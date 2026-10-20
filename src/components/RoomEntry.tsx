import { useState } from "react";

interface RoomEntryProps {
  onCreateGame: () => void;
  onJoinGame: (roomCode: string) => void;
  isServerConnected: boolean;
}

export default function RoomEntry({
  onCreateGame,
  onJoinGame,
  isServerConnected,
}: RoomEntryProps) {
  const [joinCode, setJoinCode] = useState("");

  return (
    <main className="room-entry">
      <header className="room-entry-header">
        <div className="room-entry-brand">
          <img
            src={`${import.meta.env.BASE_URL}assets/exile-small-logo.png`}
            alt="EXiLE volcano logo"
            className="room-entry-brand-icon"
          />

          <div className="room-entry-brand-text">
            <span className="room-entry-studio">ANKLE DEEP GAMES</span>
            <span className="room-entry-logo">EXiLE</span>
          </div>
        </div>
      </header>

      <section className="room-entry-hero">
        <div className="room-entry-copy">
          <p className="room-entry-heading">
            A STRATEGY GAME OF ELEMENTS AND EMPIRES
          </p>

          <h1 className="room-entry-title">
            CONQUER.
            <br />
            EXPAND.
            <br />
            <em>OUTLAST.</em>
          </h1>

          <p className="room-entry-subtitle">
            Gather resources. Build your bases. Train your armies. Outmaneuver
            your opponents and be the last one standing.
          </p>

          <div className="room-entry-features">
            <span>2–12 PLAYERS</span>
            <span>UP TO 30 MINUTES</span>
            <span>LAST ONE STANDING</span>
          </div>
        </div>

        <div className="room-entry-panel">
          <div className="room-entry-actions">
            <label htmlFor="room-create">START A NEW BATTLE</label>

            <button
              id="room-create"
              className="room-entry-button room-entry-create"
              disabled={!isServerConnected}
              onClick={onCreateGame}
            >
              {isServerConnected ? "Create a Game" : "Connecting..."}
            </button>

            <div className="room-entry-divider">
              <span>OR JOIN FRIENDS</span>
            </div>

            <label htmlFor="room-code">GAME CODE</label>

            <div className="room-entry-join-row">
              <input
                id="room-code"
                className="room-entry-code"
                value={joinCode}
                maxLength={4}
                autoComplete="off"
                placeholder="ABCD"
                onChange={(event) =>
                  setJoinCode(
                    event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  )
                }
              />

              <button
                className="room-entry-button room-entry-join"
                disabled={!isServerConnected || joinCode.length !== 4}
                onClick={() => onJoinGame(joinCode)}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
