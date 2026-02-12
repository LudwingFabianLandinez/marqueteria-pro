const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http'); 
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// 1. CORS Totalmente Abierto para evitar bloqueos en los botones
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Conexión a Base de Datos (Optimizada para evitar caídas)
let isConnected = false;
const connect = async () => {
    if (isConnected) return;
    try {
        await connectDB();
        isConnected = true;
        console.log("🟢 MongoDB Conectado");
    } catch (err) {
        console.error("🚨 Error DB:", err);
    }
};
connect();

// ==========================================
// 3. RUTAS DE LA API (Carga Protegida Quirúrgica)
// ==========================================
const router = express.Router();

/**
 * Función de seguridad: Si un archivo de ruta tiene errores, 
 * no detiene el resto del servidor.
 */
const safeLoad = (routePath, modulePath) => {
    try {
        router.use(routePath, require(modulePath));
        console.log(`✅ Ruta cargada con éxito: ${routePath}`);
    } catch (error) {
        console.error(`⚠️ Error al cargar la ruta [${routePath}]:`, error.message);
    }
};

// Cargamos cada botón protegiendo que no rompa a los demás
safeLoad('/inventory', './routes/inventoryRoutes');
safeLoad('/quotes', './routes/quoteRoutes');
safeLoad('/invoices', './routes/invoiceRoutes');
safeLoad('/providers', './routes/providerRoutes');
safeLoad('/suppliers', './routes/supplierRoutes');
safeLoad('/stats', './routes/statsRoutes');

app.use('/api', router);

// Manejador de errores para evitar que la app se quede en blanco
app.use((err, req, res, next) => {
    console.error("🚨 ERROR CRÍTICO EN EL SERVIDOR:", err);
    res.status(500).json({ 
        success: false, 
        error: "Error interno en el servidor",
        message: err.message
    });
});

// ==========================================
// 4. EXPORTACIÓN PARA NETLIFY
// ==========================================
const handler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await connect();
    return await handler(event, context);
};

// Desarrollo local
if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`✅ Servidor local en puerto ${PORT}`));
}