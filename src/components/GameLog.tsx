import type {
  ArmyCounts,
  GameEvent,
  Player,
  ResourceType,
} from "../game/types";

import ResourceDisplay from "./ResourceDisplay";

interface GameLogProps {
  events: GameEvent[];
  players: Player[];
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

function ResourceIcon({ type }: { type: ResourceType }) {
  const filenames: Record<ResourceType, string> = {
    water: "water.png",
    fire: "fuel.png",
    grass: "food.png",
  };

  const names: Record<ResourceType, string> = {
    water: "Water",
    fire: "Fuel",
    grass: "Food",
  };

  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/resources/${filenames[type]}`}
      alt={names[type]}
      title={names[type]}
      className="comms-resource-icon"
    />
  );
}

function formatArmies(armies: ArmyCounts) {
  return (
    <span className="comms-resource-list">
      {(["water", "fire", "grass"] as ResourceType[]).map((resource) =>
        armies[resource] > 0 ? (
          <span className="comms-resource-item" key={resource}>
            <ResourceIcon type={resource} />
            {armies[resource]}
          </span>
        ) : null,
      )}
    </span>
  );
}

function formatCompactArmies(armies: ArmyCounts) {
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

export default function GameLog({ events, players }: GameLogProps) {
  function getPlayerName(playerId: number): string {
    return (
      players.find((player) => player.id === playerId)?.name ??
      `Player ${playerId}`
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
                const playerName = getPlayerName(event.playerId);

                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        🏕️ {playerName} established {event.baseName} at{" "}
                        {getCoordinates(event.row, event.col)}.
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>
                  </div>
                );
              }

              if (event.type === "relocation") {
                const playerName = getPlayerName(event.playerId);

                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        📦 {playerName} relocated {event.baseName} from{" "}
                        {getCoordinates(event.fromRow, event.fromCol)} to{" "}
                        {getCoordinates(event.toRow, event.toCol)}.
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>
                  </div>
                );
              }
              if (event.type === "loot") {
                const playerName = getPlayerName(event.playerId);

                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        💰 {playerName} looted treasure at{" "}
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
                const playerName = getPlayerName(event.playerId);

                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        🔄 {playerName} transferred from {event.fromBaseName} to{" "}
                        {event.toBaseName}.
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>

                    <div>Armies: {formatArmies(event.armies)}</div>

                    <div>Cargo: {formatArmies(event.resources)}</div>
                  </div>
                );
              }

              if (event.type === "elimination") {
                const eliminatedName = getPlayerName(event.eliminatedPlayerId);

                const eliminatedByName =
                  event.eliminatedByPlayerId !== undefined
                    ? getPlayerName(event.eliminatedByPlayerId)
                    : undefined;

                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>
                        ☠️ {eliminatedName} has been eliminated
                        {eliminatedByName ? ` by ${eliminatedByName}` : ""}.
                      </strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>
                  </div>
                );
              }

              if (event.type === "victory") {
                const winnerName = getPlayerName(event.winnerPlayerId);

                return (
                  <div key={event.id} className="battle-report">
                    <div className="battle-report-header">
                      <strong>🏆 {winnerName} wins the game.</strong>

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
                      <strong>⚠️ {message}</strong>

                      <span>{formatTime(event.gameSeconds)}</span>
                    </div>
                  </div>
                );
              }

              const report = event.report;

              const attacker = getPlayerName(report.attackerPlayerId);

              const defender = getPlayerName(report.defenderPlayerId);

              const attackerSent =
                report.attackerArmies.water +
                report.attackerArmies.fire +
                report.attackerArmies.grass;

              const attackerSurvived =
                report.attackerSurvivors.water +
                report.attackerSurvivors.fire +
                report.attackerSurvivors.grass;

              const defenderDeployed =
                report.defenderArmies.water +
                report.defenderArmies.fire +
                report.defenderArmies.grass;

              const defenderSurvived =
                report.defenderSurvivors.water +
                report.defenderSurvivors.fire +
                report.defenderSurvivors.grass;

              const attackerLost = attackerSent - attackerSurvived;
              const defenderLost = defenderDeployed - defenderSurvived;

              return (
                <details key={report.id} className="battle-report comms-battle">
                  <summary className="comms-battle-summary">
                    <div className="comms-battle-heading">
                      <strong>
                        ⚔️ {attacker} → {defender}
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
                      {report.attackerBaseName} attacked{" "}
                      {report.defenderBaseName}
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
                        🧑‍🌾 Militia:{" "}
                        {report.militiaSurvived ? "Survived" : "Eliminated"}
                      </div>

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
