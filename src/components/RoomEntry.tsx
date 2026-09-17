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
    <div className="lobby">
      <div className="lobby-panel">
        <h1>EXiLE</h1>

        <button onClick={onCreateGame}>Create Game</button>

        <div>— or —</div>

        <label>
          Game Code{" "}
          <input
            value={joinCode}
            maxLength={4}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          />
        </label>

        <button
          disabled={joinCode.trim().length !== 4}
          onClick={() => onJoinGame(joinCode)}
        >
          Join Game
        </button>
      </div>
    </div>
  );
}
