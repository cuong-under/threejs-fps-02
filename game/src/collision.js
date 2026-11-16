// Map collision and navigation, shared by the player and the bots.
// Colliders are the map's AABBs; bodies are circles in the XZ plane.
import { MAP } from './mapdata.js';

const SOLIDS = MAP.solids;

// Move a circle (x,z,radius) by (dx,dz), sliding along walls. Axis-separated
// so a body hugging a wall keeps its along-wall speed. Mutates pos in place.
export function moveCircle(pos, dx, dz, radius) {
  pos.x += dx;
  for (const s of SOLIDS) {
    if (pos.x + radius > s.x0 && pos.x - radius < s.x1 && pos.z + radius > s.z0 && pos.z - radius < s.z1) {
      pos.x = dx > 0 ? s.x0 - radius : s.x1 + radius;
    }
  }
  pos.z += dz;
  for (const s of SOLIDS) {
    if (pos.x + radius > s.x0 && pos.x - radius < s.x1 && pos.z + radius > s.z0 && pos.z - radius < s.z1) {
      pos.z = dz > 0 ? s.z0 - radius : s.z1 + radius;
    }
  }
  const b = MAP.bounds;
  if (pos.x - radius < b.x0) pos.x = b.x0 + radius;
  if (pos.x + radius > b.x1) pos.x = b.x1 - radius;
  if (pos.z - radius < b.z0) pos.z = b.z0 + radius;
  if (pos.z + radius > b.z1) pos.z = b.z1 - radius;
}

// 2D segment vs solid test at a given height: true when a straight line at
// height y between two points crosses a solid tall enough to block it.
export function segmentBlocked2D(x0, z0, x1, z1, y) {
  for (const s of SOLIDS) {
    if (s.h < y) continue;
    if (segmentHitsBox(x0, z0, x1, z1, s)) return true;
  }
  return false;
}

function segmentHitsBox(x0, z0, x1, z1, s) {
  // Slab test on the XZ rectangle.
  let tmin = 0;
  let tmax = 1;
  const dx = x1 - x0;
  const dz = z1 - z0;
  if (!slab(x0, dx, s.x0, s.x1, { min: tmin, max: tmax }, (a, b) => { tmin = a; tmax = b; })) return false;
  return slab(z0, dz, s.z0, s.z1, { min: tmin, max: tmax }, (a, b) => { tmin = a; tmax = b; });
}

function slab(origin, dir, lo, hi, range, set) {
  if (Math.abs(dir) < 1e-9) return origin >= lo && origin <= hi;
  let t0 = (lo - origin) / dir;
  let t1 = (hi - origin) / dir;
  if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
  const loT = Math.max(range.min, t0);
  const hiT = Math.min(range.max, t1);
  if (loT > hiT) return false;
  set(loT, hiT);
  return true;
}

// Breadth-first search over the waypoint graph; returns node ids from start
// to goal (inclusive), or [] when unreachable. Reuses module scratch arrays.
const adjacency = new Map();
for (const [a, b] of MAP.edges) {
  if (!adjacency.has(a)) adjacency.set(a, []);
  if (!adjacency.has(b)) adjacency.set(b, []);
  adjacency.get(a).push(b);
  adjacency.get(b).push(a);
}

export function findPath(startId, goalId) {
  if (startId === goalId) return [goalId];
  const prev = new Map([[startId, null]]);
  const queue = [startId];
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head];
    for (const next of adjacency.get(node) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, node);
      if (next === goalId) {
        const path = [goalId];
        let cursor = node;
        while (cursor !== null) { path.push(cursor); cursor = prev.get(cursor); }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return [];
}

export function nearestNode(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const [id, node] of Object.entries(MAP.nodes)) {
    const dx = node.x - x;
    const dz = node.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

export function insideSite(site, x, z) {
  return x >= site.x0 && x <= site.x1 && z >= site.z0 && z <= site.z1;
}
