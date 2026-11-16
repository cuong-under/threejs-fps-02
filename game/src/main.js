// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the
// display's rate. ?shot=<name>&seed=N stages a deterministic frame for a
// capture; ?selftest=1 runs scripted play checks and reports into the DOM.
import * as THREE from 'three';
import { PALETTE, SIM, WEAPONS, ROUNDS } from './config.js';
import { createState } from './state.js';
import { mulberry32 } from './random.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createPlayerController } from './player.js';
import { createCombat, computeSpread, applyDirectionSpread, currentWeapon, damageCharacter } from './weapons.js';
import { createBots, stepBot, coordinateBots } from './bots.js';
import { createEffects } from './effects.js';
import { createGrenadeSystem } from './grenades.js';
import { createViewmodel } from './viewmodel.js';
import { createHud } from './hud.js';
import { startRound, stepRounds, buy, interactStatus } from './rounds.js';
import { runShot } from './shots.js';

const FIXED_STEP = SIM.step;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const selftest = params.get('selftest') === '1';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyTop);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 220);
camera.position.set(0, 1.62, 18.5);
scene.add(camera);

const world = createWorld(scene);
const combat = createCombat(scene, world.shootables);
const effects = createEffects(scene);
const audio = createAudio();
const S = createState(mulberry32(seed));
const botsApi = createBots(scene, combat);
const grenadeSystem = createGrenadeSystem(scene);
const viewmodel = createViewmodel(camera);
const playerController = createPlayerController();

// Invisible hitbox that follows the player, so bots shoot the same geometry
// the player shoots at them with.
const playerHitGroup = new THREE.Group();
const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
const playerBodyHit = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 0.35), hitMaterial);
playerBodyHit.position.y = 1.0;
playerBodyHit.userData.isPlayer = true;
playerBodyHit.userData.part = 'body';
const playerHeadHit = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), hitMaterial);
playerHeadHit.position.y = 1.55;
playerHeadHit.userData.isPlayer = true;
playerHeadHit.userData.part = 'head';
playerHitGroup.add(playerBodyHit, playerHeadHit);
scene.add(playerHitGroup);
combat.setPlayerHit([playerBodyHit, playerHeadHit]);

// The charge: a small amber case with a blinking lamp, visible when dropped
// or planted.
const bombGroup = new THREE.Group();
const bombCase = new THREE.Mesh(
  new THREE.BoxGeometry(0.42, 0.24, 0.3),
  new THREE.MeshStandardMaterial({ color: PALETTE.accent, roughness: 0.6 }),
);
bombCase.position.y = 0.12;
bombCase.castShadow = true;
const bombLamp = new THREE.Mesh(
  new THREE.SphereGeometry(0.05, 8, 6),
  new THREE.MeshBasicMaterial({ color: 0xff3020 }),
);
bombLamp.position.set(0.12, 0.28, 0);
bombGroup.add(bombCase, bombLamp);
bombGroup.visible = false;
scene.add(bombGroup);

const hud = createHud({
  onPlay: () => {
    audio.unlock();
    if (S.phase === 'matchEnd') {
      S.wins.wardens = 0;
      S.wins.embers = 0;
      S.round = 1;
      startRound(S, botsApi, false);
    }
    S.started = true;
    hud.hideOverlay();
    input.requestLock();
  },
  onBuy: (id) => buy(S, id, audio),
  onResume: () => {
    S.buyOpen = false;
    input.requestLock();
  },
});

const input = createInput(renderer.domElement, (locked) => {
  if (shot || selftest) return;
  if (locked) {
    S.started = true;
    hud.hideOverlay();
  } else if (S.started && S.phase !== 'matchEnd' && !S.buyOpen) {
    hud.showOverlay('paused', S);
  }
});

const _forward = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _eye = new THREE.Vector3();
let prevFiring = false;
let eyeCurrent = SIM.eyeStanding;
let grenadeCooldown = 0;
let defuseTick = 0;
let stepDistance = 0;
let frozen = false;
let fovCurrent = 74;
let lastTime = performance.now();
let accumulator = 0;

startRound(S, botsApi, false);
S.buyOpen = false;
hud.showOverlay('start', S);

function syncCamera() {
  const player = S.player;
  const targetEye = player.crouched ? SIM.eyeCrouch : SIM.eyeStanding;
  eyeCurrent += (targetEye - eyeCurrent) * 0.25;
  camera.position.set(player.x, player.y + eyeCurrent, player.z);
  const shake = S.shake;
  const shakePitch = shake > 0 ? (Math.random() - 0.5) * shake * 0.03 : 0;
  const shakeYaw = shake > 0 ? (Math.random() - 0.5) * shake * 0.03 : 0;
  camera.rotation.set(player.pitch + shakePitch, player.yaw + shakeYaw, 0, 'YXZ');
  const aiming = input.state.aiming && player.slot !== 'grenade';
  const def = currentWeapon(player);
  const targetFov = aiming && def ? 74 / def.zoom : aiming ? 62 : 74;
  fovCurrent += (targetFov - fovCurrent) * 0.2;
  if (Math.abs(fovCurrent - camera.fov) > 0.05) {
    camera.fov = fovCurrent;
    camera.updateProjectionMatrix();
  }
  playerHitGroup.position.set(player.x, player.y, player.z);
  playerHitGroup.rotation.y = player.yaw;
  playerHitGroup.visible = player.alive;
  if (player.crouched) {
    playerBodyHit.position.y = 0.72;
    playerBodyHit.scale.y = 0.72;
    playerHeadHit.position.y = 1.18;
  } else {
    playerBodyHit.position.y = 1.0;
    playerBodyHit.scale.y = 1;
    playerHeadHit.position.y = 1.55;
  }
  bombGroup.visible = S.bomb.state === 'dropped' || S.bomb.state === 'planted';
  if (bombGroup.visible) {
    bombGroup.position.set(S.bomb.x, 0, S.bomb.z);
    const rate = S.bomb.state === 'planted' ? (S.bomb.fuse < 10 ? 14 : 6) : 2;
    bombLamp.material.color.setHex(Math.sin(S.time * rate) > 0 ? 0xff3020 : 0x551008);
  }
}

function firePlayerBullet() {
  const player = S.player;
  const def = currentWeapon(player);
  if (!def) return;
  if (player.mag[def.id] <= 0) {
    audio.dryFire();
    startReload();
    return;
  }
  player.mag[def.id] -= 1;
  player.fireCooldown = def.interval;
  S.stats.shotsFired += 1;
  camera.getWorldDirection(_forward);
  const spread = computeSpread(S, player, def, input.state.aiming);
  const direction = applyDirectionSpread(S.random, _forward, spread);
  _eye.copy(camera.position);
  viewmodel.muzzleWorld(_muzzle);
  const result = combat.shoot(S, _eye, direction, def, 'player', effects, _muzzle);
  effects.muzzleFlash(_muzzle);
  viewmodel.onShot();
  audio.shoot(def.id, 0);
  S.events.push({ kind: 'shot', x: player.x, z: player.z, team: 'wardens', time: S.time, radius: 26 });
  playerController.recoil(player, def.recoil * (0.8 + S.random() * 0.4), (S.random() * 2 - 1) * def.recoil * 0.35);
  player.bloom = Math.min(def.maxBloom, player.bloom + def.bloom);
  if (result.hit) {
    S.stats.shotsHit += 1;
    if (result.part === 'head') S.stats.headshots += 1;
    hud.hitMarker(result.part === 'head', shot ? 4000 : 120);
    audio.hit(result.part === 'head');
    let damage = def.damage * combat.damageFalloff(def, result.distance);
    if (result.part === 'head') damage *= def.headMult;
    damageCharacter(S, result.bot, damage, result.part, player, audio);
  }
}

function startReload() {
  const player = S.player;
  const def = currentWeapon(player);
  if (!def || player.reloading > 0) return;
  if (player.mag[def.id] >= def.mag || player.reserve[def.id] <= 0) return;
  player.reloading = def.reload;
  player.reloadWeapon = def.id;
  audio.reload();
}

function finishReload() {
  const player = S.player;
  const def = WEAPONS[player.reloadWeapon];
  if (!def) return;
  const take = Math.min(def.mag - player.mag[def.id], player.reserve[def.id]);
  player.mag[def.id] += take;
  player.reserve[def.id] -= take;
  player.reloadWeapon = null;
}

function switchSlot(slot, grenadeKind) {
  const player = S.player;
  if (slot === 'primary' && !player.primary) return;
  if (slot === 'grenade' && (!grenadeKind || player.grenades[grenadeKind] <= 0)) return;
  player.slot = slot;
  player.grenadeKind = grenadeKind ?? null;
  player.reloading = 0;
  player.reloadWeapon = null;
  player.fireCooldown = Math.max(player.fireCooldown, 0.18);
}

function throwGrenade() {
  const player = S.player;
  const kind = player.grenadeKind;
  if (!kind || player.grenades[kind] <= 0 || grenadeCooldown > 0) return;
  camera.getWorldDirection(_forward);
  _eye.copy(camera.position);
  if (grenadeSystem.throw(S, player, _eye, _forward, kind)) {
    player.grenades[kind] -= 1;
    grenadeCooldown = 0.6;
    if (player.grenades[kind] <= 0) switchSlot('side');
  }
}

function stepSim(dt, inputState) {
  const player = S.player;
  S.time += dt;
  S.shake = Math.max(0, S.shake - dt * 1.6);
  player.damageFlash = Math.max(0, player.damageFlash - dt * 2.2);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  grenadeCooldown = Math.max(0, grenadeCooldown - dt);
  player.bloom = Math.max(0, player.bloom - dt * 0.05);
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) finishReload();
  }

  const frozenPhase = S.phase === 'freeze' || S.phase === 'end' || S.phase === 'matchEnd';
  playerController.step(player, inputState.keys, dt, frozenPhase);

  // Footsteps: quiet when sneaking or crouched, audible to bots otherwise.
  if (player.alive && player.onGround && player.speed2d > 0.5) {
    stepDistance += player.speed2d * dt;
    if (stepDistance > 2.4) {
      stepDistance = 0;
      const quiet = player.crouched || inputState.keys.has('ShiftLeft');
      audio.step(0);
      if (!quiet) S.events.push({ kind: 'step', x: player.x, z: player.z, team: 'wardens', time: S.time, radius: 9 });
    }
  }

  if (S.started && !frozenPhase && player.alive && !S.buyOpen) {
    const def = currentWeapon(player);
    const triggerEdge = inputState.firing && !prevFiring;
    if (player.slot === 'grenade') {
      if (triggerEdge) throwGrenade();
    } else if (def) {
      const wantFire = def.auto ? inputState.firing : triggerEdge;
      if (wantFire && player.fireCooldown <= 0 && player.reloading <= 0) firePlayerBullet();
    }
    if (inputState.pressed.has('KeyR')) startReload();
    if (inputState.pressed.has('Digit1')) switchSlot('primary');
    if (inputState.pressed.has('Digit2')) switchSlot('side');
    if (inputState.pressed.has('KeyQ')) switchSlot(player.slot === 'primary' ? 'side' : 'primary');
    if (inputState.pressed.has('Digit3')) switchSlot('grenade', 'frag');
    if (inputState.pressed.has('Digit4')) switchSlot('grenade', 'flash');
    if (inputState.pressed.has('Digit5')) switchSlot('grenade', 'smoke');
  }
  if (inputState.pressed.has('KeyB') && S.phase === 'freeze' && S.started) {
    S.buyOpen = !S.buyOpen;
    if (S.buyOpen) input.releaseLock();
    else input.requestLock();
  }
  if (S.buyOpen && S.phase === 'freeze') {
    const ids = ['kr7', 'mako', 'longshot', 'armor', 'frag', 'flash', 'smoke', 'refill'];
    ids.forEach((id, i) => {
      if (inputState.pressed.has(`Digit${i + 1}`)) buy(S, id, audio);
    });
  }

  // Defuse: hold E beside the planted charge.
  const status = interactStatus(S);
  if (status === 'defuse' && inputState.keys.has('KeyE') && player.alive) {
    player.defusing += dt;
    defuseTick -= dt;
    if (defuseTick <= 0) {
      defuseTick = 0.5;
      audio.plantTick();
    }
    if (player.defusing >= ROUNDS.defuseTime) {
      S.bomb.state = 'defused';
      player.defusing = 0;
    }
  } else {
    player.defusing = Math.max(0, player.defusing - dt * 3);
  }

  if (S.phase === 'live') {
    for (const bot of S.bots) stepBot(S, bot, dt, combat, effects, audio);
    coordinateBots(S);
  } else if (S.phase === 'end') {
    // The living hold still; the fallen finish falling.
    for (const bot of S.bots) {
      if (!bot.alive) stepBot(S, bot, dt, combat, effects, audio);
    }
  }
  grenadeSystem.step(S, dt, combat, effects, audio);
  effects.step(dt);
  stepRounds(S, dt, audio, botsApi);
  if (S.phase === 'matchEnd') {
    hud.showOverlay('matchEnd', S);
    input.releaseLock();
  }
  S.events = S.events.filter((event) => S.time - event.time < 2.5);
  S.killfeed = S.killfeed.filter((entry) => S.time - entry.time < 7);
  prevFiring = inputState.firing;
  inputState.pressed.clear();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    const sensitivity = 0.0021 / (input.state.aiming ? (currentWeapon(S.player)?.zoom ?? 1) : 1);
    playerController.look(S.player, look.x, look.y, sensitivity);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      stepSim(FIXED_STEP, input.state);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    const def = currentWeapon(S.player);
    viewmodel.show(
      S.player.slot === 'grenade' ? null : def?.id ?? 'p9',
      S.player.slot === 'grenade' ? S.player.grenadeKind : null,
    );
    viewmodel.update(dt, S.player, input.state.aiming && S.player.slot !== 'grenade', S.player.reloading > 0);
  }
  renderer.render(scene, camera);
  const spread = currentWeapon(S.player)
    ? computeSpread(S, S.player, currentWeapon(S.player), input.state.aiming)
    : 0.02;
  const status = interactStatus(S);
  hud.update(S, spread * 900, status === 'defuse' ? 'HOLD E TO DEFUSE' : null);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
window.__game = {
  S, stepSim, firePlayerBullet, startReload, switchSlot, throwGrenade,
  startRound, botsApi, combat, input, syncCamera, camera, renderer, hud, effects,
  audio, viewmodel, scene,
};

if (shot) {
  S.started = true;
  hud.hideOverlay();
  runShot(shot, window.__game);
  frozen = true;
  let painted = 0;
  (function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) window.__shotReady = true;
  })();
} else if (selftest) {
  import('./selftest.js').then((module) => module.runSelfTest(window.__game));
} else {
  requestAnimationFrame(frame);
}
