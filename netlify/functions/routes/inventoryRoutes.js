/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Rutas de Inventario - Versión 12.2.1 (FIX 404 POST & ENUM)
 */

const express = require('express');
const router = express.Router();

/**
 * IMPORTACIÓN DE MODELOS
 */
const Material = require('../models/Material');
const Provider = require('../models/Provider');

/**
 * IMPORTACIÓN DEL CONTROLADOR
 */
const inventoryController = require('../controllers/inventoryController');

/**
 * 🛡️ MIDDLEWARE QUIRÚRGICO DE NORMALIZACIÓN (Blindaje de ENUM)
 * Intercepta la petición para asegurar que el 'tipo' sea aceptado por Mongoose.
 */
const normalizarTipoCompra = (req, res, next) => {
    if (req.body && req.body.tipo) {
        const tipoOriginal = String(req.body.tipo).trim().toLowerCase();
        
        // Sincronización con el Schema: Forzamos PURCHASE o INGRESO según tu backend
        if (tipoOriginal === 'compra' || tipoOriginal === 'purchase') {
            req.body.tipo = 'PURCHASE'; 
        }
    }
    next();
};

/**
 * 📋 RUTAS DE INVENTARIO PRINCIPAL
 */

// 1. Obtener lista completa
router.get('/', (req, res, next) => {
    const fn = inventoryController.getInventory || inventoryController.getMaterials || inventoryController.getAll;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ error: "Función de inventario no definida en controlador" });
});

/**
 * 🚀 REGISTRO/CREACIÓN DE MATERIAL (Solución al Error 404 POST)
 * Esta ruta es la que el frontend llama al "Guardar Material" o "Crear Nuevo".
 */
router.post('/', (req, res, next) => {
    const fn = inventoryController.saveMaterial || inventoryController.createMaterial || inventoryController.addMaterial;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ error: "Función de creación no definida en controlador" });
});

// 2. Historial de compras para purchases.html
router.get('/all-purchases', inventoryController.getAllPurchases || ((req, res) => res.json({ success: true, data: [] })));

// 3. Registrar nueva compra (Específica para el módulo de compras)
router.post('/purchase', normalizarTipoCompra, inventoryController.registerPurchase);

/**
 * 📊 RUTAS DE ANALÍTICA (Dashboard Superior)
 */
router.get('/purchases-summary', inventoryController.getPurchasesSummary || ((req, res) => res.json({ success: true, data: {} })));
router.get('/low-stock', inventoryController.getLowStockMaterials || ((req, res) => res.json({ success: true, data: [] })));

/**
 * 🛠️ GESTIÓN Y AJUSTES
 */
router.post('/adjust', (req, res, next) => {
    const fn = inventoryController.adjustStock || inventoryController.manualAdjustment || inventoryController.updateStock;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ error: "Función de ajuste no definida en controlador" });
});

/**
 * 🕒 RUTAS DE HISTORIAL
 */

// 5. Historial General
router.get('/history', (req, res, next) => {
    const fn = inventoryController.getAllHistory || inventoryController.getMaterialHistory;
    if (typeof fn === 'function') { 
        return fn(req, res, next);
    }
    res.json({ success: true, data: [] });
});

// 6. Movimientos de un material específico
router.get('/history/:id', inventoryController.getMaterialHistory || ((req, res) => res.json({ success: true, data: [] })));

// 7. Eliminar material
router.delete('/:id', inventoryController.deleteMaterial);

module.exports = router;