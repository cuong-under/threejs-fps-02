// The single state store: every module reads and writes this one object.
// Plain data only; three.js meshes live on the objects they visualise so the
// sim never allocates in its hot loops.
import { ECONOMY, ROUNDS } from './config.js';

export function createPlayerState() {
  return {
    team: 'wardens',
    name: 'You',
    x: 0, z: 18.5, y: 0, vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0,
    health: 100, armor: 0, alive: true,
    crouched: false, onGround: true,
    money: ECONOMY.startMoney,
    primary: null, side: 'p9', slot: 'side',
    mag: {}, reserve: {},
    grenades: { frag: 0, flash: 0, smoke: 0 },
    reloading: 0, reloadWeapon: null, fireCooldown: 0, bloom: 0,
    recoilPitch: 0, recoilYaw: 0, flashUntil: 0, blind: 0,
    defusing: 0, planting: 0, kills: 0, deaths: 0,
    mesh: null, speed2d: 0, lastDamageFrom: null, damageFlash: 0,
  };
}

export function createBotState(index, team, name) {
  return {
    team, name, index,
    x: 0, z: 0, y: 0, vx: 0, vz: 0,
    yaw: 0, pitch: 0,
    health: 100, armor: 0, alive: true,
    crouched: false,
    weapon: 'kr7', mag: 30, reserve: 90, fireCooldown: 0, reloading: 0,
    // AI brain: mode, route queue, hold post, senses.
    mode: 'advance', route: [], routeIndex: 0, holdNode: null, holdYaw: 0,
    target: null, lastSeenX: 0, lastSeenZ: 0, lastSeenTime: -99,
    reactUntil: 0, burstLeft: 0, burstPause: 0, aimError: 0.05,
    investigateX: 0, investigateZ: 0, investigateUntil: 0,
    hasBomb: false, channel: 0, channelKind: null, blindUntil: 0,
    scanPhase: 0, stuckTime: 0, lastX: 0, lastZ: 0,
    kills: 0, deaths: 0,
    mesh: null, headMesh: null, bodyMesh: null, deadTime: 0, speed2d: 0,
    senseTimer: 0, site: null, strafeDir: 1, strafeTimer: 0,
    resumeMode: 'advance', walkPhase: 0, flashTime: 0, parts: null,
  };
}

export function createState(random) {
  return {
    random,
    time: 0,
    round: 1,
    phase: 'freeze', // freeze | live | end | matchEnd
    phaseTime: ROUNDS.freezeTime,
    wins: { wardens: 0, embers: 0 },
    roundWinner: null,
    roundReason: '',
    player: createPlayerState(),
    bots: [],
    bomb: {
      state: 'carried', // carried | dropped | planted | exploded | defused
      x: 0, z: 0, site: null, carrier: null,
      fuse: 0, plantProgress: 0, defuseProgress: 0, beepTimer: 0,
    },
    grenades: [],
    smokes: [],
    events: [], // {kind, x, z, radius, team, time} — gunshots bots can hear
    killfeed: [], // {text, team, time}
    banner: null, // {text, sub, team, until}
    buyOpen: false,
    started: false,
    paused: false,
    stats: { shotsFired: 0, shotsHit: 0, headshots: 0 },
    shake: 0,
    version: 0,
  };
}
