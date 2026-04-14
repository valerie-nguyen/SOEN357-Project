import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { QuietnessTag } from './QuietnessTag';

type SearchOverlayProps = {
  fadeSearchAnim: Animated.Value;
  headerHeight: number;
  isSearchActive: boolean;
  searchQuery: string;
  searchResults: any[];
  recommendedPlaces: any[];
  onSelectPlace: (place: any) => void;
};

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <Text>{text}</Text>;
  }

  const parts = text.split(new RegExp(`(${query})`, 'gi'));

  return (
    <Text>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={styles.highlightedText}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

export function SearchOverlay({
  fadeSearchAnim,
  headerHeight,
  isSearchActive,
  searchQuery,
  searchResults,
  recommendedPlaces,
  onSelectPlace,
}: SearchOverlayProps) {
  return (
    <Animated.View
      style={[
        styles.searchOverlay,
        {
          opacity: fadeSearchAnim,
          top: headerHeight,
          transform: [{ translateY: fadeSearchAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          pointerEvents: isSearchActive ? 'auto' : 'none',
        },
      ]}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.searchScrollContent}>
        {!searchQuery.trim() ? (
            // Recommended Section
          <View style={styles.recommendationSection}>
            <Text style={styles.sectionHeadingText}>Recommended for You 🌟</Text>
            {recommendedPlaces.map((place) => (
              <TouchableOpacity key={`rec-${place.id}`} style={styles.searchResultItem} onPress={() => onSelectPlace(place)}>
                <View style={styles.searchResultIcon}>
                  <Ionicons name="star" size={16} color="#F0B361" />
                </View>
                <View style={styles.searchResultTextContainer}>
                  <Text style={styles.searchResultTitle}>{place.title}</Text>
                  <Text style={styles.searchResultAddress}>{place.address}</Text>
                </View>
                <QuietnessTag level={place.level} containerStyle={styles.levelPillMini} textStyle={styles.levelPillMiniText} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
            // Search Results
          <View style={styles.searchResultsSection}>
            {searchResults.length > 0 ? (
              searchResults.map((place) => (
                <TouchableOpacity key={`search-${place.id}`} style={styles.searchResultItem} onPress={() => onSelectPlace(place)}>
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
                  <QuietnessTag level={place.level} containerStyle={styles.levelPillMini} textStyle={styles.levelPillMiniText} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noResultsText}>No QuietSpaces found matching &quot;{searchQuery}&quot;</Text>
            )}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  highlightedText: {
    color: '#6B9E78',
    fontWeight: 'bold',
  },
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
    fontFamily: 'Nunito_700Bold',
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
    fontFamily: 'Nunito_700Bold',
  },
  searchResultAddress: {
    fontSize: 12,
    color: '#777',
    fontFamily: 'Nunito_400Regular',
  },
  levelPillMini: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelPillMiniText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  noResultsText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#777',
    fontSize: 14,
    fontFamily: 'Nunito_500Medium',
  },
});
