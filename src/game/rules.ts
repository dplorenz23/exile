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
  UnitCounts,
  UnitType,
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
 * NEW UNIT COMBAT
 * ============================================================
 */

interface CombatUnit {
  type: UnitType;
  health: number;
}

export interface UnitCombatResult {
  attackerSurvivors: UnitCounts;
  defenderSurvivors: UnitCounts;
  attackerWon: boolean;
  baseDestroyed: boolean;
  attackerRetreated: boolean;
  roundsFought: number;
}

const UNIT_PRIORITY: UnitType[] = ["guardian", "marksman", "spy", "medic"];

function createCombatUnits(counts: UnitCounts): CombatUnit[] {
  const units: CombatUnit[] = [];

  for (const type of UNIT_PRIORITY) {
    for (let i = 0; i < counts[type]; i++) {
      units.push({
        type,
        health: BALANCE.units[type].health,
      });
    }
  }

  return units;
}

function countCombatUnits(units: CombatUnit[]): UnitCounts {
  const counts: UnitCounts = {
    guardian: 0,
    marksman: 0,
    medic: 0,
    spy: 0,
  };

  for (const unit of units) {
    if (unit.health > 0) {
      counts[unit.type] += 1;
    }
  }

  return counts;
}

/*
 * Apply damage in targeting-priority order.
 * Excess damage carries over to the next soldier.
 */
function applyCombatDamage(targets: CombatUnit[], damage: number): void {
  for (const type of UNIT_PRIORITY) {
    for (const target of targets) {
      if (damage <= 0) {
        return;
      }

      if (target.type !== type || target.health <= 0) {
        continue;
      }

      const applied = Math.min(target.health, damage);

      target.health -= applied;
      damage -= applied;
    }
  }
}

/*
 * Each surviving Medic heals the most wounded
 * living friendly soldier, including itself.
 */
function healCombatUnits(units: CombatUnit[]): void {
  const medics = units.filter(
    (unit) => unit.type === "medic" && unit.health > 0,
  );

  for (let i = 0; i < medics.length; i++) {
    let mostWounded: CombatUnit | undefined;
    let largestWound = 0;

    for (const unit of units) {
      if (unit.health <= 0) {
        continue;
      }

      const missingHealth = BALANCE.units[unit.type].health - unit.health;

      if (missingHealth > largestWound) {
        largestWound = missingHealth;
        mostWounded = unit;
      }
    }

    if (!mostWounded) {
      continue;
    }

    mostWounded.health = Math.min(
      BALANCE.units[mostWounded.type].health,
      mostWounded.health + BALANCE.units.medic.healing,
    );
  }
}

/*
 * Estimate how many rounds each army needs to defeat
 * the other, based on remaining HP and attack damage.
 *
 * Retreat if the defender can eliminate the attacker
 * at least twice as quickly as the attacker can
 * eliminate the defender.
 */
function shouldAttackersRetreat(
  attackers: CombatUnit[],
  defenders: CombatUnit[],
): boolean {
  const remainingHealth = (units: CombatUnit[]) =>
    units.reduce((total, unit) => total + Math.max(0, unit.health), 0);

  const damagePerRound = (units: CombatUnit[]) =>
    units.reduce(
      (total, unit) =>
        total + (unit.health > 0 ? BALANCE.units[unit.type].attack : 0),
      0,
    );

  const attackerHealth = remainingHealth(attackers);
  const defenderHealth = remainingHealth(defenders);

  const attackerDamage = damagePerRound(attackers);
  const defenderDamage = damagePerRound(defenders);

  if (attackerDamage === 0) {
    return true;
  }

  if (defenderDamage === 0) {
    return false;
  }

  const roundsForAttackersToWin = defenderHealth / attackerDamage;
  const roundsForDefendersToWin = attackerHealth / defenderDamage;

  return (
    roundsForAttackersToWin >=
    roundsForDefendersToWin * BALANCE.combat.retreatDisadvantageRatio
  );
}

/*
 * Resolve combat with simultaneous damage.
 *
 * Both sides attack based on their living units
 * at the beginning of each round.
 *
 * Healing occurs after damage.
 * Dead units cannot be healed.
 *
 * The defender wins ties.
 */

export function resolveUnitCombat(
  attackingUnits: UnitCounts,
  defendingUnits: UnitCounts,
): UnitCombatResult {
  const attackers = createCombatUnits(attackingUnits);
  const defenders = createCombatUnits(defendingUnits);

  let roundsFought = 0;
  let attackerRetreated = false;

  while (
    attackers.some((unit) => unit.health > 0) &&
    defenders.some((unit) => unit.health > 0)
  ) {
    roundsFought += 1;

    /*
     * Both sides calculate damage before either
     * side takes casualties.
     */
    const attackerDamage = attackers.reduce(
      (total, unit) =>
        total + (unit.health > 0 ? BALANCE.units[unit.type].attack : 0),
      0,
    );

    const defenderDamage = defenders.reduce(
      (total, unit) =>
        total + (unit.health > 0 ? BALANCE.units[unit.type].attack : 0),
      0,
    );

    /*
     * Simultaneous attacks.
     */
    applyCombatDamage(defenders, attackerDamage);
    applyCombatDamage(attackers, defenderDamage);

    /*
     * Surviving Medics heal after damage.
     */
    healCombatUnits(attackers);
    healCombatUnits(defenders);

    /*
     * Check for elimination before retreat.
     */
    const attackersAlive = attackers.some((unit) => unit.health > 0);

    const defendersAlive = defenders.some((unit) => unit.health > 0);

    if (!attackersAlive || !defendersAlive) {
      break;
    }

    /*
     * The first round is mandatory.
     * Starting at its end, retreat if the
     * defender has a major advantage.
     */
    if (shouldAttackersRetreat(attackers, defenders)) {
      attackerRetreated = true;
      break;
    }

    /*
     * Prevent extended battles and Medic stalemates.
     */
    if (roundsFought >= BALANCE.combat.maxRounds) {
      attackerRetreated = true;
      break;
    }
  }

  const attackerSurvivors = countCombatUnits(attackers);
  const defenderSurvivors = countCombatUnits(defenders);

  const attackerRemaining = Object.values(attackerSurvivors).reduce(
    (total, count) => total + count,
    0,
  );

  const defenderRemaining = Object.values(defenderSurvivors).reduce(
    (total, count) => total + count,
    0,
  );

  const attackerWon = attackerRemaining > 0 && defenderRemaining === 0;

  return {
    attackerSurvivors,
    defenderSurvivors,
    attackerWon,
    baseDestroyed: attackerWon,
    attackerRetreated,
    roundsFought,
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

    return (
      total +
      base.armies.guardian +
      base.armies.marksman +
      base.armies.medic +
      base.armies.spy
    );
  }, 0);

  const armiesInTransit = playerMissions.reduce(
    (total, mission) =>
      total +
      mission.armies.guardian +
      mission.armies.marksman +
      mission.armies.medic +
      mission.armies.spy,
    0,
  );

  const survivingArmies = stationedArmies + armiesInTransit;

  /*
   * Each surviving army unit contributes a fixed
   * amount to the player's military score.
   */
  const armyScore = survivingArmies * BALANCE.scoring.armyValue;

  return {
    playerId,

    baseScore,
    resourceScore,
    armyScore,

    totalScore: baseScore + resourceScore + armyScore,
  };
}
