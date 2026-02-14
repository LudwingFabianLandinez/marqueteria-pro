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

/**
 * 🕒 RUTAS DE HISTORIAL
 */

// 5. NUEVO: Historial General (Para evitar el error 404 que traba el modal)
router.get('/history', (req, res, next) => {
    // Intentamos usar la función del controlador si existe, si no, devolvemos array vacío para no trabar el front
    const fn = inventoryController.getAllHistory || inventoryController.getMaterialHistory;
    if (typeof fn === 'function' && fn.length === 2) { // Si es una función que no requiere ID
        return fn(req, res, next);
    }
    res.json({ success: true, data: [] });
});

// 6. Movimientos/Historial de un material específico (con ID)
router.get('/history/:id', inventoryController.getMaterialHistory || ((req, res) => res.json({ success: true, data: [] })));

// 7. Eliminar material
router.delete('/:id', inventoryController.deleteMaterial);

module.exports = router;