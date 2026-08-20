import type { Base, Player, ResourceType } from "./types";

export const players: Player[] = [
  {
    id: 1,
    name: "You",
    color: "#4f8cff",
    avatar: "🧙",
  },
  {
    id: 2,
    name: "Player 2",
    color: "#e05a47",
    avatar: "🦊",
  },
  {
    id: 3,
    name: "Player 3",
    color: "#d8b640",
    avatar: "🐸",
  },
  {
    id: 4,
    name: "Player 4",
    color: "#9b6bd6",
    avatar: "🐼",
  },
];

export const bases: Base[] = [
  {
    id: 1,
    playerId: 1,
    row: 0,
    col: 3,
    timeInLocationSeconds: 100,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
  },
  {
    id: 2,
    playerId: 2,
    row: 1,
    col: 7,
    timeInLocationSeconds: 210,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
  },
  {
    id: 3,
    playerId: 3,
    row: 7,
    col: 6,
    timeInLocationSeconds: 420,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
  },
  {
    id: 4,
    playerId: 4,
    row: 6,
    col: 0,
    timeInLocationSeconds: 620,

    armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
  },
  {
  id: 5,
  playerId: 1,
  row: 3,
  col: 2,
  timeInLocationSeconds: 350,

  armies: {
      water: 0,
      fire: 0,
      grass: 0,
    },

    armiesBuilt: 0,
    training: null,
},
];

export interface BaseResources {
  water: number;
  fire: number;
  grass: number;
}

export const startingResourcesByBase: Record<number, BaseResources> = {
  1: {
    water: 50,
    fire: 50,
    grass: 50,
  },

  5: {
    water: 50,
    fire: 50,
    grass: 50,
  },
};