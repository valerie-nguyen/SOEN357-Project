import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Animated, Dimensions, PanResponder, Keyboard, Linking } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Haversine formula to calculate distance between two lat/lon coordinates in km
enum SheetState {
  COLLAPSED,
  HALF,
  EXPANDED
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

function CustomStudyMarker({ place, onPress, color }: any) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // Stop tracking after the UI has had enough time to fully un-furl its styles natively
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
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fadeSearchAnim = useRef(new Animated.Value(0)).current;

  // --- SEARCH LOGIC ---
  useEffect(() => {
    Animated.timing(fadeSearchAnim, {
      toValue: isSearchActive ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isSearchActive, fadeSearchAnim]);

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

  const HighlightedText = ({ text, query }: { text: string, query: string }) => {
    if (!query.trim()) return <Text>{text}</Text>;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <Text>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <Text key={i} style={{ color: '#6B9E78', fontWeight: 'bold' }}>{part}</Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  const INITIAL_REGION = {
    latitude: 45.4960,
    longitude: -73.5775,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };

  const CURRENT_LOCATION = {
    latitude: 45.4953,
    longitude: -73.5790, // Near Guy-Concordia
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
  const studyPlaces = [
    { 
      id: '1', 
      title: 'Webster Library', 
      level: 'Quiet', 
      coord: { latitude: 45.4967, longitude: -73.5781 },
      address: '1400 De Maisonneuve Blvd W',
      status: 'Open • 8 am - 10 pm',
      score: 5, // out of 5
      features: [
        { label: 'Study rooms', color: '#FADEE1' },
        { label: 'Wi-Fi', color: '#FFF9C4' },
        { label: 'Outlets', color: '#F0E6FF' },
        { label: '👥 Low', color: '#D4EFFF' }
      ],
      etas: [
        { mode: 'Walk', icon: '🚶', time: '2 mins', dist: '150 m', active: true },
        { mode: 'Bike', icon: '🚲', time: '1 min', dist: '150 m', active: false },
        { mode: 'Transit', icon: '🚌', time: '5 mins', dist: '150 m', active: false },
        { mode: 'Drive', icon: '🚗', time: '2 mins', dist: '150 m', active: false }
      ]
    },
    { id: '2', title: 'Grey Nuns Reading Room', level: 'Quiet', coord: { latitude: 45.4936, longitude: -73.5772 }, address: '1190 Guy St', status: 'Open • 9 am - 9 pm', score: 5, features: [{ label: 'Quiet Zone', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 Low', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '4 mins', dist: '300 m', active: true }] },
    { id: '3', title: 'Kafein Cafe', level: 'Moderate', coord: { latitude: 45.497075257693226, longitude: -73.57711049446944 }, address: '1429 Bishop St', status: 'Open • 7 am - 8 pm', score: 3, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 Moderate', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '3 mins', dist: '250 m', active: true }] },
    { id: '4', title: 'Myriade Cafe', level: 'Moderate', coord: { latitude: 45.49610120959447, longitude: -73.57789764638058 }, address: '1432 Mackay St, Montreal, Quebec H3G 2H7', status: 'Open • 8 am - 6 pm', score: 3, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '5 mins', dist: '400 m', active: true }] },
    { id: '5', title: 'EV Building', level: 'Noisy', coord: { latitude: 45.4954, longitude: -73.5778 }, address: '1515 Saint-Catherine St W', status: 'Open • 24/7', score: 1, features: [{ label: 'Study rooms', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '1 min', dist: '50 m', active: true }] },
    { id: '6', title: 'Hall Building 12th Floor', level: 'Quiet', coord: { latitude: 45.4970, longitude: -73.5788 }, address: '1455 De Maisonneuve Blvd W', status: 'Open • 8 am - 11 pm', score: 4, features: [{ label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 Moderate', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '2 mins', dist: '150 m', active: true }] },
    { id: '7', title: 'Leaves House', level: 'Moderate', coord: { latitude: 45.4990, longitude: -73.5780 }, address: '2051 de la Montagne St', status: 'Open • 9 am - 5 pm', score: 3, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 Low', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '7 mins', dist: '550 m', active: true }] },
    { id: '8', title: 'Crew Collective & Cafe', level: 'Moderate', coord: { latitude: 45.5023, longitude: -73.5595 }, address: '360 St Jacques St', status: 'Open • 8 am - 4 pm', score: 2, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Transit', icon: '🚌', time: '12 mins', dist: '2.5 km', active: true }, { mode: 'Walk', icon: '🚶', time: '30 mins', dist: '2.5 km', active: false }] },
    { id: '9', title: 'Tim Hortons', level: 'Noisy', coord: { latitude: 45.49604280712215, longitude: -73.57969024077563 }, address: '2081 Guy St, Montreal, Quebec H3H 2L9', status: 'Open • 24/7', score: 1, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '2 mins', dist: '150 m', active: true }] },
    { id: '10', title: 'Starbucks (Guy-Concordia)', level: 'Noisy', coord: { latitude: 45.49565650315576, longitude: -73.579611783592 }, address: '1561 Saint-Catherine St W', status: 'Open • 6 am - 8 pm', score: 1, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '1 min', dist: '50 m', active: true }] },
    { id: '11', title: 'BAnQ (Grande Bibliothèque)', level: 'Quiet', coord: { latitude: 45.5154, longitude: -73.5621 }, address: '475 De Maisonneuve Blvd E', status: 'Open • 10 am - 10 pm', score: 5, features: [{ label: 'Quiet Zone', color: '#FADEE1' }, { label: 'Study rooms', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }], etas: [{ mode: 'Transit', icon: '🚌', time: '15 mins', dist: '2.5 km', active: true }] },
    { id: '12', title: 'Westmount Public Library', level: 'Quiet', coord: { latitude: 45.4851, longitude: -73.5960 }, address: '4574 Sherbrooke St W', status: 'Open • 10 am - 9 pm', score: 4, features: [{ label: 'Quiet Zone', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 Low', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '25 mins', dist: '2.0 km', active: true }, { mode: 'Transit', icon: '🚌', time: '10 mins', dist: '2.0 km', active: false }] },
    { id: '13', title: 'Café Myriade (Plateau)', level: 'Moderate', coord: { latitude: 45.5186, longitude: -73.5804 }, address: '4627 Saint-Denis St', status: 'Open • 8 am - 6 pm', score: 3, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Transit', icon: '🚌', time: '20 mins', dist: '3.0 km', active: true }] },
    { id: '14', title: 'Atwater Library', level: 'Quiet', coord: { latitude: 45.4883, longitude: -73.5855 }, address: '1200 Atwater Ave', status: 'Open • 10 am - 6 pm', score: 4, features: [{ label: 'Study rooms', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 Low', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '15 mins', dist: '1.2 km', active: true }] },
    { id: '15', title: 'Café Olimpico (Old Port)', level: 'Moderate', coord: { latitude: 45.5065, longitude: -73.5539 }, address: '419 Saint-Vincent St', status: 'Open • 7 am - 7 pm', score: 2, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 Moderate', color: '#D4EFFF' }], etas: [{ mode: 'Transit', icon: '🚌', time: '18 mins', dist: '2.8 km', active: true }] },
    { id: '16', title: 'Mont-Royal Chalet', level: 'Noisy', coord: { latitude: 45.5035, longitude: -73.5874 }, address: '1196 Camillien-Houde Rd', status: 'Open • 8 am - 8 pm', score: 1, features: [{ label: 'Outdoors', color: '#E1F5FE' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '45 mins', dist: '3.5 km', active: true }, { mode: 'Transit', icon: '🚌', time: '30 mins', dist: '3.5 km', active: false }] },
    { id: '17', title: 'ER Building Floor 9', level: 'Quiet', coord: { latitude: 45.496200460477574, longitude: -73.58012862739068 }, address: '2155 Guy St, Montreal, Quebec H3H 2L9', status: 'Open • 8 am - 11 pm', score: 5, features: [{ label: 'Study rooms', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 Low', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '2 mins', dist: '180 m', active: true }] }
  ];

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

      return inDistance && inLevel && inAmenities;
    });
  }, [maxDistance, selectedLevels, selectedAmenities]);

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
        showsUserLocation={true}
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
        <Marker coordinate={CURRENT_LOCATION} title="Current Location" zIndex={100}>
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
        
        {/* Top Header Bar */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 10 }]} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <Text style={styles.headerTitle}>QuietSpace</Text>
          <View style={styles.searchContainer}>
            {isSearchActive ? (
              <TouchableOpacity onPress={() => { setIsSearchActive(false); setSearchQuery(''); Keyboard.dismiss(); }}>
                <Ionicons name="arrow-back" size={20} color="#6B9E78" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="search" size={20} color="#6B9E78" />
            )}
            <TextInput
              style={styles.searchInput}
              placeholder="Search study places..."
              placeholderTextColor="#999999"
              returnKeyType="search"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchActive(true)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Overlay Container */}
        <Animated.View 
          style={[
            styles.searchOverlay, 
            { 
              opacity: fadeSearchAnim,
              top: headerHeight,
              transform: [
                { translateY: fadeSearchAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
              ],
              pointerEvents: isSearchActive ? 'auto' : 'none'
            }
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.searchScrollContent}>
            {!searchQuery.trim() ? (
              // Recommended Section
              <View style={styles.recommendationSection}>
                <Text style={styles.sectionHeadingText}>Recommended for You 🌟</Text>
                {recommendedPlaces.map(place => (
                  <TouchableOpacity key={`rec-${place.id}`} style={styles.searchResultItem} onPress={() => handleSelectFromSearch(place)}>
                    <View style={styles.searchResultIcon}>
                      <Ionicons name="star" size={16} color="#F0B361" />
                    </View>
                    <View style={styles.searchResultTextContainer}>
                      <Text style={styles.searchResultTitle}>{place.title}</Text>
                      <Text style={styles.searchResultAddress}>{place.address}</Text>
                    </View>
                    <View style={[styles.levelPillMini, { backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.levelPillMiniText, { color: '#2E7D32' }]}>{place.level}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              // Search Results
              <View style={styles.searchResultsSection}>
                {searchResults.length > 0 ? (
                  searchResults.map(place => (
                    <TouchableOpacity key={`search-${place.id}`} style={styles.searchResultItem} onPress={() => handleSelectFromSearch(place)}>
                      <View style={styles.searchResultIcon}>
                        <Ionicons name="location" size={16} color="#6B9E78" />
                      </View>
                      <View style={styles.searchResultTextContainer}>
                        <Text style={styles.searchResultTitle}>
                          <HighlightedText text={place.title} query={searchQuery} />
                        </Text>
                        <Text style={styles.searchResultAddress}>
                          <HighlightedText text={place.address || ''} query={searchQuery} />
                        </Text>
                      </View>
                      <View style={[styles.levelPillMini, { backgroundColor: place.level === 'Quiet' ? '#E8F5E9' : place.level === 'Moderate' ? '#FFF3E0' : '#FFEBEE' }]}>
                        <Text style={[
                          styles.levelPillMiniText, 
                          { color: place.level === 'Quiet' ? '#2E7D32' : place.level === 'Moderate' ? '#E65100' : '#C62828' }
                        ]}>{place.level}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noResultsText}>No QuietSpaces found matching &quot;{searchQuery}&quot;</Text>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>

        {/* Floating Action/Filter Bar & Legend */}
        <Animated.View style={[styles.floatingContainer, { opacity: fadeSearchAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} pointerEvents={isSearchActive ? "none" : "box-none"}>
          
          <View style={styles.actionsLeft} pointerEvents="box-none">
            <TouchableOpacity 
              style={styles.filterButton} 
              activeOpacity={0.8}
              onPress={() => {
                setShowFilters(!showFilters);
                setSelectedPlace(null);
              }}
            >
              <Ionicons name="options" size={16} color="#ffffff" />
              <Text style={styles.filterText}>Filters</Text>
            </TouchableOpacity>

            {/* Filter Modal Overlay */}
            {showFilters && (
              <View style={styles.filterModal}>
                <TouchableOpacity style={styles.closeIcon} onPress={() => setShowFilters(false)}>
                  <Ionicons name="close" size={20} color="#555" />
                </TouchableOpacity>
                
                {/* Section: Quietness Level */}
                <View style={styles.filterSection}>
                  <View style={[styles.filterLabelPill, { backgroundColor: '#E8F5E9' }]}>
                    <Text style={[styles.filterLabelText, { color: '#2E7D32' }]}>Quietness level 🔇</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {['Noisy', 'Moderate', 'Quiet'].map(level => {
                      const isActive = selectedLevels.includes(level);
                      return (
                        <TouchableOpacity 
                          key={level} 
                          style={[styles.chip, isActive && styles.chipActive]}
                          onPress={() => toggleLevel(level)}
                        >
                          <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{level}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Section: Amenities */}
                <View style={styles.filterSection}>
                  <View style={[styles.filterLabelPill, { backgroundColor: '#F3E5F5' }]}>
                    <Text style={[styles.filterLabelText, { color: '#6A1B9A' }]}>Amenities 🛠️</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {['Outlets', 'Wi-Fi', 'Coffee', 'Study rooms'].map(amenity => {
                      const isActive = selectedAmenities.includes(amenity);
                      return (
                        <TouchableOpacity 
                          key={amenity} 
                          style={[styles.chip, isActive && styles.chipActive]}
                          onPress={() => toggleAmenity(amenity)}
                        >
                          <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{amenity}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Section: Max Distance */}
                <View style={styles.filterSection}>
                  <View style={[styles.filterLabelPill, { backgroundColor: '#F0F4C3' }]}>
                    <Text style={[styles.filterLabelText, { color: '#827717' }]}>Max Distance 📏</Text>
                  </View>
                  <Text style={styles.distanceValue}>{maxDistance.toFixed(1)} km</Text>
                  <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={0.1}
                    maximumValue={5}
                    step={0.1}
                    value={maxDistance}
                    onValueChange={(val) => setMaxDistance(val)}
                    minimumTrackTintColor="#6B9E78"
                    maximumTrackTintColor="#E0E0E0"
                    thumbTintColor="#6B9E78"
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabelText}>100m</Text>
                    <Text style={styles.sliderLabelText}>5km</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Legend Card */}
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

        </Animated.View>

        {/* Empty State Overlay Toast */}
        <Animated.View style={[styles.emptyToast, { opacity: fadeAnim }]} pointerEvents="none">
          <Ionicons name="alert-circle" size={24} color="#333" />
          <Text style={styles.emptyToastText}>No spots found in this range. Try increasing the distance.</Text>
        </Animated.View>

        {/* Location Info Panel (Bottom Sheet) */}
        {selectedPlace && (
          <Animated.View 
            style={[
              styles.bottomSheet, 
              { transform: [{ translateY: sheetY }] }
            ]} 
            pointerEvents="box-none"
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetContent}>
              <TouchableOpacity activeOpacity={1} style={styles.dragHandleTouchArea} onPress={() => {
                // Tap to cycle sheet state
                let next = currentSheetState.current + 1;
                if (next > SheetState.EXPANDED) next = SheetState.COLLAPSED;
                animateToState(next);
              }}>
                <View style={styles.dragHandle} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.closeSheetIcon} onPress={() => {
                setSelectedPlace(null);
                setRoutePolyline([]);
                setSelectedTravelMode(null);
              }}>
                <Ionicons name="close" size={22} color="#555" />
              </TouchableOpacity>

              <View style={styles.sheetRow}>
                <View style={styles.sheetHeaderLeft}>
                  <Text style={styles.sheetTitle}>{selectedPlace.title}</Text>
                  <View style={styles.addressRow}>
                    <Ionicons name="location" size={14} color="#A01D21" />
                    <Text style={styles.addressText}>{selectedPlace.address}</Text>
                  </View>
                  <Text style={styles.statusText}>{selectedPlace.status || 'Status unavailable'}</Text>
                </View>

                {/* Level Tag Top Right */}
                <View style={[styles.levelTag, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.levelTagText, { color: '#2E7D32' }]}>
                    {selectedPlace.level === 'Quiet' ? '🔇 Quiet' : selectedPlace.level}
                  </Text>
                </View>
              </View>

              {/* Quietness Level Bar */}
              <Text style={styles.sectionHeading}>Quietness Level</Text>
              <View style={styles.levelBarContainer}>
                {[1, 2, 3, 4, 5].map((segment) => (
                  <View 
                    key={segment} 
                    style={[
                      styles.levelSegment, 
                      { backgroundColor: segment <= (selectedPlace.score || 3) ? '#6B9E78' : '#DCE9E0' }
                    ]} 
                  />
                ))}
              </View>

              {/* Feature Tags */}
              {selectedPlace.features && (
                <View style={styles.featuresContainer}>
                  {selectedPlace.features.map((feat: any, idx: number) => (
                    <View key={idx} style={[styles.featurePill, { backgroundColor: feat.color }]}>
                      <Text style={styles.featureText}>{feat.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* ETA Cards */}
              {selectedPlace.etas && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.etaScroll}>
                  {selectedPlace.etas.map((eta: any, idx: number) => {
                    // Update active state based on selected travel mode
                    const isActive = selectedTravelMode === eta.mode;
                    return (
                      <TouchableOpacity 
                        key={idx} 
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedTravelMode(eta.mode);
                          fetchDirections(selectedPlace, eta.mode);
                        }}
                        style={[styles.etaCard, isActive && styles.etaCardActive]}
                      >
                        <Text style={styles.etaIcon}>{eta.icon}</Text>
                        <Text style={[styles.etaTime, isActive && styles.etaTextActive]}>{eta.time}</Text>
                        <Text style={styles.etaDist}>{eta.dist}</Text>
                        <Text style={styles.etaMode}>{eta.mode}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Primary Action Button */}
              <TouchableOpacity 
                style={[styles.navButton, !selectedTravelMode && styles.navButtonDisabled]} 
                activeOpacity={0.8} 
                disabled={!selectedTravelMode}
                onPress={() => {
                  if (selectedTravelMode && selectedPlace) {
                    let mode = 'driving';
                    if (selectedTravelMode === 'Walk') mode = 'walking';
                    else if (selectedTravelMode === 'Bike') mode = 'bicycling';
                    else if (selectedTravelMode === 'Transit') mode = 'transit';

                    const url = `https://www.google.com/maps/dir/?api=1&origin=${CURRENT_LOCATION.latitude},${CURRENT_LOCATION.longitude}&destination=${selectedPlace.coord.latitude},${selectedPlace.coord.longitude}&travelmode=${mode}`;
                    Linking.openURL(url);
                  }
                }}
              >
                <Ionicons name="navigate-outline" size={20} color={!selectedTravelMode ? "#a0a0a0" : "#ffffff"} />
                <Text style={[styles.navButtonText, !selectedTravelMode && styles.navButtonTextDisabled]}>Start Navigation</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Places List Panel (Bottom Sheet Drawer when no place is selected) */}
        {!selectedPlace && !isSearchActive && (
          <Animated.View 
            style={[
              styles.bottomSheet, 
              { transform: [{ translateY: listSheetY }] }
            ]} 
            pointerEvents="box-none"
          >
            <View style={[styles.sheetContent, { backgroundColor: '#f5f5f5', paddingHorizontal: 0 }]} {...panResponderList.panHandlers}>
              <TouchableOpacity activeOpacity={1} style={styles.dragHandleTouchAreaList} onPress={() => {
                let next = currentListSheetState.current + 1;
                if (next > SheetState.EXPANDED) next = SheetState.COLLAPSED;
                animateListToState(next);
              }}>
                <View style={styles.dragHandle} />
              </TouchableOpacity>

              <ScrollView 
                contentContainerStyle={styles.listSheetContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}
              >
                {filteredPlaces.map(place => (
                  <TouchableOpacity key={`listsheet-${place.id}`} style={styles.listCard} activeOpacity={0.8} onPress={() => setSelectedPlace(place)}>
                    <View style={styles.listCardTopRow}>
                      <Text style={styles.listCardTitle}>{place.title}</Text>
                      {/* Pill style matching screenshot */}
                      <View style={[
                        styles.listLevelPill, 
                        { backgroundColor: place.level === 'Quiet' ? '#C8E6C9' : place.level === 'Moderate' ? '#FFECB3' : '#FFCDD2' }
                      ]}>
                        <Ionicons name={place.level === 'Quiet' ? 'volume-mute' : place.level === 'Moderate' ? 'volume-low' : 'volume-high'} size={12} color={place.level === 'Quiet' ? '#2E7D32' : place.level === 'Moderate' ? '#EF6C00' : '#C62828'} style={{ marginRight: 4 }} />
                        <Text style={[
                          styles.listLevelPillText,
                          { color: place.level === 'Quiet' ? '#2E7D32' : place.level === 'Moderate' ? '#EF6C00' : '#C62828' }
                        ]}>{place.level}</Text>
                      </View>
                    </View>
                    <View style={styles.listCardAddressRow}>
                      <Ionicons name="location" size={14} color="#A01D21" style={{ marginRight: 4 }} />
                      <Text style={styles.listCardAddressText}>{place.address}</Text>
                    </View>
                    <View style={styles.listCardStatusRow}>
                      <Text style={styles.listCardStatusOpen}>
                        {(place.status || 'Open').split(' • ')[0]}
                      </Text>
                      {(place.status || '').includes(' • ') && (
                        <Text style={styles.listCardStatusHours}>
                          {' • ' + place.status.split(' • ')[1]}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Animated.View>
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
  
  // SEARCH OVERLAY STYLES
  searchOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAFAFA',
    zIndex: 9,
  },
  searchScrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  recommendationSection: {
    marginBottom: 20,
  },
  searchResultsSection: {
    marginBottom: 20,
  },
  sectionHeadingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchResultTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  searchResultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  searchResultAddress: {
    fontSize: 12,
    color: '#777',
  },
  levelPillMini: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelPillMiniText: {
    fontSize: 10,
    fontWeight: '700',
  },
  noResultsText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#777',
    fontSize: 14,
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

  // FILTER MODAL STYLES
  filterModal: {
    backgroundColor: '#ffffff',
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  closeIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    padding: 4,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabelPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  filterLabelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#6B9E78',
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  distanceValue: {
    position: 'absolute',
    right: 0,
    top: 6,
    fontSize: 13,
    color: '#333',
    fontWeight: '700',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },

  // LEGEND STYLES
  legendCard: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    alignSelf: 'flex-start',
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 11,
    color: '#555555',
    fontWeight: '600',
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
  },

  // CUSTOM MARKER STYLES
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
  },

  // BOTTOM SHEET STYLES
  bottomSheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 1.5,
    zIndex: 20,
  },
  sheetContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandleTouchArea: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  closeSheetIcon: {
    position: 'absolute',
    top: 16,
    right: 20,
    padding: 4,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingRight: 24, // spacing to avoid overlap with 'x'
  },
  sheetHeaderLeft: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#777',
    marginLeft: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#6B9E78', // matching primary green
    fontWeight: '600',
  },
  levelTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  levelTagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  levelBarContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  levelSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  featurePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  etaScroll: {
    flexDirection: 'row',
    marginBottom: 20,
    maxHeight: 100, // Keep scroll contained
  },
  etaCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 10,
    minWidth: 70,
  },
  etaCardActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#6B9E78',
  },
  etaIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  etaTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  etaTextActive: {
    color: '#2E7D32',
  },
  etaDist: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
  etaMode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    marginTop: 4,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B9E78',
    paddingVertical: 16,
    borderRadius: 16,
  },
  navButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  navButtonTextDisabled: {
    color: '#a0a0a0',
  },
  
  // LIST DRAWER STYLES
  dragHandleTouchAreaList: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  listSheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 150,
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  listCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  listLevelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  listLevelPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listCardAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  listCardAddressText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  listCardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listCardStatusOpen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32', // Green
  },
  listCardStatusHours: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  }
});