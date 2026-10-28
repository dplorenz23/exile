import { Crosshair, Eye, HeartPulse, Shield } from "lucide-react";
import type { UnitType } from "../game/types";

interface UnitIconProps {
  type: UnitType;
  size?: number;
  className?: string;
}

const icons = {
  guardian: Shield,
  marksman: Crosshair,
  medic: HeartPulse,
  spy: Eye,
};

export default function UnitIcon({
  type,
  size = 16,
  className,
}: UnitIconProps) {
  const Icon = icons[type];

  return <Icon size={size} className={className} aria-label={type} />;
}
