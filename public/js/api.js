/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 12.2.9 (SINCRO TOTAL SCHEMA)
 * Ajustado para cumplir con Transaccion.js y asegurar cálculo Área x Cantidad.
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

    /** * REGISTRO DE COMPRA - REESTRUCTURADO V12.2.9
     * Sincronizado con Transaccion.js (Model) y FIX de Medidas Totales
     */
    registerPurchase: async function(purchaseData) {
        console.log("🚀 Sincronizando Compra con Medidas Totales...");
        
        // Calculamos el costo unitario por m2 para el historial si no viene definido
        const cantidadFinal = Number(purchaseData.cantidad || 0);
        const costoTotal = Number(purchaseData.costo_total || 0);
        const costoUnitarioCalculado = cantidadFinal > 0 ? (costoTotal / cantidadFinal) : 0;

        // Mapeo quirúrgico para coincidir con los campos del Schema de Mongoose
        const payload = {
            materialId: String(purchaseData.materialId),
            proveedor: String(purchaseData.proveedor || purchaseData.providerId || purchaseData.proveedorId),
            // 'cantidad' ahora recibe el total de m2 (Ej: 17.60) calculado en inventory.js
            cantidad: Number(parseFloat(cantidadFinal).toFixed(4)),
            cantidad_m2: Number(parseFloat(cantidadFinal).toFixed(4)),
            costo_total: Number(Math.round(costoTotal)),
            // Aseguramos que el historial guarde el costo por cada m2
            costo_unitario: Number(purchaseData.precio_m2_costo || costoUnitarioCalculado),
            tipo: "COMPRA",
            motivo: purchaseData.motivo || "Registro de compra",
            fecha: new Date().toISOString()
        };

        try {
            const response = await fetch(`${window.API.url}/inventory/purchase`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            return await window.API._safeParse(response);
        } catch (err) {
            console.error("❌ Error Crítico en Compra:", err.message);
            throw err;
        }
    },

    adjustStock: async function(data) {
        try {
            if (!data.tipo) data.tipo = "AJUSTE_MAS"; 
            
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
    }
};

// COMPATIBILIDAD DE MÉTODOS
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.getStats = window.API.getDashboardStats;
window.API.savePurchase = window.API.registerPurchase; 

console.log("🛡️ API v12.2.9 - Blindaje y Sincronización Total Activa.");