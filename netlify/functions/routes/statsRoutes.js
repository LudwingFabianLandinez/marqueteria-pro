const express = require('express');
const router = express.Router();
const statsCtrl = require('../controllers/statsController');

/**
 * RUTAS DE ESTADÍSTICAS Y DASHBOARD
 * Solo enviamos lo esencial para los gráficos y alertas de stock
 */

router.use((req, res, next) => {
    console.log(`📊 [StatsRoute] Generando datos analíticos simplificados...`);
    next();
});

router.get('/', (req, res) => {
    try {
        const method = statsCtrl.getDashboardStats || statsCtrl.getStats || statsCtrl.getAll;
        
        if (!method) {
            // Respuesta por defecto si el controlador no está listo
            return res.json({ 
                success: true, 
                data: { totalVentas: 0, productosBajos: 0 } 
            });
        }
        
        return method(req, res);
    } catch (error) {
        console.error("🚨 Error crítico en stats:", error.message);
        res.status(500).json({ success: false, error: "Error en dashboard" });
    }
});

module.exports = router;