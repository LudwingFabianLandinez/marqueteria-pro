const mongoose = require('mongoose');

/**
 * MODELO DE PROVEEDORES - MARQUETERÍA PRO
 * Optimizado para capturar información detallada de la agenda.
 */
const SupplierSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        required: [true, 'El nombre es obligatorio'], 
        unique: true,
        trim: true 
    },
    // SUMA: Campo NIT específico para que no se pierda la información
    nit: { 
        type: String, 
        trim: true,
        default: "N/A"
    },
    // Teléfono celular o fijo
    telefono: { 
        type: String, 
        trim: true,
        default: "Sin teléfono"
    },
    // Nombre de la persona de contacto
    contacto: { 
        type: String, 
        trim: true,
        default: "N/A" 
    },
    correo: { 
        type: String, 
        default: "n/a",
        lowercase: true,
        trim: true
    },
    // SUMA: Categorías actualizadas según el formulario dashboard.html
    categoria: { 
        type: String, 
        enum: ['Vidrios', 'Marcos', 'Herrajes', 'Químicos', 'General', 'Otros'], 
        default: 'General' 
    },
    direccion: { 
        type: String, 
        trim: true,
        default: "Dirección no registrada" 
    },
    fechaRegistro: { 
        type: Date, 
        default: Date.now 
    }
});

// Índice para búsquedas rápidas por nombre en la Agenda
SupplierSchema.index({ nombre: 1 });

module.exports = mongoose.model('Supplier', SupplierSchema);