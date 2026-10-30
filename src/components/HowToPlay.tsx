interface HowToPlayProps {
  onClose: () => void;
}

export default function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <div className="how-to-overlay" onClick={onClose}>
      <div
        className="how-to-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="how-to-header">
          <h2>How to Play</h2>

          <button
            className="how-to-close"
            onClick={onClose}
            aria-label="Close How to Play"
          >
            ×
          </button>
        </div>

        <div className="how-to-content">
          <section>
            <h3>🎯 Objective</h3>
            <p>
              Build your empire, strengthen your bases, gather resources, and
              eliminate your rivals.
            </p>
            <p>
              <strong>Timed Match:</strong> The highest-scoring surviving player
              when time expires wins.
            </p>
            <p>
              <strong>Sudden Death:</strong> The last surviving player wins.
              Losing all your bases eliminates you.
            </p>
          </section>

          <section>
            <h3>🏳 Choose Your Faction</h3>
            <p>Each faction has a unique advantage:</p>
            <p>
              <strong>Soldier:</strong> +15% unit attack and maximum HP.
            </p>
            <p>
              <strong>Engineer:</strong> Starts with a Level 2 Outpost, doubling
              starting base production.
            </p>
            <p>
              <strong>Farmer:</strong> +15% resource production.
            </p>
            <p>
              <strong>Scientist:</strong> 15% lower unit training and research
              costs.
            </p>
            <p>Soldier, Farmer, and Scientist bonuses stack with research.</p>
          </section>

          <section>
            <h3>💧🔥🌱 Resources — Top Center</h3>
            <p>
              Bases automatically produce <strong>Water, Fuel, and Food</strong>
              . Each base has its own resource inventory.
            </p>
            <p>
              The terrain determines which resource a base produces most
              efficiently. Resource tiles with 2× or 3× multipliers increase
              primary resource production.
            </p>
            <p>
              Resources are used to recruit units, purchase research, upgrade
              bases, expand, and relocate.
            </p>
          </section>

          <section>
            <h3>🏰 Your Bases — Bottom Left</h3>
            <p>
              Switch between your bases here. Resources, armies, and actions
              belong to the currently selected base.
            </p>
            <p>
              Bases progress through four levels:
              <strong> Encampment → Outpost → Stronghold → Citadel</strong>.
            </p>
            <p>
              Higher-level bases produce more resources. Upgrades must be
              purchased through Base Management; they no longer happen
              automatically.
            </p>
            <p>
              While a base is upgrading, you cannot issue new actions from that
              base. Existing production and missions continue.
            </p>
          </section>

          <section>
            <h3>🔬 Research</h3>
            <p>
              Research benefits all your bases and armies. Each category has
              four levels.
            </p>
            <p>
              <strong>Military:</strong> +15% unit attack and maximum HP per
              level above Level 1.
            </p>
            <p>
              <strong>Production:</strong> +15% resource production per level
              above Level 1.
            </p>
            <p>
              <strong>Efficiency:</strong> 15% lower training and research costs
              per level above Level 1.
            </p>
            <p>
              Research completes instantly, but you must have a sufficiently
              upgraded base to unlock higher levels. Research costs are paid
              entirely from the selected base.
            </p>
          </section>

          <section>
            <h3>⚔ Recruit Units — Bottom Right</h3>
            <p>
              Recruit units by spending resources at your selected base. Each
              unit takes 10 seconds to train.
            </p>
            <p>
              <strong>Guardian:</strong> Durable frontline unit.
            </p>
            <p>
              <strong>Marksman:</strong> Ranged damage dealer.
            </p>
            <p>
              <strong>Medic:</strong> Heals surviving allies between combat
              rounds.
            </p>
            <p>
              <strong>Spy:</strong> Specialized unit with its own combat
              statistics.
            </p>
          </section>

          <section>
            <h3>➤ Deploy Army — Bottom Right</h3>
            <p>
              Select units from your base and send them on missions. Travel time
              depends on distance.
            </p>
            <p>
              <strong>Attack:</strong> Fight enemy units and attempt to destroy
              their base.
            </p>
            <p>
              <strong>Transfer:</strong> Move units and resources between your
              bases.
            </p>
            <p>
              <strong>Loot:</strong> Send units to collect treasure.
            </p>
          </section>

          <section>
            <h3>⚔ Combat</h3>
            <p>
              Both armies attack during each combat round. Medics heal surviving
              allies at the end of the round, but cannot revive dead units.
            </p>
            <p>
              Attacking armies may retreat when significantly outmatched.
              Surviving units return with full health.
            </p>
            <p>
              Military research and Soldier faction bonuses improve combat
              performance.
            </p>
          </section>

          <section>
            <h3>🏗 Base Management — Bottom Right</h3>
            <p>
              <strong>Upgrade:</strong> Spend resources to increase your base
              level and production.
            </p>
            <p>
              <strong>Expand:</strong> Spend resources and an Expansion Key to
              establish another base. You can control up to three bases.
            </p>
            <p>
              <strong>Relocate:</strong> Move an existing base to a different
              location.
            </p>
            <p>
              Each player starts with one Expansion Key. Additional keys are
              earned by destroying enemy bases and successfully bringing them
              home.
            </p>
          </section>

          <section>
            <h3>📜 COMMS — Left</h3>
            <p>
              Follow important events across the map, including attacks,
              destroyed bases, expansions, relocations, and looting. Expand an
              event to see additional details.
            </p>
          </section>

          <section>
            <h3>🏆 Standings & Timer — Top Right</h3>
            <p>
              Standings show each player's current score. Scores are based on
              surviving bases, resources, and armies.
            </p>
            <p>The timer shows the remaining time in a timed match.</p>
          </section>

          <section>
            <h3>➤ Army Movements — Right</h3>
            <p>
              Track your active missions as armies travel across the map. Only
              you can see your armies and their movements.
            </p>
          </section>

          <section>
            <h3>Ready?</h3>
            <p>
              Choose your faction, gather resources, upgrade your bases,
              research improvements, and build your army. Conquer the island and
              survive the chaos of <strong>EXiLE!</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
