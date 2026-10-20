import { BALANCE } from "../../src/game/balance";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import { mapOne } from "../../src/game/maps/mapOne";
import { mapTwo } from "../../src/game/maps/mapTwo";
import {
  getArmyCost,
  getLocationMultiplier,
  getSecondaryProduction,
  resolveCombat,
  calculateLoot,
  calculatePlayerScore,
  getExpansionCost,
} from "../../src/game/rules";

import type {
  ArmyCounts,
  ArmyMission,
  BaseResources,
  GameState,
  MatchType,
  ResourceType,
} from "../../src/game/types";

import { CLASSES } from "../../src/game/characters";
import type { CharacterClass } from "../../src/game/characters";

import { WebSocket, WebSocketServer } from "ws";

/*
 * ==================================================
 * SERVER CONFIGURATION
 * ==================================================
 */

const PORT = Number(process.env.PORT) || 8080;

const server = new WebSocketServer({
  port: PORT,
  maxPayload: 64 * 1024,
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
  isBot: boolean;
  characterClass: CharacterClass | null;
  portrait: PortraitVariant;
};

type GameRoom = {
  code: string;
  hostClientId: number;
  lobbyPlayers: Map<number, LobbyPlayer>;
  matchConfig: {
    mapId: string;
    matchType: MatchType;
  };
  gameState: GameState | null;
  gameTimer: NodeJS.Timeout | null;
};

/*
 * ==================================================
 * SERVER STATE
 * ==================================================
 */

let nextClientId = 1;
let nextBotClientId = -1;

const connectedClients = new Map<number, WebSocket>();

const rooms = new Map<string, GameRoom>();

const roomCodeByClient = new Map<number, string>();

/*
 * ==================================================
 * LOBBY HELPERS
 * ==================================================
 */
function generateRoomCode(): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  do {
    code = "";

    for (let i = 0; i < 4; i++) {
      code += characters[Math.floor(Math.random() * characters.length)];
    }
  } while (rooms.has(code));

  return code;
}

function getRoomForClient(clientId: number): GameRoom | null {
  const roomCode = roomCodeByClient.get(clientId);

  if (!roomCode) {
    return null;
  }

  return rooms.get(roomCode) ?? null;
}

function getNextAvailableSlot(
  players: Map<number, LobbyPlayer>,
): number | null {
  const usedSlots = Array.from(players.values()).map((player) => player.slotId);

  for (let slotId = 1; slotId <= 4; slotId++) {
    if (!usedSlots.includes(slotId)) {
      return slotId;
    }
  }

  return null;
}

function getNextAvailablePlayerId(
  players: Map<number, LobbyPlayer>,
): number | null {
  const usedPlayerIds = Array.from(players.values()).map(
    (player) => player.playerId,
  );

  for (let playerId = 1; playerId <= 4; playerId++) {
    if (!usedPlayerIds.includes(playerId)) {
      return playerId;
    }
  }

  return null;
}

function broadcastLobby(room: GameRoom): void {
  const players = Array.from(room.lobbyPlayers.values()).sort(
    (a, b) => a.slotId - b.slotId,
  );

  const message = JSON.stringify({
    type: "lobby-state",
    players,
    matchConfig: room.matchConfig,
  });

  for (const player of room.lobbyPlayers.values()) {
    const socket = connectedClients.get(player.clientId);

    if (socket) {
      socket.send(message);
    }
  }
}

/*
 * ==================================================
 * VALIDATION HELPERS
 * ==================================================
 */
function isResourceType(value: unknown): value is ResourceType {
  return value === "water" || value === "fire" || value === "grass";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isValidMapCoordinate(
  mapId: string,
  row: number,
  col: number,
): boolean {
  const map =
    mapId === "map-two" ? mapTwo : mapId === "exile-island" ? mapOne : null;

  if (!map) {
    return false;
  }

  return map.some((tile) => tile.row === row && tile.col === col);
}

function isValidResourcePayment(payment: BaseResources): boolean {
  return (
    payment.water % 50 === 0 &&
    payment.fire % 50 === 0 &&
    payment.grass % 50 === 0
  );
}

function isArmyCounts(value: unknown): value is ArmyCounts {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const armies = value as Record<string, unknown>;

  return (
    isNonNegativeInteger(armies.water) &&
    isNonNegativeInteger(armies.fire) &&
    isNonNegativeInteger(armies.grass)
  );
}

function isBaseResources(value: unknown): value is BaseResources {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const resources = value as Record<string, unknown>;

  return (
    isNonNegativeInteger(resources.water) &&
    isNonNegativeInteger(resources.fire) &&
    isNonNegativeInteger(resources.grass)
  );
}
/*
 * ==================================================
 * GAME ACTION HELPERS
 * ==================================================
 */
function startArmyTraining(
  room: GameRoom,
  playerId: number,
  baseId: number,
  resource: ResourceType,
): boolean {
  const gameState = room.gameState;

  if (!gameState) {
    return false;
  }

  const base = gameState.bases.find((base) => base.id === baseId);

  if (!base) {
    return false;
  }

  /*
   * Player may only train at their own base.
   */
  if (base.playerId !== playerId) {
    return false;
  }

  /*
   * Base can only train one army at a time.
   */
  if (base.training) {
    return false;
  }

  const resources = gameState.resourcesByBase[baseId];

  if (!resources) {
    return false;
  }

  const cost = getArmyCost(base.armiesBuilt[resource]);

  if (resources[resource] < cost) {
    return false;
  }

  const updatedBases = gameState.bases.map((currentBase) => {
    if (currentBase.id !== baseId) {
      return currentBase;
    }

    return {
      ...currentBase,
      training: {
        resource,
        secondsRemaining: BALANCE.armies.trainingSeconds,
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

  room.gameState = {
    ...gameState,
    bases: updatedBases,
    resourcesByBase: updatedResources,
  };

  return true;
}

/*
 * ==================================================
 * BOT HELPERS
 * ==================================================
 */

function tryBotTrainArmy(room: GameRoom, bot: LobbyPlayer): boolean {
  const gameState = room.gameState;

  if (!gameState || !bot.isBot) {
    return false;
  }

  const base = gameState.bases.find((base) => base.playerId === bot.playerId);

  if (!base || base.training) {
    return false;
  }

  const resources = gameState.resourcesByBase[base.id];

  if (!resources) {
    return false;
  }

  const resourceTypes: ResourceType[] = ["water", "fire", "grass"];

  const affordableResources = resourceTypes.filter((resource) => {
    const cost = getArmyCost(base.armiesBuilt[resource]);

    return resources[resource] >= cost;
  });

  if (affordableResources.length === 0) {
    return false;
  }

  affordableResources.sort((a, b) => base.armiesBuilt[a] - base.armiesBuilt[b]);

  const resource = affordableResources[0];

  return startArmyTraining(room, bot.playerId, base.id, resource);
}

function runBotTick(room: GameRoom): void {
  if (!room.gameState) {
    return;
  }

  for (const player of room.lobbyPlayers.values()) {
    if (!player.isBot) {
      continue;
    }

    tryBotTrainArmy(room, player);
  }
}

/*
 * ==================================================
 * GAME-STATE HELPERS
 * ==================================================
 */

function broadcastGameState(room: GameRoom): void {
  if (!room.gameState) {
    return;
  }

  const message = JSON.stringify({
    type: "game-state",
    gameState: room.gameState,
  });

  for (const player of room.lobbyPlayers.values()) {
    const socket = connectedClients.get(player.clientId);

    if (socket) {
      socket.send(message);
    }
  }
}

/*
 * ==================================================
 * SERVER GAME TICK
 * ==================================================
 *
 * Advances the authoritative match state once per second.
 *
 * The server owns base aging, training, mission movement
 * and arrivals, combat, elimination, scoring, victory,
 * resource production, and state broadcasts.
 */

function runGameTick(room: GameRoom): void {
  const currentGameState = room.gameState;

  if (!currentGameState) {
    return;
  }

  let gameState: GameState = currentGameState;

  /*
   * Game is over.
   * Freeze authoritative game state
   * and stop the room's game timer.
   */
  if (gameState.winnerPlayerId !== null) {
    if (room.gameTimer) {
      clearInterval(room.gameTimer);
      room.gameTimer = null;
    }

    return;
  }

  /*
   * ==================================================
   * STEP 1:
   * AGE BASES AND PROCESS TRAINING
   * ==================================================
   *
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

  const updatedExpansionsCompletedByPlayer = {
    ...gameState.expansionsCompletedByPlayer,
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
   * PROCESS MISSIONS
   * ==================================================
   *
   * Advances and resolves attack, loot, transfer,
   * expansion, and relocation missions.
   */

  const updatedArmyMissions: ArmyMission[] = [];

  gameState.armyMissions.forEach((mission) => {
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

          secondsRemaining: distance * BALANCE.missions.travelSecondsPerTile,
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

        const lootCapacity = totalSurvivors * BALANCE.armies.cargoCapacity;

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

            expansionKeys: 0,
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

          secondsRemaining: distance * BALANCE.missions.travelSecondsPerTile,
        });
      }

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

          secondsRemaining: distance * BALANCE.missions.travelSecondsPerTile,
        });

        return;
      }

      const totalArmies =
        mission.armies.water + mission.armies.fire + mission.armies.grass;

      const lootCapacity = totalArmies * BALANCE.armies.cargoCapacity;

      const lootResult = calculateLoot(treasure.resources, lootCapacity);

      const remainingTotal =
        lootResult.remaining.water +
        lootResult.remaining.fire +
        lootResult.remaining.grass;

      const expansionKeysLooted = treasure.expansionKeys;

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

        expansionKeysLooted,
      });

      nextGameEventId += 1;

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

            expansionKeys: 0,
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

        expansionKeys: expansionKeysLooted,

        secondsRemaining: distance * BALANCE.missions.travelSecondsPerTile,
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

      if (mission.expansionKeys > 0) {
        updatedExpansionKeysByPlayer[originBase.playerId] =
          (updatedExpansionKeysByPlayer[originBase.playerId] ?? 0) +
          mission.expansionKeys;
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
          secondsRemaining: distance * BALANCE.missions.travelSecondsPerTile,
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

      updatedExpansionsCompletedByPlayer[originBase.playerId] =
        (updatedExpansionsCompletedByPlayer[originBase.playerId] ?? 0) + 1;

      /*
       * Give the newly established base its starting resources.
       */
      updatedResources[newBaseId] = {
        ...BALANCE.expansion.startingResources,
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

          secondsRemaining:
            returnDistance * BALANCE.relocation.travelSecondsPerTile,
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

          secondsRemaining: distance * BALANCE.missions.travelSecondsPerTile,
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
    gameState.gameSeconds + 1 >= BALANCE.match.timedMatchSeconds &&
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
   */
  updatedBases.forEach((base) => {
    if (base.isRelocating) {
      return;
    }

    const activeMapTiles = gameState.mapId === "map-two" ? mapTwo : mapOne;

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

    const primaryProduction =
      getLocationMultiplier(base.timeInLocationSeconds) * tile.multiplier;

    const secondaryProduction = getSecondaryProduction(
      base.timeInLocationSeconds,
    );

    const producedResources = {
      ...currentResources,
    };

    producedResources[tile.resource] += primaryProduction;

    if (secondaryProduction > 0) {
      const secondaryResources: ResourceType[] = [
        "water",
        "fire",
        "grass",
      ].filter((resource) => resource !== tile.resource) as ResourceType[];

      secondaryResources.forEach((resource) => {
        producedResources[resource] += secondaryProduction;
      });
    }

    updatedResources[base.id] = producedResources;
  });

  /*
   * ==================================================
   * STEP 5:
   * COMMIT AUTHORITATIVE STATE
   * ==================================================
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

    expansionsCompletedByPlayer: updatedExpansionsCompletedByPlayer,

    treasures: updatedTreasures,

    nextTreasureId,

    gameEvents: updatedGameEvents,

    nextGameEventId,

    eliminatedPlayerIds: updatedEliminatedPlayerIds,

    finalScoreByPlayer: updatedFinalScoreByPlayer,

    winnerPlayerId: updatedWinnerPlayerId,
  };

  room.gameState = gameState;

  /*
   * Allow bots to make decisions using the newly
   * committed authoritative state.
   */
  runBotTick(room);

  broadcastGameState(room);
}

/*
 * ==================================================
 * CONNECTION HANDLING
 * ==================================================
 */

server.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  const requestedClientId = Number(url.searchParams.get("clientId"));

  const reconnectRoomCode = roomCodeByClient.get(requestedClientId);

  const reconnectRoom = reconnectRoomCode
    ? rooms.get(reconnectRoomCode)
    : undefined;

  const isReconnect =
    Number.isInteger(requestedClientId) &&
    requestedClientId > 0 &&
    reconnectRoom !== undefined &&
    reconnectRoom.lobbyPlayers.has(requestedClientId);

  const clientId = isReconnect ? requestedClientId : nextClientId++;

  socket.on("error", (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });

  if (isReconnect) {
    if (!reconnectRoom) {
      socket.close();
      return;
    }

    const existingPlayer = reconnectRoom.lobbyPlayers.get(clientId);

    if (!existingPlayer) {
      socket.close();
      return;
    }

    connectedClients.set(clientId, socket);

    console.log(`Client ${clientId} reconnected to room ${reconnectRoom.code}`);

    socket.send(
      JSON.stringify({
        type: "connected",
        clientId,
        message: "Reconnected to EXiLE server",
      }),
    );

    socket.send(
      JSON.stringify({
        type: "room-joined",
        roomCode: reconnectRoom.code,
      }),
    );

    if (reconnectRoom.gameState) {
      socket.send(
        JSON.stringify({
          type: "game-started",
          gameState: reconnectRoom.gameState,
          players: Array.from(reconnectRoom.lobbyPlayers.values()),
          matchConfig: reconnectRoom.matchConfig,
        }),
      );
    }

    broadcastLobby(reconnectRoom);

    // Message + close handlers still need to be attached below.
  }

  if (!isReconnect) {
    connectedClients.set(clientId, socket);

    console.log(`Client ${clientId} connected`);

    socket.send(
      JSON.stringify({
        type: "connected",
        clientId,
        message: "Connected to EXiLE server",
      }),
    );
  }

  /*
   * ==================================================
   * CLIENT MESSAGE HANDLING
   * ==================================================
   *
   * Gameplay requests follow the authoritative flow:
   *
   * 1. Client sends a request.
   * 2. Server validates the request.
   * 3. Server updates authoritative state.
   * 4. Server broadcasts the resulting state.
   */

  socket.on("message", (data) => {
    let parsedMessage: unknown;

    try {
      parsedMessage = JSON.parse(data.toString());
    } catch {
      console.warn(`Client ${clientId} sent invalid JSON`);
      return;
    }

    if (
      typeof parsedMessage !== "object" ||
      parsedMessage === null ||
      Array.isArray(parsedMessage)
    ) {
      console.warn(`Client ${clientId} sent an invalid message`);
      return;
    }

    const message = parsedMessage as Record<string, unknown>;

    if (typeof message.type !== "string") {
      console.warn(`Client ${clientId} sent a message without a valid type`);
      return;
    }

    /*
     * ==============================================
     * ROOM ACTION: CREATE GAME
     * ==============================================
     */

    if (message.type === "create-game") {
      if (getRoomForClient(clientId)) {
        return;
      }

      const roomCode = generateRoomCode();

      const slotId = 1;
      const playerId = 1;

      const lobbyPlayer: LobbyPlayer = {
        clientId,
        slotId,
        playerId,
        isReady: false,
        isHost: true,
        isBot: false,
      };

      const room: GameRoom = {
        code: roomCode,
        hostClientId: clientId,
        lobbyPlayers: new Map([[clientId, lobbyPlayer]]),

        matchConfig: {
          mapId: "exile-island",
          matchType: "30m",
        },

        gameState: null,
        gameTimer: null,
      };

      rooms.set(roomCode, room);

      roomCodeByClient.set(clientId, roomCode);

      console.log(`Client ${clientId} created room ${roomCode}`);

      socket.send(
        JSON.stringify({
          type: "room-created",
          roomCode,
        }),
      );

      broadcastLobby(room);
    }

    /*
     * ==============================================
     * ROOM ACTION: JOIN GAME
     * ==============================================
     */

    if (message.type === "join-game") {
      if (getRoomForClient(clientId)) {
        return;
      }

      const roomCode = String(message.roomCode ?? "")
        .trim()
        .toUpperCase();

      const room = rooms.get(roomCode);

      if (!room) {
        socket.send(
          JSON.stringify({
            type: "room-error",
            message: "Game not found.",
          }),
        );

        return;
      }

      if (room.gameState !== null) {
        socket.send(
          JSON.stringify({
            type: "room-error",
            message: "Game has already started.",
          }),
        );

        return;
      }

      const slotId = getNextAvailableSlot(room.lobbyPlayers);
      const playerId = getNextAvailablePlayerId(room.lobbyPlayers);

      if (slotId === null || playerId === null) {
        socket.send(
          JSON.stringify({
            type: "room-error",
            message: "Game is full.",
          }),
        );

        return;
      }

      const lobbyPlayer: LobbyPlayer = {
        clientId,
        slotId,
        playerId,
        isReady: false,
        isHost: false,
        isBot: false,
        characterClass: null,
        portrait: "A",
      };

      room.lobbyPlayers.set(clientId, lobbyPlayer);

      roomCodeByClient.set(clientId, roomCode);

      socket.send(
        JSON.stringify({
          type: "room-joined",
          roomCode,
        }),
      );

      console.log(`Client ${clientId} joined room ${roomCode}`);

      broadcastLobby(room);
    }

    /*
     * ==============================================
     * LOBBY ACTION: ADD BOT
     * ==============================================
     */

    if (message.type === "add-bot") {
      const room = getRoomForClient(clientId);

      if (!room || room.gameState !== null || clientId !== room.hostClientId) {
        return;
      }

      const slotId = getNextAvailableSlot(room.lobbyPlayers);
      const playerId = getNextAvailablePlayerId(room.lobbyPlayers);

      if (slotId === null || playerId === null) {
        return;
      }

      // Find the first class that isn't taken.
      const availableClass = CLASSES.find(
        (characterClass) =>
          !Array.from(room.lobbyPlayers.values()).some(
            (player) => player.characterClass === characterClass,
          ),
      );

      if (!availableClass) {
        return;
      }

      const botClientId = nextBotClientId--;

      const botPlayer: LobbyPlayer = {
        clientId: botClientId,
        slotId,
        playerId,
        isReady: true,
        isHost: false,
        isBot: true,
        characterClass: availableClass,
        portrait: "A",
      };

      room.lobbyPlayers.set(botClientId, botPlayer);

      console.log(
        `Bot ${botClientId} added to room ${room.code} as Player ${playerId} (${botPlayer.characterClass})`,
      );

      broadcastLobby(room);
    }

    /*
     * ==============================================
     * LOBBY ACTION: REMOVE BOT
     * ==============================================
     */

    if (message.type === "remove-bot") {
      const room = getRoomForClient(clientId);

      if (!room || room.gameState !== null || clientId !== room.hostClientId) {
        return;
      }

      const botClientId = Number(message.botClientId);
      const botPlayer = room.lobbyPlayers.get(botClientId);

      if (!botPlayer || !botPlayer.isBot) {
        return;
      }

      room.lobbyPlayers.delete(botClientId);

      console.log(`Bot ${botClientId} removed from room ${room.code}`);

      broadcastLobby(room);
    }

    /*
     * ==============================================
     * LOBBY ACTION: READY
     * ==============================================
     */

    if (message.type === "set-ready") {
      const room = getRoomForClient(clientId);

      if (!room || room.gameState !== null) {
        return;
      }

      const player = room.lobbyPlayers.get(clientId);

      if (!player || player.isBot) {
        return;
      }

      const requestedReady = message.isReady === true;

      // Players must select a class before readying up.
      if (requestedReady && player.characterClass === null) {
        return;
      }

      player.isReady = requestedReady;

      console.log(
        `Client ${clientId} ready in room ${room.code}: ${player.isReady}`,
      );

      broadcastLobby(room);
    }

    /*
     * ==============================================
     * LOBBY ACTION: LEAVE
     * ==============================================
     */

    if (message.type === "leave-lobby") {
      const room = getRoomForClient(clientId);

      if (!room) {
        return;
      }

      room.lobbyPlayers.delete(clientId);
      roomCodeByClient.delete(clientId);

      socket.send(
        JSON.stringify({
          type: "room-left",
        }),
      );

      if (clientId === room.hostClientId) {
        const nextHost = Array.from(room.lobbyPlayers.values())
          .filter((player) => !player.isBot)
          .sort((a, b) => a.slotId - b.slotId)[0];

        if (nextHost) {
          room.hostClientId = nextHost.clientId;
          nextHost.isHost = true;
        }
      }

      console.log(`Client ${clientId} left room ${room.code}`);

      if (room.lobbyPlayers.size === 0) {
        if (room.gameTimer) {
          clearInterval(room.gameTimer);
          room.gameTimer = null;
        }

        rooms.delete(room.code);

        console.log(`Room ${room.code} deleted`);
      } else {
        broadcastLobby(room);
      }
    }

    /*
     * ==============================================
     * LOBBY ACTION: START GAME
     * ==============================================
     */

    if (message.type === "start-game") {
      const room = getRoomForClient(clientId);

      if (!room || clientId !== room.hostClientId) {
        return;
      }

      const players = Array.from(room.lobbyPlayers.values());

      const currentMap =
        mapConfigs[room.matchConfig.mapId as keyof typeof mapConfigs];

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

      const everyoneHasCharacter = players.every(
        (player) => player.characterClass != null,
      );

      if (!everyoneHasCharacter) {
        return;
      }

      const selectedClasses = players.map((player) => player.characterClass);

      if (new Set(selectedClasses).size !== selectedClasses.length) {
        return;
      }

      const activePlayerIds = players.map((player) => player.playerId);

      room.gameState = createInitialGameState(
        activePlayerIds,
        room.matchConfig.matchType,
        room.matchConfig.mapId,
      );

      if (room.gameTimer) {
        clearInterval(room.gameTimer);
      }

      room.gameTimer = setInterval(() => {
        runGameTick(room);
      }, 1000);

      const gameStartedMessage = JSON.stringify({
        type: "game-started",
        players,
        matchConfig: room.matchConfig,
        gameState: room.gameState,
      });

      for (const player of room.lobbyPlayers.values()) {
        const playerSocket = connectedClients.get(player.clientId);

        if (playerSocket) {
          playerSocket.send(gameStartedMessage);
        }
      }

      console.log(`Client ${clientId} started game in room ${room.code}`);
    }

    /*
     * ==============================================
     * GAME ACTION: TRAIN ARMY
     * ==============================================
     *
     * Validates and starts army training at a
     * player-owned base.
     */

    if (message.type === "train-army") {
      const room = getRoomForClient(clientId);

      if (!room || !room.gameState) {
        return;
      }

      const player = room.lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      const baseId = Number(message.baseId);

      if (!isResourceType(message.resource)) {
        return;
      }

      const resource = message.resource;

      const trainingStarted = startArmyTraining(
        room,
        player.playerId,
        baseId,
        resource,
      );

      if (!trainingStarted) {
        return;
      }

      broadcastGameState(room);
    }

    /*
     * ==============================================
     * GAME ACTION: TRANSFER
     * ==============================================
     */

    if (message.type === "transfer-army") {
      const room = getRoomForClient(clientId);

      if (!room || !room.gameState) {
        return;
      }

      const player = room.lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      let gameState = room.gameState;

      const originBaseId = Number(message.originBaseId);

      const destinationBaseId = Number(message.destinationBaseId);

      if (!isArmyCounts(message.armies)) {
        return;
      }

      if (!isBaseResources(message.resources)) {
        return;
      }

      const armies = message.armies;
      const transferredResources = message.resources;

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

      const cargoCapacity = totalArmies * BALANCE.armies.cargoCapacity;

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

      const travelTime = distance * BALANCE.missions.travelSecondsPerTile;

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

      room.gameState = gameState;

      broadcastGameState(room);
    }

    /*
     * ==============================================
     * GAME ACTION: ATTACK
     * ==============================================
     */

    if (message.type === "attack-army") {
      const room = getRoomForClient(clientId);

      if (!room || !room.gameState) {
        return;
      }

      const player = room.lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      let gameState = room.gameState;

      const originBaseId = Number(message.originBaseId);

      const destinationBaseId = Number(message.destinationBaseId);

      if (!isArmyCounts(message.armies)) {
        return;
      }

      const armies = message.armies;

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

      const travelTime = distance * BALANCE.missions.travelSecondsPerTile;

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

      room.gameState = gameState;

      broadcastGameState(room);
    }

    /*
     * ==============================================
     * GAME ACTION: LOOT
     * ==============================================
     */

    if (message.type === "loot-army") {
      const room = getRoomForClient(clientId);

      if (!room || !room.gameState) {
        return;
      }

      const player = room.lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      let gameState = room.gameState;

      const originBaseId = Number(message.originBaseId);

      const treasureId = Number(message.treasureId);

      if (!isArmyCounts(message.armies)) {
        return;
      }

      const armies = message.armies;

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

      const travelTime = distance * BALANCE.missions.travelSecondsPerTile;

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

      room.gameState = gameState;

      broadcastGameState(room);
    }

    /*
     * ==============================================
     * GAME ACTION: EXPAND
     * ==============================================
     */

    if (message.type === "expand") {
      const room = getRoomForClient(clientId);

      if (!room || !room.gameState) {
        return;
      }

      const player = room.lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      let gameState = room.gameState;

      const originBaseId = Number(message.originBaseId);

      const destinationRow = Number(message.destinationRow);

      const destinationCol = Number(message.destinationCol);

      if (
        !isPositiveInteger(originBaseId) ||
        !isPositiveInteger(destinationRow) ||
        !isPositiveInteger(destinationCol)
      ) {
        return;
      }

      if (
        !isValidMapCoordinate(
          room.matchConfig.mapId,
          destinationRow,
          destinationCol,
        )
      ) {
        return;
      }

      if (!isBaseResources(message.payment)) {
        return;
      }

      const payment = message.payment;

      if (!isValidResourcePayment(payment)) {
        return;
      }

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

      if (playerBaseCount >= BALANCE.expansion.maxBases) {
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

      if (currentKeys < BALANCE.expansion.keyCost) {
        return;
      }

      const expansionsCompleted =
        gameState.expansionsCompletedByPlayer[player.playerId] ?? 0;

      const expansionCost = getExpansionCost(expansionsCompleted);

      /*
       * Validate the resource payment for this player's
       * next expansion.
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

      if (paymentTotal !== expansionCost) {
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

        [player.playerId]: currentKeys - BALANCE.expansion.keyCost,
      };

      /*
       * Determine expansion travel time
       */
      const distance =
        Math.abs(originBase.row - destinationRow) +
        Math.abs(originBase.col - destinationCol);

      const travelTime = distance * BALANCE.missions.travelSecondsPerTile;

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

        expansionKeys: BALANCE.expansion.keyCost,

        secondsRemaining: travelTime,
      };

      gameState = {
        ...gameState,

        resourcesByBase: updatedResources,

        expansionKeysByPlayer: updatedExpansionKeysByPlayer,

        armyMissions: [...gameState.armyMissions, newMission],

        nextMissionId: gameState.nextMissionId + 1,
      };

      room.gameState = gameState;

      broadcastGameState(room);
    }

    /*
     * ==============================================
     * GAME ACTION: RELOCATE
     * ==============================================
     */

    if (message.type === "relocate") {
      const room = getRoomForClient(clientId);

      if (!room || !room.gameState) {
        return;
      }

      const player = room.lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      let gameState = room.gameState;

      const originBaseId = Number(message.originBaseId);

      const destinationRow = Number(message.destinationRow);

      const destinationCol = Number(message.destinationCol);

      if (
        !isPositiveInteger(originBaseId) ||
        !isPositiveInteger(destinationRow) ||
        !isPositiveInteger(destinationCol)
      ) {
        return;
      }

      if (
        !isValidMapCoordinate(
          room.matchConfig.mapId,
          destinationRow,
          destinationCol,
        )
      ) {
        return;
      }

      if (!isBaseResources(message.payment)) {
        return;
      }

      const payment = message.payment;

      if (!isValidResourcePayment(payment)) {
        return;
      }

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
       * Calculate Relocation Cost
       */
      const relocationCost =
        BALANCE.relocation.baseCost +
        originBase.relocations * BALANCE.relocation.costIncrease;

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
       * Calculate relocation time
       */
      const distance =
        Math.abs(originBase.row - destinationRow) +
        Math.abs(originBase.col - destinationCol);

      const travelTime = distance * BALANCE.relocation.travelSecondsPerTile;

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

      room.gameState = gameState;

      broadcastGameState(room);
    }

    /*
     * ==============================================
     * LOBBY ACTION: SET MAP
     * ==============================================
     */

    if (message.type === "set-map") {
      const room = getRoomForClient(clientId);

      if (!room || room.gameState !== null || clientId !== room.hostClientId) {
        return;
      }

      if (typeof message.mapId !== "string" || !(message.mapId in mapConfigs)) {
        return;
      }

      room.matchConfig = {
        ...room.matchConfig,
        mapId: message.mapId,
      };

      broadcastLobby(room);
    }

    /*
     * ==============================================
     * LOBBY ACTION: SET MATCH TYPE
     * ==============================================
     */

    if (message.type === "set-match-type") {
      const room = getRoomForClient(clientId);

      if (!room || room.gameState !== null || clientId !== room.hostClientId) {
        return;
      }

      if (message.matchType !== "30m" && message.matchType !== "sudden-death") {
        return;
      }

      room.matchConfig = {
        ...room.matchConfig,
        matchType: message.matchType,
      };

      broadcastLobby(room);
    }

    /*
     * ==============================================
     * LOBBY ACTION: CHANGE CHARACTER
     * ==============================================
     */

    if (message.type === "change-character") {
      const room = getRoomForClient(clientId);

      if (!room || room.gameState !== null) {
        return;
      }

      const player = room.lobbyPlayers.get(clientId);

      if (!player) {
        return;
      }

      const requestedPlayerId = Number(message.playerId);

      if (!isPositiveInteger(requestedPlayerId) || requestedPlayerId > 4) {
        return;
      }

      const alreadyClaimed = Array.from(room.lobbyPlayers.values()).some(
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

      broadcastLobby(room);
    }

    /*
     * ==============================================
     * LOBBY ACTION: SELECT CHARACTER
     * ==============================================
     */

    if (message.type === "select-character") {
      const room = getRoomForClient(clientId);

      if (!room || room.gameState !== null) return;

      const player = room.lobbyPlayers.get(clientId);

      if (!player || player.isBot || player.isReady) return;

      const requestedClass = message.characterClass;

      if (!CLASSES.includes(requestedClass as CharacterClass)) {
        return;
      }

      // Only one player may select each class.
      const alreadyClaimed = Array.from(room.lobbyPlayers.values()).some(
        (otherPlayer) =>
          otherPlayer.clientId !== clientId &&
          otherPlayer.characterClass === requestedClass,
      );

      if (alreadyClaimed) return;

      player.characterClass = requestedClass as CharacterClass;
      player.portrait = "A";
      player.isReady = false;

      broadcastLobby(room);
    }

    /*
     * ==============================================
     * LOBBY ACTION: CHANGE PORTRAIT
     * ==============================================
     */

    if (message.type === "change-portrait") {
      const room = getRoomForClient(clientId);

      if (!room || room.gameState !== null) return;

      const player = room.lobbyPlayers.get(clientId);

      if (!player || player.isBot || player.isReady) return;

      if (message.variant !== "A" && message.variant !== "B") return;

      if (player.characterClass === null) return;

      player.portrait = message.variant;

      broadcastLobby(room);
    }
  });
  /*
   * ==================================================
   * DISCONNECT HANDLING
   * ==================================================
   */

  socket.on("close", () => {
    const currentSocket = connectedClients.get(clientId);

    if (currentSocket !== socket) {
      console.log(
        `Ignoring close event from stale socket for Client ${clientId}`,
      );
      return;
    }

    connectedClients.delete(clientId);

    const room = getRoomForClient(clientId);

    if (!room) {
      console.log(`Client ${clientId} disconnected`);
      return;
    }

    /*
     * During an active game, preserve the player's room
     * membership so they can reconnect later.
     */
    if (room.gameState !== null) {
      console.log(
        `Client ${clientId} disconnected from active room ${room.code}`,
      );

      return;
    }

    /*
     * Before the game starts, disconnecting removes
     * the player from the lobby.
     */
    room.lobbyPlayers.delete(clientId);
    roomCodeByClient.delete(clientId);

    console.log(`Client ${clientId} disconnected from room ${room.code}`);

    if (clientId === room.hostClientId) {
      const nextHost = Array.from(room.lobbyPlayers.values())
        .filter((player) => !player.isBot)
        .sort((a, b) => a.slotId - b.slotId)[0];

      if (nextHost) {
        room.hostClientId = nextHost.clientId;
        nextHost.isHost = true;
      }
    }

    if (room.lobbyPlayers.size === 0) {
      if (room.gameTimer) {
        clearInterval(room.gameTimer);
        room.gameTimer = null;
      }

      rooms.delete(room.code);

      console.log(`Room ${room.code} deleted`);
    } else {
      broadcastLobby(room);
    }
  });
});

console.log(`EXiLE server running on port ${PORT}`);
