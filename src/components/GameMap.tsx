import { mapOne } from "../game/maps/mapOne";
import { players } from "../game/gameState";
import type {
  Base,
  Treasure,
} from "../game/types";
import Tile from "./Tile";

const GRID_SIZE = 8;

interface GameMapProps {
  selectedBaseId: number;
  bases: Base[];
  treasures: Treasure[];

  targetingMode: "attack" | "loot" | "expand" | null;
  yourPlayerId: number;

  originBase?: Base;

  onAttackTargetSelected: (
    destinationBaseId: number,
  ) => void;

  onLootTargetSelected: (
    treasureId: number,
  ) => void;

  onExpandTargetSelected: (
    row: number,
    col: number,
  ) => void;

}

export default function GameMap({
  selectedBaseId,
  bases,
  treasures,
  targetingMode,
  yourPlayerId,
  originBase,
  onAttackTargetSelected,
  onLootTargetSelected,
  onExpandTargetSelected,
}: GameMapProps) {
  return (
    <div className="game-map">
      {mapOne.map((tile) => {
        const base = bases.find(
          (base) =>
            base.row === tile.row &&
            base.col === tile.col,
        );

        const treasure = treasures.find(
          (treasure) =>
            treasure.row === tile.row &&
            treasure.col === tile.col,
        );

        const isLootTarget =
          targetingMode === "loot" &&
          treasure !== undefined;

        const lootTravelTimeSeconds =
          isLootTarget && originBase && treasure
            ? (
                Math.abs(
                  originBase.row - treasure.row,
                ) +
                Math.abs(
                  originBase.col - treasure.col,
                )
              ) * 5
            : undefined;

        const player = base
          ? players.find(
              (player) => player.id === base.playerId,
            )
          : undefined;

        const isExpandTarget =
          targetingMode === "expand" &&
          base === undefined &&
          treasure === undefined;

        const expandTravelTimeSeconds =
          isExpandTarget && originBase
            ? (
                Math.abs(
                  originBase.row - tile.row,
                ) +
                Math.abs(
                  originBase.col - tile.col,
                )
              ) * 5
            : undefined;

        /*
        * During Attack Targeting Mode, any enemy base
        * is a valid map target.
        */
        const isAttackTarget =
          targetingMode === "attack" &&
          base !== undefined &&
          base.playerId !== yourPlayerId;

        const travelTimeSeconds =
          isAttackTarget && originBase && base
            ? (
                Math.abs(
                  originBase.row - base.row,
                ) +
                Math.abs(
                  originBase.col - base.col,
                )
              ) * 5
            : undefined;

        return (
          <Tile
            key={`${tile.row}-${tile.col}`}
            tile={tile}
            gridSize={GRID_SIZE}
            base={base}
            player={player}
            treasure={treasure}
            isSelectedBase={base?.id === selectedBaseId}
            isAttackTarget={isAttackTarget}
            travelTimeSeconds={travelTimeSeconds}
            onAttackTargetClick={
              isAttackTarget && base
                ? () =>
                    onAttackTargetSelected(base.id)
                : undefined
            }
            isLootTarget={isLootTarget}
            lootTravelTimeSeconds={lootTravelTimeSeconds}
            onLootTargetClick={
              isLootTarget && treasure
                ? () => onLootTargetSelected(treasure.id)
                : undefined
            }
            isExpandTarget={isExpandTarget}
            onExpandTargetClick={
              isExpandTarget
                ? () =>
                    onExpandTargetSelected(
                      tile.row,
                      tile.col,
                    )
                : undefined
            }
            expandTravelTimeSeconds={expandTravelTimeSeconds}
        />
        );
      })}
    </div>
  );
}