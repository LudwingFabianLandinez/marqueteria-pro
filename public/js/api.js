/**
 * Configuración central de la API - Blindada
 * Detecta el entorno y asegura que las funciones existan siempre.
 */

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'  // Desarrollo local
    : 'https://tu-servidor-backend.com/api'; // <--- ASEGÚRATE DE PONER TU URL REAL DE RENDER/RAILWAY AQUÍ

// Objeto Global API
const API = {
    /**
     * Obtener lista de proveedores
     */
    getProviders: async () => {
        try {
            console.log("📡 Solicitando proveedores a:", `${API_URL}/providers`);
            const response = await fetch(`${API_URL}/providers`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(supplierData)
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Error en API.saveSupplier:", error);
            return { success: false, message: "Error de conexión" };
        }
    },

    /**
     * ALIAS DE SEGURIDAD (Mapeo de nombres)
     * Estos nombres aseguran que si el HTML llama a la función de forma distinta, NO se rompa.
     */
    saveProvider: async function(data) { return this.saveSupplier(data); },
    getSuppliers: async function() { return this.getProviders(); }
};

// Hacer que API sea accesible globalmente de forma explícita
window.API = API;

console.log(`🔌 API configurada en: ${API_URL}`);