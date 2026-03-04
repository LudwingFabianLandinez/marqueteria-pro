/**
 * Lógica del Historial de Órdenes de Trabajo - MARQUETERÍA LA CHICA MORALES
 * Versión: 17.1.0 - OPTIMIZADA Y CONSOLIDADA
 */

let todasLasFacturas = [];
const formatter = new Intl.NumberFormat('es-CO', { 
    style: 'currency', currency: 'COP', maximumFractionDigits: 0 
});

// --- 1. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Iniciando carga de historial...");
    
    // Carga de datos inicial
    await fetchInvoices(); 

    // Configuraciones protegidas
    try {
        configurarBuscador();
    } catch (e) { console.warn("Aviso: El buscador no se pudo configurar", e); }

    try {
        vincularBotones();
    } catch (e) { console.warn("Aviso: Error vinculando botones", e); }
});

// --- 2. VINCULACIÓN DE EVENTOS ---
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

// --- 3. OBTENCIÓN DE DATOS (API) ---
async function fetchInvoices() {
    try {
        const response = await fetch('/.netlify/functions/server/invoices');
        if (!response.ok) throw new Error(`Error: ${response.status}`);
        todasLasFacturas = await response.json();
        
        // Ordenar: Más recientes arriba
        todasLasFacturas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        console.log("📦 Datos recibidos:", todasLasFacturas.length);
        renderTable(todasLasFacturas);
    } catch (error) {
        console.error("❌ Error de conexión:", error);
    }
}

// --- 4. UTILIDADES DE FORMATEO ---
function formatearNumeroOT(f) {
    const num = f.numeroFactura || f.ot || f.numeroOT || f.numeroOrden;
    if (num && num !== "undefined") {
        return num.toString().startsWith('OT-') ? num : `OT-${num.toString().padStart(6, '0')}`;
    }
    const idSufijo = f._id ? f._id.substring(f._id.length - 4).toUpperCase() : '0000';
    return `OT-${idSufijo}`;
}

// --- 5. RENDERIZADO DE TABLA Y ACORDEÓN ---
function renderTable(facturas) {
    const tableBody = document.getElementById('tablaFacturas');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';

    if (!facturas || facturas.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">No se encontraron órdenes de trabajo.</td></tr>`;
        return;
    }

    facturas.forEach(f => {
        const total = Number(f.totalFactura || f.total || 0);
        const pagado = Number(f.totalPagado || f.abono || 0);
        const saldo = total - pagado;
        const numeroOT = formatearNumeroOT(f);
        const clienteVisual = (f.cliente?.nombre || f.clienteNombre || 'Cliente Genérico').toUpperCase();
        const estaPagada = saldo <= 0;

        const tr = document.createElement('tr');
        tr.className = 'row-factura';
        tr.style.cursor = 'pointer'; 
        tr.innerHTML = `
            <td>${f.fecha ? new Date(f.fecha).toLocaleDateString() : '---'}</td>
            <td style="font-weight: 700; color: #1e3a8a;">${numeroOT}</td>
            <td>${clienteVisual}</td>
            <td style="font-weight: 600;">${formatter.format(total)}</td>
            <td style="color: ${estaPagada ? '#059669' : '#e11d48'}; font-weight: 700;">${formatter.format(saldo)}</td>
            <td>
                <span class="badge-status ${estaPagada ? 'badge-pagado' : 'badge-abonado'}">
                    ${estaPagada ? 'PAGADA' : 'CON SALDO'}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-end;">
                    <button onclick="event.stopPropagation(); toggleDetails('details-${f._id}')" 
                            style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.75rem;">
                        <i class="fas fa-chevron-down"></i> INFO
                    </button>
                    <button onclick="event.stopPropagation(); abrirAnalisisCostos('${f._id}')" 
                            style="background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="event.stopPropagation(); eliminarFactura('${f._id}', '${numeroOT}')" 
                            style="background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>`;

        tr.onclick = () => toggleDetails(`details-${f._id}`);

        const trDetails = document.createElement('tr');
        trDetails.id = `details-${f._id}`;
        trDetails.className = 'detalle-acordeon';
        trDetails.style.display = 'none'; 
        trDetails.style.backgroundColor = '#f8fafc';
        
        trDetails.innerHTML = `
            <td colspan="7" style="padding: 15px; border-left: 5px solid #3b82f6;">
                <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="text-align: left;">
                        <h4 style="margin: 0 0 10px 0; color: #1e3a8a; font-size: 0.9rem; text-transform: uppercase;">Resumen Financiero</h4>
                        <div style="display: grid; grid-template-columns: auto auto auto; gap: 20px; font-size: 0.85rem;">
                            <span>Total: <b>${formatter.format(total)}</b></span>
                            <span style="color: #059669;">Pagado: <b>${formatter.format(pagado)}</b></span>
                            <span style="color: #dc2626;">Saldo: <b>${formatter.format(saldo)}</b></span>
                        </div>
                    </div>
                    <div>
                        ${!estaPagada ? 
                            `<button onclick="abrirModalAbono('${f._id}', ${total}, ${pagado})" 
                                     style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-plus-circle"></i> REGISTRAR PAGO
                             </button>` 
                            : '<b style="color: #059669; font-size: 0.9rem;"><i class="fas fa-check-circle"></i> TOTALMENTE PAGA</b>'}
                    </div>
                </div>
            </td>`;

        tableBody.appendChild(tr);
        tableBody.appendChild(trDetails);
    });
}

function toggleDetails(id) {
    const fila = document.getElementById(id);
    if (!fila) return;
    const estaAbierta = fila.style.display === 'table-row';
    document.querySelectorAll('.detalle-acordeon').forEach(el => el.style.display = 'none');
    if (!estaAbierta) {
        fila.style.display = 'table-row';
        fila.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// --- 6. GESTIÓN DE PAGOS (ABONOS) ---
async function abrirModalAbono(id, valorTotal, abonoPrevio) {
    const saldoActual = valorTotal - abonoPrevio;
    
    const { value: monto } = await Swal.fire({
        title: 'Registrar Nuevo Pago',
        html: `<div style="text-align: left;">
                <p>Saldo pendiente: <b style="color:#e11d48">${formatter.format(saldoActual)}</b></p>
               </div>`,
        input: 'number',
        inputAttributes: { min: 1, step: 1 },
        inputPlaceholder: 'Monto a abonar',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        preConfirm: (value) => {
            if (!value || value <= 0) return Swal.showValidationMessage('Ingrese un monto válido');
            if (value > saldoActual) return Swal.showValidationMessage('El abono no puede exceder el saldo');
            return value;
        }
    });

    if (monto) {
        realizarPago(id, abonoPrevio, monto);
    }
}

async function realizarPago(id, abonoPrevio, monto) {
    Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const nuevoTotalPagado = parseFloat(abonoPrevio) + parseFloat(monto);

    try {
        const res = await fetch(`/.netlify/functions/server/invoices/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totalPagado: nuevoTotalPagado })
        });

        if (res.ok) {
            await Swal.fire('¡Éxito!', 'Pago registrado.', 'success');
            fetchInvoices();
        }
    } catch (e) {
        Swal.fire('Error', 'Error al conectar con el servidor.', 'error');
    }
}

// --- 7. AUDITORÍA Y ANÁLISIS DE COSTOS ---
async function abrirAnalisisCostos(id) {
    const f = todasLasFacturas.find(fact => fact._id === id);
    if (!f) return;

    const manoObra = Number(f.manoObra || f.mano_obra_total || 0);
    const totalFactura = Number(f.totalFactura || f.total || 0);
    
    const materialesHTML = (f.items || []).map(item => `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding:8px 0; font-size:0.85rem;">
            <span style="color:#475569;">• ${(item.descripcion || item.nombre || 'Material').toUpperCase()}</span>
            <span style="font-weight:700; color:#1e293b;">${formatter.format(item.costoBase || 0)}</span>
        </div>
    `).join('');

    Swal.fire({
        title: `<span style="color:#1e3a8a; font-weight:800;">AUDITORÍA: ${formatearNumeroOT(f)}</span>`,
        html: `
            <div style="text-align: left; font-family: 'Segoe UI', sans-serif;">
                <div style="background:#f8fafc; padding:12px; border-radius:10px; margin-bottom:15px; border:1px solid #e2e8f0;">
                    <strong style="color:#64748b; font-size:0.7rem;">CLIENTE:</strong><br>
                    <span style="font-weight:700; color:#1e3a8a;">${(f.cliente?.nombre || f.clienteNombre || 'CLIENTE').toUpperCase()}</span>
                </div>
                <h4 style="font-size:0.9rem; color:#1e3a8a; border-bottom:2px solid #3b82f6; padding-bottom:5px;">COSTOS BASE</h4>
                <div style="max-height: 150px; overflow-y: auto;">
                    ${materialesHTML || '<p>No hay materiales</p>'}
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:10px; padding:10px; font-weight:700; background:#eff6ff;">
                    <span>MANO DE OBRA:</span>
                    <span>${formatter.format(manoObra)}</span>
                </div>
                <div style="margin-top:20px; padding:15px; border-radius:10px; background:#1e3a8a; color:white; text-align:center;">
                    <span style="font-size:0.8rem;">PRECIO FINAL COBRADO:</span><br>
                    <span style="font-size:1.4rem; font-weight:900;">${formatter.format(totalFactura)}</span>
                </div>
            </div>`,
        confirmButtonText: 'CERRAR',
        confirmButtonColor: '#1e3a8a'
    });
}

// --- 8. REPORTE DIARIO (VENTANA EMERGENTE) ---
async function generarReporteDiario() {
    try {
        const inventarioLocal = JSON.parse(localStorage.getItem('inventory') || '[]');
        const nuevaVentana = window.open('', '_blank');
        
        let htmlContenido = `<html><head><title>Reporte de Ventas</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #1e293b; background: #f1f5f9; }
                .ot-card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #1e3a8a; color: white; padding: 10px; font-size: 0.75rem; }
                td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; text-align: center; }
                .resumen-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; padding: 15px; margin-top: 10px; }
                .rentabilidad { background: #f0fdf4; padding: 10px; text-align: right; font-weight: bold; color: #15803d; }
                @media print { .no-print { display: none; } }
            </style>
        </head><body>
            <div style="text-align:center;">
                <h1 style="color:#1e3a8a;">MARQUETERIA LA CHICA MORALES</h1>
                <p>FECHA: ${new Date().toLocaleDateString()}</p>
            </div>`;

        todasLasFacturas.forEach(f => {
            let sumaCostoMateriales = 0;
            let sumaMaterialesX3 = 0;
            const manoObra = Number(f.manoObra || f.mano_obra_total || 0);
            const totalCobrado = Number(f.totalFactura || f.total || 0);

            htmlContenido += `<div class="ot-card">
                <strong>${formatearNumeroOT(f)} - ${(f.cliente?.nombre || f.clienteNombre || 'CLIENTE').toUpperCase()}</strong>
                <table>
                    <thead><tr><th>Material</th><th>Área</th><th>Costo</th><th>Sugerido (x3)</th></tr></thead>
                    <tbody>`;

            (f.items || []).forEach(item => {
                const area = Number(item.area_m2 || item.area || 1);
                const costoBase = Number(item.costoBase || item.precioUnitario || 0);
                const subtotal = costoBase * area;
                sumaCostoMateriales += subtotal;
                sumaMaterialesX3 += (subtotal * 3);

                htmlContenido += `<tr>
                    <td>${(item.nombre || 'MATERIAL').toUpperCase()}</td>
                    <td>${area.toFixed(3)}</td>
                    <td>${formatter.format(subtotal)}</td>
                    <td>${formatter.format(subtotal * 3)}</td>
                </tr>`;
            });

            const rentabilidadReal = totalCobrado - sumaCostoMateriales;

            htmlContenido += `</tbody></table>
                <div class="resumen-grid">
                    <div><span>COSTOS:</span><br><b>${formatter.format(sumaCostoMateriales)}</b></div>
                    <div><span>MAT x3:</span><br><b>${formatter.format(sumaMaterialesX3)}</b></div>
                    <div><span>M. OBRA:</span><br><b>${formatter.format(manoObra)}</b></div>
                    <div><span>TOTAL OT:</span><br><b>${formatter.format(sumaMaterialesX3 + manoObra)}</b></div>
                </div>
                <div class="rentabilidad">RENTABILIDAD: ${formatter.format(rentabilidadReal)} ✅</div>
            </div>`;
        });

        htmlContenido += `</body></html>`;
        nuevaVentana.document.write(htmlContenido);
        nuevaVentana.document.close();
    } catch (e) { console.error(e); }
}

// --- 9. EXPORTAR A EXCEL (CSV) ---
function exportarAExcel() {
    if (todasLasFacturas.length === 0) return alert("No hay datos");
    let csvContent = "\uFEFF Fecha,OT,Cliente,Total,Saldo,Estado\n";
    todasLasFacturas.forEach(f => {
        const total = Number(f.totalFactura || f.total) || 0;
        const saldo = total - (Number(f.totalPagado || f.abono) || 0);
        csvContent += `${new Date(f.fecha).toLocaleDateString()},${formatearNumeroOT(f)},${(f.cliente?.nombre || f.clienteNombre || "C").replace(/,/g, '')},${total},${saldo},${saldo <= 0 ? "PAGADO" : "DEUDA"}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Ventas.csv`;
    link.click();
}

// --- 10. BUSCADOR ---
function configurarBuscador() {
    const searchInput = document.getElementById('searchInputFacturas');
    if (!searchInput) return;
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtradas = todasLasFacturas.filter(f => {
            const nombre = (f.cliente?.nombre || f.clienteNombre || "").toLowerCase();
            const ot = formatearNumeroOT(f).toLowerCase();
            return nombre.includes(term) || ot.includes(term);
        });
        renderTable(filtradas);
    });
}

// --- 11. ELIMINAR ---
async function eliminarFactura(id, numero) {
    const confirmacion = await Swal.fire({
        title: `¿Eliminar Orden ${numero}?`,
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar'
    });

    if (confirmacion.isConfirmed) {
        try {
            const res = await fetch(`/.netlify/functions/server/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                Swal.fire('Eliminado', 'La orden ha sido borrada.', 'success');
                fetchInvoices();
            }
        } catch (error) { console.error(error); }
    }
}