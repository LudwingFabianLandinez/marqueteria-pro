/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión 12.2.9 (BUILD CONSOLIDADO FINAL)
 * Objetivo: Ejecución garantizada, blindaje de modelos y cálculo dinámico (Costo x 3).
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
    console.log("📦 Modelos v12.2.9 registrados exitosamente");
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
    console.log(`📡 [v12.2.9] ${req.method} -> ${req.url}`);
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
    const Material = mongoose.model('Material'); 

    // --- 🚀 RUTA DE SINCRONIZACIÓN DE FAMILIAS ---
    router.get('/quotes/materials', async (req, res) => {
        try {
            const materiales = await Material.find({ estado: { $ne: 'Inactivo' } });
            const normalizar = (texto) => texto ? texto.toLowerCase().trim() : "";

            const data = {
                vidrios: materiales.filter(m => {
                    const n = normalizar(m.nombre);
                    const c = normalizar(m.categoria);
                    return n.includes('vidrio') || n.includes('espejo') || c.includes('vidrio');
                }),
                respaldos: materiales.filter(m => {
                    const n = normalizar(m.nombre);
                    return n.includes('mdf') || n.includes('respaldo') || n.includes('triplex') || n.includes('celtex');
                }),
                marcos: materiales.filter(m => {
                    const n = normalizar(m.nombre);
                    const c = normalizar(m.categoria);
                    return c.includes('marco') || n.includes('marco') || n.includes('moldura') || n.includes('madera');
                }),
                paspartu: materiales.filter(m => {
                    const n = normalizar(m.nombre);
                    return n.includes('paspartu') || n.includes('passepartout') || n.includes('cartulina');
                }),
                foam: materiales.filter(m => normalizar(m.nombre).includes('foam')),
                tela: materiales.filter(m => normalizar(m.nombre).includes('tela') || normalizar(m.nombre).includes('lona')),
                chapilla: materiales.filter(m => normalizar(m.nombre).includes('chapilla'))
            };

            res.json({ success: true, count: materiales.length, data });
        } catch (error) {
            console.error("🚨 Error en /quotes/materials:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 🧮 MOTOR DE CÁLCULO DE COTIZACIÓN (SINCRONIZACIÓN TOTAL) ---
    router.post('/quotes', async (req, res) => {
        try {
            const { ancho, largo, materialesIds, manoObra } = req.body;
            const materialesDB = await Material.find({ _id: { $in: materialesIds } });
            
            const area_m2 = (ancho * largo) / 10000;
            let costoBaseTotalMateriales = 0;
            let detallesItems = [];

            materialesDB.forEach(mat => {
                // Buscamos el costo en cualquier variante del esquema
                const costoM2 = mat.costo_m2 || mat.precio_costo_m2 || mat.precio || mat.costo || 0;
                const costoProporcional = area_m2 * costoM2;
                
                costoBaseTotalMateriales += costoProporcional;
                
                detallesItems.push({
                    nombre: mat.nombre,
                    costo_m2_base: costoM2,
                    precio_proporcional: costoProporcional
                });
            });

            // REGLA DE NEGOCIO: (Costo Total * 3) + Mano de Obra
            const costoMaterialesX3 = costoBaseTotalMateriales * 3;
            const manoObraValor = parseFloat(manoObra || 0);
            const totalSugerido = costoMaterialesX3 + manoObraValor;

            // Enviamos un objeto plano y robusto para que el frontend lo lea sin fallos
            res.json({
                success: true,
                data: {
                    total: Math.round(totalSugerido),
                    valor_materiales: costoMaterialesX3,
                    valor_mano_obra: manoObraValor,
                    area: area_m2,
                    detalles: detallesItems
                }
            });
        } catch (error) {
            console.error("🚨 Error en motor de cálculo:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Rutas existentes
    router.use('/inventory', require('./routes/inventoryRoutes'));
    router.use('/providers', require('./routes/providerRoutes'));
    
    try { router.use('/clients', require('./routes/clientRoutes')); } catch(e){}
    try { router.use('/invoices', require('./routes/invoiceRoutes')); } catch(e){}
    try { router.use('/quotes', require('./routes/quoteRoutes')); } catch(e){}

    router.get('/health', (req, res) => {
        res.json({ status: 'OK', version: '12.2.9', db: mongoose.connection.readyState === 1 });
    });

} catch (error) {
    console.error(`🚨 Error vinculando rutas: ${error.message}`);
}

app.use('/', router);

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
            body: JSON.stringify({ success: false, error: 'Fallo fatal en el servidor' })
        };
    }
};