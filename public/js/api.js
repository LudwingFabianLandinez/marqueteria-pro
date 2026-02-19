/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.3.34 (RECONEXIÓN INTELIGENTE)
 * Intervención: Fallback automático para rutas Netlify si /api devuelve 404.
 * Mantiene intacto el blindaje de compras, la estructura original y el diseño.
 */

const API_BASE = '/api';
const API_DIRECT = '/.netlify/functions/server';

window.API = {
    url: API_BASE,

    // Motor de procesamiento de respuestas (Blindado y original)
    async _safeParse(response) {
        const contentType = response.headers.get("content-type");
        if (!response.ok) {
            let errorMsg = `Error del servidor (Estado ${response.status})`;
            try {
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                }
            } catch (e) { }
            throw new Error(errorMsg);
        }
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            return Array.isArray(data) ? { success: true, data: data } : data;
        }
        return { success: true };
    },

    // --- SECCIÓN PROVEEDORES (Con Salto Inteligente) ---
    getProviders: async function() {
        try {
            let response = await fetch(`${API_BASE}/providers`);
            
            if (response.status === 404) {
                console.log("🔄 Reintentando proveedores por ruta directa...");
                response = await fetch(`${API_DIRECT}/providers`);
            }

            const res = await window.API._safeParse(response);
            if (res.success && Array.isArray(res.data)) {
                res.data = res.data.map(p => ({
                    ...p,
                    nombre: p.nombre || p.name || "PROVEEDOR SIN NOMBRE",
                    _id: p._id || p.id || "ID_TEMP"
                }));
            }
            return res;
        } catch (err) { 
            console.warn("⚠️ Modo Local activado para Proveedores");
            const localData = localStorage.getItem('providers');
            return { success: true, data: localData ? JSON.parse(localData) : [], local: true }; 
        }
    },

    saveProvider: async function(providerData) {
        try {
            let response = await fetch(`${API_BASE}/providers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerData)
            });

            if (response.status === 404) {
                response = await fetch(`${API_DIRECT}/providers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(providerData)
                });
            }
            return await window.API._safeParse(response);
        } catch (err) { throw err; }
    },

    // --- SECCIÓN INVENTARIO ---
    getInventory: async function() {
        try {
            let response = await fetch(`${API_BASE}/inventory`);
            if (response.status === 404) response = await fetch(`${API_DIRECT}/inventory`);
            return await window.API._safeParse(response);
        } catch (err) { 
            const localInv = localStorage.getItem('inventory');
            return { success: true, data: localInv ? JSON.parse(localInv) : [], local: true }; 
        }
    },

    saveMaterial: async function(materialData) {
        try {
            const isEdit = materialData.id && materialData.id !== "";
            const path = isEdit ? `/inventory/${materialData.id}` : `/inventory`;
            
            let response = await fetch(`${API_BASE}${path}`, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(materialData)
            });

            if (response.status === 404) {
                response = await fetch(`${API_DIRECT}${path}`, {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(materialData)
                });
            }
            return await window.API._safeParse(response);
        } catch (err) { throw err; }
    },

    // --- REGISTRO DE COMPRA (Blindaje de datos intacto al 100%) ---
    registerPurchase: async function(purchaseData) {
        console.log("🚀 Sincronizando Compra con API...", purchaseData);
        
        const payload = {
            materialId: String(purchaseData.materialId),
            proveedorId: String(purchaseData.proveedorId || purchaseData.proveedor || purchaseData.providerId),
            cantidad: Number(purchaseData.cantidad || purchaseData.cantidad_laminas || 1),
            largo: Number(purchaseData.largo || purchaseData.largo_lamina_cm || 0),
            ancho: Number(purchaseData.ancho || purchaseData.ancho_lamina_cm || 0),
            valorUnitario: Number(purchaseData.valorUnitario || purchaseData.precio_total_lamina || 0),
            tipo: "COMPRA",
            fecha: new Date().toISOString()
        };

        try {
            let response = await fetch(`${API_BASE}/inventory/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 404) {
                response = await fetch(`${API_DIRECT}/inventory/purchase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            return await window.API._safeParse(response);
        } catch (err) {
            console.error("❌ Error en Compra:", err.message);
            throw err;
        }
    },

    adjustStock: async function(data) {
        try {
            let response = await fetch(`${API_BASE}/inventory/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (response.status === 404) {
                response = await fetch(`${API_DIRECT}/inventory/adjust`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    getHistory: async function(id = null) {
        try {
            const path = id ? `/inventory/history/${id}` : `/inventory/history`;
            let response = await fetch(`${API_BASE}${path}`);
            if (response.status === 404) response = await fetch(`${API_DIRECT}${path}`);
            return await window.API._safeParse(response);
        } catch (err) { return { success: true, data: [] }; }
    },

    getDashboardStats: async function() {
        try {
            let response = await fetch(`${API_BASE}/stats`);
            if (response.status === 404) response = await fetch(`${API_DIRECT}/stats`);
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, data: { totalVentas: 0 } }; }
    },

    getInvoices: async function() { 
        try { 
            let response = await fetch(`${API_BASE}/invoices`);
            if (response.status === 404) response = await fetch(`${API_DIRECT}/invoices`);
            return await window.API._safeParse(response); 
        } catch(e) { return { success: false, data: [] }; } 
    },

    saveInvoice: async function(d) { 
        try { 
            let response = await fetch(`${API_BASE}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(d)
            });
            if (response.status === 404) {
                response = await fetch(`${API_DIRECT}/invoices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(d)
                });
            }
            return await window.API._safeParse(response); 
        } catch(e) { return { success: false, message: e.message }; } 
    }
};

// COMPATIBILIDAD (Respetada al 100%)
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.getStats = window.API.getDashboardStats;
window.API.savePurchase = window.API.registerPurchase; 
window.API.updateStock = window.API.adjustStock;

console.log("🛡️ API v13.3.34 - Reconexión Inteligente y Blindaje Activo.");