/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión Quirúrgica Final
 */

// Detectamos si estamos en local o en la nube para asignar la ruta base
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api'
    : '/.netlify/functions/server';

window.API = {
    url: API_BASE,

    // Función auxiliar para validar que la respuesta sea JSON y no HTML de error
    async _safeParse(response) {
        const contentType = response.headers.get("content-type");
        
        if (!response.ok) {
            // Si el servidor responde 404 o 500, lanzamos error con el estatus
            throw new Error(`Servidor respondió con estado ${response.status}`);
        }

        if (contentType && contentType.includes("application/json")) {
            return await response.json();
        } else {
            // Esto atrapa el error del símbolo '<' (cuando el servidor devuelve un HTML de error)
            throw new Error("El servidor devolvió un formato incorrecto (HTML en lugar de JSON).");
        }
    },

    // ==========================================
    // INVENTARIO
    // ==========================================
    getInventory: async function() {
        try {
            const response = await fetch(`${this.url}/inventory`);
            return await this._safeParse(response);
        } catch (err) { 
            console.error("Error en getInventory:", err);
            return { success: false, error: err.message }; 
        }
    },

    adjustStock: async function(data) {
        try {
            const response = await fetch(`${this.url}/inventory/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await this._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    deleteMaterial: async function(id) {
        try {
            const response = await fetch(`${this.url}/inventory/${id}`, {
                method: 'DELETE'
            });
            return await this._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    getHistory: async function(id) {
        try {
            const response = await fetch(`${this.url}/inventory/history/${id}`);
            return await this._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    // ==========================================
    // PROVEEDORES
    // ==========================================
    getProviders: async function() {
        try {
            const response = await fetch(`${this.url}/providers`);
            return await this._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    saveProvider: async function(providerData) {
        try {
            const response = await fetch(`${this.url}/providers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerData)
            });
            return await this._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    // ==========================================
    // COTIZACIONES
    // ==========================================
    getQuotes: async function() {
        try {
            const response = await fetch(`${this.url}/quotes`);
            return await this._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    // ==========================================
    // COMPRAS
    // ==========================================
    registerPurchase: async function(purchaseData) {
        try {
            const response = await fetch(`${this.url}/purchases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purchaseData)
            });
            return await this._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    savePurchase: async function(purchaseData) {
        return this.registerPurchase(purchaseData);
    }
};