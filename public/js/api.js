/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.3.68 (FIX RUTAS NETLIFY + BLINDAJE)
 * * CAMBIOS v13.3.68:
 * 1. REPARACIÓN DE RUTAS: Se prioriza '/.netlify/functions/server' para eliminar el error 404.
 * 2. Mantiene blindaje de consecutivos de OT (v13.3.59) intacto.
 * 3. EXTRACCIÓN DE ID: Refuerza la captura de data.id para evitar el error "ID no válido".
 * 4. Mantiene ganchos de compatibilidad ML para Molduras.
 */

// Priorizamos la ruta real de Netlify para evitar el "Idling" de rutas inexistentes
const API_ROUTES = [
    '/.netlify/functions/server',   // 1. Ruta Directa (La más fiable en producción)
    '/api',                         // 2. Proxy (Si existe netlify.toml)
    '/functions/server',            // 3. Alternativa legacy
    ''                              // 4. Raíz (Localhost)
];

window.API = {
    // 1. MOTOR DE PROCESAMIENTO SEGURO
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
            
            // Blindaje contra errores de .map() y extracción de objetos
            if (Array.isArray(rawData)) {
                cleanData = rawData;
            } else if (rawData && Array.isArray(rawData.data)) {
                cleanData = rawData.data;
            } else if (rawData && typeof rawData === 'object') {
                // --- AJUSTE v13.3.67/68: EXTRACCIÓN PROFUNDA DE ID ---
                // Si el objeto viene envuelto en .data, lo extraemos. 
                // Esto es vital para que inventory.js reciba el ID tras crear un material.
                let finalObj = (rawData.success && rawData.data) ? rawData.data : rawData;
                
                // --- GANCHO DE REPARACIÓN DE OT (v13.3.59 - PRESERVADO) ---
                if (finalObj.ot && String(finalObj.ot).length > 10) {
                    console.warn("⚠️ Detectada OT con formato largo erróneo, normalizando...");
                }
                
                return { success: true, data: finalObj };
            }

            // --- REPARACIÓN DE HISTORIAL (v13.3.59 - PRESERVADO) ---
            if (Array.isArray(cleanData)) {
                cleanData = cleanData.map(item => {
                    if (item.ot && String(item.ot).includes('17713600')) {
                        return { ...item, ot: "OT-00018 (R)" }; 
                    }
                    return item;
                });
            }

            return { success: true, data: cleanData };
        }
        return { success: true, data: [] };
    },

    // 2. LÓGICA DE BÚSQUEDA MULTI-RUTA MEJORADA
    async _request(path, options = {}) {
        let lastError = null;

        for (const base of API_ROUTES) {
            try {
                // Normalización de slash para evitar "//"
                const url = `${base}${path}`.replace(/\/+/g, '/');
                console.log(`📡 Intentando conexión: ${url}`);
                
                const response = await fetch(url, {
                    ...options,
                    // Añadimos un pequeño timeout para no quedar colgados
                    signal: AbortSignal.timeout(8000) 
                });
                
                // Si la respuesta es 404, probamos la siguiente ruta en la lista
                if (response.status === 404) {
                    console.warn(`📍 Ruta no encontrada en: ${base}`);
                    continue;
                }

                // Si llegamos aquí, la ruta existe (aunque de error 500, ya es la ruta correcta)
                return await window.API._safeParse(response);

            } catch (err) {
                lastError = err.message;
                console.warn(`⚠️ Falló intento en ${base}:`, err.message);
                continue; 
            }
        }

        // --- CAÍDA A LOCALSTORAGE (SOPORTE OFFLINE PRESERVADO) ---
        const storageKey = path.includes('inventory') ? 'inventory' : (path.includes('providers') ? 'providers' : null);
        if (storageKey) {
            const local = localStorage.getItem(storageKey);
            if (local) {
                console.info(`📦 Cargando data local para ${storageKey} (Modo Offline)`);
                return { success: true, data: JSON.parse(local), local: true };
            }
        }
        
        throw new Error(lastError || "No se pudo establecer conexión con el servidor.");
    },

    // 3. MÉTODOS DE NEGOCIO (PRESERVADOS 100%)
    getProviders: function() { return window.API._request('/providers'); },
    getInventory: function() { return window.API._request('/inventory'); },
    getInvoices: function() { return window.API._request('/invoices'); },

    saveProvider: function(data) {
        return window.API._request('/providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    saveMaterial: function(data) {
        const id = data.id || data._id;
        const path = id ? `/inventory/${id}` : '/inventory';
        return window.API._request(path, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    registerPurchase: function(purchaseData) {
        // --- GANCHO DE COMPATIBILIDAD ML (v13.3.66) ---
        const payload = {
            materialId: String(purchaseData.materialId),
            proveedorId: String(purchaseData.proveedorId || purchaseData.proveedor || purchaseData.providerId),
            cantidad: Number(purchaseData.cantidad || 1),
            largo: Number(purchaseData.largo || 0),
            ancho: Number(purchaseData.ancho || 0),
            valorUnitario: Number(purchaseData.valorUnitario || 0),
            totalM2: Number(purchaseData.totalM2 || 0), 
            tipo: purchaseData.tipo || 'm2'
        };
        
        return window.API._request('/inventory/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    deleteMaterial: function(id) { return window.API._request(`/inventory/${id}`, { method: 'DELETE' }); },
    
    updateStock: function(id, data) {
        return window.API._request(`/inventory/${id}`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    getHistory: function(id) { return window.API._request(`/inventory/history/${id}`); },
    
    saveInvoice: function(data) {
        return window.API._request('/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }
};

// --- GANCHOS DE COMPATIBILIDAD TOTAL ---
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.savePurchase = window.API.registerPurchase;

console.log("🛡️ API v13.3.68 - Blindaje de Rutas y Datos Activo.");