const Invoice = require('../models/Invoice');
const Material = require('../models/Material');
const Transaction = require('../models/Transaction');

/**
 * CONTROLADOR DE FACTURACIÓN Y OT - MARQUETERÍA LA CHICA MORALES
 * Maneja la creación de órdenes, abonos y restauración de stock por anulación.
 */

// 1. CREAR ORDEN DE TRABAJO (OT)
const createInvoice = async (req, res) => {
    try {
        const { 
            cliente, 
            totalFactura, 
            abonoInicial, 
            totalPagado, 
            manoObraTotal, 
            mano_obra_total, 
            medidas 
        } = req.body;
        
        const itemsAProcesar = req.body.items || req.body.materiales || []; 
        const tieneMateriales = Array.isArray(itemsAProcesar) && itemsAProcesar.length > 0;
        const moFinal = parseFloat(manoObraTotal || mano_obra_total || 0);

        if (!tieneMateriales && moFinal <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: "La orden debe incluir al menos un material o un valor de mano de obra." 
            });
        }

        // Generación de número de factura correlativo OT-000001
        const facturasOT = await Invoice.find({ 
            numeroFactura: { $regex: /^OT-\d+$/ } 
        }).select('numeroFactura').lean();

        let siguienteNumero = 1;
        if (facturasOT.length > 0) {
            const numeros = facturasOT.map(inv => {
                const parteNumerica = inv.numeroFactura.split('-')[1];
                return parseInt(parteNumerica, 10) || 0;
            });
            siguienteNumero = Math.max(...numeros) + 1;
        }
        
        const numeroFactura = `OT-${siguienteNumero.toString().padStart(6, '0')}`;
        
        const itemsProcesados = [];
        let costoAcumuladoMateriales = 0; 
        const pagoRecibido = parseFloat(abonoInicial || totalPagado || 0);
        const totalVenta = Math.round(totalFactura || 0);

        // Procesamiento de materiales y descuento de stock
        for (const item of itemsAProcesar) {
            let materialInfo = null;
            
            if (item.productoId) {
                materialInfo = await Material.findById(item.productoId);
            } else if (item.materialNombre) {
                materialInfo = await Material.findOne({ 
                    nombre: { $regex: new RegExp(`^${item.materialNombre.trim()}$`, 'i') } 
                });
            }
            
            if (!materialInfo) {
                itemsProcesados.push({
                    materialNombre: item.materialNombre || "Material no identificado",
                    ancho: parseFloat(item.ancho || 0),
                    largo: parseFloat(item.largo || 0),
                    area_m2: parseFloat(item.area_m2 || 0),
                    costo_base_unitario: 0, 
                    valor_material: 0,
                    total_item: Math.round(item.total_item || 0)
                });
                continue;
            }

            const ancho = parseFloat(item.ancho || 0);
            const largo = parseFloat(item.largo || 0);
            // Si el frontend no envía el área, la calculamos (ancho * largo / 10000)
            const areaCalculada = item.area_m2 || parseFloat(((ancho * largo) / 10000).toFixed(4));
            
            const costoUnitarioCompra = materialInfo.precio_compra_m2 || materialInfo.precio_total_lamina || 0;
            const costoItemReal = Math.round(costoUnitarioCompra * areaCalculada);
            costoAcumuladoMateriales += costoItemReal;

            // ACTUALIZACIÓN DE STOCK: Sincronizado con el campo 'stock_actual'
            await Material.findByIdAndUpdate(materialInfo._id, { 
                $inc: { stock_actual: -areaCalculada } 
            });

            // Registro en historial de movimientos
            await Transaction.create({
                materialId: materialInfo._id,
                tipo: 'VENTA',
                cantidad_m2: areaCalculada,
                motivo: `Orden ${numeroFactura} - Cliente: ${cliente?.nombre || 'Desconocido'}`
            });

            itemsProcesados.push({
                productoId: materialInfo._id,
                materialNombre: materialInfo.nombre,
                ancho, 
                largo, 
                area_m2: areaCalculada,
                costo_base_unitario: costoUnitarioCompra, 
                valor_material: costoItemReal,
                total_item: Math.round(item.total_item || 0)
            });
        }

        const newInvoice = new Invoice({
            numeroFactura,
            cliente: {
                nombre: cliente?.nombre || "Consumidor Final",
                telefono: cliente?.telefono || "N/A"
            },
            medidas: medidas || "N/A",
            items: itemsProcesados,
            mano_obra_total: moFinal,
            costo_materiales_total: costoAcumuladoMateriales, 
            totalFactura: totalVenta,
            totalPagado: pagoRecibido,
            estado: pagoRecibido >= totalVenta ? "PAGADA" : "PENDIENTE",
            fecha: new Date()
        });

        await newInvoice.save();

        res.status(201).json({
            success: true,
            message: `🎉 Orden ${numeroFactura} generada exitosamente`,
            data: newInvoice
        });

    } catch (error) {
        console.error("🚨 Error al crear factura:", error);
        res.status(500).json({ success: false, error: "Error al procesar la venta: " + error.message });
    }
};

// 2. REPORTE DIARIO CON CÁLCULO DE UTILIDAD
const getDailyReport = async (req, res) => {
    try {
        const hoy = new Date();
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
        const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

        const invoices = await Invoice.find({
            fecha: { $gte: inicio, $lte: fin }
        }).lean();

        let totalVentasDia = 0;
        let utilidadDia = 0;

        const reporte = invoices.map(inv => {
            const vVenta = Number(inv.totalFactura) || 0;
            const costoMat = Number(inv.costo_materiales_total) || 0;
            const manoObra = Number(inv.mano_obra_total) || 0;
            
            const utilidad = vVenta - (costoMat + manoObra);
            totalVentasDia += vVenta;
            utilidadDia += utilidad;

            return {
                ot: inv.numeroFactura || "S/N",
                cliente: inv.cliente?.nombre || "Cliente Genérico",
                totalVenta: vVenta,
                utilidad: Math.round(utilidad)
            };
        });

        res.status(200).json({ 
            success: true, 
            data: reporte,
            resumen: {
                totalVentas: Math.round(totalVentasDia),
                utilidadTotal: Math.round(utilidadDia)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. OTROS MÉTODOS (Obtener, Abonar, Eliminar)
const getInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find().sort({ fecha: -1 }).lean();
        res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).lean();
        if (!invoice) return res.status(404).json({ success: false, error: "Factura no encontrada" });
        res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const addPayment = async (req, res) => {
    try {
        const { montoAbono } = req.body;
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ success: false, error: "No encontrada" });

        const abono = parseFloat(montoAbono || 0);
        invoice.totalPagado = (Number(invoice.totalPagado) || 0) + abono;
        
        if (invoice.totalPagado >= invoice.totalFactura) {
            invoice.estado = "PAGADA";
        }

        await invoice.save();
        res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ success: false, error: "No encontrada" });

        // Devolución de stock al inventario antes de borrar
        if (invoice.items) {
            for (const item of invoice.items) {
                if (item.productoId && item.area_m2 > 0) {
                    await Material.findByIdAndUpdate(item.productoId, { 
                        $inc: { stock_actual: item.area_m2 } 
                    });
                }
            }
        }

        await Invoice.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Orden anulada y stock devuelto" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    createInvoice,
    getDailyReport,
    getInvoices,
    getInvoiceById,
    addPayment,
    deleteInvoice,
    saveInvoice: createInvoice
};