import { ETHNICITY_GROUPS } from '../config/demographics';
import type { DemographicLayer } from '../types/demographics';
import type { DemographicData } from '../types/demographics';

interface DemographicLegendProps {
  layer: DemographicLayer;
  data?: DemographicData | null;
}

export function DemographicLegend({ layer, data }: DemographicLegendProps) {
  if (layer.colorMode === 'categorical') {
    // Only show groups that actually appear in the data
    const presentGroups = new Set<string>();
    if (data?.features) {
      for (const f of data.features) {
        const g = f.properties?.dominant_group;
        if (g) presentGroups.add(String(g));
      }
    }
    const groups = ETHNICITY_GROUPS.filter(
      (g) => layer.categoryColors?.[g.key] && (presentGroups.size === 0 || presentGroups.has(g.key)),
    );
    return (
      <div className="demographic-legend">
        <div className="legend-title">{layer.label}</div>
        <div className="demographic-legend-categories">
          {groups.map((g) => (
            <div key={g.key} className="legend-item">
              <span
                className="legend-swatch"
                style={{ backgroundColor: g.color }}
              />
              <span>{g.label}</span>
            </div>
          ))}
        </div>
        <div className="demographic-legend-hint">
          Opacity = dominance strength
        </div>
      </div>
    );
  }

  // Gradient legend for numeric metrics
  const stops = layer.colorStops;
  const gradient = stops
    .map(([, color], i) => {
      const pct = (i / (stops.length - 1)) * 100;
      return `${color} ${pct}%`;
    })
    .join(', ');

  return (
    <div className="demographic-legend">
      <div className="legend-title">{layer.label}</div>
      <div
        className="demographic-legend-gradient"
        style={{ background: `linear-gradient(to right, ${gradient})` }}
      />
      <div className="demographic-legend-labels">
        <span>{layer.formatValue(stops[0][0])}</span>
        <span>{layer.formatValue(stops[stops.length - 1][0])}</span>
      </div>
    </div>
  );
}
