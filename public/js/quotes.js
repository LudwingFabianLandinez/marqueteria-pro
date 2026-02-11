/**
 * Lógica del Cotizador y Facturación - MARQUETERÍA LA CHICA MORALES
 * Versión: Protegida contra Stock Negativo y Sincronizada
 */

let datosCotizacionActual = null;
let materialesOriginales = []; // Para validar stock real sin consultar la API cada segundo

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
        const response = await fetch('/api/quotes/materials');
        const result = await response.json();
        
        if (result.success) {
            const cat = result.data;
            // Guardamos referencia global de materiales para validaciones rápidas
            materialesOriginales = [
                ...cat.vidrios, ...cat.respaldos, ...cat.paspartu, 
                ...cat.marcos, ...cat.foam, ...cat.tela, ...cat.chapilla
            ];

            const llenar = (select, lista) => {
                if (!select || !lista) return;
                select.innerHTML = `<option value="">-- Seleccionar --</option>`;
                lista.forEach(m => {
                    const stock = m.stock_actual_m2 || 0;
                    const color = stock <= 0 ? 'color: red;' : '';
                    select.innerHTML += `<option value="${m._id}" style="${color}">${m.nombre} (${stock.toFixed(2)} m²)</option>`;
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

    const elementos = divRes.querySelectorAll('p, b, span, div');
    elementos.forEach(el => {
        const contenido = el.innerText.toLowerCase();
        const esCostoInterno = contenido.includes('costo base') || contenido.includes('mano de obra');
        const estaFueraDeZonasSeguras = !el.closest('#printArea') && !el.closest('#containerAcciones');

        if (esCostoInterno && estaFueraDeZonasSeguras) {
            el.remove(); 
        }
        
        if (contenido.includes('total venta') && contenido.includes('$ 0') && estaFueraDeZonasSeguras) {
            el.remove();
        }
    });
}

async function procesarCotizacion() {
    const anchoValue = document.getElementById('ancho').value;
    const largoValue = document.getElementById('largo').value;
    const ancho = parseFloat(anchoValue);
    const largo = parseFloat(largoValue);
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
        const response = await fetch('/api/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ancho, largo, materialesIds: idsSeleccionados, manoObra: manoObraInput })
        });

        const result = await response.json();
        if (result.success) {
            result.data.anchoOriginal = ancho;
            result.data.largoOriginal = largo;
            
            const costoBaseMateriales = result.data.costos.valor_materiales;
            const nuevoTotalSugerido = (costoBaseMateriales * 3) + manoObraInput;

            result.data.precioSugeridoCliente = Math.round(nuevoTotalSugerido);
            result.data.costos.valor_mano_obra = manoObraInput; 

            datosCotizacionActual = result.data;
            mostrarResultado(result.data);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Error al procesar la cotización.");
    }
}

function actualizarSaldoEnRecibo() {
    if (!datosCotizacionActual) return;
    
    const abono = parseFloat(document.getElementById('abonoInicial').value) || 0;
    const total = datosCotizacionActual.precioSugeridoCliente;
    const saldo = total - abono;

    const formatter = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0
    });

    const abonoElement = document.getElementById('montoAbonoRecibo');
    const saldoElement = document.getElementById('montoSaldoRecibo');

    if (abonoElement) abonoElement.innerText = `- ${formatter.format(abono)}`;
    if (saldoElement) saldoElement.innerText = formatter.format(saldo);

    limpiarTextosNoDeseados();
}

function mostrarResultado(data) {
    const divRes = document.getElementById('resultado');
    divRes.innerHTML = '<div id="detalleObra"></div><div id="containerAcciones"></div>';
    divRes.style.display = 'block';

    const formatter = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0
    });

    // --- NUEVO: Validación de Stock Visual ---
    let htmlStockAlert = "";
    let hayInsuficiente = false;

    data.detalles.materiales.forEach(m => {
        const matOriginal = materialesOriginales.find(mo => mo._id === m.id);
        const stockDisponible = matOriginal ? matOriginal.stock_actual_m2 : 0;
        const areaRequerida = m.area_m2;

        if (areaRequerida > stockDisponible) {
            hayInsuficiente = true;
            htmlStockAlert += `<div style="color: #dc2626; font-size: 0.85rem; margin-top: 2px;">
                ❌ Stock insuficiente: ${m.nombre} (Req: ${areaRequerida.toFixed(2)}m² | Disp: ${stockDisponible.toFixed(2)}m²)
            </div>`;
        }
    });

    const itemsHTML = data.detalles.materiales.map(m => 
        `<li style="margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
            <i class="fas fa-check" style="color:#10b981; margin-right: 8px;"></i> ${m.nombre}
        </li>`
    ).join('');

    document.getElementById('detalleObra').innerHTML = `
        <div id="printArea" style="background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
                <h3 style="margin:0; color: #1e3a8a; font-size: 1.3rem;">COTIZACIÓN DE MARQUETERÍA</h3>
                <span style="color: #64748b; font-size: 0.9rem;">Fecha: ${new Date().toLocaleDateString()}</span>
            </div>
            <p style="margin: 15px 0; font-size: 1.2rem; color: #1e293b;"><strong>Medidas:</strong> ${data.detalles.medidas}</p>
            <ul style="list-style:none; padding-left:0; margin:25px 0; font-size:1rem; color:#334155;">${itemsHTML}</ul>
            ${htmlStockAlert}
            <div style="margin-top: 20px; padding: 20px; background: #f8fafc; border-radius: 8px; border-right: 5px solid #1e3a8a;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #64748b; font-weight: 600;">VALOR TOTAL:</span>
                    <span style="font-weight: 700; color: #1e293b;">${formatter.format(data.precioSugeridoCliente)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #059669;">
                    <span style="font-weight: 600;">ABONO RECIBIDO:</span>
                    <span id="montoAbonoRecibo" style="font-weight: 700;">- ${formatter.format(0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid #cbd5e1;">
                    <span style="font-weight: 800; color: #1e293b;">SALDO PENDIENTE:</span>
                    <span id="montoSaldoRecibo" style="font-size: 1.8rem; font-weight: 900; color: #dc2626;">${formatter.format(data.precioSugeridoCliente)}</span>
                </div>
            </div>
        </div>
        <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="imprimirResumen()" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%;">
                <i class="fas fa-print"></i> Imprimir Cotización para Cliente
            </button>
        </div>
    `;

    document.getElementById('containerAcciones').innerHTML = `
        <div class="confirm-sale-box" style="background: #f1f5f9; border: 2px solid #e2e8f0; padding: 25px; border-radius: 12px; margin-top: 20px;">
            <h4 style="margin:0 0 20px 0; color: #1e3a8a; font-size: 1.2rem; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px;">
                <i class="fas fa-cash-register"></i> Panel de Registro de Venta
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="input-group">
                    <label style="font-size: 0.8rem; font-weight: 700;">Nombre del Cliente</label>
                    <input type="text" id="nombreCliente" placeholder="Nombre completo" class="form-control" style="width:100%; padding:12px; border-radius:6px; border:1px solid #cbd5e1;">
                </div>
                <div class="input-group">
                    <label style="font-size: 0.8rem; font-weight: 700;">WhatsApp / Celular</label>
                    <input type="text" id="telCliente" placeholder="Opcional" class="form-control" style="width:100%; padding:12px; border-radius:6px; border:1px solid #cbd5e1;">
                </div>
            </div>
            <div class="input-group" style="margin-top: 20px; background: #fffbeb; padding: 18px; border-radius: 10px; border: 1px solid #fcd34d;">
                <label style="font-size: 0.9rem; font-weight: 800; color: #92400e; display: block; text-align:center;">MONTO DEL ABONO (COP)</label>
                <input type="number" id="abonoInicial" value="0" oninput="actualizarSaldoEnRecibo()"
                    style="border: 2px solid #fbbf24; width:100%; padding:15px; border-radius:8px; font-weight: 900; font-size: 1.5rem; text-align: center;">
            </div>
            <button id="btnFinalizarVenta" class="btn-calc" 
                style="background: ${hayInsuficiente ? '#94a3b8' : '#059669'}; color: white; border: none; width: 100%; margin-top:25px; padding: 18px; font-weight: 800; font-size: 1.1rem; border-radius: 12px; cursor: ${hayInsuficiente ? 'not-allowed' : 'pointer'};" 
                onclick="${hayInsuficiente ? "alert('No puedes facturar: Hay materiales sin stock suficiente.')" : "facturarVenta()"}">
                <i class="fas fa-save"></i> ${hayInsuficiente ? 'STOCK INSUFICIENTE' : 'FINALIZAR VENTA Y DESCONTAR'}
            </button>
        </div>
    `;
    setTimeout(limpiarTextosNoDeseados, 100);
}

function imprimirResumen() {
    const printArea = document.getElementById('printArea');
    const ventana = window.open('', '', 'height=750,width=950');
    ventana.document.write('<html><head><title>Cotización</title><style>body{font-family:sans-serif;padding:40px;} .no-print{display:none;}</style></head><body>' + printArea.innerHTML + '</body></html>');
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); ventana.close(); }, 500);
}

async function facturarVenta() {
    if (!datosCotizacionActual) {
        alert("🚨 Primero debes realizar una cotización.");
        return;
    }

    const nombre = document.getElementById('nombreCliente').value.trim();
    const abono = parseFloat(document.getElementById('abonoInicial').value) || 0;

    if (!nombre) { 
        alert("⚠️ Ingresa el nombre del cliente."); 
        document.getElementById('nombreCliente').focus();
        return; 
    }

    const listaMateriales = datosCotizacionActual.detalles.materiales.map(m => ({
        productoId: m.id,
        materialNombre: m.nombre, 
        ancho: datosCotizacionActual.anchoOriginal,
        largo: datosCotizacionActual.largoOriginal,
        area_m2: m.area_m2, 
        costo_base_unitario: m.costo_m2_base || 0, 
        valor_material: Math.round(m.precio_proporcional || 0),
        total_item: Math.round(m.precio_proporcional || 0)
    }));

    const facturaData = {
        cliente: { 
            nombre, 
            telefono: document.getElementById('telCliente').value || "N/A" 
        },
        items: listaMateriales, 
        materiales: listaMateriales,
        totalFactura: datosCotizacionActual.precioSugeridoCliente,
        abonoInicial: abono,   
        manoObraTotal: datosCotizacionActual.costos.valor_mano_obra || 0,
        medidas: datosCotizacionActual.detalles.medidas
    };

    try {
        const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(facturaData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ VENTA REGISTRADA\nOrden: ${result.data.numeroFactura}`);
            window.location.href = "/history.html"; 
        } else {
            alert("🚨 Error del servidor: " + (result.error || "No se pudo registrar la venta."));
        }
    } catch (error) { 
        console.error("Error en facturación:", error); 
        alert("Error de conexión. Verifica que el servidor esté encendido.");
    }
}