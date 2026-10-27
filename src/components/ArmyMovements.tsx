import { getBaseName } from "../game/gameState";

import type { ArmyMission, Base, Treasure } from "../game/types";

import ResourceDisplay from "./ResourceDisplay";

import ArmyDisplay from "./ArmyDisplay";

import { BALANCE } from "../game/balance";

interface ArmyMovementsProps {
  missions: ArmyMission[];
  bases: Base[];
  treasures: Treasure[];
}

/*
 * Gives each traveling mission a clear human-readable status.
 */
function getMissionLabel(mission: ArmyMission): string {
  if (mission.type === "attack") {
    return mission.phase === "outbound" ? "Army Attacking" : "Army Returning";
  }

  if (mission.type === "loot") {
    return mission.phase === "outbound" ? "Army Looting" : "Army Returning";
  }

  if (mission.type === "transfer") {
    return mission.phase === "outbound"
      ? "Army Transferring"
      : "Army Returning";
  }

  if (mission.type === "expand") {
    return mission.phase === "outbound"
      ? "Settlers Expanding"
      : "Settlers Returning";
  }

  if (mission.type === "relocate") {
    return mission.phase === "outbound"
      ? "📦 Base Relocating"
      : "📦 Base Returning";
  }

  return "Army Moving";
}

export default function ArmyMovements({
  missions,
  bases,
  treasures,
}: ArmyMovementsProps) {
  function getMissionBaseName(baseId: number): string {
    const base = bases.find((base) => base.id === baseId);

    if (!base) {
      return "Unknown Base";
    }

    return getBaseName(base.playerId, base.baseSlot);
  }

  function getCoordinateName(row?: number, col?: number): string {
    if (row === undefined || col === undefined) {
      return "Unknown Location";
    }

    const column = String.fromCharCode(65 + col);

    return `${column}${row + 1}`;
  }

  /*
   * Loot missions store the target treasure ID in destinationBaseId.
   * This keeps the shared mission shape consistent across mission types.
   */
  function getTreasureName(treasureId: number): string {
    const treasure = treasures.find((treasure) => treasure.id === treasureId);

    if (!treasure) {
      return "Treasure";
    }

    const column = String.fromCharCode(65 + treasure.col);

    return `Treasure at ${column}${treasure.row + 1}`;
  }

  function getMissionOrigin(mission: ArmyMission): string {
    if (mission.type === "relocate" || mission.type === "expand") {
      return mission.phase === "returning"
        ? getCoordinateName(mission.destinationRow, mission.destinationCol)
        : getMissionBaseName(mission.originBaseId);
    }

    if (mission.phase === "returning") {
      return mission.type === "loot"
        ? getTreasureName(mission.destinationBaseId)
        : getMissionBaseName(mission.destinationBaseId);
    }

    return getMissionBaseName(mission.originBaseId);
  }

  function getMissionDestination(mission: ArmyMission): string {
    if (mission.type === "relocate" || mission.type === "expand") {
      return mission.phase === "returning"
        ? getMissionBaseName(mission.originBaseId)
        : getCoordinateName(mission.destinationRow, mission.destinationCol);
    }

    if (mission.phase === "returning") {
      return getMissionBaseName(mission.originBaseId);
    }

    return mission.type === "loot"
      ? getTreasureName(mission.destinationBaseId)
      : getMissionBaseName(mission.destinationBaseId);
  }

  return (
    <div className="army-movements">
      <div className="army-movements-title">
        <span>📡 DEPLOYMENTS</span>
        <span className="army-movements-count">
          {missions.length} / {BALANCE.missions.maxActivePerPlayer} ACTIVE
        </span>
      </div>
      {missions.length === 0 && (
        <div className="army-movements-empty">No active deployments</div>
      )}
      {missions.map((mission) => (
        <div
          key={mission.id}
          className={[
            "army-movement",
            `army-movement--${mission.phase}`,
            `army-movement--${mission.type}`,
          ].join(" ")}
        >
          <div className="army-movement-status-row">
            <span className="army-movement-status">
              {getMissionLabel(mission)}
            </span>

            <strong className="army-movement-timer">
              {mission.secondsRemaining}s
            </strong>
          </div>

          <div className="army-movement-route">
            {getMissionOrigin(mission)}
            {" → "}
            {getMissionDestination(mission)}
          </div>

          <div className="army-movement-summary">
            {(mission.armies.guardian > 0 ||
              mission.armies.marksman > 0 ||
              mission.armies.medic > 0 ||
              mission.armies.spy > 0) && (
              <ArmyDisplay armies={mission.armies} />
            )}

            {(mission.resources.water > 0 ||
              mission.resources.fire > 0 ||
              mission.resources.grass > 0) && (
              <span>
                Cargo: <ResourceDisplay resources={mission.resources} />
              </span>
            )}

            {mission.expansionKeys > 0 && (
              <span>Keys: 🔑{mission.expansionKeys}</span>
            )}

            {mission.armies.guardian === 0 &&
              mission.armies.marksman === 0 &&
              mission.armies.medic === 0 &&
              mission.armies.spy === 0 &&
              mission.resources.water === 0 &&
              mission.resources.fire === 0 &&
              mission.resources.grass === 0 &&
              mission.expansionKeys === 0 && <span>None</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
