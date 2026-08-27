import { players } from "../game/gameState";
import { calculatePlayerScore } from "../game/rules";

import type {
  ArmyMission,
  Base,
  BaseResources,
} from "../game/types";

interface LeaderboardProps {
  bases: Base[];

  resourcesByBase:
    Record<number, BaseResources>;

  armyMissions: ArmyMission[];

  armiesTrainedByPlayer:
    Record<number, number>;

  armyResourcesSpentByPlayer:
    Record<number, number>;

  activePlayerIds: number[];

  eliminatedPlayerIds: number[];

  finalScoreByPlayer:
    Record<number, number>;
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
  const standings =
    activePlayerIds
      .map((playerId) => {
        const player =
          players.find(
            (player) =>
              player.id === playerId,
          );

        const score =
          calculatePlayerScore(
            playerId,
            bases,
            resourcesByBase,
            armyMissions,
            armiesTrainedByPlayer[
              playerId
            ] ?? 0,
            armyResourcesSpentByPlayer[
              playerId
            ] ?? 0,
          );

        return {
          player,
          score,
        };
      })
      .filter(
        (standing) =>
          standing.player !== undefined,
      )
      .sort((a, b) => {
        const aPlayer =
          a.player!;

        const bPlayer =
          b.player!;

        const aIsEliminated =
          eliminatedPlayerIds.includes(
            aPlayer.id,
          );

        const bIsEliminated =
          eliminatedPlayerIds.includes(
            bPlayer.id,
          );

        const aScore =
          aIsEliminated
            ? finalScoreByPlayer[
                aPlayer.id
              ] ??
              a.score.totalScore
            : a.score.totalScore;

        const bScore =
          bIsEliminated
            ? finalScoreByPlayer[
                bPlayer.id
              ] ??
              b.score.totalScore
            : b.score.totalScore;

        return bScore - aScore;
      });

  return (
    <div className="leaderboard">
      <strong className="leaderboard-title">
        🏆 Standings
      </strong>

      {standings.map(
        (standing, index) => {
          const player =
            standing.player!;

          const isEliminated =
            eliminatedPlayerIds.includes(
              player.id,
            );

          const displayedScore =
            isEliminated
              ? finalScoreByPlayer[
                  player.id
                ] ??
                standing.score.totalScore
              : standing.score.totalScore;

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
                {index + 1}.{" "}
                {player.avatar}{" "}
                {player.name}
              </span>

              <span>
                {Math.round(
                  displayedScore,
                ).toLocaleString()}
              </span>
            </div>
          );
        },
      )}
    </div>
  );
}