// Pooled visual effects: tracers, impact sparks, muzzle flashes, smoke and
// the explosion flash. Pools are allocated once at boot; the sim borrows and
// returns slots, so the hot loop never allocates.
import * as THREE from 'three';

const MAX_TRACERS = 32;
const MAX_PARTICLES = 240;

export function createEffects(scene) {
  const tracers = [];
  const tracerMaterial = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9 });
  for (let i = 0; i < MAX_TRACERS; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geometry, tracerMaterial.clone());
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerCursor = 0;

  const particlePositions = new Float32Array(MAX_PARTICLES * 3);
  const particleVelocities = new Float32Array(MAX_PARTICLES * 3);
  const particleLife = new Float32Array(MAX_PARTICLES);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
    color: 0xffc070, size: 0.09, transparent: true, opacity: 0.95, depthWrite: false,
  }));
  particles.frustumCulled = false;
  scene.add(particles);
  let particleCursor = 0;

  const flashLight = new THREE.PointLight(0xffb060, 0, 14, 1.8);
  scene.add(flashLight);

  const smokeTexture = makeSmokeTexture();
  const smokeSprites = [];
  for (let i = 0; i < 40; i += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTexture, transparent: true, opacity: 0, depthWrite: false, color: 0xcfc8bc,
    }));
    sprite.visible = false;
    scene.add(sprite);
    smokeSprites.push({ sprite, life: 0, maxLife: 1, scale: 1 });
  }

  return {
    tracer(from, to) {
      const slot = tracers[tracerCursor];
      tracerCursor = (tracerCursor + 1) % MAX_TRACERS;
      const positions = slot.line.geometry.attributes.position.array;
      positions[0] = from.x; positions[1] = from.y; positions[2] = from.z;
      positions[3] = to.x; positions[4] = to.y; positions[5] = to.z;
      slot.line.geometry.attributes.position.needsUpdate = true;
      slot.line.material.opacity = 0.9;
      slot.line.visible = true;
      slot.life = 0.06;
    },

    impact(point, normal, count = 6) {
      for (let i = 0; i < count; i += 1) {
        const slot = particleCursor;
        particleCursor = (particleCursor + 1) % MAX_PARTICLES;
        particlePositions[slot * 3] = point.x;
        particlePositions[slot * 3 + 1] = point.y;
        particlePositions[slot * 3 + 2] = point.z;
        particleVelocities[slot * 3] = normal.x * 2 + (Math.random() - 0.5) * 3;
        particleVelocities[slot * 3 + 1] = normal.y * 2 + Math.random() * 3;
        particleVelocities[slot * 3 + 2] = normal.z * 2 + (Math.random() - 0.5) * 3;
        particleLife[slot] = 0.35 + Math.random() * 0.25;
      }
      particleGeometry.attributes.position.needsUpdate = true;
    },

    muzzleFlash(position) {
      flashLight.position.copy(position);
      flashLight.intensity = 26;
    },

    explosion(position) {
      flashLight.position.set(position.x, position.y + 1, position.z);
      flashLight.intensity = 90;
      this.impact(position, { x: 0, y: 1, z: 0 }, 40);
    },

    smokePuff(x, y, z, scale) {
      for (const slot of smokeSprites) {
        if (slot.life > 0) continue;
        slot.sprite.position.set(x, y, z);
        slot.sprite.scale.setScalar(scale);
        slot.sprite.material.opacity = 0.55;
        slot.sprite.visible = true;
        slot.life = 2.4;
        slot.maxLife = 2.4;
        slot.scale = scale;
        return;
      }
    },

    step(dt) {
      for (const slot of tracers) {
        if (slot.life <= 0) continue;
        slot.life -= dt;
        if (slot.life <= 0) slot.line.visible = false;
        else slot.line.material.opacity = (slot.life / 0.06) * 0.9;
      }
      let moved = false;
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        if (particleLife[i] <= 0) continue;
        particleLife[i] -= dt;
        particleVelocities[i * 3 + 1] -= 9 * dt;
        particlePositions[i * 3] += particleVelocities[i * 3] * dt;
        particlePositions[i * 3 + 1] += particleVelocities[i * 3 + 1] * dt;
        particlePositions[i * 3 + 2] += particleVelocities[i * 3 + 2] * dt;
        if (particlePositions[i * 3 + 1] < 0.02) particlePositions[i * 3 + 1] = 0.02;
        if (particleLife[i] <= 0) particlePositions[i * 3 + 1] = -10;
        moved = true;
      }
      if (moved) particleGeometry.attributes.position.needsUpdate = true;
      flashLight.intensity = Math.max(0, flashLight.intensity - 320 * dt);
      for (const slot of smokeSprites) {
        if (slot.life <= 0) continue;
        slot.life -= dt;
        slot.sprite.material.opacity = Math.max(0, (slot.life / slot.maxLife) * 0.55);
        slot.sprite.scale.setScalar(slot.scale * (1 + (1 - slot.life / slot.maxLife) * 0.6));
        if (slot.life <= 0) slot.sprite.visible = false;
      }
    },
  };
}

function makeSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// A hot radial glow for muzzle flashes, shared by the viewmodel and the bot
// bodies so a shot reads as light, not as a cardboard square.
export function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,240,200,1)');
  gradient.addColorStop(0.35, 'rgba(255,190,90,0.85)');
  gradient.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
