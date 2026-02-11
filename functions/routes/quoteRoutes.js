const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');

/**
 * MIDDLEWARE DE LOGGING (Opcional pero recomendado)
 * Registra cada petición que llega a las rutas de cotización para depurar fallos.
 */
router.use((req, res, next) => {
    console.log(`[QuoteRoute] ${req.method} ${req.url}`);
    next();
});

/**
 * RUTA: GET /api/quotes/materials
 * Obtiene los materiales del inventario categorizados para llenar los selectores.
 * Esta es la ruta que tu frontend espera para quitar el mensaje de "Cargando..."
 */
router.get('/materials', async (req, res, next) => {
    try {
        // Llamamos al controlador
        await quoteController.getQuotationMaterials(req, res);
    } catch (error) {
        console.error("🚨 Error crítico en GET /materials:", error);
        res.status(500).json({ 
            success: false, 
            error: "Error interno al obtener la lista de materiales." 
        });
    }
});

/**
 * RUTA: POST /api/quotes
 * Procesa la cotización integrando múltiples materiales y mano de obra.
 * Incluye una validación previa (Middleware) antes de entrar al controlador.
 */
router.post('/', (req, res, next) => {
    const { ancho, largo, materialesIds, manoObra } = req.body;

    // 1. Validación de medidas: Evita que el controlador falle por cálculos matemáticos nulos
    if (!ancho || !largo || ancho <= 0 || largo <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ Medidas inválidas. El ancho y largo deben ser mayores a 0." 
        });
    }

    // 2. Validación de materiales: Verifica que llegue un array con al menos un ID
    if (!materialesIds || (Array.isArray(materialesIds) && materialesIds.length === 0)) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ Debes seleccionar al menos un material (vidrio, marco, etc.) para cotizar." 
        });
    }

    // 3. Limpieza de datos: Aseguramos que manoObra sea numérico
    req.body.manoObra = parseFloat(manoObra) || 0;
    
    // Si todo está bien, pasamos al controlador
    next();
}, quoteController.generateQuote);

/**
 * RUTA DE COMPATIBILIDAD: POST /api/quotes/calculate
 * Mantiene soporte si alguna versión antigua del frontend usa esta URL.
 */
router.post('/calculate', quoteController.generateQuote);

/**
 * RUTA DE DIAGNÓSTICO: GET /api/quotes/status
 * Útil para verificar si el módulo de cotizaciones está activo sin cargar materiales.
 */
router.get('/status', (req, res) => {
    res.json({ success: true, message: "Módulo de cotizaciones activo y conectado." });
});

module.exports = router;