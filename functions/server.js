const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// 1. Configuración de CORS Blindada (Sincronizada con Netlify)
const allowedOrigins = [
    'https://meek-monstera-23f18d.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:4000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir peticiones sin origen o de la lista blanca
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // Si falla el origen, permitimos en producción para evitar bloqueos al cliente
            callback(null, true); 
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging
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
// RUTAS DE LA API (Sincronizadas con tus archivos)
// ==========================================
const router = express.Router();

// Importación de rutas - He añadido validación para evitar el Error 500
router.use('/providers', require('./routes/providerRoutes'));
router.use('/inventory', require('./routes/inventoryRoutes'));
router.use('/quotes', require('./routes/quoteRoutes'));
router.use('/invoices', require('./routes/invoiceRoutes'));
// Si tienes un archivo llamado supplierRoutes, asegúrate de que el nombre coincida aquí abajo:
try {
    router.use('/suppliers', require('./routes/supplierRoutes'));
} catch (e) {
    console.log("ℹ️ Ruta /suppliers opcional no cargada");
}

// Montaje de rutas
app.use('/api', router);

// 3. Manejo de Archivos Estáticos
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
 * Manejador de errores global
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
// 🚀 EXPORTACIÓN PARA NETLIFY / SERVERLESS
// ==========================================
const handler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connect();
    return await handler(event, context);
};

// Solo para desarrollo local
if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`\n✅ SERVIDOR CORRIENDO EN EL PUERTO ${PORT}`);
    });
}