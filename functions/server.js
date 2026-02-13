const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
const mongoose = require('mongoose'); // <--- SUMAR ESTO
require('dotenv').config();

/**
 * CONFIGURACIÓN DE MODELOS
 */
try {
    require('./models/Provider');
    require('./models/Material');
    require('./models/Invoice'); 
    require('./models/Transaction'); 
    require('./models/Purchase');
    require('./models/Client');
    console.log("📦 Modelos cargados correctamente");
} catch (err) {
    console.error("🚨 Error cargando modelos:", err.message);
}

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Gestión de Conexión Singleton - MANTENEMOS TU LÓGICA
let isConnected = false;
const connect = async () => {
    if (isConnected) return;
    try {
        // --- ESTO ES LO ÚNICO QUE SUMAMOS PARA ACTIVAR LOS BOTONES ---
        // Evita que proveedores.find() se bloquee 10 segundos
        mongoose.set('bufferCommands', false); 
        
        await connectDB();
        isConnected = true;
        console.log("🟢 MongoDB Conectado a Atlas");
    } catch (err) {
        console.error("🚨 Error Crítico de Conexión DB:", err);
    }
};

const router = express.Router();

const safeLoad = (routePath, moduleRelativePath) => {
    try {
        const absolutePath = path.resolve(__dirname, moduleRelativePath);
        const routeModule = require(absolutePath);
        router.use(routePath, routeModule);
        console.log(`✅ Ruta activa: ${routePath}`);
    } catch (error) {
        console.error(`🚨 ERROR CARGANDO RUTA [${routePath}]: ${error.message}`);
    }
};

// --- MAPEO DE RUTAS (Se mantienen todas) ---
safeLoad('/inventory', './routes/inventoryRoutes');
safeLoad('/quotes', './routes/quoteRoutes');
safeLoad('/invoices', './routes/invoiceRoutes');
safeLoad('/stats', './routes/statsRoutes');
safeLoad('/purchases', './routes/purchaseRoutes'); 
safeLoad('/providers', './routes/providerRoutes'); 
safeLoad('/clients', './routes/clientRoutes');

app.use((req, res, next) => {
    const prefixes = ['/.netlify/functions/server', '/api'];
    let currentUrl = req.url;
    
    prefixes.forEach(prefix => {
        if (currentUrl.startsWith(prefix)) {
            currentUrl = currentUrl.replace(prefix, '');
        }
    });

    req.url = currentUrl === '' ? '/' : currentUrl;
    next();
});

app.use('/', router);

const handler = serverless(app);

module.exports.handler = async (event, context) => {
    // Esto asegura que la respuesta sea inmediata al presionar botones
    context.callbackWaitsForEmptyEventLoop = false;
    await connect();
    return await handler(event, context);
};