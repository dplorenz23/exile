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
            <h3>🎯 Goal</h3>
            <p>
              Build your empire, strengthen your bases, and eliminate your
              rivals. In a timed match, the highest-scoring surviving empire
              when time expires wins. In a sudden death match, the last player
              standing wins.
            </p>
          </section>

          <section>
            <h3>💧🔥🌱 Resources — Top Center</h3>
            <p>
              Your selected base produces{" "}
              <strong>Water, Fire, and Grass</strong> automatically.
            </p>
            <p>
              Bases mature over time from{" "}
              <strong>Tent → House → Mansion → Castle</strong>, increasing their
              production.
            </p>
            <p>
              Resource tiles marked <strong>2× or 3×</strong> increase
              production of that resource.
            </p>
          </section>

          <section>
            <h3>📜 Game Log — Left</h3>
            <p>
              Follow important events across the map, including attacks,
              destroyed bases, expansions, relocations, and looting. Failed
              attacks, expansions, relocations, and loot attempts are also
              logged for everyone to see.
            </p>
          </section>

          <section>
            <h3>🏆 Standings — Top Right</h3>
            <p>See each player's current score and position.</p>
          </section>

          <section>
            <h3>⏱ Timer — Top Right</h3>
            <p>Shows the time remaining in a timed match.</p>
          </section>

          <section>
            <h3>➤ Armies Moving — Right</h3>
            <p>
              Track your armies and missions as they travel across the map.
              Travel time depends on distance.{" "}
              <strong>Only you can see your armies and their movements.</strong>
            </p>
          </section>

          <section>
            <h3>🏰 Your Bases — Bottom Left</h3>
            <p>
              Switch between your bases here.{" "}
              <strong>
                Resources, armies, and actions belong to the currently selected
                base.
              </strong>
            </p>
          </section>

          <section>
            <h3>⚔ Base Actions — Bottom Right</h3>

            <p>
              <strong>⚔ Train</strong> — Spend resources to train Water, Fire,
              or Grass armies.
            </p>

            <p>
              <strong>➤ Send Army</strong> — Attack an enemy, transfer resources
              to another base, or loot treasure.
            </p>

            <p>
              <strong>🔑 Expand</strong> — Spend resources and an Expansion Key
              to establish a new base. You can control up to{" "}
              <strong>3 bases</strong>.
            </p>

            <p>
              <strong>📦 Relocate</strong> — Move your selected base to a new
              location.
            </p>
          </section>

          <section>
            <h3>⚔ Combat</h3>
            <p>Each army has an elemental type:</p>

            <div className="how-to-combat">
              <strong>💧 Water beats 🔥 Fire</strong>
              <strong>🔥 Fire beats 🌱 Grass</strong>
              <strong>🌱 Grass beats 💧 Water</strong>
            </div>
          </section>

          <section>
            <h3>Need a Reminder?</h3>
            <p>
              Click the <strong>?</strong> during the game to open How to Play
              at any time.
            </p>
          </section>

          <section>
            <h3>Ready?</h3>
            <p>
              Pick a base, build up some resources, train an army, and start
              expanding your empire on... <strong>EXiLE!</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
