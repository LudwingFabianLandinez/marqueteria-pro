/**
 * Configuración central de la API
 * Este archivo detecta automáticamente si estás en tu PC (localhost)
 * o en la nube (Netlify) para conectar con el servidor correcto.
 */

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'  // URL para desarrollo local
    : '/api';                      // URL para Netlify (Producción)

// Exportar para que otros archivos lo usen si es necesario
// Aunque en tu caso, al cargarlo en el HTML, API_URL se vuelve global.
console.log(`🔌 Conectado a la API en: ${API_URL}`);