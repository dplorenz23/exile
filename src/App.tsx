import { useEffect, useRef, useState } from "react";

import Lobby from "./components/Lobby";
import ArmyMovements from "./components/ArmyMovements";
import BaseActions from "./components/BaseActions";
import GameLog from "./components/GameLog";
import GameClock from "./components/GameClock";
import GameMap from "./components/GameMap";
import ResourceBar from "./components/ResourceBar";
import Leaderboard from "./components/Leaderboard";

import { players, getBaseName } from "./game/gameState";

import { createInitialGameState } from "./game/createInitialGameState";

import { mapOne } from "./game/maps/mapOne";
import { mapTwo } from "./game/maps/mapTwo";

import { calculatePlayerScore } from "./game/rules";

import type {
  LobbySlot,
  MatchConfig,
  MatchType,
  ArmyCounts,
  BaseResources,
  ResourceType,
  GameState,
} from "./game/types";

import "./App.css";

/*
 * ============================================================
 * BASE PRODUCTION MULTIPLIER
 * ============================================================
 *
 * Time in location:
 *
 * 0–2 minutes   = 1x
 * 2–5 minutes   = 2x
 * 5–10 minutes  = 3x
 * 10+ minutes   = 4x
 */
function createLobbySlots(playerCount: number): LobbySlot[] {
  return Array.from({ length: playerCount }, (_, index) => ({
    slotId: index + 1,

    playerId: index === 0 ? 1 : null,

    isReady: false,
  }));
}

function App() {
  /*
   * ==========================================================
   * SERVER CONNECTION
   * ==========================================================
   *
   * Connect to EXiLE Server
   *
   */
  const socketRef = useRef<WebSocket | null>(null);

  const myClientIdRef = useRef<number | null>(null);

  const [myClientId, setMyClientId] = useState<number | null>(null);

  const [yourPlayerId, setYourPlayerId] = useState(1);

  /*
   * ==========================================================
   * LOBBY STATE
   * ==========================================================
   *
   * The Lobby state where characters are chosen and pre-game
   * decisions are made
   */
  const [isGameStarted, setIsGameStarted] = useState(false);

  const [lobbySlots, setLobbySlots] = useState<LobbySlot[]>(
    createLobbySlots(4),
  );

  const [matchConfig, setMatchConfig] = useState<MatchConfig>({
    mapId: "exile-island",
    matchType: "30m",
  });

  function handleJoinSlot(slotId: number) {
    setLobbySlots((current) => {
      const claimedPlayerIds = current
        .map((slot) => slot.playerId)
        .filter((playerId): playerId is number => playerId !== null);

      const availablePlayer = players.find(
        (player) => !claimedPlayerIds.includes(player.id),
      );

      if (!availablePlayer) {
        return current;
      }

      return current.map((slot) =>
        slot.slotId === slotId
          ? {
              ...slot,

              playerId: availablePlayer.id,

              isReady: false,
            }
          : slot,
      );
    });
  }

  function handleMatchTypeChange(matchType: MatchType) {
    socketRef.current?.send(
      JSON.stringify({
        type: "set-match-type",
        matchType,
      }),
    );
  }

  function handleMapChange(mapId: string) {
    socketRef.current?.send(
      JSON.stringify({
        type: "set-map",
        mapId,
      }),
    );
  }

  function handleCharacterChange(slotId: number, playerId: number) {
    const slot = lobbySlots.find((slot) => slot.slotId === slotId);

    if (!slot || slot.clientId !== myClientId) {
      return;
    }

    socketRef.current?.send(
      JSON.stringify({
        type: "change-character",
        playerId,
      }),
    );
  }

  function handleLeaveSlot(slotId: number) {
    const slot = lobbySlots.find((slot) => slot.slotId === slotId);

    if (!slot || slot.clientId !== myClientId) {
      return;
    }

    socketRef.current?.send(
      JSON.stringify({
        type: "leave-lobby",
      }),
    );
  }

  function handleToggleReady(slotId: number) {
    const slot = lobbySlots.find((slot) => slot.slotId === slotId);

    if (!slot || slot.clientId !== myClientId) {
      return;
    }

    socketRef.current?.send(
      JSON.stringify({
        type: "set-ready",
        isReady: !slot.isReady,
      }),
    );
  }

  function handleStartGame() {
    const mySlot = lobbySlots.find((slot) => slot.clientId === myClientId);

    if (!mySlot?.isHost) {
      return;
    }

    socketRef.current?.send(
      JSON.stringify({
        type: "start-game",
      }),
    );
  }

  /*
   * ==========================================================
   * LIVE GAME STATE
   * ==========================================================
   *
   * Everything that changes while a match is running lives
   * here.
   */
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);

  const currentMapTiles = gameState.mapId === "map-two" ? mapTwo : mapOne;

  /*
   * ==========================================================
   * DERIVED PLAYER DATA
   * ==========================================================
   *
   * These values are calculated from the live game state.
   */
  const yourBases = gameState.bases.filter(
    (base) => base.playerId === yourPlayerId,
  );

  const activePlayerIds = lobbySlots
    .map((slot) => slot.playerId)
    .filter((playerId): playerId is number => playerId !== null);

  const yourExpansionKeys = gameState.expansionKeysByPlayer[yourPlayerId] ?? 0;

  const youAreEliminated = gameState.eliminatedPlayerIds.includes(yourPlayerId);

  const winner =
    gameState.winnerPlayerId !== null
      ? players.find((player) => player.id === gameState.winnerPlayerId)
      : undefined;

  const finalStandings = players
    .filter((player) =>
      Object.prototype.hasOwnProperty.call(
        gameState.armiesTrainedByPlayer,
        player.id,
      ),
    )
    .map((player) => {
      const isEliminated = gameState.eliminatedPlayerIds.includes(player.id);

      const score = isEliminated
        ? (gameState.finalScoreByPlayer[player.id] ?? 0)
        : calculatePlayerScore(
            player.id,
            gameState.bases,
            gameState.resourcesByBase,
            gameState.armyMissions,
            gameState.armiesTrainedByPlayer[player.id] ?? 0,
            gameState.armyResourcesSpentByPlayer[player.id] ?? 0,
          ).totalScore;

      return {
        player,
        score,
        isEliminated,
      };
    })
    .sort((a, b) => {
      if (a.player.id === gameState.winnerPlayerId) {
        return -1;
      }

      if (b.player.id === gameState.winnerPlayerId) {
        return 1;
      }

      return b.score - a.score;
    });

  /*
   * ==========================================================
   * SELECTED BASE
   * ==========================================================
   *
   * The bottom-left base selector determines which of our
   * bases is currently active in the UI.
   */
  const [selectedBaseId, setSelectedBaseId] = useState(yourBases[0]?.id ?? 0);

  const yourPlayer = players.find((player) => player.id === yourPlayerId);

  const selectedBase = gameState.bases.find(
    (base) => base.id === selectedBaseId,
  );

  const selectedResources = gameState.resourcesByBase[selectedBaseId] ?? {
    water: 0,
    fire: 0,
    grass: 0,
  };

  /*
   * ==========================================================
   * MAP TARGETING
   * ==========================================================
   *
   * When null, the map behaves normally.
   *
   * Later this can support:
   * - attack
   * - transfer
   * - loot
   * - expand
   * - relocate
   */
  const [targetingMode, setTargetingMode] = useState<
    "attack" | "loot" | "expand" | "transfer" | "relocate" | null
  >(null);

  const [pendingAttackArmies, setPendingAttackArmies] =
    useState<ArmyCounts | null>(null);

  const [pendingLootArmies, setPendingLootArmies] = useState<ArmyCounts | null>(
    null,
  );

  const [pendingExpansionPayment, setPendingExpansionPayment] =
    useState<BaseResources | null>(null);

  const [pendingTransferArmies, setPendingTransferArmies] =
    useState<ArmyCounts | null>(null);

  const [pendingTransferResources, setPendingTransferResources] =
    useState<BaseResources | null>(null);

  const [pendingRelocationPayment, setPendingRelocationPayment] =
    useState<BaseResources | null>(null);

  /*
   * ==========================================================
   * SERVER CONNECTION
   * ==========================================================
   */
  useEffect(() => {
    const socket = new WebSocket(`ws://${window.location.hostname}:8080`);

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Connected to EXiLE server");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      console.log("Server message:", message);

      if (message.type === "connected") {
        myClientIdRef.current = message.clientId;

        setMyClientId(message.clientId);

        console.log(`I am Client ${message.clientId}`);
      }

      if (message.type === "lobby-state") {
        console.log("Server lobby:", message.players);

        setLobbySlots(
          message.players.map(
            (player: {
              clientId: number;
              slotId: number;
              playerId: number;
              isReady: boolean;
              isHost: boolean;
            }) => ({
              clientId: player.clientId,
              slotId: player.slotId,
              playerId: player.playerId,
              isReady: player.isReady,
              isHost: player.isHost,
            }),
          ),
        );
        setMatchConfig(message.matchConfig);
      }

      if (message.type === "game-started") {
        const newGameState: GameState = message.gameState;

        setGameState(newGameState);

        const myLobbyPlayer = message.players.find(
          (player: { clientId: number; playerId: number }) =>
            player.clientId === myClientIdRef.current,
        );

        if (myLobbyPlayer) {
          setYourPlayerId(myLobbyPlayer.playerId);

          const myBase = newGameState.bases.find(
            (base) => base.playerId === myLobbyPlayer.playerId,
          );

          if (myBase) {
            setSelectedBaseId(myBase.id);
          }
        }

        setTargetingMode(null);

        setIsGameStarted(true);
      }

      if (message.type === "game-state") {
        console.log("Received game state:", message.gameState);

        setGameState(message.gameState);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from EXiLE server");
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  function cancelTargeting() {
    setTargetingMode(null);

    setPendingAttackArmies(null);
    setPendingLootArmies(null);
    setPendingExpansionPayment(null);
    setPendingTransferArmies(null);
    setPendingTransferResources(null);
  }

  /*
   * ==========================================================
   * START ATTACK TARGETING
   * ==========================================================
   *
   * BaseActions tells App which armies the player selected.
   *
   * We remember those armies, then let the player choose
   * the destination directly from the map.
   */
  function handleStartAttackTargeting(armies: ArmyCounts) {
    setPendingAttackArmies({
      ...armies,
    });

    setTargetingMode("attack");
  }

  function handleAttackTargetSelected(destinationBaseId: number) {
    if (!pendingAttackArmies) {
      return;
    }

    handleAttackArmies(destinationBaseId, pendingAttackArmies);

    setPendingAttackArmies(null);
    setTargetingMode(null);
  }

  /*
   * ==========================================================
   * ATTACK
   * ==========================================================
   *
   * Creates an outbound Attack mission.
   *
   * Armies:
   * - immediately leave the originating base
   * - travel at 5 seconds per Manhattan tile
   * - carry no resources outbound
   *
   * Combat occurs later when the mission timer reaches zero.
   */
  function handleAttackArmies(destinationBaseId: number, armies: ArmyCounts) {
    socketRef.current?.send(
      JSON.stringify({
        type: "attack-army",
        originBaseId: selectedBaseId,
        destinationBaseId,
        armies,
      }),
    );
  }

  /*
   * ==========================================================
   * START LOOT TARGETING
   * ==========================================================
   *
   * Remember which armies were selected, then allow
   * the player to choose a treasure chest on the map.
   */
  function handleStartLootTargeting(armies: ArmyCounts) {
    setPendingLootArmies({
      ...armies,
    });

    setTargetingMode("loot");
  }

  /*
   * ==========================================================
   * LOOT TARGET SELECTED
   * ==========================================================
   *
   * Called when the player clicks a treasure chest while
   * the map is in Loot Targeting Mode.
   *
   * For now this creates the outbound mission only.
   * The actual looting will happen when the army arrives.
   */
  function handleLootTargetSelected(treasureId: number) {
    if (!pendingLootArmies) {
      return;
    }

    socketRef.current?.send(
      JSON.stringify({
        type: "loot-army",
        originBaseId: selectedBaseId,
        treasureId,
        armies: {
          ...pendingLootArmies,
        },
      }),
    );

    setPendingLootArmies(null);
    setTargetingMode(null);
  }

  /*
   * ==========================================================
   * TRANSFER TARGET SELECTED
   * ==========================================================
   *
   * Called when the player clicks one of their other bases
   * while the map is in Transfer Targeting Mode.
   */
  function handleTransferTargetSelected(destinationBaseId: number) {
    if (!pendingTransferArmies || !pendingTransferResources) {
      return;
    }

    /*
     * Launch the normal Transfer mission using the
     * armies and cargo we saved before entering
     * map targeting.
     */
    handleTransferArmies(
      destinationBaseId,
      pendingTransferArmies,
      pendingTransferResources,
    );

    /*
     * Clear targeting state now that the mission
     * has been launched.
     */
    setPendingTransferArmies(null);
    setPendingTransferResources(null);
    setTargetingMode(null);
  }

  /*
   * ==========================================================
   * TRANSFER
   * ==========================================================
   *
   * Sends armies and optional cargo between two of our bases.
   *
   * Each selected army provides 200 resource capacity.
   */
  function handleTransferArmies(
    destinationBaseId: number,
    armies: ArmyCounts,
    transferredResources: BaseResources,
  ) {
    socketRef.current?.send(
      JSON.stringify({
        type: "transfer-army",
        originBaseId: selectedBaseId,
        destinationBaseId,
        armies,
        resources: transferredResources,
      }),
    );
  }

  /*
   * ==========================================================
   * TRAIN ARMY
   * ==========================================================
   *
   * Starts a 10-second training order
   * at the selected base.
   */
  function handleTrainArmy(resource: ResourceType) {
    socketRef.current?.send(
      JSON.stringify({
        type: "train-army",
        baseId: selectedBaseId,
        resource,
      }),
    );
  }
  /*
   * ==========================================================
   * EXPANSION
   * ==========================================================
   *
   * Expand to an open location on the map
   *
   */
  function handleStartExpandTargeting(payment: BaseResources) {
    setPendingExpansionPayment({
      ...payment,
    });

    setTargetingMode("expand");
  }

  function handleExpandTargetSelected(row: number, col: number) {
    if (!pendingExpansionPayment) {
      return;
    }

    socketRef.current?.send(
      JSON.stringify({
        type: "expand",
        originBaseId: selectedBaseId,
        destinationRow: row,
        destinationCol: col,
        payment: {
          ...pendingExpansionPayment,
        },
      }),
    );

    setPendingExpansionPayment(null);
    setTargetingMode(null);
  }

  function handleStartTransferTargeting(
    armies: ArmyCounts,
    resources: BaseResources,
  ) {
    setPendingTransferArmies({
      ...armies,
    });

    setPendingTransferResources({
      ...resources,
    });

    setTargetingMode("transfer");
  }

  function handleStartRelocateTargeting(payment: BaseResources) {
    setPendingRelocationPayment(payment);
    setTargetingMode("relocate");
  }

  function handleRelocateTargetSelected(row: number, col: number) {
    if (!pendingRelocationPayment) {
      return;
    }

    socketRef.current?.send(
      JSON.stringify({
        type: "relocate",
        originBaseId: selectedBaseId,
        destinationRow: row,
        destinationCol: col,
        payment: {
          ...pendingRelocationPayment,
        },
      }),
    );

    setPendingRelocationPayment(null);
    setTargetingMode(null);
  }

  function handlePlayAgain() {
    setIsGameStarted(false);

    setLobbySlots((currentSlots) =>
      currentSlots.map((slot) => ({
        ...slot,
        isReady: false,
      })),
    );

    setTargetingMode(null);

    setPendingAttackArmies(null);
    setPendingTransferArmies(null);
    setPendingTransferResources(null);
    setPendingExpansionPayment(null);
    setPendingRelocationPayment(null);
  }

  if (!isGameStarted) {
    return (
      <Lobby
        slots={lobbySlots}
        players={players}
        matchConfig={matchConfig}
        myClientId={myClientId}
        onMatchTypeChange={handleMatchTypeChange}
        onMapChange={handleMapChange}
        onToggleReady={handleToggleReady}
        onStartGame={handleStartGame}
        onJoinSlot={handleJoinSlot}
        onCharacterChange={handleCharacterChange}
        onLeaveSlot={handleLeaveSlot}
      />
    );
  }

  /*
   * ==========================================================
   * MAIN GAME UI
   * ==========================================================
   */
  return (
    <main className="app">
      {winner && (
        <div className="game-over-overlay">
          <div className="game-over-panel">
            <strong>
              {winner.id === yourPlayerId ? "Victory!" : `${winner.name} Wins!`}
            </strong>

            <span>
              {gameState.matchType === "sudden-death"
                ? `${winner.name} is the last player standing.`
                : `${winner.name} had the highest score when time expired.`}
            </span>

            <h2>Final Standings</h2>

            <div className="final-standings-list">
              {finalStandings.map(({ player, score, isEliminated }, index) => (
                <div
                  key={player.id}
                  className={`final-standing-row ${
                    isEliminated ? "eliminated" : ""
                  }`}
                >
                  <span className="final-rank">{index + 1}.</span>

                  <span className="final-player">
                    {player.avatar} {player.name}
                  </span>

                  <span className="final-score">{Math.round(score)}</span>
                </div>
              ))}
            </div>

            <button className="play-again-button" onClick={handlePlayAgain}>
              🔄 Play Again
            </button>
          </div>
        </div>
      )}

      {youAreEliminated && !winner && (
        <div className="game-over-overlay">
          <div className="game-over-panel">
            <strong>Game Over</strong>

            <span>Your final base has been destroyed.</span>
          </div>
        </div>
      )}

      {/* Top-left */}
      <GameLog events={gameState.gameEvents} players={players} />

      {/* Top-center */}
      <ResourceBar
        water={selectedResources.water}
        fire={selectedResources.fire}
        grass={selectedResources.grass}
      />

      {/* Top-right */}
      <Leaderboard
        bases={gameState.bases}
        resourcesByBase={gameState.resourcesByBase}
        armyMissions={gameState.armyMissions}
        armiesTrainedByPlayer={gameState.armiesTrainedByPlayer}
        armyResourcesSpentByPlayer={gameState.armyResourcesSpentByPlayer}
        activePlayerIds={activePlayerIds}
        eliminatedPlayerIds={gameState.eliminatedPlayerIds}
        finalScoreByPlayer={gameState.finalScoreByPlayer}
      />

      <GameClock seconds={gameState.gameSeconds} />

      {/* Bottom-right */}
      <BaseActions
        key={selectedBaseId}
        base={selectedBase}
        resources={selectedResources}
        ownedBases={yourBases}
        expansionKeys={yourExpansionKeys}
        onTrainArmy={handleTrainArmy}
        onStartAttackTargeting={handleStartAttackTargeting}
        onStartLootTargeting={handleStartLootTargeting}
        onStartExpandTargeting={handleStartExpandTargeting}
        onStartTransferTargeting={handleStartTransferTargeting}
        onStartRelocateTargeting={handleStartRelocateTargeting}
      />

      {/* Traveling armies */}
      <ArmyMovements
        missions={gameState.armyMissions.filter(
          (mission) => mission.playerId === yourPlayerId,
        )}
        bases={gameState.bases}
        treasures={gameState.treasures}
      />

      {/* Map Targeting Banner */}
      {targetingMode !== null && (
        <div className="targeting-banner">
          <span>
            {targetingMode === "attack" && "Choose an enemy base to attack"}

            {targetingMode === "loot" && "Choose a treasure chest to loot"}

            {targetingMode === "expand" && "Choose an empty tile to expand to"}

            {targetingMode === "transfer" &&
              "Choose one of your bases to transfer to"}

            {targetingMode === "relocate" &&
              "Choose an empty tile to relocate to"}
          </span>

          <button onClick={cancelTargeting}>Cancel</button>
        </div>
      )}

      {/* Main battlefield */}
      <GameMap
        mapTiles={currentMapTiles}
        selectedBaseId={selectedBaseId}
        bases={gameState.bases}
        treasures={gameState.treasures}
        targetingMode={targetingMode}
        yourPlayerId={yourPlayerId}
        originBase={selectedBase}
        onAttackTargetSelected={handleAttackTargetSelected}
        onLootTargetSelected={handleLootTargetSelected}
        onExpandTargetSelected={handleExpandTargetSelected}
        onTransferTargetSelected={handleTransferTargetSelected}
        onRelocateTargetSelected={handleRelocateTargetSelected}
      />

      {/*
       * ======================================================
       * BOTTOM-LEFT BASE SELECTOR
       * ======================================================
       *
       * Quick empire overview:
       *
       * - select a base
       * - see armies
       * - see stored resources
       */}
      <div className="base-selector">
        <div className="base-selector-title">
          <span>{yourPlayer?.name ?? "Your Bases"}</span>

          <span className="expansion-key-count">🔑 {yourExpansionKeys}</span>
        </div>

        <div className="base-selector-row">
          {yourBases.map((base) => (
            <button
              key={base.id}
              className={[
                "base-selector-button",

                base.id === selectedBaseId
                  ? "base-selector-button--selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setSelectedBaseId(base.id)}
            >
              <span>{getBaseName(base.playerId, base.baseSlot)}</span>

              <span className="base-army-summary">
                ⚔️💧{base.armies.water} ⚔️🔥{base.armies.fire} ⚔️🌱
                {base.armies.grass}
              </span>

              <span className="base-resource-summary">
                💧
                {Math.floor(gameState.resourcesByBase[base.id]?.water ?? 0)} 🔥
                {Math.floor(gameState.resourcesByBase[base.id]?.fire ?? 0)} 🌱
                {Math.floor(gameState.resourcesByBase[base.id]?.grass ?? 0)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

export default App;
