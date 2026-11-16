// Scripted play checks, run only with ?selftest=1. Drives the real sim with
// a fake input device and writes PASS/FAIL lines into the DOM, so a headless
// run can prove the game plays: move, shoot, reload, run dry, hit a bot,
// throw a grenade, end a round, restart, buy, plant and defuse.
import { WEAPONS } from './config.js';
import { buy } from './rounds.js';
import { damageCharacter } from './weapons.js';

const STEP = 1 / 60;

function fakeInput() {
  return { keys: new Set(), pressed: new Set(), firing: false, aiming: false };
}

export function runSelfTest(api) {
  const { S } = api;
  const results = [];
  const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` — ${detail}`}`);
  const input = fakeInput();
  const step = (n) => { for (let i = 0; i < n; i += 1) api.stepSim(STEP, input); };
  S.started = true;
  api.hud.hideOverlay();

  try {
    check('boot: freeze phase with 6 bots', S.phase === 'freeze' && S.bots.length === 6, `${S.phase}/${S.bots.length}`);
    step(370);
    check('freeze ends into live round', S.phase === 'live', S.phase);

    // Movement: walk north, then push into the west wall.
    const z0 = S.player.z;
    input.keys.add('KeyW');
    step(60);
    input.keys.delete('KeyW');
    check('WASD movement', S.player.z < z0 - 2, `z ${z0} -> ${S.player.z}`);
    S.player.x = -29;
    S.player.z = 0;
    input.keys.add('KeyA');
    step(60);
    input.keys.delete('KeyA');
    check('wall collision holds', S.player.x >= -30 + 0.38 - 0.01, `x=${S.player.x}`);

    // Fire, reload, run dry.
    S.player.primary = 'kr7';
    S.player.slot = 'primary';
    S.player.mag.kr7 = WEAPONS.kr7.mag;
    S.player.reserve.kr7 = WEAPONS.kr7.reserveMax;
    const shotsBefore = S.stats.shotsFired;
    input.firing = true;
    step(12);
    input.firing = false;
    check('automatic fire spends ammo', S.stats.shotsFired > shotsBefore && S.player.mag.kr7 < 30,
      `shots=${S.stats.shotsFired}, mag=${S.player.mag.kr7}`);
    S.player.mag.kr7 = 5;
    input.pressed.add('KeyR');
    step(150);
    check('reload refills the magazine', S.player.mag.kr7 === 30 && S.player.reserve.kr7 === 90 - 25,
      `mag=${S.player.mag.kr7} reserve=${S.player.reserve.kr7}`);
    S.player.mag.kr7 = 0;
    S.player.reserve.kr7 = 0;
    input.firing = true;
    step(6);
    input.firing = false;
    check('empty weapon cannot fire', S.player.mag.kr7 === 0, `mag=${S.player.mag.kr7}`);
    S.player.mag.kr7 = 30;
    S.player.reserve.kr7 = 90;

    // Hit a bot with aimed fire.
    const bot = S.bots[0];
    bot.x = S.player.x;
    bot.z = S.player.z - 10;
    bot.mode = 'hold';
    bot.holdYaw = Math.PI;
    S.player.yaw = 0;
    S.player.pitch = 0;
    const healthBefore = bot.health;
    api.syncCamera();
    input.firing = true;
    step(30);
    input.firing = false;
    check('hitscan damages a bot', bot.health < healthBefore, `health ${healthBefore} -> ${bot.health}`);

    // Grenade: throw, fuse, detonate.
    S.player.grenades.frag = 1;
    api.switchSlot('grenade', 'frag');
    api.throwGrenade();
    check('grenade throw spawns a projectile', S.grenades.length === 1, `grenades=${S.grenades.length}`);
    step(140);
    check('grenade fuse detonates', S.grenades.length === 0, `grenades=${S.grenades.length}`);

    // Round end by elimination, then restart.
    for (const enemy of S.bots.filter((b) => b.team === 'embers')) {
      if (enemy.alive) damageCharacter(S, enemy, 500, 'body', S.player, api.audio);
    }
    step(5);
    check('elimination ends the round', S.phase === 'end' && S.roundWinner === 'wardens', `${S.phase}/${S.roundWinner}`);
    const roundBefore = S.round;
    step(300);
    check('next round restarts', S.phase === 'freeze' && S.round === roundBefore + 1 && S.bots.every((b) => b.alive),
      `${S.phase} round=${S.round}`);

    // Buy menu purchase during freeze.
    S.player.money = 3000;
    S.player.primary = null;
    S.player.slot = 'side';
    const bought = buy(S, 'kr7', api.audio);
    check('buy menu purchase', bought && S.player.primary === 'kr7' && S.player.money === 300,
      `bought=${bought} money=${S.player.money}`);

    // Bomb: plant ends the round by explosion when the fuse runs out.
    step(370);
    S.bomb.state = 'planted';
    S.bomb.site = 'A';
    S.bomb.x = -23;
    S.bomb.z = -6.5;
    S.bomb.fuse = 0.5;
    step(40);
    check('bomb explosion ends the round', S.phase === 'end' && S.roundWinner === 'embers', `${S.phase}/${S.roundWinner}`);

    // Defuse: hold E beside the charge for the full channel. The attackers
    // are blinded for the check so the channel itself is what is tested.
    step(300);
    step(370);
    for (const enemy of S.bots.filter((b) => b.team === 'embers')) {
      enemy.blindUntil = S.time + 12;
      enemy.mode = 'hold';
    }
    S.bomb.state = 'planted';
    S.bomb.site = 'B';
    S.bomb.x = 23;
    S.bomb.z = -6.5;
    S.bomb.fuse = 30;
    S.player.x = 23;
    S.player.z = -5.5;
    S.player.alive = true;
    S.player.health = 100;
    input.keys.add('KeyE');
    step(320);
    input.keys.delete('KeyE');
    check('defuse wins the round', S.phase === 'end' && S.roundWinner === 'wardens', `${S.phase}/${S.roundWinner}`);

    // Render sanity: one frame through the real renderer.
    api.syncCamera();
    api.renderer.render(api.scene, api.camera);
    check('render one frame', true);
  } catch (error) {
    results.push(`FAIL exception — ${error.message}`);
  }

  const passed = results.filter((line) => line.startsWith('PASS')).length;
  const pre = document.createElement('pre');
  pre.id = 'selftest-output';
  pre.textContent = results.join('\n');
  document.body.appendChild(pre);
  document.title = `SELFTEST ${passed}/${results.length} PASS`;
  window.__selftestDone = true;
}
