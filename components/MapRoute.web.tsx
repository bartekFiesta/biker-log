import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Text as ThemedText } from '@/components/Themed';
import Colors from '@/constants/Colors';
import type { RoutePoint } from '@/lib/types';

interface MapRouteProps {
  points: RoutePoint[];
  height?: number;
}

export default function MapRoute({ points, height = 260 }: MapRouteProps) {
  const distanceKm = useMemo(() => {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const latRad = ((b.lat - a.lat) * Math.PI) / 180;
      const lngRad = ((b.lng - a.lng) * Math.PI) / 180;
      const x =
        Math.sin(latRad / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) *
          Math.cos((b.lat * Math.PI) / 180) *
          Math.sin(lngRad / 2) ** 2;
      total += 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }
    return total;
  }, [points]);

  if (points.length === 0) {
    return <View style={[styles.placeholder, { height }]} />;
  }

  return (
    <View style={[styles.webFallback, { height }]}>
      <ThemedText style={styles.webTitle}>Route preview</ThemedText>
      <Text style={styles.webMeta}>
        {points.length} GPS points · ~{distanceKm.toFixed(1)} km
      </Text>
      <Text style={styles.webHint}>Full map view is in the native iOS build.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  webFallback: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  webTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  webMeta: {
    color: Colors.dark.muted,
    fontSize: 14,
    marginBottom: 8,
  },
  webHint: {
    color: Colors.dark.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
