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
  isOwned?: boolean;
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

const BASE_IMAGES = [
  "base_stage_0_encampment.png",
  "base_stage_1_outpost.png",
  "base_stage_2_stronghold.png",
  "base_stage_3_citadel.png",
];

export default function BasePiece({
  base,
  baseName,
  player,
  isSelected = false,
  isAttackTarget = false,
  isTransferTarget = false,
  travelTimeSeconds,
  onClick,
  isOwned = false,
}: BasePieceProps) {
  const tier = getBaseTier(base.timeInLocationSeconds);

  return (
    <div
      className={[
        "base-piece",
        `base-piece--tier-${tier}`,
        isOwned ? "base-piece--owned" : "",
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
      <div className="base-structure">
        <img
          src={`${import.meta.env.BASE_URL}assets/basePieces/${BASE_IMAGES[tier - 1]}`}
          alt={`Tier ${tier} base`}
          className="base-structure-image"
          draggable={false}
        />
      </div>

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
