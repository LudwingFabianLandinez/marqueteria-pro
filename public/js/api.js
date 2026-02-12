// Detecta si estás trabajando en tu PC o si ya estás en la web real
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:4000/api' 
    : 'https://marqueteria-pro.onrender.com/api';

window.API = {
    url: API_BASE,

    getInventory: async function() {
        try {
            console.log(`📡 Pidiendo inventario a: ${this.url}/inventory`);
            const response = await fetch(`${this.url}/inventory`);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("🚨 Error en getInventory:", error);
            return { success: false, data: [] };
        }
    },

    getProviders: async function() {
        try {
            console.log(`📡 Solicitando proveedores a: ${this.url}/providers`);
            const response = await fetch(`${this.url}/providers`);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("🚨 Error en getProviders:", error);
            return [];
        }
    }
};