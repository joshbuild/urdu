// f17 (FR-K): the tank meter. How many days of new words are queued at the daily batch size.
// Low under three full days, so there is time to harvest again; full at two weeks.

export const LOW_DAYS = 3;
export const FULL_DAYS = 14;

export type TankLevel = "empty" | "low" | "ok" | "full";
export type Tank = {
  queued: number;
  batchSize: number;
  // Days of supply, rounded up: a part batch still releases on its day.
  days: number;
  level: TankLevel;
  // 0–1, for the meter.
  fill: number;
};

export function tank(queued: number, batchSize: number): Tank {
  const n = Math.max(1, batchSize);
  const level: TankLevel =
    queued <= 0 ? "empty" : queued < LOW_DAYS * n ? "low" : queued >= FULL_DAYS * n ? "full" : "ok";
  return {
    queued,
    batchSize,
    days: queued <= 0 ? 0 : Math.ceil(queued / n),
    level,
    fill: Math.min(Math.max(queued, 0) / (FULL_DAYS * n), 1),
  };
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export function tankLabel(t: Tank): string {
  if (t.level === "empty") return "Empty: time to harvest";
  if (t.level === "low") return `${days(t.days)} of new words left: harvest soon`;
  return `${days(t.days)} of new words`;
}
