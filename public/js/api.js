const API_BASE = 'https://marqueteria-pro.onrender.com/api';

window.API = {
    url: API_BASE,

    getInventory: async function() {
        try {
            const response = await fetch(`${this.url}/inventory`);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("🚨 Error inventario:", error);
            return { success: false, data: [] };
        }
    },

    getProviders: async function() {
        try {
            const response = await fetch(`${this.url}/providers`);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            const result = await response.json();
            return result.success ? result.data : result;
        } catch (error) {
            console.error("🚨 Error proveedores:", error);
            return [];
        }
    }
};