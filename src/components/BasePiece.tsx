import type { Base, Player } from "../game/types";

interface BasePieceProps {
  base: Base;
  player: Player;
  isSelected?: boolean;
  isAttackTarget?: boolean;
  travelTimeSeconds?: number;
  onClick?: () => void;
  isTransferTarget?: boolean;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getBaseTier(seconds: number) {
  if (seconds >= 600) {
    return 4;
  }

  if (seconds >= 300) {
    return 3;
  }

  if (seconds >= 120) {
    return 2;
  }

  return 1;
}

function getBaseIcon(tier: number) {
  switch (tier) {
    case 1:
      return "⛺";
    case 2:
      return "🏠";
    case 3:
      return "🏘️";
    case 4:
      return "🏰";
    default:
      return "⛺";
  }
}

export default function BasePiece({
  base,
  player,
  isSelected = false,
  isAttackTarget = false,
  travelTimeSeconds,
  onClick,
  isTransferTarget = false,
}: BasePieceProps) {
  const tier = getBaseTier(base.timeInLocationSeconds);

  return (
    <div
      className={[
        "base-piece",
        `base-piece--tier-${tier}`,
        isSelected ? "base-piece--selected" : "",
        isAttackTarget ? "base-piece--attack-target" : "",
        isTransferTarget? "base-piece--transfer-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--player-color": player.color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="base-structure">
        {getBaseIcon(tier)}
      </div>

      <div className="base-avatar">
        {player.avatar}
      </div>

      {isAttackTarget && travelTimeSeconds !== undefined && (
        <div className="attack-travel-time">
          {travelTimeSeconds}s
        </div>
      )}

      <div className="base-tooltip">
        <strong>{player.name}</strong>

        <span>
          Time here: {formatTime(base.timeInLocationSeconds)}
        </span>

        {travelTimeSeconds !== undefined && (
          <span>
            Travel time: {travelTimeSeconds}s
          </span>
        )}
    </div>
    </div>
  );
}