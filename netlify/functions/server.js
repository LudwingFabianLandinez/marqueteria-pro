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
const fs = require('fs');
const path = require('path');

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

// SERVIR ARCHIVOS ESTÁTICOS (LOCAL DEV)
app.use(express.static(path.join(__dirname, '../../public')));

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
router.get('/invoices', async (req, res) => {
    try {
        const facturas = await Invoice.find().sort({ createdAt: -1 }).limit(100).lean();
        
        res.json(facturas.map(f => {
            // 🔍 1. BÚSQUEDA ULTRA-EXHAUSTIVA (Sin margen de error)
            let nombreReal = null;

            // Prioridad 1: Campo directo 'clienteNombre'
            if (f.clienteNombre && String(f.clienteNombre).trim() !== "" && String(f.clienteNombre).toLowerCase() !== "null") {
                nombreReal = f.clienteNombre;
            } 
            // Prioridad 2: Campo alternativo 'nombreCliente'
            else if (f.nombreCliente && String(f.nombreCliente).trim() !== "" && String(f.nombreCliente).toLowerCase() !== "null") {
                nombreReal = f.nombreCliente;
            } 
            // Prioridad 3: Estructura de objeto 'cliente.nombre'
            else if (f.cliente) {
                if (typeof f.cliente === 'object') {
                    nombreReal = f.cliente.nombre || f.cliente.clienteNombre || null;
                } else if (typeof f.cliente === 'string' && f.cliente.toLowerCase() !== "null") {
                    nombreReal = f.cliente;
                }
            }

            // 🧹 2. FILTRO ANTI-GENÉRICO Y LIMPIEZA
            // Si el nombre resultante contiene la palabra "GENERICO", lo tratamos como "SIN NOMBRE"
            let nombreFinal = "SIN NOMBRE";
            
            if (nombreReal && 
                !String(nombreReal).toUpperCase().includes("GENÉRICO") && 
                !String(nombreReal).toUpperCase().includes("GENERICO") &&
                String(nombreReal).toLowerCase() !== "null" && 
                String(nombreReal).trim() !== "") {
                
                nombreFinal = String(nombreReal).trim().toUpperCase();
            }

            // 📦 3. RETORNO DE DATA (Manteniendo todos tus otros campos intactos)
            return {
                ...f, 
                cliente: nombreFinal, // Este es el que usa tu tabla del historial
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

        // 🔥 TRIPLE ASIGNACIÓN: No dañamos nada, solo aseguramos que el nombre esté en todo lado
        
        // 1. Para el historial que busca el campo directo
        facturaData.clienteNombre = nombreParaTabla;
        
        // 2. Para procesos internos que usen nombreCliente
        facturaData.nombreCliente = nombreParaTabla;

        // 3. PARA ATLAS Y EL HISTORIAL QUE BUSCA OBJETOS (Soluciona el error de validación)
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

        // --- DESCUENTO DE STOCK ---
        if (facturaData.items) {
            for (const item of facturaData.items) {
                if (item.productoId) {
                    const area = parseFloat(item.area_m2) || ((parseFloat(item.ancho || 0) * parseFloat(item.largo || 0)) / 10000);
                    // Usar updateOne para evitar el hook pre('findOneAndUpdate') del modelo Material
                    await Material.updateOne({ _id: item.productoId }, { $inc: { stock_actual: -area } });
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

// --- RUTA DE BORRADO DEFINITIVO EN ATLAS (SINCRO V15.0) ---
router.delete('/inventory/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📡 Orden de borrado físico recibida para ID: ${id}`);

        // Ejecución directa en la colección de Materiales
        const resultado = await Material.findByIdAndDelete(id);

        if (!resultado) {
            console.warn(`⚠️ El material ${id} no existe en Atlas.`);
            return res.status(404).json({ 
                success: false, 
                message: "Material no encontrado en la nube." 
            });
        }

        console.log(`✅ ¡ÉXITO! Material ${id} eliminado de Atlas permanentemente.`);
        res.json({ 
            success: true, 
            message: "Eliminado de Atlas permanentemente." 
        });

    } catch (error) {
        console.error("🚨 Error crítico en el endpoint de borrado:", error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
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
        })
        .populate('materialId', 'nombre')
        .populate('proveedor', 'nombre contacto')
        .sort({ fecha: -1 })
        .limit(100)
        .lean();

        // Compatibilidad con históricos: algunas compras viejas guardaron proveedorId en vez de proveedor.
        const idsProveedor = [...new Set(
            compras
                .map(c => {
                    if (c.proveedor && typeof c.proveedor === 'string' && c.proveedor.length === 24) return c.proveedor;
                    if (c.proveedorId && typeof c.proveedorId === 'string' && c.proveedorId.length === 24) return c.proveedorId;
                    if (c.proveedorId && typeof c.proveedorId === 'object' && c.proveedorId._id) return String(c.proveedorId._id);
                    return null;
                })
                .filter(Boolean)
        )];

        const proveedoresLookup = idsProveedor.length > 0
            ? await Provider.find({ _id: { $in: idsProveedor } }).select('nombre contacto').lean()
            : [];

        const mapaProveedores = new Map(
            proveedoresLookup.map(p => [String(p._id), p.nombre || p.contacto || 'Proveedor General'])
        );

        const resolverNombreProveedor = (c) => {
            if (c.proveedor && typeof c.proveedor === 'object') {
                return c.proveedor.nombre || c.proveedor.contacto || 'Proveedor General';
            }

            if (c.proveedorNombre || c.providerName || c.nombreProveedor) {
                return c.proveedorNombre || c.providerName || c.nombreProveedor;
            }

            const idCandidato =
                (typeof c.proveedor === 'string' ? c.proveedor : null) ||
                (typeof c.proveedorId === 'string' ? c.proveedorId : null) ||
                (c.proveedorId && c.proveedorId._id ? String(c.proveedorId._id) : null);

            if (idCandidato && idCandidato.length === 24 && mapaProveedores.has(idCandidato)) {
                return mapaProveedores.get(idCandidato);
            }

            // Si viene texto libre no-ObjectId, lo tratamos como nombre directo
            if (idCandidato && idCandidato.length !== 24) {
                return idCandidato;
            }

            return 'Proveedor General';
        };

        const dataMapeada = compras.map(c => ({
            _id: c._id,
            fecha: c.fecha || new Date(),
            materialId: { 
                nombre: (c.materialId && c.materialId.nombre) || c.materialNombre || "Ingreso de Material" 
            },
            proveedorId: { 
                nombre: resolverNombreProveedor(c)
            },
            proveedor: c.proveedor || null,
            cantidad_m2: Number.parseFloat(c.cantidad_m2 ?? c.cantidad ?? c.totalM2 ?? 0).toFixed(2),
            costo_total: Number.parseFloat(c.costo_total ?? c.total ?? c.costo ?? c.precio_total ?? c.costo_pagado ?? c.total_pagado ?? 0) || 0,
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
        // DEBUG: log incoming purchase payload (truncated)
        try { console.log('DEBUG /inventory/purchase body:', JSON.stringify(req.body).slice(0,2000)); } catch(e){}
        // -- ADICIONAL: Guardar copia en archivo local para facilitar debug en entorno local
        try {
            const debugDir = path.join(process.cwd(), 'debug');
            if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
            const file = path.join(debugDir, 'purchases.log');
            const logEntry = { ts: new Date().toISOString(), path: (req.originalUrl||req.url), body: req.body };
            fs.appendFileSync(file, JSON.stringify(logEntry) + '\n');
        } catch (fileErr) {
            console.warn('WARN: no se pudo escribir debug/purchases.log:', fileErr && fileErr.message);
        }
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
        const proveedorId = req.body.proveedorId || req.body.proveedor || req.body.providerId;
        const proveedorNombreRaw = req.body.proveedorNombre || req.body.providerName || req.body.nombreProveedor;
        const proveedorNombre = (proveedorNombreRaw && String(proveedorNombreRaw).trim())
            ? String(proveedorNombreRaw).trim()
            : ((proveedorId && String(proveedorId).length !== 24) ? String(proveedorId).trim() : "");
        const costoTotalRecibido = parseFloat(
            req.body.costo_total ||
            req.body.total ||
            req.body.costoPagado ||
            req.body.costo_pagado ||
            req.body.total_pagado ||
            req.body.valorTotal ||
            0
        );

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

        // Si el frontend envía costo total de la compra, lo respetamos; si no, usamos el cálculo tradicional
        const valorTotalCalculado = costoTotalRecibido > 0 ? costoTotalRecibido : (valorUnitario * cantidad);

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

        const provAct = (proveedorId && String(proveedorId).length === 24)
            ? await Provider.findById(proveedorId).select('nombre contacto').lean()
            : null;

        // 5. Registro de Transacción
        const registro = new Transaction({
            tipo: 'IN',
            materialId: materialId,
            materialNombre: matAct ? matAct.nombre : "Material",
            proveedor: proveedorId,
            proveedorId: proveedorId,
            proveedorNombre: proveedorNombre || (provAct ? (provAct.nombre || provAct.contacto) : "Proveedor General"), 
            cantidad: areaTotalIngreso,     
            cantidad_m2: areaTotalIngreso,  
            costo_unitario: precioInventarioActualizado,
            total: valorTotalCalculado,           
            costo_total: valorTotalCalculado, 
            costo_pagado: valorTotalCalculado,
            fecha: new Date()
        });

        // DEBUG: what we will save for key fields
        try {
            console.log('DEBUG registro to save ->', JSON.stringify({ proveedorId: registro.proveedorId, proveedorNombre: registro.proveedorNombre, costo_total: registro.costo_total, total: registro.total }).slice(0,2000));
        } catch(e){}

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

// --- ELIMINAR COMPRA Y RESTAURAR INVENTARIO ---
router.delete('/inventory/purchase/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Pedido de eliminación de compra recibido: ${id}`);

        const trx = await Transaction.findById(id).lean();
        if (!trx) return res.status(404).json({ success: false, message: 'Compra no encontrada' });
        if (trx.tipo !== 'COMPRA') return res.status(400).json({ success: false, message: 'El registro no corresponde a una compra' });

        const mId = trx.materialId;
        const resta = Number(trx.cantidad_m2 || trx.cantidad || 0);
        if (mId && resta) {
            await Material.updateOne({ _id: mId }, { $inc: { stock_actual: -(resta) } });
        }

        await Transaction.findByIdAndDelete(id);
        res.json({ success: true, message: 'Compra eliminada y stock actualizado' });
    } catch (error) {
        console.error('🚨 Error eliminando compra:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- ELIMINACIÓN DE OT CON RESTAURACIÓN DE STOCK ---
router.delete('/invoices/:id', async (req, res) => {
    try {
        const id = req.params.id;
        console.log(`[DELETE OT] Iniciando eliminación de OT: ${id}`);

        const factura = await Invoice.findById(id).lean();
        if (!factura) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada' });
        }

        const items = Array.isArray(factura.items) ? factura.items : [];
        console.log(`[DELETE OT] OT encontrada: ${factura.numeroFactura || id} | Items: ${items.length}`);

        let restaurados = 0;
        const sinRestaurar = [];

        for (const item of items) {
            try {
                const productoId = item && item.productoId;
                if (!productoId) {
                    console.warn(`[DELETE OT] Item sin productoId: ${item && (item.materialNombre || item.nombre)}`);
                    sinRestaurar.push(item && (item.materialNombre || item.nombre) || 'desconocido');
                    continue;
                }

                // Usar EXACTAMENTE el mismo campo y orden de prioridad que al descontar stock
                // (creación usa: parseFloat(item.area_m2) || ((ancho * largo) / 10000))
                const cantidadARestaurar = parseFloat(item.area_m2) ||
                    ((parseFloat(item.ancho || 0) * parseFloat(item.largo || 0)) / 10000) ||
                    parseFloat(item.cantidadUsada) || 0;

                if (cantidadARestaurar <= 0) {
                    console.warn(`[DELETE OT] Cantidad 0 para: ${item.materialNombre || item.nombre} | area_m2=${item.area_m2}`);
                    sinRestaurar.push(item.materialNombre || item.nombre || 'desconocido');
                    continue;
                }

                console.log(`[DELETE OT] Restaurando: ${item.materialNombre || item.nombre} | productoId=${productoId} | cantidad=${cantidadARestaurar}`);

                // Usar Material.updateOne para evitar el hook pre('findOneAndUpdate')
                // que puede corromper el update al agregar campos extra
                const resultado = await Material.updateOne(
                    { _id: productoId },
                    { $inc: { stock_actual: cantidadARestaurar } }
                );

                if (resultado.matchedCount === 0) {
                    console.warn(`[DELETE OT] Material no encontrado en BD: ${productoId}`);
                    sinRestaurar.push(item.materialNombre || item.nombre || String(productoId));
                } else {
                    console.log(`[DELETE OT] ✅ Stock restaurado: +${cantidadARestaurar} para ${item.materialNombre || item.nombre}`);
                    restaurados++;
                }
            } catch (errItem) {
                const nombreItem = item && (item.materialNombre || item.nombre) || 'desconocido';
                console.error(`[DELETE OT] Error en item ${nombreItem}:`, errItem.message);
                sinRestaurar.push(nombreItem);
            }
        }

        await Invoice.findByIdAndDelete(id);

        console.log(`[DELETE OT] ✅ Eliminada OT ${factura.numeroFactura || id}. Restaurados: ${restaurados}/${items.length}`);
        res.json({
            success: true,
            message: `Orden eliminada. Stock restaurado para ${restaurados} de ${items.length} material(es).`,
            detalles: sinRestaurar.length > 0 ? { sinRestaurar } : undefined
        });

    } catch (error) {
        console.error('[DELETE OT] Error general:', error.message);
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

// --- RUTA DEBUG: Listar transacciones crudas (solo para debug local) ---
router.get('/debug/raw-purchases', async (req, res) => {
    try {
        const data = await Transaction.find().sort({ fecha: -1 }).limit(10).lean();
        res.json({ success: true, count: data.length, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6. MONTAJE DE RUTAS
app.use('/', router);

const handler = serverless(app);

// SERVIDOR LOCAL (Solo se activa al correr con node directamente)
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Servidor local en http://localhost:${PORT}`));
    connectDB().catch(err => console.warn('⚠️ BD no disponible:', err.message));
}

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