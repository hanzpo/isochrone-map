import { useState } from 'react';
import { PROFILES, CONTOUR_COLORS } from '../config/map';
import type { IsochroneProfile } from '../types/map';

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
}

function CarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14M5 17a2 2 0 01-2-2v-4l2.67-5.34A2 2 0 017.46 4h9.08a2 2 0 011.79 1.11L21 10.5V15a2 2 0 01-2 2M5 17a2 2 0 002 2h1a2 2 0 002-2M14 17a2 2 0 002 2h1a2 2 0 002-2M3 10.5h18" />
    </svg>
  );
}

function BikeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6a1 1 0 100-2 1 1 0 000 2zM12 17.5V14l-3-3 4-3 2 3h3" />
    </svg>
  );
}

function WalkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1.5" />
      <path d="M10 21l1.5-6L9 13V9l3-1 2.5 3L17 12M14 21l-2-5" />
    </svg>
  );
}

function TransitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <path d="M4 10h16M9 21l-2-4M15 21l2-4M9 7h0M15 7h0M9 14h0M15 14h0" />
    </svg>
  );
}

const PROFILE_ICONS: Record<IsochroneProfile['id'], React.FC<{ className?: string }>> = {
  driving: CarIcon,
  cycling: BikeIcon,
  walking: WalkIcon,
  transit: TransitIcon,
};

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
}: ControlsProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  function handleInputChange(key: string, raw: string, commit: (val: number) => void, min: number, max: number) {
    setInputValues((prev) => ({ ...prev, [key]: raw }));
    const parsed = parseInt(raw);
    if (!isNaN(parsed)) {
      commit(Math.max(min, Math.min(max, parsed)));
    }
  }

  function handleInputBlur(key: string, fallback: number, commit: (val: number) => void) {
    const raw = inputValues[key];
    if (raw === undefined || raw === '') {
      commit(fallback);
    }
    setInputValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function getInputValue(key: string, stateValue: number): string {
    return key in inputValues ? inputValues[key] : String(stateValue);
  }

  const [stowed, setStowed] = useState(false);

  return (
    <div className={`controls${stowed ? ' controls-stowed' : ''}`}>
      <button className="controls-toggle" onClick={() => setStowed(!stowed)} aria-label={stowed ? 'Expand controls' : 'Collapse controls'}>
        <span className="controls-toggle-handle" />
      </button>
      <div className="controls-header">
        <h2>Isochrone</h2>
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
        {loading ? 'Generating...' : 'Apply'}
      </button>

      {!hasLocation && (
        <p className="controls-hint">Click the map or search for an address</p>
      )}
    </div>
  );
}
