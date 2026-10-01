// The Dash's six elements (f16, PRD FR-J1–J6), top to bottom. Renders a DashResponse and nothing
// else: every number is derived in shared/dash.ts. Charts are hand-written SVG coloured from the
// --chart-* tokens in app.css; labels that must stay readable are HTML, not SVG text.

import type { DashResponse } from "../../shared/api";
import { MIN_RECALL_SAMPLE, type RecallRate } from "../../shared/dash";
import { bandName, MASTERY_BANDS } from "../../shared/mastery";
import { calendarColumns, percent, recallHint, shortDate, stackedAreas } from "./view";

type Props = { dash: DashResponse; onOpenVocab: (id: string) => void };

export function DashView({ dash, onOpenVocab }: Props) {
  return (
    <>
      <KnownCard dash={dash} />
      <ForecastCard dash={dash} />
      <RecallCard dash={dash} />
      <TroubleCard dash={dash} onOpenVocab={onOpenVocab} />
      <BacklogCard dash={dash} />
      <CalendarCard dash={dash} />
    </>
  );
}

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en")} ${n === 1 ? one : many}`;

// J1
export function KnownCard({ dash }: { dash: DashResponse }) {
  const { count, history } = dash.known;
  const w = 320;
  const h = 120;
  const areas = stackedAreas(history, w, h);
  const first = history[0];
  return (
    <section className="panel dash-card" aria-labelledby="dash-known">
      <p className="eyebrow" id="dash-known">
        KNOWN
      </p>
      <p className="dash-headline">
        <strong>{count.toLocaleString("en")}</strong> {count === 1 ? "item" : "items"} on an
        interval of 14 days or more
      </p>
      {areas.length > 0 && first ? (
        <>
          <svg
            className="dash-chart"
            viewBox={`0 0 ${w} ${h}`}
            role="img"
            aria-label={`Items per mastery band from ${shortDate(first.day)} to today`}
          >
            {areas.map((a) => (
              <path key={a.band} className={`dash-band dash-band--${a.band}`} d={a.d} />
            ))}
          </svg>
          <p className="dash-axis">
            <span>{shortDate(first.day)}</span>
            <span>Today</span>
          </p>
          <ul className="dash-legend">
            {MASTERY_BANDS.map((b) => (
              <li key={b.band}>
                <span className={`dash-swatch dash-band--${b.band}`} />
                {b.name}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="hint">History builds as you review.</p>
      )}
    </section>
  );
}

// J2
export function ForecastCard({ dash }: { dash: DashResponse }) {
  const { overdue, days } = dash.forecast;
  const fresh = dash.forecast.new;
  const w = 320;
  const h = 96;
  const top = 14;
  const slot = w / days.length;
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <section className="panel dash-card" aria-labelledby="dash-forecast">
      <p className="eyebrow" id="dash-forecast">
        DUE FORECAST
      </p>
      <dl className="dash-counts">
        <div>
          <dt>Overdue</dt>
          <dd>{overdue.toLocaleString("en")}</dd>
        </div>
        <div>
          <dt>New, never reviewed</dt>
          <dd>{fresh.toLocaleString("en")}</dd>
        </div>
      </dl>
      <svg
        className="dash-chart"
        viewBox={`0 0 ${w} ${h + top + 16}`}
        role="img"
        aria-label={`Items due over the next 14 days: ${days.map((d) => d.count).join(", ")}`}
      >
        <line className="dash-baseline" x1={0} x2={w} y1={top + h} y2={top + h} />
        {days.map((d, i) => {
          const bh = (d.count / max) * h;
          const x = i * slot + slot * 0.15;
          return (
            <g key={d.day}>
              {d.count > 0 && (
                <rect
                  className={i === 0 ? "dash-bar dash-bar--today" : "dash-bar"}
                  x={x}
                  y={top + h - bh}
                  width={slot * 0.7}
                  height={bh}
                  rx={2}
                />
              )}
              {d.count > 0 && (
                <text className="dash-value" x={x + slot * 0.35} y={top + h - bh - 3}>
                  {d.count}
                </text>
              )}
              <text className="dash-tick" x={x + slot * 0.35} y={top + h + 13}>
                {Number(d.day.slice(8))}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="hint">Due each day for the next two weeks, today first.</p>
    </section>
  );
}

// J3
export function RecallCard({ dash }: { dash: DashResponse }) {
  const { recognition, production, band } = dash.recall;
  const hint = recallHint(band, dash.active_ladder_id);
  return (
    <section className="panel dash-card" aria-labelledby="dash-recall">
      <p className="eyebrow" id="dash-recall">
        RECALL, LAST 30 DAYS
      </p>
      <RecallRow label="Recognition (Urdu → English)" rate={recognition} />
      <RecallRow label="Production (English → Urdu, oral)" rate={production} />
      {hint && <p className="dash-hint">{hint}</p>}
      <p className="hint">Target 80–90%. Unprompted, scheduled reviews only.</p>
    </section>
  );
}

function RecallRow({ label, rate }: { label: string; rate: RecallRate }) {
  const pct = percent(rate);
  const enough = rate.n >= MIN_RECALL_SAMPLE && pct !== null;
  const w = 320;
  return (
    <div className="dash-recall">
      <p className="dash-recall-label">
        <span>{label}</span>
        <span>
          {enough ? <strong>{pct}%</strong> : "not enough reviews yet"} (n={rate.n})
        </span>
      </p>
      <svg className="dash-meter" viewBox={`0 0 ${w} 12`} aria-hidden="true">
        <rect className="dash-meter-track" x={0} y={2} width={w} height={8} rx={4} />
        <rect className="dash-meter-target" x={w * 0.8} y={0} width={w * 0.1} height={12} />
        {enough && (
          <rect
            className="dash-meter-mark"
            x={Math.min(w - 4, Math.max(0, (w * pct) / 100 - 2))}
            y={0}
            width={4}
            height={12}
            rx={1}
          />
        )}
      </svg>
    </div>
  );
}

// J4
export function TroubleCard({ dash, onOpenVocab }: Props) {
  return (
    <section className="panel dash-card" aria-labelledby="dash-trouble">
      <p className="eyebrow" id="dash-trouble">
        TROUBLE ITEMS
      </p>
      {dash.trouble.length === 0 ? (
        <p className="hint">No trouble items in the last 30 days.</p>
      ) : (
        <>
          <ul className="vocab-list">
            {dash.trouble.map((t) => (
              <li key={t.id}>
                <button type="button" className="vocab-row" onClick={() => onOpenVocab(t.id)}>
                  <span className="vocab-row-head">
                    <span className="vocab-row-roman">{t.english || "—"}</span>
                    <span className="urdu-inline" dir="rtl" lang="ur">
                      {t.urdu}
                    </span>
                  </span>
                  <span className="vocab-row-meta">
                    <span className={`mastery-pill mastery-pill--${t.band}`}>
                      {bandName(t.band)}
                    </span>{" "}
                    {plural(t.lapses, "miss", "misses")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="hint">
            Missed twice or more in 30 days. Tap one to fix its entry or add an example.
          </p>
        </>
      )}
    </section>
  );
}

// J5
export function BacklogCard({ dash }: { dash: DashResponse }) {
  const { now, weeks } = dash.backlog;
  const w = 320;
  const h = 80;
  const top = 14;
  const slot = w / weeks.length;
  // Pairs nearly fill their week so two-digit value labels clear each other.
  const bar = slot * 0.38;
  const max = Math.max(1, ...weeks.flatMap((wk) => [wk.added, wk.known]));
  const first = weeks[0];
  return (
    <section className="panel dash-card" aria-labelledby="dash-backlog">
      <p className="eyebrow" id="dash-backlog">
        LEARNING BACKLOG
      </p>
      <p className="dash-headline">
        <strong>{now.toLocaleString("en")}</strong> {now === 1 ? "item" : "items"} in New, Learning
        or Basic
      </p>
      <svg
        className="dash-chart"
        viewBox={`0 0 ${w} ${h + top + 2}`}
        role="img"
        aria-label={`Per week, items added: ${weeks.map((wk) => wk.added).join(", ")}; items reaching Known: ${weeks.map((wk) => wk.known).join(", ")}`}
      >
        <line className="dash-baseline" x1={0} x2={w} y1={top + h} y2={top + h} />
        {weeks.map((wk, i) => {
          const x = i * slot + slot * 0.08;
          const pairs = [
            { key: "added", value: wk.added, x, cls: "dash-bar dash-bar--added" },
            {
              key: "known",
              value: wk.known,
              x: x + bar + slot * 0.08,
              cls: "dash-bar dash-bar--known",
            },
          ];
          return (
            <g key={wk.week}>
              {pairs.map((p) =>
                p.value > 0 ? (
                  <g key={p.key}>
                    <rect
                      className={p.cls}
                      x={p.x}
                      y={top + h - (p.value / max) * h}
                      width={bar}
                      height={(p.value / max) * h}
                      rx={2}
                    />
                    <text
                      className="dash-value"
                      x={p.x + bar / 2}
                      y={top + h - (p.value / max) * h - 3}
                    >
                      {p.value}
                    </text>
                  </g>
                ) : null,
              )}
            </g>
          );
        })}
      </svg>
      {first && (
        <p className="dash-axis">
          <span>Week of {shortDate(first.week)}</span>
          <span>This week</span>
        </p>
      )}
      <ul className="dash-legend">
        <li>
          <span className="dash-swatch dash-bar--added" />
          Added
        </li>
        <li>
          <span className="dash-swatch dash-bar--known" />
          Reached Known
        </li>
      </ul>
      <p className="hint">If you add faster than words reach Known, the backlog grows.</p>
    </section>
  );
}

// J6
export function CalendarCard({ dash }: { dash: DashResponse }) {
  const columns = calendarColumns(dash.calendar);
  const cell = 16;
  const pitch = 20;
  const left = 30;
  const w = left + columns.length * pitch;
  const h = 7 * pitch;
  const labels: [number, string][] = [
    [0, "Mon"],
    [2, "Wed"],
    [4, "Fri"],
  ];
  return (
    <section className="panel dash-card" aria-labelledby="dash-calendar">
      <p className="eyebrow" id="dash-calendar">
        REVIEW CALENDAR
      </p>
      <svg
        className="dash-chart dash-calendar"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Reviews per day over the last 12 weeks"
      >
        {labels.map(([row, text]) => (
          <text key={text} className="dash-tick dash-tick--start" x={0} y={row * pitch + 13}>
            {text}
          </text>
        ))}
        {columns.map((col, c) =>
          col.map((d, r) =>
            d ? (
              <rect
                key={d.day}
                className={`dash-heat dash-heat--${d.level}`}
                x={left + c * pitch}
                y={r * pitch}
                width={cell}
                height={cell}
                rx={3}
              >
                <title>{`${shortDate(d.day)}: ${plural(d.count, "review", "reviews")}`}</title>
              </rect>
            ) : null,
          ),
        )}
      </svg>
      <p className="dash-axis dash-axis--end">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`dash-swatch dash-heat--${l}`} />
        ))}
        <span>More</span>
      </p>
    </section>
  );
}
