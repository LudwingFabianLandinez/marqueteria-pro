const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http'); 
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');

/**
 * 1. RESCATE DE MODELOS
 * Cargarlos aquí es vital para que las rutas externas funcionen con Atlas
 */
try {
    require('./models/Provider');
    require('./models/Material');
    require('./models/Invoice'); 
    require('./models/Transaction'); 
    require('./models/Purchase');
    require('./models/Client');
    console.log("📦 Modelos cargados desde carpetas originales");
} catch (err) {
    console.error("🚨 Error cargando modelos:", err.message);
}

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. CONEXIÓN SINGLETON (Rescatada de tu blindaje anterior)
let isConnected = false;
const connect = async () => {
    if (isConnected && mongoose.connection.readyState === 1) return;
    try {
        mongoose.set('bufferCommands', false); 
        await connectDB();
        isConnected = true;
        console.log("🟢 Conexión de fondo establecida con Atlas");
    } catch (err) {
        console.error("🚨 Fallo de conexión DB:", err.message);
        isConnected = false;
    }
};

// 3. NORMALIZACIÓN DE RUTAS NETLIFY
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

// 4. MAPEO DE RUTAS EXTERNAS (El corazón de tu sistema original)
const router = express.Router();
try {
    router.use('/inventory', require('./routes/inventoryRoutes'));
    router.use('/quotes', require('./routes/quoteRoutes'));
    router.use('/invoices', require('./routes/invoiceRoutes'));
    router.use('/stats', require('./routes/statsRoutes'));
    router.use('/purchases', require('./routes/purchaseRoutes')); 
    router.use('/providers', require('./routes/providerRoutes')); 
    router.use('/clients', require('./routes/clientRoutes'));
    console.log("✅ Rutas externas vinculadas correctamente");
} catch (error) {
    console.error(`🚨 ERROR EN RUTAS: ${error.message}`);
}

app.use('/', router);

const handler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connect();
    return await handler(event, context);
};