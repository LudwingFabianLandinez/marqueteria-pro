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
        unique: true // Evita duplicar nombres de empresas
    },
    nit: {
        type: String,
        unique: true,
        sparse: true, // Permite que varios proveedores no tengan NIT sin chocar
        trim: true
    },
    telefono: {
        type: String,
        default: 'Sin teléfono',
        trim: true
    },
    contacto: {
        type: String, // Nombre de la persona que atiende
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
    timestamps: true // Manejo automático de fechas (createdAt, updatedAt)
});

/**
 * EXPORTACIÓN ROBUSTA PARA NETLIFY:
 * 1. Mantenemos el Singleton (mongoose.models.Provider) para evitar errores de compilación.
 * 2. Añadimos 'proveedores' como tercer parámetro para forzar la conexión con la colección de Atlas.
 */
module.exports = mongoose.models.Provider || mongoose.model('Provider', ProviderSchema, 'providers');