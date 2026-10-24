import { useEffect, useRef, useState } from "react";
import {
  Swords,
  Wrench,
  Wheat,
  FlaskConical,
  CircleHelp,
  DoorOpen,
} from "lucide-react";

import Lobby from "./components/Lobby";
import ArmyMovements from "./components/ArmyMovements";
import BaseActions from "./components/BaseActions";
import GameLog from "./components/GameLog";
import GameClock from "./components/GameClock";
import GameMap from "./components/GameMap";
import ResourceBar from "./components/ResourceBar";
import Leaderboard from "./components/Leaderboard";
import RoomEntry from "./components/RoomEntry";
import HowToPlay from "./components/HowToPlay";

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

import { CLASS_COLORS } from "./game/characters";
import type { CharacterClass, PortraitVariant } from "./game/characters";

import "./App.css";

const FACTION_ICONS = {
  soldier: Swords,
  engineer: Wrench,
  farmer: Wheat,
  scientist: FlaskConical,
};

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
   * CLIENT CONNECTION STATE
   * ==========================================================
   */
  const socketRef = useRef<WebSocket | null>(null);

  const myClientIdRef = useRef<number | null>(null);

  const pendingNewGameRef = useRef(false);

  const [myClientId, setMyClientId] = useState<number | null>(null);

  const [isServerConnected, setIsServerConnected] = useState(false);

  const [yourPlayerId, setYourPlayerId] = useState(1);

  /*
   * ==========================================================
   * LOBBY STATE
   * ==========================================================
   *
   * The Lobby state where characters are chosen and pre-game
   * decisions are made
   */
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const [isGameStarted, setIsGameStarted] = useState(false);

  const [lobbySlots, setLobbySlots] = useState<LobbySlot[]>(
    createLobbySlots(4),
  );

  const [matchConfig, setMatchConfig] = useState<MatchConfig>({
    mapId: "exile-island",
    matchType: "30m",
  });

  function handleCreateGame(): void {
    socketRef.current?.send(
      JSON.stringify({
        type: "create-game",
      }),
    );
  }

  function handleJoinGame(roomCode: string): void {
    socketRef.current?.send(
      JSON.stringify({
        type: "join-game",
        roomCode,
      }),
    );
  }

  function handleMatchTypeChange(matchType: MatchType): void {
    socketRef.current?.send(
      JSON.stringify({
        type: "set-match-type",
        matchType,
      }),
    );
  }

  function handleMapChange(mapId: string): void {
    socketRef.current?.send(
      JSON.stringify({
        type: "set-map",
        mapId,
      }),
    );
  }

  function handleCharacterChange(slotId: number, playerId: number): void {
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

  function handleSelectCharacter(characterClass: CharacterClass): void {
    socketRef.current?.send(
      JSON.stringify({
        type: "select-character",
        characterClass,
      }),
    );
  }

  function handleLeaveSlot(slotId: number): void {
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

  function handleToggleReady(slotId: number): void {
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

  function handleStartGame(): void {
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

  function handleAddBot() {
    console.log("Sending add-bot request");

    socketRef.current?.send(
      JSON.stringify({
        type: "add-bot",
      }),
    );
  }

  function handleRemoveBot(botClientId: number) {
    socketRef.current?.send(
      JSON.stringify({
        type: "remove-bot",
        botClientId,
      }),
    );
  }

  /*
   * ==========================================================
   * LIVE GAME STATE
   * ==========================================================
   *
   * The latest authoritative GameState received from the server.
   * App uses this state to derive and render the current match UI.
   */
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);

  const currentMapTiles = gameState.mapId === "map-two" ? mapTwo : mapOne;

  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

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

  const yourExpansionsCompleted =
    gameState?.expansionsCompletedByPlayer[yourPlayerId] ?? 0;

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

  const characterClassByPlayer: Partial<Record<number, CharacterClass>> =
    Object.fromEntries(
      lobbySlots
        .filter(
          (slot) => slot.playerId !== null && slot.characterClass !== null,
        )
        .map((slot) => [slot.playerId, slot.characterClass]),
    );

  const yourCharacterClass = characterClassByPlayer[yourPlayerId];

  function getFactionName(playerId: number): string {
    const faction = characterClassByPlayer[playerId];

    return faction
      ? faction.charAt(0).toUpperCase() + faction.slice(1)
      : `Player ${playerId}`;
  }

  const YourFactionIcon = yourCharacterClass
    ? FACTION_ICONS[yourCharacterClass]
    : null;

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
   * Temporary client-side state used while the player is
   * choosing a map destination for a mission.
   *
   * The server still validates and creates the actual mission.
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
   * WEBSOCKET CONNECTION
   * ==========================================================
   *
   * Connects to the authoritative EXiLE server and applies
   * lobby and game-state updates received from it.
   */
  useEffect(() => {
    const previousClientId = sessionStorage.getItem("exileClientId");

    console.log("Previous session client ID:", previousClientId);

    const websocketBaseUrl =
      import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8080`;

    const socketUrl = previousClientId
      ? `${websocketBaseUrl}?clientId=${previousClientId}`
      : websocketBaseUrl;

    const socket = new WebSocket(socketUrl);

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Connected to EXiLE server", socketUrl);
      setIsServerConnected(true);
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "connected") {
        myClientIdRef.current = message.clientId;

        setMyClientId(message.clientId);

        console.log(`I am Client ${message.clientId}`);
      }

      if (message.type === "room-created") {
        setRoomCode(message.roomCode);

        if (myClientIdRef.current !== null) {
          sessionStorage.setItem(
            "exileClientId",
            String(myClientIdRef.current),
          );
        }
      }

      if (message.type === "room-joined") {
        setRoomCode(message.roomCode);

        if (myClientIdRef.current !== null) {
          sessionStorage.setItem(
            "exileClientId",
            String(myClientIdRef.current),
          );
        }
      }

      function resetGameUI(): void {
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
        setPendingLootArmies(null);
        setPendingTransferResources(null);
        setPendingExpansionPayment(null);
        setPendingRelocationPayment(null);
      }

      if (message.type === "room-left") {
        const createNewGame = pendingNewGameRef.current;
        pendingNewGameRef.current = false;

        resetGameUI();

        setShowForfeitConfirm(false);

        setRoomCode(null);
        setLobbySlots(createLobbySlots(4));

        if (createNewGame) {
          handleCreateGame();
        }
      }

      if (message.type === "lobby-state") {
        console.log("Server lobby:", message.players);

        setLobbySlots(
          message.players.map((player: LobbySlot) => ({
            clientId: player.clientId,
            slotId: player.slotId,
            playerId: player.playerId,
            isReady: player.isReady,
            isHost: player.isHost,
            isBot: player.isBot,
            characterClass: player.characterClass,
            portrait: player.portrait,
          })),
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
        setGameState(message.gameState);
      }
    };

    socket.onclose = (event) => {
      console.log(
        "Disconnected from EXiLE server",
        "code:",
        event.code,
        "reason:",
        event.reason,
      );
      setIsServerConnected(false);
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  function cancelTargeting(): void {
    setTargetingMode(null);

    setPendingAttackArmies(null);
    setPendingLootArmies(null);
    setPendingExpansionPayment(null);
    setPendingTransferArmies(null);
    setPendingTransferResources(null);
    setPendingRelocationPayment(null);
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
  function handleStartAttackTargeting(armies: ArmyCounts): void {
    setPendingAttackArmies({
      ...armies,
    });

    setTargetingMode("attack");
  }

  function handleAttackTargetSelected(destinationBaseId: number): void {
    if (!pendingAttackArmies) {
      return;
    }

    handleAttackArmies(destinationBaseId, pendingAttackArmies);

    setPendingAttackArmies(null);
    setTargetingMode(null);
  }

  /*
   * Sends an attack request to the authoritative server.
   */
  function handleAttackArmies(
    destinationBaseId: number,
    armies: ArmyCounts,
  ): void {
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
  function handleStartLootTargeting(armies: ArmyCounts): void {
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
   * Sends the selected treasure target and armies to the
   * authoritative server, then exits targeting mode.
   */
  function handleLootTargetSelected(treasureId: number): void {
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
   * Sends the selected transfer destination, armies, and cargo
   * to the server, then exits targeting mode.
   */
  function handleTransferTargetSelected(destinationBaseId: number): void {
    if (!pendingTransferArmies || !pendingTransferResources) {
      return;
    }

    handleTransferArmies(
      destinationBaseId,
      pendingTransferArmies,
      pendingTransferResources,
    );

    setPendingTransferArmies(null);
    setPendingTransferResources(null);
    setTargetingMode(null);
  }

  /*
   * ==========================================================
   * TRANSFER
   * ==========================================================
   *
   * Sends a transfer request to the authoritative server.
   */
  function handleTransferArmies(
    destinationBaseId: number,
    armies: ArmyCounts,
    transferredResources: BaseResources,
  ): void {
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
   * Starts a training order at the selected base.
   *
   */
  function handleTrainArmy(resource: ResourceType): void {
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
  function handleStartExpandTargeting(payment: BaseResources): void {
    setPendingExpansionPayment({
      ...payment,
    });

    setTargetingMode("expand");
  }

  function handleExpandTargetSelected(row: number, col: number): void {
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
  ): void {
    setPendingTransferArmies({
      ...armies,
    });

    setPendingTransferResources({
      ...resources,
    });

    setTargetingMode("transfer");
  }

  function handleStartRelocateTargeting(payment: BaseResources): void {
    setPendingRelocationPayment({
      ...payment,
    });

    setTargetingMode("relocate");
  }

  function handleRelocateTargetSelected(row: number, col: number): void {
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

  function handleCreateNewGame(): void {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    pendingNewGameRef.current = true;

    socketRef.current.send(JSON.stringify({ type: "leave-lobby" }));
  }

  function handleExitGame(): void {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    pendingNewGameRef.current = false;

    socketRef.current.send(JSON.stringify({ type: "leave-lobby" }));
  }

  if (!roomCode) {
    return (
      <RoomEntry
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        isServerConnected={isServerConnected}
      />
    );
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
        onCharacterChange={handleCharacterChange}
        onSelectCharacter={handleSelectCharacter}
        onLeaveSlot={handleLeaveSlot}
        roomCode={roomCode}
        onAddBot={handleAddBot}
        onRemoveBot={handleRemoveBot}
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
              {winner.id === yourPlayerId
                ? "Victory!"
                : `${getFactionName(winner.id)} Wins!`}
            </strong>

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
                    {(() => {
                      const faction = characterClassByPlayer[player.id];
                      const FactionIcon = faction
                        ? FACTION_ICONS[faction]
                        : null;

                      return (
                        <>
                          {FactionIcon && (
                            <FactionIcon
                              size={18}
                              strokeWidth={2.3}
                              color={CLASS_COLORS[faction!]}
                            />
                          )}
                          <span
                            style={{
                              color: faction
                                ? CLASS_COLORS[faction]
                                : undefined,
                            }}
                          >
                            {getFactionName(player.id)}
                          </span>
                        </>
                      );
                    })()}
                  </span>

                  <span className="final-score">{Math.round(score)}</span>
                </div>
              ))}
            </div>

            <div className="game-over-actions">
              <button
                className="game-over-button primary"
                onClick={handleCreateNewGame}
              >
                Create New Game
              </button>

              <button
                className="game-over-button secondary"
                onClick={handleExitGame}
              >
                Exit
              </button>
            </div>
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
      <GameLog
        events={gameState.gameEvents}
        players={players}
        characterClassByPlayer={characterClassByPlayer}
      />

      {/* Top-center */}
      <ResourceBar
        water={selectedResources.water}
        fire={selectedResources.fire}
        grass={selectedResources.grass}
      />

      {/* Top-right */}

      {/* Top-right HUD */}
      <div className="game-right-hud">
        <Leaderboard
          bases={gameState.bases}
          resourcesByBase={gameState.resourcesByBase}
          armyMissions={gameState.armyMissions}
          armiesTrainedByPlayer={gameState.armiesTrainedByPlayer}
          armyResourcesSpentByPlayer={gameState.armyResourcesSpentByPlayer}
          activePlayerIds={activePlayerIds}
          eliminatedPlayerIds={gameState.eliminatedPlayerIds}
          finalScoreByPlayer={gameState.finalScoreByPlayer}
          characterClassByPlayer={Object.fromEntries(
            lobbySlots
              .filter(
                (slot) =>
                  slot.playerId !== null && slot.characterClass !== null,
              )
              .map((slot) => [slot.playerId, slot.characterClass]),
          )}
        />

        <div className="game-right-hud-main">
          <div className="game-header-controls">
            <button
              className="game-how-to-button"
              onClick={() => setShowHowToPlay(true)}
              aria-label="How to Play"
              title="How to Play"
            >
              <CircleHelp size={18} strokeWidth={2.3} />
            </button>

            <button
              className="game-clock-exit"
              aria-label="Forfeit Match"
              title="Forfeit Match"
              onClick={() => setShowForfeitConfirm(true)}
            >
              <DoorOpen size={18} strokeWidth={2.3} />
            </button>

            <GameClock
              seconds={gameState.gameSeconds}
              matchType={gameState.matchType}
            />
          </div>

          <ArmyMovements
            missions={gameState.armyMissions.filter(
              (mission) => mission.playerId === yourPlayerId,
            )}
            bases={gameState.bases}
            treasures={gameState.treasures}
          />
        </div>
      </div>

      {/* Bottom-right */}
      <BaseActions
        key={selectedBaseId}
        base={selectedBase}
        resources={selectedResources}
        ownedBases={yourBases}
        expansionKeys={yourExpansionKeys}
        expansionsCompleted={yourExpansionsCompleted}
        activeDeployments={
          gameState.armyMissions.filter(
            (mission) => mission.playerId === selectedBase?.playerId,
          ).length
        }
        onTrainArmy={handleTrainArmy}
        onStartAttackTargeting={handleStartAttackTargeting}
        onStartLootTargeting={handleStartLootTargeting}
        onStartExpandTargeting={handleStartExpandTargeting}
        onStartTransferTargeting={handleStartTransferTargeting}
        onStartRelocateTargeting={handleStartRelocateTargeting}
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
        characterClassByPlayer={Object.fromEntries(
          lobbySlots
            .filter(
              (slot) => slot.playerId !== null && slot.characterClass !== null,
            )
            .map((slot) => [slot.playerId, slot.characterClass]),
        )}
      />

      {/*
       * ======================================================
       * BOTTOM-LEFT BASE SELECTOR
       * ======================================================
       */}

      <div className="base-selector">
        <div className="base-selector-title">
          <span
            style={{
              color: yourCharacterClass
                ? CLASS_COLORS[yourCharacterClass]
                : (yourPlayer?.color ?? "#d7ad6c"),
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {YourFactionIcon && (
              <YourFactionIcon
                size={16}
                strokeWidth={2.3}
                color={CLASS_COLORS[yourCharacterClass!]}
              />
            )}
            {yourCharacterClass
              ? yourCharacterClass.charAt(0).toUpperCase() +
                yourCharacterClass.slice(1)
              : "Your Bases"}
          </span>
          <span className="expansion-key-count">🔑 {yourExpansionKeys}</span>
        </div>

        <div className="base-selector-row">
          {[1, 2, 3].map((slot) => {
            const base = yourBases.find((base) => base.baseSlot === slot);

            return (
              <button
                key={slot}
                type="button"
                disabled={!base}
                className={[
                  "base-selector-button",
                  base?.id === selectedBaseId
                    ? "base-selector-button--selected"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  if (base) setSelectedBaseId(base.id);
                }}
              >
                Base {slot}
              </button>
            );
          })}
        </div>

        <div className="base-selector-details">
          {selectedBase ? (
            <>
              <div className="base-selector-details-title">
                <span>
                  {getBaseName(selectedBase.playerId, selectedBase.baseSlot)}
                </span>
                <span>SELECTED</span>
              </div>

              <div className="base-selector-stats">
                <div className="base-selector-stat-column">
                  <div className="base-selector-stat-heading">RESOURCES</div>

                  <div className="base-selector-stat">
                    <img
                      src={`${import.meta.env.BASE_URL}assets/resources/water.png`}
                      alt="Water"
                    />
                    {Math.floor(
                      gameState.resourcesByBase[selectedBase.id]?.water ?? 0,
                    )}
                  </div>

                  <div className="base-selector-stat">
                    <img
                      src={`${import.meta.env.BASE_URL}assets/resources/fuel.png`}
                      alt="Fuel"
                    />
                    {Math.floor(
                      gameState.resourcesByBase[selectedBase.id]?.fire ?? 0,
                    )}
                  </div>

                  <div className="base-selector-stat">
                    <img
                      src={`${import.meta.env.BASE_URL}assets/resources/food.png`}
                      alt="Food"
                    />
                    {Math.floor(
                      gameState.resourcesByBase[selectedBase.id]?.grass ?? 0,
                    )}
                  </div>
                </div>

                <div className="base-selector-stat-column">
                  <div className="base-selector-stat-heading">ARMIES</div>

                  <div className="base-selector-stat">
                    <img
                      src={`${import.meta.env.BASE_URL}assets/resources/water.png`}
                      alt="Water"
                    />
                    {selectedBase.armies.water}
                  </div>

                  <div className="base-selector-stat">
                    <img
                      src={`${import.meta.env.BASE_URL}assets/resources/fuel.png`}
                      alt="Fuel"
                    />
                    {selectedBase.armies.fire}
                  </div>

                  <div className="base-selector-stat">
                    <img
                      src={`${import.meta.env.BASE_URL}assets/resources/food.png`}
                      alt="Food"
                    />
                    {selectedBase.armies.grass}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="base-selector-no-base">No base selected</div>
          )}
        </div>
      </div>

      {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}

      {showForfeitConfirm && (
        <div className="forfeit-overlay">
          <div
            className="forfeit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forfeit-title"
          >
            <h2 id="forfeit-title">Leave Match?</h2>

            <p>
              Are you sure you want to forfeit this match? Your bases and armies
              will be lost.
            </p>

            <div className="forfeit-actions">
              <button
                className="forfeit-cancel"
                onClick={() => setShowForfeitConfirm(false)}
              >
                Cancel
              </button>

              <button
                className="forfeit-confirm"
                onClick={() => {
                  socketRef.current?.send(
                    JSON.stringify({ type: "forfeit-match" }),
                  );
                }}
              >
                Forfeit Match
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
