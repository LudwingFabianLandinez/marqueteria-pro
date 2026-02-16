/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Rutas de Inventario - Versión 12.8.0 (SINCRO TOTAL + MOTOR MATEMÁTICO DE PESO)
 * Objetivo: Blindaje absoluto de cálculos antes de entrar al controlador.
 */

const express = require('express');
const router = express.Router();

/**
 * IMPORTACIÓN DEL CONTROLADOR
 */
const inventoryController = require('../controllers/inventoryController');

/**
 * 🛡️ MIDDLEWARE DE BLINDAJE MATEMÁTICO v12.8.0
 * Mantenemos tu estructura y sumamos el recalculo forzado de costos.
 */
const normalizarDatosMaterial = (req, res, next) => {
    if (req.body) {
        // 1. Blindaje de Tipo (m2 / ml)
        if (req.body.tipo) {
            const tipoOriginal = String(req.body.tipo).trim().toLowerCase();
            if (tipoOriginal === 'compra' || tipoOriginal === 'purchase') {
                req.body.tipo = 'm2'; 
            }
        }

        // 2. Blindaje de Categoría
        if (req.body.categoria) {
            const cat = String(req.body.categoria).trim();
            if (cat === "") delete req.body.categoria;
        }

        // 3. ⚖️ SOLUCIÓN DE PESO: MOTOR DE CÁLCULO PRE-CONTROLADOR
        // Si hay dimensiones y precio de lámina, forzamos el costo m2 correcto
        const ancho = parseFloat(req.body.ancho_lamina_cm) || 0;
        const largo = parseFloat(req.body.largo_lamina_cm) || 0;
        const precioLamina = parseFloat(req.body.precio_total_lamina) || 0;

        if (ancho > 0 && largo > 0 && precioLamina > 0) {
            const areaM2 = (ancho * largo) / 10000;
            // Sobreescribimos cualquier valor previo de precio_m2_costo
            req.body.precio_m2_costo = Math.round(precioLamina / areaM2);
            
            console.log(`⚖️ [Calculador v12.8.0]: ${req.body.nombre || 'Material'} -> $${req.body.precio_m2_costo}/m2 calculado.`);
        }
    }
    next();
};

/**
 * 📋 RUTAS DE INVENTARIO PRINCIPAL
 */

// 1. Obtener lista completa de materiales
router.get('/', (req, res, next) => {
    const fn = inventoryController.getMaterials || inventoryController.getInventory || inventoryController.getAll;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ success: false, error: "Función de lectura no definida en controlador" });
});

/**
 * 🚀 GUARDADO / CREACIÓN (Punto crítico para el botón "Guardar")
 * Aplicamos el motor matemático para que el controlador guarde el m2 real.
 */
router.post('/', normalizarDatosMaterial, (req, res, next) => {
    const fn = inventoryController.saveMaterial || inventoryController.createMaterial || inventoryController.addMaterial;
    if (typeof fn === 'function') return fn(req, res, next);
    res.status(500).json({ success: false, error: "Función de guardado no definida en controlador" });
});

// 2. Registrar compra (Incremento de stock + Actualización de precio maestro)
router.post('/purchase', normalizarDatosMaterial, inventoryController.registerPurchase);

// 3. Historial de compras
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

// 7. Eliminar material
router.delete('/:id', inventoryController.deleteMaterial);

module.exports = router;