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

    // ==========================================
    // PROVEEDORES (Consultas y Registro)
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
    // COMPRAS (Para el modal de Nueva Compra)
    // ==========================================
    savePurchase: async function(purchaseData) {
        try {
            const response = await fetch(`${this.url}/purchases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purchaseData)
            });
            return await response.json();
        } catch (err) { return { success: false, error: err.message }; }
    }
};