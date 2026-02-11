const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
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

// Middleware de logging para depuración (Verás esto en la consola de VS Code o Netlify)
app.use((req, res, next) => {
    console.log(`📨 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 2. Conexión a Base de Datos
// En Serverless es vital que la conexión sea eficiente
connectDB().then(() => {
    console.log("🟢 Conexión a MongoDB establecida desde server.js");
}).catch(err => {
    console.error("🚨 Error inicial de conexión DB:", err);
});

// ==========================================
// RUTAS DE LA API
// ==========================================
const router = express.Router();

// Importación de rutas (Asegúrate de que los archivos existan en /routes)
router.use('/providers', require('./routes/providerRoutes'));
router.use('/inventory', require('./routes/inventoryRoutes'));

// ✅ ACTIVADAS: Ya no están comentadas, ahora el cotizador podrá hablar con el servidor
router.use('/quotes', require('./routes/quoteRoutes'));
router.use('/invoices', require('./routes/invoiceRoutes'));

// Montaje de rutas bajo el prefijo /api
app.use('/api', router);

// 3. Servir archivos estáticos
// Ajustamos para que busque la carpeta public correctamente subiendo un nivel si es necesario
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// 4. Manejador 404 para API
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: `Ruta API no encontrada: ${req.originalUrl}` 
    });
});

// Redirección para SPA (Opcional): Si el usuario refresca en una ruta que no es API, sirve el index
app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
        res.sendFile(path.join(publicPath, 'dashboard.html'));
    }
});

/**
 * Manejador de errores global
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

module.exports.handler = serverless(app, {
    binary: ['image/png', 'image/jpeg', 'application/pdf'],
    // callbackWaitsForEmptyEventLoop: false es CLAVE para que MongoDB no cuelgue la función de Netlify
    callbackWaitsForEmptyEventLoop: false 
});

// Solo para desarrollo local
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`\n✅ SERVIDOR LOCAL CORRIENDO`);
        console.log(`👉 API: http://localhost:${PORT}/api`);
        console.log(`👉 WEB: http://localhost:${PORT}/dashboard.html\n`);
    });
}