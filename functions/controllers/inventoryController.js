const Material = require('../models/Material');
const Transaction = require('../models/Transaction');
const Supplier = require('../models/Supplier');

/**
 * CONTROLADOR DE INVENTARIO - MARQUETERÍA LA CHICA MORALES
 * Gestión de existencias y trazabilidad [cite: 2026-02-05]
 */

// 1. Obtener materiales (Ordenados alfabéticamente)
exports.getMaterials = async (req, res) => {
    try {
        const materials = await Material.find().sort({ nombre: 1 }).lean();
        res.status(200).json({ success: true, data: materials || [] });
    } catch (error) {
        console.error("❌ Error en getMaterials:", error);
        res.status(500).json({ success: false, error: "Error al cargar materiales" });
    }
};

// 2. Registrar compra (Cálculos automáticos y trazabilidad)
exports.registerPurchase = async (req, res) => {
    try {
        const { nombre, ancho_lamina_cm, largo_lamina_cm, precio_total_lamina, cantidad_laminas, proveedorId } = req.body;

        // Normalización de números para evitar NaN en la DB [cite: 2026-02-05]
        const ancho = Math.abs(parseFloat(ancho_lamina_cm)) || 0;
        const largo = Math.abs(parseFloat(largo_lamina_cm)) || 0;
        const precioTotalUnitario = Math.abs(parseFloat(precio_total_lamina)) || 0;
        const cantidad = Math.abs(parseFloat(cantidad_laminas)) || 0;

        // Cálculos de área y costos [cite: 2026-02-05]
        const areaM2Unitario = (ancho * largo) / 10000;
        const areaM2Total = areaM2Unitario * cantidad;
        const costoM2 = areaM2Unitario > 0 ? (precioTotalUnitario / areaM2Unitario) : 0;
        const inversionTotalCompra = precioTotalUnitario * cantidad;

        const nombreLimpio = nombre ? nombre.trim() : "Material Sin Nombre";
        const nombreBusqueda = nombreLimpio.toLowerCase();

        // Categorización automática inteligente mejorada
        let categoria = 'Otros';
        const reglas = [
            { regex: /vidrio|espejo/i, cat: 'Vidrio' },
            { regex: /mdf|triplex|respaldo|madera/i, cat: 'Respaldo' },
            { regex: /paspartu|passepartout|carton/i, cat: 'Paspartu' },
            { regex: /foam|icopor/i, cat: 'Foam' },
            { regex: /tela|lona|lienzo/i, cat: 'Tela' },
            { regex: /marco|moldura|madera/i, cat: 'Marco' }
        ];
        
        const reglaEncontrada = reglas.find(r => r.regex.test(nombreBusqueda));
        if (reglaEncontrada) categoria = reglaEncontrada.cat;

        // Buscar o crear material (Case Insensitive)
        let material = await Material.findOne({ 
            nombre: { $regex: new RegExp(`^${nombreLimpio}$`, 'i') } 
        });

        if (material) {
            material.stock_actual_m2 += areaM2Total;
            material.precio_total_lamina = precioTotalUnitario;
            material.precio_m2_costo = costoM2; 
            material.ancho_lamina_cm = ancho;
            material.largo_lamina_cm = largo;
            material.categoria = categoria; 
            await material.save();
        } else {
            material = new Material({
                nombre: nombreLimpio,
                categoria,
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                precio_total_lamina: precioTotalUnitario,
                precio_m2_costo: costoM2,
                stock_actual_m2: areaM2Total,
                proveedor: (proveedorId && proveedorId !== "") ? proveedorId : null
            });
            await material.save();
        }

        // Registrar transacción para el historial
        const trans = new Transaction({
            materialId: material._id,
            tipo: 'COMPRA',
            cantidad_m2: areaM2Total,
            costo_unitario_m2: costoM2, 
            costo_total: inversionTotalCompra,
            proveedorId: (proveedorId && proveedorId !== "") ? proveedorId : null,
            motivo: `Compra de ${cantidad} láminas (${ancho}x${largo}cm)`,
            fecha: new Date()
        });
        await trans.save();

        res.status(201).json({ success: true, data: material });
    } catch (error) {
        console.error("🚨 Error en registerPurchase:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. Obtener todas las compras (Para la tabla de historial)
exports.getAllPurchases = async (req, res) => {
    try {
        const purchases = await Transaction.find({ tipo: 'COMPRA' })
            .populate({ path: 'materialId', select: 'nombre categoria' })
            .populate({ path: 'proveedorId', select: 'nombre' })
            .sort({ fecha: -1 })
            .lean();

        res.status(200).json({ success: true, data: purchases || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al cargar historial" });
    }
};

// 4. Resumen de KPIs (Para las tarjetas del Dashboard)
exports.getPurchasesSummary = async (req, res) => {
    try {
        const stats = await Transaction.aggregate([
            { $match: { tipo: 'COMPRA' } },
            { $group: {
                _id: null,
                totalInvertido: { $sum: "$costo_total" },
                totalM2: { $sum: "$cantidad_m2" },
                conteo: { $sum: 1 }
            }}
        ]);

        const data = stats[0] || { totalInvertido: 0, totalM2: 0, conteo: 0 };
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en KPIs" });
    }
};

// 5. Historial de un material específico (Modal Reloj)
exports.getMaterialHistory = async (req, res) => {
    try {
        const history = await Transaction.find({ materialId: req.params.id })
            .populate({ path: 'proveedorId', select: 'nombre' })
            .sort({ fecha: -1 })
            .limit(30)
            .lean();
        res.status(200).json({ success: true, data: history || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al cargar trazabilidad" });
    }
};

// 6. Alertas de Stock Bajo
exports.getLowStockMaterials = async (req, res) => {
    try {
        const lowStock = await Material.find({ 
            $expr: { $lt: ["$stock_actual_m2", "$stock_minimo_m2"] } 
        }).limit(10).lean();
        res.status(200).json({ success: true, data: lowStock || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en alertas" });
    }
};

// 7. Ajuste manual de stock (Mermas) [cite: 2026-02-05]
exports.manualAdjustment = async (req, res) => {
    try {
        const { materialId, nuevaCantidadM2, motivo } = req.body;
        const material = await Material.findById(materialId);
        if (!material) return res.status(404).json({ success: false, message: "Material no encontrado" });

        const diferencia = parseFloat(nuevaCantidadM2) - material.stock_actual_m2;
        material.stock_actual_m2 = parseFloat(nuevaCantidadM2);
        await material.save();

        const trans = new Transaction({
            materialId: material._id,
            tipo: diferencia > 0 ? 'AJUSTE_MAS' : 'AJUSTE_MENOS',
            cantidad_m2: Math.abs(diferencia),
            motivo: motivo || 'Ajuste manual',
            fecha: new Date()
        });
        await trans.save();
        res.status(200).json({ success: true, stock: material.stock_actual_m2 });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en ajuste" });
    }
};

// 8. Actualización masiva de precios
exports.bulkPriceUpdate = async (req, res) => {
    try {
        const { categoria, porcentaje } = req.body;
        const factor = 1 + (parseFloat(porcentaje) / 100);
        await Material.updateMany({ categoria }, { $mul: { precio_m2_costo: factor, precio_total_lamina: factor } });
        res.status(200).json({ success: true, message: "Precios actualizados" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en actualización masiva" });
    }
};

// 9. Eliminar material
exports.deleteMaterial = async (req, res) => {
    try {
        await Material.findByIdAndDelete(req.params.id);
        await Transaction.deleteMany({ materialId: req.params.id });
        res.status(200).json({ success: true, message: "Material eliminado" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al eliminar" });
    }
};