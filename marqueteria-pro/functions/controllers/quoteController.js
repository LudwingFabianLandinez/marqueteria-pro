const Material = require('../models/Material');
const { calcularCostoMaterial } = require('../utils/calculator');

// 1. OBTENER MATERIALES ORGANIZADOS (Filtrado estricto por categoría)
exports.getQuotationMaterials = async (req, res) => {
    try {
        const materials = await Material.find().sort({ nombre: 1 });
        
        const categorizados = {
            vidrios: materials.filter(m => 
                m.nombre.toLowerCase().includes('vidrio') || 
                m.nombre.toLowerCase().includes('espejo')
            ),
            respaldos: materials.filter(m => 
                m.nombre.toLowerCase().includes('mdf') || 
                m.nombre.toLowerCase().includes('respaldo') || 
                m.nombre.toLowerCase().includes('triplex')
            ),
            paspartu: materials.filter(m => 
                m.nombre.toLowerCase().includes('paspartu') || 
                m.nombre.toLowerCase().includes('passepartout')
            ),
            marcos: materials.filter(m => 
                (m.nombre.toLowerCase().includes('marco') || m.nombre.toLowerCase().includes('moldura')) && 
                !m.nombre.toLowerCase().includes('chapilla')
            ),
            foam: materials.filter(m => m.nombre.toLowerCase().includes('foam')),
            tela: materials.filter(m => m.nombre.toLowerCase().includes('tela') || m.nombre.toLowerCase().includes('lona')),
            chapilla: materials.filter(m => m.nombre.toLowerCase().includes('chapilla'))
        };

        res.status(200).json({ success: true, data: categorizados });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. GENERAR COTIZACIÓN (Calcula costos y prepara datos para la venta)
exports.generateQuote = async (req, res) => {
    try {
        const { ancho, largo, materialesIds, manoObra = 0 } = req.body;

        if (!ancho || !largo || !materialesIds) {
            return res.status(400).json({ 
                success: false, 
                error: "⚠️ Medidas y materiales son obligatorios para cotizar." 
            });
        }

        const ids = Array.isArray(materialesIds) ? materialesIds : [materialesIds].filter(id => id && id !== "");
        const materialesDB = await Material.find({ _id: { $in: ids } });
        
        let costoMaterialesTotal = 0;
        let listaDetallada = [];
        const area_m2 = (Number(ancho) * Number(largo) / 10000);

        materialesDB.forEach(mat => {
            // Calculamos el costo real de este pedazo de material
            const costoItem = calcularCostoMaterial(Number(ancho), Number(largo), mat.precio_m2_costo);
            costoMaterialesTotal += costoItem;
            
            // AGREGAMOS DATOS CRÍTICOS: id, costo_m2_base y area_m2 para el reporte de utilidad
            listaDetallada.push({ 
                id: mat._id,
                nombre: mat.nombre, 
                costo_m2_base: mat.precio_m2_costo, // Precio de compra original
                area_m2: area_m2.toFixed(4),
                precio_proporcional: Math.round(costoItem) // Lo que te costó a ti ese pedazo
            });
        });

        const mo = parseFloat(manoObra) || 0;
        const subtotalCostoBase = Math.round(costoMaterialesTotal + mo);

        res.status(200).json({
            success: true,
            data: {
                detalles: {
                    medidas: `${ancho} x ${largo} cm`,
                    area_m2: area_m2.toFixed(4),
                    materiales: listaDetallada
                },
                costos: {
                    valor_materiales: Math.round(costoMaterialesTotal),
                    valor_mano_obra: mo,
                    total_base: subtotalCostoBase,
                    // Regla de Negocio: (Costo Total Materiales * 3) + Mano de Obra
                    precio_sugerido: Math.round((costoMaterialesTotal * 3) + mo) 
                }
            }
        });

    } catch (error) {
        console.error("🚨 Error en quoteController:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};