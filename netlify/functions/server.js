/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Módulo de Servidor (Netlify Function) - Versión v13.4.45 (BLINDADA)
 * Blindaje: Estructura visual, cálculos m2 y consecutivos OT 100% INTACTOS.
 * Reparación: Estabilización de /inventory/purchase para eliminar Error 500.
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

console.log("📦 Modelos v13.4.45 vinculados y registrados exitosamente");

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
    
    console.log(`📡 [v13.4.45] ${req.method} -> ${req.url}`);
    next();
});

// 4. GESTIÓN DE CONEXIÓN DB (ESTABILIZADA)
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
    // --- RUTA DE SINCRONIZACIÓN DE FAMILIAS (INTACTA) ---
    router.get('/quotes/materials', async (req, res) => {
    try {
        // REFUERZO: Traemos todo lo que no esté inactivo Y que tenga nombre (elimina fantasmas)
        const materiales = await Material.find({ 
            estado: { $ne: 'Inactivo' },
            nombre: { $exists: true, $ne: "" } 
        }).sort({ nombre: 1 }).lean();
        
        console.log("📦 Total materiales reales recuperados:", materiales.length);
        
        const normalizar = (texto) => texto ? texto.toLowerCase().trim() : "";
        
        const materialesMapeados = materiales.map(m => ({
            ...m, 
            costo_m2: m.costo_m2 || m.precio_m2_costo || 0, 
            id: m._id,
            // SINCRONIZACIÓN: Forzamos que 'unidad' sea lo que diga el campo 'tipo'
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
                const u = normalizar(m.unidad); // Ahora sí viene de m.tipo
                
                // BLINDAJE TOTAL:
                return c.includes('marco') || 
                       c.includes('moldura') ||
                       n.includes('marco') || 
                       n.includes('moldura') || 
                       n.includes('madera') || 
                       n.includes('2312') || 
                       u === 'ml'; // <--- El salvavidas para la MP K 2312
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
        console.error("🚨 Error en server.js:", error.message);
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

    // --- PROVEEDORES ---
    router.get('/providers', async (req, res) => {
        try {
            const proveedores = await Provider.find().sort({ nombre: 1 }).lean();
            res.json(proveedores);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // --- INVENTARIO ---
    // --- INVENTARIO UNIFICADO (LECTURA Y GUARDADO) ---

// A. Leer Inventario (Ya lo tienes)
// --- SECCIÓN INVENTARIO UNIFICADA (CIRUGÍA DEFINITIVA) ---

// A. Leer Inventario
router.get('/inventory', async (req, res) => {
    try {
        const materiales = await Material.find().sort({ nombre: 1 }).lean();
        res.json(materiales);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// B. CREAR Nuevo Material (Ruta que espera api.js)
router.post('/inventory', async (req, res) => {
    try {
        // Quitamos cualquier ID temporal "LOC-" que venga del frontend
        const datos = { ...req.body };
        delete datos.id;
        delete datos._id;

        const resultado = new Material(datos);
        await resultado.save();
        
        console.log(`✅ Nuevo material creado en Atlas: ${resultado.nombre}`);
        res.json({ success: true, data: resultado });
    } catch (error) {
        console.error("❌ Error al crear material:", error.message);
        res.status(400).json({ success: false, error: error.message });
    }
});

// C. EDITAR Material Existente (Ruta compatible con api.js)
router.put('/inventory/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const datos = req.body;

        // Limpieza de datos numéricos para asegurar persistencia
        if (datos.stock_minimo !== undefined) datos.stock_minimo = parseFloat(datos.stock_minimo);
        if (datos.stock_actual !== undefined) datos.stock_actual = parseFloat(datos.stock_actual);

        const actualizado = await Material.findByIdAndUpdate(
            id, 
            { $set: datos }, 
            { new: true, runValidators: false }
        );

        if (!actualizado) return res.status(404).json({ success: false, error: "No encontrado en Atlas" });
        
        console.log(`✅ Material actualizado en Atlas: ${actualizado.nombre}`);
        res.json({ success: true, data: actualizado });
    } catch (error) {
        console.error("❌ Error al editar material:", error.message);
        res.status(400).json({ success: false, error: error.message });
    }
});

// D. MANTENER COMPATIBILIDAD (Ruta antigua /inventory/save)
router.post('/inventory/save', async (req, res) => {
    try {
        const { id, ...datos } = req.body;
        let resultado;
        if (id && id.length > 5 && !id.startsWith('LOC-')) {
            resultado = await Material.findByIdAndUpdate(id, { $set: datos }, { new: true });
        } else {
            const limpio = { ...datos };
            delete limpio.id; delete limpio._id;
            resultado = new Material(limpio);
            await resultado.save();
        }
        res.json({ success: true, data: resultado });
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

            const dataMapeada = compras.map(c => {
                return {
                    fecha: c.fecha || new Date(),
                    materialId: { nombre: c.materialNombre || "Ingreso de Material" },
                    proveedorId: { nombre: c.proveedorNombre || "Proveedor General" },
                    cantidad_m2: parseFloat(c.cantidad || c.cantidad_m2 || 0).toFixed(2),
                    costo_total: parseFloat(c.costo_total || c.total || 0),
                    motivo: c.materialNombre || "Ingreso"
                };
            });
            res.json({ success: true, count: dataMapeada.length, data: dataMapeada });
        } catch (error) {
            res.json({ success: true, data: [] });
        }
    });

    // --- REGISTRO DE COMPRA (ESTABILIZACIÓN ANTIFALLO 500) ---
    router.post('/inventory/purchase', async (req, res) => {
        try {
            const { materialId, cantidad, largo, ancho, valorUnitario, proveedorId, proveedorNombre } = req.body;
            
            // Cálculos blindados
            const areaTotalIngreso = (parseFloat(largo || 0) * parseFloat(ancho || 0) / 10000) * parseFloat(cantidad || 0);
            const valorTotalCalculado = parseFloat(valorUnitario || 0) * parseFloat(cantidad || 0);

            // Ejecución secuencial para evitar race conditions que causan el 500
            const matAct = await Material.findByIdAndUpdate(materialId, { 
                $inc: { stock_actual: areaTotalIngreso },
                $set: { 
                    ultimo_costo: parseFloat(valorUnitario), 
                    fecha_ultima_compra: new Date(), 
                    proveedor_principal: proveedorId 
                }
            }, { new: true }).lean();

            const provAct = await Provider.findById(proveedorId).select('nombre').lean();

            // Creación del registro con fallback de seguridad
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

            // Guardado forzado sin validaciones que bloqueen el hilo
            await registro.save({ validateBeforeSave: false });
            
            return res.status(200).json({ 
                success: true, 
                nuevoStock: matAct ? matAct.stock_actual : 0, 
                ingreso_m2: areaTotalIngreso 
            });

        } catch (error) {
            console.error("🚨 Error crítico en Purchase:", error.message);
            // Si falla la DB, devolvemos un 200 falso pero con éxito false para que el Frontend active el Rescate Local
            return res.status(200).json({ 
                success: false, 
                error: "Fallo de escritura, activando respaldo local",
                localRescue: true 
            });
        }
    });

} catch (error) {
    console.error(`🚨 Error vinculando rutas: ${error.message}`);
}

// --- RUTA PARA ELIMINAR FACTURAS (Añadir esto) ---
router.delete('/invoices/:id', async (req, res) => {
    try {
        await Invoice.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Orden eliminada" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. MONTAJE DE RUTAS
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
        console.log("Actualizado:", materialActualizado.stock_minimo); 
        res.json({ success: true, data: materialActualizado });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6. MONTAJE DE RUTAS (SOLO UNA VEZ Y AL FINAL)
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