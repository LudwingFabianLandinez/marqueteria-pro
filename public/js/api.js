const API_BASE = '/api';

window.API = {
    url: API_BASE,

    // ==========================================
    // INVENTARIO
    // ==========================================
    getInventory: async function() {
        try {
            const response = await fetch(`${this.url}/inventory`);
            return await response.json();
        } catch (err) { return { success: false, error: err.message }; }
    },

    adjustStock: async function(data) {
        try {
            const response = await fetch(`${this.url}/inventory/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (err) { return { success: false, error: err.message }; }
    },

    deleteMaterial: async function(id) {
        try {
            const response = await fetch(`${this.url}/inventory/${id}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (err) { return { success: false, error: err.message }; }
    },

    getHistory: async function(id) {
        try {
            const response = await fetch(`${this.url}/inventory/history/${id}`);
            return await response.json();
        } catch (err) { return { success: false, error: err.message }; }
    },

    // ==========================================
    // PROVEEDORES
    // ==========================================
    getProviders: async function() {
        try {
            const response = await fetch(`${this.url}/providers`);
            return await response.json();
        } catch (err) { return { success: false, error: err.message }; }
    },

    saveProvider: async function(providerData) {
        try {
            const response = await fetch(`${this.url}/providers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerData)
            });
            return await response.json();
        } catch (err) { return { success: false, error: err.message }; }
    },

    // ==========================================
    // COTIZACIONES
    // ==========================================
    getQuotes: async function() {
        try {
            const response = await fetch(`${this.url}/quotes`);
            return await response.json();
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
            return await response.json();
        } catch (err) { return { success: false, error: err.message }; }
    },

    savePurchase: async function(purchaseData) {
        return this.registerPurchase(purchaseData);
    }
};