/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.3.30 (BLINDAJE DE ACERO)
 * Intervención Quirúrgica: Rutas inyectadas directamente para eliminar el error 'undefined'.
 * Mantiene intacto el blindaje, la estructura original y la lógica de compras v13.3.29.
 */

// RUTA GLOBAL FIJA - Mantenida para compatibilidad
const API_BASE = '/.netlify/functions/server'; 

window.API = {
    url: API_BASE,

    // Motor de procesamiento de respuestas (Blindado - Tu estructura original)
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
            // Normalización: Si es un Array directo, lo envolvemos en success: true
            return Array.isArray(data) ? { success: true, data: data } : data;
        }
        return { success: true };
    },

    // --- SECCIÓN PROVEEDORES (RESTABLECIDA CON INYECCIÓN DIRECTA) ---
    getProviders: async function() {
        try {
            // Inyección directa de ruta para anular cualquier error 'undefined'
            const response = await fetch('/.netlify/functions/server/providers');
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
            const response = await fetch('/.netlify/functions/server/providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerData)
            });
            return await window.API._safeParse(response);
        } catch (err) { throw err; }
    },

    // --- SECCIÓN INVENTARIO ---
    getInventory: async function() {
        try {
            const response = await fetch('/.netlify/functions/server/inventory');
            return await window.API._safeParse(response);
        } catch (err) { 
            const localInv = localStorage.getItem('inventory');
            return { success: true, data: localInv ? JSON.parse(localInv) : [], local: true }; 
        }
    },

    saveMaterial: async function(materialData) {
        try {
            const isEdit = materialData.id && materialData.id !== "";
            const url = isEdit ? `/.netlify/functions/server/inventory/${materialData.id}` : `/.netlify/functions/server/inventory`;
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(materialData)
            });
            return await window.API._safeParse(response);
        } catch (err) { throw err; }
    },

    // --- REGISTRO DE COMPRA (Sincronizado y Protegido contra daños) ---
    registerPurchase: async function(purchaseData) {
        console.log("🚀 Sincronizando Compra con Motor de Diagnóstico...", purchaseData);
        
        // Mapeo inteligente: El Dashboard sigue igual, el servidor recibe lo que espera
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
            const response = await fetch('/.netlify/functions/server/inventory/purchase', {
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
            const response = await fetch('/.netlify/functions/server/inventory/adjust', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    deleteMaterial: async function(id) {
        try {
            const response = await fetch(`/.netlify/functions/server/inventory/${id}`, { method: 'DELETE' });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    getHistory: async function(id = null) {
        try {
            const url = id ? `/.netlify/functions/server/inventory/history/${id}` : `/.netlify/functions/server/inventory/history`;
            const response = await fetch(url);
            return await window.API._safeParse(response);
        } catch (err) { return { success: true, data: [] }; }
    },

    // --- SECCIÓN VENTAS Y ESTADÍSTICAS ---
    getDashboardStats: async function() {
        try {
            const response = await fetch('/.netlify/functions/server/stats');
            return await window.API._safeParse(response);
        } catch (err) { 
            console.error("Error stats:", err);
            return { success: false, data: { totalVentas: 0 }, error: err.message }; 
        }
    },

    getInvoices: async function() { 
        try { 
            const response = await fetch('/.netlify/functions/server/invoices');
            return await window.API._safeParse(response); 
        } 
        catch(e) { 
            return { success: false, data: [], error: e.message }; 
        } 
    },

    saveInvoice: async function(d) { 
        try { 
            const response = await fetch('/.netlify/functions/server/invoices', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' 
                },
                body: JSON.stringify(d)
            }); 
            return await window.API._safeParse(response); 
        } catch(e) { return { success: false, message: e.message }; } 
    }
};

// COMPATIBILIDAD DE MÉTODOS (Respetada al 100%)
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.getStats = window.API.getDashboardStats;
window.API.savePurchase = window.API.registerPurchase; 
window.API.updateStock = window.API.adjustStock;

console.log("🛡️ API v13.3.30 - Blindaje Directo y Estabilidad de Compras.");