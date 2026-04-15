import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, Linking, PanResponder, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomStudyMarker } from '../components/CustomStudyMarker';
import { FilterModal } from '../components/FilterModal';
import { LocationInfoPanel } from '../components/LocationInfoPanel';
import { MapHeader } from '../components/MapHeader';
import { PlaceListSheet } from '../components/PlaceListSheet';
import { SearchOverlay } from '../components/SearchOverlay';
import { silverMapStyle } from '../constants/mapStyles';
import { STUDY_PLACES } from '../constants/mockData';

// Haversine formula to calculate distance between two lat/lon coordinates in km
enum SheetState {
  COLLAPSED,
  HALF,
  EXPANDED
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CURRENT_LOCATION = {
  latitude: 45.4953,
  longitude: -73.5790, // Near Guy-Concordia
};

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Decode Google Maps directions polyline
const decodePolyline = (t: string, e: number = 5) => {
  let [n, o, u, l, r, h, idx, len] = [0, 0, 0, 0, 0, 0, 0, t.length];
  const res: {latitude: number; longitude: number;}[] = [];
  const factor = Math.pow(10, e);
  while (idx < len) {
    u = 0;
    r = 0;
    do {
      l = t.charCodeAt(idx++) - 63;
      r |= (31 & l) << u;
      u += 5;
    } while (l >= 32);
    h = 1 & r ? ~(r >> 1) : r >> 1;
    n += h;
    u = 0;
    r = 0;
    do {
      l = t.charCodeAt(idx++) - 63;
      r |= (31 & l) << u;
      u += 5;
    } while (l >= 32);
    h = 1 & r ? ~(r >> 1) : r >> 1;
    o += h;
    res.push({ latitude: n / factor, longitude: o / factor });
  }
  return res as {latitude: number; longitude: number;}[];
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [maxDistance, setMaxDistance] = useState<number>(2.1); // Default to 2.1 km
  const [headerHeight, setHeaderHeight] = useState(140);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  
  const mapRef = useRef<MapView>(null);
  const [selectedTravelMode, setSelectedTravelMode] = useState<string | null>(null);
  const [routePolyline, setRoutePolyline] = useState<{latitude: number; longitude: number;}[]>([]);

  // --- BOTTOM SHEET STATE & LOGIC ---
  const sheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const currentSheetState = useRef(SheetState.HALF);

  const snapPoints = useMemo(() => ({
    [SheetState.COLLAPSED]: SCREEN_HEIGHT - 170, // Peek: showing only header + quietness level
    [SheetState.HALF]: SCREEN_HEIGHT - 420,      // Default: header + quietness + ETAs
    [SheetState.EXPANDED]: 120                   // Full: all details
  }), []);

  const animateToState = useCallback((state: SheetState) => {
    currentSheetState.current = state;
    Animated.spring(sheetY, {
      toValue: snapPoints[state],
      stiffness: 300,
      damping: 30,
      useNativeDriver: false,
    }).start();
  }, [snapPoints]);

  useEffect(() => {
    if (selectedPlace) {
      animateToState(SheetState.HALF);
    } else {
      Animated.timing(sheetY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [selectedPlace, animateToState]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
    onPanResponderGrant: () => {
      // Keep tracking from the visual position
      // @ts-ignore
      sheetY.setOffset(sheetY._value);
      sheetY.setValue(0);
    },
    onPanResponderMove: Animated.event([
      null, { dy: sheetY }
    ], { useNativeDriver: false }),
    onPanResponderRelease: (_, gestureState) => {
      sheetY.flattenOffset();
      // @ts-ignore
      const finalY = sheetY._value + gestureState.vy * 50; // Velocity extrapolation

      // Determine closest snap point
      const distToCollapsed = Math.abs(finalY - snapPoints[SheetState.COLLAPSED]);
      const distToHalf = Math.abs(finalY - snapPoints[SheetState.HALF]);
      const distToExpanded = Math.abs(finalY - snapPoints[SheetState.EXPANDED]);

      const minDist = Math.min(distToCollapsed, distToHalf, distToExpanded);
      
      let nextState = currentSheetState.current;
      if (minDist === distToCollapsed) nextState = SheetState.COLLAPSED;
      else if (minDist === distToHalf) nextState = SheetState.HALF;
      else nextState = SheetState.EXPANDED;

      animateToState(nextState);
    },
    onPanResponderTerminate: () => {
      sheetY.flattenOffset();
      animateToState(currentSheetState.current);
    }
  }), [animateToState, snapPoints, sheetY]);

  const scrimOpacity = sheetY.interpolate({
    inputRange: [snapPoints[SheetState.EXPANDED], snapPoints[SheetState.HALF]],
    outputRange: [0.2, 0],
    extrapolate: 'clamp',
  });

  // --- LIST BOTTOM SHEET STATE ---
  const listSheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const currentListSheetState = useRef(SheetState.COLLAPSED);

  const listSnapPoints = useMemo(() => ({
    [SheetState.COLLAPSED]: SCREEN_HEIGHT - 65,
    [SheetState.HALF]: SCREEN_HEIGHT - 400,
    [SheetState.EXPANDED]: 160
  }), []);

  const animateListToState = useCallback((state: SheetState) => {
    currentListSheetState.current = state;
    Animated.spring(listSheetY, {
      toValue: listSnapPoints[state],
      stiffness: 300,
      damping: 30,
      useNativeDriver: false,
    }).start();
  }, [listSnapPoints, listSheetY]);

  useEffect(() => {
    if (selectedPlace) {
      Animated.timing(listSheetY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      animateListToState(currentListSheetState.current || SheetState.COLLAPSED);
    }
  }, [selectedPlace, animateListToState, listSheetY]);

  const panResponderList = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
    onPanResponderGrant: () => {
      // @ts-ignore
      listSheetY.setOffset(listSheetY._value);
      listSheetY.setValue(0);
    },
    onPanResponderMove: Animated.event([
      null, { dy: listSheetY }
    ], { useNativeDriver: false }),
    onPanResponderRelease: (_, gestureState) => {
      listSheetY.flattenOffset();
      // @ts-ignore
      const finalY = listSheetY._value + gestureState.vy * 50;

      const distToCollapsed = Math.abs(finalY - listSnapPoints[SheetState.COLLAPSED]);
      const distToHalf = Math.abs(finalY - listSnapPoints[SheetState.HALF]);
      const distToExpanded = Math.abs(finalY - listSnapPoints[SheetState.EXPANDED]);

      const minDist = Math.min(distToCollapsed, distToHalf, distToExpanded);
      
      let nextState = currentListSheetState.current;
      if (minDist === distToCollapsed) nextState = SheetState.COLLAPSED;
      else if (minDist === distToHalf) nextState = SheetState.HALF;
      else nextState = SheetState.EXPANDED;

      animateListToState(nextState);
    },
    onPanResponderTerminate: () => {
      listSheetY.flattenOffset();
      animateListToState(currentListSheetState.current);
    }
  }), [animateListToState, listSnapPoints, listSheetY]);

  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedCrowdDensities, setSelectedCrowdDensities] = useState<string[]>([]);
  const [selectedTemperatures, setSelectedTemperatures] = useState<string[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fadeSearchAnim = useRef(new Animated.Value(0)).current;
  const [isFilterModalMounted, setIsFilterModalMounted] = useState(false);
  const filterModalAnim = useRef(new Animated.Value(0)).current;

  // --- SEARCH LOGIC ---
  useEffect(() => {
    Animated.timing(fadeSearchAnim, {
      toValue: isSearchActive ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isSearchActive, fadeSearchAnim]);

  useEffect(() => {
    if (showFilters) {
      setIsFilterModalMounted(true);
      Animated.spring(filterModalAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(filterModalAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsFilterModalMounted(false);
      }
    });
  }, [showFilters, filterModalAnim]);

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const toggleCrowdDensity = (density: string) => {
    setSelectedCrowdDensities(prev =>
      prev.includes(density) ? prev.filter(d => d !== density) : [...prev, density]
    );
  };

  const toggleTemperature = (temperature: string) => {
    setSelectedTemperatures(prev =>
      prev.includes(temperature) ? prev.filter(t => t !== temperature) : [...prev, temperature]
    );
  };

  const getCrowdDensity = (place: any) => {
    const crowdTag = place.features?.find((f: any) => typeof f.label === 'string' && f.label.includes('👥'))?.label?.toLowerCase();
    if (!crowdTag) return null;
    if (crowdTag.includes('low')) return 'Low';
    if (crowdTag.includes('moderate')) return 'Moderate';
    if (crowdTag.includes('high')) return 'High';
    return null;
  };

  const getTemperature = (place: any) => {
    const temperatureTag = place.features?.find((f: any) => typeof f.label === 'string' && f.label.includes('🌡️'))?.label?.toLowerCase();
    if (!temperatureTag) return null;
    if (temperatureTag.includes('cool')) return 'Cool';
    if (temperatureTag.includes('neutral')) return 'Neutral';
    if (temperatureTag.includes('warm')) return 'Warm';
    return null;
  };

  const handleSelectFromSearch = (place: any) => {
    Keyboard.dismiss();
    setIsSearchActive(false);
    setSearchQuery('');
    setSelectedPlace(place);
    setShowFilters(false);
    setRoutePolyline([]);
    setSelectedTravelMode(null);
    animateToState(SheetState.HALF);
    
    mapRef.current?.animateToRegion({
      latitude: place.coord.latitude,
      longitude: place.coord.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 500);
  };

  const INITIAL_REGION = {
    latitude: 45.4960,
    longitude: -73.5775,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };

  const fetchDirections = async (place: any, mode: string) => {
    try {
      // Map UI mode ('Walk', 'Bike', 'Transit', 'Drive') to Google Maps API mode
      let googleMode = 'walking';
      if (mode === 'Bike') googleMode = 'bicycling';
      if (mode === 'Transit') googleMode = 'transit';
      if (mode === 'Drive') googleMode = 'driving';

      const origin = `${CURRENT_LOCATION.latitude},${CURRENT_LOCATION.longitude}`;
      const dest = `${place.coord.latitude},${place.coord.longitude}`;
      const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey;

      if (!apiKey) {
        console.error('API key is missing!');
        return;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${dest}&mode=${googleMode}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const points = decodePolyline(data.routes[0].overview_polyline.points);
        setRoutePolyline(points);
        
        // Auto-Zoom: Fit both points in view
        mapRef.current?.fitToCoordinates(
          [CURRENT_LOCATION, place.coord],
          {
            edgePadding: { top: 280, right: 70, bottom: 480, left: 70 },
            animated: true,
          }
        );
      } else {
        setRoutePolyline([]);
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      setRoutePolyline([]);
    }
  };

  // Mock data for places (Concordia Campus Edition)
  const studyPlaces = STUDY_PLACES;

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return studyPlaces.filter(p => 
      p.title.toLowerCase().includes(q) || 
      (p.address && p.address.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const recommendedPlaces = useMemo(() => {
    return studyPlaces
      .filter(p => p.level === 'Quiet' || p.score >= 4)
      .slice(0, 4);
  }, []);

  // Filtering function to get subset within distance
  const filteredPlaces = useMemo(() => {
    return studyPlaces.filter(place => {
      const distance = getDistanceFromLatLonInKm(
        CURRENT_LOCATION.latitude,
        CURRENT_LOCATION.longitude,
        place.coord.latitude,
        place.coord.longitude
      );
      
      const inDistance = distance <= maxDistance;
      
      const inLevel = selectedLevels.length === 0 || selectedLevels.includes(place.level);
      
      const inAmenities = selectedAmenities.length === 0 || selectedAmenities.every(amenity => 
        place.features?.some((f: any) => f.label.toLowerCase() === amenity.toLowerCase())
      );

      const crowdDensity = getCrowdDensity(place);
      const inCrowdDensity =
        selectedCrowdDensities.length === 0 ||
        (crowdDensity !== null && selectedCrowdDensities.includes(crowdDensity));

      const temperature = getTemperature(place);
      const inTemperature =
        selectedTemperatures.length === 0 ||
        (temperature !== null && selectedTemperatures.includes(temperature));

      return inDistance && inLevel && inAmenities && inCrowdDensity && inTemperature;
    });
  }, [maxDistance, selectedLevels, selectedAmenities, selectedCrowdDensities, selectedTemperatures]);

  // Effect to automatically close bottom sheet if selected place is filtered out
  useEffect(() => {
    if (selectedPlace) {
      const isStillVisible = filteredPlaces.some(p => p.id === selectedPlace.id);
      if (!isStillVisible) {
        setSelectedPlace(null);
      }
    }
  }, [filteredPlaces, selectedPlace]);

  // Effect for Empty State Toast Animation
  useEffect(() => {
    if (filteredPlaces.length === 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [filteredPlaces.length, fadeAnim]);

  // Helper to determine marker color by ambient noise level
  const getColorForLevel = (level: string) => {
    switch (level) {
      case 'Quiet': return '#6B9E78'; // Soft Forest Green
      case 'Moderate': return '#F0B361'; // Muted Amber
      case 'Noisy': return '#F47C7C'; // Soft Coral/Red
      default: return '#6B9E78';
    }
  };

  const getPolylineColor = (mode: string | null) => {
    switch (mode) {
      case 'Walk': return '#34A853';   // Google Maps Green
      case 'Bike': return '#FBBC04';   // Google Maps Yellow
      case 'Transit': return '#EA4335';// Google Maps Red
      case 'Drive': return '#4285F4';  // Google Maps Blue
      default: return '#4285F4';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <MapView
        ref={mapRef}
        style={styles.map}
        userInterfaceStyle="light"
        initialRegion={INITIAL_REGION}
        customMapStyle={silverMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsBuildings={true}
        pitchEnabled={false}
        onPress={() => {
          setSelectedPlace(null);
          setRoutePolyline([]);
          setSelectedTravelMode(null);
          setShowFilters(false);
        }}
      >
        {/* Current Location Marker */}
        <Marker
          key="current-location-marker"
          identifier="current-location-marker"
          coordinate={CURRENT_LOCATION}
          title="Current Location"
          tracksViewChanges={true}
          zIndex={100}
        >
          <View style={styles.userLocationDotBorder}>
            <View style={styles.userLocationDot} />
          </View>
        </Marker>

        {/* Route Polyline (drawn when available) */}
        {routePolyline.length > 0 && selectedPlace && (
          <Polyline
            coordinates={routePolyline}
            strokeWidth={5}
            strokeColor={getPolylineColor(selectedTravelMode)}
            lineCap="round"
            lineJoin="round"
            zIndex={50}
          />
        )}

        {filteredPlaces.map(place => {
          const color = getColorForLevel(place.level);
          return (
            <CustomStudyMarker
              key={place.id}
              place={place}
              color={color}
              isSelected={selectedPlace?.id === place.id}
              onPress={(e: any) => {
                e.stopPropagation();
                setSelectedPlace(place);
                setRoutePolyline([]);
                setSelectedTravelMode(null);
                setShowFilters(false);
                
                // Animate camera to focus loosely on place initially
                mapRef.current?.animateToRegion({
                  latitude: place.coord.latitude,
                  longitude: place.coord.longitude,
                  latitudeDelta: 0.012,
                  longitudeDelta: 0.012,
                }, 500);
              }}
            />
          );
        })}
      </MapView>

      {/* Main UI Overlay Container */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {selectedPlace && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: '#000', opacity: scrimOpacity }
            ]}
          />
        )}
        
        <MapHeader
          topInset={insets.top}
          isSearchActive={isSearchActive}
          searchQuery={searchQuery}
          onDeactivateSearch={() => {
            setIsSearchActive(false);
            setSearchQuery('');
            Keyboard.dismiss();
          }}
          onSearchQueryChange={setSearchQuery}
          onActivateSearch={() => setIsSearchActive(true)}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        />

        <SearchOverlay
          fadeSearchAnim={fadeSearchAnim}
          headerHeight={headerHeight}
          isSearchActive={isSearchActive}
          searchQuery={searchQuery}
          searchResults={searchResults}
          recommendedPlaces={recommendedPlaces}
          onSelectPlace={handleSelectFromSearch}
        />

        <FilterModal
          fadeSearchAnim={fadeSearchAnim}
          isSearchActive={isSearchActive}
          showFilters={showFilters}
          isFilterModalMounted={isFilterModalMounted}
          filterModalAnim={filterModalAnim}
          selectedLevels={selectedLevels}
          selectedAmenities={selectedAmenities}
          selectedCrowdDensities={selectedCrowdDensities}
          selectedTemperatures={selectedTemperatures}
          maxDistance={maxDistance}
          onToggleFilters={() => {
            setShowFilters(!showFilters);
            setSelectedPlace(null);
          }}
          onCloseFilters={() => setShowFilters(false)}
          onToggleLevel={toggleLevel}
          onToggleAmenity={toggleAmenity}
          onToggleCrowdDensity={toggleCrowdDensity}
          onToggleTemperature={toggleTemperature}
          onMaxDistanceChange={setMaxDistance}
        />

        {/* Empty State Overlay Toast */}
        <Animated.View style={[styles.emptyToast, { opacity: fadeAnim }]} pointerEvents="none">
          <Ionicons name="alert-circle" size={24} color="#333" />
          <Text style={styles.emptyToastText}>No spots found in this range. Try increasing the distance.</Text>
        </Animated.View>

        <LocationInfoPanel
          selectedPlace={selectedPlace}
          selectedTravelMode={selectedTravelMode}
          sheetY={sheetY}
          panHandlers={panResponder.panHandlers}
          onCycleSheetState={() => {
            let next = currentSheetState.current + 1;
            if (next > SheetState.EXPANDED) next = SheetState.COLLAPSED;
            animateToState(next);
          }}
          onClose={() => {
            setSelectedPlace(null);
            setRoutePolyline([]);
            setSelectedTravelMode(null);
          }}
          onSelectTravelMode={(mode) => {
            setSelectedTravelMode(mode);
            fetchDirections(selectedPlace, mode);
          }}
          onStartNavigation={() => {
            if (selectedTravelMode && selectedPlace) {
              let mode = 'driving';
              if (selectedTravelMode === 'Walk') mode = 'walking';
              else if (selectedTravelMode === 'Bike') mode = 'bicycling';
              else if (selectedTravelMode === 'Transit') mode = 'transit';

              const url = `https://www.google.com/maps/dir/?api=1&origin=${CURRENT_LOCATION.latitude},${CURRENT_LOCATION.longitude}&destination=${selectedPlace.coord.latitude},${selectedPlace.coord.longitude}&travelmode=${mode}`;
              Linking.openURL(url);
            }
          }}
        />

        {!selectedPlace && !isSearchActive && (
          <PlaceListSheet
            listSheetY={listSheetY}
            panHandlers={panResponderList.panHandlers}
            filteredPlaces={filteredPlaces}
            onCycleSheetState={() => {
              let next = currentListSheetState.current + 1;
              if (next > SheetState.EXPANDED) next = SheetState.COLLAPSED;
              animateListToState(next);
            }}
            onSelectPlace={setSelectedPlace}
          />
        )}

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
  // EMPTY STATE TOAST
  emptyToast: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 20,
    maxWidth: '85%',
  },
  emptyToastText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flexShrink: 1,
    fontFamily: 'Nunito_600SemiBold',
  },

  userLocationDotBorder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(33, 150, 243, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userLocationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2196F3',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  }
});

