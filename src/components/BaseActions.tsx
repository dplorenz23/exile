import { useState } from "react";

import { BALANCE } from "../game/balance";

import type {
  Base,
  BaseResources,
  ResourceType,
  UnitCounts,
  UnitType,
} from "../game/types";

import { getExpansionCost, getSpendableResourceTotal } from "../game/rules";

/*
 * Controls the action menus for the currently selected base.
 *
 * This component manages temporary UI selections such as armies,
 * cargo, expansion payment, and relocation payment. Completed
 * selections are passed upward through callbacks; authoritative
 * validation and game-state changes happen outside this component.
 */

interface BaseActionsProps {
  base?: Base;
  resources: BaseResources;
  ownedBases: Base[];
  expansionKeys: number;
  expansionsCompleted: number;

  onTrainArmy: (unitType: UnitType) => void;

  onStartAttackTargeting: (armies: UnitCounts) => void;

  onStartLootTargeting: (armies: UnitCounts) => void;

  onStartExpandTargeting: (payment: BaseResources) => void;

  onStartTransferTargeting: (
    armies: UnitCounts,
    resources: BaseResources,
  ) => void;

  onStartRelocateTargeting: (payment: BaseResources) => void;

  activeDeployments: number;
}

export default function BaseActions({
  base,
  resources,
  ownedBases,
  expansionKeys,
  expansionsCompleted,
  onTrainArmy,
  onStartAttackTargeting,
  onStartLootTargeting,
  onStartExpandTargeting,
  onStartTransferTargeting,
  onStartRelocateTargeting,
  activeDeployments,
}: BaseActionsProps) {
  const [mode, setMode] = useState<
    | "main"
    | "train"
    | "mission"
    | "attack-armies"
    | "transfer-armies"
    | "cargo"
    | "loot-armies"
    | "expand-payment"
    | "relocate-payment"
  >("main");

  const [selectedArmies, setSelectedArmies] = useState<UnitCounts>({
    guardian: 0,
    marksman: 0,
    medic: 0,
    spy: 0,
  });

  const [selectedResources, setSelectedResources] = useState<BaseResources>({
    water: 0,
    fire: 0,
    grass: 0,
  });

  const [expansionPayment, setExpansionPayment] = useState<BaseResources>({
    water: 0,
    fire: 0,
    grass: 0,
  });

  const [relocationPayment, setRelocationPayment] = useState<BaseResources>({
    water: 0,
    fire: 0,
    grass: 0,
  });

  const totalRelocationPayment =
    relocationPayment.water + relocationPayment.fire + relocationPayment.grass;

  if (!base) {
    return null;
  }

  const currentBase = base;

  const unitTypes = [
    { key: "guardian", label: "Guardian" },
    { key: "marksman", label: "Marksman" },
    { key: "medic", label: "Medic" },
    { key: "spy", label: "Spy" },
  ] as const;

  const deploymentLimitReached =
    activeDeployments >= BALANCE.missions.maxActivePerPlayer;

  const armyCosts = {
    guardian: BALANCE.units.guardian.cost,
    marksman: BALANCE.units.marksman.cost,
    medic: BALANCE.units.medic.cost,
    spy: BALANCE.units.spy.cost,
  };

  const isTraining = base.training !== null;

  const totalSelected =
    selectedArmies.guardian +
    selectedArmies.marksman +
    selectedArmies.medic +
    selectedArmies.spy;

  const cargoCapacity = totalSelected * BALANCE.armies.cargoCapacity;

  const totalCargo =
    selectedResources.water + selectedResources.fire + selectedResources.grass;

  const spendableResources = getSpendableResourceTotal(resources);

  const expansionCost = getExpansionCost(expansionsCompleted);

  const canExpand =
    ownedBases.length < BALANCE.expansion.maxBases &&
    expansionKeys >= BALANCE.expansion.keyCost &&
    spendableResources >= expansionCost;

  const totalExpansionPayment =
    expansionPayment.water + expansionPayment.fire + expansionPayment.grass;

  const relocationCost =
    BALANCE.relocation.baseCost +
    base.relocations * BALANCE.relocation.costIncrease;

  const canAffordRelocation = spendableResources >= relocationCost;

  function canAfford(unitType: UnitType): boolean {
    const cost = armyCosts[unitType];

    return (
      resources.water >= cost.water &&
      resources.fire >= cost.fire &&
      resources.grass >= cost.grass
    );
  }

  function handleTrain(unitType: UnitType): void {
    onTrainArmy(unitType);
    setMode("main");
  }

  function changeArmyCount(unitType: UnitType, change: number): void {
    setSelectedArmies((current) => {
      const maximum = currentBase.armies[unitType];

      const newValue = Math.max(
        0,
        Math.min(maximum, current[unitType] + change),
      );

      return {
        ...current,
        [unitType]: newValue,
      };
    });
  }

  function changeResourceCount(resource: ResourceType, change: number): void {
    setSelectedResources((current) => {
      const currentValue = current[resource];
      const newValue = currentValue + change;

      if (newValue < 0) {
        return current;
      }

      if (newValue > resources[resource]) {
        return current;
      }

      const currentTotal = current.water + current.fire + current.grass;

      const newTotal = currentTotal - currentValue + newValue;

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
  ): void {
    setExpansionPayment((current) => {
      const newValue = current[resource] + change;

      if (newValue < 0) {
        return current;
      }

      if (newValue > resources[resource]) {
        return current;
      }

      const currentTotal = current.water + current.fire + current.grass;

      const newTotal = currentTotal - current[resource] + newValue;

      if (newTotal > expansionCost) {
        return current;
      }

      return {
        ...current,
        [resource]: newValue,
      };
    });
  }

  function changeRelocationPayment(
    resource: ResourceType,
    change: number,
  ): void {
    setRelocationPayment((current) => {
      const newValue = current[resource] + change;

      if (newValue < 0) {
        return current;
      }

      /*
       * Cannot spend more of a resource
       * than this base currently owns.
       */
      if (newValue > resources[resource]) {
        return current;
      }

      const currentTotal = current.water + current.fire + current.grass;

      const newTotal = currentTotal - current[resource] + newValue;

      /*
       * Stop once the exact relocation
       * cost has been reached.
       */
      if (newTotal > relocationCost) {
        return current;
      }

      return {
        ...current,
        [resource]: newValue,
      };
    });
  }

  function resetSend(): void {
    setSelectedArmies({
      guardian: 0,
      marksman: 0,
      medic: 0,
      spy: 0,
    });

    setSelectedResources({
      water: 0,
      fire: 0,
      grass: 0,
    });

    setMode("main");
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
            {base.training.unitType.charAt(0).toUpperCase() +
              base.training.unitType.slice(1)}{" "}
            Army
          </strong>

          <span>{base.training.secondsRemaining}s remaining</span>
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
        <div className="train-menu-title">Recruit Unit</div>

        {unitTypes.map(({ key, label }) => {
          const cost = armyCosts[key];

          return (
            <button
              key={key}
              className="base-action-button"
              disabled={!canAfford(key)}
              onClick={() => handleTrain(key)}
            >
              {label} — 💧{cost.water} 🔥{cost.fire} 🌱{cost.grass}
            </button>
          );
        })}

        <button className="base-action-button" onClick={() => setMode("main")}>
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
        <div className="send-menu-title">What are you sending them to do?</div>

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

        <button className="base-action-button" onClick={resetSend}>
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
        <div className="send-menu-title">Select Looting Armies</div>

        {unitTypes.map(({ key, label }) => (
          <ArmySelector
            key={key}
            label={label}
            available={base.armies[key]}
            selected={selectedArmies[key]}
            onDecrease={() => changeArmyCount(key, -1)}
            onIncrease={() => changeArmyCount(key, 1)}
          />
        ))}

        <button
          className="base-action-button"
          disabled={totalSelected === 0}
          onClick={() => {
            onStartLootTargeting(selectedArmies);

            setSelectedArmies({
              guardian: 0,
              marksman: 0,
              medic: 0,
              spy: 0,
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

        <button className="base-action-button" onClick={resetSend}>
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
        <div className="send-menu-title">Select Armies</div>

        {unitTypes.map(({ key, label }) => (
          <ArmySelector
            key={key}
            label={label}
            available={base.armies[key]}
            selected={selectedArmies[key]}
            onDecrease={() => changeArmyCount(key, -1)}
            onIncrease={() => changeArmyCount(key, 1)}
          />
        ))}

        <button
          className="base-action-button"
          disabled={totalSelected === 0}
          onClick={() => setMode("cargo")}
        >
          Choose Cargo
        </button>

        <button className="base-action-button" onClick={resetSend}>
          Cancel
        </button>
      </div>
    );
  }

  if (mode === "cargo") {
    return (
      <div className="base-actions send-menu">
        <div className="send-menu-title">Select Cargo</div>

        <div className="cargo-capacity">
          Cargo: {totalCargo} / {cargoCapacity}
        </div>

        <ResourceSelector
          resourceType="water"
          label="Water"
          available={resources.water}
          selected={selectedResources.water}
          onDecrease={() => changeResourceCount("water", -50)}
          onIncrease={() => changeResourceCount("water", 50)}
        />

        <ResourceSelector
          resourceType="fuel"
          label="Fuel"
          available={resources.fire}
          selected={selectedResources.fire}
          onDecrease={() => changeResourceCount("fire", -50)}
          onIncrease={() => changeResourceCount("fire", 50)}
        />

        <ResourceSelector
          resourceType="food"
          label="Food"
          available={resources.grass}
          selected={selectedResources.grass}
          onDecrease={() => changeResourceCount("grass", -50)}
          onIncrease={() => changeResourceCount("grass", 50)}
        />

        <button
          className="base-action-button"
          onClick={() => {
            onStartTransferTargeting(selectedArmies, selectedResources);

            setSelectedArmies({
              guardian: 0,
              marksman: 0,
              medic: 0,
              spy: 0,
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
        <div className="send-menu-title">Select Attacking Armies</div>

        {unitTypes.map(({ key, label }) => (
          <ArmySelector
            key={key}
            label={label}
            available={base.armies[key]}
            selected={selectedArmies[key]}
            onDecrease={() => changeArmyCount(key, -1)}
            onIncrease={() => changeArmyCount(key, 1)}
          />
        ))}

        <button
          className="base-action-button"
          disabled={totalSelected === 0}
          onClick={() => {
            onStartAttackTargeting(selectedArmies);

            setSelectedArmies({
              guardian: 0,
              marksman: 0,
              medic: 0,
              spy: 0,
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

        <button className="base-action-button" onClick={resetSend}>
          Cancel
        </button>
      </div>
    );
  }

  if (mode === "expand-payment") {
    return (
      <div className="base-actions send-menu">
        <div className="send-menu-title">Expand</div>

        <div className="send-menu-message">
          Cost: 🔑{BALANCE.expansion.keyCost} + {expansionCost} resources
        </div>

        <ResourceSelector
          resourceType="water"
          label="Water"
          available={resources.water}
          selected={expansionPayment.water}
          onDecrease={() => changeExpansionPayment("water", -50)}
          onIncrease={() => changeExpansionPayment("water", 50)}
        />

        <ResourceSelector
          resourceType="fuel"
          label="Fuel"
          available={resources.fire}
          selected={expansionPayment.fire}
          onDecrease={() => changeExpansionPayment("fire", -50)}
          onIncrease={() => changeExpansionPayment("fire", 50)}
        />

        <ResourceSelector
          resourceType="food"
          label="Food"
          available={resources.grass}
          selected={expansionPayment.grass}
          onDecrease={() => changeExpansionPayment("grass", -50)}
          onIncrease={() => changeExpansionPayment("grass", 50)}
        />

        <div className="send-menu-message">
          Payment: {totalExpansionPayment} / {expansionCost}
        </div>

        <button
          className="base-action-button"
          disabled={totalExpansionPayment !== expansionCost}
          onClick={() => {
            onStartExpandTargeting(expansionPayment);

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

        <button className="base-action-button" onClick={() => setMode("main")}>
          Back
        </button>
      </div>
    );
  }

  if (mode === "relocate-payment") {
    return (
      <div className="base-actions send-menu">
        <div className="send-menu-title">📦 Relocate Base</div>

        <div className="send-menu-message">
          Cost: {relocationCost} resources
        </div>

        <ResourceSelector
          resourceType="water"
          label="Water"
          available={resources.water}
          selected={relocationPayment.water}
          onDecrease={() => changeRelocationPayment("water", -50)}
          onIncrease={() => changeRelocationPayment("water", 50)}
        />

        <ResourceSelector
          resourceType="fuel"
          label="Fuel"
          available={resources.fire}
          selected={relocationPayment.fire}
          onDecrease={() => changeRelocationPayment("fire", -50)}
          onIncrease={() => changeRelocationPayment("fire", 50)}
        />

        <ResourceSelector
          resourceType="food"
          label="Food"
          available={resources.grass}
          selected={relocationPayment.grass}
          onDecrease={() => changeRelocationPayment("grass", -50)}
          onIncrease={() => changeRelocationPayment("grass", 50)}
        />

        <div className="send-menu-message">
          Payment: {totalRelocationPayment} / {relocationCost}
        </div>

        <button
          className="base-action-button"
          disabled={totalRelocationPayment !== relocationCost}
          onClick={() => {
            onStartRelocateTargeting(relocationPayment);

            setRelocationPayment({
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
          onClick={() => {
            setRelocationPayment({
              water: 0,
              fire: 0,
              grass: 0,
            });

            setMode("main");
          }}
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
      <button className="base-action-button" onClick={() => setMode("train")}>
        🪖 RECRUIT
      </button>

      <button
        className="base-action-button"
        disabled={
          deploymentLimitReached ||
          base.armies.guardian +
            base.armies.marksman +
            base.armies.medic +
            base.armies.spy ===
            0
        }
        onClick={() => setMode("mission")}
      >
        📡 DEPLOY ARMY
      </button>

      <button
        className="base-action-button"
        disabled={!canExpand || deploymentLimitReached}
        onClick={() => setMode("expand-payment")}
      >
        🏕️ EXPAND ({expansionCost}+🔑)
      </button>

      <button
        className="base-action-button"
        disabled={!canAffordRelocation || deploymentLimitReached}
        onClick={() => setMode("relocate-payment")}
      >
        🚚 RELOCATE ({relocationCost})
      </button>
    </div>
  );
}

interface ArmySelectorProps {
  label: string;
  available: number;
  selected: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

function ArmySelector({
  label,
  available,
  selected,
  onDecrease,
  onIncrease,
}: ArmySelectorProps) {
  return (
    <div className="army-selector">
      <div className="army-selector-label">
        {label}
        <span>Available: {available}</span>
      </div>

      <div className="army-selector-controls">
        <button disabled={selected <= 0} onClick={onDecrease}>
          −
        </button>

        <strong>{selected}</strong>

        <button disabled={selected >= available} onClick={onIncrease}>
          +
        </button>
      </div>
    </div>
  );
}

interface ResourceSelectorProps {
  resourceType: "water" | "fuel" | "food";
  label: string;
  available: number;
  selected: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

function ResourceSelector({
  resourceType,
  label,
  available,
  selected,
  onDecrease,
  onIncrease,
}: ResourceSelectorProps) {
  return (
    <div className="army-selector">
      <div className="army-selector-label">
        <img
          className="resource-selector-icon"
          src={`${import.meta.env.BASE_URL}assets/resources/${resourceType}.png`}
          alt=""
        />
        {label}
        <span>Available: {available}</span>
      </div>

      <div className="army-selector-controls">
        <button disabled={selected <= 0} onClick={onDecrease}>
          −50
        </button>
        <strong>{selected}</strong>
        <button disabled={selected + 50 > available} onClick={onIncrease}>
          +50
        </button>
      </div>
    </div>
  );
}
