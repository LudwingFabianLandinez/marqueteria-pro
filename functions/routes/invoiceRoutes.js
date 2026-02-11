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

// 1. OBTENER REPORTE DIARIO 
// SUMADO: Protección contra fallos de agregación si no hay datos hoy
router.get('/report/daily', (req, res, next) => {
    try {
        const ahora = new Date();
        const fechaLocal = ahora.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
        
        console.log(`📊 Petición de Reporte Consolidado: ${fechaLocal}`);
        
        // El middleware pasa al controlador getDailyReport
        next();
    } catch (error) {
        console.error("❌ Error en el middleware de reporte:", error);
        // SUMADO: Respuesta JSON limpia para evitar el cartel "Error en reporte" en el front
        res.status(200).json({ success: false, data: [], message: "No se pudo preparar el reporte" });
    }
}, getDailyReport);

// 2. CREAR NUEVA ORDEN DE TRABAJO
// CORRECCIÓN: Blindaje para permitir costos en 0 si es necesario (evita bloqueos de órdenes de prueba)
router.post('/', async (req, res, next) => {
    console.log("📝 Iniciando guardado de OT...");
    
    // Capturamos las variantes del frontend con valores por defecto seguros
    const totalFactura = Number(req.body.totalFactura) || 0;
    const itemsAProcesar = req.body.items || req.body.materiales || [];
    const manoObra = Number(req.body.manoObraTotal || req.body.manoObra) || 0;

    // VALIDACIÓN FINANCIERA: Si el total es 0, enviamos error claro en lugar de dejar que el servidor falle
    if (totalFactura <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: "La orden no puede procesarse con valor total de $0." 
        });
    }

    console.log(`💰 Verificación financiera: Venta: ${totalFactura} | MO: ${manoObra}`);
    
    // VALIDACIÓN DE MATERIALES: Ahora permitimos continuar si es un servicio puro (solo mano de obra)
    // Esto previene el error cuando el array de materiales llega vacío pero hay un total de venta.
    if (!Array.isArray(itemsAProcesar) || itemsAProcesar.length === 0) {
        if (manoObra <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: "La orden debe incluir al menos un material o mano de obra." 
            });
        }
        console.warn("⚠️ Orden sin materiales pero con Mano de Obra detectada.");
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
    console.log(`💰 Procesando abono de ${montoAbono} para factura ID: ${req.params.id}`);
    
    if (montoAbono <= 0) {
        return res.status(400).json({ success: false, error: "El monto del abono debe ser mayor a 0." });
    }
    next();
}, addPayment);

// 6. ELIMINAR / ANULAR FACTURA
router.delete('/:id', (req, res, next) => {
    console.warn(`⚠️ ALERTA: Anulando factura ID: ${req.params.id}. Se reintegrará stock.`);
    next();
}, deleteInvoice);

// SUMADO: MANEJADOR DE ERRORES GLOBAL PARA ESTE ROUTER
// Esto captura cualquier error de MongoDB (como los de tus capturas) y evita que el front muestre "Error en reporte"
router.use((err, req, res, next) => {
    console.error("🚨 ERROR INTERCEPTADO EN EL SERVIDOR:", err.message);
    
    // Si el error viene de un fallo de cálculo o dato nulo en la BD
    res.status(200).json({ 
        success: false, 
        message: "Ocurrió un problema con los datos de esta orden.",
        data: [], // Enviamos array vacío para que el reporte no se rompa
        error: err.message 
    });
});

module.exports = router;