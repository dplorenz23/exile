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

### `src/game/createInitialGameState.ts`

Creates a fresh runtime `GameState` whenever a match starts or resets.

The function accepts the active player IDs, selected match type, and selected map,
then builds the initial authoritative state used by the server.

It is responsible for:

- Including only the players participating in the current match.
- Assigning map-specific starting base positions.
- Creating fresh copies of bases, armies, training state, and starting resources
  so a new match cannot reuse mutated objects from a previous game.
- Giving each active player one starting Expansion Key.
- Initializing historical army-training and resource-spending totals used for
  end-game scoring.
- Resetting missions, game events, treasure, eliminations, IDs, the game clock,
  and the winner.

Map Two currently supports two players and overrides their normal EXiLE Island
starting positions with B1 and C8.

This file bridges the static configuration in `gameState.ts` and the live
authoritative match state maintained by the server.

### `src/game/rules.ts`

Contains EXiLE's shared deterministic game rules.

This file is intended to be the common source of truth for rules that must
behave identically on the client and authoritative server. It currently
handles production multipliers, army costs, combat resolution, automatic
loot distribution, and end-game player scoring.

#### Base production

A base's production multiplier increases based on how long it has remained
in its current location:

- 0–1:59: 1x
- 2:00–4:59: 2x
- 5:00–9:59: 3x
- 10:00+: 4x

Relocating a base resets its time-in-location elsewhere in the game logic.

#### Army training cost

Each resource type tracks its historical armies built at that base.

Training starts at 100 resources and increases by 50 for each previously
trained army of that resource type. Losing an army does not reduce future
training costs.

#### Combat

Combat is deterministic.

1. Matching army types cancel each other 1-for-1.
2. Attacker-favorable elemental matchups resolve.
3. Defender-favorable elemental matchups resolve.
4. The defending base's militia fights one remaining attacker.
5. The attacker only wins if at least one attacking army remains, all
   defending armies are gone, and the militia is defeated.

The elemental advantage cycle is:

- Water > Fire
- Fire > Grass
- Grass > Water

One army fighting with elemental advantage can eliminate up to two armies
of the weaker type and survives that matchup.

Militia casualty selection is deterministic. If multiple attacking army
types remain, militia targets the largest group, with ties resolved in
Water → Fire → Grass order.

#### Loot

Automatic raid/treasure loot is distributed as evenly as possible among
Water, Fire, and Grass.

If one resource type runs out, unused capacity is redistributed among the
remaining types. Any final indivisible remainder is taken from the resource
type with the largest amount remaining, with Water → Fire → Grass used as
the deterministic tie order.

#### Player scoring

Player score consists of:

- 500 points per surviving base.
- 1 point per owned resource, including resources currently in transit.
- Surviving armies valued using the player's historical average training
  cost per army.

Relocating bases still count toward base score. Their armies and resources
are represented by the relocation mission while in transit and are therefore
excluded from the stationary-base totals to prevent double-counting.

Refundable relocation payments also remain part of the player's resource
score while the relocation is unresolved.

### `src/game/maps/mapOne.ts`

Defines EXiLE Island, the primary 8x8 game map.

The map is authored as a human-readable two-dimensional grid using three helper
functions:

- `G(...)` creates Grass tiles.
- `W(...)` creates Water tiles.
- `F(...)` creates Fire tiles.

Each tile can define its terrain type, resource multiplier, and optional river
or lava flow direction.

The file includes coordinate and flow-direction documentation so the map can be
edited directly without having to reason about zero-based array indexes.

After the 8x8 layout is defined, it is converted into the flat `Tile[]` format
used by the rest of EXiLE. Each exported tile receives its zero-based row and
column coordinates during this conversion.

Flow-direction values describe which two edges of a river or lava tile connect;
they do not indicate the direction the liquid is moving.

### `src/game/maps/mapTwo.ts`

Defines Map Two, a compact 4x8 map designed for two-player matches.

Like EXiLE Island, the map is authored as a human-readable two-dimensional grid
using the `G`, `W`, and `F` helper functions for Grass, Water, and Fire tiles.

Each tile can define its terrain type, resource multiplier, and optional river
or lava flow direction.

Map Two is 180-degree rotationally symmetrical to give the two starting players
equivalent terrain and resource opportunities.

The first active player starts at B1 and the second active player starts at C8.
Those starting-base overrides are applied in `createInitialGameState.ts`.

The hand-authored grid is converted into the flat `Tile[]` format used by the
rest of EXiLE, with zero-based row and column coordinates assigned during that
conversion.

### `src/components/ArmyMovements.tsx`

Displays the current player's missions that are traveling across the map.

The component receives missions, known bases, and treasure locations and
converts each mission into a human-readable movement summary showing:

- Mission status, such as attacking, returning, expanding, or relocating.
- Origin and destination.
- Remaining travel time.
- Armies in transit.
- Resources being carried.
- Expansion Keys being carried.

Expansion and relocation missions use map coordinates as destinations, while
normal army missions generally use base IDs.

Loot missions reuse `destinationBaseId` to store the target Treasure ID, so the
component resolves those destinations against the supplied treasure list.

The component is display-only. It does not update mission state or resolve
arrivals; those behaviors are handled by the authoritative game logic.

### `src/components/GameClock.tsx`

Displays the current match time in `minutes:seconds` format.

The component receives the authoritative game's elapsed time in seconds and
formats it for display. It does not maintain or advance the game clock itself;
the match timer is controlled by the authoritative server.

### `src/components/BasePiece.tsx`

Renders a player's base on the game map.

The component displays the base's visual structure, player avatar, optional base
name, and tooltip information. It can also visually indicate when a base is
selected or is a valid attack or transfer target.

A base's visual tier changes according to how long it has remained in its
current location:

- Under 2 minutes: Tent
- 2–5 minutes: House
- 5–10 minutes: Settlement
- 10+ minutes: Castle

The component can display travel time when the base is being considered as a
mission target.

Player color is passed into CSS through the `--player-color` custom property so
the component's styling can reflect the base owner.

`BasePiece` is presentation-only. It does not modify bases, resolve attacks, or
control mission movement.

### `src/components/ResourceBar.tsx`

Displays the Water, Fire, and Grass resource totals for the currently selected
base.

The component receives the three resource values as props and renders them with
their corresponding resource icons.

`ResourceBar` is presentation-only. It does not produce, spend, or modify
resources; resource state is maintained by the authoritative game state.

### `src/components/Leaderboard.tsx`

Displays the current player standings for the match.

The component calculates each active player's score using the shared
`calculatePlayerScore()` rule and sorts players from highest to lowest score.

For active players, the displayed score is calculated from the current game
state. When a player is eliminated, the component uses that player's frozen
score from `finalScoreByPlayer` so later changes to missions or other state do
not change their final standing.

Eliminated players are visually marked with a separate leaderboard style.

The scoring formula itself is not defined in this component. It lives in
`src/game/rules.ts`, keeping scoring behavior shared with the authoritative
server.

### `src/components/GameLog.tsx`

Displays the public chronological log of important match events.

The Game Log currently renders:

- Battles and their surviving armies.
- Base destruction and loot results.
- Expansion.
- Relocation.
- Treasure looting.
- Transfers.
- Mission failures.
- Player elimination.
- Match victory.

Events are displayed newest-first.

Battle events store their timestamp inside their battle report, while other
game events store `gameSeconds` directly. When multiple events happen during
the same second, the display uses a deterministic ordering so victory and
elimination events appear above the battle that caused them.

Mission-failure events explain failures such as an unavailable destination,
a destroyed origin base, or a relocation that cannot return to its original
location.

`GameLog` is presentation-only. The authoritative server creates the game
events; this component only sorts and renders them for players.

### `src/components/Tile.tsx`

Renders one tile of the game map.

The component is responsible for displaying:

- Terrain and resource type.
- Resource multipliers.
- River or lava flow styling.
- Map-edge styling.
- Treasure.
- Bases.
- Travel-time indicators.
- Valid or unavailable mission targets.

`Tile` also routes click behavior for attacks, transfers, loot, expansion, and
relocation to the callback supplied by its parent.

Bases are rendered through `BasePiece`, while treasure and tile-level targeting
are rendered directly inside this component.

The component does not resolve missions or modify game state. It only displays
the current authoritative state and forwards user interactions to higher-level
game logic.

### `src/components/GameMap.tsx`

Builds and renders the interactive game map from the current authoritative
match state.

For each map tile, the component determines:

- Whether a base occupies the tile.
- Whether treasure occupies the tile.
- Which player owns a base.
- The base's display name.
- Whether the tile is a valid attack, loot, expansion, transfer, or relocation
  target.
- Whether the tile should be marked unavailable during targeting.
- Travel time from the currently selected origin base.

Travel time is calculated using Manhattan distance between map coordinates.

Most army missions currently use 5 seconds of travel time per tile, while
relocation uses 15 seconds per tile.

`GameMap` does not execute missions itself. It derives targeting and display
state, renders each map position through `Tile`, and forwards valid target
selections to callbacks supplied by the parent game component.

### `src/components/BaseActions.tsx`

Controls the action menus for the currently selected base.

The component provides the player-facing workflows for:

- Training Water, Fire, or Grass armies.
- Sending armies to attack.
- Sending armies to loot treasure.
- Transferring armies and resources between friendly bases.
- Paying for and beginning an expansion.
- Paying for and beginning a base relocation.

`BaseActions` manages temporary UI state such as selected armies, cargo, and
resource payments. Army selection is limited by the armies currently stationed
at the base, and cargo capacity is 200 resources per selected army.

Expansion currently costs one Expansion Key plus 500 resources.

Relocation cost increases with the number of previous relocations performed by
that base.

The component performs client-side UI checks to control selections and button
availability, but completed actions are passed upward through callbacks.
Authoritative validation and changes to the match state are handled by the
server.

### `src/components/Lobby.tsx`

Displays the multiplayer lobby before a match begins.

The component renders:

- Available player slots.
- Character selection.
- Ready status.
- Join and leave controls.
- Host designation.
- Map selection.
- Match-type selection.
- Match-start requirements and validation messages.

Each playable character can only be selected by one occupied lobby slot at a
time.

Only the host can change the map, change the match type, or start the game.
The Play Game button becomes available when the selected map supports the
current number of players and every occupied slot is ready.

The lobby performs client-side checks to control the interface, but lobby state
and authoritative validation are maintained by the server. Player actions such
as joining, leaving, changing characters, readying up, and starting the match
are passed upward through callbacks and sent to the server.

### `src/App.tsx`

Acts as the main client-side coordinator for EXiLE.

`App` connects the React interface to the authoritative multiplayer server and
holds the latest lobby and match state received over WebSockets.

Its primary responsibilities include:

- Connecting to the EXiLE WebSocket server on port 8080.
- Receiving and storing authoritative lobby and `GameState` updates.
- Determining which player and bases belong to the current client.
- Maintaining temporary client-side map-targeting state for attack, loot,
  transfer, expansion, and relocation workflows.
- Sending player action requests to the server.
- Selecting the correct map layout for the current match.
- Deriving client display data such as the selected base, resources, standings,
  elimination state, and winner.
- Rendering the lobby before a match and the main game interface after the
  server starts the match.
- Coordinating the Game Map, Game Log, Leaderboard, Base Actions, Resource Bar,
  Army Movements, Game Clock, and base selector.

`App.tsx` does not run the authoritative game simulation. Training, production,
mission resolution, combat, resource changes, elimination, scoring, and victory
are validated and resolved by the server.

The targeting state stored in `App` is temporary UI state only. For example,
when a player chooses armies for an attack, `App` remembers those armies while
the player selects a destination on the map. Once the destination is chosen,
the action is sent to the server for authoritative validation and execution.

The client currently receives full authoritative `GameState` snapshots from the
server and renders the interface from those snapshots.

### `src/App.css`

Contains the primary visual styling for the EXiLE client.

The stylesheet defines the layout and appearance of the game map, terrain,
bases, resources, game log, leaderboard, army movements, base actions, lobby,
targeting indicators, treasure, game-over interface, and base selector.

It also contains desktop-responsive layouts for medium-size displays and
smaller desktop/laptop screens.

Map terrain and flow-direction classes are used by the map components to render
Grass, Water, Fire, rivers, lava, map edges, and resource multipliers.

Mission-targeting styles visually distinguish valid attack, loot, transfer,
expansion, and relocation destinations without controlling whether those
actions are actually legal. Target validation remains part of the game logic
and authoritative server.

### `server/src/index.ts`

Runs the authoritative EXiLE multiplayer game server using Node.js and WebSockets.

The server listens on port `8080` and owns both the multiplayer lobby and the
live match simulation.

#### Lobby responsibilities

The server manages:

- Connected clients and client IDs.
- Lobby slots and character selection.
- Ready status.
- Host assignment and host reassignment when the host leaves or disconnects.
- Map selection.
- Match-type selection.
- Validation that the selected map supports the current player count.
- Starting a match only when the lobby is valid and all players are ready.

The first connected player becomes the host. If the host leaves or disconnects,
host control passes to another player in the lobby.

#### Authoritative game state

When a match begins, the server creates the initial `GameState` and advances the
match once per second.

The server is authoritative for:

- Match time.
- Base aging.
- Resource production.
- Army training and training costs.
- Army movement.
- Transfers.
- Attacks and combat.
- Looting.
- Expansion.
- Relocation.
- Mission failures and returns.
- Treasure creation and removal.
- Expansion Keys.
- Player elimination.
- Score calculation.
- Victory.
- Public game events.

Clients do not directly modify these systems. They send action requests to the
server, the server validates those requests, updates the authoritative
`GameState`, and broadcasts the resulting state to connected clients.

#### Missions

The server currently supports five mission types:

- `transfer`
- `attack`
- `loot`
- `expand`
- `relocate`

Mission travel and arrival are processed by the server game tick.

Attack, transfer, loot, and expansion travel currently use 5 seconds per map
tile. Relocation uses 15 seconds per tile.

Missions preserve enough origin and destination information to resolve failures
and returns even when the map changes while they are traveling.

Examples include:

- An attack returning when its target no longer exists.
- A transfer returning when its destination is destroyed.
- A loot mission failing when its treasure has already been taken.
- A failed expansion returning its resources and Expansion Key.
- A relocation returning when its destination becomes occupied.
- A relocating base being lost if both its destination and original location
  become unavailable.

If a mission's required origin base is destroyed before a return can complete,
the returning armies, resources, and other carried items are lost.

#### Combat and scoring

Combat, loot distribution, army costs, production multipliers, and player
scoring use the shared deterministic rules from `src/game/rules.ts`.

This keeps the authoritative server and client display logic based on the same
rule definitions without duplicating those formulas.

A player is eliminated immediately when they have no surviving bases. Their
score is frozen at elimination.

In a 30-minute match, the server determines the winner from the surviving
players' scores when time expires. In Sudden Death, play continues until only
one player remains.

#### Networking

The server currently broadcasts full authoritative `GameState` snapshots to
connected clients after state-changing player actions and after each server
game tick.

The current multiplayer implementation is designed first for LAN play. Features
such as persistent rooms, reconnect support, internet matchmaking, protocol
hardening, and runtime validation of incoming WebSocket message payloads are
future work.
