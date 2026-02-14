const Invoice = require('../models/Invoice');
const Material = require('../models/Material');

/**
 * CONTROLADOR DE ESTADÍSTICAS - MARQUETERÍA LA CHICA MORALES
 * Genera el resumen ejecutivo para el Dashboard principal
 */
const getDashboardStats = async (req, res) => {
    try {
        // 1. Calcular el rango de tiempo (Hoy)
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date();
        finDia.setHours(23, 59, 59, 999);

        // 2. Traer facturas de hoy y métricas financieras
        // Buscamos facturas creadas hoy para los KPIs rápidos
        const facturasHoy = await Invoice.find({
            createdAt: { $gte: inicioDia, $lte: finDia }
        }).lean();

        const totalVentasHoy = facturasHoy.reduce((acc, f) => acc + (f.totalFactura || 0), 0);
        const totalRecaudadoHoy = facturasHoy.reduce((acc, f) => acc + (f.pagoRealizado || 0), 0);

        // 3. Traer las últimas 5 ventas (Historial reciente)
        // Incluimos el nombre del cliente para la tabla del dashboard
        const ultimasVentas = await Invoice.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // 4. Alertas de inventario (Stock actual <= Stock mínimo)
        // Corregido para usar los nombres de campo estándar: stock_actual y stock_minimo
        const alertasStock = await Material.find({
            $expr: { $lte: ["$stock_actual", "$stock_minimo"] }
        })
        .select('nombre stock_actual stock_minimo categoria')
        .limit(10)
        .lean();

        // 5. Métricas de Cartera (Cuentas por cobrar)
        // Calculamos cuánto nos deben en total sumando saldos de facturas no pagadas
        const facturasPendientes = await Invoice.find({ estado: { $ne: 'PAGADA' } }).lean();
        const saldoPendienteTotal = facturasPendientes.reduce((acc, f) => {
            const pendiente = (f.totalFactura || 0) - (f.pagoRealizado || 0);
            return acc + (pendiente > 0 ? pendiente : 0);
        }, 0);

        // Respuesta consolidada para el frontend
        res.status(200).json({
            success: true,
            data: {
                ventasHoy: totalVentasHoy,
                recaudadoHoy: totalRecaudadoHoy,
                numVentasHoy: facturasHoy.length,
                alertas: alertasStock,
                ultimasVentas: ultimasVentas,
                carteraTotal: saldoPendienteTotal,
                ultimoSinc: new Date()
            }
        });

    } catch (error) {
        console.error("🚨 Error Crítico en Dashboard Stats:", error);
        res.status(500).json({ 
            success: false, 
            error: "No se pudieron calcular las estadísticas",
            details: error.message 
        });
    }
};

// EXPORTACIÓN CON ALIAS DE SEGURIDAD
module.exports = {
    getDashboardStats,
    getStats: getDashboardStats,
    getAll: getDashboardStats
};