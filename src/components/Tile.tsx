import type {
  Base,
  Player,
  Tile as TileType,
} from "../game/types";

import BasePiece from "./BasePiece";

interface TileProps {
  tile: TileType;
  gridSize: number;
  base?: Base;
  player?: Player;
  isSelectedBase?: boolean;
}

function getTerrainIcon(tile: TileType) {
  switch (tile.terrain) {
    case "meadow":
      return "🌾";
    case "forest":
      return "🌲";
    case "lake":
      return "💧";
    case "river":
      return "🌊";
    case "volcano":
      return "🌋";
    case "lava":
      return "🔥";
  }
}

export default function Tile({
  tile,
  gridSize,
  base,
  player,
  isSelectedBase = false,
}: TileProps) {
  const isTop = tile.row === 0;
  const isBottom = tile.row === gridSize - 1;
  const isLeft = tile.col === 0;
  const isRight = tile.col === gridSize - 1;

  const edgeClasses = [
    isTop ? "tile-edge-top" : "",
    isBottom ? "tile-edge-bottom" : "",
    isLeft ? "tile-edge-left" : "",
    isRight ? "tile-edge-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={[
        "map-tile",
        `map-tile--${tile.resource}`,
        `terrain--${tile.terrain}`,
        tile.flowDirection
          ? `flow--${tile.flowDirection}`
          : "",
        edgeClasses,
      ]
        .filter(Boolean)
        .join(" ")}
      title={`${tile.terrain} | ${tile.resource} | ${tile.multiplier}x`}
    >
      <span className="tile-icon">
        {getTerrainIcon(tile)}
      </span>

      {tile.multiplier > 1 && (
        <span className="tile-multiplier">
          {tile.multiplier}×
        </span>
      )}

      {base && player && (
        <BasePiece
          base={base}
          player={player}
          isSelected={isSelectedBase}
        />
      )}
    </div>
  );
}