const mongoose = require('mongoose');

// --- 📦 SCHEMA DE COMPRAS (SINCRO TOTAL V12.1.9) ---
const PurchaseSchema = new mongoose.Schema({
    // 🎯 CAMBIO CLAVE: Cambiamos 'proveedorId' a 'proveedor' para que coincida con .populate('proveedor')
    // y aseguramos que 'ref' coincida con el nombre exacto de tu modelo de proveedores
    proveedor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider', // Asegúrate de que tu modelo de proveedores se exporte como 'Provider'
        required: true
    },
    items: [{
        descripcion: String,
        cantidad: Number,
        precioUnitario: Number,
        subtotal: Number
    }],
    // 💰 SINCRO DE CAMPOS: Mantenemos 'total' pero añadimos 'costo_total' como alias 
    // para compatibilidad con tus rutas nuevas
    total: {
        type: Number,
        required: true
    },
    costo_total: { 
        type: Number 
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
}, { 
    timestamps: true,
    strict: false // 🔓 Permite guardar campos extra mientras terminamos la transición
});

module.exports = mongoose.model('Purchase', PurchaseSchema);