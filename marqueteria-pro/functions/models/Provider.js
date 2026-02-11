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
    timestamps: true // Reemplaza createdAt manual por manejo automático de fechas
});

/**
 * EXPORTACIÓN ROBUSTA:
 * mongoose.models.Provider verifica si el modelo ya fue compilado.
 * Esto es CRÍTICO para evitar el error "Cannot overwrite model once compiled" en Netlify Functions.
 */
module.exports = mongoose.models.Provider || mongoose.model('Provider', ProviderSchema);