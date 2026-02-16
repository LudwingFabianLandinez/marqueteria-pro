/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Controlador de Inventario - Versión 12.2.3 (FIX BUILD & SINCRO TOTAL)
 */

const mongoose = require('mongoose');

// Carga segura de modelos
const Material = require('../models/Material');
const Provider = require('../models/Provider');

// Función interna para obtener el modelo de transacción de forma dinámica
// Esto evita que el build de Netlify falle por rutas de archivos inconsistentes
const getTransactionModel = () => {
    return mongoose.models.Transaction || mongoose.models.Transaccion;
};

/**
 * 🚀 saveMaterial: Maneja la creación y edición de materiales
 */
const saveMaterial = async (req, res) => {
    try {
        const { id, nombre, categoria, tipo, stock_actual, precio_total_lamina, proveedor } = req.body;

        let material;
        if (id && mongoose.Types.ObjectId.isValid(id)) {
            material = await Material.findById(id);
            if (!material) return res.status(404).json({ success: false, message: "Material no encontrado" });

            material.nombre = nombre || material.nombre;
            material.categoria = categoria || material.categoria;
            material.tipo = tipo || material.tipo;
            material.stock_actual = stock_actual !== undefined ? parseFloat(stock_actual) : material.stock_actual;
            material.precio_total_lamina = precio_total_lamina !== undefined ? parseFloat(precio_total_lamina) : material.precio_total_lamina;
            material.proveedor = (proveedor && mongoose.Types.ObjectId.isValid(proveedor)) ? proveedor : material.proveedor;
            
            await material.save();
        } else {
            material = new Material({
                nombre: nombre || "Nuevo Material",
                categoria: categoria || "Otros",
                tipo: tipo || "m2",
                stock_actual: parseFloat(stock_actual) || 0,
                precio_total_lamina: parseFloat(precio_total_lamina) || 0,
                proveedor: (proveedor && mongoose.Types.ObjectId.isValid(proveedor)) ? proveedor : null
            });
            await material.save();
        }

        res.status(200).json({ success: true, data: material });
    } catch (error) {
        console.error("🚨 Error en saveMaterial:", error);
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

// 2. Registrar compra - VERSIÓN INTELIGENTE
const registerPurchase = async (req, res) => {
    try {
        const { 
            materialId, proveedorId, 
            nombre, proveedor,      
            ancho_lamina_cm, largo_lamina_cm, 
            precio_total_lamina, cantidad_laminas,
            cantidad_m2, 
            precio_venta_sugerido,
            precio_total,
            costo_total 
        } = req.body;

        let material;
        if (materialId && mongoose.Types.ObjectId.isValid(materialId)) {
            material = await Material.findById(materialId);
        } else if (nombre) {
            const nombreLimpio = nombre.trim();
            material = await Material.findOne({ 
                nombre: { $regex: new RegExp(`^${nombreLimpio}$`, 'i') } 
            });
        }

        const ancho = Math.abs(parseFloat(ancho_lamina_cm)) || (material ? material.ancho_lamina_cm : 0);
        const largo = Math.abs(parseFloat(largo_lamina_cm)) || (material ? material.largo_lamina_cm : 0);
        const cantidad = Math.abs(parseFloat(cantidad_laminas)) || 1;
        
        let incrementoStock = parseFloat(cantidad_m2) || 0;
        if (incrementoStock <= 0) {
            const tipoMaterial = (req.body.tipo_material === 'ml' || (material && material.tipo === 'ml')) ? 'ml' : 'm2';
            incrementoStock = (tipoMaterial === 'ml') ? (largo / 100) * cantidad : ((ancho * largo) / 10000) * cantidad;
        }

        const precioTotalUnitario = Math.abs(parseFloat(precio_total_lamina)) || 0;
        const idProvFinal = proveedor || proveedorId;
        let proveedorValido = (idProvFinal && mongoose.Types.ObjectId.isValid(idProvFinal)) ? idProvFinal : null;

        if (material) {
            material.stock_actual += incrementoStock;
            material.precio_total_lamina = precioTotalUnitario > 0 ? precioTotalUnitario : material.precio_total_lamina;
            material.ancho_lamina_cm = ancho > 0 ? ancho : material.ancho_lamina_cm;
            material.largo_lamina_cm = largo > 0 ? largo : material.largo_lamina_cm;
            material.precio_venta_sugerido = precio_venta_sugerido || material.precio_venta_sugerido;
            material.proveedor = proveedorValido || material.proveedor;
            await material.save();
        } else {
            material = new Material({
                nombre: nombre ? nombre.trim() : "Material Nuevo",
                tipo: (req.body.tipo_material || 'm2'),
                categoria: 'Otros',
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                precio_total_lamina: precioTotalUnitario,
                stock_actual: incrementoStock,
                precio_venta_sugerido: precio_venta_sugerido || 0,
                proveedor: proveedorValido
            });
            await material.save();
        }

        const TransactionModel = getTransactionModel();
        if (TransactionModel) {
            await TransactionModel.create({
                materialId: material._id,
                tipo: 'COMPRA',
                cantidad: incrementoStock,
                cantidad_m2: incrementoStock,
                costo_total: costo_total || precio_total || (precioTotalUnitario * cantidad),
                proveedor: proveedorValido,
                motivo: `Ingreso de ${incrementoStock.toFixed(2)} unidades/m2`,
                fecha: new Date()
            });
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
        await Material.findByIdAndDelete(req.params.id);
        const TransactionModel = getTransactionModel();
        if (TransactionModel) await TransactionModel.deleteMany({ materialId: req.params.id });
        res.status(200).json({ success: true, message: "Material eliminado" });
    } catch (error) {
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