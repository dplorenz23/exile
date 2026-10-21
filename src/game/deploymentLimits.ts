import { BALANCE } from "./balance";
import type { ArmyMission } from "./types";

export function hasDeploymentCapacity(
  missions: ArmyMission[],
  playerId: number,
): boolean {
  const activeCount = missions.filter(
    (mission) => mission.playerId === playerId,
  ).length;

  return activeCount < BALANCE.missions.maxActivePerPlayer;
}
