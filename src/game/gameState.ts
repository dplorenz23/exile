import { emptyUnitCounts } from "./types";
import type { Base, BaseResources, Player } from "./types";
import { BALANCE } from "../../src/game/balance";
/*
 * Static game configuration used when creating a new match.
 *
 * This file does not contain live match state. Runtime state is created
 * separately in createInitialGameState.ts.
 */

interface MapConfig {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  rows: number;
  columns: number;
}

export const maps: MapConfig[] = [
  {
    id: "exile-island",
    name: "EXiLE ISLAND",
    minPlayers: 2,
    maxPlayers: 4,
    rows: 8,
    columns: 8,
  },
];

export const players: Player[] = [
  {
    id: 1,
    name: "Survivor 1",
    color: "#4f8cff",
    avatar: "🎖️",
    research: {
      military: 1,
      production: 1,
      efficiency: 1,
    },
  },
  {
    id: 2,
    name: "Survivor 2",
    color: "#e05a47",
    avatar: "🔧",
    research: {
      military: 1,
      production: 1,
      efficiency: 1,
    },
  },
  {
    id: 3,
    name: "Survivor 3",
    color: "#d8b640",
    avatar: "🌾",
    research: {
      military: 1,
      production: 1,
      efficiency: 1,
    },
  },
  {
    id: 4,
    name: "Survivor 4",
    color: "#9b6bd6",
    avatar: "🔬",
    research: {
      military: 1,
      production: 1,
      efficiency: 1,
    },
  },
];

export const baseNamesByPlayer: Record<number, Record<1 | 2 | 3, string>> = {
  1: {
    1: "Base 1",
    2: "Base 2",
    3: "Base 3",
  },
  2: {
    1: "Base 1",
    2: "Base 2",
    3: "Base 3",
  },
  3: {
    1: "Base 1",
    2: "Base 2",
    3: "Base 3",
  },
  4: {
    1: "Base 1",
    2: "Base 2",
    3: "Base 3",
  },
};

export function getBaseName(playerId: number, baseSlot: 1 | 2 | 3) {
  return baseNamesByPlayer[playerId]?.[baseSlot] ?? `Base ${baseSlot}`;
}

/*
 * Default starting bases for EXiLE Island.
 *
 * These are used as seed data for new matches. Map-specific adjustments
 * can be applied later when createInitialGameState.ts builds runtime state.
 */
export const bases: Base[] = [
  {
    id: 1,
    playerId: 1,
    baseSlot: 1,
    row: 0,
    col: 3,
    timeInLocationSeconds: 0,
    level: 1,
    upgradeCompletesAt: null,

    armies: emptyUnitCounts(),
    armiesBuilt: emptyUnitCounts(),

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
    level: 1,
    upgradeCompletesAt: null,

    armies: emptyUnitCounts(),
    armiesBuilt: emptyUnitCounts(),

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
    level: 1,
    upgradeCompletesAt: null,

    armies: emptyUnitCounts(),
    armiesBuilt: emptyUnitCounts(),

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
    level: 1,
    upgradeCompletesAt: null,

    armies: emptyUnitCounts(),
    armiesBuilt: emptyUnitCounts(),

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
        ...BALANCE.startingBase.resources,
      },
    ]),
  );
