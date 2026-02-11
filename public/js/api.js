/**
 * Configuración central de la API - Versión de Supervivencia
 * Cambiamos const por var para evitar bloqueos por re-declaración.
 */

var API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://tu-servidor-backend.com/api'; // <--- Cambia esto cuando tengas tu URL real

// Usamos window.API directamente para asegurar disponibilidad global
window.API = {
    /**
     * Obtener lista de proveedores
     */
    getProviders: async function() {
        try {
            console.log("📡 Solicitando proveedores a:", API_URL + "/providers");
            const response = await fetch(API_URL + "/providers");
            if (!response.ok) throw new Error("Error en respuesta");
            const data = await response.json();
            return data.data || data; 
        } catch (error) {
            console.error("🚨 Error en API.getProviders:", error);
            return []; // Retorna lista vacía para no romper el HTML
        }
    },

    /**
     * Guardar un nuevo proveedor
     */
    saveSupplier: async function(supplierData) {
        try {
            const response = await fetch(API_URL + "/providers", {
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
     * ALIAS DE SEGURIDAD
     */
    saveProvider: async function(data) { return this.saveSupplier(data); },
    getSuppliers: async function() { return this.getProviders(); }
};

console.log("🔌 API cargada correctamente en: " + API_URL);