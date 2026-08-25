import type {
  GameEvent,
  Player,
  ResourceType,
} from "../game/types";

interface GameLogProps {
  events: GameEvent[];
  players: Player[];
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

function getCoordinates(
  row: number,
  col: number,
) {
  const column =
    String.fromCharCode(65 + col);

  return `${column}${row + 1}`;
}

function formatArmies(
  armies: {
    water: number;
    fire: number;
    grass: number;
  },
) {
  const parts: string[] = [];

  const armyIcons: Record<
    ResourceType,
    string
  > = {
    water: "⚔️💧",
    fire: "⚔️🔥",
    grass: "⚔️🌱",
  };

  (
    ["water", "fire", "grass"] as ResourceType[]
  ).forEach((resource) => {
    if (armies[resource] > 0) {
      parts.push(
        `${armyIcons[resource]}${armies[resource]}`,
      );
    }
  });

  return parts.length > 0
    ? parts.join(" ")
    : "None";
}

function formatCompactArmies(
  armies: {
    water: number;
    fire: number;
    grass: number;
  },
) {
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

  return parts.length > 0
    ? parts.join(" ")
    : "—";
}

export default function GameLog({
  events,
  players,
}: GameLogProps) {

  function getPlayerName(playerId: number) {
    return (
      players.find(
        (player) => player.id === playerId,
      )?.name ?? `Player ${playerId}`
    );
  }

  return (
    <div className="battle-reports">
      <div className="battle-reports-button">
          📜 Game Log
          {events.length > 0 &&
            ` (${events.length})`}
        </div>

        <div className="battle-reports-panel">
          {events.length === 0 ? (
            <div className="battle-report-empty">
              No game events yet.
            </div>
          ) : (
            [...events]
              .sort((a, b) => {
                /*
                 * Battle events store their timestamp inside
                 * report. All other events store it directly.
                 */
                const aSeconds =
                  a.type === "battle"
                    ? a.report.gameSeconds
                    : a.gameSeconds;

                const bSeconds =
                  b.type === "battle"
                    ? b.report.gameSeconds
                    : b.gameSeconds;

                /*
                 * Normal behavior:
                 * newest events appear at the top.
                 */
                if (aSeconds !== bSeconds) {
                  return bSeconds - aSeconds;
                }

                /*
                 * Only when events occurred during the SAME
                 * second do we apply a special display order.
                 *
                 * Chronologically:
                 * Battle → Elimination → Victory
                 *
                 * Since the Game Log displays newest first:
                 * Victory → Elimination → Battle
                 */
                const eventPriority = {
                  victory: 1,
                  elimination: 2,
                  battle: 3,

                  expansion: 3,
                  relocation: 3,
                  loot: 3,
                  transfer: 3,
                };

                return (
                  eventPriority[a.type] -
                  eventPriority[b.type]
                );
              })
              .map((event) => {
                if (event.type === "expansion") {
                  const playerName =
                    getPlayerName(event.playerId);

                  return (
                    <div
                      key={event.id}
                      className="battle-report"
                    >
                      <div className="battle-report-header">
                        <strong>
                          🏕️ {playerName} established{" "}
                          {event.baseName} at{" "}
                          {getCoordinates(
                            event.row,
                            event.col,
                          )}.
                        </strong>

                        <span>
                          {formatTime(
                            event.gameSeconds,
                          )}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (event.type === "relocation") {
                  const playerName =
                    getPlayerName(event.playerId);

                  return (
                    <div
                      key={event.id}
                      className="battle-report"
                    >
                      <div className="battle-report-header">
                        <strong>
                          📦 {playerName} relocated{" "}
                          {event.baseName} from{" "}
                          {getCoordinates(
                            event.fromRow,
                            event.fromCol,
                          )}{" "}
                          to{" "}
                          {getCoordinates(
                            event.toRow,
                            event.toCol,
                          )}.
                        </strong>

                        <span>
                          {formatTime(
                            event.gameSeconds,
                          )}
                        </span>
                      </div>
                    </div>
                  );
                }
                if (event.type === "loot") {
                  const playerName =
                    getPlayerName(event.playerId);

                  return (
                    <div
                      key={event.id}
                      className="battle-report"
                    >
                      <div className="battle-report-header">
                        <strong>
                          💰 {playerName} looted treasure at{" "}
                          {getCoordinates(
                            event.row,
                            event.col,
                          )}.
                        </strong>

                        <span>
                          {formatTime(
                            event.gameSeconds,
                          )}
                        </span>
                      </div>

                      <div>
                        Taken:{" "}
                        💧{event.resourcesLooted.water}{" "}
                        🔥{event.resourcesLooted.fire}{" "}
                        🌱{event.resourcesLooted.grass}
                      </div>

                      <div>
                        Remaining:{" "}
                        💧{event.resourcesRemaining.water}{" "}
                        🔥{event.resourcesRemaining.fire}{" "}
                        🌱{event.resourcesRemaining.grass}
                      </div>
                    </div>
                  );
                }

                if (event.type === "transfer") {
                  const playerName =
                    getPlayerName(event.playerId);

                  return (
                    <div
                      key={event.id}
                      className="battle-report"
                    >
                      <div className="battle-report-header">
                        <strong>
                          🔄 {playerName} transferred from{" "}
                          {event.fromBaseName} to{" "}
                          {event.toBaseName}.
                        </strong>

                        <span>
                          {formatTime(
                            event.gameSeconds,
                          )}
                        </span>
                      </div>

                      <div>
                        Armies:{" "}
                        {formatArmies(
                          event.armies,
                        )}
                      </div>

                      <div>
                        Cargo:{" "}
                        💧{event.resources.water}{" "}
                        🔥{event.resources.fire}{" "}
                        🌱{event.resources.grass}
                      </div>
                    </div>
                  );
                }

                if (event.type === "elimination") {
                  const eliminatedName =
                    getPlayerName(
                      event.eliminatedPlayerId,
                    );

                  const eliminatedByName =
                    event.eliminatedByPlayerId !== undefined
                      ? getPlayerName(
                          event.eliminatedByPlayerId,
                        )
                      : undefined;

                  return (
                    <div
                      key={event.id}
                      className="battle-report"
                    >
                      <div className="battle-report-header">
                        <strong>
                          ☠️ {eliminatedName} has been eliminated
                          {eliminatedByName
                            ? ` by ${eliminatedByName}`
                            : ""}.
                        </strong>

                        <span>
                          {formatTime(
                            event.gameSeconds,
                          )}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (event.type === "victory") {
                  const winnerName =
                    getPlayerName(
                      event.winnerPlayerId,
                    );

                  return (
                    <div
                      key={event.id}
                      className="battle-report"
                    >
                      <div className="battle-report-header">
                        <strong>
                          🏆 {winnerName} wins the game.
                        </strong>

                        <span>
                          {formatTime(
                            event.gameSeconds,
                          )}
                        </span>
                      </div>
                    </div>
                  );
                }

                const report =
                  event.report;

                const attacker =
                  getPlayerName(
                    report.attackerPlayerId,
                  );

                const defender =
                  getPlayerName(
                    report.defenderPlayerId,
                  );

                return (
                  <div
                    key={report.id}
                    className="battle-report"
                  >
                    <div className="battle-report-header">
                      <strong>
                        {attacker} ({report.attackerBaseName}) attacked{" "}
                        {defender} ({report.defenderBaseName})
                      </strong>

                      <span>
                        {getCoordinates(report.row, report.col)}
                        {" · "}
                        {formatTime(report.gameSeconds)}
                      </span>
                    </div>

                    <div>
                      ⚔️·
                      {formatCompactArmies(
                        report.attackerArmies,
                      )}
                      {" → "}
                      {formatCompactArmies(
                        report.attackerSurvivors,
                      )}

                      {" | "}

                      {report.defenderArmies.water +
                        report.defenderArmies.fire +
                        report.defenderArmies.grass >
                      0 ? (
                        <>
                          🛡️·
                          {formatCompactArmies(
                            report.defenderArmies,
                          )}
                          {" → "}
                          {formatCompactArmies(
                            report.defenderSurvivors,
                          )}
                          {" | "}
                        </>
                      ) : null}

                      🧑‍🌾{" "}
                      {report.militiaSurvived
                        ? "→ 🧑‍🌾"
                        : "→ —"}
                    </div>

                    <div>
                      <strong>
                        {report.baseDestroyed
                          ? `💥 ${report.defenderBaseName} destroyed`
                          : `🛡️ ${report.defenderBaseName} defended`}
                      </strong>

                      {" · Loot "}
                      💧{report.resourcesLooted.water}{" "}
                      🔥{report.resourcesLooted.fire}{" "}
                      🌱{report.resourcesLooted.grass}

                      {" · "}
                        {report.baseDestroyed
                          ? "Chest "
                          : "Kept "}
                        💧{report.resourcesRemaining.water}{" "}
                        🔥{report.resourcesRemaining.fire}{" "}
                        🌱{report.resourcesRemaining.grass}
                    </div>
                  </div>
                );
              })
          )}
        </div>
    </div>
  );
}