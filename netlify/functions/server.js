/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión 13.3.43 (CONSOLIDADO FINAL)
 * Objetivo: Mantener blindaje v13.3.42, asegurar persistencia y FORZAR conexión.
 * Blindaje: Estructura de rutas y lógica de m2 intacta.
 */

const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http'); 
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');

// 1. CARGA DE MODELOS (Singleton) - RESPETADO AL 100%
try {
    require('./models/Provider');
    require('./models/Material'); 
    require('./models/Invoice'); 
    require('./models/Transaction'); 
    require('./models/Client');
    console.log("📦 Modelos v13.3.43 registrados exitosamente");
} catch (err) {
    console.error("🚨 Error inicializando modelos:", err.message);
}

const app = express();

// 2. MIDDLEWARES INICIALES
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. NORMALIZACIÓN DE URL (GANCHO MAESTRO - REPARACIÓN 404)
app.use((req, res, next) => {
    const basePrefix = '/.netlify/functions/server';
    if (req.url.startsWith(basePrefix)) req.url = req.url.replace(basePrefix, '');
    if (req.url.startsWith('/.netlify/functions')) req.url = req.url.replace('/.netlify/functions', '');
    if (req.url.startsWith('/api/')) req.url = req.url.replace('/api', '');
    
    req.url = req.url.replace(/\/+/g, '/');
    if (!req.url || req.url === '') { req.url = '/'; }
    
    console.log(`📡 [v13.3.43] ${req.method} -> ${req.url}`);
    next();
});

// 4. GESTIÓN DE CONEXIÓN DB - RESPETADO AL 100%
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

// 5. DEFINICIÓN DE RUTAS - TU LÓGICA DE NEGOCIO INTACTA
const router = express.Router();

try {
    const Material = mongoose.model('Material'); 
    const Invoice = mongoose.model('Invoice');
    const Provider = mongoose.model('Provider');
    const Transaction = mongoose.model('Transaction');
    const Client = mongoose.model('Client');

    // --- 🚀 RUTA DE SINCRONIZACIÓN DE FAMILIAS ---
    router.get('/quotes/materials', async (req, res) => {
        try {
            const materiales = await Material.find({ estado: { $ne: 'Inactivo' } }).lean();
            const normalizar = (texto) => texto ? texto.toLowerCase().trim() : "";
            const materialesMapeados = materiales.map(m => ({
                ...m, costo_m2: m.costo_m2 || m.precio_m2_costo || 0, id: m._id 
            }));

            const data = {
                vidrios: materialesMapeados.filter(m => {
                    const n = normalizar(m.nombre); const c = normalizar(m.categoria);
                    return n.includes('vidrio') || n.includes('espejo') || c.includes('vidrio');
                }),
                respaldos: materialesMapeados.filter(m => {
                    const n = normalizar(m.nombre);
                    return n.includes('mdf') || n.includes('respaldo') || n.includes('triplex') || n.includes('celtex');
                }),
                marcos: materialesMapeados.filter(m => {
                    const n = normalizar(m.nombre); const c = normalizar(m.categoria);
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
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 🧮 MOTOR DE CÁLCULO ---
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
                detallesItems.push({ nombre: mat.nombre, area_m2, costo_m2_base: costoM2, precio_proporcional: costoProporcional });
            });

            res.json({ success: true, data: { valor_materiales: costoBaseTotalMateriales, valor_mano_obra: parseFloat(manoObra || 0), area: area_m2, detalles: { medidas: `${ancho} x ${largo} cm`, materiales: detallesItems } } });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 🧾 GESTIÓN DE FACTURAS / OT ---
    router.get('/invoices', async (req, res) => {
        try {
            const facturas = await Invoice.find().sort({ createdAt: -1 }).limit(100).lean();
            const facturasLimpias = facturas.map(f => ({
                ...f, 
                cliente: f.clienteNombre || (f.cliente && f.cliente.nombre) || "Cliente General",
                total: f.total || f.totalVenta || 0,
                numeroOrden: f.numeroOrden || f.numeroFactura || "S/N"
            }));
            res.json(facturasLimpias); 
        } catch (error) {
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
                    const num = parseInt(idTexto.split('-').pop());
                    if (!isNaN(num) && num > maxNumero) maxNumero = num;
                }
            });

            const otConsecutivo = `OT-${String(maxNumero + 1).padStart(5, '0')}`;
            facturaData.numeroFactura = otConsecutivo;
            facturaData.numeroOrden = otConsecutivo; 

            const nuevaFactura = new Invoice(facturaData);
            await nuevaFactura.save();

            if (facturaData.items) {
                for (const item of facturaData.items) {
                    if (item.productoId) {
                        const area = parseFloat(item.area_m2) || ((parseFloat(item.ancho || 0) * parseFloat(item.largo || 0)) / 10000);
                        await Material.findByIdAndUpdate(item.productoId, { $inc: { stock_actual: -area } });
                    }
                }
            }
            res.json({ success: true, message: "OT generada con éxito", ot: otConsecutivo, data: nuevaFactura });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 🚀 PROVEEDORES ---
    router.get('/providers', async (req, res) => {
        try {
            const proveedores = await Provider.find().sort({ nombre: 1 }).lean();
            res.json(proveedores);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.post('/providers', async (req, res) => {
        try {
            const nuevo = new Provider(req.body);
            await nuevo.save();
            res.json({ success: true, data: nuevo });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 👥 CLIENTES ---
    router.get('/clients', async (req, res) => {
        try {
            const clientes = await Client.find().sort({ nombre: 1 }).lean();
            res.json(clientes);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.post('/clients', async (req, res) => {
        try {
            const nuevo = new Client(req.body);
            await nuevo.save();
            res.json({ success: true, data: nuevo });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 📦 INVENTARIO Y COMPRAS ---
    router.get('/inventory', async (req, res) => {
        try {
            const materiales = await Material.find().sort({ nombre: 1 }).lean();
            res.json(materiales);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.get('/inventory/all-purchases', async (req, res) => {
        try {
            const compras = await Transaction.find({ tipo: 'IN' }).sort({ fecha: -1 }).limit(100).lean();
            res.json(compras);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.post('/inventory/purchase', async (req, res) => {
        try {
            const { materialId, cantidad, largo, ancho, valorUnitario, proveedorId } = req.body;
            if (!materialId || !mongoose.Types.ObjectId.isValid(materialId)) return res.status(400).json({ success: false, error: "ID inválido" });

            const areaTotalIngreso = (parseFloat(largo) * parseFloat(ancho) / 10000) * parseFloat(cantidad);
            const matAct = await Material.findByIdAndUpdate(materialId, { 
                $inc: { stock_actual: areaTotalIngreso },
                $set: { ultimo_costo: parseFloat(valorUnitario), fecha_ultima_compra: new Date(), proveedor_principal: proveedorId }
            }, { new: true });

            if (!matAct) return res.status(404).json({ success: false, error: "Material no encontrado" });

            const registro = new Transaction({
                tipo: 'IN', materialId, materialNombre: matAct.nombre, cantidad: areaTotalIngreso, 
                costo_unitario: valorUnitario, total: valorUnitario * cantidad, proveedorId, fecha: new Date()
            });
            await registro.save({ validateBeforeSave: false });

            res.json({ success: true, nuevoStock: matAct.stock_actual, ingreso_m2: areaTotalIngreso });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- 🏁 SALUD DEL SISTEMA ---
    router.get('/health', (req, res) => {
        res.json({ status: 'OK', version: '13.3.43-FINAL-REPAIR', db: mongoose.connection.readyState === 1 });
    });

} catch (error) {
    console.error(`🚨 Error vinculando rutas: ${error.message}`);
}

// 6. BLINDAJE FINAL (Triple Mapeo)
app.use('/.netlify/functions/server', router);
app.use('/api', router); 
app.use('/', router);

const handler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await connect();
        // Gancho de limpieza de ruta para el evento de Netlify
        event.path = event.path.replace('/.netlify/functions/server', '').replace('/api', '');
        return await handler(event, context);
    } catch (error) {
        console.error("🚨 Handler Crash:", error);
        return { 
            statusCode: 500, 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ success: false, error: 'Fallo fatal en servidor' }) 
        };
    }
};