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
        console.log("🚀 INICIANDO REGISTRO DE COMPRA CON CÁLCULO DE COSTO REAL...");
        let { materialId, nombre, cantidad_laminas, precio_total_lamina, proveedor } = req.body;

        const limpiarId = (id) => {
            if (!id || typeof id !== 'string' || id.startsWith('TEMP-') || id.startsWith('MAT-') || id.length !== 24) return null;
            return id;
        };

        let mid = limpiarId(materialId);
        let material = null;

        // --- LÓGICA IDENTIDAD ÚNICA (Mantenida) ---
        if (mid) material = await Material.findById(mid);
        
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

        // --- CÁLCULOS (INTEGRIDAD PRESERVADA) ---
        const n = material.nombre.toUpperCase();
        const esMoldura = n.includes('K ') || n.includes('MP') || n.includes('MOLDURA');
        const cant = parseFloat(cantidad_laminas) || 0;
        const precioPagado = parseFloat(precio_total_lamina) || 0;
        
        let incrementoStock = 0;
        let costoCalculadoUnidad = 0;

        if (esMoldura) {
            incrementoStock = cant * 2.90;
            costoCalculadoUnidad = precioPagado / 2.90;
        } else {
            // REVISIÓN CRÍTICA: Aseguramos que tome las medidas del material de la base de datos
            const ancho = parseFloat(material.ancho_lamina_cm) || 0;
            const largo = parseFloat(material.largo_lamina_cm) || 0;
            const areaM2PorLamina = (ancho * largo) / 10000;
            
            incrementoStock = areaM2PorLamina * cant;
            
            // CORRECCIÓN: Si hay área, dividimos. Si no (ej. insumos por unidad), usamos el precio pagado.
            costoCalculadoUnidad = areaM2PorLamina > 0 ? (precioPagado / areaM2PorLamina) : precioPagado;
        }

        // --- PERSISTENCIA REAL EN ATLAS ---
        material.stock_actual = (material.stock_actual || 0) + incrementoStock;
        
        // Mantenemos el historial de precio por lámina
        if (precioPagado > 0) material.precio_total_lamina = precioPagado;

        // 🔥 SINCRONIZACIÓN TOTAL: Actualizamos AMBOS campos para evitar errores de lectura
        // Esto garantiza que el cotizador vea el precio por M2 (41.193)
        material.costo_base = costoCalculadoUnidad;
        material.costo_unitario = costoCalculadoUnidad; 

        const mSaved = await material.save();
        
        await Transaction.create({
            materialId: material._id,
            tipo: 'COMPRA',
            cantidad: cant,
            cantidad_m2: incrementoStock,
            costo_unitario: precioPagado, 
            costo_total: precioPagado * cant,
            proveedor: limpiarId(proveedor) || material.proveedor,
            motivo: `Compra: ${material.nombre} (Costo M2/ML calculado: $${costoCalculadoUnidad.toFixed(2)})`
        });

        console.log(`✅ DATOS ANCLADOS: Costo unidad calculado en $${costoCalculadoUnidad.toFixed(2)}`);
        res.status(200).json({ success: true, data: mSaved });

    } catch (error) {
        console.error("🚨 ERROR CRÍTICO:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ⚠️ FUNCIÓN TEMPORAL DE LIMPIEZA - USAR UNA SOLA VEZ
const clearDuplicateChapilla = async (req, res) => {
    try {
        const nombreABorrar = "CHAPILLA AFRICANA"; // O el nombre exacto que te aparece
        const resultado = await Material.deleteMany({ 
            nombre: { $regex: new RegExp(`^${nombreABorrar}$`, 'i') } 
        });
        
        console.log(`🧹 Limpieza completada: ${resultado.deletedCount} registros borrados.`);
        res.status(200).json({ 
            success: true, 
            message: `Se borraron ${resultado.deletedCount} registros de ${nombreABorrar}. Ya puedes crear uno nuevo.` 
        });
    } catch (error) {
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
        // 1. Obtenemos los datos de Atlas tal cual (Tu lógica original intacta)
        const materiales = await Material.find()
            .populate('proveedor', 'nombre')
            .sort({ nombre: 1 })
            .lean();
        
        // 2. UNIFICACIÓN DE IDENTIDAD: Juntamos lo que se llame igual
        const mapaUnificado = {};

        materiales.forEach(m => {
            // Normalizamos para que "CHAPILLA" y "Chapilla" sean detectados como lo mismo
            const nombreNorm = (m.nombre || "").trim().toUpperCase();

            if (!mapaUnificado[nombreNorm]) {
                // Si es el primero con este nombre, lo guardamos como base
                mapaUnificado[nombreNorm] = { ...m };
            } else {
                // SI YA EXISTE (Duplicado): Sumamos el stock al registro base
                // Así verás UNA SOLA FILA con la suma de los metros cuadrados
                mapaUnificado[nombreNorm].stock_actual = (mapaUnificado[nombreNorm].stock_actual || 0) + (m.stock_actual || 0);
                
                // Si el duplicado tiene las medidas (ancho/largo) y el base no, las rescatamos
                if (m.ancho_lamina_cm > 0 && !mapaUnificado[nombreNorm].ancho_lamina_cm) {
                    mapaUnificado[nombreNorm].ancho_lamina_cm = m.ancho_lamina_cm;
                    mapaUnificado[nombreNorm].largo_lamina_cm = m.largo_lamina_cm;
                }
            }
        });

        // Convertimos el mapa de nuevo a la lista que espera tu Dashboard
        const dataFinal = Object.values(mapaUnificado);

        res.status(200).json({ success: true, data: dataFinal });
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