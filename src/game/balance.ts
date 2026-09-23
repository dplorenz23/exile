export const BALANCE = {
  startingBase: {
    resources: {
      water: 100,
      fire: 100,
      grass: 100,
    },
  },

  production: {
    level2Seconds: 120,
    level3Seconds: 300,
    level4Seconds: 600,

    primaryByLevel: [1, 2, 3, 4],
    secondaryByLevel: [0, 1, 1, 2],
  },

  armies: {
    trainingSeconds: 10,
    baseCost: 100,
    costIncrease: 50,
    cargoCapacity: 200,
  },

  expansion: {
    baseCost: 250,
    costIncrease: 250,
    keyCost: 1,
    maxBases: 3,

    startingResources: {
      water: 100,
      fire: 100,
      grass: 100,
    },
  },

  relocation: {
    baseCost: 250,
    costIncrease: 250,
    travelSecondsPerTile: 15,
  },

  missions: {
    travelSecondsPerTile: 5,
  },

  scoring: {
    baseValue: 500,
  },

  match: {
    timedMatchSeconds: 1800,
  },
} as const;
