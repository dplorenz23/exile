import { resolveUnitCombat } from "./src/game/rules";
import type { UnitCounts } from "./src/game/types";

const army = (guardian = 0, marksman = 0, medic = 0, spy = 0): UnitCounts => ({
  guardian,
  marksman,
  medic,
  spy,
});

const scenarios: {
  name: string;
  attackers: UnitCounts;
  defenders: UnitCounts;
}[] = [
  {
    name: "Overwhelming attacker advantage",
    attackers: army(10, 10, 2, 5),
    defenders: army(1, 1),
  },
  {
    name: "Overwhelming defender advantage",
    attackers: army(2, 2),
    defenders: army(10, 10, 2, 5),
  },
  {
    name: "Equal armies",
    attackers: army(5, 5, 1, 2),
    defenders: army(5, 5, 1, 2),
  },
  {
    name: "Medic-heavy battle",
    attackers: army(2, 1, 10),
    defenders: army(2, 1, 10),
  },
  {
    name: "Unprotected base",
    attackers: army(1),
    defenders: army(),
  },
  {
    name: "Both armies empty",
    attackers: army(),
    defenders: army(),
  },
];

for (const scenario of scenarios) {
  const result = resolveUnitCombat(scenario.attackers, scenario.defenders);

  console.log(`\n${scenario.name}`);
  console.log("Rounds:", result.roundsFought);
  console.log("Attacker won:", result.attackerWon);
  console.log("Retreated:", result.attackerRetreated);
  console.log("Attacker survivors:", result.attackerSurvivors);
  console.log("Defender survivors:", result.defenderSurvivors);
}
