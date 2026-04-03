import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Minimal "Silver" styling for Google Maps
const silverMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] }
];

export default function MapScreen() {
  const insets = useSafeAreaInsets();

  const INITIAL_REGION = {
    latitude: 45.4971,
    longitude: -73.5791,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };

  // Mock data for places with different quietness levels
  const studyPlaces = [
    { id: '1', title: 'Library Level 1', level: 'Quiet', coord: { latitude: 45.4975, longitude: -73.5795 } },
    { id: '2', title: 'Student Lounge', level: 'Noisy', coord: { latitude: 45.4965, longitude: -73.5785 } },
    { id: '3', title: 'Cafeteria', level: 'Moderate', coord: { latitude: 45.4980, longitude: -73.5780 } },
  ];

  // Helper to determine marker color by ambient noise level
  const getColorForLevel = (level: string) => {
    switch (level) {
      case 'Quiet': return '#6B9E78'; // Soft Forest Green
      case 'Moderate': return '#F0B361'; // Muted Amber
      case 'Noisy': return '#F47C7C'; // Soft Coral/Red
      default: return '#6B9E78';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <MapView
        style={styles.map}
        userInterfaceStyle="light"
        initialRegion={INITIAL_REGION}
        customMapStyle={silverMapStyle}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {studyPlaces.map(place => (
          <Marker
            key={place.id}
            coordinate={place.coord}
            title={place.title}
            description={`${place.level} Zone`}
            pinColor={getColorForLevel(place.level)}
          />
        ))}
      </MapView>

      {/* Box-none allows taps on the map to pass through empty space */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        
        {/* Top Header Bar */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 10 }]}>
          <Text style={styles.headerTitle}>QuietSpace</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#6B9E78" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search study places..."
              placeholderTextColor="#999999"
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Floating Action/Filter Bar & Legend */}
        <View style={styles.floatingContainer} pointerEvents="box-none">
          <View style={styles.actionsLeft} pointerEvents="box-none">
            <TouchableOpacity style={styles.filterButton} activeOpacity={0.8}>
              <Ionicons name="options" size={16} color="#ffffff" />
              <Text style={styles.filterText}>Filters</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.legendCard} pointerEvents="none">
            <Text style={styles.legendTitle}>Quietness level</Text>
            
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: '#6B9E78' }]} />
              <Text style={styles.legendLabel}>Quiet</Text>
            </View>
            
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: '#F0B361' }]} />
              <Text style={styles.legendLabel}>Moderate</Text>
            </View>
            
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: '#F47C7C' }]} />
              <Text style={styles.legendLabel}>Noisy</Text>
            </View>
          </View>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    backgroundColor: '#6B9E78',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'System',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333333',
  },
  floatingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    zIndex: 5,
  },
  actionsLeft: {
    alignItems: 'flex-start',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A7A56',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  filterText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 6,
  },
  legendCard: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 150,
  },
  legendTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  legendLabel: {
    fontSize: 14,
    color: '#555555',
    fontWeight: '600',
  }
});