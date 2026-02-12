// 1. Definición de la URL Base (Sincronizada con Netlify y Local)
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:4000/api'
    : '/api'; // Esto usa el redireccionamiento de netlify.toml que configuramos

window.API = {
    url: API_BASE,

    getInventory: async function() {
        try {
            // Agregamos un log para ver en consola qué está pasando
            console.log(`📡 Solicitando inventario a: ${this.url}/inventory`);
            
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
            console.log(`📡 Solicitando proveedores a: ${this.url}/providers`);
            
            const response = await fetch(`${this.url}/providers`);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            const result = await response.json();
            
            // Mantenemos tu lógica de validación de éxito
            return result.success ? result.data : result;
        } catch (error) {
            console.error("🚨 Error proveedores:", error);
            return [];
        }
    }
};

// Log de confirmación de carga
console.log("🔌 API Blindada y Sincronizada en:", API_BASE);