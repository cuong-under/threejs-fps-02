// The visible harbor: meshes, lights and procedural textures built from the
// map data. Textures are painted on offscreen canvases at boot, so the game
// needs no image files and no network.
import * as THREE from 'three';
import { MAP } from './mapdata.js';
import { PALETTE } from './config.js';

function canvasTexture(size, painter, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  painter(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function groundTexture() {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#57514a';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 5200; i += 1) {
      const shade = 70 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgb(${shade},${shade - 4},${shade - 10})`;
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    g.strokeStyle = 'rgba(30,28,24,0.55)';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i += 1) {
      g.beginPath(); g.moveTo((i * s) / 4, 0); g.lineTo((i * s) / 4, s); g.stroke();
      g.beginPath(); g.moveTo(0, (i * s) / 4); g.lineTo(s, (i * s) / 4); g.stroke();
    }
    g.fillStyle = 'rgba(240,168,48,0.5)';
    g.fillRect(0, s / 2 - 3, s, 6);
  }, 8, 6);
}

function wallTexture(base, stripe) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1600; i += 1) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      g.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    }
    g.fillStyle = stripe;
    g.fillRect(0, 0, s, 10);
    g.fillRect(0, s - 10, s, 10);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    for (let x = 0; x <= s; x += 64) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke();
    }
  }, 2, 1);
}

function containerTexture(base, label) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x, 0, 5, s);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x + 5, 0, 3, s);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, s, 12);
    g.fillRect(0, s - 12, s, 12);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = 'bold 44px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(label, s / 2, s / 2 + 16);
  });
}

function crateTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#7a6a4a';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#5d5138';
    g.lineWidth = 10;
    g.strokeRect(8, 8, s - 16, s - 16);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.moveTo(s, 0); g.lineTo(0, s); g.stroke();
    for (let i = 0; i < 900; i += 1) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
      g.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    }
  });
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const gradient = g.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#24313f');
  gradient.addColorStop(0.55, '#5c5a52');
  gradient.addColorStop(0.78, '#d98a4a');
  gradient.addColorStop(1, '#e8a85c');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWorld(scene) {
  // Sky dome: a gradient shell, plus fog to melt the far walls into dusk.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 34, 120);

  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-30, 42, -28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8fa3b8, 0x4a4238, 0.85));
  const fill = new THREE.DirectionalLight(0x6a86a8, 0.5);
  fill.position.set(30, 20, 30);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.solid = true;
  scene.add(ground);

  const materials = {
    wall: new THREE.MeshStandardMaterial({ map: wallTexture('#6e6a60', '#57534a'), roughness: 0.9 }),
    wallDark: new THREE.MeshStandardMaterial({ map: wallTexture('#4a463e', '#f0a830'), roughness: 0.9 }),
    containerA: new THREE.MeshStandardMaterial({ map: containerTexture('#b05c2e', 'HARBOR'), roughness: 0.8 }),
    containerB: new THREE.MeshStandardMaterial({ map: containerTexture('#3f6d7a', 'YARD 7'), roughness: 0.8 }),
    containerC: new THREE.MeshStandardMaterial({ map: containerTexture('#8a7a3a', 'DOCK 3'), roughness: 0.8 }),
    crate: new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ color: PALETTE.metal, roughness: 0.55, metalness: 0.6 }),
  };

  const shootables = [ground];
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  for (const solid of MAP.solids) {
    const width = solid.x1 - solid.x0;
    const depth = solid.z1 - solid.z0;
    const mesh = new THREE.Mesh(boxGeometry, materials[solid.kind]);
    mesh.scale.set(width, solid.h, depth);
    mesh.position.set((solid.x0 + solid.x1) / 2, solid.h / 2, (solid.z0 + solid.z1) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.solid = true;
    scene.add(mesh);
    shootables.push(mesh);
  }

  // Site markers: painted ground rings and a floating letter board per site.
  const siteMeshes = {};
  for (const [id, site] of Object.entries(MAP.sites)) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.7, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.cx, 0.03, site.cz);
    scene.add(ring);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.1, 0.2),
      new THREE.MeshStandardMaterial({ color: PALETTE.metal, roughness: 0.6, metalness: 0.4 }),
    );
    board.position.set(site.cx, 3.4, site.cz);
    scene.add(board);
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.8),
      new THREE.MeshBasicMaterial({ map: letterTexture(site.label), transparent: true }),
    );
    letter.position.set(site.cx, 3.4, site.cz + 0.12);
    scene.add(letter);
    siteMeshes[id] = { ring, board, letter };
  }

  // Harbour dressing: crane silhouettes and lamp posts outside the playable
  // area, so sightlines end on shapes instead of fog.
  const craneMaterial = materials.metal;
  for (const x of [-38, 38]) {
    const mast = new THREE.Mesh(boxGeometry, craneMaterial);
    mast.scale.set(1.2, 26, 1.2);
    mast.position.set(x, 13, -14);
    scene.add(mast);
    const jib = new THREE.Mesh(boxGeometry, craneMaterial);
    jib.scale.set(16, 1, 1);
    jib.position.set(x - Math.sign(x) * 6, 25, -14);
    scene.add(jib);
    const hook = new THREE.Mesh(boxGeometry, craneMaterial);
    hook.scale.set(0.3, 7, 0.3);
    hook.position.set(x - Math.sign(x) * 12, 21, -14);
    scene.add(hook);
  }
  for (const [x, z] of [[-26, 14], [26, 14], [-26, -18], [26, -18], [0, -20]]) {
    const pole = new THREE.Mesh(boxGeometry, craneMaterial);
    pole.scale.set(0.25, 6, 0.25);
    pole.position.set(x, 3, z);
    scene.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
    );
    lamp.position.set(x, 6.1, z);
    scene.add(lamp);
  }

  return { shootables, siteMeshes, sun };
}

function letterTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 256, 72);
  g.fillStyle = '#f0a830';
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(label, 128, 54);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
