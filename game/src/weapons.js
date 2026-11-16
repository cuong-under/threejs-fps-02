// Hitscan combat: one raycast resolves every shot, whether the shooter is
// the player or a bot. Head and body are separate hit meshes, so headshots
// fall out of the geometry instead of a special case. Damage, armor, death,
// killfeed and economy all land here, in one place.
import * as THREE from 'three';
import { WEAPONS } from './config.js';

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _normal = new THREE.Vector3();

export function createCombat(scene, shootables) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 140;
  const hitMeshes = [];
  const targets = [];
  let playerHit = null;

  function refreshTargets() {
    targets.length = 0;
    for (const mesh of shootables) targets.push(mesh);
    for (const mesh of hitMeshes) targets.push(mesh);
  }

  // Raycasts read matrixWorld, which the renderer refreshes once a frame; a
  // shot or a sight check between renders refreshes it first, so a bot that
  // just moved is hit where it stands.
  function refreshMatrices() {
    scene.updateMatrixWorld(true);
  }

  return {
    hitMeshes,
    refreshTargets,
    setPlayerHit(meshes) {
      playerHit = meshes;
      for (const mesh of meshes) hitMeshes.push(mesh);
      refreshTargets();
    },

    // True when no wall and no smoke stands between two points.
    occluded(S, from, to) {
      for (const smoke of S.smokes) {
        if (segmentHitsSphere(from, to, smoke)) return true;
      }
      refreshMatrices();
      _dir.subVectors(to, from);
      const distance = _dir.length();
      _dir.normalize();
      raycaster.set(from, _dir);
      raycaster.far = distance;
      const hit = raycaster.intersectObjects(shootables, false)[0];
      return Boolean(hit);
    },

    // Fire one bullet. The ray starts at the shooter's eye; the tracer may
    // start at the muzzle instead, so the line reads from the gun.
    shoot(S, origin, direction, def, shooter, effects, tracerFrom) {
      refreshMatrices();
      raycaster.set(origin, direction);
      raycaster.far = def.range;
      refreshTargets();
      const hit = raycaster.intersectObjects(targets, false)[0];
      const result = { hit: false, part: null, bot: null, player: false, point: null, distance: def.range };
      if (hit) {
        result.distance = hit.distance;
        result.point = hit.point;
        const data = hit.object.userData;
        if (data.bot && data.bot.alive && data.bot !== shooter) {
          result.hit = true;
          result.part = data.part;
          result.bot = data.bot;
        } else if (data.isPlayer && shooter !== 'player') {
          result.hit = true;
          result.part = data.part;
          result.player = true;
        } else {
          _normal.copy(hit.face ? hit.face.normal : _normal.set(0, 1, 0));
          _normal.transformDirection(hit.object.matrixWorld);
          effects.impact(hit.point, _normal, 5);
        }
      }
      _end.copy(origin).addScaledVector(direction, result.distance);
      effects.tracer(tracerFrom ?? origin, _end);
      return result;
    },

    damageFalloff(def, distance) {
      if (distance <= 20) return 1;
      const t = Math.min(1, (distance - 20) / (def.range - 20));
      return 1 - 0.4 * t;
    },
  };
}

function segmentHitsSphere(from, to, smoke) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const fx = from.x - smoke.x;
  const fy = from.y - smoke.y;
  const fz = from.z - smoke.z;
  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const c = fx * fx + fy * fy + fz * fz - smoke.radius * smoke.radius;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  discriminant = Math.sqrt(discriminant);
  const t0 = (-b - discriminant) / (2 * a);
  const t1 = (-b + discriminant) / (2 * a);
  return (t0 >= 0 && t0 <= 1) || (t1 >= 0 && t1 <= 1);
}

// Spread for a shot: rest spread, bloom from recent fire, movement and air
// penalties, crouch and aim bonuses. Stopping, crouching and aiming pay.
export function computeSpread(S, player, def, aiming) {
  let spread = def.spread;
  if (def.id === 'longshot' && aiming) spread = def.scopedSpread;
  spread += player.bloom;
  const speedRatio = Math.min(1, player.speed2d / 4.4);
  spread += def.moveSpread * speedRatio;
  if (!player.onGround) spread += 0.05;
  if (player.crouched) spread *= 0.7;
  if (aiming && def.id !== 'longshot') spread *= 0.55;
  return spread;
}

export function applyDirectionSpread(random, direction, spread) {
  _dir.set(
    direction.x + (random() * 2 - 1) * spread,
    direction.y + (random() * 2 - 1) * spread,
    direction.z + (random() * 2 - 1) * spread,
  ).normalize();
  return _dir;
}

export function weaponDef(id) {
  return WEAPONS[id];
}

export function currentWeapon(player) {
  if (player.slot === 'primary' && player.primary) return WEAPONS[player.primary];
  if (player.slot === 'grenade') return null;
  return WEAPONS[player.side];
}

// Damage one character. The caller folds in headshot multipliers and range
// falloff; this applies armor, death, killfeed and the bomb drop.
export function damageCharacter(S, target, rawDamage, part, attacker, audio) {
  if (!target.alive) return false;
  let damage = rawDamage;
  if (target.armor > 0) {
    const absorbed = damage * 0.5;
    target.armor = Math.max(0, target.armor - absorbed);
    damage *= 0.5;
  }
  target.health -= damage;
  if (target === S.player) {
    S.player.damageFlash = 1;
    S.player.lastDamageFrom = attacker?.name ?? null;
    audio.hurt();
  }
  if (target.health > 0) return false;
  target.health = 0;
  target.alive = false;
  target.deaths += 1;
  if (attacker) attacker.kills += 1;
  const attackerName = attacker ? attacker.name : 'The yard';
  S.killfeed.unshift({
    text: `${attackerName} ▸ ${target.name}${part === 'head' ? ' (headshot)' : ''}`,
    team: attacker ? attacker.team : null,
    time: S.time,
  });
  if (S.killfeed.length > 5) S.killfeed.pop();
  if (attacker === S.player) {
    S.player.money = Math.min(16000, S.player.money + 300);
    audio.kill();
  }
  if (target.hasBomb) {
    target.hasBomb = false;
    S.bomb.state = 'dropped';
    S.bomb.x = target.x;
    S.bomb.z = target.z;
    S.bomb.carrier = null;
  }
  if (target !== S.player) target.deadTime = 0;
  return true;
}
