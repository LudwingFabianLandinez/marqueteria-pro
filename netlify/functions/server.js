const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http'); 
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');

// 1. CARGA DE MODELOS (Singleton)
try {
    require('./models/Provider');
    require('./models/Material');
    require('./models/Invoice'); 
    require('./models/Transaction'); 
    require('./models/Purchase');
    require('./models/Client');
    console.log("📦 Modelos cargados");
} catch (err) {
    console.error("🚨 Error modelos:", err.message);
}

const app = express();

// 2. MIDDLEWARES INICIALES
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. NORMALIZACIÓN DE URL (DEBE IR ANTES DEL ROUTER)
app.use((req, res, next) => {
    const prefixes = ['/.netlify/functions/server', '/api'];
    let currentUrl = req.url;
    
    prefixes.forEach(prefix => {
        if (currentUrl.startsWith(prefix)) {
            currentUrl = currentUrl.replace(prefix, '');
        }
    });

    // Aseguramos que la URL sea válida para Express
    req.url = (currentUrl === '' || currentUrl === '/') ? '/' : currentUrl;
    next();
});

// 4. GESTIÓN DE CONEXIÓN DB
let isConnected = false;
const connect = async () => {
    if (isConnected && mongoose.connection.readyState === 1) return;
    try {
        mongoose.set('bufferCommands', false); 
        mongoose.set('strictQuery', false);
        await connectDB();
        isConnected = true;
        console.log("🟢 MongoDB Atlas Conectado");
    } catch (err) {
        console.error("🚨 Error DB:", err);
        isConnected = false;
        throw err;
    }
};

// 5. DEFINICIÓN DE RUTAS
const router = express.Router();

try {
    router.use('/inventory', require('./routes/inventoryRoutes'));
    router.use('/quotes', require('./routes/quoteRoutes'));
    router.use('/invoices', require('./routes/invoiceRoutes'));
    router.use('/stats', require('./routes/statsRoutes'));
    router.use('/purchases', require('./routes/purchaseRoutes')); 
    router.use('/providers', require('./routes/providerRoutes')); 
    router.use('/clients', require('./routes/clientRoutes'));
    
    router.get('/health', (req, res) => {
        res.json({ status: 'OK', db: isConnected });
    });

    console.log("✅ Rutas mapeadas");
} catch (error) {
    console.error(`🚨 Error rutas: ${error.message}`);
}

// 6. VINCULACIÓN FINAL
app.use('/', router);

const handler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    
    try {
        await connect();
        // Importante: Netlify a veces envía paths que serverless-http necesita procesar
        return await handler(event, context);
    } catch (error) {
        console.error("🚨 Handler Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error interno', details: error.message })
        };
    }
};