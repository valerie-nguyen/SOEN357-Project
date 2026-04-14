import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

type MarkerPlace = {
  id: string;
  title: string;
  level: string;
  coord: {
    latitude: number;
    longitude: number;
  };
};

type CustomStudyMarkerProps = {
  place: MarkerPlace;
  onPress: (event: any) => void;
  color: string;
};

export function CustomStudyMarker({ place, onPress, color }: CustomStudyMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      key={place.id}
      coordinate={place.coord}
      title={place.title}
      description={`${place.level} Zone`}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
    >
      <View style={styles.customMarkerContainer}>
        <View style={[styles.customMarkerPin, { backgroundColor: color }]}>
          <View style={styles.customMarkerDot} />
        </View>
        <View style={[styles.customMarkerTriangle, { borderTopColor: color }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  customMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  customMarkerPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customMarkerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  customMarkerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
