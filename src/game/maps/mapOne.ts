import type { ResourceMultiplier, ResourceType, Tile } from "../types";

/*
 * EXiLE Island — 8x8 Resource Map
 *
 * W = Water
 * F = Fuel (internal key: fire)
 * G = Food (internal key: grass)
 *
 * W    = 1x Water
 * W2   = 2x Water
 * W3   = 3x Water
 *
 * Same pattern for Fuel and Food.
 *
 * Each row represents one map row (1–8).
 * Each column represents A–H.
 */

type MapCell = "W" | "W2" | "W3" | "F" | "F2" | "F3" | "G" | "G2" | "G3";

const mapLayout: MapCell[][] = [
  // A    B    C    D    E    F    G    H
  ["G", "W", "G", "G", "G", "F", "F", "F2"], // 1
  ["G", "W", "G", "G", "G", "F", "F2", "F3"], // 2
  ["G", "G", "W2", "W2", "G", "F", "F", "F"], // 3
  ["G", "W", "W", "W2", "G2", "W", "F", "F"], // 4
  ["W", "G3", "G", "W", "W", "W", "W", "G2"], // 5
  ["G3", "W", "W3", "W", "G", "G", "F", "G2"], // 6
  ["F", "F", "F", "F", "W3", "F", "G", "F2"], // 7
  ["F", "G", "F", "G", "G", "W", "F", "F2"], // 8
];

const resourceMap: Record<string, ResourceType> = {
  W: "water",
  F: "fire",
  G: "grass",
};

export const mapOne: Tile[] = mapLayout.flatMap((row, rowIndex) =>
  row.map((cell, colIndex) => {
    const resource = resourceMap[cell[0]];

    const multiplier = (
      cell.length > 1 ? Number(cell[1]) : 1
    ) as ResourceMultiplier;

    return {
      row: rowIndex,
      col: colIndex,
      resource,
      multiplier,
    };
  }),
);
