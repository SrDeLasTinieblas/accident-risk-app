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
  Animated,
  Platform,
  StatusBar,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Tab = createBottomTabNavigator();
const { width, height } = Dimensions.get('window');

// 🧪 MODO DE PRUEBA - Coordenadas de demo
const DEMO_MODE = true; // Cambia a false para usar ubicación real
const DEMO_COORDINATES = {
  latitude: -16.3974773,
  longitude: -71.501184,
};

// Configuración de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ==================== SERVICIOS ====================

// Servicio de ubicación
const LocationService = {
  locationSubscription: null,
  
  async startTracking(interval, onUpdate) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación');
      return;
    }

    // Obtener ubicación inmediatamente
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    onUpdate(location);

    // Configurar actualización periódica
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

// Servicio de API
const APIService = {
  async predictRisk(latitude, longitude, edad, hora, mes) {
    try {
      const response = await fetch('https://accident-risk-model.onrender.com/predict', {
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
};

// Servicio de almacenamiento
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
      };
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      return {
        interval: 5,
        notificationsEnabled: true,
        edad: 30,
      };
    }
  },
};

// ==================== COMPONENTE DE MAPA PERSONALIZADO ====================

function CustomMapView({ location, riskData }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const getRiskColor = () => {
    if (!riskData) return '#4CAF50';
    switch (riskData.riskLevel) {
      case 'Alto':
        return '#F44336';
      case 'Medio':
        return '#FF9800';
      default:
        return '#4CAF50';
    }
  };

  const openInMaps = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${location.coords.latitude},${location.coords.longitude}`,
      android: `geo:0,0?q=${location.coords.latitude},${location.coords.longitude}`,
    });
    Alert.alert(
      'Abrir en Mapas',
      '¿Deseas ver tu ubicación en la aplicación de mapas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir', onPress: () => Linking.openURL(url) },
      ]
    );
  };

  return (
    <View style={styles.customMapContainer}>
      {/* Círculos de riesgo animados */}
      <Animated.View
        style={[
          styles.riskCircle,
          {
            backgroundColor: `${getRiskColor()}20`,
            borderColor: getRiskColor(),
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.riskCircleInner,
          {
            backgroundColor: `${getRiskColor()}40`,
            borderColor: getRiskColor(),
          },
        ]}
      />

      {/* Marcador central */}
      <View style={[styles.locationMarker, { backgroundColor: getRiskColor() }]}>
        <Ionicons name="location" size={40} color="#FFF" />
      </View>

      {/* Grid de fondo */}
      <View style={styles.gridOverlay}>
        {[...Array(10)].map((_, i) => (
          <View key={`h-${i}`} style={styles.gridLineHorizontal} />
        ))}
        {[...Array(10)].map((_, i) => (
          <View key={`v-${i}`} style={styles.gridLineVertical} />
        ))}
      </View>

      {/* Brújula */}
      <View style={styles.compassContainer}>
        <Ionicons name="navigate" size={24} color="#FF6B6B" />
        <Text style={styles.compassText}>N</Text>
      </View>

      {/* Botón para abrir en mapas */}
      <TouchableOpacity style={styles.openMapButton} onPress={openInMaps}>
        <Ionicons name="map-outline" size={20} color="#FFF" />
        <Text style={styles.openMapText}>Ver en Mapa</Text>
      </TouchableOpacity>

      {/* Indicadores de dirección */}
      <View style={styles.directionsContainer}>
        <Text style={styles.directionLabel}>Norte</Text>
        <Text style={[styles.directionLabel, styles.directionRight]}>Este</Text>
        <Text style={[styles.directionLabel, styles.directionBottom]}>Sur</Text>
        <Text style={[styles.directionLabel, styles.directionLeft]}>Oeste</Text>
      </View>
    </View>
  );
}

// ==================== PANTALLA DE MAPA ====================

function MapScreen() {
  const [location, setLocation] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ interval: 5, edad: 30, notificationsEnabled: true });
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    loadSettings();
    initializeLocation();

    return () => {
      LocationService.stopTracking();
    };
  }, []);

  const loadSettings = async () => {
    const savedSettings = await StorageService.getSettings();
    setSettings(savedSettings);
  };

  const initializeLocation = async () => {
    try {
      if (DEMO_MODE) {
        // 🧪 Usar coordenadas de demostración
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
        
        // Actualizar inmediatamente con ubicación demo
        handleLocationUpdate(demoLocation);
        
        // Configurar actualizaciones periódicas con ubicación demo
        const intervalId = setInterval(() => {
          handleLocationUpdate({
            ...demoLocation,
            timestamp: Date.now(),
          });
        }, settings.interval * 60 * 1000);
        
        // Guardar referencia para poder detenerlo
        LocationService.locationSubscription = intervalId;
      } else {
        // Usar ubicación real
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
    
    const now = new Date();
    const hora = now.getHours();
    const mes = now.getMonth() + 1;

    try {
      const risk = await APIService.predictRisk(
        newLocation.coords.latitude,
        newLocation.coords.longitude,
        settings.edad,
        hora,
        mes
      );

      setRiskData(risk);

      const alert = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        latitude: risk.latitude,
        longitude: risk.longitude,
        riskLevel: risk.riskLevel,
        probability: risk.probability,
        mensaje: risk.mensaje,
      };

      await StorageService.saveAlert(alert);

      if (risk.riskLevel === 'Alto' && settings.notificationsEnabled) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Alerta de Riesgo Alto',
            body: risk.mensaje,
            sound: true,
          },
          trigger: null,
        });
      }
    } catch (error) {
      console.error('Error al obtener predicción:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor');
    }
  };

  const getRiskColor = () => {
    if (!riskData) return '#4CAF50';
    switch (riskData.riskLevel) {
      case 'Alto':
        return '#F44336';
      case 'Medio':
        return '#FF9800';
      default:
        return '#4CAF50';
    }
  };

  const refreshLocation = () => {
    setLoading(true);
    LocationService.stopTracking();
    initializeLocation();
  };

  if (loading || !location) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="location" size={60} color="#FF6B6B" />
        <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomMapView location={location} riskData={riskData} />

      {/* Banner de modo demo */}
      {DEMO_MODE && (
        <View style={styles.demoBanner}>
          <Ionicons name="flask" size={16} color="#FFF" />
          <Text style={styles.demoText}>MODO DE PRUEBA</Text>
        </View>
      )}

      {/* Panel de información */}
      <View style={styles.infoPanel}>
        <View style={styles.riskBadge}>
          <Ionicons
            name={riskData?.riskLevel === 'Alto' ? 'warning' : riskData?.riskLevel === 'Medio' ? 'alert-circle' : 'checkmark-circle'}
            size={24}
            color={getRiskColor()}
          />
          <Text style={[styles.riskText, { color: getRiskColor() }]}>
            {riskData?.riskLevel || 'Calculando...'}
          </Text>
        </View>

        <Text style={styles.messageText}>
          {riskData?.mensaje || 'Analizando zona...'}
        </Text>

        {riskData && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Probabilidad</Text>
              <Text style={styles.statValue}>
                {(riskData.probability * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Riesgo</Text>
              <Text style={styles.statValue}>
                {(riskData.riesgo * 100).toFixed(1)}%
              </Text>
            </View>
          </View>
        )}

        <View style={styles.coordsContainer}>
          <Text style={styles.coordsText}>
            📍 {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
          </Text>
          {lastUpdate && (
            <Text style={styles.updateText}>
              Actualizado: {lastUpdate.toLocaleTimeString('es-ES')}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={refreshLocation}>
          <Ionicons name="refresh" size={20} color="#FFF" />
          <Text style={styles.refreshButtonText}>Actualizar Ubicación</Text>
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
      case 'Alto':
        return 'warning';
      case 'Medio':
        return 'alert-circle';
      default:
        return 'checkmark-circle';
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'Alto':
        return '#F44336';
      case 'Medio':
        return '#FF9800';
      default:
        return '#4CAF50';
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

      <ScrollView
        style={styles.alertsList}
        refreshing={refreshing}
        onRefresh={loadAlerts}
      >
        {alerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>No hay alertas registradas</Text>
            <Text style={styles.emptySubtext}>
              Las alertas aparecerán aquí cuando se detecte tu ubicación
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
                    {(alert.probability * 100).toFixed(1)}%
                  </Text>
                </View>
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
  });
  const [modalVisible, setModalVisible] = useState(false);

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
      Alert.alert('Actualizado', 'El nuevo intervalo se aplicará en el próximo envío. Reinicia la app para aplicar cambios inmediatamente.');
    }
  };

  const testNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Alerta de Riesgo Alto',
        body: 'Esta es una notificación de prueba. Zona de alto riesgo detectada.',
        sound: true,
        data: { test: true },
      },
      trigger: null,
    });
    // Alert.alert('✅ Notificación enviada', 'Revisa la bandeja de notificaciones');
  };

  const intervals = [1, 3, 5, 10, 15];

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
          <Text style={styles.sectionTitle}>⏱️ Frecuencia de Envío</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setModalVisible(true)}
          >
            <View>
              <Text style={styles.settingLabel}>Intervalo de actualización</Text>
              <Text style={styles.settingDescription}>
                Cada cuánto se envían las coordenadas
              </Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>{settings.interval} min</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>🔔 Notificaciones</Text>
          
          <View style={styles.settingItem}>
            <View>
              <Text style={styles.settingLabel}>Alertas de riesgo</Text>
              <Text style={styles.settingDescription}>
                Recibir notificaciones en zonas de alto riesgo
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

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>🧪 Modo de Prueba</Text>
          
          <View style={styles.demInfoCard}>
            <View style={styles.demInfoHeader}>
              <Ionicons name="flask" size={24} color="#FF6B6B" />
              <Text style={styles.demInfoTitle}>MODO DEMO ACTIVADO</Text>
            </View>
            <Text style={styles.demInfoText}>
              La app está usando coordenadas de demostración para simular una zona de riesgo.
            </Text>
            <View style={styles.demoCoordsBox}>
              <Text style={styles.demoCoordsLabel}>Coordenadas de prueba:</Text>
              <Text style={styles.demoCoordsValue}>
                📍 {DEMO_COORDINATES.latitude}, {DEMO_COORDINATES.longitude}
              </Text>
            </View>
            <Text style={styles.demInfoNote}>
              💡 Para usar tu ubicación real, cambia DEMO_MODE = false en el código
            </Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={24} color="#666" />
          <Text style={styles.infoText}>
            La aplicación enviará tu ubicación al servidor cada {settings.interval} minutos
            para analizar el riesgo de accidentes en tiempo real. Sin mapas de Google, sin costos adicionales.
          </Text>
        </View>

        <View style={styles.versionSection}>
          <Text style={styles.versionText}>Versión 1.0.0</Text>
          <Text style={styles.versionSubtext}>
            Predicción de riesgos con IA
          </Text>
        </View>
      </ScrollView>

      {/* Modal de selección de intervalo */}
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
        'Se recomienda activar las notificaciones para recibir alertas de riesgo'
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
              iconName = focused ? 'location' : 'location-outline';
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
          options={{ headerTitle: '🗺️ Zona de Riesgo' }}
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
  },
  // Mapa personalizado
  customMapContainer: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  gridOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.1,
  },
  gridLineHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: '#666',
  },
  gridLineVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: '#666',
  },
  riskCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
  },
  riskCircleInner: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
  },
  locationMarker: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
  },
  compassContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  compassText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 2,
  },
  openMapButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: '#FF6B6B',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  openMapText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  directionsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  directionLabel: {
    position: 'absolute',
    top: 100,
    left: '50%',
    transform: [{ translateX: -20 }],
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  directionRight: {
    top: '50%',
    left: 'auto',
    right: 20,
    transform: [{ translateY: -10 }],
  },
  directionBottom: {
    top: 'auto',
    bottom: 100,
    left: '50%',
    transform: [{ translateX: -20 }],
  },
  directionLeft: {
    top: '50%',
    left: 20,
    right: 'auto',
    transform: [{ translateY: -10 }],
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
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  riskText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  messageText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    paddingVertical: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  coordsContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  coordsText: {
    fontSize: 12,
    color: '#999',
  },
  updateText: {
    fontSize: 10,
    color: '#CCC',
    marginTop: 4,
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
  },
  alertDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  demInfoCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 10,
    padding: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  demInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  demInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginLeft: 10,
  },
  demInfoText: {
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
  demInfoNote: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
});