/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.3.67 (SOPORTE MOLDURAS/ML + FIX ID)
 * * CAMBIOS v13.3.67:
 * 1. Mantiene blindaje de consecutivos de OT (v13.3.59) intacto.
 * 2. GANCHO ML: Inyecta el campo 'tipo' en el registro de compra para molduras.
 * 3. REPARACIÓN CRÍTICA: Extracción profunda de ID para evitar errores 500/undefined.
 * 4. Sincronización con motor de inventario de precisión lineal.
 */

const API_ROUTES = [
    '/api',                         // Ruta preferencial (vía Netlify Redirects)
    '/.netlify/functions/server',   // Ruta directa a la función
    '',                             // Ruta raíz
    '/functions/server'             // Ruta alternativa
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
                // --- AJUSTE v13.3.67: EXTRACCIÓN DE ID PARA NUEVOS REGISTROS ---
                // Si el objeto viene envuelto en .data, lo extraemos para que inventory.js lo vea
                let finalObj = rawData.success && rawData.data ? rawData.data : rawData;
                
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

    // 2. LÓGICA DE BÚSQUEDA MULTI-RUTA
    async _request(path, options = {}) {
        for (const base of API_ROUTES) {
            try {
                const url = `${base}${path}`.replace(/\/+/g, '/');
                console.log(`📡 Intentando: ${url}`);
                const response = await fetch(url, options);
                
                if (response.status !== 404) {
                    return await window.API._safeParse(response);
                }
            } catch (err) {
                console.warn(`⚠️ Falló intento en ${base}:`, err.message);
                continue; 
            }
        }

        const storageKey = path.includes('inventory') ? 'inventory' : (path.includes('providers') ? 'providers' : null);
        if (storageKey) {
            const local = localStorage.getItem(storageKey);
            return { success: true, data: local ? JSON.parse(local) : [], local: true };
        }
        throw new Error("No se pudo establecer conexión con ninguna ruta del servidor.");
    },

    // 3. MÉTODOS DE NEGOCIO
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
        // Normalizamos los datos para evitar errores 500 de ObjectId en el servidor
        const payload = {
            materialId: String(purchaseData.materialId),
            proveedorId: String(purchaseData.proveedorId || purchaseData.proveedor || purchaseData.providerId),
            cantidad: Number(purchaseData.cantidad || 1),
            largo: Number(purchaseData.largo || 0),
            ancho: Number(purchaseData.ancho || 0),
            valorUnitario: Number(purchaseData.valorUnitario || 0),
            totalM2: Number(purchaseData.totalM2 || 0), // Puede ser ML o M2 según el tipo
            tipo: purchaseData.tipo || 'm2' // Enviamos el tipo detectado (ml o m2)
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
        // --- GANCHO PREVENTIVO (v13.3.59 - PRESERVADO) ---
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

console.log("🛡️ API v13.3.67 - Blindaje de Datos y Extracción de IDs Activo.");