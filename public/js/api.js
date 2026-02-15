/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 9.8.0 con Blindaje y Compras
 */

// La ruta raíz de tus funciones en Netlify
const API_BASE = '/.netlify/functions/server';

window.API = {
    url: API_BASE,

    // Función auxiliar para validar respuestas y evitar el error "Unexpected token <"
    async _safeParse(response) {
        if (!response.ok) {
            // Si el estado es 400, intentamos leer el mensaje de error del backend
            try {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error del servidor (Estado ${response.status})`);
            } catch (e) {
                throw new Error(`Servidor no disponible (Estado ${response.status})`);
            }
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            // Normalizamos la respuesta: si el backend envía el array directo, lo envolvemos
            return Array.isArray(data) ? { success: true, data: data } : data;
        }
        
        throw new Error("El servidor respondió con HTML/Texto en lugar de JSON. Revisa la ruta.");
    },

    // ==========================================
    // PROVEEDORES
    // ==========================================
    getProviders: async function() {
        try {
            const response = await fetch(`${window.API.url}/providers`);
            return await window.API._safeParse(response);
        } catch (err) { 
            console.warn("⚠️ Usando Respaldo Local para Proveedores.");
            const localData = localStorage.getItem('providers'); // Usamos el mismo key que inventory.js
            const lista = localData ? JSON.parse(localData) : [];
            return { success: true, data: lista, local: true }; 
        }
    },

    saveProvider: async function(providerData) {
        try {
            const response = await fetch(`${window.API.url}/providers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerData)
            });
            return await window.API._safeParse(response);
        } catch (err) {
            console.error("🚨 ERROR REAL DE CONEXIÓN:", err);
            throw err; 
        }
    },

    // ==========================================
    // INVENTARIO, COMPRAS Y AJUSTES
    // ==========================================
    getInventory: async function() {
        try {
            const response = await fetch(`${window.API.url}/inventory`);
            return await window.API._safeParse(response);
        } catch (err) { 
            console.error("🚨 Error cargando inventario:", err);
            const localInv = localStorage.getItem('inventory');
            return { 
                success: true, 
                data: localInv ? JSON.parse(localInv) : [], 
                local: true 
            }; 
        }
    },

    // NUEVA: Registro de compras (Entrada de mercancía)
    registerPurchase: async function(purchaseData) {
        try {
            const response = await fetch(`${window.API.url}/inventory/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purchaseData)
            });
            return await window.API._safeParse(response);
        } catch (err) {
            console.error("🚨 Error en registro de compra:", err);
            throw err;
        }
    },

    adjustStock: async function(data) {
        try {
            const response = await fetch(`${window.API.url}/inventory/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    deleteMaterial: async function(id) {
        try {
            const response = await fetch(`${window.API.url}/inventory/${id}`, {
                method: 'DELETE'
            });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    // ==========================================
    // HISTORIALES
    // ==========================================
    // Modificada para aceptar ID y obtener historial específico
    getHistory: async function(materialId = null) {
        try {
            const url = materialId 
                ? `${window.API.url}/inventory/history/${materialId}` 
                : `${window.API.url}/inventory/history`;
            const response = await fetch(url);
            return await window.API._safeParse(response);
        } catch (err) { 
            console.warn("⚠️ Error en historial, devolviendo vacío.");
            return { success: true, data: [] }; 
        }
    },

    // ==========================================
    // ESTADÍSTICAS Y FACTURACIÓN
    // ==========================================
    getDashboardStats: async function() {
        try {
            const response = await fetch(`${window.API.url}/stats`);
            return await window.API._safeParse(response);
        } catch (err) { 
            return { success: true, data: { totalVentas: 0, productosBajos: 0 }, local: true }; 
        }
    },

    getInvoices: async function() { 
        try { 
            const r = await fetch(`${window.API.url}/invoices`); 
            return await window.API._safeParse(r); 
        } catch(e) { return { success: true, data: [] }; } 
    },

    saveInvoice: async function(d) { 
        try { 
            const r = await fetch(`${window.API.url}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(d)
            }); 
            return await window.API._safeParse(r); 
        } catch(e) { return { success: false }; } 
    },

    generateQuote: async function(quoteData) {
        try {
            const response = await fetch(`${window.API.url}/quotes/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteData)
            });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    }
};

// ==========================================
// BLOQUE DE COMPATIBILIDAD (Sincronización Total)
// ==========================================
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.getStats = window.API.getDashboardStats;
window.API.savePurchase = window.API.registerPurchase; // Alias de seguridad

console.log("🚀 API v9.8.0 - Conexión total establecida.");