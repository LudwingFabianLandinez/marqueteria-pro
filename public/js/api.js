/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión Quirúrgica con Respaldo Local
 */

// Intentamos la ruta de Netlify, pero el sistema ahora es inteligente:
const API_BASE = '/.netlify/functions/server';

window.API = {
    url: API_BASE,

    // Función auxiliar para validar respuestas
    async _safeParse(response) {
        if (!response.ok) {
            throw new Error(`Servidor no disponible (Estado ${response.status})`);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await response.json();
        }
        throw new Error("Formato incorrecto");
    },

    // ==========================================
    // PROVEEDORES (Con "Escudo de Memoria Local")
    // ==========================================
    getProviders: async function() {
        try {
            const response = await fetch(`${this.url}/providers`);
            const result = await this._safeParse(response);
            return result;
        } catch (err) { 
            console.warn("⚠️ Servidor no encontrado (404). Usando Memoria Local para Proveedores.");
            // Respaldo: Si el servidor falla, lee de la memoria del navegador
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
            return await this._safeParse(response);
        } catch (err) {
            console.warn("⚠️ Guardando en Memoria Local debido a error de servidor.");
            // Respaldo: Guarda en la memoria del navegador
            const localData = localStorage.getItem('db_proveedores');
            let lista = localData ? JSON.parse(localData) : [];
            lista.push(providerData);
            localStorage.setItem('db_proveedores', JSON.stringify(lista));
            return { success: true, local: true };
        }
    },

    // Alias de compatibilidad
    getSuppliers: function() { return this.getProviders(); },
    saveSupplier: function(data) { return this.saveProvider(data); },

    // ==========================================
    // RESTO DE FUNCIONES (ESTADÍSTICAS E INVENTARIO)
    // ==========================================
    getDashboardStats: async function() {
        try {
            const response = await fetch(`${this.url}/stats`);
            return await this._safeParse(response);
        } catch (err) { 
            return { success: false, error: "Servidor offline" }; 
        }
    },

    getInventory: async function() {
        try {
            const response = await fetch(`${this.url}/inventory`);
            return await this._safeParse(response);
        } catch (err) { return { success: false, error: "Servidor offline" }; }
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

    generateQuote: async function(quoteData) {
        try {
            const response = await fetch(`${this.url}/quotes/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteData)
            });
            return await this._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    // Mantener el resto de funciones según tu código original...
    getInvoices: async function() { try { const r = await fetch(`${this.url}/invoices`); return await this._safeParse(r); } catch(e){return {success:false}} },
    saveInvoice: async function(d) { try { const r = await fetch(`${this.url}/invoices`,{method:'POST',body:JSON.stringify(d)}); return await this._safeParse(r); } catch(e){return {success:false}} }
};

console.log("🚀 API Sincronizada: Modo Híbrido (Nube + Memoria Local) Activo.");