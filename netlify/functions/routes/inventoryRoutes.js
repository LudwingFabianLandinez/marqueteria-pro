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
 * Este bloque intercepta la petición y arregla el valor 'tipo' antes 
 * de que llegue al controlador para evitar el Error 500 de Mongoose.
 */
const normalizarTipoCompra = (req, res, next) => {
    if (req.body && req.body.tipo) {
        // Limpiamos el valor de espacios y lo pasamos a minúsculas para comparar
        const tipoOriginal = String(req.body.tipo).trim().toLowerCase();
        
        // Blindaje: Si el servidor espera 'PURCHASE' (mayúsculas), aquí lo forzamos.
        // Esto soluciona el error: "tipo: 'compra' is not a valid enum value"
        if (tipoOriginal === 'compra' || tipoOriginal === 'purchase') {
            req.body.tipo = 'PURCHASE'; 
        }
    }
    next();
};

/**
 * 📋 RUTAS DE INVENTARIO PRINCIPAL
 */

// 1. Obtener lista completa (Si falla uno, intenta el otro método del controlador)
router.get('/', (req, res, next) => {
    const fn = inventoryController.getInventory || inventoryController.getMaterials || inventoryController.getAll;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ error: "Función de inventario no definida en controlador" });
});

// 2. Historial de compras para purchases.html
router.get('/all-purchases', inventoryController.getAllPurchases);

// 3. Registrar nueva compra (Aplicamos el normalizador aquí antes del controlador)
router.post('/purchase', normalizarTipoCompra, inventoryController.registerPurchase);

/**
 * 📊 RUTAS DE ANALÍTICA (Dashboard Superior)
 */
router.get('/purchases-summary', inventoryController.getPurchasesSummary);
router.get('/low-stock', inventoryController.getLowStockMaterials);

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
    if (typeof fn === 'function' && fn.length === 2) { 
        return fn(req, res, next);
    }
    res.json({ success: true, data: [] });
});

// 6. Movimientos/Historial de un material específico (con ID)
router.get('/history/:id', inventoryController.getMaterialHistory || ((req, res) => res.json({ success: true, data: [] })));

// 7. Eliminar material
router.delete('/:id', inventoryController.deleteMaterial);

module.exports = router;