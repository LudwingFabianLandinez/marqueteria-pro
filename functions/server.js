const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// 1. Configuración de CORS Blindada (Acepta Netlify y Localhost sin restricciones)
const allowedOrigins = [
    'https://meek-monstera-23f18d.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:4000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir peticiones sin origen o si están en la lista blanca
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // En caso de emergencia con el cliente, podrías cambiar la línea de abajo por: callback(null, true);
            callback(new Error('CORS: Origen no permitido por seguridad'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging para depuración (Verás las rutas en los logs de Render)
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
// Llamada inicial
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
    // Esto asegura que la base de datos responda antes de que la función se cierre
    context.callbackWaitsForEmptyEventLoop = false;
    
    // Re-conectar si la conexión se perdió entre ejecuciones
    await connect();
    
    return await handler(event, context);
};

// Solo para desarrollo local o Render (Non-serverless)
if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`\n✅ SERVIDOR CORRIENDO EN EL PUERTO ${PORT}`);
    });
}