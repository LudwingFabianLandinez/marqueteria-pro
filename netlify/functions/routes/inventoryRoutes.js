/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Rutas de Inventario e Invoices - Versión 12.2.5 (SINCRO TOTAL & BLINDAJE)
 */

const express = require('express');
const router = express.Router();

/**
 * IMPORTACIÓN DE CONTROLADORES
 * Mantenemos tu inventoryController y sumamos invoiceController para las OT
 */
const inventoryController = require('../controllers/inventoryController');
const invoiceController = require('../controllers/invoiceController');

/**
 * 🛡️ MIDDLEWARE QUIRÚRGICO DE NORMALIZACIÓN
 * Mantenemos tu blindaje para asegurar que el 'tipo' sea compatible 
 * con los ENUMS del modelo antes de procesar la petición.
 */
// 🛡️ MIDDLEWARE DE BLINDAJE TOTAL
const normalizarDatosMaterial = (req, res, next) => {
    console.log("🛠️ Iniciando blindaje de datos para Atlas...");
    
    if (req.body) {
        // 1. Forzar valores numéricos (Evita que Mongoose rechace la compra por datos vacíos)
        req.body.ancho_lamina_cm = parseFloat(req.body.ancho_lamina_cm) || 0;
        req.body.largo_lamina_cm = parseFloat(req.body.largo_lamina_cm) || 0;
        req.body.precio_total_lamina = parseFloat(req.body.precio_total_lamina) || 0;

        // 2. Asegurar Categoría (Tu modelo exige que esté en el ENUM)
        let cat = String(req.body.categoria || '').trim();
        // Si no viene categoría válida, ponemos 'General' que sí está en tu Enum de Material.js
        if (!cat || cat === "") {
            req.body.categoria = 'General'; 
        }

        // 3. Limpiar el Tipo (Debe ser estrictamente 'm2' o 'ml')
        let t = String(req.body.tipo || '').toLowerCase().trim();
        req.body.tipo = (t === 'ml' || t === 'm2') ? t : 'm2';

        // 4. Limpieza de ID (Si es TEMP-, lo anulamos para que el controlador busque por nombre)
        if (req.body.materialId && String(req.body.materialId).startsWith('TEMP-')) {
            console.log("⚠️ ID TEMP detectado en Middleware, limpiando...");
            req.body.materialId = null;
        }
    }
    
    console.log("✅ Datos blindados con éxito. Pasando al controlador.");
    next();
};

/**
 * 📋 RUTAS DE INVENTARIO PRINCIPAL (Tu código intacto)
 */

// 1. Obtener lista completa de materiales
router.get('/', (req, res, next) => {
    const fn = inventoryController.getMaterials || inventoryController.getInventory || inventoryController.getAll;
    if (typeof fn === 'function') return fn(req, res, next);
    
    // Si no es inventario, buscamos si es una petición de facturas (Invoices)
    const fnInvoice = invoiceController.getInvoices || invoiceController.getAll;
    if (typeof fnInvoice === 'function') return fnInvoice(req, res, next);
    
    res.status(500).json({ success: false, error: "Función de lectura no definida en controlador" });
});

/**
 * 🚀 GUARDADO / CREACIÓN (Punto crítico para el botón "Guardar")
 */
router.post('/', normalizarDatosMaterial, (req, res, next) => {
    const fn = inventoryController.saveMaterial || inventoryController.createMaterial || inventoryController.addMaterial;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ success: false, error: "Función de guardado no definida en controlador" });
});

// 2. Registrar compra (Usa la lógica inteligente de incremento de stock)
router.post('/purchase', normalizarDatosMaterial, inventoryController.registerPurchase);

// 3. Historial de compras para purchases.html
router.get('/all-purchases', (req, res, next) => {
    const fn = inventoryController.getAllPurchases || inventoryController.getPurchases;
    if (typeof fn === 'function') return fn(req, res, next);
    res.json({ success: true, data: [] });
});

// Delete a purchase (and restore inventory accordingly)
router.delete('/purchase/:id', async (req, res, next) => {
    const fn = inventoryController.deletePurchase;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ success: false, error: 'Delete handler not implemented' });
});

/**
 * 📊 RUTAS DE ANALÍTICA (Dashboard Superior)
 */
router.get('/purchases-summary', (req, res, next) => {
    const fn = inventoryController.getPurchasesSummary || inventoryController.getSummary;
    if (typeof fn === 'function') return fn(req, res, next);
    res.json({ success: true, data: { totalInvertido: 0 } });
});

router.get('/low-stock', (req, res, next) => {
    const fn = inventoryController.getLowStockMaterials || inventoryController.getAlerts;
    if (typeof fn === 'function') return fn(req, res, next);
    res.json({ success: true, data: [] });
});

/**
 * 🛠️ GESTIÓN Y AJUSTES
 */
router.post('/adjust', (req, res, next) => {
    const fn = inventoryController.adjustStock || inventoryController.manualAdjustment || inventoryController.updateStock;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ success: false, error: "Función de ajuste no definida" });
});

/**
 * 🕒 RUTAS DE HISTORIAL
 */

// 5. Historial General
router.get('/history', (req, res, next) => {
    const fn = inventoryController.getAllHistory || inventoryController.getHistory;
    if (typeof fn === 'function') return fn(req, res, next);
    res.json({ success: true, data: [] });
});

// 6. Historial por Material específico
router.get('/history/:id', (req, res, next) => {
    const fn = inventoryController.getMaterialHistory || inventoryController.getHistoryById;
    if (typeof fn === 'function') return fn(req, res, next);
    res.json({ success: true, data: [] });
});

/**
 * 🗑️ GESTIÓN DE ELIMINACIÓN (GANCHOS CONSOLIDADOS)
 * Aquí sumamos la lógica para eliminar tanto Materiales como Facturas (OT)
 */
/**
 * 🗑️ GESTIÓN DE ELIMINACIÓN BLINDADA (V12.2.6)
 */
router.delete('/:id', async (req, res, next) => {
    const id = req.params.id;
    console.log(`🗑️ Petición de borrado recibida para ID: ${id}`);

    try {
        // 1. Prioridad: Si el ID es de un material (usualmente empieza por el ID de MongoDB de 24 caracteres)
        // Intentamos borrar primero en Inventario para asegurar el stock
        if (inventoryController.deleteMaterial || inventoryController.removeMaterial) {
            const fnInv = inventoryController.deleteMaterial || inventoryController.removeMaterial;
            console.log("📦 Intentando borrar como Material de Inventario...");
            return fnInv(req, res, next);
        } 

        // 2. Si fallara lo anterior, intentamos con Facturas
        const fnInvoice = invoiceController.deleteInvoice || invoiceController.eliminarFactura;
        if (typeof fnInvoice === 'function') {
            console.log("📄 Intentando borrar como Factura/OT...");
            return fnInvoice(req, res, next);
        }

        res.status(500).json({ success: false, error: "No se encontró controlador de eliminación" });
    } catch (err) {
        console.error("🚨 Error en cascada de eliminación:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;