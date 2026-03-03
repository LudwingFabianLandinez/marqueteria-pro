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

        const limpiarId = (id) => {
            if (!id || typeof id !== 'string' || id.startsWith('TEMP-') || id.startsWith('MAT-') || id.length !== 24) return null;
            return id;
        };

        let mid = limpiarId(materialId);
        let material = null;

        // --- LÓGICA IDENTIDAD ÚNICA (Igual al Foam Board) ---
        // 1. Intentamos por ID
        if (mid) material = await Material.findById(mid);
        
        // 2. Si no hay material, buscamos por NOMBRE (Obligatorio)
        if (!material && nombre) {
            const nombreBusqueda = nombre.trim().toUpperCase();
            material = await Material.findOne({ nombre: nombreBusqueda });
            if (material) {
                console.log(`🎯 Vinculación Exitosa: Usando material existente [${material._id}]`);
            }
        }

        if (!material) {
            return res.status(404).json({ success: false, message: "El material no existe. Créelo en el Maestro primero." });
        }

        // --- CÁLCULOS (INTACTOS) ---
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

        // --- PERSISTENCIA REAL EN ATLAS ---
        material.stock_actual = (material.stock_actual || 0) + incrementoStock;
        if (precio > 0) material.precio_total_lamina = precio;

        // Guardamos y esperamos confirmación real de MongoDB
        const mSaved = await material.save();
        
        await Transaction.create({
            materialId: material._id,
            tipo: 'COMPRA',
            cantidad: cant,
            cantidad_m2: incrementoStock,
            costo_unitario: precio,
            costo_total: precio * cant,
            proveedor: limpiarId(proveedor) || material.proveedor,
            motivo: `Compra: ${material.nombre}`
        });

        console.log("✅ DATOS ANCLADOS EN ATLAS CORRECTAMENTE");
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
        
        // 1. Normalización: "Chapilla", "CHAPILLA", " chapilla" -> Todo será "CHAPILLA"
        const nombreNorm = (nombre || "").trim().toUpperCase();

        // 🛡️ LIMPIEZA DE IDs (Tu lógica original para no romper nada)
        if (id && (id.startsWith('TEMP-') || id.startsWith('MAT-'))) id = null;

        // 🎯 EL AJUSTE MAESTRO: 
        // Si no hay ID de Atlas, buscamos por NOMBRE. 
        // Si existe una "Chapilla" (ya sea General o Acabado), tomamos SU ID.
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            const materialExistente = await Material.findOne({ 
                nombre: { $regex: new RegExp(`^${nombreNorm}$`, 'i') } 
            });
            
            if (materialExistente) {
                id = materialExistente._id; // <--- AQUÍ AJUSTAMOS A UNA SOLA
                console.log(`♻️ Unificando "${nombreNorm}" en el ID existente: ${id}`);
            }
        }

        const datos = {
            nombre: nombreNorm,
            categoria: categoria || "GENERAL", // Estandarizamos
            tipo: tipo || "m2",
            stock_actual: Number(stock_actual) || 0,
            precio_total_lamina: Number(precio_total_lamina) || 0,
            ancho_lamina_cm: Number(ancho_lamina_cm) || 0,
            largo_lamina_cm: Number(largo_lamina_cm) || 0,
            proveedor: (proveedor && proveedor.length === 24) ? proveedor : undefined
        };

        let material;
        // 2. Si encontramos el ID arriba, se ACTUALIZA la existente. Si no, se CREA.
        if (id && mongoose.Types.ObjectId.isValid(id)) {
            material = await Material.findByIdAndUpdate(id, { $set: datos }, { new: true });
        } else {
            material = new Material(datos);
            await material.save();
        }

        res.status(200).json({ success: true, data: material });
    } catch (error) {
        console.error("🚨 Error en saveMaterial:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// (Mantenemos las demás funciones igual)
const getMaterials = async (req, res) => {
    try {
        // Traemos los datos tal cual están en Atlas (Tu lógica original)
        const materiales = await Material.find().populate('proveedor', 'nombre').sort({ nombre: 1 }).lean();
        
        // --- PROCESO DE UNIFICACIÓN (Solo para la vista del Dashboard) ---
        const mapaUnificado = {};

        materiales.forEach(m => {
            // Normalizamos el nombre para agrupar (ej: "CHAPILLA")
            const nombreKey = (m.nombre || "").trim().toUpperCase();

            if (!mapaUnificado[nombreKey]) {
                // Si es el primero con ese nombre, lo tomamos como base
                mapaUnificado[nombreKey] = { ...m };
            } else {
                // Si ya existe uno igual, SUMAMOS el stock al registro base
                // Esto hace que las dos chapillas se vean como una sola con stock total
                mapaUnificado[nombreKey].stock_actual = (mapaUnificado[nombreKey].stock_actual || 0) + (m.stock_actual || 0);
                
                // Si el duplicado tiene un ID real de Atlas y el base no, preferimos el real
                if (m._id && !mapaUnificado[nombreKey]._id.toString().includes('TEMP')) {
                    // Mantenemos la referencia del objeto más completo
                }
            }
        });

        // Convertimos el mapa de nuevo a una lista para el Dashboard
        const dataUnificada = Object.values(mapaUnificado);

        res.status(200).json({ success: true, data: dataUnificada });
    } catch (error) { 
        console.error("Error en getMaterials:", error.message);
        res.status(500).json({ success: false, data: [] }); 
    }
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