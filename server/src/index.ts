import { createInitialGameState } from "../../src/game/createInitialGameState";
import { mapOne } from "../../src/game/maps/mapOne";
import { mapTwo } from "../../src/game/maps/mapTwo";
import {
  getArmyCost,
  getLocationMultiplier,
} from "../../src/game/rules";

import type {
  GameState,
  MatchType,
  ResourceType,
} from "../../src/game/types";

import {
  WebSocket,
  WebSocketServer,
} from "ws";

/*
 * ==================================================
 * SERVER CONFIGURATION
 * ==================================================
 */

const PORT = 8080;

const server =
  new WebSocketServer({
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

let hostClientId:
  number | null = null;

const connectedClients =
  new Map<number, WebSocket>();

const lobbyPlayers =
  new Map<number, LobbyPlayer>();

let matchConfig: {
  mapId: string;
  matchType: MatchType;
} = {
  mapId: "exile-island",
  matchType: "30m",
};

let gameState:
  GameState | null = null;

let gameTimer:
  NodeJS.Timeout | null = null;

/*
 * ==================================================
 * LOBBY HELPERS
 * ==================================================
 */

function getNextAvailableSlot() {
  const usedSlots =
    Array.from(
      lobbyPlayers.values(),
    ).map(
      (player) =>
        player.slotId,
    );

  for (
    let slotId = 1;
    slotId <= 4;
    slotId++
  ) {
    if (
      !usedSlots.includes(
        slotId,
      )
    ) {
      return slotId;
    }
  }

  return null;
}

function getNextAvailablePlayerId() {
  const usedPlayerIds =
    Array.from(
      lobbyPlayers.values(),
    ).map(
      (player) =>
        player.playerId,
    );

  for (
    let playerId = 1;
    playerId <= 4;
    playerId++
  ) {
    if (
      !usedPlayerIds.includes(
        playerId,
      )
    ) {
      return playerId;
    }
  }

  return null;
}

function broadcastLobby() {
  const players =
    Array.from(
      lobbyPlayers.values(),
    ).sort(
      (a, b) =>
        a.slotId - b.slotId,
    );

  const message =
    JSON.stringify({
      type: "lobby-state",
      players,
      matchConfig,
    });

  for (
    const socket
    of connectedClients.values()
  ) {
    socket.send(
      message,
    );
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

  const message =
    JSON.stringify({
      type: "game-state",
      gameState,
    });

  for (
    const socket
    of connectedClients.values()
  ) {
    socket.send(
      message,
    );
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

  const updatedBases =
    gameState.bases.map(
      (base) => {
        /*
         * A relocating base still exists, but it does
         * not age or train while moving.
         */
        if (base.isRelocating) {
          return base;
        }

        let updatedArmies =
          base.armies;

        let updatedTraining =
          base.training;

        let updatedArmiesBuilt =
          base.armiesBuilt;

        if (base.training) {
          const secondsRemaining =
            base.training
              .secondsRemaining - 1;

          if (
            secondsRemaining <= 0
          ) {
            const resource =
              base.training.resource;

            updatedArmies = {
              ...base.armies,

              [resource]:
                base.armies[
                  resource
                ] + 1,
            };

            updatedArmiesBuilt = {
              ...base.armiesBuilt,

              [resource]:
                base.armiesBuilt[
                  resource
                ] + 1,
            };

            const completedArmyCost =
              getArmyCost(
                base.armiesBuilt[
                  resource
                ],
              );

            updatedArmiesTrainedByPlayer[
              base.playerId
            ] =
              (
                updatedArmiesTrainedByPlayer[
                  base.playerId
                ] ?? 0
              ) + 1;

            updatedArmyResourcesSpentByPlayer[
              base.playerId
            ] =
              (
                updatedArmyResourcesSpentByPlayer[
                  base.playerId
                ] ?? 0
              ) +
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

          timeInLocationSeconds:
            base.timeInLocationSeconds + 1,

          armies:
            updatedArmies,

          armiesBuilt:
            updatedArmiesBuilt,

          training:
            updatedTraining,
        };
      },
    );

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

  /*
   * ==================================================
   * STEP 3:
   * ELIMINATION / SCORING / VICTORY
   * ==================================================
   *
   * TODO — MIGRATE FROM App.tsx
   *
   * Expected contents:
   * - detect players with zero surviving bases
   * - freeze eliminated-player scores
   * - calculate live scores
   * - detect Sudden Death winner
   * - detect timed-match winner
   */

  /*
   * ==================================================
   * STEP 4:
   * RESOURCE PRODUCTION
   * ==================================================
   *
   * MIGRATED FROM App.tsx.
   */

  const updatedResources = {
    ...gameState.resourcesByBase,
  };

  updatedBases.forEach(
    (base) => {
      if (base.isRelocating) {
        return;
      }

      const activeMapTiles =
        gameState!.mapId ===
        "map-two"
          ? mapTwo
          : mapOne;

      const tile =
        activeMapTiles.find(
          (tile) =>
            tile.row ===
              base.row &&
            tile.col ===
              base.col,
        );

      if (!tile) {
        return;
      }

      const currentResources =
        updatedResources[
          base.id
        ];

      if (!currentResources) {
        return;
      }

      const locationMultiplier =
        getLocationMultiplier(
          base.timeInLocationSeconds,
        );

      const productionAmount =
        locationMultiplier *
        tile.multiplier;

      const resource =
        tile.resource;

      updatedResources[
        base.id
      ] = {
        ...currentResources,

        [resource]:
          currentResources[
            resource
          ] +
          productionAmount,
      };
    },
  );

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

    gameSeconds:
      gameState.gameSeconds + 1,

    bases:
      updatedBases,

    resourcesByBase:
      updatedResources,

    armiesTrainedByPlayer:
      updatedArmiesTrainedByPlayer,

    armyResourcesSpentByPlayer:
      updatedArmyResourcesSpentByPlayer,
  };

  console.log(
    "SERVER CLOCK:",
    gameState.gameSeconds,
  );

  broadcastGameState();
}

/*
 * ==================================================
 * CONNECTION HANDLING
 * ==================================================
 */

server.on(
  "connection",
  (socket) => {
    const clientId =
      nextClientId++;

    const slotId =
      getNextAvailableSlot();

    const playerId =
      getNextAvailablePlayerId();

    if (
      slotId === null ||
      playerId === null
    ) {
      socket.send(
        JSON.stringify({
          type: "error",
          message:
            "Lobby is full",
        }),
      );

      socket.close();
      return;
    }

    if (
      hostClientId === null
    ) {
      hostClientId =
        clientId;
    }

    const lobbyPlayer:
      LobbyPlayer = {
      clientId,
      slotId,
      playerId,
      isReady: false,

      isHost:
        clientId ===
        hostClientId,
    };

    connectedClients.set(
      clientId,
      socket,
    );

    lobbyPlayers.set(
      clientId,
      lobbyPlayer,
    );

    console.log(
      `Client ${clientId} connected`,
    );

    socket.send(
      JSON.stringify({
        type: "connected",
        clientId,

        message:
          "Connected to EXiLE server",
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

    socket.on(
      "message",
      (data) => {
        const message =
          JSON.parse(
            data.toString(),
          );

        /*
         * ==============================================
         * LOBBY ACTION: READY
         * ==============================================
         */

        if (
          message.type ===
          "set-ready"
        ) {
          const player =
            lobbyPlayers.get(
              clientId,
            );

          if (!player) {
            return;
          }

          player.isReady =
            Boolean(
              message.isReady,
            );

          console.log(
            `Client ${clientId} ready: ${player.isReady}`,
          );

          broadcastLobby();
        }

        /*
         * ==============================================
         * LOBBY ACTION: LEAVE
         * ==============================================
         */

        if (
          message.type ===
          "leave-lobby"
        ) {
          lobbyPlayers.delete(
            clientId,
          );

          if (
            clientId ===
            hostClientId
          ) {
            const nextHost =
              lobbyPlayers
                .values()
                .next();

            hostClientId =
              nextHost.done
                ? null
                : nextHost
                    .value
                    .clientId;

            if (
              hostClientId !==
              null
            ) {
              const newHost =
                lobbyPlayers.get(
                  hostClientId,
                );

              if (newHost) {
                newHost.isHost =
                  true;
              }
            }
          }

          console.log(
            `Client ${clientId} left lobby`,
          );

          broadcastLobby();
        }

        /*
         * ==============================================
         * LOBBY ACTION: START GAME
         * ==============================================
         */

        if (
          message.type ===
          "start-game"
        ) {
          if (
            clientId !==
            hostClientId
          ) {
            return;
          }

          const players =
            Array.from(
              lobbyPlayers.values(),
            );

          const currentMap =
            mapConfigs[
              matchConfig.mapId as
                keyof typeof mapConfigs
            ];

          if (!currentMap) {
            return;
          }

          if (
            players.length <
              currentMap.minPlayers ||
            players.length >
              currentMap.maxPlayers
          ) {
            return;
          }

          if (
            players.length < 2
          ) {
            return;
          }

          const everyoneReady =
            players.every(
              (player) =>
                player.isReady,
            );

          if (!everyoneReady) {
            return;
          }

          const activePlayerIds =
            players.map(
              (player) =>
                player.playerId,
            );

          gameState =
            createInitialGameState(
              activePlayerIds,
              matchConfig.matchType,
              matchConfig.mapId,
            );

          if (gameTimer) {
            clearInterval(
              gameTimer,
            );
          }

          gameTimer =
            setInterval(
              runGameTick,
              1000,
            );

          const gameStartedMessage =
            JSON.stringify({
              type: "game-started",
              players,
              matchConfig,
              gameState,
            });

          for (
            const socket
            of connectedClients.values()
          ) {
            socket.send(
              gameStartedMessage,
            );
          }

          console.log(
            `Client ${clientId} started the game`,
          );
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

        if (
          message.type ===
          "train-army"
        ) {
          if (!gameState) {
            return;
          }

          const player =
            lobbyPlayers.get(
              clientId,
            );

          if (!player) {
            return;
          }

          const baseId =
            Number(
              message.baseId,
            );

          const resource =
            message.resource as
              ResourceType;

          const base =
            gameState.bases.find(
              (base) =>
                base.id ===
                baseId,
            );

          if (!base) {
            return;
          }

          /*
           * Player may only train at their own base.
           */
          if (
            base.playerId !==
            player.playerId
          ) {
            return;
          }

          /*
           * Base can only train one army at a time.
           */
          if (base.training) {
            return;
          }

          const resources =
            gameState.resourcesByBase[
              baseId
            ];

          if (!resources) {
            return;
          }

          const cost =
            getArmyCost(
              base.armiesBuilt[
                resource
              ],
            );

          if (
            resources[resource] <
            cost
          ) {
            return;
          }

          const updatedBases =
            gameState.bases.map(
              (currentBase) => {
                if (
                  currentBase.id !==
                  baseId
                ) {
                  return currentBase;
                }

                return {
                  ...currentBase,

                  training: {
                    resource,
                    secondsRemaining:
                      10,
                  },
                };
              },
            );

          const updatedResources = {
            ...gameState
              .resourcesByBase,

            [baseId]: {
              ...resources,

              [resource]:
                resources[
                  resource
                ] -
                cost,
            },
          };

          gameState = {
            ...gameState,

            bases:
              updatedBases,

            resourcesByBase:
              updatedResources,
          };

          console.log(
            "TRAIN APPROVED:",
            {
              baseId,
              resource,
              cost,
            },
          );

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

        /*
        if (
          message.type ===
          "send-army"
        ) {
          // TODO: paste / migrate validation and
          // mission-creation logic from App.tsx.
        }
        */

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

        if (
          message.type ===
          "set-map"
        ) {
          if (
            clientId !==
            hostClientId
          ) {
            return;
          }

          matchConfig = {
            ...matchConfig,
            mapId:
              message.mapId,
          };

          broadcastLobby();
        }

        /*
         * ==============================================
         * LOBBY ACTION: SET MATCH TYPE
         * ==============================================
         */

        if (
          message.type ===
          "set-match-type"
        ) {
          if (
            clientId !==
            hostClientId
          ) {
            return;
          }

          matchConfig = {
            ...matchConfig,

            matchType:
              message.matchType,
          };

          broadcastLobby();
        }

        /*
         * ==============================================
         * LOBBY ACTION: CHANGE CHARACTER
         * ==============================================
         */

        if (
          message.type ===
          "change-character"
        ) {
          const player =
            lobbyPlayers.get(
              clientId,
            );

          if (!player) {
            return;
          }

          const requestedPlayerId =
            Number(
              message.playerId,
            );

          if (
            requestedPlayerId < 1 ||
            requestedPlayerId > 4
          ) {
            return;
          }

          const alreadyClaimed =
            Array.from(
              lobbyPlayers.values(),
            ).some(
              (otherPlayer) =>
                otherPlayer.clientId !==
                  clientId &&
                otherPlayer.playerId ===
                  requestedPlayerId,
            );

          if (alreadyClaimed) {
            return;
          }

          player.playerId =
            requestedPlayerId;

          player.isReady =
            false;

          console.log(
            `Client ${clientId} changed to player ${requestedPlayerId}`,
          );

          broadcastLobby();
        }
      },
    );

    /*
     * ==================================================
     * DISCONNECT HANDLING
     * ==================================================
     */

    socket.on(
      "close",
      () => {
        connectedClients.delete(
          clientId,
        );

        lobbyPlayers.delete(
          clientId,
        );

        console.log(
          `Client ${clientId} disconnected`,
        );

        if (
          clientId ===
          hostClientId
        ) {
          const nextHost =
            lobbyPlayers
              .values()
              .next();

          hostClientId =
            nextHost.done
              ? null
              : nextHost
                  .value
                  .clientId;

          if (
            hostClientId !==
            null
          ) {
            const newHost =
              lobbyPlayers.get(
                hostClientId,
              );

            if (newHost) {
              newHost.isHost =
                true;
            }

            console.log(
              `Client ${hostClientId} is now host`,
            );
          }
        }

        broadcastLobby();
      },
    );
  },
);

console.log(
  `EXiLE server running on port ${PORT}`,
);
