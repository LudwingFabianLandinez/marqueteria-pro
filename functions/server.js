const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// 1. Middlewares de Seguridad y Capacidad
app.use(cors());
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging para depuración
app.use((req, res, next) => {
    console.log(`📨 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 2. Conexión a Base de Datos (Optimizada para Serverless)
let isConnected = false;
const connect = async () => {
    if (isConnected) return;
    try {
        await connectDB();
        isConnected = true;
        console.log("🟢 Conexión a MongoDB establecida");
    } catch (err) {
        console.error("🚨 Error inicial de conexión DB:", err);
    }
};
connect();

// ==========================================
// RUTAS DE LA API
// ==========================================
const router = express.Router();

// Importación de rutas
router.use('/providers', require('./routes/providerRoutes'));
router.use('/inventory', require('./routes/inventoryRoutes'));
router.use('/quotes', require('./routes/quoteRoutes'));
router.use('/invoices', require('./routes/invoiceRoutes'));

// Montaje de rutas bajo el prefijo /api
app.use('/api', router);

// 3. Manejo de Archivos Estáticos (CORRECCIÓN CRÍTICA PARA NETLIFY)
// En Netlify, los archivos estáticos los sirve Netlify directamente desde la carpeta pública,
// no es necesario que Express lo haga. Esto evita el Error 404 del CSS.
if (process.env.NODE_ENV !== 'production') {
    const publicPath = path.join(__dirname, '../public');
    app.use(express.static(publicPath));
}

// 4. Manejador 404 para API
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: `Ruta API no encontrada: ${req.originalUrl}` 
    });
});

/**
 * Manejador de errores global (Para eliminar el Error 500 genérico)
 */
app.use((err, req, res, next) => {
    console.error("🚨 ERROR EN EL SERVIDOR:", err);
    res.status(err.status || 500).json({ 
        success: false, 
        error: "Error interno en el servidor",
        message: err.message
    });
});

// ==========================================
// 🚀 EXPORTACIÓN PARA NETLIFY
// ==========================================
module.exports.handler = async (event, context) => {
    // Esto asegura que la base de datos responda antes de que la función se cierre
    context.callbackWaitsForEmptyEventLoop = false;
    await connect();
    const handler = serverless(app);
    return await handler(event, context);
};

// Solo para desarrollo local
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`\n✅ SERVIDOR LOCAL CORRIENDO EN EL PUERTO ${PORT}`);
    });
}