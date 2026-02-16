const mongoose = require('mongoose');

// Carga segura de modelos
const Material = require('../models/Material');
const Provider = require('../models/Provider');
let Transaction;
try {
    Transaction = require('../models/Transaction');
} catch (e) {
    console.error("⚠️ Modelo Transaction no encontrado");
}

/**
 * CONTROLADOR DE INVENTARIO - MARQUETERÍA LA CHICA MORALES
 */

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

// 2. Registrar compra - VERSIÓN INTELIGENTE (ID + NOMBRE + BLINDAJE)
const registerPurchase = async (req, res) => {
    try {
        const { 
            materialId, proveedorId, // Datos del dashboard nuevo
            nombre, proveedor,       // Datos del sistema anterior/manual
            ancho_lamina_cm, largo_lamina_cm, 
            precio_total_lamina, cantidad_laminas,
            precio_venta_sugerido 
        } = req.body;

        // --- PASO 1: LOCALIZAR EL MATERIAL ---
        let material;
        if (materialId && mongoose.Types.ObjectId.isValid(materialId)) {
            material = await Material.findById(materialId);
        } else if (nombre) {
            const nombreLimpio = nombre.trim();
            material = await Material.findOne({ 
                nombre: { $regex: new RegExp(`^${nombreLimpio}$`, 'i') } 
            });
        }

        // --- PASO 2: NORMALIZAR DATOS TÉCNICOS ---
        const ancho = Math.abs(parseFloat(ancho_lamina_cm)) || (material ? material.ancho_lamina_cm : 0);
        const largo = Math.abs(parseFloat(largo_lamina_cm)) || (material ? material.largo_lamina_cm : 0);
        const precioTotalUnitario = Math.abs(parseFloat(precio_total_lamina)) || 0;
        const cantidad = Math.abs(parseFloat(cantidad_laminas)) || 1;

        // Forzamos tipo ml o m2
        const tipoMaterial = (req.body.tipo_material === 'ml' || req.body.tipo === 'ml' || (material && material.tipo === 'ml')) ? 'ml' : 'm2';

        // Cálculo de incremento
        let incrementoStock = 0;
        if (tipoMaterial === 'ml') {
            incrementoStock = (largo / 100) * cantidad;
        } else {
            const areaM2Unitario = (ancho * largo) / 10000;
            incrementoStock = areaM2Unitario * cantidad;
        }

        // --- PASO 3: PROVEEDOR Y CATEGORÍA ---
        const idProvFinal = proveedorId || proveedor;
        let proveedorValido = (idProvFinal && mongoose.Types.ObjectId.isValid(idProvFinal)) ? idProvFinal : null;

        let categoria = material ? material.categoria : 'Otros';
        if (!material && nombre) {
            const reglas = [
                { regex: /vidrio|espejo/i, cat: 'Vidrio' },
                { regex: /mdf|triplex|respaldo|madera/i, cat: 'Respaldo' },
                { regex: /paspartu|passepartout|carton/i, cat: 'Paspartu' },
                { regex: /foam|icopor/i, cat: 'Foam' },
                { regex: /tela|lona|lienzo/i, cat: 'Tela' },
                { regex: /marco|moldura/i, cat: 'Moldura' }
            ];
            const reglaEncontrada = reglas.find(r => r.regex.test(nombre));
            if (reglaEncontrada) categoria = reglaEncontrada.cat;
        }

        // --- PASO 4: GUARDADO DE MATERIAL ---
        if (material) {
            material.stock_actual += incrementoStock;
            material.precio_total_lamina = precioTotalUnitario > 0 ? precioTotalUnitario : material.precio_total_lamina;
            material.ancho_lamina_cm = ancho;
            material.largo_lamina_cm = largo;
            material.tipo = tipoMaterial;
            material.precio_venta_sugerido = precio_venta_sugerido || material.precio_venta_sugerido;
            material.proveedor = proveedorValido || material.proveedor;
            await material.save();
        } else {
            material = new Material({
                nombre: nombre ? nombre.trim() : "Material Nuevo",
                tipo: tipoMaterial,
                categoria,
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                precio_total_lamina: precioTotalUnitario,
                stock_actual: incrementoStock,
                precio_venta_sugerido: precio_venta_sugerido || 0,
                proveedor: proveedorValido
            });
            await material.save();
        }

        // --- PASO 5: REGISTRO DE TRANSACCIÓN ---
        if (Transaction) {
            try {
                await Transaction.create({
                    materialId: material._id,
                    tipo: 'COMPRA', // Blindado por el Enum del modelo
                    cantidad: incrementoStock,
                    cantidad_m2: incrementoStock,
                    costo_total: precioTotalUnitario * cantidad,
                    proveedor: proveedorValido,
                    motivo: `Compra de ${cantidad} unidades registrada`,
                    fecha: new Date()
                });
            } catch (transError) {
                console.error("⚠️ Error en Historial:", transError.message);
            }
        }

        res.status(201).json({ success: true, data: material });
    } catch (error) {
        console.error("🚨 Error en registerPurchase:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. Obtener todas las compras
const getAllPurchases = async (req, res) => {
    try {
        if (!Transaction) return res.status(200).json({ success: true, data: [] });
        const purchases = await Transaction.find({ tipo: 'COMPRA' })
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
        if (!Transaction) return res.status(200).json({ success: true, data: [] });
        const history = await Transaction.find({ materialId: id })
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
        if (!Transaction) return res.json({ totalInvertido: 0, totalCantidad: 0, conteo: 0 });
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

        if (Transaction) {
            await Transaction.create({
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
        await Material.findByIdAndDelete(req.params.id);
        if (Transaction) await Transaction.deleteMany({ materialId: req.params.id });
        res.status(200).json({ success: true, message: "Material eliminado" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al eliminar" });
    }
};

module.exports = {
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