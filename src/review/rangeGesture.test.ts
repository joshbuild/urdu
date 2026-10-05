import { describe, expect, it } from "vitest";
import {
  GESTURE_SLOP,
  type RangeGesture,
  type RangeGestureEvent,
  stepRangeGesture,
} from "./rangeGesture";

// Runs the events from idle and collects every value applied along the way.
function run(events: RangeGestureEvent[]): { applied: number[]; gesture: RangeGesture } {
  let gesture: RangeGesture = { kind: "idle" };
  const applied: number[] = [];
  for (const event of events) {
    const step = stepRangeGesture(gesture, event);
    gesture = step.gesture;
    if (step.apply !== null) applied.push(step.apply);
  }
  return { applied, gesture };
}

describe("stepRangeGesture", () => {
  it("applies nothing when a touch turns into a scroll the browser takes over", () => {
    const { applied, gesture } = run([
      { type: "down", x: 200, y: 300 },
      { type: "change", value: 4 },
      { type: "move", x: 201, y: 304 },
      { type: "cancel" },
    ]);
    expect(applied).toEqual([]);
    expect(gesture).toEqual({ kind: "idle" });
  });

  it("applies nothing for a mostly vertical move, even if the pointer is not cancelled", () => {
    const { applied } = run([
      { type: "down", x: 200, y: 300 },
      { type: "change", value: 4 },
      { type: "move", x: 203, y: 300 - GESTURE_SLOP - 2 },
      { type: "change", value: 5 },
      { type: "up" },
    ]);
    expect(applied).toEqual([]);
  });

  it("applies a tap's value on lift", () => {
    const { applied } = run([
      { type: "down", x: 200, y: 300 },
      { type: "change", value: 3 },
      { type: "move", x: 202, y: 301 },
      { type: "up" },
    ]);
    expect(applied).toEqual([3]);
  });

  it("applies a sideways drag as it goes, starting with the held value", () => {
    const { applied } = run([
      { type: "down", x: 200, y: 300 },
      { type: "change", value: 2 },
      { type: "move", x: 200 + GESTURE_SLOP + 1, y: 302 },
      { type: "change", value: 3 },
      { type: "change", value: 4 },
      { type: "up" },
    ]);
    expect(applied).toEqual([2, 3, 4]);
  });

  it("applies changes with no touch in progress (keyboard, mouse)", () => {
    expect(run([{ type: "change", value: 6 }]).applied).toEqual([6]);
  });

  it("applies nothing for a tap that changed nothing", () => {
    expect(run([{ type: "down", x: 1, y: 1 }, { type: "up" }]).applied).toEqual([]);
  });
});
