import { cn } from "@/lib/utils";

function starPoints(cx: number, cy: number, spikes: number, outer: number, inner: number) {
  const points: string[] = [];
  for (let index = 0; index < spikes * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / spikes;
    points.push(`${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return points.join(" ");
}

const STAR = starPoints(50, 50, 7, 31, 14);

export function Emblem({ className, detailed = false }: { className?: string; detailed?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("shrink-0", className)} aria-hidden>
      <circle cx="50" cy="50" r="47" fill="#0c1118" stroke="#d4af37" strokeWidth={detailed ? 2.2 : 3} />
      <circle cx="50" cy="50" r="41" fill="none" stroke="#e0b84c" strokeWidth="0.6" opacity="0.8" />
      <polygon points={STAR} fill="#d4af37" />
      <circle cx="50" cy="50" r="13" fill="#0c1118" stroke="#e0b84c" strokeWidth="1" />
      {detailed ? (
        <text
          x="50"
          y="53.5"
          textAnchor="middle"
          fill="#e0b84c"
          fontSize="7.5"
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.4"
        >
          BCSO
        </text>
      ) : null}
    </svg>
  );
}
