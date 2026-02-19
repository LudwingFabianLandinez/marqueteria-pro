/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de conexión API - Versión 13.3.35 (SALIDA DEL BUCLE)
 * Intervención: Motor de búsqueda de ruta activa (Triple vía).
 * Mantiene intacto el blindaje de compras, la estructura original y el diseño.
 */

// Definimos las rutas posibles para romper el error 404 de Netlify
const API_ROUTES = [
    '/api',
    '/.netlify/functions/server',
    '/functions/server'
];

window.API = {
    // Motor de procesamiento de respuestas (Tu estructura original blindada)
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
            const data = await response.json();
            return Array.isArray(data) ? { success: true, data: data } : data;
        }
        return { success: true };
    },

    // --- SECCIÓN PROVEEDORES (Motor de búsqueda activa) ---
    getProviders: async function() {
        for (const base of API_ROUTES) {
            try {
                console.log(`🔍 Intentando conectar proveedores en: ${base}`);
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
                    console.log(`✅ Conexión exitosa vía: ${base}`);
                    return res;
                }
            } catch (err) { continue; }
        }
        // Contingencia local si todo falla
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
        throw new Error("No se pudo establecer conexión con el servidor.");
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
        const isEdit = materialData.id && materialData.id !== "";
        const path = isEdit ? `/inventory/${materialData.id}` : `/inventory`;
        
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
            cantidad: Number(purchaseData.cantidad || purchaseData.cantidad_laminas || 1),
            largo: Number(purchaseData.largo || purchaseData.largo_lamina_cm || 0),
            ancho: Number(purchaseData.ancho || purchaseData.ancho_lamina_cm || 0),
            valorUnitario: Number(purchaseData.valorUnitario || purchaseData.precio_total_lamina || 0),
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

    saveInvoice: async function(d) { 
        for (const base of API_ROUTES) {
            try {
                const response = await fetch(`${base}/invoices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(d)
                });
                if (response.status !== 404) return await window.API._safeParse(response);
            } catch (e) { }
        }
        throw new Error("Error al guardar la factura.");
    }
};

// COMPATIBILIDAD (Tu estructura intacta)
window.API.getSuppliers = window.API.getProviders;
window.API.saveSupplier = window.API.saveProvider;
window.API.getMaterials = window.API.getInventory;
window.API.getStats = window.API.getDashboardStats;
window.API.savePurchase = window.API.registerPurchase; 

console.log("🛡️ API v13.3.35 - Motor de búsqueda de rutas activado.");