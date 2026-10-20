import type { Dict } from "@/lib/i18n/dict";

const STYLE = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  high: "bg-red-50 text-red-700 ring-red-200",
};

/** Works on server and client pages: the caller passes its dictionary's risk labels. */
export default function RiskBadge({ score, level, labels, size = "sm" }: { score: number; level: "low" | "medium" | "high"; labels: Dict["risk"]; size?: "sm" | "lg" }) {
  if (size === "lg") {
    return (
      <div className={`inline-flex items-baseline gap-2 rounded-xl px-4 py-2 ring-1 ${STYLE[level]}`}>
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-sm font-medium">/100 · {labels[level]}</span>
      </div>
    );
  }
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STYLE[level]}`}>{labels[level]} · {score}</span>;
}
