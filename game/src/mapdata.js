// Harbor Yard: the map as data. Colliders are axis-aligned boxes
// {x0,z0,x1,z1,h}; visuals describe what the renderer builds from them.
// Waypoints form the graph bots navigate; sites are the bomb zones.
// Nothing here imports three.js: the sim and the renderer share this data.
export const MAP = {
  bounds: { x0: -30, z0: -22, x1: 30, z1: 22 },
  // Walls, containers and crates. kind selects the visual treatment.
  solids: [
    // Perimeter.
    { x0: -31, z0: -23, x1: 31, z1: -22, h: 4.5, kind: 'wall' },
    { x0: -31, z0: 22, x1: 31, z1: 23, h: 4.5, kind: 'wall' },
    { x0: -31, z0: -23, x1: -30, z1: 23, h: 4.5, kind: 'wall' },
    { x0: 30, z0: -23, x1: 31, z1: 23, h: 4.5, kind: 'wall' },
    // Attacker spawn wall (z=-16.5): gates west, mid, east.
    { x0: -30, z0: -17, x1: -14, z1: -16, h: 4, kind: 'wall' },
    { x0: -10, z0: -17, x1: -2, z1: -16, h: 4, kind: 'wall' },
    { x0: 2, z0: -17, x1: 10, z1: -16, h: 4, kind: 'wall' },
    { x0: 14, z0: -17, x1: 30, z1: -16, h: 4, kind: 'wall' },
    // Defender spawn wall (z=16.5): same three gates.
    { x0: -30, z0: 16, x1: -14, z1: 17, h: 4, kind: 'wall' },
    { x0: -10, z0: 16, x1: -2, z1: 17, h: 4, kind: 'wall' },
    { x0: 2, z0: 16, x1: 10, z1: 17, h: 4, kind: 'wall' },
    { x0: 14, z0: 16, x1: 30, z1: 17, h: 4, kind: 'wall' },
    // Mid building: two blocks, one doorway between them.
    { x0: -7, z0: -4, x1: -1.5, z1: 4, h: 4, kind: 'wallDark' },
    { x0: 1.5, z0: -4, x1: 7, z1: 4, h: 4, kind: 'wallDark' },
    // Site A warehouse shell (west): north, east and south walls with gaps.
    { x0: -29, z0: -13, x1: -22, z1: -12, h: 3.6, kind: 'wall' },
    { x0: -18, z0: -13, x1: -17, z1: -6, h: 3.6, kind: 'wall' },
    { x0: -18, z0: -3, x1: -17, z1: 1, h: 3.6, kind: 'wall' },
    { x0: -29, z0: 1, x1: -26, z1: 2, h: 3.6, kind: 'wall' },
    { x0: -23, z0: 1, x1: -17, z1: 2, h: 3.6, kind: 'wall' },
    // Site B crane deck shell (east), mirrored.
    { x0: 22, z0: -13, x1: 29, z1: -12, h: 3.6, kind: 'wall' },
    { x0: 17, z0: -13, x1: 18, z1: -6, h: 3.6, kind: 'wall' },
    { x0: 17, z0: -3, x1: 18, z1: 1, h: 3.6, kind: 'wall' },
    { x0: 17, z0: 1, x1: 23, z1: 2, h: 3.6, kind: 'wall' },
    { x0: 26, z0: 1, x1: 29, z1: 2, h: 3.6, kind: 'wall' },
    // Shipping containers: tall lane blockers.
    { x0: -16, z0: -10, x1: -10, z1: -7.6, h: 2.6, kind: 'containerA' },
    { x0: 10, z0: -10, x1: 16, z1: -7.6, h: 2.6, kind: 'containerB' },
    { x0: -16, z0: 9, x1: -10, z1: 11.4, h: 2.6, kind: 'containerC' },
    { x0: 10, z0: 9, x1: 16, z1: 11.4, h: 2.6, kind: 'containerA' },
    // Crates: low cover dotted along lanes and sites.
    { x0: -4.4, z0: -9, x1: -2.6, z1: -7.2, h: 1.3, kind: 'crate' },
    { x0: 2.6, z0: -9, x1: 4.4, z1: -7.2, h: 1.3, kind: 'crate' },
    { x0: -4.4, z0: 7.2, x1: -2.6, z1: 9, h: 1.3, kind: 'crate' },
    { x0: 2.6, z0: 7.2, x1: 4.4, z1: 9, h: 1.3, kind: 'crate' },
    { x0: -25.2, z0: -11, x1: -23, z1: -8.8, h: 1.3, kind: 'crate' },
    { x0: -28.4, z0: -6.4, x1: -26.6, z1: -4.6, h: 1.3, kind: 'crate' },
    { x0: -21.4, z0: -6.2, x1: -19.6, z1: -4.4, h: 1.3, kind: 'crate' },
    { x0: 23, z0: -11, x1: 25.2, z1: -8.8, h: 1.3, kind: 'crate' },
    { x0: 26.6, z0: -6.4, x1: 28.4, z1: -4.6, h: 1.3, kind: 'crate' },
    { x0: 19.6, z0: -6.2, x1: 21.4, z1: -4.4, h: 1.3, kind: 'crate' },
    { x0: -27.4, z0: -15.6, x1: -25.6, z1: -13.8, h: 1.3, kind: 'crate' },
    { x0: 25.6, z0: -15.6, x1: 27.4, z1: -13.8, h: 1.3, kind: 'crate' },
    { x0: -9.4, z0: 5.6, x1: -7.6, z1: 7.4, h: 1.3, kind: 'crate' },
    { x0: 7.6, z0: 5.6, x1: 9.4, z1: 7.4, h: 1.3, kind: 'crate' },
    { x0: -2.9, z0: -6.2, x1: -1.7, z1: -5, h: 1.1, kind: 'crate' },
    { x0: 1.7, z0: -6.2, x1: 2.9, z1: -5, h: 1.1, kind: 'crate' },
    { x0: -2.9, z0: 5, x1: -1.7, z1: 6.2, h: 1.1, kind: 'crate' },
    { x0: 1.7, z0: 5, x1: 2.9, z1: 6.2, h: 1.1, kind: 'crate' },
  ],
  sites: {
    A: { x0: -27, z0: -11, x1: -19, z1: -2, label: 'SITE A', cx: -23, cz: -6.5 },
    B: { x0: 19, z0: -11, x1: 27, z1: -2, label: 'SITE B', cx: 23, cz: -6.5 },
  },
  spawns: {
    attackers: [
      { x: -4, z: -19.5 }, { x: 0, z: -20 }, { x: 4, z: -19.5 }, { x: 0, z: -18 },
    ],
    defenders: [
      { x: -4, z: 19.5 }, { x: 4, z: 19.5 }, { x: 0, z: 18.5 },
    ],
  },
  // Waypoint graph. Bots run BFS over edges; hold nodes are defensive posts.
  nodes: {
    ATK: { x: 0, z: -19 }, GW: { x: -12, z: -16.5 }, GM: { x: 0, z: -16.5 }, GE: { x: 12, z: -16.5 },
    A1: { x: -24, z: -15 }, A2: { x: -24, z: -9 }, A3: { x: -21, z: -7 }, AS: { x: -23, z: -7 },
    B1: { x: 24, z: -15 }, B2: { x: 24, z: -9 }, B3: { x: 21, z: -7 }, BS: { x: 23, z: -7 },
    AIN: { x: -19, z: -5 }, BIN: { x: 19, z: -5 },
    ASOUTH: { x: -25, z: 4 }, BSOUTH: { x: 25, z: 4 },
    M1: { x: 0, z: -12 }, M2: { x: 0, z: -6 }, M3: { x: 0, z: 0 }, M4: { x: 0, z: 7 }, M5: { x: 0, z: 13 },
    CW: { x: -14, z: 8 }, CE: { x: 14, z: 8 }, CW2: { x: -21, z: 8 }, CE2: { x: 21, z: 8 },
    DW: { x: -12, z: 16.5 }, DM: { x: 0, z: 16.5 }, DE: { x: 12, z: 16.5 }, DEF: { x: 0, z: 19 },
    HA: { x: -20, z: 4 }, HB: { x: 20, z: 4 }, HM: { x: 0, z: 12 },
  },
  edges: [
    ['ATK', 'GW'], ['ATK', 'GM'], ['ATK', 'GE'],
    ['GW', 'A1'], ['A1', 'A2'], ['A2', 'A3'], ['A3', 'AS'], ['A3', 'AIN'], ['AIN', 'M2'],
    ['A2', 'ASOUTH'], ['ASOUTH', 'A3'], ['ASOUTH', 'CW2'],
    ['GE', 'B1'], ['B1', 'B2'], ['B2', 'B3'], ['B3', 'BS'], ['B3', 'BIN'], ['BIN', 'M2'],
    ['B2', 'BSOUTH'], ['BSOUTH', 'B3'], ['BSOUTH', 'CE2'],
    ['GM', 'M1'], ['M1', 'M2'], ['M2', 'M3'], ['M3', 'M4'], ['M4', 'M5'], ['M5', 'DM'],
    ['M4', 'CW'], ['M4', 'CE'], ['CW', 'CW2'], ['CE', 'CE2'],
    ['CW', 'DW'], ['CE', 'DE'], ['DW', 'DEF'], ['DM', 'DEF'], ['DE', 'DEF'],
    ['CW2', 'HA'], ['CE2', 'HB'], ['M5', 'HM'], ['HA', 'DW'], ['HB', 'DE'],
  ],
  // Attack plans: each attacker bot gets a site and a route there.
  plans: {
    A: [['ATK', 'GW', 'A1', 'A2', 'A3', 'AS'], ['ATK', 'GM', 'M1', 'M2', 'AIN', 'A3', 'AS']],
    B: [['ATK', 'GE', 'B1', 'B2', 'B3', 'BS'], ['ATK', 'GM', 'M1', 'M2', 'BIN', 'B3', 'BS']],
  },
  // Where attackers hold after the plant, and where defenders post up.
  siteHolds: {
    A: ['A3', 'AIN', 'A2', 'ASOUTH'],
    B: ['B3', 'BIN', 'B2', 'BSOUTH'],
  },
  defenderPosts: [
    { node: 'HA', yaw: Math.PI / 4 },
    { node: 'HB', yaw: -Math.PI / 4 },
    { node: 'HM', yaw: 0 },
  ],
};
