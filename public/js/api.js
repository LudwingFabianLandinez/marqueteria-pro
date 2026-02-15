/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 12.0.0 (Consolidación con Bucle de Compatibilidad)
 */

const API_BASE = '/.netlify/functions/server';

window.API = {
    url: API_BASE,

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

    getProviders: async function() {
        try {
            const response = await fetch(`${window.API.url}/providers`);
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
            const localData = localStorage.getItem('providers');
            return { success: true, data: localData ? JSON.parse(localData) : [], local: true }; 
        }
    },

    saveProvider: async function(providerData) {
        try {
            const response = await fetch(`${window.API.url}/providers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerData)
            });
            return await window.API._safeParse(response);
        } catch (err) { throw err; }
    },

    getInventory: async function() {
        try {
            const response = await fetch(`${window.API.url}/inventory`);
            return await window.API._safeParse(response);
        } catch (err) { 
            const localInv = localStorage.getItem('inventory');
            return { success: true, data: localInv ? JSON.parse(localInv) : [], local: true }; 
        }
    },

    /** NUEVA FUNCIÓN CONSOLIDADA: GUARDAR O EDITAR MATERIAL **/
    saveMaterial: async function(materialData) {
        try {
            const isEdit = materialData.id && materialData.id !== "";
            const url = isEdit ? `${window.API.url}/inventory/${materialData.id}` : `${window.API.url}/inventory`;
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(materialData)
            });
            return await window.API._safeParse(response);
        } catch (err) { throw err; }
    },

    registerPurchase: async function(purchaseData) {
        console.log("🚀 Iniciando registro de compra v12.0.0");
        const valorCantidad = Number(purchaseData.cantidad || purchaseData.cantidad_m2 || 0);
        const valorPrecio = Number(purchaseData.precio || purchaseData.precio_total || 0);
        
        const tiposDePrueba = ['compra', 'PURCHASE', 'INGRESO', 'entrada'];
        let ultimoError = null;

        for (const tipo of tiposDePrueba) {
            try {
                const payload = {
                    materialId: purchaseData.materialId,
                    proveedorId: purchaseData.proveedorId || purchaseData.providerId,
                    cantidad: valorCantidad,
                    precio: valorPrecio,
                    tipo: tipo,
                    detalles: purchaseData.detalles || {},
                    fecha: new Date().toISOString()
                };

                const response = await fetch(`${window.API.url}/inventory/purchase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) return await window.API._safeParse(response);
                const errorData = await response.json();
                ultimoError = errorData.message || "Error de validación";
            } catch (err) { ultimoError = err.message; }
        }
        throw new Error("Error crítico en compra: " + ultimoError);
    },

    adjustStock: async function(data) {
        try {
            const response = await fetch(`${window.API.url}/inventory/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    deleteMaterial: async function(id) {
        try {
            const response = await fetch(`${window.API.url}/inventory/${id}`, { method: 'DELETE' });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    getHistory: async function(id = null) {
        try {
            const url = id ? `${window.API.url}/inventory/history/${id}` : `${window.API.url}/inventory/history`;
            return await window.API._safeParse(await fetch(url));
        } catch (err) { return { success: true, data: [] }; }
    },

    getDashboardStats: async function() {
        try {
            return await window.API._safeParse(await fetch(`${window.API.url}/stats`));
        } catch (err) { return { success: true, data: { totalVentas: 0 } }; }
    },

    getInvoices: async function() { 
        try { return await window.API._safeParse(await fetch(`${window.API.url}/invoices`)); } 
        catch(e) { return { success: true, data: [] }; } 
    },

    saveInvoice: async function(d) { 
        try { 
            const r = await fetch(`${window.API.url}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(d)
            }); 
            return await window.API._safeParse(r); 
        } catch(e) { return { success: false, message: e.message }; } 
    },

    generateQuote: async function(quoteData) {
        try {
            const response = await fetch(`${window.API.url}/quotes/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteData)
            });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    }
};

// COMPATIBILIDAD
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.getStats = window.API.getDashboardStats;
window.API.savePurchase = window.API.registerPurchase; 

console.log("🛡️ API v12.0.0 - Blindaje Activo.");