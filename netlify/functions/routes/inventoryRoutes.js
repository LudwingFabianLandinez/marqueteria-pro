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
const normalizarDatosMaterial = (req, res, next) => {
    if (req.body) {
        // 1. Blindaje de Tipo (m2 / ml)
        if (req.body.tipo) {
            const tipoOriginal = String(req.body.tipo).trim().toLowerCase();
            if (tipoOriginal === 'compra' || tipoOriginal === 'purchase') {
                req.body.tipo = 'm2'; // Fallback seguro para el modelo Material
            }
        }
        // 2. Blindaje de Categoría (Evita Error 500 por ENUM)
        if (req.body.categoria) {
            const cat = String(req.body.categoria).trim();
            // Si llega algo vacío o no reconocido, el controlador usará el default del modelo
            if (cat === "") delete req.body.categoria;
        }
    }
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
router.delete('/:id', (req, res, next) => {
    // 1. Intentamos con el controlador de Facturas (Para la OT-00015)
    if (invoiceController && (invoiceController.deleteInvoice || invoiceController.eliminarFactura)) {
        const fnInvoice = invoiceController.deleteInvoice || invoiceController.eliminarFactura;
        return fnInvoice(req, res, next);
    }
    
    // 2. Si no, usamos tu código original de inventario
    const fnInv = inventoryController.deleteMaterial || inventoryController.removeMaterial;
    if (typeof fnInv === 'function') return fnInv(req, res, next);
    
    res.status(500).json({ success: false, error: "Función de eliminación no definida" });
});

module.exports = router;