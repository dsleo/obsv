"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { shortTitle } from "../../lib/radar/labels";

const SHOWN = 5;
type Article = { title: string; publisher: string; url: string };

export function ArticleList({ articles }: { articles: Article[] }) {
  const [all, setAll] = useState(false);
  const rows = all ? articles : articles.slice(0, SHOWN);
  return <>
    <ul>{rows.map((a) => <li key={a.url}><a href={a.url} target="_blank" rel="noopener noreferrer"><span>{a.publisher || (a.url.includes("news.google.com") ? "Google Actualités" : "")}</span><strong title={a.title}>{shortTitle(a.title, 200)}</strong><ExternalLink size={18} aria-hidden="true" /></a></li>)}</ul>
    {articles.length > SHOWN ? <button type="button" className="article-more" onClick={() => setAll(!all)} aria-expanded={all} aria-label={all ? "Réduire la liste" : `Voir les ${articles.length - SHOWN} autres articles`} title={all ? "Réduire" : `${articles.length - SHOWN} autres articles`}>
      {all ? <ChevronUp size={20} /> : <><ChevronDown size={20} /><small>+{articles.length - SHOWN}</small></>}
    </button> : null}
  </>;
}
