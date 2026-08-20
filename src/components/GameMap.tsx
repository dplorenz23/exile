import { mapOne } from "../game/maps/mapOne";
import { players } from "../game/gameState";
import type { Base } from "../game/types";
import Tile from "./Tile";

const GRID_SIZE = 8;

interface GameMapProps {
  selectedBaseId: number;
  bases: Base[];
}

export default function GameMap({
  selectedBaseId,
  bases,
}: GameMapProps) {
  return (
    <div className="game-map">
      {mapOne.map((tile) => {
        const base = bases.find(
          (base) =>
            base.row === tile.row &&
            base.col === tile.col,
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
            isSelectedBase={base?.id === selectedBaseId}
          />
        );
      })}
    </div>
  );
}