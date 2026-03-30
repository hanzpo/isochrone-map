import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { DEFAULT_VIEW, MAPBOX_TOKEN, CONTOUR_COLORS } from '../config/map';
import { ETHNICITY_GROUPS } from '../config/demographics';
import type { IsochroneResult } from '../types/map';
import type { DemographicData, DemographicLayer } from '../types/demographics';

const ISOCHRONE_SOURCE = 'isochrone';
const ISOCHRONE_LAYER = 'isochrone-fill';
const DEMO_SOURCE = 'demographics';
const DEMO_LAYER = 'demographics-fill';
const DEMO_OUTLINE_LAYER = 'demographics-outline';

export const MIN_DEMO_ZOOM = 9;

export function useMap(
  onLocationSelect: (lng: number, lat: number) => void,
  onMoveEnd?: () => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_VIEW.zoom);

  // Always call the latest callback without re-binding map events
  const onLocationSelectRef = useRef(onLocationSelect);
  onLocationSelectRef.current = onLocationSelect;
  const onMoveEndRef = useRef(onMoveEnd);
  onMoveEndRef.current = onMoveEnd;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [DEFAULT_VIEW.lng, DEFAULT_VIEW.lat],
      zoom: DEFAULT_VIEW.zoom,
    });

    const geocoder = new MapboxGeocoder({
      accessToken: MAPBOX_TOKEN,
      mapboxgl: mapboxgl as never,
      marker: false,
      placeholder: 'Search for an address...',
    });

    map.addControl(geocoder, 'top-left');
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    geocoder.on('result', (e: { result: { center: [number, number] } }) => {
      const [lng, lat] = e.result.center;
      setMarker(map, lng, lat);
      onLocationSelectRef.current(lng, lat);
    });

    map.on('click', (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      setMarker(map, lng, lat);
      onLocationSelectRef.current(lng, lat);
    });

    map.on('load', () => {
      setReady(true);
    });

    map.on('moveend', () => {
      setZoom(map.getZoom());
      onMoveEndRef.current?.();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function setMarker(map: mapboxgl.Map, lng: number, lat: number) {
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else {
      markerRef.current = new mapboxgl.Marker({ color: '#0a0a0a' })
        .setLngLat([lng, lat])
        .addTo(map);
    }
  }

  const renderIsochrone = useCallback((data: IsochroneResult, contourMinutes: number[]) => {
    const map = mapRef.current;
    if (!map) return;

    // Always clear and re-add so paint expressions match current data
    if (map.getLayer(`${ISOCHRONE_LAYER}-outline`)) map.removeLayer(`${ISOCHRONE_LAYER}-outline`);
    if (map.getLayer(ISOCHRONE_LAYER)) map.removeLayer(ISOCHRONE_LAYER);
    if (map.getSource(ISOCHRONE_SOURCE)) map.removeSource(ISOCHRONE_SOURCE);

    // Build color expression from contourMinutes order (not feature order)
    // so map colors match legend colors regardless of API response order.
    const colorExpr: mapboxgl.ExpressionSpecification = [
      'match',
      ['get', 'contour'],
      ...contourMinutes.flatMap((minutes, i) => [
        minutes,
        CONTOUR_COLORS[i % CONTOUR_COLORS.length],
      ]),
      CONTOUR_COLORS[0],
    ];

    map.addSource(ISOCHRONE_SOURCE, { type: 'geojson', data });
    map.addLayer({
      id: ISOCHRONE_LAYER,
      type: 'fill',
      source: ISOCHRONE_SOURCE,
      paint: {
        'fill-color': colorExpr,
        'fill-opacity': 0.3,
      },
    });
    map.addLayer({
      id: `${ISOCHRONE_LAYER}-outline`,
      type: 'line',
      source: ISOCHRONE_SOURCE,
      paint: {
        'line-color': colorExpr,
        'line-width': 2,
      },
    });

    // Fit map to isochrone bounds
    const bounds = new mapboxgl.LngLatBounds();
    for (const feature of data.features) {
      if (feature.geometry.type === 'Polygon') {
        for (const ring of (feature.geometry as GeoJSON.Polygon).coordinates) {
          for (const coord of ring) {
            bounds.extend(coord as [number, number]);
          }
        }
      } else if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of (feature.geometry as GeoJSON.MultiPolygon).coordinates) {
          for (const ring of polygon) {
            for (const coord of ring) {
              bounds.extend(coord as [number, number]);
            }
          }
        }
      }
    }
    map.fitBounds(bounds, { padding: 40 });
  }, []);

  const clearIsochrone = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(`${ISOCHRONE_LAYER}-outline`)) map.removeLayer(`${ISOCHRONE_LAYER}-outline`);
    if (map.getLayer(ISOCHRONE_LAYER)) map.removeLayer(ISOCHRONE_LAYER);
    if (map.getSource(ISOCHRONE_SOURCE)) map.removeSource(ISOCHRONE_SOURCE);
  }, []);

  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const renderDemographics = useCallback((data: DemographicData, layerConfig: DemographicLayer) => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing demographic layers and popup
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
    if (map.getLayer(DEMO_OUTLINE_LAYER)) map.removeLayer(DEMO_OUTLINE_LAYER);
    if (map.getLayer(DEMO_LAYER)) map.removeLayer(DEMO_LAYER);
    if (map.getSource(DEMO_SOURCE)) map.removeSource(DEMO_SOURCE);

    if (!data.features.length) return;

    // For categorical (race): compute fill_color and _opacity client-side
    // so we don't rely on backend or Mapbox expressions for color resolution
    if (layerConfig.colorMode === 'categorical' && layerConfig.categoryColors) {
      const colors = layerConfig.categoryColors;
      for (const f of data.features) {
        const p = f.properties;
        if (!p) continue;
        const group = String(p.dominant_group || '');
        p._color = colors[group] || '#bab0ac';
        const pct = Number(p.dominant_pct) || 0;
        p._opacity = pct <= 25 ? 0.25 : pct >= 100 ? 0.85 : 0.25 + (pct - 25) * (0.6 / 75);
      }
    }

    map.addSource(DEMO_SOURCE, { type: 'geojson', data: data as GeoJSON.FeatureCollection });

    // Insert BELOW isochrone layer if it exists
    const beforeLayer = map.getLayer(ISOCHRONE_LAYER) ? ISOCHRONE_LAYER : undefined;

    if (layerConfig.colorMode === 'categorical') {
      map.addLayer(
        {
          id: DEMO_LAYER,
          type: 'fill',
          source: DEMO_SOURCE,
          paint: {
            'fill-color': ['get', '_color'] as mapboxgl.ExpressionSpecification,
            'fill-opacity': ['get', '_opacity'] as mapboxgl.ExpressionSpecification,
          },
        },
        beforeLayer,
      );

      // Hover popup for ethnicity breakdown
      const onMouseMove = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties!;
        map.getCanvas().style.cursor = 'pointer';

        const rows = ETHNICITY_GROUPS
          .filter((g) => {
            const val = props[`pct_${g.key}`];
            return val !== undefined && val !== null && Number(val) > 0.5;
          })
          .sort((a, b) => Number(props[`pct_${b.key}`]) - Number(props[`pct_${a.key}`]))
          .map(
            (g) =>
              `<div style="display:flex;align-items:center;gap:6px;font-size:12px">` +
              `<span style="width:8px;height:8px;border-radius:50%;background:${g.color};flex-shrink:0"></span>` +
              `<span style="flex:1">${g.label}</span>` +
              `<span style="font-weight:600">${Number(props[`pct_${g.key}`]).toFixed(1)}%</span>` +
              `</div>`,
          )
          .join('');

        const html =
          `<div style="font-family:-apple-system,sans-serif;min-width:150px">` +
          `<div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:6px;letter-spacing:0.3px">Ethnic Breakdown</div>` +
          `<div style="display:flex;flex-direction:column;gap:3px">${rows || '<div style="font-size:12px;color:#999">No data</div>'}</div>` +
          `</div>`;

        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: '220px',
          });
        }
        popupRef.current.setLngLat(e.lngLat).setHTML(html).addTo(map);
      };

      const onMouseLeave = () => {
        map.getCanvas().style.cursor = '';
        if (popupRef.current) { popupRef.current.remove(); }
      };

      map.on('mousemove', DEMO_LAYER, onMouseMove);
      map.on('mouseleave', DEMO_LAYER, onMouseLeave);
    } else {
      // Interpolated coloring for numeric metrics
      const colorExpr: mapboxgl.ExpressionSpecification = [
        'interpolate',
        ['linear'],
        ['get', layerConfig.property],
        ...layerConfig.colorStops.flatMap(([val, color]) => [val, color]),
      ];

      map.addLayer(
        {
          id: DEMO_LAYER,
          type: 'fill',
          source: DEMO_SOURCE,
          paint: {
            'fill-color': colorExpr,
            'fill-opacity': 0.55,
          },
        },
        beforeLayer,
      );
    }

    map.addLayer(
      {
        id: DEMO_OUTLINE_LAYER,
        type: 'line',
        source: DEMO_SOURCE,
        paint: {
          'line-color': '#999',
          'line-width': 0.3,
          'line-opacity': 0.4,
        },
      },
      beforeLayer,
    );
  }, []);

  const clearDemographics = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
    if (map.getLayer(DEMO_OUTLINE_LAYER)) map.removeLayer(DEMO_OUTLINE_LAYER);
    if (map.getLayer(DEMO_LAYER)) map.removeLayer(DEMO_LAYER);
    if (map.getSource(DEMO_SOURCE)) map.removeSource(DEMO_SOURCE);
  }, []);

  const getMapBounds = useCallback((): {
    bbox: [number, number, number, number];
    center: { lng: number; lat: number };
    zoom: number;
  } | null => {
    const map = mapRef.current;
    if (!map) return null;
    const bounds = map.getBounds();
    if (!bounds) return null;
    const center = map.getCenter();
    return {
      bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()] as [number, number, number, number],
      center: { lng: center.lng, lat: center.lat },
      zoom: map.getZoom(),
    };
  }, []);

  return {
    containerRef,
    ready,
    zoom,
    renderIsochrone,
    clearIsochrone,
    renderDemographics,
    clearDemographics,
    getMapBounds,
  };
}
