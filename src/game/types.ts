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

  armies: ArmyCounts;

  // Historical number produced by this base.
  // Losing armies later will NOT lower army cost.
  armiesBuilt: number;

  // Null means this base is not currently training.
  training: TrainingOrder | null;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  avatar: string;
}

export interface ArmyMission {
  id: number;

  type: "transfer" | "attack";

  phase: "outbound" | "returning";

  originBaseId: number;
  destinationBaseId: number;

  armies: ArmyCounts;

  resources: {
    water: number;
    fire: number;
    grass: number;
  };

  secondsRemaining: number;
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

  attackerSurvivors: ArmyCounts;
  defenderSurvivors: ArmyCounts;

  militiaSurvived: boolean;
  baseDestroyed: boolean;
}