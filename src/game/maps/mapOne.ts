import type {
  FlowDirection,
  ResourceMultiplier,
  ResourceType,
  TerrainType,
  Tile,
} from "../types";

interface MapTile {
  resource: ResourceType;
  terrain: TerrainType;
  multiplier?: ResourceMultiplier;
  flowDirection?: FlowDirection;
}

/*
 * ============================================================
 * TILE HELPERS
 * ============================================================
 *
 * G = Grass resource
 * W = Water resource
 * F = Fire resource
 *
 *
 * GRASS
 *
 * G()
 * 1x Meadow
 *
 * G("forest")
 * 1x Forest
 *
 * G("forest", 2)
 * 2x Forest
 *
 *
 * WATER
 *
 * W("lake")
 * 1x Lake
 *
 * W("lake", 2)
 * 2x Lake
 *
 * W("river", 1, "north-south")
 * 1x River connecting North ↔ South
 *
 *
 * FIRE
 *
 * F("volcano")
 * 1x Volcano
 *
 * F("volcano", 3)
 * 3x Volcano
 *
 * F("lava", 1, "east-west")
 * 1x Lava flow connecting East ↔ West
 */

const G = (
  terrain: "meadow" | "forest" = "meadow",
  multiplier: ResourceMultiplier = 1,
): MapTile => ({
  resource: "grass",
  terrain,
  multiplier,
});

const W = (
  terrain: "lake" | "river" = "lake",
  multiplier: ResourceMultiplier = 1,
  flowDirection?: FlowDirection,
): MapTile => ({
  resource: "water",
  terrain,
  multiplier,
  flowDirection,
});

const F = (
  terrain: "volcano" | "lava" = "volcano",
  multiplier: ResourceMultiplier = 1,
  flowDirection?: FlowDirection,
): MapTile => ({
  resource: "fire",
  terrain,
  multiplier,
  flowDirection,
});

/*
 * ============================================================
 * FLOW DIRECTIONS
 * ============================================================
 *
 * IMPORTANT:
 *
 * The direction name tells you which TWO EDGES of the tile
 * the river or lava flow touches.
 *
 * It does NOT indicate the direction the water/lava is moving.
 *
 *
 * NORTH-SOUTH
 *
 *       │
 *       │
 *       │
 *
 * "north-south"
 *
 *
 * EAST-WEST
 *
 *   ─────────
 *
 * "east-west"
 *
 *
 * NORTH-EAST
 *
 *       │
 *       └────
 *
 * "north-east"
 *
 *
 * NORTH-WEST
 *
 *       │
 *   ────┘
 *
 * "north-west"
 *
 *
 * SOUTH-EAST
 *
 *       ┌────
 *       │
 *       │
 *
 * "south-east"
 *
 *
 * SOUTH-WEST
 *
 *   ────┐
 *       │
 *       │
 *
 * "south-west"
 *
 *
 * EXAMPLE:
 *
 * A lava flow coming LEFT out of a volcano and then
 * turning DOWN would look like:
 *
 *
 *             F       G
 *
 *     2       ┌────  🌋
 *             │
 *     3       │
 *             │
 *     4       │
 *
 *
 * F2 = "south-east"
 * F3 = "north-south"
 * F4 = "north-south"
 *
 * F2 connects:
 *
 * EAST  → G2 volcano
 * SOUTH → F3 lava
 */

/*
 * ============================================================
 * MAP COORDINATES
 * ============================================================
 *
 *       A    B    C    D    E    F    G    H
 *
 *  1   [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
 *  2   [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
 *  3   [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
 *  4   [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
 *  5   [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
 *  6   [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
 *  7   [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
 *  8   [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]
 *
 *
 * COLUMNS:
 *
 * A → H
 * Left → Right
 *
 *
 * ROWS:
 *
 * 1 → 8
 * Top → Bottom
 *
 *
 * Top-left tile:
 *
 * A1
 *
 * Bottom-right tile:
 *
 * H8
 *
 *
 * Each array below represents ONE ROW.
 *
 * Each entry inside the array represents one column,
 * starting with A and ending with H.
 */

/*
 * ============================================================
 * MAP 1
 * ============================================================
 */

const mapLayout: MapTile[][] = [

  // =========================================================
  // ROW 1
  // =========================================================
  [
    W("river", 1, "north-south"),     // A1
    G(),                              // B1
    G("forest"),                      // C1
    W("river", 1, "south-east"),      // D1
    W("river", 1, "east-west"),       // E1
    W("river", 1, "east-west"),       // F1
    W("river", 1, "north-west"),      // G1
    F("lava", 1, "north-south"),      // H1
  ],

  // =========================================================
  // ROW 2
  // =========================================================
  [
    W("river", 1, "north-south"),     // A2
    G("forest"),                      // B2
    G("forest", 2),                   // C2
    W("river", 1, "north-south"),     // D2
    G(),                              // E2
    F("lava", 1, "south-east"),       // F2
    F("volcano", 2),                  // G2
    F("lava", 1, "north-west"),       // H2
  ],

  // =========================================================
  // ROW 3
  // =========================================================
  [
    W("river", 1, "north-east"),      // A3
    W("river", 1, "south-west"),      // B3
    W("lake"),                        // C3
    W("river", 1, "north-south"),     // D3
    G(),                              // E3
    F("lava", 1, "north-south"),      // F3
    G(),                              // G3
    G(),                              // H3
  ],

  // =========================================================
  // ROW 4
  // =========================================================
  [
    G(),                              // A4
    W("lake"),                        // B4
    W("lake", 2),                     // C4
    W("lake", 3),                     // D4
    G("forest", 2),                   // E4
    F("lava", 1, "north-east"),       // F4
    F("lava", 1, "east-west"),        // G4
    F("lava", 1, "east-west"),        // H4
  ],

  // =========================================================
  // ROW 5
  // =========================================================
  [
    G(),                              // A5
    W("river", 1, "north-south"),     // B5
    W("lake"),                        // C5
    W("lake"),                        // D5
    G("forest", 3),                   // E5
    F("lava", 1, "south-east"),       // F5
    F("volcano", 2),                  // G5
    F("lava", 1, "south-west"),       // H5
  ],

  // =========================================================
  // ROW 6
  // =========================================================
  [
    W("river", 1, "east-west"),       // A6
    W("river", 1, "north-west"),      // B6
    W("lake"),                        // C6
    W("lake", 2),                     // D6
    F("volcano", 3),                  // E6
    F("lava", 1, "north-south"),      // F6
    G("forest"),                      // G6
    F("lava", 1, "north-south"),      // H6
  ],

  // =========================================================
  // ROW 7
  // =========================================================
  [
    G(),                              // A7
    G("forest", 2),                      // B7
    F("lava", 1, "south-east"),       // C7
    F("lava", 1, "east-west"),        // D7
    F("lava", 1, "north-west"),       // E7
    F("lava", 1, "north-south"),      // F7
    G(),                              // G7
    F("lava", 1, "north-east"),       // H7
  ],

  // =========================================================
  // ROW 8
  // =========================================================
  [
    G(),                              // A8
    G("forest"),                      // B8
    F("lava", 1, "north-south"),      // C8
    G(),                              // D8
    G(),                              // E8
    F("lava", 1, "north-south"),      // F8
    G(),                              // G8
    G("forest"),                      // H8
  ],
];

/*
 * Convert our easy-to-edit 8x8 layout into the Tile[]
 * structure used by the rest of EXiLE.
 */
export const mapOne: Tile[] = mapLayout.flatMap((row, rowIndex) =>
  row.map((tile, colIndex) => ({
    row: rowIndex,
    col: colIndex,
    resource: tile.resource,
    terrain: tile.terrain,
    multiplier: tile.multiplier ?? 1,
    flowDirection: tile.flowDirection,
  })),
);