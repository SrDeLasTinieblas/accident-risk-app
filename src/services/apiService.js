import axios from 'axios';
import { getUserData } from '../utils/storage';

// Cambia esta URL por la IP de tu servidor
const API_URL = 'https://ccea964a8b77.ngrok-free.app'; // En desarrollo, usa tu IP local
// const API_URL = 'http://192.168.1.18:8000'; // Para servidor local

// ⚠️ MODO DEMO - Cambia a false para usar el servidor real
const DEMO_MODE = false;

// Coordenadas de demostración
const DEMO_COORDINATES = {
  latitude: -16.3974773,  // Latitud de demo (cambié xx por latitude)
  longitude: -71.501184    // Longitud de demo (cambié yy por longitude)
};

// Respuesta simulada para modo demo (formato actualizado)
const generateDemoResponse = (latitude, longitude, userData) => {
  const now = new Date();
  const hora = now.getHours();
  
  // Simular diferentes niveles de riesgo según la hora
  let riskLevel, probability, riesgo, mensaje;
  
  if (hora >= 22 || hora <= 5) {
    riskLevel = 'Alto';
    riesgo = 0.8;
    probability = 0.7 + Math.random() * 0.25;
    mensaje = '⚠️ Zona de alto riesgo';
  } else if (hora >= 18 || hora <= 7) {
    riskLevel = 'Medio';
    riesgo = 0.5;
    probability = 0.4 + Math.random() * 0.3;
    mensaje = '⚠️ Zona de riesgo moderado';
  } else {
    riskLevel = 'Bajo';
    riesgo = 0.1;
    probability = 0.0 + Math.random() * 0.2;
    mensaje = '✅ Zona de bajo riesgo';
  }
  
  return {
    latitude: latitude,
    longitude: longitude,
    riskLevel: riskLevel,
    probability: probability,
    riesgo: riesgo,
    mensaje: mensaje + ' (Modo Demo)',
    timestamp: now.toISOString()
  };
};

export const sendPredictionRequest = async (latitude, longitude) => {
  try {
    // Obtener datos del usuario
    const userData = await getUserData();
    
    // SI ESTÁ EN MODO DEMO, retornar respuesta simulada
    if (DEMO_MODE) {
      console.log('🎭 MODO DEMO ACTIVADO - Usando datos simulados');
      
      // Simular delay de red (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const demoResponse = generateDemoResponse(latitude, longitude, userData);
      console.log('Respuesta demo:', demoResponse);
      return demoResponse;
    }
    
    // MODO NORMAL - Conectar al servidor real
    // Usar el formato que espera el servidor Flask (xx, yy en lugar de latitude, longitude)
    const requestData = {
      xx: latitude,      // Cambiado de latitude a xx
      yy: longitude,     // Cambiado de longitude a yy
      edad: userData?.edad || 35,           // Usar edad del usuario o valor por defecto
      hora: new Date().getHours(),          // Hora actual
      mes: new Date().getMonth() + 1        // Mes actual
    };
    
    console.log('Enviando datos al servidor:', requestData);
    console.log('URL del servidor:', `${API_URL}/predict`);
    
    const response = await axios.post(`${API_URL}/predict`, requestData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });
    
    console.log('Respuesta del servidor:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('Error en la petición:', error.message);
    
    if (error.response) {
      console.error('Error del servidor:', error.response.data);
      console.error('Status:', error.response.status);
      throw new Error(`Error del servidor: ${error.response.status}`);
    } else if (error.request) {
      console.error('No hay respuesta del servidor');
      console.error('Verifica que el servidor esté corriendo en:', API_URL);
      throw new Error('No se pudo conectar con el servidor. Verifica la URL y que el servidor esté corriendo.');
    } else {
      console.error('Error configurando la petición:', error.message);
      throw new Error('Error al enviar la petición');
    }
  }
};

// Función para verificar conexión con el servidor
export const checkServerConnection = async () => {
  // En modo demo, siempre retornar true
  if (DEMO_MODE) {
    console.log('🎭 MODO DEMO - Servidor simulado disponible');
    return true;
  }
  
  try {
    // Intentar hacer un ping al endpoint /predict con datos de prueba
    // o crear un endpoint /health si lo tienes en tu API
    const response = await axios.get(`${API_URL}/health`, {
      timeout: 5000
    });
    console.log('✅ Servidor conectado correctamente');
    return response.status === 200;
  } catch (error) {
    console.error('❌ Servidor no disponible:', error.message);
    return false;
  }
};

// Función auxiliar para obtener el modo actual
export const isDemoMode = () => DEMO_MODE;

// Función para usar coordenadas de demo si está activado
export const getDemoCoordinates = () => {
  if (DEMO_MODE) {
    return DEMO_COORDINATES;
  }
  return null;
};

// Función auxiliar para interpretar el nivel de riesgo
export const getRiskInfo = (riskLevel) => {
  const riskInfo = {
    'Alto': {
      color: '#FF4444',
      icon: 'alert-circle',
      description: 'Se recomienda extrema precaución'
    },
    'Medio': {
      color: '#FFA726',
      icon: 'warning',
      description: 'Se recomienda precaución'
    },
    'Bajo': {
      color: '#66BB6A',
      icon: 'checkmark-circle',
      description: 'Zona relativamente segura'
    }
  };
  
  return riskInfo[riskLevel] || riskInfo['Bajo'];
};