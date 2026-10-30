import { useState } from "react";

import { Swords, Wrench, Wheat, FlaskConical } from "lucide-react";

import { maps } from "../game/gameState";

import type { LobbySlot, MatchConfig, Player, MatchType } from "../game/types";

import type { CharacterClass } from "../game/characters";
import { CLASSES, CLASS_COLORS } from "../game/characters";

import HowToPlay from "./HowToPlay";

const FACTION_ICONS = {
  soldier: Swords,
  engineer: Wrench,
  farmer: Wheat,
  scientist: FlaskConical,
};

const FACTION_BONUSES: Record<
  CharacterClass,
  { startingBonus: string; effect: string }
> = {
  soldier: {
    startingBonus: "Permanent Military Bonus",
    effect: "+15% unit attack and max HP",
  },
  engineer: {
    startingBonus: "Starts with Outpost (Lvl 2)",
    effect: "2× starting base production",
  },
  farmer: {
    startingBonus: "Permanent Production Bonus",
    effect: "+15% resource production",
  },
  scientist: {
    startingBonus: "Permanent Efficiency Bonus",
    effect: "−15% training and research costs",
  },
};

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

  onRemoveBot: (botClientId: number) => void;

  onSelectCharacter: (characterClass: CharacterClass) => void;
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
  onLeaveSlot,
  roomCode,
  onAddBot,
  onRemoveBot,
  onSelectCharacter,
}: LobbyProps) {
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const mySlot = slots.find(
    (slot) => slot.clientId === myClientId && !slot.isBot,
  );

  function handleClassSelection(characterClass: CharacterClass): void {
    if (!mySlot || mySlot.isReady) return;

    const taken = slots.some(
      (slot) =>
        slot.clientId !== myClientId && slot.characterClass === characterClass,
    );

    if (!taken) onSelectCharacter(characterClass);
  }

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
          <div className="room-entry-brand">
            <img
              src={`${import.meta.env.BASE_URL}assets/exile-small-logo.png`}
              alt="EXiLE volcano logo"
              className="room-entry-brand-icon"
            />

            <div className="room-entry-brand-text">
              <span className="room-entry-studio">ANKLE DEEP GAMES</span>
              <span className="room-entry-logo">EXiLE</span>
            </div>
          </div>

          <div className="lobby-header-actions">
            <div className="lobby-room-code">
              <span>ROOM</span>
              <strong>{roomCode}</strong>
            </div>

            {mySlot && (
              <button
                type="button"
                className="lobby-header-leave"
                onClick={() => onLeaveSlot(mySlot.slotId)}
              >
                Leave
              </button>
            )}
          </div>
        </div>

        <div className="lobby-character-builder">
          <div className="lobby-builder-heading">
            <div>
              <span className="lobby-builder-eyebrow">CHARACTER CREATION</span>
              <h2>
                {mySlot?.characterClass
                  ? "CHOOSE YOUR FACTION"
                  : "CHOOSE YOUR FACTION"}
              </h2>
            </div>
          </div>

          <div className="lobby-character-grid">
            {CLASSES.map((characterClass) => {
              const FactionIcon = FACTION_ICONS[characterClass];
              const isSelected = mySlot?.characterClass === characterClass;
              const taken = slots.some(
                (slot) =>
                  slot.clientId !== myClientId &&
                  slot.characterClass === characterClass,
              );

              return (
                <div
                  key={characterClass}
                  className={`lobby-character-card ${
                    isSelected ? "lobby-character-card-selected" : ""
                  } ${taken ? "lobby-character-taken" : ""}`}
                  style={
                    {
                      borderColor: CLASS_COLORS[characterClass],
                      "--faction-color": CLASS_COLORS[characterClass],
                    } as React.CSSProperties
                  }
                >
                  <div className="lobby-character-art">
                    <FactionIcon
                      size={100}
                      strokeWidth={1.3}
                      color={CLASS_COLORS[characterClass]}
                    />
                  </div>

                  <div className="lobby-character-details">
                    <h3 className="lobby-faction-heading">
                      <FactionIcon size={19} strokeWidth={2.3} />
                      {characterClass.toUpperCase()}
                    </h3>

                    <div className="lobby-faction-bonus">
                      <strong>
                        {FACTION_BONUSES[characterClass].startingBonus}
                      </strong>
                      <span>{FACTION_BONUSES[characterClass].effect}</span>
                    </div>

                    {isSelected ? (
                      <span className="lobby-selected-badge">SELECTED</span>
                    ) : (
                      <button
                        type="button"
                        disabled={taken || !mySlot || mySlot.isReady}
                        onClick={() => handleClassSelection(characterClass)}
                      >
                        {taken ? "Taken" : "Choose Faction"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="lobby-management-row">
          <div className="lobby-players-column">
            <div className="lobby-section-title">Players</div>

            <div className="lobby-slots">
              {displaySlots.map((slot) => {
                const player =
                  slot.playerId !== null
                    ? players.find((player) => player.id === slot.playerId)
                    : undefined;

                console.log("Lobby slots:", slots);

                return (
                  <div
                    key={slot.slotId}
                    className={`lobby-slot ${slot.isReady ? "lobby-slot-ready" : ""}`}
                  >
                    {player ? (
                      <>
                        <div className="lobby-player-identity">
                          <strong
                            style={{
                              color: slot.characterClass
                                ? CLASS_COLORS[slot.characterClass]
                                : undefined,
                            }}
                          >
                            {slot.characterClass
                              ? slot.characterClass.charAt(0).toUpperCase() +
                                slot.characterClass.slice(1)
                              : "Choosing Faction"}

                            {slot.isBot && (
                              <span className="lobby-bot-badge"> BOT</span>
                            )}
                          </strong>

                          {slot.isHost && (
                            <span className="lobby-host-badge">👑 Host</span>
                          )}
                        </div>

                        <span className="lobby-player-status">
                          {slot.isReady ? "✓ Ready" : "Not Ready"}
                        </span>

                        {isCurrentClientHost &&
                          slot.isBot &&
                          slot.clientId !== undefined && (
                            <button
                              className="lobby-leave-button"
                              onClick={() => onRemoveBot(slot.clientId!)}
                            >
                              Remove Bot
                            </button>
                          )}
                      </>
                    ) : (
                      <div className="lobby-empty-slot">
                        <strong>Open Seat</strong>
                        {isCurrentClientHost && (
                          <button onClick={onAddBot}>Add Bot</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lobby-settings-column">
            <div className="lobby-section-title">Game Settings</div>
            <div className="lobby-settings">
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
              type="button"
              className="lobby-ready-button"
              disabled={!mySlot || (!mySlot.isReady && !mySlot.characterClass)}
              onClick={() => {
                if (mySlot) {
                  onToggleReady(mySlot.slotId);
                }
              }}
            >
              {mySlot?.isReady ? "Not Ready" : "Ready Up"}
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
