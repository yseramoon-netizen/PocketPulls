import styles from "./NebuSprite.module.css";

export type NebuPose =
  | "idle"
  | "walk"
  | "run"
  | "wiggle"
  | "swipe"
  | "pounce"
  | "groom"
  | "puffed"
  | "back"
  | "smug"
  | "yarn"
  | "balloon"
  | "sacred"
  | "leap"
  | "crown"
  | "catnip";

type NebuSpriteProps = {
  pose: NebuPose;
  className?: string;
  label?: string;
};

export default function NebuSprite({
  pose,
  className = "",
  label,
}: NebuSpriteProps) {
  return (
    <span
      className={`${styles.sprite} ${className}`.trim()}
      data-pose={pose}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
