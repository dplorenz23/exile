import type {
  ArmyMission,
  Base,
} from "../game/types";

interface ArmyMovementsProps {
  missions: ArmyMission[];
  bases: Base[];
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
    mission.type === "transfer"
  ) {
    return "Army Transferring";
  }

  return "Army Moving";
}

export default function ArmyMovements({
  missions,
  bases,
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
  function getBaseName(baseId: number) {
    const baseIndex = bases.findIndex(
      (base) => base.id === baseId,
    );

    return baseIndex >= 0
      ? `Base ${baseIndex + 1}`
      : "Unknown Base";
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
              {mission.phase === "returning"
                ? getBaseName(mission.destinationBaseId)
                : getBaseName(mission.originBaseId)}

              {" → "}

              {mission.phase === "returning"
                ? getBaseName(mission.originBaseId)
                : getBaseName(mission.destinationBaseId)}
            </span>

            <strong>
              {mission.secondsRemaining}s
            </strong>
          </div>

          {/* Armies and carried resources */}
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
          </div>
        </div>
      ))}
    </div>
  );
}