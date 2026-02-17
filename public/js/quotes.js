/**
 * Lógica del Cotizador y Facturación - MARQUETERÍA LA CHICA MORALES
 * Versión: 12.9.2 - Sincronización de Familias + Corrección Visual OT
 * Objetivo: Carga automática de materiales y visualización limpia en Orden de Trabajo.
 */

let datosCotizacionActual = null;
let materialesOriginales = []; // Referencia global para validación de stock

document.addEventListener('DOMContentLoaded', async () => {
    // 🎯 GANCHOS DE LOS SELECTS (Respetando tus IDs de dashboard.html)
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

        // 🛡️ SINCRONIZACIÓN BLINDADA: Ruta directa
        const response = await fetch('/.netlify/functions/server/quotes/materials');
        const result = await response.json();
        
        if (result.success) {
            const cat = result.data;
            
            materialesOriginales = [
                ...(cat.vidrios || []), ...(cat.respaldos || []), ...(cat.paspartu || []), 
                ...(cat.marcos || []), ...(cat.foam || []), ...(cat.tela || []), ...(cat.chapilla || [])
            ];

            const llenar = (select, lista) => {
                if (!select) return;
                if (!lista || lista.length === 0) {
                    select.innerHTML = `<option value="">-- No disponible --</option>`;
                    return;
                }
                
                select.innerHTML = `<option value="">-- Seleccionar --</option>`;
                lista.forEach(m => {
                    const stock = m.stock_actual || m.stock_actual_m2 || 0;
                    const color = stock <= 0 ? 'color: #ef4444; font-weight: bold;' : '';
                    const avisoStock = stock <= 0 ? '(SIN STOCK)' : `(${stock.toFixed(2)} m²)`;
                    
                    const option = document.createElement('option');
                    option.value = m._id || m.id;
                    option.style = color;
                    option.textContent = `${m.nombre.toUpperCase()} ${avisoStock}`;
                    select.appendChild(option);
                });
            };

            llenar(selects.Vidrio, cat.vidrios);
            llenar(selects.Respaldo, cat.respaldos);
            llenar(selects.Paspartu, cat.paspartu);
            llenar(selects.Marco, cat.marcos);
            llenar(selects.Foam, cat.foam);
            llenar(selects.Tela, cat.tela);
            llenar(selects.Chapilla, cat.chapilla);
            
            console.log("✅ Familias de materiales desplegadas correctamente");
        }
    } catch (error) {
        console.error("🚨 Error cargando materiales:", error);
        Object.values(selects).forEach(s => { if(s) s.innerHTML = '<option>Error de conexión</option>'; });
    }
});

/**
 * MOTOR DE CÁLCULO Y LIMPIEZA
 */
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

    const idsSeleccionados = [
        document.getElementById('materialId').value,
        document.getElementById('materialRespaldoId').value,
        document.getElementById('materialExtraId').value,
        document.getElementById('materialOtroId').value,
        document.getElementById('materialFoamId')?.value,
        document.getElementById('materialTelaId')?.value,
        document.getElementById('materialChapillaId')?.value
    ].filter(id => id && id !== "");

    if (!ancho || !largo || idsSeleccionados.length === 0) {
        alert("⚠️ Por favor ingresa medidas y selecciona al menos un material.");
        return;
    }

    try {
        if(btnCalc) btnCalc.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculando...';
        
        const response = await fetch('/.netlify/functions/server/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ancho, largo, materialesIds: idsSeleccionados, manoObra: manoObraInput })
        });

        const result = await response.json();
        if (result.success) {
            const dataFinal = result.data;
            dataFinal.anchoOriginal = ancho;
            dataFinal.largoOriginal = largo;
            dataFinal.precioSugeridoCliente = dataFinal.total; 
            
            datosCotizacionActual = dataFinal;
            mostrarResultado(dataFinal);
            document.getElementById('resultado').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Error al procesar la cotización. Revisa la consola.");
    } finally {
        if(btnCalc) btnCalc.innerHTML = '<i class="fas fa-coins"></i> Calcular Precio Final';
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
    divRes.innerHTML = '<div id="detalleObra"></div><div id="containerAcciones"></div>';
    divRes.style.display = 'block';

    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

    // --- CIRUGÍA DE LISTA DE MATERIALES PARA EVITAR [object Object] ---
    const listaMateriales = data.detalles?.materiales || [];

    const itemsHTML = listaMateriales.map(m => {
        // Si m es un objeto (v12.3.2), tomamos m.nombre. Si es string, lo usamos directo.
        const nombreVisual = (typeof m === 'object' && m !== null) ? (m.nombre || "MATERIAL") : m;
        
        return `<li style="margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; display: flex; justify-content: space-between;">
            <span><i class="fas fa-check" style="color:#10b981; margin-right: 8px;"></i> ${nombreVisual.toUpperCase()}</span>
        </li>`;
    }).join('');

    document.getElementById('detalleObra').innerHTML = `
        <div id="printArea" style="background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; font-family: 'Segoe UI', sans-serif;">
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
            <p style="margin: 15px 0; font-size: 1.1rem; color: #1e293b; background: #f1f5f9; padding: 10px; border-radius: 6px;">
                <strong>Medidas:</strong> ${data.detalles?.medidas || '--'}
            </p>
            <h4 style="color: #475569; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0;">Materiales incluidos:</h4>
            <ul style="list-style:none; padding-left:0; margin:10px 0; font-size:0.95rem; color:#334155;">${itemsHTML}</ul>
            <div style="margin-top: 25px; padding: 20px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #64748b; font-weight: 600;">VALOR TOTAL:</span>
                    <span style="font-weight: 700; color: #1e293b; font-size: 1.1rem;">${formatter.format(data.precioSugeridoCliente)}</span>
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
        </div>
        <div class="no-print" style="margin-top: 20px;">
            <button onclick="imprimirResumen()" style="background: #334155; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%; transition: 0.3s;">
                <i class="fas fa-print"></i> IMPRIMIR PARA CLIENTE
            </button>
        </div>
    `;

    document.getElementById('containerAcciones').innerHTML = `
        <div class="confirm-sale-box" style="background: #ffffff; border: 2px solid #3498db; padding: 25px; border-radius: 12px; margin-top: 25px;">
            <h4 style="margin:0 0 20px 0; color: #2980b9; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-cash-register"></i> REGISTRAR VENTA FINAL
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="input-group">
                    <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">NOMBRE DEL CLIENTE</label>
                    <input type="text" id="nombreCliente" placeholder="Ej: Juan Pérez" style="width:100%; padding:12px; border-radius:8px; border:1px solid #cbd5e1;">
                </div>
                <div class="input-group">
                    <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">WHATSAPP / TEL</label>
                    <input type="text" id="telCliente" placeholder="Ej: 3001234567" style="width:100%; padding:12px; border-radius:8px; border:1px solid #cbd5e1;">
                </div>
            </div>
            <div style="margin-top: 20px; background: #fffbeb; padding: 15px; border-radius: 10px; border: 1px solid #fcd34d;">
                <label style="font-size: 0.9rem; font-weight: 800; color: #92400e; display: block; text-align:center; margin-bottom: 10px;">¿CUÁNTO ABONA EL CLIENTE?</label>
                <input type="number" id="abonoInicial" value="0" oninput="actualizarSaldoEnRecibo()"
                    style="border: 2px solid #fbbf24; width:100%; padding:15px; border-radius:8px; font-weight: 900; font-size: 1.8rem; text-align: center; color: #92400e;">
            </div>
            <button id="btnFinalizarVenta" class="btn-calc" 
                style="background: #2ecc71; color: white; border: none; width: 100%; margin-top:20px; padding: 20px; font-weight: 800; font-size: 1.1rem; border-radius: 10px; cursor: pointer; transition: 0.3s;" 
                onclick="facturarVenta()">
                <i class="fas fa-save"></i> CONFIRMAR VENTA Y DESCONTAR STOCK
            </button>
        </div>
    `;
    setTimeout(limpiarTextosNoDeseados, 100);
}

function imprimirResumen() {
    const printArea = document.getElementById('printArea');
    const ventana = window.open('', '', 'height=750,width=950');
    ventana.document.write('<html><head><title>Cotización - La Chica Morales</title>');
    ventana.document.write('<style>body{font-family:sans-serif;padding:40px;color:#333;} .no-print{display:none;}</style></head><body>');
    ventana.document.write(printArea.innerHTML);
    ventana.document.write('</body></html>');
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); ventana.close(); }, 500);
}

async function facturarVenta() {
    if (!datosCotizacionActual) return;
    const nombre = document.getElementById('nombreCliente').value.trim();
    const abono = parseFloat(document.getElementById('abonoInicial').value) || 0;
    const btnVenta = document.getElementById('btnFinalizarVenta');

    if (!nombre) { 
        alert("⚠️ Por favor, ingresa el nombre del cliente."); 
        document.getElementById('nombreCliente').focus();
        return; 
    }

    const facturaData = {
        cliente: { nombre, telefono: document.getElementById('telCliente').value || "N/A" },
        items: (datosCotizacionActual.detalles?.materiales || []).map(m => ({
            materialNombre: (typeof m === 'object' && m !== null) ? m.nombre : m, 
            ancho: datosCotizacionActual.anchoOriginal,
            largo: datosCotizacionActual.largoOriginal,
            area_m2: datosCotizacionActual.area,
            total_item: Math.round(datosCotizacionActual.valor_materiales || 0)
        })), 
        totalFactura: datosCotizacionActual.precioSugeridoCliente,
        abonoInicial: abono,   
        manoObraTotal: datosCotizacionActual.valor_mano_obra || 0,
        medidas: datosCotizacionActual.detalles?.medidas || '--'
    };

    try {
        btnVenta.disabled = true;
        btnVenta.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        
        const response = await fetch('/.netlify/functions/server/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(facturaData)
        });
        const result = await response.json();
        if (result.success) {
            alert(`✅ VENTA EXITOSA\nOrden N°: ${result.data.numeroFactura}`);
            window.location.href = "/history.html"; 
        } else {
            alert("🚨 Error: " + (result.error || "No se pudo registrar."));
            btnVenta.disabled = false;
        }
    } catch (error) { 
        alert("Error de conexión.");
        btnVenta.disabled = false;
    }
}