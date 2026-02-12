/**
 * Configuración central de la API - Versión Blindada v4.2
 * Forzamos la conexión directa a Render para evitar errores 500 en Netlify.
 */

var API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:4000/api'
    : 'https://marqueteria-pro.onrender.com/api';

// REFUERZO DE SEGURIDAD: Si no es localhost, forzamos que use Render 
// Esto evita que Netlify intente resolver la ruta internamente.
if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    API_URL = 'https://marqueteria-pro.onrender.com/api';
}

// Objeto Global de API
window.API = {
    /**
     * Obtener lista de materiales (Inventario)
     */
    getInventory: async function() {
        try {
            const response = await fetch(API_URL + "/inventory");
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
            console.log("📡 Solicitando proveedores a:", API_URL + "/providers");
            const response = await fetch(API_URL + "/providers");
            if (!response.ok) throw new Error("Error en respuesta de proveedores");
            const result = await response.json();
            // Normalizamos la respuesta para que siempre devuelva un array
            return result.success ? result.data : (Array.isArray(result) ? result : []);
        } catch (error) {
            console.error("🚨 Error en API.getProviders:", error);
            return [];
        }
    },

    /**
     * Guardar un nuevo proveedor (desde suppliers.html)
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
     * Registrar una compra (Entrada de stock)
     */
    registerPurchase: async function(purchaseData) {
        try {
            const response = await fetch(API_URL + "/inventory/purchase", {
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
            const response = await fetch(API_URL + "/inventory/adjust", {
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

    // Alias de compatibilidad
    saveProvider: async function(data) { return this.saveSupplier(data); },
    getSuppliers: async function() { return this.getProviders(); }
};

console.log("🔌 API Blindada y lista en: " + API_URL);