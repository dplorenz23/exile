## Local Development Setup

### Prerequisites

Install:

- Git
- Node.js LTS (includes npm)
- Visual Studio Code

Recommended VS Code extensions:

- ESLint
- Prettier - Code formatter

### Clone and Install

Clone the repository:

```bash
git clone <EXILE_REPOSITORY_URL>
cd exile
```

Terminology:
- Client - App.tsx - ../exile
- Server - index.ts - ../exile/server

Install client dependencies:
```bash
npm install
```

Install server dependencies:
```bash
cd server
npm install
```

### Run EXiLE

From server:
```bash
npm run dev
```

From client (open a second cmd prompt):
```bash
npm run dev -- --host
```

The client side will display 2 URL's, the local URL and the Network URL.
- Open the Local URL to play on the host computer.
- Other computers on the same LAN can connect using the Network URL.

## File Summaries

### `src/game/types.ts`

Defines the shared TypeScript data model used throughout EXiLE.

This file contains the core types for players, bases, resources, armies, tiles,
missions, combat results, game events, treasure, scoring, lobby state, match
configuration, and the authoritative `GameState`.

Important architectural details represented here include:

- Players may own up to three bases.
- Missions can be outbound or returning and may represent transfers, attacks,
  loot, expansion, or relocation.
- Mission origin coordinates are stored directly on missions so already-launched
  missions can continue even if their origin base is destroyed.
- Historical army-training totals are preserved for end-game scoring.
- Eliminated-player scores can be frozen in `finalScoreByPlayer`.
- `winnerPlayerId` is `null` while a match is active and is set by the
  authoritative server when the match ends.

Because these types are shared across the client, shared game logic, and server,
changes here can affect networking and authoritative state handling across the
entire project.

### `src/game/gameState.ts`

Contains EXiLE's static game configuration and default starting data.

This file defines:

- Available maps and their supported player counts/dimensions.
- Match types, including the 30-minute and Sudden Death modes.
- The four playable characters, including name, color, and avatar.
- The three possible base names assigned to each player.
- `getBaseName()`, which resolves a player's base name from its base slot.
- Default starting bases and starting resources used when initializing a new match.

This file represents configuration rather than live match state. Runtime state such
as current resources, missions, treasure, eliminations, and the winner is created
separately in `createInitialGameState.ts` and then maintained by the authoritative
server.
