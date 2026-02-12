const mongoose = require('mongoose');

/**
 * MODELO DE MATERIALES - MARQUETERÍA LA CHICA MORALES
 * Define la estructura de las láminas y perfiles del inventario.
 */
const MaterialSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        required: true, 
        trim: true 
    },
    // Categoría para organizar el cotizador automáticamente
    categoria: { 
        type: String, 
        required: true,
        enum: [
            'Vidrio', 
            'Respaldo', 
            'Paspartu', 
            'Marco', 
            'Foam', 
            'Tela', 
            'Chapilla',
            'Otros'
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
    stock_actual_m2: { 
        type: Number, 
        default: 0 
    }, 
    stock_minimo_m2: { 
        type: Number, 
        default: 2 // Recomendado para alertas de stock bajo
    },
    area_por_lamina_m2: { 
        type: Number,
        default: 0
    },
    precio_m2_costo: { 
        type: Number,
        default: 0
    },
    /**
     * AJUSTE CRÍTICO: Referencia al modelo único Provider.
     * Esto conecta con el archivo Provider.js que ajustaremos luego.
     */
    proveedor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Provider' 
    }
}, { 
    timestamps: true 
});

/**
 * MIDDLEWARE PRE-SAVE:
 * Realiza cálculos técnicos automáticos antes de guardar.
 */
MaterialSchema.pre('save', function(next) {
    if (this.tipo === 'm2') {
        // 1. Cálculo del área: (Ancho * Largo) / 10,000
        const areaCalculada = (this.ancho_lamina_cm * this.largo_lamina_cm) / 10000;
        this.area_por_lamina_m2 = areaCalculada;
        
        // 2. Cálculo del costo m²
        if (areaCalculada > 0) {
            this.precio_m2_costo = Math.round(this.precio_total_lamina / areaCalculada);
        }
    }
    
    // Validar que el stock no sea negativo
    if (this.stock_actual_m2 < 0) this.stock_actual_m2 = 0;

    next();
});

/**
 * EXPORTACIÓN CORREGIDA:
 * 1. Mantenemos el Singleton para Netlify (mongoose.models.Material).
 * 2. Forzamos el nombre de la colección a 'materiales' (en español) como tercer parámetro.
 */
module.exports = mongoose.models.Material || mongoose.model('Material', MaterialSchema, 'materiales');