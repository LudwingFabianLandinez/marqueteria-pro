const mongoose = require('mongoose');

/**
 * MODELO DE PROVEEDORES - MARQUETERÍA LA CHICA MORALES
 * Ajustado para permitir validación por NIT sin bloqueos por nombre duplicado.
 */
const ProviderSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio'],
        trim: true,
        // SE ELIMINÓ unique: true para evitar el bloqueo que mencionas
    },
    nit: {
        type: String,
        unique: true, // El NIT sigue siendo el identificador único
        sparse: true,
        trim: true,
        required: [true, 'El NIT es obligatorio para evitar duplicidad']
    },
    telefono: {
        type: String,
        default: 'Sin teléfono',
        trim: true
    },
    contacto: {
        type: String,
        trim: true
    },
    correo: {
        type: String,
        trim: true,
        lowercase: true
    },
    direccion: {
        type: String,
        trim: true
    },
    categoria: {
        type: String,
        default: 'General'
    },
    activo: {
        type: Boolean,
        default: true
    }
}, { 
    timestamps: true,
    bufferCommands: false,
    autoIndex: true // Cambiado a true temporalmente para que Mongoose ayude a limpiar los índices
});

/**
 * EXPORTACIÓN QUIRÚRGICA:
 * Forzamos la conexión con la colección 'providers'
 */
const Provider = mongoose.models.Provider || mongoose.model('Provider', ProviderSchema, 'providers');

// Inyección de seguridad para evitar bloqueos en Netlify
Provider.schema.set('bufferCommands', false);

module.exports = Provider;