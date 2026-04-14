import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { QuietnessTag } from './QuietnessTag';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type PlaceListSheetProps = {
  listSheetY: Animated.Value;
  panHandlers: any;
  filteredPlaces: any[];
  onCycleSheetState: () => void;
  onSelectPlace: (place: any) => void;
};

export function PlaceListSheet({ listSheetY, panHandlers, filteredPlaces, onCycleSheetState, onSelectPlace }: PlaceListSheetProps) {
  return (
    <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: listSheetY }] }]} pointerEvents="box-none">
      <View style={styles.sheetContent} {...panHandlers}>
        <TouchableOpacity activeOpacity={1} style={styles.dragHandleTouchAreaList} onPress={onCycleSheetState}>
          <View style={styles.dragHandle} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.listSheetContent} showsVerticalScrollIndicator={false} scrollEnabled={true}>
          {filteredPlaces.map((place) => (
            <TouchableOpacity key={`listsheet-${place.id}`} style={styles.listCard} activeOpacity={0.8} onPress={() => onSelectPlace(place)}>
              <View style={styles.listCardTopRow}>
                <Text style={styles.listCardTitle}>{place.title}</Text>
                <QuietnessTag level={place.level} containerStyle={styles.listLevelPill} textStyle={styles.listLevelPillText} />
              </View>
              <View style={styles.listCardAddressRow}>
                <Ionicons name="location" size={14} color="#A01D21" style={{ marginRight: 4 }} />
                <Text style={styles.listCardAddressText}>{place.address}</Text>
              </View>
              <View style={styles.listCardStatusRow}>
                <Text style={styles.listCardStatusOpen}>{(place.status || 'Open').split(' • ')[0]}</Text>
                {(place.status || '').includes(' • ') && (
                  <Text style={styles.listCardStatusHours}>{' • ' + place.status.split(' • ')[1]}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 8,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandleTouchAreaList: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
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
    fontFamily: 'Nunito_700Bold',
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
    fontFamily: 'Nunito_600SemiBold',
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
    fontFamily: 'Nunito_500Medium',
  },
  listCardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listCardStatusOpen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    fontFamily: 'Nunito_700Bold',
  },
  listCardStatusHours: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    fontFamily: 'Nunito_500Medium',
  },
});
