import { useState } from "react";

import type {
  BattleReport,
  Player,
  ResourceType,
} from "../game/types";

interface BattleReportsProps {
  reports: BattleReport[];
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

export default function BattleReports({
  reports,
  players,
}: BattleReportsProps) {
  const [isOpen, setIsOpen] =
    useState(false);

  function getPlayerName(playerId: number) {
    return (
      players.find(
        (player) => player.id === playerId,
      )?.name ?? `Player ${playerId}`
    );
  }

  return (
    <div className="battle-reports">
      <button
        className="battle-reports-button"
        onClick={() =>
          setIsOpen((current) => !current)
        }
      >
        ⚔ Battle Reports
        {reports.length > 0 &&
          ` (${reports.length})`}
      </button>

      {isOpen && (
        <div className="battle-reports-panel">
          {reports.length === 0 ? (
            <div className="battle-report-empty">
              No battles yet.
            </div>
          ) : (
            [...reports]
              .reverse()
              .map((report) => {
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
                        {attacker} attacked{" "}
                        {defender}
                      </strong>

                      <span>
                        {formatTime(
                          report.gameSeconds,
                        )}
                      </span>
                    </div>

                    <div>
                      📍{" "}
                      {getCoordinates(
                        report.row,
                        report.col,
                      )}
                    </div>

                    <div>
                      Attack:{" "}
                      {formatArmies(
                        report.attackerArmies,
                      )}
                    </div>

                    <div>
                      Defense:{" "}
                      {report.defenderArmies.water +
                        report.defenderArmies.fire +
                        report.defenderArmies.grass ===
                      0
                        ? "🛡️ Militia"
                        : `${formatArmies(report.defenderArmies)} + 🛡️ Militia`}
                    </div>

                    <div>
                      Resources Looted:{" "}
                      💧{report.resourcesLooted.water}{" "}
                      🔥{report.resourcesLooted.fire}{" "}
                      🌱{report.resourcesLooted.grass}
                    </div>

                    <div>
                      Resources Remaining:{" "}
                      💧{report.resourcesRemaining.water}{" "}
                      🔥{report.resourcesRemaining.fire}{" "}
                      🌱{report.resourcesRemaining.grass}
                    </div>

                    <div>
                      Survivors:{" "}
                      {formatArmies(
                        report.attackerSurvivors,
                      )}{" "}
                      vs.{" "}
                      {formatArmies(
                        report.defenderSurvivors,
                      )}
                    </div>

                    <strong>
                      {report.baseDestroyed
                        ? `${attacker} destroyed the base.`
                        : `${defender} defended the base.`}
                    </strong>
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}