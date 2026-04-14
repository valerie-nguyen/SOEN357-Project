import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type FilterModalProps = {
  fadeSearchAnim: Animated.Value;
  isSearchActive: boolean;
  showFilters: boolean;
  isFilterModalMounted: boolean;
  filterModalAnim: Animated.Value;
  selectedLevels: string[];
  selectedAmenities: string[];
  maxDistance: number;
  onToggleFilters: () => void;
  onCloseFilters: () => void;
  onToggleLevel: (level: string) => void;
  onToggleAmenity: (amenity: string) => void;
  onMaxDistanceChange: (value: number) => void;
};

export function FilterModal({
  fadeSearchAnim,
  isSearchActive,
  showFilters,
  isFilterModalMounted,
  filterModalAnim,
  selectedLevels,
  selectedAmenities,
  maxDistance,
  onToggleFilters,
  onCloseFilters,
  onToggleLevel,
  onToggleAmenity,
  onMaxDistanceChange,
}: FilterModalProps) {
  return (
    <Animated.View
      style={[styles.floatingContainer, { opacity: fadeSearchAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
      pointerEvents={isSearchActive ? 'none' : 'box-none'}
    >
      <View style={styles.actionsLeft} pointerEvents="box-none">
        <TouchableOpacity style={styles.filterButton} activeOpacity={0.8} onPress={onToggleFilters}>
          <Ionicons name="options" size={16} color="#ffffff" />
          <Text style={styles.filterText}>Filters</Text>
        </TouchableOpacity>

        {isFilterModalMounted && (
          <Animated.View
            pointerEvents={showFilters ? 'auto' : 'none'}
            style={[
              styles.filterModal,
              {
                opacity: filterModalAnim,
                transform: [
                  {
                    translateY: filterModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: filterModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Section: Quietness Level */}
            <TouchableOpacity style={styles.closeIcon} onPress={onCloseFilters}>
              <Ionicons name="close" size={20} color="#555" />
            </TouchableOpacity>

            {/* Section: Amenities */}
            <View style={styles.filterSection}>
              <View style={[styles.filterLabelPill, { backgroundColor: '#E8F5E9' }]}>
                <View style={styles.filterLabelContent}>
                  <Ionicons name="volume-mute" size={14} color="#2E7D32" />
                  <Text style={[styles.filterLabelText, { color: '#2E7D32' }]}>Quietness level</Text>
                </View>
              </View>
              <View style={styles.chipRow}>
                {['Noisy', 'Moderate', 'Quiet'].map((level) => {
                  const isActive = selectedLevels.includes(level);
                  return (
                    <TouchableOpacity key={level} style={[styles.chip, isActive && styles.chipActive]} onPress={() => onToggleLevel(level)}>
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{level}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section: Max Distance */}
            <View style={styles.filterSection}>
              <View style={[styles.filterLabelPill, { backgroundColor: '#f6e8fe' }]}>
                <View style={styles.filterLabelContent}>
                  <Ionicons name="construct" size={14} color="#6b457f" />
                  <Text style={[styles.filterLabelText, { color: '#6b457f' }]}>Amenities</Text>
                </View>
              </View>
              <View style={styles.chipRow}>
                {['Outlets', 'Wi-Fi', 'Coffee', 'Study rooms'].map((amenity) => {
                  const isActive = selectedAmenities.includes(amenity);
                  return (
                    <TouchableOpacity
                      key={amenity}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => onToggleAmenity(amenity)}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{amenity}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.filterSection}>
              <View style={[styles.filterLabelPill, { backgroundColor: '#F0F4C3' }]}>
                <View style={styles.filterLabelContent}>
                  <Ionicons name="resize" size={14} color="#827717" />
                  <Text style={[styles.filterLabelText, { color: '#827717' }]}>Max Distance</Text>
                </View>
              </View>
              <Text style={styles.distanceValue}>{maxDistance.toFixed(1)} km</Text>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0.1}
                maximumValue={5}
                step={0.1}
                value={maxDistance}
                onValueChange={(val) => onMaxDistanceChange(val)}
                minimumTrackTintColor="#6B9E78"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#6B9E78"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabelText}>100m</Text>
                <Text style={styles.sliderLabelText}>5km</Text>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
      
      {/* Legend Card */}
      <View style={[styles.legendCard, showFilters && styles.legendCardHidden]} pointerEvents="none">
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
  );
}

const styles = StyleSheet.create({
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
    fontFamily: 'Nunito_600SemiBold',
  },
  filterModal: {
    position: 'relative',
    zIndex: 20,
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
  filterLabelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterLabelText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
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
    fontFamily: 'Nunito_500Medium',
  },
  chipTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
  },
  distanceValue: {
    position: 'absolute',
    right: 0,
    top: 6,
    fontSize: 13,
    color: '#333',
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
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
    fontFamily: 'Nunito_600SemiBold',
  },
  legendCard: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  legendCardHidden: {
    opacity: 0.28,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 6,
    fontFamily: 'Nunito_700Bold',
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
    fontFamily: 'Nunito_600SemiBold',
  },
});
