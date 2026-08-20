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
}

export default function GameMap({
  selectedBaseId,
  bases,
  treasures,
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

        const player = base
          ? players.find(
              (player) => player.id === base.playerId,
            )
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
          />
        );
      })}
    </div>
  );
}