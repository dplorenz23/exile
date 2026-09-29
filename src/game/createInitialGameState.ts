import {
  bases as startingBases,
  players,
  startingResourcesByBase,
} from "./gameState";

import { mapOne } from "../../src/game/maps/mapOne";
import { mapTwo } from "../../src/game/maps/mapTwo";

import { BALANCE } from "../../src/game/balance";

import type { Base, GameState, MatchType, Tile, Treasure } from "./types";

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

function getManhattanDistance(
  rowA: number,
  colA: number,
  rowB: number,
  colB: number,
): number {
  return Math.abs(rowA - rowB) + Math.abs(colA - colB);
}

function createStartingTreasureResources(): {
  water: number;
  fire: number;
  grass: number;
} {
  const resourceTypes = ["water", "fire", "grass"] as const;

  const resources = {
    water: 0,
    fire: 0,
    grass: 0,
  };

  const increment = BALANCE.startingTreasure.resourceIncrement;

  const possibleTotals: number[] = [];

  for (
    let total = BALANCE.startingTreasure.minimumResources;
    total <= BALANCE.startingTreasure.maximumResources;
    total += increment
  ) {
    possibleTotals.push(total);
  }

  const totalResources =
    possibleTotals[Math.floor(Math.random() * possibleTotals.length)];

  const shuffledTypes = [...resourceTypes].sort(() => Math.random() - 0.5);

  resources[shuffledTypes[0]] += increment;
  resources[shuffledTypes[1]] += increment;

  let remainingResources = totalResources - increment * 2;

  while (remainingResources > 0) {
    const resource =
      resourceTypes[Math.floor(Math.random() * resourceTypes.length)];

    resources[resource] += increment;

    remainingResources -= increment;
  }

  return resources;
}

function createStartingTreasures(
  initialBases: Base[],
  mapId: string,
  playerCount: number,
): Treasure[] {
  const map: Tile[] = mapId === "map-two" ? mapTwo : mapOne;

  const treasureCount = playerCount * BALANCE.startingTreasure.chestsPerPlayer;

  const expansionKeyChestCount =
    Math.floor(playerCount / 2) *
    BALANCE.startingTreasure.expansionKeysPerTwoPlayers;

  /*
   * Find every tile that is far enough away
   * from every player's starting base.
   */
  const eligibleTiles = map.filter((tile) => {
    return initialBases.every((base) => {
      const distance = getManhattanDistance(
        tile.row,
        tile.col,
        base.row,
        base.col,
      );

      return distance >= BALANCE.startingTreasure.minimumStartDistance;
    });
  });

  /*
   * Prefer tiles whose nearest starting base
   * is no more than the preferred maximum distance.
   */
  const preferredTiles = eligibleTiles.filter((tile) => {
    const nearestStartDistance = Math.min(
      ...initialBases.map((base) =>
        getManhattanDistance(tile.row, tile.col, base.row, base.col),
      ),
    );

    return (
      nearestStartDistance <=
      BALANCE.startingTreasure.preferredMaximumStartDistance
    );
  });

  /*
   * Use preferred tiles if enough exist.
   * Otherwise fall back to all legal tiles.
   */
  const availableTiles =
    preferredTiles.length >= treasureCount ? preferredTiles : eligibleTiles;

  /*
   * Shuffle so treasure locations change each match.
   */
  const shuffledTiles = [...availableTiles].sort(() => Math.random() - 0.5);

  return shuffledTiles.slice(0, treasureCount).map((tile, index) => ({
    id: index + 1,

    row: tile.row,
    col: tile.col,

    resources: createStartingTreasureResources(),

    expansionKeys: index < expansionKeyChestCount ? 1 : 0,
  }));
}

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

  const initialTreasures = createStartingTreasures(
    initialBases,
    mapId,
    activePlayerIds.length,
  );

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
                ...BALANCE.startingBase.resources,
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

    treasures: initialTreasures,
    nextTreasureId: initialTreasures.length + 1,

    eliminatedPlayerIds: [],

    winnerPlayerId: null,
  };
}
