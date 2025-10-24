import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation } from '../services/locationService';
import { getAlerts, saveAlert } from '../utils/storage';
import { sendPredictionRequest, isDemoMode } from '../services/apiService';

const MapScreen = () => {
  const [location, setLocation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [currentRisk, setCurrentRisk] = useState(null);

  useEffect(() => {
    loadLocationAndAlerts();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(() => {
      loadLocationAndAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadLocationAndAlerts = async () => {
    setLoading(true);
    
    // Obtener ubicación actual
    const coords = await getCurrentLocation();
    if (coords) {
      setLocation(coords);
      setLastUpdate(new Date());
      
      // Consultar riesgo de la ubicación actual
      await checkCurrentLocationRisk(coords);
    }

    // Cargar alertas
    const savedAlerts = await getAlerts();
    setAlerts(savedAlerts);
    
    setLoading(false);
  };

const checkCurrentLocationRisk = async (coords) => {
  try {
    console.log('Consultando riesgo para coordenadas:', coords);
    
    const riskData = await sendPredictionRequest(coords.latitude, coords.longitude);
    console.log('Datos de riesgo recibidos:', riskData);
    
    setCurrentRisk(riskData);
    
    // Guardar automáticamente como alerta si no es bajo riesgo
    if (riskData.riskLevel && riskData.riskLevel.toLowerCase() !== 'bajo') {
      await saveAlert({
        ...coords,
        riskLevel: riskData.riskLevel,
        probability: riskData.probability,
        mensaje: riskData.mensaje,
        date: new Date().toLocaleDateString('es-PE'),
        time: new Date().toLocaleTimeString('es-PE'),
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Error al consultar riesgo:', error);
    
    // Establecer un valor por defecto en caso de error
    const fallbackRisk = {
      riskLevel: 'Desconocido',
      mensaje: 'No se pudo determinar el nivel de riesgo',
      probability: 0,
      riesgo: 0,
      latitude: coords.latitude,
      longitude: coords.longitude
    };
    
    setCurrentRisk(fallbackRisk);
    
    // Si estamos en modo demo, podríamos simular una respuesta
    if (isDemoMode()) {
      const demoRisk = {
        riskLevel: 'Medio',
        mensaje: '⚠️ Zona de riesgo moderado (Demo)',
        probability: 0.6,
        riesgo: 0.5,
        latitude: coords.latitude,
        longitude: coords.longitude
      };
      setCurrentRisk(demoRisk);
    }
  }
};

  // En MapScreen.js - función getRiskStats actualizada
  const getRiskStats = () => {
    const riskCount = {
      alto: 0,
      medio: 0,
      bajo: 0,
      desconocido: 0
    };

    alerts.forEach(alert => {
      const riskLevel = alert.riskLevel?.toLowerCase() || 'desconocido';
      
      if (riskLevel.includes('alto')) {
        riskCount.alto++;
      } else if (riskLevel.includes('medio')) {
        riskCount.medio++;
      } else if (riskLevel.includes('bajo')) {
        riskCount.bajo++;
      } else {
        riskCount.desconocido++;
      }
    });

    return riskCount;
  };

  const getRiskColor = (riskLevel) => {
    if (!riskLevel) return '#999';
    const level = riskLevel.toLowerCase();
    if (level === 'alto') return '#FF4444';
    if (level === 'medio') return '#FFA726';
    return '#66BB6A';
  };

  const stats = getRiskStats();
  const lastAlert = alerts[0];

  if (loading && !location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Ubicación actual y riesgo */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="location" size={28} color="#FF6B6B" />
          <Text style={styles.cardTitle}>Ubicación Actual</Text>
        </View>
        {location ? (
          <>
            <View style={styles.coordRow}>
              <Text style={styles.coordLabel}>Latitud:</Text>
              <Text style={styles.coordValue}>{location.latitude.toFixed(6)}</Text>
            </View>
            <View style={styles.coordRow}>
              <Text style={styles.coordLabel}>Longitud:</Text>
              <Text style={styles.coordValue}>{location.longitude.toFixed(6)}</Text>
            </View>
            <View style={styles.coordRow}>
              <Text style={styles.coordLabel}>Precisión:</Text>
              <Text style={styles.coordValue}>{location.accuracy?.toFixed(0)}m</Text>
            </View>
            {lastUpdate && (
              <Text style={styles.updateTime}>
                Última actualización: {lastUpdate.toLocaleTimeString('es-PE')}
              </Text>
            )}
            
            {/* Riesgo actual */}
            {currentRisk ? (
              <View style={styles.currentRiskSection}>
                <View style={[styles.riskBadge, { 
                  backgroundColor: getRiskColor(currentRisk.riskLevel)
                }]}>
                  <Text style={styles.riskText}>
                    RIESGO {currentRisk.riskLevel?.toUpperCase() || 'DESCONOCIDO'}
                  </Text>
                </View>
                <Text style={styles.riskMessage}>
                  {currentRisk.mensaje || 'No se pudo determinar el mensaje de riesgo'}
                </Text>
                <Text style={styles.probability}>
                  Probabilidad: {((currentRisk.probability || 0) * 100).toFixed(1)}%
                </Text>
                {isDemoMode() && (
                  <Text style={styles.demoIndicator}>🎭 Modo Demo</Text>
                )}
              </View>
            ) : (
              <View style={styles.currentRiskSection}>
                <Text style={styles.loadingText}>Calculando riesgo...</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.errorText}>No se pudo obtener la ubicación</Text>
        )}
      </View>

      {/* Última alerta */}
      {lastAlert && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="notifications" size={28} color="#FF6B6B" />
            <Text style={styles.cardTitle}>Última Alerta</Text>
          </View>
          <View style={[styles.riskBadge, { 
            backgroundColor: getRiskColor(lastAlert.riskLevel)
          }]}>
            <Text style={styles.riskText}>
              RIESGO {lastAlert.riskLevel?.toUpperCase() || 'DESCONOCIDO'}
            </Text>
          </View>
          <Text style={styles.probability}>
            Probabilidad: {(lastAlert.probability * 100).toFixed(1)}%
          </Text>
          {lastAlert.mensaje && (
            <Text style={styles.riskMessage}>{lastAlert.mensaje}</Text>
          )}
          <Text style={styles.alertDate}>
            {lastAlert.date} - {lastAlert.time}
          </Text>
          <View style={styles.coordRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.alertCoord}>
              {lastAlert.latitude.toFixed(4)}, {lastAlert.longitude.toFixed(4)}
            </Text>
          </View>
        </View>
      )}

      {/* Estadísticas */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="stats-chart" size={28} color="#FF6B6B" />
          <Text style={styles.cardTitle}>Estadísticas</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#FF4444' }]}>
              <Ionicons name="alert-circle" size={32} color="#FFF" />
            </View>
            <Text style={styles.statNumber}>{stats.alto}</Text>
            <Text style={styles.statLabel}>Riesgo Alto</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#FFA726' }]}>
              <Ionicons name="warning" size={32} color="#FFF" />
            </View>
            <Text style={styles.statNumber}>{stats.medio}</Text>
            <Text style={styles.statLabel}>Riesgo Medio</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#66BB6A' }]}>
              <Ionicons name="checkmark-circle" size={32} color="#FFF" />
            </View>
            <Text style={styles.statNumber}>{stats.bajo}</Text>
            <Text style={styles.statLabel}>Riesgo Bajo</Text>
          </View>
        </View>
        <View style={styles.totalAlerts}>
          <Text style={styles.totalAlertsText}>
            Total de alertas registradas: {alerts.length}
          </Text>
        </View>
      </View>

      {/* Alertas recientes */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="time" size={28} color="#FF6B6B" />
          <Text style={styles.cardTitle}>Alertas Recientes</Text>
        </View>
        {alerts.slice(0, 5).length > 0 ? (
          alerts.slice(0, 5).map((alert, index) => (
            <View key={alert.id} style={styles.recentAlert}>
              <View style={[styles.alertDot, { 
                backgroundColor: getRiskColor(alert.riskLevel)
              }]} />
              <View style={styles.recentAlertInfo}>
                <Text style={styles.recentAlertRisk}>
                  {alert.riskLevel || 'N/A'} - {(alert.probability * 100).toFixed(1)}%
                </Text>
                <Text style={styles.recentAlertTime}>
                  {alert.date} {alert.time}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noAlerts}>No hay alertas recientes</Text>
        )}
      </View>

      {/* Botón refrescar */}
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={loadLocationAndAlerts}
        disabled={loading}
      >
        <Ionicons name="refresh" size={24} color="#FFF" />
        <Text style={styles.refreshButtonText}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  coordLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  coordValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'monospace',
  },
  updateTime: {
    marginTop: 12,
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  currentRiskSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  riskBadge: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  riskText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  riskMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  probability: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  alertCoord: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  totalAlerts: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    alignItems: 'center',
  },
  totalAlertsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  recentAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  alertDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  recentAlertInfo: {
    flex: 1,
  },
  recentAlertRisk: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  recentAlertTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  noAlerts: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B6B',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 20,
  },
});

export default MapScreen;