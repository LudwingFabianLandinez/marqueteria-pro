const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');

/**
 * MIDDLEWARE DE LOGGING
 * Registra cada petición que llega a las rutas de cotización para depurar fallos en Netlify.
 */
router.use((req, res, next) => {
    console.log(`[QuoteRoute] ${req.method} ${req.url}`);
    next();
});

/**
 * RUTA: GET /api/quotes/materials
 * Obtiene los materiales del inventario categorizados.
 */
router.get('/materials', async (req, res) => {
    try {
        // Intentamos llamar al método principal o al alias getMaterials
        const method = quoteController.getQuotationMaterials || quoteController.getMaterials;
        
        if (!method) {
            throw new Error("El método de obtención de materiales no está definido en el controlador.");
        }
        
        await method(req, res);
    } catch (error) {
        console.error("🚨 Error crítico en GET /materials:", error.message);
        res.status(500).json({ 
            success: false, 
            error: "Error interno al obtener la lista de materiales para cotizar." 
        });
    }
});

/**
 * RUTA: POST /api/quotes
 * Procesa la cotización integrando múltiples materiales y mano de obra.
 */
router.post('/', (req, res, next) => {
    const { ancho, largo, materialesIds, manoObra } = req.body;

    // 1. Validación de medidas
    if (!ancho || !largo || parseFloat(ancho) <= 0 || parseFloat(largo) <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ Medidas inválidas. El ancho y largo deben ser mayores a 0." 
        });
    }

    // 2. Validación de materiales
    if (!materialesIds || (Array.isArray(materialesIds) && materialesIds.length === 0)) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ Debes seleccionar al menos un material para cotizar." 
        });
    }

    // 3. Limpieza de datos
    req.body.manoObra = parseFloat(manoObra) || 0;
    
    next();
}, (req, res) => {
    const method = quoteController.generateQuote || quoteController.calculateQuote;
    if (!method) return res.status(500).json({ success: false, error: "Método de cálculo no definido." });
    return method(req, res);
});

/**
 * RUTA DE COMPATIBILIDAD Y DIAGNÓSTICO
 */
router.post('/calculate', quoteController.generateQuote || quoteController.calculateQuote);

router.get('/status', (req, res) => {
    res.json({ success: true, message: "Módulo de cotizaciones activo." });
});

module.exports = router;