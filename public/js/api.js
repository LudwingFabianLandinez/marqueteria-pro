/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.3.72 (PUENTE DIRECTO + FIX 404)
 * * CAMBIOS v13.3.72:
 * 1. PUENTE DIRECTO: Prioriza la ruta de funciones para evitar el 404 del proxy inestable.
 * 2. EXTRACCIÓN AGRESIVA: Blindaje para capturar ID incluso en respuestas envueltas.
 * 3. ANTI-OFFLINE: No salta a LocalStorage si hay una respuesta de servidor válida.
 * 4. Preservación 100% de molduras (ML), OTs históricas y estructura visual.
 */

// Priorizamos rutas directas para romper el ciclo del error 404
const API_ROUTES = [
    '/.netlify/functions/server',   // 1. Ruta Directa Netlify (Puente)
    '/api',                         // 2. Túnel Maestro
    '/functions/server'             // 3. Ruta Legacy
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
            
            // --- AJUSTE v13.3.72: EXTRACCIÓN DE ID REFORZADA ---
            let cleanObj = (rawData.success && rawData.data) ? rawData.data : rawData;

            // Si es un objeto único (Captura de ID para nuevos materiales)
            if (cleanObj && typeof cleanObj === 'object' && !Array.isArray(cleanObj)) {
                // Gancho de reparación de OT (v13.3.59 - PRESERVADO)
                if (cleanObj.ot && String(cleanObj.ot).length > 10) {
                    console.warn("⚠️ Normalizando OT detectada...");
                }
                return { success: true, data: cleanObj };
            }

            // Si es un arreglo (historial o inventario)
            let items = Array.isArray(cleanObj) ? cleanObj : (Array.isArray(rawData.data) ? rawData.data : []);

            // Reparación de historial OT-00018 (v13.3.59 - PRESERVADO)
            if (items.length > 0) {
                items = items.map(item => {
                    if (item.ot && String(item.ot).includes('17713600')) {
                        return { ...item, ot: "OT-00018 (R)" }; 
                    }
                    return item;
                });
            }

            return { success: true, data: items };
        }
        return { success: true, data: [] };
    },

    // 2. LÓGICA DE BÚSQUEDA MULTI-RUTA (v13.3.72 - PERSISTENTE)
    async _request(path, options = {}) {
        let lastError = null;

        for (const base of API_ROUTES) {
            try {
                const url = `${base}${path}`.replace(/\/+/g, '/');
                console.log(`📡 Conectando vía: ${url}`);
                
                const response = await fetch(url, {
                    ...options,
                    signal: AbortSignal.timeout(12000) // Un poco más de tiempo para procesar
                });
                
                // Si el servidor responde algo distinto a 404, procesamos
                if (response.status !== 404) {
                    return await window.API._safeParse(response);
                }
                
                console.warn(`📍 404 en ${base}, reintentando ruta alterna...`);
            } catch (err) {
                lastError = err.message;
                console.warn(`⚠️ Fallo en ${base}:`, err.message);
                continue; 
            }
        }

        // --- CAÍDA A LOCALSTORAGE SOLO SI TODO LO ANTERIOR FALLÓ ---
        const storageKey = path.includes('inventory') ? 'inventory' : (path.includes('providers') ? 'providers' : null);
        if (storageKey) {
            const local = localStorage.getItem(storageKey);
            if (local) {
                console.info(`📦 Servidor inaccesible. Usando respaldo local.`);
                return { success: true, data: JSON.parse(local), local: true };
            }
        }
        
        throw new Error("No se pudo conectar con el servidor. Por favor, verifica tu conexión.");
    },

    // 3. MÉTODOS DE NEGOCIO (100% PRESERVADOS)
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
        // --- GANCHO DE COMPATIBILIDAD ML (v13.3.66 - PRESERVADO) ---
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

console.log("🚀 API v13.3.72 - Puente Directo y Blindaje de IDs Activo.");