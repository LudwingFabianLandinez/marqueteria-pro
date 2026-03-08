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

// --- TABLA DE DESPERDICIO (Se mantiene externa para integridad) ---
const obtenerMLConDesperdicio = (a, l) => {
    const min = Math.min(Number(a), Number(l));
    const max = Math.max(Number(a), Number(l));
    if (min <= 20 && max <= 20) return 1.20;
    if (min <= 20 && max <= 80) return 2.50;
    if (min <= 40 && max <= 80) return 2.80; 
    if (min <= 60 && max <= 80) return 3.40; 
    if (min <= 80 && max <= 100) return 4.20;
    if (min <= 100 && max <= 100) return 4.50;
    return Number((((Number(a) + Number(l)) * 2) / 100 * 1.20).toFixed(2));
};

const generateQuote = async (req, res) => {
    try {
        const { ancho, largo, materialesIds, manoObra = 0 } = req.body;

        // 1. Validación de entrada (Intacta)
        if (!ancho || !largo || !materialesIds) {
            return res.status(400).json({ 
                success: false, 
                error: "⚠️ Medidas y materiales son obligatorios para cotizar." 
            });
        }

        // 2. Normalización de IDs (Intacta)
        const ids = Array.isArray(materialesIds) ? materialesIds : [materialesIds];
        const idsValidos = ids.filter(id => id && id.toString().length === 24);
        
        const materialesDB = await Material.find({ _id: { $in: idsValidos } }).lean();
        
        let costoMaterialesTotal = 0;
        let listaDetallada = [];
        
        // 3. Cálculos Base (Intactos)
        const area_m2 = (Math.max(0, Number(ancho)) * Math.max(0, Number(largo)) / 10000);
        const gastoML = obtenerMLConDesperdicio(ancho, largo);

        // 4. Bucle de Materiales con Detección Blindada
        materialesDB.forEach(mat => {
            const nombreUP = (mat.nombre || "").toUpperCase();

            /**
             * DETECCIÓN REDUNDANTE (La clave del éxito):
             * Prioridad 1: Campo 'tipo' de Atlas sea 'ml'.
             * Prioridad 2: Si tiene un 'largo_lamina_cm' definido (como tus 290).
             * Prioridad 3: Palabras clave en el nombre.
             */
            const esMoldura = (mat.tipo && mat.tipo.toLowerCase().includes("ml")) || 
                              (mat.largo_lamina_cm && Number(mat.largo_lamina_cm) > 0) ||
                              nombreUP.includes("MOLDURA") || 
                              nombreUP.includes("MARCO") || 
                              nombreUP.includes("K "); 

            // Sincronización de Precios
            const precioCostoBase = mat.precio_total_lamina || mat.precio_m2_costo || mat.precio || 0;
            
            let costoItem = 0;

            if (esMoldura) {
                // --- LÓGICA DE MOLDURA ---
                // Si Atlas dice que mide 290cm, usamos 2.9m. Si no, por defecto 2.90m.
                const largoTiraMetros = mat.largo_lamina_cm ? (Number(mat.largo_lamina_cm) / 100) : 2.90;
                const precioMetroLineal = precioCostoBase / largoTiraMetros;
                costoItem = precioMetroLineal * gastoML;
            } else {
                // --- LÓGICA DE SUPERFICIE (VIDRIOS) ---
                costoItem = area_m2 * precioCostoBase;
            }
            
            costoMaterialesTotal += costoItem;
            
            listaDetallada.push({ 
                id: mat._id,
                nombre: mat.nombre, 
                identificado_como: esMoldura ? "MOLDURA" : "LÁMINA/VIDRIO",
                costo_base_db: precioCostoBase,
                unidad_calculo: esMoldura ? "ML" : "m2",
                cantidad_aplicada: esMoldura ? gastoML : area_m2.toFixed(4),
                precio_proporcional: Math.round(costoItem)
            });
        });

        // 5. Cálculos Finales y REGLA DE ORO (Multiplicador x3)
        const mo = parseFloat(manoObra) || 0;
        const totalBaseCosto = Math.round(costoMaterialesTotal + mo);
        const precioSugerido = Math.round((costoMaterialesTotal * 3) + mo);

        // 6. Respuesta JSON (Estructura Original con detalles extra para auditoría)
        res.status(200).json({
            success: true,
            data: {
                detalles: {
                    medidas: `${ancho} x ${largo} cm`,
                    area_m2: area_m2.toFixed(2),
                    gasto_ml_calculado: gastoML,
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
        res.status(500).json({ success: false, error: "Error interno en el cálculo." });
    }
};

module.exports = {
    generateQuote,
    calculate: generateQuote
};