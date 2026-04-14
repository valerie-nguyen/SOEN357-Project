import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type MapHeaderProps = {
  topInset: number;
  isSearchActive: boolean;
  searchQuery: string;
  onDeactivateSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onActivateSearch: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
};

export function MapHeader({
  topInset,
  isSearchActive,
  searchQuery,
  onDeactivateSearch,
  onSearchQueryChange,
  onActivateSearch,
  onLayout,
}: MapHeaderProps) {
  return (
    <View style={[styles.header, { paddingTop: Math.max(topInset, 20) + 10 }]} onLayout={onLayout}>
      <Text style={styles.headerTitle}>QuietSpace</Text>
      <View style={styles.searchContainer}>
        {isSearchActive ? (
          <TouchableOpacity onPress={onDeactivateSearch}>
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
          onChangeText={onSearchQueryChange}
          onFocus={onActivateSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchQueryChange('')}>
            <Ionicons name="close-circle" size={20} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: 'Nunito_800ExtraBold',
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
    fontFamily: 'Nunito_400Regular',
  },
});
