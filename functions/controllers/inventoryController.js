const Material = require('../models/Material');
const Provider = require('../models/Provider');
const Transaction = require('../models/Transaction');

/**
 * CONTROLADOR DE INVENTARIO - MARQUETERÍA LA CHICA MORALES
 * Gestión de existencias y trazabilidad
 */

// 1. Obtener materiales (Con nombre de proveedor)
const getMaterials = async (req, res) => {
    try {
        const materials = await Material.find()
            .populate('proveedor', 'nombre') 
            .sort({ categoria: 1, nombre: 1 })
            .lean();
        res.status(200).json({ success: true, data: materials || [] });
    } catch (error) {
        console.error("❌ Error en getMaterials:", error);
        res.status(500).json({ success: false, error: "Error al cargar materiales" });
    }
};

// 2. Registrar compra (Sincronizado con cálculos automáticos)
const registerPurchase = async (req, res) => {
    try {
        const { 
            nombre, 
            tipo, // 'm2' o 'ml'
            ancho_lamina_cm, 
            largo_lamina_cm, 
            precio_total_lamina, 
            cantidad_laminas, 
            proveedor,
            precio_venta_sugerido 
        } = req.body;

        const ancho = Math.abs(parseFloat(ancho_lamina_cm)) || 0;
        const largo = Math.abs(parseFloat(largo_lamina_cm)) || 0;
        const precioTotalUnitario = Math.abs(parseFloat(precio_total_lamina)) || 0;
        const cantidad = Math.abs(parseFloat(cantidad_laminas)) || 0;

        // Cálculos de stock según el tipo
        let incrementoStock = 0;
        if (tipo === 'ml') {
            incrementoStock = (largo / 100) * cantidad; // Convertimos cm a metros lineales totales
        } else {
            const areaM2Unitario = (ancho * largo) / 10000;
            incrementoStock = areaM2Unitario * cantidad; // m2 totales
        }

        const nombreLimpio = nombre ? nombre.trim() : "Material Sin Nombre";
        const nombreBusqueda = nombreLimpio.toLowerCase();

        // Categorización automática mejorada
        let categoria = 'Otros';
        const reglas = [
            { regex: /vidrio|espejo/i, cat: 'Vidrio' },
            { regex: /mdf|triplex|respaldo|madera/i, cat: 'Respaldo' },
            { regex: /paspartu|passepartout|carton/i, cat: 'Paspartu' },
            { regex: /foam|icopor/i, cat: 'Foam' },
            { regex: /tela|lona|lienzo/i, cat: 'Tela' },
            { regex: /marco|moldura/i, cat: 'Moldura' }
        ];
        
        const reglaEncontrada = reglas.find(r => r.regex.test(nombreBusqueda));
        if (reglaEncontrada) categoria = reglaEncontrada.cat;

        let material = await Material.findOne({ 
            nombre: { $regex: new RegExp(`^${nombreLimpio}$`, 'i') } 
        });

        if (material) {
            material.stock_actual += incrementoStock;
            material.precio_total_lamina = precioTotalUnitario;
            material.ancho_lamina_cm = ancho;
            material.largo_lamina_cm = largo;
            material.tipo = tipo || material.tipo;
            material.categoria = categoria; 
            material.precio_venta_sugerido = precio_venta_sugerido || material.precio_venta_sugerido;
            material.proveedor = (proveedor && proveedor !== "") ? proveedor : material.proveedor;
            await material.save();
        } else {
            material = new Material({
                nombre: nombreLimpio,
                tipo: tipo || 'm2',
                categoria,
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                precio_total_lamina: precioTotalUnitario,
                stock_actual: incrementoStock,
                precio_venta_sugerido: precio_venta_sugerido || 0,
                proveedor: (proveedor && proveedor !== "") ? proveedor : null
            });
            await material.save();
        }

        // Registrar transacción para el historial
        if (Transaction) {
            await Transaction.create({
                materialId: material._id,
                tipo: 'COMPRA',
                cantidad_m2: incrementoStock,
                precio_m2_costo: material.precio_m2_costo, 
                costo_total: precioTotalUnitario * cantidad,
                proveedor: (proveedor && proveedor !== "") ? proveedor : null,
                motivo: `Compra de ${cantidad} unidades (${tipo === 'ml' ? largo + 'cm' : ancho + 'x' + largo + 'cm'})`,
                fecha: new Date()
            });
        }

        res.status(201).json({ success: true, data: material });
    } catch (error) {
        console.error("🚨 Error en registerPurchase:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. Obtener todas las compras (Historial)
const getAllPurchases = async (req, res) => {
    try {
        const purchases = await Transaction.find({ tipo: 'COMPRA' })
            .populate({ path: 'materialId', select: 'nombre categoria' })
            .populate({ path: 'proveedor', select: 'nombre' })
            .sort({ fecha: -1 })
            .lean();

        res.status(200).json({ success: true, data: purchases || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al cargar historial" });
    }
};

// 4. Resumen de KPIs
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

        const data = stats[0] || { totalInvertido: 0, totalCantidad: 0, conteo: 0 };
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en KPIs" });
    }
};

// 5. Alertas de Stock Bajo
const getLowStockMaterials = async (req, res) => {
    try {
        const lowStock = await Material.find({ 
            $expr: { $lt: ["$stock_actual", "$stock_minimo"] } 
        }).limit(10).lean();
        res.status(200).json({ success: true, data: lowStock || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en alertas" });
    }
};

// 6. Ajuste manual de stock
const manualAdjustment = async (req, res) => {
    try {
        const { materialId, nuevaCantidad, stock_minimo, motivo } = req.body;
        const material = await Material.findById(materialId);
        if (!material) return res.status(404).json({ success: false, message: "Material no encontrado" });

        const diferencia = parseFloat(nuevaCantidad) - material.stock_actual;
        material.stock_actual = parseFloat(nuevaCantidad);
        if (stock_minimo) material.stock_minimo = parseFloat(stock_minimo);
        
        await material.save();

        await Transaction.create({
            materialId: material._id,
            tipo: diferencia > 0 ? 'AJUSTE_MAS' : 'AJUSTE_MENOS',
            cantidad_m2: Math.abs(diferencia),
            motivo: motivo || 'Ajuste manual',
            fecha: new Date()
        });

        res.status(200).json({ success: true, stock: material.stock_actual });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en ajuste" });
    }
};

// 7. Eliminar material
const deleteMaterial = async (req, res) => {
    try {
        await Material.findByIdAndDelete(req.params.id);
        if (Transaction) await Transaction.deleteMany({ materialId: req.params.id });
        res.status(200).json({ success: true, message: "Material eliminado" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al eliminar" });
    }
};

// EXPORTACIÓN FINAL (Mantenemos nombres originales y agregamos alias para evitar errores de ruta)
module.exports = {
    getMaterials,
    getInventory: getMaterials, // Alias de seguridad
    registerPurchase,
    getAllPurchases,
    getPurchasesSummary,
    getLowStockMaterials,
    manualAdjustment,
    adjustStock: manualAdjustment, // Alias de seguridad
    deleteMaterial
};