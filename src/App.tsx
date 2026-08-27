import { useEffect, useState } from "react";

import Lobby from "./components/Lobby";
import ArmyMovements from "./components/ArmyMovements";
import BaseActions from "./components/BaseActions";
import GameLog from "./components/GameLog";
import GameClock from "./components/GameClock";
import GameMap from "./components/GameMap";
import ResourceBar from "./components/ResourceBar";
import Leaderboard from "./components/Leaderboard";

import {
  bases as startingBases,
  players,
  startingResourcesByBase,
  getBaseName,
  matchTypes,
} from "./game/gameState";

import { mapOne } from "./game/maps/mapOne";

import {
  calculateLoot,
  getArmyCost,
  resolveCombat,
  calculatePlayerScore,
} from "./game/rules";

import type {
  LobbySlot,
  MatchConfig,
  MatchType,
  ArmyCounts,
  ArmyMission,
  GameEvent,
  BaseResources,
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


type GameState = {
  gameSeconds: number;

  matchType: MatchType;

  bases: typeof startingBases;

  resourcesByBase:
    typeof startingResourcesByBase;

  expansionKeysByPlayer:
    Record<number, number>;

  armyMissions: ArmyMission[];
  nextMissionId: number;

  gameEvents: GameEvent[];
  nextGameEventId: number;

  treasures: Treasure[];
  nextTreasureId: number;

  armiesTrainedByPlayer:
    Record<number, number>;

  armyResourcesSpentByPlayer:
    Record<number, number>;

  finalScoreByPlayer:
    Record<number, number>;

  eliminatedPlayerIds: number[];

  winnerPlayerId: number | null;
};


function createInitialGameState(
  activePlayerIds: number[] =
    players.map(
      (player) => player.id,
    ),

  matchType: MatchType = "30m",
): GameState {
  return {
    gameSeconds: 0,

    matchType,

    /*
     * Fresh copies so a reset cannot accidentally
     * reuse mutated live-game objects.
     */
    bases:
      startingBases
        .filter(
          (base) =>
            activePlayerIds.includes(
              base.playerId,
            ),
        )
        .map((base) => ({
          ...base,

          armies: {
            ...base.armies,
          },

          armiesBuilt: {
            ...base.armiesBuilt,
          },

          training:
            base.training
              ? { ...base.training }
              : null,
        })),

    resourcesByBase:
      Object.fromEntries(
        Object.entries(
          startingResourcesByBase,
        )
          .filter(([baseId]) => {
            const base =
              startingBases.find(
                (base) =>
                  base.id ===
                  Number(baseId),
              );

            return (
              base !== undefined &&
              activePlayerIds.includes(
                base.playerId,
              )
            );
          })
          .map(
            ([baseId, resources]) => [
              Number(baseId),
              {
                ...resources,
              },
            ],
          ),
      ),

    expansionKeysByPlayer:
      Object.fromEntries(
        activePlayerIds.map(
          (playerId) => [
            playerId,
            1,
          ],
        ),
      ),

    armiesTrainedByPlayer:
      Object.fromEntries(
        activePlayerIds.map(
          (playerId) => [
            playerId,
            0,
          ],
        ),
      ),

    armyResourcesSpentByPlayer:
      Object.fromEntries(
        activePlayerIds.map(
          (playerId) => [
            playerId,
            0,
          ],
        ),
      ),

    finalScoreByPlayer: {},

    armyMissions: [],
    nextMissionId: 1,

    gameEvents: [],
    nextGameEventId: 1,

    treasures: [],
    nextTreasureId: 1,

    eliminatedPlayerIds: [],

    winnerPlayerId: null,
  };
}

function createLobbySlots(
  playerCount: number,
): LobbySlot[] {
  return Array.from(
    { length: playerCount },
    (_, index) => ({
      slotId: index + 1,

      playerId:
        index === 0
          ? 1
          : null,

      isReady: false,
    }),
  );
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
  const [
    yourPlayerId,
    setYourPlayerId,
  ] = useState(1);

  /*
   * ==========================================================
   * LOBBY STATE
   * ==========================================================
   *
   * The Lobby state where characters are chosen and pre-game
   * decisions are made
   */

   const [isGameStarted, setIsGameStarted] =
     useState(false);

   const [lobbySlots, setLobbySlots] =
     useState<LobbySlot[]>(
       createLobbySlots(4),
     );

   const [matchConfig, setMatchConfig] =
     useState<MatchConfig>({
       mapId: "exile-island",
       matchType: "30m",
     });

   function handleJoinSlot(
      slotId: number,
    ) {
      setLobbySlots((current) => {
        const claimedPlayerIds =
          current
            .map(
              (slot) => slot.playerId,
            )
            .filter(
              (playerId):
                playerId is number =>
                  playerId !== null,
            );

        const availablePlayer =
          players.find(
            (player) =>
              !claimedPlayerIds.includes(
                player.id,
              ),
          );

        if (!availablePlayer) {
          return current;
        }

        return current.map((slot) =>
          slot.slotId === slotId
            ? {
                ...slot,

                playerId:
                  availablePlayer.id,

                isReady: false,
              }
            : slot,
        );
      });
    }

   function handleMatchTypeChange(
     matchType: MatchType,
   ) {
     setMatchConfig((current) => ({
       ...current,
       matchType,
     }));
   }

   function handleCharacterChange(
     slotId: number,
     playerId: number,
   ) {
     setLobbySlots((current) => {
       const alreadyClaimed =
         current.some(
           (slot) =>
             slot.slotId !== slotId &&
             slot.playerId === playerId,
         );

       if (alreadyClaimed) {
         return current;
       }

       return current.map((slot) =>
         slot.slotId === slotId
           ? {
               ...slot,
               playerId,
               isReady: false,
             }
           : slot,
       );
     });
   }

   function handleLeaveSlot(
      slotId: number,
    ) {
      /*
       * Slot 1 is the host and cannot leave.
       */
      if (slotId === 1) {
        return;
      }

      setLobbySlots((current) =>
        current.map((slot) =>
          slot.slotId === slotId
            ? {
                ...slot,
                playerId: null,
                isReady: false,
              }
            : slot,
        ),
      );
    }

   function handleToggleReady(
     slotId: number,
   ) {
     setLobbySlots((current) =>
       current.map((slot) =>
         slot.slotId === slotId
           ? {
               ...slot,
               isReady:
                 !slot.isReady,
             }
           : slot,
       ),
     );
   }

   function handleStartGame() {
      const activePlayerIds =
        lobbySlots
          .map(
            (slot) =>
              slot.playerId,
          )
          .filter(
            (playerId):
              playerId is number =>
                playerId !== null,
          );

      const newGameState =
        createInitialGameState(
          activePlayerIds,
          matchConfig.matchType,
        );

      setGameState(
        newGameState,
      );

      /*
       * Slot 1 is the host/local player.
       */
      const hostPlayerId =
        lobbySlots[0]?.playerId;

      if (
        hostPlayerId !== null &&
        hostPlayerId !== undefined
      ) {
        setYourPlayerId(
          hostPlayerId,
        );

        const hostBase =
          newGameState.bases.find(
            (base) =>
              base.playerId ===
              hostPlayerId,
          );

        if (hostBase) {
          setSelectedBaseId(
            hostBase.id,
          );
        }
      }

      setTargetingMode(null);

      setIsGameStarted(true);
    }

  /*
   * ==========================================================
   * LIVE GAME STATE
   * ==========================================================
   *
   * Everything that changes while a match is running lives
   * here.
   */
  const [gameState, setGameState] =
    useState<GameState>(
      createInitialGameState,
    );

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

  const activePlayerIds =
    lobbySlots
      .map(
        (slot) =>
          slot.playerId,
      )
      .filter(
        (playerId):
          playerId is number =>
            playerId !== null,
      );

  const yourExpansionKeys =
    gameState.expansionKeysByPlayer[
      yourPlayerId
    ] ?? 0;

  const youAreEliminated =
    gameState.eliminatedPlayerIds.includes(
      yourPlayerId,
    );

  const winner =
    gameState.winnerPlayerId !== null
      ? players.find(
          (player) =>
            player.id ===
            gameState.winnerPlayerId,
        )
      : undefined;

  const finalStandings = players
    .filter((player) =>
      Object.prototype.hasOwnProperty.call(
        gameState.armiesTrainedByPlayer,
        player.id,
      ),
    )
    .map((player) => {
      const isEliminated =
        gameState.eliminatedPlayerIds.includes(
          player.id,
        );

      const score =
        isEliminated
          ? gameState.finalScoreByPlayer[
              player.id
            ] ?? 0
          : calculatePlayerScore(
              player.id,
              gameState.bases,
              gameState.resourcesByBase,
              gameState.armyMissions,
              gameState.armiesTrainedByPlayer[
                player.id
              ] ?? 0,
              gameState.armyResourcesSpentByPlayer[
                player.id
              ] ?? 0,
            ).totalScore;

      return {
        player,
        score,
        isEliminated,
      };
    })
    .sort((a, b) => {
      if (
        a.player.id ===
        gameState.winnerPlayerId
      ) {
        return -1;
      }

      if (
        b.player.id ===
        gameState.winnerPlayerId
      ) {
        return 1;
      }

      return b.score - a.score;
    });

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
  useState<
    "attack" | "loot" | "expand" | "transfer" | "relocate" | null
  >(null);

  const [pendingAttackArmies, setPendingAttackArmies] =
    useState<ArmyCounts | null>(null);

  const [pendingLootArmies, setPendingLootArmies] =
    useState<ArmyCounts | null>(null);

  const [pendingExpansionPayment, setPendingExpansionPayment] =
    useState<BaseResources | null>(null);

  const [pendingTransferArmies, setPendingTransferArmies] =
    useState<ArmyCounts | null>(null);

  const [pendingTransferResources, setPendingTransferResources] =
    useState<BaseResources | null>(null);

  const [pendingRelocationPayment, setPendingRelocationPayment] =
    useState<BaseResources | null>(null);

  function cancelTargeting() {
    setTargetingMode(null);

    setPendingAttackArmies(null);
    setPendingLootArmies(null);
    setPendingExpansionPayment(null);
    setPendingTransferArmies(null);
    setPendingTransferResources(null);
  }

  function handleDevPlayerSwitch(
    playerId: number,
  ) {
    setYourPlayerId(playerId);

    const firstBase =
      gameState.bases.find(
        (base) =>
          base.playerId === playerId,
      );

    if (firstBase) {
      setSelectedBaseId(
        firstBase.id,
      );
    }

    /*
     * Cancel any targeting operation that belonged
     * to the previously controlled player.
     */
    setTargetingMode(null);

    setPendingAttackArmies(null);
    setPendingTransferArmies(null);
    setPendingTransferResources(null);
    setPendingExpansionPayment(null);
    setPendingRelocationPayment(null);
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
        playerId: originBase.playerId,

        type: "attack",
        phase: "outbound",

        originBaseId:
          originBase.id,

        destinationBaseId:
          destinationBase.id,

        destinationRow:
          destinationBase.row,

        destinationCol:
          destinationBase.col,

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

        expansionKeys: 0,

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
          playerId: originBase.playerId,

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

          expansionKeys: 0,

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
   * TRANSFER TARGET SELECTED
   * ==========================================================
   *
   * Called when the player clicks one of their other bases
   * while the map is in Transfer Targeting Mode.
   */
  function handleTransferTargetSelected(
    destinationBaseId: number,
  ) {
    if (
      !pendingTransferArmies ||
      !pendingTransferResources
    ) {
      return;
    }

    /*
     * Launch the normal Transfer mission using the
     * armies and cargo we saved before entering
     * map targeting.
     */
    handleTransferArmies(
      destinationBaseId,
      pendingTransferArmies,
      pendingTransferResources,
    );

    /*
     * Clear targeting state now that the mission
     * has been launched.
     */
    setPendingTransferArmies(null);
    setPendingTransferResources(null);
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
        playerId: originBase.playerId,

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

        expansionKeys: 0,

        secondsRemaining:
          travelTime,

        destinationRow:
          destinationBase.row,

        destinationCol:
          destinationBase.col,
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
          base.armiesBuilt[resource],
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
  * EXPANSION
  * ==========================================================
  *
  * Expand to an open location on the map
  *
  */
  function getNextBaseId(
    bases: typeof startingBases,
  ) {
    return (
      Math.max(
        0,
        ...bases.map((base) => base.id),
      ) + 1
    );
  }

  function handleStartExpandTargeting(
    payment: BaseResources,
  ) {
    setPendingExpansionPayment({
      ...payment,
    });

    setTargetingMode("expand");
  }

  function handleExpandTargetSelected(
      row: number,
      col: number,
    ) {
      if (!pendingExpansionPayment) {
        return;
      }

      setGameState((current) => {
        const originBase = current.bases.find(
          (base) => base.id === selectedBaseId,
        );

        if (!originBase) {
          return current;
        }

        /*
         * Must still have room for another base.
         */
        const playerBaseCount =
          current.bases.filter(
            (base) =>
              base.playerId === yourPlayerId,
          ).length;

        if (playerBaseCount >= 3) {
          return current;
        }

        /*
         * Destination must still be empty.
         */
        const destinationOccupied =
          current.bases.some(
            (base) =>
              base.row === row &&
              base.col === col,
          );

        const destinationHasTreasure =
          current.treasures.some(
            (treasure) =>
              treasure.row === row &&
              treasure.col === col,
          );

        if (
          destinationOccupied ||
          destinationHasTreasure
        ) {
          return current;
        }

        /*
         * Player must still own an Expansion Key.
         */
        const currentKeys =
          current.expansionKeysByPlayer[
            yourPlayerId
          ] ?? 0;

        if (currentKeys < 1) {
          return current;
        }

        /*
         * The selected base must still be able
         * to afford the exact chosen payment.
         */
        const baseResources =
          current.resourcesByBase[
            originBase.id
          ];

        if (!baseResources) {
          return current;
        }

        const paymentTotal =
          pendingExpansionPayment.water +
          pendingExpansionPayment.fire +
          pendingExpansionPayment.grass;

        if (paymentTotal !== 500) {
          return current;
        }

        if (
          pendingExpansionPayment.water >
            baseResources.water ||
          pendingExpansionPayment.fire >
            baseResources.fire ||
          pendingExpansionPayment.grass >
            baseResources.grass
        ) {
          return current;
        }

        /*
         * Pay the 500 resources immediately.
         */
        const updatedResources = {
          ...current.resourcesByBase,

          [originBase.id]: {
            water:
              baseResources.water -
              pendingExpansionPayment.water,

            fire:
              baseResources.fire -
              pendingExpansionPayment.fire,

            grass:
              baseResources.grass -
              pendingExpansionPayment.grass,
          },
        };

        /*
         * Spend one global Expansion Key.
         */
        const updatedExpansionKeysByPlayer = {
          ...current.expansionKeysByPlayer,

          [yourPlayerId]:
            currentKeys - 1,
        };

        /*
         * Settler travel uses the normal
         * 5-seconds-per-tile movement rate for now.
         */
        const distance =
          Math.abs(
            originBase.row - row,
          ) +
          Math.abs(
            originBase.col - col,
          );

        const travelTime =
          distance * 5;

        const newMission: ArmyMission = {
          id: current.nextMissionId,
          playerId: originBase.playerId,

          type: "expand",
          phase: "outbound",

          originBaseId:
            originBase.id,

          /*
           * This field is still named destinationBaseId,
           * but for Expansion we temporarily store 0.
           * The real destination is held below by row/col.
           */
          destinationBaseId: 0,

          armies: {
            water: 0,
            fire: 0,
            grass: 0,
          },

          resources: {
            ...pendingExpansionPayment,
          },

          expansionKeys: 1,

          destinationRow: row,
          destinationCol: col,

          secondsRemaining:
            travelTime,
        };

        return {
          ...current,

          resourcesByBase:
            updatedResources,

          expansionKeysByPlayer:
            updatedExpansionKeysByPlayer,

          armyMissions: [
            ...current.armyMissions,
            newMission,
          ],

          nextMissionId:
            current.nextMissionId + 1,
        };
      });

      setPendingExpansionPayment(null);
      setTargetingMode(null);
    }

  function handleStartTransferTargeting(
      armies: ArmyCounts,
      resources: BaseResources,
    ) {
      setPendingTransferArmies({
        ...armies,
      });

      setPendingTransferResources({
        ...resources,
      });

      setTargetingMode("transfer");
    }

  function handleStartRelocateTargeting(
    payment: BaseResources,
  ) {
    setPendingRelocationPayment(payment);
    setTargetingMode("relocate");
  }

  function handleRelocateTargetSelected(
      row: number,
      col: number,
    ) {
      if (!pendingRelocationPayment) {
        return;
      }

      setGameState((current) => {
        const originBase =
          current.bases.find(
            (base) =>
              base.id === selectedBaseId,
          );

        if (!originBase) {
          return current;
        }

        const destinationOccupied =
          current.bases.some(
            (base) =>
              base.row === row &&
              base.col === col,
          );

        const destinationHasTreasure =
          current.treasures.some(
            (treasure) =>
              treasure.row === row &&
              treasure.col === col,
          );

        if (
          destinationOccupied ||
          destinationHasTreasure
        ) {
          return current;
        }

        const relocationCost =
          (originBase.relocations + 1) * 250;

        const paymentTotal =
          pendingRelocationPayment.water +
          pendingRelocationPayment.fire +
          pendingRelocationPayment.grass;

        if (paymentTotal !== relocationCost) {
          return current;
        }

        const baseResources =
          current.resourcesByBase[
            originBase.id
          ];

        if (!baseResources) {
          return current;
        }

        if (
          pendingRelocationPayment.water >
            baseResources.water ||
          pendingRelocationPayment.fire >
            baseResources.fire ||
          pendingRelocationPayment.grass >
            baseResources.grass
        ) {
          return current;
        }

        /*
         * Pay relocation cost immediately.
         */
        const updatedResources = {
          ...current.resourcesByBase,

          [originBase.id]: {
            water:
              baseResources.water -
              pendingRelocationPayment.water,

            fire:
              baseResources.fire -
              pendingRelocationPayment.fire,

            grass:
              baseResources.grass -
              pendingRelocationPayment.grass,
          },
        };

        const updatedBases =
          current.bases.map((base) => {
            if (base.id !== originBase.id) {
              return base;
            }

            return {
              ...base,

              /*
               * The base still EXISTS for elimination/base-count
               * purposes, but it is no longer physically on the map.
               */
              isRelocating: true,

              /*
               * Armies are traveling with the base.
               */
              armies: {
                water: 0,
                fire: 0,
                grass: 0,
              },
            };
          });

        const distance =
          Math.abs(
            originBase.row - row,
          ) +
          Math.abs(
            originBase.col - col,
          );

        const travelTime =
          distance * 15;

        const newMission: ArmyMission = {
          id: current.nextMissionId,
          playerId: originBase.playerId,

          type: "relocate",
          phase: "outbound",

          originBaseId:
            originBase.id,

          destinationBaseId: 0,

          armies: {
            ...originBase.armies,
          },

          resources: {
            ...updatedResources[
              originBase.id
            ],
          },

          relocationPayment: {
            ...pendingRelocationPayment,
          },

          expansionKeys: 0,

          destinationRow: row,
          destinationCol: col,

          secondsRemaining:
            travelTime,
        };

        delete updatedResources[originBase.id];

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

      setPendingRelocationPayment(null);
      setTargetingMode(null);
    }

  function handlePlayAgain() {
    setIsGameStarted(false);

    setLobbySlots((currentSlots) =>
      currentSlots.map((slot) => ({
        ...slot,
        isReady: false,
      })),
    );

    setTargetingMode(null);

    setPendingAttackArmies(null);
    setPendingTransferArmies(null);
    setPendingTransferResources(null);
    setPendingExpansionPayment(null);
    setPendingRelocationPayment(null);
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
           * Once a winner has been declared,
           * the game state is completely frozen.
           */
          if (current.winnerPlayerId !== null) {
            return current;
            }

          const currentMatchType =
            matchTypes[
              current.matchType
            ];

          const matchDurationSeconds =
            currentMatchType.durationMinutes !== null
              ? currentMatchType.durationMinutes * 60
              : null;

          const updatedArmiesTrainedByPlayer = {
            ...current.armiesTrainedByPlayer,
          };

          const updatedArmyResourcesSpentByPlayer = {
            ...current.armyResourcesSpentByPlayer,
          };

          /*
           * ==================================================
           * STEP 1:
           * AGE BASES AND PROCESS TRAINING
           * ==================================================
           */
          let updatedBases =
            current.bases.map((base) => {

              /*
               * A relocating base still exists, but it does not
               * age, train armies, or otherwise operate while moving.
               */
              if (base.isRelocating) {
                return base;
              }

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

                  updatedArmiesBuilt = {
                    ...base.armiesBuilt,

                    [resource]:
                      base.armiesBuilt[resource] + 1,
                  };

                  const completedArmyCost =
                    getArmyCost(
                      base.armiesBuilt[resource],
                    );

                  updatedArmiesTrainedByPlayer[
                    base.playerId
                  ] =
                    (
                      updatedArmiesTrainedByPlayer[
                        base.playerId
                     ] ?? 0
                    ) + 1;

                  updatedArmyResourcesSpentByPlayer[
                    base.playerId
                  ] =
                    (
                      updatedArmyResourcesSpentByPlayer[
                        base.playerId
                      ] ?? 0
                    ) +
                    completedArmyCost;

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

          const updatedExpansionKeysByPlayer = {
            ...current.expansionKeysByPlayer,
          };

          const updatedGameEvents = [
            ...current.gameEvents,
          ];

          let nextGameEventId =
            current.nextGameEventId;

          const updatedTreasures = [
            ...current.treasures,
          ];

          let nextTreasureId =
            current.nextTreasureId;

          const updatedArmyMissions:
            ArmyMission[] = [];

          const updatedEliminatedPlayerIds = [
            ...current.eliminatedPlayerIds,
          ];

          const updatedFinalScoreByPlayer = {
            ...current.finalScoreByPlayer,
          };

          let updatedWinnerPlayerId:
            number | null =
              current.winnerPlayerId;

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
                 * If the origin base is gone,
                 * the mission has nowhere to return.
                 */
                if (!originBase) {
                  return;
                }

                /*
                 * If the target base was destroyed before
                 * this army arrived, turn around and go home.
                 */
                if (!defendingBase) {
                  const distance =
                    Math.abs(
                      originBase.row -
                        mission.destinationRow!,
                    ) +
                    Math.abs(
                      originBase.col -
                        mission.destinationCol!,
                    );

                  updatedArmyMissions.push({
                    ...mission,

                    phase: "returning",

                    secondsRemaining:
                      distance * 5,
                  });

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

                const defenderScoreBeforeDestruction =
                  calculatePlayerScore(
                    defendingBase.playerId,
                    updatedBases,
                    updatedResources,
                    updatedArmyMissions,
                    updatedArmiesTrainedByPlayer[
                      defendingBase.playerId
                    ] ?? 0,
                    updatedArmyResourcesSpentByPlayer[
                      defendingBase.playerId
                    ] ?? 0,
                  ).totalScore;

                /*
                 * -----------------------------------------------
                 * DESTROY THE BASE IF ATTACKER WON
                 * -----------------------------------------------
                 */

                let eliminatedPlayerId:
                  number | undefined;

                if (
                  combatResult.baseDestroyed
                ) {
                  /*
                   * Remove the destroyed base.
                   */
                  updatedBases =
                    updatedBases.filter(
                      (base) =>
                        base.id !==
                        defendingBase.id,
                    );

                  /*
                   * Check whether the defender still owns
                   * any other bases anywhere on the map.
                   */
                  const defenderStillHasBase =
                    updatedBases.some(
                      (base) =>
                        base.playerId ===
                        defendingBase.playerId,
                    );

                  /*
                   * Zero bases = immediate elimination.
                   *
                   * Armies, settlers, loot, keys, etc. that are
                   * still traveling do NOT keep the player alive.
                   */
                  if (
                    !defenderStillHasBase &&
                    !updatedEliminatedPlayerIds.includes(
                      defendingBase.playerId,
                    )
                  ) {
                    updatedEliminatedPlayerIds.push(
                      defendingBase.playerId,
                    );

                    updatedFinalScoreByPlayer[
                      defendingBase.playerId
                    ] =
                      defenderScoreBeforeDestruction;

                    updatedGameEvents.push({
                      type: "elimination",

                      id: nextGameEventId,

                      gameSeconds:
                        current.gameSeconds + 1,

                      eliminatedPlayerId:
                        defendingBase.playerId,

                      eliminatedByPlayerId:
                        originBase.playerId,
                    });

                    nextGameEventId += 1;

                    /*
                     * Save this so the Battle Report can announce
                     * who was eliminated.
                     */
                    eliminatedPlayerId =
                      defendingBase.playerId;

                    const activePlayerIds =
                      Object.keys(
                        updatedArmiesTrainedByPlayer,
                      ).map(Number);

                    const remainingPlayers =
                      players.filter(
                        (player) =>
                          activePlayerIds.includes(
                            player.id,
                          ) &&
                          !updatedEliminatedPlayerIds.includes(
                            player.id,
                          ),
                      );

                    if (
                      remainingPlayers.length === 1
                    ) {
                      updatedWinnerPlayerId =
                        remainingPlayers[0].id;

                      updatedGameEvents.push({
                        type: "victory",

                        id: nextGameEventId,

                        gameSeconds:
                          current.gameSeconds + 1,

                        winnerPlayerId:
                          remainingPlayers[0].id,
                      });

                      nextGameEventId += 1;
                    }
                  }
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

                const returningExpansionKeys =
                    combatResult.baseDestroyed &&
                    totalSurvivors > 0
                      ? 1
                      : 0;

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
                updatedGameEvents.push({
                  type: "battle",

                  report: {
                    id:
                      nextGameEventId,

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

                    attackerBaseName:
                      getBaseName(
                        originBase.playerId,
                        originBase.baseSlot,
                      ),

                    defenderBaseName:
                      getBaseName(
                        defendingBase.playerId,
                        defendingBase.baseSlot,
                      ),

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

                    eliminatedPlayerId,
                  },
                });

                nextGameEventId += 1;


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

                    expansionKeys:
                      returningExpansionKeys,

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

                /*
                 * Find the base the victorious army returned to.
                 * We use its playerId to credit the global Expansion Key.
                 */
                const returningOriginBase =
                  updatedBases.find(
                    (base) =>
                      base.id === mission.originBaseId,
                  );

                if (
                  returningOriginBase &&
                  mission.expansionKeys > 0
                ) {
                  const playerId =
                    returningOriginBase.playerId;

                  updatedExpansionKeysByPlayer[
                    playerId
                  ] =
                    (
                      updatedExpansionKeysByPlayer[
                        playerId
                      ] ?? 0
                    ) +
                    mission.expansionKeys;
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

                updatedGameEvents.push({
                  type: "loot",

                  id: nextGameEventId,

                  gameSeconds:
                    current.gameSeconds + 1,

                  playerId:
                    originBase.playerId,

                  row:
                    treasure.row,

                  col:
                    treasure.col,

                  resourcesLooted: {
                    ...lootResult.loot,
                  },

                  resourcesRemaining: {
                    ...lootResult.remaining,
                  },
                });

                nextGameEventId += 1;

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
             * EXPANSION
             * =================================================
             *
             * Settlers arrive at the chosen tile and establish
             * a new base if the location is still available.
             */
            if (
              mission.type === "expand" &&
              mission.phase === "outbound"
            ) {
              const originBase = updatedBases.find(
                (base) =>
                  base.id === mission.originBaseId,
              );

              /*
               * Expansion missions must have destination
               * coordinates.
               */
              if (
                !originBase ||
                mission.destinationRow === undefined ||
                mission.destinationCol === undefined
              ) {
                return;
              }

              const destinationOccupied =
                updatedBases.some(
                  (base) =>
                    base.row === mission.destinationRow &&
                    base.col === mission.destinationCol,
                );

              const destinationHasTreasure =
                updatedTreasures.some(
                  (treasure) =>
                    treasure.row === mission.destinationRow &&
                    treasure.col === mission.destinationCol,
                );

              /*
               * If someone got there first or treasure is still
               * present, expansion fails for now.
               *
               * We will add return/refund behavior later.
               */
              if (
                  destinationOccupied ||
                  destinationHasTreasure
                ) {
                  /*
                   * Someone beat us to the destination.
                   *
                   * Settlers turn around and carry the original
                   * Expansion Key + 500-resource payment home.
                   */
                  const distance =
                    Math.abs(
                      originBase.row -
                        mission.destinationRow,
                    ) +
                    Math.abs(
                      originBase.col -
                        mission.destinationCol,
                    );

                  const returnTravelTime =
                    distance * 5;

                  updatedArmyMissions.push({
                    ...mission,

                    phase: "returning",

                    secondsRemaining:
                      returnTravelTime,
                  });

                  return;
                }

              /*
               * Create the new base.
               */
              const newBaseId =
                getNextBaseId(updatedBases);

              const usedBaseSlots =
                updatedBases
                  .filter(
                    (base) =>
                      base.playerId === originBase.playerId,
                  )
                  .map(
                    (base) => base.baseSlot,
                  );

              const newBaseSlot =
                ([1, 2, 3] as const).find(
                  (slot) =>
                    !usedBaseSlots.includes(slot),
                );

              if (newBaseSlot === undefined) {
                return;
              }

              updatedBases.push({
                id: newBaseId,

                playerId: originBase.playerId,
                baseSlot: newBaseSlot,

                row: mission.destinationRow,
                col: mission.destinationCol,

                timeInLocationSeconds: 0,
                isRelocating: false,

                armies: {
                  water: 0,
                  fire: 0,
                  grass: 0,
                },

                armiesBuilt: {
                  water: 0,
                  fire: 0,
                  grass: 0,
                },
                training: null,
                relocations: 0,
              });

              /*
               * New bases begin with the same starting resources
               * as all other bases.
               */
              updatedResources[newBaseId] = {
                water: 50,
                fire: 50,
                grass: 50,
              };

              updatedGameEvents.push({
                type: "expansion",

                id: nextGameEventId,

                gameSeconds:
                  current.gameSeconds + 1,

                playerId:
                  originBase.playerId,

                baseName:
                  getBaseName(
                    originBase.playerId,
                    newBaseSlot,
                  ),

                row:
                  mission.destinationRow,

                col:
                  mission.destinationCol,
              });

              nextGameEventId += 1;

                return;
            }

            /*
             * =================================================
             * MISSION ARRIVAL:
             * RETURNING EXPANSION
             * =================================================
             *
             * Failed settlers return their Expansion Key
             * and 500-resource payment to the origin base.
             */
            if (
              mission.type === "expand" &&
              mission.phase === "returning"
            ) {
              const originBase =
                updatedBases.find(
                  (base) =>
                    base.id === mission.originBaseId,
                );

              /*
               * If the origin base was destroyed while the
               * settlers were away, everything is lost.
               */
              if (!originBase) {
                return;
              }

              /*
               * Refund the 500-resource payment.
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

              /*
               * Refund the global Expansion Key.
               */
              const playerId =
                originBase.playerId;

              updatedExpansionKeysByPlayer[
                playerId
              ] =
                (
                  updatedExpansionKeysByPlayer[
                    playerId
                  ] ?? 0
                ) +
                mission.expansionKeys;

              return;
            }

              /*
               * =================================================
               * MISSION ARRIVAL:
               * RELOCATION
               * =================================================
               *
               * The existing base arrives at its new location.
               */
              if (
                mission.type === "relocate" &&
                mission.phase === "outbound"
              ) {
                if (
                  mission.destinationRow === undefined ||
                  mission.destinationCol === undefined
                ) {
                  return;
                }

                const relocatingBase =
                  updatedBases.find(
                    (base) =>
                      base.id === mission.originBaseId,
                  );

                if (!relocatingBase) {
                  return;
                }

                /*
                 * Check whether another base or treasure now
                 * occupies the intended destination.
                 */
                const destinationOccupied =
                  updatedBases.some(
                    (base) =>
                      base.id !== relocatingBase.id &&
                      !base.isRelocating &&
                      base.row === mission.destinationRow &&
                      base.col === mission.destinationCol,
                  );

                const destinationHasTreasure =
                  updatedTreasures.some(
                    (treasure) =>
                      treasure.row === mission.destinationRow &&
                      treasure.col === mission.destinationCol,
                  );

                /*
                 * Destination is blocked.
                 *
                 * Turn around and return to the base's
                 * original location.
                 */
                if (
                  destinationOccupied ||
                  destinationHasTreasure
                ) {
                  const returnDistance =
                    Math.abs(
                      relocatingBase.row -
                        mission.destinationRow,
                    ) +
                    Math.abs(
                      relocatingBase.col -
                        mission.destinationCol,
                    );

                  updatedArmyMissions.push({
                    ...mission,

                    phase: "returning",

                    secondsRemaining:
                      returnDistance * 15,
                  });

                  return;
                }

                /*
                 * Destination is still available.
                 * Complete the relocation normally.
                 */
                updatedBases =
                  updatedBases.map((base) => {
                    if (
                      base.id !== relocatingBase.id
                    ) {
                      return base;
                    }

                    return {
                      ...base,

                      row: mission.destinationRow!,
                      col: mission.destinationCol!,

                      isRelocating: false,

                      /*
                       * Successful relocation increases this
                       * base's NEXT relocation cost by 250.
                       */
                      relocations:
                        base.relocations + 1,

                      armies: {
                        ...mission.armies,
                      },
                    };
                  });

                /*
                 * Restore the resource bank at the new location.
                 */
                updatedResources[
                  relocatingBase.id
                ] = {
                  ...mission.resources,
                };

                /*
                 * Record the successful relocation
                 * in the public Game Log.
                 *
                 * relocatingBase still contains the ORIGINAL
                 * row/col, which is exactly what we need here.
                 */
                updatedGameEvents.push({
                  type: "relocation",

                  id: nextGameEventId,

                  gameSeconds:
                    current.gameSeconds + 1,

                  playerId:
                    relocatingBase.playerId,

                  baseName:
                    getBaseName(
                      relocatingBase.playerId,
                      relocatingBase.baseSlot,
                    ),

                  fromRow:
                    relocatingBase.row,

                  fromCol:
                    relocatingBase.col,

                  toRow:
                    mission.destinationRow,

                  toCol:
                    mission.destinationCol,
                });

                nextGameEventId += 1;

                return;
              }

              /*
               * =================================================
               * MISSION ARRIVAL:
               * RETURNING RELOCATION
               * =================================================
               *
               * A relocation failed because its destination
               * became occupied.
               *
               * The base now tries to return to its original tile.
               *
               * If the original tile is also occupied, the
               * relocating base is lost.
               */
              if (
                mission.type === "relocate" &&
                mission.phase === "returning"
              ) {
                const relocatingBase =
                  updatedBases.find(
                    (base) =>
                      base.id === mission.originBaseId,
                 );

                /*
                 * If the relocating base somehow no longer exists,
                 * there is nothing left to restore.
                 */
                if (!relocatingBase) {
                  return;
                }

                /*
                 * Check whether another active base now occupies
                 * the original tile.
                 *
                 * The relocating base itself does not count.
                 */
                const originalOccupied =
                  updatedBases.some(
                    (base) =>
                      base.id !== relocatingBase.id &&
                      !base.isRelocating &&
                      base.row === relocatingBase.row &&
                      base.col === relocatingBase.col,
                  );

                /*
                 * Treasure also prevents the base from returning
                 * to its original tile.
                 */
                const originalHasTreasure =
                  updatedTreasures.some(
                    (treasure) =>
                      treasure.row === relocatingBase.row &&
                      treasure.col === relocatingBase.col,
                  );

                /*
                 * -----------------------------------------------
                 * ORIGINAL TILE IS BLOCKED
                 * -----------------------------------------------
                 *
                 * The base is lost.
                 *
                 * Everything traveling with it is also lost:
                 * - armies
                 * - resources
                 *
                 * We do NOT restore its resource bank.
                 */
                if (
                  originalOccupied ||
                  originalHasTreasure
                ) {
                  /*
                   * The base tried to return home, but its
                   * original tile is no longer available.
                   *
                   * The relocating base and everything traveling
                   * with it are permanently lost.
                   */
                  updatedBases =
                    updatedBases.filter(
                      (base) =>
                        base.id !== relocatingBase.id,
                    );

                  delete updatedResources[
                    relocatingBase.id
                  ];

                  /*
                   * Check whether this player still has any
                   * other bases.
                   *
                   * Relocating bases still count because they
                   * remain in updatedBases until they are lost.
                   */
                  const playerStillHasBase =
                    updatedBases.some(
                      (base) =>
                        base.playerId ===
                        relocatingBase.playerId,
                    );

                  /*
                   * Losing the final base means immediate
                   * elimination.
                   */
                  if (
                    !playerStillHasBase &&
                    !updatedEliminatedPlayerIds.includes(
                      relocatingBase.playerId,
                    )
                  ) {
                    updatedEliminatedPlayerIds.push(
                      relocatingBase.playerId,
                    );

                    updatedGameEvents.push({
                      type: "elimination",

                      id: nextGameEventId,

                      gameSeconds:
                        current.gameSeconds + 1,

                      eliminatedPlayerId:
                        relocatingBase.playerId,
                    });

                    nextGameEventId += 1;

                    /*
                     * See whether this elimination leaves
                     * exactly one surviving player.
                     */
                    const activePlayerIds =
                      Object.keys(
                        updatedArmiesTrainedByPlayer,
                      ).map(Number);

                    const remainingPlayers =
                      players.filter(
                        (player) =>
                          activePlayerIds.includes(
                            player.id,
                          ) &&
                          !updatedEliminatedPlayerIds.includes(
                            player.id,
                          ),
                      );

                    if (
                      remainingPlayers.length === 1
                    ) {
                      updatedWinnerPlayerId =
                        remainingPlayers[0].id;

                      updatedGameEvents.push({
                        type: "victory",

                        id: nextGameEventId,

                        gameSeconds:
                          current.gameSeconds + 1,

                        winnerPlayerId:
                          remainingPlayers[0].id,
                      });

                      nextGameEventId += 1;
                    }
                  }

                  return;
                }

                /*
                 * -----------------------------------------------
                 * ORIGINAL TILE IS STILL OPEN
                 * -----------------------------------------------
                 *
                 * Restore the same base back to its original
                 * location.
                 *
                 * Its row/col never changed during the failed
                 * relocation, so we do not need to change them.
                 */
                updatedBases =
                  updatedBases.map((base) => {
                    if (
                      base.id !== relocatingBase.id
                    ) {
                      return base;
                    }

                    return {
                      ...base,

                      isRelocating: false,

                      /*
                       * Restore the armies that traveled
                       * with the base.
                       */
                      armies: {
                        ...mission.armies,
                      },
                    };
                  });

                /*
                 * Restore the base's carried resources.
                 */
                const relocationPayment =
                  mission.relocationPayment ?? {
                    water: 0,
                    fire: 0,
                    grass: 0,
                  };

                updatedResources[
                  relocatingBase.id
                ] = {
                  water:
                    mission.resources.water +
                    relocationPayment.water,

                  fire:
                    mission.resources.fire +
                    relocationPayment.fire,

                  grass:
                    mission.resources.grass +
                    relocationPayment.grass,
                };

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

                const destinationBase =
                  updatedBases.find(
                    (base) =>
                      base.id === mission.destinationBaseId,
                  );

                const originBase =
                  updatedBases.find(
                    (base) =>
                      base.id === mission.originBaseId,
                  );

                /*
                 * If the origin base no longer exists,
                 * the transfer mission is lost.
                 */
                if (!originBase) {
                  return;
                }
                /*
                 * If the destination base was destroyed while
                 * the transfer was traveling, turn around.
                 */
                if (!destinationBase) {
                  const distance =
                    Math.abs(
                      originBase.row -
                        mission.destinationRow!,
                    ) +
                    Math.abs(
                      originBase.col -
                        mission.destinationCol!,
                    );

                  updatedArmyMissions.push({
                    ...mission,
                    phase: "returning",
                    secondsRemaining: distance * 5,
                  });

                  return;
                }

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

                updatedGameEvents.push({
                  type: "transfer",

                  id: nextGameEventId,

                  gameSeconds:
                    current.gameSeconds + 1,

                  playerId:
                    destinationBase.playerId,

                  fromBaseName:
                    getBaseName(
                      originBase.playerId,
                      originBase.baseSlot,
                    ),

                  toBaseName:
                    getBaseName(
                      destinationBase.playerId,
                      destinationBase.baseSlot,
                    ),

                  armies: {
                    ...mission.armies,
                  },

                  resources: {
                    ...mission.resources,
                  },
                });

                nextGameEventId += 1;

                return;
              }

              /*
               * =================================================
               * MISSION ARRIVAL:
               * RETURNING TRANSFER
               * =================================================
               *
               * A transfer whose destination was destroyed
               * returns its armies and cargo to the origin base.
               */
              if (
                mission.type === "transfer" &&
                mission.phase === "returning"
              ) {
                const originBase =
                  updatedBases.find(
                    (base) =>
                      base.id === mission.originBaseId,
                  );

                /*
                 * If the origin was destroyed while the transfer
                 * was returning, everything is lost.
                 */
                if (!originBase) {
                  return;
                }

                updatedBases =
                  updatedBases.map((base) => {
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

            if (base.isRelocating) {
              return;
            }

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
           * TIME-LIMIT CHECK
           * ==================================================
           */
           const nextGameSeconds =
             current.gameSeconds + 1;

           const timedMatchEnded =
             matchDurationSeconds !== null &&
             nextGameSeconds >=
               matchDurationSeconds;

           if (
             timedMatchEnded &&
             updatedWinnerPlayerId === null
           ) {
             const survivingPlayerIds =
              Object.keys(
                updatedArmiesTrainedByPlayer,
              )
                .map(Number)
                .filter(
                  (playerId) =>
                    !updatedEliminatedPlayerIds.includes(
                      playerId,
                    ),
                );

             const standings =
               survivingPlayerIds
                 .map((playerId) => ({
                   playerId,

                   score:
                     calculatePlayerScore(
                       playerId,
                       updatedBases,
                       updatedResources,
                       updatedArmyMissions,
                       updatedArmiesTrainedByPlayer[
                         playerId
                       ] ?? 0,
                       updatedArmyResourcesSpentByPlayer[
                         playerId
                       ] ?? 0,
                     ).totalScore,
                 }))
                 .sort(
                   (a, b) =>
                     b.score - a.score,
                 );

             updatedWinnerPlayerId =
               standings[0]?.playerId ??
               null;
           }

          /*
           * ==================================================
           * STEP 5:
           * SAVE THE COMPLETED GAME TICK
           * ==================================================
           */
          return {
            ...current,

            gameSeconds:
              timedMatchEnded &&
              matchDurationSeconds !== null
                ? matchDurationSeconds
                : nextGameSeconds,

            bases:
              updatedBases,

            resourcesByBase:
              updatedResources,

            expansionKeysByPlayer:
              updatedExpansionKeysByPlayer,

            eliminatedPlayerIds:
              updatedEliminatedPlayerIds,

            armyMissions:
              updatedArmyMissions,

            gameEvents:
              updatedGameEvents,

            nextGameEventId,

            treasures:
              updatedTreasures,

            armiesTrainedByPlayer:
              updatedArmiesTrainedByPlayer,

            armyResourcesSpentByPlayer:
              updatedArmyResourcesSpentByPlayer,

            finalScoreByPlayer:
              updatedFinalScoreByPlayer,

            nextTreasureId,

            winnerPlayerId:
              updatedWinnerPlayerId,
          };
        });
      }, 1000);


    /*
     * Stop the timer if App is ever removed.
     */
    return () =>
      window.clearInterval(timer);
  }, []);

  if (!isGameStarted) {
    return (
      <Lobby
        slots={lobbySlots}
        players={players}
        matchConfig={matchConfig}

        onMatchTypeChange={
          handleMatchTypeChange
        }

        onToggleReady={
          handleToggleReady
        }

        onStartGame={
          handleStartGame
        }

        onJoinSlot={
          handleJoinSlot
        }

        onCharacterChange={
          handleCharacterChange
        }

        onLeaveSlot={
          handleLeaveSlot
        }
      />
    );
  }

  /*
   * ==========================================================
   * MAIN GAME UI
   * ==========================================================
   */
  return (
    <main className="app">

      {winner && (
        <div className="game-over-overlay">
          <div className="game-over-panel">
            <strong>
              {winner.id === yourPlayerId
                ? "Victory!"
                : `${winner.name} Wins!`}
            </strong>

            <span>
              {gameState.matchType === "sudden-death"
                ? `${winner.name} is the last player standing.`
                : `${winner.name} had the highest score when time expired.`}
            </span>

            <h2>Final Standings</h2>

            <div className="final-standings-list">
              {finalStandings.map(
                (
                  {
                    player,
                    score,
                    isEliminated,
                  },
                  index,
                ) => (
                  <div
                    key={player.id}
                    className={`final-standing-row ${
                      isEliminated
                        ? "eliminated"
                        : ""
                    }`}
                  >
                    <span className="final-rank">
                      {index + 1}.
                    </span>

                    <span className="final-player">
                      {player.avatar}{" "}
                      {player.name}
                    </span>

                    <span className="final-score">
                      {Math.round(score)}
                    </span>
                  </div>
                ),
              )}
            </div>

            <button
              className="play-again-button"
              onClick={handlePlayAgain}
            >
              🔄 Play Again
            </button>
          </div>
        </div>
      )}

      {youAreEliminated && !winner && (
        <div className="game-over-overlay">
          <div className="game-over-panel">
            <strong>Game Over</strong>

            <span>
              Your final base has been destroyed.
            </span>
          </div>
        </div>
      )}

      {/* Top-left */}
      <GameLog
        events={gameState.gameEvents}
        players={players}
      />

      {/* Top-center */}
      <ResourceBar
        water={selectedResources.water}
        fire={selectedResources.fire}
        grass={selectedResources.grass}
      />

      {/* Top-right */}
      <Leaderboard
        bases={gameState.bases}
        resourcesByBase={
          gameState.resourcesByBase
        }
        armyMissions={
          gameState.armyMissions
        }
        armiesTrainedByPlayer={
          gameState.armiesTrainedByPlayer
        }
        armyResourcesSpentByPlayer={
          gameState.armyResourcesSpentByPlayer
        }
        activePlayerIds={
          activePlayerIds
        }
        eliminatedPlayerIds={
          gameState.eliminatedPlayerIds
        }
        finalScoreByPlayer={
          gameState.finalScoreByPlayer
        }
      />

      <GameClock
        seconds={gameState.gameSeconds}
      />

      <div className="dev-player-switcher">
        <strong>DEV: Playing as</strong>

        <div className="dev-player-switcher-buttons">
          {players.map((player) => (
            <button
              key={player.id}
              className={
                player.id === yourPlayerId
                  ? "dev-player-button dev-player-button--active"
                  : "dev-player-button"
              }
              onClick={() =>
                handleDevPlayerSwitch(
                  player.id,
                )
              }
            >
              {player.avatar} {player.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom-right */}
      <BaseActions
        key={selectedBaseId}
        base={selectedBase}
        resources={selectedResources}
        ownedBases={yourBases}
        expansionKeys={yourExpansionKeys}
        onTrainArmy={handleTrainArmy}
        onStartAttackTargeting={handleStartAttackTargeting}
        onStartLootTargeting={handleStartLootTargeting}
        onStartExpandTargeting={handleStartExpandTargeting}
        onStartTransferTargeting={handleStartTransferTargeting}
        onStartRelocateTargeting={handleStartRelocateTargeting}
      />

      {/* Traveling armies */}
      <ArmyMovements
          missions={gameState.armyMissions.filter(
            (mission) =>
              mission.playerId === yourPlayerId,
          )}
          bases={gameState.bases}
          treasures={gameState.treasures}
        />

      {/* Map Targeting Banner */}
      {targetingMode !== null && (
          <div className="targeting-banner">
            <span>
              {targetingMode === "attack" &&
                "Choose an enemy base to attack"}

              {targetingMode === "loot" &&
                "Choose a treasure chest to loot"}

              {targetingMode === "expand" &&
                "Choose an empty tile to expand to"}

              {targetingMode === "transfer" &&
                "Choose one of your bases to transfer to"}

              {targetingMode === "relocate" &&
                "Choose an empty tile to relocate to"}

            </span>

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
        onExpandTargetSelected={handleExpandTargetSelected}
        onTransferTargetSelected={handleTransferTargetSelected}
        onRelocateTargetSelected={handleRelocateTargetSelected}
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
            <span>
              {yourPlayer?.name ??
                "Your Bases"}
            </span>

            <span className="expansion-key-count">
              🔑 {yourExpansionKeys}
            </span>
          </div>

          <div className="base-selector-row">
            {yourBases.map(
              (base) => (
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
                    {getBaseName(
                      base.playerId,
                      base.baseSlot,
                    )}
                  </span>

                  <span className="base-army-summary">
                    ⚔️💧{base.armies.water}{" "}
                    ⚔️🔥{base.armies.fire}{" "}
                    ⚔️🌱{base.armies.grass}
                  </span>

                  <span className="base-resource-summary">
                    💧
                    {Math.floor(
                      gameState.resourcesByBase[
                        base.id
                      ]?.water ?? 0,
                    )}{" "}

                    🔥
                    {Math.floor(
                      gameState.resourcesByBase[
                        base.id
                      ]?.fire ?? 0,
                    )}{" "}

                    🌱
                    {Math.floor(
                      gameState.resourcesByBase[
                        base.id
                      ]?.grass ?? 0,
                    )}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
    </main>
  );
}

export default App;