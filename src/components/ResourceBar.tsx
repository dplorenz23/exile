interface ResourceBarProps {
  water: number;
  fire: number;
  grass: number;
}

export default function ResourceBar({
  water,
  fire,
  grass,
}: ResourceBarProps) {
  return (
    <div className="resource-bar">
      <div className="resource">
        <span>💧</span>
        <strong>{water}</strong>
      </div>

      <div className="resource">
        <span>🔥</span>
        <strong>{fire}</strong>
      </div>

      <div className="resource">
        <span>🌱</span>
        <strong>{grass}</strong>
      </div>
    </div>
  );
}