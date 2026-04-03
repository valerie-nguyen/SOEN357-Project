import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

type QuietnessLevel = 'Quiet' | 'Moderate' | 'Noisy' | string;

type QuietnessTagProps = {
  level: QuietnessLevel;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconSize?: number;
};

const getQuietnessTagConfig = (level: QuietnessLevel) => {
  switch (level) {
    case 'Quiet':
      return {
        backgroundColor: '#DCE9E0',
        textColor: '#4A7456',
        iconName: 'volume-mute' as const,
      };
    case 'Moderate':
      return {
        backgroundColor: '#FFE8C4',
        textColor: '#BF7F2D',
        iconName: 'volume-low' as const,
      };
    case 'Noisy':
      return {
        backgroundColor: '#FCD0D0',
        textColor: '#B84F4F',
        iconName: 'volume-high' as const,
      };
    default:
      return {
        backgroundColor: '#DCE9E0',
        textColor: '#4A7456',
        iconName: 'volume-mute' as const,
      };
  }
};

export function QuietnessTag({
  level,
  containerStyle,
  textStyle,
  iconSize = 12,
}: QuietnessTagProps) {
  const config = getQuietnessTagConfig(level);

  return (
    <View style={[styles.base, { backgroundColor: config.backgroundColor }, containerStyle]}>
      <Ionicons
        name={config.iconName}
        size={iconSize}
        color={config.textColor}
        style={styles.icon}
      />
      <Text style={[styles.text, { color: config.textColor }, textStyle]}>{level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '700',
  },
});
