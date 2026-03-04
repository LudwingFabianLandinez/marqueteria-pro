/**
 * Lógica del Historial de Órdenes de Trabajo - MARQUETERÍA LA CHICA MORALES
 * Versión: 17.0.0 - REPARACIÓN DE CARGA Y ACORDEÓN (CONSOLIDADO)
 */

let todasLasFacturas = [];

// 1. ARRANCAR CARGA DE DATOS DE INMEDIATO
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Iniciando carga de historial...");
    
    // Ejecutamos la carga de datos primero que todo
    await fetchInvoices(); 

    // Luego intentamos configurar lo demás, pero con protección
    try {
        configurarBuscador();
    } catch (e) { console.warn("Aviso: El buscador no se pudo configurar", e); }

    try {
        vincularBotones();
    } catch (e) { console.warn("Aviso: Error vinculando botones", e); }
});

// 2. FUNCIÓN DE VINCULACIÓN PROTEGIDA
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

// 3. FETCH INVOICES (CONSOLIDADA Y ORDENADA)
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

// --- 4. FORMATEO DE NÚMERO DE ORDEN ---
function formatearNumeroOT(f) {
    const num = f.numeroFactura || f.ot || f.numeroOT || f.numeroOrden;
    if (num && num !== "undefined") {
        return num.toString().startsWith('OT-') ? num : `OT-${num.toString().padStart(6, '0')}`;
    }
    const idSufijo = f._id ? f._id.substring(f._id.length - 4).toUpperCase() : '0000';
    return `OT-${idSufijo}`;
}

// --- 5. REPORTE DE AUDITORÍA DIARIO (ESTRUCTURA QUIRÚRGICA) ---
async function generarReporteDiario() {
    try {
        const facturasAReportar = todasLasFacturas; 
        const inventarioLocal = JSON.parse(localStorage.getItem('inventory') || '[]');
        const formatter = new Intl.NumberFormat('es-CO', { 
            style: 'currency', currency: 'COP', maximumFractionDigits: 0 
        });

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

            let nombreCliente = "CLIENTE GENERAL";
            if (f.cliente && typeof f.cliente === 'object' && f.cliente.nombre) {
                nombreCliente = f.cliente.nombre;
            } else if (f.clienteNombre) {
                nombreCliente = f.clienteNombre;
            } else if (typeof f.cliente === 'string' && f.cliente.trim() !== "") {
                nombreCliente = f.cliente;
            }
            nombreCliente = nombreCliente.toUpperCase();

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
                
                if (nombreReal === "MATERIAL" && costoBaseUnitario > 0) {
                    const match = inventarioLocal.find(inv => 
                        Math.abs(Number(inv.costo_m2 || inv.precio_m2_costo) - costoBaseUnitario) < 10
                    );
                    if (match) nombreReal = match.nombre.toUpperCase();
                }

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

        htmlContenido += `
            <script>
                function exportarExcel() {
                    var html = document.body.innerHTML;
                    var blob = new Blob([html], { type: 'application/vnd.ms-excel' });
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'Reporte_Ventas_Chica_Morales.xls';
                    a.click();
                }
            </script>
        </body></html>`;

        nuevaVentana.document.write(htmlContenido);
        nuevaVentana.document.close();
    } catch (e) { console.error(e); }
}

// --- 6. EXPORTAR A EXCEL (CSV) ---
function exportarAExcel() {
    if (todasLasFacturas.length === 0) {
        alert("No hay datos para exportar");
        return;
    }
    try {
        let csvContent = "\uFEFF"; 
        csvContent += "Fecha,OT,Cliente,Total Venta,Saldo,Estado\n";
        todasLasFacturas.forEach(f => {
            const fecha = f.fecha ? new Date(f.fecha).toLocaleDateString() : '---';
            const ot = formatearNumeroOT(f);
            const cliente = (f.cliente?.nombre || f.clienteNombre || "Cliente").replace(/,/g, ''); 
            const total = Number(f.totalFactura || f.total) || 0;
            const abono = Number(f.totalPagado || f.abono || 0);
            const saldo = total - abono;
            csvContent += `${fecha},${ot},${cliente},${total},${saldo},${saldo <= 0 ? "PAGADO" : "ABONADO"}\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Reporte_Ventas.csv`);
        link.click();
    } catch (error) { console.error("Error Excel:", error); }
}

// --- 7. RENDERIZADO DE LA TABLA CON ACORDEÓN ---
function renderTable(facturas) {
    // Sincronizado con el ID de tu tabla física en el HTML
    const tableBody = document.getElementById('tablaFacturas');
    if (!tableBody) {
        console.error("❌ No se encontró el elemento 'tablaFacturas'");
        return;
    }
    
    tableBody.innerHTML = '';

    const formatter = new Intl.NumberFormat('es-CO', { 
        style: 'currency', currency: 'COP', maximumFractionDigits: 0 
    });

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
                            title="Ver detalles de abonos"
                            style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.75rem; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-chevron-down"></i> INFO
                    </button>
                    <button onclick="event.stopPropagation(); abrirAnalisisCostos('${f._id}')" 
                            title="Ver Auditoría"
                            style="background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center;">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="event.stopPropagation(); eliminarFactura('${f._id}', '${numeroOT}')" 
                            title="Eliminar Orden"
                            style="background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>`;

        // Al hacer clic en cualquier parte de la fila se abre el acordeón
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

// --- 8. CONTROL DE ACORDEÓN ---
function toggleDetails(id) {
    const fila = document.getElementById(id);
    if (!fila) return;

    const estaAbierta = fila.style.display === 'table-row';

    document.querySelectorAll('.detalle-acordeon').forEach(el => {
        el.style.display = 'none';
    });

    if (!estaAbierta) {
        fila.style.display = 'table-row';
        fila.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// --- 9. GESTIÓN DE ABONOS (BOTÓN AZUL) ---
async function abrirModalAbono(id, valorTotal, abonoPrevio) {
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    const saldoActual = valorTotal - abonoPrevio;
    
    const { value: monto } = await Swal.fire({
        title: 'Registrar Nuevo Pago',
        html: `<p>Saldo pendiente: <b style="color:#e11d48">${formatter.format(saldoActual)}</b></p>`,
        input: 'number',
        inputPlaceholder: 'Ingrese el monto del abono',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonText: 'Cancelar'
    });

    if (monto && monto > 0) {
        Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const nuevoTotalPagado = abonoPrevio + parseFloat(monto);
        try {
            const res = await fetch(`/.netlify/functions/server/invoices/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalPagado: nuevoTotalPagado })
            });

            if (res.ok) {
                await Swal.fire('¡Éxito!', 'El pago ha sido registrado.', 'success');
                fetchInvoices();
            }
        } catch (error) {
            Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
        }
    }
}

// --- 10. ANÁLISIS DE COSTOS (BOTÓN ROSA - MODAL PRO) ---
async function abrirAnalisisCostos(id) {
    if (!id) return;
    try {
        Swal.fire({ title: 'Consultando Auditoría...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        const res = await fetch(`/.netlify/functions/server/invoices/${id}`);
        if (!res.ok) throw new Error('No se encontró la orden');
        
        const f = await res.json();
        const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

        const manoObra = Number(f.manoObra || f.mano_obra_total || 0);
        const totalFactura = Number(f.totalFactura || f.total || 0);
        
        const materialesHTML = (f.items || []).map(item => `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding:8px 0; font-size:0.85rem;">
                <span style="color:#475569;">• ${(item.descripcion || item.nombre || 'Material').toUpperCase()}</span>
                <span style="font-weight:700; color:#1e293b;">${formatter.format(item.costoBase || 0)}</span>
            </div>
        `).join('');

        Swal.fire({
            title: `<span style="color:#1e3a8a; font-weight:800;">AUDITORÍA OT: ${f.numeroFactura || f.ot || 'S/N'}</span>`,
            html: `
                <div style="text-align: left; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <div style="background:#f8fafc; padding:12px; border-radius:10px; margin-bottom:15px; border:1px solid #e2e8f0;">
                        <strong style="color:#64748b; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px;">Información del Cliente:</strong><br>
                        <span style="font-weight:700; font-size:1.1rem; color:#1e3a8a;">${(f.cliente?.nombre || f.clienteNombre || 'CLIENTE GENERAL').toUpperCase()}</span>
                    </div>
                    <h4 style="font-size:0.9rem; color:#1e3a8a; border-bottom:2px solid #3b82f6; padding-bottom:5px; margin-bottom:10px; font-weight:800;">DESGLOSE DE COSTOS BASE</h4>
                    <div style="max-height: 200px; overflow-y: auto; margin-bottom:10px; padding-right:5px;">
                        ${materialesHTML || '<p style="color:#94a3b8; font-style:italic;">No hay materiales registrados</p>'}
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:10px; padding:10px; font-weight:700; color:#1e3a8a; background:#eff6ff; border-radius:6px;">
                        <span>MANO DE OBRA:</span>
                        <span>${formatter.format(manoObra)}</span>
                    </div>
                    <div style="margin-top:20px; padding:15px; border-radius:10px; background:linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); color:white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.8rem; opacity:0.9; font-weight:600;">PRECIO FINAL COBRADO:</span>
                            <span style="font-size:1.4rem; font-weight:900;">${formatter.format(totalFactura)}</span>
                        </div>
                    </div>
                </div>`,
            confirmButtonText: 'CERRAR ANÁLISIS',
            confirmButtonColor: '#1e3a8a',
            showCloseButton: true
        });

    } catch (error) {
        console.error("Error en análisis:", error);
        Swal.fire('Error', 'No pudimos cargar los costos.', 'error');
    }
}

// --- 11. BUSCADOR ---
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

// --- 10. LÓGICA DE ABONOS (ACTIVA EL BOTÓN REGISTRAR PAGO) ---
async function abrirModalAbono(id, valorTotal, abonoPrevio) {
    const saldoActual = valorTotal - abonoPrevio;
    
    const { value: monto } = await Swal.fire({
        title: 'Registrar Nuevo Pago',
        html: `
            <div style="text-align: left; font-family: sans-serif;">
                <p>Monto pendiente: <b style="color:#e11d48">${formatter.format(saldoActual)}</b></p>
                <label style="display:block; margin-bottom:5px; font-size:0.8rem; color:#64748b;">VALOR A ABONAR:</label>
            </div>`,
        input: 'number',
        inputAttributes: { min: 1, step: 1 },
        inputPlaceholder: 'Ej: 50000',
        showCancelButton: true,
        confirmButtonText: 'Confirmar Pago',
        confirmButtonColor: '#059669',
        cancelButtonText: 'Cancelar',
        preConfirm: (value) => {
            if (!value || value <= 0) {
                Swal.showValidationMessage('Por favor ingresa un monto válido');
            }
            if (value > saldoActual) {
                Swal.showValidationMessage('El abono no puede exceder el saldo pendiente');
            }
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
            await Swal.fire('¡Éxito!', 'Pago registrado correctamente.', 'success');
            fetchInvoices(); // Refresca la tabla automáticamente para ver el nuevo saldo
        } else {
            throw new Error();
        }
    } catch (e) {
        Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    }
}

// --- 11. LÓGICA DE AUDITORÍA (BOTÓN OJO 👁️ - DISEÑO PRO) ---
async function abrirAnalisisCostos(id) {
    const f = todasLasFacturas.find(fact => fact._id === id);
    if (!f) return;

    const manoObra = Number(f.manoObra || 0);
    const totalFactura = Number(f.totalFactura || f.total || 0);
    
    const materialesHTML = (f.items || []).map(item => `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding:8px 0; font-size:0.85rem;">
            <span style="color:#475569;">• ${(item.descripcion || item.nombre || 'Material').toUpperCase()}</span>
            <span style="font-weight:700; color:#1e293b;">${formatter.format(item.costoBase || 0)}</span>
        </div>
    `).join('');

    Swal.fire({
        title: `<span style="color:#1e3a8a; font-weight:800;">AUDITORÍA OT: ${formatearNumeroOT(f)}</span>`,
        html: `
            <div style="text-align: left; font-family: 'Segoe UI', sans-serif;">
                <div style="background:#f8fafc; padding:12px; border-radius:10px; margin-bottom:15px; border:1px solid #e2e8f0;">
                    <strong style="color:#64748b; font-size:0.7rem; text-transform:uppercase;">Cliente:</strong><br>
                    <span style="font-weight:700; color:#1e3a8a;">${(f.cliente?.nombre || f.clienteNombre || 'CLIENTE').toUpperCase()}</span>
                </div>
                <h4 style="font-size:0.9rem; color:#1e3a8a; border-bottom:2px solid #3b82f6; padding-bottom:5px; margin-bottom:10px;">COSTOS DE PRODUCCIÓN</h4>
                <div style="max-height: 150px; overflow-y: auto;">
                    ${materialesHTML || '<p>No hay materiales registrados</p>'}
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:10px; padding:10px; font-weight:700; background:#eff6ff; border-radius:6px;">
                    <span>MANO DE OBRA:</span>
                    <span>${formatter.format(manoObra)}</span>
                </div>
                <div style="margin-top:20px; padding:15px; border-radius:10px; background:#1e3a8a; color:white;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.8rem;">TOTAL COBRADO:</span>
                        <span style="font-size:1.2rem; font-weight:900;">${formatter.format(totalFactura)}</span>
                    </div>
                </div>
            </div>`,
        confirmButtonText: 'CERRAR',
        confirmButtonColor: '#1e3a8a'
    });
}

// --- 12. ELIMINAR ---
async function eliminarFactura(id, numero) {
    if (confirm(`¿Estás seguro de eliminar la Orden ${numero}?`)) {
        try {
            const res = await fetch(`/.netlify/functions/server/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert("✅ Orden eliminada exitosamente");
                fetchInvoices();
            } else {
                alert("❌ No se pudo eliminar la orden.");
            }
        } catch (error) { console.error("Error al eliminar:", error); }
    }
}