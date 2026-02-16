/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión 12.2.0 (RUTA ULTRA-ROBUSTA)
 * Objetivo: Eliminar definitivamente el Error 404 mediante mapeo forzado.
 */

const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http'); 
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');

// 1. CARGA DE MODELOS (Singleton - Asegura que existan antes de las rutas)
try {
    require('./models/Provider');
    require('./models/Material');
    require('./models/Invoice'); 
    require('./models/Transaction'); 
    require('./models/Purchase');
    require('./models/Client');
    console.log("📦 Modelos v12.2.0 cargados");
} catch (err) {
    console.error("🚨 Error modelos:", err.message);
}

const app = express();

// 2. MIDDLEWARES INICIALES
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. NORMALIZACIÓN QUIRÚRGICA DE URL (Blindaje 404)
app.use((req, res, next) => {
    const basePrefix = '/.netlify/functions/server';
    
    // Eliminamos el prefijo de Netlify si existe
    if (req.url.startsWith(basePrefix)) {
        req.url = req.url.replace(basePrefix, '');
    }

    // ELIMINACIÓN DE DOBLE SLASH: Netlify a veces envía //inventory
    req.url = req.url.replace(/\/+/g, '/');

    // Aseguramos que la ruta no quede vacía
    if (!req.url || req.url === '') {
        req.url = '/';
    }

    console.log(`📡 [v12.2.0] ${req.method} procesado para: ${req.url}`);
    next();
});

// 4. GESTIÓN DE CONEXIÓN DB (Optimizado para Serverless)
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
        console.error("🚨 Error crítico DB:", err.message);
        isConnected = false;
        throw err;
    }
};

// 5. DEFINICIÓN DE RUTAS (Mapeo Ultra-Robusto)
const router = express.Router();

try {
    const inventoryRoutes = require('./routes/inventoryRoutes');
    const purchaseRoutes = require('./routes/purchaseRoutes');
    const providerRoutes = require('./routes/providerRoutes');

    // Mapeo Directo
    router.use('/inventory', inventoryRoutes);
    router.use('/providers', providerRoutes);
    router.use('/purchases', purchaseRoutes);
    
    // ALIAS DE SEGURIDAD: Si el frontend busca /inventory/purchase, redirigimos aquí.
    router.use('/inventory/purchase', purchaseRoutes);
    
    // Rutas Complementarias
    router.use('/clients', require('./routes/clientRoutes'));
    router.use('/invoices', require('./routes/invoiceRoutes'));
    router.use('/quotes', require('./routes/quoteRoutes'));
    router.use('/stats', require('./routes/statsRoutes'));

    router.get('/health', (req, res) => {
        res.json({ 
            status: 'OK', 
            version: '12.2.0',
            db: mongoose.connection.readyState === 1 
        });
    });

    console.log("✅ Sistema de rutas ultra-robusto mapeado");
} catch (error) {
    console.error(`🚨 Error vinculando rutas: ${error.message}`);
}

// 6. VINCULACIÓN FINAL
// Montamos todo en la raíz para que el middleware de limpieza sea efectivo
app.use('/', router);

// Manejador de errores global
app.use((err, req, res, next) => {
    console.error("🔥 Error crítico servidor:", err.stack);
    res.status(500).json({
        success: false,
        message: "Error interno en Netlify",
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                success: false, 
                error: 'Fallo fatal en ejecución', 
                details: error.message 
            })
        };
    }
};