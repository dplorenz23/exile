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
 * MAP TWO
 * 4 columns x 8 rows
 *
 *       A    B    C    D
 *
 *  1   [ ]  [ ]  [ ]  [ ]
 *  2   [ ]  [ ]  [ ]  [ ]
 *  3   [ ]  [ ]  [ ]  [ ]
 *  4   [ ]  [ ]  [ ]  [ ]
 *  5   [ ]  [ ]  [ ]  [ ]
 *  6   [ ]  [ ]  [ ]  [ ]
 *  7   [ ]  [ ]  [ ]  [ ]
 *  8   [ ]  [ ]  [ ]  [ ]
 *
 * Proposed starts:
 *
 * Player 1: B1
 * Player 2: C8
 *
 * The map is 180-degree rotationally symmetrical.
 * ============================================================
 */

const mapLayout: MapTile[][] = [

  // ROW 1
  [
    G(),                              // A1
    W("river", 1, "north-south"),     // B1
    F("lava", 1, "north-south"),      // C1
    G(),                              // D1
  ],

  // ROW 2
  [
    G(),                              // A2
    W("river", 1, "north-south"),     // B2
    F("lava", 1, "north-south"),      // C2
    G(),                              // D2
  ],

  // ROW 3
  [
    W("lake", 2),                     // A3
    W("river", 1, "north-south"),     // B3
    F("lava", 1, "north-east"),       // C3
    F("volcano", 2),                  // D3
  ],

  // ROW 4
  [
    G("forest", 2),                   // A4
    W("lake", 3),                     // B4
    F("volcano", 3),                  // C4
    G("forest", 2),                   // D4
  ],

  // ROW 5
  [
    G("forest", 2),                   // A5
    F("volcano", 3),                  // B5
    W("lake", 3),                     // C5
    G("forest", 2),                   // D5
  ],

  // ROW 6
  [
    F("volcano", 2),                  // A6
    F("lava", 1, "south-west"),       // B6
    W("river", 1, "north-south"),     // C6
    W("lake", 2),                     // D6
  ],

  // ROW 7
  [
    G(),                              // A7
    F("lava", 1, "north-south"),      // B7
    W("river", 1, "north-south"),     // C7
    G(),                              // D7
  ],

  // ROW 8
  [
    G(),                              // A8
    F("lava", 1, "north-south"),      // B8
    W("river", 1, "north-south"),     // C8
    G(),                              // D8
  ],
];

export const mapTwo: Tile[] =
  mapLayout.flatMap(
    (row, rowIndex) =>
      row.map((tile, colIndex) => ({
        row: rowIndex,
        col: colIndex,
        resource: tile.resource,
        terrain: tile.terrain,
        multiplier:
          tile.multiplier ?? 1,
        flowDirection:
          tile.flowDirection,
      })),
  );