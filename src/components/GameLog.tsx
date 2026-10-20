import type {
  ArmyCounts,
  GameEvent,
  Player,
  ResourceType,
} from "../game/types";

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

function formatArmies(armies: ArmyCounts): string {
  const parts: string[] = [];

  const armyIcons: Record<ResourceType, string> = {
    water: "⚔️💧",
    fire: "⚔️🔥",
    grass: "⚔️🌱",
  };

  (["water", "fire", "grass"] as ResourceType[]).forEach((resource) => {
    if (armies[resource] > 0) {
      parts.push(`${armyIcons[resource]}${armies[resource]}`);
    }
  });

  return parts.length > 0 ? parts.join(" ") : "None";
}

function formatCompactArmies(armies: ArmyCounts): string {
  const parts: string[] = [];

  if (armies.water > 0) {
    parts.push(`💧${armies.water}`);
  }

  if (armies.fire > 0) {
    parts.push(`🔥${armies.fire}`);
  }

  if (armies.grass > 0) {
    parts.push(`🌱${armies.grass}`);
  }

  return parts.length > 0 ? parts.join(" ") : "—";
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
                      Taken: 💧{event.resourcesLooted.water} 🔥
                      {event.resourcesLooted.fire} 🌱
                      {event.resourcesLooted.grass}
                      {event.expansionKeysLooted > 0 && (
                        <> 🔑{event.expansionKeysLooted}</>
                      )}
                    </div>

                    <div>
                      Remaining: 💧{event.resourcesRemaining.water} 🔥
                      {event.resourcesRemaining.fire} 🌱
                      {event.resourcesRemaining.grass}
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

                    <div>
                      Cargo: 💧{event.resources.water} 🔥{event.resources.fire}{" "}
                      🌱{event.resources.grass}
                    </div>
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

              return (
                <div key={report.id} className="battle-report">
                  <div className="battle-report-header">
                    <strong>
                      {attacker} ({report.attackerBaseName}) attacked {defender}{" "}
                      ({report.defenderBaseName})
                    </strong>

                    <span>
                      {getCoordinates(report.row, report.col)}
                      {" · "}
                      {formatTime(report.gameSeconds)}
                    </span>
                  </div>

                  <div>
                    ⚔️·
                    {formatCompactArmies(report.attackerArmies)}
                    {" → "}
                    {formatCompactArmies(report.attackerSurvivors)}
                    {" | "}
                    {report.defenderArmies.water +
                      report.defenderArmies.fire +
                      report.defenderArmies.grass >
                    0 ? (
                      <>
                        🛡️·
                        {formatCompactArmies(report.defenderArmies)}
                        {" → "}
                        {formatCompactArmies(report.defenderSurvivors)}
                        {" | "}
                      </>
                    ) : null}
                    🧑‍🌾 {report.militiaSurvived ? "→ 🧑‍🌾" : "→ —"}
                  </div>

                  <div>
                    <strong>
                      {report.baseDestroyed
                        ? `💥 ${report.defenderBaseName} destroyed`
                        : `🛡️ ${report.defenderBaseName} defended`}
                    </strong>
                    {" · Loot "}
                    💧{report.resourcesLooted.water} 🔥
                    {report.resourcesLooted.fire} 🌱
                    {report.resourcesLooted.grass}
                    {" · "}
                    {report.baseDestroyed ? "Chest " : "Kept "}
                    💧{report.resourcesRemaining.water} 🔥
                    {report.resourcesRemaining.fire} 🌱
                    {report.resourcesRemaining.grass}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
