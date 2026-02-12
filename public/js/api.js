/**
 * Configuración central de la API - Versión Blindada v4.3
 * Sincronizada para evitar errores 500 en Netlify y bloqueos de inventario.
 */

var API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:4000/api'
    : 'https://marqueteria-pro.onrender.com/api';

// REFUERZO DE SEGURIDAD: Si no es localhost, forzamos que use Render 
if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    API_URL = 'https://marqueteria-pro.onrender.com/api';
}

// Objeto Global de API
window.API = {
    // Guardamos la URL dentro del objeto para que otros scripts la consulten si es necesario
    url: API_URL,

    /**
     * Obtener lista de materiales (Inventario)
     */
    getInventory: async function() {
        try {
            console.log("📡 Pidiendo inventario a:", this.url + "/inventory");
            const response = await fetch(this.url + "/inventory");
            if (!response.ok) throw new Error("Error cargando inventario");
            return await response.json();
        } catch (error) {
            console.error("🚨 Error en API.getInventory:", error);
            return { success: false, data: [] };
        }
    },

    /**
     * Obtener lista de proveedores
     */
    getProviders: async function() {
        try {
            console.log("📡 Solicitando proveedores a:", this.url + "/providers");
            const response = await fetch(this.url + "/providers");
            if (!response.ok) throw new Error("Error en respuesta de proveedores");
            const result = await response.json();
            return result.success ? result.data : (Array.isArray(result) ? result : []);
        } catch (error) {
            console.error("🚨 Error en API.getProviders:", error);
            return [];
        }
    },

    /**
     * Guardar un nuevo proveedor
     */
    saveSupplier: async function(supplierData) {
        try {
            const response = await fetch(this.url + "/providers", {
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
     * Registrar una compra (Entrada de stock)
     */
    registerPurchase: async function(purchaseData) {
        try {
            const response = await fetch(this.url + "/inventory/purchase", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purchaseData)
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Error en API.registerPurchase:", error);
            return { success: false };
        }
    },

    /**
     * Ajustar stock manualmente
     */
    adjustStock: async function(adjustData) {
        try {
            const response = await fetch(this.url + "/inventory/adjust", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(adjustData)
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Error en API.adjustStock:", error);
            return { success: false };
        }
    },

    /**
     * Obtener historial de movimientos de un material
     */
    getHistory: async function(id) {
        try {
            const response = await fetch(`${this.url}/inventory/history/${id}`);
            return await response.json();
        } catch (error) {
            console.error("🚨 Error en API.getHistory:", error);
            return { success: false, data: [] };
        }
    },

    // Alias de compatibilidad
    saveProvider: async function(data) { return this.saveSupplier(data); },
    getSuppliers: async function() { return this.getProviders(); }
};

console.log("🔌 API Blindada y Sincronizada en: " + window.API.url);