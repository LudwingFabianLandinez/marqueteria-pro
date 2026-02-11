const express = require('express');
const router = express.Router();
const path = require('path');

// --- BLOQUE DE SEGURIDAD PARA DEPURACIÓN ---
try {
    // Verificamos que el controlador existe antes de cargarlo para evitar el Error 500 silencioso
    const controllerPath = path.resolve(__dirname, '../controllers/inventoryController.js');
    console.log(`🔍 Intentando cargar controlador desde: ${controllerPath}`);
} catch (e) {
    console.error("🚨 Error de ruta en inventoryRoutes:", e.message);
}

// Importación del controlador con ruta relativa verificada para la carpeta /functions
const inventoryController = require('../controllers/inventoryController');

/**
 * RUTAS DE INVENTARIO - MARQUETERÍA LA CHICA MORALES
 */

// 1. Obtener lista completa de materiales (Tabla principal)
// Si esta falla, verás el error 500 en la consola del navegador
router.get('/', inventoryController.getMaterials);

// 2. Historial Global de Compras (Alimenta purchases.html)
router.get('/all-purchases', inventoryController.getAllPurchases);

// 3. Registrar una nueva compra
router.post('/purchase', inventoryController.registerPurchase);

// 4. Historial de movimientos de UN material específico (Modal)
router.get('/history/:id', inventoryController.getMaterialHistory);

/**
 * 📊 RUTAS DE ANALÍTICA Y CONTROL
 */

// Resumen estadístico (KPIs superiores)
router.get('/purchases-summary', inventoryController.getPurchasesSummary);

// Alertas de stock bajo
router.get('/low-stock', inventoryController.getLowStockMaterials);

// 5. Ajuste manual de stock (Mermas) [cite: 2026-02-05]
router.post('/adjust', inventoryController.manualAdjustment);

/**
 * 🛠️ GESTIÓN AVANZADA
 */

// 6. Eliminar material por completo
router.delete('/:id', inventoryController.deleteMaterial);

// Actualización masiva de precios
router.patch('/update-prices', inventoryController.bulkPriceUpdate);

module.exports = router;