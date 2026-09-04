import {
  bases as startingBases,
  players,
  startingResourcesByBase,
} from "./gameState";

import type { GameState, MatchType } from "./types";

/*
 * Builds a fresh runtime GameState from the static configuration in
 * gameState.ts.
 *
 * This function is used when starting or resetting a match. It creates new
 * copies of mutable objects so live gameplay cannot mutate the static
 * starting configuration.
 */

interface StartingPosition {
  row: number;
  col: number;
}

const mapTwoStarts: StartingPosition[] = [
  { row: 0, col: 1 }, // B1
  { row: 7, col: 2 }, // C8
];

export function createInitialGameState(
  activePlayerIds: number[] = players.map((player) => player.id),
  matchType: MatchType = "30m",
  mapId: string = "exile-island",
): GameState {
  const initialBases = startingBases
    .filter((base) => activePlayerIds.includes(base.playerId))
    .map((base, index) => {
      if (mapId !== "map-two") {
        return base;
      }

      const start = mapTwoStarts[index];

      if (!start) {
        return base;
      }

      return {
        ...base,
        row: start.row,
        col: start.col,
      };
    });

  return {
    gameSeconds: 0,

    matchType,
    mapId,

    /*
     * Fresh copies prevent a reset from reusing objects that may have been
     * mutated during a previous match.
     */
    bases: initialBases.map((base) => ({
      ...base,

      armies: {
        ...base.armies,
      },

      armiesBuilt: {
        ...base.armiesBuilt,
      },

      training: base.training ? { ...base.training } : null,
    })),

    resourcesByBase: Object.fromEntries(
      initialBases.map((base) => {
        const startingResources = startingResourcesByBase[base.id];

        return [
          base.id,
          startingResources
            ? { ...startingResources }
            : {
                water: 50,
                fire: 50,
                grass: 50,
              },
        ];
      }),
    ),

    expansionKeysByPlayer: Object.fromEntries(
      activePlayerIds.map((playerId) => [playerId, 1]),
    ),

    expansionsCompletedByPlayer: Object.fromEntries(
      activePlayerIds.map((playerId) => [playerId, 0]),
    ),

    armiesTrainedByPlayer: Object.fromEntries(
      activePlayerIds.map((playerId) => [playerId, 0]),
    ),

    armyResourcesSpentByPlayer: Object.fromEntries(
      activePlayerIds.map((playerId) => [playerId, 0]),
    ),

    finalScoreByPlayer: {},

    armyMissions: [],
    nextMissionId: 1,

    gameEvents: [],
    nextGameEventId: 1,

    treasures: [],
    nextTreasureId: 1,

    eliminatedPlayerIds: [],

    winnerPlayerId: null,
  };
}
