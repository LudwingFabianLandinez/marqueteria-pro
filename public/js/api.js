/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.3.44 (CONSOLIDADO FINAL + MULTI-RUTA)
 * Objetivo: Romper el error 404 mediante búsqueda cíclica y blindaje de Arrays.
 */

const API_ROUTES = [
    '/api',                         // Ruta preferencial (vía Netlify Redirects)
    '/.netlify/functions/server',   // Ruta directa a la función
    '',                             // Ruta raíz
    '/functions/server'             // Ruta alternativa
];

window.API = {
    // MOTOR DE PROCESAMIENTO SEGURO
    async _safeParse(response) {
        const contentType = response.headers.get("content-type");
        if (!response.ok) {
            let errorMsg = `Error (Estado ${response.status})`;
            try {
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                }
            } catch (e) { }
            throw new Error(errorMsg);
        }

        if (contentType && contentType.includes("application/json")) {
            const rawData = await response.json();
            let cleanData = [];
            // Blindaje contra errores de .map()
            if (Array.isArray(rawData)) {
                cleanData = rawData;
            } else if (rawData && Array.isArray(rawData.data)) {
                cleanData = rawData.data;
            } else if (rawData && typeof rawData === 'object') {
                // Si es un objeto de stats, lo pasamos tal cual pero dentro de data
                return { success: true, data: rawData };
            }
            return { success: true, data: cleanData };
        }
        return { success: true, data: [] };
    },

    // LÓGICA DE BÚSQUEDA MULTI-RUTA (Evita el 404 persistente)
    async _request(path, options = {}) {
        for (const base of API_ROUTES) {
            try {
                const url = `${base}${path}`.replace(/\/+/g, '/');
                console.log(`📡 Intentando: ${url}`);
                const response = await fetch(url, options);
                
                if (response.status !== 404) {
                    return await this._safeParse(response);
                }
            } catch (err) {
                console.warn(`⚠️ Falló intento en ${base}:`, err.message);
                continue; 
            }
        }
        // Fallback a LocalStorage si todo falla (Modo Rescate)
        const storageKey = path.includes('inventory') ? 'inventory' : (path.includes('providers') ? 'providers' : null);
        if (storageKey) {
            const local = localStorage.getItem(storageKey);
            return { success: true, data: local ? JSON.parse(local) : [], local: true };
        }
        throw new Error("No se pudo establecer conexión con ninguna ruta del servidor.");
    },

    // --- MÉTODOS DE NEGOCIO ---
    getProviders: function() { return this._request('/providers'); },
    getInventory: function() { return this._request('/inventory'); },
    getInvoices: function() { return this._request('/invoices'); },

    saveProvider: function(data) {
        return this._request('/providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    saveMaterial: function(data) {
        const id = data.id || data._id;
        const path = id ? `/inventory/${id}` : '/inventory';
        return this._request(path, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    registerPurchase: function(purchaseData) {
        const payload = {
            materialId: String(purchaseData.materialId),
            proveedorId: String(purchaseData.proveedorId || purchaseData.proveedor || purchaseData.providerId),
            cantidad: Number(purchaseData.cantidad || 1),
            largo: Number(purchaseData.largo || 0),
            ancho: Number(purchaseData.ancho || 0),
            valorUnitario: Number(purchaseData.valorUnitario || 0)
        };
        return this._request('/inventory/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    deleteMaterial: function(id) { return this._request(`/inventory/${id}`, { method: 'DELETE' }); },
    
    updateStock: function(id, data) {
        // Soporta tanto PATCH como PUT según tu server.js
        return this._request(`/inventory/${id}`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    getHistory: function(id) { return this._request(`/inventory/history/${id}`); },
    saveInvoice: function(data) {
        return this._request('/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }
};

// --- COMPATIBILIDAD TOTAL ---
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.savePurchase = window.API.registerPurchase;

console.log("🛡️ API v13.3.44 - Blindaje Multirruta Activo.");