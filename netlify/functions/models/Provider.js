const mongoose = require('mongoose');

/**
 * MODELO DE PROVEEDORES - MARQUETERÍA LA CHICA MORALES
 * Centraliza la información de contacto para compras de materiales.
 */
const ProviderSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio'],
        trim: true,
        unique: true
    },
    nit: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
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
    autoIndex: false 
});

/**
 * EXPORTACIÓN QUIRÚRGICA:
 * Forzamos la conexión con la colección 'providers' (donde están tus datos en Atlas)
 */
const Provider = mongoose.models.Provider || mongoose.model('Provider', ProviderSchema, 'providers');

// Inyección de seguridad para evitar bloqueos en Netlify
Provider.schema.set('bufferCommands', false);

module.exports = Provider;