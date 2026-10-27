import type { UnitCounts } from "../game/types";

interface ArmyDisplayProps {
  armies: UnitCounts;
}

export default function ArmyDisplay({ armies }: ArmyDisplayProps) {
  const armyTypes = [
    { key: "guardian", label: "Guardian" },
    { key: "marksman", label: "Marksman" },
    { key: "medic", label: "Medic" },
    { key: "spy", label: "Spy" },
  ] as const;

  const visibleArmies = armyTypes.filter(({ key }) => armies[key] > 0);

  if (visibleArmies.length === 0) {
    return <span>None</span>;
  }

  return (
    <span className="resource-display">
      {visibleArmies.map(({ key, label }) => (
        <span className="resource-display-item" key={key}>
          <span title={label}>{label}</span>
          {armies[key]}
        </span>
      ))}
    </span>
  );
}
