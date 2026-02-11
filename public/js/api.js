/**
 * Configuración central de la API
 * Este archivo detecta automáticamente si estás en tu PC (localhost)
 * o en la nube (Netlify) para conectar con el servidor correcto.
 */

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'  // URL para desarrollo local
    : '/api';                      // URL para Netlify (Producción)

// Objeto Global API para centralizar las llamadas de todos los módulos
const API = {
    /**
     * Obtener lista de proveedores
     */
    getProviders: async () => {
        try {
            const response = await fetch(`${API_URL}/providers`);
            const data = await response.json();
            // Si la respuesta viene envuelta en un objeto { success: true, data: [...] }
            return data.data || data; 
        } catch (error) {
            console.error("🚨 Error en API.getProviders:", error);
            return [];
        }
    },

    /**
     * Guardar un nuevo proveedor
     */
    saveSupplier: async (supplierData) => {
        try {
            const response = await fetch(`${API_URL}/providers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(supplierData)
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Error en API.saveSupplier:", error);
            return { success: false, message: "No se pudo conectar con el servidor" };
        }
    },

    /**
     * ALIAS DE SEGURIDAD:
     * Esto evita el error "API.saveProvider is not a function" 
     * si se llama desde el HTML con el otro nombre.
     */
    saveProvider: async function(data) {
        return this.saveSupplier(data);
    }
};

// Log de confirmación
console.log(`🔌 Conectado a la API en: ${API_URL}`);