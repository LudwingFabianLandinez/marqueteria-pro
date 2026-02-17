/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión 13.3.2 (SOLUCIÓN DEFINITIVA CONTADOR)
 * Objetivo: Asegurar que el consecutivo de OT suba buscando siempre el valor máximo real.
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
    console.log("📦 Modelos v13.3.2 registrados exitosamente");
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
    console.log(`📡 [v13.3.2] ${req.method} -> ${req.url}`);
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
    const Invoice = mongoose.model('Invoice');

    // --- 🚀 RUTA DE SINCRONIZACIÓN DE FAMILIAS ---
    router.get('/quotes/materials', async (req, res) => {
        try {
            const materiales = await Material.find({ estado: { $ne: 'Inactivo' } }).lean();
            const normalizar = (texto) => texto ? texto.toLowerCase().trim() : "";

            const materialesMapeados = materiales.map(m => {
                const costoReal = m.costo_m2 || m.precio_m2_costo || 0;
                return {
                    ...m,
                    costo_m2: costoReal,
                    id: m._id 
                };
            });

            const data = {
                vidrios: materialesMapeados.filter(m => {
                    const n = normalizar(m.nombre);
                    const c = normalizar(m.categoria);
                    return n.includes('vidrio') || n.includes('espejo') || c.includes('vidrio');
                }),
                respaldos: materialesMapeados.filter(m => {
                    const n = normalizar(m.nombre);
                    return n.includes('mdf') || n.includes('respaldo') || n.includes('triplex') || n.includes('celtex');
                }),
                marcos: materialesMapeados.filter(m => {
                    const n = normalizar(m.nombre);
                    const c = normalizar(m.categoria);
                    return c.includes('marco') || n.includes('marco') || n.includes('moldura') || n.includes('madera');
                }),
                paspartu: materialesMapeados.filter(m => {
                    const n = normalizar(m.nombre);
                    return n.includes('paspartu') || n.includes('passepartout') || n.includes('cartulina');
                }),
                foam: materialesMapeados.filter(m => normalizar(m.nombre).includes('foam')),
                tela: materialesMapeados.filter(m => normalizar(m.nombre).includes('tela') || normalizar(m.nombre).includes('lona')),
                chapilla: materialesMapeados.filter(m => normalizar(m.nombre).includes('chapilla'))
            };

            res.json({ success: true, count: materiales.length, data });
        } catch (error) {
            console.error("🚨 Error en /quotes/materials:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 🧮 MOTOR DE CÁLCULO DE COTIZACIÓN ---
    router.post('/quotes', async (req, res) => {
        try {
            const { ancho, largo, materialesIds, manoObra } = req.body;
            const materialesDB = await Material.find({ _id: { $in: materialesIds } });
            
            const area_m2 = (ancho * largo) / 10000;
            let costoBaseTotalMateriales = 0;
            let detallesItems = [];

            materialesDB.forEach(mat => {
                const costoM2 = mat.costo_m2 || mat.precio_m2_costo || 0;
                const costoProporcional = area_m2 * costoM2;
                costoBaseTotalMateriales += costoProporcional;
                detallesItems.push({
                    nombre: mat.nombre,
                    area_m2: area_m2,
                    costo_m2_base: costoM2,
                    precio_proporcional: costoProporcional
                });
            });

            res.json({
                success: true,
                data: {
                    valor_materiales: costoBaseTotalMateriales,
                    valor_mano_obra: parseFloat(manoObra || 0),
                    area: area_m2,
                    detalles: {
                        medidas: `${ancho} x ${largo} cm`,
                        materiales: detallesItems
                    }
                }
            });
        } catch (error) {
            console.error("🚨 Error en motor de cálculo:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 🧾 GESTIÓN DE FACTURAS / OT ---

    router.get('/invoices', async (req, res) => {
        try {
            const facturas = await Invoice.find().sort({ createdAt: -1 }).limit(100);
            res.json(facturas); 
        } catch (error) {
            console.error("🚨 Error obteniendo historial:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.post('/invoices', async (req, res) => {
        try {
            const facturaData = req.body;

            // --- 🔧 SOLUCIÓN DEFINITIVA CONTADOR (v13.3.2) ---
            // Buscamos todas las facturas para encontrar el número más alto real sin depender de fechas
            const facturasParaConteo = await Invoice.find({}, 'numeroFactura numeroOrden').lean();
            let maxNumero = 0;

            facturasParaConteo.forEach(doc => {
                const idTexto = doc.numeroFactura || doc.numeroOrden || "";
                if (idTexto.includes('-')) {
                    const partes = idTexto.split('-');
                    const num = parseInt(partes[partes.length - 1]);
                    if (!isNaN(num) && num > maxNumero) {
                        maxNumero = num;
                    }
                }
            });

            const siguienteNumero = maxNumero + 1;
            const otConsecutivo = `OT-${String(siguienteNumero).padStart(5, '0')}`;
            
            // Asignamos el número a ambos campos para total compatibilidad
            facturaData.numeroFactura = otConsecutivo;
            facturaData.numeroOrden = otConsecutivo; 
            // -------------------------------------------------------

            // 1. Guardar la factura
            const nuevaFactura = new Invoice(facturaData);
            await nuevaFactura.save();

            // 2. Descuento Automático de Stock
            if (facturaData.items && Array.isArray(facturaData.items)) {
                for (const item of facturaData.items) {
                    if (item.productoId) {
                        const area = parseFloat(item.area_m2) || ((parseFloat(item.ancho || 0) * parseFloat(item.largo || 0)) / 10000);
                        if (area > 0) {
                            await Material.findByIdAndUpdate(item.productoId, {
                                $inc: { stock_actual: -area }
                            });
                            console.log(`📉 Stock Restado: ${item.materialNombre} -${area.toFixed(4)} m2`);
                        }
                    }
                }
            }

            res.json({ 
                success: true, 
                message: "OT generada con éxito", 
                ot: otConsecutivo,
                cliente: (facturaData.cliente && facturaData.cliente.nombre) || facturaData.clienteNombre,
                data: nuevaFactura 
            });
        } catch (error) {
            console.error("🚨 Error en proceso de facturación:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- VINCULACIÓN DE RUTAS RESTANTES ---
    router.use('/inventory', require('./routes/inventoryRoutes'));
    router.use('/providers', require('./routes/providerRoutes'));
    router.use('/purchases', require('./routes/inventoryRoutes'));
    
    try { router.use('/clients', require('./routes/clientRoutes')); } catch(e){}
    try { router.use('/quotes', require('./routes/quoteRoutes')); } catch(e){}

    router.get('/health', (req, res) => {
        res.json({ status: 'OK', version: '13.3.2', db: mongoose.connection.readyState === 1 });
    });

} catch (error) {
    console.error(`🚨 Error vinculando rutas en server.js: ${error.message}`);
}

app.use('/', router);

app.use((err, req, res, next) => {
    console.error("🔥 Error en ejecución serverless:", err.stack);
    res.status(500).json({ success: false, message: "Error interno", error: err.message });
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