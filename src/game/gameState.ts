import type { Base, Player, ResourceType } from "./types";

export const players: Player[] = [
  {
    id: 1,
    name: "Albus",
    color: "#4f8cff",
    avatar: "🧙",
  },
  {
    id: 2,
    name: "Galahad",
    color: "#e05a47",
    avatar: "🛡️",
  },
  {
    id: 3,
    name: "Magnus",
    color: "#d8b640",
    avatar: "🪓",
  },
  {
    id: 4,
    name: "Blackbeard",
    color: "#9b6bd6",
    avatar: "🏴‍☠️",
  },
];

export const baseNamesByPlayer: Record<
  number,
  Record<1 | 2 | 3, string>
> = {
  1: {
    1: "Emberkeep",
    2: "Spellhaven",
    3: "Moonspire",
  },

  2: {
    1: "Ironhold",
    2: "Highwatch",
    3: "Stonegate",
  },

  3: {
    1: "Frostholm",
    2: "Ravenfjord",
    3: "Skullhaven",
  },

  4: {
    1: "Blackwater",
    2: "Rumrunner's Rest",
    3: "Deadman's Cay",
  },
};

export function getBaseName(
  playerId: number,
  baseSlot: 1 | 2 | 3,
) {
  return (
    baseNamesByPlayer[playerId]?.[baseSlot] ??
    `Base ${baseSlot}`
  );
}

export const bases: Base[] = [
  {
    id: 1,
    playerId: 1,
    baseSlot: 1,
    row: 0,
    col: 3,
    timeInLocationSeconds: 100,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
    relocations: 0,
    isRelocating: false,
  },
  {
    id: 2,
    playerId: 2,
    baseSlot: 1,
    row: 1,
    col: 7,
    timeInLocationSeconds: 210,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
    relocations: 0,
    isRelocating: false,
  },
  {
    id: 3,
    playerId: 3,
    baseSlot: 1,
    row: 7,
    col: 6,
    timeInLocationSeconds: 420,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
    relocations: 0,
    isRelocating: false,
  },
  {
    id: 4,
    playerId: 4,
    baseSlot: 1,
    row: 6,
    col: 0,
    timeInLocationSeconds: 620,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
    relocations: 0,
    isRelocating: false,
  },
  {
  id: 5,
  playerId: 1,
  baseSlot: 2,
  row: 3,
  col: 2,
  timeInLocationSeconds: 350,

  armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
    relocations: 0,
    isRelocating: false,
},
 {
  id: 6,
  playerId: 2,
  baseSlot: 2,
  row: 4,
  col: 4,
  timeInLocationSeconds: 350,

  armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
    relocations: 0,
    isRelocating: false,
},
];

export interface BaseResources {
  water: number;
  fire: number;
  grass: number;
}

export const startingResourcesByBase: Record<number, BaseResources> =
  Object.fromEntries(
    bases.map((base) => [
      base.id,
      {
        water: 50,
        fire: 50,
        grass: 50,
      },
    ]),
  );
