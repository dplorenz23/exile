import type {
  ArmyCounts,
  CombatResult,
  ResourceType,
} from "./types";

export function getArmyCost(armiesBuilt: number) {
  return 100 + armiesBuilt * 50;
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
) {
  const resources: ResourceType[] = [
    "water",
    "fire",
    "grass",
  ];

  resources.forEach((resource) => {
    const cancelled = Math.min(
      attackers[resource],
      defenders[resource],
    );

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
) {
  const strongCount = strongArmies[strongType];
  const weakCount = weakArmies[weakType];

  if (strongCount <= 0 || weakCount <= 0) {
    return;
  }

  const maximumKills = strongCount * 2;

  const kills = Math.min(
    maximumKills,
    weakCount,
  );

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
function resolveMilitia(
  attackers: ArmyCounts,
): boolean {
  const totalAttackers =
    attackers.water +
    attackers.fire +
    attackers.grass;

  /*
   * No attackers remain, so militia survives.
   */
  if (totalAttackers === 0) {
    return true;
  }

  const casualtyPriority: ResourceType[] = [
    "water",
    "fire",
    "grass",
  ];

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

function totalArmies(armies: ArmyCounts) {
  return (
    armies.water +
    armies.fire +
    armies.grass
  );
}

export function resolveCombat(
  attackingArmies: ArmyCounts,
  defendingArmies: ArmyCounts,
): CombatResult {
  /*
   * Never mutate the original objects passed into
   * the function.
   */
  const attackers =
    copyArmies(attackingArmies);

  const defenders =
    copyArmies(defendingArmies);

  /*
   * ========================================================
   * ROUND 1
   * Matching elements cancel.
   * ========================================================
   */

  cancelMatchingArmies(
    attackers,
    defenders,
  );

  /*
   * ========================================================
   * ROUND 2
   * Attacker favorable matchups.
   * ========================================================
   */

  // Water attacks Fire
  resolveStrongMatchup(
    attackers,
    "water",
    defenders,
    "fire",
  );

  // Fire attacks Grass
  resolveStrongMatchup(
    attackers,
    "fire",
    defenders,
    "grass",
  );

  // Grass attacks Water
  resolveStrongMatchup(
    attackers,
    "grass",
    defenders,
    "water",
  );

  /*
   * ========================================================
   * ROUND 3
   * Defender favorable matchups.
   * ========================================================
   */

  // Defender Water attacks Attacker Fire
  resolveStrongMatchup(
    defenders,
    "water",
    attackers,
    "fire",
  );

  // Defender Fire attacks Attacker Grass
  resolveStrongMatchup(
    defenders,
    "fire",
    attackers,
    "grass",
  );

  // Defender Grass attacks Attacker Water
  resolveStrongMatchup(
    defenders,
    "grass",
    attackers,
    "water",
  );

  /*
   * ========================================================
   * MILITIA
   * ========================================================
   */

  const militiaSurvived =
    resolveMilitia(attackers);

  const attackersRemaining =
    totalArmies(attackers);

  const defendersRemaining =
    totalArmies(defenders);

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
    attackersRemaining > 0 &&
    defendersRemaining === 0 &&
    !militiaSurvived;

  return {
    attackerSurvivors: attackers,
    defenderSurvivors: defenders,

    militiaSurvived,

    attackerWon,

    baseDestroyed: attackerWon,
  };
}