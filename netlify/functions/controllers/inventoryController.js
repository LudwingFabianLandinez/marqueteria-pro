/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Controlador de Inventario - Versión 12.4.0 (FORZADO DE PERSISTENCIA TOTAL)
 */

const mongoose = require('mongoose');
const Material = require('../models/Material');
const Provider = require('../models/Provider');

// 1. DEFINICIÓN ESTÁTICA (Para que Mongoose no pierda el hilo en Atlas)
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
    collection: 'purchases',
    timestamps: true 
});

// Evitamos errores de recompilación típicos de Netlify
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

/**
 * 🚀 saveMaterial: Maneja la creación y edición de materiales
 */
const saveMaterial = async (req, res) => {
    try {
        const { id, nombre, categoria, tipo, stock_actual, precio_total_lamina, proveedor, ancho_lamina_cm, largo_lamina_cm } = req.body;
        const esIdValido = (val) => val && mongoose.Types.ObjectId.isValid(val) && val.length === 24;

        const datosLimpios = {
            nombre: (nombre || "").trim().toUpperCase(),
            categoria: categoria || "Otros",
            tipo: tipo || "m2",
            stock_actual: Number(stock_actual) || 0,
            precio_total_lamina: Number(precio_total_lamina) || 0,
            ancho_lamina_cm: Number(ancho_lamina_cm) || 0,
            largo_lamina_cm: Number(largo_lamina_cm) || 0,
            proveedor: esIdValido(proveedor) ? proveedor : undefined
        };

        let material;
        if (esIdValido(id)) {
            material = await Material.findByIdAndUpdate(id, { $set: datosLimpios }, { new: true });
        } else {
            material = new Material(datosLimpios);
            await material.save();
        }
        res.status(200).json({ success: true, data: material });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 📦 registerPurchase: Registro con persistencia garantizada en Atlas
 */
const registerPurchase = async (req, res) => {
    try {
        console.log("------------------------------------------");
        console.log("🛰️ INICIANDO OPERACIÓN EN ATLAS...");

        const { nombre, proveedor, ancho_lamina_cm, largo_lamina_cm, precio_total_lamina, cantidad_laminas, precio_venta_sugerido } = req.body;
        let { materialId } = req.body;

        // Asegurar conexión activa
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        // Limpiar IDs temporales
        if (!materialId || materialId.startsWith('TEMP-') || materialId.startsWith('MAT-') || materialId.length !== 24) {
            materialId = null;
        }
        
        let material = null;
        if (materialId) material = await Material.findById(materialId);
        if (!material && nombre) {
            material = await Material.findOne({ nombre: { $regex: new RegExp(`^${nombre.trim()}$`, 'i') } });
        }

        if (!material) throw new Error("Material no encontrado en Atlas");

        // LÓGICA DE CÁLCULO
        const n = nombre.toUpperCase();
        const esMoldura = n.includes('K ') || n.includes('MP') || n.includes('MOLDURA');
        const cant = Math.max(0, parseFloat(cantidad_laminas) || 0);
        const precioUnitario = Math.max(0, parseFloat(precio_total_lamina) || 0);
        let incrementoStock = 0;
        
        if (esMoldura) {
            incrementoStock = cant * 2.90;
        } else {
            const ancho = parseFloat(ancho_lamina_cm) || material.ancho_lamina_cm || 0;
            const largo = parseFloat(largo_lamina_cm) || material.largo_lamina_cm || 0;
            incrementoStock = (ancho * largo / 10000) * cant;
        }

        // ACTUALIZACIÓN DE STOCK
        material.stock_actual = (Number(material.stock_actual) || 0) + incrementoStock;
        if (precioUnitario > 0) material.precio_total_lamina = precioUnitario;

        // 🔥 BLOQUE DE PERSISTENCIA ATÓMICA
        // Usamos Promise.all para que Netlify NO corte la ejecución hasta que ambos se guarden
        const [materialGuardado, compraGuardada] = await Promise.all([
            material.save(),
            Transaction.create({
                materialId: material._id,
                tipo: 'COMPRA',
                cantidad: cant,
                cantidad_m2: incrementoStock,
                costo_unitario: precioUnitario,
                costo_total: precioUnitario * cant,
                proveedor: material.proveedor || proveedor,
                fecha: new Date(),
                motivo: `Compra registrada: ${nombre}`
            })
        ]);

        console.log("💎 ATLAS CONFIRMÓ ESCRITURA. ID COMPRA:", compraGuardada._id);

        return res.status(200).json({ 
            success: true, 
            message: "Sincronizado con Atlas",
            data: materialGuardado
        });

    } catch (error) {
        console.error("🚨 ERROR CRÍTICO:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. Obtener todas las compras
const getAllPurchases = async (req, res) => {
    try {
        const purchases = await Transaction.find({ tipo: 'COMPRA' })
            .populate('materialId', 'nombre categoria')
            .populate('proveedor', 'nombre')
            .sort({ fecha: -1 }).lean();
        res.status(200).json({ success: true, data: purchases || [] });
    } catch (error) {
        res.status(500).json({ success: false, data: [] });
    }
};

// 4. Historial de un material específico
const getMaterialHistory = async (req, res) => {
    try {
        const history = await Transaction.find({ materialId: req.params.id }).sort({ fecha: -1 }).limit(20).lean();
        res.status(200).json({ success: true, data: history || [] });
    } catch (error) {
        res.status(500).json({ success: false, data: [] });
    }
};

// 5. Resumen de KPIs (Ajustado al modelo Transaction)
const getPurchasesSummary = async (req, res) => {
    try {
        const stats = await Transaction.aggregate([
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
        res.status(500).json({ success: false });
    }
};

// 6. Alertas de Stock Bajo
const getLowStockMaterials = async (req, res) => {
    try {
        const lowStock = await Material.find({ $expr: { $lt: ["$stock_actual", "$stock_minimo"] } }).limit(10).lean();
        res.status(200).json({ success: true, data: lowStock || [] });
    } catch (error) {
        res.status(500).json({ success: false, data: [] });
    }
};

// 7. Ajuste manual de stock
const manualAdjustment = async (req, res) => {
    try {
        const { materialId, nuevaCantidad, motivo } = req.body;
        const material = await Material.findById(materialId);
        if (!material) return res.status(404).json({ success: false });

        const diferencia = parseFloat(nuevaCantidad) - material.stock_actual;
        material.stock_actual = parseFloat(nuevaCantidad);
        await material.save();

        await Transaction.create({
            materialId: material._id,
            tipo: diferencia > 0 ? 'AJUSTE_MAS' : 'AJUSTE_MENOS',
            cantidad: Math.abs(diferencia),
            cantidad_m2: Math.abs(diferencia),
            motivo: motivo || 'Ajuste manual',
            fecha: new Date()
        });
        res.status(200).json({ success: true, data: { stock: material.stock_actual } });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// 8. Eliminar material
const deleteMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        if (id && id.length === 24) {
            await Material.findByIdAndDelete(id);
            await Transaction.deleteMany({ materialId: id });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
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