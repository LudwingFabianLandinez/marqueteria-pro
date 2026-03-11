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

// --- GESTIÓN DE FACTURAS (MAPEO DE CLIENTE CORREGIDO) ---
// --- GESTIÓN DE FACTURAS (MAPEO DE CLIENTE AGRESIVO v17.5.2) ---
router.get('/invoices', async (req, res) => {
    try {
        const facturas = await Invoice.find().sort({ createdAt: -1 }).limit(100).lean();
        
        res.json(facturas.map(f => {
            // 🔍 1. BÚSQUEDA EXHAUSTIVA DEL NOMBRE (Prioridad absoluta a datos reales)
            let nombreReal = null;

            if (f.clienteNombre && String(f.clienteNombre).trim() !== "" && f.clienteNombre !== "null") {
                nombreReal = f.clienteNombre;
            } else if (f.nombreCliente && String(f.nombreCliente).trim() !== "" && f.nombreCliente !== "null") {
                nombreReal = f.nombreCliente;
            } else if (f.cliente) {
                // Si 'f.cliente' es un objeto sacamos el nombre, si es string lo usamos directo
                nombreReal = (typeof f.cliente === 'object') 
                    ? (f.cliente.nombre || f.cliente.clienteNombre || null) 
                    : f.cliente;
            }

            // 🧹 2. LIMPIEZA FINAL (Eliminamos cualquier rastro de "GENÉRICO")
            const nombreFinal = (nombreReal && String(nombreReal).toLowerCase() !== "null" && String(nombreReal).toLowerCase() !== "undefined" && String(nombreReal).trim() !== "")
                ? String(nombreReal).toUpperCase()
                : "SIN NOMBRE"; // Cambiado de "GENÉRICO" a "SIN NOMBRE" para diagnóstico

            return {
                ...f, 
                cliente: nombreFinal, // Este es el campo que lee tu tabla de historial
                total: f.total || f.totalVenta || 0,
                numeroOrden: f.numeroOrden || f.numeroFactura || "S/N"
            };
        })); 
    } catch (error) {
        console.error("🚨 Error al mapear clientes en Historial:", error.message);
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
        console.log("📥 Iniciando proceso de guardado en Atlas...");

        // 👤 1. RESCATE DEFINITIVO DEL NOMBRE DEL CLIENTE (ACTUALIZADO)
    // 👤 1. RESCATE DEFINITIVO Y FORMATEO PARA ATLAS (REFORZADO)
        let nombreParaTabla = "SIN NOMBRE";
        
        // Buscamos el nombre en todas las posibles rutas que el frontend pueda estar usando
        const nombreRecibido = facturaData.clienteNombre || 
                               facturaData.nombreCliente || 
                               (facturaData.cliente && typeof facturaData.cliente === 'object' ? facturaData.cliente.nombre : null) || 
                               (typeof facturaData.cliente === 'string' ? facturaData.cliente : null);

        if (nombreRecibido && nombreRecibido.toString().trim() !== "" && nombreRecibido.toString().toLowerCase() !== "null") {
            nombreParaTabla = nombreRecibido.toString().trim().toUpperCase();
        }

        // --- SOLUCIÓN AL ERROR DE ATLAS ---
        // Forzamos el nombre en 'clienteNombre' para el historial
        facturaData.clienteNombre = nombreParaTabla;

        // Creamos el objeto 'cliente' con la propiedad 'nombre' para que la DB no lo rechace
        facturaData.cliente = {
            nombre: nombreParaTabla
        };

        // 🔥 2. BLOQUE DE RESCATE DE MATERIALES (MANTENIDO E INTACTO)
        if (facturaData.items && Array.isArray(facturaData.items)) {
            facturaData.items = facturaData.items.map(item => {
                const nombreDetectado = item.nombre || item.descripcion || item.materialNombre || "MATERIAL";
                const nombreFinal = String(nombreDetectado).toUpperCase();
                return {
                    ...item,
                    materialNombre: nombreFinal, 
                    nombre: nombreFinal,        
                    descripcion: nombreFinal    
                };
            });
        }

        // --- LÓGICA DE CONSECUTIVO OT (REFORZADA v18.0.0) ---
        // Buscamos la última factura asegurando que Atlas nos de el dato más reciente
        const ultimaFactura = await Invoice.findOne().sort({ createdAt: -1 }).lean();
        let siguienteNumero = 1;

        if (ultimaFactura) {
            // Buscamos el número en numeroOrden o numeroFactura indistintamente
            const idTexto = ultimaFactura.numeroOrden || ultimaFactura.numeroFactura || "";
            // Usamos regex para extraer solo los números al final (ej: de 'OT-00025' extrae 25)
            const match = idTexto.match(/\d+$/);
            if (match) {
                siguienteNumero = parseInt(match[0]) + 1;
            } else if (idTexto.startsWith('OT-')) {
                // Fallback a tu lógica anterior por si el regex no aplica
                const partes = idTexto.split('-');
                const ultimoNum = parseInt(partes[partes.length - 1]);
                if (!isNaN(ultimoNum)) siguienteNumero = ultimoNum + 1;
            }
        }

        const otConsecutivo = `OT-${String(siguienteNumero).padStart(5, '0')}`;
        facturaData.numeroFactura = otConsecutivo;
        facturaData.numeroOrden = otConsecutivo; 
        console.log(`🆕 Asignando consecutivo: ${otConsecutivo}`);
        
        // --- GUARDADO EN ATLAS CON MONITOREO DE ERRORES ---
        const nuevaFactura = new Invoice(facturaData);
        nuevaFactura.markModified('items'); 
        
        try {
            await nuevaFactura.save();
            console.log(`✅ ¡ÉXITO! ${otConsecutivo} guardada en Atlas.`);
        } catch (saveError) {
            // Este log aparecerá en Netlify y nos dirá exactamente qué campo rechaza Atlas
            console.error("🚨 ATLAS RECHAZÓ EL GUARDADO:", saveError.message);
            throw new Error(`Error de validación en Atlas: ${saveError.message}`);
        }

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
        console.error("🚨 ERROR FINAL EN /INVOICES:", error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            tip: "Revisa los logs de Netlify para ver el error detallado de Mongoose" 
        });
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
router.post('/inventory/purchase', async (req, res) => {
    try {
        // 1. Captura de ID y detección de flujo (Creación vs Compra)
        let materialId = req.body.materialId || req.body.id;

        // --- INICIO LÓGICA DE CREACIÓN ULTRA-REFORZADA (v17.6.9) ---
        if (materialId === "NUEVO") {
            const nombreNormalizado = req.body.nombre ? req.body.nombre.trim() : "";
            console.log(`🔍 Buscando identidad única para: "${nombreNormalizado}"...`);

            const materialExistente = await Material.findOne({ 
                nombre: { $regex: new RegExp(`^${nombreNormalizado}$`, 'i') } 
            });

            if (materialExistente) {
                console.log(`♻️ MATERIAL DETECTADO: Usando registro existente.`);
                materialId = materialExistente._id.toString(); 
            } else {
                console.log("🆕 Forzando creación de maestro con Stock 0 y Precio Neto...");
                
                const esMoldura = (req.body.categoria === "MOLDURAS" || nombreNormalizado.toUpperCase().includes("MOLDURA"));
                const costoDirecto = parseFloat(req.body.costo_base || req.body.precio_total_lamina || 0);
                
                const nuevoMat = new Material({
                    nombre: nombreNormalizado,
                    categoria: req.body.categoria,
                    // BLOQUEO DE PRECIO: Asignamos el valor neto. 
                    // Si el inventario muestra 10345 es porque algo le suma el 20%. 
                    // Al usar el mismo valor en ambos campos, neutralizamos recargos automáticos.
                    costo_base: costoDirecto,
                    precio_m2_costo: costoDirecto, 
                    
                    // BLOQUEO DE STOCK: Forzamos 0 independientemente de lo que llegue en el body.
                    stock_actual: 0,
                    
                    ancho_lamina_cm: parseFloat(req.body.ancho_lamina_cm || 0),
                    largo_lamina_cm: parseFloat(req.body.largo_lamina_cm || 0),
                    unidad: esMoldura ? "ML" : "M2",
                    estado: 'Activo'
                });

                // ESTA LÍNEA ES CRUCIAL: Evita que middlewares de cálculo se activen para el stock inicial
                nuevoMat.isNew = true;

                const guardado = await nuevoMat.save();
                
                console.log(`✅ BLOQUEO EXITOSO: ${nombreNormalizado} guardado con $${costoDirecto} y Stock 0`);

                // IMPORTANTE: El return aquí impide que el código siga hacia la lógica de compra.
                return res.status(200).json({ 
                    success: true, 
                    message: "Material creado en cero. Proceda a registrar compra.", 
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

        // --- 3. CÁLCULOS DIFERENCIADOS (ML vs M2) ---
        const categoriaMat = (req.body.categoria || "").toUpperCase();
        const nombreMat = (req.body.nombre || "").toUpperCase();
        
        let areaTotalIngreso;
        let precioInventarioActualizado = valorUnitario; // Por defecto para M2 que ya está bien
        
        // Verificamos si es moldura
        if (categoriaMat.includes("MOLDURA") || categoriaMat.includes("ML") || nombreMat.includes("MOLDURA")) {
            areaTotalIngreso = cantidad * 2.8;
            // CORRECCIÓN: Para que el inventario no suba a 10mil, guardamos el precio por metro (8618 / 2.8)
            precioInventarioActualizado = valorUnitario / 2.8;
            console.log(`📏 LÓGICA ML APLICADA: ${cantidad} tiras * 2.8 = ${areaTotalIngreso} ML`);
        } else {
            areaTotalIngreso = (largo * ancho / 10000) * cantidad;
            console.log(`🔳 LÓGICA M2 APLICADA: Area calculada = ${areaTotalIngreso} M2`);
        }

        const valorTotalCalculado = valorUnitario * cantidad;

        // 4. Actualización del Material
        const matAct = await Material.findByIdAndUpdate(materialId, { 
            $inc: { stock_actual: areaTotalIngreso },
            $set: { 
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                precio_total_lamina: valorUnitario,
                precio_m2_costo: precioInventarioActualizado, // Se actualiza solo si es ML, M2 sigue su curso
                ultimo_costo: valorUnitario,
                fecha_ultima_compra: new Date(), 
                proveedor_principal: proveedorId 
            }
        }, { new: true });

        if (!matAct) {
            return res.status(404).json({ 
                success: false, 
                error: `El material con ID ${materialId} no fue encontrado en la base de datos.` 
            });
        }

        const provAct = await Provider.findById(proveedorId).select('nombre').lean();

        // 5. Registro de Transacción
        const registro = new Transaction({
            tipo: 'IN',
            materialId: materialId,
            materialNombre: matAct ? matAct.nombre : "Material",
            proveedorId: proveedorId,
            proveedorNombre: proveedorNombre || (provAct ? provAct.nombre : "Proveedor General"), 
            cantidad: areaTotalIngreso,     
            cantidad_m2: areaTotalIngreso,  
            costo_unitario: precioInventarioActualizado,
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