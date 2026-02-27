const mongoose = require('mongoose');

/**
 * MODELO DE MATERIALES - MARQUETERÍA LA CHICA MORALES
 * Versión: 12.2.6 - BLINDAJE DE DATOS Y VIRTUALS
 * Objetivo: Asegurar que el campo 'costo_m2' sea accesible para el motor de cálculo.
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
        enum: [
            'Vidrio', 'Respaldo', 'Paspartu', 'Marco', 'Foam', 'Tela', 'Chapilla',
            'Moldura', 'General', 'Otros'
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

// 🌟 PUENTE DE COMPATIBILIDAD (No daña nada, solo traduce para el navegador)
MaterialSchema.virtual('medidas').get(function() {
    return `${this.ancho_lamina_cm || 0} x ${this.largo_lamina_cm || 0} cm`;
});

MaterialSchema.virtual('costo').get(function() {
    return this.precio_m2_costo || this.costo_m2 || 0;
});

/**
 * MIDDLEWARE PRE-SAVE:
 * Realiza cálculos técnicos y sincroniza ambos campos de costo.
 */
MaterialSchema.pre('save', function(next) {
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

    this.costo_m2 = this.precio_m2_costo;
    if (this.stock_actual < 0) this.stock_actual = 0;
    next();
});

// Middleware extra para que las COMPRAS también activen los cálculos
MaterialSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    if (update.$set) {
        const doc = update.$set;
        if (doc.ancho_lamina_cm && doc.largo_lamina_cm) {
            const area = (doc.ancho_lamina_cm * doc.largo_lamina_cm) / 10000;
            doc.area_por_lamina_m2 = area;
            if (area > 0 && doc.precio_total_lamina) {
                doc.precio_m2_costo = Math.round(doc.precio_total_lamina / area);
                doc.costo_m2 = doc.precio_m2_costo;
            }
        }
    }
    next();
});

module.exports = mongoose.models.Material || mongoose.model('Material', MaterialSchema, 'materiales');