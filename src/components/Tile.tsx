import type { Base, Player, Tile as TileType, Treasure } from "../game/types";

import BasePiece from "./BasePiece";

interface TileProps {
  tile: TileType;
  gridSize: number;
  base?: Base;
  baseName?: string;
  player?: Player;
  treasure?: Treasure;
  isSelectedBase?: boolean;
  isAttackTarget?: boolean;
  travelTimeSeconds?: number;
  onAttackTargetClick?: () => void;
  isLootTarget?: boolean;
  lootTravelTimeSeconds?: number;
  onLootTargetClick?: () => void;
  isExpandTarget?: boolean;
  onExpandTargetClick?: () => void;
  expandTravelTimeSeconds?: number;
  isTransferTarget?: boolean;
  transferTravelTimeSeconds?: number;
  onTransferTargetClick?: () => void;
  isRelocateTarget?: boolean;
  relocationTravelTimeSeconds?: number;
  onRelocateTargetClick?: () => void;
  isUnavailableTarget?: boolean;
}

export default function Tile({
  tile,
  gridSize,
  base,
  baseName,
  player,
  treasure,
  isSelectedBase = false,
  isAttackTarget = false,
  travelTimeSeconds,
  onAttackTargetClick,
  isLootTarget = false,
  lootTravelTimeSeconds,
  onLootTargetClick,
  isExpandTarget = false,
  onExpandTargetClick,
  expandTravelTimeSeconds,
  isTransferTarget = false,
  transferTravelTimeSeconds,
  onTransferTargetClick,
  isRelocateTarget = false,
  relocationTravelTimeSeconds,
  onRelocateTargetClick,
  isUnavailableTarget = false,
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

  const baseTravelTimeSeconds = isAttackTarget
    ? travelTimeSeconds
    : transferTravelTimeSeconds;

  const onBaseClick = isAttackTarget
    ? onAttackTargetClick
    : isTransferTarget
      ? onTransferTargetClick
      : undefined;

  return (
    <div
      className={[
        "map-tile",
        `map-tile--${tile.resource}`,
        `terrain--${tile.terrain}`,
        tile.flowDirection ? `flow--${tile.flowDirection}` : "",
        isExpandTarget ? "map-tile--expand-target" : "",
        isRelocateTarget ? "map-tile--relocate-target" : "",
        isUnavailableTarget ? "map-tile--unavailable-target" : "",
        edgeClasses,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={isRelocateTarget ? onRelocateTargetClick : onExpandTargetClick}
      title={
        isAttackTarget
          ? undefined
          : `${tile.terrain} | ${tile.resource} | ${tile.multiplier}x`
      }
    >
      {isExpandTarget && expandTravelTimeSeconds !== undefined && (
        <div className="expand-travel-time">{expandTravelTimeSeconds}s</div>
      )}

      {isRelocateTarget && relocationTravelTimeSeconds !== undefined && (
        <div className="relocate-travel-time">
          📦 {relocationTravelTimeSeconds}s
        </div>
      )}

      {tile.multiplier > 1 && (
        <span className="tile-multiplier">{tile.multiplier}×</span>
      )}

      {treasure && (
        <div
          className={["treasure", isLootTarget ? "treasure--loot-target" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={onLootTargetClick}
          title={
            isLootTarget && lootTravelTimeSeconds !== undefined
              ? `Loot treasure — ${lootTravelTimeSeconds}s travel`
              : `Treasure — Water: ${treasure.resources.water}, Fire: ${treasure.resources.fire}, Grass: ${treasure.resources.grass}${
                  treasure.expansionKeys > 0
                    ? `, Expansion Keys: ${treasure.expansionKeys}`
                    : ""
                }`
          }
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/basePieces/treasure_chest.png`}
            alt="Treasure chest"
            className="treasure-image"
            draggable={false}
          />
          {isLootTarget && lootTravelTimeSeconds !== undefined && (
            <div className="loot-travel-time">{lootTravelTimeSeconds}s</div>
          )}
        </div>
      )}

      {base && player && (
        <BasePiece
          base={base}
          baseName={baseName}
          player={player}
          isSelected={isSelectedBase}
          isAttackTarget={isAttackTarget}
          isTransferTarget={isTransferTarget}
          travelTimeSeconds={baseTravelTimeSeconds}
          onClick={onBaseClick}
        />
      )}
    </div>
  );
}
