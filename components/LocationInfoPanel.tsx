import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { QuietnessTag } from './QuietnessTag';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type LocationInfoPanelProps = {
  selectedPlace: any;
  selectedTravelMode: string | null;
  sheetY: Animated.Value;
  panHandlers: any;
  onCycleSheetState: () => void;
  onClose: () => void;
  onSelectTravelMode: (mode: string) => void;
  onStartNavigation: () => void;
};

export function LocationInfoPanel({
  selectedPlace,
  selectedTravelMode,
  sheetY,
  panHandlers,
  onCycleSheetState,
  onClose,
  onSelectTravelMode,
  onStartNavigation,
}: LocationInfoPanelProps) {
  if (!selectedPlace) {
    return null;
  }

  return (
    <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetY }] }]} pointerEvents="box-none" {...panHandlers}>
      <View style={styles.sheetContent}>
        <TouchableOpacity activeOpacity={1} style={styles.dragHandleTouchArea} onPress={onCycleSheetState}>
          <View style={styles.dragHandle} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeSheetIcon} onPress={onClose}>
          <Ionicons name="close" size={22} color="#555" />
        </TouchableOpacity>

        <View style={styles.sheetRow}>
          <View style={styles.sheetHeaderLeft}>
            <Text style={styles.sheetTitle}>{selectedPlace.title}</Text>
            <View style={styles.addressRow}>
              <Ionicons name="location" size={14} color="#A01D21" />
              <Text style={styles.addressText}>{selectedPlace.address}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusTextOpen}>{selectedPlace.status.split(' • ')[0]}</Text>
              <Text style={styles.statusTextHours}>{' • ' + selectedPlace.status.split(' • ')[1]}</Text>
            </View>
          </View>

          <QuietnessTag level={selectedPlace.level} containerStyle={styles.levelTag} textStyle={styles.levelTagText} iconSize={14} />
        </View>

        <Text style={styles.sectionHeading}>Quietness Level</Text>
        <View style={styles.levelBarContainer}>
          {[1, 2, 3, 4, 5].map((segment) => (
            <View
              key={segment}
              style={[
                styles.levelSegment,
                {
                  backgroundColor:
                    segment <= (selectedPlace.score || 3)
                      ? selectedPlace.level === 'Quiet'
                        ? '#6B9E78'
                        : selectedPlace.level === 'Moderate'
                          ? '#F0B361'
                          : '#F47C7C'
                      : selectedPlace.level === 'Quiet'
                        ? '#DCE9E0'
                        : selectedPlace.level === 'Moderate'
                          ? '#FFE8C4'
                          : '#FCD0D0',
                },
              ]}
            />
          ))}
        </View>

        {selectedPlace.features && (
          <View style={styles.featuresContainer}>
            {selectedPlace.features.map((feat: any, idx: number) => (
              <View key={idx} style={[styles.featurePill, { backgroundColor: feat.color }]}>
                <Text style={styles.featureText}>{feat.label}</Text>
              </View>
            ))}
          </View>
        )}

        {selectedPlace.etas && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.etaScroll}>
            {selectedPlace.etas.map((eta: any, idx: number) => {
              const isActive = selectedTravelMode === eta.mode;
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  onPress={() => onSelectTravelMode(eta.mode)}
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

        <TouchableOpacity
          style={[styles.navButton, !selectedTravelMode && styles.navButtonDisabled]}
          activeOpacity={0.8}
          disabled={!selectedTravelMode}
          onPress={onStartNavigation}
        >
          <Ionicons name="navigate-outline" size={20} color={!selectedTravelMode ? '#a0a0a0' : '#ffffff'} />
          <Text style={[styles.navButtonText, !selectedTravelMode && styles.navButtonTextDisabled]}>Start Navigation</Text>
        </TouchableOpacity>
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
    paddingRight: 24,
  },
  sheetHeaderLeft: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
    marginBottom: 4,
    fontFamily: 'Nunito_800ExtraBold',
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
    fontFamily: 'Nunito_400Regular',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextOpen: {
    fontSize: 14,
    color: '#6B9E78',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
  },
  statusTextHours: {
    fontSize: 14,
    color: '#777',
    fontWeight: '500',
    fontFamily: 'Nunito_500Medium',
  },
  levelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  levelTagText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    fontFamily: 'Nunito_600SemiBold',
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
    fontFamily: 'Nunito_600SemiBold',
  },
  etaScroll: {
    flexDirection: 'row',
    marginBottom: 20,
    maxHeight: 100,
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
    fontFamily: 'Nunito_700Bold',
  },
  etaTextActive: {
    color: '#2E7D32',
  },
  etaDist: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
    fontFamily: 'Nunito_400Regular',
  },
  etaMode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    marginTop: 4,
    fontFamily: 'Nunito_600SemiBold',
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
    fontFamily: 'Nunito_700Bold',
  },
  navButtonTextDisabled: {
    color: '#a0a0a0',
  },
});
