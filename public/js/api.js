const API_BASE = '/api'; // Configuración para Netlify

window.API = {
    url: API_BASE,

    // BOTÓN INVENTARIO
    getInventory: async function() {
        const response = await fetch(`${this.url}/inventory`);
        return await response.json();
    },

    // BOTÓN PROVEEDORES
    getProviders: async function() {
        const response = await fetch(`${this.url}/providers`);
        return await response.json();
    },

    // BOTÓN COTIZACIONES
    getQuotes: async function() {
        const response = await fetch(`${this.url}/quotes`);
        return await response.json();
    }
};