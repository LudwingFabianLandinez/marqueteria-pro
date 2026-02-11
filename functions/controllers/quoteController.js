const Material = require('../models/Material');
const { calcularCostoMaterial } = require('../utils/calculator');

// 1. OBTENER MATERIALES ORGANIZADOS
exports.getQuotationMaterials = async (req, res) => {
    try {
        // Traemos solo los materiales que tienen stock o precio definido
        const materials = await Material.find().sort({ nombre: 1 });
        
        if (!materials || materials.length === 0) {
            console.log("⚠️ No se encontraron materiales en la base de datos.");
        }

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

        // Enviamos la respuesta. Este es el trigger que quita el "Cargando..."
        res.status(200).json({ 
            success: true, 
            count: materials.length,
            data: categorizados 
        });
    } catch (error) {
        console.error("🚨 Error en getQuotationMaterials:", error);
        res.status(500).json({ success: false, error: "Error al organizar materiales" });
    }
};

// 2. GENERAR COTIZACIÓN
exports.generateQuote = async (req, res) => {
    try {
        const { ancho, largo, materialesIds, manoObra = 0 } = req.body;

        // Validación de entrada
        if (!ancho || !largo || !materialesIds) {
            return res.status(400).json({ 
                success: false, 
                error: "⚠️ Medidas y materiales son obligatorios para cotizar." 
            });
        }

        // Normalizamos IDs a un Array
        const ids = Array.isArray(materialesIds) ? materialesIds : [materialesIds].filter(id => id && id !== "");
        
        // Buscamos materiales en la DB
        const materialesDB = await Material.find({ _id: { $in: ids } });
        
        let costoMaterialesTotal = 0;
        let listaDetallada = [];
        
        // Cálculo de área con seguridad contra ceros
        const area_m2 = (Math.max(0, Number(ancho)) * Math.max(0, Number(largo)) / 10000);

        materialesDB.forEach(mat => {
            // Usamos el calculador de utilidad para obtener el costo base
            const precioCostoM2 = mat.precio_m2_costo || 0;
            const costoItem = calcularCostoMaterial(Number(ancho), Number(largo), precioCostoM2);
            
            costoMaterialesTotal += costoItem;
            
            listaDetallada.push({ 
                id: mat._id,
                nombre: mat.nombre, 
                costo_m2_base: precioCostoM2,
                area_m2: area_m2,
                precio_proporcional: Math.round(costoItem)
            });
        });

        const mo = parseFloat(manoObra) || 0;
        const totalBaseCosto = Math.round(costoMaterialesTotal + mo);
        
        // REGLA DE ORO: Costo x 3 + Mano de Obra
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
                    valor_materiales: Math.round(costoMaterialesTotal),
                    valor_mano_obra: mo,
                    total_base: totalBaseCosto,
                    precio_sugerido: precioSugerido 
                }
            }
        });

    } catch (error) {
        console.error("🚨 Error en generateQuote:", error);
        res.status(500).json({ success: false, error: "Error interno en el cálculo." });
    }
};