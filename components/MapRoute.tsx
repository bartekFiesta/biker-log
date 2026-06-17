import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Polyline, type Region } from 'react-native-maps';

import Colors from '@/constants/Colors';
import type { RoutePoint } from '@/lib/types';

interface MapRouteProps {
  points: RoutePoint[];
  height?: number;
}

export default function MapRoute({ points, height = 260 }: MapRouteProps) {
  const region = useMemo<Region | undefined>(() => {
    if (points.length === 0) return undefined;

    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = Math.max((maxLat - minLat) * 1.4, 0.01);
    const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.01);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [points]);

  if (!region || points.length === 0) {
    return <View style={[styles.placeholder, { height }]} />;
  }

  return (
    <MapView style={[styles.map, { height }]} initialRegion={region} scrollEnabled={false}>
      <Polyline
        coordinates={points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
        strokeColor={Colors.dark.tint}
        strokeWidth={4}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeholder: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
});
