/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión 12.2.5 (BUILD FINAL & SINCRO)
 * Objetivo: Ejecución garantizada y blindaje de modelos para Inventario.
 */

const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http'); 
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');

// 1. CARGA DE MODELOS (Singleton - Asegura que existan antes de las rutas)
// Nota: El orden importa para evitar errores de referencia circular
try {
    require('./models/Provider');
    require('./models/Material'); // Este ya incluye el Enum 'General'
    require('./models/Invoice'); 
    require('./models/Transaction'); 
    require('./models/Client');
    console.log("📦 Modelos v12.2.5 registrados exitosamente");
} catch (err) {
    console.error("🚨 Error inicializando modelos:", err.message);
}

const app = express();

// 2. MIDDLEWARES INICIALES
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. NORMALIZACIÓN QUIRÚRGICA DE URL (Blindaje 404 de Netlify)
app.use((req, res, next) => {
    const basePrefix = '/.netlify/functions/server';
    
    if (req.url.startsWith(basePrefix)) {
        req.url = req.url.replace(basePrefix, '');
    }

    // ELIMINACIÓN DE DOBLE SLASH (Común en despliegues de Netlify)
    req.url = req.url.replace(/\/+/g, '/');

    if (!req.url || req.url === '') {
        req.url = '/';
    }

    console.log(`📡 [v12.2.5] ${req.method} -> ${req.url}`);
    next();
});

// 4. GESTIÓN DE CONEXIÓN DB (Optimizado para Serverless / Mongoose Singleton)
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

// 5. DEFINICIÓN DE RUTAS (Mapeo Ultra-Robusto)
const router = express.Router();

try {
    // Importamos las rutas que acabamos de consolidar
    const inventoryRoutes = require('./routes/inventoryRoutes');
    const providerRoutes = require('./routes/providerRoutes');

    // Mapeo Directo: /api/inventory -> inventoryRoutes
    router.use('/inventory', inventoryRoutes);
    router.use('/providers', providerRoutes);
    
    // REDIRECCIÓN INTELIGENTE: Si el frontend llama a /purchases lo enviamos al inventario
    // donde reside la lógica de registerPurchase consolidada.
    router.use('/purchases', inventoryRoutes);
    
    // Rutas Complementarias (Carga dinámica para evitar fallos si no existen)
    try { router.use('/clients', require('./routes/clientRoutes')); } catch(e){}
    try { router.use('/invoices', require('./routes/invoiceRoutes')); } catch(e){}
    try { router.use('/quotes', require('./routes/quoteRoutes')); } catch(e){}
    try { router.use('/stats', require('./routes/statsRoutes')); } catch(e){}

    router.get('/health', (req, res) => {
        res.json({ 
            status: 'OK', 
            version: '12.2.5',
            db: mongoose.connection.readyState === 1,
            env: process.env.NODE_ENV || 'production'
        });
    });

    console.log("✅ Mapa de rutas sincronizado con controladores v12.2.x");
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
    // Importante para Netlify: No esperar a que el event loop esté vacío
    context.callbackWaitsForEmptyEventLoop = false;
    
    try {
        await connect();
        return await handler(event, context);
    } catch (error) {
        console.error("🚨 Handler Crash:", error);
        return {
            statusCode: 500,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
            },
            body: JSON.stringify({ 
                success: false, 
                error: 'Fallo fatal en el servidor Netlify', 
                details: error.message 
            })
        };
    }
};