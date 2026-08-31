import {
  bases as startingBases,
  players,
  startingResourcesByBase,
} from "./gameState";

import type {
  GameState,
  MatchType,
} from "./types";

export function createInitialGameState(
  activePlayerIds: number[] =
    players.map(
      (player) => player.id,
    ),

  matchType: MatchType = "30m",
  mapId: string = "exile-island",
): GameState {
  const mapTwoStarts = [
    { row: 0, col: 1 }, // B1
    { row: 7, col: 2 }, // C8
  ];

  const initialBases =
    startingBases
      .filter((base) =>
        activePlayerIds.includes(base.playerId),
      )
      .map((base, index) => {
        if (mapId !== "map-two") {
          return base;
        }

        const start =
          mapTwoStarts[index];

        return {
          ...base,
          row: start.row,
          col: start.col,
        };
      });

    /*
     * ==================================================
     * TEMPORARY TRANSFER TEST BASE
     * ==================================================
     *
     * Gives Player 1 a second base so Transfer can be
     * tested before Expansion is server-authoritative.
     *
     * REMOVE AFTER TRANSFER TESTING.
     */
    const playerOneBase =
      initialBases.find(
        (base) =>
          base.playerId === 1,
      );

    if (
      playerOneBase &&
      mapId === "exile-island"
    ) {
      initialBases.push({
        ...playerOneBase,

        id: 99,

        baseSlot: 2,

        row:
          playerOneBase.row + 1,

        col:
          playerOneBase.col,

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
      });
    }


  return {
    gameSeconds: 0,

    matchType,

    mapId,

    /*
     * Fresh copies so a reset cannot accidentally
     * reuse mutated live-game objects.
     */
    bases:
      initialBases.map((base) => ({
        ...base,

        armies: {
          ...base.armies,
        },

        armiesBuilt: {
          ...base.armiesBuilt,
        },

        training:
          base.training
            ? { ...base.training }
            : null,
      })),

    resourcesByBase:
      Object.fromEntries(
        initialBases.map((base) => {
          const startingResources =
            startingResourcesByBase[
              base.id
            ];

          return [
            base.id,

            startingResources
              ? {
                  ...startingResources,
                }
              : {
                  water: 50,
                  fire: 50,
                  grass: 50,
                },
          ];
        }),
      ),

    expansionKeysByPlayer:
      Object.fromEntries(
        activePlayerIds.map(
          (playerId) => [
            playerId,
            1,
          ],
        ),
      ),

    armiesTrainedByPlayer:
      Object.fromEntries(
        activePlayerIds.map(
          (playerId) => [
            playerId,
            0,
          ],
        ),
      ),

    armyResourcesSpentByPlayer:
      Object.fromEntries(
        activePlayerIds.map(
          (playerId) => [
            playerId,
            0,
          ],
        ),
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