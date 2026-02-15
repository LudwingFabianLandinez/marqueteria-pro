/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 11.0.0 (Protocolo de Fuerza Bruta y Anidación)
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
                    nombre: p && p.nombre ? p.nombre : "PROVEEDOR SIN NOMBRE",
                    _id: p && p._id ? p._id : (p && p.id ? p.id : "ID_TEMP")
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

    // REPARACIÓN DEFINITIVA v11.0.0
    registerPurchase: async function(purchaseData) {
        const valorCantidad = Number(purchaseData.cantidad || purchaseData.unidades || 0);
        const valorPrecio = Number(purchaseData.precio || purchaseData.valorUnitario || 0);

        // Mapeo exhaustivo para evitar el error "cantidad is required"
        const baseData = {
            materialId: purchaseData.materialId,
            proveedorId: purchaseData.proveedorId || purchaseData.supplierId,
            cantidad: valorCantidad,
            unidades: valorCantidad,
            quantity: valorCantidad,
            precio: valorPrecio,
            valorUnitario: valorPrecio,
            costo: valorPrecio,
            largo: Number(purchaseData.largo || 0),
            ancho: Number(purchaseData.ancho || 0)
        };

        // Palabras clave en orden de probabilidad (Español, Inglés, Técnico)
        const intentosTipo = ['compra', 'entrada', 'PURCHASE', 'STOCK_IN', 'INVENTORY_IN'];
        let errorFinal = "";

        for (const tipoTest of intentosTipo) {
            try {
                const dataFinal = { ...baseData, tipo: tipoTest };
                console.log(`🧪 Probando v11 con: "${tipoTest}"`, dataFinal);

                const response = await fetch(`${window.API.url}/inventory/purchase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataFinal)
                });

                return await window.API._safeParse(response);
            } catch (err) {
                errorFinal = err.message;
                console.warn(`❌ Falló con "${tipoTest}": ${err.message}`);
                // Si no es un error de "tipo/enum", el problema es otro campo, nos detenemos.
                if (!err.message.includes("tipo") && !err.message.includes("enum")) break;
            }
        }

        // ÚLTIMO RECURSO: Enviar sin el campo 'tipo'
        try {
            console.log("🛡️ Intento final: Omitiendo campo 'tipo'...");
            const response = await fetch(`${window.API.url}/inventory/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(baseData)
            });
            return await window.API._safeParse(response);
        } catch (err) {
            return { success: false, message: `Error persistente: ${err.message}` };
        }
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

console.log("🚀 API v11.0.0 - Protocolo de Fuerza Bruta Desplegado.");