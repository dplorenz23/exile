import { maps } from "../game/gameState";

import type {
  LobbySlot,
  MatchConfig,
  Player,
  MatchType
} from "../game/types";

interface LobbyProps {
  myClientId: number | null;
  slots: LobbySlot[];
  players: Player[];

  matchConfig: MatchConfig;

  onMatchTypeChange: (
    matchType: MatchType,
  ) => void;

  onMapChange: (
    mapId: string,
  ) => void;

  onToggleReady: (
    slotId: number,
  ) => void;

  onStartGame: () => void;

  onJoinSlot: (
    slotId: number,
  ) => void;

  onCharacterChange: (
    slotId: number,
    playerId: number,
  ) => void;

  onLeaveSlot: (
    slotId: number,
  ) => void;
}

export default function Lobby({
  myClientId,
  slots,
  players,
  matchConfig,
  onMatchTypeChange,
  onMapChange,
  onToggleReady,
  onStartGame,
  onJoinSlot,
  onCharacterChange,
  onLeaveSlot,
}: LobbyProps) {

  const occupiedSlots =
    slots.filter(
      (slot) =>
        slot.playerId !== null,
    );

  const currentMap =
    maps.find(
      (map) =>
        map.id === matchConfig.mapId,
    );

  const canStart =
    currentMap !== undefined &&
    occupiedSlots.length >=
      currentMap.minPlayers &&
    occupiedSlots.length <=
      currentMap.maxPlayers &&
    occupiedSlots.every(
      (slot) =>
        slot.isReady,
    );

  return (
    <div className="lobby">
      <div className="lobby-panel">
        <h1>EXiLE</h1>

        <div className="lobby-slots">
          {slots.map((slot) => {
            const player =
              slot.playerId !== null
                ? players.find(
                    (player) =>
                      player.id ===
                      slot.playerId,
                  )
                : undefined;

            return (
              <div
                key={slot.slotId}
                className="lobby-slot"
              >
                <strong>
                  Slot {slot.slotId}
                  {slot.slotId === 1 && " 👑 Host"}
                </strong>

                {player ? (
                  <select
                    value={slot.playerId ?? ""}
                    onChange={(event) =>
                      onCharacterChange(
                        slot.slotId,
                        Number(event.target.value),
                      )
                    }
                  >
                    {players.map((character) => {
                      const claimedByAnotherSlot =
                        slots.some(
                          (otherSlot) =>
                            otherSlot.slotId !==
                              slot.slotId &&
                            otherSlot.playerId ===
                              character.id,
                        );

                      return (
                        <option
                          key={character.id}
                          value={character.id}
                          disabled={
                            claimedByAnotherSlot
                          }
                        >
                          {character.avatar}{" "}
                          {character.name}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <>
                    <span>
                      Open
                    </span>

                    <button
                      onClick={() =>
                        onJoinSlot(
                          slot.slotId,
                        )
                      }
                    >
                      Join
                    </button>
                  </>
                )}

                {player && (
                  <button
                    className="lobby-ready-button"
                    disabled={
                      slot.clientId !== myClientId
                    }
                    onClick={() =>
                      onToggleReady(slot.slotId)
                    }
                  >
                    {slot.isReady
                      ? "✅ Ready"
                      : "Ready Up"}
                  </button>
                )}

                {player && slot.slotId !== 1 && (
                  <button
                    className="lobby-leave-button"
                    onClick={() =>
                      onLeaveSlot(slot.slotId)
                    }
                  >
                    Leave
                  </button>
                )}

              </div>
            );
          })}
        </div>

        <div className="lobby-host-controls">
          <label>
            Map{" "}

            <select
              value={matchConfig.mapId}
              onChange={(event) =>
                onMapChange(
                  event.target.value,
                )
              }
            >
              {maps.map((map) => (
                <option
                  key={map.id}
                  value={map.id}
                >
                  {map.name} ({map.minPlayers}–{map.maxPlayers} Players)
                </option>
              ))}
            </select>
          </label>

          <label>
            Match Type{" "}

            <select
              value={
                matchConfig.matchType
              }
              onChange={(event) =>
                onMatchTypeChange(
                  event.target.value as MatchType,
                )
              }
            >
              <option value="30m">
                30 Minutes
              </option>

              <option value="sudden-death">
                Sudden Death
              </option>
            </select>
          </label>

          <button
            disabled={!canStart}
            onClick={onStartGame}
          >
            Play Game
          </button>
        </div>
      </div>
    </div>
  );
}