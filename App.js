import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Circle, Polygon } from 'react-native-maps';

const Tab = createBottomTabNavigator();

// 🧪 MODO DE PRUEBA
const DEMO_MODE = true;
const DEMO_COORDINATES = {
  latitude: -16.3974773,
  longitude: -71.501184,
};

// 🔴 URL de tu API para obtener zonas de riesgo
const API_BASE_URL = 'https://accident-risk-model.onrender.com';

// Configuración de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ==================== SERVICIOS ====================

const LocationService = {
  locationSubscription: null,
  
  async startTracking(interval, onUpdate) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación');
      return;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    onUpdate(location);

    this.locationSubscription = setInterval(async () => {
      const newLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      onUpdate(newLocation);
    }, interval * 60 * 1000);
  },

  stopTracking() {
    if (this.locationSubscription) {
      clearInterval(this.locationSubscription);
      this.locationSubscription = null;
    }
  },
};

const APIService = {
  async predictRisk(latitude, longitude, edad, hora, mes) {
    try {
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          edad: edad,
          hora: hora,
          mes: mes,
          xx: latitude,
          yy: longitude,
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error al predecir riesgo:', error);
      throw error;
    }
  },

  async getRiskZones(minRisk = 0.7) {
    try {
      const response = await fetch(`${API_BASE_URL}/risk-zones?min_risk=${minRisk}`);
      
      if (!response.ok) {
        // Si el endpoint no existe, retornar zonas demo
        console.warn('Endpoint /risk-zones no disponible, usando datos demo');
        return this.getDemoRiskZones();
      }

      const data = await response.json();
      return data.zones || [];
    } catch (error) {
      console.error('Error al obtener zonas de riesgo:', error);
      // Retornar zonas demo si falla
      return this.getDemoRiskZones();
    }
  },

  getDemoRiskZones() {
    // Zonas de riesgo de demostración alrededor de las coordenadas
    return [
      {
        latitude: -16.3974773,
        longitude: -71.501184,
        risk_score: 0.95,
        radius: 150,
        accident_count: 12
      },
      {
        latitude: -16.3980,
        longitude: -71.5020,
        risk_score: 0.85,
        radius: 120,
        accident_count: 8
      },
      {
        latitude: -16.3965,
        longitude: -71.5005,
        risk_score: 0.78,
        radius: 100,
        accident_count: 5
      },
      {
        latitude: -16.3990,
        longitude: -71.5000,
        risk_score: 0.72,
        radius: 80,
        accident_count: 4
      }
    ];
  },

  // Calcular distancia entre dos puntos (Haversine)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  },

  checkNearbyRiskZones(latitude, longitude, riskZones, alertDistance = 200) {
    const nearbyZones = [];
    
    for (const zone of riskZones) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        zone.latitude,
        zone.longitude
      );
      
      if (distance <= alertDistance) {
        nearbyZones.push({
          ...zone,
          distance: Math.round(distance)
        });
      }
    }
    
    return nearbyZones.sort((a, b) => b.risk_score - a.risk_score);
  }
};

const StorageService = {
  async saveAlert(alert) {
    try {
      const alerts = await this.getAlerts();
      alerts.unshift(alert);
      await AsyncStorage.setItem('alerts', JSON.stringify(alerts.slice(0, 50)));
    } catch (error) {
      console.error('Error al guardar alerta:', error);
    }
  },

  async getAlerts() {
    try {
      const alerts = await AsyncStorage.getItem('alerts');
      return alerts ? JSON.parse(alerts) : [];
    } catch (error) {
      console.error('Error al obtener alertas:', error);
      return [];
    }
  },

  async clearAlerts() {
    try {
      await AsyncStorage.setItem('alerts', JSON.stringify([]));
    } catch (error) {
      console.error('Error al limpiar alertas:', error);
    }
  },

  async saveSettings(settings) {
    try {
      await AsyncStorage.setItem('settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error al guardar configuración:', error);
    }
  },

  async getSettings() {
    try {
      const settings = await AsyncStorage.getItem('settings');
      return settings ? JSON.parse(settings) : {
        interval: 5,
        notificationsEnabled: true,
        edad: 30,
        alertDistance: 200, // metros
      };
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      return {
        interval: 5,
        notificationsEnabled: true,
        edad: 30,
        alertDistance: 200,
      };
    }
  },

  async saveRiskZones(zones) {
    try {
      await AsyncStorage.setItem('riskZones', JSON.stringify(zones));
    } catch (error) {
      console.error('Error al guardar zonas de riesgo:', error);
    }
  },

  async getRiskZones() {
    try {
      const zones = await AsyncStorage.getItem('riskZones');
      return zones ? JSON.parse(zones) : null;
    } catch (error) {
      console.error('Error al obtener zonas de riesgo:', error);
      return null;
    }
  }
};

// ==================== COMPONENTE DE MAPA ====================

function CustomMapView({ location, riskZones, onZoneAlert }) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [nearbyZone, setNearbyZone] = useState(null);

  const latitude = location?.coords?.latitude;
  const longitude = location?.coords?.longitude;

  useEffect(() => {
    if (latitude && longitude) {
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }

      // Verificar si está cerca de alguna zona de riesgo
      if (riskZones && riskZones.length > 0) {
        const nearby = APIService.checkNearbyRiskZones(latitude, longitude, riskZones, 200);
        if (nearby.length > 0) {
          setNearbyZone(nearby[0]);
          if (onZoneAlert) {
            onZoneAlert(nearby[0]);
          }
        } else {
          setNearbyZone(null);
        }
      }
    }
  }, [latitude, longitude, riskZones]);

  if (!latitude || !longitude || !region) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Cargando mapa...</Text>
      </View>
    );
  }

  const getRiskColor = (riskScore) => {
    if (riskScore >= 0.8) return '#F44336'; // Alto
    if (riskScore >= 0.6) return '#FF9800'; // Medio
    return '#FFC107'; // Bajo-Medio
  };

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation={!DEMO_MODE}
        showsMyLocationButton={!DEMO_MODE}
        showsCompass={true}
        showsScale={true}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        {/* Zonas de riesgo históricas */}
        {riskZones && riskZones.map((zone, index) => (
          <React.Fragment key={`zone-${index}`}>
            <Circle
              center={{ latitude: zone.latitude, longitude: zone.longitude }}
              radius={zone.radius || 100}
              fillColor={getRiskColor(zone.risk_score) + '40'}
              strokeColor={getRiskColor(zone.risk_score)}
              strokeWidth={2}
            />
            <Marker
              coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.riskMarker, { backgroundColor: getRiskColor(zone.risk_score) }]}>
                <Ionicons name="warning" size={16} color="#FFF" />
                <Text style={styles.riskMarkerText}>
                  {(zone.risk_score * 100).toFixed(0)}%
                </Text>
              </View>
            </Marker>
          </React.Fragment>
        ))}

        {/* Marcador de ubicación actual */}
        <Marker
          coordinate={{ latitude, longitude }}
          title="Tu ubicación"
          description={nearbyZone ? `⚠️ Zona de riesgo a ${nearbyZone.distance}m` : 'Zona segura'}
        >
          <View style={[styles.customMarker, { 
            backgroundColor: nearbyZone ? '#F44336' : '#4CAF50' 
          }]}>
            <Ionicons name="person" size={24} color="#FFF" />
          </View>
        </Marker>

        {/* Círculo de proximidad alrededor del usuario */}
        <Circle
          center={{ latitude, longitude }}
          radius={200}
          fillColor="rgba(33, 150, 243, 0.1)"
          strokeColor="#2196F3"
          strokeWidth={1}
          lineDashPattern={[5, 5]}
        />
      </MapView>

      {/* Banner de proximidad */}
      {nearbyZone && (
        <View style={styles.proximityBanner}>
          <Ionicons name="warning" size={20} color="#FFF" />
          <View style={styles.proximityInfo}>
            <Text style={styles.proximityTitle}>
              ⚠️ Zona de Riesgo Cercana
            </Text>
            <Text style={styles.proximityText}>
              A {nearbyZone.distance}m - Riesgo: {(nearbyZone.risk_score * 100).toFixed(0)}%
            </Text>
            {nearbyZone.accident_count && (
              <Text style={styles.proximitySubtext}>
                {nearbyZone.accident_count} accidentes históricos
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Leyenda del mapa */}
      <View style={styles.mapLegend}>
        <Text style={styles.legendTitle}>Zonas de Riesgo</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
          <Text style={styles.legendText}>Alto (&gt;80%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
          <Text style={styles.legendText}>Medio (60-80%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFC107' }]} />
          <Text style={styles.legendText}>Bajo (&lt;60%)</Text>
        </View>
      </View>
    </View>
  );
}

// ==================== PANTALLA DE MAPA ====================

function MapScreen() {
  const [location, setLocation] = useState(null);
  const [riskZones, setRiskZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingZones, setLoadingZones] = useState(true);
  const [settings, setSettings] = useState({ 
    interval: 5, 
    edad: 30, 
    notificationsEnabled: true,
    alertDistance: 200 
  });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [stats, setStats] = useState({
    totalZones: 0,
    nearbyZones: 0,
    highRiskZones: 0
  });

  useEffect(() => {
    loadSettings();
    loadRiskZones();
    initializeLocation();

    return () => {
      LocationService.stopTracking();
    };
  }, []);

  const loadSettings = async () => {
    const savedSettings = await StorageService.getSettings();
    setSettings(savedSettings);
  };

  const loadRiskZones = async () => {
    try {
      setLoadingZones(true);
      
      // Intentar cargar desde caché primero
      const cachedZones = await StorageService.getRiskZones();
      
      if (cachedZones && cachedZones.length > 0) {
        setRiskZones(cachedZones);
        updateStats(cachedZones);
      }

      // Cargar zonas actualizadas de la API
      const zones = await APIService.getRiskZones(0.7);
      setRiskZones(zones);
      updateStats(zones);
      
      // Guardar en caché
      await StorageService.saveRiskZones(zones);
      
    } catch (error) {
      console.error('Error al cargar zonas de riesgo:', error);
      Alert.alert('Info', 'Usando zonas de riesgo en caché');
    } finally {
      setLoadingZones(false);
    }
  };

  const updateStats = (zones) => {
    const highRisk = zones.filter(z => z.risk_score >= 0.8).length;
    setStats({
      totalZones: zones.length,
      nearbyZones: 0,
      highRiskZones: highRisk
    });
  };

  const initializeLocation = async () => {
    try {
      if (DEMO_MODE) {
        const demoLocation = {
          coords: {
            latitude: DEMO_COORDINATES.latitude,
            longitude: DEMO_COORDINATES.longitude,
            altitude: 0,
            accuracy: 10,
            altitudeAccuracy: 10,
            heading: 0,
            speed: 0,
          },
          timestamp: Date.now(),
        };
        
        handleLocationUpdate(demoLocation);
        
        const intervalId = setInterval(() => {
          const randomLat = DEMO_COORDINATES.latitude + (Math.random() - 0.5) * 0.002;
          const randomLon = DEMO_COORDINATES.longitude + (Math.random() - 0.5) * 0.002;
          
          handleLocationUpdate({
            coords: {
              latitude: randomLat,
              longitude: randomLon,
              altitude: 0,
              accuracy: 10,
              altitudeAccuracy: 10,
              heading: 0,
              speed: 0,
            },
            timestamp: Date.now(),
          });
        }, settings.interval * 60 * 1000);
        
        LocationService.locationSubscription = intervalId;
      } else {
        LocationService.startTracking(settings.interval, handleLocationUpdate);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo iniciar el seguimiento de ubicación');
      setLoading(false);
    }
  };

  const handleLocationUpdate = async (newLocation) => {
    setLocation(newLocation);
    setLoading(false);
    setLastUpdate(new Date());
  };

  const handleZoneAlert = async (zone) => {
    if (!settings.notificationsEnabled) return;

    // Evitar múltiples alertas de la misma zona
    const lastAlert = await AsyncStorage.getItem('lastZoneAlert');
    const now = Date.now();
    
    if (lastAlert) {
      const { zoneId, timestamp } = JSON.parse(lastAlert);
      // Si es la misma zona y han pasado menos de 5 minutos, no alertar
      if (zoneId === `${zone.latitude}-${zone.longitude}` && (now - timestamp) < 300000) {
        return;
      }
    }

    // Guardar alerta
    await AsyncStorage.setItem('lastZoneAlert', JSON.stringify({
      zoneId: `${zone.latitude}-${zone.longitude}`,
      timestamp: now
    }));

    // Enviar notificación
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Advertencia: Zona de Riesgo',
        body: `Estás a ${zone.distance}m de una zona con ${(zone.risk_score * 100).toFixed(0)}% de riesgo de accidentes. ${zone.accident_count ? `${zone.accident_count} accidentes históricos.` : ''} ¡Conduce con precaución!`,
        sound: true,
        data: { zone },
      },
      trigger: null,
    });

    // Guardar en historial
    const alert = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      latitude: zone.latitude,
      longitude: zone.longitude,
      riskLevel: zone.risk_score >= 0.8 ? 'Alto' : 'Medio',
      probability: zone.risk_score,
      mensaje: `Zona de riesgo detectada a ${zone.distance}m`,
      accident_count: zone.accident_count
    };

    await StorageService.saveAlert(alert);
  };

  const refreshAll = () => {
    setLoading(true);
    LocationService.stopTracking();
    loadRiskZones();
    initializeLocation();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="location" size={60} color="#FF6B6B" />
        <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
        {loadingZones && (
          <Text style={styles.loadingSubtext}>Cargando zonas de riesgo...</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomMapView 
        location={location} 
        riskZones={riskZones}
        onZoneAlert={handleZoneAlert}
      />

      {DEMO_MODE && (
        <View style={styles.demoBanner}>
          <Ionicons name="flask" size={16} color="#FFF" />
          <Text style={styles.demoText}>MODO DE PRUEBA</Text>
        </View>
      )}

      <View style={styles.infoPanel}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="map-outline" size={20} color="#FF6B6B" />
            <Text style={styles.statNumber}>{stats.totalZones}</Text>
            <Text style={styles.statLabel}>Zonas</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="warning-outline" size={20} color="#F44336" />
            <Text style={styles.statNumber}>{stats.highRiskZones}</Text>
            <Text style={styles.statLabel}>Alto Riesgo</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color="#4CAF50" />
            <Text style={styles.statNumber}>
              {lastUpdate ? lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </Text>
            <Text style={styles.statLabel}>Última Act.</Text>
          </View>
        </View>

        {location && (
          <View style={styles.coordsContainer}>
            <Text style={styles.coordsText}>
              📍 {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.refreshButton} onPress={refreshAll}>
          <Ionicons name="refresh" size={20} color="#FFF" />
          <Text style={styles.refreshButtonText}>Actualizar Todo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==================== PANTALLA DE ALERTAS ====================

function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    setRefreshing(true);
    const savedAlerts = await StorageService.getAlerts();
    setAlerts(savedAlerts);
    setRefreshing(false);
  };

  const clearAllAlerts = () => {
    Alert.alert(
      'Confirmar',
      '¿Deseas eliminar todo el historial de alertas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await StorageService.clearAlerts();
            setAlerts([]);
          },
        },
      ]
    );
  };

  const getRiskIcon = (level) => {
    switch (level) {
      case 'Alto': return 'warning';
      case 'Medio': return 'alert-circle';
      default: return 'checkmark-circle';
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'Alto': return '#F44336';
      case 'Medio': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.alertsHeader}>
        <View>
          <Text style={styles.alertsTitle}>Historial de Alertas</Text>
          <Text style={styles.alertsSubtitle}>{alerts.length} registros</Text>
        </View>
        {alerts.length > 0 && (
          <TouchableOpacity onPress={clearAllAlerts} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={20} color="#F44336" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.alertsList}>
        {alerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>No hay alertas registradas</Text>
            <Text style={styles.emptySubtext}>
              Las alertas aparecerán aquí cuando te acerques a zonas de riesgo
            </Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View style={[styles.alertIconContainer, { backgroundColor: getRiskColor(alert.riskLevel) }]}>
                  <Ionicons name={getRiskIcon(alert.riskLevel)} size={24} color="#FFF" />
                </View>
                <View style={styles.alertInfo}>
                  <Text style={[styles.alertRisk, { color: getRiskColor(alert.riskLevel) }]}>
                    Riesgo {alert.riskLevel}
                  </Text>
                  <Text style={styles.alertDate}>
                    {new Date(alert.timestamp).toLocaleString('es-ES')}
                  </Text>
                </View>
              </View>

              <Text style={styles.alertMessage}>{alert.mensaje}</Text>

              <View style={styles.alertDetails}>
                <View style={styles.alertDetailItem}>
                  <Ionicons name="location-outline" size={16} color="#666" />
                  <Text style={styles.alertDetailText}>
                    {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.alertDetailItem}>
                  <Ionicons name="speedometer-outline" size={16} color="#666" />
                  <Text style={styles.alertDetailText}>
                    {(alert.probability * 100).toFixed(0)}%
                  </Text>
                </View>
                {alert.accident_count && (
                  <View style={styles.alertDetailItem}>
                    <Ionicons name="car-outline" size={16} color="#666" />
                    <Text style={styles.alertDetailText}>
                      {alert.accident_count} accidentes
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================== PANTALLA DE CONFIGURACIÓN ====================

function SettingsScreen() {
  const [settings, setSettings] = useState({
    interval: 5,
    notificationsEnabled: true,
    edad: 30,
    alertDistance: 200,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [distanceModalVisible, setDistanceModalVisible] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedSettings = await StorageService.getSettings();
    setSettings(savedSettings);
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await StorageService.saveSettings(newSettings);

    if (key === 'interval') {
      Alert.alert('Actualizado', 'El nuevo intervalo se aplicará en el próximo ciclo.');
    }
  };

  const testNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Advertencia: Zona de Riesgo',
        body: 'Esta es una notificación de prueba. Zona de alto riesgo detectada a 150m.',
        sound: true,
      },
      trigger: null,
    });
  };

  const intervals = [1, 3, 5, 10, 15];
  const distances = [100, 150, 200, 300, 500];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.settingsContainer}>
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>👤 Datos del Usuario</Text>
          
          <View style={styles.settingItem}>
            <View>
              <Text style={styles.settingLabel}>Edad</Text>
              <Text style={styles.settingDescription}>
                Se usa para calcular el riesgo
              </Text>
            </View>
            <TextInput
              style={styles.ageInput}
              value={settings.edad.toString()}
              onChangeText={(text) => {
                const edad = parseInt(text) || 0;
                if (edad >= 0 && edad <= 120) {
                  updateSetting('edad', edad);
                }
              }}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>⏱️ Frecuencia de Actualización</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setModalVisible(true)}
          >
            <View>
              <Text style={styles.settingLabel}>Intervalo de actualización</Text>
              <Text style={styles.settingDescription}>
                Cada cuánto se actualiza tu ubicación
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>{settings.interval} min</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>📍 Distancia de Alerta</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setDistanceModalVisible(true)}
          >
            <View>
              <Text style={styles.settingLabel}>Distancia de proximidad</Text>
              <Text style={styles.settingDescription}>
                A qué distancia alertar sobre zonas de riesgo
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>{settings.alertDistance}m</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>🔔 Notificaciones</Text>
          
          <View style={styles.settingItem}>
            <View>
              <Text style={styles.settingLabel}>Alertas de proximidad</Text>
              <Text style={styles.settingDescription}>
                Recibir notificaciones al acercarte a zonas de riesgo
              </Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(value) => updateSetting('notificationsEnabled', value)}
              trackColor={{ false: '#CCC', true: '#FF6B6B' }}
              thumbColor={settings.notificationsEnabled ? '#FFF' : '#F4F3F4'}
            />
          </View>

          <TouchableOpacity
            style={styles.testButton}
            onPress={testNotification}
          >
            <Ionicons name="notifications-outline" size={20} color="#FF6B6B" />
            <Text style={styles.testButtonText}>Probar Notificación</Text>
          </TouchableOpacity>
        </View>

        {DEMO_MODE && (
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>🧪 Modo de Prueba</Text>
            
            <View style={styles.demoInfoCard}>
              <View style={styles.demoInfoHeader}>
                <Ionicons name="flask" size={24} color="#FF6B6B" />
                <Text style={styles.demoInfoTitle}>MODO DEMO ACTIVADO</Text>
              </View>
              <Text style={styles.demoInfoText}>
                La app está usando coordenadas de demostración con zonas de riesgo simuladas basadas en datos históricos.
              </Text>
              <View style={styles.demoCoordsBox}>
                <Text style={styles.demoCoordsLabel}>Coordenadas de prueba:</Text>
                <Text style={styles.demoCoordsValue}>
                  📍 {DEMO_COORDINATES.latitude}, {DEMO_COORDINATES.longitude}
                </Text>
              </View>
              <Text style={styles.demoInfoNote}>
                💡 Para usar tu ubicación real, cambia DEMO_MODE = false en el código
              </Text>
            </View>
          </View>
        )}

        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={24} color="#666" />
          <Text style={styles.infoText}>
            La aplicación usa zonas de riesgo basadas en accidentes históricos. Te alertará cuando te acerques a {settings.alertDistance}m de una zona peligrosa.
          </Text>
        </View>

        <View style={styles.versionSection}>
          <Text style={styles.versionText}>Versión 2.0.0</Text>
          <Text style={styles.versionSubtext}>
            Mapa de calor con zonas de riesgo histórico
          </Text>
        </View>
      </ScrollView>

      {/* Modal de intervalo */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar Intervalo</Text>
            
            {intervals.map((interval) => (
              <TouchableOpacity
                key={interval}
                style={[
                  styles.intervalOption,
                  settings.interval === interval && styles.intervalOptionSelected,
                ]}
                onPress={() => {
                  updateSetting('interval', interval);
                  setModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.intervalText,
                    settings.interval === interval && styles.intervalTextSelected,
                  ]}
                >
                  Cada {interval} minuto{interval > 1 ? 's' : ''}
                </Text>
                {settings.interval === interval && (
                  <Ionicons name="checkmark-circle" size={24} color="#FF6B6B" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de distancia */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={distanceModalVisible}
        onRequestClose={() => setDistanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Distancia de Alerta</Text>
            
            {distances.map((distance) => (
              <TouchableOpacity
                key={distance}
                style={[
                  styles.intervalOption,
                  settings.alertDistance === distance && styles.intervalOptionSelected,
                ]}
                onPress={() => {
                  updateSetting('alertDistance', distance);
                  setDistanceModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.intervalText,
                    settings.alertDistance === distance && styles.intervalTextSelected,
                  ]}
                >
                  {distance} metros
                </Text>
                {settings.alertDistance === distance && (
                  <Ionicons name="checkmark-circle" size={24} color="#FF6B6B" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setDistanceModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==================== APP PRINCIPAL ====================

export default function App() {
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permisos de notificación',
        'Se recomienda activar las notificaciones para recibir alertas de zonas de riesgo'
      );
    }
  };

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B6B" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Mapa') {
              iconName = focused ? 'map' : 'map-outline';
            } else if (route.name === 'Alertas') {
              iconName = focused ? 'notifications' : 'notifications-outline';
            } else if (route.name === 'Configuración') {
              iconName = focused ? 'settings' : 'settings-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#FF6B6B',
          tabBarInactiveTintColor: '#999',
          headerStyle: {
            backgroundColor: '#FF6B6B',
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: '#FFF',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 18,
          },
          tabBarStyle: {
            backgroundColor: '#FFF',
            borderTopWidth: 1,
            borderTopColor: '#EEE',
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        })}
      >
        <Tab.Screen 
          name="Mapa" 
          component={MapScreen}
          options={{ headerTitle: '🗺️ Mapa de Riesgo' }}
        />
        <Tab.Screen 
          name="Alertas" 
          component={AlertsScreen}
          options={{ headerTitle: '🔔 Historial' }}
        />
        <Tab.Screen 
          name="Configuración" 
          component={SettingsScreen}
          options={{ headerTitle: '⚙️ Configuración' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ==================== ESTILOS ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#999',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  riskMarker: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  riskMarkerText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 11,
    marginLeft: 4,
  },
  demoBanner: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: [{ translateX: -75 }],
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  demoText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 5,
  },
  proximityBanner: {
    position: 'absolute',
    top: 60,
    left: 15,
    right: 15,
    backgroundColor: '#F44336',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 999,
  },
  proximityInfo: {
    flex: 1,
    marginLeft: 10,
  },
  proximityTitle: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  proximityText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 2,
  },
  proximitySubtext: {
    color: '#FFE0E0',
    fontSize: 11,
    marginTop: 2,
  },
  mapLegend: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  coordsContainer: {
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  coordsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 15,
  },
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
  },
  alertsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  alertsSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
  },
  alertsList: {
    flex: 1,
    padding: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#CCC',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  alertCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  alertInfo: {
    flex: 1,
  },
  alertRisk: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  alertDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  alertMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20,
  },
  alertDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    flexWrap: 'wrap',
  },
  alertDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginTop: 5,
  },
  alertDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  settingsContainer: {
    flex: 1,
    padding: 15,
  },
  settingsSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    maxWidth: '80%',
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    fontSize: 15,
    color: '#666',
    marginRight: 5,
    fontWeight: '600',
  },
  ageInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 15,
    minWidth: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontWeight: '600',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE8E8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
  },
  testButtonText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  demoInfoCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 10,
    padding: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  demoInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  demoInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginLeft: 10,
  },
  demoInfoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  demoCoordsBox: {
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  demoCoordsLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  demoCoordsValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  demoInfoNote: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  infoSection: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 15,
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    marginLeft: 10,
    lineHeight: 20,
  },
  versionSection: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  versionSubtext: {
    fontSize: 11,
    color: '#CCC',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  intervalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
  },
  intervalOptionSelected: {
    backgroundColor: '#FFE8E8',
  },
  intervalText: {
    fontSize: 16,
    color: '#666',
  },
  intervalTextSelected: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingVertical: 15,
    marginTop: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});