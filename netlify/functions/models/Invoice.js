const mongoose = require('mongoose');

/**
 * Modelo de Facturación/OT - MARQUETERÍA LA CHICA MORALES
 * Versión: 13.1.0 - CONSOLIDACIÓN DE COSTOS Y VIRTUALS
 * Objetivo: Actuar como el núcleo de datos para Inventario, Ventas y Reportes.
 */

const InvoiceSchema = new mongoose.Schema({
    // Número correlativo (Formato estricto OT-000000)
    numeroFactura: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        default: () => `OT-${Math.floor(Date.now() / 1000)}` 
    },
    cliente: {
        nombre: { type: String, required: true },
        telefono: { type: String, default: "N/A" }
    },
    medidas: {
        type: String,
        default: "N/A"
    },
    items: [{
        productoId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Material' 
        },
        materialNombre: { type: String, default: "Material no especificado" },
        ancho: { type: Number, default: 0 },
        largo: { type: Number, default: 0 },
        area_m2: { type: Number, default: 0 }, 
        
        // --- SECCIÓN DE COSTOS POR ITEM ---
        costo_base_unitario: { 
            type: Number, 
            default: 0 
        }, // Precio de compra m2 (Costo real)
        valor_material: { 
            type: Number, 
            default: 0 
        }, // (costo_base_unitario * area_m2)
        
        total_item: { 
            type: Number,
            default: 0 
        } // Precio de venta final del item (Sugerido al cliente)
    }],
    
    // --- CAMPOS GLOBALES DE COSTO (Blindaje para Reportes) ---
    mano_obra_total: {
        type: Number,
        default: 0
    },
    costo_materiales_total: {
        type: Number,
        default: 0
    },
    costo_produccion_total: {
        type: Number,
        default: 0
    },

    totalFactura: { 
        type: Number, 
        required: true,
        default: 0 
    },
    totalPagado: { 
        type: Number, 
        default: 0 
    },
    saldoPendiente: { 
        type: Number, 
        default: 0 
    },

    estado: { 
        type: String, 
        enum: ['Pendiente', 'Abonado', 'Pagado', 'Anulado'], 
        default: 'Pendiente' 
    },
    
    fecha: { 
        type: Date, 
        default: Date.now,
        index: true 
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true }
});

/**
 * PROPIEDAD VIRTUAL: Utilidad Neta
 * Calcula en tiempo real: Venta Total - (Costos de Materiales + Mano de Obra)
 */
InvoiceSchema.virtual('utilidad_neta').get(function() {
    const venta = this.totalFactura || 0;
    const costos = (this.costo_materiales_total || 0) + (this.mano_obra_total || 0);
    return venta - costos;
});

/**
 * Middleware Pre-Save: 
 * Blindaje final antes de entrar a la base de datos.
 */
InvoiceSchema.pre('save', function(next) {
    let sumaCostosMateriales = 0;
    
    // 1. Normalización y cálculo de items
    if (this.items && this.items.length > 0) {
        this.items.forEach(item => {
            // Aseguramos que el area_m2 esté presente para el descuento de stock
            if (!item.area_m2 && (item.ancho && item.largo)) {
                item.area_m2 = (item.ancho * item.largo) / 10000;
            }

            const unitario = Number(item.costo_base_unitario) || 0;
            const area = Number(item.area_m2) || 0;
            
            // El valor_material es el COSTO real para la marquetería
            item.valor_material = Math.round(unitario * area);
            sumaCostosMateriales += item.valor_material;

            // Si el total_item viene en 0, lo estimamos para no romper el historial
            if (!item.total_item || item.total_item === 0) {
                item.total_item = Math.round(item.valor_material * 3);
            }
        });
    }

    // 2. Consolidación de Costos Globales
    this.costo_materiales_total = Math.round(sumaCostosMateriales);
    const mo = Number(this.mano_obra_total) || 0;
    this.costo_produccion_total = Math.round(this.costo_materiales_total + mo);

    // 3. Sincronización Financiera
    const totalVenta = Number(this.totalFactura) || 0;
    const pagado = Number(this.totalPagado) || 0;

    // Cálculo de saldo (nunca negativo)
    this.saldoPendiente = Math.max(0, totalVenta - pagado);

    // 4. Automatización de Estados
    if (this.estado !== 'Anulado') {
        if (pagado <= 0) {
            this.estado = 'Pendiente';
        } else if (pagado < totalVenta) {
            this.estado = 'Abonado';
        } else {
            this.estado = 'Pagado';
        }
    }
    
    next();
});

// Exportación robusta para entornos Serverless (Netlify)
module.exports = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema, 'facturas');