import { useEffect, useState } from "react";

import BattleReports from "./components/BattleReports";
import BaseActions from "./components/BaseActions";
import GameClock from "./components/GameClock";
import GameMap from "./components/GameMap";
import ResourceBar from "./components/ResourceBar";
import type { ResourceType } from "./game/types";
import { getArmyCost } from "./game/rules";

import {
  bases as startingBases,
  players,
  startingResourcesByBase,
} from "./game/gameState";

import { mapOne } from "./game/maps/mapOne";

import "./App.css";

function getLocationMultiplier(seconds: number) {
  if (seconds >= 600) {
    return 4;
  }

  if (seconds >= 300) {
    return 3;
  }

  if (seconds >= 120) {
    return 2;
  }

  return 1;
}

function App() {
  const yourPlayerId = 1;

  /*
   * LIVE GAME STATE
   *
   * These values will change while the match is running.
   */
  const [gameState, setGameState] = useState({
    gameSeconds: 0,
    bases: startingBases,
    resourcesByBase: startingResourcesByBase,
  });

  const yourBases = gameState.bases.filter(
    (base) => base.playerId === yourPlayerId,
  );

  const [selectedBaseId, setSelectedBaseId] = useState(
    yourBases[0]?.id ?? 0,
  );

  const yourPlayer = players.find(
    (player) => player.id === yourPlayerId,
  );

  const selectedBase = gameState.bases.find(
  (base) => base.id === selectedBaseId,
  );

  const selectedResources =
    gameState.resourcesByBase[selectedBaseId] ?? {
      water: 0,
      fire: 0,
      grass: 0,
    };

  function handleTrainArmy(resource: ResourceType) {
  setGameState((current) => {
    const base = current.bases.find(
      (base) => base.id === selectedBaseId,
    );

    if (!base) {
      return current;
    }

    if (base.training) {
      return current;
    }

    const resources =
      current.resourcesByBase[selectedBaseId];

    if (!resources) {
      return current;
    }

    const cost = getArmyCost(base.armiesBuilt);

    if (resources[resource] < cost) {
      return current;
    }

    const updatedBases = current.bases.map((currentBase) => {
      if (currentBase.id !== selectedBaseId) {
        return currentBase;
      }

      return {
        ...currentBase,

        training: {
          resource,
          secondsRemaining: 10,
        },
      };
    });

    const updatedResources = {
      ...current.resourcesByBase,

      [selectedBaseId]: {
        ...resources,
        [resource]: resources[resource] - cost,
      },
    };

    return {
      ...current,
      bases: updatedBases,
      resourcesByBase: updatedResources,
    };
  });
}

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGameState((current) => {
        /*
         * First, age every base by one second.
         */
        const updatedBases = current.bases.map((base) => {
  let updatedArmies = base.armies;
  let updatedTraining = base.training;
  let updatedArmiesBuilt = base.armiesBuilt;

  if (base.training) {
    const secondsRemaining =
      base.training.secondsRemaining - 1;

    /*
     * Training completed.
     */
    if (secondsRemaining <= 0) {
      const resource = base.training.resource;

      updatedArmies = {
        ...base.armies,
        [resource]: base.armies[resource] + 1,
      };

      updatedArmiesBuilt += 1;
      updatedTraining = null;
    } else {
      /*
       * Training is still underway.
       */
      updatedTraining = {
        ...base.training,
        secondsRemaining,
      };
    }
  }

  return {
    ...base,

    timeInLocationSeconds:
      base.timeInLocationSeconds + 1,

    armies: updatedArmies,
    armiesBuilt: updatedArmiesBuilt,
    training: updatedTraining,
  };
});

        /*
         * Copy the current resource banks.
         */
        const updatedResources = {
          ...current.resourcesByBase,
        };

        /*
         * Every base owned by the local player produces
         * resources simultaneously.
         */
        updatedBases
          .filter(
            (base) => base.playerId === yourPlayerId,
          )
          .forEach((base) => {
            const tile = mapOne.find(
              (tile) =>
                tile.row === base.row &&
                tile.col === base.col,
            );

            if (!tile) {
              return;
            }

            const currentResources =
              updatedResources[base.id];

            if (!currentResources) {
              return;
            }

            const locationMultiplier =
              getLocationMultiplier(
                base.timeInLocationSeconds,
              );

            const productionAmount =
              locationMultiplier * tile.multiplier;

            const resource = tile.resource;

            updatedResources[base.id] = {
              ...currentResources,
              [resource]:
                currentResources[resource] +
                productionAmount,
            };
          });

        return {
          gameSeconds: current.gameSeconds + 1,
          bases: updatedBases,
          resourcesByBase: updatedResources,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="app">
      <BattleReports />

      <ResourceBar
        water={selectedResources.water}
        fire={selectedResources.fire}
        grass={selectedResources.grass}
      />

      <GameClock seconds={gameState.gameSeconds} />

      <BaseActions
        base={selectedBase}
        resources={selectedResources}
        onTrainArmy={handleTrainArmy}
      />

      <GameMap
        selectedBaseId={selectedBaseId}
        bases={gameState.bases}
      />

      <div className="base-selector">
        <div className="base-selector-title">
          {yourPlayer?.name ?? "Your Bases"}
        </div>

        {yourBases.map((base, index) => (
          <button
  key={base.id}
  className={[
    "base-selector-button",
    base.id === selectedBaseId
      ? "base-selector-button--selected"
      : "",
  ]
    .filter(Boolean)
    .join(" ")}
  onClick={() =>
    setSelectedBaseId(base.id)
  }
>
  <span>Base {index + 1}</span>

  <span className="base-army-summary">
    💧{base.armies.water}
    {" "}
    🔥{base.armies.fire}
    {" "}
    🌱{base.armies.grass}
  </span>
</button>
        ))}
      </div>
    </main>
  );
}

export default App;