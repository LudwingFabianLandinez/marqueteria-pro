/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Controlador de Inventario - Versión 12.3.0 (SUPER-PERSISTENCIA ATLAS)
 * + DIAGNÓSTICO DE CONEXIÓN Y FORZADO DE ESCRITURA
 */

const mongoose = require('mongoose');

// Carga segura de modelos
const Material = require('../models/Material');
const Provider = require('../models/Provider');

// Función interna para obtener el modelo de transacción apuntando a 'purchases'
const getTransactionModel = () => {
    // Si el modelo ya existe lo usamos para evitar errores de recompilación en Mongoose
    if (mongoose.models.Transaction) return mongoose.models.Transaction;
    if (mongoose.models.Transaccion) return mongoose.models.Transaccion;

    const transactionSchema = new mongoose.Schema({
        materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
        tipo: { type: String, required: true },
        cantidad: Number,
        cantidad_m2: Number,
        costo_unitario: Number,
        costo_total: Number,
        proveedor: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
        fecha: { type: Date, default: Date.now },
        motivo: String
    }, { 
        collection: 'purchases', // <--- ESTO ES LO QUE HACE QUE SE VEA EN ATLAS
        timestamps: true 
    });

    return mongoose.model('Transaction', transactionSchema);
};

/**
 * 🚀 saveMaterial: Maneja la creación y edición de materiales
 */
const saveMaterial = async (req, res) => {
    try {
        console.log("------------------------------------------");
        console.log("📥 Datos recibidos en saveMaterial:", JSON.stringify(req.body));
        console.log("🛰️ DB CONECTADA:", mongoose.connection.name);
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
        
        res.status(200).json({ success: true, data: materials || [] });
    } catch (error) {
        res.status(500).json({ success: false, data: [], error: "Error al cargar materiales" });
    }
};

// 2. Registrar compra - VERSIÓN DUAL REFORZADA
const registerPurchase = async (req, res) => {
    try {
        console.log("------------------------------------------");
        console.log("🛰️ PROCESANDO COMPRA PARA ATLAS...");
        
        const { 
            nombre, proveedor, ancho_lamina_cm, largo_lamina_cm, 
            precio_total_lamina, cantidad_laminas, precio_venta_sugerido
        } = req.body;

        let { materialId } = req.body; 

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const esIdInvalido = !materialId || 
                             String(materialId).startsWith('TEMP-') || 
                             String(materialId).startsWith('MAT-') || 
                             String(materialId).length !== 24;

        if (esIdInvalido) materialId = null;
        
        let material = null;
        if (materialId) material = await Material.findById(materialId).exec();
        if (!material && nombre) {
            material = await Material.findOne({ 
                nombre: { $regex: new RegExp(`^${nombre.trim()}$`, 'i') } 
            }).exec();
        }

        // LÓGICA DE CÁLCULO
        const n = nombre.toUpperCase();
        const esMoldura = n.includes('K ') || n.includes('MP') || n.includes('MOLDURA');
        const cant = Math.max(0, parseFloat(cantidad_laminas) || 0);
        const precioUnitario = Math.max(0, parseFloat(precio_total_lamina) || 0);
        let incrementoStock = 0;
        let ancho = parseFloat(ancho_lamina_cm) || 0;
        let largo = parseFloat(largo_lamina_cm) || 0;

        if (esMoldura) {
            incrementoStock = cant * 2.90;
            ancho = ancho || 1; largo = largo || 290;
        } else {
            ancho = Math.max(0.1, ancho); largo = Math.max(0.1, largo);
            incrementoStock = (ancho * largo / 10000) * cant;
        }

        if (material) {
            material.stock_actual = (Number(material.stock_actual) || 0) + incrementoStock;
            if (precioUnitario > 0) material.precio_total_lamina = precioUnitario;
            await material.save();
        } else {
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
            await material.save();
        }

        // 🚩 REGISTRO EN 'purchases' CON PERSISTENCIA INMEDIATA (.create)
        const TransactionModel = getTransactionModel();
        if (TransactionModel && material) {
            const result = await TransactionModel.create({
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
            console.log("💎 ATLAS: Documento insertado en 'purchases' con ID:", result._id);
        }

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
        const purchases = await TransactionModel.find({ tipo: 'COMPRA' })
            .populate('materialId', 'nombre categoria')
            .populate('proveedor', 'nombre')
            .sort({ fecha: -1 }).lean();
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
        const history = await TransactionModel.find({ materialId: id }).sort({ fecha: -1 }).limit(20).lean();
        res.status(200).json({ success: true, data: history || [] });
    } catch (error) {
        res.status(500).json({ success: false, data: [], error: "Error al obtener historial" });
    }
};

// 5. Resumen de KPIs
const getPurchasesSummary = async (req, res) => {
    try {
        const TransactionModel = getTransactionModel();
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
        await TransactionModel.create({
            materialId: material._id,
            tipo: diferencia > 0 ? 'AJUSTE_MAS' : 'AJUSTE_MENOS',
            cantidad: Math.abs(diferencia),
            cantidad_m2: Math.abs(diferencia),
            motivo: motivo || 'Ajuste manual',
            fecha: new Date()
        });
        res.status(200).json({ success: true, data: { stock: material.stock_actual } });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en ajuste" });
    }
};

// 8. Eliminar material
const deleteMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        if (id && id.startsWith('MAT-')) return res.status(200).json({ success: true });
        await Material.findByIdAndDelete(id);
        const TransactionModel = getTransactionModel();
        await TransactionModel.deleteMany({ materialId: id });
        res.status(200).json({ success: true, message: "Material eliminado de Atlas" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al eliminar" });
    }
};

module.exports = {
    saveMaterial, createMaterial: saveMaterial, addMaterial: saveMaterial,
    getMaterials, getInventory: getMaterials,
    getMaterialHistory, registerPurchase, getAllPurchases,
    getPurchasesSummary, getLowStockMaterials,
    manualAdjustment, adjustStock: manualAdjustment,
    deleteMaterial
};