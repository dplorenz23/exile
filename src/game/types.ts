export type MatchType = "30m" | "sudden-death";

export interface LobbySlot {
  slotId: number;
  playerId: number | null;
  isReady: boolean;
  clientId?: number;
  isHost?: boolean;
}

export interface MatchConfig {
  mapId: string;
  matchType: MatchType;
}

export type ResourceType = "water" | "fire" | "grass";

export type TerrainType =
  | "meadow"
  | "forest"
  | "lake"
  | "river"
  | "volcano"
  | "lava";

/*
 * FLOW DIRECTIONS
 *
 * A flow direction describes the TWO EDGES of a tile
 * that a river or lava flow connects.
 *
 * It does NOT describe which direction the water/lava
 * is actually traveling.
 *
 *
 * "north-south"
 *
 *       │
 *       │
 *       │
 *
 * Connects the NORTH and SOUTH edges.
 *
 *
 * "east-west"
 *
 *   ─────────
 *
 * Connects the EAST and WEST edges.
 *
 *
 * "north-east"
 *
 *       │
 *       └────
 *
 * Connects the NORTH and EAST edges.
 *
 *
 * "north-west"
 *
 *       │
 *   ────┘
 *
 * Connects the NORTH and WEST edges.
 *
 *
 * "south-east"
 *
 *       ┌────
 *       │
 *       │
 *
 * Connects the SOUTH and EAST edges.
 *
 *
 * "south-west"
 *
 *   ────┐
 *       │
 *       │
 *
 * Connects the SOUTH and WEST edges.
 */

export type FlowDirection =
  | "north-south"
  | "east-west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west";

export type ResourceMultiplier = 1 | 2 | 3;

export interface Tile {
  row: number;
  col: number;
  resource: ResourceType;
  terrain: TerrainType;
  multiplier: ResourceMultiplier;
  flowDirection?: FlowDirection;
}

export interface BaseResources {
  water: number;
  fire: number;
  grass: number;
}

export interface ResourceCounts {
  water: number;
  fire: number;
  grass: number;
}

export interface ArmyCounts {
  water: number;
  fire: number;
  grass: number;
}

export interface TrainingOrder {
  resource: ResourceType;
  secondsRemaining: number;
}

export interface Base {
  id: number;
  playerId: number;

  row: number;
  col: number;

  timeInLocationSeconds: number;
  isRelocating: boolean;

  armies: ArmyCounts;

  // Historical number of armies produced by this base.
  // Losing armies later does not reduce future training cost.
  armiesBuilt: ArmyCounts;

  // Null means this base is not currently training.
  training: TrainingOrder | null;

  relocations: number;

  // Players may own at most three bases.
  baseSlot: 1 | 2 | 3;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  avatar: string;
}

export type MissionType =
  | "transfer"
  | "attack"
  | "loot"
  | "expand"
  | "relocate";

export type MissionPhase = "outbound" | "returning";

export type MissionFailureReason =
  | "destination-unavailable"
  | "origin-destroyed"
  | "return-location-blocked";

export interface ArmyMission {
  id: number;

  type: MissionType;
  phase: MissionPhase;

  originBaseId: number;
  destinationBaseId: number;

  playerId: number;

  armies: ArmyCounts;
  resources: ResourceCounts;

  secondsRemaining: number;

  expansionKeys: number;

  /*
   * Origin metadata is stored directly on the mission so already-launched
   * missions can continue even if their origin base is destroyed while
   * they are in transit.
   */
  originRow?: number;
  originCol?: number;
  originBaseSlot?: number;

  /*
   * Tile-based missions such as expansion and relocation use coordinates
   * rather than an existing destination base.
   */
  destinationRow?: number;
  destinationCol?: number;

  /*
   * Relocation payment is carried with the relocating base so it can be
   * refunded if the relocation fails and the base successfully returns.
   */
  relocationPayment?: BaseResources;
}

export interface CombatResult {
  attackerSurvivors: ArmyCounts;
  defenderSurvivors: ArmyCounts;

  militiaSurvived: boolean;

  attackerWon: boolean;
  baseDestroyed: boolean;
}

export interface BattleReport {
  id: number;
  gameSeconds: number;

  attackerPlayerId: number;
  defenderPlayerId: number;

  row: number;
  col: number;

  attackerArmies: ArmyCounts;
  defenderArmies: ArmyCounts;

  defenderBaseName: string;
  attackerBaseName: string;

  resourcesLooted: ResourceCounts;
  resourcesRemaining: ResourceCounts;

  attackerSurvivors: ArmyCounts;
  defenderSurvivors: ArmyCounts;

  militiaSurvived: boolean;
  baseDestroyed: boolean;

  eliminatedPlayerId?: number;
}

export type GameEvent =
  | {
      type: "battle";
      report: BattleReport;
    }
  | {
      type: "expansion";

      id: number;
      gameSeconds: number;

      playerId: number;
      baseName: string;

      row: number;
      col: number;
    }
  | {
      type: "relocation";

      id: number;
      gameSeconds: number;

      playerId: number;
      baseName: string;

      fromRow: number;
      fromCol: number;

      toRow: number;
      toCol: number;
    }
  | {
      type: "loot";

      id: number;
      gameSeconds: number;

      playerId: number;

      row: number;
      col: number;

      resourcesLooted: BaseResources;
      resourcesRemaining: BaseResources;
    }
  | {
      type: "transfer";

      id: number;
      gameSeconds: number;

      playerId: number;

      fromBaseName: string;
      toBaseName: string;

      armies: ArmyCounts;
      resources: BaseResources;
    }
  | {
      type: "mission-failed";

      id: number;
      gameSeconds: number;

      playerId: number;
      missionType: MissionType;
      reason: MissionFailureReason;

      baseName?: string;

      row?: number;
      col?: number;
    }
  | {
      type: "elimination";

      id: number;
      gameSeconds: number;

      eliminatedPlayerId: number;
      eliminatedByPlayerId?: number;
    }
  | {
      type: "victory";

      id: number;
      gameSeconds: number;

      winnerPlayerId: number;
    };

export interface Treasure {
  id: number;

  row: number;
  col: number;

  resources: ResourceCounts;
}

export interface PlayerScore {
  playerId: number;

  baseScore: number;
  resourceScore: number;
  armyScore: number;

  totalScore: number;
}

export type GameState = {
  gameSeconds: number;

  matchType: MatchType;
  mapId: string;

  bases: Base[];

  resourcesByBase: Record<number, BaseResources>;

  expansionKeysByPlayer: Record<number, number>;

  expansionsCompletedByPlayer: Record<number, number>;

  armyMissions: ArmyMission[];
  nextMissionId: number;

  gameEvents: GameEvent[];
  nextGameEventId: number;

  treasures: Treasure[];
  nextTreasureId: number;

  /*
   * Historical training totals are used for end-game army scoring.
   * These values do not decrease when armies are destroyed.
   */
  armiesTrainedByPlayer: Record<number, number>;
  armyResourcesSpentByPlayer: Record<number, number>;

  /*
   * Eliminated players have their score frozen so standings remain stable
   * after elimination.
   */
  finalScoreByPlayer: Record<number, number>;

  eliminatedPlayerIds: number[];

  // Null while the match is active.
  winnerPlayerId: number | null;
};
