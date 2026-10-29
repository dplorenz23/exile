import type { UnitCounts, GameEvent, Player } from "../game/types";

import ResourceDisplay from "./ResourceDisplay";
import UnitIcon from "./UnitIcon";

import { CLASSES, CLASS_COLORS } from "../game/characters";
import type { CharacterClass } from "../game/characters";

interface GameLogProps {
  events: GameEvent[];
  players: Player[];
  characterClassByPlayer: Partial<Record<number, CharacterClass>>;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getCoordinates(row: number, col: number): string {
  const column = String.fromCharCode(65 + col);

  return `${column}${row + 1}`;
}

function formatArmies(armies: UnitCounts) {
  const unitTypes = [
    { key: "guardian", label: "Guardian" },
    { key: "marksman", label: "Marksman" },
    { key: "medic", label: "Medic" },
    { key: "spy", label: "Spy" },
  ] as const;

  const visibleUnits = unitTypes.filter(({ key }) => armies[key] > 0);

  if (visibleUnits.length === 0) {
    return <span>None</span>;
  }

  return (
    <span className="comms-resource-list">
      {visibleUnits.map(({ key, label }) => (
        <span className="comms-resource-item" key={key} title={label}>
          <UnitIcon type={key} size={14} />
          {armies[key]}
        </span>
      ))}
    </span>
  );
}

function formatCompactArmies(armies: UnitCounts) {
  return formatArmies(armies);
}

function getEventSeconds(event: GameEvent): number {
  return event.type === "battle" ? event.report.gameSeconds : event.gameSeconds;
}

/*
 * When multiple events occur during the same second,
 * show Victory → Elimination → Battle at the top of the log.
 */
const eventPriority: Record<GameEvent["type"], number> = {
  victory: 1,
  elimination: 2,
  battle: 3,
  expansion: 3,
  relocation: 3,
  loot: 3,
  transfer: 3,
  "mission-failed": 3,
  "base-upgrade": 3,
};

function getMissionFailureMessage(
  event: Extract<GameEvent, { type: "mission-failed" }>,
  playerName: string,
): string {
  switch (event.reason) {
    case "destination-unavailable":
      return `${playerName}'s ${event.missionType} mission failed because the destination is no longer available.`;

    case "origin-destroyed":
      return `${playerName}'s ${event.missionType} mission was lost because its origin base no longer exists.`;

    case "return-location-blocked":
      return `${playerName}'s ${event.missionType} mission could not return to its original location.`;
  }
}

export default function GameLog({
  events,
  characterClassByPlayer,
}: GameLogProps) {
  function getPlayerName(playerId: number): string {
    const faction = characterClassByPlayer[playerId];

    return faction && CLASSES.includes(faction)
      ? faction.charAt(0).toUpperCase() + faction.slice(1)
      : `Player ${playerId}`;
  }

  function factionLabel(playerId: number, label = getPlayerName(playerId)) {
    const faction = characterClassByPlayer[playerId];
    return (
      <span
        style={
          faction && CLASSES.includes(faction)
            ? { color: CLASS_COLORS[faction] }
            : undefined
        }
      >
        {label}
      </span>
    );
  }

  return (
    <div className="battle-reports">
      <div className="battle-reports-button">
        <span>📡 COMMS</span>
        <span className="battle-reports-count">{events.length} EVENTS</span>
      </div>

      <div className="battle-reports-panel">
        {events.length === 0 ? (
          <div className="battle-report-empty">No game events yet.</div>
        ) : (
          [...events]
            .sort((a, b) => {
              /*
               * Battle events store their timestamp inside
               * report. All other events store it directly.
               */
              const aSeconds = getEventSeconds(a);
              const bSeconds = getEventSeconds(b);

              /*
               * Normal behavior:
               * newest events appear at the top.
               */
              if (aSeconds !== bSeconds) {
                return bSeconds - aSeconds;
              }

              return eventPriority[a.type] - eventPriority[b.type];
            })
            .map((event) => {
              if (event.type === "expansion") {
                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        🏕️ {factionLabel(event.playerId)} established{" "}
                        {event.baseName} at{" "}
                        {getCoordinates(event.row, event.col)}.
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>
                  </div>
                );
              }

              if (event.type === "relocation") {
                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        📦 {factionLabel(event.playerId)} relocated{" "}
                        {event.baseName} from{" "}
                        {getCoordinates(event.fromRow, event.fromCol)} to{" "}
                        {getCoordinates(event.toRow, event.toCol)}.
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>
                  </div>
                );
              }
              if (event.type === "loot") {
                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        💰 {factionLabel(event.playerId)} looted treasure at{" "}
                        {getCoordinates(event.row, event.col)}.
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>

                    <div>
                      Taken:{" "}
                      <ResourceDisplay resources={event.resourcesLooted} />
                    </div>

                    {event.expansionKeysLooted > 0 && (
                      <div>Keys: 🔑{event.expansionKeysLooted}</div>
                    )}

                    <div>
                      Remaining:{" "}
                      <ResourceDisplay resources={event.resourcesRemaining} />
                    </div>
                  </div>
                );
              }

              if (event.type === "transfer") {
                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        🔄 {factionLabel(event.playerId)} transferred from{" "}
                        {event.fromBaseName} to {event.toBaseName}.
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>

                    <div>Armies: {formatArmies(event.armies)}</div>

                    <div>
                      Cargo: <ResourceDisplay resources={event.resources} />
                    </div>
                  </div>
                );
              }

              if (event.type === "elimination") {
                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        ☠️ {factionLabel(event.eliminatedPlayerId)} has been
                        eliminated
                        {event.eliminatedByPlayerId !== undefined ? (
                          <> by {factionLabel(event.eliminatedByPlayerId)}</>
                        ) : null}
                        .
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>
                  </div>
                );
              }

              if (event.type === "base-upgrade") {
                return (
                  <div key={event.id}>
                    {event.baseName} upgraded to Level {event.level}
                  </div>
                );
              }

              if (event.type === "victory") {
                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        🏆 {factionLabel(event.winnerPlayerId)} wins the game.
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>
                  </div>
                );
              }

              if (event.type === "mission-failed") {
                const playerName = getPlayerName(event.playerId);
                const message = getMissionFailureMessage(event, playerName);

                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        ⚠️ {factionLabel(event.playerId)}
                        {message.slice(playerName.length)}
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>
                  </div>
                );
              }

              const report = event.report;

              const countUnits = (armies: UnitCounts): number =>
                armies.guardian + armies.marksman + armies.medic + armies.spy;

              const attackerSent = countUnits(report.attackerArmies);
              const attackerSurvived = countUnits(report.attackerSurvivors);

              const defenderDeployed = countUnits(report.defenderArmies);
              const defenderSurvived = countUnits(report.defenderSurvivors);

              const attackerLost = attackerSent - attackerSurvived;
              const defenderLost = defenderDeployed - defenderSurvived;

              return (
                <details key={report.id} className="battle-report comms-battle">
                  <summary className="comms-battle-summary">
                    <div className="comms-battle-heading">
                      <strong>
                        ⚔️ {factionLabel(report.attackerPlayerId)} →{" "}
                        {factionLabel(report.defenderPlayerId)}
                      </strong>

                      <span className="comms-battle-time">
                        {getCoordinates(report.row, report.col)}
                        {" · "}
                        {formatTime(report.gameSeconds)}
                      </span>
                    </div>

                    <div className="comms-battle-result">
                      <span
                        className={
                          report.baseDestroyed
                            ? "comms-result-destroyed"
                            : "comms-result-defended"
                        }
                      >
                        {report.baseDestroyed ? "💥 Destroyed" : "🛡️ Defended"}
                      </span>

                      <span>
                        Attacker −{attackerLost} · Defender −{defenderLost}
                      </span>
                    </div>
                  </summary>

                  <div className="comms-battle-details">
                    <div className="comms-battle-location">
                      {factionLabel(
                        report.attackerPlayerId,
                        report.attackerBaseName,
                      )}{" "}
                      attacked{" "}
                      {factionLabel(
                        report.defenderPlayerId,
                        report.defenderBaseName,
                      )}
                    </div>

                    <div className="comms-battle-armies">
                      <div className="comms-battle-side">
                        <strong>⚔️ ATTACKER</strong>

                        <div>Sent: {attackerSent}</div>
                        <div>Survived: {attackerSurvived}</div>
                        <div>Lost: {attackerLost}</div>

                        <div className="comms-battle-units">
                          {formatCompactArmies(report.attackerArmies)}
                          {" → "}
                          {formatCompactArmies(report.attackerSurvivors)}
                        </div>
                      </div>

                      <div className="comms-battle-side">
                        <strong>🛡️ DEFENDER</strong>

                        <div>Deployed: {defenderDeployed}</div>
                        <div>Survived: {defenderSurvived}</div>
                        <div>Lost: {defenderLost}</div>

                        <div className="comms-battle-units">
                          {formatCompactArmies(report.defenderArmies)}
                          {" → "}
                          {formatCompactArmies(report.defenderSurvivors)}
                        </div>
                      </div>
                    </div>

                    <div className="comms-battle-footer">
                      <div>
                        Loot taken:{" "}
                        <ResourceDisplay resources={report.resourcesLooted} />
                      </div>

                      <div>
                        {report.baseDestroyed
                          ? "Chest remaining"
                          : "Resources kept"}
                        :{" "}
                        <ResourceDisplay
                          resources={report.resourcesRemaining}
                        />
                      </div>
                    </div>
                  </div>
                </details>
              );
            })
        )}
      </div>
    </div>
  );
}
