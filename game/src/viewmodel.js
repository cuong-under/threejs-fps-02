// The first-person weapon: boxy guns built from primitives, attached to the
// camera. Walk bob, recoil kick, reload dip and aim-down-sights are all
// procedural, driven by the sim state the main loop hands in each frame.
import * as THREE from 'three';
import { makeGlowTexture } from './effects.js';

function box(w, h, d, color, x, y, z, roughness = 0.55) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.35 }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function buildGun(kind) {
  const group = new THREE.Group();
  const dark = 0x23252b;
  const mid = 0x3a3d44;
  const grip = 0x4a3826;
  if (kind === 'p9') {
    group.add(box(0.05, 0.06, 0.24, dark, 0, 0, -0.1));
    group.add(box(0.045, 0.1, 0.07, grip, 0, -0.07, 0.02));
    group.add(box(0.03, 0.03, 0.1, mid, 0, 0.015, -0.26));
  } else if (kind === 'kr7') {
    group.add(box(0.06, 0.08, 0.5, dark, 0, 0, -0.2));
    group.add(box(0.03, 0.03, 0.3, mid, 0, 0.01, -0.55));
    group.add(box(0.05, 0.14, 0.09, mid, 0, -0.1, -0.12));
    group.add(box(0.05, 0.09, 0.07, grip, 0, -0.07, 0.06));
    group.add(box(0.05, 0.06, 0.18, dark, 0, -0.01, 0.18));
    group.add(box(0.02, 0.05, 0.06, mid, 0, 0.06, -0.3));
  } else if (kind === 'mako') {
    group.add(box(0.055, 0.07, 0.36, dark, 0, 0, -0.14));
    group.add(box(0.035, 0.035, 0.18, mid, 0, 0.005, -0.4));
    group.add(box(0.045, 0.12, 0.07, mid, 0, -0.09, -0.08));
    group.add(box(0.045, 0.08, 0.06, grip, 0, -0.06, 0.08));
  } else if (kind === 'longshot') {
    group.add(box(0.055, 0.07, 0.55, 0x2c2e26, 0, 0, -0.22));
    group.add(box(0.025, 0.025, 0.42, mid, 0, 0.01, -0.66));
    group.add(box(0.05, 0.12, 0.08, mid, 0, -0.09, -0.14));
    group.add(box(0.05, 0.08, 0.06, grip, 0, -0.06, 0.08));
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10),
      new THREE.MeshStandardMaterial({ color: dark, roughness: 0.4, metalness: 0.5 }),
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.075, -0.22);
    group.add(scope);
  }
  return group;
}

export function createViewmodel(camera) {
  const root = new THREE.Group();
  const guns = {};
  for (const kind of ['p9', 'kr7', 'mako', 'longshot']) {
    const gun = buildGun(kind);
    gun.visible = false;
    root.add(gun);
    guns[kind] = gun;
  }
  const grenade = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.5 }),
  );
  grenade.visible = false;
  root.add(grenade);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ map: makeGlowTexture(), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  flash.position.set(0, 0.01, -0.78);
  root.add(flash);
  root.position.set(0.24, -0.22, -0.45);
  camera.add(root);

  let kick = 0;
  let flashTime = 0;
  let bobPhase = 0;
  let reloadDip = 0;
  let aimBlend = 0;

  return {
    show(weaponId, grenadeKind) {
      for (const [kind, gun] of Object.entries(guns)) gun.visible = kind === weaponId;
      grenade.visible = Boolean(grenadeKind);
      if (grenadeKind) {
        grenade.material.color.set(grenadeKind === 'flash' ? 0xd8d4c8 : grenadeKind === 'smoke' ? 0x5a6a4a : 0x3a3d42);
      }
    },
    onShot() {
      kick = Math.min(0.09, kick + 0.035);
      flashTime = 0.045;
    },
    update(dt, player, aiming, reloading) {
      bobPhase += player.speed2d * dt * 1.9;
      const bob = Math.min(1, player.speed2d / 4.4) * 0.012;
      kick = Math.max(0, kick - dt * 0.35);
      flashTime = Math.max(0, flashTime - dt);
      reloadDip += ((reloading ? 1 : 0) - reloadDip) * Math.min(1, dt * 8);
      aimBlend += ((aiming ? 1 : 0) - aimBlend) * Math.min(1, dt * 12);
      const hipX = 0.24;
      const hipY = -0.22;
      root.position.x = hipX + (0 - hipX) * aimBlend;
      root.position.y = hipY + (-0.148 - hipY) * aimBlend + Math.sin(bobPhase * 2) * bob - reloadDip * 0.14;
      root.position.z = -0.45 + kick;
      root.rotation.x = kick * 1.6 - reloadDip * 0.5 + Math.sin(bobPhase) * bob * 0.6;
      root.rotation.z = reloadDip * 0.35;
      flash.material.opacity = flashTime > 0 ? 0.95 : 0;
      if (flashTime > 0) flash.rotation.z = Math.random() * Math.PI;
    },
    muzzleWorld(out) {
      flash.getWorldPosition(out);
      return out;
    },
  };
}
