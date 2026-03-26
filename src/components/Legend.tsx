import { CONTOUR_COLORS } from '../config/map';
import type { IsochroneProfile } from '../types/map';

interface LegendProps {
  contourMinutes: number[];
  profile: IsochroneProfile['id'];
}

export function Legend({ contourMinutes, profile }: LegendProps) {
  const isTransit = profile === 'transit';

  return (
    <div className="legend">
      <div className="legend-title">
        {isTransit ? 'Transit reach' : 'Travel time'}
      </div>
      {isTransit ? (
        <div className="legend-item">
          <span
            className="legend-swatch"
            style={{ backgroundColor: CONTOUR_COLORS[0] }}
          />
          <span>≤ {Math.max(...contourMinutes)} min</span>
        </div>
      ) : (
        contourMinutes.map((minutes, i) => (
          <div key={i} className="legend-item">
            <span
              className="legend-swatch"
              style={{ backgroundColor: CONTOUR_COLORS[i % CONTOUR_COLORS.length] }}
            />
            <span>≤ {minutes} min</span>
          </div>
        ))
      )}
    </div>
  );
}
