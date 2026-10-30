export const CLASSES = ["soldier", "engineer", "farmer", "scientist"] as const;

export type CharacterClass = (typeof CLASSES)[number];

export const CLASS_COLORS: Record<CharacterClass, string> = {
  soldier: "#a65d57", // Muted brick red
  engineer: "#64869b", // Weathered steel blue
  farmer: "#788d65", // Dusty sage green
  scientist: "#8a779e", // Smoky violet
};
