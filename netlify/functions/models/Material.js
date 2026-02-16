const mongoose = require('mongoose');

/**
 * MODELO DE MATERIALES - MARQUETERÍA LA CHICA MORALES
 * Versión: 12.8.0 - MOTOR MATEMÁTICO INTEGRADO Y BLINDAJE 360°
 * Objetivo: Garantizar la integridad de precios y áreas en MongoDB Atlas.
 */
const MaterialSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        required: true, 
        trim: true 
    },
    // Categoría blindada: Sincronizada con el sistema v12.x
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
            'General', 
            'Otros'
        ],
        default: 'Otros'
    },
    tipo: { 
        type: String, 
        enum: ['m2', 'ml'], 
        default: 'm2' 
    },
    // Dimensiones físicas (Blindadas contra valores negativos)
    ancho_lamina_cm: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0
    }, 
    largo_lamina_cm: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0
    }, 
    // Costos y Precios Maestros
    precio_total_lamina: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0
    }, 
    precio_m2_costo: { 
        type: Number,
        default: 0,
        min: 0
    },
    // Precio de venta sugerido (Base para cotizador)
    precio_venta_sugerido: {
        type: Number,
        default: 0,
        min: 0
    },
    // Gestión de existencias
    stock_actual: { 
        type: Number, 
        default: 0 
    }, 
    stock_minimo: { 
        type: Number, 
        default: 2 // Umbral para alertas en Dashboard
    },
    area_por_lamina_m2: { 
        type: Number,
        default: 0
    },
    /**
     * Referencia al modelo único Provider.
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
 * ⚖️ MIDDLEWARE PRE-SAVE v12.8.0:
 * Blindaje final: El servidor recalcula todo antes de escribir en disco.
 * Esto erradica errores de desincronización de precios.
 */
MaterialSchema.pre('save', function(next) {
    // 1. Limpieza de seguridad: Evitamos valores negativos accidentales
    this.ancho_lamina_cm = Math.abs(this.ancho_lamina_cm || 0);
    this.largo_lamina_cm = Math.abs(this.largo_lamina_cm || 0);
    this.precio_total_lamina = Math.abs(this.precio_total_lamina || 0);

    // 2. Lógica para materiales por Área (Vidrio, Foam, etc.)
    if (this.tipo === 'm2') {
        const areaCalculada = (this.ancho_lamina_cm * this.largo_lamina_cm) / 10000;
        this.area_por_lamina_m2 = areaCalculada;
        
        if (areaCalculada > 0) {
            // El "Precio de Peso": Forzamos el redondeo para evitar decimales infinitos
            this.precio_m2_costo = Math.round(this.precio_total_lamina / areaCalculada);
        }
    } 
    // 3. Lógica para materiales por Metro Lineal (Marcos, Molduras)
    else if (this.tipo === 'ml') {
        if (this.largo_lamina_cm > 0) {
            this.precio_m2_costo = Math.round(this.precio_total_lamina / (this.largo_lamina_cm / 100));
        }
    }
    
    // 4. Protección de Stock
    if (this.stock_actual < 0) this.stock_actual = 0;

    console.log(`💾 [Model v12.8.0]: Guardando ${this.nombre} - Costo final: $${this.precio_m2_costo}`);
    next();
});

/**
 * EXPORTACIÓN CORREGIDA PARA SERVERLESS (NETLIFY):
 * Mantenemos el Singleton para evitar el error "Cannot overwrite model once compiled".
 */
module.exports = mongoose.models.Material || mongoose.model('Material', MaterialSchema, 'materiales');