// Staged screenshot scenes. Each one plays the real rules — the sim steps,
// the shots fired are real hitscan, the HUD reads the real state — then the
// frame freezes for capture. Nothing here draws outside the game's own code.
import { WEAPONS } from './config.js';
import { damageCharacter, currentWeapon } from './weapons.js';

const STEP = 1 / 60;

function fakeInput() {
  return { keys: new Set(), pressed: new Set(), firing: false, aiming: false };
}

function aimAtPoint(S, x, y, z) {
  const player = S.player;
  const eyeY = player.y + 1.62;
  const dx = x - player.x;
  const dy = y - eyeY;
  const dz = z - player.z;
  player.yaw = Math.atan2(-dx, -dz);
  player.pitch = Math.asin(Math.max(-1, Math.min(1, dy / Math.hypot(dx, dy, dz))));
}

function settle(api, input, steps) {
  for (let i = 0; i < steps; i += 1) api.stepSim(STEP, input);
}

function giveRifle(S) {
  S.player.primary = 'kr7';
  S.player.slot = 'primary';
  S.player.mag.kr7 = WEAPONS.kr7.mag;
  S.player.reserve.kr7 = WEAPONS.kr7.reserveMax;
}

function finishFrame(api, spreadPx = 10, prompt = null) {
  const def = currentWeapon(api.S.player);
  api.syncCamera();
  api.viewmodel.show(api.S.player.slot === 'grenade' ? null : def?.id ?? 'p9', null);
  api.viewmodel.update(0.016, api.S.player, false, false);
  api.hud.update(api.S, spreadPx, prompt);
}

function stageCombat(api) {
  const { S } = api;
  const input = fakeInput();
  settle(api, input, 370); // past the freeze, round live
  giveRifle(S);
  S.player.money = 1100;
  S.player.kills = 1;
  S.round = 2;
  S.wins.wardens = 1;
  S.phaseTime = 62;
  S.player.x = 0;
  S.player.z = 7.5;
  S.player.health = 84;
  const rook = S.bots[0];
  const vex = S.bots[1];
  const juno = S.bots[4];
  rook.x = 0.5; rook.z = -5.5; rook.mode = 'hold'; rook.holdYaw = Math.PI; rook.health = 66;
  vex.x = -3.5; vex.z = -8.5; vex.mode = 'hold'; vex.holdYaw = Math.PI * 0.9;
  juno.x = -2.6; juno.z = 9.5; juno.mode = 'hold'; juno.holdYaw = 0;
  S.killfeed.unshift({ text: 'You ▸ Vex (headshot)', team: 'wardens', time: S.time });
  settle(api, input, 25);
  // The enemy opens fire first: its tracer and muzzle flash are in frame.
  rook.mode = 'engage';
  rook.target = S.player;
  rook.reactUntil = S.time;
  rook.burstLeft = 3;
  rook.fireCooldown = 0;
  settle(api, input, 4);
  // The player answers with a burst down mid.
  aimAtPoint(S, rook.x, 1.3, rook.z);
  api.syncCamera();
  for (let i = 0; i < 3; i += 1) {
    api.firePlayerBullet();
    settle(api, input, 6);
  }
  aimAtPoint(S, rook.x, 1.3, rook.z);
  api.syncCamera();
  api.firePlayerBullet();
  finishFrame(api, 14);
}

function stageBuy(api) {
  const { S } = api;
  const input = fakeInput();
  settle(api, input, 110); // freeze at ~4 seconds left
  S.player.money = 3400;
  S.player.x = 0;
  S.player.z = 18.5;
  S.player.yaw = 0;
  S.player.pitch = 0;
  S.buyOpen = true;
  settle(api, input, 10);
  finishFrame(api, 8);
}

function stageObjective(api) {
  const { S } = api;
  const input = fakeInput();
  settle(api, input, 370);
  giveRifle(S);
  S.round = 3;
  S.wins.wardens = 1;
  S.wins.embers = 1;
  S.bomb.state = 'planted';
  S.bomb.site = 'A';
  S.bomb.x = -23;
  S.bomb.z = -6.5;
  S.bomb.fuse = 18;
  S.player.x = -21.4;
  S.player.z = -6.5;
  S.player.health = 71;
  S.player.money = 2050;
  const rook = S.bots[0];
  rook.x = -26; rook.z = -9.5; rook.mode = 'hold'; rook.holdYaw = Math.PI * 0.6;
  const sable = S.bots[2];
  sable.alive = false;
  sable.health = 0;
  sable.x = -24.5; sable.z = -4.2;
  S.killfeed.unshift({ text: 'Charge planted at Site A', team: 'embers', time: S.time });
  S.killfeed.unshift({ text: 'You ▸ Sable', team: 'wardens', time: S.time });
  settle(api, input, 25);
  S.player.health = 71;
  S.player.damageFlash = 0;
  S.player.defusing = 2.0;
  aimAtPoint(S, S.bomb.x, 0.4, S.bomb.z);
  finishFrame(api, 8);
}

function stageEnd(api) {
  const { S } = api;
  const input = fakeInput();
  settle(api, input, 370);
  giveRifle(S);
  S.round = 4;
  S.player.x = 0;
  S.player.z = 7.5;
  S.player.health = 62;
  S.player.money = 2500;
  S.player.mag.kr7 = 18;
  const rook = S.bots[0];
  rook.x = 1.5; rook.z = 4.0; rook.mode = 'hold'; rook.holdYaw = Math.PI;
  const juno = S.bots[4];
  juno.x = -3; juno.z = 6; juno.mode = 'hold'; juno.holdYaw = 0;
  settle(api, input, 20);
  aimAtPoint(S, rook.x, 0.5, rook.z);
  damageCharacter(S, rook, 200, 'head', S.player, api.audio);
  for (const bot of S.bots) {
    if (bot.team === 'embers' && bot.alive) damageCharacter(S, bot, 200, 'body', S.player, api.audio);
  }
  settle(api, input, 20); // the fallen bot drops; the round resolves
  S.phase = 'end';
  S.phaseTime = 2;
  S.wins.wardens = 3;
  S.wins.embers = 1;
  S.roundWinner = 'wardens';
  S.roundReason = 'Attackers eliminated';
  S.banner = { text: 'ROUND WON', sub: 'Attackers eliminated', team: 'wardens', until: S.time + 9999 };
  S.player.damageFlash = 0;
  finishFrame(api, 8);
}

export function runShot(name, api) {
  if (name === 'buy') stageBuy(api);
  else if (name === 'objective') stageObjective(api);
  else if (name === 'end') stageEnd(api);
  else stageCombat(api);
}
