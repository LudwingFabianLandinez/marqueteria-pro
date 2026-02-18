/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión 13.3.13 (CONSOLIDADA)
 * Objetivo: Reparar Historial de Compras y asegurar Suma de Stock.
 * Blindaje: Inyección directa de rutas críticas manteniendo lógica de negocio intacta.
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
    console.log("📦 Modelos v13.3.13 registrados exitosamente");
} catch (err) {
    console.error("🚨 Error inicializando modelos:", err.message);
}

const app = express();

// 2. MIDDLEWARES INICIALES
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. NORMALIZACIÓN DE URL (Blindaje Netlify + Puente API)
app.use((req, res, next) => {
    const basePrefix = '/.netlify/functions/server';
    
    if (req.url.startsWith(basePrefix)) {
        req.url = req.url.replace(basePrefix, '');
    }

    // --- 🔧 GANCHO QUIRÚRGICO PARA HISTORIAL ---
    if (req.url.startsWith('/api/')) {
        req.url = req.url.replace('/api', '');
    }
    // -------------------------------------------

    req.url = req.url.replace(/\/+/g, '/');
    if (!req.url || req.url === '') { req.url = '/'; }
    console.log(`📡 [v13.3.13] ${req.method} -> ${req.url}`);
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
    const Provider = mongoose.model('Provider');
    const Transaction = mongoose.model('Transaction');

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
            const facturas = await Invoice.find().sort({ createdAt: -1 }).limit(100).lean();
            
            const facturasLimpias = facturas.map(f => {
                let clienteDisplay = "Cliente General";
                if (f.cliente && typeof f.cliente === 'object') {
                    clienteDisplay = f.cliente.nombre || f.cliente.clienteNombre || "Cliente General";
                } else if (f.cliente) {
                    clienteDisplay = f.cliente;
                } else if (f.clienteNombre) {
                    clienteDisplay = f.clienteNombre;
                }

                return {
                    ...f,
                    cliente: clienteDisplay,
                    total: f.total || f.totalVenta || 0,
                    numeroOrden: f.numeroOrden || f.numeroFactura || "S/N"
                };
            });

            res.json(facturasLimpias); 
        } catch (error) {
            console.error("🚨 Error obteniendo historial:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.post('/invoices', async (req, res) => {
        try {
            const facturaData = req.body;

            const facturasParaConteo = await Invoice.find({}, 'numeroFactura numeroOrden').lean();
            let maxNumero = 0;

            facturasParaConteo.forEach(doc => {
                const idTexto = doc.numeroFactura || doc.numeroOrden || "";
                if (idTexto.startsWith('OT-')) {
                    const partes = idTexto.split('-');
                    const num = parseInt(partes[partes.length - 1]);
                    if (!isNaN(num) && num < 1000000 && num > maxNumero) {
                        maxNumero = num;
                    }
                }
            });

            const siguienteNumero = maxNumero + 1;
            const otConsecutivo = `OT-${String(siguienteNumero).padStart(5, '0')}`;
            
            facturaData.numeroFactura = otConsecutivo;
            facturaData.numeroOrden = otConsecutivo; 

            const nuevaFactura = new Invoice(facturaData);
            await nuevaFactura.save();

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

    // --- 🚀 GESTIÓN DIRECTA DE PROVEEDORES ---
    router.get('/providers', async (req, res) => {
        try {
            const proveedores = await Provider.find().sort({ nombre: 1 }).lean();
            res.json(proveedores);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 📦 GESTIÓN DIRECTA DE INVENTARIO Y COMPRAS ---
    router.get('/inventory', async (req, res) => {
        try {
            const materiales = await Material.find().sort({ nombre: 1 }).lean();
            res.json(materiales);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 📜 RUTA PARA EL HISTORIAL DE COMPRAS (FIX: Evita el 404 en la tabla de compras) ---
    router.get('/purchases', async (req, res) => {
        try {
            const compras = await Transaction.find({ tipo: 'Compra' })
                .sort({ fecha: -1 })
                .populate('proveedorId', 'nombre')
                .lean();
            res.json(compras);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.post('/inventory/purchase', async (req, res) => {
        try {
            const { materialId, cantidad, largo, ancho, valorUnitario, proveedorId } = req.body;
            
            const cant = parseFloat(cantidad) || 0;
            const lg = parseFloat(largo) || 0;
            const an = parseFloat(ancho) || 0;
            const vUnit = parseFloat(valorUnitario) || 0;

            const areaPorUnidad = (lg * an) / 10000;
            const areaTotalIngreso = areaPorUnidad * cant;

            // 1. Actualización Atómica de Stock
            const materialActualizado = await Material.findByIdAndUpdate(
                materialId,
                { 
                    $inc: { stock_actual: areaTotalIngreso },
                    $set: { 
                        ultimo_costo: vUnit,
                        fecha_ultima_compra: new Date(),
                        proveedor_principal: proveedorId
                    }
                },
                { new: true }
            );

            // 2. Registro en el Historial de Transacciones (Para que aparezca en la tabla de compras)
            const registroCompra = new Transaction({
                tipo: 'Compra',
                materialId: materialId,
                materialNombre: materialActualizado ? materialActualizado.nombre : 'Material',
                cantidad: areaTotalIngreso,
                costo_unitario: vUnit,
                total: vUnit * cant,
                proveedorId: proveedorId,
                fecha: new Date()
            });
            await registroCompra.save();

            console.log(`✅ Compra registrada: ${areaTotalIngreso} m2 sumados.`);

            res.json({ 
                success: true, 
                message: "Stock actualizado y compra registrada", 
                data: materialActualizado,
                ingreso_m2: areaTotalIngreso
            });
        } catch (error) {
            console.error("🚨 Error en ingreso de compra:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- VINCULACIÓN DE RUTAS RESTANTES ---
    router.use('/inventory', require('./routes/inventoryRoutes'));
    router.use('/purchases', require('./routes/inventoryRoutes'));
    
    try { router.use('/clients', require('./routes/clientRoutes')); } catch(e){}
    try { router.use('/quotes', require('./routes/quoteRoutes')); } catch(e){}

    router.get('/health', (req, res) => {
        res.json({ status: 'OK', version: '13.3.13', db: mongoose.connection.readyState === 1 });
    });

} catch (error) {
    console.error(`🚨 Error vinculando rutas en server.js: ${error.message}`);
}

// 6. BLINDAJE FINAL DE RUTAS
app.use('/.netlify/functions/server', router);
app.use('/api', router); 
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