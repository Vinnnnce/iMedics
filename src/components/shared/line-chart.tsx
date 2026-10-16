import { useId } from "react";
export interface ChartPoint { label: string; value: number }
/** Small SVG chart with an equivalent data table; no remote requests. */
export function LineChart({ title, unit = "", points }: { title: string; unit?: string; points: readonly ChartPoint[] }) {
  const id = useId();
  const data = points.filter(point => Number.isFinite(point.value));
  if (!data.length) return <p className="text-sm text-muted-foreground">No chart data available.</p>;
  const min = Math.min(...data.map(point => point.value)), max = Math.max(...data.map(point => point.value));
  const span = max - min || 1;
  const coords = data.map((point, index) => ({
    x: data.length === 1 ? 300 : 32 + index / (data.length - 1) * 536,
    y: 160 - (point.value - min) / span * 128,
  }));
  return <figure className="min-w-0">
    <figcaption className="text-sm font-semibold">{title}{unit && ` (${unit})`}</figcaption>
    <svg role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} viewBox="0 0 600 192" className="mt-3 h-auto w-full text-foreground">
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-description`}>Trend across {data.length} measurements. Exact values are available in the chart data table.</desc>
      {[32, 96, 160].map(y => <line key={y} x1="24" x2="576" y1={y} y2={y} stroke="var(--border)" />)}
      <polyline points={coords.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
      {coords.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill="currentColor"><title>{`${data[index].label}: ${data[index].value} ${unit}`}</title></circle>)}
    </svg>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer rounded-sm">View chart data</summary>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">{title}{unit && ` (${unit})`}</caption>
        <thead><tr><th scope="col" className="py-1">Date / period</th><th scope="col">Value {unit && `(${unit})`}</th></tr></thead>
        <tbody>{data.map((point, index) => <tr key={index}><th scope="row" className="py-1 font-normal">{point.label}</th><td>{point.value}</td></tr>)}</tbody>
      </table></div>
    </details>
  </figure>;
}
