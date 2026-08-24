import { getBaseName } from "../game/gameState";

import type {
  ArmyMission,
  Base,
  Treasure,
} from "../game/types";

interface ArmyMovementsProps {
  missions: ArmyMission[];
  bases: Base[];
  treasures: Treasure[];
}

/*
 * ============================================================
 * MISSION LABELS
 * ============================================================
 *
 * Gives each traveling mission a clear human-readable status.
 */
function getMissionLabel(mission: ArmyMission) {
  if (
    mission.type === "attack" &&
    mission.phase === "outbound"
  ) {
    return "Army Attacking";
  }

  if (
    mission.type === "attack" &&
    mission.phase === "returning"
  ) {
    return "Army Returning";
  }

  if (
      mission.type === "loot" &&
      mission.phase === "outbound"
    ) {
      return "Army Looting";
    }

    if (
      mission.type === "loot" &&
      mission.phase === "returning"
    ) {
      return "Army Returning";
    }

  if (
      mission.type === "transfer" &&
      mission.phase === "outbound"
    ) {
      return "Army Transferring";
    }

    if (
      mission.type === "transfer" &&
      mission.phase === "returning"
    ) {
      return "Army Returning";
    }

  if (
    mission.type === "expand" &&
    mission.phase === "outbound"
  ) {
    return "Settlers Expanding";
  }

  if (
      mission.type === "expand" &&
      mission.phase === "returning"
    ) {
      return "Settlers Returning";
    }

  if (
      mission.type === "relocate" &&
      mission.phase === "outbound"
    ) {
      return "📦 Base Relocating";
    }

    if (
      mission.type === "relocate" &&
      mission.phase === "returning"
    ) {
      return "📦 Base Returning";
    }

  return "Army Moving";
}

export default function ArmyMovements({
  missions,
  bases,
  treasures,
}: ArmyMovementsProps) {
  /*
   * Hide the entire panel when nothing is moving.
   */
  if (missions.length === 0) {
    return null;
  }

  /*
   * Convert a base ID into the player's local
   * Base 1 / Base 2 / Base 3 naming.
   *
   * Enemy bases may show as Unknown Base for now
   * because this component currently receives only
   * the local player's bases.
   */
  function getMissionBaseName(
    baseId: number,
  ) {
    const base = bases.find(
      (base) => base.id === baseId,
    );

    if (!base) {
      return "Unknown Base";
    }

    return getBaseName(
      base.playerId,
      base.baseSlot,
    );
  }

  function getCoordinateName(
    row?: number,
    col?: number,
  ) {
    if (
      row === undefined ||
      col === undefined
    ) {
      return "Unknown Location";
    }

    const column =
      String.fromCharCode(65 + col);

    return `${column}${row + 1}`;
  }

  function getTreasureName(treasureId: number) {
    const treasure = treasures.find(
      (treasure) => treasure.id === treasureId,
    );

    if (!treasure) {
      return "Treasure";
    }

    const column =
      String.fromCharCode(65 + treasure.col);

    return `Treasure at ${column}${treasure.row + 1}`;
  }

  return (
    <div className="army-movements">
      <strong>Armies Moving</strong>

      {missions.map((mission) => (
        <div
          key={mission.id}
          className="army-movement"
        >
          {/* Attack / Return / Transfer */}
          <div className="army-movement-status">
            {getMissionLabel(mission)}
          </div>

          {/* Origin, destination, and timer */}
          <div className="army-movement-header">
            <span>
              {mission.type === "relocate"
                ? mission.phase === "returning"
                  ? getCoordinateName(
                      mission.destinationRow,
                      mission.destinationCol,
                    )
                  : getMissionBaseName(
                     mission.originBaseId,
                    )
                : mission.type === "expand"
                  ? mission.phase === "returning"
                    ? getCoordinateName(
                        mission.destinationRow,
                        mission.destinationCol,
                      )
                    : getMissionBaseName(
                        mission.originBaseId,
                      )
                  : mission.phase === "returning"
                    ? mission.type === "loot"
                      ? getTreasureName(
                          mission.destinationBaseId,
                        )
                      : getMissionBaseName(
                          mission.destinationBaseId,
                        )
                    : getMissionBaseName(
                        mission.originBaseId,
                      )}

              {" → "}

              {mission.type === "relocate"
                ? mission.phase === "returning"
                  ? getMissionBaseName(
                      mission.originBaseId,
                    )
                  : getCoordinateName(
                      mission.destinationRow,
                      mission.destinationCol,
                    )
                : mission.type === "expand"
                  ? mission.phase === "returning"
                    ? getMissionBaseName(
                        mission.originBaseId,
                      )
                    : getCoordinateName(
                        mission.destinationRow,
                        mission.destinationCol,
                      )
                  : mission.phase === "returning"
                    ? getMissionBaseName(
                        mission.originBaseId,
                      )
                    : mission.type === "loot"
                      ? getTreasureName(
                          mission.destinationBaseId,
                        )
                      : getMissionBaseName(
                          mission.destinationBaseId,
                        )}
            </span>

            <strong>
              {mission.secondsRemaining}s
            </strong>
          </div>

          {/* Armies, cargo, and Expansion Keys in transit */}
          <div className="army-movement-details">
            <div>
              <span className="movement-label">
                Armies
              </span>

              <span>
                ⚔️💧{mission.armies.water}{" "}
                ⚔️🔥{mission.armies.fire}{" "}
                ⚔️🌱{mission.armies.grass}
              </span>
            </div>

            <div>
              <span className="movement-label">
                Cargo
              </span>

              <span>
                💧{mission.resources.water}{" "}
                🔥{mission.resources.fire}{" "}
                🌱{mission.resources.grass}
              </span>
            </div>

            {mission.expansionKeys > 0 && (
              <div>
                <span className="movement-label">
                  Keys
                </span>

                <span>
                  🔑{mission.expansionKeys}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

