const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http'); 
const mongoose = require('mongoose');
require('dotenv').config();

// Requerimos el archivo de conexión (Asegúrate que la ruta sea correcta desde functions/)
const connectDB = require('./config/db');

/**
 * CONFIGURACIÓN DE MODELOS
 * Los cargamos al inicio para evitar el error "Schema hasn't been registered"
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

// Configuración de Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Gestión de Conexión Singleton (Optimizada para Serverless)
let isConnected = false;
const connect = async () => {
    if (isConnected && mongoose.connection.readyState === 1) return;
    try {
        mongoose.set('bufferCommands', false); 
        mongoose.set('strictQuery', false); // Para evitar warnings en versiones nuevas
        
        await connectDB();
        isConnected = true;
        console.log("🟢 MongoDB Conectado a Atlas");
    } catch (err) {
        console.error("🚨 Error Crítico de Conexión DB:", err);
        isConnected = false;
        throw err; // Re-lanzamos para que el handler sepa que falló
    }
};

const router = express.Router();

/**
 * MAPEO DE RUTAS
 * IMPORTANTE: Verifica que los archivos existan en estas rutas relativas
 */
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

// Middleware para normalizar las URLs de Netlify (Bypass de prefijos)
app.use((req, res, next) => {
    const prefixes = ['/.netlify/functions/server', '/api'];
    let currentUrl = req.url;
    
    prefixes.forEach(prefix => {
        if (currentUrl.startsWith(prefix)) {
            currentUrl = currentUrl.replace(prefix, '');
        }
    });

    // Si después de limpiar queda vacío o solo prefijo, mandamos a raíz
    req.url = currentUrl === '' || currentUrl === '/' ? '/' : currentUrl;
    next();
});

// Ruta de salud para probar que el servidor responde
router.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Servidor funcionando en Netlify' });
});

app.use('/', router);

// Envolver Express con Serverless
const handler = serverless(app);

module.exports.handler = async (event, context) => {
    // 1. Evita que Netlify espere a que el loop de eventos esté vacío (vital para DBs)
    context.callbackWaitsForEmptyEventLoop = false;
    
    try {
        // 2. Conectar a la DB antes de procesar
        await connect();
        
        // 3. Procesar la petición
        return await handler(event, context);
    } catch (error) {
        console.error("🚨 Error en el Handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
        };
    }
};