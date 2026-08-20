import type {
  ArmyMission,
  Base,
} from "../game/types";

interface ArmyMovementsProps {
  missions: ArmyMission[];
  bases: Base[];
}

export default function ArmyMovements({
  missions,
  bases,
}: ArmyMovementsProps) {
  if (missions.length === 0) {
    return null;
  }

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
    <div className="army-movement-header">
      <span>
        {getBaseName(mission.originBaseId)}
        {" → "}
        {getBaseName(mission.destinationBaseId)}
      </span>

      <strong>
        {mission.secondsRemaining}s
      </strong>
    </div>

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