const express = require('express');
const router = express.Router();
// Cargamos el controlador como objeto completo para evitar errores de desestructuración
const invoiceCtrl = require('../controllers/invoiceController');

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

/**
 * 1. OBTENER REPORTE DIARIO
 */
router.get('/report/daily', (req, res, next) => {
    try {
        console.log(`📊 Generando Reporte Consolidado...`);
        // Verificamos que la función exista en el controlador
        const method = invoiceCtrl.getDailyReport || invoiceCtrl.getReport;
        if (!method) throw new Error("Método getDailyReport no encontrado");
        next();
    } catch (error) {
        console.error("❌ Error en el middleware de reporte:", error.message);
        res.status(200).json({ 
            success: false, 
            data: { totalVentas: 0, totalAbonos: 0, totalPendiente: 0, ordenes: [] }, 
            message: "No se pudo preparar el reporte diario." 
        });
    }
}, (req, res) => (invoiceCtrl.getDailyReport || invoiceCtrl.getReport)(req, res));

/**
 * 2. CREAR NUEVA ORDEN DE TRABAJO
 */
router.post('/', async (req, res, next) => {
    console.log("📝 Validando integridad de la nueva OT...");
    
    const totalFactura = Number(req.body.totalFactura) || 0;
    const itemsAProcesar = req.body.items || req.body.materiales || [];
    const manoObra = Number(req.body.manoObraTotal || req.body.manoObra) || 0;
    const cliente = req.body.cliente;

    if (!cliente || !cliente.nombre) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ El nombre del cliente es obligatorio." 
        });
    }

    if (totalFactura <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ La orden no puede procesarse con valor total de $0." 
        });
    }

    next();
}, (req, res) => (invoiceCtrl.createInvoice || invoiceCtrl.saveInvoice)(req, res));

/**
 * 3. OBTENER HISTORIAL Y DETALLE
 */
router.get('/', (req, res) => (invoiceCtrl.getInvoices || invoiceCtrl.getAll)(req, res));

router.get('/:id', (req, res) => (invoiceCtrl.getInvoiceById || invoiceCtrl.getOne)(req, res));

/**
 * 4. REGISTRAR ABONO
 */
router.put('/:id/payment', (req, res, next) => {
    const montoAbono = Number(req.body.montoAbono) || 0;
    if (montoAbono <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: "⚠️ El monto del abono debe ser positivo." 
        });
    }
    next();
}, (req, res) => (invoiceCtrl.addPayment || invoiceCtrl.registerPayment)(req, res));

/**
 * 5. ELIMINAR / ANULAR FACTURA
 */
router.delete('/:id', (req, res, next) => {
    console.warn(`🚨 SOLICITUD DE ANULACIÓN: Factura ID ${req.params.id}`);
    next();
}, (req, res) => (invoiceCtrl.deleteInvoice || invoiceCtrl.cancelInvoice)(req, res));

// Manejador de Errores Global para Facturación
router.use((err, req, res, next) => {
    console.error("🚨 ERROR INTERCEPTADO EN FACTURACIÓN:", err.message);
    res.status(500).json({ 
        success: false, 
        message: "Ocurrió un error al procesar la transacción financiera.",
        error: err.message 
    });
});

module.exports = router;