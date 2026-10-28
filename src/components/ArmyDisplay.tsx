import type { UnitCounts } from "../game/types";
import UnitIcon from "./UnitIcon";

interface ArmyDisplayProps {
  armies: UnitCounts;
}

export default function ArmyDisplay({ armies }: ArmyDisplayProps) {
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
    <span className="resource-display">
      {visibleUnits.map(({ key, label }) => (
        <span className="resource-display-item" key={key} title={label}>
          <UnitIcon type={key} size={16} />
          {armies[key]}
        </span>
      ))}
    </span>
  );
}
