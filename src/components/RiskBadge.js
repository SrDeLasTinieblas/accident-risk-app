import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const RiskBadge = ({ riskLevel }) => {
  const getBadgeStyle = () => {
    switch (riskLevel?.toLowerCase()) {
      case 'alto':
        return { backgroundColor: '#FF4444', color: '#FFF' };
      case 'medio':
        return { backgroundColor: '#FFA726', color: '#FFF' };
      case 'bajo':
        return { backgroundColor: '#66BB6A', color: '#FFF' };
      default:
        return { backgroundColor: '#9E9E9E', color: '#FFF' };
    }
  };

  const style = getBadgeStyle();

  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: style.color }]}>
        {riskLevel || 'Desconocido'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
});

export default RiskBadge;