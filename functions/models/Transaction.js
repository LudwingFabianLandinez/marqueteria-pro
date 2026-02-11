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
    cantidad_m2: { 
        type: Number, 
        required: true 
    },
    // Precio por metro cuadrado en el momento de la transacción
    costo_unitario_m2: { 
        type: Number, 
        default: 0 
    },
    // NUEVO/CRÍTICO: Campo para almacenar el desembolso total de la compra
    // Sin este campo, la tabla de historial aparecerá vacía o sin montos [cite: 2026-02-05]
    costo_total: { 
        type: Number, 
        default: 0 
    },
    // Relación con el proveedor
    proveedorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Supplier' 
    },
    // Descripción de la transacción (ej: "Compra de 5 láminas")
    motivo: { 
        type: String 
    },
    fecha: { 
        type: Date, 
        default: Date.now 
    }
}, { 
    timestamps: true // Crea automáticamente createdAt y updatedAt
});

module.exports = mongoose.model('Transaction', TransactionSchema);