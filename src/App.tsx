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

import type { BaseResources } from "./game/gameState";

import { mapOne } from "./game/maps/mapOne";

import {
  calculateLoot,
  getArmyCost,
  resolveCombat,
} from "./game/rules";

import type {
  ArmyCounts,
  ArmyMission,
  BattleReport,
  ResourceType,
  Treasure,
} from "./game/types";

import "./App.css";


/*
 * ============================================================
 * BASE PRODUCTION MULTIPLIER
 * ============================================================
 *
 * Time in location:
 *
 * 0–2 minutes   = 1x
 * 2–5 minutes   = 2x
 * 5–10 minutes  = 3x
 * 10+ minutes   = 4x
 */
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
  /*
   * ==========================================================
   * LOCAL PLAYER
   * ==========================================================
   *
   * For the current single-browser MVP, Player 1 is always us.
   *
   * Later, multiplayer will determine this dynamically.
   */
  const yourPlayerId = 1;


  /*
   * ==========================================================
   * LIVE GAME STATE
   * ==========================================================
   *
   * Everything that changes while a match is running lives
   * here.
   */
  const [gameState, setGameState] = useState<{
    gameSeconds: number;

    bases: typeof startingBases;

    resourcesByBase:
      typeof startingResourcesByBase;

    armyMissions: ArmyMission[];
    nextMissionId: number;

    battleReports: BattleReport[];
    nextBattleReportId: number;

    treasures: Treasure[];
    nextTreasureId: number;
  }>({
    gameSeconds: 0,

    bases: startingBases,

    resourcesByBase:
      startingResourcesByBase,

    armyMissions: [],
    nextMissionId: 1,

    battleReports: [],
    nextBattleReportId: 1,

    treasures: [],
    nextTreasureId: 1,
  });


  /*
   * ==========================================================
   * DERIVED PLAYER DATA
   * ==========================================================
   *
   * These values are calculated from the live game state.
   */
  const yourBases = gameState.bases.filter(
    (base) =>
      base.playerId === yourPlayerId,
  );

  const enemyBases = gameState.bases.filter(
    (base) =>
      base.playerId !== yourPlayerId,
  );


  /*
   * ==========================================================
   * SELECTED BASE
   * ==========================================================
   *
   * The bottom-left base selector determines which of our
   * bases is currently active in the UI.
   */
  const [selectedBaseId, setSelectedBaseId] =
    useState(
      yourBases[0]?.id ?? 0,
    );

  const yourPlayer = players.find(
    (player) =>
      player.id === yourPlayerId,
  );

  const selectedBase =
    gameState.bases.find(
      (base) =>
        base.id === selectedBaseId,
    );

  const selectedResources =
    gameState.resourcesByBase[
      selectedBaseId
    ] ?? {
      water: 0,
      fire: 0,
      grass: 0,
    };

  /*
  * ==========================================================
  * MAP TARGETING
  * ==========================================================
  *
  * When null, the map behaves normally.
  *
  * Later this can support:
  * - attack
  * - transfer
  * - loot
  * - expand
  * - relocate
  */
  const [targetingMode, setTargetingMode] =
    useState<"attack" | "loot" | null>(null);

  const [pendingAttackArmies, setPendingAttackArmies] =
    useState<ArmyCounts | null>(null);

  const [pendingLootArmies, setPendingLootArmies] =
    useState<ArmyCounts | null>(null);

  function cancelTargeting() {
    setTargetingMode(null);

    setPendingAttackArmies(null);
    setPendingLootArmies(null);
  }

  /*
  * ==========================================================
  * START ATTACK TARGETING
  * ==========================================================
  *
  * BaseActions tells App which armies the player selected.
  *
  * We remember those armies, then let the player choose
  * the destination directly from the map.
  */
  function handleStartAttackTargeting(
    armies: ArmyCounts,
  ) {
    setPendingAttackArmies({
      ...armies,
    });

    setTargetingMode("attack");
  }

  function handleAttackTargetSelected(
    destinationBaseId: number,
  ) {
    if (!pendingAttackArmies) {
      return;
    }

    handleAttackArmies(
      destinationBaseId,
      pendingAttackArmies,
    );

    setPendingAttackArmies(null);
    setTargetingMode(null);
  }

  /*
   * ==========================================================
   * ATTACK
   * ==========================================================
   *
   * Creates an outbound Attack mission.
   *
   * Armies:
   * - immediately leave the originating base
   * - travel at 5 seconds per Manhattan tile
   * - carry no resources outbound
   *
   * Combat occurs later when the mission timer reaches zero.
   */
  function handleAttackArmies(
    destinationBaseId: number,
    armies: ArmyCounts,
  ) {
    setGameState((current) => {
      const originBase =
        current.bases.find(
          (base) =>
            base.id === selectedBaseId,
        );

      const destinationBase =
        current.bases.find(
          (base) =>
            base.id ===
            destinationBaseId,
        );

      /*
       * Both bases must still exist.
       */
      if (
        !originBase ||
        !destinationBase
      ) {
        return current;
      }

      /*
       * We may only attack:
       *
       * - FROM one of our bases
       * - TO an enemy base
       */
      if (
        originBase.playerId !==
          yourPlayerId ||
        destinationBase.playerId ===
          yourPlayerId
      ) {
        return current;
      }

      /*
       * Verify the requested armies
       * actually exist at the base.
       */
      if (
        armies.water >
          originBase.armies.water ||
        armies.fire >
          originBase.armies.fire ||
        armies.grass >
          originBase.armies.grass
      ) {
        return current;
      }

      const totalArmies =
        armies.water +
        armies.fire +
        armies.grass;

      /*
       * Cannot send an empty mission.
       */
      if (totalArmies === 0) {
        return current;
      }

      /*
       * Manhattan distance:
       *
       * horizontal tiles
       * +
       * vertical tiles
       */
      const distance =
        Math.abs(
          originBase.row -
            destinationBase.row,
        ) +
        Math.abs(
          originBase.col -
            destinationBase.col,
        );

      const travelTime =
        distance * 5;

      /*
       * Remove armies from the origin
       * immediately when they depart.
       */
      const updatedBases =
        current.bases.map((base) => {
          if (
            base.id !== originBase.id
          ) {
            return base;
          }

          return {
            ...base,

            armies: {
              water:
                base.armies.water -
                armies.water,

              fire:
                base.armies.fire -
                armies.fire,

              grass:
                base.armies.grass -
                armies.grass,
            },
          };
        });

      /*
       * Create the outbound Attack mission.
       */
      const newMission: ArmyMission = {
        id: current.nextMissionId,

        type: "attack",
        phase: "outbound",

        originBaseId:
          originBase.id,

        destinationBaseId:
          destinationBase.id,

        armies: {
          ...armies,
        },

        /*
         * Attacking armies carry nothing
         * on the outbound trip.
         *
         * Loot may be added after victory.
         */
        resources: {
          water: 0,
          fire: 0,
          grass: 0,
        },

        secondsRemaining:
          travelTime,
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

  /*
  * ==========================================================
  * START LOOT TARGETING
  * ==========================================================
  *
  * Remember which armies were selected, then allow
  * the player to choose a treasure chest on the map.
  */
  function handleStartLootTargeting(
    armies: ArmyCounts,
  ) {
    setPendingLootArmies({
      ...armies,
    });

    setTargetingMode("loot");
  }

  /*
  * ==========================================================
  * LOOT TARGET SELECTED
  * ==========================================================
  *
  * Called when the player clicks a treasure chest while
  * the map is in Loot Targeting Mode.
  *
  * For now this creates the outbound mission only.
  * The actual looting will happen when the army arrives.
  */
  function handleLootTargetSelected(
    treasureId: number,
  ) {
    if (!pendingLootArmies) {
      return;
    }

    const armiesToSend = {
      ...pendingLootArmies,
    };

      setGameState((current) => {
        const originBase = current.bases.find(
          (base) => base.id === selectedBaseId,
        );

        const treasure = current.treasures.find(
          (treasure) => treasure.id === treasureId,
        );

        if (!originBase || !treasure) {
          return current;
        }

        /*
         * Make sure the armies are still available.
         */
        if (
          armiesToSend.water > originBase.armies.water ||
          armiesToSend.fire > originBase.armies.fire ||
          armiesToSend.grass > originBase.armies.grass
        ) {
          return current;
        }

        const totalArmies =
          armiesToSend.water +
          armiesToSend.fire +
          armiesToSend.grass;

        if (totalArmies === 0) {
          return current;
        }

        /*
         * Travel time is 5 seconds per tile.
         */
        const distance =
          Math.abs(originBase.row - treasure.row) +
          Math.abs(originBase.col - treasure.col);

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
                base.armies.water -
                armiesToSend.water,

              fire:
                base.armies.fire -
                armiesToSend.fire,

              grass:
                base.armies.grass -
                armiesToSend.grass,
            },
          };
        });

        /*
         * Create the outbound Loot mission.
         *
         * destinationBaseId is not meaningful for treasure,
         * so we use the treasure ID here temporarily.
         * We'll clean this model up later if needed.
         */
        const newMission: ArmyMission = {
          id: current.nextMissionId,

          type: "loot",
          phase: "outbound",

          originBaseId: originBase.id,
          destinationBaseId: treasure.id,

          armies: {
            ...armiesToSend,
          },

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

      /*
       * Leave targeting mode once the mission launches.
       */
      setPendingLootArmies(null);
      setTargetingMode(null);
    }

  /*
   * ==========================================================
   * TRANSFER
   * ==========================================================
   *
   * Sends armies and optional cargo between two of our bases.
   *
   * Each selected army provides 200 resource capacity.
   */
  function handleTransferArmies(
    destinationBaseId: number,
    armies: ArmyCounts,
    transferredResources: BaseResources,
  ) {
    setGameState((current) => {
      const originBase =
        current.bases.find(
          (base) =>
            base.id === selectedBaseId,
        );

      const destinationBase =
        current.bases.find(
          (base) =>
            base.id ===
            destinationBaseId,
        );

      if (
        !originBase ||
        !destinationBase
      ) {
        return current;
      }

      /*
       * Transfers may only occur between
       * bases belonging to us.
       */
      if (
        originBase.playerId !==
          yourPlayerId ||
        destinationBase.playerId !==
          yourPlayerId
      ) {
        return current;
      }

      /*
       * Verify the armies exist.
       */
      if (
        armies.water >
          originBase.armies.water ||
        armies.fire >
          originBase.armies.fire ||
        armies.grass >
          originBase.armies.grass
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

      /*
       * Get the resource bank
       * at the originating base.
       */
      const resources =
        current.resourcesByBase[
          originBase.id
        ];

      if (!resources) {
        return current;
      }

      /*
       * Every army can carry
       * up to 200 resources.
       */
      const cargoCapacity =
        totalArmies * 200;

      const totalCargo =
        transferredResources.water +
        transferredResources.fire +
        transferredResources.grass;

      /*
       * Cannot exceed carrying capacity.
       */
      if (
        totalCargo > cargoCapacity
      ) {
        return current;
      }

      /*
       * Cannot transfer resources
       * the originating base does not own.
       */
      if (
        transferredResources.water >
          resources.water ||
        transferredResources.fire >
          resources.fire ||
        transferredResources.grass >
          resources.grass
      ) {
        return current;
      }

      const distance =
        Math.abs(
          originBase.row -
            destinationBase.row,
        ) +
        Math.abs(
          originBase.col -
            destinationBase.col,
        );

      const travelTime =
        distance * 5;

      /*
       * Remove armies immediately.
       */
      const updatedBases =
        current.bases.map((base) => {
          if (
            base.id !== originBase.id
          ) {
            return base;
          }

          return {
            ...base,

            armies: {
              water:
                base.armies.water -
                armies.water,

              fire:
                base.armies.fire -
                armies.fire,

              grass:
                base.armies.grass -
                armies.grass,
            },
          };
        });

      /*
       * Remove cargo immediately.
       */
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

      /*
       * Create outbound Transfer mission.
       */
      const newMission: ArmyMission = {
        id: current.nextMissionId,

        type: "transfer",
        phase: "outbound",

        originBaseId:
          originBase.id,

        destinationBaseId:
          destinationBase.id,

        armies: {
          ...armies,
        },

        resources: {
          ...transferredResources,
        },

        secondsRemaining:
          travelTime,
      };

      return {
        ...current,

        bases: updatedBases,

        resourcesByBase:
          updatedResources,

        armyMissions: [
          ...current.armyMissions,
          newMission,
        ],

        nextMissionId:
          current.nextMissionId + 1,
      };
    });
  }


  /*
   * ==========================================================
   * TRAIN ARMY
   * ==========================================================
   *
   * Starts a 10-second training order
   * at the selected base.
   */
  function handleTrainArmy(
    resource: ResourceType,
  ) {
    setGameState((current) => {
      const base =
        current.bases.find(
          (base) =>
            base.id === selectedBaseId,
        );

      if (!base) {
        return current;
      }

      /*
       * A base can only train one
       * army at a time.
       */
      if (base.training) {
        return current;
      }

      const resources =
        current.resourcesByBase[
          selectedBaseId
        ];

      if (!resources) {
        return current;
      }

      /*
       * Army price increases by 50
       * after every army ever built here.
       */
      const cost =
        getArmyCost(
          base.armiesBuilt,
        );

      /*
       * Army cost must be paid using
       * the matching resource.
       */
      if (
        resources[resource] < cost
      ) {
        return current;
      }

      /*
       * Start the training timer.
       */
      const updatedBases =
        current.bases.map(
          (currentBase) => {
            if (
              currentBase.id !==
              selectedBaseId
            ) {
              return currentBase;
            }

            return {
              ...currentBase,

              training: {
                resource,
                secondsRemaining: 10,
              },
            };
          },
        );

      /*
       * Deduct the cost immediately.
       */
      const updatedResources = {
        ...current.resourcesByBase,

        [selectedBaseId]: {
          ...resources,

          [resource]:
            resources[resource] -
            cost,
        },
      };

      return {
        ...current,

        bases: updatedBases,

        resourcesByBase:
          updatedResources,
      };
    });
  }


  /*
   * ==========================================================
   * MASTER GAME TIMER
   * ==========================================================
   *
   * This currently runs the whole MVP simulation.
   *
   * Every second it:
   *
   * 1. Advances base age
   * 2. Advances army training
   * 3. Advances traveling missions
   * 4. Resolves arriving attacks
   * 5. Resolves arriving transfers
   * 6. Deposits returning attackers and raid loot
   * 7. Produces resources at every remaining base
   * 8. Advances the game clock
   *
   * Later, this logic will move server-side.
   */
  useEffect(() => {
    const timer =
      window.setInterval(() => {
        setGameState((current) => {

          /*
           * ==================================================
           * STEP 1:
           * AGE BASES AND PROCESS TRAINING
           * ==================================================
           */
          let updatedBases =
            current.bases.map((base) => {
              let updatedArmies =
                base.armies;

              let updatedTraining =
                base.training;

              let updatedArmiesBuilt =
                base.armiesBuilt;

              /*
               * If this base is training,
               * reduce its timer by one second.
               */
              if (base.training) {
                const secondsRemaining =
                  base.training
                    .secondsRemaining - 1;

                /*
                 * Training completed.
                 */
                if (
                  secondsRemaining <= 0
                ) {
                  const resource =
                    base.training.resource;

                  updatedArmies = {
                    ...base.armies,

                    [resource]:
                      base.armies[
                        resource
                      ] + 1,
                  };

                  updatedArmiesBuilt += 1;

                  updatedTraining = null;
                } else {
                  /*
                   * Still training.
                   */
                  updatedTraining = {
                    ...base.training,

                    secondsRemaining,
                  };
                }
              }

              return {
                ...base,

                /*
                 * Base ages by one second.
                 */
                timeInLocationSeconds:
                  base.timeInLocationSeconds +
                  1,

                armies:
                  updatedArmies,

                armiesBuilt:
                  updatedArmiesBuilt,

                training:
                  updatedTraining,
              };
            });


          /*
           * ==================================================
           * STEP 2:
           * CREATE WORKING COPIES OF OTHER GAME STATE
           * ==================================================
           *
           * We modify these during this tick,
           * then return them at the end.
           */

          const updatedResources = {
            ...current.resourcesByBase,
          };

          const updatedBattleReports = [
            ...current.battleReports,
          ];

          let nextBattleReportId =
            current.nextBattleReportId;

          const updatedTreasures = [
            ...current.treasures,
          ];

          let nextTreasureId =
            current.nextTreasureId;

          const updatedArmyMissions:
            ArmyMission[] = [];


          /*
           * ==================================================
           * STEP 3:
           * ADVANCE EVERY ARMY MISSION
           * ==================================================
           */
          current.armyMissions.forEach(
            (mission) => {

              /*
               * Mission has NOT arrived yet.
               *
               * Reduce timer by one second
               * and keep it active.
               */
              if (
                mission.secondsRemaining > 1
              ) {
                updatedArmyMissions.push({
                  ...mission,

                  secondsRemaining:
                    mission.secondsRemaining -
                    1,
                });

                return;
              }


              /*
               * =================================================
               * MISSION ARRIVAL:
               * OUTBOUND ATTACK
               * =================================================
               */
              if (
                mission.type === "attack" &&
                mission.phase === "outbound"
              ) {
                const defendingBase =
                  updatedBases.find(
                    (base) =>
                      base.id ===
                      mission.destinationBaseId,
                  );

                const originBase =
                  updatedBases.find(
                    (base) =>
                      base.id ===
                      mission.originBaseId,
                  );

                /*
                 * If either relevant base no longer
                 * exists, terminate the mission.
                 *
                 * We can refine this edge case later.
                 */
                if (
                  !defendingBase ||
                  !originBase
                ) {
                  return;
                }


                /*
                 * -----------------------------------------------
                 * COMBAT
                 * -----------------------------------------------
                 */
                const combatResult =
                  resolveCombat(
                    mission.armies,
                    defendingBase.armies,
                  );


                /*
                 * -----------------------------------------------
                 * RESOURCE RESULT DEFAULTS
                 * -----------------------------------------------
                 *
                 * If the defense succeeds:
                 *
                 * - nothing is looted
                 * - all resources remain at the base
                 */
                let resourcesLooted = {
                  water: 0,
                  fire: 0,
                  grass: 0,
                };

                let resourcesRemaining = {
                  ...(
                    updatedResources[
                      defendingBase.id
                    ] ?? {
                      water: 0,
                      fire: 0,
                      grass: 0,
                    }
                  ),
                };


                /*
                 * -----------------------------------------------
                 * UPDATE DEFENDER SURVIVORS
                 * -----------------------------------------------
                 */
                updatedBases =
                  updatedBases.map((base) => {
                    if (
                      base.id !==
                      defendingBase.id
                    ) {
                      return base;
                    }

                    return {
                      ...base,

                      armies:
                        combatResult
                          .defenderSurvivors,
                    };
                  });


                /*
                 * -----------------------------------------------
                 * DESTROY THE BASE IF ATTACKER WON
                 * -----------------------------------------------
                 */
                if (
                  combatResult.baseDestroyed
                ) {
                  updatedBases =
                    updatedBases.filter(
                      (base) =>
                        base.id !==
                        defendingBase.id,
                    );
                }


                /*
                 * -----------------------------------------------
                 * COUNT SURVIVING ATTACKERS
                 * -----------------------------------------------
                 */
                const survivingAttackers =
                  combatResult
                    .attackerSurvivors;

                const totalSurvivors =
                  survivingAttackers.water +
                  survivingAttackers.fire +
                  survivingAttackers.grass;


                /*
                 * Returning attackers normally
                 * carry nothing.
                 *
                 * A successful raid can fill this
                 * with captured resources.
                 */
                let returningResources = {
                  water: 0,
                  fire: 0,
                  grass: 0,
                };


                /*
                 * -----------------------------------------------
                 * RAID LOOT
                 * -----------------------------------------------
                 *
                 * Only occurs if:
                 *
                 * - the base was destroyed
                 * - at least one attacker survived
                 */
                if (
                  combatResult.baseDestroyed &&
                  totalSurvivors > 0
                ) {
                  const defeatedResources =
                    updatedResources[
                      defendingBase.id
                    ] ?? {
                      water: 0,
                      fire: 0,
                      grass: 0,
                    };

                  /*
                   * Each survivor carries
                   * up to 200 resources.
                   */
                  const lootCapacity =
                    totalSurvivors * 200;

                  const lootResult =
                    calculateLoot(
                      defeatedResources,
                      lootCapacity,
                    );


                  /*
                   * Save final resource results
                   * for the Battle Report.
                   */
                  resourcesLooted = {
                    ...lootResult.loot,
                  };

                  resourcesRemaining = {
                    ...lootResult.remaining,
                  };


                  /*
                   * The attackers carry the loot
                   * home on their return mission.
                   */
                  returningResources = {
                    ...lootResult.loot,
                  };


                  /*
                   * The destroyed base no longer
                   * owns a resource bank.
                   */
                  delete updatedResources[
                    defendingBase.id
                  ];


                  /*
                   * ---------------------------------------------
                   * TREASURE CHEST
                   * ---------------------------------------------
                   *
                   * Anything that surviving attackers
                   * cannot carry stays on the tile.
                   */
                  const treasureRemaining =
                    lootResult.remaining.water +
                    lootResult.remaining.fire +
                    lootResult.remaining.grass;

                  if (
                    treasureRemaining > 0
                  ) {
                    updatedTreasures.push({
                      id: nextTreasureId,

                      row:
                        defendingBase.row,

                      col:
                        defendingBase.col,

                      resources: {
                        ...lootResult.remaining,
                      },
                    });

                    nextTreasureId += 1;
                  }
                }


                /*
                 * -----------------------------------------------
                 * BATTLE REPORT
                 * -----------------------------------------------
                 *
                 * IMPORTANT:
                 *
                 * The report is created AFTER both combat
                 * and loot have been resolved.
                 *
                 * That lets the public report show:
                 *
                 * - armies involved
                 * - survivors
                 * - resources looted
                 * - resources remaining
                 * - final battle result
                 */
                updatedBattleReports.push({
                  id:
                    nextBattleReportId,

                  gameSeconds:
                    current.gameSeconds + 1,

                  attackerPlayerId:
                    originBase.playerId,

                  defenderPlayerId:
                    defendingBase.playerId,

                  row:
                    defendingBase.row,

                  col:
                    defendingBase.col,

                  attackerArmies: {
                    ...mission.armies,
                  },

                  defenderArmies: {
                    ...defendingBase.armies,
                  },

                  attackerSurvivors: {
                    ...combatResult
                      .attackerSurvivors,
                  },

                  defenderSurvivors: {
                    ...combatResult
                      .defenderSurvivors,
                  },

                  resourcesLooted: {
                    ...resourcesLooted,
                  },

                  resourcesRemaining: {
                    ...resourcesRemaining,
                  },

                  militiaSurvived:
                    combatResult
                      .militiaSurvived,

                  baseDestroyed:
                    combatResult
                      .baseDestroyed,
                });

                nextBattleReportId += 1;


                /*
                 * -----------------------------------------------
                 * START RETURN TRIP
                 * -----------------------------------------------
                 *
                 * Only surviving attackers return.
                 */
                if (
                  totalSurvivors > 0
                ) {
                  const distance =
                    Math.abs(
                      originBase.row -
                        defendingBase.row,
                    ) +
                    Math.abs(
                      originBase.col -
                        defendingBase.col,
                    );

                  const returnTravelTime =
                    distance * 5;

                  updatedArmyMissions.push({
                    ...mission,

                    phase: "returning",

                    armies: {
                      ...survivingAttackers,
                    },

                    resources: {
                      ...returningResources,
                    },

                    secondsRemaining:
                      returnTravelTime,
                  });
                }

                /*
                 * Attack arrival is fully resolved.
                 */
                return;
              }


              /*
               * =================================================
               * MISSION ARRIVAL:
               * RETURNING ATTACK
               * =================================================
               *
               * Surviving attackers return to their
               * original base with any raid loot.
               */
              if (
                mission.type === "attack" &&
                mission.phase === "returning"
              ) {

                /*
                 * Return armies to origin.
                 */
                updatedBases =
                  updatedBases.map((base) => {
                    if (
                      base.id !==
                      mission.originBaseId
                    ) {
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


                /*
                 * Deposit raid loot at origin.
                 */
                const originResources =
                  updatedResources[
                    mission.originBaseId
                  ];

                if (originResources) {
                  updatedResources[
                    mission.originBaseId
                  ] = {
                    water:
                      originResources.water +
                      mission.resources.water,

                    fire:
                      originResources.fire +
                      mission.resources.fire,

                    grass:
                      originResources.grass +
                      mission.resources.grass,
                  };
                }

                return;
              }

              /*
              * =================================================
              * MISSION ARRIVAL:
              * OUTBOUND LOOT
              * =================================================
              *
              * Looting armies arrive at a treasure chest,
              * take as much as they can carry, then return home.
              */
              if (
                mission.type === "loot" &&
                mission.phase === "outbound"
              ) {
                const originBase = updatedBases.find(
                  (base) =>
                    base.id === mission.originBaseId,
                );

                const treasure = updatedTreasures.find(
                  (treasure) =>
                    treasure.id === mission.destinationBaseId,
                );

                /*
                 * If the origin base or treasure no longer exists,
                 * terminate the mission for now.
                 */
                if (!originBase || !treasure) {
                  return;
                }

                const totalArmies =
                  mission.armies.water +
                  mission.armies.fire +
                  mission.armies.grass;

                const lootCapacity =
                  totalArmies * 200;

                const lootResult = calculateLoot(
                  treasure.resources,
                  lootCapacity,
                );

                /*
                 * Update or remove the treasure chest.
                 */
                const remainingTotal =
                  lootResult.remaining.water +
                  lootResult.remaining.fire +
                  lootResult.remaining.grass;

                if (remainingTotal > 0) {
                  const treasureIndex =
                    updatedTreasures.findIndex(
                      (currentTreasure) =>
                        currentTreasure.id === treasure.id,
                    );

                  if (treasureIndex >= 0) {
                    updatedTreasures[treasureIndex] = {
                      ...treasure,

                      resources: {
                        ...lootResult.remaining,
                      },
                    };
                  }
                } else {
                  const treasureIndex =
                    updatedTreasures.findIndex(
                      (currentTreasure) =>
                        currentTreasure.id === treasure.id,
                    );

                  if (treasureIndex >= 0) {
                    updatedTreasures.splice(
                      treasureIndex,
                      1,
                    );
                  }
                }

                /*
                 * Return travel time uses the same Manhattan distance.
                 */
                const distance =
                  Math.abs(
                    originBase.row - treasure.row,
                  ) +
                  Math.abs(
                    originBase.col - treasure.col,
                  );

                const returnTravelTime =
                  distance * 5;

                /*
                 * Turn the outbound Loot mission into a returning mission.
                 *
                 * The mission now carries the captured resources.
                 */
                updatedArmyMissions.push({
                  ...mission,

                  phase: "returning",

                  resources: {
                    ...lootResult.loot,
                  },

                  secondsRemaining:
                    returnTravelTime,
                });

                return;
              }

              /*
               * =================================================
               * MISSION ARRIVAL:
               * RETURNING LOOT
               * =================================================
               *
               * Looting armies return home and deposit both
               * themselves and their captured resources.
               */
              if (
                mission.type === "loot" &&
                mission.phase === "returning"
              ) {
                updatedBases = updatedBases.map((base) => {
                  if (
                    base.id !== mission.originBaseId
                  ) {
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

                const originResources =
                  updatedResources[
                    mission.originBaseId
                  ];

                if (originResources) {
                  updatedResources[
                    mission.originBaseId
                  ] = {
                    water:
                      originResources.water +
                      mission.resources.water,

                    fire:
                      originResources.fire +
                      mission.resources.fire,

                    grass:
                      originResources.grass +
                      mission.resources.grass,
                  };
                }

                return;
              }

              /*
               * =================================================
               * MISSION ARRIVAL:
               * TRANSFER
               * =================================================
               *
               * Transfer armies and cargo arrive
               * at another friendly base.
               */
              if (
                mission.type === "transfer" &&
                mission.phase === "outbound"
              ) {

                /*
                 * Add armies.
                 */
                updatedBases =
                  updatedBases.map((base) => {
                    if (
                      base.id !==
                      mission.destinationBaseId
                    ) {
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


                /*
                 * Add cargo.
                 */
                const destinationResources =
                  updatedResources[
                    mission.destinationBaseId
                  ];

                if (
                  destinationResources
                ) {
                  updatedResources[
                    mission.destinationBaseId
                  ] = {
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
            },
          );


          /*
           * ==================================================
           * STEP 4:
           * RESOURCE PRODUCTION
           * ==================================================
           *
           * Every surviving base produces independently.
           *
           * Production =
           *
           * location multiplier
           * ×
           * tile multiplier
           */
          updatedBases.forEach((base) => {
            const tile =
              mapOne.find(
                (tile) =>
                  tile.row === base.row &&
                  tile.col === base.col,
              );

            if (!tile) {
              return;
            }

            const currentResources =
              updatedResources[
                base.id
              ];

            /*
             * Every legitimate base should
             * have a resource bank.
             */
            if (!currentResources) {
              return;
            }

            const locationMultiplier =
              getLocationMultiplier(
                base.timeInLocationSeconds,
              );

            const productionAmount =
              locationMultiplier *
              tile.multiplier;

            const resource =
              tile.resource;

            updatedResources[base.id] = {
              ...currentResources,

              [resource]:
                currentResources[
                  resource
                ] +
                productionAmount,
            };
          });


          /*
           * ==================================================
           * STEP 5:
           * SAVE THE COMPLETED GAME TICK
           * ==================================================
           */
          return {
            ...current,

            gameSeconds:
              current.gameSeconds + 1,

            bases:
              updatedBases,

            resourcesByBase:
              updatedResources,

            armyMissions:
              updatedArmyMissions,

            battleReports:
              updatedBattleReports,

            nextBattleReportId,

            treasures:
              updatedTreasures,

            nextTreasureId,
          };
        });
      }, 1000);


    /*
     * Stop the timer if App is ever removed.
     */
    return () =>
      window.clearInterval(timer);
  }, []);


  /*
   * ==========================================================
   * MAIN GAME UI
   * ==========================================================
   */
  return (
    <main className="app">

      {/* Top-left */}
      <BattleReports
        reports={gameState.battleReports}
        players={players}
      />

      {/* Top-center */}
      <ResourceBar
        water={selectedResources.water}
        fire={selectedResources.fire}
        grass={selectedResources.grass}
      />

      {/* Top-right */}
      <GameClock
        seconds={gameState.gameSeconds}
      />

      {/* Bottom-right */}
      <BaseActions
        key={selectedBaseId}
        base={selectedBase}
        resources={selectedResources}
        ownedBases={yourBases}
        enemyBases={enemyBases}
        onTrainArmy={handleTrainArmy}
        onTransferArmies={handleTransferArmies}
        onAttackArmies={handleAttackArmies}
        onStartAttackTargeting={handleStartAttackTargeting}
        onStartLootTargeting={handleStartLootTargeting}
      />

      {/* Traveling armies */}
      <ArmyMovements
        missions={gameState.armyMissions}
        bases={yourBases}
        treasures={gameState.treasures}
      />

      {/* Attack targeting instructions */}
      {targetingMode === "attack" && (
        <div className="targeting-banner">
          <span>Choose an enemy base to attack</span>

          <button onClick={cancelTargeting}>
            Cancel
          </button>
        </div>
      )}

      {/* Main battlefield */}
      <GameMap
        selectedBaseId={selectedBaseId}
        bases={gameState.bases}
        treasures={gameState.treasures}
        targetingMode={targetingMode}
        yourPlayerId={yourPlayerId}
        originBase={selectedBase}
        onAttackTargetSelected={handleAttackTargetSelected}
        onLootTargetSelected={handleLootTargetSelected}
      />


      {/*
       * ======================================================
       * BOTTOM-LEFT BASE SELECTOR
       * ======================================================
       *
       * Quick empire overview:
       *
       * - select a base
       * - see armies
       * - see stored resources
       */}
      <div className="base-selector">
        <div className="base-selector-title">
          {yourPlayer?.name ??
            "Your Bases"}
        </div>

        {yourBases.map(
          (base, index) => (
            <button
              key={base.id}
              className={[
                "base-selector-button",

                base.id ===
                selectedBaseId
                  ? "base-selector-button--selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                setSelectedBaseId(
                  base.id,
                )
              }
            >
              <span>
                Base {index + 1}
              </span>

              {/* Armies stationed here */}
              <span className="base-army-summary">
                ⚔️💧
                {base.armies.water}{" "}
                ⚔️🔥
                {base.armies.fire}{" "}
                ⚔️🌱
                {base.armies.grass}
              </span>

              {/* Resources stored here */}
              <span className="base-resource-summary">
                💧
                {Math.floor(
                  gameState
                    .resourcesByBase[
                    base.id
                  ]?.water ?? 0,
                )}{" "}

                🔥
                {Math.floor(
                  gameState
                    .resourcesByBase[
                    base.id
                  ]?.fire ?? 0,
                )}{" "}

                🌱
                {Math.floor(
                  gameState
                    .resourcesByBase[
                    base.id
                  ]?.grass ?? 0,
                )}
              </span>
            </button>
          ),
        )}
      </div>
    </main>
  );
}

export default App;