import type { Modifier } from "@dnd-kit/core";

/** Lists only move up and down (same as @dnd-kit/modifiers, without the extra package). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});
