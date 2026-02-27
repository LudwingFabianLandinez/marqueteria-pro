const mongoose = require('mongoose');

/**
 * MODELO DE MATERIALES - MARQUETERÍA LA CHICA MORALES
 * Versión: 12.2.8 - BLINDAJE DE CATEGORÍAS Y VIRTUALS
 */
const MaterialSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        required: true, 
        trim: true 
    },
    categoria: { 
        type: String, 
        required: true,
        trim: true,
        // Enum blindado: Acepta variaciones para que Atlas no bloquee el guardado
        enum: [
            'Vidrio', 'Respaldo', 'Paspartu', 'Marco', 'Foam', 'Tela', 'Chapilla', 
            'Moldura', 'General', 'Otros', 
            'MOLDURAS', 'GENERAL', 'VIDRIO', 'MOLDURA',
            'moldura', 'general', 'vidrio'
        ],
        default: 'Otros'
    },
    tipo: { 
        type: String, 
        // Eliminamos el enum estricto temporalmente para ver si el flujo se destraba
        // o nos aseguramos de que siempre tenga un valor válido
        default: 'm2',
        trim: true,
        lowercase: true
    },
    ancho_lamina_cm: { 
        type: Number, 
        required: true,
        default: 0
    }, 
    largo_lamina_cm: { 
        type: Number, 
        required: true,
        default: 0
    }, 
    precio_total_lamina: { 
        type: Number, 
        required: true,
        default: 0
    }, 
    precio_m2_costo: { 
        type: Number,
        default: 0
    },
    // 🛡️ GANCHO DE SEGURIDAD: Campo duplicado para compatibilidad total
    costo_m2: {
        type: Number,
        default: 0
    },
    precio_venta_sugerido: {
        type: Number,
        default: 0
    },
    stock_actual: { 
        type: Number, 
        default: 0 
    }, 
    stock_minimo: { 
        type: Number, 
        default: 2 
    },
    area_por_lamina_m2: { 
        type: Number,
        default: 0
    },
    proveedor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Provider' 
    },
    notes: {
        type: String,
        trim: true
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

/**
 * MIDDLEWARE PRE-SAVE:
 * Realiza cálculos técnicos y sincroniza ambos campos de costo.
 */
/**
 * MIDDLEWARE DE CÁLCULO - MARQUETERÍA LA CHICA MORALES
 * Esta función centraliza la lógica para que no haya errores de "0x0 cm"
 */
function calcularValoresTecnicos(doc) {
    if (!doc) return;

    // 1. Cálculo de área y precio m2
    if (doc.tipo === 'm2') {
        const ancho = doc.ancho_lamina_cm || 0;
        const largo = doc.largo_lamina_cm || 0;
        const areaCalculada = (ancho * largo) / 10000;
        
        doc.area_por_lamina_m2 = areaCalculada;
        
        if (areaCalculada > 0 && doc.precio_total_lamina) {
            doc.precio_m2_costo = Math.round(doc.precio_total_lamina / areaCalculada);
        }
    } 
    else if (doc.tipo === 'ml') {
        if (doc.largo_lamina_cm > 0 && doc.precio_total_lamina) {
            doc.precio_m2_costo = Math.round(doc.precio_total_lamina / (doc.largo_lamina_cm / 100));
        }
    }

    // 2. 🔥 SINCRONIZACIÓN CRÍTICA PARA ATLAS
    doc.costo_m2 = doc.precio_m2_costo || 0;
    
    if (doc.stock_actual < 0) doc.stock_actual = 0;
}

// HOOK 1: Se activa al usar .save() (Material nuevo)
MaterialSchema.pre('save', function(next) {
    calcularValoresTecnicos(this);
    next();
});

// HOOK 2: Se activa al usar .findByIdAndUpdate() (Compras/Actualizaciones)
MaterialSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    // Si la actualización viene dentro de $set (lo normal en Express)
    if (update.$set) {
        calcularValoresTecnicos(update.$set);
    } else {
        calcularValoresTecnicos(update);
    }
    next();
});

// 🚨 Mantenemos tu exportación blindada
module.exports = mongoose.models.Material || mongoose.model('Material', MaterialSchema, 'materiales');