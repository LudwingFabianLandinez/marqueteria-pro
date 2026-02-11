const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db'); //
require('dotenv').config();

/**
 * SERVIDOR SERVERLESS - MARQUETERÍA LA CHICA MORALES
 * Este archivo centraliza la lógica de la API para Netlify Functions.
 */

const app = express();

// 1. Middlewares de Seguridad y Capacidad
app.use(cors());
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging para depuración en Netlify Logs
app.use((req, res, next) => {
    console.log(`📨 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 2. Conexión a Base de Datos con manejo de errores para Serverless
// Intentamos conectar, pero no bloqueamos el inicio del handler
connectDB().catch(err => console.error("🚨 Error inicial de conexión DB:", err));

// ==========================================
// RUTAS DE LA API
// ==========================================
const router = express.Router();

// Importación de rutas ajustadas a la estructura /functions
router.use('/providers', require('./routes/providerRoutes'));
router.use('/inventory', require('./routes/inventoryRoutes'));
// Si tienes estos archivos creados, descoméntalos:
// router.use('/quotes', require('./routes/quoteRoutes'));
// router.use('/invoices', require('./routes/invoiceRoutes'));

// Montaje de rutas: Solo necesitamos /api porque netlify.toml redirige el resto
app.use('/api', router);

// 3. Servir archivos estáticos (Útil solo en modo local)
app.use(express.static(path.join(__dirname, '../public')));

// 4. Manejador 404 para API
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: `Ruta API no encontrada: ${req.originalUrl}` 
    });
});

/**
 * Manejador de errores global (Captura el Error 500)
 */
app.use((err, req, res, next) => {
    console.error("🚨 ERROR CRÍTICO EN SERVER.JS:", err.stack);
    res.status(500).json({ 
        success: false, 
        error: "Error interno en la función del servidor",
        details: err.message 
    });
});

// ==========================================
// 🚀 EXPORTACIÓN PARA NETLIFY (HANDLER)
// ==========================================

// IMPORTANTE: Netlify requiere que el handler sea la exportación principal
module.exports.handler = serverless(app, {
    binary: ['image/png', 'image/jpeg', 'application/pdf'],
    // Esto asegura que la base de datos no mantenga la función abierta innecesariamente
    callbackWaitsForEmptyEventLoop: false 
});

// Solo para desarrollo local
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`\n🚀 SERVIDOR LOCAL: http://localhost:${PORT}/api`);
    });
}