/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 10.5.0 (Blindaje Total y Auto-Reintento)
 */

const API_BASE = '/.netlify/functions/server';

window.API = {
    url: API_BASE,

    // Función auxiliar corregida para evitar errores de contexto (this)
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

    // ==========================================
    // PROVEEDORES
    // ==========================================
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
            console.warn("⚠️ Usando Respaldo Local para Proveedores.");
            const localData = localStorage.getItem('providers');
            const lista = localData ? JSON.parse(localData) : [];
            return { success: true, data: lista, local: true }; 
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
        } catch (err) {
            console.error("🚨 ERROR REAL DE CONEXIÓN:", err);
            throw err; 
        }
    },

    // ==========================================
    // INVENTARIO Y COMPRAS
    // ==========================================
    getInventory: async function() {
        try {
            const response = await fetch(`${window.API.url}/inventory`);
            return await window.API._safeParse(response);
        } catch (err) { 
            console.error("🚨 Error cargando inventario:", err);
            const localInv = localStorage.getItem('inventory');
            return { success: true, data: localInv ? JSON.parse(localInv) : [], local: true }; 
        }
    },

    // REPARACIÓN DEFINITIVA: registerPurchase con Inteligencia de Reintento
    registerPurchase: async function(purchaseData) {
        // 1. Mapeo Universal de campos (Enviamos todo para que no falte nada)
        const valorCantidad = Number(purchaseData.cantidad || purchaseData.unidades || 0);
        const valorPrecio = Number(purchaseData.precio || purchaseData.valorUnitario || 0);

        const baseData = {
            materialId: purchaseData.materialId,
            proveedorId: purchaseData.proveedorId || purchaseData.supplierId,
            cantidad: valorCantidad,
            unidades: valorCantidad, // Alias
            precio: valorPrecio,
            valorUnitario: valorPrecio, // Alias
            largo: Number(purchaseData.largo || 0),
            ancho: Number(purchaseData.ancho || 0)
        };

        // 2. Lista de palabras clave que Atlas suele aceptar en el ENUM 'tipo'
        const intentosTipo = ['ingreso', 'entrada', 'compra', 'ajuste'];
        let errorFinal = "";

        console.log("🚀 Iniciando secuencia de guardado inteligente...");

        for (const tipoTest of intentosTipo) {
            try {
                const dataFinal = { ...baseData, tipo: tipoTest };
                console.log(`🧪 Probando con tipo: "${tipoTest}"`);

                const response = await fetch(`${window.API.url}/inventory/purchase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataFinal)
                });

                const result = await window.API._safeParse(response);
                console.log(`✅ ¡Éxito total con tipo: "${tipoTest}"!`);
                return result; // Si funciona, terminamos aquí.

            } catch (err) {
                errorFinal = err.message;
                console.warn(`❌ Falló con "${tipoTest}": ${err.message}`);
                // Si el error NO es de validación (enum/tipo), paramos los reintentos
                if (!err.message.includes("tipo") && !err.message.includes("enum") && !err.message.includes("required")) {
                    break;
                }
            }
        }

        return { success: false, message: `No se pudo guardar tras varios intentos. Último error: ${errorFinal}` };
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

    // ==========================================
    // HISTORIALES, ESTADÍSTICAS Y FACTURACIÓN
    // ==========================================
    getHistory: async function(materialId = null) {
        try {
            const url = materialId ? `${window.API.url}/inventory/history/${materialId}` : `${window.API.url}/inventory/history`;
            const response = await fetch(url);
            return await window.API._safeParse(response);
        } catch (err) { return { success: true, data: [] }; }
    },

    getDashboardStats: async function() {
        try {
            const response = await fetch(`${window.API.url}/stats`);
            return await window.API._safeParse(response);
        } catch (err) { return { success: true, data: { totalVentas: 0, productosBajos: 0 } }; }
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

// BLOQUE DE COMPATIBILIDAD
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.getStats = window.API.getDashboardStats;
window.API.savePurchase = window.API.registerPurchase; 

console.log("🛡️ API v10.5.0 - Blindaje y Auto-Reintento Activado.");