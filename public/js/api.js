/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 9.8.6 (Estabilización de Contexto)
 */

// La ruta raíz de tus funciones en Netlify
const API_BASE = '/.netlify/functions/server';

window.API = {
    url: API_BASE,

    // Función auxiliar para validar respuestas y evitar el error "Unexpected token <"
    async _safeParse(response) {
        const contentType = response.headers.get("content-type");
        
        if (!response.ok) {
            // Si el servidor falla, intentamos extraer el mensaje de error real
            let errorMsg = `Error del servidor (Estado ${response.status})`;
            try {
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                }
            } catch (e) { /* No se pudo parsear el error */ }
            throw new Error(errorMsg);
        }
        
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            // Normalizamos la respuesta: si el backend envía el array directo, lo envolvemos
            return Array.isArray(data) ? { success: true, data: data } : data;
        }
        
        throw new Error("El servidor respondió con un formato no válido (HTML/Texto).");
    },

    // ==========================================
    // PROVEEDORES
    // ==========================================
    getProviders: async function() {
        try {
            // Intervención: Cambio 'this' por 'window.API'
            const response = await fetch(`${window.API.url}/providers`);
            const res = await window.API._safeParse(response);
            
            // BLINDAJE: Si el servidor manda proveedores sin nombre o nulos, los reparamos aquí
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
    // INVENTARIO, COMPRAS Y AJUSTES
    // ==========================================
    getInventory: async function() {
        try {
            const response = await fetch(`${window.API.url}/inventory`);
            return await window.API._safeParse(response);
        } catch (err) { 
            console.error("🚨 Error cargando inventario:", err);
            const localInv = localStorage.getItem('inventory');
            return { 
                success: true, 
                data: localInv ? JSON.parse(localInv) : [], 
                local: true 
            }; 
        }
    },

    // Registro de compras (Entrada de mercancía)
    registerPurchase: async function(purchaseData) {
        try {
            // DIAGNÓSTICO: Vemos en consola exactamente qué enviamos antes de que falle
            console.log("📦 Intentando registrar compra en:", `${window.API.url}/inventory/purchase`);
            
            const response = await fetch(`${window.API.url}/inventory/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purchaseData)
            });
            return await window.API._safeParse(response);
        } catch (err) {
            console.error("🚨 Fallo en registerPurchase:", err.message);
            return { success: false, message: err.message };
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
            const response = await fetch(`${window.API.url}/inventory/${id}`, {
                method: 'DELETE'
            });
            return await window.API._safeParse(response);
        } catch (err) { return { success: false, error: err.message }; }
    },

    // ==========================================
    // HISTORIALES
    // ==========================================
    getHistory: async function(materialId = null) {
        try {
            const url = materialId 
                ? `${window.API.url}/inventory/history/${materialId}` 
                : `${window.API.url}/inventory/history`;
            const response = await fetch(url);
            return await window.API._safeParse(response);
        } catch (err) { 
            console.warn("⚠️ Error en historial, devolviendo vacío.");
            return { success: true, data: [] }; 
        }
    },

    // ==========================================
    // ESTADÍSTICAS Y FACTURACIÓN
    // ==========================================
    getDashboardStats: async function() {
        try {
            const response = await fetch(`${window.API.url}/stats`);
            return await window.API._safeParse(response);
        } catch (err) { 
            return { success: true, data: { totalVentas: 0, productosBajos: 0 }, local: true }; 
        }
    },

    getInvoices: async function() { 
        try { 
            const r = await fetch(`${window.API.url}/invoices`); 
            return await window.API._safeParse(r); 
        } catch(e) { return { success: true, data: [] }; } 
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

// ==========================================
// BLOQUE DE COMPATIBILIDAD (Sincronización Total)
// ==========================================
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.getStats = window.API.getDashboardStats;
window.API.savePurchase = window.API.registerPurchase; 

console.log("🛡️ API v9.8.6 - Blindaje Quirúrgico Finalizado.");