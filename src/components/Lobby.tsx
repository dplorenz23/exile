import { useState } from "react";

import { maps } from "../game/gameState";

import type { LobbySlot, MatchConfig, Player, MatchType } from "../game/types";

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

  onJoinSlot: (slotId: number) => void;

  onCharacterChange: (slotId: number, playerId: number) => void;

  onLeaveSlot: (slotId: number) => void;

  roomCode: string;
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
  roomCode,
}: LobbyProps) {
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const occupiedSlots = slots.filter((slot) => slot.playerId !== null);

  const isCurrentClientHost = slots.some(
    (slot) => slot.clientId === myClientId && slot.isHost,
  );

  const currentMap = maps.find((map) => map.id === matchConfig.mapId);

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
          {slots.map((slot) => {
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
                          <strong>{player.name}</strong>
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
                        disabled={slot.clientId !== myClientId}
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
                      disabled={slot.clientId !== myClientId}
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

                    <button onClick={() => onJoinSlot(slot.slotId)}>
                      Join
                    </button>
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

        {showHowToPlay && (
          <div
            className="how-to-overlay"
            onClick={() => setShowHowToPlay(false)}
          >
            <div
              className="how-to-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="how-to-header">
                <h2>How to Play</h2>

                <button
                  className="how-to-close"
                  onClick={() => setShowHowToPlay(false)}
                  aria-label="Close How to Play"
                >
                  ×
                </button>
              </div>

              <div className="how-to-content">
                <section>
                  <h3>🎯 Goal</h3>
                  <p>
                    Build your empire, strengthen your bases, and eliminate your
                    rivals. In a timed match, the highest-scoring surviving
                    empire when time expires wins. In a sudden death match, the
                    last player standing wins.
                  </p>
                </section>

                <section>
                  <h3>💧🔥🌱 Resources — Top Center</h3>
                  <p>
                    Your selected base produces{" "}
                    <strong>Water, Fire, and Grass</strong> automatically.
                  </p>
                  <p>
                    Bases mature over time from{" "}
                    <strong>Tent → House → Mansion → Castle</strong>, increasing
                    their production.
                  </p>
                  <p>
                    Resource tiles marked <strong>2× or 3×</strong> increase
                    production of that resource.
                  </p>
                </section>

                <section>
                  <h3>📜 Game Log — Left</h3>
                  <p>
                    Follow important events across the map, including attacks,
                    destroyed bases, expansions, relocations, and looting.
                    Failed attacks, expansions, relocations, and loot attempts
                    are also logged for everyone to see.
                  </p>
                </section>

                <section>
                  <h3>🏆 Standings — Top Right</h3>
                  <p>See each player's current score and position.</p>
                </section>

                <section>
                  <h3>⏱ Timer — Top Right</h3>
                  <p>Shows the time remaining in a timed match.</p>
                </section>

                <section>
                  <h3>➤ Armies Moving — Right</h3>
                  <p>
                    Track your armies and missions as they travel across the
                    map. Travel time depends on distance.{" "}
                    <strong>
                      Only you can see your armies and their movements.
                    </strong>
                  </p>
                </section>

                <section>
                  <h3>🏰 Your Bases — Bottom Left</h3>
                  <p>
                    Switch between your bases here.{" "}
                    <strong>
                      Resources, armies, and actions belong to the currently
                      selected base.
                    </strong>
                  </p>
                </section>

                <section>
                  <h3>⚔ Base Actions — Bottom Right</h3>

                  <p>
                    <strong>⚔ Train</strong> — Spend resources to train Water,
                    Fire, or Grass armies.
                  </p>

                  <p>
                    <strong>➤ Send Army</strong> — Attack an enemy, transfer
                    resources to another base, or loot treasure.
                  </p>

                  <p>
                    <strong>🔑 Expand</strong> — Spend resources and an
                    Expansion Key to establish a new base. You can control up to{" "}
                    <strong>3 bases</strong>.
                  </p>

                  <p>
                    <strong>📦 Relocate</strong> — Move your selected base to a
                    new location.
                  </p>
                </section>

                <section>
                  <h3>⚔ Combat</h3>
                  <p>Each army has an elemental type:</p>

                  <div className="how-to-combat">
                    <strong>💧 Water beats 🔥 Fire</strong>
                    <strong>🔥 Fire beats 🌱 Grass</strong>
                    <strong>🌱 Grass beats 💧 Water</strong>
                  </div>
                </section>

                <section>
                  <h3>Ready?</h3>
                  <p>
                    Pick a base, build up some resources, train an army, and
                    start expanding your empire on... <strong>EXiLE!</strong>
                  </p>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
