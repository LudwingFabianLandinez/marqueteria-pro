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

        // 4. Bucle de Materiales con Detección Mejorada
        materialesDB.forEach(mat => {
            const nombreUP = (mat.nombre || "").toUpperCase();

            /**
             * MEJORA DE DETECCIÓN:
             * Ahora busca "MOLDURA" en cualquier parte del texto para evitar que falle
             * si el nombre empieza por MP o espacios.
             */
            const esMoldura = nombreUP.includes("MOLDURA") || 
                              nombreUP.includes("MARCO") || 
                              nombreUP.includes("K "); 

            // Prioridad de campos de precio (Sincronizado con Inventario)
            const precioCostoBase = mat.precio_total_lamina || mat.precio_m2_costo || 0;
            
            let costoItem = 0;

            if (esMoldura) {
                // --- LÓGICA DE MOLDURA (ML x Costo Proporcional) ---
                // Dividimos el costo de la tira de 2.90m para sacar el metro lineal
                const precioMetroLineal = precioCostoBase / 2.90;
                costoItem = precioMetroLineal * gastoML;
            } else {
                // --- LÓGICA DE SUPERFICIE (M2 x Costo Base) ---
                costoItem = area_m2 * precioCostoBase;
            }
            
            costoMaterialesTotal += costoItem;
            
            // Estructura de listaDetallada (Mantenida según tus requerimientos)
            listaDetallada.push({ 
                id: mat._id,
                nombre: mat.nombre, 
                costo_base: precioCostoBase,
                area_o_ml: esMoldura ? `${gastoML} ML` : `${area_m2.toFixed(2)} m2`,
                precio_proporcional: Math.round(costoItem)
            });
        });

        // 5. Cálculos Finales y REGLA DE ORO (Mantenida x3)
        const mo = parseFloat(manoObra) || 0;
        const totalBaseCosto = Math.round(costoMaterialesTotal + mo);
        const precioSugerido = Math.round((costoMaterialesTotal * 3) + mo);

        // 6. Respuesta JSON (Estructura Original Preservada)
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
        res.status(500).json({ success: false, error: "Error interno en el cálculo de la cotización." });
    }
};

module.exports = {
    getQuotationMaterials,
    getMaterials: getQuotationMaterials,
    generateQuote,
    calculate: generateQuote
};