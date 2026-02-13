const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
const mongoose = require('mongoose');
require('dotenv').config();

/**
 * CONFIGURACIÓN DE MODELOS
 * Los cargamos al inicio para que las rutas los encuentren siempre
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

// Gestión de Conexión Singleton
let isConnected = false;
const connect = async () => {
    if (isConnected && mongoose.connection.readyState === 1) return;
    try {
        // Desactivamos el buffering para que si la conexión tarda, el servidor no se quede colgado
        mongoose.set('bufferCommands', false); 
        
        await connectDB();
        isConnected = true;
        console.log("🟢 MongoDB Conectado a Atlas");
    } catch (err) {
        console.error("🚨 Error Crítico de Conexión DB:", err);
        isConnected = false;
    }
};

const router = express.Router();

// --- MAPEO DE RUTAS MEJORADO ---
// Usamos require directo para evitar fallos de resolución de path en Netlify
try {
    router.use('/inventory', require('./routes/inventoryRoutes'));
    router.use('/quotes', require('./routes/quoteRoutes'));
    router.use('/invoices', require('./routes/invoiceRoutes'));
    router.use('/stats', require('./routes/statsRoutes'));
    router.use('/purchases', require('./routes/purchaseRoutes')); 
    router.use('/providers', require('./routes/providerRoutes')); 
    router.use('/clients', require('./routes/clientRoutes'));
    console.log("✅ Todas las rutas mapeadas correctamente");
} catch (error) {
    console.error(`🚨 ERROR CRÍTICO CARGANDO RUTAS: ${error.message}`);
}

// Middleware para normalizar las URLs de Netlify
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
    // Evita que Netlify espere a que la conexión de Mongo se cierre para responder
    context.callbackWaitsForEmptyEventLoop = false;
    
    // Conectamos a la DB antes de procesar la petición
    await connect();
    
    return await handler(event, context);
};