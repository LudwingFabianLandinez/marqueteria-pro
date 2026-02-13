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
    // --- CONFIGURACIÓN AGRESIVA PARA NETLIFY ---
    timestamps: true,
    bufferCommands: false,       // 1. NO esperar si la conexión no es instantánea
    bufferTimeoutMS: 0,          // 2. Desactivar el tiempo de espera de buffer
    autoIndex: false             // 3. No crear índices en caliente (evita bloqueos en producción)
});

/**
 * EXPORTACIÓN ROBUSTA PARA NETLIFY:
 * Forzamos la conexión con la colección 'providers'.
 */
const Provider = mongoose.models.Provider || mongoose.model('Provider', ProviderSchema, 'providers');

// 4. Inyección de seguridad: Forzamos la desactivación del buffering a nivel de modelo global
Provider.schema.set('bufferCommands', false);

module.exports = Provider;