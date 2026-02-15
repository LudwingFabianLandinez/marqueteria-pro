/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión Final con Blindaje de Errores e Historial
 */

// La ruta raíz de tus funciones en Netlify
const API_BASE = '/.netlify/functions/server';

window.API = {
    url: API_BASE,

    // Función auxiliar para validar respuestas y evitar el error "Unexpected token <"
    async _safeParse(response) {
        if (!response.ok) {
            throw new Error(`Servidor no disponible (Estado ${response.status})`);
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
    // PROVEEDORES (Híbrido)
    // ==========================================
    getProviders: async function() {
        try {
            const response = await fetch(`${this.url}/providers`);
            // CAMBIO QUIRÚRGICO: Usamos window.API para asegurar la función
            return await window.API._safeParse(response);
        } catch (err) { 
            console.warn("⚠️ Usando Respaldo Local para Proveedores.");
            const localData = localStorage.getItem('db_proveedores');
            const lista = localData ? JSON.parse(localData) : [];
            return { success: true, data: lista, local: true }; 
        }
    },

    saveProvider: async function(providerData) {
        try {
            const response = await fetch(`${this.url}/providers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerData)
            });
            // CAMBIO QUIRÚRGICO: Usamos window.API para evitar error "this._safeParse is not a function"
            return await window.API._safeParse(response);
        } catch (err) {
            console.error("🚨 ERROR REAL DE CONEXIÓN:", err);
            throw err; 
        }
    },

    // ==========================================
    // INVENTARIO Y HISTORIAL
    // ==========================================
    getInventory: async function() {
        try {
            const response = await fetch(`${this.url}/inventory`);
            return await window.API._safeParse(response);
        } catch (err) { 
            console.error("🚨 Error cargando inventario:", err);
            const localInv = localStorage.getItem('db_materiales');
            return { 
                success: true, 
                data: localInv ? JSON.parse(localInv) : [], 
                local: true 
            }; 
        }
    },

    getHistory: async function() {
        try {
            const response = await fetch(`${this.url}/inventory/history`);
            return await window.API._safeParse(response);
        } catch (err) { 
            console.warn("⚠️ Error en historial, devolviendo vacío.");
            return { success: true, data: [] }; 
        }
    },

    adjustStock: async function(data) {
        try {
            const response = await fetch(`${this.url}/inventory/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    // ==========================================
    // ESTADÍSTICAS Y FACTURACIÓN
    // ==========================================
    getDashboardStats: async function() {
        try {
            const response = await fetch(`${this.url}/stats`);
            return await window.API._safeParse(response);
        } catch (err) { 
            return { success: true, data: { totalVentas: 0, productosBajos: 0 }, local: true }; 
        }
    },

    getInvoices: async function() { 
        try { 
            const r = await fetch(`${this.url}/invoices`); 
            return await window.API._safeParse(r); 
        } catch(e) { return { success: true, data: [] }; } 
    },

    saveInvoice: async function(d) { 
        try { 
            const r = await fetch(`${this.url}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(d)
            }); 
            return await window.API._safeParse(r); 
        } catch(e) { return { success: false }; } 
    },

    generateQuote: async function(quoteData) {
        try {
            const response = await fetch(`${this.url}/quotes/generate`, {
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

console.log("🚀 API Híbrida Protegida (con Historial) cargada correctamente.");