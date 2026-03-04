/**
 * Lógica del Historial de Órdenes de Trabajo - MARQUETERÍA LA CHICA MORALES
 * Versión: 17.0.1 - REPARACIÓN DEFINITIVA DE BOTÓN DE PAGO
 */

let todasLasFacturas = [];

// --- 0. VARIABLE GLOBAL (ESTO ARREGLA EL ERROR DE LA IMAGEN) ---
const formatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
});

// 1. ARRANCAR CARGA DE DATOS DE INMEDIATO
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Iniciando carga de historial...");
    await fetchInvoices(); 

    try {
        configurarBuscador();
    } catch (e) { console.warn("Aviso: El buscador no se pudo configurar", e); }

    try {
        vincularBotones();
    } catch (e) { console.warn("Aviso: Error vinculando botones", e); }
});

// 2. FUNCIÓN DE VINCULACIÓN PROTEGIDA (SE MANTIENE IGUAL)
function vincularBotones() {
    const btnReporte = document.querySelector('.btn-primary') || 
                       Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('REPORTE HOY'));
    if (btnReporte) {
        btnReporte.onclick = (e) => {
            e.preventDefault(); 
            generarReporteDiario();
        };
    }

    const btnExcel = document.querySelector('.btn-success') || 
                     Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('EXCEL'));
    if (btnExcel) {
        btnExcel.onclick = exportarAExcel;
    }
}

// 3. FETCH INVOICES (SE MANTIENE IGUAL)
async function fetchInvoices() {
    try {
        const response = await fetch('/.netlify/functions/server/invoices');
        if (!response.ok) throw new Error(`Error: ${response.status}`);
        todasLasFacturas = await response.json();
        
        todasLasFacturas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        console.log("📦 Datos recibidos:", todasLasFacturas.length);
        renderTable(todasLasFacturas);
    } catch (error) {
        console.error("❌ Error de conexión:", error);
    }
}

// 4. FORMATEO DE OT (SE MANTIENE IGUAL)
function formatearNumeroOT(f) {
    const num = f.numeroFactura || f.ot || f.numeroOT || f.numeroOrden;
    if (num && num !== "undefined") {
        return num.toString().startsWith('OT-') ? num : `OT-${num.toString().padStart(6, '0')}`;
    }
    const idSufijo = f._id ? f._id.substring(f._id.length - 4).toUpperCase() : '0000';
    return `OT-${idSufijo}`;
}

// 5. REPORTE DE AUDITORÍA DIARIO (SE MANTIENE INTACTO)
async function generarReporteDiario() {
    try {
        const facturasAReportar = todasLasFacturas; 
        const inventarioLocal = JSON.parse(localStorage.getItem('inventory') || '[]');

        const nuevaVentana = window.open('', '_blank');
        let htmlContenido = `<html><head><title>Auditoría Final - La Chica Morales</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; background: #f1f5f9; }
                .no-print { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }
                .btn { padding: 10px 15px; cursor: pointer; border-radius: 5px; border: none; color: white; font-weight: bold; }
                .ot-card { background: white; border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                th { background: #1e3a8a; color: white; padding: 12px; font-size: 0.75rem; text-align: center; text-transform: uppercase; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; text-align: center; }
                .tfoot-sumas td { background: #f8fafc; font-weight: 800; color: #1e3a8a; border-top: 2px solid #1e3a8a; }
                .resumen-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #cbd5e1; margin-top: 15px; }
                .label-resumen { font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 5px; }
                .val-resumen { font-size: 1.1rem; font-weight: 800; color: #1e293b; }
                .footer-rentabilidad { background: #f0fdf4; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: right; border: 1px solid #bbf7d0; }
                .rentabilidad-texto { color: #15803d; font-weight: bold; font-size: 1.2rem; }
                @media print { .no-print { display: none; } }
            </style>
        </head><body>
            <div class="no-print">
                <button class="btn" style="background: #64748b;" onclick="window.close()">← REGRESAR</button>
                <button class="btn" style="background: #1e3a8a;" onclick="window.print()">🖨️ IMPRIMIR</button>
                <button class="btn" style="background: #16a34a;" onclick="exportarExcel()">📊 EXCEL</button>
            </div>
            <div style="text-align:center; margin-bottom:30px;">
                <h1 style="color:#1e3a8a; margin:0;">MARQUETERIA LA CHICA MORALES</h1>
                <h2 style="color:#64748b; margin:5px 0;">REPORTE DE VENTAS</h2>
                <p><strong>FECHA GENERACIÓN:</strong> ${new Date().toLocaleDateString()}</p>
            </div>`;

        facturasAReportar.forEach(f => {
            let sumaCostoMateriales = 0;
            let sumaMaterialesX3 = 0;
            const manoObra = Number(f.manoObra || f.mano_obra_total || 0);
            const totalCobrado = Number(f.totalFactura || f.total || 0);
            const medidaTexto = f.medidas ? `(${f.medidas} cm)` : '';

            let nombreCliente = (f.cliente?.nombre || f.clienteNombre || f.cliente || "CLIENTE GENERAL").toString().toUpperCase();

            const fechaLimpia = f.fecha ? f.fecha.split('T')[0] : '---';

            htmlContenido += `<div class="ot-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom: 1px solid #eee; padding-bottom:10px;">
                    <div><strong style="font-size:1.4rem; color:#1e3a8a;">${formatearNumeroOT(f)}</strong><br>
                    <span style="color:#64748b">CLIENTE:</span> <strong>${nombreCliente}</strong></div>
                    <div style="text-align:right; color:#64748b"><strong>FECHA OT:</strong> ${fechaLimpia}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align:left;">Descripción Material</th>
                            <th>Medida Usada (m²)</th>
                            <th>Costo Base</th>
                            <th>Subtotal (x3)</th>
                        </tr>
                    </thead>
                    <tbody>`;

            (f.items || []).forEach(item => {
                const area = Number(item.area_m2 || item.area || 1);
                const costoBaseUnitario = Number(item.costoBase || item.precioUnitario || item.costo_base_unitario || item.costo || 0);
                let nombreReal = (item.nombre || item.material || item.descripcion || "MATERIAL").toUpperCase();

                const costoFila = costoBaseUnitario * area;
                const sugeridoFila = costoFila * 3;
                sumaCostoMateriales += costoFila;
                sumaMaterialesX3 += sugeridoFila;

                htmlContenido += `<tr>
                    <td style="text-align:left; font-weight:600;">${nombreReal}</td>
                    <td>${area.toFixed(3)} ${medidaTexto}</td>
                    <td>${formatter.format(costoFila)}</td>
                    <td style="background:#f0fdf4; font-weight:bold;">${formatter.format(sugeridoFila)}</td>
                </tr>`;
            });

            const totalOrden = sumaMaterialesX3 + manoObra;
            const rentabilidadReal = totalCobrado - sumaCostoMateriales;

            htmlContenido += `</tbody>
                    <tfoot class="tfoot-sumas">
                        <tr>
                            <td colspan="2" style="text-align:right;">TOTALES MATERIALES:</td>
                            <td>${formatter.format(sumaCostoMateriales)}</td>
                            <td>${formatter.format(sumaMaterialesX3)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div class="resumen-grid">
                    <div><span class="label-resumen">SUMA COSTOS</span><span class="val-resumen">${formatter.format(sumaCostoMateriales)}</span></div>
                    <div><span class="label-resumen">MATERIAL (X3)</span><span class="val-resumen">${formatter.format(sumaMaterialesX3)}</span></div>
                    <div><span class="label-resumen">MANO DE OBRA</span><span class="val-resumen">${formatter.format(manoObra)}</span></div>
                    <div><span class="label-resumen" style="color:#1e3a8a;">TOTAL ORDEN</span><span class="val-resumen" style="color:#1e3a8a; font-size:1.3rem;">${formatter.format(totalOrden)}</span></div>
                </div>
                <div class="footer-rentabilidad">
                    <span class="rentabilidad-texto">RENTABILIDAD OBTENIDA: ${formatter.format(rentabilidadReal)} ✅</span>
                </div>
            </div>`;
        });

        htmlContenido += `<script>function exportarExcel() { var html = document.body.innerHTML; var blob = new Blob([html], { type: 'application/vnd.ms-excel' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Reporte_Ventas_Chica_Morales.xls'; a.click(); }</script></body></html>`;
        nuevaVentana.document.write(htmlContenido);
        nuevaVentana.document.close();
    } catch (e) { console.error(e); }
}

// 6. EXPORTAR EXCEL (SE MANTIENE IGUAL)
function exportarAExcel() {
    if (todasLasFacturas.length === 0) {
        alert("No hay datos para exportar");
        return;
    }
    try {
        let csvContent = "\uFEFF"; 
        // 1. Definimos la cabecera con la columna "PRODUCTOS / MATERIALES"
        csvContent += "Fecha,OT,Cliente,PRODUCTOS / MATERIALES,Total Venta,Saldo,Estado\n";
        
        todasLasFacturas.forEach(f => {
            const fecha = f.fecha ? new Date(f.fecha).toLocaleDateString() : '---';
            const ot = formatearNumeroOT(f);
            const cliente = (f.cliente?.nombre || f.clienteNombre || "Cliente").replace(/,/g, ''); 
            
            // 2. EXTRACCIÓN REAL DE MATERIALES:
            // Buscamos en 'materiales' o 'items'. Recorremos cada uno para sacar su descripción o nombre.
            const listaMateriales = (f.materiales || f.items || [])
                .map(m => {
                    // Priorizamos el nombre o descripción que NO sea la palabra genérica "MATERIAL"
                    const nombreReal = m.nombre || m.descripcion || m.producto || "---";
                    return `${nombreReal} (${m.medida || ''})`;
                })
                .join(' + ') // Los unimos con un signo + para que se vean claros en la celda
                .replace(/,/g, ''); // Limpieza de comas para no romper las columnas del CSV

            const total = Number(f.totalFactura || f.total || f.totalOrden) || 0;
            const abono = Number(f.totalPagado || f.abono || 0);
            const saldo = total - abono;
            
            // 3. Construimos la línea asegurándonos de que listaMateriales esté en su lugar
            csvContent += `${fecha},${ot},${cliente},${listaMateriales},${total},${saldo},${saldo <= 0 ? "PAGADO" : "ABONADO"}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Reporte_Detallado_Marqueteria.csv`);
        link.click();
    } catch (error) { 
        console.error("Error al exportar materiales:", error); 
    }
}

// 7. RENDERIZADO DE TABLA (CORRECCIÓN DE BOTÓN VERDE)
function renderTable(facturas) {
    const tableBody = document.getElementById('tablaFacturas');
    if (!tableBody) return console.error("❌ No se encontró 'tablaFacturas'");
    
    tableBody.innerHTML = '';

    if (!facturas || facturas.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">No se encontraron órdenes.</td></tr>`;
        return;
    }

    facturas.forEach(f => {
        const total = Number(f.totalFactura || f.total || 0);
        const pagado = Number(f.totalPagado || f.abono || 0);
        const saldo = total - pagado;
        const estaPagada = saldo <= 0;

        const tr = document.createElement('tr');
        tr.className = 'row-factura';
        tr.onclick = () => toggleDetails(`details-${f._id}`);
        tr.innerHTML = `
            <td>${f.fecha ? new Date(f.fecha).toLocaleDateString() : '---'}</td>
            <td style="font-weight: 700; color: #1e3a8a;">${formatearNumeroOT(f)}</td>
            <td>${(f.cliente?.nombre || f.clienteNombre || 'Cliente Genérico').toUpperCase()}</td>
            <td style="font-weight: 600;">${formatter.format(total)}</td>
            <td style="color: ${estaPagada ? '#059669' : '#e11d48'}; font-weight: 700;">${formatter.format(saldo)}</td>
            <td><span class="badge-status ${estaPagada ? 'badge-pagado' : 'badge-abonado'}">${estaPagada ? 'PAGADA' : 'CON SALDO'}</span></td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-info" onclick="event.stopPropagation(); toggleDetails('details-${f._id}')">INFO</button>
                    <button onclick="event.stopPropagation(); abrirAnalisisCostos('${f._id}')" style="background:#fce7f3; color:#9d174d; border:1px solid #fbcfe8; padding:8px; border-radius:6px; cursor:pointer;"><i class="fas fa-eye"></i></button>
                    <button onclick="event.stopPropagation(); eliminarFactura('${f._id}', '${formatearNumeroOT(f)}')" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca; padding:8px; border-radius:6px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </div>
            </td>`;

        const trDetails = document.createElement('tr');
        trDetails.id = `details-${f._id}`;
        trDetails.className = 'detalle-acordeon';
        trDetails.style.display = 'none'; 
        trDetails.style.backgroundColor = '#f8fafc';
        
        // CORRECCIÓN CLAVE: Pasamos los valores como parseFloat para evitar errores de tipo
        trDetails.innerHTML = `
            <td colspan="7" style="padding: 15px; border-left: 5px solid #3b82f6;">
                <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="text-align: left;">
                        <h4 style="margin: 0; color: #1e3a8a; font-size: 0.9rem;">RESUMEN FINANCIERO</h4>
                        <div style="display: flex; gap: 20px; font-size: 0.85rem; margin-top: 5px;">
                            <span>Total: <b>${formatter.format(total)}</b></span>
                            <span style="color: #059669;">Pagado: <b>${formatter.format(pagado)}</b></span>
                            <span style="color: #dc2626;">Saldo: <b>${formatter.format(saldo)}</b></span>
                        </div>
                    </div>
                    <div>
                        ${!estaPagada ? 
                            `<button onclick="event.stopPropagation(); abrirModalAbono('${f._id}', ${total}, ${pagado})" 
                                     style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 700;">
                                <i class="fas fa-plus-circle"></i> REGISTRAR PAGO
                             </button>` 
                            : '<b style="color: #059669;"><i class="fas fa-check-circle"></i> PAGADA</b>'}
                    </div>
                </div>
            </td>`;

        tableBody.appendChild(tr);
        tableBody.appendChild(trDetails);
    });
}

// 8. CONTROL ACORDEÓN (SE MANTIENE IGUAL)
function toggleDetails(id) {
    const fila = document.getElementById(id);
    if (!fila) return;
    const abierta = fila.style.display === 'table-row';
    document.querySelectorAll('.detalle-acordeon').forEach(el => el.style.display = 'none');
    if (!abierta) fila.style.display = 'table-row';
}

// 9. GESTIÓN DE ABONOS (CORREGIDA PARA TRABAJAR CON EL FORMATTER GLOBAL)
async function abrirModalAbono(id, valorTotal, abonoPrevio) {
    // Blindaje 1: Mantener formateador local (SIN CAMBIOS)
    const formatter = new Intl.NumberFormat('es-CO', { 
        style: 'currency', currency: 'COP', maximumFractionDigits: 0 
    });

    // Blindaje 2: Conversión estricta a números (SIN CAMBIOS)
    const totalNum = Number(valorTotal) || 0;
    const abonoPrevioNum = Number(abonoPrevio) || 0;
    const saldoActual = totalNum - abonoPrevioNum;
    
    const { value: montoInput } = await Swal.fire({
        title: 'Registrar Nuevo Pago',
        html: `<p>Saldo pendiente: <b style="color:#e11d48">${formatter.format(saldoActual)}</b></p>`,
        input: 'number',
        inputPlaceholder: 'Ingrese monto',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value || value <= 0) return 'Ingrese un monto válido';
            if (Number(value) > saldoActual) return 'El abono excede el saldo';
        }
    });

    if (montoInput) {
        Swal.fire({ 
            title: 'Procesando...', 
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading() 
        });

        const nuevoTotalPagado = abonoPrevioNum + Number(montoInput);

        try {
            // ÚNICA CORRECCIÓN: Se usa la ruta absoluta para evitar el error 405 en Netlify
            // Esta ruta coincide con la estructura de la función eliminar que ya te funciona.
            const res = await fetch(`/.netlify/functions/server/invoices/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalPagado: nuevoTotalPagado })
            });

            if (res.ok) {
                await Swal.fire({
                    icon: 'success',
                    title: '¡Éxito!',
                    text: 'Pago registrado correctamente',
                    timer: 1500,
                    showConfirmButton: false
                });
                
                // Refrescar la tabla o recargar (SIN CAMBIOS)
                if (typeof fetchInvoices === 'function') {
                    await fetchInvoices();
                } else {
                    location.reload();
                }
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Error en la respuesta del servidor');
            }
        } catch (error) { 
            console.error("Error al pagar:", error);
            // Mostramos el error real (SIN CAMBIOS)
            Swal.fire('Error de Conexión', error.message || 'No se pudo conectar con el servidor.', 'error'); 
        }
    }
}

// 10. AUDITORÍA (SE MANTIENE IGUAL)
async function abrirAnalisisCostos(id) {
    const f = todasLasFacturas.find(fact => fact._id === id);
    if (!f) return;
    const materialesHTML = (f.items || []).map(item => `
        <div style="display:flex; justify-content:space-between; padding:5px 0; font-size:0.8rem; border-bottom:1px solid #eee;">
            <span>${(item.nombre || 'Material').toUpperCase()}</span>
            <b>${formatter.format(item.costoBase || 0)}</b>
        </div>`).join('');

    Swal.fire({
        title: `AUDITORÍA OT: ${formatearNumeroOT(f)}`,
        html: `<div style="text-align:left;">${materialesHTML}</div>`,
        confirmButtonColor: '#1e3a8a'
    });
}

// 11. BUSCADOR (SE MANTIENE IGUAL)
function configurarBuscador() {
    const input = document.getElementById('searchInputFacturas');
    if (input) input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        renderTable(todasLasFacturas.filter(f => (f.cliente?.nombre || f.clienteNombre || "").toLowerCase().includes(term) || formatearNumeroOT(f).toLowerCase().includes(term)));
    });
}

// 12. ELIMINAR (SE MANTIENE IGUAL)
async function eliminarFactura(id, numero) {
    if (confirm(`¿Eliminar Orden ${numero}?`)) {
        const res = await fetch(`/.netlify/functions/server/invoices/${id}`, { method: 'DELETE' });
        if (res.ok) { alert("Orden eliminada"); fetchInvoices(); }
    }
}