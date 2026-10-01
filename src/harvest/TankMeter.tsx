// f17 (FR-K): the tank meter, on the Harvest tab and (compact) on the Review start screen.
// Hand-written SVG coloured from CSS variables, like the Dash.

import type { IntakeCounts } from "../../shared/api";
import { tank, tankLabel } from "./tank";

export function TankMeter({
  intake,
  compact = false,
}: {
  intake: IntakeCounts;
  compact?: boolean;
}) {
  const t = tank(intake.queued, intake.batch_size);
  const width = Math.round(t.fill * 200);
  return (
    <div className={`tank tank--${t.level}${compact ? " tank--compact" : ""}`}>
      <svg
        className="tank-meter"
        viewBox="0 0 200 16"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Queue: ${tankLabel(t)}`}
      >
        <rect className="tank-track" x="0" y="0" width="200" height="16" rx="8" />
        {width > 0 && (
          <rect className="tank-fill" x="0" y="0" width={Math.max(width, 16)} height="16" rx="8" />
        )}
      </svg>
      <p className="tank-label">
        <strong>{tankLabel(t)}</strong>
        {!compact && (
          <span className="hint">
            {" "}
            · {intake.queued} queued · {intake.batch_size} a day
          </span>
        )}
      </p>
    </div>
  );
}
