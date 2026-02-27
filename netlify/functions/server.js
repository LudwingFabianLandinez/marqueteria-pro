/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión v13.8.0 (BLINDADA + PROVIDERS)
 * Blindaje: Estructura visual, cálculos m2 y consecutivos OT 100% INTACTOS.
 * Reparación: Ruta POST /providers activada para guardado en Atlas.
 */

const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http'); 
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');

// 1. CARGA DIRECTA DE MODELOS
const Client = require('./models/Client');
const Provider = require('./models/Provider');
const Material = require('./models/Material'); 
const Invoice = require('./models/Invoice'); 
const Transaction = require('./models/Transaction');

console.log("📦 Modelos v13.8.0 vinculados y registrados exitosamente");

const app = express();

// 2. MIDDLEWARES INICIALES
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. NORMALIZACIÓN DE URL (MANTENIDA)
app.use((req, res, next) => {
    const basePrefixes = ['/.netlify/functions/server', '/.netlify/functions', '/api'];
    basePrefixes.forEach(p => {
        if (req.url.startsWith(p)) req.url = req.url.replace(p, '');
    });
    
    req.url = req.url.replace(/\/+/g, '/');
    if (!req.url || req.url === '') req.url = '/';
    
    console.log(`📡 [v13.8.0] ${req.method} -> ${req.url}`);
    next();
});

// 4. GESTIÓN DE CONEXIÓN DB (ESTABILIZADA v13.8.0)
let isConnected = false;
const connect = async () => {
    if (mongoose.connection.readyState === 1) {
        isConnected = true;
        return;
    }
    
    try {
        mongoose.set('bufferCommands', false); 
        mongoose.set('strictQuery', false);
        
        const dbUri = process.env.MONGODB_URI;
        
        if (dbUri) {
            await mongoose.connect(dbUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000
            });
        } else {
            await connectDB();
        }
        
        isConnected = true;
        console.log("🟢 Conexión activa con MongoDB Atlas (Virginia)");
    } catch (err) {
        console.error("🚨 Error crítico en conexión DB:", err.message);
        isConnected = false;
        throw err;
    }
};

// 5. DEFINICIÓN DE RUTAS
const router = express.Router();

try {
    // --- RUTA DE SINCRONIZACIÓN DE FAMILIAS (INTACTA) ---
    router.get('/quotes/materials', async (req, res) => {
    try {
        const materiales = await Material.find({ 
            estado: { $ne: 'Inactivo' },
            nombre: { $exists: true, $ne: "" } 
        }).sort({ nombre: 1 }).lean();
        
        const normalizar = (texto) => texto ? texto.toLowerCase().trim() : "";
        
        const materialesMapeados = materiales.map(m => ({
            ...m, 
            costo_m2: m.costo_m2 || m.precio_m2_costo || 0, 
            id: m._id,
            unidad: (m.tipo || "m2").toLowerCase() 
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
                const n = normalizar(m.nombre); 
                const c = normalizar(m.categoria);
                const u = normalizar(m.unidad);
                return c.includes('marco') || c.includes('moldura') || n.includes('marco') || n.includes('moldura') || n.includes('madera') || n.includes('2312') || u === 'ml';
            }),
            paspartu: materialesMapeados.filter(m => {
                const n = normalizar(m.nombre);
                return n.includes('paspartu') || n.includes('passepartout') || n.includes('cartulina');
            }),
            foam: materialesMapeados.filter(m => normalizar(m.nombre).includes('foam')),
            tela: materialesMapeados.filter(m => normalizar(m.nombre).includes('tela') || normalizar(m.nombre).includes('lona')),
            chapilla: materialesMapeados.filter(m => normalizar(m.nombre).includes('chapilla')),
            todos: materialesMapeados 
        };
        
        res.json({ success: true, count: materiales.length, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

    // --- MOTOR DE CÁLCULO (INTACTO) ---
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

    // --- GESTIÓN DE FACTURAS (CONSECUTIVO BLINDADO INTACTO) ---
    router.get('/invoices', async (req, res) => {
        try {
            const facturas = await Invoice.find().sort({ createdAt: -1 }).limit(100).lean();
            res.json(facturas.map(f => ({
                ...f, 
                cliente: f.clienteNombre || (f.cliente && f.cliente.nombre) || "Cliente General",
                total: f.total || f.totalVenta || 0,
                numeroOrden: f.numeroOrden || f.numeroFactura || "S/N"
            }))); 
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
                    const partes = idTexto.split('-');
                    const num = parseInt(partes[partes.length - 1]);
                    if (!isNaN(num) && num < 100000 && num > maxNumero) {
                        maxNumero = num;
                    }
                }
            });

            if (maxNumero === 0) maxNumero = 17; 

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

    // --- PROVEEDORES (LECTURA Y GUARDADO CORREGIDO) ---
    router.get('/providers', async (req, res) => {
        try {
            const proveedores = await Provider.find().sort({ nombre: 1 }).lean();
            res.json(proveedores);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // RUTA NUEVA: Esta es la que guarda a Distribuidora Virginia
    router.post('/providers', async (req, res) => {
        try {
            const data = req.body;
            let resultado;
            const id = data._id || data.id;

            if (id && id.length > 5) {
                resultado = await Provider.findByIdAndUpdate(id, { $set: data }, { new: true });
            } else {
                delete data.id; delete data._id; // Limpiar IDs vacíos
                resultado = new Provider(data);
                await resultado.save();
            }
            res.json({ success: true, data: resultado });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    // --- INVENTARIO ---
    router.get('/inventory', async (req, res) => {
        try {
            const materiales = await Material.find().sort({ nombre: 1 }).lean();
            res.json(materiales);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    router.post('/inventory/save', async (req, res) => {
        try {
            const { id, ...datos } = req.body;
            let resultado;
            if (id && id.length > 5) {
                resultado = await Material.findByIdAndUpdate(id, { $set: datos }, { new: true });
            } else {
                resultado = new Material(datos);
                await resultado.save();
            }
            res.json({ success: true, data: resultado });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    router.put('/materials/:id', async (req, res) => {
        try {
            if (req.body.stock_minimo !== undefined) {
                req.body.stock_minimo = parseFloat(req.body.stock_minimo);
            }
            const actualizado = await Material.findByIdAndUpdate(
                req.params.id, 
                { $set: req.body }, 
                { new: true, runValidators: false }
            );
            if (!actualizado) return res.status(404).json({ success: false, error: "No encontrado" });
            res.json({ success: true, data: actualizado });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    // --- REPORTE DE COMPRAS (INTACTO) ---
    router.get('/inventory/all-purchases', async (req, res) => {
        try {
            const compras = await Transaction.find({ 
                $or: [{ tipo: 'IN' }, { cantidad: { $gt: 0 } }, { cantidad_m2: { $gt: 0 } }]
            }).sort({ fecha: -1 }).limit(100).lean();

            const dataMapeada = compras.map(c => ({
                fecha: c.fecha || new Date(),
                materialId: { nombre: c.materialNombre || "Ingreso de Material" },
                proveedorId: { nombre: c.proveedorNombre || "Proveedor General" },
                cantidad_m2: parseFloat(c.cantidad || c.cantidad_m2 || 0).toFixed(2),
                costo_total: parseFloat(c.costo_total || c.total || 0),
                motivo: c.materialNombre || "Ingreso"
            }));
            res.json({ success: true, count: dataMapeada.length, data: dataMapeada });
        } catch (error) {
            res.json({ success: true, data: [] });
        }
    });

    // --- REGISTRO DE COMPRA (ESTABILIZACIÓN ANTIFALLO 500) ---
    router.post('/inventory/purchase', async (req, res) => {
        try {
            const { materialId, cantidad, largo, ancho, valorUnitario, proveedorId, proveedorNombre } = req.body;
            const areaTotalIngreso = (parseFloat(largo || 0) * parseFloat(ancho || 0) / 10000) * parseFloat(cantidad || 0);
            const valorTotalCalculado = parseFloat(valorUnitario || 0) * parseFloat(cantidad || 0);

            const matAct = await Material.findByIdAndUpdate(materialId, { 
                $inc: { stock_actual: areaTotalIngreso },
                $set: { ultimo_costo: parseFloat(valorUnitario), fecha_ultima_compra: new Date(), proveedor_principal: proveedorId }
            }, { new: true }).lean();

            const provAct = await Provider.findById(proveedorId).select('nombre').lean();

            const registro = new Transaction({
                tipo: 'IN',
                materialId: materialId,
                materialNombre: matAct ? matAct.nombre : "Material",
                proveedorId: proveedorId,
                proveedorNombre: proveedorNombre || (provAct ? provAct.nombre : "Proveedor General"), 
                cantidad: areaTotalIngreso,     
                cantidad_m2: areaTotalIngreso,  
                costo_unitario: valorUnitario,
                total: valorTotalCalculado,           
                costo_total: valorTotalCalculado, 
                fecha: new Date()
            });

            await registro.save({ validateBeforeSave: false });
            return res.status(200).json({ success: true, nuevoStock: matAct ? matAct.stock_actual : 0 });
        } catch (error) {
            return res.status(200).json({ success: false, localRescue: true });
        }
    });

} catch (error) {
    console.error(`🚨 Error vinculando rutas: ${error.message}`);
}

router.delete('/invoices/:id', async (req, res) => {
    try {
        await Invoice.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Orden eliminada" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/fix-material-data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const update = {
            nombre: req.body.nombre,
            ancho_lamina_cm: req.body.ancho_lamina_cm,
            largo_lamina_cm: req.body.largo_lamina_cm,
            precio_total_lamina: req.body.precio_total_lamina,
            stock_minimo: req.body.stock_minimo
        };
        const materialActualizado = await Material.findByIdAndUpdate(id, { $set: update }, { new: true });
        res.json({ success: true, data: materialActualizado });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6. MONTAJE DE RUTAS
app.use('/', router);

const handler = serverless(app);

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await connect();
        if (event.path.includes('.netlify/functions/server')) {
            event.path = event.path.replace('/.netlify/functions/server', '');
        }
        return await handler(event, context);
    } catch (error) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ success: false, error: 'Fallo fatal en Handler' }) 
        };
    }
};