const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');

/**
 * RUTA: GET /api/quotes/materials
 * Obtiene los materiales del inventario categorizados para llenar los selectores.
 */
router.get('/materials', quoteController.getQuotationMaterials);

/**
 * RUTA: POST /api/quotes
 * Procesa la cotización integrando múltiples materiales y mano de obra.
 */
router.post('/', (req, res, next) => {
    const { ancho, largo, materialesIds, manoObra } = req.body;

    // Validación de medidas
    if (!ancho || !largo) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ Faltan las medidas (ancho y largo) para calcular el área." 
        });
    }

    // Validación de materiales
    if (!materialesIds || (Array.isArray(materialesIds) && materialesIds.length === 0)) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ Debes seleccionar al menos un material principal." 
        });
    }

    // Aseguramos que manoObra sea un número aunque llegue vacío
    req.body.manoObra = parseFloat(manoObra) || 0;

    next();
}, quoteController.generateQuote);

/**
 * RUTA COMPATIBILIDAD: POST /api/quotes/calculate
 */
router.post('/calculate', quoteController.generateQuote);

module.exports = router;