const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
require('dotenv').config();

// IMPORTANTE: Cargamos los modelos estandarizados
require('./models/Provider');
require('./models/Material');
require('./models/Invoice'); 
require('./models/Transaction'); 
// require('./models/Purchase'); // Comentado temporalmente hasta que crees el archivo físico

const app = express();

// 1. Configuración de Seguridad y Datos
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Gestión de Conexión a MongoDB
let isConnected = false;
const connect = async () => {
    if (isConnected) return;
    try {
        await connectDB();
        isConnected = true;
        console.log("🟢 MongoDB Conectado a Atlas");
    } catch (err) {
        console.error("🚨 Error Crítico de Conexión DB:", err);
    }
};

// 3. Sistema de Carga de Rutas
const router = express.Router();

const safeLoad = (routePath, modulePath) => {
    try {
        const routeModule = require(modulePath);
        router.use(routePath, routeModule);
        console.log(`✅ Ruta activa: ${routePath}`);
    } catch (error) {
        console.error(`🚨 ERROR CARGANDO RUTA [${routePath}]: Verifica que ${modulePath} exista.`);
        // No lanzamos el error para que el servidor no se caiga si falta una ruta secundaria
    }
};

// --- MAPEO DE RUTAS DE LA API ---
safeLoad('/inventory', './routes/inventoryRoutes');
safeLoad('/quotes', './routes/quoteRoutes');
safeLoad('/invoices', './routes/invoiceRoutes');
safeLoad('/stats', './routes/statsRoutes');
// safeLoad('/purchases', './routes/purchaseRoutes'); // Comentado hasta que el archivo exista

// UNIFICACIÓN QUIRÚRGICA: 
safeLoad('/providers', './routes/providerRoutes'); 
safeLoad('/suppliers', './routes/providerRoutes'); 

app.use('/api', router);

// Manejador Global de Errores
app.use((err, req, res, next) => {
    console.error("🚨 ERROR NO CONTROLADO:", err.stack);
    res.status(500).json({ 
        success: false, 
        error: "Error interno en el servidor", 
        message: err.message 
    });
});

// 4. Exportación para Netlify Functions
const handler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connect();
    return await handler(event, context);
};

// Modo Desarrollo Local
if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        connect();
        console.log(`🚀 Servidor de Pruebas: http://localhost:${PORT}`);
    });
}