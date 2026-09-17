import { BALANCE } from "./balance";

import type {
  ArmyCounts,
  CombatResult,
  ResourceType,
  ResourceCounts,
  ArmyMission,
  Base,
  BaseResources,
  PlayerScore,
} from "./types";

/*
 * Shared EXiLE game rules.
 *
 * Functions in this file contain deterministic game logic that can be used
 * by both the client and authoritative server. Rules that must produce the
 * same result everywhere should live here rather than being duplicated in
 * UI or networking code.
 */

export function getLocationMultiplier(ageSeconds: number): number {
  if (ageSeconds >= BALANCE.production.level4Seconds) {
    return BALANCE.production.primaryByLevel[3];
  }

  if (ageSeconds >= BALANCE.production.level3Seconds) {
    return BALANCE.production.primaryByLevel[2];
  }

  if (ageSeconds >= BALANCE.production.level2Seconds) {
    return BALANCE.production.primaryByLevel[1];
  }

  return BALANCE.production.primaryByLevel[0];
}

export function getArmyCost(armiesBuilt: number): number {
  return BALANCE.armies.baseCost + armiesBuilt * BALANCE.armies.costIncrease;
}

export function getSecondaryProduction(ageSeconds: number): number {
  if (ageSeconds >= BALANCE.production.level4Seconds) {
    return BALANCE.production.secondaryByLevel[3];
  }

  if (ageSeconds >= BALANCE.production.level3Seconds) {
    return BALANCE.production.secondaryByLevel[2];
  }

  if (ageSeconds >= BALANCE.production.level2Seconds) {
    return BALANCE.production.secondaryByLevel[1];
  }

  return BALANCE.production.secondaryByLevel[0];
}

export function getExpansionCost(expansionsCompleted: number): number {
  return (
    BALANCE.expansion.baseCost +
    expansionsCompleted * BALANCE.expansion.costIncrease
  );
}

export function getSpendableResourceTotal(resources: ResourceCounts): number {
  return (
    Math.floor(resources.water / 50) * 50 +
    Math.floor(resources.fire / 50) * 50 +
    Math.floor(resources.grass / 50) * 50
  );
}

/*
 * ============================================================
 * COMBAT
 * ============================================================
 *
 * Combat order:
 *
 * 1. Matching elements cancel 1-for-1.
 *
 * 2. Attacker favorable matchups:
 *      Water > Fire
 *      Fire > Grass
 *      Grass > Water
 *
 *    One strong army can eliminate up to two weak armies.
 *    The strong army survives.
 *
 * 3. Defender favorable matchups use the same rules.
 *
 * 4. Militia fights neutral 1-for-1 against one remaining
 *    attacking army.
 *
 * 5. If both sides are completely destroyed, defender wins
 *    the tie and retains the base.
 */

function copyArmies(armies: ArmyCounts): ArmyCounts {
  return {
    water: armies.water,
    fire: armies.fire,
    grass: armies.grass,
  };
}

/*
 * Cancel identical elements 1-for-1.
 */
function cancelMatchingArmies(
  attackers: ArmyCounts,
  defenders: ArmyCounts,
): void {
  const resources: ResourceType[] = ["water", "fire", "grass"];

  resources.forEach((resource) => {
    const cancelled = Math.min(attackers[resource], defenders[resource]);

    attackers[resource] -= cancelled;
    defenders[resource] -= cancelled;
  });
}

/*
 * Resolve one favorable elemental matchup.
 *
 * Example:
 *
 * 2 Water attackers vs 5 Fire defenders
 *
 * Each Water army can defeat up to 2 Fire armies.
 *
 * 2 Water can therefore eliminate 4 Fire.
 *
 * Result:
 * Water = 2
 * Fire = 1
 */
function resolveStrongMatchup(
  strongArmies: ArmyCounts,
  strongType: ResourceType,
  weakArmies: ArmyCounts,
  weakType: ResourceType,
): void {
  const strongCount = strongArmies[strongType];
  const weakCount = weakArmies[weakType];

  if (strongCount <= 0 || weakCount <= 0) {
    return;
  }

  const maximumKills = strongCount * 2;

  const kills = Math.min(maximumKills, weakCount);

  weakArmies[weakType] -= kills;
}

/*
 * Militia kills one remaining attacker 1-for-1.
 *
 * If multiple elements remain, remove an army from the
 * largest surviving group.
 *
 * Tie priority:
 * Water -> Fire -> Grass
 *
 * This keeps militia deterministic.
 */
function resolveMilitia(attackers: ArmyCounts): boolean {
  const totalAttackers = attackers.water + attackers.fire + attackers.grass;

  /*
   * No attackers remain, so militia survives.
   */
  if (totalAttackers === 0) {
    return true;
  }

  const casualtyPriority: ResourceType[] = ["water", "fire", "grass"];

  let casualty: ResourceType = "water";
  let largestCount = -1;

  casualtyPriority.forEach((resource) => {
    if (attackers[resource] > largestCount) {
      largestCount = attackers[resource];
      casualty = resource;
    }
  });

  /*
   * Militia and one attacker eliminate each other.
   */
  attackers[casualty] -= 1;

  return false;
}

function totalArmies(armies: ArmyCounts): number {
  return armies.water + armies.fire + armies.grass;
}

export function resolveCombat(
  attackingArmies: ArmyCounts,
  defendingArmies: ArmyCounts,
): CombatResult {
  /*
   * Never mutate the original objects passed into
   * the function.
   */
  const attackers = copyArmies(attackingArmies);

  const defenders = copyArmies(defendingArmies);

  /*
   * ========================================================
   * ROUND 1
   * Matching elements cancel.
   * ========================================================
   */

  cancelMatchingArmies(attackers, defenders);

  /*
   * ========================================================
   * ROUND 2
   * Attacker favorable matchups.
   * ========================================================
   */

  // Water attacks Fire
  resolveStrongMatchup(attackers, "water", defenders, "fire");

  // Fire attacks Grass
  resolveStrongMatchup(attackers, "fire", defenders, "grass");

  // Grass attacks Water
  resolveStrongMatchup(attackers, "grass", defenders, "water");

  /*
   * ========================================================
   * ROUND 3
   * Defender favorable matchups.
   * ========================================================
   */

  // Defender Water attacks Attacker Fire
  resolveStrongMatchup(defenders, "water", attackers, "fire");

  // Defender Fire attacks Attacker Grass
  resolveStrongMatchup(defenders, "fire", attackers, "grass");

  // Defender Grass attacks Attacker Water
  resolveStrongMatchup(defenders, "grass", attackers, "water");

  /*
   * ========================================================
   * MILITIA
   * ========================================================
   */

  const militiaSurvived = resolveMilitia(attackers);

  const attackersRemaining = totalArmies(attackers);

  const defendersRemaining = totalArmies(defenders);

  /*
   * Attacker only wins if:
   *
   * - at least one attacking army survives
   * - no defending armies survive
   * - militia does not survive
   *
   * This naturally gives the defender the tie.
   */
  const attackerWon =
    attackersRemaining > 0 && defendersRemaining === 0 && !militiaSurvived;

  return {
    attackerSurvivors: attackers,
    defenderSurvivors: defenders,

    militiaSurvived,

    attackerWon,

    baseDestroyed: attackerWon,
  };
}

/*
 * ============================================================
 * RAID LOOT
 * ============================================================
 *
 * Loot is automatically divided as evenly as possible
 * among available Water, Fire, and Grass.
 *
 * If a resource pile runs out, its unused share is
 * redistributed among the remaining resource types.
 *
 * Any final remainder goes to the resource pile with the
 * most resources still remaining.
 *
 * Tie priority:
 * Water -> Fire -> Grass
 */
export function calculateLoot(
  availableResources: ResourceCounts,
  capacity: number,
): {
  loot: ResourceCounts;
  remaining: ResourceCounts;
} {
  const loot: ResourceCounts = {
    water: 0,
    fire: 0,
    grass: 0,
  };

  const remaining: ResourceCounts = {
    ...availableResources,
  };

  const resourceTypes: ResourceType[] = ["water", "fire", "grass"];

  let remainingCapacity = Math.min(
    capacity,
    remaining.water + remaining.fire + remaining.grass,
  );

  /*
   * Repeatedly divide available capacity evenly among
   * resource types that still have resources.
   */
  while (remainingCapacity > 0) {
    const availableTypes = resourceTypes.filter(
      (resource) => remaining[resource] > 0,
    );

    if (availableTypes.length === 0) {
      break;
    }

    const evenShare = Math.floor(remainingCapacity / availableTypes.length);

    /*
     * If we can no longer divide evenly because fewer
     * units remain than resource types, finish below.
     */
    if (evenShare === 0) {
      break;
    }

    availableTypes.forEach((resource) => {
      const amountTaken = Math.min(evenShare, remaining[resource]);

      loot[resource] += amountTaken;
      remaining[resource] -= amountTaken;
      remainingCapacity -= amountTaken;
    });
  }

  /*
   * Any leftover capacity comes from whichever resource
   * pile currently has the most remaining.
   */
  while (remainingCapacity > 0) {
    let largestResource: ResourceType | null = null;
    let largestAmount = 0;

    resourceTypes.forEach((resource) => {
      if (remaining[resource] > largestAmount) {
        largestAmount = remaining[resource];
        largestResource = resource;
      }
    });

    if (!largestResource || largestAmount === 0) {
      break;
    }

    const amountTaken = Math.min(remainingCapacity, remaining[largestResource]);

    switch (largestResource) {
      case "water":
        loot.water += amountTaken;
        remaining.water -= amountTaken;
        break;

      case "fire":
        loot.fire += amountTaken;
        remaining.fire -= amountTaken;
        break;

      case "grass":
        loot.grass += amountTaken;
        remaining.grass -= amountTaken;
        break;
    }

    remainingCapacity -= amountTaken;
  }
  return {
    loot,
    remaining,
  };
}

export function calculatePlayerScore(
  playerId: number,
  bases: Base[],
  resourcesByBase: Record<number, BaseResources>,
  armyMissions: ArmyMission[],
  armiesTrained: number,
  armyResourcesSpent: number,
): PlayerScore {
  /*
   * ==================================================
   * BASE VALUE
   * ==================================================
   *
   * Relocating bases still belong to the player,
   * so they still count.
   */
  const playerBases = bases.filter((base) => base.playerId === playerId);

  const baseScore = playerBases.length * BALANCE.scoring.baseValue;

  /*
   * ==================================================
   * RESOURCES STORED AT ACTIVE BASES
   * ==================================================
   *
   * Relocating bases have their resources carried
   * by their mission, so don't count them here.
   */
  const resourcesAtBases = playerBases.reduce((total, base) => {
    if (base.isRelocating) {
      return total;
    }

    const resources = resourcesByBase[base.id];

    if (!resources) {
      return total;
    }

    return total + resources.water + resources.fire + resources.grass;
  }, 0);

  /*
   * ==================================================
   * RESOURCES IN TRANSIT
   * ==================================================
   */
  const playerMissions = armyMissions.filter(
    (mission) => mission.playerId === playerId,
  );

  const resourcesInTransit = playerMissions.reduce((total, mission) => {
    let missionResources =
      mission.resources.water +
      mission.resources.fire +
      mission.resources.grass;

    /*
     * Relocation payment is refundable if
     * relocation fails, so while the mission
     * is unresolved it still counts as owned value.
     */
    if (mission.relocationPayment) {
      missionResources +=
        mission.relocationPayment.water +
        mission.relocationPayment.fire +
        mission.relocationPayment.grass;
    }

    return total + missionResources;
  }, 0);

  const resourceScore = resourcesAtBases + resourcesInTransit;

  /*
   * ==================================================
   * SURVIVING ARMIES
   * ==================================================
   *
   * Relocating-base armies are represented by the
   * relocation mission, so don't count them twice.
   */
  const stationedArmies = playerBases.reduce((total, base) => {
    if (base.isRelocating) {
      return total;
    }

    return total + base.armies.water + base.armies.fire + base.armies.grass;
  }, 0);

  const armiesInTransit = playerMissions.reduce(
    (total, mission) =>
      total + mission.armies.water + mission.armies.fire + mission.armies.grass,
    0,
  );

  const survivingArmies = stationedArmies + armiesInTransit;

  /*
   * Historical average price paid per army.
   */
  const averageArmyCost =
    armiesTrained > 0 ? armyResourcesSpent / armiesTrained : 0;

  const armyScore = survivingArmies * averageArmyCost;

  return {
    playerId,

    baseScore,
    resourceScore,
    armyScore,

    totalScore: baseScore + resourceScore + armyScore,
  };
}
