/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Controlador de Inventario - Versión 12.2.6 (FIX MEDIDAS Y COSTOS)
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
 * FIX: Se añadieron campos de dimensiones para evitar el 0x0 cm.
 */
const saveMaterial = async (req, res) => {
    try {
        console.log("📥 Datos recibidos en saveMaterial:", req.body);
        const { 
            id, nombre, categoria, tipo, stock_actual, 
            precio_total_lamina, proveedor,
            ancho_lamina_cm, largo_lamina_cm 
        } = req.body;

        // --- BLINDAJE PARA ATLAS: Validación de ObjectId ---
        const esIdValido = (val) => val && mongoose.Types.ObjectId.isValid(val) && val.length === 24;
        const proveedorFinal = esIdValido(proveedor) ? proveedor : null;

        // Preparación de datos normalizados para evitar errores de tipo en MongoDB
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
            // EDITAR: Usamos findByIdAndUpdate para una escritura más directa en Atlas
            material = await Material.findByIdAndUpdate(
                id, 
                { $set: datosLimpios }, 
                { new: true, runValidators: true }
            );
            if (!material) return res.status(404).json({ success: false, message: "Material no encontrado" });
            console.log("✅ Material actualizado en Atlas");
        } else {
            // CREAR: Caso de la moldura 2311
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

// 2. Registrar compra - VERSIÓN INTELIGENTE FORZADA
const registerPurchase = async (req, res) => {
    try {
        const { 
            materialId, nombre, proveedor,      
            ancho_lamina_cm, largo_lamina_cm, 
            precio_total_lamina, cantidad_laminas,
            cantidad_m2, precio_venta_sugerido, costo_total 
        } = req.body;

        const esIdValido = (val) => val && mongoose.Types.ObjectId.isValid(val);
        
        // --- FILTRO CRÍTICO ---
        // Si el ID viene del navegador (MAT-...), lo ignoramos para que Atlas no lo rechace.
        const idParaBusqueda = (materialId && materialId.startsWith('MAT-')) ? null : materialId;

        let material;
        if (idParaBusqueda && esIdValido(idParaBusqueda)) {
            material = await Material.findById(idParaBusqueda);
        } 
        
        // Si no hay ID real, buscamos por NOMBRE (así encontraremos la MP K 2315)
        if (!material && nombre) {
            material = await Material.findOne({ 
                nombre: { $regex: new RegExp(`^${nombre.trim()}$`, 'i') } 
            });
        }

        // Normalización para cumplir el Schema de Atlas
        const ancho = Math.max(0.1, parseFloat(ancho_lamina_cm) || 0);
        const largo = Math.max(0.1, parseFloat(largo_lamina_cm) || 0);
        const precioUnitario = Math.max(0, parseFloat(precio_total_lamina) || 0);
        const cantidad = Math.max(1, parseFloat(cantidad_laminas) || 1);
        
        let incrementoStock = parseFloat(cantidad_m2) || 0;
        if (incrementoStock <= 0) {
            incrementoStock = (ancho * largo / 10000) * cantidad;
        }

        if (material) {
            material.stock_actual += incrementoStock;
            material.precio_total_lamina = precioUnitario > 0 ? precioUnitario : material.precio_total_lamina;
            if (esIdValido(proveedor)) material.proveedor = proveedor;
            await material.save();
        } else {
            // DETECCIÓN DE CATEGORÍA SEGÚN TU MODELO
            let cat = 'Otros';
            const nUpper = nombre.toUpperCase();
            if (nUpper.includes('K ') || nUpper.includes('MP') || nUpper.includes('MOLDURA')) cat = 'Moldura';

            material = new Material({
                nombre: nombre.trim().toUpperCase(),
                tipo: req.body.tipo_material || 'm2',
                categoria: cat,
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                precio_total_lamina: precioUnitario,
                stock_actual: incrementoStock,
                precio_venta_sugerido: parseFloat(precio_venta_sugerido) || 0,
                proveedor: esIdValido(proveedor) ? proveedor : undefined
            });
            await material.save();
        }

        res.status(201).json({ success: true, data: material });
    } catch (error) {
        console.error("🚨 ERROR DE ESCRITURA EN ATLAS:", error.message);
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