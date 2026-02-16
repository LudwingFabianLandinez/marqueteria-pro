const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http'); 
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');

// 1. CARGA DE MODELOS (Singleton)
// Aseguramos que los modelos se registren antes de cargar las rutas
try {
    require('./models/Provider');
    require('./models/Material');
    require('./models/Invoice'); 
    require('./models/Transaction'); 
    require('./models/Purchase');
    require('./models/Client');
    console.log("📦 Modelos cargados exitosamente");
} catch (err) {
    console.error("🚨 Error cargando modelos:", err.message);
}

const app = express();

// 2. MIDDLEWARES INICIALES
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. NORMALIZACIÓN DE URL (FIX 404 NETLIFY)
app.use((req, res, next) => {
    const basePrefix = '/.netlify/functions/server';
    
    // Limpiamos el prefijo de Netlify
    if (req.url.startsWith(basePrefix)) {
        req.url = req.url.replace(basePrefix, '');
    }

    // Si la ruta queda vacía o es solo un slash, aseguramos la raíz
    if (!req.url || req.url === '') {
        req.url = '/';
    }

    // LOG DE DEPURACIÓN: Verás exactamente qué ruta llega al router
    console.log(`🛣️ [v12.1.8] ${req.method} ${req.url}`);
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

// 5. DEFINICIÓN DE RUTAS
const router = express.Router();

try {
    // Rutas principales
    router.use('/inventory', require('./routes/inventoryRoutes'));
    router.use('/providers', require('./routes/providerRoutes'));
    router.use('/clients', require('./routes/clientRoutes'));
    router.use('/invoices', require('./routes/invoiceRoutes'));
    router.use('/quotes', require('./routes/quoteRoutes'));
    router.use('/stats', require('./routes/statsRoutes'));

    /** * ALINEACIÓN QUIRÚRGICA:
     * Si el frontend envía a /inventory/purchase, pero tienes un archivo purchaseRoutes,
     * creamos un alias aquí para que no de 404.
     */
    const purchaseRoutes = require('./routes/purchaseRoutes');
    router.use('/purchases', purchaseRoutes);
    router.use('/inventory/purchase', purchaseRoutes); // <--- ALIAS PARA EVITAR 404

    router.get('/health', (req, res) => {
        res.json({ 
            status: 'OK', 
            version: '12.1.8',
            db: mongoose.connection.readyState === 1 
        });
    });

    console.log("✅ Sistema de rutas mapeado");
} catch (error) {
    console.error(`🚨 Error vinculando rutas: ${error.message}`);
}

// 6. VINCULACIÓN FINAL
app.use('/', router);

// Manejador de errores global para evitar que la función muera sin aviso
app.use((err, req, res, next) => {
    console.error("🔥 Error no controlado:", err.stack);
    res.status(500).json({
        success: false,
        message: "Error interno en el servidor de Netlify",
        error: err.message
    });
});

const handler = serverless(app);

module.exports.handler = async (event, context) => {
    // Permite que la función responda inmediatamente sin esperar a que el loop de eventos esté vacío
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
                error: 'Fallo de conexión en el Handler', 
                details: error.message 
            })
        };
    }
};