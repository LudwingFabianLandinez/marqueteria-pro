const express = require('express');
const router = express.Router();
// Cargamos el controlador como objeto completo para mayor seguridad
const statsCtrl = require('../controllers/statsController');

/**
 * RUTAS DE ESTADÍSTICAS Y DASHBOARD
 * Esta ruta alimenta los gráficos y contadores principales
 */

// Middleware de monitoreo
router.use((req, res, next) => {
    console.log(`📊 [StatsRoute] Generando datos analíticos...`);
    next();
});

// Ruta principal: GET /api/stats
router.get('/', (req, res) => {
    try {
        // Intentamos usar getDashboardStats o un alias genérico
        const method = statsCtrl.getDashboardStats || statsCtrl.getStats || statsCtrl.getAll;
        
        if (!method) {
            console.error("🚨 El controlador de estadísticas no exporta una función válida.");
            return res.status(500).json({ 
                success: false, 
                error: "Módulo de estadísticas no disponible en el servidor." 
            });
        }
        
        return method(req, res);
    } catch (error) {
        console.error("🚨 Error crítico en el enrutador de estadísticas:", error.message);
        res.status(500).json({ 
            success: false, 
            error: "Error interno al procesar los datos del dashboard." 
        });
    }
});

module.exports = router;