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
import MapView, { Marker, Circle } from 'react-native-maps';

const Tab = createBottomTabNavigator();

// 🧪 MODO DE PRUEBA
const DEMO_MODE = false;
const DEMO_COORDINATES = {
  latitude: -16.3974773,
  longitude: -71.501184,
};

// 🔴 URL de tu API
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
  demoInterval: null,
  
  // 🎯 SEGUIMIENTO GPS EN TIEMPO REAL
  async startRealTimeTracking(onUpdate) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación');
      return;
    }

    // Obtener ubicación inicial
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    onUpdate(location);

    // Suscribirse a actualizaciones continuas
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,  // Balanced para mejor rendimiento
        timeInterval: 3000,        // Cada 3 segundos (menos lag)
        distanceInterval: 15,      // O cada 15 metros
      },
      (newLocation) => {
        onUpdate(newLocation);
      }
    );
  },

  // 🧪 MODO DEMO - Movimiento simulado fluido
  startDemoTracking(onUpdate) {
    let currentLat = DEMO_COORDINATES.latitude;
    let currentLon = DEMO_COORDINATES.longitude;
    let angle = Math.random() * Math.PI * 2;
    const speed = 0.00004; // Velocidad más visible

    // Ubicación inicial
    onUpdate({
      coords: {
        latitude: currentLat,
        longitude: currentLon,
        altitude: 0,
        accuracy: 10,
        heading: angle * (180 / Math.PI),
        speed: 3,
      },
      timestamp: Date.now(),
    });

    // Actualizar cada 3 segundos (mejor rendimiento)
    this.demoInterval = setInterval(() => {
      // Cambiar dirección ocasionalmente
      if (Math.random() < 0.15) {
        angle += (Math.random() - 0.5) * 0.8;
      }

      // Actualizar posición
      currentLat += Math.cos(angle) * speed;
      currentLon += Math.sin(angle) * speed;

      // Mantener en área cercana
      const distFromCenter = Math.sqrt(
        Math.pow(currentLat - DEMO_COORDINATES.latitude, 2) +
        Math.pow(currentLon - DEMO_COORDINATES.longitude, 2)
      );

      if (distFromCenter > 0.008) {
        angle += Math.PI;
      }

      onUpdate({
        coords: {
          latitude: currentLat,
          longitude: currentLon,
          altitude: 0,
          accuracy: 10,
          heading: angle * (180 / Math.PI),
          speed: 3,
        },
        timestamp: Date.now(),
      });
    }, 3000); // 3 segundos para evitar lag
  },

  stopTracking() {
    if (this.locationSubscription) {
      if (typeof this.locationSubscription.remove === 'function') {
        this.locationSubscription.remove();
      }
      this.locationSubscription = null;
    }
    
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
  },
};

const APIService = {
  // Obtener zonas de riesgo desde API
  async getRiskZones(minRiskLevel = 1, minAccidents = 1, limit = 100, sortBy = 'risk') {
    try {
      let url = `${API_BASE_URL}/risk-zones?min_risk=${minRiskLevel}&min_accidents=${minAccidents}`;
      
      if (limit !== null) {
        url += `&limit=${limit}`;
      }
      
      url += `&sort_by=${sortBy}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        return this.getDemoRiskZones();
      }

      const data = await response.json();
      return data.zones || [];
    } catch (error) {
      console.error('❌ Error al obtener zonas:', error);
      return this.getDemoRiskZones();
    }
  },

  // Zonas demo para pruebas
  getDemoRiskZones() {
    return [
      {
        latitude: -16.3974773,
        longitude: -71.501184,
        risk_level: "Alto",
        risk_score: 0.95,
        radius: 150,
        accident_count: 12
      },
      {
        latitude: -16.3980,
        longitude: -71.5020,
        risk_level: "Alto",
        risk_score: 0.85,
        radius: 120,
        accident_count: 8
      },
      {
        latitude: -16.3965,
        longitude: -71.5005,
        risk_level: "Medio",
        risk_score: 0.78,
        radius: 100,
        accident_count: 5
      },
      {
        latitude: -16.3990,
        longitude: -71.5000,
        risk_level: "Medio",
        risk_score: 0.72,
        radius: 80,
        accident_count: 4
      },
      {
        latitude: -16.3955,
        longitude: -71.5015,
        risk_level: "Bajo",
        risk_score: 0.55,
        radius: 70,
        accident_count: 2
      }
    ];
  },

  // Calcular distancia entre dos puntos
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },

  // 🎯 VERIFICAR SI ESTÁS DENTRO DE ALGUNA ZONA
  checkInsideRiskZones(latitude, longitude, riskZones) {
    const insideZones = [];
    
    for (const zone of riskZones) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        zone.latitude,
        zone.longitude
      );
      
      const zoneRadius = zone.radius || 100;
      
      if (distance <= zoneRadius) {
        insideZones.push({
          ...zone,
          distance: Math.round(distance),
          isInside: true
        });
      }
    }
    
    // Retornar ordenado por riesgo (más peligroso primero)
    return insideZones.sort((a, b) => b.risk_score - a.risk_score);
  }
};

const StorageService = {
  async saveSettings(settings) {
    try {
      await AsyncStorage.setItem('settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error al guardar:', error);
    }
  },

  async getSettings() {
    try {
      const settings = await AsyncStorage.getItem('settings');
      return settings ? JSON.parse(settings) : {
        notificationsEnabled: true,
        edad: 30,
        minRiskLevel: 1,
        minAccidents: 1,
        maxZones: 100,
        sortBy: 'risk',
      };
    } catch (error) {
      return {
        notificationsEnabled: true,
        edad: 30,
        minRiskLevel: 1,
        minAccidents: 1,
        maxZones: 100,
        sortBy: 'risk',
      };
    }
  },

  async saveAlert(alert) {
    try {
      const alerts = await this.getAlerts();
      alerts.unshift(alert);
      await AsyncStorage.setItem('alerts', JSON.stringify(alerts.slice(0, 50)));
    } catch (error) {
      console.error('Error:', error);
    }
  },

  async getAlerts() {
    try {
      const alerts = await AsyncStorage.getItem('alerts');
      return alerts ? JSON.parse(alerts) : [];
    } catch (error) {
      return [];
    }
  },

  async clearAlerts() {
    try {
      await AsyncStorage.setItem('alerts', JSON.stringify([]));
    } catch (error) {
      console.error('Error:', error);
    }
  },

  async saveRiskZones(zones) {
    try {
      await AsyncStorage.setItem('riskZones', JSON.stringify(zones));
    } catch (error) {
      console.error('Error:', error);
    }
  },

  async getRiskZones() {
    try {
      const zones = await AsyncStorage.getItem('riskZones');
      return zones ? JSON.parse(zones) : null;
    } catch (error) {
      return null;
    }
  }
};

// ==================== COMPONENTE DE MAPA OPTIMIZADO ====================

function CustomMapView({ location, riskZones, onInsideZone }) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [insideZone, setInsideZone] = useState(null);
  const previousZoneRef = useRef(null);
  const updateCountRef = useRef(0);

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
      
      // Solo mover mapa cada 2 actualizaciones (reduce lag)
      updateCountRef.current += 1;
      if (updateCountRef.current % 2 === 0 && mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 500);
      }

      // 🎯 DETECTAR SI ENTRASTE A UNA ZONA
      if (riskZones && riskZones.length > 0) {
        const insideZones = APIService.checkInsideRiskZones(latitude, longitude, riskZones);
        
        if (insideZones.length > 0) {
          const currentZone = insideZones[0];
          setInsideZone(currentZone);
          
          // Notificar solo si es zona nueva
          const zoneId = `${currentZone.latitude}-${currentZone.longitude}`;
          const prevZoneId = previousZoneRef.current ? 
            `${previousZoneRef.current.latitude}-${previousZoneRef.current.longitude}` : null;
          
          if (zoneId !== prevZoneId && onInsideZone) {
            onInsideZone(currentZone);
          }
          
          previousZoneRef.current = currentZone;
        } else {
          setInsideZone(null);
          previousZoneRef.current = null;
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
    if (riskScore >= 0.8) return '#F44336';
    if (riskScore >= 0.6) return '#FF9800';
    return '#FFC107';
  };

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation={!DEMO_MODE}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
        loadingEnabled={false}
      >
        {/* Zonas de riesgo con markers de porcentaje */}
        {riskZones && riskZones.map((zone, index) => (
          <React.Fragment key={`zone-${index}`}>
            <Circle
              center={{ latitude: zone.latitude, longitude: zone.longitude }}
              radius={zone.radius || 100}
              fillColor={getRiskColor(zone.risk_score) + '30'}
              strokeColor={getRiskColor(zone.risk_score)}
              strokeWidth={2}
            />
            <Marker
              coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={[styles.riskMarker, { backgroundColor: getRiskColor(zone.risk_score) }]}>
                <Ionicons name="warning" size={14} color="#FFF" />
                <Text style={styles.riskMarkerText}>
                  {(zone.risk_score * 100).toFixed(0)}%
                </Text>
              </View>
            </Marker>
          </React.Fragment>
        ))}

        {/* Tu ubicación - Camión/Carro */}
        {/* <Marker
          coordinate={{ latitude, longitude }}
          title="Tu ubicación"
          description={insideZone ? `⚠️ Zona ${insideZone.risk_level}` : '✅ Zona segura'}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.vehicleMarker}>
            <Ionicons 
              name="car" 
              size={28} 
              color={insideZone ? '#F44336' : '#4CAF50'} 
            />
          </View>
        </Marker> */}

        {/* Círculo alrededor tuyo */}
        {/* <Circle
          center={{ latitude, longitude }}
          radius={30}
          fillColor={insideZone ? "rgba(244, 67, 54, 0.3)" : "rgba(76, 175, 80, 0.3)"}
          strokeColor={insideZone ? "#F44336" : "#4CAF50"}
          strokeWidth={2}
        /> */}
      </MapView>

      {/* 🚨 BANNER COMPLETO CUANDO ESTÁS DENTRO */}
      {insideZone && (
        <View style={[styles.insideBanner, { backgroundColor: getRiskColor(insideZone.risk_score) }]}>
          <Ionicons name="warning" size={22} color="#FFF" />
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle}>
              🚨 ¡DENTRO DE ZONA DE RIESGO!
            </Text>
            <Text style={styles.bannerText}>
              Riesgo {insideZone.risk_level} ({(insideZone.risk_score * 100).toFixed(0)}%)
            </Text>
            {insideZone.accident_count && (
              <Text style={styles.bannerSubtext}>
                {insideZone.accident_count} accidentes históricos
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Leyenda */}
      <View style={styles.legend}>
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
  const [settings, setSettings] = useState({
    notificationsEnabled: true,
    edad: 30,
    minRiskLevel: 1,
    minAccidents: 1,
    maxZones: 100,
    sortBy: 'risk',
  });
  const [isInRiskZone, setIsInRiskZone] = useState(false);
  const lastNotificationRef = useRef(0);

  useEffect(() => {
    loadSettings();
    loadRiskZones();
    initializeTracking();

    return () => {
      LocationService.stopTracking();
    };
  }, []);

  const loadSettings = async () => {
    const saved = await StorageService.getSettings();
    setSettings(saved);
  };

  const loadRiskZones = async () => {
      try {
        const currentSettings = await StorageService.getSettings();
        const maxZones = currentSettings.maxZones || null; // null = sin límite
        
        // Cargar desde caché primero
        const cached = await StorageService.getRiskZones();
        if (cached && cached.length > 0) {
          // Aplicar límite del usuario
          const limitedZones = maxZones ? cached.slice(0, maxZones) : cached;
          setRiskZones(limitedZones);
        }

        // Cargar desde API con el límite configurado
        const zones = await APIService.getRiskZones(
          currentSettings.minRiskLevel,
          currentSettings.minAccidents,
          maxZones, // Usar el límite del usuario
          currentSettings.sortBy
        );
        
        setRiskZones(zones);
        await StorageService.saveRiskZones(zones);
        
      } catch (error) {
        console.error('Error al cargar zonas:', error);
      }
    };


  const initializeTracking = async () => {
    try {
      if (DEMO_MODE) {
        LocationService.startDemoTracking(handleLocationUpdate);
      } else {
        await LocationService.startRealTimeTracking(handleLocationUpdate);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo iniciar el seguimiento');
      setLoading(false);
    }
  };

  const handleLocationUpdate = (newLocation) => {
    setLocation(newLocation);
    setLoading(false);
  };

  // 🚨 NOTIFICAR CUANDO ENTRAS A UNA ZONA
  const handleInsideZone = async (zone) => {
    if (!settings.notificationsEnabled) return;

    setIsInRiskZone(true);

    // Cooldown de 3 minutos para evitar spam
    const now = Date.now();
    if (now - lastNotificationRef.current < 180000) {
      return;
    }

    lastNotificationRef.current = now;

    // Enviar notificación
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 ¡ALERTA DE RIESGO!',
        body: `Entraste a zona de riesgo ${zone.risk_level} (${(zone.risk_score * 100).toFixed(0)}%). ${zone.accident_count ? `${zone.accident_count} accidentes históricos.` : ''} ¡Precaución!`,
        sound: true,
        priority: 'high',
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
      riskLevel: zone.risk_level,
      probability: zone.risk_score,
      mensaje: `🚨 Entrada a zona ${zone.risk_level}`,
      accident_count: zone.accident_count
    };

    await StorageService.saveAlert(alert);
  };

  const refreshZones = async () => {
    setLoading(true);
    await loadSettings();
    await loadRiskZones();
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="location" size={60} color="#FF6B6B" />
        <Text style={styles.loadingText}>Iniciando GPS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomMapView 
        location={location} 
        riskZones={riskZones}
        onInsideZone={handleInsideZone}
      />

      {DEMO_MODE && (
        <View style={styles.demoBanner}>
          <Ionicons name="flask" size={14} color="#FFF" />
          <Text style={styles.demoText}>MODO DEMO</Text>
        </View>
      )}

      <View style={styles.infoPanel}>
        {/* Estado en tiempo real */}
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { 
            backgroundColor: isInRiskZone ? '#F44336' : '#4CAF50' 
          }]} />
          <Text style={styles.statusText}>
            {isInRiskZone ? '🚨 En zona de riesgo' : '✅ Zona segura'}
          </Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Ionicons name="map" size={18} color="#FF6B6B" />
            <Text style={styles.statValue}>{riskZones.length}</Text>
            <Text style={styles.statLabel}>Zonas</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="warning" size={18} color="#F44336" />
            <Text style={styles.statValue}>
              {riskZones.filter(z => z.risk_score >= 0.8).length}
            </Text>
            <Text style={styles.statLabel}>Alto Riesgo</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={18} color="#4CAF50" />
            <Text style={styles.statValue}>
              {location ? '●' : '○'}
            </Text>
            <Text style={styles.statLabel}>GPS Activo</Text>
          </View>
        </View>

        {location && (
          <Text style={styles.coords}>
            📍 {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
          </Text>
        )}

        <TouchableOpacity style={styles.refreshBtn} onPress={refreshZones}>
          <Ionicons name="refresh" size={18} color="#FFF" />
          <Text style={styles.refreshText}>Recargar Zonas</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==================== PANTALLA DE ALERTAS ====================

function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    const saved = await StorageService.getAlerts();
    setAlerts(saved);
  };

  const clearAll = () => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar todo el historial?',
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

  const getRiskColor = (level) => {
    if (level === 'Alto') return '#F44336';
    if (level === 'Medio') return '#FF9800';
    return '#FFC107';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.alertsHeader}>
        <View>
          <Text style={styles.alertsTitle}>Historial</Text>
          <Text style={styles.alertsSubtitle}>{alerts.length} alertas</Text>
        </View>
        {alerts.length > 0 && (
          <TouchableOpacity onPress={clearAll}>
            <Ionicons name="trash-outline" size={22} color="#F44336" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.alertsList}>
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={50} color="#CCC" />
            <Text style={styles.emptyText}>Sin alertas</Text>
            <Text style={styles.emptySubtext}>
              Las alertas aparecerán cuando entres a zonas de riesgo
            </Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View style={[styles.alertIcon, { 
                  backgroundColor: getRiskColor(alert.riskLevel) 
                }]}>
                  <Ionicons name="warning" size={22} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertLevel, { 
                    color: getRiskColor(alert.riskLevel) 
                  }]}>
                    Riesgo {alert.riskLevel}
                  </Text>
                  <Text style={styles.alertDate}>
                    {new Date(alert.timestamp).toLocaleString('es-ES')}
                  </Text>
                </View>
              </View>

              <Text style={styles.alertMsg}>{alert.mensaje}</Text>

              <View style={styles.alertFooter}>
                <Text style={styles.alertDetail}>
                  📍 {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                </Text>
                <Text style={styles.alertDetail}>
                  📊 {(alert.probability * 100).toFixed(0)}%
                </Text>
                {alert.accident_count && (
                  <Text style={styles.alertDetail}>
                    🚗 {alert.accident_count} accidentes
                  </Text>
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
    notificationsEnabled: true,
    edad: 30,
    minRiskLevel: 1,
    minAccidents: 1,
    maxZones: 100,
    sortBy: 'risk',
  });
  
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showAccidentsModal, setShowAccidentsModal] = useState(false);
  const [showZonesModal, setShowZonesModal] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const saved = await StorageService.getSettings();
    setSettings(saved);
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await StorageService.saveSettings(newSettings);
  };

  const testNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Prueba de Alerta',
        body: 'Esta es una notificación de prueba. Sistema funcionando correctamente.',
        sound: true,
      },
      trigger: null,
    });
  };

  const riskLevels = [
    { value: 0, label: 'Todas', desc: 'Bajo, medio y alto' },
    { value: 1, label: 'Medio y Alto', desc: 'Recomendado' },
    { value: 2, label: 'Solo Alto', desc: 'Más peligrosas' },
  ];

  const getRiskLabel = (value) => {
    const level = riskLevels.find(l => l.value === value);
    return level ? level.label : 'Medio y Alto';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.settings}>
        
        {/* Usuario */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Usuario</Text>
          
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Edad</Text>
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

        {/* Zonas de Riesgo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗺️ Zonas de Riesgo</Text>
          
          <TouchableOpacity
            style={styles.setting}
            onPress={() => setShowRiskModal(true)}
          >
            <Text style={styles.settingLabel}>Nivel mínimo</Text>
            <View style={styles.settingValue}>
              <Text style={styles.valueText}>{getRiskLabel(settings.minRiskLevel)}</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.setting}
            onPress={() => setShowAccidentsModal(true)}
          >
            <Text style={styles.settingLabel}>Mínimo accidentes</Text>
            <View style={styles.settingValue}>
              <Text style={styles.valueText}>{settings.minAccidents}+</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.setting}
            onPress={() => setShowZonesModal(true)}
          >
            <Text style={styles.settingLabel}>Límite de zonas</Text>
            <View style={styles.settingValue}>
              <Text style={styles.valueText}>{settings.maxZones || 'Todas'}</Text>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </View>
          </TouchableOpacity>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Ordenar por</Text>
            <View style={styles.sortBtns}>
              <TouchableOpacity
                style={[
                  styles.sortBtn,
                  settings.sortBy === 'risk' && styles.sortBtnActive
                ]}
                onPress={() => updateSetting('sortBy', 'risk')}
              >
                <Text style={[
                  styles.sortBtnText,
                  settings.sortBy === 'risk' && styles.sortBtnTextActive
                ]}>Riesgo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.sortBtn,
                  settings.sortBy === 'accidents' && styles.sortBtnActive
                ]}
                onPress={() => updateSetting('sortBy', 'accidents')}
              >
                <Text style={[
                  styles.sortBtnText,
                  settings.sortBy === 'accidents' && styles.sortBtnTextActive
                ]}>Frecuencia</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Notificaciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Notificaciones</Text>
          
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Alertas activadas</Text>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(value) => updateSetting('notificationsEnabled', value)}
              trackColor={{ false: '#CCC', true: '#FF6B6B' }}
              thumbColor="#FFF"
            />
          </View>

          <TouchableOpacity style={styles.testBtn} onPress={testNotification}>
            <Ionicons name="notifications-outline" size={18} color="#FF6B6B" />
            <Text style={styles.testBtnText}>Probar Notificación</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={22} color="#2196F3" />
          <Text style={styles.infoText}>
            💡 La app detecta en tiempo real cuando entras a zonas de riesgo. 
            No es necesario configurar intervalos.
          </Text>
        </View>

        <View style={styles.version}>
          <Text style={styles.versionText}>Versión 3.0.0</Text>
          <Text style={styles.versionSub}>Detección en tiempo real</Text>
        </View>
      </ScrollView>
      
      {/* Modal Nivel de Riesgo */}
      <Modal
        visible={showRiskModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRiskModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nivel de Riesgo</Text>
            
            {riskLevels.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.modalOption,
                  settings.minRiskLevel === level.value && styles.modalOptionActive
                ]}
                onPress={() => {
                  updateSetting('minRiskLevel', level.value);
                  setShowRiskModal(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.modalOptionText,
                    settings.minRiskLevel === level.value && styles.modalOptionTextActive
                  ]}>
                    {level.label}
                  </Text>
                  <Text style={styles.modalOptionDesc}>{level.desc}</Text>
                </View>
                {settings.minRiskLevel === level.value && (
                  <Ionicons name="checkmark-circle" size={22} color="#FF6B6B" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowRiskModal(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Mínimo Accidentes */}
      <Modal
        visible={showAccidentsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAccidentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mínimo de Accidentes</Text>
            
            {[1, 3, 5, 10, 15].map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.modalOption,
                  settings.minAccidents === num && styles.modalOptionActive
                ]}
                onPress={() => {
                  updateSetting('minAccidents', num);
                  setShowAccidentsModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  settings.minAccidents === num && styles.modalOptionTextActive
                ]}>
                  {num}+ accidente{num > 1 ? 's' : ''}
                </Text>
                {settings.minAccidents === num && (
                  <Ionicons name="checkmark-circle" size={22} color="#FF6B6B" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowAccidentsModal(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Límite Zonas */}
      <Modal
        visible={showZonesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowZonesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Límite de Zonas</Text>
            
            {[30, 50, 100, 200, null].map((num) => (
              <TouchableOpacity
                key={num || 'all'}
                style={[
                  styles.modalOption,
                  settings.maxZones === num && styles.modalOptionActive
                ]}
                onPress={() => {
                  updateSetting('maxZones', num);
                  setShowZonesModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  settings.maxZones === num && styles.modalOptionTextActive
                ]}>
                  {num ? `${num} zonas` : 'Sin límite'}
                </Text>
                {settings.maxZones === num && (
                  <Ionicons name="checkmark-circle" size={22} color="#FF6B6B" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowZonesModal(false)}
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
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permisos de notificación',
        'Activa las notificaciones para recibir alertas de riesgo'
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
          },
          headerTintColor: '#FFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          tabBarStyle: {
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
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

// ==================== ESTILOS OPTIMIZADOS ====================

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
    marginTop: 15,
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  
  // Mapa
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  riskMarker: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  riskMarkerText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 10,
    marginLeft: 3,
  },
  
  // Banner
  demoBanner: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  demoText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 11,
    marginLeft: 5,
  },
  insideBanner: {
    position: 'absolute',
    top: 50,
    left: 15,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  bannerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  bannerTitle: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bannerText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 2,
  },
  bannerSubtext: {
    color: '#FFE0E0',
    fontSize: 11,
    marginTop: 2,
  },
  
  // Leyenda
  legend: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
  },
  
  // Panel Info
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  coords: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  refreshBtn: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 14,
  },
  
  // Alertas
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFF',
  },
  alertsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  alertsSubtitle: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  alertsList: {
    flex: 1,
    padding: 15,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 15,
    color: '#999',
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 12,
    color: '#CCC',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  alertCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  alertLevel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  alertMsg: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  alertFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  alertDetail: {
    fontSize: 11,
    color: '#666',
    marginRight: 12,
    marginTop: 3,
  },
  
  // Configuración
  settings: {
    flex: 1,
    padding: 15,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 14,
    color: '#666',
    marginRight: 5,
  },
  ageInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    minWidth: 50,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontWeight: '600',
  },
  sortBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sortBtnActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  sortBtnText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  sortBtnTextActive: {
    color: '#FFF',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE8E8',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  testBtnText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 6,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 12,
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 10,
    lineHeight: 18,
  },
  version: {
    alignItems: 'center',
    padding: 20,
  },
  versionText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
  versionSub: {
    fontSize: 10,
    color: '#CCC',
    marginTop: 2,
  },
  
  // Modales
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
    paddingBottom: Platform.OS === 'ios' ? 35 : 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
  },
  modalOptionActive: {
    backgroundColor: '#FFE8E8',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  modalOptionTextActive: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  modalOptionDesc: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  modalClose: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});