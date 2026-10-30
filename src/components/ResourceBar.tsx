interface ResourceBarProps {
  water: number;
  fire: number;
  grass: number;
}

export default function ResourceBar({ water, fire, grass }: ResourceBarProps) {
  return (
    <div className="resource-bar">
      <div className="resource">
        <img
          className="resource-icon"
          src={`${import.meta.env.BASE_URL}assets/resources/water.png`}
          alt="Water"
        />
        <span className="resource-label">WATER</span>
        <strong>{Math.floor(water)}</strong>
      </div>

      <div className="resource">
        <img
          className="resource-icon"
          src={`${import.meta.env.BASE_URL}assets/resources/fuel.png`}
          alt="Fuel"
        />
        <span className="resource-label">FUEL</span>
        <strong>{Math.floor(fire)}</strong>
      </div>

      <div className="resource">
        <img
          className="resource-icon"
          src={`${import.meta.env.BASE_URL}assets/resources/food.png`}
          alt="Food"
        />
        <span className="resource-label">FOOD</span>
        <strong>{Math.floor(grass)}</strong>
      </div>
    </div>
  );
}
