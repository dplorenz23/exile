import { useState } from "react";

import { maps } from "../game/gameState";

import type { LobbySlot, MatchConfig, Player, MatchType } from "../game/types";

import HowToPlay from "./HowToPlay";

/*
 * Displays the multiplayer lobby and sends player/host actions
 * upward through callbacks.
 *
 * Lobby state and validation are authoritative on the server;
 * this component only renders the current lobby state and
 * controls which actions are available in the UI.
 */

interface LobbyProps {
  myClientId: number | null;
  slots: LobbySlot[];
  players: Player[];

  matchConfig: MatchConfig;

  onMatchTypeChange: (matchType: MatchType) => void;

  onMapChange: (mapId: string) => void;

  onToggleReady: (slotId: number) => void;

  onStartGame: () => void;

  onCharacterChange: (slotId: number, playerId: number) => void;

  onLeaveSlot: (slotId: number) => void;

  roomCode: string;

  onAddBot: () => void;
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
  onCharacterChange,
  onLeaveSlot,
  roomCode,
  onAddBot,
}: LobbyProps) {
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const occupiedSlots = slots.filter((slot) => slot.playerId !== null);

  const isCurrentClientHost = slots.some(
    (slot) => slot.clientId === myClientId && slot.isHost,
  );

  const currentMap = maps.find((map) => map.id === matchConfig.mapId);

  const displaySlots: LobbySlot[] = Array.from(
    { length: currentMap?.maxPlayers ?? 4 },
    (_, index) => {
      const slotId = index + 1;

      return (
        slots.find((slot) => slot.slotId === slotId) ?? {
          slotId,
          playerId: null,
          isReady: false,
        }
      );
    },
  );

  const canStart =
    currentMap !== undefined &&
    occupiedSlots.length >= currentMap.minPlayers &&
    occupiedSlots.length <= currentMap.maxPlayers &&
    occupiedSlots.every((slot) => slot.isReady);

  let startError = "";

  if (currentMap) {
    if (occupiedSlots.length < currentMap.minPlayers) {
      startError =
        `${currentMap.name} requires at least ` +
        `${currentMap.minPlayers} players.`;
    } else if (occupiedSlots.length > currentMap.maxPlayers) {
      startError =
        `${currentMap.name} supports a maximum of ` +
        `${currentMap.maxPlayers} players.`;
    } else if (!occupiedSlots.every((slot) => slot.isReady)) {
      startError = "All players must be ready.";
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-panel">
        <div className="lobby-header">
          <h1>EXiLE</h1>

          <div className="lobby-room-code">
            <span>ROOM</span>
            <strong>{roomCode}</strong>
          </div>
        </div>

        <div className="lobby-section-title">Players</div>

        <div className="lobby-slots">
          {displaySlots.map((slot) => {
            const player =
              slot.playerId !== null
                ? players.find((player) => player.id === slot.playerId)
                : undefined;

            return (
              <div
                key={slot.slotId}
                className={`lobby-slot ${
                  slot.isReady ? "lobby-slot-ready" : ""
                }`}
              >
                {player ? (
                  <>
                    <div className="lobby-player-header">
                      <div className="lobby-player-identity">
                        <span className="lobby-player-avatar">
                          {player.avatar}
                        </span>

                        <div>
                          <strong>
                            {player.name}
                            {slot.isBot && (
                              <span className="lobby-bot-badge"> BOT</span>
                            )}
                          </strong>

                          <span>Player {slot.slotId}</span>
                        </div>
                      </div>

                      {slot.isHost && (
                        <span className="lobby-host-badge">👑 Host</span>
                      )}
                    </div>

                    <label className="lobby-character-select">
                      Character
                      <select
                        value={slot.playerId ?? ""}
                        disabled={slot.clientId !== myClientId || slot.isBot}
                        onChange={(event) =>
                          onCharacterChange(
                            slot.slotId,
                            Number(event.target.value),
                          )
                        }
                      >
                        {players.map((character) => {
                          const claimedByAnotherSlot = slots.some(
                            (otherSlot) =>
                              otherSlot.slotId !== slot.slotId &&
                              otherSlot.playerId === character.id,
                          );

                          return (
                            <option
                              key={character.id}
                              value={character.id}
                              disabled={claimedByAnotherSlot}
                            >
                              {character.avatar} {character.name}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <button
                      className="lobby-ready-button"
                      disabled={slot.clientId !== myClientId || slot.isBot}
                      onClick={() => onToggleReady(slot.slotId)}
                    >
                      {slot.isReady ? "✓ Ready" : "Ready Up"}
                    </button>

                    {slot.clientId === myClientId && (
                      <button
                        className="lobby-leave-button"
                        onClick={() => onLeaveSlot(slot.slotId)}
                      >
                        Leave
                      </button>
                    )}
                  </>
                ) : (
                  <div className="lobby-empty-slot">
                    <span className="lobby-empty-icon">+</span>
                    <strong>Open Player Slot</strong>

                    {isCurrentClientHost && (
                      <button
                        onClick={() => {
                          console.log("Add Bot button clicked");
                          onAddBot();
                        }}
                      >
                        Add Bot
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lobby-settings">
          <div className="lobby-section-title">Game Settings</div>

          <div className="lobby-settings-grid">
            <label>
              Map
              <select
                value={matchConfig.mapId}
                disabled={!isCurrentClientHost}
                onChange={(event) => onMapChange(event.target.value)}
              >
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name} ({map.minPlayers}–{map.maxPlayers} Players)
                  </option>
                ))}
              </select>
            </label>

            <label>
              Match Type
              <select
                value={matchConfig.matchType}
                disabled={!isCurrentClientHost}
                onChange={(event) =>
                  onMatchTypeChange(event.target.value as MatchType)
                }
              >
                <option value="30m">30 Minutes</option>
                <option value="sudden-death">Sudden Death</option>
              </select>
            </label>
          </div>
        </div>

        <div className="lobby-start-section">
          {startError && (
            <div className="lobby-start-message">{startError}</div>
          )}

          <div className="lobby-start-buttons">
            <button
              className="lobby-how-to-button"
              onClick={() => setShowHowToPlay(true)}
            >
              ? How to Play
            </button>

            <button
              className="lobby-play-button"
              disabled={!canStart || !isCurrentClientHost}
              onClick={onStartGame}
            >
              Play Game
            </button>
          </div>
        </div>

        {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
      </div>
    </div>
  );
}
