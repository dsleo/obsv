"""Render the mathematical calibration diagram used in the Radar method note.

Requires matplotlib. Run from the repository root with
`python3 scripts/radar/render_calibration_diagram.py`.
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch


OUT = Path("docs/radar/diagrams/local-calibration.svg")
BG = "#f4f0e9"
INK = "#29241f"
MUTED = "#62584f"
PAPER = "#fffaf3"
EDGE = "#c9b9a8"
ACCENT = "#ad6544"
DARK = "#27221f"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "mathtext.fontset": "stix",
    "svg.fonttype": "path",
    "svg.hashsalt": "radar-calibration",
})
fig, ax = plt.subplots(figsize=(16, 9), dpi=120)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")
fig.subplots_adjust(left=0, right=1, bottom=0, top=1)


def box(x, y, w, h, color=PAPER, border=EDGE):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.008,rounding_size=0.012",
                                facecolor=color, edgecolor=border, linewidth=1.2))


def arrow(x1, y1, x2, y2):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=16,
                                 linewidth=1.7, color=ACCENT))


ax.text(.035, .955, "LOCAL CALIBRATION  /  ONE COMMUNE", fontsize=15, weight="bold", color=ACCENT, va="top")
ax.text(.035, .910, "Change each prior as little as possible while fitting the observed result.",
        fontsize=18, weight="bold", color=INK, va="top")

inputs = [
    (.035, r"$p_i$", "Survey model", "A probability vector for each synthetic row"),
    (.355, r"$\alpha_i$", "Resident-adult weight", "Normalized INSEE age × sex cells"),
    (.675, r"$s_k$", "Official 2022 share", "Commune result for each choice k"),
]
for x, symbol, label, caption in inputs:
    box(x, .697, .287, .155)
    ax.text(x + .018, .811, symbol, fontsize=27, color=INK, va="center")
    ax.text(x + .092, .808, label, fontsize=15, weight="bold", color=INK, va="center")
    ax.text(x + .018, .732, caption, fontsize=10.6, color=MUTED, va="center")
    arrow(x + .144, .689, x + .144, .641)

box(.035, .345, .93, .284, color=DARK, border=DARK)
ax.text(.058, .594, "MINIMUM-CHANGE PROJECTION", fontsize=12, weight="bold", color="#eaa783", va="center")
ax.text(.058, .521,
        r"$\min_{\{q_i\}}\ \sum_{i=1}^{n}\alpha_i\,D_{\mathrm{KL}}(q_i\Vert p_i)$",
        fontsize=28, color=PAPER, va="center")
ax.text(.058, .431, "subject to", fontsize=12, weight="bold", color="#d4c8bb", va="center")
ax.text(.193, .430,
        r"$\sum_i\alpha_i q_{ik}=s_k\ \ (\forall k),\qquad\sum_k q_{ik}=1\ \ (\forall i)$",
        fontsize=21, color=PAPER, va="center")
ax.text(.193, .376, r"$q_{ik}\geq 0\ \ (\forall i,k)$", fontsize=18, color=PAPER, va="center")

arrow(.35, .337, .35, .296)
arrow(.78, .337, .78, .296)
box(.035, .129, .603, .154, color="#fff6eb", border=ACCENT)
ax.text(.054, .256, "WHAT EACH PERSON GETS", fontsize=11, weight="bold", color=ACCENT, va="center")
ax.text(.054, .191,
        r"$q_{ik}=\frac{p_{ik}\,e^{\lambda_k}}{\sum_r p_{ir}\,e^{\lambda_r}}$",
        fontsize=25, color=INK, va="center")
ax.text(.383, .190, "Shared option multiplier within the commune;\ndifferent priors stay different.",
        fontsize=10.7, color=MUTED, va="center", linespacing=1.6)

box(.661, .129, .304, .154)
ax.text(.681, .256, "GUARDRAILS", fontsize=11, weight="bold", color=ACCENT, va="center")
ax.text(.681, .222, "≥30 rows  ·  effective support ≥20", fontsize=11.5, color=INK, va="center")
ax.text(.681, .185, "Adult-cell coverage ≥95%", fontsize=11.5, color=INK, va="center")
ax.text(.681, .149, r"$\max_{i,k}|q_{ik}-p_{ik}|\leq 0.20$", fontsize=14.5, color=INK, va="center")

ax.text(.035, .071, "PASS  →  adjusted vector + original prior + QA", fontsize=12, weight="bold", color=INK)
ax.text(.565, .071, "FAIL  →  keep the survey prior", fontsize=12, weight="bold", color=INK)
ax.text(.035, .033, "Exact aggregate fit checks arithmetic, not any persona's actual vote.",
        fontsize=10.5, color=MUTED)

OUT.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(OUT, format="svg", facecolor=BG, bbox_inches=None, pad_inches=0, metadata={"Date": None})
plt.close(fig)

# Preserve a useful description even though math glyphs are outlined as paths.
svg = OUT.read_text(encoding="utf8")
svg = svg.replace("<svg ", "<svg role=\"img\" aria-labelledby=\"title desc\" ", 1)
needle = ">\n <metadata>"
svg = svg.replace(needle,
                  ">\n <title id=\"title\">Radar local minimum-KL calibration</title>\n"
                  " <desc id=\"desc\">Weighted KL minimization of row vectors q from survey priors p, "
                  "subject to official commune shares and probability normalization. The solution uses a shared "
                  "option multiplier and is accepted only when support, coverage and shift checks pass.</desc>\n <metadata>", 1)
svg = "\n".join(line.rstrip() for line in svg.splitlines()) + "\n"
OUT.write_text(svg, encoding="utf8")
print(OUT)
