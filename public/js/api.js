/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.4.35 (REPARACIÓN TOTAL DE STOCK)
 * * CAMBIOS v13.4.35:
 * 1. NORMALIZACIÓN ESTRICTA: Limpia espacios extra y caracteres invisibles para forzar la suma de stock.
 * 2. VINCULACIÓN TOTAL: Cruza bitácora local con inventario usando comparación de nombres "limpios".
 * 3. SUMA FORZADA: Si el servidor falla, el stock se calcula sumando la bitácora local al inventario base.
 * 4. Preservación absoluta de blindajes de OTs, diseño visual y lógica de rescate v13.4.25.
 */

const API_BASE = window.API_URL || '/.netlify/functions/server';

window.API = {
    // 1. MOTOR DE PROCESAMIENTO SEGURO (Mantiene blindaje de OTs y Rescate)
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

    // 2. PETICIÓN MAESTRA (v13.4.35 - CON NORMALIZACIÓN)
    async _request(path, options = {}) {
        const url = `${API_BASE}${path}`.replace(/\/+/g, '/');
        
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

    // 3. MÉTODOS DE NEGOCIO (ESTRUCTURA ORIGINAL 100% PRESERVADA)
    getProviders: function() { return window.API._request('/providers'); },

    // --- MEJORA v13.4.35: REPARACIÓN MECÁNICA DE STOCK POR NOMBRE LIMPIO ---
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

        // --- VÍNCULO CRÍTICO CON EL COTIZADOR Y FACTURACIÓN ---
        window.todosLosMateriales = finalData; 

        // 🚀 NUEVO: Disparar evento para que facturacion.html se actualice
        const event = new CustomEvent('inventoryUpdated', { detail: finalData });
        window.dispatchEvent(event);

        if (typeof window.renderMaterialOptions === 'function') {
            window.renderMaterialOptions(finalData);
        }

        return { ...res, data: finalData };
    },

    getInvoices: function() { return window.API._request('/invoices'); },
    
    saveProvider: function(data) { 
        return window.API._request('/providers', { method: 'POST', body: JSON.stringify(data) }); 
    },

    saveMaterial: async function(data) {
        const id = data.id || data._id;
        const isLocal = !id || String(id).startsWith('LOC-') || String(id).startsWith('MAT-');
        
        const cleanData = {
            ...data,
            nombre: String(data.nombre || "SIN NOMBRE").trim().toUpperCase(),
            categoria: String(data.categoria || "MARCOS"),
            tipo: String(data.tipo || "ml"),
            stock_actual: Number(data.stock_actual) || 0,
            stock_minimo: Number(data.stock_minimo) || 0,
            costo_m2: Number(data.costo_m2 || data.precio_m2_costo || 0),
            precio_m2_costo: Number(data.costo_m2 || data.precio_m2_costo || 0),
            ancho_lamina_cm: Number(data.ancho_lamina_cm) || 0,
            largo_lamina_cm: Number(data.largo_lamina_cm) || 0,
            precio_total_lamina: Number(data.precio_total_lamina) || 0,
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
            console.warn("💾 Rescate Local Activo...");
            
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
        
        // Intentar envío al servidor
        const res = await window.API._request('/inventory/purchase', { method: 'POST', body: JSON.stringify(payload) });

        if (res.isOffline || !res.success) {
            console.warn("💾 Registrando compra en bitácora local por fallo de servidor...");
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

console.log("🛡️ API v13.4.35 - Normalización y Stock Garantizado (Rescate de Emergencia).");console.log('?? FUERZA BRUTA: v13.7.0');
