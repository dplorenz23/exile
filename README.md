# EXiLE

EXiLE is a fast-paced multiplayer strategy game built around territory,
resource production, army movement, expansion, relocation, and
deterministic elemental combat.

The current version is a browser-based multiplayer game built with
React, TypeScript, Vite, Node.js, and WebSockets.

The immediate development goal is a complete, playable multiplayer game
for friends. The current architecture uses an authoritative server so
the project can later move beyond LAN play without requiring the core
game simulation to be rewritten.

------------------------------------------------------------------------

------------------------------------------------------------------------

## Table of Contents

-   [Current Game Overview](#current-game-overview)
-   [Local Development Setup](#local-development-setup)
-   [Multiplayer Architecture](#multiplayer-architecture)
-   [Current Maps](#current-maps)
-   [Characters](#characters)
-   [Resource Production](#resource-production)
-   [Army Training](#army-training)
-   [Missions](#missions)
-   [Combat Rules](#combat-rules)
-   [Elimination and Victory](#elimination-and-victory)
-   [Scoring](#scoring)
-   [Game Events](#game-events)
-   [Current Multiplayer Status](#current-multiplayer-status)
-   [Known Issues and Deferred Work](#known-issues-and-deferred-work)
-   [Development Status](#development-status)
-   [Project Structure](#project-structure)

------------------------------------------------------------------------

## Current Game Overview

Players control an empire made up of one to three bases located on a
shared tile-based map.

Each map tile produces one of three resources:

-   💧 Water
-   🔥 Fire
-   🌱 Grass

Tiles may have increased resource multipliers, and a base's production
also increases as the base remains in the same location.

Players use resources to train armies, move resources between bases,
attack other players, loot treasure, establish new bases, and relocate
existing bases.

The game uses an elemental combat relationship:

-   Water defeats Fire.
-   Fire defeats Grass.
-   Grass defeats Water.

There is no fog of war. The map and major game events are visible to all
players.

The current game supports 2--4 players depending on the selected map.

------------------------------------------------------------------------

## Local Development Setup

### Prerequisites

Install:

-   Git
-   Node.js LTS (includes npm)
-   Visual Studio Code

Recommended VS Code extensions:

-   ESLint
-   Prettier - Code formatter

### Clone and Install

Clone the repository:

``` bash
git clone <EXILE_REPOSITORY_URL>
cd exile
```

For the commands below:

-   **Client** = repository root (`../exile`), with the main React
    coordinator in `src/App.tsx`.
-   **Server** = `../exile/server`, with the authoritative server in
    `server/src/index.ts`.

Install client dependencies:

``` bash
npm install
```

Install server dependencies:

``` bash
cd server
npm install
```

### Run EXiLE

From the `server` directory:

``` bash
npm run dev
```

Open a second terminal in the repository root and start the client:

``` bash
npm run dev -- --host
```

Vite will display two URLs: a Local URL and a Network URL.

-   Open the Local URL to play on the host computer.
-   Other computers on the same LAN can connect using the Network URL.

------------------------------------------------------------------------

## Multiplayer Architecture

EXiLE uses a server-authoritative multiplayer architecture.

The React client is primarily responsible for:

-   Rendering the current game state.
-   Displaying the lobby and game interface.
-   Managing temporary UI state.
-   Allowing the player to select actions, armies, cargo, payments, and
    targets.
-   Sending player requests to the server.
-   Receiving authoritative lobby and game-state updates.

The Node.js WebSocket server is responsible for:

-   Lobby state.
-   Match creation.
-   The game clock.
-   Resource production.
-   Army training.
-   Mission movement and arrival.
-   Transfers.
-   Combat.
-   Looting.
-   Expansion.
-   Relocation.
-   Treasure.
-   Elimination.
-   Scoring.
-   Victory.
-   Public game events.

**Do not move authoritative simulation logic back into `App.tsx`.**

The client may perform checks for UI purposes, such as disabling an
unavailable button or highlighting a valid destination, but the server
must independently validate gameplay requests before modifying the
match.

Shared deterministic rules belong in `src/game/rules.ts` whenever
practical so the server and client can use the same formulas without
maintaining duplicate implementations.

The server currently broadcasts full authoritative `GameState` snapshots
rather than incremental state changes.

------------------------------------------------------------------------

## Current Maps

### EXiLE Island

EXiLE Island is the primary 8x8 map and supports 2--4 players.

The map is hand-authored and contains Grass, Water, and Fire terrain,
including river and lava-flow visuals and tiles with increased resource
multipliers.

Starting bases are associated with the participating characters.

### Map Two

Map Two is a compact 4x8 map intended specifically for two-player
matches.

It is designed with 180-degree rotational symmetry so both players
receive equivalent starting opportunities.

The first active player starts at B1 and the second active player starts
at C8.

------------------------------------------------------------------------

## Characters

The current playable characters are:

1.  Albus 🧙
2.  Galahad 🛡️
3.  Magnus 🪓
4.  Blackbeard 🏴‍☠️

Each character can only be claimed by one player in the lobby.

Players may own a maximum of three bases.

------------------------------------------------------------------------

## Resource Production

Every base produces the resource associated with the tile it occupies.

Production depends on both:

1.  The resource multiplier of the map tile.
2.  How long the base has remained in its current location.

Current base-location production milestones are:

-   Under 2 minutes: 1x
-   2--5 minutes: 2x
-   5--10 minutes: 3x
-   10+ minutes: 4x

Relocating a base stops its production and resets its time-in-location
when the relocation succeeds.

------------------------------------------------------------------------

## Army Training

There are three army types:

-   Water
-   Fire
-   Grass

Each base trains armies independently.

Training takes 10 seconds.

The first army of a particular resource type at a base costs 100 of that
resource. Each additional army of that type trained at that base
increases the cost by 50.

Army-training cost is based on the historical number of armies of that
type trained at the base. Losing armies does not reduce future training
costs.

------------------------------------------------------------------------

## Missions

EXiLE currently supports five mission types:

-   Transfer
-   Attack
-   Loot
-   Expand
-   Relocate

Army missions normally travel at 5 seconds per tile.

Relocation travels at 15 seconds per tile.

Travel distance uses Manhattan distance between map coordinates.

### Transfer

Transfer moves armies and optional resources from one friendly base to
another.

Each army can carry up to 200 resources.

Armies and cargo leave the origin immediately and are added to the
destination when the mission arrives.

If the destination disappears before arrival, the mission returns toward
its origin.

If the origin is destroyed before a returning mission arrives, the
returning armies and cargo are lost.

### Attack

Attack sends armies from one player-owned base to an enemy base.

The server resolves combat when the mission reaches the target.

Surviving attackers return toward the base from which they were
originally launched.

If an attack destroys a base, surviving attackers can loot resources
from the destroyed base and may return carrying an Expansion Key.

If resources remain after the attackers reach their carrying capacity,
those resources become treasure on the destroyed base's tile.

If the attack target disappears before the attackers arrive, the mission
returns home.

### Loot

Loot sends armies to collect resources from treasure on the map.

Each army provides 200 units of carrying capacity.

If another player removes the treasure before the mission arrives, the
loot mission returns without treasure.

Treasure remains on the map until all of its resources have been
collected.

### Expand

Expansion creates an additional base.

A player may own at most three bases.

Expansion currently costs:

-   1 Expansion Key
-   500 total resources

The 500 resources may be paid using a combination of Water, Fire, and
Grass.

The Expansion Key and payment travel with the mission.

If the destination becomes unavailable before arrival, the settlers
return to their origin. The Expansion Key and resources are refunded
only after the return successfully reaches the origin.

New bases begin with:

-   50 Water
-   50 Fire
-   50 Grass

### Relocate

Relocation moves an existing base to another map tile.

Relocation cost increases with the number of previous relocations
performed by that base:

-   First relocation: 250 resources
-   Second relocation: 500 resources
-   Third relocation: 750 resources
-   And so on

A relocating base still counts as an existing base for elimination and
base-count purposes, but it cannot produce resources or perform normal
base actions while traveling.

Its armies and remaining resources travel with it.

A successful relocation resets the base's time-in-location.

If the destination becomes unavailable before arrival, the base attempts
to return to its original tile.

If the original tile has also become unavailable by the time the base
returns, the relocating base and everything traveling with it are lost.

------------------------------------------------------------------------

## Combat Rules

Combat is deterministic.

Before elemental advantages are resolved, matching army types cancel
each other one-for-one.

The elemental relationship is:

-   Water is strong against Fire.
-   Fire is strong against Grass.
-   Grass is strong against Water.

When a strong army fights its weak opposing type, one strong army can
eliminate up to two weak armies while surviving.

Favorable attacker matchups are resolved before favorable defender
matchups.

Each defending base also has one militia unit.

The militia eliminates one remaining attacker, targeting the largest
remaining attacking army group. Ties use a deterministic Water, Fire,
Grass ordering.

The attacker only wins if attackers remain after combat, all defending
armies are gone, and the militia has been defeated.

A tie therefore favors the defender.

------------------------------------------------------------------------

## Elimination and Victory

A player is immediately eliminated when they have no surviving bases.

Armies, resources, Expansion Keys, or expansion missions in transit do
not prevent elimination.

When a player is eliminated, their score is frozen so later changes to
the remaining game state cannot alter their final result.

### 30-Minute Match

The match ends after 30 minutes.

If only one player remains before the timer expires, that player wins
immediately.

Otherwise, the surviving player with the highest score when time expires
wins.

### Sudden Death

The match continues until only one player remains.

------------------------------------------------------------------------

## Scoring

Current scoring includes:

### Bases

Each surviving base is worth 500 points.

### Resources

Resources are worth one point each.

Resources traveling with unresolved missions still belong to the player
and count toward scoring when appropriate.

### Armies

Surviving stationed and in-transit armies count toward scoring.

Army value is based on the player's historical average training cost:

`historical resources spent training armies / historical armies trained`

That average value is multiplied by the player's surviving army count.

Historical training totals do not decrease when armies are destroyed.

Relocating bases count toward scoring, but their armies and resources
are stored on the relocation mission while traveling and must not be
counted twice.

------------------------------------------------------------------------

## Game Events

Important events are recorded by the authoritative server and displayed
in the public Game Log.

Current events include:

-   Battles
-   Base destruction
-   Loot
-   Transfers
-   Expansion
-   Relocation
-   Mission failures
-   Player elimination
-   Victory

Mission failures can include situations such as:

-   Destination unavailable
-   Origin base destroyed
-   Relocation return location blocked

When multiple events occur during the same game second, the client
applies a deterministic display priority so victory and elimination
appear above the battle that caused them.

------------------------------------------------------------------------

## Current Multiplayer Status

The core multiplayer architecture is functional.

The following systems have been moved to and tested on the authoritative
server:

-   Lobby synchronization
-   Host assignment and reassignment
-   Character selection
-   Ready state
-   Map and match-type selection
-   Match start validation
-   Game clock
-   Resource production
-   Base aging
-   Army training
-   Transfer
-   Attack
-   Combat
-   Loot
-   Expansion
-   Relocation
-   Mission failure and return behavior
-   Treasure
-   Elimination
-   Scoring
-   Victory
-   Full game-state broadcasting

EXiLE has successfully been run on two separate physical computers over
a local network, with synchronized training and combat observed on both
clients.

A clean repository clone has also been tested on another computer by
installing the project dependencies and starting the client and server
from the cloned repository.

The next multiplayer milestone is a complete multi-computer match
involving three players.

------------------------------------------------------------------------

## Known Issues and Deferred Work

The following items are intentionally deferred and should not be
mistaken for missing pieces of the current milestone.

### Networking

-   Runtime validation of incoming WebSocket message payloads.
-   Internet-hosted multiplayer.
-   Persistent rooms / room codes.
-   Reconnection after a network interruption.
-   Additional privacy rules for player-specific information.
-   More robust handling of clients joining or leaving during an active
    match.

### Gameplay / Simulation

-   Investigate the rare same-second edge case where simultaneous
    actions may occasionally produce unexpected behavior.
-   More exhaustive testing of failed Expansion returns.
-   Future map shrinkage mechanics.
-   Additional maps and eventual randomized map generation.
-   Additional balancing after multiplayer playtesting.

### UI / UX

-   Further responsive-layout refinement.
-   Replace temporary emoji-based visuals with final artwork/icons where
    desired.
-   Additional polish for multiplayer status and connection feedback.
-   Further Play Again / rematch synchronization work.

### Code Quality

-   Possible extraction of repeated mission/event helpers after gameplay
    behavior is stable.
-   Possible decomposition of the large authoritative server tick after
    the multiplayer milestone.
-   Remove remaining obsolete development-only CSS if discovered.

These refactors should not take priority over validating the current
authoritative multiplayer gameplay.

------------------------------------------------------------------------

## Development Status

The current priority is stability and complete multiplayer playtesting
rather than adding major new systems.

The immediate test plan is:

1.  Run a short two-player smoke test covering all five mission types
    and a full elimination/victory flow.
2.  Run a three-player LAN match on three separate computers.
3.  Verify simultaneous actions and interactions between multiple
    players.
4.  Confirm all clients finish with the same winner and standings.
5.  Fix multiplayer bugs discovered during those tests before adding
    substantial new features.

After the multiplayer milestone, development can move toward internet
hosting, additional polish, gameplay balancing, and additional content.

------------------------------------------------------------------------

------------------------------------------------------------------------

## Project Structure

The sections below document the responsibility of the major source
files.

They are intentionally more detailed than a typical README so this
document can also serve as an architectural snapshot of the project. A
developer---or a future AI-assisted development session---should be able
to use this README to understand the current system boundaries before
modifying the code.

### `src/game/types.ts`

Defines the shared TypeScript data model used throughout EXiLE.

This file contains the core types for players, bases, resources, armies,
tiles, missions, combat results, game events, treasure, scoring, lobby
state, match configuration, and the authoritative `GameState`.

Important architectural details represented here include:

-   Players may own up to three bases.
-   Missions can be outbound or returning and may represent transfers,
    attacks, loot, expansion, or relocation.
-   Mission origin coordinates are stored directly on missions so
    already-launched missions can continue even if their origin base is
    destroyed.
-   Historical army-training totals are preserved for end-game scoring.
-   Eliminated-player scores can be frozen in `finalScoreByPlayer`.
-   `winnerPlayerId` is `null` while a match is active and is set by the
    authoritative server when the match ends.

Because these types are shared across the client, shared game logic, and
server, changes here can affect networking and authoritative state
handling across the entire project.

### `src/game/gameState.ts`

Contains EXiLE's static game configuration and default starting data.

This file defines:

-   Available maps and their supported player counts/dimensions.
-   Match types, including the 30-minute and Sudden Death modes.
-   The four playable characters, including name, color, and avatar.
-   The three possible base names assigned to each player.
-   `getBaseName()`, which resolves a player's base name from its base
    slot.
-   Default starting bases and starting resources used when initializing
    a new match.

This file represents configuration rather than live match state. Runtime
state such as current resources, missions, treasure, eliminations, and
the winner is created separately in `createInitialGameState.ts` and then
maintained by the authoritative server.

### `src/game/createInitialGameState.ts`

Creates a fresh runtime `GameState` whenever a match starts or resets.

The function accepts the active player IDs, selected match type, and
selected map, then builds the initial authoritative state used by the
server.

It is responsible for:

-   Including only the players participating in the current match.
-   Assigning map-specific starting base positions.
-   Creating fresh copies of bases, armies, training state, and starting
    resources so a new match cannot reuse mutated objects from a
    previous game.
-   Giving each active player one starting Expansion Key.
-   Initializing historical army-training and resource-spending totals
    used for end-game scoring.
-   Resetting missions, game events, treasure, eliminations, IDs, the
    game clock, and the winner.

Map Two currently supports two players and overrides their normal EXiLE
Island starting positions with B1 and C8.

This file bridges the static configuration in `gameState.ts` and the
live authoritative match state maintained by the server.

### `src/game/rules.ts`

Contains EXiLE's shared deterministic game rules.

This file is intended to be the common source of truth for rules that
must behave identically on the client and authoritative server. It
currently handles production multipliers, army costs, combat resolution,
automatic loot distribution, and end-game player scoring.

#### Base production

A base's production multiplier increases based on how long it has
remained in its current location:

-   0--1:59: 1x
-   2:00--4:59: 2x
-   5:00--9:59: 3x
-   10:00+: 4x

Relocating a base resets its time-in-location elsewhere in the game
logic.

#### Army training cost

Each resource type tracks its historical armies built at that base.

Training starts at 100 resources and increases by 50 for each previously
trained army of that resource type. Losing an army does not reduce
future training costs.

#### Combat

Combat is deterministic.

1.  Matching army types cancel each other 1-for-1.
2.  Attacker-favorable elemental matchups resolve.
3.  Defender-favorable elemental matchups resolve.
4.  The defending base's militia fights one remaining attacker.
5.  The attacker only wins if at least one attacking army remains, all
    defending armies are gone, and the militia is defeated.

The elemental advantage cycle is:

-   Water \> Fire
-   Fire \> Grass
-   Grass \> Water

One army fighting with elemental advantage can eliminate up to two
armies of the weaker type and survives that matchup.

Militia casualty selection is deterministic. If multiple attacking army
types remain, militia targets the largest group, with ties resolved in
Water → Fire → Grass order.

#### Loot

Automatic raid/treasure loot is distributed as evenly as possible among
Water, Fire, and Grass.

If one resource type runs out, unused capacity is redistributed among
the remaining types. Any final indivisible remainder is taken from the
resource type with the largest amount remaining, with Water → Fire →
Grass used as the deterministic tie order.

#### Player scoring

Player score consists of:

-   500 points per surviving base.
-   1 point per owned resource, including resources currently in
    transit.
-   Surviving armies valued using the player's historical average
    training cost per army.

Relocating bases still count toward base score. Their armies and
resources are represented by the relocation mission while in transit and
are therefore excluded from the stationary-base totals to prevent
double-counting.

Refundable relocation payments also remain part of the player's resource
score while the relocation is unresolved.

### `src/game/maps/mapOne.ts`

Defines EXiLE Island, the primary 8x8 game map.

The map is authored as a human-readable two-dimensional grid using three
helper functions:

-   `G(...)` creates Grass tiles.
-   `W(...)` creates Water tiles.
-   `F(...)` creates Fire tiles.

Each tile can define its terrain type, resource multiplier, and optional
river or lava flow direction.

The file includes coordinate and flow-direction documentation so the map
can be edited directly without having to reason about zero-based array
indexes.

After the 8x8 layout is defined, it is converted into the flat `Tile[]`
format used by the rest of EXiLE. Each exported tile receives its
zero-based row and column coordinates during this conversion.

Flow-direction values describe which two edges of a river or lava tile
connect; they do not indicate the direction the liquid is moving.

### `src/game/maps/mapTwo.ts`

Defines Map Two, a compact 4x8 map designed for two-player matches.

Like EXiLE Island, the map is authored as a human-readable
two-dimensional grid using the `G`, `W`, and `F` helper functions for
Grass, Water, and Fire tiles.

Each tile can define its terrain type, resource multiplier, and optional
river or lava flow direction.

Map Two is 180-degree rotationally symmetrical to give the two starting
players equivalent terrain and resource opportunities.

The first active player starts at B1 and the second active player starts
at C8. Those starting-base overrides are applied in
`createInitialGameState.ts`.

The hand-authored grid is converted into the flat `Tile[]` format used
by the rest of EXiLE, with zero-based row and column coordinates
assigned during that conversion.

### `src/components/ArmyMovements.tsx`

Displays the current player's missions that are traveling across the
map.

The component receives missions, known bases, and treasure locations and
converts each mission into a human-readable movement summary showing:

-   Mission status, such as attacking, returning, expanding, or
    relocating.
-   Origin and destination.
-   Remaining travel time.
-   Armies in transit.
-   Resources being carried.
-   Expansion Keys being carried.

Expansion and relocation missions use map coordinates as destinations,
while normal army missions generally use base IDs.

Loot missions reuse `destinationBaseId` to store the target Treasure ID,
so the component resolves those destinations against the supplied
treasure list.

The component is display-only. It does not update mission state or
resolve arrivals; those behaviors are handled by the authoritative game
logic.

### `src/components/GameClock.tsx`

Displays the current match time in `minutes:seconds` format.

The component receives the authoritative game's elapsed time in seconds
and formats it for display. It does not maintain or advance the game
clock itself; the match timer is controlled by the authoritative server.

### `src/components/BasePiece.tsx`

Renders a player's base on the game map.

The component displays the base's visual structure, player avatar,
optional base name, and tooltip information. It can also visually
indicate when a base is selected or is a valid attack or transfer
target.

A base's visual tier changes according to how long it has remained in
its current location:

-   Under 2 minutes: Tent
-   2--5 minutes: House
-   5--10 minutes: Settlement
-   10+ minutes: Castle

The component can display travel time when the base is being considered
as a mission target.

Player color is passed into CSS through the `--player-color` custom
property so the component's styling can reflect the base owner.

`BasePiece` is presentation-only. It does not modify bases, resolve
attacks, or control mission movement.

### `src/components/ResourceBar.tsx`

Displays the Water, Fire, and Grass resource totals for the currently
selected base.

The component receives the three resource values as props and renders
them with their corresponding resource icons.

`ResourceBar` is presentation-only. It does not produce, spend, or
modify resources; resource state is maintained by the authoritative game
state.

### `src/components/Leaderboard.tsx`

Displays the current player standings for the match.

The component calculates each active player's score using the shared
`calculatePlayerScore()` rule and sorts players from highest to lowest
score.

For active players, the displayed score is calculated from the current
game state. When a player is eliminated, the component uses that
player's frozen score from `finalScoreByPlayer` so later changes to
missions or other state do not change their final standing.

Eliminated players are visually marked with a separate leaderboard
style.

The scoring formula itself is not defined in this component. It lives in
`src/game/rules.ts`, keeping scoring behavior shared with the
authoritative server.

### `src/components/GameLog.tsx`

Displays the public chronological log of important match events.

The Game Log currently renders:

-   Battles and their surviving armies.
-   Base destruction and loot results.
-   Expansion.
-   Relocation.
-   Treasure looting.
-   Transfers.
-   Mission failures.
-   Player elimination.
-   Match victory.

Events are displayed newest-first.

Battle events store their timestamp inside their battle report, while
other game events store `gameSeconds` directly. When multiple events
happen during the same second, the display uses a deterministic ordering
so victory and elimination events appear above the battle that caused
them.

Mission-failure events explain failures such as an unavailable
destination, a destroyed origin base, or a relocation that cannot return
to its original location.

`GameLog` is presentation-only. The authoritative server creates the
game events; this component only sorts and renders them for players.

### `src/components/Tile.tsx`

Renders one tile of the game map.

The component is responsible for displaying:

-   Terrain and resource type.
-   Resource multipliers.
-   River or lava flow styling.
-   Map-edge styling.
-   Treasure.
-   Bases.
-   Travel-time indicators.
-   Valid or unavailable mission targets.

`Tile` also routes click behavior for attacks, transfers, loot,
expansion, and relocation to the callback supplied by its parent.

Bases are rendered through `BasePiece`, while treasure and tile-level
targeting are rendered directly inside this component.

The component does not resolve missions or modify game state. It only
displays the current authoritative state and forwards user interactions
to higher-level game logic.

### `src/components/GameMap.tsx`

Builds and renders the interactive game map from the current
authoritative match state.

For each map tile, the component determines:

-   Whether a base occupies the tile.
-   Whether treasure occupies the tile.
-   Which player owns a base.
-   The base's display name.
-   Whether the tile is a valid attack, loot, expansion, transfer, or
    relocation target.
-   Whether the tile should be marked unavailable during targeting.
-   Travel time from the currently selected origin base.

Travel time is calculated using Manhattan distance between map
coordinates.

Most army missions currently use 5 seconds of travel time per tile,
while relocation uses 15 seconds per tile.

`GameMap` does not execute missions itself. It derives targeting and
display state, renders each map position through `Tile`, and forwards
valid target selections to callbacks supplied by the parent game
component.

### `src/components/BaseActions.tsx`

Controls the action menus for the currently selected base.

The component provides the player-facing workflows for:

-   Training Water, Fire, or Grass armies.
-   Sending armies to attack.
-   Sending armies to loot treasure.
-   Transferring armies and resources between friendly bases.
-   Paying for and beginning an expansion.
-   Paying for and beginning a base relocation.

`BaseActions` manages temporary UI state such as selected armies, cargo,
and resource payments. Army selection is limited by the armies currently
stationed at the base, and cargo capacity is 200 resources per selected
army.

Expansion currently costs one Expansion Key plus 500 resources.

Relocation cost increases with the number of previous relocations
performed by that base.

The component performs client-side UI checks to control selections and
button availability, but completed actions are passed upward through
callbacks. Authoritative validation and changes to the match state are
handled by the server.

### `src/components/Lobby.tsx`

Displays the multiplayer lobby before a match begins.

The component renders:

-   Available player slots.
-   Character selection.
-   Ready status.
-   Join and leave controls.
-   Host designation.
-   Map selection.
-   Match-type selection.
-   Match-start requirements and validation messages.

Each playable character can only be selected by one occupied lobby slot
at a time.

Only the host can change the map, change the match type, or start the
game. The Play Game button becomes available when the selected map
supports the current number of players and every occupied slot is ready.

The lobby performs client-side checks to control the interface, but
lobby state and authoritative validation are maintained by the server.
Player actions such as joining, leaving, changing characters, readying
up, and starting the match are passed upward through callbacks and sent
to the server.

### `src/App.tsx`

Acts as the main client-side coordinator for EXiLE.

`App` connects the React interface to the authoritative multiplayer
server and holds the latest lobby and match state received over
WebSockets.

Its primary responsibilities include:

-   Connecting to the EXiLE WebSocket server on port 8080.
-   Receiving and storing authoritative lobby and `GameState` updates.
-   Determining which player and bases belong to the current client.
-   Maintaining temporary client-side map-targeting state for attack,
    loot, transfer, expansion, and relocation workflows.
-   Sending player action requests to the server.
-   Selecting the correct map layout for the current match.
-   Deriving client display data such as the selected base, resources,
    standings, elimination state, and winner.
-   Rendering the lobby before a match and the main game interface after
    the server starts the match.
-   Coordinating the Game Map, Game Log, Leaderboard, Base Actions,
    Resource Bar, Army Movements, Game Clock, and base selector.

`App.tsx` does not run the authoritative game simulation. Training,
production, mission resolution, combat, resource changes, elimination,
scoring, and victory are validated and resolved by the server.

The targeting state stored in `App` is temporary UI state only. For
example, when a player chooses armies for an attack, `App` remembers
those armies while the player selects a destination on the map. Once the
destination is chosen, the action is sent to the server for
authoritative validation and execution.

The client currently receives full authoritative `GameState` snapshots
from the server and renders the interface from those snapshots.

### `src/App.css`

Contains the primary visual styling for the EXiLE client.

The stylesheet defines the layout and appearance of the game map,
terrain, bases, resources, game log, leaderboard, army movements, base
actions, lobby, targeting indicators, treasure, game-over interface, and
base selector.

It also contains desktop-responsive layouts for medium-size displays and
smaller desktop/laptop screens.

Map terrain and flow-direction classes are used by the map components to
render Grass, Water, Fire, rivers, lava, map edges, and resource
multipliers.

Mission-targeting styles visually distinguish valid attack, loot,
transfer, expansion, and relocation destinations without controlling
whether those actions are actually legal. Target validation remains part
of the game logic and authoritative server.

### `server/src/index.ts`

Runs the authoritative EXiLE multiplayer game server using Node.js and
WebSockets.

The server listens on port `8080` and owns both the multiplayer lobby
and the live match simulation.

#### Lobby responsibilities

The server manages:

-   Connected clients and client IDs.
-   Lobby slots and character selection.
-   Ready status.
-   Host assignment and host reassignment when the host leaves or
    disconnects.
-   Map selection.
-   Match-type selection.
-   Validation that the selected map supports the current player count.
-   Starting a match only when the lobby is valid and all players are
    ready.

The first connected player becomes the host. If the host leaves or
disconnects, host control passes to another player in the lobby.

#### Authoritative game state

When a match begins, the server creates the initial `GameState` and
advances the match once per second.

The server is authoritative for:

-   Match time.
-   Base aging.
-   Resource production.
-   Army training and training costs.
-   Army movement.
-   Transfers.
-   Attacks and combat.
-   Looting.
-   Expansion.
-   Relocation.
-   Mission failures and returns.
-   Treasure creation and removal.
-   Expansion Keys.
-   Player elimination.
-   Score calculation.
-   Victory.
-   Public game events.

Clients do not directly modify these systems. They send action requests
to the server, the server validates those requests, updates the
authoritative `GameState`, and broadcasts the resulting state to
connected clients.

#### Missions

The server currently supports five mission types:

-   `transfer`
-   `attack`
-   `loot`
-   `expand`
-   `relocate`

Mission travel and arrival are processed by the server game tick.

Attack, transfer, loot, and expansion travel currently use 5 seconds per
map tile. Relocation uses 15 seconds per tile.

Missions preserve enough origin and destination information to resolve
failures and returns even when the map changes while they are traveling.

Examples include:

-   An attack returning when its target no longer exists.
-   A transfer returning when its destination is destroyed.
-   A loot mission failing when its treasure has already been taken.
-   A failed expansion returning its resources and Expansion Key.
-   A relocation returning when its destination becomes occupied.
-   A relocating base being lost if both its destination and original
    location become unavailable.

If a mission's required origin base is destroyed before a return can
complete, the returning armies, resources, and other carried items are
lost.

#### Combat and scoring

Combat, loot distribution, army costs, production multipliers, and
player scoring use the shared deterministic rules from
`src/game/rules.ts`.

This keeps the authoritative server and client display logic based on
the same rule definitions without duplicating those formulas.

A player is eliminated immediately when they have no surviving bases.
Their score is frozen at elimination.

In a 30-minute match, the server determines the winner from the
surviving players' scores when time expires. In Sudden Death, play
continues until only one player remains.

#### Networking

The server currently broadcasts full authoritative `GameState` snapshots
to connected clients after state-changing player actions and after each
server game tick.

The current multiplayer implementation is designed first for LAN play.
Features such as persistent rooms, reconnect support, internet
matchmaking, protocol hardening, and runtime validation of incoming
WebSocket message payloads are future work.
