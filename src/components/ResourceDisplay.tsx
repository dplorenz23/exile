import type { ResourceCounts } from "../game/types";

interface ResourceDisplayProps {
  resources: ResourceCounts;
}

export default function ResourceDisplay({ resources }: ResourceDisplayProps) {
  const resourceTypes = [
    { key: "water", image: "water.png", label: "Water" },
    { key: "fire", image: "fuel.png", label: "Fuel" },
    { key: "grass", image: "food.png", label: "Food" },
  ] as const;

  const visibleResources = resourceTypes.filter(
    ({ key }) => resources[key] > 0,
  );

  if (visibleResources.length === 0) {
    return <span>None</span>;
  }

  return (
    <span className="resource-display">
      {visibleResources.map(({ key, image, label }) => (
        <span className="resource-display-item" key={key}>
          <img
            src={`${import.meta.env.BASE_URL}assets/resources/${image}`}
            alt={label}
            title={label}
          />
          {Math.floor(resources[key])}
        </span>
      ))}
    </span>
  );
}
