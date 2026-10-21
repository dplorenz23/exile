import type { ArmyCounts, ResourceCounts } from "./types";

export function formatResources(resources: ResourceCounts): string {
  const parts: string[] = [];

  if (resources.water > 0) {
    parts.push(`💧${resources.water}`);
  }

  if (resources.fire > 0) {
    parts.push(`🔥${resources.fire}`);
  }

  if (resources.grass > 0) {
    parts.push(`🌱${resources.grass}`);
  }

  return parts.length > 0 ? parts.join(" ") : "None";
}

export function formatArmies(armies: ArmyCounts): string {
  const parts: string[] = [];

  if (armies.water > 0) {
    parts.push(`⚔️💧${armies.water}`);
  }

  if (armies.fire > 0) {
    parts.push(`⚔️🔥${armies.fire}`);
  }

  if (armies.grass > 0) {
    parts.push(`⚔️🌱${armies.grass}`);
  }

  return parts.length > 0 ? parts.join(" ") : "None";
}
