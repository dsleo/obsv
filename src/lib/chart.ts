import {
  dayToIso,
  formatShortDate,
  pollObservations,
  POLL_DAYS,
  type CandidateId,
} from "../data/chartData";

export const Y_MAX = 40;
export const Y_TICKS = [0, 10, 20, 30, 40];
// One tick every 15 days from POLL_START; compact layouts keep every other one (see components).
// The last tick is always the current date (POLL_DAYS); regular ticks too close to it are dropped.
export const AXIS_DAYS = [
  ...Array.from({ length: Math.floor(POLL_DAYS / 15) + 1 }, (_, index) => index * 15).filter(
    (day) => POLL_DAYS - day >= 6,
  ),
  POLL_DAYS,
];
/** Horizontal room per day: the plot grows (and scrolls) as new polls extend the timeline. */
export const PX_PER_DAY = 12;
// Breathing room (in days) so the first and last points are not clipped by the plot edge.
export const PAD_DAYS = 2;

export type Plot = { left: number; right: number; top: number; bottom: number };

export function createScale(plot: Plot) {
  return {
    x: (day: number) =>
      plot.left + ((day + PAD_DAYS) / (POLL_DAYS + 2 * PAD_DAYS)) * (plot.right - plot.left),
    y: (value: number) => plot.bottom - (value / Y_MAX) * (plot.bottom - plot.top),
  };
}

export const axisLabel = (day: number) => formatShortDate(dayToIso(day));

export const pollDateLong = (day: number) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.parse(dayToIso(day)));

/** Plot width in px: fills the viewport when data is short, otherwise grows with the number of days. */
export const plotWidthFor = (viewport: number) =>
  Math.max(viewport, Math.round((POLL_DAYS + 2 * PAD_DAYS) * PX_PER_DAY));

/** Gaussian-weighted mean of the polls that tested this candidate around `day`; null where polls are too sparse to say anything. */
export function getSmoothedPollValue(candidateId: CandidateId, day: number) {
  let sum = 0;
  let weight = 0;
  for (const poll of pollObservations) {
    const value = poll.values[candidateId];
    if (value === undefined) continue;
    const w = Math.exp(-Math.pow(day - poll.day, 2) / 40); // sigma ≈ 4.5 days: smooth, still tracks real moves
    sum += w * value;
    weight += w;
  }
  return weight > 0.25 ? sum / weight : null;
}

/** SVG path of the smoothed curve; skips non-finite points so a bad input never yields NaN coordinates. */
export function trendPath(candidateId: CandidateId, scale: ReturnType<typeof createScale>) {
  const points: string[] = [];
  for (let day = 0; day <= POLL_DAYS; day += 1) {
    const value = getSmoothedPollValue(candidateId, day);
    if (value === null || !Number.isFinite(value)) continue;
    points.push(
      `${points.length ? "L" : "M"}${scale.x(day).toFixed(1)},${scale.y(value).toFixed(1)}`,
    );
  }
  return points.join(" ");
}

export const formatPct = (value: number) =>
  value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Each candidate's current average is evaluated at their own latest observed fieldwork date. */
export function currentPollValue(id: CandidateId) {
  const last = pollObservations.filter((p) => p.values[id] !== undefined).at(-1);
  return last ? getSmoothedPollValue(id, last.day) : null;
}
