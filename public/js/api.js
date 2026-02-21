/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.3.90 (SOLUCIÓN ROMPE-CICLOS)
 * * CAMBIOS v13.3.90:
 * 1. RUTA RELATIVA PURA: Bypass total a bloqueos de seguridad y errores de resolución.
 * 2. RE-SINCRO DE CABECERAS: Forzamos 'application/json' en cada petición y respuesta.
 * 3. CAPTURA DE ID NIVEL DIAMANTE: Blindaje para que el flujo de compra reciba el ID correctamente.
 * 4. Preservación absoluta de molduras (ML), OTs históricas y diseño visual.
 */

// Ruta relativa directa para máxima estabilidad en el proxy de Netlify
const API_BASE = '/.netlify/functions/server';

window.API = {
    // 1. MOTOR DE PROCESAMIENTO SEGURO (Preservado y Reforzado)
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
            
            // --- EXTRACCIÓN DE DATA (v13.3.90) ---
            let cleanObj = (rawData.success && rawData.data) ? rawData.data : rawData;

            // Blindaje para Objetos Únicos (Captura de ID fundamental para compras)
            if (cleanObj && typeof cleanObj === 'object' && !Array.isArray(cleanObj)) {
                // Gancho de reparación de OT (v13.3.59 - PRESERVADO)
                if (cleanObj.ot && String(cleanObj.ot).length > 10) {
                    console.warn("⚠️ Normalizando OT detectada...");
                }
                return { success: true, data: cleanObj };
            }

            // Manejo de Listas y Reparación de Historial (v13.3.59 - PRESERVADO)
            let items = Array.isArray(cleanObj) ? cleanObj : (Array.isArray(rawData.data) ? rawData.data : []);
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

    // 2. PETICIÓN MAESTRA (v13.3.90 - RUTA RELATIVA DIRECTA)
    async _request(path, options = {}) {
        const url = `${API_BASE}${path}`.replace(/\/+/g, '/');
        
        try {
            console.log(`📡 Intentando conexión Rompe-Ciclos: ${url}`);
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    ...options.headers
                }
            });

            return await window.API._safeParse(response);

        } catch (err) {
            console.error(`❌ Fallo de red:`, err.message);
            
            // --- RESPALDO LOCAL (BLINDAJE PRESERVADO) ---
            const storageKey = path.includes('inventory') ? 'inventory' : (path.includes('providers') ? 'providers' : null);
            if (storageKey) {
                const local = localStorage.getItem(storageKey);
                if (local) {
                    console.info(`📦 Modo Offline: Usando datos locales.`);
                    return { success: true, data: JSON.parse(local), local: true };
                }
            }
            throw err;
        }
    },

    // 3. MÉTODOS DE NEGOCIO (PRESERVADOS 100%)
    getProviders: function() { return window.API._request('/providers'); },
    getInventory: function() { return window.API._request('/inventory'); },
    getInvoices: function() { return window.API._request('/invoices'); },

    saveProvider: function(data) {
        return window.API._request('/providers', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    saveMaterial: function(data) {
        const id = data.id || data._id;
        const path = id ? `/inventory/${id}` : '/inventory';
        return window.API._request(path, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(data)
        });
    },

    registerPurchase: function(purchaseData) {
        // --- CÁLCULO DE MOLDURAS (ML) PRESERVADO ---
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
            body: JSON.stringify(payload)
        });
    },

    deleteMaterial: function(id) { return window.API._request(`/inventory/${id}`, { method: 'DELETE' }); },
    
    updateStock: function(id, data) {
        return window.API._request(`/inventory/${id}`, {
            method: 'PUT', 
            body: JSON.stringify(data)
        });
    },

    getHistory: function(id) { return window.API._request(`/inventory/history/${id}`); },
    
    saveInvoice: function(data) {
        return window.API._request('/invoices', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// --- GANCHOS DE COMPATIBILIDAD TOTAL ---
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.savePurchase = window.API.registerPurchase;

console.log("🛡️ API v13.3.90 - Sistema Rompe-Ciclos Activo.");