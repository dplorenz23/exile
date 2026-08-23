import { useState } from "react";

import type {
  ArmyCounts,
  Base,
  ResourceType,
} from "../game/types";

import type { BaseResources } from "../game/gameState";
import { getArmyCost } from "../game/rules";

interface BaseActionsProps {
  base?: Base;
  resources: BaseResources;
  ownedBases: Base[];
  enemyBases: Base[];
  expansionKeys: number;

  onTrainArmy: (resource: ResourceType) => void;

  onTransferArmies: (
    destinationBaseId: number,
    armies: ArmyCounts,
    resources: BaseResources,
  ) => void;

  onAttackArmies: (
    destinationBaseId: number,
    armies: ArmyCounts,
  ) => void;

  onStartAttackTargeting: (
    armies: ArmyCounts,
  ) => void;

  onStartLootTargeting: (
    armies: ArmyCounts,
  ) => void;

  onStartExpandTargeting: (
    payment: BaseResources,
  ) => void;

  onStartTransferTargeting: (
    armies: ArmyCounts,
    resources: BaseResources,
  ) => void;

}

export default function BaseActions({
  base,
  resources,
  ownedBases,
  enemyBases,
  expansionKeys,
  onTrainArmy,
  onTransferArmies,
  onAttackArmies,
  onStartAttackTargeting,
  onStartLootTargeting,
  onStartExpandTargeting,
  onStartTransferTargeting,
}: BaseActionsProps) {
  const [mode, setMode] = useState<
    | "main"
    | "train"
    | "mission"
    | "attack-armies"
    | "transfer-armies"
    | "cargo"
    | "transfer-destination"
    | "loot-armies"
    | "expand-payment"
  >("main");

  const [selectedArmies, setSelectedArmies] =
    useState<ArmyCounts>({
      water: 0,
      fire: 0,
      grass: 0,
    });

  const [selectedResources, setSelectedResources] =
    useState<BaseResources>({
      water: 0,
      fire: 0,
      grass: 0,
    });

  const [expansionPayment, setExpansionPayment] =
    useState<BaseResources>({
      water: 0,
      fire: 0,
      grass: 0,
    });

  if (!base) {
    return null;
  }

  const armyCost = getArmyCost(base.armiesBuilt);

  const isTraining = base.training !== null;

  const totalSelected =
    selectedArmies.water +
    selectedArmies.fire +
    selectedArmies.grass;

  const cargoCapacity = totalSelected * 200;

  const totalCargo =
    selectedResources.water +
    selectedResources.fire +
    selectedResources.grass;

  const totalResources =
    resources.water +
    resources.fire +
    resources.grass;

  const canExpand =
    ownedBases.length < 3 &&
    expansionKeys > 0 &&
    totalResources >= 500;

  const totalExpansionPayment =
    expansionPayment.water +
    expansionPayment.fire +
    expansionPayment.grass;

  function canAfford(resource: ResourceType) {
    return resources[resource] >= armyCost;
  }

  function handleTrain(resource: ResourceType) {
    onTrainArmy(resource);
    setMode("main");
  }

  function changeArmyCount(
    resource: ResourceType,
    change: number,
  ) {
    setSelectedArmies((current) => {
      const maximum = base.armies[resource];

      const newValue = Math.max(
        0,
        Math.min(
          maximum,
          current[resource] + change,
        ),
      );

      return {
        ...current,
        [resource]: newValue,
      };
    });
  }

  function changeResourceCount(
    resource: ResourceType,
    change: number,
  ) {
    setSelectedResources((current) => {
      const currentValue = current[resource];
      const newValue = currentValue + change;

      if (newValue < 0) {
        return current;
      }

      if (newValue > resources[resource]) {
        return current;
      }

      const currentTotal =
        current.water +
        current.fire +
        current.grass;

      const newTotal =
        currentTotal - currentValue + newValue;

      if (newTotal > cargoCapacity) {
        return current;
      }

      return {
        ...current,
        [resource]: newValue,
      };
    });
  }

  function changeExpansionPayment(
    resource: ResourceType,
    change: number,
  ) {
    setExpansionPayment((current) => {
      const newValue =
        current[resource] + change;

      if (newValue < 0) {
        return current;
      }

      if (newValue > resources[resource]) {
        return current;
      }

      const currentTotal =
        current.water +
        current.fire +
        current.grass;

      const newTotal =
       currentTotal -
        current[resource] +
        newValue;

      if (newTotal > 500) {
        return current;
      }

      return {
        ...current,
        [resource]: newValue,
      };
    });
  }

  function resetSend() {
    setSelectedArmies({
      water: 0,
      fire: 0,
      grass: 0,
    });

    setSelectedResources({
      water: 0,
      fire: 0,
      grass: 0,
    });

    setMode("main");
  }

  function handleTransfer(destinationBaseId: number) {
    onTransferArmies(
      destinationBaseId,
      selectedArmies,
      selectedResources,
    );

    resetSend();
  }

  /*
   * Training is underway.
   */
  if (isTraining && base.training) {
    return (
      <div className="base-actions">
        <div className="training-status">
          <strong>
            Training{" "}
            {base.training.resource
              .charAt(0)
              .toUpperCase() +
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

  /*
   * Train menu.
   */
  if (mode === "train") {
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
          onClick={() => setMode("main")}
        >
          Cancel
        </button>
      </div>
    );
  }

  /*
   * Choose what the armies are being sent to do.
  */
  if (mode === "mission") {
    return (
      <div className="base-actions send-menu">
        <div className="send-menu-title">
          What are you sending them to do?
        </div>

        <button
          className="base-action-button"
          onClick={() => setMode("attack-armies")}
        >
          ⚔ Attack
        </button>

        <button
          className="base-action-button"
          onClick={() => setMode("transfer-armies")}
        >
          ⇄ Transfer
        </button>

        <button
          className="base-action-button"
          onClick={() => setMode("loot-armies")}
        >
          💰 Loot
        </button>

        <button
          className="base-action-button"
          onClick={resetSend}
        >
          Cancel
        </button>
      </div>
    );
  }

  /*
  * Select armies for a Loot mission.
  */
  if (mode === "loot-armies") {
    return (
      <div className="base-actions send-menu">
        <div className="send-menu-title">
          Select Looting Armies
        </div>

        <ArmySelector
          icon="⚔️💧"
          label="Water"
          available={base.armies.water}
          selected={selectedArmies.water}
          onDecrease={() =>
            changeArmyCount("water", -1)
          }
          onIncrease={() =>
            changeArmyCount("water", 1)
          }
        />

        <ArmySelector
          icon="⚔️🔥"
          label="Fire"
          available={base.armies.fire}
          selected={selectedArmies.fire}
          onDecrease={() =>
            changeArmyCount("fire", -1)
          }
          onIncrease={() =>
            changeArmyCount("fire", 1)
          }
        />

        <ArmySelector
          icon="⚔️🌱"
          label="Grass"
          available={base.armies.grass}
          selected={selectedArmies.grass}
          onDecrease={() =>
            changeArmyCount("grass", -1)
          }
          onIncrease={() =>
            changeArmyCount("grass", 1)
          }
        />

        <button
          className="base-action-button"
          disabled={totalSelected === 0}
          onClick={() => {
              onStartLootTargeting(selectedArmies);

              setSelectedArmies({
                water: 0,
                fire: 0,
                grass: 0,
              });

              setMode("main");
            }}
        >
          Choose Treasure
        </button>

        <button
          className="base-action-button"
          onClick={() => setMode("mission")}
        >
          Back
        </button>

        <button
          className="base-action-button"
          onClick={resetSend}
        >
          Cancel
        </button>
      </div>
    );
  }

  /*
   * Select armies to send.
   */
  if (mode === "transfer-armies") {
    return (
      <div className="base-actions send-menu">
        <div className="send-menu-title">
          Select Armies
        </div>

        <ArmySelector
          icon="💧"
          label="Water"
          available={base.armies.water}
          selected={selectedArmies.water}
          onDecrease={() =>
            changeArmyCount("water", -1)
          }
          onIncrease={() =>
            changeArmyCount("water", 1)
          }
        />

        <ArmySelector
          icon="🔥"
          label="Fire"
          available={base.armies.fire}
          selected={selectedArmies.fire}
          onDecrease={() =>
            changeArmyCount("fire", -1)
          }
          onIncrease={() =>
            changeArmyCount("fire", 1)
          }
        />

        <ArmySelector
          icon="🌱"
          label="Grass"
          available={base.armies.grass}
          selected={selectedArmies.grass}
          onDecrease={() =>
            changeArmyCount("grass", -1)
          }
          onIncrease={() =>
            changeArmyCount("grass", 1)
          }
        />

        <button
          className="base-action-button"
          disabled={totalSelected === 0}
          onClick={() => setMode("cargo")}
        >
          Choose Cargo
        </button>

        <button
          className="base-action-button"
          onClick={resetSend}
        >
          Cancel
        </button>
      </div>
    );
  }
  if (mode === "cargo") {
  return (
    <div className="base-actions send-menu">
      <div className="send-menu-title">
        Select Cargo
      </div>

      <div className="cargo-capacity">
        Cargo: {totalCargo} / {cargoCapacity}
      </div>

      <ResourceSelector
        icon="💧"
        label="Water"
        available={resources.water}
        selected={selectedResources.water}
        onDecrease={() =>
          changeResourceCount("water", -50)
        }
        onIncrease={() =>
            changeResourceCount("water", 50)
        }
      />

      <ResourceSelector
        icon="🔥"
        label="Fire"
        available={resources.fire}
        selected={selectedResources.fire}
        onDecrease={() =>
          changeResourceCount("fire", -50)
        }
        onIncrease={() =>
          changeResourceCount("fire", 50)
        }
      />

      <ResourceSelector
        icon="🌱"
        label="Grass"
        available={resources.grass}
        selected={selectedResources.grass}
        onDecrease={() =>
          changeResourceCount("grass", -50)
        }
        onIncrease={() =>
          changeResourceCount("grass", 50)
        }
      />

      <button
        className="base-action-button"
        onClick={() => {
          onStartTransferTargeting(
            selectedArmies,
            selectedResources,
          );

          setSelectedArmies({
            water: 0,
            fire: 0,
            grass: 0,
          });

          setSelectedResources({
            water: 0,
            fire: 0,
            grass: 0,
          });

          setMode("main");
        }}
      >
        Choose Destination
      </button>

      <button
        className="base-action-button"
        onClick={() => setMode("transfer-armies")}
      >
        Back
      </button>
    </div>
  );
}
/*
 * Select armies for an attack.
 */
if (mode === "attack-armies") {
  return (
    <div className="base-actions send-menu">
      <div className="send-menu-title">
        Select Attacking Armies
      </div>

      <ArmySelector
        icon="⚔️💧"
        label="Water"
        available={base.armies.water}
        selected={selectedArmies.water}
        onDecrease={() =>
          changeArmyCount("water", -1)
        }
        onIncrease={() =>
          changeArmyCount("water", 1)
        }
      />

      <ArmySelector
        icon="⚔️🔥"
        label="Fire"
        available={base.armies.fire}
        selected={selectedArmies.fire}
        onDecrease={() =>
          changeArmyCount("fire", -1)
        }
        onIncrease={() =>
          changeArmyCount("fire", 1)
        }
      />

      <ArmySelector
        icon="⚔️🌱"
        label="Grass"
        available={base.armies.grass}
        selected={selectedArmies.grass}
        onDecrease={() =>
          changeArmyCount("grass", -1)
        }
        onIncrease={() =>
          changeArmyCount("grass", 1)
        }
      />

      <button
        className="base-action-button"
        disabled={totalSelected === 0}
        onClick={() => {
          onStartAttackTargeting(selectedArmies);

          setSelectedArmies({
            water: 0,
            fire: 0,
            grass: 0,
          });

          setMode("main");
        }}
      >
        Choose Target
      </button>

      <button
        className="base-action-button"
        onClick={() => setMode("mission")}
      >
        Back
      </button>

      <button
        className="base-action-button"
        onClick={resetSend}
      >
        Cancel
      </button>
    </div>
  );
}

  if (mode === "expand-payment") {
    return (
      <div className="base-actions send-menu">
        <div className="send-menu-title">
          Expand Empire
        </div>

        <div className="send-menu-message">
          Cost: 🔑1 + 500 resources
        </div>

        <div className="send-menu-message">
          Available:{" "}
          💧{resources.water}{" "}
          🔥{resources.fire}{" "}
          🌱{resources.grass}
        </div>

        <ResourceSelector
          icon="💧"
          label="Water"
          available={resources.water}
          selected={expansionPayment.water}
          onDecrease={() =>
            changeExpansionPayment("water", -50)
          }
          onIncrease={() =>
            changeExpansionPayment("water", 50)
          }
        />

        <ResourceSelector
          icon="🔥"
          label="Fire"
          available={resources.fire}
          selected={expansionPayment.fire}
          onDecrease={() =>
            changeExpansionPayment("fire", -50)
          }
          onIncrease={() =>
            changeExpansionPayment("fire", 50)
          }
        />

        <ResourceSelector
          icon="🌱"
          label="Grass"
          available={resources.grass}
          selected={expansionPayment.grass}
          onDecrease={() =>
            changeExpansionPayment("grass", -50)
          }
          onIncrease={() =>
            changeExpansionPayment("grass", 50)
          }
        />

        <div className="send-menu-message">
          Payment: {totalExpansionPayment} / 500
        </div>

        <button
          className="base-action-button"
          disabled={totalExpansionPayment !== 500}
          onClick={() => {
            onStartExpandTargeting(
              expansionPayment,
            );

            setExpansionPayment({
              water: 0,
              fire: 0,
              grass: 0,
            });

            setMode("main");
          }}
        >
          Choose Location
        </button>

        <button
          className="base-action-button"
          onClick={() => setMode("main")}
        >
          Back
        </button>
      </div>
    );
  }
  /*
   * Main actions.
   */
  return (
    <div className="base-actions">
      <button
        className="base-action-button"
        onClick={() => setMode("train")}
      >
        ⚔ Train
      </button>

      <button
        className="base-action-button"
        disabled={
          base.armies.water +
            base.armies.fire +
            base.armies.grass ===
          0
        }
        onClick={() => setMode("mission")}
      >
        ➤ Send Army
      </button>

      <button
        className="base-action-button"
        disabled={!canExpand}
        onClick={() => setMode("expand-payment")}
      >
        🔑 Expand
      </button>

      <button className="base-action-button">
        🏕 Relocate
      </button>
    </div>
  );
}

interface ArmySelectorProps {
  icon: string;
  label: string;
  available: number;
  selected: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

function ArmySelector({
  icon,
  label,
  available,
  selected,
  onDecrease,
  onIncrease,
}: ArmySelectorProps) {
  return (
    <div className="army-selector">
      <div className="army-selector-label">
        {icon} {label}
        <span>Available: {available}</span>
      </div>

      <div className="army-selector-controls">
        <button
          disabled={selected <= 0}
          onClick={onDecrease}
        >
          −
        </button>

        <strong>{selected}</strong>

        <button
          disabled={selected >= available}
          onClick={onIncrease}
        >
          +
        </button>
      </div>
    </div>
  );
}
interface ResourceSelectorProps {
  icon: string;
  label: string;
  available: number;
  selected: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

function ResourceSelector({
  icon,
  label,
  available,
  selected,
  onDecrease,
  onIncrease,
}: ResourceSelectorProps) {
  return (
    <div className="army-selector">
      <div className="army-selector-label">
        {icon} {label}
        <span>Available: {available}</span>
      </div>

      <div className="army-selector-controls">
        <button
          disabled={selected <= 0}
          onClick={onDecrease}
        >
          −50
        </button>

        <strong>{selected}</strong>

        <button
          disabled={selected + 50 > available}
          onClick={onIncrease}
        >
          +50
        </button>
      </div>
    </div>
  );
}