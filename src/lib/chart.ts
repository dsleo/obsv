import { dayToIso, formatShortDate, pollObservations, POLL_DAYS, type CandidateId } from "../data/radarData";

export const Y_MAX = 35;
export const Y_TICKS = [0, 5, 10, 15, 20, 25, 30, 35];
export const AXIS_DAYS = [0, 14, 30, 45, 60, 75, 91];

export type Plot = { left: number; right: number; top: number; bottom: number };

export function createScale(plot: Plot) {
  return {
    x: (day: number) => plot.left + (day / POLL_DAYS) * (plot.right - plot.left),
    y: (value: number) => plot.bottom - (value / Y_MAX) * (plot.bottom - plot.top),
  };
}

export const axisLabel = (day: number) => formatShortDate(dayToIso(day));

export const pollDateLong = (day: number) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.parse(dayToIso(day)));

/** Gaussian-weighted mean of all polls around `day`; null where polls are too sparse to say anything. */
export function getSmoothedPollValue(candidateId: CandidateId, day: number) {
  let sum = 0;
  let weight = 0;
  for (const poll of pollObservations) {
    const w = Math.exp(-Math.pow(day - poll.day, 2) / 18);
    sum += w * poll.values[candidateId];
    weight += w;
  }
  return weight > 0.35 ? sum / weight : null;
}

/** SVG path of the smoothed curve; skips non-finite points so a bad input never yields NaN coordinates. */
export function trendPath(candidateId: CandidateId, scale: ReturnType<typeof createScale>) {
  const points: string[] = [];
  for (let day = 0; day <= POLL_DAYS; day += 1) {
    const value = getSmoothedPollValue(candidateId, day);
    if (value === null || !Number.isFinite(value)) continue;
    points.push(`${points.length ? "L" : "M"}${scale.x(day).toFixed(1)},${scale.y(value).toFixed(1)}`);
  }
  return points.join(" ");
}
