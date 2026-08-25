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

  // Historical number produced by this base.
  // Losing armies later will NOT lower army cost.
  armiesBuilt: ArmyCounts;

  // Null means this base is not currently training.
  training: TrainingOrder | null;

  relocations: number;

  baseSlot: 1 | 2 | 3;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  avatar: string;
}

export interface ArmyMission {
  id: number;

  type: "transfer" | "attack" | "loot" | "expand" | "relocate";

  phase: "outbound" | "returning";

  originBaseId: number;
  destinationBaseId: number;

  armies: ArmyCounts;

  resources: ResourceCounts;

  secondsRemaining: number;

  expansionKeys: number;

  destinationRow?: number;
  destinationCol?: number;

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