import { createInitialGameState } from "../../src/game/createInitialGameState";

import { getArmyCost } from "../../src/game/rules";

import type {
  GameState,
  MatchType,
  ResourceType,
} from "../../src/game/types";

import {
  WebSocket,
  WebSocketServer,
} from "ws";

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

let nextClientId = 1;
let hostClientId: number | null = null;

type LobbyPlayer = {
  clientId: number;
  slotId: number;
  playerId: number;
  isReady: boolean;
  isHost: boolean;
};

const connectedClients =
  new Map<number, WebSocket>();

const lobbyPlayers =
  new Map<number, LobbyPlayer>();

let matchConfig = {
  mapId: "exile-island",
  matchType: "30m",
};

let gameState = null;

let gameTimer:
  NodeJS.Timeout | null =
  null;

function getNextAvailableSlot() {
  const usedSlots =
    Array.from(
      lobbyPlayers.values(),
    ).map(
      (player) => player.slotId,
    );

  for (
    let slotId = 1;
    slotId <= 4;
    slotId++
  ) {
    if (
      !usedSlots.includes(slotId)
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
      (player) => player.playerId,
    );

  for (
    let playerId = 1;
    playerId <= 4;
    playerId++
  ) {
    if (
      !usedPlayerIds.includes(playerId)
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
    socket.send(message);
  }
}

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
      hostClientId = clientId;
    }

    const lobbyPlayer:
      LobbyPlayer = {
      clientId,
      slotId,
      playerId,
      isReady: false,
      isHost:
        clientId === hostClientId,
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

    socket.on(
      "message",
      (data) => {
        const message =
          JSON.parse(
            data.toString(),
          );

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

        if (
          message.type ===
          "leave-lobby"
        ) {
          lobbyPlayers.delete(
            clientId,
          );

          if (
            clientId === hostClientId
          ) {
            const nextHost =
              lobbyPlayers
                .values()
                .next();

            hostClientId =
              nextHost.done
                ? null
                : nextHost.value.clientId;

            if (
              hostClientId !== null
            ) {
              const newHost =
                lobbyPlayers.get(
                  hostClientId,
                );

              if (newHost) {
                newHost.isHost = true;
              }
            }
          }

          console.log(
            `Client ${clientId} left lobby`,
          );

          broadcastLobby();
        }

        if (
          message.type ===
          "start-game"
        ) {
          if (
            clientId !== hostClientId
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
            setInterval(() => {
              if (!gameState) {
                return;
              }

              gameState = {
                ...gameState,
                gameSeconds:
                  gameState.gameSeconds + 1,
              };

              console.log(
                "SERVER CLOCK:",
                gameState.gameSeconds,
              );

              const clockMessage =
                JSON.stringify({
                  type: "game-clock",
                  gameSeconds:
                    gameState.gameSeconds,
                });

              for (
                const socket
                of connectedClients.values()
              ) {
                socket.send(
                  clockMessage,
                );
              }
            }, 1000);

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

        if (
          message.type ===
          "train-army"
        ) {
          console.log(
            "TRAIN REQUEST:",
            clientId,
            message,
          );

          if (!gameState) {
            console.log(
              "TRAIN REJECTED: no gameState",
            );
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
            message.resource as ResourceType;

          const base =
            gameState.bases.find(
              (base) =>
               base.id === baseId,
            );

          console.log(
            "TRAIN BASE:",
            base,
          );

          console.log(
          "TRAIN PLAYER:",
          player,
        );

        console.log(
          "TRAIN RESOURCES:",
          gameState.resourcesByBase[
            baseId
          ],
        );

        console.log(
          "TRAIN OWNERSHIP:",
          {
            basePlayerId:
              base.playerId,
            requestingPlayerId:
              player.playerId,
          },
        );

          if (!base) {
            return;
          }

          /*
           * A player may only train
           * at one of their own bases.
           */
          if (
            base.playerId !==
            player.playerId
          ) {
            return;
          }

          /*
           * A base can only train
           * one army at a time.
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
                    secondsRemaining: 10,
                  },
                };
              },
            );

          const updatedResources = {
            ...gameState.resourcesByBase,

            [baseId]: {
              ...resources,

              [resource]:
                resources[resource] -
                cost,
            },
          };

          console.log(
            "TRAIN APPROVED:",
            {
              baseId,
              resource,
              cost,
            },
          );

          gameState = {
            ...gameState,
            bases: updatedBases,
            resourcesByBase:
              updatedResources,
          };

          const gameStateMessage =
            JSON.stringify({
              type: "game-state",
              gameState,
            });

          for (
            const socket
            of connectedClients.values()
          ) {
            socket.send(
              gameStateMessage,
            );
          }
        }

        if (
          message.type === "set-map"
        ) {
          if (
            clientId !== hostClientId
          ) {
            return;
          }

          matchConfig = {
            ...matchConfig,
            mapId: message.mapId,
          };

          broadcastLobby();
        }

        if (
          message.type ===
          "set-match-type"
        ) {
          if (
            clientId !== hostClientId
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

          player.isReady = false;

          console.log(
            `Client ${clientId} changed to player ${requestedPlayerId}`,
          );

          broadcastLobby();
        }

      },
    );

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
          clientId === hostClientId
        ) {
          const nextHost =
            lobbyPlayers
              .values()
              .next();

          hostClientId =
            nextHost.done
              ? null
              : nextHost.value.clientId;

          if (
            hostClientId !== null
          ) {
            const newHost =
              lobbyPlayers.get(
                hostClientId,
              );

            if (newHost) {
              newHost.isHost = true;
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