import AsyncStorage from '@react-native-async-storage/async-storage';

const ALERTS_KEY = '@alerts';
const SETTINGS_KEY = '@settings';
const USER_DATA_KEY = '@user_data';

// Guardar alertas
export const saveAlert = async (alert) => {
  try {
    const existingAlerts = await getAlerts();
    const newAlerts = [alert, ...existingAlerts];
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(newAlerts));
    return true;
  } catch (error) {
    console.error('Error guardando alerta:', error);
    return false;
  }
};

// Obtener todas las alertas
export const getAlerts = async () => {
  try {
    const alerts = await AsyncStorage.getItem(ALERTS_KEY);
    return alerts ? JSON.parse(alerts) : [];
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    return [];
  }
};

// Limpiar alertas
export const clearAlerts = async () => {
  try {
    await AsyncStorage.removeItem(ALERTS_KEY);
    return true;
  } catch (error) {
    console.error('Error limpiando alertas:', error);
    return false;
  }
};

// Guardar configuración
export const saveSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error guardando configuración:', error);
    return false;
  }
};

// Obtener configuración
export const getSettings = async () => {
  try {
    const settings = await AsyncStorage.getItem(SETTINGS_KEY);
    return settings ? JSON.parse(settings) : {
      interval: 5, // minutos
      notificationsEnabled: true
    };
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    return { interval: 5, notificationsEnabled: true };
  }
};

// Guardar datos del usuario
export const saveUserData = async (userData) => {
  try {
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    return true;
  } catch (error) {
    console.error('Error guardando datos del usuario:', error);
    return false;
  }
};

// Obtener datos del usuario
export const getUserData = async () => {
  try {
    const userData = await AsyncStorage.getItem(USER_DATA_KEY);
    return userData ? JSON.parse(userData) : { edad: 25 };
  } catch (error) {
    console.error('Error obteniendo datos del usuario:', error);
    return { edad: 25 };
  }
};