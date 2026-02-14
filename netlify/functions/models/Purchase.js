const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
    proveedorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    items: [{
        descripcion: String,
        cantidad: Number,
        precioUnitario: Number,
        subtotal: Number
    }],
    total: {
        type: Number,
        required: true
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    metodoPago: {
        type: String,
        enum: ['Efectivo', 'Transferencia', 'Crédito'],
        default: 'Efectivo'
    }
}, { timestamps: true });

module.exports = mongoose.model('Purchase', PurchaseSchema);