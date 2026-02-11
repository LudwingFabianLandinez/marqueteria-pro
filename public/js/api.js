/**
 * Configuración central de la API - Versión Final de Supervivencia
 * Cambiamos const por var para evitar bloqueos por re-declaración.
 */

var API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://marqueteria-pro.onrender.com/api'; // <--- He puesto la URL que parece ser tu backend de Render

// Usamos window.API directamente para asegurar disponibilidad global
window.API = {
    /**
     * Obtener lista de proveedores
     */
    getProviders: async function() {
        try {
            console.log("📡 Solicitando proveedores a:", API_URL + "/providers");
            const response = await fetch(API_URL + "/providers");
            if (!response.ok) throw new Error("Error en respuesta");
            const data = await response.json();
            return data.data || data; 
        } catch (error) {
            console.error("🚨 Error en API.getProviders:", error);
            return []; // Retorna lista vacía para no romper el HTML
        }
    },

    /**
     * Guardar un nuevo proveedor
     */
    saveSupplier: async function(supplierData) {
        try {
            const response = await fetch(API_URL + "/providers", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(supplierData)
            });
            return await response.json();
        } catch (error) {
            console.error("🚨 Error en API.saveSupplier:", error);
            return { success: false, message: "Error de conexión" };
        }
    },

    /**
     * FUNCIÓN DE EMERGENCIA PARA EL BOTÓN AZUL
     * Esto asegura que abrirAgenda() siempre encuentre qué hacer.
     */
    abrirAgendaGlobal: function() {
        console.log("🚀 Ejecutando apertura de agenda desde API global...");
        const modal = document.getElementById('modalAgenda');
        if (modal) {
            modal.style.display = 'block';
            // Intentamos renderizar si la función existe en inventory.js
            if (typeof window.renderAgendaProveedores === 'function') {
                window.renderAgendaProveedores();
            } else {
                console.warn("⚠️ renderAgendaProveedores no encontrada, el modal estará vacío.");
                // Opcional: podrías poner un mensaje de "Cargando..." dentro del modal aquí
            }
        } else {
            console.error("❌ No se encontró el elemento modalAgenda en el HTML.");
            window.location.href = 'suppliers.html';
        }
    },

    /**
     * ALIAS DE SEGURIDAD
     */
    saveProvider: async function(data) { return this.saveSupplier(data); },
    getSuppliers: async function() { return this.getProviders(); }
};

// Inyectamos la función en el scope global por si el dashboard la busca allí
window.abrirAgenda = function() {
    window.API.abrirAgendaGlobal();
};

console.log("🔌 API cargada correctamente en: " + API_URL);