import { players } from "../game/gameState";
import { calculatePlayerScore } from "../game/rules";
import { Swords, Wrench, Wheat, FlaskConical } from "lucide-react";
import { CLASS_COLORS } from "../game/characters";
import type { CharacterClass } from "../game/characters";

import type {
  ArmyMission,
  Base,
  BaseResources,
  Player,
  PlayerScore,
} from "../game/types";

const FACTION_ICONS = {
  soldier: Swords,
  engineer: Wrench,
  farmer: Wheat,
  scientist: FlaskConical,
};

interface LeaderboardProps {
  bases: Base[];
  resourcesByBase: Record<number, BaseResources>;
  armyMissions: ArmyMission[];
  armiesTrainedByPlayer: Record<number, number>;
  armyResourcesSpentByPlayer: Record<number, number>;
  activePlayerIds: number[];
  eliminatedPlayerIds: number[];
  finalScoreByPlayer: Record<number, number>;
  characterClassByPlayer: Record<number, CharacterClass>;
}

interface Standing {
  player: Player;
  score: PlayerScore;
}

export default function Leaderboard({
  bases,
  resourcesByBase,
  armyMissions,
  armiesTrainedByPlayer,
  armyResourcesSpentByPlayer,
  activePlayerIds,
  eliminatedPlayerIds,
  finalScoreByPlayer,
  characterClassByPlayer,
}: LeaderboardProps) {
  function getDisplayedScore(
    playerId: number,
    calculatedScore: number,
  ): number {
    return eliminatedPlayerIds.includes(playerId)
      ? (finalScoreByPlayer[playerId] ?? calculatedScore)
      : calculatedScore;
  }

  const standings: Standing[] = activePlayerIds
    .map((playerId): Standing | null => {
      const player = players.find((player) => player.id === playerId);

      if (!player) {
        return null;
      }

      const score = calculatePlayerScore(
        playerId,
        bases,
        resourcesByBase,
        armyMissions,
        armiesTrainedByPlayer[playerId] ?? 0,
        armyResourcesSpentByPlayer[playerId] ?? 0,
      );

      return {
        player,
        score,
      };
    })
    .filter((standing): standing is Standing => standing !== null)
    .sort((a, b) => {
      const aScore = getDisplayedScore(a.player.id, a.score.totalScore);

      const bScore = getDisplayedScore(b.player.id, b.score.totalScore);

      return bScore - aScore;
    });

  return (
    <div className="leaderboard">
      <div className="leaderboard-title">
        <span>⚑ FACTIONS</span>
        <span className="leaderboard-count">{standings.length} ACTIVE</span>
      </div>

      {standings.map((standing, index) => {
        const { player, score } = standing;

        const characterClass = characterClassByPlayer[player.id];
        const FactionIcon = characterClass
          ? FACTION_ICONS[characterClass]
          : null;

        const isEliminated = eliminatedPlayerIds.includes(player.id);

        const displayedScore = getDisplayedScore(player.id, score.totalScore);

        return (
          <div
            key={player.id}
            className={
              isEliminated
                ? "leaderboard-row leaderboard-row--eliminated"
                : "leaderboard-row"
            }
          >
            <span className="leaderboard-player">
              <span>{index + 1}.</span>

              {FactionIcon && characterClass && (
                <FactionIcon
                  size={16}
                  strokeWidth={2.3}
                  color={CLASS_COLORS[characterClass]}
                />
              )}

              <span
                style={{
                  color: characterClass
                    ? CLASS_COLORS[characterClass]
                    : undefined,
                }}
              >
                {player.name}
              </span>
            </span>

            <span>{Math.round(displayedScore).toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
