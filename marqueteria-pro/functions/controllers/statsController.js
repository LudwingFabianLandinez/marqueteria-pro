const Invoice = require('../models/Invoice');
const Material = require('../models/Material');

/**
 * Obtiene las estadísticas para el Panel de Control
 */
exports.getDashboardStats = async (req, res) => {
    try {
        // 1. Calcular el inicio del día de hoy
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);

        // 2. Traer facturas de hoy
        const facturasHoy = await Invoice.find({
            createdAt: { $gte: inicioDia }
        });

        const totalVentasHoy = facturasHoy.reduce((acc, f) => acc + f.totalFactura, 0);

        // 3. Traer las últimas 5 ventas para la tabla inferior
        const ultimasVentas = await Invoice.find()
            .sort({ createdAt: -1 })
            .limit(5);

        // 4. Buscar alertas de inventario (Stock actual <= Stock mínimo)
        const alertasStock = await Material.find({
            $expr: { $lte: ["$stock_actual_m2", "$stock_minimo_m2"] }
        });

        res.status(200).json({
            success: true,
            data: {
                ventasHoy: totalVentasHoy,
                numVentasHoy: facturasHoy.length,
                alertas: alertasStock,
                ultimasVentas: ultimasVentas,
                ultimoSinc: new Date()
            }
        });

    } catch (error) {
        console.error("Error Dashboard:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};