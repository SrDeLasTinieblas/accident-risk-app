import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  getSettings, 
  saveSettings, 
  getUserData, 
  saveUserData 
} from '../utils/storage';
import { restartLocationTracking } from '../services/locationService';
import { checkServerConnection } from '../services/apiService';

const SettingsScreen = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [interval, setInterval] = useState(5);
  const [edad, setEdad] = useState('25');
  const [serverStatus, setServerStatus] = useState(null);

  useEffect(() => {
    loadSettings();
    checkServer();
  }, []);

  const loadSettings = async () => {
    const settings = await getSettings();
    const userData = await getUserData();
    
    setNotificationsEnabled(settings.notificationsEnabled);
    setInterval(settings.interval);
    setEdad(userData.edad?.toString() || '25');
  };

  const checkServer = async () => {
    const isConnected = await checkServerConnection();
    setServerStatus(isConnected);
  };

  const handleSaveSettings = async () => {
    // Validar edad
    const edadNum = parseInt(edad);
    if (isNaN(edadNum) || edadNum < 1 || edadNum > 120) {
      Alert.alert('Error', 'Por favor ingresa una edad válida (1-120)');
      return;
    }

    // Guardar configuración
    const newSettings = {
      notificationsEnabled,
      interval,
    };
    await saveSettings(newSettings);

    // Guardar datos de usuario
    const newUserData = {
      edad: edadNum,
    };
    await saveUserData(newUserData);

    // Reiniciar seguimiento con nueva configuración
    await restartLocationTracking();

    Alert.alert(
      'Configuración Guardada',
      `Intervalo: ${interval} minutos\nNotificaciones: ${notificationsEnabled ? 'Activadas' : 'Desactivadas'}\nEdad: ${edadNum} años`,
      [{ text: 'OK' }]
    );
  };

  const intervalOptions = [
    { value: 1, label: '1 minuto' },
    { value: 3, label: '3 minutos' },
    { value: 5, label: '5 minutos' },
    { value: 10, label: '10 minutos' },
    { value: 15, label: '15 minutos' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Estado del servidor */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado del Servidor</Text>
        <View style={styles.serverStatus}>
          <View style={styles.statusRow}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: serverStatus === true ? '#66BB6A' : serverStatus === false ? '#FF4444' : '#FFA726' }
            ]} />
            <Text style={styles.statusText}>
              {serverStatus === true ? 'Conectado' : serverStatus === false ? 'Desconectado' : 'Verificando...'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.checkButton}
            onPress={checkServer}
          >
            <Ionicons name="refresh" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          Verifica que el servidor esté en ejecución en tu red local
        </Text>
      </View>

      {/* Datos del usuario */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos del Usuario</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Edad</Text>
          <TextInput
            style={styles.input}
            value={edad}
            onChangeText={setEdad}
            keyboardType="numeric"
            placeholder="Ingresa tu edad"
            maxLength={3}
          />
        </View>
        <Text style={styles.helpText}>
          Tu edad se usa para calcular el riesgo de accidentes
        </Text>
      </View>

      {/* Notificaciones */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificaciones</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-outline" size={24} color="#666" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Alertas Push</Text>
              <Text style={styles.settingDescription}>
                Recibe notificaciones de riesgo alto y medio
              </Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#D0D0D0', true: '#FF9B9B' }}
            thumbColor={notificationsEnabled ? '#FF6B6B' : '#F4F3F4'}
          />
        </View>
      </View>

      {/* Intervalo de actualización */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Intervalo de Actualización</Text>
        <Text style={styles.helpText}>
          Selecciona cada cuánto tiempo se enviará tu ubicación al servidor
        </Text>
        {intervalOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.intervalOption,
              interval === option.value && styles.intervalOptionSelected,
            ]}
            onPress={() => setInterval(option.value)}
          >
            <Ionicons
              name={interval === option.value ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={interval === option.value ? '#FF6B6B' : '#999'}
            />
            <Text
              style={[
                styles.intervalLabel,
                interval === option.value && styles.intervalLabelSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.warningText}>
          ⚠️ Intervalos más cortos consumirán más batería
        </Text>
      </View>

      {/* Botón guardar */}
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={handleSaveSettings}
      >
        <Ionicons name="save-outline" size={24} color="#FFF" />
        <Text style={styles.saveButtonText}>Guardar Configuración</Text>
      </TouchableOpacity>

      {/* Información adicional */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>ℹ️ Información</Text>
        <Text style={styles.infoText}>
          • Esta app monitorea tu ubicación y predice riesgos de accidentes usando IA{'\n'}
          • Los datos se envían a un servidor local cada {interval} minutos{'\n'}
          • Las alertas de riesgo alto generan notificaciones automáticas{'\n'}
          • Puedes ver tu historial de alertas en la pestaña Alertas
        </Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    backgroundColor: '#FFF',
    padding: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  serverStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  checkButton: {
    padding: 8,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  helpText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    lineHeight: 18,
  },
  warningText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 12,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settingDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  intervalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  intervalOptionSelected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FF6B6B',
  },
  intervalLabel: {
    marginLeft: 12,
    fontSize: 16,
    color: '#666',
  },
  intervalLabelSelected: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B6B',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoSection: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 22,
  },
  bottomPadding: {
    height: 40,
  },
});

export default SettingsScreen;