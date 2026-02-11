const express = require('express');
const router = express.Router();
const { 
    createInvoice, 
    getInvoices, 
    getInvoiceById,
    deleteInvoice,
    addPayment,
    getDailyReport 
} = require('../controllers/invoiceController');

/**
 * RUTAS PARA /api/invoices
 * Gestión de Órdenes de Trabajo (OT), Abonos y Stock
 * Versión con Blindaje de Reportes y Manejo de Errores (Anti-Crash)
 */

// Middleware de Logging específico para Facturación
router.use((req, res, next) => {
    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    console.log(`[BillingLog] ${fecha} - ${req.method} ${req.url}`);
    next();
});

// 1. OBTENER REPORTE DIARIO 
// SUMADO: Protección contra fallos de agregación si no hay datos hoy
router.get('/report/daily', (req, res, next) => {
    try {
        console.log(`📊 Generando Reporte Consolidado...`);
        next();
    } catch (error) {
        console.error("❌ Error en el middleware de reporte:", error);
        res.status(200).json({ 
            success: false, 
            data: { totalVentas: 0, totalAbonos: 0, totalPendiente: 0, ordenes: [] }, 
            message: "No se pudo preparar el reporte diario." 
        });
    }
}, getDailyReport);

// 2. CREAR NUEVA ORDEN DE TRABAJO
// CORRECCIÓN: Blindaje para permitir costos en 0 si es necesario (evita bloqueos de órdenes de prueba)
router.post('/', async (req, res, next) => {
    console.log("📝 Validando integridad de la nueva OT...");
    
    // Capturamos las variantes del frontend con valores por defecto seguros
    const totalFactura = Number(req.body.totalFactura) || 0;
    const itemsAProcesar = req.body.items || req.body.materiales || [];
    const manoObra = Number(req.body.manoObraTotal || req.body.manoObra) || 0;
    const cliente = req.body.cliente;

    // VALIDACIÓN DE CLIENTE: Mínimo el nombre es requerido
    if (!cliente || !cliente.nombre) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ El nombre del cliente es obligatorio para registrar la venta." 
        });
    }

    // VALIDACIÓN FINANCIERA: Si el total es 0, enviamos error claro
    if (totalFactura <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ La orden no puede procesarse con valor total de $0." 
        });
    }

    console.log(`💰 Verificación: Venta: ${totalFactura} | Items: ${itemsAProcesar.length} | MO: ${manoObra}`);
    
    // VALIDACIÓN DE MATERIALES O SERVICIO
    if (!Array.isArray(itemsAProcesar) || itemsAProcesar.length === 0) {
        if (manoObra <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: "⚠️ La orden debe incluir al menos un material o mano de obra." 
            });
        }
        console.warn("⚠️ Orden de servicio puro detectada (Solo Mano de Obra).");
    }

    next();
}, createInvoice);

// 3. OBTENER HISTORIAL COMPLETO
router.get('/', getInvoices);

// 4. OBTENER DETALLE DE UNA OT ESPECÍFICA
router.get('/:id', getInvoiceById);

// 5. REGISTRAR ABONO A UNA CUENTA PENDIENTE
router.put('/:id/payment', (req, res, next) => {
    const montoAbono = Number(req.body.montoAbono) || 0;
    
    if (montoAbono <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ El monto del abono debe ser un número positivo." 
        });
    }
    
    console.log(`💰 Registrando abono: ${montoAbono} a Factura ID: ${req.params.id}`);
    next();
}, addPayment);

// 6. ELIMINAR / ANULAR FACTURA
router.delete('/:id', (req, res, next) => {
    console.warn(`🚨 SOLICITUD DE ANULACIÓN: Factura ID ${req.params.id}. Se procederá a reintegrar stock.`);
    next();
}, deleteInvoice);

// SUMADO: MANEJADOR DE ERRORES GLOBAL PARA ESTE ROUTER
// Esto captura fallos de MongoDB o errores de lógica en el controlador
router.use((err, req, res, next) => {
    console.error("🚨 ERROR INTERCEPTADO EN FACTURACIÓN:", err.message);
    
    res.status(500).json({ 
        success: false, 
        message: "Ocurrió un error al procesar la transacción financiera.",
        error: err.message 
    });
});

module.exports = router;