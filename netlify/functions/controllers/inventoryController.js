/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Controlador de Inventario - Versión 13.6.0 (ELIMINACIÓN DE IDs TEMPORALES)
 */

const mongoose = require('mongoose');
const Material = require('../models/Material');

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
}, { collection: 'purchases', timestamps: true });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

const registerPurchase = async (req, res) => {
    try {
        console.log("🚀 INICIANDO REGISTRO DE COMPRA...");
        
        let { materialId, nombre, cantidad_laminas, precio_total_lamina, proveedor } = req.body;

        // 🛡️ LIMPIEZA RADICAL DE IDs (Evita el error 'Cast to ObjectId failed')
        const limpiarId = (id) => {
            if (!id || typeof id !== 'string' || id.startsWith('TEMP-') || id.startsWith('MAT-') || id.length !== 24) {
                return null;
            }
            return id;
        };

        const mid = limpiarId(materialId);
        const pid = limpiarId(proveedor);

        let material = null;
        if (mid) material = await Material.findById(mid);
        if (!material && nombre) {
            material = await Material.findOne({ nombre: { $regex: new RegExp(`^${nombre.trim()}$`, 'i') } });
        }

        if (!material) {
            return res.status(404).json({ success: false, message: "Material no existe en Atlas" });
        }

        // LÓGICA DE NEGOCIO
        const n = material.nombre.toUpperCase();
        const esMoldura = n.includes('K ') || n.includes('MP') || n.includes('MOLDURA');
        const cant = parseFloat(cantidad_laminas) || 0;
        const precio = parseFloat(precio_total_lamina) || 0;
        let incrementoStock = 0;

        if (esMoldura) {
            incrementoStock = cant * 2.90;
        } else {
            const ancho = material.ancho_lamina_cm || 0;
            const largo = material.largo_lamina_cm || 0;
            incrementoStock = (ancho * largo / 10000) * cant;
        }

        // ACTUALIZACIÓN ATÓMICA
        material.stock_actual = (material.stock_actual || 0) + incrementoStock;
        if (precio > 0) material.precio_total_lamina = precio;

        const [mSaved, tSaved] = await Promise.all([
            material.save(),
            Transaction.create({
                materialId: material._id,
                tipo: 'COMPRA',
                cantidad: cant,
                cantidad_m2: incrementoStock,
                costo_unitario: precio,
                costo_total: precio * cant,
                proveedor: pid || material.proveedor,
                motivo: `Compra: ${material.nombre}`
            })
        ]);

        console.log("✅ GUARDADO EN ATLAS - ID COMPRA:", tSaved._id);
        res.status(200).json({ success: true, data: mSaved });

    } catch (error) {
        console.error("🚨 ERROR CRÍTICO:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ... (El resto de funciones se mantienen igual, el cambio clave está arriba)

const saveMaterial = async (req, res) => {
    try {
        let { id, nombre, categoria, tipo, stock_actual, precio_total_lamina, proveedor, ancho_lamina_cm, largo_lamina_cm } = req.body;
        
        // Limpiar ID de material para edición
        if (id && (id.startsWith('TEMP-') || id.startsWith('MAT-'))) id = null;

        const datos = {
            nombre: (nombre || "").trim().toUpperCase(),
            categoria: categoria || "Otros",
            tipo: tipo || "m2",
            stock_actual: Number(stock_actual) || 0,
            precio_total_lamina: Number(precio_total_lamina) || 0,
            ancho_lamina_cm: Number(ancho_lamina_cm) || 0,
            largo_lamina_cm: Number(largo_lamina_cm) || 0,
            proveedor: (proveedor && proveedor.length === 24) ? proveedor : undefined
        };

        let material;
        if (id && mongoose.Types.ObjectId.isValid(id)) {
            material = await Material.findByIdAndUpdate(id, { $set: datos }, { new: true });
        } else {
            material = new Material(datos);
            await material.save();
        }
        res.status(200).json({ success: true, data: material });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// (Mantenemos las demás funciones igual)
const getMaterials = async (req, res) => {
    try {
        const data = await Material.find().populate('proveedor', 'nombre').sort({ nombre: 1 }).lean();
        res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, data: [] }); }
};

const getAllPurchases = async (req, res) => {
    try {
        const data = await Transaction.find({ tipo: 'COMPRA' }).populate('materialId', 'nombre').sort({ fecha: -1 }).lean();
        res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, data: [] }); }
};

module.exports = {
    saveMaterial, createMaterial: saveMaterial, addMaterial: saveMaterial,
    getMaterials, getInventory: getMaterials,
    registerPurchase, getAllPurchases,
    getMaterialHistory: async (req, res) => {
        const data = await Transaction.find({ materialId: req.params.id }).sort({ fecha: -1 }).lean();
        res.json({ success: true, data });
    },
    getPurchasesSummary: async (req, res) => {
        const stats = await Transaction.aggregate([{ $match: { tipo: 'COMPRA' } }, { $group: { _id: null, totalInvertido: { $sum: "$costo_total" }, totalCantidad: { $sum: "$cantidad_m2" }, conteo: { $sum: 1 } } }]);
        res.json(stats[0] || { totalInvertido: 0, totalCantidad: 0, conteo: 0 });
    },
    getLowStockMaterials: async (req, res) => {
        const data = await Material.find({ $expr: { $lt: ["$stock_actual", "$stock_minimo"] } }).limit(10).lean();
        res.json({ success: true, data });
    },
    manualAdjustment: async (req, res) => {
        const { materialId, nuevaCantidad } = req.body;
        await Material.findByIdAndUpdate(materialId, { stock_actual: nuevaCantidad });
        res.json({ success: true });
    },
    deleteMaterial: async (req, res) => {
        await Material.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    }
};