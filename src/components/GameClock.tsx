interface GameClockProps {
  seconds: number;
  matchType: "30m" | "sudden-death";
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function GameClock({ seconds, matchType }: GameClockProps) {
  const isTimed = matchType === "30m";
  const durationSeconds = 30 * 60;
  const displaySeconds = isTimed
    ? Math.max(0, durationSeconds - seconds)
    : seconds;
  const progress = Math.min(1, Math.max(0, seconds / durationSeconds));

  const segmentCount = 20;
  const filledSegments = Math.floor(progress * segmentCount);

  return (
    <div className="game-clock">
      <div className="game-clock-header">
        <span className="game-clock-mode">
          {isTimed ? "TIMED MATCH" : "SUDDEN DEATH"}
        </span>
        <span className="game-clock-time">{formatTime(displaySeconds)}</span>
      </div>

      {isTimed ? (
        <div className="game-clock-progress">
          {Array.from({ length: segmentCount }, (_, index) => {
            const hue = 40 - (index / (segmentCount - 1)) * 38;

            return (
              <span
                key={index}
                className="game-clock-segment"
                style={{
                  backgroundColor:
                    index < filledSegments
                      ? `hsl(${hue}, 60%, 43%)`
                      : "rgba(255, 255, 255, 0.1)",
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="game-clock-survival">☠ Last survivor wins</div>
      )}
    </div>
  );
}
