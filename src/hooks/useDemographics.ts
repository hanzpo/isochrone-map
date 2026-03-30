import { useCallback, useRef, useState } from 'react';
import { fetchDemographicData } from '../services/demographics';
import { detectCountry } from '../utils/geo';
import type { DemographicMetric, DemographicData } from '../types/demographics';

interface UseDemographicsState {
  data: DemographicData | null;
  loading: boolean;
  error: string | null;
}

export function useDemographics() {
  const [state, setState] = useState<UseDemographicsState>({
    data: null,
    loading: false,
    error: null,
  });
  const [metric, setMetricRaw] = useState<DemographicMetric | null>(null);

  // Cache keyed by "roundedBbox_metric_country"
  const cache = useRef(new Map<string, DemographicData>());

  const fetchData = useCallback(
    async (
      bbox: [number, number, number, number],
      centerLng: number,
      centerLat: number,
      selectedMetric: DemographicMetric,
    ) => {
      const country = detectCountry(centerLng, centerLat);
      const roundedBbox = bbox.map((v) => Math.round(v * 100) / 100).join(',');
      const cacheKey = `${roundedBbox}_${selectedMetric}_${country}`;

      const cached = cache.current.get(cacheKey);
      if (cached) {
        setState({ data: cached, loading: false, error: null });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const data = await fetchDemographicData({
          bbox,
          lng: centerLng,
          lat: centerLat,
          metric: selectedMetric,
          country,
        });

        cache.current.set(cacheKey, data);
        setState({ data, loading: false, error: null });
      } catch (err) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load demographics',
        });
      }
    },
    [],
  );

  const setMetric = useCallback(
    (
      next: DemographicMetric | null,
      bbox?: [number, number, number, number],
      centerLng?: number,
      centerLat?: number,
    ) => {
      setMetricRaw(next);

      if (!next) {
        setState({ data: null, loading: false, error: null });
        return;
      }

      if (bbox && centerLng !== undefined && centerLat !== undefined) {
        fetchData(bbox, centerLng, centerLat, next);
      }
    },
    [fetchData],
  );

  const refresh = useCallback(
    (bbox: [number, number, number, number], centerLng: number, centerLat: number) => {
      const currentMetric = metric;
      if (!currentMetric) return;
      fetchData(bbox, centerLng, centerLat, currentMetric);
    },
    [metric, fetchData],
  );

  const clearData = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    metric,
    setMetric,
    refresh,
    clearData,
  };
}
