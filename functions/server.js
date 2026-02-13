const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
require('dotenv').config();

/**
 * CONFIGURACIÓN DE MODELOS
 * Usamos una carga protegida para asegurar que el empaquetador de Netlify
 * incluya los archivos correctamente.
 */
try {
    require('./models/Provider');
    require('./models/Material');
    require('./models/Invoice'); 
    require('./models/Transaction'); 
    require('./models/Purchase');
    // Sumamos el de Cliente para que el botón funcione
    require('./models/Client'); 
    console.log("📦 Modelos cargados correctamente");
} catch (err) {
    console.error("🚨 Error cargando modelos:", err.message);
}

const app = express();

// 1. Configuración de Seguridad y Datos (CORS optimizado)
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Gestión de Conexión a MongoDB (Patrón Singleton para Serverless)
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

// 3. Sistema de Carga de Rutas con Router (CORREGIDO PARA NETLIFY)
const router = express.Router();

const safeLoad = (routePath, moduleRelativePath) => {
    try {
        // Ajuste Quirúrgico: Resolvemos la ruta absoluta basada en la ubicación de server.js
        const absolutePath = path.resolve(__dirname, moduleRelativePath);
        const routeModule = require(absolutePath);
        router.use(routePath, routeModule);
        console.log(`✅ Ruta activa: ${routePath}`);
    } catch (error) {
        console.error(`🚨 ERROR CARGANDO RUTA [${routePath}]:`);
        console.error(`Detalle: ${error.message}`);
    }
};

// --- MAPEO DE RUTAS DE LA API ---
// Aquí es donde activamos los botones que te hacían falta
safeLoad('/inventory', './routes/inventoryRoutes');
safeLoad('/quotes', './routes/quoteRoutes');
safeLoad('/invoices', './routes/invoiceRoutes');
safeLoad('/stats', './routes/statsRoutes');
safeLoad('/purchases', './routes/purchaseRoutes'); 
safeLoad('/providers', './routes/providerRoutes'); 
safeLoad('/suppliers', './routes/providerRoutes'); 
safeLoad('/clients', './routes/clientRoutes'); // <--- NUEVA RUTA PARA BOTÓN CLIENTES

/**
 * AJUSTE QUIRÚRGICO DE RUTAS
 * Este middleware limpia la URL antes de que llegue al router para evitar el 404.
 */
app.use((req, res, next) => {
    const prefixes = ['/.netlify/functions/server', '/api'];
    let currentUrl = req.url;
    
    prefixes.forEach(prefix => {
        if (currentUrl.startsWith(prefix)) {
            currentUrl = currentUrl.replace(prefix, '');
        }
    });

    req.url = currentUrl === '' ? '/' : currentUrl;
    console.log(`🔍 Ruta procesada: ${req.url}`); 
    next();
});

// Aplicamos el router a la raíz ya limpia
app.use('/', router);

// Manejador Global de Errores (Devuelve JSON, no HTML)
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
    // Vital para entornos serverless: Evita que la función se quede "colgada"
    context.callbackWaitsForEmptyEventLoop = false;
    await connect();
    return await handler(event, context);
};

// Modo Desarrollo Local
if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        connect = async () => { // Redefinición simple para local
             if (isConnected) return;
             await connectDB();
             isConnected = true;
        };
        connect();
        console.log(`🚀 Servidor de Pruebas: http://localhost:${PORT}`);
    });
}