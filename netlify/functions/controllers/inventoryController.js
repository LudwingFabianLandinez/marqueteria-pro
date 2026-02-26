/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Controlador de Inventario - Versión 13.5.0 (Veredicto Final Atlas)
 */

const mongoose = require('mongoose');
const Material = require('../models/Material');
const Provider = require('../models/Provider');

// 1. ESQUEMA ESTÁTICO DE SEGURIDAD (Obliga a Atlas a reconocer la colección)
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
    collection: 'purchases', // No negociable
    timestamps: true 
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

/**
 * 🚀 registerPurchase: El motor de persistencia total
 */
const registerPurchase = async (req, res) => {
    try {
        console.log("------------------------------------------");
        console.log("🛰️ OPERACIÓN DE COMPRA - INICIO FORZADO");

        // ASEGURAR CONEXIÓN (Netlify a veces pierde el túnel a Atlas)
        if (mongoose.connection.readyState !== 1) {
            console.log("🔄 Reconectando a MongoDB Atlas...");
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000
            });
        }

        const { 
            nombre, proveedor, ancho_lamina_cm, largo_lamina_cm, 
            precio_total_lamina, cantidad_laminas, precio_venta_sugerido,
            materialId 
        } = req.body;

        // Limpieza estricta de IDs
        const esIdInvalido = !materialId || String(materialId).length !== 24 || String(materialId).includes('-');
        let material = null;

        if (!esIdInvalido) {
            material = await Material.findById(materialId);
        }
        
        if (!material && nombre) {
            material = await Material.findOne({ nombre: { $regex: new RegExp(`^${nombre.trim()}$`, 'i') } });
        }

        if (!material) throw new Error("Material no encontrado en la base de datos");

        // LÓGICA DE CÁLCULO (Molduras vs Láminas)
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

        // ACTUALIZACIÓN DE DOCUMENTOS
        material.stock_actual = (Number(material.stock_actual) || 0) + incrementoStock;
        if (precioUnitario > 0) material.precio_total_lamina = precioUnitario;

        // 🔥 TRIPLE CANDADO DE PERSISTENCIA (Promise.all + writeConcern)
        // Esto obliga a Atlas a responder "Recibido" antes de que la función se cierre
        const [mSaved, tSaved] = await Promise.all([
            material.save(),
            Transaction.create([{
                materialId: material._id,
                tipo: 'COMPRA',
                cantidad: cant,
                cantidad_m2: incrementoStock,
                costo_unitario: precioUnitario,
                costo_total: precioUnitario * cant,
                proveedor: material.proveedor || (mongoose.Types.ObjectId.isValid(proveedor) ? proveedor : null),
                fecha: new Date(),
                motivo: `Compra: ${nombre}`
            }], { writeConcern: { w: 'majority' } })
        ]);

        console.log("✅ ATLAS: Material y Compra guardados con éxito.");
        console.log("🆔 ID Compra registrada:", tSaved[0]._id);

        return res.status(200).json({ 
            success: true, 
            message: "Sincronizado con Atlas",
            data: mSaved
        });

    } catch (error) {
        console.error("🚨 FALLO TOTAL EN COMPRA:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 🛠 saveMaterial: Guardado y edición de materiales
 */
const saveMaterial = async (req, res) => {
    try {
        const { id, nombre, categoria, tipo, stock_actual, precio_total_lamina, proveedor, ancho_lamina_cm, largo_lamina_cm } = req.body;
        const esIdValido = (val) => val && mongoose.Types.ObjectId.isValid(val) && val.length === 24;

        const datos = {
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

// --- FUNCIONES DE CONSULTA (Mantenidas) ---

const getMaterials = async (req, res) => {
    try {
        const data = await Material.find().populate('proveedor', 'nombre').sort({ nombre: 1 }).lean();
        res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, data: [] }); }
};

const getAllPurchases = async (req, res) => {
    try {
        const data = await Transaction.find({ tipo: 'COMPRA' })
            .populate('materialId', 'nombre categoria')
            .populate('proveedor', 'nombre')
            .sort({ fecha: -1 }).lean();
        res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, data: [] }); }
};

const getMaterialHistory = async (req, res) => {
    try {
        const data = await Transaction.find({ materialId: req.params.id }).sort({ fecha: -1 }).limit(20).lean();
        res.status(200).json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false, data: [] }); }
};

const getPurchasesSummary = async (req, res) => {
    try {
        const stats = await Transaction.aggregate([
            { $match: { tipo: 'COMPRA' } },
            { $group: { _id: null, totalInvertido: { $sum: "$costo_total" }, totalCantidad: { $sum: "$cantidad_m2" }, conteo: { $sum: 1 } } }
        ]);
        res.json(stats[0] || { totalInvertido: 0, totalCantidad: 0, conteo: 0 });
    } catch (error) { res.status(500).json({ success: false }); }
};

const getLowStockMaterials = async (req, res) => {
    try {
        const data = await Material.find({ $expr: { $lt: ["$stock_actual", "$stock_minimo"] } }).limit(10).lean();
        res.json({ success: true, data });
    } catch (error) { res.status(500).json({ success: false }); }
};

const manualAdjustment = async (req, res) => {
    try {
        const { materialId, nuevaCantidad, motivo } = req.body;
        const material = await Material.findById(materialId);
        if (!material) return res.status(404).json({ success: false });
        const diferencia = nuevaCantidad - material.stock_actual;
        material.stock_actual = nuevaCantidad;
        await material.save();
        await Transaction.create({ materialId, tipo: diferencia > 0 ? 'AJUSTE_MAS' : 'AJUSTE_MENOS', cantidad: Math.abs(diferencia), cantidad_m2: Math.abs(diferencia), motivo: motivo || 'Ajuste manual' });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
};

const deleteMaterial = async (req, res) => {
    try {
        await Material.findByIdAndDelete(req.params.id);
        await Transaction.deleteMany({ materialId: req.params.id });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
};

module.exports = {
    saveMaterial, createMaterial: saveMaterial, addMaterial: saveMaterial,
    getMaterials, getInventory: getMaterials,
    getMaterialHistory, registerPurchase, getAllPurchases,
    getPurchasesSummary, getLowStockMaterials,
    manualAdjustment, adjustStock: manualAdjustment,
    deleteMaterial
};