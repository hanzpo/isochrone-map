import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from '../hooks/useMap';
import { useIsochrone } from '../hooks/useIsochrone';
import { Controls } from './Controls';
import { Legend } from './Legend';

export function MapView() {
  const [location, setLocation] = useState<{ lng: number; lat: number } | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;

  const iso = useIsochrone();
  const generateRef = useRef(iso.generate);
  generateRef.current = iso.generate;

  const onLocationSelect = useCallback((lng: number, lat: number) => {
    setLocation({ lng, lat });
  }, []);

  const { containerRef, ready, renderIsochrone } = useMap(onLocationSelect);

  useEffect(() => {
    if (iso.data) {
      renderIsochrone(iso.data);
    }
  }, [iso.data, renderIsochrone]);

  const handleApply = useCallback(() => {
    if (locationRef.current) {
      generateRef.current(locationRef.current.lng, locationRef.current.lat);
    }
  }, []);

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-container" />
      {ready && (
        <Controls
          profile={iso.profile}
          onProfileChange={iso.setProfile}
          isTransit={iso.isTransit}
          contourMinutes={iso.contourMinutes}
          onContourChange={iso.setContourMinutes}
          transitMinutes={iso.transitMinutes}
          onTransitMinutesChange={iso.setTransitMinutes}
          loading={iso.loading}
          hasLocation={!!location}
          onApply={handleApply}
        />
      )}
      {iso.data && (
        <Legend
          contourMinutes={iso.isTransit ? [iso.transitMinutes] : iso.contourMinutes}
          profile={iso.profile}
        />
      )}
      {iso.error && <div className="error-banner">{iso.error}</div>}
    </div>
  );
}
