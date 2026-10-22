import type { CSSProperties } from "react";

import { BALANCE } from "../game/balance";

import { getBaseName, players } from "../game/gameState";

import type { Base, Tile as MapTile, Treasure } from "../game/types";

import Tile from "./Tile";

import { CLASS_COLORS } from "../game/characters";
import type { CharacterClass } from "../game/characters";

interface GameMapProps {
  selectedBaseId: number;
  bases: Base[];
  treasures: Treasure[];
  mapTiles: MapTile[];
  targetingMode: "attack" | "loot" | "expand" | "transfer" | "relocate" | null;
  yourPlayerId: number;
  originBase?: Base;
  onAttackTargetSelected: (destinationBaseId: number) => void;
  onLootTargetSelected: (treasureId: number) => void;
  onExpandTargetSelected: (row: number, col: number) => void;
  onTransferTargetSelected: (destinationBaseId: number) => void;
  onRelocateTargetSelected: (row: number, col: number) => void;
  characterClassByPlayer: Record<number, CharacterClass>;
}

function getTravelTimeSeconds(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  secondsPerTile: number,
): number {
  const distance = Math.abs(fromRow - toRow) + Math.abs(fromCol - toCol);

  return distance * secondsPerTile;
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
  onTransferTargetSelected,
  onRelocateTargetSelected,
  mapTiles,
  characterClassByPlayer,
}: GameMapProps) {
  const mapColumns = Math.max(...mapTiles.map((tile) => tile.col)) + 1;

  const mapRows = Math.max(...mapTiles.map((tile) => tile.row)) + 1;

  return (
    <div
      className="game-map"
      style={
        {
          "--map-columns": mapColumns,
          "--map-rows": mapRows,
        } as CSSProperties
      }
    >
      {mapTiles.map((tile) => {
        const base = bases.find(
          (base) =>
            !base.isRelocating &&
            base.row === tile.row &&
            base.col === tile.col,
        );

        const treasure = treasures.find(
          (treasure) => treasure.row === tile.row && treasure.col === tile.col,
        );

        const isLootTarget = targetingMode === "loot" && treasure !== undefined;

        const lootTravelTimeSeconds =
          isLootTarget && originBase && treasure
            ? getTravelTimeSeconds(
                originBase.row,
                originBase.col,
                treasure.row,
                treasure.col,
                5,
              )
            : undefined;

        const player = base
          ? (() => {
              const originalPlayer = players.find(
                (player) => player.id === base.playerId,
              );

              if (!originalPlayer) return undefined;

              const characterClass = characterClassByPlayer[base.playerId];

              return {
                ...originalPlayer,
                color: characterClass
                  ? CLASS_COLORS[characterClass]
                  : originalPlayer.color,
              };
            })()
          : undefined;

        const baseName = base
          ? getBaseName(base.playerId, base.baseSlot)
          : undefined;

        const isExpandTarget =
          targetingMode === "expand" &&
          base === undefined &&
          treasure === undefined;

        const expandTravelTimeSeconds =
          isExpandTarget && originBase
            ? getTravelTimeSeconds(
                originBase.row,
                originBase.col,
                tile.row,
                tile.col,
                5,
              )
            : undefined;

        const isTransferTarget =
          targetingMode === "transfer" &&
          base !== undefined &&
          base.playerId === yourPlayerId &&
          base.id !== selectedBaseId;

        const transferTravelTimeSeconds =
          isTransferTarget && originBase && base
            ? getTravelTimeSeconds(
                originBase.row,
                originBase.col,
                base.row,
                base.col,
                5,
              )
            : undefined;

        const isRelocateTarget =
          targetingMode === "relocate" &&
          base === undefined &&
          treasure === undefined;

        const relocationTravelTimeSeconds =
          isRelocateTarget && originBase
            ? getTravelTimeSeconds(
                originBase.row,
                originBase.col,
                tile.row,
                tile.col,
                BALANCE.relocation.travelSecondsPerTile,
              )
            : undefined;

        /*
         * During attack targeting, any enemy base is valid.
         */
        const isAttackTarget =
          targetingMode === "attack" &&
          base !== undefined &&
          base.playerId !== yourPlayerId;

        const attackTravelTimeSeconds =
          isAttackTarget && originBase && base
            ? getTravelTimeSeconds(
                originBase.row,
                originBase.col,
                base.row,
                base.col,
                5,
              )
            : undefined;

        const isTargeting = targetingMode !== null;

        const isAvailableTarget =
          isAttackTarget ||
          isLootTarget ||
          isExpandTarget ||
          isTransferTarget ||
          isRelocateTarget;

        const isUnavailableTarget = isTargeting && !isAvailableTarget;

        return (
          <Tile
            key={`${tile.row}-${tile.col}`}
            tile={tile}
            gridSize={Math.max(mapColumns, mapRows)}
            base={base}
            baseName={baseName}
            player={player}
            treasure={treasure}
            isSelectedBase={base?.id === selectedBaseId}
            isAttackTarget={isAttackTarget}
            travelTimeSeconds={attackTravelTimeSeconds}
            onAttackTargetClick={
              isAttackTarget && base
                ? () => onAttackTargetSelected(base.id)
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
                ? () => onExpandTargetSelected(tile.row, tile.col)
                : undefined
            }
            expandTravelTimeSeconds={expandTravelTimeSeconds}
            isTransferTarget={isTransferTarget}
            transferTravelTimeSeconds={transferTravelTimeSeconds}
            onTransferTargetClick={
              isTransferTarget && base
                ? () => onTransferTargetSelected(base.id)
                : undefined
            }
            isRelocateTarget={isRelocateTarget}
            relocationTravelTimeSeconds={relocationTravelTimeSeconds}
            onRelocateTargetClick={
              isRelocateTarget
                ? () => onRelocateTargetSelected(tile.row, tile.col)
                : undefined
            }
            isUnavailableTarget={isUnavailableTarget}
          />
        );
      })}
    </div>
  );
}
