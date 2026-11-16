// Bots: bodies, senses and tactics. Each bot runs a small state machine —
// advance along a route, hold a post, engage what it sees, investigate what
// it hears, plant or defuse the charge. Senses tick on a stagger so all six
// bots never raycast on the same step.
import * as THREE from 'three';
import { MAP } from './mapdata.js';
import { PALETTE, WEAPONS } from './config.js';
import { findPath, nearestNode, moveCircle, insideSite } from './collision.js';
import { createBotState } from './state.js';
import { damageCharacter } from './weapons.js';
import { makeGlowTexture } from './effects.js';
import { pick, range } from './random.js';

const EYE = 1.55;
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();

function buildBotMesh(scene, bot) {
  const teamColor = bot.team === 'wardens' ? PALETTE.warden : PALETTE.ember;
  const darkColor = bot.team === 'wardens' ? PALETTE.wardenDark : PALETTE.emberDark;
  const group = new THREE.Group();
  const mat = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
  const bodyMat = mat(teamColor);
  const darkMat = mat(darkColor);
  const skinMat = mat(0xc9a17e);

  const legGeometry = new THREE.BoxGeometry(0.17, 0.75, 0.17);
  legGeometry.translate(0, -0.375, 0);
  const legL = new THREE.Mesh(legGeometry, darkMat);
  legL.position.set(-0.11, 0.75, 0);
  const legR = new THREE.Mesh(legGeometry, darkMat);
  legR.position.set(0.11, 0.75, 0);
  legL.castShadow = true;
  legR.castShadow = true;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), bodyMat);
  torso.position.y = 1.08;
  torso.castShadow = true;
  torso.userData.bot = bot;
  torso.userData.part = 'body';
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.34), darkMat);
  vest.position.y = 1.12;
  vest.userData.bot = bot;
  vest.userData.part = 'body';

  const armGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.5);
  const armL = new THREE.Mesh(armGeometry, bodyMat);
  armL.position.set(-0.2, 1.28, -0.18);
  const armR = new THREE.Mesh(armGeometry, bodyMat);
  armR.position.set(0.2, 1.28, -0.18);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), skinMat);
  head.position.y = 1.58;
  head.castShadow = true;
  head.userData.bot = bot;
  head.userData.part = 'head';
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), darkMat);
  helmet.position.y = 1.6;
  helmet.userData.bot = bot;
  helmet.userData.part = 'head';
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.3, metalness: 0.6 }));
  visor.position.set(0, 1.6, -0.15);

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.72), mat(0x22242a, 0.5));
  gun.position.set(0.14, 1.3, -0.42);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.34),
    new THREE.MeshBasicMaterial({ map: makeGlowTexture(), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  flash.position.set(0.14, 1.3, -0.82);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.16), mat(PALETTE.accent, 0.7));
  pack.position.set(0, 1.12, 0.24);
  pack.visible = false;

  group.add(legL, legR, torso, vest, armL, armR, head, helmet, visor, gun, flash, pack);
  group.visible = false;
  scene.add(group);
  bot.mesh = group;
  bot.headMesh = head;
  bot.bodyMesh = torso;
  bot.parts = { legL, legR, armL, armR, flash, pack, hitMeshes: [torso, vest, head, helmet] };
  bot.walkPhase = 0;
  bot.flashTime = 0;
  return group;
}

export function createBots(scene, combat) {
  return {
    spawn(S) {
      S.bots.length = 0;
      const names = ['Rook', 'Vex', 'Sable', 'Onyx', 'Juno', 'Pike'];
      const attackerSpawns = MAP.spawns.attackers;
      const defenderSpawns = MAP.spawns.defenders;
      for (let i = 0; i < 4; i += 1) {
        const bot = makeBot(S, i, 'embers', names[i], attackerSpawns[i]);
        bot.weapon = i === 3 ? 'mako' : 'kr7';
        const def = WEAPONS[bot.weapon];
        bot.mag = def.mag;
        bot.reserve = def.reserveMax;
        S.bots.push(bot);
      }
      for (let i = 0; i < 2; i += 1) {
        const bot = makeBot(S, 4 + i, 'wardens', names[4 + i], defenderSpawns[i + 1]);
        bot.weapon = i === 1 ? 'longshot' : 'kr7';
        const def = WEAPONS[bot.weapon];
        bot.mag = def.mag;
        bot.reserve = def.reserveMax;
        S.bots.push(bot);
      }
      for (const bot of S.bots) {
        if (!bot.mesh) buildBotMesh(scene, bot);
        for (const mesh of bot.parts.hitMeshes) {
          if (!combat.hitMeshes.includes(mesh)) combat.hitMeshes.push(mesh);
        }
        bot.mesh.visible = true;
        bot.mesh.position.set(bot.x, 0, bot.z);
        bot.mesh.rotation.set(0, bot.yaw, 0);
        bot.parts.pack.visible = bot.hasBomb;
      }
      combat.refreshTargets();
    },
  };

  function makeBot(S, index, team, name, spawn) {
    const bot = createBotState(index, team, name);
    bot.x = spawn.x;
    bot.z = spawn.z;
    bot.lastX = spawn.x;
    bot.lastZ = spawn.z;
    bot.yaw = team === 'embers' ? Math.PI : 0;
    bot.scanPhase = S.random() * Math.PI * 2;
    bot.senseTimer = index * 0.05;
    return bot;
  }
}

// Assign round plans: three attackers to one site, one lurks to the other;
// the carrier takes the main site. Defenders take their posts.
export function assignPlans(S) {
  const mainSite = S.random() < 0.5 ? 'A' : 'B';
  const otherSite = mainSite === 'A' ? 'B' : 'A';
  const attackers = S.bots.filter((b) => b.team === 'embers');
  attackers.forEach((bot, i) => {
    bot.site = i === 3 ? otherSite : mainSite;
    const routes = MAP.plans[bot.site];
    bot.route = [...pick(S.random, routes)];
    bot.routeIndex = 1;
    bot.mode = 'advance';
    bot.hasBomb = i === 0;
    bot.target = null;
    bot.channel = 0;
    bot.channelKind = null;
  });
  const defenders = S.bots.filter((b) => b.team === 'wardens');
  defenders.forEach((bot, i) => {
    const post = MAP.defenderPosts[i];
    bot.holdNode = post.node;
    bot.holdYaw = post.yaw;
    const start = nearestNode(bot.x, bot.z);
    bot.route = findPath(start, post.node);
    bot.routeIndex = 1;
    bot.mode = 'advance';
    bot.target = null;
  });
  const carrier = attackers[0];
  S.bomb.state = 'carried';
  S.bomb.carrier = carrier;
  S.bomb.site = null;
  S.bomb.fuse = 0;
  S.bomb.plantProgress = 0;
  S.bomb.defuseProgress = 0;
}

function visibleEnemies(S, bot, combat) {
  const seen = [];
  const enemies = bot.team === 'embers'
    ? [S.player, ...S.bots.filter((b) => b.team === 'wardens')]
    : [...S.bots.filter((b) => b.team === 'embers')];
  _from.set(bot.x, EYE, bot.z);
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - bot.x;
    const dz = enemy.z - bot.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 46) continue;
    const angle = Math.atan2(-dx, -dz);
    let diff = angle - bot.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 1.15 && distance > 6) continue;
    const eyeY = enemy === S.player && enemy.crouched ? 1.0 : 1.3;
    _to.set(enemy.x, eyeY, enemy.z);
    if (combat.occluded(S, _from, _to)) continue;
    seen.push({ enemy, distance });
  }
  seen.sort((a, b) => a.distance - b.distance);
  return seen;
}

function hearShots(S, bot) {
  if (bot.mode === 'engage') return;
  for (const event of S.events) {
    if (event.team === bot.team) continue;
    if (S.time - event.time > 1.2) continue;
    const distance = Math.hypot(event.x - bot.x, event.z - bot.z);
    if (distance > event.radius) continue;
    bot.investigateX = event.x;
    bot.investigateZ = event.z;
    bot.investigateUntil = S.time + 2.5;
    bot.yaw = Math.atan2(-(event.x - bot.x), -(event.z - bot.z));
    if (bot.mode === 'hold') {
      bot.resumeMode = 'hold';
      bot.mode = 'investigate';
    }
  }
}

function moveToward(S, bot, tx, tz, speed, dt) {
  const dx = tx - bot.x;
  const dz = tz - bot.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.05) return true;
  const step = Math.min(distance, speed * dt);
  const nx = (dx / distance) * step;
  const nz = (dz / distance) * step;
  const pos = { x: bot.x, z: bot.z };
  moveCircle(pos, nx, nz, 0.38);
  const moved = Math.hypot(pos.x - bot.x, pos.z - bot.z);
  bot.x = pos.x;
  bot.z = pos.z;
  bot.speed2d = moved / Math.max(dt, 1e-6);
  bot.walkPhase += bot.speed2d * dt * 2.4;
  // Stuck detection: barely moving while trying to move.
  if (moved < step * 0.25) bot.stuckTime += dt;
  else bot.stuckTime = 0;
  return distance <= 0.8;
}

function followRoute(S, bot, dt, speed) {
  if (bot.routeIndex >= bot.route.length) return true;
  const node = MAP.nodes[bot.route[bot.routeIndex]];
  if (!node) { bot.routeIndex += 1; return false; }
  const arrived = moveToward(S, bot, node.x, node.z, speed, dt);
  if (bot.stuckTime > 0.9) {
    // Sidestep and skip the node: a crate or a teammate is in the way.
    bot.stuckTime = 0;
    bot.routeIndex += 1;
    return false;
  }
  if (arrived) bot.routeIndex += 1;
  return bot.routeIndex >= bot.route.length;
}

function aimAt(bot, tx, tz, dt, rate = 7) {
  const want = Math.atan2(-(tx - bot.x), -(tz - bot.z));
  let diff = want - bot.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxTurn = rate * dt;
  bot.yaw += Math.abs(diff) < maxTurn ? diff : Math.sign(diff) * maxTurn;
}

function botShoot(S, bot, combat, effects, audio) {
  const def = WEAPONS[bot.weapon];
  if (bot.reloading > 0) return;
  if (bot.mag <= 0) {
    if (bot.reserve > 0) bot.reloading = def.reload;
    return;
  }
  const target = bot.target;
  if (!target || !target.alive) return;
  const headshot = S.random() < 0.14;
  const aimY = headshot ? 1.58 : 1.28;
  _from.set(bot.x, EYE, bot.z);
  _to.set(target.x, aimY, target.z);
  if (combat.occluded(S, _from, _to)) return;
  _dir.subVectors(_to, _from).normalize();
  const distance = _from.distanceTo(_to);
  const error = bot.aimError + distance * 0.0009 + (target.speed2d ?? 0) * 0.004;
  _dir.x += (S.random() * 2 - 1) * error;
  _dir.y += (S.random() * 2 - 1) * error;
  _dir.z += (S.random() * 2 - 1) * error;
  _dir.normalize();
  bot.mag -= 1;
  bot.flashTime = 0.05;
  bot.fireCooldown = def.interval;
  const muzzle = _muzzle.copy(_from);
  muzzle.y -= 0.25;
  const result = combat.shoot(S, muzzle, _dir, def, bot, effects);
  effects.muzzleFlash(muzzle);
  audio.shoot(bot.weapon, Math.hypot(bot.x - S.player.x, bot.z - S.player.z));
  S.events.push({ kind: 'shot', x: bot.x, z: bot.z, team: bot.team, time: S.time, radius: 26 });
  if (result.hit) {
    let damage = def.damage * combat.damageFalloff(def, result.distance);
    if (result.part === 'head') damage *= def.headMult;
    const victim = result.player ? S.player : result.bot;
    damageCharacter(S, victim, damage, result.part, bot, audio);
  }
}

export function stepBot(S, bot, dt, combat, effects, audio) {
  if (!bot.alive) {
    bot.deadTime += dt;
    if (bot.mesh) {
      const fall = Math.min(1, bot.deadTime / 0.3);
      bot.mesh.rotation.x = fall * (Math.PI / 2) * 0.94;
      if (bot.deadTime > 4) bot.mesh.position.y = -Math.min(1.2, (bot.deadTime - 4) * 0.8);
    }
    return;
  }
  bot.fireCooldown = Math.max(0, bot.fireCooldown - dt);
  bot.flashTime = Math.max(0, bot.flashTime - dt);
  if (bot.reloading > 0) {
    bot.reloading -= dt;
    if (bot.reloading <= 0) {
      const def = WEAPONS[bot.weapon];
      const take = Math.min(def.mag - bot.mag, bot.reserve);
      bot.mag += take;
      bot.reserve -= take;
    }
  }
  const blinded = S.time < bot.blindUntil;
  if (blinded) {
    syncBotMesh(bot, dt);
    return;
  }

  // Senses, staggered across bots.
  bot.senseTimer -= dt;
  if (bot.senseTimer <= 0) {
    bot.senseTimer = 0.15;
    const seen = visibleEnemies(S, bot, combat);
    if (seen.length > 0) {
      const first = seen[0];
      bot.lastSeenX = first.enemy.x;
      bot.lastSeenZ = first.enemy.z;
      bot.lastSeenTime = S.time;
      if (bot.mode !== 'engage') {
        bot.target = first.enemy;
        bot.resumeMode = bot.mode;
        bot.mode = 'engage';
        bot.reactUntil = S.time + range(S.random, 0.28, 0.5);
        bot.burstLeft = 0;
        bot.burstPause = 0;
      } else {
        bot.target = first.enemy;
      }
    } else if (bot.mode === 'engage' && S.time - bot.lastSeenTime > 3) {
      bot.target = null;
      bot.investigateX = bot.lastSeenX;
      bot.investigateZ = bot.lastSeenZ;
      bot.investigateUntil = S.time + 3;
      bot.mode = 'investigate';
    }
    hearShots(S, bot);
  }

  switch (bot.mode) {
    case 'advance': {
      const done = followRoute(S, bot, dt, 3.7);
      if (bot.routeIndex < bot.route.length) {
        const node = MAP.nodes[bot.route[bot.routeIndex]];
        if (node) aimAt(bot, node.x, node.z, dt, 6);
      }
      if (done) {
        if (bot.team === 'embers' && bot.hasBomb && S.bomb.state === 'carried') {
          bot.mode = 'plant';
          bot.channel = 0;
        } else if (bot.team === 'embers') {
          const holds = MAP.siteHolds[bot.site];
          bot.holdNode = holds[bot.index % holds.length];
          const start = nearestNode(bot.x, bot.z);
          bot.route = findPath(start, bot.holdNode);
          bot.routeIndex = 1;
          bot.mode = 'toHold';
        } else {
          bot.mode = 'hold';
        }
      }
      break;
    }
    case 'toHold': {
      const done = followRoute(S, bot, dt, 3.7);
      if (done) {
        bot.mode = 'hold';
        bot.holdYaw = bot.yaw;
      }
      break;
    }
    case 'hold': {
      bot.scanPhase += dt * 0.5;
      bot.yaw = bot.holdYaw + Math.sin(bot.scanPhase) * 0.55;
      bot.speed2d = 0;
      break;
    }
    case 'investigate': {
      aimAt(bot, bot.investigateX, bot.investigateZ, dt, 6);
      const arrived = moveToward(S, bot, bot.investigateX, bot.investigateZ, 3.4, dt);
      if (arrived || S.time > bot.investigateUntil) {
        bot.mode = bot.resumeMode === 'hold' ? 'hold' : 'advance';
        if (bot.mode === 'advance' && bot.team === 'wardens') {
          const start = nearestNode(bot.x, bot.z);
          bot.route = findPath(start, bot.holdNode);
          bot.routeIndex = 1;
        }
      }
      break;
    }
    case 'engage': {
      const target = bot.target;
      if (!target || !target.alive) {
        bot.mode = 'investigate';
        bot.investigateX = bot.lastSeenX;
        bot.investigateZ = bot.lastSeenZ;
        bot.investigateUntil = S.time + 2;
        break;
      }
      aimAt(bot, target.x, target.z, dt, 9);
      // Strafe to be a harder target, pausing to shoot straight.
      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeTimer = range(S.random, 0.7, 1.4);
        bot.strafeDir *= -1;
      }
      const sideX = Math.cos(bot.yaw) * bot.strafeDir;
      const sideZ = -Math.sin(bot.yaw) * bot.strafeDir;
      const pos = { x: bot.x, z: bot.z };
      moveCircle(pos, sideX * 1.9 * dt, sideZ * 1.9 * dt, 0.38);
      bot.x = pos.x;
      bot.z = pos.z;
      bot.speed2d = 1.9;
      bot.walkPhase += bot.speed2d * dt * 2.4;
      if (S.time >= bot.reactUntil && bot.fireCooldown <= 0) {
        if (bot.burstLeft <= 0) {
          if (bot.burstPause <= 0) {
            bot.burstLeft = bot.weapon === 'longshot' ? 1 : 3 + Math.floor(S.random() * 3);
            bot.burstPause = range(S.random, 0.35, 0.65);
          } else {
            bot.burstPause -= dt;
          }
        }
        if (bot.burstLeft > 0) {
          botShoot(S, bot, combat, effects, audio);
          bot.burstLeft -= 1;
        }
      }
      break;
    }
    case 'plant': {
      bot.speed2d = 0;
      const site = MAP.sites[bot.site];
      if (!insideSite(site, bot.x, bot.z)) {
        bot.route = findPath(nearestNode(bot.x, bot.z), bot.site === 'A' ? 'AS' : 'BS');
        bot.routeIndex = 1;
        bot.mode = 'advance';
        break;
      }
      bot.channel += dt;
      S.bomb.plantProgress = bot.channel / 3;
      if (bot.channel >= 3) {
        S.bomb.state = 'planted';
        S.bomb.site = bot.site;
        S.bomb.x = bot.x;
        S.bomb.z = bot.z;
        S.bomb.fuse = 35;
        S.bomb.carrier = null;
        bot.hasBomb = false;
        bot.parts.pack.visible = false;
        bot.mode = 'hold';
        bot.holdYaw = bot.yaw;
        S.killfeed.unshift({ text: `Charge planted at Site ${bot.site}`, team: 'embers', time: S.time });
        audio.plantTick();
      }
      break;
    }
    case 'fetch': {
      const arrived = moveToward(S, bot, S.bomb.x, S.bomb.z, 4.0, dt);
      aimAt(bot, S.bomb.x, S.bomb.z, dt, 6);
      if (arrived || Math.hypot(S.bomb.x - bot.x, S.bomb.z - bot.z) < 1.3) {
        if (S.bomb.state === 'dropped') {
          S.bomb.state = 'carried';
          S.bomb.carrier = bot;
          bot.hasBomb = true;
          bot.parts.pack.visible = true;
          const start = nearestNode(bot.x, bot.z);
          bot.route = findPath(start, bot.site === 'A' ? 'AS' : 'BS');
          bot.routeIndex = 1;
          bot.mode = 'advance';
        } else {
          bot.mode = 'hold';
        }
      }
      break;
    }
    case 'defuse': {
      bot.speed2d = 0;
      bot.channel += dt;
      S.bomb.defuseProgress = bot.channel / 5;
      if (bot.channel >= 5) {
        S.bomb.state = 'defused';
        bot.mode = 'hold';
      }
      break;
    }
    case 'rotate': {
      const done = followRoute(S, bot, dt, 4.0);
      if (done) {
        if (S.bomb.state === 'planted') {
          const distance = Math.hypot(S.bomb.x - bot.x, S.bomb.z - bot.z);
          if (distance < 2.4) {
            bot.mode = 'defuse';
            bot.channel = 0;
          } else {
            bot.route = findPath(nearestNode(bot.x, bot.z), S.bomb.site === 'A' ? 'AS' : 'BS');
            bot.routeIndex = 1;
          }
        } else {
          bot.mode = 'hold';
        }
      }
      break;
    }
    default:
      break;
  }
  syncBotMesh(bot, dt);
}

function syncBotMesh(bot, dt) {
  if (!bot.mesh) return;
  bot.mesh.position.x = bot.x;
  bot.mesh.position.z = bot.z;
  bot.mesh.rotation.y = bot.yaw;
  const swing = Math.sin(bot.walkPhase) * Math.min(0.6, bot.speed2d * 0.14);
  bot.parts.legL.rotation.x = swing;
  bot.parts.legR.rotation.x = -swing;
  bot.parts.armL.rotation.x = -swing * 0.4;
  bot.parts.armR.rotation.x = swing * 0.4;
  bot.parts.flash.material.opacity = bot.flashTime > 0 ? 0.95 : 0;
  bot.parts.pack.visible = bot.hasBomb;
  if (bot.flashTime > 0) bot.parts.flash.rotation.z = Math.random() * Math.PI;
}

// Round-level bot coordination: fetch a dropped charge, rotate on a plant.
export function coordinateBots(S) {
  if (S.bomb.state === 'dropped') {
    const fetchers = S.bots.filter((b) => b.alive && b.team === 'embers' && b.mode === 'fetch');
    if (fetchers.length === 0) {
      let best = null;
      let bestD = Infinity;
      for (const bot of S.bots) {
        if (!bot.alive || bot.team !== 'embers' || bot.mode === 'engage') continue;
        const d = Math.hypot(bot.x - S.bomb.x, bot.z - S.bomb.z);
        if (d < bestD) { bestD = d; best = bot; }
      }
      if (best) {
        best.mode = 'fetch';
        best.channel = 0;
      }
    }
  }
  if (S.bomb.state === 'planted') {
    for (const bot of S.bots) {
      if (!bot.alive || bot.team !== 'wardens') continue;
      if (bot.mode === 'engage' || bot.mode === 'defuse' || bot.mode === 'rotate') continue;
      bot.route = findPath(nearestNode(bot.x, bot.z), S.bomb.site === 'A' ? 'AS' : 'BS');
      bot.routeIndex = 1;
      bot.mode = 'rotate';
      bot.channel = 0;
    }
  }
}
