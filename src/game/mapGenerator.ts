import type { ResourceType, Tile } from "./types";

type Cell = {
  row: number;
  col: number;
  resource: ResourceType | null;
};

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function getIndex(row: number, col: number, gridSize: number) {
  return row * gridSize + col;
}

function isInBounds(row: number, col: number, gridSize: number) {
  return row >= 0 && row < gridSize && col >= 0 && col < gridSize;
}

function getRandomCell(cells: Cell[]) {
  return cells[Math.floor(Math.random() * cells.length)];
}

function growRegion(
  cells: Cell[],
  gridSize: number,
  resource: ResourceType,
  targetSize: number,
) {
  const emptyCells = cells.filter((cell) => cell.resource === null);

  if (emptyCells.length === 0) {
    return;
  }

  const start = getRandomCell(emptyCells);
  start.resource = resource;

  const frontier: Cell[] = [start];
  let regionSize = 1;

  while (frontier.length > 0 && regionSize < targetSize) {
    const current =
      frontier[Math.floor(Math.random() * frontier.length)];

    const shuffledDirections = [...DIRECTIONS].sort(
      () => Math.random() - 0.5,
    );

    let expanded = false;

    for (const [rowOffset, colOffset] of shuffledDirections) {
      const nextRow = current.row + rowOffset;
      const nextCol = current.col + colOffset;

      if (!isInBounds(nextRow, nextCol, gridSize)) {
        continue;
      }

      const nextCell =
        cells[getIndex(nextRow, nextCol, gridSize)];

      if (nextCell.resource !== null) {
        continue;
      }

      nextCell.resource = resource;
      frontier.push(nextCell);

      regionSize += 1;
      expanded = true;

      if (regionSize >= targetSize) {
        break;
      }
    }

    if (!expanded) {
      const currentIndex = frontier.indexOf(current);
      frontier.splice(currentIndex, 1);
    }
  }
}

export function generateMap(gridSize: number): Tile[] {
  const cells: Cell[] = Array.from(
    { length: gridSize * gridSize },
    (_, index) => ({
      row: Math.floor(index / gridSize),
      col: index % gridSize,
      resource: null,
    }),
  );

  // Water regions
  growRegion(cells, gridSize, "water", 7);
  growRegion(cells, gridSize, "water", 5);

  // Fire / volcanic regions
  growRegion(cells, gridSize, "fire", 6);
  growRegion(cells, gridSize, "fire", 4);

  // Forest / grass regions
  growRegion(cells, gridSize, "grass", 8);
  growRegion(cells, gridSize, "grass", 7);

  // Anything left becomes grass/meadow.
  cells.forEach((cell) => {
    if (cell.resource === null) {
      cell.resource = "grass";
    }
  });

  return cells.map((cell) => ({
    row: cell.row,
    col: cell.col,
    resource: cell.resource as ResourceType,
    multiplier: 1,

    terrain: "meadow"
  }));
}