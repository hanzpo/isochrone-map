import { useCallback, useRef, useState } from 'react';
import { fetchIsochrone } from '../services/isochrone';
import { fetchTransitIsochrone } from '../services/traveltime';
import { DEFAULT_CONTOUR_MINUTES, DEFAULT_TRANSIT_MINUTES, PROFILES } from '../config/map';
import type { IsochroneProfile, IsochroneResult } from '../types/map';

interface UseIsochroneState {
  data: IsochroneResult | null;
  loading: boolean;
  error: string | null;
}

export function useIsochrone() {
  const [state, setState] = useState<UseIsochroneState>({
    data: null,
    loading: false,
    error: null,
  });

  const [profile, setProfileRaw] = useState<IsochroneProfile['id']>('driving');
  const [contourMinutes, setContourMinutes] = useState(DEFAULT_CONTOUR_MINUTES);
  const [transitMinutes, setTransitMinutes] = useState(DEFAULT_TRANSIT_MINUTES);

  // Remember last mapbox contours so switching back restores them
  const savedContours = useRef(DEFAULT_CONTOUR_MINUTES);

  const setProfile = useCallback((next: IsochroneProfile['id']) => {
    setProfileRaw((prev) => {
      const wasTransit = prev === 'transit';
      const isTransit = next === 'transit';

      if (!wasTransit && isTransit) {
        savedContours.current = contourMinutes;
      }
      if (wasTransit && !isTransit) {
        setContourMinutes(savedContours.current);
      }

      return next;
    });
  }, [contourMinutes]);

  const isTransit = profile === 'transit';

  const generate = useCallback(
    async (lng: number, lat: number) => {
      setState({ data: null, loading: true, error: null });

      const profileConfig = PROFILES.find((p) => p.id === profile)!;

      try {
        let data: IsochroneResult;

        if (profileConfig.provider === 'traveltime') {
          data = await fetchTransitIsochrone({
            lng,
            lat,
            travelTimeSeconds: transitMinutes * 60,
          });
        } else {
          data = await fetchIsochrone({
            lng,
            lat,
            profile: profile as 'driving' | 'walking' | 'cycling',
            contourMinutes,
          });
        }

        setState({ data, loading: false, error: null });
      } catch (err) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [profile, contourMinutes, transitMinutes],
  );

  const clearData = useCallback(() => {
    setState((prev) => (prev.data ? { ...prev, data: null } : prev));
  }, []);

  return {
    ...state,
    profile,
    setProfile,
    isTransit,
    contourMinutes,
    setContourMinutes,
    transitMinutes,
    setTransitMinutes,
    generate,
    clearData,
  };
}
