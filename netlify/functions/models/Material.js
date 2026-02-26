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
        enum: ['m2', 'ml'], 
        default: 'm2' 
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
    notas: {
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
MaterialSchema.pre('save', function(next) {
    // Cálculo de área
    if (this.tipo === 'm2') {
        const areaCalculada = (this.ancho_lamina_cm * this.largo_lamina_cm) / 10000;
        this.area_por_lamina_m2 = areaCalculada;
        
        if (areaCalculada > 0) {
            this.precio_m2_costo = Math.round(this.precio_total_lamina / areaCalculada);
        }
    } 
    else if (this.tipo === 'ml') {
        if (this.largo_lamina_cm > 0) {
            this.precio_m2_costo = Math.round(this.precio_total_lamina / (this.largo_lamina_cm / 100));
        }
    }

    // 🔥 SINCRONIZACIÓN CRÍTICA:
    this.costo_m2 = this.precio_m2_costo;
    
    if (this.stock_actual < 0) this.stock_actual = 0;

    next();
});

// 🚨 CONEXIÓN FORZADA A LA COLECCIÓN 'materiales'
module.exports = mongoose.models.Material || mongoose.model('Material', MaterialSchema, 'materiales');