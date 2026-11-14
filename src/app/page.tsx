import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RadarHeader } from "../components/radar/RadarHeader";
import { ImpactHome } from "../components/radar/ImpactHome";
import { topSolde } from "../lib/radar/highlights";
import { impactCells } from "../lib/radar/impactMap";
import { loadAnalysis } from "../lib/radar/loadAnalysis";
import { publishedEvents } from "../lib/radar/publishedEvents";
import { windowEvents } from "../data/chartData";
import "../components/radar/radar.css";

export default function Page() {
  const analyses = publishedEvents.map((e) => ({ id: e.id, analysis: loadAnalysis(e.id) }));
  // The hero is about candidates: abstention tops almost every ranking, so it stays in the map only.
  const heroes = Object.fromEntries(analyses.flatMap((a) => { const s = topSolde(a.analysis, ["abstention"]); return s ? [[a.id, s]] : []; }));
  const meta = Object.fromEntries(windowEvents.filter((e) => heroes[e.id]).map((e) => [e.id, { title: e.title, shortDate: e.shortDate, pollDay: e.pollDay }]));
  const cells = analyses.flatMap((a) => impactCells(a.analysis)).filter((c) => meta[c.e]);
  return (
    <main className="radar-page" id="contenu">
      <RadarHeader active="home" />
      <ImpactHome data={{ heroes, meta, cells }} />
      <section className="impact impact-go" aria-label="Explorer le radar des sondages">
        <Link className="impact-cta" href="/radar">
          Suivre la campagne <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
