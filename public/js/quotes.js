/**
 * Lógica del Cotizador y Facturación - MARQUETERÍA LA CHICA MORALES
 * Versión: 13.1.7 - CONSOLIDACIÓN ESTRICTA (FRONT 13.1.7 + BACK 13.1.0)
 * Objetivo: Asegurar que la venta se registre respetando el diseño y el blindaje actual.
 */

let datosCotizacionActual = null;
let materialesOriginales = []; 

document.addEventListener('DOMContentLoaded', async () => {
    const selects = {
        Vidrio: document.getElementById('materialId'),
        Respaldo: document.getElementById('materialRespaldoId'),
        Paspartu: document.getElementById('materialExtraId'),
        Marco: document.getElementById('materialOtroId'),
        Foam: document.getElementById('materialFoamId'),
        Tela: document.getElementById('materialTelaId'),
        Chapilla: document.getElementById('materialChapillaId')
    };

    if (!selects.Vidrio) return;

    try {
        Object.values(selects).forEach(s => { if(s) s.innerHTML = '<option>Cargando materiales...</option>'; });

        const response = await fetch('/.netlify/functions/server/quotes/materials');
        const result = await response.json();
        
        console.log("📡 DATOS LLEGANDO DEL SERVIDOR:", result);

        if (result.success) {
            const cat = result.data;
            
            // 1. UNIFICACIÓN INICIAL (Servidor)
            let inventarioHibrido = cat.todos || [];

            // 🚀 --- BLOQUE DE RESCATE LOCAL ---
            const localMaterials = JSON.parse(localStorage.getItem('inventory') || '[]');
            localMaterials.forEach(lm => {
                const nombreLimpioLocal = (lm.nombre || "").trim().toUpperCase();
                
                const yaExisteEnServidor = inventarioHibrido.some(m => 
                    (m.nombre || "").trim().toUpperCase() === nombreLimpioLocal
                );

                if (!yaExisteEnServidor && nombreLimpioLocal !== "") {
                    inventarioHibrido.push({
                        ...lm,
                        costo_base: lm.costo_m2 || lm.precio_m2_costo || 0,
                        stock_actual: lm.stock_actual || 0,
                        unidad: (lm.tipo || 'm2').toUpperCase()
                    });
                }
            });

            // 🔥 --- EL FILTRO MAESTRO ANTI-DUPLICADOS (VERSIÓN FINAL) ---
            // Este bloque asegura que si queda algún duplicado por caché, se elimine aquí.
            let inventarioCompleto = [];
            let nombresVistos = new Set();

            inventarioHibrido.forEach(m => {
                const nombreKey = (m.nombre || "").trim().toUpperCase();
                if (!nombresVistos.has(nombreKey) && nombreKey !== "" && !nombreKey.includes("UNDEFINED")) {
                    nombresVistos.add(nombreKey);
                    inventarioCompleto.push(m);
                }
            });

            // ALERT DE VERIFICACIÓN
            const busquedaCritica = inventarioCompleto.filter(m => 
                m.nombre && (m.nombre.toUpperCase().includes("2312") || m.nombre.toUpperCase().includes("2311"))
            );

            if (busquedaCritica.length === 0) {
                console.warn("🚨 ALERTA: Molduras críticas no encontradas.");
            } else {
                console.log("✅ MOLDURAS DETECTADAS:", busquedaCritica);
            }

            materialesOriginales = inventarioCompleto;

            const datalist = document.getElementById('lista-molduras');
            if (datalist) datalist.innerHTML = '';

// 2. FUNCIÓN DE LLENADO INTELIGENTE
            const llenar = (select, filtroBusqueda, esParaBuscador = false) => {
                if (!select) return;
                select.innerHTML = `<option value="">-- Seleccionar --</option>`;
                
                const listaFiltrada = inventarioCompleto.filter(filtroBusqueda);

                if (listaFiltrada.length === 0) {
                    select.innerHTML = `<option value="">-- No disponible --</option>`;
                    return;
                }
                
                listaFiltrada.forEach(m => {
                    if (!m.nombre || m.nombre.trim() === "" || m.nombre.includes("undefined")) return;

                    const stock = m.stock_actual || 0;
                    // --- 🛡️ NORMALIZACIÓN DE UNIDAD ---
                    // Priorizamos lo que venga de Atlas (m.unidad o m.tipo)
                    let unidad = (m.unidad || m.tipo || "m2").toUpperCase();
                    const nombreM = m.nombre.toUpperCase();
                    const categoriaM = (m.categoria || "").toUpperCase();
                    
                    // --- 🔍 DETECCIÓN REFORZADA DE MOLDURA ---
                    const esML = unidad === 'ML' || 
                                 nombreM.includes("MOLDURA") || 
                                 nombreM.includes("MARCO") || 
                                 nombreM.startsWith("K ") ||
                                 nombreM.includes("2312") ||
                                 categoriaM.includes("MOLDURA");

                    // Si es moldura, forzamos que la unidad sea ML para el calculador
                    if (esML) unidad = 'ML';

                    const color = stock <= 0 ? 'color: #ef4444; font-weight: bold;' : '';
                    const avisoStock = stock <= 0 ? '(SIN STOCK)' : `(${stock.toFixed(2)} ${unidad})`;
                    
                    const option = document.createElement('option');
                    option.id = `opt-${m._id || m.id}`;
                    option.value = m._id || m.id;
                    option.style = color;

                    // --- 💰 EXTRACCIÓN DE PRECIO MULTI-CAMPO ---
                    const precio = m.precio_m2_costo || m.costo_m2 || m.costo_base || 0;
                    
                    // Inyectamos los datos críticos en el dataset del HTML
                    option.dataset.costo = precio;
                    option.dataset.unidad = unidad; // Queda como ML o M2
                    option.dataset.categoria = categoriaM;
                    
                    option.textContent = `${nombreM} ${avisoStock}`;
                    select.appendChild(option);

                    // Si es moldura, la agregamos al datalist del buscador
                    if (esML && datalist && esParaBuscador) {
                        const optBusqueda = document.createElement('option');
                        optBusqueda.value = nombreM;
                        // Guardamos el ID en el datalist para que el buscador sepa qué seleccionar
                        optBusqueda.dataset.id = m._id || m.id; 
                        datalist.appendChild(optBusqueda);
                    }
                });
            };

            // 3. REPARTO QUIRÚRGICO (TRIPLEX + CARTÓN UNIFICADOS)
            llenar(selects.Vidrio, m => {
                const n = (m.nombre || "").toUpperCase();
                const esRespaldo = n.includes("TRIPLEX") || n.includes("CARTON") || n.includes("CARTÓN") || n.includes("MDF");
                return (n.includes("VIDRIO") || n.includes("ESPEJO") || n.includes("3MM") || n.includes("2MM")) && !esRespaldo;
            });

            llenar(selects.Respaldo, m => {
                const n = (m.nombre || "").toUpperCase();
                return n.includes("RESPALDO") || n.includes("MDF") || n.includes("CARTON") || n.includes("CARTÓN") || n.includes("TRIPLEX") || n.includes("CELTEX");
            });

            llenar(selects.Paspartu, m => {
                const n = (m.nombre || "").toUpperCase();
                return n.includes("PASPARTU") || n.includes("PASSEPARTOUT") || n.includes("CARTULINA");
            });
            
            // --- 🛡️ REPARTO DE MOLDURAS (FILTRO REFORZADO PARA "K ") ---
            llenar(selects.Marco, m => {
                const n = (m.nombre || "").toUpperCase();
                const u = (m.unidad || m.tipo || "").toUpperCase();
                const c = (m.categoria || "").toUpperCase();
                
                // Si el nombre empieza con K, ES MOLDURA sí o sí
                const esK = n.startsWith("K ");
                const esMolduraPorNombre = n.includes("MOLDURA") || n.includes("MARCO") || n.includes("MADERA") || n.includes("2312");
                const esMolduraPorUnidad = u === "ML";
                const esMolduraPorCategoria = c.includes("MOLDURA") || c.includes("MARCO");
                
                return esK || esMolduraPorNombre || esMolduraPorUnidad || esMolduraPorCategoria;
            }, true);
            
            llenar(selects.Foam, m => (m.nombre || "").toUpperCase().includes("FOAM"));
            
            llenar(selects.Tela, m => {
                const n = (m.nombre || "").toUpperCase();
                return n.includes("TELA") || n.includes("LONA") || n.includes("CANVAS");
            });
            
            llenar(selects.Chapilla, m => (m.nombre || "").toUpperCase().includes("CHAPILLA"));
            
            console.log("🚀 Sincronización terminada. Únicos:", inventarioCompleto.length);
        }
    } catch (error) {
        console.error("🚨 Error:", error);
        Object.values(selects).forEach(s => { if(s) s.innerHTML = '<option>Error de conexión</option>'; });
    }
});

function limpiarTextosNoDeseados() {
    const divRes = document.getElementById('resultado');
    if (!divRes) return;
    const elementos = divRes.querySelectorAll('p, b, span, div');
    elementos.forEach(el => {
        const contenido = el.innerText.toLowerCase();
        const esCostoInterno = contenido.includes('costo base') || contenido.includes('mano de obra');
        const estaFueraDeZonasSeguras = !el.closest('#printArea') && !el.closest('#containerAcciones');
        if (esCostoInterno && estaFueraDeZonasSeguras) el.remove(); 
        if (contenido.includes('total venta') && contenido.includes('$ 0') && estaFueraDeZonasSeguras) el.remove();
    });
}

async function procesarCotizacion() {
    const btnCalc = document.querySelector('.btn-calc');
    const ancho = parseFloat(document.getElementById('ancho').value);
    const largo = parseFloat(document.getElementById('largo').value);
    const manoObraInput = parseFloat(document.getElementById('manoObra').value) || 0;

    // 1. Recolección de materiales estándar (Vidrio, Respaldo, etc.)
    const selectsIds = [
        'materialId', 'materialRespaldoId', 'materialExtraId', 
        'materialOtroId', 'materialFoamId', 'materialTelaId', 'materialChapillaId'
    ];

    // Mapeo inteligente con Blindaje Multi-Campo (Sincronizado)
    let materialesSeleccionados = selectsIds
        .map(id => {
            const el = document.getElementById(id);
            if (!el || !el.value || el.value === "") return null;
            
            const opcion = el.options[el.selectedIndex];
            if (!opcion) return null;

            // --- 🛡️ EXTRACCIÓN DE COSTO MULTI-ORIGEN ---
            const costoExtraido = parseFloat(opcion.dataset.costo) || 
                                 parseFloat(opcion.dataset.costom2) || 
                                 parseFloat(opcion.dataset.precio) || 0;

            // --- 🛡️ EXTRACCIÓN Y CLASIFICACIÓN CONTUNDENTE ---
            const nombreMat = (opcion.text || "").toUpperCase();
            const categoriaMat = (opcion.dataset.categoria || "").toUpperCase();
            const unidadDataset = (opcion.dataset.unidad || "").toLowerCase();
            
            // BLINDAJE TOTAL: Si es ML en Atlas, o si el nombre contiene marcas clave, ES ML.
            const esML = unidadDataset === 'ml' || 
                         categoriaMat.includes("MOLDURA") || 
                         nombreMat.includes("MOLDURA") || 
                         nombreMat.includes("MARCO") || 
                         nombreMat.startsWith("K ") ||
                         nombreMat.includes("2312") || // Moldura específica de prueba
                         nombreMat.includes("2311");

            return {
                id: el.value,
                nombre: opcion.text.split('(')[0].trim(),
                costoUnitario: costoExtraido, // Ahora este valor es $/Metro Lineal gracias al Punto 1
                unidad: esML ? 'ML' : 'M2'
            };
        })
        .filter(m => m !== null && m.costoUnitario > 0);

    // --- 🕵️‍♂️ RASTREO QUIRÚRGICO DEL BUSCADOR DE MOLDURAS ---
    const inputTextoMoldura = document.getElementById('input-moldura');
    const selectMolduraOculto = document.getElementById('materialOtroId');

    if (inputTextoMoldura && inputTextoMoldura.value.trim() !== "") {
        const optM = selectMolduraOculto.options[selectMolduraOculto.selectedIndex];
        const yaIncluido = materialesSeleccionados.find(m => m.id === selectMolduraOculto.value);

        if (optM && optM.value !== "" && !yaIncluido) {
            const costoM = parseFloat(optM.dataset.costo) || 
                           parseFloat(optM.dataset.costom2) || 
                           parseFloat(optM.dataset.precio) || 0;

            materialesSeleccionados.push({
                id: selectMolduraOculto.value,
                nombre: inputTextoMoldura.value.split('(')[0].trim(),
                costoUnitario: costoM,
                unidad: 'ML'
            });
        }
    }

    if (!ancho || !largo || materialesSeleccionados.length === 0) {
        alert("⚠️ Por favor ingresa medidas y selecciona al menos un material.");
        return;
    }
    
// --- 📐 LÓGICA DE GASTO REAL DE MOLDURA (FÓRMULA EXACTA DE TALLER) ---
const obtenerMLConDesperdicio = (a, l, materialEspecífico) => {
    const ancho = parseFloat(a) || 0;
    const largo = parseFloat(l) || 0;
    
    // 1. Suma de lados x 2 (Perímetro base en CM)
    const perimetroCM = (ancho + largo) * 2;
    
    // 2. Recuperar desperdicio desde el material o usar 15cm por defecto
    const desperdicioCM = parseFloat(materialEspecífico?.desperdicio) || 15;
    
    // 3. Cálculo final en Metros Lineales (ML)
    const totalML = (perimetroCM + desperdicioCM) / 100;
    
    return Number(totalML.toFixed(2));
};

try {
    if(btnCalc) btnCalc.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculando...';
    
    const areaCalculada = Number(((ancho * largo) / 10000).toFixed(2)); 
    let totalVentaAcumulado = 0;
    let costoBaseAcumulado = 0;
    let resumenGastoML = ""; // Para el reporte visual

   // --- 💰 CÁLCULO SUMATORIO DE MATERIALES (DENTRO DE procesarCotizacion) ---
        materialesSeleccionados.forEach(m => {
            let costoItem = 0;
            let ventaItem = 0;

            if (m.unidad === 'ML') {
                // 1. LÓGICA DE MOLDURA: Perímetro Real + 15cm Desperdicio
                const gastoMLReal = obtenerMLConDesperdicio(ancho, largo, m);
                costoItem = Math.round(m.costoUnitario * gastoMLReal);
                
                // REGLA DE ORO: Molduras se multiplican por 2.5
                ventaItem = Math.round(costoItem * 2.5);
                
                // Sincronización para el reporte y otros archivos
                m.cantidadUsada = gastoMLReal; 
                m.subtotalVenta = ventaItem; 
                m.tipoMedida = "ML"; // Identificador para el reporte
                resumenGastoML = `${gastoMLReal} ML`;

                console.log(`📏 MOLDURA: ${m.nombre} | ML: ${gastoMLReal} | Costo: ${costoItem} | Venta(x2.5): ${ventaItem}`);
            } else {
                // 2. LÓGICA DE OTROS: Área M2
                costoItem = Math.round(m.costoUnitario * areaCalculada);
                
                // REGLA: Otros materiales (Vidrio/Fondo) se multiplican por 3
                ventaItem = Math.round(costoItem * 3);
                
                // Sincronización para el reporte y otros archivos
                m.cantidadUsada = areaCalculada;
                m.subtotalVenta = ventaItem;
                m.tipoMedida = "M2"; // Identificador para el reporte

                console.log(`🪟 OTRO: ${m.nombre} | Area: ${areaCalculada} | Costo: ${costoItem} | Venta(x3): ${ventaItem}`);
            }

            // Mantener integridad de acumuladores existentes
            costoBaseAcumulado += costoItem;
            totalVentaAcumulado += ventaItem;
        });
        

    // --- 📈 TOTAL FINAL: Materiales con Utilidad + Mano de Obra ---
    // --- 📈 PUNTO 2: CONSOLIDACIÓN DE TOTALES Y RENTABILIDAD REAL ---
    // totalVentaAcumulado ya trae la suma de (Molduras x2.5 + Otros x3)
    const totalFinalCalculado = Math.round(totalVentaAcumulado + manoObraInput);
    
    // REGLA DE ORO SOLICITADA: Total Orden - Suma de Costos Base - Mano de Obra
    const rentabilidadFinal = Math.round(totalFinalCalculado - costoBaseAcumulado - manoObraInput);

    let dataFinal = {
        valor_materiales: costoBaseAcumulado,    // Suma de costos base (lo que te cuesta a ti)
        suma_costos: costoBaseAcumulado,         // Alias para compatibilidad con otros archivos
        precioSugeridoCliente: totalFinalCalculado, // El valor que paga el cliente
        area: areaCalculada,
        anchoOriginal: ancho,
        largoOriginal: largo,
        areaFinal: areaCalculada,
        valor_mano_obra: manoObraInput,
        rentabilidad: rentabilidadFinal,         // Utilidad neta real del taller
        detalles: { 
            medidas: `${ancho} x ${largo} cm ${resumenGastoML ? '(Uso: ' + resumenGastoML + ')' : ''}`, 
            materiales: materialesSeleccionados 
        }
    };
    
    // Sincronización con la persistencia global
    datosCotizacionActual = dataFinal;
    
    // Enviamos los datos listos al reporte visual
    if (typeof mostrarResultado === 'function') {
        mostrarResultado(dataFinal);
    }
    
    // Navegación automática para ver el resultado
    const resDiv = document.getElementById('resultado');
    if (resDiv) {
        resDiv.scrollIntoView({ behavior: 'smooth' });
    }

} catch (error) {
    console.error("🚨 Error crítico en el cálculo:", error);
} finally {
    if(btnCalc) btnCalc.innerHTML = '<i class="fas fa-coins"></i> Calcular Precio Final';
}
}

// FUNCIÓN PARA EL BUSCADOR INTELIGENTE (Punto 2b)
function sincronizarBuscadorMoldura(valor) {
    const selectMarco = document.getElementById('materialOtroId');
    const datalist = document.getElementById('lista-molduras');
    
    // Buscar si el valor escrito coincide con alguna opción del datalist
    const opciones = datalist.options;
    for (let i = 0; i < opciones.length; i++) {
        if (opciones[i].value === valor.toUpperCase()) {
            selectMarco.value = opciones[i].dataset.id;
            // Opcional: disparar un efecto visual de que se seleccionó
            selectMarco.style.backgroundColor = "#e0f2fe";
            setTimeout(() => selectMarco.style.backgroundColor = "", 500);
            return;
        }
    }
}

function actualizarSaldoEnRecibo() {
    if (!datosCotizacionActual) return;
    const abono = parseFloat(document.getElementById('abonoInicial').value) || 0;
    const total = datosCotizacionActual.precioSugeridoCliente;
    const saldo = total - abono;
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

    const abonoElement = document.getElementById('montoAbonoRecibo');
    const saldoElement = document.getElementById('montoSaldoRecibo');

    if (abonoElement) abonoElement.innerText = `- ${formatter.format(abono)}`;
    if (saldoElement) {
        saldoElement.innerText = formatter.format(saldo);
        saldoElement.style.color = saldo > 0 ? '#dc2626' : '#059669';
    }
    limpiarTextosNoDeseados();
}

    function mostrarResultado(data) {
    const divRes = document.getElementById('resultado');
    
    // --- BLOQUE DE ANCHO TOTAL (Blindaje de Diseño) ---
    divRes.style.display = 'block';
    divRes.style.width = '100%';
    divRes.style.maxWidth = 'none'; 
    divRes.style.boxSizing = 'border-box';
    // --------------------------------------------------

    divRes.innerHTML = '<div id="detalleObra" style="width:100%;"></div><div id="containerAcciones" style="width:100%;"></div>';

    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

    // --- 🖋️ GENERADOR DE LISTA DE MATERIALES (CORREGIDO: ML/M2 + SUBTOTALES) ---
    const materialesValidos = data.detalles?.materiales || [];
    const itemsHTML = materialesValidos.length > 0 
        ? materialesValidos.map(m => {
            const nombreVisual = (m.nombre || "MATERIAL").toUpperCase();
            const unidadVisual = (m.unidad || "").toUpperCase();
            
            // 🛡️ RESCATE DE MEDIDA: Usamos cantidadUsada (ML) si existe, sino el área (M2)
            const medidaExacta = m.cantidadUsada ? m.cantidadUsada : (unidadVisual === 'M2' ? data.areaFinal : '--');
            const subtotalVisual = formatter.format(m.subtotalVenta || 0);
            
            return `<li style="margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; display: flex; justify-content: space-between; align-items: flex-start;">
                <span style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; color: #1e3a8a; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle" style="color:#10b981; font-size: 0.9rem;"></i> 
                        ${nombreVisual}
                    </span>
                    <small style="color: #64748b; margin-left: 22px; font-size: 0.75rem; font-weight: 500;">
                        CANTIDAD: ${medidaExacta} ${unidadVisual}
                    </small>
                </span>
                <span style="font-weight: 700; color: #1e293b; font-size: 0.9rem; padding-top: 2px;">
                    ${subtotalVisual}
                </span>
            </li>`;
        }).join('')
        : '<li style="color: #94a3b8;">No se seleccionaron materiales</li>';

    document.getElementById('detalleObra').innerHTML = `
        <div id="printArea" style="background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif; width: 100%; box-sizing: border-box; margin: 0 auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
                <div>
                    <h2 style="margin:0; color: #1e3a8a; font-size: 1.5rem;">ORDEN DE TRABAJO</h2>
                    <small style="color: #64748b;">Marquetería La Chica Morales</small>
                </div>
                <div style="text-align: right;">
                    <span style="display:block; font-weight: bold; color: #1e3a8a;">COTIZACIÓN</span>
                    <span style="color: #64748b; font-size: 0.9rem;">${new Date().toLocaleDateString()}</span>
                </div>
            </div>
            
            <p style="margin: 15px 0; font-size: 1.1rem; color: #1e293b; background: #f1f5f9; padding: 12px; border-radius: 6px; border-left: 4px solid #1e3a8a;">
                <strong>Medidas Marco:</strong> ${data.detalles?.medidas || '--'}
            </p>

            <h4 style="color: #475569; margin: 20px 0 10px 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">
                Desglose de Materiales:
            </h4>
            
            <ul style="list-style:none; padding-left:0; margin:10px 0; font-size:0.95rem; color:#334155;">
                ${itemsHTML}
            </ul>

            <div style="margin-top: 25px; padding: 20px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #64748b; font-weight: 600;">VALOR TOTAL:</span>
                    <span style="font-weight: 700; color: #1e293b; font-size: 1.5rem;">${formatter.format(data.precioSugeridoCliente)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #059669;">
                    <span style="font-weight: 600;">ABONO RECIBIDO:</span>
                    <span id="montoAbonoRecibo" style="font-weight: 700;">- ${formatter.format(0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px dashed #cbd5e1;">
                    <span style="font-weight: 800; color: #1e293b;">SALDO PENDIENTE:</span>
                    <span id="montoSaldoRecibo" style="font-size: 1.8rem; font-weight: 900; color: #dc2626;">${formatter.format(data.precioSugeridoCliente)}</span>
                </div>
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                <h4 style="margin: 0 0 10px 0; font-size: 0.85rem; color: #475569; font-weight: bold; text-transform: uppercase;">Observaciones de Taller:</h4>
                <div style="border-bottom: 1px solid #cbd5e1; height: 28px;"></div>
                <div style="border-bottom: 1px solid #cbd5e1; height: 28px;"></div>
                <div style="border-bottom: 1px solid #cbd5e1; height: 28px;"></div>
            </div>
        </div>

        <div class="no-print" style="margin-top: 20px; width: 100%; display: flex; gap: 10px;">
            <button onclick="imprimirResumen()" style="background: #1e3a8a; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-weight: 600; flex: 1; transition: background 0.3s;">
                <i class="fas fa-print"></i> IMPRIMIR ORDEN (CLIENTE)
            </button>
        </div>`;
    
    document.getElementById('containerAcciones').innerHTML = `
        <div class="confirm-sale-box" style="background: #ffffff; border: 2px solid #3498db; padding: 25px; border-radius: 12px; margin-top: 25px; width: 100%; box-sizing: border-box;">
            <h4 style="margin:0 0 20px 0; color: #2980b9; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-cash-register"></i> REGISTRAR VENTA FINAL
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="input-group">
                    <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">NOMBRE DEL CLIENTE</label>
                    <input type="text" id="nombreCliente" placeholder="Ej: Juan Pérez" style="width:100%; padding:12px; border-radius:8px; border:1px solid #cbd5e1; box-sizing: border-box;">
                </div>
                <div class="input-group">
                    <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">WHATSAPP / TEL</label>
                    <input type="text" id="telCliente" style="width:100%; padding:12px; border-radius:8px; border:1px solid #cbd5e1; box-sizing: border-box;">
                </div>
            </div>
            <div style="margin-top: 20px; background: #fffbeb; padding: 15px; border-radius: 10px;">
                <label style="font-size: 0.9rem; font-weight: 800; color: #92400e; display: block; text-align:center;">¿CUÁNTO ABONA EL CLIENTE?</label>
                <input type="number" id="abonoInicial" value="0" oninput="actualizarSaldoEnRecibo()"
                    style="border: 2px solid #fbbf24; width:100%; padding:15px; border-radius:8px; font-weight: 900; font-size: 1.8rem; text-align: center; box-sizing: border-box;">
            </div>
            <button id="btnFinalizarVenta" class="btn-calc" style="background: #2ecc71; color: white; border: none; width: 100%; margin-top:20px; padding: 20px; font-weight: 800; border-radius: 10px;" onclick="facturarVenta()">
                <i class="fas fa-save"></i> CONFIRMAR VENTA Y DESCONTAR STOCK
            </button>
        </div>`;
    setTimeout(limpiarTextosNoDeseados, 100);
}

function imprimirResumen() {
    const printArea = document.getElementById('printArea');
    const ventana = window.open('', '', 'height=750,width=950');
    ventana.document.write('<html><head><title>Cotización</title><style>body{font-family:sans-serif;padding:40px;}</style></head><body>');
    ventana.document.write(printArea.innerHTML);
    ventana.document.write('</body></html>');
    ventana.document.close();
    setTimeout(() => { ventana.print(); ventana.close(); }, 500);
}

window.facturarVenta = async function() {
    if (!datosCotizacionActual) {
        alert("⚠️ No hay una cotización activa para facturar.");
        return;
    }
    
    // 1. Captura de elementos de interfaz (Sin cambios para mantener integridad)
    const nombreInput = document.getElementById('nombreCliente');
    const telInput = document.getElementById('telCliente');
    const abonoInput = document.getElementById('abonoInicial');
    const btnVenta = document.getElementById('btnFinalizarVenta');

    const nombre = nombreInput?.value.trim();
    const telefono = telInput?.value.trim() || "N/A";
    const abono = parseFloat(abonoInput?.value) || 0;

    if (!nombre) {
        alert("⚠️ Por favor, ingresa el nombre del cliente.");
        nombreInput?.focus();
        return;
    }

    // 2. 🚀 RESCATE QUIRÚRGICO DE MATERIALES (Sincronizado con el cálculo real)
    // En lugar de recolectar datos "genéricos", usamos lo que ya calculamos en 'procesarCotizacion'
    // 2. 🚀 RESCATE QUIRÚRGICO DE MATERIALES (Sincronizado con el cálculo real)
    // Se asegura que 'cantidad' sea el valor real de consumo para el inventario
    const itemsProcesados = datosCotizacionActual.detalles.materiales.map(m => {
        // Determinamos qué valor debe procesar el servidor para el stock:
        // Si es ML, enviamos m.cantidadUsada (ej. 2.95). 
        // Si es M2, enviamos datosCotizacionActual.areaFinal (ej. 0.48).
        const cantidadRealConsumo = (m.unidad === 'ML') 
            ? m.cantidadUsada 
            : (datosCotizacionActual.areaFinal || 0);

        return {
            productoId: m.id,
            materialNombre: m.nombre.toUpperCase(), 
            descripcion: m.nombre.toUpperCase(),
            nombre: m.nombre.toUpperCase(),      

            // 💰 COSTOS Y VENTAS REALES (Blindaje de rentabilidad para el reporte)
            costo_base_unitario: m.costoUnitario,
            costoBase: m.costoUnitario,
            precio_venta_item: m.subtotalVenta, // x2.5 para molduras, x3 para el resto

            // 📐 MEDIDAS EXACTAS Y DESCUENTO DE STOCK
            // 'cantidad' es el motor del inventario en el servidor
            cantidad: Number(cantidadRealConsumo.toFixed(3)), 
            unidad: m.unidad, // 'ML' o 'M2'
            
            ancho: Number((datosCotizacionActual.anchoOriginal || 0).toFixed(2)),
            largo: Number((datosCotizacionActual.largoOriginal || 0).toFixed(2)),
            area_m2: Number((datosCotizacionActual.areaFinal || 0).toFixed(3)),
            
            // Enviamos cantidadUsada por separado para que el reporte histórico
            // pueda mostrar los ML específicos sin confundirse con el área.
            cantidadUsada: Number(m.cantidadUsada.toFixed(3))
        };
    });

    if (itemsProcesados.length === 0) {
        alert("⚠️ No has seleccionado ningún material para la venta.");
        return;
    }

    // 3. Estructura de datos final (La maleta blindada y ampliada)
    const facturaData = {
        cliente: { 
            nombre: nombre, 
            telefono: telefono 
        },
        // Mantenemos el formato de medidas que ya tenías pero con el detalle de uso
        medidas: datosCotizacionActual.detalles.medidas,
        items: itemsProcesados,
        totalFactura: datosCotizacionActual.precioSugeridoCliente || 0,
        totalPagado: abono,
        // Sincronización de mano de obra y rentabilidad
        manoObra: datosCotizacionActual.valor_mano_obra || 0, 
        mano_obra_total: datosCotizacionActual.valor_mano_obra || 0,
        rentabilidad: datosCotizacionActual.rentabilidad || 0,
        fecha: new Date().toISOString()
    };

    // 4. Envío Quirúrgico al Servidor (Sin alterar las rutas de tu backend)
    try {
        if (btnVenta) {
            btnVenta.disabled = true;
            btnVenta.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GUARDANDO VENTA REAL...';
        }

        const response = await fetch('/.netlify/functions/server/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(facturaData)
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ VENTA EXITOSA\nOrden N°: ${result.ot || 'Generada'}\n\nLos cálculos de ML y utilidad se han guardado correctamente.`);
            window.location.href = "/history.html";
        } else {
            throw new Error(result.error || "El servidor rechazó la venta.");
        }

    } catch (error) {
        console.error("Error crítico en facturación:", error);
        alert("🚨 ERROR AL GUARDAR: " + error.message);
        if (btnVenta) {
            btnVenta.disabled = false;
            btnVenta.innerHTML = '<i class="fas fa-save"></i> REINTENTAR GUARDAR';
        }
    }
};