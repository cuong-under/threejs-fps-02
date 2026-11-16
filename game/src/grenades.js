// Grenades: thrown projectiles with bounce physics, then three payloads —
// a frag that hurts through open air, a flash that blinds whoever looks at
// it, and smoke that hangs in the air and blocks sight (see combat.occluded).
import * as THREE from 'three';
import { GRENADES } from './config.js';
import { damageCharacter } from './weapons.js';
import { moveCircle } from './collision.js';

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

export function createGrenadeSystem(scene) {
  const meshPool = [];
  const geometry = new THREE.SphereGeometry(0.11, 10, 8);
  const materials = {
    frag: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.5 }),
    flash: new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.4, metalness: 0.3 }),
    smoke: new THREE.MeshStandardMaterial({ color: 0x5a6a4a, roughness: 0.6 }),
  };
  for (let i = 0; i < 8; i += 1) {
    const mesh = new THREE.Mesh(geometry, materials.frag);
    mesh.visible = false;
    mesh.castShadow = true;
    scene.add(mesh);
    meshPool.push(mesh);
  }

  return {
    throw(S, owner, origin, direction, kind) {
      const def = GRENADES[kind];
      const mesh = meshPool.find((m) => !m.visible);
      if (!mesh) return false;
      mesh.material = materials[kind];
      mesh.visible = true;
      mesh.position.copy(origin);
      S.grenades.push({
        kind, owner, fuse: def.fuse,
        x: origin.x, y: origin.y, z: origin.z,
        vx: direction.x * 13, vy: direction.y * 13 + 2.5, vz: direction.z * 13,
        mesh, bounced: false,
      });
      return true;
    },

    step(S, dt, combat, effects, audio) {
      for (let i = S.grenades.length - 1; i >= 0; i -= 1) {
        const g = S.grenades[i];
        g.vy -= 20 * dt;
        const pos = { x: g.x, z: g.z };
        const oldX = g.x;
        const oldZ = g.z;
        moveCircle(pos, g.vx * dt, g.vz * dt, 0.11);
        if (pos.x !== oldX + g.vx * dt) { g.vx *= -0.45; audio.bounce(0); }
        if (pos.z !== oldZ + g.vz * dt) { g.vz *= -0.45; audio.bounce(0); }
        g.x = pos.x;
        g.z = pos.z;
        g.y += g.vy * dt;
        if (g.y < 0.11) {
          g.y = 0.11;
          if (Math.abs(g.vy) > 1.5) audio.bounce(Math.hypot(g.x - S.player.x, g.z - S.player.z));
          g.vy = Math.abs(g.vy) > 1.2 ? -g.vy * 0.42 : 0;
          g.vx *= 0.7;
          g.vz *= 0.7;
        }
        g.mesh.position.set(g.x, g.y, g.z);
        g.fuse -= dt;
        if (g.fuse <= 0) {
          detonate(S, g, combat, effects, audio);
          g.mesh.visible = false;
          S.grenades.splice(i, 1);
        }
      }
      for (let i = S.smokes.length - 1; i >= 0; i -= 1) {
        const smoke = S.smokes[i];
        smoke.until -= dt;
        smoke.puffTimer -= dt;
        if (smoke.puffTimer <= 0) {
          smoke.puffTimer = 0.28;
          effects.smokePuff(
            smoke.x + (S.random() * 2 - 1) * 1.6,
            smoke.y + S.random() * 1.4,
            smoke.z + (S.random() * 2 - 1) * 1.6,
            2.6 + S.random() * 1.6,
          );
        }
        if (smoke.until <= 0) S.smokes.splice(i, 1);
      }
    },
  };

  function detonate(S, g, combat, effects, audio) {
    const def = GRENADES[g.kind];
    const distanceToPlayer = Math.hypot(g.x - S.player.x, g.z - S.player.z);
    if (g.kind === 'frag') {
      effects.explosion({ x: g.x, y: g.y, z: g.z });
      audio.explosion(distanceToPlayer);
      S.shake = Math.min(1, S.shake + 0.7 / (1 + distanceToPlayer * 0.15));
      S.events.push({ kind: 'explosion', x: g.x, z: g.z, team: g.owner.team, time: S.time, radius: 40 });
      const victims = [S.player, ...S.bots];
      for (const victim of victims) {
        if (!victim.alive || victim === g.owner) continue;
        if (victim.team === g.owner.team) continue;
        const distance = Math.hypot(victim.x - g.x, victim.z - g.z);
        if (distance > def.radius) continue;
        _from.set(g.x, g.y + 0.4, g.z);
        _to.set(victim.x, 1.2, victim.z);
        if (combat.occluded(S, _from, _to)) continue;
        const damage = def.damage * (1 - (distance / def.radius) * 0.7);
        damageCharacter(S, victim, damage, 'body', g.owner, audio);
      }
    } else if (g.kind === 'flash') {
      effects.muzzleFlash({ x: g.x, y: g.y, z: g.z });
      audio.flashRing();
      S.events.push({ kind: 'shot', x: g.x, z: g.z, team: g.owner.team, time: S.time, radius: 30 });
      const victims = [S.player, ...S.bots];
      for (const victim of victims) {
        if (!victim.alive || victim === g.owner) continue;
        const distance = Math.hypot(victim.x - g.x, victim.z - g.z);
        if (distance > def.radius) continue;
        _from.set(g.x, g.y + 0.4, g.z);
        _to.set(victim.x, 1.5, victim.z);
        if (combat.occluded(S, _from, _to)) continue;
        // Facing the flash blinds fully; looking away still dazzles up close.
        const lookX = -Math.sin(victim.yaw);
        const lookZ = -Math.cos(victim.yaw);
        const toX = (g.x - victim.x) / Math.max(distance, 0.01);
        const toZ = (g.z - victim.z) / Math.max(distance, 0.01);
        const facing = lookX * toX + lookZ * toZ;
        const strength = Math.max(0, 1 - distance / def.radius) * (facing > -0.3 ? 1 : 0.45);
        if (strength <= 0.1) continue;
        if (victim === S.player) {
          S.player.blind = Math.max(S.player.blind, strength);
          S.player.flashUntil = S.time + strength * 2.2;
        } else {
          victim.blindUntil = Math.max(victim.blindUntil, S.time + strength * 2.4);
        }
      }
    } else if (g.kind === 'smoke') {
      S.smokes.push({ x: g.x, y: 0.6, z: g.z, radius: def.radius, until: def.life, puffTimer: 0 });
      for (let i = 0; i < 6; i += 1) {
        effects.smokePuff(g.x + (S.random() * 2 - 1) * 1.8, 0.8 + S.random(), g.z + (S.random() * 2 - 1) * 1.8, 3);
      }
    }
  }
}
