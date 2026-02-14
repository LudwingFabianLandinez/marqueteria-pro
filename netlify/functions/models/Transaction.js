const mongoose = require('mongoose');

/**
 * MODELO DE TRANSACCIONES - MARQUETERÍA LA CHICA MORALES
 * Registra cada movimiento de material para trazabilidad total.
 */
const TransactionSchema = new mongoose.Schema({
    materialId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Material', 
        required: true 
    },
    tipo: { 
        type: String, 
        enum: ['COMPRA', 'AJUSTE_MAS', 'AJUSTE_MENOS', 'VENTA'], 
        required: true 
    },
    // Este campo almacena la cantidad neta (sea m2 o ml según el material)
    cantidad: { 
        type: Number, 
        required: true 
    },
    // Mantenemos este por compatibilidad con reportes viejos, pero usamos 'cantidad' para lo nuevo
    cantidad_m2: { 
        type: Number
    },
    // Precio por unidad (m2 o ml) en el momento de la transacción
    costo_unitario: { 
        type: Number, 
        default: 0 
    },
    // Desembolso total de la operación
    costo_total: { 
        type: Number, 
        default: 0 
    },
    // AJUSTE CRÍTICO: Referencia al modelo único Provider (antes Supplier)
    proveedor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Provider' 
    },
    // Descripción de la transacción (ej: "Ajuste por rotura" o "Compra de 5 láminas")
    motivo: { 
        type: String 
    },
    fecha: { 
        type: Date, 
        default: Date.now 
    }
}, { 
    timestamps: true 
});

/**
 * MIDDLEWARE PRE-SAVE
 * Asegura que cantidad_m2 siempre tenga un valor para no romper el dashboard viejo.
 */
TransactionSchema.pre('save', function(next) {
    if (this.cantidad && !this.cantidad_m2) {
        this.cantidad_m2 = this.cantidad;
    }
    next();
});

// Singleton para evitar errores de recompilación en Netlify
module.exports = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);