import { useState } from "react";

interface RoomEntryProps {
  onCreateGame: () => void;
  onJoinGame: (roomCode: string) => void;
}

export default function RoomEntry({
  onCreateGame,
  onJoinGame,
}: RoomEntryProps) {
  const [joinCode, setJoinCode] = useState("");

  return (
    <div className="lobby room-entry">
      <div className="room-entry-panel">
        <h1 className="room-entry-title">EXiLE</h1>

        <p className="room-entry-heading">ENTER THE BATTLE</p>
        <p className="room-entry-subtitle">
          Create a new game or join your friends.
        </p>

        <div className="room-entry-actions">
          <button
            className="room-entry-button room-entry-create"
            onClick={onCreateGame}
          >
            Create Game
          </button>

          <div className="room-entry-divider">
            <span>OR</span>
          </div>

          <label className="room-entry-code-label" htmlFor="room-code">
            Game Code
          </label>

          <input
            id="room-code"
            className="room-entry-code"
            value={joinCode}
            maxLength={4}
            autoComplete="off"
            placeholder="ABCD"
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          />

          <button
            className="room-entry-button room-entry-join"
            disabled={joinCode.trim().length !== 4}
            onClick={() => onJoinGame(joinCode)}
          >
            Join Game
          </button>
        </div>
      </div>
    </div>
  );
}
