const express = require('express');
const router = express.Router();

/**
 * IMPORTACIÓN DE MODELOS
 * Aseguramos que los modelos estén cargados para evitar errores de referencia
 */
const Material = require('../models/Material');
const Provider = require('../models/Provider');

/**
 * IMPORTACIÓN DEL CONTROLADOR
 */
const inventoryController = require('../controllers/inventoryController');

/**
 * 📋 RUTAS DE INVENTARIO PRINCIPAL
 */

// 1. Obtener lista completa (Si falla uno, intenta el otro)
router.get('/', (req, res, next) => {
    const fn = inventoryController.getInventory || inventoryController.getMaterials || inventoryController.getAll;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ error: "Función de inventario no definida en controlador" });
});

// 2. Historial de compras para purchases.html
router.get('/all-purchases', inventoryController.getAllPurchases);

// 3. Registrar nueva compra (Asegura que el frontend envíe datos a esta ruta)
router.post('/purchase', inventoryController.registerPurchase);

/**
 * 📊 RUTAS DE ANALÍTICA (Dashboard Superior)
 */

// Resumen de compras (KPIs)
router.get('/purchases-summary', inventoryController.getPurchasesSummary);

// Alertas de stock bajo
router.get('/low-stock', inventoryController.getLowStockMaterials);

/**
 * 🛠️ GESTIÓN Y AJUSTES
 */

// 4. Ajuste manual de stock (Ruta que usa el botón de la tabla)
router.post('/adjust', (req, res, next) => {
    const fn = inventoryController.adjustStock || inventoryController.manualAdjustment || inventoryController.updateStock;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ error: "Función de ajuste no definida en controlador" });
});

// 5. Movimientos/Historial de un material específico
router.get('/history/:id', inventoryController.getMaterialHistory || ((req, res) => res.json([])));

// 6. Eliminar material
router.delete('/:id', inventoryController.deleteMaterial);

module.exports = router;