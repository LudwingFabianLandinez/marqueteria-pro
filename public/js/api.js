// Forzamos a que el sistema busque en tu propio Netlify
const API_BASE = '/api'; 

window.API = {
    url: API_BASE,

    getInventory: async function() {
        try {
            console.log("📡 Solicitando Inventario a Netlify Functions...");
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
            console.log("📡 Solicitando Proveedores a Netlify Functions...");
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

console.log("✅ API unificada en Netlify lista.");