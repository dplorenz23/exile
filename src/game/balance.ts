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

  research: {
    military: {
      attackBonusPerLevel: 0.15,
      healthBonusPerLevel: 0.15,
      costs: {
        2: { water: 50, fire: 150, grass: 50 },
        3: { water: 100, fire: 300, grass: 100 },
        4: { water: 150, fire: 450, grass: 150 },
      },
    },

    production: {
      bonusPerLevel: 0.15,
      costs: {
        2: { water: 50, fire: 50, grass: 150 },
        3: { water: 100, fire: 100, grass: 300 },
        4: { water: 150, fire: 150, grass: 450 },
      },
    },

    efficiency: {
      costReductionPerLevel: 0.1,
      costs: {
        2: { water: 150, fire: 50, grass: 50 },
        3: { water: 300, fire: 100, grass: 100 },
        4: { water: 450, fire: 150, grass: 150 },
      },
    },
  },

  baseUpgrades: {
    costs: {
      2: { water: 100, fire: 100, grass: 100 },
      3: { water: 200, fire: 200, grass: 200 },
      4: { water: 300, fire: 300, grass: 300 },
    },

    upgradeSeconds: {
      2: 10,
      3: 20,
      4: 30,
    },
  },

  startingTreasure: {
    chestsPerPlayer: 1,

    minimumResources: 200,
    maximumResources: 300,
    resourceIncrement: 50,

    expansionKeysPerTwoPlayers: 1,

    minimumStartDistance: 3,
    preferredMaximumStartDistance: 4,
  },

  units: {
    guardian: {
      health: 150,
      attack: 15,
      speed: 1,
      cost: { water: 15, fire: 65, grass: 20 },
    },
    marksman: {
      health: 100,
      attack: 25,
      speed: 2,
      cost: { water: 20, fire: 40, grass: 40 },
    },
    medic: {
      health: 70,
      attack: 5,
      speed: 2,
      healing: 10,
      cost: { water: 65, fire: 10, grass: 25 },
    },
    spy: {
      health: 40,
      attack: 5,
      speed: 3,
      cost: { water: 30, fire: 15, grass: 55 },
    },
  },

  combat: {
    retreatDisadvantageRatio: 2,
    maxRounds: 10,
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
    maxActivePerPlayer: 3,
  },

  scoring: {
    baseValue: 500,
    armyValue: 200,
  },

  match: {
    timedMatchSeconds: 1800,
  },
} as const;
