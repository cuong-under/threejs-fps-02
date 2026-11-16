// One place for every tunable: palette, weapons, economy and round rules.
// The sim reads from here; nothing else hardcodes a weapon stat or a price.
export const PALETTE = {
  skyTop: 0x2b3a4a,
  skyBottom: 0xd98a4a,
  fog: 0x9a7a5c,
  ground: 0x565049,
  wall: 0x6e6a60,
  wallDark: 0x4a463e,
  containerA: 0xb05c2e,
  containerB: 0x3f6d7a,
  containerC: 0x8a7a3a,
  crate: 0x7a6a4a,
  metal: 0x3a3d42,
  accent: 0xf0a830,
  warden: 0x2e8f8a,
  wardenDark: 0x1e5f5c,
  ember: 0xc2502e,
  emberDark: 0x7a2f1a,
  ink: '#e9e6df',
  muted: '#98a0a8',
};

export const SIM = {
  step: 1 / 60,
  gravity: 22,
  eyeStanding: 1.62,
  eyeCrouch: 1.12,
  playerRadius: 0.38,
  walkSpeed: 4.4,
  crouchSpeed: 2.2,
  sneakSpeed: 2.4,
  jumpSpeed: 6.4,
  accelGround: 42,
  accelAir: 10,
  friction: 9,
};

// Damage, fire rate, spread and price per weapon. spread is radians at rest;
// moving, airborne and repeated shots multiply it (see weapons.js).
export const WEAPONS = {
  p9: {
    id: 'p9', name: 'P9 SIDEARM', slot: 'side', price: 0, damage: 26, headMult: 4,
    interval: 0.16, auto: false, mag: 12, reserveMax: 48, reload: 1.4,
    spread: 0.011, moveSpread: 0.05, bloom: 0.004, maxBloom: 0.03,
    recoil: 0.011, range: 60, pellets: 1, zoom: 1,
  },
  kr7: {
    id: 'kr7', name: 'KR-7 CARBINE', slot: 'primary', price: 2700, damage: 27, headMult: 4,
    interval: 0.1, auto: true, mag: 30, reserveMax: 90, reload: 2.2,
    spread: 0.009, moveSpread: 0.055, bloom: 0.0035, maxBloom: 0.038,
    recoil: 0.012, range: 80, pellets: 1, zoom: 1,
  },
  mako: {
    id: 'mako', name: 'MAKO SMG', slot: 'primary', price: 1500, damage: 22, headMult: 4,
    interval: 0.075, auto: true, mag: 32, reserveMax: 96, reload: 2.0,
    spread: 0.014, moveSpread: 0.045, bloom: 0.003, maxBloom: 0.034,
    recoil: 0.008, range: 50, pellets: 1, zoom: 1,
  },
  longshot: {
    id: 'longshot', name: 'LONGSHOT DMR', slot: 'primary', price: 4200, damage: 82, headMult: 2,
    interval: 0.9, auto: false, mag: 10, reserveMax: 30, reload: 3.0,
    spread: 0.028, scopedSpread: 0.0008, moveSpread: 0.09, bloom: 0.01, maxBloom: 0.02,
    recoil: 0.03, range: 120, pellets: 1, zoom: 2.4,
  },
};

export const GRENADES = {
  frag: { id: 'frag', name: 'FRAG CHARGE', price: 300, fuse: 1.6, radius: 8, damage: 110 },
  flash: { id: 'flash', name: 'FLASH CHARGE', price: 200, fuse: 1.4, radius: 16 },
  smoke: { id: 'smoke', name: 'SMOKE CHARGE', price: 250, fuse: 1.2, radius: 4.5, life: 13 },
};

export const ECONOMY = {
  startMoney: 800,
  killReward: 300,
  winReward: 1400,
  lossReward: 900,
  plantBonus: 300,
  maxMoney: 16000,
  armorPrice: 650,
  refillPrice: 200,
};

export const ROUNDS = {
  freezeTime: 6,
  roundTime: 100,
  fuseTime: 35,
  plantTime: 3,
  defuseTime: 5,
  endPause: 4,
  winsForMatch: 5,
};

export const BOT_NAMES = ['Rook', 'Vex', 'Sable', 'Onyx', 'Juno', 'Pike'];
