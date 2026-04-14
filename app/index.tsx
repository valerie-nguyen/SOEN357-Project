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

  const getCrowdDensity = (place: any) => {
    const crowdTag = place.features?.find((f: any) => typeof f.label === 'string' && f.label.includes('👥'))?.label?.toLowerCase();
    if (!crowdTag) return null;
    if (crowdTag.includes('low')) return 'Low';
    if (crowdTag.includes('moderate')) return 'Moderate';
    if (crowdTag.includes('high')) return 'High';
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
    { id: '4', title: 'Myriade Cafe', level: 'Moderate', coord: { latitude: 45.49610120959447, longitude: -73.57789764638058 }, address: '1432 Mackay St', status: 'Open • 8 am - 6 pm', score: 3, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '5 mins', dist: '400 m', active: true }] },
    { id: '5', title: 'EV Building', level: 'Noisy', coord: { latitude: 45.4954, longitude: -73.5778 }, address: '1515 Saint-Catherine St W', status: 'Open • 24/7', score: 1, features: [{ label: 'Study rooms', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '1 min', dist: '50 m', active: true }] },
    { id: '6', title: 'Hall Building 12th Floor', level: 'Quiet', coord: { latitude: 45.4970, longitude: -73.5788 }, address: '1455 De Maisonneuve Blvd W', status: 'Open • 8 am - 11 pm', score: 4, features: [{ label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 Moderate', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '2 mins', dist: '150 m', active: true }] },
    { id: '7', title: 'Leaves House', level: 'Moderate', coord: { latitude: 45.4990, longitude: -73.5780 }, address: '2051 de la Montagne St', status: 'Open • 9 am - 5 pm', score: 3, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 Low', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '7 mins', dist: '550 m', active: true }] },
    { id: '8', title: 'Crew Collective & Cafe', level: 'Moderate', coord: { latitude: 45.5023, longitude: -73.5595 }, address: '360 St Jacques St', status: 'Open • 8 am - 4 pm', score: 2, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Transit', icon: '🚌', time: '12 mins', dist: '2.5 km', active: true }, { mode: 'Walk', icon: '🚶', time: '30 mins', dist: '2.5 km', active: false }] },
    { id: '9', title: 'Tim Hortons', level: 'Noisy', coord: { latitude: 45.49604280712215, longitude: -73.57969024077563 }, address: '2081 Guy St', status: 'Open • 24/7', score: 1, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '2 mins', dist: '150 m', active: true }] },
    { id: '10', title: 'Starbucks (Guy-Concordia)', level: 'Noisy', coord: { latitude: 45.49565650315576, longitude: -73.579611783592 }, address: '1561 Saint-Catherine St W', status: 'Open • 6 am - 8 pm', score: 1, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '1 min', dist: '50 m', active: true }] },
    { id: '11', title: 'BAnQ (Grande Bibliothèque)', level: 'Quiet', coord: { latitude: 45.5154, longitude: -73.5621 }, address: '475 De Maisonneuve Blvd E', status: 'Open • 10 am - 10 pm', score: 5, features: [{ label: 'Quiet Zone', color: '#FADEE1' }, { label: 'Study rooms', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }], etas: [{ mode: 'Transit', icon: '🚌', time: '15 mins', dist: '2.5 km', active: true }] },
    { id: '12', title: 'Westmount Public Library', level: 'Quiet', coord: { latitude: 45.4851, longitude: -73.5960 }, address: '4574 Sherbrooke St W', status: 'Open • 10 am - 9 pm', score: 4, features: [{ label: 'Quiet Zone', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 Low', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '25 mins', dist: '2.0 km', active: true }, { mode: 'Transit', icon: '🚌', time: '10 mins', dist: '2.0 km', active: false }] },
    { id: '13', title: 'Café Myriade (Plateau)', level: 'Moderate', coord: { latitude: 45.5186, longitude: -73.5804 }, address: '4627 Saint-Denis St', status: 'Open • 8 am - 6 pm', score: 3, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Transit', icon: '🚌', time: '20 mins', dist: '3.0 km', active: true }] },
    { id: '14', title: 'Atwater Library', level: 'Quiet', coord: { latitude: 45.4883, longitude: -73.5855 }, address: '1200 Atwater Ave', status: 'Open • 10 am - 6 pm', score: 4, features: [{ label: 'Study rooms', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 Low', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '15 mins', dist: '1.2 km', active: true }] },
    { id: '15', title: 'Café Olimpico (Old Port)', level: 'Moderate', coord: { latitude: 45.5065, longitude: -73.5539 }, address: '419 Saint-Vincent St', status: 'Open • 7 am - 7 pm', score: 2, features: [{ label: 'Coffee', color: '#FFE0B2' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: '👥 Moderate', color: '#D4EFFF' }], etas: [{ mode: 'Transit', icon: '🚌', time: '18 mins', dist: '2.8 km', active: true }] },
    { id: '16', title: 'Mont-Royal Chalet', level: 'Noisy', coord: { latitude: 45.5035, longitude: -73.5874 }, address: '1196 Camillien-Houde Rd', status: 'Open • 8 am - 8 pm', score: 1, features: [{ label: 'Outdoors', color: '#E1F5FE' }, { label: '👥 High', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '45 mins', dist: '3.5 km', active: true }, { mode: 'Transit', icon: '🚌', time: '30 mins', dist: '3.5 km', active: false }] },
    { id: '17', title: 'ER Building Floor 9', level: 'Quiet', coord: { latitude: 45.496200460477574, longitude: -73.58012862739068 }, address: '2155 Guy St', status: 'Open • 8 am - 11 pm', score: 5, features: [{ label: 'Study rooms', color: '#FADEE1' }, { label: 'Wi-Fi', color: '#FFF9C4' }, { label: 'Outlets', color: '#F0E6FF' }, { label: '👥 Low', color: '#D4EFFF' }], etas: [{ mode: 'Walk', icon: '🚶', time: '2 mins', dist: '180 m', active: true }] }
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

      const crowdDensity = getCrowdDensity(place);
      const inCrowdDensity =
        selectedCrowdDensities.length === 0 ||
        (crowdDensity !== null && selectedCrowdDensities.includes(crowdDensity));

      return inDistance && inLevel && inAmenities && inCrowdDensity;
    });
  }, [maxDistance, selectedLevels, selectedAmenities, selectedCrowdDensities]);

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
        <Marker
          key="current-location-marker"
          identifier="current-location-marker"
          coordinate={CURRENT_LOCATION}
          title="Current Location"
          tracksViewChanges={false}
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
          maxDistance={maxDistance}
          onToggleFilters={() => {
            setShowFilters(!showFilters);
            setSelectedPlace(null);
          }}
          onCloseFilters={() => setShowFilters(false)}
          onToggleLevel={toggleLevel}
          onToggleAmenity={toggleAmenity}
          onToggleCrowdDensity={toggleCrowdDensity}
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
