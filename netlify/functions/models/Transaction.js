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
    /**
     * AJUSTE QUIRÚRGICO: Expandimos el enum para aceptar variaciones 
     * comunes y evitar el Error 500 de validación.
     * Se incluye 'IN' y 'OUT' para total compatibilidad con el servidor v13.3.19.
     */
    tipo: { 
        type: String, 
        enum: [
            'COMPRA', 'compra', 'PURCHASE', 'purchase', 'IN', 'in', // Variaciones de ingreso
            'AJUSTE_MAS', 'AJUSTE_MENOS', 
            'VENTA', 'venta', 'SALE', 'sale', 'OUT', 'out'         // Variaciones de salida
        ], 
        required: true 
    },
    // Este campo almacena la cantidad neta (sea m2 o ml según el material)
    cantidad: { 
        type: Number, 
        required: true 
    },
    // Mantenemos este por compatibilidad con reportes viejos
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
    // Referencia al modelo único Provider
    proveedor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Provider' 
    },
    // Descripción de la transacción
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
 * 1. Asegura compatibilidad de cantidad_m2.
 * 2. Normaliza el tipo a MAYÚSCULAS antes de guardar para mantener limpia la DB.
 */
TransactionSchema.pre('save', function(next) {
    // Compatibilidad de cantidad
    if (this.cantidad && !this.cantidad_m2) {
        this.cantidad_m2 = this.cantidad;
    }

    // Normalización: Si llega 'compra' o 'IN', lo guarda como 'COMPRA'
    if (this.tipo) {
        const t = this.tipo.toLowerCase();
        if (t === 'compra' || t === 'purchase' || t === 'in') {
            this.tipo = 'COMPRA';
        }
        if (t === 'venta' || t === 'sale' || t === 'out') {
            this.tipo = 'VENTA';
        }
    }
    
    next();
});

// Singleton para evitar errores de recompilación en Netlify
module.exports = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);