/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Controlador de Inventario - Versión 12.2.8 (FIX DOBLE PERSISTENCIA)
 * + DIAGNÓSTICO DE CONEXIÓN (Punto 3)
 */

const mongoose = require('mongoose');

// Carga segura de modelos
const Material = require('../models/Material');
const Provider = require('../models/Provider');

// Función interna para obtener el modelo de transacción de forma dinámica
const getTransactionModel = () => {
    return mongoose.models.Transaction || mongoose.models.Transaccion;
};

/**
 * 🚀 saveMaterial: Maneja la creación y edición de materiales
 */
const saveMaterial = async (req, res) => {
    try {
        // 🕵️ DIAGNÓSTICO SAVE:
        console.log("------------------------------------------");
        console.log("📥 Datos recibidos en saveMaterial:", JSON.stringify(req.body));
        console.log("🛰️ DB CONECTADA:", mongoose.connection.name);
        console.log("📋 COLECCIONES:", Object.keys(mongoose.connection.collections));
        console.log("------------------------------------------");

        const { 
            id, nombre, categoria, tipo, stock_actual, 
            precio_total_lamina, proveedor,
            ancho_lamina_cm, largo_lamina_cm 
        } = req.body;

        const esIdValido = (val) => val && mongoose.Types.ObjectId.isValid(val) && val.length === 24;
        const proveedorFinal = esIdValido(proveedor) ? proveedor : null;

        const datosLimpios = {
            nombre: (nombre || "Nuevo Material").trim().toUpperCase(),
            categoria: categoria || "Otros",
            tipo: tipo || "m2",
            stock_actual: Number(stock_actual) || 0,
            precio_total_lamina: Number(precio_total_lamina) || 0,
            ancho_lamina_cm: Number(ancho_lamina_cm) || 0,
            largo_lamina_cm: Number(largo_lamina_cm) || 0,
            proveedor: proveedorFinal || undefined
        };

        let material;
        if (id && esIdValido(id)) {
            material = await Material.findByIdAndUpdate(
                id, 
                { $set: datosLimpios }, 
                { new: true, runValidators: true }
            );
            if (!material) return res.status(404).json({ success: false, message: "Material no encontrado" });
            console.log("✅ Material actualizado en Atlas");
        } else {
            material = new Material(datosLimpios);
            await material.save();
            console.log("✨ Nuevo material guardado en Atlas:", material.nombre);
        }

        res.status(200).json({ success: true, data: material });
    } catch (error) {
        console.error("🚨 Error crítico en saveMaterial (Atlas):", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 1. Obtener materiales
const getMaterials = async (req, res) => {
    try {
        const materials = await Material.find()
            .populate('proveedor', 'nombre') 
            .sort({ categoria: 1, nombre: 1 })
            .lean();
        
        res.status(200).json({
            success: true,
            data: materials || []
        });
    } catch (error) {
        console.error("❌ Error en getMaterials:", error);
        res.status(500).json({ success: false, data: [], error: "Error al cargar materiales" });
    }
};

// 2. Registrar compra - VERSIÓN DUAL REFORZADA
const registerPurchase = async (req, res) => {
    try {
        // 🕵️ DIAGNÓSTICO PURCHASE:
        console.log("------------------------------------------");
        console.log("🛰️ REGISTRANDO COMPRA EN DB:", mongoose.connection.name);
        console.log("📋 COLECCIONES DISPONIBLES:", Object.keys(mongoose.connection.collections));
        console.log("📦 DATA RECIBIDA:", req.body.nombre, "ID:", req.body.materialId);
        console.log("------------------------------------------");

        const { 
            nombre, proveedor,      
            ancho_lamina_cm, largo_lamina_cm, 
            precio_total_lamina, cantidad_laminas,
            precio_venta_sugerido
        } = req.body;

        let { materialId } = req.body; 

        // 🛡️ SEGURIDAD 1: Verificar conexión activa
        if (mongoose.connection.readyState !== 1) {
            console.log("🔄 Re-conectando a Atlas...");
            await mongoose.connect(process.env.MONGODB_URI);
        }

        console.log(`📦 Procesando compra en Atlas: ${nombre}`);

        // 🛡️ SEGURIDAD 2: LIMPIEZA RADICAL DE ID (Mata los TEMP- y MAT-)
        const esIdInvalido = !materialId || 
                             String(materialId).startsWith('TEMP-') || 
                             String(materialId).startsWith('MAT-') || 
                             String(materialId).length !== 24;

        if (esIdInvalido) {
            console.log("⚠️ ID temporal detectado, se ignorará para buscar por nombre.");
            materialId = null;
        }
        
        let material = null;
        if (materialId) {
            material = await Material.findById(materialId).exec();
        }
        
        // Búsqueda por nombre si no hay ID real
        if (!material && nombre) {
            material = await Material.findOne({ 
                nombre: { $regex: new RegExp(`^${nombre.trim()}$`, 'i') } 
            }).exec();
        }

        // --- LÓGICA DE CÁLCULO ORIGINAL (INTACTA) ---
        const n = nombre.toUpperCase();
        const esMoldura = n.includes('K ') || n.includes('MP') || n.includes('MOLDURA');
        
        const cant = Math.max(0, parseFloat(cantidad_laminas) || 0);
        const precioUnitario = Math.max(0, parseFloat(precio_total_lamina) || 0);
        let incrementoStock = 0;
        let ancho = parseFloat(ancho_lamina_cm) || 0;
        let largo = parseFloat(largo_lamina_cm) || 0;

        if (esMoldura) {
            incrementoStock = cant * 2.90;
            ancho = ancho || 1; 
            largo = largo || 290;
        } else {
            ancho = Math.max(0.1, ancho);
            largo = Math.max(0.1, largo);
            incrementoStock = (ancho * largo / 10000) * cant;
        }

        if (material) {
            // ACTUALIZAR EXISTENTE
            material.stock_actual = (Number(material.stock_actual) || 0) + incrementoStock;
            if (precioUnitario > 0) material.precio_total_lamina = precioUnitario;
            if (material.ancho_lamina_cm === 0) material.ancho_lamina_cm = ancho;
            if (material.largo_lamina_cm === 0) material.largo_lamina_cm = largo;

            // 🔥 PERSISTENCIA FORZADA
            await material.save();
            console.log("✅ Atlas: Material actualizado exitosamente en 'materiales'.");
        } else {
            // CREAR NUEVO
            material = new Material({
                nombre: nombre.trim().toUpperCase(),
                categoria: esMoldura ? 'MOLDURAS' : 'GENERAL',
                tipo: esMoldura ? 'ml' : 'm2',
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                precio_total_lamina: precioUnitario,
                stock_actual: incrementoStock,
                precio_venta_sugerido: parseFloat(precio_venta_sugerido) || 0,
                proveedor: mongoose.Types.ObjectId.isValid(proveedor) ? proveedor : undefined
            });

            // 🔥 PERSISTENCIA FORZADA
            await material.save();
            console.log("✨ Atlas: Nuevo material creado físicamente en 'materiales' con ID:", material._id);
        }

        // 🚩 ADICIÓN PARA ATLAS: CREAR EL REGISTRO DE TRANSACCIÓN
        const TransactionModel = getTransactionModel();
        if (TransactionModel && material) {
            const nuevaCompra = new TransactionModel({
                materialId: material._id,
                tipo: 'COMPRA',
                cantidad: cant,
                cantidad_m2: incrementoStock,
                costo_unitario: precioUnitario,
                costo_total: precioUnitario * cant,
                proveedor: material.proveedor,
                fecha: new Date(),
                motivo: `Compra registrada: ${nombre}`
            });
            await nuevaCompra.save();
            console.log("💎 Atlas: Registro de transacción guardado exitosamente.");
        }

        // --- RESPUESTA GARANTIZADA ---
        return res.status(200).json({ 
            success: true, 
            message: "Sincronizado con Atlas",
            data: material.toObject()
        });

    } catch (error) {
        console.error("🚨 ERROR CRÍTICO EN ATLAS:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. Obtener todas las compras
const getAllPurchases = async (req, res) => {
    try {
        const TransactionModel = getTransactionModel();
        if (!TransactionModel) return res.status(200).json({ success: true, data: [] });
        const purchases = await TransactionModel.find({ tipo: 'COMPRA' })
            .populate('materialId', 'nombre categoria')
            .populate('proveedor', 'nombre')
            .sort({ fecha: -1 })
            .lean();
        res.status(200).json({ success: true, data: purchases || [] });
    } catch (error) {
        res.status(500).json({ success: false, data: [], error: "Error al cargar historial" });
    }
};

// 4. Historial de un material específico
const getMaterialHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const TransactionModel = getTransactionModel();
        if (!TransactionModel) return res.status(200).json({ success: true, data: [] });
        const history = await TransactionModel.find({ materialId: id })
            .sort({ fecha: -1 })
            .limit(20)
            .lean();
        res.status(200).json({ success: true, data: history || [] });
    } catch (error) {
        res.status(500).json({ success: false, data: [], error: "Error al obtener historial" });
    }
};

// 5. Resumen de KPIs
const getPurchasesSummary = async (req, res) => {
    try {
        const TransactionModel = getTransactionModel();
        if (!TransactionModel) return res.json({ totalInvertido: 0, totalCantidad: 0, conteo: 0 });
        const stats = await TransactionModel.aggregate([
            { $match: { tipo: 'COMPRA' } },
            { $group: {
                _id: null,
                totalInvertido: { $sum: "$costo_total" },
                totalCantidad: { $sum: "$cantidad_m2" },
                conteo: { $sum: 1 }
            }}
        ]);
        res.status(200).json(stats[0] || { totalInvertido: 0, totalCantidad: 0, conteo: 0 });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en KPIs" });
    }
};

// 6. Alertas de Stock Bajo
const getLowStockMaterials = async (req, res) => {
    try {
        const lowStock = await Material.find({ 
            $expr: { $lt: ["$stock_actual", "$stock_minimo"] } 
        }).limit(10).lean();
        res.status(200).json({ success: true, data: lowStock || [] });
    } catch (error) {
        res.status(500).json({ success: false, data: [], error: "Error en alertas" });
    }
};

// 7. Ajuste manual de stock
const manualAdjustment = async (req, res) => {
    try {
        const { materialId, nuevaCantidad, stock_minimo, motivo } = req.body;
        const material = await Material.findById(materialId);
        if (!material) return res.status(404).json({ success: false, message: "No encontrado" });

        const diferencia = parseFloat(nuevaCantidad) - material.stock_actual;
        material.stock_actual = parseFloat(nuevaCantidad);
        if (stock_minimo !== undefined) material.stock_minimo = parseFloat(stock_minimo);
        
        await material.save();

        const TransactionModel = getTransactionModel();
        if (TransactionModel) {
            await TransactionModel.create({
                materialId: material._id,
                tipo: diferencia > 0 ? 'AJUSTE_MAS' : 'AJUSTE_MENOS',
                cantidad: Math.abs(diferencia),
                cantidad_m2: Math.abs(diferencia),
                motivo: motivo || 'Ajuste manual',
                fecha: new Date()
            });
        }
        res.status(200).json({ success: true, data: { stock: material.stock_actual } });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en ajuste" });
    }
};

// 8. Eliminar material
const deleteMaterial = async (req, res) => {
    try {
        const { id } = req.params;

        if (id && id.startsWith('MAT-')) {
            console.log("🛡️ Bloqueando intento de borrado local en Atlas para ID:", id);
            return res.status(200).json({ 
                success: true, 
                message: "Registro local ignorado, permitiendo sincronización" 
            });
        }

        await Material.findByIdAndDelete(id);
        
        const TransactionModel = getTransactionModel();
        if (TransactionModel) {
            await TransactionModel.deleteMany({ materialId: id });
        }

        res.status(200).json({ success: true, message: "Material eliminado de Atlas" });
    } catch (error) {
        console.error("❌ Error en deleteMaterial:", error.message);
        res.status(500).json({ success: false, error: "Error al eliminar" });
    }
};

// EXPORTACIÓN CONSOLIDADA
module.exports = {
    saveMaterial,
    createMaterial: saveMaterial,
    addMaterial: saveMaterial,
    getMaterials,
    getInventory: getMaterials,
    getMaterialHistory,
    registerPurchase,
    getAllPurchases,
    getPurchasesSummary,
    getLowStockMaterials,
    manualAdjustment,
    adjustStock: manualAdjustment,
    deleteMaterial
};