import { useEffect, useState } from "react";

import ArmyMovements from "./components/ArmyMovements";
import BaseActions from "./components/BaseActions";
import BattleReports from "./components/BattleReports";
import GameClock from "./components/GameClock";
import GameMap from "./components/GameMap";
import ResourceBar from "./components/ResourceBar";

import {
  bases as startingBases,
  players,
  startingResourcesByBase,
} from "./game/gameState";
import { mapOne } from "./game/maps/mapOne";
import {
  getArmyCost,
  resolveCombat,
} from "./game/rules";

import type {
  ArmyCounts,
  ArmyMission,
  ResourceType,
  BattleReport,
} from "./game/types";

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
  const [gameState, setGameState] = useState<{
  gameSeconds: number;
  bases: typeof startingBases;
  resourcesByBase: typeof startingResourcesByBase;
  armyMissions: ArmyMission[];
  nextMissionId: number;
  battleReports: BattleReport[];
  nextBattleReportId: number;
}>({
  gameSeconds: 0,
  bases: startingBases,
  resourcesByBase: startingResourcesByBase,
  armyMissions: [],
  nextMissionId: 1,
  battleReports: [],
  nextBattleReportId: 1,
});

  const yourBases = gameState.bases.filter(
    (base) => base.playerId === yourPlayerId,
  );

  const enemyBases = gameState.bases.filter(
    (base) => base.playerId !== yourPlayerId,
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

  function handleAttackArmies(
  destinationBaseId: number,
  armies: ArmyCounts,
) {
  setGameState((current) => {
    const originBase = current.bases.find(
      (base) => base.id === selectedBaseId,
    );

    const destinationBase = current.bases.find(
      (base) => base.id === destinationBaseId,
    );

    if (!originBase || !destinationBase) {
      return current;
    }

    /*
     * You may only attack an enemy base.
     */
    if (
      originBase.playerId !== yourPlayerId ||
      destinationBase.playerId === yourPlayerId
    ) {
      return current;
    }

    /*
     * Verify the armies actually exist.
     */
    if (
      armies.water > originBase.armies.water ||
      armies.fire > originBase.armies.fire ||
      armies.grass > originBase.armies.grass
    ) {
      return current;
    }

    const totalArmies =
      armies.water +
      armies.fire +
      armies.grass;

    if (totalArmies === 0) {
      return current;
    }

    const distance =
      Math.abs(
        originBase.row - destinationBase.row,
      ) +
      Math.abs(
        originBase.col - destinationBase.col,
      );

    const travelTime = distance * 5;

    /*
     * Armies leave the origin immediately.
     */
    const updatedBases = current.bases.map((base) => {
      if (base.id !== originBase.id) {
        return base;
      }

      return {
        ...base,

        armies: {
          water:
            base.armies.water - armies.water,

          fire:
            base.armies.fire - armies.fire,

          grass:
            base.armies.grass - armies.grass,
        },
      };
    });

    const newMission: ArmyMission = {
      id: current.nextMissionId,
      type: "attack",
      phase: "outbound",

      originBaseId: originBase.id,
      destinationBaseId: destinationBase.id,

      armies: {
        ...armies,
      },

      /*
       * Attacking armies do not deliberately
       * carry resources outbound.
       */
      resources: {
        water: 0,
        fire: 0,
        grass: 0,
      },

      secondsRemaining: travelTime,
    };

    return {
      ...current,

      bases: updatedBases,

      armyMissions: [
        ...current.armyMissions,
        newMission,
      ],

      nextMissionId:
        current.nextMissionId + 1,
    };
  });
}

  function handleTransferArmies(
  destinationBaseId: number,
  armies: ArmyCounts,
  transferredResources: BaseResources,
) {
  setGameState((current) => {
    const originBase = current.bases.find(
      (base) => base.id === selectedBaseId,
    );

    const destinationBase = current.bases.find(
      (base) => base.id === destinationBaseId,
    );

    if (!originBase || !destinationBase) {
      return current;
    }

    /*
     * Transfers are only allowed between your bases.
     */
    if (
      originBase.playerId !== yourPlayerId ||
      destinationBase.playerId !== yourPlayerId
    ) {
      return current;
    }

    /*
     * Make sure the armies are really available.
     */
    if (
      armies.water > originBase.armies.water ||
      armies.fire > originBase.armies.fire ||
      armies.grass > originBase.armies.grass
    ) {
      return current;
    }

    const totalArmies =
      armies.water +
      armies.fire +
      armies.grass;

    if (totalArmies === 0) {
      return current;
    }

    const resources =
  current.resourcesByBase[originBase.id];

if (!resources) {
  return current;
}

const cargoCapacity = totalArmies * 200;

const totalCargo =
  transferredResources.water +
  transferredResources.fire +
  transferredResources.grass;

if (totalCargo > cargoCapacity) {
  return current;
}

if (
  transferredResources.water > resources.water ||
  transferredResources.fire > resources.fire ||
  transferredResources.grass > resources.grass
) {
  return current;
}

    const distance =
      Math.abs(
        originBase.row - destinationBase.row,
      ) +
      Math.abs(
        originBase.col - destinationBase.col,
      );

    const travelTime = distance * 5;

    /*
     * Remove the armies immediately from the origin.
     */
    const updatedBases = current.bases.map((base) => {
      if (base.id !== originBase.id) {
        return base;
      }

      return {
        ...base,

        armies: {
          water:
            base.armies.water - armies.water,

          fire:
            base.armies.fire - armies.fire,

          grass:
            base.armies.grass - armies.grass,
        },
      };
    });

    const newMission: ArmyMission = {
      id: current.nextMissionId,
      type: "transfer",
      phase: "outbound",

      originBaseId: originBase.id,
      destinationBaseId: destinationBase.id,

      armies: {
        ...armies,
      },

      resources: {
        ...transferredResources,
      },

      secondsRemaining: travelTime,
    };

    const updatedResources = {
      ...current.resourcesByBase,

      [originBase.id]: {
        water:
          resources.water -
          transferredResources.water,

        fire:
          resources.fire -
          transferredResources.fire,

        grass:
          resources.grass -
          transferredResources.grass,
      },
    };

    return {
      ...current,

      bases: updatedBases,

      resourcesByBase: updatedResources,

      armyMissions: [
        ...current.armyMissions,
        newMission,
      ],

      nextMissionId: current.nextMissionId + 1,
    };
  });
}

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
        let updatedBases = current.bases.map((base) => {
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
*
* We do this BEFORE processing army missions so
* transferred cargo can be added when a mission arrives.
*/
const updatedResources = {
  ...current.resourcesByBase,
};

const updatedBattleReports = [
  ...current.battleReports,
];

let nextBattleReportId =
  current.nextBattleReportId;

/*
 * Advance traveling armies.
 */
const updatedArmyMissions: ArmyMission[] = [];

current.armyMissions.forEach((mission) => {
  /*
   * The mission arrives on this tick.
   */
  if (mission.secondsRemaining <= 1) {
    if (
  mission.type === "attack" &&
  mission.phase === "outbound"
) {
  const defendingBase = updatedBases.find(
    (base) => base.id === mission.destinationBaseId,
  );

  const originBase = updatedBases.find(
    (base) => base.id === mission.originBaseId,
  );

  if (!defendingBase || !originBase) {
    return;
  }

  const combatResult = resolveCombat(
    mission.armies,
    defendingBase.armies,
  );

  updatedBattleReports.push({
    id: nextBattleReportId,
    gameSeconds: current.gameSeconds + 1,

    attackerPlayerId: originBase.playerId,
    defenderPlayerId: defendingBase.playerId,

    row: defendingBase.row,
    col: defendingBase.col,

    attackerArmies: {
      ...mission.armies,
    },

    defenderArmies: {
      ...defendingBase.armies,
    },

    attackerSurvivors: {
      ...combatResult.attackerSurvivors,
    },

    defenderSurvivors: {
      ...combatResult.defenderSurvivors,
    },

    militiaSurvived:
      combatResult.militiaSurvived,

    baseDestroyed:
      combatResult.baseDestroyed,
  });

  nextBattleReportId += 1;

  /*
   * Update the defending base's surviving armies.
   */
  updatedBases = updatedBases.map((base) => {
    if (base.id !== defendingBase.id) {
      return base;
    }

    return {
      ...base,
      armies: combatResult.defenderSurvivors,
    };
  });

  /*
   * If attacker won, destroy the base.
   *
   * For now, we simply remove it from the game.
   * Loot and Expansion Tokens come later.
   */
  if (combatResult.baseDestroyed) {
    updatedBases = updatedBases.filter(
      (base) => base.id !== defendingBase.id,
    );
  }

  /*
   * If attacking armies survived, send them home.
   */
  const survivingAttackers =
    combatResult.attackerSurvivors;

  const totalSurvivors =
    survivingAttackers.water +
    survivingAttackers.fire +
    survivingAttackers.grass;

  if (totalSurvivors > 0) {
    const distance =
      Math.abs(
        originBase.row - defendingBase.row,
      ) +
      Math.abs(
        originBase.col - defendingBase.col,
      );

    const returnTravelTime = distance * 5;

    updatedArmyMissions.push({
      ...mission,

      phase: "returning",

      armies: {
        ...survivingAttackers,
      },

      secondsRemaining: returnTravelTime,
    });
  }

  return;
}
if (
  mission.type === "attack" &&
  mission.phase === "returning"
) {
  updatedBases = updatedBases.map((base) => {
    if (base.id !== mission.originBaseId) {
      return base;
    }

    return {
      ...base,

      armies: {
        water:
          base.armies.water +
          mission.armies.water,

        fire:
          base.armies.fire +
          mission.armies.fire,

        grass:
          base.armies.grass +
          mission.armies.grass,
      },
    };
  });

  return;
}
  if (
  mission.type === "transfer" &&
  mission.phase === "outbound"
) {
  updatedBases = updatedBases.map((base) => {
    if (base.id !== mission.destinationBaseId) {
      return base;
    }

    return {
      ...base,

      armies: {
        water:
          base.armies.water +
          mission.armies.water,

        fire:
          base.armies.fire +
          mission.armies.fire,

        grass:
          base.armies.grass +
          mission.armies.grass,
      },
    };
  });

  const destinationResources =
    updatedResources[mission.destinationBaseId];

  if (destinationResources) {
    updatedResources[mission.destinationBaseId] = {
      water:
        destinationResources.water +
        mission.resources.water,

      fire:
        destinationResources.fire +
        mission.resources.fire,

      grass:
        destinationResources.grass +
        mission.resources.grass,
    };
  }

  return;
}

  /*
   * Add carried resources to the destination base.
   */
  const destinationResources =
    updatedResources[mission.destinationBaseId];

  if (destinationResources) {
    updatedResources[mission.destinationBaseId] = {
      water:
        destinationResources.water +
        mission.resources.water,

      fire:
        destinationResources.fire +
        mission.resources.fire,

      grass:
        destinationResources.grass +
        mission.resources.grass,
    };
  }

  /*
   * Don't add this mission back to updatedArmyMissions.
   * It has completed.
   */
  return;
}

  /*
   * Still traveling.
   */
  updatedArmyMissions.push({
    ...mission,

    secondsRemaining:
      mission.secondsRemaining - 1,
  });
});

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
          ...current,
          gameSeconds: current.gameSeconds + 1,
          bases: updatedBases,
          resourcesByBase: updatedResources,
          armyMissions: updatedArmyMissions,
          battleReports: updatedBattleReports,
          nextBattleReportId,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="app">
      <BattleReports
        reports={gameState.battleReports}
        players={players}
      />

      <ResourceBar
        water={selectedResources.water}
        fire={selectedResources.fire}
        grass={selectedResources.grass}
      />

      <GameClock seconds={gameState.gameSeconds} />

      <BaseActions
        key={selectedBaseId}
        base={selectedBase}
        resources={selectedResources}
        ownedBases={yourBases}
        enemyBases={enemyBases}
        onTrainArmy={handleTrainArmy}
        onTransferArmies={handleTransferArmies}
        onAttackArmies={handleAttackArmies}
      />

      <ArmyMovements
        missions={gameState.armyMissions}
        bases={yourBases}
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
  ⚔️💧{base.armies.water}
  {" "}
  ⚔️🔥{base.armies.fire}
  {" "}
  ⚔️🌱{base.armies.grass}
</span>

<span className="base-resource-summary">
  💧{Math.floor(gameState.resourcesByBase[base.id]?.water ?? 0)}
  {" "}
  🔥{Math.floor(gameState.resourcesByBase[base.id]?.fire ?? 0)}
  {" "}
  🌱{Math.floor(gameState.resourcesByBase[base.id]?.grass ?? 0)}
</span>
</button>
        ))}
      </div>
    </main>
  );
}

export default App;