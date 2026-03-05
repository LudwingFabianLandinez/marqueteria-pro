/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión v14.0.0 (ESTRUCTURA CORREGIDA)
 * Blindaje: Estructura visual, cálculos m2 y consecutivos OT 100% INTACTOS.
 * Reparación: Corchetes alineados y mapeo de variables de compra para Atlas.
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

console.log("📦 Modelos v14.0.1 - TEST PAGO");

const app = express();

// 2. MIDDLEWARES INICIALES (FUERZA BRUTA CORS)
// 2. MIDDLEWARES INICIALES (FUERZA BRUTA CORS + ANTI-CACHÉ FANTASMA)
app.use((req, res, next) => {
    // --- TUS CABECERAS CORS (INTACTAS) ---
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
    // --- BLINDAJE ANTI-CACHÉ (PARA ELIMINAR EL DOBLE ITEM FANTASMA) ---
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');

    if (req.method === 'OPTIONS') return res.status(200).send();
    next();
});
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
    console.log(`📡 [v14.0.0] ${req.method} -> ${req.url}`);
    next();
});

// 4. GESTIÓN DE CONEXIÓN DB (FORZADA ATLAS V2)
let isConnected = false;
const connect = async () => {
    if (mongoose.connection.readyState === 1) {
        if (!mongoose.connection.db.databaseName.includes('V2')) {
            console.log("⚠️ Detectada DB antigua, cerrando conexión...");
            await mongoose.disconnect();
        } else { return; }
    }
    try {
        mongoose.set('strictQuery', false);
        const dbUri = process.env.MONGODB_URI; 
        console.log("📡 Intentando conectar a Atlas V2...");
        await mongoose.connect(dbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000,
            heartbeatFrequencyMS: 2000
        });
        isConnected = true;
        console.log(`🟢 CONECTADO EXITOSAMENTE A: ${mongoose.connection.db.databaseName}`);
    } catch (err) {
        console.error("🚨 ERROR CRÍTICO ATLAS:", err.message);
        throw err;
    }
};

// 5. DEFINICIÓN DE RUTAS
const router = express.Router();

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

// --- NUEVA RUTA: ACTUALIZAR ABONO DE FACTURA (PATCH) ---
router.patch('/invoices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { totalPagado } = req.body;

        // Buscamos la factura y actualizamos el campo totalPagado
        const facturaActualizada = await Invoice.findByIdAndUpdate(
            id,
            { $set: { totalPagado: parseFloat(totalPagado) } },
            { new: true }
        );

        if (!facturaActualizada) {
            return res.status(404).json({ success: false, error: "Factura no encontrada" });
        }

        console.log(`✅ Pago actualizado en OT: ${facturaActualizada.numeroOrden}. Nuevo total pagado: ${totalPagado}`);
        
        res.json({ 
            success: true, 
            message: "Pago registrado con éxito", 
            data: facturaActualizada 
        });
    } catch (error) {
        console.error("🚨 Error al actualizar pago:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


router.post('/invoices', async (req, res) => {
    try {
        let facturaData = req.body;

        // 🔥 BLOQUE DE RESCATE DE NOMBRES (TRIPLE SINCRONIZACIÓN)
        // Aseguramos que el nombre real se guarde en 'materialNombre' (que está en tu Schema)
        // y en 'descripcion'/'nombre' para compatibilidad con el Excel.
        if (facturaData.items && Array.isArray(facturaData.items)) {
            facturaData.items = facturaData.items.map(item => {
                // Buscamos el nombre en cualquier rincón del objeto que venga del Front
                const nombreDetectado = item.nombre || item.descripcion || item.materialNombre || "MATERIAL";
                const nombreFinal = String(nombreDetectado).toUpperCase();

                return {
                    ...item,
                    materialNombre: nombreFinal, // Este coincide con tu Invoice.js
                    nombre: nombreFinal,         // Para reportes generales
                    descripcion: nombreFinal     // Para el Excel
                };
            });
        }

        // --- LÓGICA DE CONSECUTIVO OT (MANTENIDA INTACTA) ---
        const facturasParaConteo = await Invoice.find({}, 'numeroFactura numeroOrden').lean();
        let maxNumero = 0;
        facturasParaConteo.forEach(doc => {
            const idTexto = doc.numeroFactura || doc.numeroOrden || "";
            if (idTexto.startsWith('OT-')) {
                const partes = idTexto.split('-');
                const num = parseInt(partes[partes.length - 1]);
                if (!isNaN(num) && num < 100000 && num > maxNumero) { maxNumero = num; }
            }
        });

        if (maxNumero === 0) maxNumero = 17; 
        const otConsecutivo = `OT-${String(maxNumero + 1).padStart(5, '0')}`;
        facturaData.numeroFactura = otConsecutivo;
        facturaData.numeroOrden = otConsecutivo; 

        // --- GUARDADO EN ATLAS CON FORZADO ---
        const nuevaFactura = new Invoice(facturaData);
        
        // Esto obliga a Mongoose a guardar el array de items aunque sea complejo
        nuevaFactura.markModified('items'); 
        
        await nuevaFactura.save();

        // --- DESCUENTO DE STOCK (MANTENIDO INTACTO) ---
        if (facturaData.items) {
            for (const item of facturaData.items) {
                if (item.productoId) {
                    const area = parseFloat(item.area_m2) || ((parseFloat(item.ancho || 0) * parseFloat(item.largo || 0)) / 10000);
                    await Material.findByIdAndUpdate(item.productoId, { $inc: { stock_actual: -area } });
                }
            }
        }

        res.json({ 
            success: true, 
            message: "OT generada con éxito", 
            ot: otConsecutivo, 
            data: nuevaFactura 
        });

    } catch (error) {
        console.error("🚨 Error en /invoices:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- PROVEEDORES (LECTURA Y GUARDADO INTACTO) ---
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
        const data = req.body;
        let resultado;
        const id = data._id || data.id;
        if (id && id.length > 5) {
            resultado = await Provider.findByIdAndUpdate(id, { $set: data }, { new: true });
        } else {
            delete data.id; delete data._id;
            resultado = new Provider(data);
            await resultado.save();
        }
        res.json({ success: true, data: resultado });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// --- INVENTARIO (AJUSTADO PARA IDS MAESTROS) ---
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

        // Si viene un ID (ya sea ID-NOMBRE o un ID largo de Mongo)
        if (id) {
            // Usamos una operación 'upsert': Si existe lo actualiza, si no existe lo crea con ese ID
            resultado = await Material.findByIdAndUpdate(
                id, 
                { $set: datos }, 
                { new: true, upsert: true, runValidators: false }
            );
        } else {
            // Si por alguna razón no hay ID, creamos uno nuevo (Fallback)
            resultado = new Material(datos);
            await resultado.save();
        }
        res.json({ success: true, data: resultado });
    } catch (error) {
        console.error("🚨 Error al guardar material maestro:", error.message);
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

// --- REGISTRO DE COMPRA (CORREGIDO PARA ATLAS) ---
// --- REGISTRO DE COMPRA (BLINDAJE TOTAL + CREACIÓN DE MATERIALES EN ATLAS v16.1.7) ---
router.post('/inventory/purchase', async (req, res) => {
    try {
        // 1. Captura de ID y detección de flujo (Creación vs Compra)
        const materialId = req.body.materialId || req.body.id;

        // --- INICIO LÓGICA DE CREACIÓN CON FILTRO DE IDENTIDAD ÚNICA (v16.2.0) ---
        if (materialId === "NUEVO") {
            const nombreNormalizado = req.body.nombre ? req.body.nombre.trim() : "";
            console.log(`🔍 Buscando identidad única para: "${nombreNormalizado}"...`);

            // 1. Buscamos si ya existe por nombre (sin importar mayúsculas/minúsculas)
            const materialExistente = await Material.findOne({ 
                nombre: { $regex: new RegExp(`^${nombreNormalizado}$`, 'i') } 
            });

            if (materialExistente) {
                console.log(`♻️ MATERIAL DETECTADO: Usando registro existente [${materialExistente.categoria}] para concentrar stock.`);
                
                // CRUCIAL: Reasignamos la variable materialId con el ID del que ya existe.
                // NO hacemos 'return' para que el código de abajo ejecute la compra sobre este ID.
                materialId = materialExistente._id.toString(); 
                
            } else {
                // 2. Si realmente es nuevo, lo creamos y retornamos éxito
                console.log("🆕 Material no encontrado. Creando nuevo maestro en Atlas...");
                const nuevoMat = new Material({
                    nombre: nombreNormalizado,
                    categoria: req.body.categoria,
                    costo_base: parseFloat(req.body.costo_base || req.body.precio_total_lamina || 0),
                    precio_m2_costo: parseFloat(req.body.precio_m2_costo || req.body.costo_base || 0),
                    stock_actual: 0,
                    ancho_lamina_cm: parseFloat(req.body.ancho_lamina_cm || 0),
                    largo_lamina_cm: parseFloat(req.body.largo_lamina_cm || 0),
                    unidad: req.body.unidad || ((req.body.categoria === "MOLDURAS" || nombreNormalizado.toUpperCase().includes("MOLDURA")) ? "ML" : "M2"),
                    estado: 'Activo'
                });
                const guardado = await nuevoMat.save();
                return res.status(200).json({ 
                    success: true, 
                    message: "Material maestro creado. Proceda a registrar compra.", 
                    data: guardado 
                });
            }
        }      
        // --- FIN LÓGICA DE CREACIÓN ---

        // Validaciones de seguridad para compras (se mantienen intactas)
        if (!materialId || materialId === 'null' || materialId === 'undefined') {
            console.error("🚨 Intento de compra sin materialId válido");
            return res.status(400).json({ 
                success: false, 
                error: "ID de material no proporcionado o inválido. La actualización de stock fue abortada." 
            });
        }

        // 2. Mantenemos tus nombres de variables y lógica de fallback (Frontend compatible)
        const cantidad = parseFloat(req.body.cantidad_laminas || req.body.cantidad || 0);
        const largo = parseFloat(req.body.largo_lamina_cm || req.body.largo || 0);
        const ancho = parseFloat(req.body.ancho_lamina_cm || req.body.ancho || 0);
        const valorUnitario = parseFloat(req.body.precio_total_lamina || req.body.valorUnitario || 0);
        const proveedorId = req.body.proveedorId;
        const proveedorNombre = req.body.proveedorNombre;

        // 3. Cálculos m2 intactos
        const areaTotalIngreso = (largo * ancho / 10000) * cantidad;
        const valorTotalCalculado = valorUnitario * cantidad;

        // 4. Actualización del Material (Crucial: sin esto no aparece en colección materiales)
        const matAct = await Material.findByIdAndUpdate(materialId, { 
            $inc: { stock_actual: areaTotalIngreso },
            $set: { 
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                precio_total_lamina: valorUnitario,
                ultimo_costo: valorUnitario,
                fecha_ultima_compra: new Date(), 
                proveedor_principal: proveedorId 
            }
        }, { new: true });

        // Si el material no existe en Atlas, detenemos el proceso
        if (!matAct) {
            return res.status(404).json({ 
                success: false, 
                error: `El material con ID ${materialId} no fue encontrado en la base de datos.` 
            });
        }

        const provAct = await Provider.findById(proveedorId).select('nombre').lean();

        // 5. Registro de Transacción (Sincronizado con el éxito del paso anterior)
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

        return res.status(200).json({ 
            success: true, 
            nuevoStock: matAct ? matAct.stock_actual : 0,
            data: matAct 
        });

    } catch (error) {
        console.error("🚨 Error en Compra/Creación Atlas:", error.message);
        return res.status(200).json({ success: false, localRescue: true, error: error.message });
    }
});

// --- RUTAS DE MANTENIMIENTO (INTACTAS) ---
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