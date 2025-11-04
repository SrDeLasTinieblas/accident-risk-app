const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbz9q85J_3WXuUM7QflHtCe7NJcxZQ1R-4JSXuvX9wvM30JzFQebZCMMmpuCStJ0WGDZXg/exec";

/**
 * Envía un error al Google Sheet centralizado
 * @param {Object} params
 * @param {string} params.system - Nombre del sistema o app
 * @param {string} params.module - Pantalla o módulo donde ocurrió el error
 * @param {string} params.errorType - Tipo de error (por ejemplo: "API", "Network", "UI")
 * @param {string} params.message - Mensaje de error o descripción
 * @param {string} [params.stacktrace] - Detalle técnico opcional
 * @param {string} [params.user] - Usuario afectado
 * @param {string} [params.version] - Versión de la app
 * @param {string} [params.endpoint] - Endpoint o ruta si aplica
 * @param {number} [params.latitude] - Latitud si aplica
 * @param {number} [params.longitude] - Longitud si aplica
 */

export async function logError({
  module = "Desconocido",
  errorType = "Desconocido",
  message = "",
  stacktrace = "",
  endpoint = "",
  user = "",
  latitude = "",
  longitude = "",
} = {}) {
  try {
    const system = "App de Accidentes de carreteras Arequipa";
    const version = "1.0.0";

    const body = {
      system,
      module,
      errorType,
      message,
      stacktrace,
      user,
      version,
      endpoint,
      latitude,
      longitude,
    };

    await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log("✅ Error enviado al Google Sheet");
  } catch (err) {
    console.error("❌ No se pudo enviar el error al Sheet:", err);
  }
}