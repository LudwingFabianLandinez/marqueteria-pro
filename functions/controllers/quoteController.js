const Material = require('../models/Material');
const { calcularCostoMaterial } = require('../utils/calculator');

/**
 * CONTROLADOR DE COTIZACIONES - MARQUETERÍA LA CHICA MORALES
 * Calcula precios basados en la Regla de Oro: (Costo Materiales * 3) + Mano de Obra
 */

// 1. OBTENER MATERIALES ORGANIZADOS POR CATEGORÍA PARA EL SELECTOR
const getQuotationMaterials = async (req, res) => {
    try {
        // Traemos materiales con stock o precio, usando lean para velocidad
        const materials = await Material.find().sort({ nombre: 1 }).lean();
        
        if (!materials || materials.length === 0) {
            console.log("⚠️ No se encontraron materiales en la base de datos.");
        }

        // Categorización inteligente (Busca por campo 'categoria' o por palabras clave en 'nombre')
        const filtrar = (terminos, catNome) => materials.filter(m => 
            (m.categoria && m.categoria.toLowerCase() === catNome.toLowerCase()) ||
            terminos.some(t => m.nombre.toLowerCase().includes(t))
        );

        const categorizados = {
            vidrios: filtrar(['vidrio', 'espejo'], 'Vidrio'),
            respaldos: filtrar(['mdf', 'respaldo', 'triplex'], 'Respaldo'),
            paspartu: filtrar(['paspartu', 'passepartout', 'carton'], 'Paspartu'),
            marcos: materials.filter(m => 
                ((m.nombre.toLowerCase().includes('marco') || m.nombre.toLowerCase().includes('moldura')) || 
                 (m.categoria && m.categoria.toLowerCase() === 'moldura')) && 
                !m.nombre.toLowerCase().includes('chapilla')
            ),
            foam: filtrar(['foam', 'icopor'], 'Foam'),
            tela: filtrar(['tela', 'lona', 'lienzo'], 'Tela'),
            chapilla: filtrar(['chapilla'], 'Otros')
        };

        res.status(200).json({ 
            success: true, 
            count: materials.length,
            data: categorizados 
        });
    } catch (error) {
        console.error("🚨 Error en getQuotationMaterials:", error);
        res.status(500).json({ success: false, error: "Error al organizar materiales para cotización" });
    }
};

// 2. GENERAR COTIZACIÓN (CÁLCULO MATEMÁTICO)
const generateQuote = async (req, res) => {
    try {
        const { ancho, largo, materialesIds, manoObra = 0 } = req.body;

        // Validación de entrada
        if (!ancho || !largo || !materialesIds) {
            return res.status(400).json({ 
                success: false, 
                error: "⚠️ Medidas y materiales son obligatorios para cotizar." 
            });
        }

        // Normalizamos IDs a un Array y limpiamos valores nulos
        const ids = Array.isArray(materialesIds) ? materialesIds : [materialesIds];
        const idsValidos = ids.filter(id => id && id.toString().length === 24);
        
        // Buscamos materiales en la DB
        const materialesDB = await Material.find({ _id: { $in: idsValidos } }).lean();
        
        let costoMaterialesTotal = 0;
        let listaDetallada = [];
        
        // Cálculo de área con seguridad contra ceros (cm a m2)
        const area_m2 = (Math.max(0, Number(ancho)) * Math.max(0, Number(largo)) / 10000);

        materialesDB.forEach(mat => {
            // El precio de costo es vital para la utilidad. Buscamos en varios campos por si acaso.
            const precioCostoM2 = mat.precio_m2_costo || mat.precio_total_lamina || 0;
            
            // Usamos el utilitario de cálculo o lo hacemos manual si falla
            let costoItem = 0;
            if (typeof calcularCostoMaterial === 'function') {
                costoItem = calcularCostoMaterial(Number(ancho), Number(largo), precioCostoM2);
            } else {
                costoItem = area_m2 * precioCostoM2;
            }
            
            costoMaterialesTotal += costoItem;
            
            listaDetallada.push({ 
                id: mat._id,
                nombre: mat.nombre, 
                costo_m2_base: precioCostoM2,
                area_m2: area_m2.toFixed(4),
                precio_proporcional: Math.round(costoItem)
            });
        });

        const mo = parseFloat(manoObra) || 0;
        const totalBaseCosto = Math.round(costoMaterialesTotal + mo);
        
        /**
         * REGLA DE ORO DE LA MARQUETERÍA:
         * El precio de venta debe cubrir desperdicio, local y ganancia.
         * Formula: (Costo Materiales * 3) + Mano de Obra
         */
        const precioSugerido = Math.round((costoMaterialesTotal * 3) + mo);

        res.status(200).json({
            success: true,
            data: {
                detalles: {
                    medidas: `${ancho} x ${largo} cm`,
                    area_m2: area_m2.toFixed(4),
                    materiales: listaDetallada
                },
                costos: {
                    valor_materiales_costo: Math.round(costoMaterialesTotal),
                    valor_mano_obra: mo,
                    total_solo_costo: totalBaseCosto,
                    precio_sugerido_venta: precioSugerido 
                }
            }
        });

    } catch (error) {
        console.error("🚨 Error en generateQuote:", error);
        res.status(500).json({ success: false, error: "Error interno en el cálculo de la cotización." });
    }
};

module.exports = {
    getQuotationMaterials,
    getMaterials: getQuotationMaterials,
    generateQuote,
    calculate: generateQuote
};