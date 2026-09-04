import { players } from "../game/gameState";
import { calculatePlayerScore } from "../game/rules";

import type {
  ArmyMission,
  Base,
  BaseResources,
  Player,
  PlayerScore,
} from "../game/types";

interface LeaderboardProps {
  bases: Base[];
  resourcesByBase: Record<number, BaseResources>;
  armyMissions: ArmyMission[];
  armiesTrainedByPlayer: Record<number, number>;
  armyResourcesSpentByPlayer: Record<number, number>;
  activePlayerIds: number[];
  eliminatedPlayerIds: number[];
  finalScoreByPlayer: Record<number, number>;
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
      <strong className="leaderboard-title">🏆 Standings</strong>

      {standings.map((standing, index) => {
        const { player, score } = standing;

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
            <span>
              {index + 1}. {player.avatar} {player.name}
            </span>

            <span>{Math.round(displayedScore).toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
