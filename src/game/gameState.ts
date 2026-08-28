import type { Base, Player, BaseResources } from "./types";

export const maps = [
  {
    id: "exile-island",
    name: "EXiLE ISLAND",
    minPlayers: 2,
    maxPlayers: 4,
    rows: 8,
    columns: 8,
  },
  {
    id: "map-two",
    name: "Map Two",
    minPlayers: 2,
    maxPlayers: 2,
    rows: 8,
    columns: 4,
  },
];

export const matchTypes = {
  "30m": {
    name: "30 Minutes",
    durationMinutes: 30,
  },

  "sudden-death": {
    name: "Sudden Death",
    durationMinutes: null,
  },
};

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
    2: "Rumrunner Rest",
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
    timeInLocationSeconds: 0,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    training: null,
    relocations: 0,
    isRelocating: false,
  },

  {
    id: 2,
    playerId: 2,
    baseSlot: 1,
    row: 3,
    col: 7,
    timeInLocationSeconds: 0,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    training: null,
    relocations: 0,
    isRelocating: false,
  },

  {
    id: 3,
    playerId: 3,
    baseSlot: 1,
    row: 7,
    col: 3,
    timeInLocationSeconds: 0,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    training: null,
    relocations: 0,
    isRelocating: false,
  },

  {
    id: 4,
    playerId: 4,
    baseSlot: 1,
    row: 4,
    col: 0,
    timeInLocationSeconds: 0,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    training: null,
    relocations: 0,
    isRelocating: false,
  },
];

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
