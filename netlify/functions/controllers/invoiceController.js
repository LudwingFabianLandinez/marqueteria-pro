/**
 * Lógica del Cotizador y Facturación - MARQUETERÍA LA CHICA MORALES
 * Versión: 13.0.9 - SINCRONIZACIÓN TOTAL CON BACKEND
 * Objetivo: Coincidir propiedades con invoiceController.js (productoId y area_m2)
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
                    const precioDetectado = m.costo_m2 || m.precio_m2_costo || 0;
                    option.dataset.costo = precioDetectado;
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
        }
    } catch (error) {
        console.error("🚨 Error cargando materiales:", error);
    }
});

function limpiarTextosNoDeseados() {
    const divRes = document.getElementById('resultado');
    if (!divRes) return;
    divRes.querySelectorAll('p, b, span, div').forEach(el => {
        const contenido = el.innerText.toLowerCase();
        const estaFuera = !el.closest('#printArea') && !el.closest('#containerAcciones');
        if ((contenido.includes('costo base') || contenido.includes('mano de obra')) && estaFuera) el.remove();
    });
}

async function procesarCotizacion() {
    const btnCalc = document.querySelector('.btn-calc');
    const ancho = parseFloat(document.getElementById('ancho').value);
    const largo = parseFloat(document.getElementById('largo').value);
    const manoObraInput = parseFloat(document.getElementById('manoObra').value) || 0;

    const selectsIds = ['materialId', 'materialRespaldoId', 'materialExtraId', 'materialOtroId', 'materialFoamId', 'materialTelaId', 'materialChapillaId'];
    const materialesSeleccionados = selectsIds
        .map(id => document.getElementById(id))
        .filter(el => el && el.value !== "")
        .map(el => ({
            id: el.value,
            nombre: el.options[el.selectedIndex].text.split('(')[0].trim(),
            costoUnitario: parseFloat(el.options[el.selectedIndex].dataset.costo) || 0
        }));

    if (!ancho || !largo || materialesSeleccionados.length === 0) {
        alert("⚠️ Por favor ingresa medidas y materiales.");
        return;
    }

    try {
        if(btnCalc) btnCalc.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculando...';
        const response = await fetch('/.netlify/functions/server/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ancho, largo, materialesIds: materialesSeleccionados.map(m => m.id), manoObra: manoObraInput })
        });

        const result = await response.json();
        const areaCalculada = (ancho * largo) / 10000;
        let dataFinal;

        if (result.success && result.data && result.data.valor_materiales > 0) {
            dataFinal = result.data;
        } else {
            let costoBaseLocal = 0;
            materialesSeleccionados.forEach(m => { costoBaseLocal += (m.costoUnitario * areaCalculada); });
            dataFinal = { valor_materiales: costoBaseLocal, area: areaCalculada };
        }

        dataFinal.detalles = { medidas: `${ancho} x ${largo} cm`, materiales: materialesSeleccionados };
        dataFinal.precioSugeridoCliente = Math.round((dataFinal.valor_materiales || 0) * 3) + manoObraInput;
        dataFinal.anchoOriginal = ancho;
        dataFinal.largoOriginal = largo;
        dataFinal.areaFinal = dataFinal.area || areaCalculada;
        dataFinal.valor_mano_obra = manoObraInput;
        
        datosCotizacionActual = dataFinal;
        mostrarResultado(dataFinal);
    } catch (error) {
        alert("Error al procesar la cotización.");
    } finally {
        if(btnCalc) btnCalc.innerHTML = '<i class="fas fa-coins"></i> Calcular Precio Final';
    }
}

function actualizarSaldoEnRecibo() {
    if (!datosCotizacionActual) return;
    const abono = parseFloat(document.getElementById('abonoInicial').value) || 0;
    const total = datosCotizacionActual.precioSugeridoCliente;
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
    document.getElementById('montoAbonoRecibo').innerText = `- ${formatter.format(abono)}`;
    const saldoEl = document.getElementById('montoSaldoRecibo');
    saldoEl.innerText = formatter.format(total - abono);
    saldoEl.style.color = (total - abono) > 0 ? '#dc2626' : '#059669';
}

function mostrarResultado(data) {
    const divRes = document.getElementById('resultado');
    divRes.innerHTML = '<div id="detalleObra"></div><div id="containerAcciones"></div>';
    divRes.style.display = 'block';

    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
    const itemsHTML = data.detalles.materiales.map(m => `
        <li style="margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; display: flex; justify-content: space-between;">
            <span><i class="fas fa-check" style="color:#10b981; margin-right: 8px;"></i> ${m.nombre.toUpperCase()}</span>
        </li>`).join('');

    document.getElementById('detalleObra').innerHTML = `
        <div id="printArea" style="background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
                <div><h2 style="margin:0; color: #1e3a8a;">ORDEN DE TRABAJO</h2><small>Marquetería La Chica Morales</small></div>
                <div style="text-align: right;"><b>COTIZACIÓN</b><br>${new Date().toLocaleDateString()}</div>
            </div>
            <p style="background: #f1f5f9; padding: 10px; border-radius: 6px;"><strong>Medidas:</strong> ${data.detalles.medidas}</p>
            <ul style="list-style:none; padding:0;">${itemsHTML}</ul>
            <div style="margin-top: 25px; padding: 20px; background: #f8fafc; border-radius: 10px;">
                <div style="display: flex; justify-content: space-between;"><span>VALOR TOTAL:</span><span style="font-weight:700; font-size:1.5rem;">${formatter.format(data.precioSugeridoCliente)}</span></div>
                <div style="display: flex; justify-content: space-between; color: #059669;"><span>ABONO:</span><span id="montoAbonoRecibo">- ${formatter.format(0)}</span></div>
                <div style="display: flex; justify-content: space-between; border-top: 2px dashed #ccc; margin-top: 10px; padding-top: 10px;">
                    <strong>SALDO:</strong><span id="montoSaldoRecibo" style="font-size: 1.8rem; font-weight: 900; color: #dc2626;">${formatter.format(data.precioSugeridoCliente)}</span>
                </div>
            </div>
        </div>
        <button onclick="imprimirResumen()" style="background:#334155; color:white; width:100%; margin-top:10px; padding:15px; border-radius:8px; font-weight:600;"><i class="fas fa-print"></i> IMPRIMIR</button>`;

    document.getElementById('containerAcciones').innerHTML = `
        <div style="background: #ffffff; border: 2px solid #3498db; padding: 25px; border-radius: 12px; margin-top: 25px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <input type="text" id="nombreCliente" placeholder="Nombre Cliente" style="padding:12px; border:1px solid #cbd5e1; border-radius:8px;">
                <input type="text" id="telCliente" placeholder="WhatsApp" style="padding:12px; border:1px solid #cbd5e1; border-radius:8px;">
            </div>
            <input type="number" id="abonoInicial" value="0" oninput="actualizarSaldoEnRecibo()" style="width:100%; padding:15px; border:2px solid #fbbf24; border-radius:8px; font-size:1.8rem; text-align:center; margin-top:15px;">
            <button id="btnFinalizarVenta" class="btn-calc" style="background:#2ecc71; color:white; width:100%; margin-top:20px; padding:20px; font-weight:800; border-radius:10px;" onclick="facturarVenta()">
                CONFIRMAR VENTA Y DESCONTAR STOCK
            </button>
        </div>`;
    setTimeout(limpiarTextosNoDeseados, 100);
}

function imprimirResumen() {
    const v = window.open('', '', 'height=750,width=950');
    v.document.write('<html><body style="font-family:sans-serif;padding:40px;">' + document.getElementById('printArea').innerHTML + '</body></html>');
    v.document.close();
    v.focus();
    setTimeout(() => { v.print(); v.close(); }, 500);
}

async function facturarVenta() {
    if (!datosCotizacionActual) return;
    const nombre = document.getElementById('nombreCliente').value.trim();
    if (!nombre) { alert("⚠️ Nombre cliente requerido."); return; }

    const btnVenta = document.getElementById('btnFinalizarVenta');
    
    // 🎯 AJUSTE DE COMPATIBILIDAD CON invoiceController.js
    const facturaData = {
        cliente: { nombre, telefono: document.getElementById('telCliente').value || "N/A" },
        // Usamos 'productoId' y 'area_m2' para que el backend lo reconozca de inmediato
        items: datosCotizacionActual.detalles.materiales.map(m => ({
            productoId: m.id, 
            materialNombre: m.nombre,
            ancho: datosCotizacionActual.anchoOriginal,
            largo: datosCotizacionActual.largoOriginal,
            area_m2: datosCotizacionActual.areaFinal,
            total_item: Math.round((datosCotizacionActual.valor_materiales * 3) / datosCotizacionActual.detalles.materiales.length)
        })),
        totalFactura: datosCotizacionActual.precioSugeridoCliente,
        abonoInicial: parseFloat(document.getElementById('abonoInicial').value) || 0,
        manoObraTotal: datosCotizacionActual.valor_mano_obra,
        medidas: datosCotizacionActual.detalles.medidas
    };

    try {
        btnVenta.disabled = true;
        btnVenta.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';
        const res = await fetch('/.netlify/functions/server/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(facturaData)
        });
        const result = await res.json();
        if (result.success) {
            alert("✅ VENTA REGISTRADA EXITOSAMENTE");
            window.location.href = "/history.html";
        } else {
            alert("🚨 Error: " + (result.error || "Falla en servidor"));
            btnVenta.disabled = false;
            btnVenta.innerHTML = 'CONFIRMAR VENTA';
        }
    } catch (e) {
        alert("Error de red");
        btnVenta.disabled = false;
    }
}