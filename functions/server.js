const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// 1. CORS Totalmente Abierto para que ningún botón se bloquee por seguridad
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Conexión a Base de Datos
let isConnected = false;
const connect = async () => {
    if (isConnected) return;
    try {
        await connectDB();
        isConnected = true;
        console.log("🟢 MongoDB Conectado");
    } catch (err) {
        console.error("🚨 Error DB:", err);
    }
};
connect();

// ==========================================
// 3. RUTAS DE LA API (Activación de todos los botones)
// ==========================================
const router = express.Router();

// Estas líneas mapean los clics del frontend con tus archivos en la carpeta 'routes'
router.use('/inventory', require('./routes/inventoryRoutes'));
router.use('/quotes', require('./routes/quoteRoutes'));
router.use('/invoices', require('./routes/invoiceRoutes'));

// Activación del botón de Proveedores (Soportamos ambos nombres comunes en tu proyecto)
router.use('/providers', require('./routes/providerRoutes'));
router.use('/suppliers', require('./routes/supplierRoutes'));

// Activación de Estadísticas e Historiales
try {
    router.use('/stats', require('./routes/statsRoutes'));
} catch (e) {
    console.log("ℹ️ Ruta /stats no disponible");
}

app.use('/api', router);

// Manejador de errores para que la app no se "congele" y dé respuestas claras
app.use((err, req, res, next) => {
    console.error("🚨 ERROR EN EL SERVIDOR:", err);
    res.status(500).json({ 
        success: false, 
        error: "Error interno en el servidor",
        message: err.message
    });
});

// ==========================================
// 4. EXPORTACIÓN PARA NETLIFY
// ==========================================
const handler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connect();
    return await handler(event, context);
};

// Desarrollo local
if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`✅ Servidor local en puerto ${PORT}`));
}