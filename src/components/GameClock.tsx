interface GameClockProps {
  seconds: number;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

export default function GameClock({
  seconds,
}: GameClockProps) {
  return (
    <div className="game-clock">
      {formatTime(seconds)}
    </div>
  );
}