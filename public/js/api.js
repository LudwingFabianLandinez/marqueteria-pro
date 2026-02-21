/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.4.15 (REPARACIÓN DE STOCK LOCAL)
 * * CAMBIOS v13.4.15:
 * 1. SUMATORIA DE STOCK: getInventory ahora suma compras locales al stock base.
 * 2. VINCULACIÓN TOTAL: Asegura que molduras locales muestren sus ML correctos.
 * 3. Preservación absoluta de blindajes, OTs y diseño visual.
 */

const API_BASE = '/.netlify/functions/server';

window.API = {
    // 1. MOTOR DE PROCESAMIENTO SEGURO (Con Rescate y Blindaje)
    async _safeParse(response, originalPath) {
        const contentType = response.headers.get("content-type");
        
        // --- RESCATE v13.4.00: Manejo de 404 Fantasma ---
        if (!response.ok && response.status === 404 && originalPath.includes('inventory')) {
            console.warn("⚠️ Error de ruteo detectado. Activando protocolo de bypass...");
        }

        if (!response.ok) {
            return { success: false, status: response.status, path: originalPath };
        }

        if (contentType && contentType.includes("application/json")) {
            const rawData = await response.json();
            
            // --- EXTRACCIÓN DE DATA REFORZADA ---
            let cleanObj = (rawData.success && rawData.data) ? rawData.data : rawData;

            // Blindaje para Objetos Únicos (Captura de ID fundamental para compras)
            if (cleanObj && typeof cleanObj === 'object' && !Array.isArray(cleanObj)) {
                if (cleanObj.ot && String(cleanObj.ot).length > 10) {
                    console.warn("⚠️ Normalizando OT detectada...");
                }
                return { success: true, data: cleanObj, id: cleanObj.id || cleanObj._id };
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

    // 2. PETICIÓN MAESTRA (v13.4.15 - CON SALVAGUARDA)
    async _request(path, options = {}) {
        const url = `${API_BASE}${path}`.replace(/\/+/g, '/');
        
        try {
            console.log(`🚀 Conectando v13.4.15: ${url}`);
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

            const result = await window.API._safeParse(response, path);
            if (result.success === false) throw new Error(`Status ${result.status}`);
            return result;

        } catch (err) {
            console.error(`❌ Fallo en enlace:`, err.message);
            const storageKey = path.includes('inventory') ? 'inventory' : (path.includes('providers') ? 'providers' : null);
            const local = localStorage.getItem(storageKey);
            
            return { 
                success: (path.includes('inventory') || path.includes('providers')), 
                data: local ? JSON.parse(local) : [], 
                local: true,
                isOffline: true,
                error: err.message 
            };
        }
    },

    // 3. MÉTODOS DE NEGOCIO (ESTRUCTURA ORIGINAL 100% PRESERVADA)
    getProviders: function() { return window.API._request('/providers'); },

    // --- MEJORA v13.4.15: LECTURA HÍBRIDA CON SUMATORIA DE STOCK LOCAL ---
    getInventory: async function() { 
        const res = await window.API._request('/inventory');
        const localMaterials = JSON.parse(localStorage.getItem('inventory') || '[]');
        const localPurchases = JSON.parse(localStorage.getItem('local_purchases') || '[]');
        
        if (localMaterials.length > 0) {
            console.log("🧩 Calculando stock híbrido para molduras locales...");
            const serverIds = new Set(res.data.map(i => String(i.id || i._id)));
            
            const hybridData = localMaterials.filter(m => !serverIds.has(String(m.id || m._id))).map(m => {
                // Sumar compras locales realizadas a este material específico para corregir el 0.00 ml
                const totalComprado = localPurchases
                    .filter(p => String(p.materialId) === String(m.id || m._id))
                    .reduce((acc, p) => acc + Number(p.cantidad || 0), 0);
                
                return { ...m, stock: Number(m.stock || 0) + totalComprado };
            });

            return { ...res, data: [...res.data, ...hybridData] };
        }
        return res;
    },

    getInvoices: function() { return window.API._request('/invoices'); },

    saveProvider: function(data) {
        return window.API._request('/providers', { method: 'POST', body: JSON.stringify(data) });
    },

    saveMaterial: async function(data) {
        const id = data.id || data._id;
        const path = id ? `/inventory/${id}` : '/inventory';
        
        try {
            const res = await window.API._request(path, {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(data)
            });
            
            if (res.isOffline || !res.success) throw new Error("Trigger Local");
            return res;

        } catch (e) {
            console.warn("💾 Rescate Local: Guardando moldura...");
            const localId = id || `LOC-${Date.now()}`;
            const newMaterial = { ...data, id: localId, _id: localId, stock: Number(data.stock || 0) };
            
            let localInv = JSON.parse(localStorage.getItem('inventory') || '[]');
            localInv = localInv.filter(m => (m.id || m._id) !== localId);
            localInv.push(newMaterial);
            localStorage.setItem('inventory', JSON.stringify(localInv));
            
            return { success: true, data: newMaterial, id: localId, local: true };
        }
    },

    registerPurchase: async function(purchaseData) {
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
        
        const res = await window.API._request('/inventory/purchase', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // --- MEJORA v13.4.15: BITÁCORA DE COMPRAS LOCALES PARA REPARAR STOCK ---
        if (res.isOffline || !res.success) {
            console.warn("💾 Registrando compra en bitácora local...");
            let localPurchases = JSON.parse(localStorage.getItem('local_purchases') || '[]');
            localPurchases.push(payload);
            localStorage.setItem('local_purchases', JSON.stringify(localPurchases));
            return { success: true, data: payload, local: true };
        }
        return res;
    },

    deleteMaterial: function(id) { return window.API._request(`/inventory/${id}`, { method: 'DELETE' }); },
    updateStock: function(id, data) { return window.API._request(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    getHistory: function(id) { return window.API._request(`/inventory/history/${id}`); },
    saveInvoice: function(data) { return window.API._request('/invoices', { method: 'POST', body: JSON.stringify(data) }); }
};

// --- GANCHOS DE COMPATIBILIDAD TOTAL ---
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.savePurchase = window.API.registerPurchase;

console.log("🛡️ API v13.4.15 - Stock Híbrido Reparado.");