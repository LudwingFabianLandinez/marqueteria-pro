const express = require('express');
const router = express.Router();
const Material = require('../models/Material'); // Verifica que la ruta y nombre sean correctos
const Provider = require('../models/Provider'); // <--- ESTA ES LA QUE FALTA

/**
 * RUTAS DE INVENTARIO - MARQUETERÍA LA CHICA MORALES
 */

// Importación segura del controlador
const inventoryController = require('../controllers/inventoryController');

// 1. Obtener lista completa de materiales (Tabla principal)
// Usamos el alias de seguridad 'getInventory' que definimos en el controlador
router.get('/', inventoryController.getInventory || inventoryController.getMaterials);

// 2. Historial Global de Compras
router.get('/all-purchases', inventoryController.getAllPurchases);

// 3. Registrar una nueva compra
router.post('/purchase', inventoryController.registerPurchase);

/**
 * 📊 RUTAS DE ANALÍTICA Y CONTROL
 */

// Resumen estadístico (KPIs superiores del dashboard)
router.get('/purchases-summary', inventoryController.getPurchasesSummary);

// Alertas de stock bajo
router.get('/low-stock', inventoryController.getLowStockMaterials);

// 4. Ajuste manual de stock (Ruta crítica para inventory.js)
// Usamos el alias 'adjustStock' para coincidir con lo que busca el frontend
router.post('/adjust', inventoryController.adjustStock || inventoryController.manualAdjustment);

/**
 * 🛠️ GESTIÓN AVANZADA
 */

// 5. Eliminar material por completo
router.delete('/:id', inventoryController.deleteMaterial);

module.exports = router;