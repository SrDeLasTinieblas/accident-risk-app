import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { sendPredictionRequest } from './apiService';
import { saveAlert, getSettings } from '../utils/storage';

let locationInterval = null;

// Enviar notificación local
const sendNotification = async (title, body, riskLevel) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: title,
      body: body,
      sound: true,
      priority: 'high',
      data: { riskLevel },
    },
    trigger: null, // Inmediato
  });
};

// Procesar la respuesta de riesgo
const processRiskResponse = async (riskData, latitude, longitude) => {
  const alert = {
    id: Date.now().toString(),
    riskLevel: riskData.riesgo || 'Desconocido',
    probability: riskData.probabilidad || 0,
    latitude,
    longitude,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('es-PE'),
    time: new Date().toLocaleTimeString('es-PE'),
  };

  // Guardar la alerta
  await saveAlert(alert);

  // Determinar si enviar notificación
  const settings = await getSettings();
  if (settings.notificationsEnabled) {
    if (riskData.riesgo === 'Alto') {
      await sendNotification(
        '⚠️ ALERTA DE RIESGO ALTO',
        `Riesgo de accidente: ${(riskData.probabilidad * 100).toFixed(1)}%\nEvita esta zona si es posible.`,
        'Alto'
      );
    } else if (riskData.riesgo === 'Medio') {
      await sendNotification(
        '⚡ Alerta de Riesgo Medio',
        `Riesgo de accidente: ${(riskData.probabilidad * 100).toFixed(1)}%\nConduce con precaución.`,
        'Medio'
      );
    }
  }

  return alert;
};

// Obtener ubicación y enviar al servidor
const sendLocationData = async () => {
  try {
    console.log('Obteniendo ubicación...');
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude, longitude } = location.coords;
    console.log(`Ubicación obtenida: ${latitude}, ${longitude}`);

    // Enviar al servidor
    const riskData = await sendPredictionRequest(latitude, longitude);
    
    // Procesar respuesta
    await processRiskResponse(riskData, latitude, longitude);
    
    return { success: true, latitude, longitude, riskData };
  } catch (error) {
    console.error('Error obteniendo ubicación o enviando datos:', error);
    return { success: false, error: error.message };
  }
};

// Iniciar seguimiento de ubicación
export const startLocationTracking = async () => {
  try {
    // Solicitar permisos
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      alert('Se necesitan permisos de ubicación para usar la app');
      return false;
    }

    // Solicitar permisos de ubicación en segundo plano
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Permisos de ubicación en segundo plano no otorgados');
    }

    // Obtener configuración
    const settings = await getSettings();
    const intervalMinutes = settings.interval || 5;

    // Limpiar intervalo anterior si existe
    if (locationInterval) {
      clearInterval(locationInterval);
    }

    // Enviar inmediatamente
    await sendLocationData();

    // Configurar envío periódico
    locationInterval = setInterval(async () => {
      await sendLocationData();
    }, intervalMinutes * 60 * 1000);

    console.log(`Seguimiento iniciado. Enviando cada ${intervalMinutes} minutos.`);
    return true;
  } catch (error) {
    console.error('Error iniciando seguimiento:', error);
    return false;
  }
};

// Detener seguimiento
export const stopLocationTracking = () => {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
    console.log('Seguimiento detenido');
  }
};

// Obtener ubicación actual sin enviar al servidor
export const getCurrentLocation = async () => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return location.coords;
  } catch (error) {
    console.error('Error obteniendo ubicación:', error);
    return null;
  }
};

// Reiniciar con nueva configuración
export const restartLocationTracking = async () => {
  stopLocationTracking();
  await startLocationTracking();
};