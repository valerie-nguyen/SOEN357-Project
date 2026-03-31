import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

export default function MapScreen() {
  const INITIAL_REGION = {
    latitude: 45.4971,
    longitude: -73.5791,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        //showsPointsOfInterest={false}
        userInterfaceStyle="light"
        initialRegion={INITIAL_REGION}
      >
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
});