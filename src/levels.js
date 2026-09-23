// Level themes. Each level is a dive deeper: the palette, scenery and enemy mix
// follow the ocean zones (sunlit -> twilight -> midnight -> hadal trench).
(function (SS) {
  const P = SS.P;
  SS.LEVELS = [
    {
      name: 'SUNLIT SHALLOWS', zone: 'EPIPELAGIC ZONE', surf: 90, skyline: 'harbor', boss: 'ship', maxDepth: 200, len: 3200, seed: 11,
      sky: ['#3aa6f0', '#9adcff', '#d8f4ff'], water: ['#28b0d8', '#1468a8', '#0a3470'],
      far: '#1a70a8', rays: 0.09, snow: '#d8f6ff', stars: false, ice: false, air: true,
      groundBase: 194, groundAmp: 14, deco: ['kelp', 'kelp', 'rock', 'coral'],
      theme: { hull: P.STEEL, belly: P.YELLOW, air: P.OLIVE, glow: P.RGLOW, mine: P.DARK, crab: P.CRAB, jelly: P.PURP, sea: P.SAND, coral: P.CORAL },
      mix: { sub: 5, mine: 3, minefield: 1, boat: 3, heli: 2, jet: 2, drone: 1 }, gap: [80, 130], bossHp: 70,
    },
    {
      name: 'TWILIGHT REEF', zone: 'MESOPELAGIC ZONE', surf: 80, skyline: 'rigs', boss: 'dread', maxDepth: 1000, len: 3800, seed: 23,
      sky: ['#1c1238', '#8a3a6a', '#f89050'], water: ['#1a7a86', '#123e66', '#0a1a3a'],
      far: '#10385a', rays: 0.05, snow: '#a8e0e8', stars: false, ice: false, air: true,
      groundBase: 190, groundAmp: 18, deco: ['coral', 'coral', 'rock', 'kelp'],
      theme: { hull: P.TEAL, belly: P.ORANGE, air: P.BONE, glow: P.RGLOW, mine: P.NAVY, crab: P.CRAB, jelly: P.PURP, sea: ['#1a0a1e', '#3a1a3a', '#6a3050', '#9a5068', '#c88a8a'], coral: P.CORAL, cloud: ['#6a2a4a', '#b05a6a', '#f0a080', '#ffd8a8'] },
      mix: { sub: 4, mine: 2, minefield: 1, boat: 2, heli: 2, jet: 1, drone: 3, turret: 3 }, gap: [70, 120], bossHp: 95,
    },
    {
      name: 'MIDNIGHT ZONE', zone: 'BATHYPELAGIC ZONE', surf: 70, skyline: 'city', boss: 'ship', maxDepth: 4000, len: 4200, seed: 37,
      sky: ['#01020a', '#060a22', '#0e1840'], water: ['#0c2446', '#061028', '#020410'],
      far: '#081830', rays: 0, snow: '#6ae0ff', stars: true, ice: false, air: true,
      groundBase: 194, groundAmp: 22, deco: ['glow', 'vent', 'rock', 'glow'],
      theme: { shipHull: P.NAVY, hull: P.DARK, belly: P.TEAL, air: P.DARK, glow: P.CGLOW, mine: P.DARK, crab: P.CRAB, jelly: P.PURP, sea: ['#04040a', '#10101c', '#22223a', '#383a5a', '#5a5e88'], coral: P.TEAL, cloud: ['#0a1030', '#1a2450', '#2a3a6a'] },
      mix: { sub: 3, mine: 2, minefield: 1, drone: 3, turret: 2, crab: 3, jelly: 4, boat: 2, jet: 2 }, gap: [65, 110], bossHp: 120,
    },
    {
      name: 'HADAL ICE TRENCH', zone: 'HADAL ZONE', surf: 62, skyline: 'bergs', boss: 'dread', maxDepth: 11000, len: 4600, seed: 53,
      sky: ['#02060c', '#0a1a28', '#1a3a4a'], water: ['#1a5a6a', '#0a2638', '#02080e'],
      far: '#0a2230', rays: 0.03, snow: '#c8f4ff', stars: false, ice: true, air: false,
      groundBase: 196, groundAmp: 16, deco: ['crystal', 'crystal', 'rock', 'glow'],
      theme: { hull: P.ICE, belly: P.NAVY, air: P.STEEL, glow: P.CGLOW, mine: P.NAVY, crab: P.ICE, jelly: P.ICE, sea: ['#061018', '#102a38', '#1e4a60', '#3a7a90', '#8ac8d8'], coral: P.ICE },
      mix: { sub: 3, mine: 2, minefield: 2, drone: 3, turret: 2, crab: 2, jelly: 2, icicle: 4 }, gap: [60, 100], bossHp: 150,
    },
  ];
})(window.SS);
