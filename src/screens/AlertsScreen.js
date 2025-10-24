import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  RefreshControl,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AlertCard from '../components/AlertCard';
import { getAlerts, clearAlerts } from '../utils/storage';

const AlertsScreen = ({ navigation }) => {
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ alto: 0, medio: 0, bajo: 0 });

  useEffect(() => {
    loadAlerts();
    
    // Recargar alertas cuando la pantalla gana foco
    const unsubscribe = navigation.addListener('focus', () => {
      loadAlerts();
    });

    return unsubscribe;
  }, [navigation]);

  const loadAlerts = async () => {
    const savedAlerts = await getAlerts();
    setAlerts(savedAlerts);
    calculateStats(savedAlerts);
  };

  const calculateStats = (alertsList) => {
    const stats = {
      alto: alertsList.filter(a => a.riskLevel?.toLowerCase() === 'alto').length,
      medio: alertsList.filter(a => a.riskLevel?.toLowerCase() === 'medio').length,
      bajo: alertsList.filter(a => a.riskLevel?.toLowerCase() === 'bajo').length,
    };
    setStats(stats);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const handleClearAlerts = () => {
    Alert.alert(
      'Limpiar Historial',
      '¿Estás seguro de que deseas eliminar todas las alertas?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await clearAlerts();
            await loadAlerts();
          },
        },
      ]
    );
  };

  const handleAlertPress = (alert) => {
    Alert.alert(
      `Alerta de Riesgo ${alert.riskLevel}`,
      `Fecha: ${alert.date}\nHora: ${alert.time}\nProbabilidad: ${(alert.probability * 100).toFixed(1)}%\nUbicación: ${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}`,
      [{ text: 'OK' }]
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={80} color="#CCC" />
      <Text style={styles.emptyText}>No hay alertas registradas</Text>
      <Text style={styles.emptySubtext}>
        Las alertas aparecerán aquí cuando el sistema detecte riesgos
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Estadísticas */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#FF4444' }]}>
            <Ionicons name="alert-circle" size={24} color="#FFF" />
          </View>
          <Text style={styles.statNumber}>{stats.alto}</Text>
          <Text style={styles.statLabel}>Alto</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#FFA726' }]}>
            <Ionicons name="warning" size={24} color="#FFF" />
          </View>
          <Text style={styles.statNumber}>{stats.medio}</Text>
          <Text style={styles.statLabel}>Medio</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#66BB6A' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#FFF" />
          </View>
          <Text style={styles.statNumber}>{stats.bajo}</Text>
          <Text style={styles.statLabel}>Bajo</Text>
        </View>
      </View>

      {/* Botón de limpiar */}
      {alerts.length > 0 && (
        <TouchableOpacity 
          style={styles.clearButton}
          onPress={handleClearAlerts}
        >
          <Ionicons name="trash-outline" size={20} color="#FF4444" />
          <Text style={styles.clearButtonText}>Limpiar historial</Text>
        </TouchableOpacity>
      )}

      {/* Lista de alertas */}
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlertCard 
            alert={item} 
            onPress={() => handleAlertPress(item)}
          />
        )}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B6B']}
          />
        }
        contentContainerStyle={alerts.length === 0 ? styles.emptyList : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statCard: {
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  clearButtonText: {
    marginLeft: 8,
    color: '#FF4444',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyList: {
    flexGrow: 1,
  },
});

export default AlertsScreen;