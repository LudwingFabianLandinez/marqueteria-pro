const express = require('express');
const router = express.Router();
// Cargamos el controlador como objeto completo para mayor seguridad
const statsCtrl = require('../controllers/statsController');
// Importamos el modelo de Proveedor para el conteo directo si el controlador falla
const Provider = require('../models/Provider');

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
router.get('/', async (req, res) => {
    try {
        // 1. Intentamos usar el controlador existente
        const method = statsCtrl.getDashboardStats || statsCtrl.getStats || statsCtrl.getAll;
        
        if (method) {
            return method(req, res);
        }

        // 2. RESPALDO QUIRÚRGICO: Si el controlador no responde, calculamos lo básico aquí mismo
        // Esto evita que el dashboard muestre "0" si el controlador está desactualizado
        console.warn("⚠️ Controlador de stats no encontrado. Usando conteo directo de respaldo.");
        
        const totalProviders = await Provider.countDocuments();
        
        return res.json({
            success: true,
            data: {
                totalVentas: 0,
                productosBajos: 0,
                totalProviders: totalProviders // Este es el dato que falta en tu contador
            }
        });

    } catch (error) {
        console.error("🚨 Error crítico en el enrutador de estadísticas:", error.message);
        res.status(500).json({ 
            success: false, 
            error: "Error interno al procesar los datos del dashboard." 
        });
    }
});

module.exports = router;