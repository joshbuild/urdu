// Scroll-safe range input (sponsor report 2026-10-05). Android Chrome moves a slider's thumb to
// the finger the moment a touch lands, so a vertical scroll that starts on the slider changed the
// review-ahead stop. A touch now holds its value back until the gesture shows what it is: a
// sideways drag applies as it goes, a tap applies on lift, and a scroll (the browser cancels the
// pointer once it takes the pan) or a mostly vertical move restores the value from before the touch.

// Movement, in CSS px, before a touch counts as a drag or a scroll.
export const GESTURE_SLOP = 8;

export type RangeGesture =
  | { kind: "idle" }
  | { kind: "pending"; x: number; y: number; value: number | null }
  | { kind: "drag" }
  | { kind: "scroll" };

export type RangeGestureEvent =
  | { type: "down"; x: number; y: number }
  | { type: "move"; x: number; y: number }
  | { type: "change"; value: number }
  | { type: "up" }
  | { type: "cancel" };

// The next gesture state, and the value to apply now (null: leave the value as it is).
export function stepRangeGesture(
  gesture: RangeGesture,
  event: RangeGestureEvent,
): { gesture: RangeGesture; apply: number | null } {
  const keep = (next: RangeGesture) => ({ gesture: next, apply: null });
  switch (event.type) {
    case "down":
      return keep({ kind: "pending", x: event.x, y: event.y, value: null });
    case "move": {
      if (gesture.kind !== "pending") return keep(gesture);
      const dx = Math.abs(event.x - gesture.x);
      const dy = Math.abs(event.y - gesture.y);
      if (Math.max(dx, dy) < GESTURE_SLOP) return keep(gesture);
      if (dx > dy) return { gesture: { kind: "drag" }, apply: gesture.value };
      return keep({ kind: "scroll" });
    }
    case "change":
      if (gesture.kind === "pending") return keep({ ...gesture, value: event.value });
      if (gesture.kind === "scroll") return keep(gesture);
      return { gesture, apply: event.value };
    case "up":
      return {
        gesture: { kind: "idle" },
        apply: gesture.kind === "pending" ? gesture.value : null,
      };
    case "cancel":
      return keep({ kind: "idle" });
  }
}
