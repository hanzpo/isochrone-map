import { useState, useRef, useEffect, useCallback } from 'react';
import { PROFILES, CONTOUR_COLORS } from '../config/map';
import { DEMOGRAPHIC_LAYERS } from '../config/demographics';
import type { IsochroneProfile } from '../types/map';
import type { DemographicMetric } from '../types/demographics';

interface ControlsProps {
  profile: IsochroneProfile['id'];
  onProfileChange: (profile: IsochroneProfile['id']) => void;
  isTransit: boolean;
  contourMinutes: number[];
  onContourChange: (minutes: number[]) => void;
  transitMinutes: number;
  onTransitMinutesChange: (minutes: number) => void;
  loading: boolean;
  hasLocation: boolean;
  onApply: () => void;
  showLegend?: boolean;
  legendContourMinutes?: number[];
  legendProfile?: IsochroneProfile['id'];
  demographicMetric: DemographicMetric | null;
  onDemographicMetricChange: (metric: DemographicMetric | null) => void;
  demographicLoading: boolean;
  tooZoomedOut: boolean;
}

function CarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
    </svg>
  );
}

function BikeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.93 0-3.5-1.57-3.5-3.5S3.07 13.5 5 13.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5zm5.8-10l2.4 2.4-3.2 3V21h-2v-5.5l2.8-2.8-2.2-2.2-.8.8C7.35 11.75 6.2 12 5 12v-2c1.5 0 2.95-.65 3.95-1.65L10.2 7.1c.2-.2.5-.3.8-.3s.6.1.8.3l2.5 2.5c1 1 2.25 1.4 3.7 1.4v2c-2.05 0-3.7-.85-4.2-1.5zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
    </svg>
  );
}

function WalkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
    </svg>
  );
}

function TransitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
    </svg>
  );
}

const PROFILE_ICONS: Record<IsochroneProfile['id'], React.FC<{ className?: string }>> = {
  driving: CarIcon,
  cycling: BikeIcon,
  walking: WalkIcon,
  transit: TransitIcon,
};

interface DragState {
  startPos: number;
  currentPos: number;
  isDragging: boolean;
  recentPos: number;
  recentTime: number;
}

export function Controls({
  profile,
  onProfileChange,
  isTransit,
  contourMinutes,
  onContourChange,
  transitMinutes,
  onTransitMinutesChange,
  loading,
  hasLocation,
  onApply,
  showLegend,
  legendContourMinutes,
  legendProfile,
  demographicMetric,
  onDemographicMetricChange,
  demographicLoading,
  tooZoomedOut,
}: ControlsProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 640px)');
    const mqLandscape = window.matchMedia('(orientation: landscape)');
    setIsMobile(mqMobile.matches);
    setIsLandscape(mqLandscape.matches);
    const handleMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const handleLandscape = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mqMobile.addEventListener('change', handleMobile);
    mqLandscape.addEventListener('change', handleLandscape);
    return () => {
      mqMobile.removeEventListener('change', handleMobile);
      mqLandscape.removeEventListener('change', handleLandscape);
    };
  }, []);

  const wasLoading = useRef(false);
  useEffect(() => {
    if (wasLoading.current && !loading && isMobile) {
      setExpanded(false);
    }
    wasLoading.current = loading;
  }, [loading, isMobile]);

  const getOffsets = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet) return { collapsed: 0, prop: 'translateY' as const };
    if (isLandscape) {
      const peekWidth = 48;
      return { collapsed: Math.max(0, sheet.offsetWidth - peekWidth), prop: 'translateX' as const };
    }
    const peekHeight = 200;
    return { collapsed: Math.max(0, sheet.offsetHeight - peekHeight), prop: 'translateY' as const };
  }, [isLandscape]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    const pos = isLandscape ? touch.clientX : touch.clientY;
    const now = Date.now();
    dragRef.current = { startPos: pos, currentPos: pos, isDragging: false, recentPos: pos, recentTime: now };
  }, [isMobile, isLandscape]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (!drag || !sheet || !isMobile) return;
    const touch = e.touches[0];
    const pos = isLandscape ? touch.clientX : touch.clientY;
    const delta = pos - drag.startPos;
    if (!drag.isDragging && Math.abs(delta) < 6) return;
    drag.isDragging = true;
    const now = Date.now();
    if (now - drag.recentTime > 40) { drag.recentPos = drag.currentPos; drag.recentTime = now; }
    drag.currentPos = pos;
    const { collapsed, prop } = getOffsets();
    const baseOffset = expanded ? 0 : collapsed;
    let offset = baseOffset + delta;
    if (offset < 0) offset = offset / 4;
    else if (offset > collapsed) offset = collapsed + (offset - collapsed) / 4;
    sheet.style.transition = 'none';
    sheet.style.transform = `${prop}(${offset}px)`;
  }, [isMobile, isLandscape, expanded, getOffsets]);

  const handleTouchEnd = useCallback(() => {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (!drag || !sheet || !isMobile) return;
    if (!drag.isDragging) { dragRef.current = null; return; }
    const now = Date.now();
    const dt = Math.max(now - drag.recentTime, 1);
    const velocity = (drag.currentPos - drag.recentPos) / dt;
    const { collapsed, prop } = getOffsets();
    const delta = drag.currentPos - drag.startPos;
    let shouldExpand: boolean;
    if (Math.abs(velocity) > 0.25) {
      shouldExpand = velocity < 0;
    } else {
      const baseOffset = expanded ? 0 : collapsed;
      const currentOffset = Math.max(0, Math.min(collapsed, baseOffset + delta));
      shouldExpand = currentOffset < collapsed * 0.4;
    }
    const targetOffset = shouldExpand ? 0 : collapsed;
    sheet.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
    sheet.style.transform = `${prop}(${targetOffset}px)`;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      sheet.style.transition = '';
      sheet.style.transform = '';
      sheet.removeEventListener('transitionend', cleanup);
    };
    sheet.addEventListener('transitionend', cleanup);
    setTimeout(cleanup, 400);
    setExpanded(shouldExpand);
    dragRef.current = null;
  }, [isMobile, isLandscape, expanded, getOffsets]);

  function handleInputChange(key: string, raw: string, commit: (val: number) => void, min: number, max: number) {
    setInputValues((prev) => ({ ...prev, [key]: raw }));
    const parsed = parseInt(raw);
    if (!isNaN(parsed)) commit(Math.max(min, Math.min(max, parsed)));
  }

  function handleInputBlur(key: string, fallback: number, commit: (val: number) => void) {
    const raw = inputValues[key];
    if (raw === undefined || raw === '') commit(fallback);
    setInputValues((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }

  function getInputValue(key: string, stateValue: number): string {
    return key in inputValues ? inputValues[key] : String(stateValue);
  }

  const isLegendTransit = legendProfile === 'transit';

  return (
    <>
      {isMobile && expanded && (
        <div className="controls-backdrop" onClick={() => setExpanded(false)} />
      )}
      <div
        ref={sheetRef}
        className={`controls${isMobile && !expanded ? ' controls-collapsed' : ''}`}
      >
        {/* Swipeable area: handle + peek */}
        <div
          className="controls-swipe-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            className="controls-toggle"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse controls' : 'Expand controls'}
          >
            <span className="controls-toggle-handle" />
          </button>

          <div className="controls-peek">
            {/* Demographics section — always visible */}
            <div className="control-section">
              <div className="controls-header">
                <h2>Demographics</h2>
                {demographicLoading && <span className="spinner" />}
              </div>
              <div className="demographic-chips">
                {DEMOGRAPHIC_LAYERS.map((layer) => (
                  <button
                    key={layer.id}
                    className={`demographic-chip${demographicMetric === layer.id ? ' active' : ''}${!layer.enabled ? ' disabled' : ''}`}
                    onClick={() => {
                      if (!layer.enabled) return;
                      onDemographicMetricChange(
                        demographicMetric === layer.id ? null : layer.id,
                      );
                    }}
                    disabled={!layer.enabled}
                    title={!layer.enabled ? 'Coming soon' : layer.label}
                  >
                    {layer.label}
                  </button>
                ))}
              </div>
              {tooZoomedOut && demographicMetric && (
                <p className="zoom-hint">Zoom in to see demographic data</p>
              )}
            </div>
          </div>
        </div>

        {/* Expandable: Travel Time section */}
        <div className="controls-body">
          <div className="controls-body-inner">
            <div className="control-section">
              <div className="controls-header">
                <h2>Travel Time</h2>
                {loading && <span className="spinner" />}
              </div>

              <div className="control-group">
                <label>Mode</label>
                <div className="profile-buttons">
                  {PROFILES.map((p) => {
                    const Icon = PROFILE_ICONS[p.id];
                    return (
                      <button
                        key={p.id}
                        className={profile === p.id ? 'active' : ''}
                        onClick={() => onProfileChange(p.id)}
                        title={p.label}
                      >
                        <Icon className="profile-icon" />
                        <span className="profile-label">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="control-group">
                {isTransit ? (
                  <>
                    <label>
                      Travel time <span className="label-unit">(min)</span>
                    </label>
                    <div className="contour-inputs">
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={getInputValue('transit', transitMinutes)}
                        onChange={(e) =>
                          handleInputChange('transit', e.target.value, onTransitMinutesChange, 5, 120)
                        }
                        onBlur={() => handleInputBlur('transit', 30, onTransitMinutesChange)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label>
                      Contours <span className="label-unit">(min)</span>
                    </label>
                    <div className="contour-inputs">
                      {contourMinutes.map((minutes, i) => {
                        const key = `contour-${i}`;
                        return (
                          <div key={i} className="contour-input-row">
                            <span
                              className="contour-dot"
                              style={{ backgroundColor: CONTOUR_COLORS[i % CONTOUR_COLORS.length] }}
                            />
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={getInputValue(key, minutes)}
                              onChange={(e) =>
                                handleInputChange(
                                  key,
                                  e.target.value,
                                  (val) => {
                                    const updated = [...contourMinutes];
                                    updated[i] = val;
                                    onContourChange(updated);
                                  },
                                  1,
                                  60,
                                )
                              }
                              onBlur={() =>
                                handleInputBlur(key, minutes, (val) => {
                                  const updated = [...contourMinutes];
                                  updated[i] = val;
                                  onContourChange(updated);
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <button
                className="apply-button"
                onClick={onApply}
                disabled={!hasLocation || loading}
              >
                {loading ? 'Generating...' : 'Generate Isochrone'}
              </button>

              {!hasLocation && (
                <p className="controls-hint">Click the map or search for an address</p>
              )}
            </div>

            {/* Inline legend on mobile */}
            {showLegend && legendContourMinutes && legendProfile && (
              <div className="controls-legend">
                <div className="legend-title">
                  {isLegendTransit ? 'Transit reach' : 'Travel time'}
                </div>
                {isLegendTransit ? (
                  <div className="legend-item">
                    <span
                      className="legend-swatch"
                      style={{ backgroundColor: CONTOUR_COLORS[0] }}
                    />
                    <span>&le; {Math.max(...legendContourMinutes)} min</span>
                  </div>
                ) : (
                  legendContourMinutes.map((minutes, i) => (
                    <div key={i} className="legend-item">
                      <span
                        className="legend-swatch"
                        style={{ backgroundColor: CONTOUR_COLORS[i % CONTOUR_COLORS.length] }}
                      />
                      <span>&le; {minutes} min</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
