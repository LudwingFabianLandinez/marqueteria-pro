/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión 12.2.6 (BUILD CON FAMILIAS)
 * Objetivo: Ejecución garantizada, blindaje de modelos y sincronización de familias para cotización.
 */

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
    require('./models/Client');
    console.log("📦 Modelos v12.2.6 registrados exitosamente");
} catch (err) {
    console.error("🚨 Error inicializando modelos:", err.message);
}

const app = express();

// 2. MIDDLEWARES INICIALES
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. NORMALIZACIÓN DE URL (Blindaje Netlify)
app.use((req, res, next) => {
    const basePrefix = '/.netlify/functions/server';
    if (req.url.startsWith(basePrefix)) {
        req.url = req.url.replace(basePrefix, '');
    }
    req.url = req.url.replace(/\/+/g, '/');
    if (!req.url || req.url === '') { req.url = '/'; }
    console.log(`📡 [v12.2.6] ${req.method} -> ${req.url}`);
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
        console.log("🟢 Conexión activa con MongoDB Atlas");
    } catch (err) {
        console.error("🚨 Error en conexión DB:", err.message);
        isConnected = false;
        throw err;
    }
};

// 5. DEFINICIÓN DE RUTAS
const router = express.Router();

try {
    const Material = mongoose.model('Material'); // Referencia al modelo para la nueva ruta

    // --- 🚀 NUEVA RUTA: SINCRONIZACIÓN DE FAMILIAS PARA COTIZACIÓN ---
    // Esta ruta resuelve el error 404 que ves en la consola
    router.get('/quotes/materials', async (req, res) => {
        try {
            const materiales = await Material.find({ estado: 'Activo' });
            
            // Clasificación por familias según el nombre o categoría para el frontend
            const data = {
                vidrios: materiales.filter(m => m.nombre.toLowerCase().includes('vidrio')),
                respaldos: materiales.filter(m => m.nombre.toLowerCase().includes('mdf') || m.nombre.toLowerCase().includes('respaldo')),
                marcos: materiales.filter(m => m.categoria === 'Marco' || m.nombre.toLowerCase().includes('marco') || m.nombre.toLowerCase().includes('moldura')),
                paspartu: materiales.filter(m => m.nombre.toLowerCase().includes('paspartu')),
                foam: materiales.filter(m => m.nombre.toLowerCase().includes('foam')),
                tela: materiales.filter(m => m.nombre.toLowerCase().includes('tela')),
                chapilla: materiales.filter(m => m.nombre.toLowerCase().includes('chapilla'))
            };

            res.json({ success: true, data });
        } catch (error) {
            console.error("🚨 Error en /quotes/materials:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Rutas existentes (Mapeo v12.2.x)
    const inventoryRoutes = require('./routes/inventoryRoutes');
    const providerRoutes = require('./routes/providerRoutes');

    router.use('/inventory', inventoryRoutes);
    router.use('/providers', providerRoutes);
    router.use('/purchases', inventoryRoutes);
    
    try { router.use('/clients', require('./routes/clientRoutes')); } catch(e){}
    try { router.use('/invoices', require('./routes/invoiceRoutes')); } catch(e){}
    try { router.use('/quotes', require('./routes/quoteRoutes')); } catch(e){}
    try { router.use('/stats', require('./routes/statsRoutes')); } catch(e){}

    router.get('/health', (req, res) => {
        res.json({ status: 'OK', version: '12.2.6', db: mongoose.connection.readyState === 1 });
    });

    console.log("✅ Mapa de rutas sincronizado y familias habilitadas");
} catch (error) {
    console.error(`🚨 Error vinculando rutas en server.js: ${error.message}`);
}

// 6. VINCULACIÓN FINAL
app.use('/', router);

// Manejador de errores global
app.use((err, req, res, next) => {
    console.error("🔥 Error en ejecución serverless:", err.stack);
    res.status(500).json({
        success: false,
        message: "Error interno procesando la solicitud",
        error: err.message
    });
});

const handler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await connect();
        return await handler(event, context);
    } catch (error) {
        console.error("🚨 Handler Crash:", error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ success: false, error: 'Fallo fatal en el servidor Netlify' })
        };
    }
};