import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap, MIN_DEMO_ZOOM } from '../hooks/useMap';
import { useIsochrone } from '../hooks/useIsochrone';
import { useDemographics } from '../hooks/useDemographics';
import { getDemographicLayer } from '../config/demographics';
import { Controls } from './Controls';
import { Legend } from './Legend';
import { DemographicLegend } from './DemographicLegend';

export function MapView() {
  const [location, setLocation] = useState<{ lng: number; lat: number } | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;

  const iso = useIsochrone();
  const demo = useDemographics();
  const generateRef = useRef(iso.generate);
  generateRef.current = iso.generate;

  const onLocationSelect = useCallback((lng: number, lat: number) => {
    setLocation({ lng, lat });
  }, []);

  // Debounced demographic refresh on map move
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchBboxRef = useRef<[number, number, number, number] | null>(null);

  const handleMoveEnd = useCallback(() => {
    // Only auto-refresh if a demographic metric is active
    if (!demo.metric) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const bounds = getMapBounds();
      if (!bounds) return;

      // Skip if zoomed out too far
      if (bounds.zoom < MIN_DEMO_ZOOM) return;

      // Skip if viewport hasn't shifted significantly (>30% of bbox dimension)
      const last = lastFetchBboxRef.current;
      if (last) {
        const lngSpan = last[2] - last[0];
        const latSpan = last[3] - last[1];
        const lngShift = Math.abs(bounds.bbox[0] - last[0]);
        const latShift = Math.abs(bounds.bbox[1] - last[1]);
        if (lngShift < lngSpan * 0.3 && latShift < latSpan * 0.3) return;
      }

      lastFetchBboxRef.current = bounds.bbox;
      demo.refresh(bounds.bbox, bounds.center.lng, bounds.center.lat);
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.metric, demo.refresh]);

  const { containerRef, ready, zoom, renderIsochrone, clearIsochrone, renderDemographics, clearDemographics, getMapBounds } =
    useMap(onLocationSelect, handleMoveEnd);

  // Clear isochrone when location or mode changes
  useEffect(() => {
    if (location) {
      clearIsochrone();
      iso.clearData();
    }
  }, [location, iso.profile, clearIsochrone, iso.clearData]);

  const contourMinutes = iso.isTransit ? [iso.transitMinutes] : iso.contourMinutes;

  useEffect(() => {
    if (iso.data) {
      renderIsochrone(iso.data, contourMinutes);
    }
  }, [iso.data, renderIsochrone, contourMinutes]);

  // Render demographic layer when data changes
  // Don't clear while loading — keep stale layer visible until new data arrives
  useEffect(() => {
    if (demo.data && demo.metric) {
      const layerConfig = getDemographicLayer(demo.metric);
      renderDemographics(demo.data, layerConfig);
    } else if (!demo.metric) {
      clearDemographics();
    }
  }, [demo.data, demo.metric, renderDemographics, clearDemographics]);

  const tooZoomedOut = zoom < MIN_DEMO_ZOOM;

  const handleDemographicMetricChange = useCallback(
    (metric: typeof demo.metric) => {
      if (!metric) {
        demo.setMetric(null);
        lastFetchBboxRef.current = null;
        return;
      }
      const bounds = getMapBounds();
      if (bounds && bounds.zoom >= MIN_DEMO_ZOOM) {
        lastFetchBboxRef.current = bounds.bbox;
        demo.setMetric(metric, bounds.bbox, bounds.center.lng, bounds.center.lat);
      } else {
        demo.setMetric(metric);
      }
    },
    [demo.setMetric, getMapBounds],
  );

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
          showLegend={!!iso.data}
          legendContourMinutes={contourMinutes}
          legendProfile={iso.profile}
          demographicMetric={demo.metric}
          onDemographicMetricChange={handleDemographicMetricChange}
          demographicLoading={demo.loading}
          tooZoomedOut={tooZoomedOut}
        />
      )}
      {demo.loading && demo.metric && (
        <div className="demo-loading-badge">
          <span className="spinner" />
          Loading demographics...
        </div>
      )}
      {iso.data && (
        <Legend
          contourMinutes={contourMinutes}
          profile={iso.profile}
        />
      )}
      {demo.metric && demo.data && !tooZoomedOut && (
        <DemographicLegend layer={getDemographicLayer(demo.metric)} data={demo.data} />
      )}
      {(iso.error || demo.error) && (
        <div className="error-banner">{iso.error || demo.error}</div>
      )}
    </div>
  );
}
