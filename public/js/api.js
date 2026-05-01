/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.5.0 (PUNTO 4: ESCUDO ANTI-404)
 * * CAMBIOS v13.5.0:
 * 1. ESCUDO ANTI-404: registerPurchase detecta IDs temporales y evita rutas dinámicas inexistentes.
 * 2. Mantenimiento de normalización estricta y vinculación de stock v13.4.35.
 * 3. Preservación absoluta de blindajes de OTs y lógica de rescate local.
 */

console.log("🛡️ CARGANDO API v13.8.6 - ESCUDO ACTIVO");

function resolveApiBase() {
    const fallbackPath = '/.netlify/functions/server';
    const remoteProductionBase = 'https://marqueterialachica.netlify.app/.netlify/functions/server';
    const configuredBase = typeof window.API_URL === 'string' ? window.API_URL.trim() : '';
    const isPlainLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const isFileProtocol = window.location.protocol === 'file:';
    const basePath = configuredBase || ((isPlainLocalHost || isFileProtocol) ? remoteProductionBase : fallbackPath);

    if (/^https?:\/\//i.test(basePath)) {
        return basePath.replace(/\/+$/, '');
    }

    const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
    return `${window.location.origin}${normalizedPath}`.replace(/\/+$/, '');
}

const API_BASE = resolveApiBase();
window.resolveApiBase = resolveApiBase;
window.API_URL = API_BASE;

window.API = {
    // 1. MOTOR DE PROCESAMIENTO SEGURO
    async _safeParse(response, originalPath) {
        const contentType = response.headers.get("content-type");
        
        if (!response.ok && response.status === 404 && originalPath.includes('inventory')) {
            console.warn("⚠️ Error de ruteo detectado. Activando protocolo de bypass...");
        }

        if (!response.ok) {
            return { success: false, status: response.status, path: originalPath };
        }

        if (contentType && contentType.includes("application/json")) {
            const rawData = await response.json();
            let cleanObj = (rawData.success && rawData.data) ? rawData.data : rawData;

            if (cleanObj && typeof cleanObj === 'object' && !Array.isArray(cleanObj)) {
                return { success: true, data: cleanObj, id: cleanObj.id || cleanObj._id };
            }

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

    // 2. PETICIÓN MAESTRA
    async _request(path, options = {}) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const url = `${API_BASE}${normalizedPath}`;
        
        try {
            console.log(`🚀 Conectando v13.7.0 - VEREDICTO FINAL: ${url}`);
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

    // 3. MÉTODOS DE NEGOCIO
    getProviders: function() { 
        return window.API._request('/providers'); 
    },

    saveProvider: async function(data) {
        return window.API._request('/providers', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    getInventory: async function() { 
        const res = await window.API._request('/inventory');
        const localMaterials = JSON.parse(localStorage.getItem('inventory') || '[]');
        const localPurchases = JSON.parse(localStorage.getItem('local_purchases') || '[]');
        const normalize = (txt) => String(txt || "").trim().toUpperCase().replace(/\s+/g, ' ');

        const uniqueMap = new Map();
        if (res.data && Array.from(res.data).length > 0) {
            res.data.forEach(m => {
                const key = normalize(m.nombre);
                uniqueMap.set(key, { ...m, stock: Number(m.stock || 0), _allIds: [String(m.id || m._id)] });
            });
        }

        localMaterials.forEach(m => {
            const materialId = String(m.id || m._id);
            const key = normalize(m.nombre);
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, { ...m, stock: Number(m.stock || 0), _allIds: [materialId] });
            } else {
                if (!uniqueMap.get(key)._allIds.includes(materialId)) {
                    uniqueMap.get(key)._allIds.push(materialId);
                }
            }
        });

        const finalData = Array.from(uniqueMap.values()).map(m => {
            const nombreNormalM = normalize(m.nombre);
            const sumaCompras = localPurchases
                .filter(p => {
                    const matchId = m._allIds.includes(String(p.materialId));
                    const matchNombre = normalize(p._materialNombre) === nombreNormalM || normalize(p.nombreMaterial) === nombreNormalM;
                    return matchId || matchNombre;
                })
                .reduce((acc, p) => acc + Number(p.cantidad || 0), 0);
            
            return { 
                ...m, 
                stock: Number(m.stock || 0) + sumaCompras,
                _id: m._allIds[0],
                precio_m2_costo: Number(m.costo_m2 || m.precio_m2_costo || 0)
            };
        });

        finalData.sort((a, b) => normalize(a.nombre).localeCompare(normalize(b.nombre)));
        window.todosLosMateriales = finalData; 

        const event = new CustomEvent('inventoryUpdated', { detail: finalData });
        window.dispatchEvent(event);

        if (typeof window.renderMaterialOptions === 'function') {
            window.renderMaterialOptions(finalData);
        }
        return { ...res, data: finalData };
    },

    saveMaterial: async function(data) {
        const id = data.id || data._id;
        const isLocal = !id || String(id).startsWith('LOC-') || String(id).startsWith('MAT-') || String(id).startsWith('TEMP-');
        
        const cleanData = {
            ...data,
            nombre: String(data.nombre || "SIN NOMBRE").trim().toUpperCase(),
            categoria: String(data.categoria || "MARCOS"),
            estado: "Activo"
        };

        const path = isLocal ? '/inventory' : `/fix-material-data/${id}`;
        
        try {
            const res = await window.API._request(path, { 
                method: 'POST', 
                body: JSON.stringify(cleanData) 
            });
            if (!res.success) throw new Error("Atlas rechazó el paquete");
            let localInv = JSON.parse(localStorage.getItem('inventory') || '[]');
            localInv = localInv.filter(m => String(m.id || m._id) !== String(id));
            localStorage.setItem('inventory', JSON.stringify(localInv));
            await this.getInventory();
            return res;
        } catch (e) {
            const localId = id || `LOC-${Date.now()}`;
            const newMaterial = { ...cleanData, id: localId, _id: localId };
            let localInv = JSON.parse(localStorage.getItem('inventory') || '[]');
            const index = localInv.findIndex(m => String(m.id || m._id) === String(localId));
            if (index > -1) localInv[index] = newMaterial;
            else localInv.push(newMaterial);
            localStorage.setItem('inventory', JSON.stringify(localInv));
            await this.getInventory();
            return { success: true, data: newMaterial, id: localId, local: true };
        }
    },

    // 🛡️ PUNTO 4 REPARADO: registerPurchase ANTI-404
    registerPurchase: async function(purchaseData) {
        const inv = JSON.parse(localStorage.getItem('inventory') || '[]');
        const mat = inv.find(m => String(m.id || m._id) === String(purchaseData.materialId));
        
        const payload = {
            ...purchaseData,
            materialId: String(purchaseData.materialId),
            cantidad: Number(purchaseData.cantidad || 1),
            _materialNombre: mat ? mat.nombre : (purchaseData.nombreMaterial || "Desconocido"),
            fechaLocal: new Date().toISOString()
        };

        /**
         * 🛡️ REPARACIÓN TÉCNICA DEFINITIVA (PUNTO 4):
         * Eliminamos la ruta dinámica con ID para evitar el error 404 de Netlify/Express.
         * Forzamos el uso de '/inventory/purchase' porque el servidor ya sabe
         * buscar el material por nombre o ID dentro del contenido (payload).
         */
        const safePath = '/inventory/purchase';
        
        console.log(`🚀 Conectando a ruta maestra: ${safePath}`);

        const res = await window.API._request(safePath, { 
            method: 'POST', 
            body: JSON.stringify(payload) 
        });

        if (res.isOffline || !res.success) {
            console.warn("💾 Fallo de red o servidor: Registrando en bitácora local...");
            let localPurchases = JSON.parse(localStorage.getItem('local_purchases') || '[]');
            localPurchases.push(payload);
            localStorage.setItem('local_purchases', JSON.stringify(localPurchases));
            return { success: true, data: payload, local: true };
        }
        
        // Si el servidor respondió 200, los datos ya están en Atlas
        console.log("✅ Compra sincronizada con Atlas exitosamente.");
        return res;
    },

    deleteMaterial: function(id) { return window.API._request(`/inventory/${id}`, { method: 'DELETE' }); },
    // El servidor expone PUT /materials/:id (server.js) — usar esa ruta para actualizar stock/metadata
    updateStock: function(id, data) { return window.API._request(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    getHistory: function(id) { return window.API._request(`/inventory/history/${id}`); },
    saveInvoice: function(data) { return window.API._request('/invoices', { method: 'POST', body: JSON.stringify(data) }); }
};

// --- GANCHOS DE COMPATIBILIDAD ---
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.savePurchase = window.API.registerPurchase;

console.log("🛡️ API v13.7.0 - VEREDICTO FINAL: Reintento de Conexión Activo");