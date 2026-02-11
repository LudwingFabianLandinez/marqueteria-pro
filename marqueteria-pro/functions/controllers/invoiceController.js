const Invoice = require('../models/Invoice');
const Material = require('../models/Material');
const Transaction = require('../models/Transaction');

// 1. CREAR ORDEN DE TRABAJO
exports.createInvoice = async (req, res) => {
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

        const facturasOT = await Invoice.find({ 
            numeroFactura: { $regex: /^OT-\d+$/ } 
        });

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
            const areaCalculada = item.area_m2 || parseFloat(((ancho * largo) / 10000).toFixed(4));
            
            const costoUnitarioCompra = materialInfo.precio_compra_m2 || 0;
            const costoItemReal = Math.round(costoUnitarioCompra * areaCalculada);
            
            costoAcumuladoMateriales += costoItemReal;

            await Material.findByIdAndUpdate(materialInfo._id, { 
                $inc: { stock_actual_m2: -areaCalculada } 
            });

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

// 2. REPORTE DIARIO (Optimizado para evitar errores visuales)
exports.getDailyReport = async (req, res) => {
    try {
        const hoy = new Date();
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
        const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

        const invoices = await Invoice.find({
            fecha: { $gte: inicio, $lte: fin }
        });

        if (!invoices || invoices.length === 0) {
            return res.status(200).json({ 
                success: true, 
                data: [], 
                resumen: { totalVentas: 0, utilidadTotal: 0 },
                message: "No hay ventas registradas para hoy."
            });
        }

        let totalVentasDia = 0;
        let utilidadDia = 0;

        const reporte = invoices.map(inv => {
            // Aseguramos que los valores sean numéricos para evitar NaN
            const vVenta = Number(inv.totalFactura) || 0;
            const costoMat = Number(inv.costo_materiales_total) || 0;
            const manoObra = Number(inv.mano_obra_total) || 0;
            
            const utilidad = vVenta - (costoMat + manoObra);

            totalVentasDia += vVenta;
            utilidadDia += utilidad;

            return {
                ot: inv.numeroFactura || "S/N",
                cliente: inv.cliente?.nombre || "Cliente Genérico",
                materiales_detalle: (inv.items && inv.items.length > 0) 
                    ? inv.items.map(i => i.materialNombre || "Sin nombre").join(', ') 
                    : "Servicio/Mano de Obra",
                costoMateriales: Math.round(costoMat),
                manoObra: Math.round(manoObra),
                costoTotal: Math.round(costoMat + manoObra),
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
        console.error("🚨 Error crítico en reporte:", error);
        res.status(200).json({ 
            success: false, 
            message: "Error al procesar datos.",
            data: [],
            resumen: { totalVentas: 0, utilidadTotal: 0 }
        });
    }
};

// 3. OBTENER TODAS LAS ÓRDENES
exports.getInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find().sort({ fecha: -1 });
        res.status(200).json({ success: true, count: invoices.length, data: invoices });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. OBTENER POR ID
exports.getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ success: false, error: "Factura no encontrada" });
        res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 5. REGISTRAR ABONO
exports.addPayment = async (req, res) => {
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

// 6. ELIMINAR Y DEVOLVER STOCK
exports.deleteInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = await Invoice.findById(id);
        if (!invoice) return res.status(404).json({ success: false, error: "No encontrada" });

        if (invoice.items && Array.isArray(invoice.items)) {
            for (const item of invoice.items) {
                if (item.productoId && item.area_m2 > 0) {
                    const materialExiste = await Material.exists({ _id: item.productoId });
                    if (materialExiste) {
                        await Material.findByIdAndUpdate(item.productoId, { $inc: { stock_actual_m2: item.area_m2 } });
                        await Transaction.create({
                            materialId: item.productoId,
                            tipo: 'ENTRADA',
                            cantidad_m2: item.area_m2,
                            motivo: `ANULACIÓN OT: ${invoice.numeroFactura}`
                        });
                    }
                }
            }
        }

        await Invoice.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Orden eliminada y stock restaurado" });
    } catch (error) {
        console.error("🚨 Error al eliminar orden:", error);
        res.status(500).json({ success: false, error: "Error al eliminar la orden" });
    }
};