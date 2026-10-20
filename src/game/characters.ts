export const CLASSES = ["soldier", "engineer", "farmer", "scientist"] as const;

export type CharacterClass = (typeof CLASSES)[number];

export type PortraitVariant = "A" | "B";
