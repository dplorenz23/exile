import type { CSSProperties } from "react";

import { BALANCE } from "../game/balance";

import type { Base, Player } from "../game/types";

interface BasePieceProps {
  base: Base;
  baseName?: string;
  player: Player;
  isSelected?: boolean;
  isAttackTarget?: boolean;
  isTransferTarget?: boolean;
  travelTimeSeconds?: number;
  onClick?: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getBaseTier(seconds: number): number {
  if (seconds >= BALANCE.production.level4Seconds) {
    return 4;
  }

  if (seconds >= BALANCE.production.level3Seconds) {
    return 3;
  }

  if (seconds >= BALANCE.production.level2Seconds) {
    return 2;
  }

  return 1;
}

function getBaseIcon(tier: number): string {
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
  baseName,
  player,
  isSelected = false,
  isAttackTarget = false,
  isTransferTarget = false,
  travelTimeSeconds,
  onClick,
}: BasePieceProps) {
  const tier = getBaseTier(base.timeInLocationSeconds);

  return (
    <div
      className={[
        "base-piece",
        `base-piece--tier-${tier}`,
        isSelected ? "base-piece--selected" : "",
        isAttackTarget ? "base-piece--attack-target" : "",
        isTransferTarget ? "base-piece--transfer-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--player-color": player.color,
        } as CSSProperties
      }
      onClick={onClick}
    >
      <div className="base-structure">{getBaseIcon(tier)}</div>

      <div className="base-avatar">{player.avatar}</div>

      {baseName && <div className="base-name">{baseName}</div>}

      {isAttackTarget && travelTimeSeconds !== undefined && (
        <div className="attack-travel-time">{travelTimeSeconds}s</div>
      )}

      <div className="base-tooltip">
        <strong>{player.name}</strong>

        <span>Time here: {formatTime(base.timeInLocationSeconds)}</span>

        {travelTimeSeconds !== undefined && (
          <span>Travel time: {travelTimeSeconds}s</span>
        )}
      </div>
    </div>
  );
}
