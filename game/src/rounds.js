// Round flow and the economy: freeze, live play, bomb resolution, rewards,
// buy menu purchases, and the match score. Win conditions follow the
// Counter-Strike shape: elimination, the clock, the explosion, the defuse.
import { ECONOMY, ROUNDS, WEAPONS, GRENADES } from './config.js';
import { MAP } from './mapdata.js';
import { assignPlans } from './bots.js';
import { insideSite } from './collision.js';

export function startRound(S, botsApi, keepLoadout) {
  const player = S.player;
  player.health = 100;
  player.alive = true;
  player.x = MAP.spawns.defenders[0].x;
  player.z = MAP.spawns.defenders[0].z;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.vz = 0;
  player.yaw = 0;
  player.pitch = 0;
  player.reloading = 0;
  player.bloom = 0;
  player.blind = 0;
  player.defusing = 0;
  player.damageFlash = 0;
  if (!keepLoadout) {
    player.primary = null;
    player.slot = 'side';
    player.armor = 0;
    player.grenades = { frag: 0, flash: 0, smoke: 0 };
    player.money = ECONOMY.startMoney;
  }
  for (const id of Object.keys(WEAPONS)) {
    player.mag[id] = WEAPONS[id].mag;
    player.reserve[id] = WEAPONS[id].reserveMax;
  }
  S.grenades.length = 0;
  S.smokes.length = 0;
  S.events.length = 0;
  botsApi.spawn(S);
  assignPlans(S);
  S.phase = 'freeze';
  S.phaseTime = ROUNDS.freezeTime;
  S.roundWinner = null;
  S.roundReason = '';
  S.banner = null;
}

export function endRound(S, winner, reason, audio) {
  if (S.phase === 'end' || S.phase === 'matchEnd') return;
  S.phase = 'end';
  S.phaseTime = ROUNDS.endPause;
  S.roundWinner = winner;
  S.roundReason = reason;
  S.wins[winner] += 1;
  const playerWon = winner === 'wardens';
  S.player.money = Math.min(
    ECONOMY.maxMoney,
    S.player.money + (playerWon ? ECONOMY.winReward : ECONOMY.lossReward),
  );
  S.banner = {
    text: playerWon ? 'ROUND WON' : 'ROUND LOST',
    sub: reason,
    team: winner,
    until: S.time + ROUNDS.endPause,
  };
  if (playerWon) audio.roundWin();
  else audio.roundLose();
  if (S.wins[winner] >= ROUNDS.winsForMatch) {
    S.phase = 'matchEnd';
    S.banner = {
      text: playerWon ? 'MATCH WON' : 'MATCH LOST',
      sub: `Wardens ${S.wins.wardens} — ${S.wins.embers} Emberjacks`,
      team: winner,
      until: Infinity,
    };
  }
}

export function stepRounds(S, dt, audio, botsApi) {
  S.phaseTime -= dt;
  if (S.phase === 'freeze') {
    if (S.phaseTime <= 0) {
      S.phase = 'live';
      S.phaseTime = ROUNDS.roundTime;
      S.buyOpen = false;
    }
    return;
  }
  if (S.phase === 'end') {
    if (S.phaseTime <= 0) {
      S.round += 1;
      startRound(S, botsApi, true);
    }
    return;
  }
  if (S.phase !== 'live') return;

  // Bomb fuse: beeps quicken as it runs down; the blast ends the round.
  if (S.bomb.state === 'planted') {
    S.bomb.fuse -= dt;
    S.bomb.beepTimer -= dt;
    if (S.bomb.beepTimer <= 0) {
      S.bomb.beepTimer = S.bomb.fuse < 10 ? 0.25 : S.bomb.fuse < 20 ? 0.5 : 1;
      audio.beep(S.bomb.fuse < 10);
    }
    if (S.bomb.fuse <= 0) {
      S.bomb.state = 'exploded';
      endRound(S, 'embers', 'The charge detonated', audio);
      return;
    }
  }
  if (S.bomb.state === 'defused') {
    endRound(S, 'wardens', 'Charge defused', audio);
    return;
  }

  const wardensAlive = (S.player.alive ? 1 : 0) + S.bots.filter((b) => b.team === 'wardens' && b.alive).length;
  const embersAlive = S.bots.filter((b) => b.team === 'embers' && b.alive).length;
  if (wardensAlive === 0) {
    endRound(S, 'embers', S.bomb.state === 'planted' ? 'Defenders eliminated' : 'Defenders eliminated', audio);
    return;
  }
  if (embersAlive === 0 && S.bomb.state !== 'planted') {
    endRound(S, 'wardens', 'Attackers eliminated', audio);
    return;
  }
  if (S.bomb.state !== 'planted' && S.phaseTime <= 0) {
    endRound(S, 'wardens', 'Time expired — the charge never went off', audio);
  }
}

// Buy menu catalogue: id, label, price and what it does. The HUD renders
// this list; buy() applies a purchase.
export function buyCatalog() {
  return [
    { id: 'kr7', label: 'KR-7 Carbine', detail: '30-round automatic rifle', price: WEAPONS.kr7.price, kind: 'weapon' },
    { id: 'mako', label: 'Mako SMG', detail: 'Fast, close-range automatic', price: WEAPONS.mako.price, kind: 'weapon' },
    { id: 'longshot', label: 'Longshot DMR', detail: 'Scoped precision rifle', price: WEAPONS.longshot.price, kind: 'weapon' },
    { id: 'armor', label: 'Kevlar Vest', detail: 'Halves damage taken', price: ECONOMY.armorPrice, kind: 'armor' },
    { id: 'frag', label: 'Frag Charge', detail: 'Explodes after a short fuse', price: GRENADES.frag.price, kind: 'grenade' },
    { id: 'flash', label: 'Flash Charge', detail: 'Blinds whoever looks at it', price: GRENADES.flash.price, kind: 'grenade' },
    { id: 'smoke', label: 'Smoke Charge', detail: 'Blocks sight for 13 seconds', price: GRENADES.smoke.price, kind: 'grenade' },
    { id: 'refill', label: 'Refill Ammo', detail: 'Full reserve for all weapons', price: ECONOMY.refillPrice, kind: 'refill' },
  ];
}

export function buy(S, id, audio) {
  const player = S.player;
  if (S.phase !== 'freeze') return false;
  const item = buyCatalog().find((entry) => entry.id === id);
  if (!item) return false;
  if (player.money < item.price) {
    audio.denied();
    return false;
  }
  if (item.kind === 'weapon') {
    if (player.primary === id) return false;
    player.primary = id;
    player.slot = 'primary';
    player.mag[id] = WEAPONS[id].mag;
    player.reserve[id] = WEAPONS[id].reserveMax;
  } else if (item.kind === 'armor') {
    if (player.armor >= 100) return false;
    player.armor = 100;
  } else if (item.kind === 'grenade') {
    if (player.grenades[id] >= 2) return false;
    player.grenades[id] += 1;
  } else if (item.kind === 'refill') {
    for (const weaponId of Object.keys(WEAPONS)) {
      player.reserve[weaponId] = WEAPONS[weaponId].reserveMax;
    }
  }
  player.money -= item.price;
  audio.buy();
  return true;
}

// The player planting or defusing: hold E near the charge. Returns a status
// string for the HUD prompt, or null when no interaction is available.
export function interactStatus(S) {
  const player = S.player;
  if (!player.alive || S.phase !== 'live') return null;
  if (S.bomb.state === 'planted') {
    const distance = Math.hypot(S.bomb.x - player.x, S.bomb.z - player.z);
    if (distance < 2.4) return 'defuse';
  }
  return null;
}

export function siteAt(x, z) {
  for (const [id, site] of Object.entries(MAP.sites)) {
    if (insideSite(site, x, z)) return id;
  }
  return null;
}
