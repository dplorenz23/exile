import {
  WebSocket,
  WebSocketServer,
} from "ws";

const PORT = 8080;

const server =
  new WebSocketServer({
    port: PORT,
  });

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