import { createInitialGameState } from "../../src/game/createInitialGameState";
import { mapOne } from "../../src/game/maps/mapOne";
import { mapTwo } from "../../src/game/maps/mapTwo";
import {
  getArmyCost,
  getLocationMultiplier,
  resolveCombat,
  calculateLoot,
  calculatePlayerScore,
} from "../../src/game/rules";

import type {
  ArmyCounts,
  ArmyMission,
  BaseResources,
  GameState,
  MatchType,
  ResourceType,
} from "../../src/game/types";

import { WebSocket, WebSocketServer } from "ws";

/*
 * ==================================================
 * SERVER CONFIGURATION
 * ==================================================
 */

const PORT = 8080;

const server = new WebSocketServer({
  port: PORT,
});

const mapConfigs = {
  "exile-island": {
    minPlayers: 2,
    maxPlayers: 4,
  },

  "map-two": {
    minPlayers: 2,
    maxPlayers: 2,
  },
};

/*
 * ==================================================
 * SERVER TYPES
 * ==================================================
 */

type LobbyPlayer = {
  clientId: number;
  slotId: number;
  playerId: number;
  isReady: boolean;
  isHost: boolean;
};

/*
 * ==================================================
 * SERVER STATE
 * ==================================================
 */

let nextClientId = 1;

let hostClientId: number | null = null;

const connectedClients = new Map<number, WebSocket>();

const lobbyPlayers = new Map<number, LobbyPlayer>();

let matchConfig: {
  mapId: string;
  matchType: MatchType;
} = {
  mapId: "exile-island",
  matchType: "30m",
};

let gameState: GameState | null = null;

let gameTimer: NodeJS.Timeout | null = null;

/*
 * ==================================================
 * LOBBY HELPERS
 * ==================================================
 */

function getNextAvailableSlot() {
  const usedSlots = Array.from(lobbyPlayers.values()).map(
    (player) => player.slotId,
  );

  for (let slotId = 1; slotId <= 4; slotId++) {
    if (!usedSlots.includes(slotId)) {
      return slotId;
    }
  }

  return null;
}

function getNextAvailablePlayerId() {
  const usedPlayerIds = Array.from(lobbyPlayers.values()).map(
    (player) => player.playerId,
  );

  for (let playerId = 1; playerId <= 4; playerId++) {
    if (!usedPlayerIds.includes(playerId)) {
      return playerId;
    }
  }

  return null;
}

function broadcastLobby() {
  const players = Array.from(lobbyPlayers.values()).sort(
    (a, b) => a.slotId - b.slotId,
  );

  const message = JSON.stringify({
    type: "lobby-state",
    players,
    matchConfig,
  });

  for (const socket of connectedClients.values()) {
    socket.send(message);
  }
}

/*
 * ==================================================
 * GAME-STATE HELPERS
 * ==================================================
 */

function broadcastGameState() {
  if (!gameState) {
    return;
  }

  const message = JSON.stringify({
    type: "game-state",
    gameState,
  });

  for (const socket of connectedClients.values()) {
    socket.send(message);
  }
}

/*
 * ==================================================
 * SERVER GAME TICK
 * ==================================================
 *
 * This is the main migration target from App.tsx.
 *
 * As gameplay becomes server-authoritative, the
 * client-side interval logic from App.tsx should move
 * into the numbered sections below.
 *
 * IMPORTANT:
 * After moving a section here and testing it, disable
 * the matching client-side section so both sides do
 * not process the same game logic.
 */

function runGameTick() {
  if (!gameState) {
    return;
  }

  /*
   * Game is over.
   * Freeze authoritative game state.
   */
  if (gameState.winnerPlayerId !== null) {
    return;
  }

  /*
   * ==================================================
   * STEP 1:
   * AGE BASES AND PROCESS TRAINING
   * ==================================================
   *
   * MIGRATED FROM App.tsx.
   */

  const updatedArmiesTrainedByPlayer = {
    ...gameState.armiesTrainedByPlayer,
  };

  const updatedArmyResourcesSpentByPlayer = {
    ...gameState.armyResourcesSpentByPlayer,
  };

  let updatedBases = gameState.bases.map((base) => {
    /*
     * A relocating base still exists, but it does
     * not age or train while moving.
     */
    if (base.isRelocating) {
      return base;
    }

    let updatedArmies = base.armies;

    let updatedTraining = base.training;

    let updatedArmiesBuilt = base.armiesBuilt;

    if (base.training) {
      const secondsRemaining = base.training.secondsRemaining - 1;

      if (secondsRemaining <= 0) {
        const resource = base.training.resource;

        updatedArmies = {
          ...base.armies,

          [resource]: base.armies[resource] + 1,
        };

        updatedArmiesBuilt = {
          ...base.armiesBuilt,

          [resource]: base.armiesBuilt[resource] + 1,
        };

        const completedArmyCost = getArmyCost(base.armiesBuilt[resource]);

        updatedArmiesTrainedByPlayer[base.playerId] =
          (updatedArmiesTrainedByPlayer[base.playerId] ?? 0) + 1;

        updatedArmyResourcesSpentByPlayer[base.playerId] =
          (updatedArmyResourcesSpentByPlayer[base.playerId] ?? 0) +
          completedArmyCost;

        updatedTraining = null;
      } else {
        updatedTraining = {
          ...base.training,
          secondsRemaining,
        };
      }
    }

    return {
      ...base,

      timeInLocationSeconds: base.timeInLocationSeconds + 1,

      armies: updatedArmies,

      armiesBuilt: updatedArmiesBuilt,

      training: updatedTraining,
    };
  });

  const updatedResources = {
    ...gameState.resourcesByBase,
  };

  const updatedExpansionKeysByPlayer = {
    ...gameState.expansionKeysByPlayer,
  };

  const updatedTreasures = [...gameState.treasures];

  let nextTreasureId = gameState.nextTreasureId;

  const updatedGameEvents = [...gameState.gameEvents];

  let nextGameEventId = gameState.nextGameEventId;

  const updatedEliminatedPlayerIds = [...gameState.eliminatedPlayerIds];

  const updatedFinalScoreByPlayer = {
    ...gameState.finalScoreByPlayer,
  };

  let updatedWinnerPlayerId: number | null = gameState.winnerPlayerId;

  /*
   * ==================================================
   * STEP 2:
   * PROCESS ARMY / SETTLER / RELOCATION MISSIONS
   * ==================================================
   *
   * TODO — MIGRATE FROM App.tsx
   *
   * Expected contents:
   * - decrement mission secondsRemaining
   * - process outbound arrivals
   * - process returning arrivals
   * - transfer cargo
   * - loot treasure
   * - resolve attacks
   * - resolve expansion arrivals / collisions
   * - resolve relocation arrivals / collisions
   * - remove completed/lost missions
   *
   * When ready, paste the matching App.tsx block here
   * and migrate it carefully rather than rewriting it.
   */

  const updatedArmyMissions: ArmyMission[] = [];

  gameState.armyMissions.forEach((mission) => {
    /*
     * For now, only Transfer is
     * server-authoritative.
     *
     * Leave every other mission untouched
     * until we migrate it.
     */
    if (
      mission.type !== "transfer" &&
      mission.type !== "attack" &&
      mission.type !== "loot" &&
      mission.type !== "expand" &&
      mission.type !== "relocate"
    ) {
      updatedArmyMissions.push(mission);
      return;
    }

    /*
     * Mission is still traveling.
     */
    if (mission.secondsRemaining > 1) {
      updatedArmyMissions.push({
        ...mission,

        secondsRemaining: mission.secondsRemaining - 1,
      });

      return;
    }

    /*
     * ==================================================
     * ATTACK ARRIVAL
     * ==================================================
     */
    if (mission.type === "attack" && mission.phase === "outbound") {
      const defendingBase = updatedBases.find(
        (base) => base.id === mission.destinationBaseId,
      );

      const originBase = updatedBases.find(
        (base) => base.id === mission.originBaseId,
      );

      if (mission.originRow === undefined || mission.originCol === undefined) {
        return;
      }

      /*
       * If the target base disappeared before arrival,
       * turn the attackers around.
       */
      if (!defendingBase) {
        const distance =
          Math.abs(mission.originRow - mission.destinationRow!) +
          Math.abs(mission.originCol - mission.destinationCol!);

        updatedGameEvents.push({
          type: "mission-failed",

          id: nextGameEventId,

          gameSeconds: gameState.gameSeconds + 1,

          playerId: mission.playerId,

          missionType: "attack",

          reason: "destination-unavailable",

          baseName:
            mission.originBaseSlot !== undefined
              ? `Base ${mission.originBaseSlot}`
              : undefined,

          row: mission.destinationRow,
          col: mission.destinationCol,
        });

        nextGameEventId += 1;

        updatedArmyMissions.push({
          ...mission,

          phase: "returning",

          secondsRemaining: distance * 5,
        });

        return;
      }

      const combatResult = resolveCombat(mission.armies, defendingBase.armies);

      const survivingAttackers = combatResult.attackerSurvivors;

      const totalSurvivors =
        survivingAttackers.water +
        survivingAttackers.fire +
        survivingAttackers.grass;

      const returningExpansionKeys =
        combatResult.baseDestroyed && totalSurvivors > 0 ? 1 : 0;

      let returningResources = {
        water: 0,
        fire: 0,
        grass: 0,
      };

      let resourcesLooted = {
        water: 0,
        fire: 0,
        grass: 0,
      };

      let resourcesRemaining = {
        ...(updatedResources[defendingBase.id] ?? {
          water: 0,
          fire: 0,
          grass: 0,
        }),
      };

      /*
       * Update surviving defenders.
       */
      updatedBases = updatedBases.map((base) => {
        if (base.id !== defendingBase.id) {
          return base;
        }

        return {
          ...base,

          armies: combatResult.defenderSurvivors,
        };
      });

      const defenderScoreBeforeDestruction = calculatePlayerScore(
        defendingBase.playerId,
        updatedBases,
        updatedResources,
        updatedArmyMissions,
        updatedArmiesTrainedByPlayer[defendingBase.playerId] ?? 0,
        updatedArmyResourcesSpentByPlayer[defendingBase.playerId] ?? 0,
      ).totalScore;

      let eliminatedPlayerId: number | undefined;

      /*
       * Remove the defending base
       * if the attacker destroyed it.
       */
      if (combatResult.baseDestroyed) {
        /*
         * Remove destroyed base.
         */
        updatedBases = updatedBases.filter(
          (base) => base.id !== defendingBase.id,
        );

        /*
         * Zero surviving bases =
         * immediate elimination.
         */
        const defenderStillHasBase = updatedBases.some(
          (base) => base.playerId === defendingBase.playerId,
        );

        if (
          !defenderStillHasBase &&
          !updatedEliminatedPlayerIds.includes(defendingBase.playerId)
        ) {
          updatedEliminatedPlayerIds.push(defendingBase.playerId);

          /*
           * Freeze eliminated player's score.
           */
          updatedFinalScoreByPlayer[defendingBase.playerId] =
            defenderScoreBeforeDestruction;

          updatedGameEvents.push({
            type: "elimination",

            id: nextGameEventId,

            gameSeconds: gameState.gameSeconds + 1,

            eliminatedPlayerId: defendingBase.playerId,

            eliminatedByPlayerId: mission.playerId,
          });

          nextGameEventId += 1;

          /*
           * Used by the Battle Report too.
           */
          eliminatedPlayerId = defendingBase.playerId;

          /*
           * Determine whether only one
           * active player remains.
           */
          const activePlayerIds = Object.keys(updatedArmiesTrainedByPlayer).map(
            Number,
          );

          const remainingPlayerIds = activePlayerIds.filter(
            (playerId) => !updatedEliminatedPlayerIds.includes(playerId),
          );

          if (remainingPlayerIds.length === 1) {
            updatedWinnerPlayerId = remainingPlayerIds[0];

            updatedGameEvents.push({
              type: "victory",

              id: nextGameEventId,

              gameSeconds: gameState.gameSeconds + 1,

              winnerPlayerId: updatedWinnerPlayerId,
            });

            nextGameEventId += 1;
          }
        }
      }

      /*
       * Surviving attackers loot the destroyed base.
       */
      if (combatResult.baseDestroyed && totalSurvivors > 0) {
        const defeatedResources = updatedResources[defendingBase.id] ?? {
          water: 0,
          fire: 0,
          grass: 0,
        };

        const lootCapacity = totalSurvivors * 200;

        const lootResult = calculateLoot(defeatedResources, lootCapacity);

        resourcesLooted = {
          ...lootResult.loot,
        };

        resourcesRemaining = {
          ...lootResult.remaining,
        };

        returningResources = {
          ...lootResult.loot,
        };

        const treasureRemaining =
          lootResult.remaining.water +
          lootResult.remaining.fire +
          lootResult.remaining.grass;

        if (treasureRemaining > 0) {
          updatedTreasures.push({
            id: nextTreasureId,

            row: defendingBase.row,

            col: defendingBase.col,

            resources: {
              ...lootResult.remaining,
            },
          });

          nextTreasureId += 1;
        }

        /*
         * Destroyed base no longer owns
         * its resource bank.
         *
         * Leftover resources will become
         * treasure in the next step.
         */
        delete updatedResources[defendingBase.id];
      }

      /*
       * ==================================================
       * BATTLE REPORT
       * ==================================================
       */
      updatedGameEvents.push({
        type: "battle",

        report: {
          id: nextGameEventId,

          gameSeconds: gameState.gameSeconds + 1,

          attackerPlayerId: mission.playerId,

          defenderPlayerId: defendingBase.playerId,

          row: defendingBase.row,

          col: defendingBase.col,

          /*
           * Temporary server-side names.
           * We can move getBaseName() to shared code later.
           */
          attackerBaseName:
            mission.originBaseSlot !== undefined
              ? `Base ${mission.originBaseSlot}`
              : "Unknown Base",

          defenderBaseName: `Base ${defendingBase.baseSlot}`,

          attackerArmies: {
            ...mission.armies,
          },

          defenderArmies: {
            ...defendingBase.armies,
          },

          attackerSurvivors: {
            ...combatResult.attackerSurvivors,
          },

          defenderSurvivors: {
            ...combatResult.defenderSurvivors,
          },

          resourcesLooted: {
            ...resourcesLooted,
          },

          resourcesRemaining: {
            ...resourcesRemaining,
          },

          militiaSurvived: combatResult.militiaSurvived,

          baseDestroyed: combatResult.baseDestroyed,

          eliminatedPlayerId,
        },
      });

      nextGameEventId += 1;

      /*
       * Surviving attackers return home.
       */
      if (totalSurvivors > 0) {
        const distance =
          Math.abs(mission.originRow - defendingBase.row) +
          Math.abs(mission.originCol - defendingBase.col);

        updatedArmyMissions.push({
          ...mission,

          phase: "returning",

          armies: {
            ...survivingAttackers,
          },

          resources: {
            ...returningResources,
          },

          expansionKeys: returningExpansionKeys,

          secondsRemaining: distance * 5,
        });
      }

      console.log("ATTACK RESOLVED:", {
        attacker: mission.playerId,
        defender: defendingBase.playerId,
        baseDestroyed: combatResult.baseDestroyed,
        attackerSurvivors: combatResult.attackerSurvivors,
        defenderSurvivors: combatResult.defenderSurvivors,
      });

      return;
    }

    /*
     * ==================================================
     * LOOT ARRIVAL
     * ==================================================
     */
    if (mission.type === "loot" && mission.phase === "outbound") {
      const originBase = updatedBases.find(
        (base) => base.id === mission.originBaseId,
      );

      const treasure = updatedTreasures.find(
        (treasure) => treasure.id === mission.destinationBaseId,
      );

      if (!originBase) {
        return;
      }

      if (!treasure) {
        updatedGameEvents.push({
          type: "mission-failed",

          id: nextGameEventId,

          gameSeconds: gameState.gameSeconds + 1,

          playerId: originBase.playerId,

          missionType: "loot",

          reason: "destination-unavailable",

          baseName: `Base ${originBase.baseSlot}`,

          row: mission.destinationRow,
          col: mission.destinationCol,
        });

        nextGameEventId += 1;

        const distance =
          mission.destinationRow !== undefined &&
          mission.destinationCol !== undefined
            ? Math.abs(originBase.row - mission.destinationRow) +
              Math.abs(originBase.col - mission.destinationCol)
            : 0;

        updatedArmyMissions.push({
          ...mission,

          phase: "returning",

          resources: {
            water: 0,
            fire: 0,
            grass: 0,
          },

          secondsRemaining: distance * 5,
        });

        return;
      }

      const totalArmies =
        mission.armies.water + mission.armies.fire + mission.armies.grass;

      const lootCapacity = totalArmies * 200;

      const lootResult = calculateLoot(treasure.resources, lootCapacity);

      updatedGameEvents.push({
        type: "loot",

        id: nextGameEventId,

        gameSeconds: gameState.gameSeconds + 1,

        playerId: originBase.playerId,

        row: treasure.row,

        col: treasure.col,

        resourcesLooted: {
          ...lootResult.loot,
        },

        resourcesRemaining: {
          ...lootResult.remaining,
        },
      });

      nextGameEventId += 1;

      const remainingTotal =
        lootResult.remaining.water +
        lootResult.remaining.fire +
        lootResult.remaining.grass;

      if (remainingTotal > 0) {
        const treasureIndex = updatedTreasures.findIndex(
          (currentTreasure) => currentTreasure.id === treasure.id,
        );

        if (treasureIndex >= 0) {
          updatedTreasures[treasureIndex] = {
            ...treasure,

            resources: {
              ...lootResult.remaining,
            },
          };
        }
      } else {
        const treasureIndex = updatedTreasures.findIndex(
          (currentTreasure) => currentTreasure.id === treasure.id,
        );

        if (treasureIndex >= 0) {
          updatedTreasures.splice(treasureIndex, 1);
        }
      }

      const distance =
        Math.abs(originBase.row - treasure.row) +
        Math.abs(originBase.col - treasure.col);

      updatedArmyMissions.push({
        ...mission,

        phase: "returning",

        resources: {
          ...lootResult.loot,
        },

        secondsRemaining: distance * 5,
      });

      return;
    }

    /*
     * ==================================================
     * RETURNING LOOT
     * ==================================================
     */
    if (mission.type === "loot" && mission.phase === "returning") {
      const originBase = updatedBases.find(
        (base) => base.id === mission.originBaseId,
      );

      if (!originBase) {
        updatedGameEvents.push({
          type: "mission-failed",

          id: nextGameEventId,

          gameSeconds: gameState.gameSeconds + 1,

          playerId: mission.playerId,

          missionType: "loot",

          reason: "origin-destroyed",
        });

        nextGameEventId += 1;

        return;
      }

      updatedBases = updatedBases.map((base) => {
        if (base.id !== originBase.id) {
          return base;
        }

        return {
          ...base,

          armies: {
            water: base.armies.water + mission.armies.water,

            fire: base.armies.fire + mission.armies.fire,

            grass: base.armies.grass + mission.armies.grass,
          },
        };
      });

      const originResources = updatedResources[originBase.id];

      if (originResources) {
        updatedResources[originBase.id] = {
          water: originResources.water + mission.resources.water,

          fire: originResources.fire + mission.resources.fire,

          grass: originResources.grass + mission.resources.grass,
        };
      }

      return;
    }

    /*
     * =================================================
     * EXPANSION ARRIVAL
     * =================================================
     */
    if (mission.type === "expand" && mission.phase === "outbound") {
      const originBase = updatedBases.find(
        (base) => base.id === mission.originBaseId,
      );

      if (
        !originBase ||
        mission.destinationRow === undefined ||
        mission.destinationCol === undefined
      ) {
        return;
      }

      const destinationOccupied = updatedBases.some(
        (base) =>
          base.row === mission.destinationRow &&
          base.col === mission.destinationCol,
      );

      const destinationHasTreasure = updatedTreasures.some(
        (treasure) =>
          treasure.row === mission.destinationRow &&
          treasure.col === mission.destinationCol,
      );

      /*
       * Destination became unavailable.
       * Return payment + key to origin.
       */
      if (destinationOccupied || destinationHasTreasure) {
        const distance =
          Math.abs(originBase.row - mission.destinationRow) +
          Math.abs(originBase.col - mission.destinationCol);

        updatedGameEvents.push({
          type: "mission-failed",

          id: nextGameEventId,

          gameSeconds: gameState.gameSeconds + 1,

          playerId: originBase.playerId,

          missionType: "expand",

          reason: "destination-unavailable",

          baseName: `Base ${originBase.baseSlot}`,

          row: mission.destinationRow,
          col: mission.destinationCol,
        });

        nextGameEventId += 1;

        updatedArmyMissions.push({
          ...mission,
          phase: "returning",
          secondsRemaining: distance * 5,
        });

        return;
      }

      /*
       * Find an unused base slot.
       */
      const usedBaseSlots = updatedBases
        .filter((base) => base.playerId === originBase.playerId)
        .map((base) => base.baseSlot);

      const newBaseSlot = ([1, 2, 3] as const).find(
        (slot) => !usedBaseSlots.includes(slot),
      );

      if (newBaseSlot === undefined) {
        return;
      }

      /*
       * Generate the next base ID.
       */
      const newBaseId =
        updatedBases.reduce(
          (highestId, base) => Math.max(highestId, base.id),
          0,
        ) + 1;

      updatedBases.push({
        id: newBaseId,

        playerId: originBase.playerId,

        baseSlot: newBaseSlot,

        row: mission.destinationRow,

        col: mission.destinationCol,

        timeInLocationSeconds: 0,

        isRelocating: false,

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
      });

      /*
       * New bases start with 50/50/50.
       */
      updatedResources[newBaseId] = {
        water: 50,
        fire: 50,
        grass: 50,
      };

      updatedGameEvents.push({
        type: "expansion",

        id: nextGameEventId,

        gameSeconds: gameState.gameSeconds + 1,

        playerId: originBase.playerId,

        /*
         * Temporary server-side name.
         * We can share getBaseName later.
         */
        baseName: `Base ${newBaseSlot}`,

        row: mission.destinationRow,

        col: mission.destinationCol,
      });

      nextGameEventId += 1;

      return;
    }

    /*
     * =================================================
     * RELOCATION ARRIVAL
     * =================================================
     */
    if (mission.type === "relocate" && mission.phase === "outbound") {
      if (
        mission.destinationRow === undefined ||
        mission.destinationCol === undefined
      ) {
        return;
      }

      const relocatingBase = updatedBases.find(
        (base) => base.id === mission.originBaseId,
      );

      if (!relocatingBase) {
        return;
      }

      const destinationOccupied = updatedBases.some(
        (base) =>
          base.id !== relocatingBase.id &&
          !base.isRelocating &&
          base.row === mission.destinationRow &&
          base.col === mission.destinationCol,
      );

      const destinationHasTreasure = updatedTreasures.some(
        (treasure) =>
          treasure.row === mission.destinationRow &&
          treasure.col === mission.destinationCol,
      );

      /*
       * Destination was taken while traveling.
       * Turn around and head back to the
       * original location.
       */
      if (destinationOccupied || destinationHasTreasure) {
        const returnDistance =
          Math.abs(relocatingBase.row - mission.destinationRow) +
          Math.abs(relocatingBase.col - mission.destinationCol);

        updatedGameEvents.push({
          type: "mission-failed",

          id: nextGameEventId,

          gameSeconds: gameState.gameSeconds + 1,

          playerId: relocatingBase.playerId,

          missionType: "relocate",

          reason: "destination-unavailable",

          baseName: `Base ${relocatingBase.baseSlot}`,

          row: mission.destinationRow,
          col: mission.destinationCol,
        });

        nextGameEventId += 1;

        updatedArmyMissions.push({
          ...mission,

          phase: "returning",

          secondsRemaining: returnDistance * 15,
        });

        return;
      }

      /*
       * Successful relocation.
       */
      updatedBases = updatedBases.map((base) => {
        if (base.id !== relocatingBase.id) {
          return base;
        }

        return {
          ...base,

          row: mission.destinationRow!,
          col: mission.destinationCol!,

          isRelocating: false,

          relocations: base.relocations + 1,

          armies: {
            ...mission.armies,
          },
        };
      });

      /*
       * Restore the resource bank at
       * the new location.
       *
       * The relocation payment remains spent.
       */
      updatedResources[relocatingBase.id] = {
        ...mission.resources,
      };

      updatedGameEvents.push({
        type: "relocation",

        id: nextGameEventId,

        gameSeconds: gameState.gameSeconds + 1,

        playerId: relocatingBase.playerId,

        baseName: `Base ${relocatingBase.baseSlot}`,

        fromRow: relocatingBase.row,

        fromCol: relocatingBase.col,

        toRow: mission.destinationRow,

        toCol: mission.destinationCol,
      });

      nextGameEventId += 1;

      return;
    }

    /*
     * =================================================
     * RETURNING RELOCATION
     * =================================================
     *
     * Destination was blocked, so the base is
     * attempting to return to its original tile.
     */
    if (mission.type === "relocate" && mission.phase === "returning") {
      const relocatingBase = updatedBases.find(
        (base) => base.id === mission.originBaseId,
      );

      if (!relocatingBase) {
        return;
      }

      /*
       * Is the original tile now occupied
       * by another active base?
       */
      const originalOccupied = updatedBases.some(
        (base) =>
          base.id !== relocatingBase.id &&
          !base.isRelocating &&
          base.row === relocatingBase.row &&
          base.col === relocatingBase.col,
      );

      const originalHasTreasure = updatedTreasures.some(
        (treasure) =>
          treasure.row === relocatingBase.row &&
          treasure.col === relocatingBase.col,
      );

      /*
       * Original tile is blocked too.
       *
       * The relocating base and everything
       * traveling with it are lost.
       */
      if (originalOccupied || originalHasTreasure) {
        updatedGameEvents.push({
          type: "mission-failed",

          id: nextGameEventId,

          gameSeconds: gameState.gameSeconds + 1,

          playerId: relocatingBase.playerId,

          missionType: "relocate",

          reason: "return-location-blocked",

          baseName: `Base ${relocatingBase.baseSlot}`,

          row: relocatingBase.row,
          col: relocatingBase.col,
        });

        nextGameEventId += 1;

        updatedBases = updatedBases.filter(
          (base) => base.id !== relocatingBase.id,
        );

        delete updatedResources[relocatingBase.id];

        const playerStillHasBase = updatedBases.some(
          (base) => base.playerId === relocatingBase.playerId,
        );

        /*
         * Losing the player's final base
         * means immediate elimination.
         */
        if (
          !playerStillHasBase &&
          !updatedEliminatedPlayerIds.includes(relocatingBase.playerId)
        ) {
          updatedEliminatedPlayerIds.push(relocatingBase.playerId);

          updatedGameEvents.push({
            type: "elimination",

            id: nextGameEventId,

            gameSeconds: gameState.gameSeconds + 1,

            eliminatedPlayerId: relocatingBase.playerId,
          });

          nextGameEventId += 1;

          /*
           * Determine whether one player remains.
           */
          const activePlayerIds = Object.keys(updatedArmiesTrainedByPlayer).map(
            Number,
          );

          const remainingPlayerIds = activePlayerIds.filter(
            (playerId) => !updatedEliminatedPlayerIds.includes(playerId),
          );

          if (remainingPlayerIds.length === 1) {
            updatedWinnerPlayerId = remainingPlayerIds[0];

            updatedGameEvents.push({
              type: "victory",

              id: nextGameEventId,

              gameSeconds: gameState.gameSeconds + 1,

              winnerPlayerId: remainingPlayerIds[0],
            });

            nextGameEventId += 1;
          }
        }

        return;
      }

      /*
       * Original tile is still available.
       * Restore the same base there.
       */
      updatedBases = updatedBases.map((base) => {
        if (base.id !== relocatingBase.id) {
          return base;
        }

        return {
          ...base,

          isRelocating: false,

          armies: {
            ...mission.armies,
          },
        };
      });

      /*
       * Failed relocation refunds the payment.
       *
       * mission.resources contains the resources
       * remaining after payment.
       */
      const relocationPayment = mission.relocationPayment ?? {
        water: 0,
        fire: 0,
        grass: 0,
      };

      updatedResources[relocatingBase.id] = {
        water: mission.resources.water + relocationPayment.water,

        fire: mission.resources.fire + relocationPayment.fire,

        grass: mission.resources.grass + relocationPayment.grass,
      };

      return;
    }

    /*
     * ==================================================
     * TRANSFER ARRIVAL
     * ==================================================
     */
    if (mission.phase === "outbound") {
      const originBase = updatedBases.find(
        (base) => base.id === mission.originBaseId,
      );

      /*
       * Origin was destroyed while traveling.
       * Mission is lost.
       */
      if (!originBase) {
        return;
      }

      const destinationBase = updatedBases.find(
        (base) => base.id === mission.destinationBaseId,
      );

      /*
       * Destination was destroyed.
       * Turn around and return home.
       */
      if (!destinationBase) {
        if (
          mission.destinationRow === undefined ||
          mission.destinationCol === undefined
        ) {
          return;
        }

        updatedGameEvents.push({
          type: "mission-failed",

          id: nextGameEventId,

          gameSeconds: gameState.gameSeconds + 1,

          playerId: mission.playerId,

          missionType: "transfer",

          reason: "destination-unavailable",

          baseName: `Base ${originBase.baseSlot}`,

          row: mission.destinationRow,
          col: mission.destinationCol,
        });

        nextGameEventId += 1;

        const distance =
          Math.abs(originBase.row - mission.destinationRow) +
          Math.abs(originBase.col - mission.destinationCol);

        updatedArmyMissions.push({
          ...mission,

          phase: "returning",

          secondsRemaining: distance * 5,
        });

        return;
      }

      /*
       * Add armies to destination.
       */
      updatedBases = updatedBases.map((base) => {
        if (base.id !== destinationBase.id) {
          return base;
        }

        return {
          ...base,

          armies: {
            water: base.armies.water + mission.armies.water,

            fire: base.armies.fire + mission.armies.fire,

            grass: base.armies.grass + mission.armies.grass,
          },
        };
      });

      /*
       * Add cargo to destination.
       */
      const destinationResources = updatedResources[destinationBase.id];

      if (destinationResources) {
        updatedResources[destinationBase.id] = {
          water: destinationResources.water + mission.resources.water,

          fire: destinationResources.fire + mission.resources.fire,

          grass: destinationResources.grass + mission.resources.grass,
        };
      }

      /*
       * Add Transfer to the public game log.
       */
      updatedGameEvents.push({
        id: nextGameEventId,

        type: "transfer",

        gameSeconds: gameState.gameSeconds + 1,

        playerId: destinationBase.playerId,

        fromBaseName: `Base ${originBase.baseSlot}`,

        toBaseName: `Base ${destinationBase.baseSlot}`,

        armies: {
          ...mission.armies,
        },

        resources: {
          ...mission.resources,
        },
      });

      nextGameEventId += 1;

      /*
       * Do NOT push the mission back into
       * updatedArmyMissions.
       *
       * It has completed and disappears.
       */
      return;
    }

    /*
     * ==================================================
     * RETURNING TRANSFER / ATTACK ARRIVAL
     * ==================================================
     */
    if (mission.phase === "returning") {
      const originBase = updatedBases.find(
        (base) => base.id === mission.originBaseId,
      );

      /*
       * Origin was destroyed during return.
       * Mission is lost.
       */
      if (!originBase) {
        updatedGameEvents.push({
          type: "mission-failed",

          id: nextGameEventId,

          gameSeconds: gameState.gameSeconds + 1,

          playerId: mission.playerId,

          missionType: mission.type,

          reason: "origin-destroyed",
        });

        nextGameEventId += 1;

        return;
      }

      updatedBases = updatedBases.map((base) => {
        if (base.id !== originBase.id) {
          return base;
        }

        return {
          ...base,

          armies: {
            water: base.armies.water + mission.armies.water,

            fire: base.armies.fire + mission.armies.fire,

            grass: base.armies.grass + mission.armies.grass,
          },
        };
      });

      const originResources = updatedResources[originBase.id];

      if (originResources) {
        updatedResources[originBase.id] = {
          water: originResources.water + mission.resources.water,

          fire: originResources.fire + mission.resources.fire,

          grass: originResources.grass + mission.resources.grass,
        };
      }

      /*
       * Return any expansion keys carried
       * by the mission to the player's pool.
       *
       * Transfer missions normally carry 0,
       * so this also safely handles Transfers.
       */
      if (mission.expansionKeys > 0) {
        updatedExpansionKeysByPlayer[mission.playerId] =
          (updatedExpansionKeysByPlayer[mission.playerId] ?? 0) +
          mission.expansionKeys;
      }

      /*
       * Mission completes here too,
       * so don't push it back.
       */
      return;
    }
  });

  /*
   * ==================================================
   * STEP 3:
   * ELIMINATION / SCORING / VICTORY
   * ==================================================
   */

  if (
    gameState.matchType === "30m" &&
    gameState.gameSeconds + 1 >= 30 * 60 &&
    updatedWinnerPlayerId === null
  ) {
    const survivingPlayerIds = Object.keys(updatedArmiesTrainedByPlayer)
      .map(Number)
      .filter((playerId) => !updatedEliminatedPlayerIds.includes(playerId));

    const standings = survivingPlayerIds
      .map((playerId) => ({
        playerId,

        score: calculatePlayerScore(
          playerId,
          updatedBases,
          updatedResources,
          updatedArmyMissions,
          updatedArmiesTrainedByPlayer[playerId] ?? 0,
          updatedArmyResourcesSpentByPlayer[playerId] ?? 0,
        ).totalScore,
      }))
      .sort((a, b) => b.score - a.score);

    updatedWinnerPlayerId = standings[0]?.playerId ?? null;

    if (updatedWinnerPlayerId !== null) {
      updatedGameEvents.push({
        type: "victory",

        id: nextGameEventId,

        gameSeconds: gameState.gameSeconds + 1,

        winnerPlayerId: updatedWinnerPlayerId,
      });

      nextGameEventId += 1;
    }
  }

  /*
   * ==================================================
   * STEP 4:
   * RESOURCE PRODUCTION
   * ==================================================
   *
   * MIGRATED FROM App.tsx.
   */
  updatedBases.forEach((base) => {
    if (base.isRelocating) {
      return;
    }

    const activeMapTiles = gameState!.mapId === "map-two" ? mapTwo : mapOne;

    const tile = activeMapTiles.find(
      (tile) => tile.row === base.row && tile.col === base.col,
    );

    if (!tile) {
      return;
    }

    const currentResources = updatedResources[base.id];

    if (!currentResources) {
      return;
    }

    const locationMultiplier = getLocationMultiplier(
      base.timeInLocationSeconds,
    );

    const productionAmount = locationMultiplier * tile.multiplier;

    const resource = tile.resource;

    updatedResources[base.id] = {
      ...currentResources,

      [resource]: currentResources[resource] + productionAmount,
    };
  });

  /*
   * ==================================================
   * STEP 5:
   * COMMIT THIS TICK'S SERVER STATE
   * ==================================================
   *
   * As more App.tsx tick sections move to the server,
   * add their updated values to THIS assignment.
   */

  gameState = {
    ...gameState,

    gameSeconds: gameState.gameSeconds + 1,

    bases: updatedBases,

    resourcesByBase: updatedResources,

    armyMissions: updatedArmyMissions,

    armiesTrainedByPlayer: updatedArmiesTrainedByPlayer,

    armyResourcesSpentByPlayer: updatedArmyResourcesSpentByPlayer,

    expansionKeysByPlayer: updatedExpansionKeysByPlayer,

    treasures: updatedTreasures,

    nextTreasureId,

    gameEvents: updatedGameEvents,

    nextGameEventId,

    eliminatedPlayerIds: updatedEliminatedPlayerIds,

    finalScoreByPlayer: updatedFinalScoreByPlayer,

    winnerPlayerId: updatedWinnerPlayerId,
  };

  broadcastGameState();
}

/*
 * ==================================================
 * CONNECTION HANDLING
 * ==================================================
 */

server.on("connection", (socket) => {
  const clientId = nextClientId++;

  const slotId = getNextAvailableSlot();

  const playerId = getNextAvailablePlayerId();

  if (slotId === null || playerId === null) {
    socket.send(
      JSON.stringify({
        type: "error",
        message: "Lobby is full",
      }),
    );

    socket.close();
    return;
  }

  if (hostClientId === null) {
    hostClientId = clientId;
  }

  const lobbyPlayer: LobbyPlayer = {
    clientId,
    slotId,
    playerId,
    isReady: false,

    isHost: clientId === hostClientId,
  };

  connectedClients.set(clientId, socket);

  lobbyPlayers.set(clientId, lobbyPlayer);

  console.log(`Client ${clientId} connected`);

  socket.send(
    JSON.stringify({
      type: "connected",
      clientId,

      message: "Connected to EXiLE server",
    }),
  );

  broadcastLobby();

  /*
   * ==================================================
   * CLIENT MESSAGE HANDLING
   * ==================================================
   *
   * Each player action should eventually follow this
   * pattern:
   *
   * 1. Client sends REQUEST.
   * 2. Server validates REQUEST.
   * 3. Server changes gameState.
   * 4. Server broadcasts authoritative gameState.
   */

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());

    /*
     * ==============================================
     * LOBBY ACTION: READY
     * ==============================================
     */

    if (message.type === "set-ready") {
      const player = lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      player.isReady = Boolean(message.isReady);

      console.log(`Client ${clientId} ready: ${player.isReady}`);

      broadcastLobby();
    }

    /*
     * ==============================================
     * LOBBY ACTION: LEAVE
     * ==============================================
     */

    if (message.type === "leave-lobby") {
      lobbyPlayers.delete(clientId);

      if (clientId === hostClientId) {
        const nextHost = lobbyPlayers.values().next();

        hostClientId = nextHost.done ? null : nextHost.value.clientId;

        if (hostClientId !== null) {
          const newHost = lobbyPlayers.get(hostClientId);

          if (newHost) {
            newHost.isHost = true;
          }
        }
      }

      console.log(`Client ${clientId} left lobby`);

      broadcastLobby();
    }

    /*
     * ==============================================
     * LOBBY ACTION: START GAME
     * ==============================================
     */

    if (message.type === "start-game") {
      if (clientId !== hostClientId) {
        return;
      }

      const players = Array.from(lobbyPlayers.values());

      const currentMap =
        mapConfigs[matchConfig.mapId as keyof typeof mapConfigs];

      if (!currentMap) {
        return;
      }

      if (
        players.length < currentMap.minPlayers ||
        players.length > currentMap.maxPlayers
      ) {
        return;
      }

      if (players.length < 2) {
        return;
      }

      const everyoneReady = players.every((player) => player.isReady);

      if (!everyoneReady) {
        return;
      }

      const activePlayerIds = players.map((player) => player.playerId);

      gameState = createInitialGameState(
        activePlayerIds,
        matchConfig.matchType,
        matchConfig.mapId,
      );

      if (gameTimer) {
        clearInterval(gameTimer);
      }

      gameTimer = setInterval(runGameTick, 1000);

      const gameStartedMessage = JSON.stringify({
        type: "game-started",
        players,
        matchConfig,
        gameState,
      });

      for (const socket of connectedClients.values()) {
        socket.send(gameStartedMessage);
      }

      console.log(`Client ${clientId} started the game`);
    }

    /*
     * ==============================================
     * GAME ACTION: TRAIN ARMY
     * ==============================================
     *
     * SERVER-AUTHORITATIVE.
     *
     * Client only requests:
     * - baseId
     * - resource
     *
     * Server validates ownership, cost and whether
     * the base is already training.
     */

    if (message.type === "train-army") {
      if (!gameState) {
        return;
      }

      const player = lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      const baseId = Number(message.baseId);

      const resource = message.resource as ResourceType;

      const base = gameState.bases.find((base) => base.id === baseId);

      if (!base) {
        return;
      }

      /*
       * Player may only train at their own base.
       */
      if (base.playerId !== player.playerId) {
        return;
      }

      /*
       * Base can only train one army at a time.
       */
      if (base.training) {
        return;
      }

      const resources = gameState.resourcesByBase[baseId];

      if (!resources) {
        return;
      }

      const cost = getArmyCost(base.armiesBuilt[resource]);

      if (resources[resource] < cost) {
        return;
      }

      const updatedBases = gameState.bases.map((currentBase) => {
        if (currentBase.id !== baseId) {
          return currentBase;
        }

        return {
          ...currentBase,

          training: {
            resource,
            secondsRemaining: 10,
          },
        };
      });

      const updatedResources = {
        ...gameState.resourcesByBase,

        [baseId]: {
          ...resources,

          [resource]: resources[resource] - cost,
        },
      };

      gameState = {
        ...gameState,

        bases: updatedBases,

        resourcesByBase: updatedResources,
      };

      console.log("TRAIN APPROVED:", {
        baseId,
        resource,
        cost,
      });

      broadcastGameState();
    }

    /*
     * ==============================================
     * GAME ACTION TEMPLATE: SEND ARMY
     * ==============================================
     *
     * TODO — MIGRATE FROM App.tsx
     *
     * Future client request should contain only the
     * choices the player is allowed to make.
     *
     * Example:
     *
     * {
     *   type: "send-army",
     *   originBaseId,
     *   missionType,
     *   armies,
     *   resources,
     *   destination...
     * }
     *
     * Server must validate ownership, army counts,
     * cargo, destination and mission legality before
     * modifying gameState.
     */

    if (message.type === "transfer-army") {
      if (!gameState) {
        return;
      }

      const player = lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      const originBaseId = Number(message.originBaseId);

      const destinationBaseId = Number(message.destinationBaseId);

      const armies = message.armies as ArmyCounts;

      const transferredResources = message.resources as BaseResources;

      const originBase = gameState.bases.find(
        (base) => base.id === originBaseId,
      );

      const destinationBase = gameState.bases.find(
        (base) => base.id === destinationBaseId,
      );

      if (!originBase || !destinationBase) {
        return;
      }

      /*
       * Both bases must belong
       * to the requesting player.
       */
      if (
        originBase.playerId !== player.playerId ||
        destinationBase.playerId !== player.playerId
      ) {
        return;
      }

      /*
       * Validate army quantities.
       */
      if (armies.water < 0 || armies.fire < 0 || armies.grass < 0) {
        return;
      }

      if (
        armies.water > originBase.armies.water ||
        armies.fire > originBase.armies.fire ||
        armies.grass > originBase.armies.grass
      ) {
        return;
      }

      const totalArmies = armies.water + armies.fire + armies.grass;

      if (totalArmies === 0) {
        return;
      }

      const resources = gameState.resourcesByBase[originBase.id];

      if (!resources) {
        return;
      }

      const cargoCapacity = totalArmies * 200;

      const totalCargo =
        transferredResources.water +
        transferredResources.fire +
        transferredResources.grass;

      if (
        transferredResources.water < 0 ||
        transferredResources.fire < 0 ||
        transferredResources.grass < 0
      ) {
        return;
      }

      if (totalCargo > cargoCapacity) {
        return;
      }

      if (
        transferredResources.water > resources.water ||
        transferredResources.fire > resources.fire ||
        transferredResources.grass > resources.grass
      ) {
        return;
      }

      const distance =
        Math.abs(originBase.row - destinationBase.row) +
        Math.abs(originBase.col - destinationBase.col);

      const travelTime = distance * 5;

      /*
       * Remove armies from origin.
       */
      const updatedBases = gameState.bases.map((base) => {
        if (base.id !== originBase.id) {
          return base;
        }

        return {
          ...base,

          armies: {
            water: base.armies.water - armies.water,

            fire: base.armies.fire - armies.fire,

            grass: base.armies.grass - armies.grass,
          },
        };
      });

      /*
       * Remove cargo from origin.
       */
      const updatedResources = {
        ...gameState.resourcesByBase,

        [originBase.id]: {
          water: resources.water - transferredResources.water,

          fire: resources.fire - transferredResources.fire,

          grass: resources.grass - transferredResources.grass,
        },
      };

      /*
       * Create server-owned mission.
       */
      const newMission: ArmyMission = {
        id: gameState.nextMissionId,

        playerId: originBase.playerId,

        type: "transfer",
        phase: "outbound",

        originBaseId: originBase.id,

        originRow: originBase.row,
        originCol: originBase.col,

        destinationBaseId: destinationBase.id,

        destinationRow: destinationBase.row,
        destinationCol: destinationBase.col,

        armies: {
          ...armies,
        },

        resources: {
          ...transferredResources,
        },

        expansionKeys: 0,

        secondsRemaining: travelTime,
      };

      gameState = {
        ...gameState,

        bases: updatedBases,

        resourcesByBase: updatedResources,

        armyMissions: [...gameState.armyMissions, newMission],

        nextMissionId: gameState.nextMissionId + 1,
      };

      console.log("TRANSFER LAUNCHED:", {
        playerId: player.playerId,
        originBaseId,
        destinationBaseId,
        travelTime,
      });

      broadcastGameState();
    }

    if (message.type === "attack-army") {
      if (!gameState) {
        return;
      }

      const player = lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      const originBaseId = Number(message.originBaseId);

      const destinationBaseId = Number(message.destinationBaseId);

      const armies = message.armies as ArmyCounts;

      const originBase = gameState.bases.find(
        (base) => base.id === originBaseId,
      );

      const destinationBase = gameState.bases.find(
        (base) => base.id === destinationBaseId,
      );

      if (!originBase || !destinationBase) {
        return;
      }

      /*
       * Attacks must originate from
       * the requesting player's base
       * and target an enemy base.
       */
      if (
        originBase.playerId !== player.playerId ||
        destinationBase.playerId === player.playerId
      ) {
        return;
      }

      /*
       * Validate army quantities.
       */
      if (armies.water < 0 || armies.fire < 0 || armies.grass < 0) {
        return;
      }

      if (
        armies.water > originBase.armies.water ||
        armies.fire > originBase.armies.fire ||
        armies.grass > originBase.armies.grass
      ) {
        return;
      }

      const totalArmies = armies.water + armies.fire + armies.grass;

      if (totalArmies === 0) {
        return;
      }

      const distance =
        Math.abs(originBase.row - destinationBase.row) +
        Math.abs(originBase.col - destinationBase.col);

      const travelTime = distance * 5;

      /*
       * Remove armies from origin immediately.
       */
      const updatedBases = gameState.bases.map((base) => {
        if (base.id !== originBase.id) {
          return base;
        }

        return {
          ...base,

          armies: {
            water: base.armies.water - armies.water,

            fire: base.armies.fire - armies.fire,

            grass: base.armies.grass - armies.grass,
          },
        };
      });

      const newMission: ArmyMission = {
        id: gameState.nextMissionId,

        playerId: originBase.playerId,

        type: "attack",
        phase: "outbound",

        originBaseId: originBase.id,

        originRow: originBase.row,
        originCol: originBase.col,
        originBaseSlot: originBase.baseSlot,

        destinationBaseId: destinationBase.id,

        destinationRow: destinationBase.row,

        destinationCol: destinationBase.col,

        armies: {
          ...armies,
        },

        resources: {
          water: 0,
          fire: 0,
          grass: 0,
        },

        expansionKeys: 0,

        secondsRemaining: travelTime,
      };

      gameState = {
        ...gameState,

        bases: updatedBases,

        armyMissions: [...gameState.armyMissions, newMission],

        nextMissionId: gameState.nextMissionId + 1,
      };

      console.log("ATTACK LAUNCHED:", {
        playerId: player.playerId,
        originBaseId,
        destinationBaseId,
        travelTime,
      });

      broadcastGameState();
    }

    if (message.type === "loot-army") {
      if (!gameState) {
        return;
      }

      const player = lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      const originBaseId = Number(message.originBaseId);

      const treasureId = Number(message.treasureId);

      const armies = message.armies as ArmyCounts;

      const originBase = gameState.bases.find(
        (base) => base.id === originBaseId,
      );

      const treasure = gameState.treasures.find(
        (treasure) => treasure.id === treasureId,
      );

      if (!originBase || !treasure) {
        return;
      }

      if (originBase.playerId !== player.playerId) {
        return;
      }

      if (armies.water < 0 || armies.fire < 0 || armies.grass < 0) {
        return;
      }

      if (
        armies.water > originBase.armies.water ||
        armies.fire > originBase.armies.fire ||
        armies.grass > originBase.armies.grass
      ) {
        return;
      }

      const totalArmies = armies.water + armies.fire + armies.grass;

      if (totalArmies === 0) {
        return;
      }

      const distance =
        Math.abs(originBase.row - treasure.row) +
        Math.abs(originBase.col - treasure.col);

      const travelTime = distance * 5;

      const updatedBases = gameState.bases.map((base) => {
        if (base.id !== originBase.id) {
          return base;
        }

        return {
          ...base,

          armies: {
            water: base.armies.water - armies.water,

            fire: base.armies.fire - armies.fire,

            grass: base.armies.grass - armies.grass,
          },
        };
      });

      const newMission: ArmyMission = {
        id: gameState.nextMissionId,

        playerId: originBase.playerId,

        type: "loot",

        phase: "outbound",

        originBaseId: originBase.id,

        /*
         * For Loot, destinationBaseId
         * temporarily stores treasure ID.
         */
        destinationBaseId: treasure.id,

        destinationRow: treasure.row,

        destinationCol: treasure.col,

        armies: {
          ...armies,
        },

        resources: {
          water: 0,
          fire: 0,
          grass: 0,
        },

        expansionKeys: 0,

        secondsRemaining: travelTime,
      };

      gameState = {
        ...gameState,

        bases: updatedBases,

        armyMissions: [...gameState.armyMissions, newMission],

        nextMissionId: gameState.nextMissionId + 1,
      };

      broadcastGameState();
    }

    if (message.type === "expand") {
      if (!gameState) {
        return;
      }

      const player = lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      const originBaseId = Number(message.originBaseId);

      const destinationRow = Number(message.destinationRow);

      const destinationCol = Number(message.destinationCol);

      const payment = message.payment as BaseResources;

      const originBase = gameState.bases.find(
        (base) => base.id === originBaseId,
      );

      if (!originBase) {
        return;
      }

      /*
       * Requester must own the origin base.
       */
      if (originBase.playerId !== player.playerId) {
        return;
      }

      /*
       * Player may own at most 3 bases.
       */
      const playerBaseCount = gameState.bases.filter(
        (base) => base.playerId === player.playerId,
      ).length;

      if (playerBaseCount >= 3) {
        return;
      }

      /*
       * Destination must still be empty.
       */
      const destinationOccupied = gameState.bases.some(
        (base) => base.row === destinationRow && base.col === destinationCol,
      );

      const destinationHasTreasure = gameState.treasures.some(
        (treasure) =>
          treasure.row === destinationRow && treasure.col === destinationCol,
      );

      if (destinationOccupied || destinationHasTreasure) {
        return;
      }

      /*
       * Player must have an Expansion Key.
       */
      const currentKeys = gameState.expansionKeysByPlayer[player.playerId] ?? 0;

      if (currentKeys < 1) {
        return;
      }

      /*
       * Validate the 500-resource payment.
       */
      if (
        !payment ||
        payment.water < 0 ||
        payment.fire < 0 ||
        payment.grass < 0
      ) {
        return;
      }

      const paymentTotal = payment.water + payment.fire + payment.grass;

      if (paymentTotal !== 500) {
        return;
      }

      const baseResources = gameState.resourcesByBase[originBase.id];

      if (!baseResources) {
        return;
      }

      if (
        payment.water > baseResources.water ||
        payment.fire > baseResources.fire ||
        payment.grass > baseResources.grass
      ) {
        return;
      }

      /*
       * Pay resources immediately.
       */
      const updatedResources = {
        ...gameState.resourcesByBase,

        [originBase.id]: {
          water: baseResources.water - payment.water,

          fire: baseResources.fire - payment.fire,

          grass: baseResources.grass - payment.grass,
        },
      };

      /*
       * Spend one global Expansion Key.
       */
      const updatedExpansionKeysByPlayer = {
        ...gameState.expansionKeysByPlayer,

        [player.playerId]: currentKeys - 1,
      };

      /*
       * Travel = 5 seconds per tile.
       */
      const distance =
        Math.abs(originBase.row - destinationRow) +
        Math.abs(originBase.col - destinationCol);

      const travelTime = distance * 5;

      const newMission: ArmyMission = {
        id: gameState.nextMissionId,

        playerId: originBase.playerId,

        type: "expand",

        phase: "outbound",

        originBaseId: originBase.id,

        destinationBaseId: 0,

        destinationRow,
        destinationCol,

        armies: {
          water: 0,
          fire: 0,
          grass: 0,
        },

        /*
         * Expansion payment travels
         * with the settlers so it can
         * be refunded on failure.
         */
        resources: {
          ...payment,
        },

        expansionKeys: 1,

        secondsRemaining: travelTime,
      };

      gameState = {
        ...gameState,

        resourcesByBase: updatedResources,

        expansionKeysByPlayer: updatedExpansionKeysByPlayer,

        armyMissions: [...gameState.armyMissions, newMission],

        nextMissionId: gameState.nextMissionId + 1,
      };

      broadcastGameState();
    }

    if (message.type === "relocate") {
      if (!gameState) {
        return;
      }

      const player = lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      const originBaseId = Number(message.originBaseId);

      const destinationRow = Number(message.destinationRow);

      const destinationCol = Number(message.destinationCol);

      const payment = message.payment as BaseResources;

      const originBase = gameState.bases.find(
        (base) => base.id === originBaseId,
      );

      if (!originBase) {
        return;
      }

      /*
       * Requester must own this base.
       */
      if (originBase.playerId !== player.playerId) {
        return;
      }

      /*
       * Cannot relocate a base that
       * is already relocating.
       */
      if (originBase.isRelocating) {
        return;
      }

      /*
       * Destination must be open.
       */
      const destinationOccupied = gameState.bases.some(
        (base) =>
          !base.isRelocating &&
          base.row === destinationRow &&
          base.col === destinationCol,
      );

      const destinationHasTreasure = gameState.treasures.some(
        (treasure) =>
          treasure.row === destinationRow && treasure.col === destinationCol,
      );

      if (destinationOccupied || destinationHasTreasure) {
        return;
      }

      /*
       * Relocation cost increases
       * by 250 each time.
       */
      const relocationCost = (originBase.relocations + 1) * 250;

      if (
        !payment ||
        payment.water < 0 ||
        payment.fire < 0 ||
        payment.grass < 0
      ) {
        return;
      }

      const paymentTotal = payment.water + payment.fire + payment.grass;

      if (paymentTotal !== relocationCost) {
        return;
      }

      const baseResources = gameState.resourcesByBase[originBase.id];

      if (!baseResources) {
        return;
      }

      if (
        payment.water > baseResources.water ||
        payment.fire > baseResources.fire ||
        payment.grass > baseResources.grass
      ) {
        return;
      }

      /*
       * Pay relocation cost immediately.
       */
      const remainingResources = {
        water: baseResources.water - payment.water,

        fire: baseResources.fire - payment.fire,

        grass: baseResources.grass - payment.grass,
      };

      /*
       * Mark the base as relocating.
       *
       * It still exists for base-count /
       * elimination purposes.
       */
      const updatedBases = gameState.bases.map((base) => {
        if (base.id !== originBase.id) {
          return base;
        }

        return {
          ...base,

          isRelocating: true,

          armies: {
            water: 0,
            fire: 0,
            grass: 0,
          },
        };
      });

      /*
       * Remove its physical resource bank
       * while the base is traveling.
       */
      const updatedResources = {
        ...gameState.resourcesByBase,
      };

      delete updatedResources[originBase.id];

      /*
       * Relocation currently travels
       * at 15 seconds per tile.
       */
      const distance =
        Math.abs(originBase.row - destinationRow) +
        Math.abs(originBase.col - destinationCol);

      const travelTime = distance * 15;

      const newMission: ArmyMission = {
        id: gameState.nextMissionId,

        playerId: originBase.playerId,

        type: "relocate",

        phase: "outbound",

        originBaseId: originBase.id,

        destinationBaseId: 0,

        destinationRow,
        destinationCol,

        /*
         * All armies travel with the base.
         */
        armies: {
          ...originBase.armies,
        },

        /*
         * Remaining resources travel too.
         */
        resources: {
          ...remainingResources,
        },

        /*
         * Keep the payment separate because
         * failed relocation refunds it.
         */
        relocationPayment: {
          ...payment,
        },

        expansionKeys: 0,

        secondsRemaining: travelTime,
      };

      gameState = {
        ...gameState,

        bases: updatedBases,

        resourcesByBase: updatedResources,

        armyMissions: [...gameState.armyMissions, newMission],

        nextMissionId: gameState.nextMissionId + 1,
      };

      broadcastGameState();
    }

    /*
     * ==============================================
     * GAME ACTION TEMPLATE: EXPAND
     * ==============================================
     *
     * TODO — MIGRATE FROM App.tsx
     *
     * Expected server validation:
     * - player owns origin base
     * - player has room for another base
     * - player has expansion key
     * - origin has selected 500 resources
     * - destination is legal when mission is sent
     */

    /*
        if (
          message.type ===
          "expand"
        ) {
          // TODO: migrate expansion request logic.
        }
        */

    /*
     * ==============================================
     * GAME ACTION TEMPLATE: RELOCATE
     * ==============================================
     *
     * TODO — MIGRATE FROM App.tsx
     *
     * Expected server validation:
     * - player owns base
     * - base is not already relocating
     * - payment is valid
     * - destination is legal when mission is sent
     * - packing / travel state starts server-side
     */

    /*
        if (
          message.type ===
          "relocate"
        ) {
          // TODO: migrate relocation request logic.
        }
        */

    /*
     * ==============================================
     * LOBBY ACTION: SET MAP
     * ==============================================
     */

    if (message.type === "set-map") {
      if (clientId !== hostClientId) {
        return;
      }

      matchConfig = {
        ...matchConfig,
        mapId: message.mapId,
      };

      broadcastLobby();
    }

    /*
     * ==============================================
     * LOBBY ACTION: SET MATCH TYPE
     * ==============================================
     */

    if (message.type === "set-match-type") {
      if (clientId !== hostClientId) {
        return;
      }

      matchConfig = {
        ...matchConfig,

        matchType: message.matchType,
      };

      broadcastLobby();
    }

    /*
     * ==============================================
     * LOBBY ACTION: CHANGE CHARACTER
     * ==============================================
     */

    if (message.type === "change-character") {
      const player = lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      const requestedPlayerId = Number(message.playerId);

      if (requestedPlayerId < 1 || requestedPlayerId > 4) {
        return;
      }

      const alreadyClaimed = Array.from(lobbyPlayers.values()).some(
        (otherPlayer) =>
          otherPlayer.clientId !== clientId &&
          otherPlayer.playerId === requestedPlayerId,
      );

      if (alreadyClaimed) {
        return;
      }

      player.playerId = requestedPlayerId;

      player.isReady = false;

      console.log(`Client ${clientId} changed to player ${requestedPlayerId}`);

      broadcastLobby();
    }
  });

  /*
   * ==================================================
   * DISCONNECT HANDLING
   * ==================================================
   */

  socket.on("close", () => {
    connectedClients.delete(clientId);

    lobbyPlayers.delete(clientId);

    console.log(`Client ${clientId} disconnected`);

    if (clientId === hostClientId) {
      const nextHost = lobbyPlayers.values().next();

      hostClientId = nextHost.done ? null : nextHost.value.clientId;

      if (hostClientId !== null) {
        const newHost = lobbyPlayers.get(hostClientId);

        if (newHost) {
          newHost.isHost = true;
        }

        console.log(`Client ${hostClientId} is now host`);
      }
    }

    broadcastLobby();
  });
});

console.log(`EXiLE server running on port ${PORT}`);
