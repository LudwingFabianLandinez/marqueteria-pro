const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    // Número correlativo (Formato estricto OT-000000)
    numeroFactura: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true
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
        }, // Precio de compra m2
        valor_material: { 
            type: Number, 
            default: 0 
        }, // (costo_base_unitario * area_m2)
        
        total_item: { 
            type: Number,
            default: 0 
        } // Precio de venta final del item
    }],
    
    // --- CAMPOS GLOBALES DE COSTO ---
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
    toJSON: { virtuals: true }, // SUMADO: Permite que el reporte vea la utilidad calculada
    toObject: { virtuals: true }
});

/**
 * SUMADO: Propiedad virtual para calcular la Utilidad
 * Esto evita errores en el reporte porque el cálculo se hace en tiempo real
 */
InvoiceSchema.virtual('utilidad_neta').get(function() {
    const venta = this.totalFactura || 0;
    const costos = (this.costo_materiales_total || 0) + (this.mano_obra_total || 0);
    return venta - costos;
});

/**
 * Middleware Pre-Save: 
 * Calcula automáticamente costos, saldos y estados.
 */
InvoiceSchema.pre('save', function(next) {
    // 1. Calcular costos automáticos desde los items
    let sumaCostosMateriales = 0;
    
    if (this.items && this.items.length > 0) {
        this.items.forEach(item => {
            // SUMADO: Forzar número para evitar NaN en el reporte
            const unitario = Number(item.costo_base_unitario) || 0;
            const area = Number(item.area_m2) || 0;
            
            const costoItem = unitario * area;
            item.valor_material = Math.round(costoItem);
            sumaCostosMateriales += item.valor_material;
        });
    }

    // 2. Asignar totales de costos
    this.costo_materiales_total = Math.round(sumaCostosMateriales);
    
    // SUMADO: Validación de mano de obra para evitar errores matemáticos
    const mo = Number(this.mano_obra_total) || 0;
    this.costo_produccion_total = Math.round(this.costo_materiales_total + mo);

    // 3. Gestión financiera (Saldo y Estado)
    const totalVenta = Number(this.totalFactura) || 0;
    const pagado = Number(this.totalPagado) || 0;

    this.saldoPendiente = Math.max(0, totalVenta - pagado);

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

module.exports = mongoose.model('Invoice', InvoiceSchema);