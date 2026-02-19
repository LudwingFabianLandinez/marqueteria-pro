/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.3.40 (TÚNEL CONSOLIDADO + BLINDAJE ARRAY)
 * Intervención: Garantía de retorno de Array para evitar error 'map' en el frontend.
 * Mantiene intacto el blindaje de compras, la estructura original y el diseño.
 */

// Rutas candidatas para romper el error 404 (Sincronizadas con netlify.toml y servidores locales)
const API_ROUTES = [
    '',                             // Ancla de ruta raíz (para redirecciones internas)
    '/api',                         // Ruta estándar de backend
    '/.netlify/functions/server',   // Túnel para Netlify
    '/functions/server'             // Túnel alternativo
];

window.API = {
    // Motor de procesamiento de respuestas (Reparado para garantizar Array)
    async _safeParse(response) {
        const contentType = response.headers.get("content-type");
        if (!response.ok) {
            let errorMsg = `Error (Estado ${response.status})`;
            try {
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                }
            } catch (e) { }
            throw new Error(errorMsg);
        }

        if (contentType && contentType.includes("application/json")) {
            const rawData = await response.json();
            
            // --- BLINDAJE CRÍTICO CONTRA EL ERROR .MAP() ---
            // Si rawData es un array, devolvemos formato estándar.
            // Si rawData tiene una propiedad 'data' que es array, la usamos.
            // Si no, devolvemos un array vacío para que el frontend no se rompa.
            let cleanData = [];
            if (Array.isArray(rawData)) {
                cleanData = rawData;
            } else if (rawData && Array.isArray(rawData.data)) {
                cleanData = rawData.data;
            }

            return { success: true, data: cleanData };
        }
        
        // Retorno por defecto seguro
        return { success: true, data: [] };
    },

    // --- SECCIÓN PROVEEDORES ---
    getProviders: async function() {
        for (const base of API_ROUTES) {
            try {
                console.log(`🔍 Buscando proveedores en: ${base || '(root)'}`);
                const response = await fetch(`${base}/providers`);
                
                if (response.status !== 404) {
                    const res = await window.API._safeParse(response);
                    if (res.success && Array.isArray(res.data)) {
                        res.data = res.data.map(p => ({
                            ...p,
                            nombre: p.nombre || p.name || "PROVEEDOR SIN NOMBRE",
                            _id: p._id || p.id || "ID_TEMP"
                        }));
                    }
                    console.log(`✅ Conectado vía: ${base || 'root'}`);
                    return res;
                }
            } catch (err) { continue; }
        }
        const localData = localStorage.getItem('providers');
        return { success: true, data: localData ? JSON.parse(localData) : [], local: true };
    },

    saveProvider: async function(providerData) {
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/providers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(providerData)
                });
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        throw new Error("No se pudo conectar con el servidor para guardar el proveedor.");
    },

    // --- SECCIÓN INVENTARIO ---
    getInventory: async function() {
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/inventory`);
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        const localInv = localStorage.getItem('inventory');
        return { success: true, data: localInv ? JSON.parse(localInv) : [], local: true };
    },

    saveMaterial: async function(materialData) {
        const id = materialData.id || materialData._id;
        const isEdit = id && id !== "";
        const path = isEdit ? `/inventory/${id}` : `/inventory`;
        
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}${path}`, {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(materialData)
                });
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        throw new Error("Error al guardar material.");
    },

    // --- REGISTRO DE COMPRA (Blindaje de datos 100% respetado) ---
    registerPurchase: async function(purchaseData) {
        const payload = {
            materialId: String(purchaseData.materialId),
            proveedorId: String(purchaseData.proveedorId || purchaseData.proveedor || purchaseData.providerId),
            cantidad: Number(purchaseData.cantidad || 1),
            largo: Number(purchaseData.largo || 0),
            ancho: Number(purchaseData.ancho || 0),
            valorUnitario: Number(purchaseData.valorUnitario || 0),
            tipo: "COMPRA",
            fecha: new Date().toISOString()
        };

        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/inventory/purchase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        throw new Error("Error al registrar la compra en el servidor.");
    },

    // --- SECCIÓN ESTADÍSTICAS Y FACTURAS ---
    getDashboardStats: async function() {
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/stats`);
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        return { success: false, data: { totalVentas: 0 } };
    },

    getInvoices: async function() { 
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/invoices`);
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        return { success: false, data: [] }; 
    },

    saveInvoice: async function(invoiceData) { 
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/invoices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(invoiceData)
                });
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        throw new Error("Error al guardar la factura.");
    },

    // --- ELIMINAR MATERIAL ---
    deleteMaterial: async function(id) {
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/inventory/${id}`, {
                    method: 'DELETE'
                });
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        throw new Error("No se pudo eliminar el material.");
    },

    // --- ACTUALIZAR STOCK (AJUSTE DIRECTO) ---
    updateStock: async function(id, data) {
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/inventory/${id}/stock`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        throw new Error("No se pudo actualizar el stock.");
    },

    // --- HISTORIAL ---
    getHistory: async function(id) {
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/inventory/${id}/history`);
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        return { success: false, data: [] };
    }
};

// COMPATIBILIDAD (Tu estructura intacta para evitar errores de referencia)
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.getStats = window.API.getDashboardStats;
window.API.savePurchase = window.API.registerPurchase; 

console.log("🛡️ API v13.3.40 - Blindaje, Sincronización y Garantía de Datos.");