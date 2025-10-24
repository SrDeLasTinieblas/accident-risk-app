import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RiskBadge from './RiskBadge';

const AlertCard = ({ alert, onPress }) => {
  const getRiskIcon = () => {
    switch (alert.riskLevel?.toLowerCase()) {
      case 'alto':
        return 'alert-circle';
      case 'medio':
        return 'warning';
      case 'bajo':
        return 'checkmark-circle';
      default:
        return 'help-circle';
    }
  };

  const getRiskColor = () => {
    switch (alert.riskLevel?.toLowerCase()) {
      case 'alto':
        return '#FF4444';
      case 'medio':
        return '#FFA726';
      case 'bajo':
        return '#66BB6A';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Ionicons 
          name={getRiskIcon()} 
          size={32} 
          color={getRiskColor()} 
        />
        <View style={styles.headerInfo}>
          <RiskBadge riskLevel={alert.riskLevel} />
          <Text style={styles.probability}>
            {(alert.probability * 100).toFixed(1)}% probabilidad
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.detailText}>{alert.date}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.detailText}>{alert.time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.detailText}>
            {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  probability: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  details: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
});

export default AlertCard;