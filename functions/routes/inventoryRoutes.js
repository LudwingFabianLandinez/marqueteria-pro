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
// Este controlador es el que realmente usa los modelos Material y Provider
const inventoryController = require('../controllers/inventoryController');

/**
 * RUTAS DE INVENTARIO - MARQUETERÍA LA CHICA MORALES
 */

// 1. Obtener lista completa de materiales (Tabla principal)
router.get('/', inventoryController.getMaterials);

// 2. Historial Global de Compras (Alimenta la sección de compras)
router.get('/all-purchases', inventoryController.getAllPurchases);

// 3. Registrar una nueva compra (Sincronizado con el modelo Provider)
router.post('/purchase', inventoryController.registerPurchase);

// 4. Historial de movimientos de UN material específico (Modal del Dashboard)
router.get('/history/:id', inventoryController.getMaterialHistory);

/**
 * 📊 RUTAS DE ANALÍTICA Y CONTROL
 */

// Resumen estadístico (KPIs superiores del dashboard)
router.get('/purchases-summary', inventoryController.getPurchasesSummary);

// Alertas de stock bajo (Basado en stock_minimo_m2)
router.get('/low-stock', inventoryController.getLowStockMaterials);

// 5. Ajuste manual de stock (Mermas o correcciones)
router.post('/adjust', inventoryController.manualAdjustment);

/**
 * 🛠️ GESTIÓN AVANZADA
 */

// 6. Eliminar material por completo (Limpieza de base de datos)
router.delete('/:id', inventoryController.deleteMaterial);

// Actualización masiva de precios (Útil para cambios por inflación)
router.patch('/update-prices', inventoryController.bulkPriceUpdate);

module.exports = router;