/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión 13.2.5 (OT + STOCK PRECISO)
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
    console.log("📦 Modelos v13.2.5 registrados exitosamente");
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
    console.log(`📡 [v13.2.5] ${req.method} -> ${req.url}`);
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

    // --- 🚀 RUTA DE SINCRONIZACIÓN DE FAMILIAS (Mantenida 100%) ---
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

    // --- 🧮 MOTOR DE CÁLCULO DE COTIZACIÓN (Mantenido 100%) ---
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

    // --- 🧾 RUTA DE FACTURACIÓN (CONSECUTIVO + STOCK PRECISO) ---
    router.post('/invoices', async (req, res) => {
        try {
            const Invoice = mongoose.model('Invoice');
            const Material = mongoose.model('Material');
            const facturaData = req.body;

            // GENERACIÓN DE CONSECUTIVO OT
            const ultimaFactura = await Invoice.findOne().sort({ createdAt: -1 });
            let siguienteNumero = 1;
            if (ultimaFactura && ultimaFactura.numeroOrden) {
                const ultimoNum = parseInt(ultimaFactura.numeroOrden.split('-')[1]);
                if (!isNaN(ultimoNum)) siguienteNumero = ultimoNum + 1;
            }
            const otConsecutivo = `OT-${String(siguienteNumero).padStart(5, '0')}`;
            
            // Asignar OT y asegurar nombre del cliente
            facturaData.numeroOrden = otConsecutivo;

            // 1. Guardar la factura
            const nuevaFactura = new Invoice(facturaData);
            await nuevaFactura.save();

            // 2. Descuento Preciso de Stock
            if (facturaData.items && Array.isArray(facturaData.items)) {
                for (const item of facturaData.items) {
                    if (item.productoId) {
                        // Priorizamos el área calculada o enviada para el descuento
                        let areaADescontar = parseFloat(item.area_m2 || 0);
                        
                        // Si el área es 0 pero tenemos medidas, la recalculamos por seguridad
                        if (areaADescontar === 0 && item.ancho && item.largo) {
                            areaADescontar = (parseFloat(item.ancho) * parseFloat(item.largo)) / 10000;
                        }

                        if (areaADescontar > 0) {
                            await Material.findByIdAndUpdate(item.productoId, {
                                $inc: { stock_actual: -areaADescontar }
                            });
                            console.log(`📉 Stock: ${item.materialNombre} | -${areaADescontar.toFixed(4)} m2`);
                        }
                    }
                }
            }

            res.json({ 
                success: true, 
                message: "OT generada con éxito", 
                ot: otConsecutivo,
                cliente: facturaData.clienteNombre,
                data: nuevaFactura 
            });
        } catch (error) {
            console.error("🚨 Error facturación v13.2.5:", error);
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
        res.json({ status: 'OK', version: '13.2.5', db: mongoose.connection.readyState === 1 });
    });

} catch (error) {
    console.error(`🚨 Error vinculando rutas en server.js: ${error.message}`);
}

app.use('/', router);

// Manejador de errores global
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