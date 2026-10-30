import {
  bases as startingBases,
  players,
  startingResourcesByBase,
} from "./gameState";

import { mapOne } from "../../src/game/maps/mapOne";

import { BALANCE } from "../../src/game/balance";

import type { Base, GameState, MatchType, Tile, Treasure } from "./types";

import type { CharacterClass } from "./characters";

/*
 * Builds a fresh runtime GameState from the static configuration in
 * gameState.ts.
 *
 * This function is used when starting or resetting a match. It creates new
 * copies of mutable objects so live gameplay cannot mutate the static
 * starting configuration.
 */

function createStartingLayout(
  activePlayerIds: number[],
  mapId: string,
): { bases: Base[]; treasures: Treasure[] } {
  const map = mapOne;

  const initialBases = startingBases.filter((base) =>
    activePlayerIds.includes(base.playerId),
  );

  const eligibleTiles = map.filter((tile) => tile.multiplier === 1);

  if (eligibleTiles.length < initialBases.length) {
    throw new Error("Not enough eligible starting tiles.");
  }

  const resourceTypes = ["water", "fire", "grass"] as const;

  const distance = (
    a: { row: number; col: number },
    b: { row: number; col: number },
  ) => getManhattanDistance(a.row, a.col, b.row, b.col);

  // Lower scores are better.
  // Compare nearby opportunities, not just the closest tile.
  const accessScore = (
    base: Base,
    tiles: { row: number; col: number }[],
    count: number,
  ): number => {
    const distances = tiles
      .map((tile) => distance(base, tile))
      .sort((a, b) => a - b);

    if (distances.length === 0) return 20;

    const nearest = distances.slice(0, count);

    return nearest.reduce((sum, value) => sum + value, 0) / nearest.length;
  };

  const candidates: {
    bases: Base[];
    treasures: Treasure[];
    score: number;
  }[] = [];

  for (let attempt = 0; attempt < 500; attempt++) {
    const shuffled = [...eligibleTiles].sort(() => Math.random() - 0.5);

    const selected: Tile[] = [];

    for (const tile of shuffled) {
      if (selected.every((other) => distance(tile, other) >= 4)) {
        selected.push(tile);
      }

      if (selected.length === initialBases.length) break;
    }

    if (selected.length !== initialBases.length) continue;

    const bases = initialBases.map((base, index) => ({
      ...base,
      row: selected[index].row,
      col: selected[index].col,
    }));

    // Generate treasure for this specific candidate layout.
    const treasures = createStartingTreasures(
      bases,
      mapId,
      activePlayerIds.length,
    );

    const expectedTreasureCount =
      activePlayerIds.length * BALANCE.startingTreasure.chestsPerPlayer;

    if (treasures.length !== expectedTreasureCount) continue;

    const playerScores = bases.map((base) => {
      let score = 0;

      // Access to all three resources.
      for (const resource of resourceTypes) {
        const tiles = map.filter((tile) => tile.resource === resource);

        score += accessScore(base, tiles, 3);
      }

      // Access to boosted production tiles.
      score +=
        accessScore(
          base,
          map.filter((tile) => tile.multiplier === 2),
          2,
        ) * 2;

      score +=
        accessScore(
          base,
          map.filter((tile) => tile.multiplier === 3),
          2,
        ) * 3;

      // Access to treasure.
      score += accessScore(base, treasures, 2) * 2;

      // Access to expansion keys.
      const keyTreasures = treasures.filter(
        (treasure) => treasure.expansionKeys > 0,
      );

      if (keyTreasures.length > 0) {
        score += accessScore(base, keyTreasures, 1) * 2;
      }

      return score;
    });

    const highest = Math.max(...playerScores);
    const lowest = Math.min(...playerScores);

    const average =
      playerScores.reduce((sum, score) => sum + score, 0) / playerScores.length;

    // Prioritize fairness, then overall accessibility.
    const fairnessScore = (highest - lowest) * 5 + average;

    candidates.push({
      bases,
      treasures,
      score: fairnessScore,
    });
  }

  if (candidates.length === 0) {
    throw new Error("Could not generate a valid starting layout.");
  }

  candidates.sort((a, b) => a.score - b.score);

  // Preserve variety by choosing from the best candidates.
  const topCandidates = candidates.slice(0, 10);

  const chosen =
    topCandidates[Math.floor(Math.random() * topCandidates.length)];

  return {
    bases: chosen.bases,
    treasures: chosen.treasures,
  };
}

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
  _mapId: string,
  playerCount: number,
): Treasure[] {
  const map = mapOne;

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
  factionsByPlayer: Record<number, CharacterClass | null> = {},
): GameState {
  const { bases: initialBases, treasures: initialTreasures } =
    createStartingLayout(activePlayerIds, mapId);

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
      level:
        factionsByPlayer[base.playerId] === "engineer"
          ? BALANCE.factions.engineer.startingBaseLevel
          : 1,

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

    factionsByPlayer: Object.fromEntries(
      activePlayerIds.map((playerId) => [playerId, factionsByPlayer[playerId]]),
    ) as Record<number, CharacterClass>,

    researchByPlayer: Object.fromEntries(
      activePlayerIds.map((playerId) => [
        playerId,
        {
          military: 1,
          production: 1,
          efficiency: 1,
        },
      ]),
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
