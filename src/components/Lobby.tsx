import type {
  LobbySlot,
  MatchConfig,
  Player,
  MatchType
} from "../game/types";

interface LobbyProps {
  slots: LobbySlot[];
  players: Player[];

  matchConfig: MatchConfig;

  onPlayerCountChange: (
    playerCount: 2 | 3 | 4,
  ) => void;

  onMatchTypeChange: (
    matchType: MatchType,
  ) => void;

  onToggleReady: (
    slotId: number,
  ) => void;

  onStartGame: () => void;
}

export default function Lobby({
  slots,
  players,
  matchConfig,
  onPlayerCountChange,
  onMatchTypeChange,
  onToggleReady,
  onStartGame,
}: LobbyProps) {

  const occupiedSlots =
    slots.filter(
      (slot) =>
        slot.playerId !== null,
    );

  const allReady =
    occupiedSlots.length >= 2 &&
    occupiedSlots.every(
      (slot) =>
        slot.isReady,
    );

  return (
    <div className="lobby">
      <div className="lobby-panel">
        <h1>EXiLE</h1>

        <div className="lobby-slots">
          {slots.map((slot) => {
            const player =
              slot.playerId !== null
                ? players.find(
                    (player) =>
                      player.id ===
                      slot.playerId,
                  )
                : undefined;

            return (
              <div
                key={slot.slotId}
                className="lobby-slot"
              >
                <strong>
                  Slot {slot.slotId}
                </strong>

                {player ? (
                  <span>
                    {player.avatar}{" "}
                    {player.name}
                  </span>
                ) : (
                  <span>
                    Open
                  </span>
                )}

                {player && (
                  <button
                    onClick={() =>
                      onToggleReady(
                        slot.slotId,
                      )
                    }
                  >
                    {slot.isReady
                      ? "✅ Ready"
                      : "Ready Up"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="lobby-controls">
          <label>
            Players{" "}

            <select
              value={
                matchConfig.playerCount
              }
              onChange={(event) =>
                onPlayerCountChange(
                  Number(
                    event.target.value,
                  ) as 2 | 3 | 4,
                )
              }
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>

          <label>
            Match Type{" "}

            <select
              value={
                matchConfig.matchType
              }
              onChange={(event) =>
                onMatchTypeChange(
                  event.target.value as MatchType,
                )
              }
            >
              <option value="30m">
                30 Minutes
              </option>

              <option value="sudden-death">
                Sudden Death
              </option>
            </select>
          </label>

          <button
            disabled={!allReady}
            onClick={onStartGame}
          >
            Play Game
          </button>
        </div>
      </div>
    </div>
  );
}