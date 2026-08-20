import { useState } from "react";

import type {
  Base,
  ResourceType,
} from "../game/types";

import type { BaseResources } from "../game/gameState";
import { getArmyCost } from "../game/rules";

interface BaseActionsProps {
  base?: Base;
  resources: BaseResources;
  onTrainArmy: (resource: ResourceType) => void;
}

export default function BaseActions({
  base,
  resources,
  onTrainArmy,
}: BaseActionsProps) {
  const [showTrainMenu, setShowTrainMenu] = useState(false);

  if (!base) {
    return null;
  }

  const armyCost = getArmyCost(base.armiesBuilt);

  const isTraining = base.training !== null;

  function canAfford(resource: ResourceType) {
    return resources[resource] >= armyCost;
  }

  function handleTrain(resource: ResourceType) {
    onTrainArmy(resource);
    setShowTrainMenu(false);
  }

  if (isTraining && base.training) {
    return (
      <div className="base-actions">
        <div className="training-status">
          <strong>
            Training{" "}
            {base.training.resource.charAt(0).toUpperCase() +
              base.training.resource.slice(1)}{" "}
            Army
          </strong>

          <span>
            {base.training.secondsRemaining}s remaining
          </span>
        </div>
      </div>
    );
  }

  if (showTrainMenu) {
    return (
      <div className="base-actions train-menu">
        <div className="train-menu-title">
          Train Army — Cost {armyCost}
        </div>

        <button
          className="base-action-button"
          disabled={!canAfford("water")}
          onClick={() => handleTrain("water")}
        >
          💧 Water Army
        </button>

        <button
          className="base-action-button"
          disabled={!canAfford("fire")}
          onClick={() => handleTrain("fire")}
        >
          🔥 Fire Army
        </button>

        <button
          className="base-action-button"
          disabled={!canAfford("grass")}
          onClick={() => handleTrain("grass")}
        >
          🌱 Grass Army
        </button>

        <button
          className="base-action-button"
          onClick={() => setShowTrainMenu(false)}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="base-actions">
      <button
        className="base-action-button"
        onClick={() => setShowTrainMenu(true)}
      >
        ⚔ Train
      </button>

      <button className="base-action-button">
        ➤ Send Army
      </button>

      <button className="base-action-button">
        🗺 Expand
      </button>

      <button className="base-action-button">
        🏕 Relocate
      </button>
    </div>
  );
}