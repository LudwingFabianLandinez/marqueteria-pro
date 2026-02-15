const mongoose = require('mongoose');

/**
 * MODELO DE MATERIALES - MARQUETERÍA LA CHICA MORALES
 * Versión: 12.1.6 - CONSOLIDADO FINAL
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
            'Moldura',
            'Otros'
        ],
        default: 'Otros'
    },
    tipo: { 
        type: String, 
        enum: ['m2', 'ml'], 
        default: 'm2' 
    },
    // Dimensiones físicas
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
    // Costos y Precios
    precio_total_lamina: { 
        type: Number, 
        required: true,
        default: 0
    }, 
    precio_m2_costo: { 
        type: Number,
        default: 0
    },
    // Precio de venta sugerido (Tu sugerencia original)
    precio_venta_sugerido: {
        type: Number,
        default: 0
    },
    // Gestión de existencias
    stock_actual: { 
        type: Number, 
        default: 0 
    }, 
    stock_minimo: { 
        type: Number, 
        default: 2 // Alerta visual en el dashboard
    },
    area_por_lamina_m2: { 
        type: Number,
        default: 0
    },
    /**
     * Referencia al modelo único Provider.
     * IMPORTANTE: Aseguramos que el nombre coincida con mongoose.model('Provider'...)
     */
    proveedor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Provider' 
    },
    notas: {
        type: String,
        trim: true
    }
}, { 
    timestamps: true 
});

/**
 * MIDDLEWARE PRE-SAVE:
 * Realiza cálculos técnicos automáticos antes de guardar.
 * Mantiene intacta tu lógica de conversión de unidades.
 */
MaterialSchema.pre('save', function(next) {
    // Caso de materiales por área (Vidrios, Foams, etc)
    if (this.tipo === 'm2') {
        // 1. Cálculo del área: (Ancho * Largo) / 10,000
        const areaCalculada = (this.ancho_lamina_cm * this.largo_lamina_cm) / 10000;
        this.area_por_lamina_m2 = areaCalculada;
        
        // 2. Cálculo del costo m²
        if (areaCalculada > 0) {
            this.precio_m2_costo = Math.round(this.precio_total_lamina / areaCalculada);
        }
    } 
    // Caso de materiales por metro lineal (Marcos, Molduras)
    else if (this.tipo === 'ml') {
        if (this.largo_lamina_cm > 0) {
            // El "precio_m2_costo" aquí actúa como precio por metro lineal
            this.precio_m2_costo = Math.round(this.precio_total_lamina / (this.largo_lamina_cm / 100));
        }
    }
    
    // Validar que el stock no sea negativo
    if (this.stock_actual < 0) this.stock_actual = 0;

    next();
});

/**
 * EXPORTACIÓN CORREGIDA PARA SERVERLESS:
 * Mantenemos tu lógica de Singleton para evitar errores de re-definición en Netlify.
 */
module.exports = mongoose.models.Material || mongoose.model('Material', MaterialSchema, 'materiales');