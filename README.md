# EXiLE

EXiLE is a fast-paced, browser-based multiplayer strategy game built around territory control, resource production, research, military training, tactical combat, and expansion.

Players compete to build and defend their empires on a shared island. Every decision matters: where to establish bases, which technologies to research, how to allocate resources, and when to attack.

The game is developed by **Ankle Deep Games** using React, TypeScript, Vite, Node.js, and WebSockets.

The immediate goal is a stable, playable online release for friends, with an authoritative multiplayer server and support for independent game rooms.

---

## Table of Contents

- [Current Game Overview](#current-game-overview)
- [Local Development Setup](#local-development-setup)
- [Multiplayer Architecture](#multiplayer-architecture)
- [Current Map](#current-map)
- [Factions](#factions)
- [Resources and Production](#resources-and-production)
- [Research and Base Upgrades](#research-and-base-upgrades)
- [Military Units and Training](#military-units-and-training)
- [Missions](#missions)
- [Combat Rules](#combat-rules)
- [Elimination and Victory](#elimination-and-victory)
- [Scoring](#scoring)
- [Game Events](#game-events)
- [Current Multiplayer Status](#current-multiplayer-status)
- [Future Ideas and Improvements](#future-ideas-and-improvements)
- [Project Structure](#project-structure)

---

## Current Game Overview

Players control an empire consisting of one to three bases on a shared tile-based map.

Each base produces resources that can be used to:

- Recruit military units.
- Research technological improvements.
- Upgrade bases.
- Establish additional bases.
- Relocate existing bases.
- Support military operations.

The three resources are:

- 💧 **Water**
- 🔥 **Fuel**
- 🌱 **Food**

Internally, these resources retain the identifiers `water`, `fire`, and `grass`, the base elements.

Players select one of four factions, each providing a distinct gameplay advantage.

Combat uses four military unit types with different health, attack, speed, and support capabilities.

There is no fog of war. The map, bases, and major game events are visible to all players.

The game supports multiplayer matches with human players and computer-controlled opponents.

### Core Gameplay Loop

1. Establish a starting base and begin producing resources.
2. Recruit units and research improvements.
3. Collect treasure and Expansion Keys.
4. Expand into valuable territory.
5. Attack competing empires while defending your own.
6. Eliminate opponents or achieve the highest score before time expires.

---

## Local Development Setup

### Prerequisites

Install:

- Git
- Node.js LTS (includes npm)
- Visual Studio Code (recommended)

Recommended VS Code extensions:

- ESLint
- Prettier

### Clone and Install

Clone the repository:

```bash
git clone <EXILE_REPOSITORY_URL>
cd exile
```

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

Start the authoritative server from the `server` directory:

```bash
npm run dev
```

Open a second terminal in the repository root and start the React client:

```bash
npm run dev -- --host
```

Vite displays a Local URL and Network URL.

- Use the Local URL on the development computer.
- Use the Network URL for devices on the same local network.

The client and server must both be running.

### Production Build

From the repository root:

```bash
npm run build
```

The production build should be tested before deployment rather than relying exclusively on the Vite development server.

---

## Deploying EXiLE to Production

EXiLE uses **Render** for the multiplayer backend and **GitHub Pages** (via the Ankle Deep Games website repository) for the frontend.

### 1. Push EXiLE changes to GitHub

From the EXiLE repository:

```powershell
cd C:\Users\davidpc\Documents\GitHub\exile

git add .
git commit -m "Update EXiLE"
git push origin main
```

### 2. Deploy the backend on Render

1. Open [Render Dashboard](https://dashboard.render.com/).
2. Select the EXiLE service.
3. Click **Manual Deploy → Deploy latest commit**.
4. Wait for the service to show **Live**.

Backend URL: https://exile-7ch3.onrender.com

### 3. Build the frontend

From the EXiLE repository:

```powershell
npm run build
```

Ensure `.env.production` points to the production WebSocket server:

```text
wss://exile-7ch3.onrender.com
```

### 4. Copy the frontend into the website repository

```powershell
cd C:\Users\davidpc\Documents\GitHub\ankle-deep-games-website

xcopy ..\exile\dist\* exile\ /E /I /Y
```

### 5. Publish the website

From the website repository:

```powershell
git add .
git commit -m "Deploy latest EXiLE frontend"
git push origin main
```

### 6. Verify production

1. Wait for the [GitHub Pages deployment](https://github.com/dplorenz23/ankle-deep-games-website/actions) to finish.
2. Open https://ankledeepgames.com and click **Play**.
3. Hard-refresh with `Ctrl + Shift + R` if the old version appears.
4. Create a game and join from a second browser to verify multiplayer connectivity.

**Note:** Updating the Render backend does not automatically update the frontend. Both repositories must be deployed for a complete EXiLE release.

## Multiplayer Architecture

EXiLE uses a **server-authoritative multiplayer architecture**.

The React client handles:

- Rendering the map and game interface.
- Lobby creation and joining.
- Faction and portrait selection.
- Displaying resources, research, armies, and missions.
- Sending player actions to the server.
- Displaying authoritative game-state updates.

The Node.js WebSocket server handles:

- Room and lobby management.
- Player and bot assignments.
- Match initialization.
- Game clock and resource production.
- Research and base upgrades.
- Unit training.
- Mission movement and resolution.
- Combat and healing.
- Expansion and relocation.
- Elimination, scoring, and victory.
- Public game events.

**The server is the source of truth for gameplay.**

Clients may calculate previews or disable unavailable controls, but the server independently validates actions before modifying game state.

Shared gameplay constants are centralized in:

```text
src/game/balance.ts
```

Shared types and reusable game rules are located in:

```text
src/game/types.ts
src/game/rules.ts
```

The server broadcasts authoritative game-state updates to connected clients.

### Rooms and Lobbies

Players can:

- Create a new game.
- Join an existing game using a four-digit room code.
- Select a faction and portrait.
- Ready up before the match.
- Add computer-controlled opponents.
- Leave a lobby.
- Start a match when the lobby is valid.

Lobby host ownership can transfer when the current host leaves.

Empty lobbies are removed.

The game also supports a Play Again flow following a completed match.

---

## Current Map

### EXiLE Island

EXiLE Island (`mapOne`) is the current playable map.

It is an 8×8 hand-authored island containing Water, Fuel, and Food terrain.

Tiles have resource-production multipliers, making some locations more valuable than others.

The map supports strategic decisions involving:

- Resource availability.
- Distance between bases.
- Expansion opportunities.
- Defensible positions.
- Valuable central territory.
- Treasure locations.

Additional maps may be introduced in future releases.

---

## Factions

Players select one of four factions during lobby setup.

Each faction provides a permanent gameplay advantage.

| Faction       | Bonus                                             |
| ------------- | ------------------------------------------------- |
| **Soldier**   | +15% unit attack and health                       |
| **Engineer**  | Starting base begins at Level 2                   |
| **Farmer**    | +15% resource production                          |
| **Scientist** | 15% reduction to unit training and research costs |

Faction bonuses are defined in `src/game/balance.ts`.

### Faction Rules

- Faction selection is independent for each player.
- Human players and bots use the same faction rules.
- Faction bonuses are separate from research bonuses.
- Research remains available to every faction.
- Faction bonuses apply automatically.

Faction choice is intended to influence strategy without restricting access to particular units or technologies.

---

## Resources and Production

Every base produces resources according to its location and upgrade level.

The three resource types are Water, Fuel, and Food.

Resource production is influenced by:

1. The resource type and multiplier of the occupied tile.
2. The base's current upgrade level.
3. The player's Production research level.
4. Any applicable faction bonus.

### Base Production

Base production increases through upgrades.

The base-production values configured in `balance.ts` are:

| Base Level | Primary Production | Secondary Production |
| ---------- | -----------------: | -------------------: |
| Level 1    |                  1 |                    0 |
| Level 2    |                  2 |                    1 |
| Level 3    |                  3 |                    1 |
| Level 4    |                  4 |                    2 |

These values are applied through the game's production calculations, including applicable tile and research modifiers.

### Local Resource Storage

Resources belong to individual bases rather than one shared empire-wide inventory.

This means:

- A base must have sufficient local resources to pay for its actions.
- Resources cannot be spent instantly from another base.
- Transfers are required to move resources between bases.

This creates strategic decisions about where to produce, store, and spend resources.

---

## Research and Base Upgrades

EXiLE includes three player-wide research categories and a separate base-upgrade system.

Research levels range from 1 to 4.

### Military Training

Improves the combat effectiveness of the player's units.

Each level above Level 1 provides:

- +15% attack.
- +15% health.

Military research applies across the player's empire.

### Resource Production

Increases resource generation.

Each level above Level 1 provides:

- +15% resource production.

Production research applies to all of the player's bases.

### Efficiency

Reduces resource costs.

Each level above Level 1 provides:

- 15% reduction to unit training costs.
- 15% reduction to research costs.

Efficiency discounts are additive across research levels and applicable faction bonuses.

### Research Costs

| Research   | Level 2 (W/F/Food) | Level 3         | Level 4         |
| ---------- | ------------------ | --------------- | --------------- |
| Military   | 50 / 150 / 50      | 100 / 300 / 100 | 150 / 450 / 150 |
| Production | 50 / 50 / 150      | 100 / 100 / 300 | 150 / 150 / 450 |
| Efficiency | 150 / 50 / 50      | 300 / 100 / 100 | 450 / 150 / 150 |

Research costs are paid using the selected base's local resources.

Military, Production, and Efficiency research complete immediately when successfully purchased.

### Base Upgrades

Bases can be upgraded individually from Level 1 through Level 4.

| Upgrade     | Cost (Water/Fuel/Food) | Construction Time |
| ----------- | ---------------------- | ----------------- |
| Level 1 → 2 | 100 / 100 / 100        | 10 seconds        |
| Level 2 → 3 | 200 / 200 / 200        | 20 seconds        |
| Level 3 → 4 | 300 / 300 / 300        | 30 seconds        |

Unlike player-wide research, base upgrades affect individual bases.

The Engineer faction begins with its starting base at Level 2.

Base upgrades are timed, while the three research categories complete immediately.

---

## Military Units and Training

EXiLE has four military unit types.

| Unit         | Health | Attack | Speed | Special Ability     |
| ------------ | -----: | -----: | ----: | ------------------- |
| **Guardian** |    150 |     15 |     1 | High durability     |
| **Marksman** |    100 |     25 |     2 | High damage         |
| **Medic**    |     70 |      5 |     2 | Heals 10 HP         |
| **Spy**      |     40 |      5 |     3 | High movement speed |

All units can participate in combat.

Each unit type has different strengths and weaknesses.

### Unit Costs

| Unit     | Water | Fuel | Food |
| -------- | ----: | ---: | ---: |
| Guardian |    15 |   65 |   20 |
| Marksman |    20 |   40 |   40 |
| Medic    |    65 |   10 |   25 |
| Spy      |    30 |   15 |   55 |

Unit costs may be modified by Efficiency research and applicable faction bonuses.

### Training Rules

- Training takes 10 seconds per unit.
- Bases train units independently.
- Each base can have one active training order.
- Resources are paid from the training base.
- Units become available when training completes.

### Cargo Capacity

Each unit provides 200 resources of carrying capacity.

Cargo capacity is used when transferring resources or collecting treasure.

---

## Missions

EXiLE supports the following mission types:

- Transfer
- Attack
- Loot
- Spy
- Expand
- Relocate

The server controls all mission movement, arrivals, failures, and returns.

### Travel

Standard mission travel uses a base value of 5 seconds per tile.

Relocation uses 15 seconds per tile.

Unit movement speed influences applicable military mission travel.

Distance is calculated using map coordinates.

The current balance configuration limits players to three active missions.

### Transfer

Transfers move units and optional resources between friendly bases.

- Units and cargo leave the origin when the mission launches.
- Each unit contributes 200 cargo capacity.
- Resources arrive at the destination when the mission completes.
- If the destination disappears, the mission attempts to return.

Transfers are particularly important because resources are stored locally.

### Attack

Attack missions send military units against an enemy base.

Combat resolves when the attackers reach their destination.

Depending on the result:

- The attacking force may retreat.
- Defending units may survive.
- The defending base may be destroyed.
- Resources and Expansion Keys may become available as loot.
- Surviving attackers may return with resources.

If the target disappears before arrival, the mission attempts to return.

### Loot

Loot missions collect resources from treasure on the map.

Each participating unit provides cargo capacity.

Treasure can remain on the map when a mission cannot carry everything.

If the treasure disappears before the mission arrives, the mission returns without collecting it.

### Spy

Spy units provide a dedicated reconnaissance-oriented mission option.

Spy missions are distinct from ordinary attack missions and are resolved by the authoritative server.

### Expand

Expansion establishes another base.

Players may own a maximum of three bases.

Expansion requires an Expansion Key and a resource payment.

The configured base expansion cost begins at 250 resources and increases by 250 for subsequent expansions.

New bases begin with:

- 100 Water
- 100 Fuel
- 100 Food

An expansion must reach an eligible destination to succeed.

Failed expansion missions follow the game's return and refund rules.

### Relocate

Relocation moves an existing base to another tile.

The first relocation costs 250 resources, with subsequent relocations increasing in cost.

A relocating base temporarily stops normal production and base actions while traveling.

Its units and remaining resources travel with it.

If the destination becomes unavailable, the base attempts to return to its original location.

If neither location is available, the base may be lost.

---

## Combat Rules

EXiLE uses deterministic, round-based combat.

The previous Water/Fire/Grass elemental combat system has been replaced.

### Combat Units

All four unit types participate in combat:

- Guardian
- Marksman
- Medic
- Spy

Unit effectiveness depends on health, attack, research bonuses, faction bonuses, and combat rules.

### Combat Rounds

Combat proceeds through rounds in which participating units attack and damage is resolved.

Medics provide healing during combat.

Destroyed units cannot be restored by healing.

Combat is limited to a configured maximum of 10 rounds.

### Retreat

Combat includes a retreat mechanic.

The current balance configuration includes:

```ts
combat: {
  retreatDisadvantageRatio: 2,
  maxRounds: 10,
}
```

The authoritative combat implementation determines whether a force continues fighting or retreats.

### Combat Research

Military research increases unit attack and health.

The Soldier faction provides an additional combat bonus.

All combat outcomes are calculated by the server, not independently by each player's browser.

---

## Elimination and Victory

A player is eliminated when they have no surviving bases.

Units, resources, or missions in transit do not independently prevent elimination.

When eliminated, the player's score is frozen.

### 30-Minute Match

The match lasts up to 30 minutes.

If only one player remains, that player wins immediately.

Otherwise, the highest-scoring eligible surviving player wins when time expires.

### Sudden Death

The match continues until only one player remains.

### End Screen

At the end of a match, players can view the final standings and use the Play Again flow to begin another game.

---

## Scoring

Players earn points through their surviving empire.

The balance configuration includes:

| Scoring Component | Value |
| ----------------- | ----: |
| Surviving base    |   500 |
| Military unit     |   200 |

Resources and other eligible holdings also contribute according to the authoritative scoring implementation.

The server calculates scores and final standings.

Eliminated players retain their frozen final score.

---

## Game Events

The server records significant gameplay events in the public game log, labeled **COMMS**.

Events include:

- Battles.
- Base destruction.
- Transfers.
- Loot collection.
- Expansion.
- Relocation.
- Mission failures.
- Player elimination.
- Victory.

The COMMS interface displays a compact event summary with expandable details.

Recent events appear first.

Combat reports use unit icons and counts to communicate military outcomes.

Player-private actions, such as ordinary research purchases, do not need to generate public COMMS events.

---

## Current Multiplayer Status

EXiLE has a functional server-authoritative multiplayer foundation.

Implemented systems include:

- Room creation and joining with four-digit codes.
- Lobby synchronization.
- Host reassignment.
- Human and bot player slots.
- Faction and portrait selection.
- Ready state and match-start validation.
- Match clock.
- Resource production.
- Research.
- Base upgrades.
- Military training.
- Transfers.
- Attacks and combat.
- Looting.
- Spy missions.
- Expansion.
- Relocation.
- Treasure and Expansion Keys.
- Elimination.
- Scoring and victory.
- COMMS event reporting.
- End-game standings.
- Play Again.

The current priority is verifying the full multiplayer experience, including simultaneous actions and unusual mission interactions.

Implementation of a feature does not necessarily mean every multiplayer edge case has been tested.

---

## Future Ideas and Improvements

These are possible future additions, not commitments for the first release.

### Additional Maps

Future maps may include:

- Larger islands.
- More valuable resource tiles.
- Mixed-resource production.
- Randomized maps.
- Different terrain layouts.

### Additional Players and Teams

Potential modes include:

- More than four players.
- 2v2.
- 4v4.
- Other team configurations.

Team modes would require changes to transfers, combat targeting, and victory conditions.

### Neutral Camps and Objectives

Neutral enemies or special map locations could provide additional objectives.

Possible rewards include:

- Resources.
- Expansion Keys.
- Treasure.

### New Victory Conditions

Potential modes include:

- King of the Hill.
- Territory control.
- Resource accumulation objectives.
- Timed special objectives.

### Improved Computer Players

Future bot improvements could include distinct strategic personalities:

- Aggressive attacker.
- Fast expander.
- Defensive builder.
- Resource-focused player.
- Opportunistic looter.

Bots should continue using the same underlying rules as human players.

### Army Training Queue

A future training queue could allow players to order multiple units in advance.

This should be evaluated through playtesting before implementation.

### Army Recall

Players could potentially recall missions before arrival.

Returning units would still need to travel back rather than teleporting.

### Post-Game Awards

Additional match statistics could support awards such as:

- Most bases destroyed.
- Most units trained.
- Most resources collected.
- Most battles won.
- Most expansions completed.
- Most treasure collected.

### Persistent Accounts and Statistics

Longer-term possibilities include:

- Player profiles.
- Match history.
- Win/loss records.
- Leaderboards.
- Achievements.

These are not requirements for the initial private alpha.

### Design Principles for Future Features

Future additions should generally:

- Reward strategic decisions.
- Reward attacking, discourage turtling.
- Make geography meaningful.
- Encourage interaction between players.
- Preserve clear, understandable gameplay.
- Avoid unnecessary complexity.
- Be informed by actual playtesting.

---

## Project Structure

The project separates the React client, shared gameplay logic, and authoritative server.

```text
exile/
├── public/
│   └── Game images and static assets
├── src/
│   ├── assets/
│   ├── components/
│   │   └── React game interface components
│   ├── game/
│   │   ├── balance.ts
│   │   ├── characters.ts
│   │   ├── gameState.ts
│   │   ├── rules.ts
│   │   └── types.ts
│   ├── App.tsx
│   └── App.css
├── server/
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── package.json
└── README.md
```

### Important Files

**`src/App.tsx`**

Main React application coordinator.

**`src/App.css`**

Game interface styling.

**`src/components/`**

Reusable interface components for the map, bases, military units, missions, lobby, and game controls.

**`src/game/balance.ts`**

Central configuration for:

- Resource production.
- Research bonuses and costs.
- Faction bonuses.
- Base upgrades.
- Unit statistics.
- Combat limits.
- Training.
- Expansion.
- Relocation.
- Mission timing.
- Scoring.

**`src/game/characters.ts`**

Faction identifiers, portrait types, and faction display colors.

**`src/game/types.ts`**

Shared TypeScript definitions for players, bases, units, missions, research, and game state.

**`src/game/rules.ts`**

Reusable gameplay calculations and deterministic rules.

**`src/game/gameState.ts`**

Shared game-state definitions and initialization logic.

**`server/src/index.ts`**

Authoritative multiplayer server, including room handling, gameplay actions, and simulation.

---

**EXiLE — Ankle Deep Games**

_Build your empire. Defend your territory. Survive the island._
