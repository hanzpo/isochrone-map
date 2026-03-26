import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { DEFAULT_VIEW, MAPBOX_TOKEN, CONTOUR_COLORS } from '../config/map';
import type { IsochroneResult } from '../types/map';

const ISOCHRONE_SOURCE = 'isochrone';
const ISOCHRONE_LAYER = 'isochrone-fill';

export function useMap(onLocationSelect: (lng: number, lat: number) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Always call the latest callback without re-binding map events
  const onLocationSelectRef = useRef(onLocationSelect);
  onLocationSelectRef.current = onLocationSelect;

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
      markerRef.current = new mapboxgl.Marker({ color: '#1976D2' })
        .setLngLat([lng, lat])
        .addTo(map);
    }
  }

  const renderIsochrone = useCallback((data: IsochroneResult) => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getSource(ISOCHRONE_SOURCE)) {
      (map.getSource(ISOCHRONE_SOURCE) as mapboxgl.GeoJSONSource).setData(data);
    } else {
      map.addSource(ISOCHRONE_SOURCE, { type: 'geojson', data });
      map.addLayer({
        id: ISOCHRONE_LAYER,
        type: 'fill',
        source: ISOCHRONE_SOURCE,
        paint: {
          'fill-color': [
            'match',
            ['get', 'contour'],
            ...data.features.flatMap((f, i) => [
              f.properties?.contour ?? i,
              CONTOUR_COLORS[i % CONTOUR_COLORS.length],
            ]),
            '#999',
          ],
          'fill-opacity': 0.3,
        },
      });
      map.addLayer({
        id: `${ISOCHRONE_LAYER}-outline`,
        type: 'line',
        source: ISOCHRONE_SOURCE,
        paint: {
          'line-color': [
            'match',
            ['get', 'contour'],
            ...data.features.flatMap((f, i) => [
              f.properties?.contour ?? i,
              CONTOUR_COLORS[i % CONTOUR_COLORS.length],
            ]),
            '#999',
          ],
          'line-width': 2,
        },
      });
    }

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

  return { containerRef, ready, renderIsochrone, clearIsochrone };
}
