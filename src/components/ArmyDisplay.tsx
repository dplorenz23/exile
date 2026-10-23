import type { ArmyCounts } from "../game/types";

interface ArmyDisplayProps {
  armies: ArmyCounts;
}

export default function ArmyDisplay({ armies }: ArmyDisplayProps) {
  const armyTypes = [
    { key: "water", image: "water.png", label: "Water" },
    { key: "fire", image: "fuel.png", label: "Fuel" },
    { key: "grass", image: "food.png", label: "Food" },
  ] as const;

  const visibleArmies = armyTypes.filter(({ key }) => armies[key] > 0);

  if (visibleArmies.length === 0) {
    return <span>None</span>;
  }

  return (
    <span className="resource-display">
      {visibleArmies.map(({ key, image, label }) => (
        <span className="resource-display-item" key={key}>
          <img
            src={`${import.meta.env.BASE_URL}assets/resources/${image}`}
            alt={`${label} Army`}
            title={`${label} Army`}
          />
          {armies[key]}
        </span>
      ))}
    </span>
  );
}
