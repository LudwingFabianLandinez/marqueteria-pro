/**
 * Lógica del Historial de Órdenes de Trabajo - MARQUETERÍA LA CHICA MORALES
 * Versión: 16.0.0 - REPORTE MAESTRO DE AUDITORÍA DETALLADO (VINCULADO A INVENTARIO)
 * Blindaje: Análisis local para evitar 404 y reporte profesional con desglose de costos x3.
 */

let todasLasFacturas = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchInvoices();
    configurarBuscador();
    
    // Vinculación LIMPIA del botón de reporte diario
    const btnReporte = document.querySelector('.btn-primary') || 
                    document.querySelector('button[onclick*="generarReporte"]') ||
                    Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('REPORTE HOY'));
    
    if (btnReporte) {
        btnReporte.onclick = (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 
            generarReporteDiario();
        };
    }

    const btnExcel = document.querySelector('.btn-success') || 
                    document.querySelector('button[onclick*="exportarExcel"]') ||
                    Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('EXCEL'));
    
    if (btnExcel) {
        btnExcel.onclick = exportarAExcel;
    }
});

// --- 1. FORMATEO DE NÚMERO DE ORDEN (INTACTO) ---
function formatearNumeroOT(f) {
    const num = f.numeroFactura || f.ot || f.numeroOT || f.numeroOrden;
    if (num && num !== "undefined") {
        return num.toString().startsWith('OT-') ? num : `OT-${num.toString().padStart(6, '0')}`;
    }
    const idSufijo = f._id ? f._id.substring(f._id.length - 4).toUpperCase() : '0000';
    return `OT-${idSufijo}`;
}

// --- 2. CARGA DE DATOS (Sincronizado) ---
// --- 1. CARGA DE ÓRDENES DESDE EL SERVIDOR (SIN PREFIJO /API) ---
async function fetchInvoices() {
    try {
        console.log("📡 Conectando con el servidor de órdenes...");
        
        // Mantener la ruta unificada de Netlify Functions
        const response = await fetch('/.netlify/functions/server/invoices');
        
        if (!response.ok) {
            throw new Error(`Servidor respondió con estado ${response.status}`);
        }

        const result = await response.json();
        
        // Blindaje de datos: Algunas APIs envuelven los datos en .data, otras envían el array directo
        // Mantengo tu lógica de asignación para no romper compatibilidad
        todasLasFacturas = result.data || result || [];
        
        if (!Array.isArray(todasLasFacturas)) {
            console.warn("⚠️ Los datos recibidos no son un array, ajustando...");
            todasLasFacturas = [];
        }

        console.log(`✅ Se cargaron ${todasLasFacturas.length} órdenes con éxito.`);

        // Renderizado de la tabla con los datos normalizados
        renderTable(todasLasFacturas);
        
        // Actualización del contador visual de órdenes
        const contador = document.querySelector('.badge-soft-blue');
        if (contador) {
            contador.textContent = `${todasLasFacturas.length} órdenes`;
        }
        
    } catch (error) {
        console.error("❌ Error crítico cargando órdenes:", error);
        
        // Alerta visual discreta para el usuario
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Error de Sincronización',
                text: 'No pudimos conectar con la base de datos de órdenes.',
                icon: 'warning',
                confirmButtonColor: '#1e3a8a'
            });
        }
    }
}

// --- 3. REPORTE DE AUDITORÍA DETALLADO (PUNTOS 1 AL 5 CORREGIDO) ---
async function generarReporteDiario() {
    try {
        // Mantenemos tu variable exacta
        const facturasAReportar = todasLasFacturas; 
        const inventarioLocal = JSON.parse(localStorage.getItem('inventory') || '[]');
        const formatter = new Intl.NumberFormat('es-CO', { 
            style: 'currency', currency: 'COP', maximumFractionDigits: 0 
        });

        // ESTRUCTURA QUIRÚRGICA: NO SE TOCA EL WINDOW.OPEN
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

            // BÚSQUEDA AGRESIVA DEL CLIENTE PARA EVITAR "CLIENTE GENERAL"
            let nombreCliente = "CLIENTE GENERAL";
            if (f.cliente && typeof f.cliente === 'object' && f.cliente.nombre) {
                nombreCliente = f.cliente.nombre;
            } else if (f.clienteNombre) {
                nombreCliente = f.clienteNombre;
            } else if (typeof f.cliente === 'string' && f.cliente.trim() !== "") {
                nombreCliente = f.cliente;
            }
            nombreCliente = nombreCliente.toUpperCase();

            // LIMPIEZA DE FECHA: Eliminamos el código T04:16...
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

// --- 4. EXPORTAR A EXCEL (INTACTO) ---
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

// --- 5. RENDERIZADO DE LA TABLA (UNIFICADO Y ACTUALIZADO) ---
function renderTable(facturas) {
    const tableBody = document.getElementById('invoiceTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    facturas.forEach(f => {
        const tr = document.createElement('tr');
        
        // Blindaje de variables intacto
        const total = Number(f.totalFactura || f.total || 0);
        const pagado = Number(f.totalPagado || f.abono || 0);
        const saldo = total - pagado;
        
        const numeroOT = formatearNumeroOT(f);
        const clienteVisual = (f.cliente?.nombre || f.clienteNombre || 'Cliente Genérico').toUpperCase();

        // Lógica de estado intacta
        const estaPagada = saldo <= 0;

        tr.innerHTML = `
            <td>${f.fecha ? new Date(f.fecha).toLocaleDateString() : '---'}</td>
            <td style="font-weight: 700; color: #1e3a8a;">${numeroOT}</td>
            <td>${clienteVisual}</td>
            <td style="font-weight: 600;">${formatter.format(total)}</td>
            <td style="color: ${estaPagada ? '#059669' : '#e11d48'}; font-weight: 600;">${formatter.format(saldo)}</td>
            <td>
                <span class="badge-status ${estaPagada ? 'badge-pagado' : 'badge-abonado'}">
                    ${estaPagada ? 'PAGADA' : 'ABONADO'}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center; justify-content: center;">
                    <button onclick="abrirModalAbono('${f._id}', ${total}, ${pagado})" 
                            title="${estaPagada ? 'Ver historial' : 'Abonar'}"
                            style="background: ${estaPagada ? '#f1f5f9' : '#e0f2fe'}; 
                                   color: ${estaPagada ? '#94a3b8' : '#0369a1'}; 
                                   border: 1px solid ${estaPagada ? '#e2e8f0' : '#bae6fd'};
                                   padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.75rem; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-edit"></i> ${estaPagada ? 'PAGOS' : 'ABONAR'}
                    </button>

                    <button onclick="abrirAnalisisCostos('${f._id}')" 
                            title="Ver Auditoría"
                            style="background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center;">
                        <i class="fas fa-eye"></i>
                    </button>

                    <button onclick="eliminarFactura('${f._id}', '${numeroOT}')" 
                            title="Eliminar Orden"
                            style="background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>`;
        tableBody.appendChild(tr);
    });
}

// --- 6. FUNCIÓN DE ANÁLISIS DE COSTOS (MODAL INTEGRADO SIN REDIRECCIÓN) ---
async function abrirAnalisisCostos(id) {
    if (!id) return;

    try {
        // Mostramos carga mientras obtenemos datos del servidor
        Swal.fire({
            title: 'Consultando Auditoría...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // RUTA BLINDADA: Asegura la conexión con Netlify Functions
        const res = await fetch(`/.netlify/functions/server/invoices/${id}`);
        if (!res.ok) throw new Error('No se encontró la orden en la base de datos');
        
        const f = await res.json();
        const formatter = new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP', 
            maximumFractionDigits: 0 
        });

        // Sincronización de variables según el nuevo estándar
        const manoObra = Number(f.manoObra || f.mano_obra_total || 0);
        const totalFactura = Number(f.totalFactura || f.total || 0);
        
        // Generamos la lista de materiales dinámica
        const materialesHTML = (f.items || []).map(item => `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding:8px 0; font-size:0.85rem;">
                <span style="color:#475569;">• ${(item.descripcion || item.nombre || 'Material').toUpperCase()}</span>
                <span style="font-weight:700; color:#1e293b;">${formatter.format(item.costoBase || 0)}</span>
            </div>
        `).join('');

        // Modal de Análisis Detallado (Diseño Pro)
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
                </div>
            `,
            confirmButtonText: 'CERRAR ANÁLISIS',
            confirmButtonColor: '#1e3a8a',
            showCloseButton: true
        });

    } catch (error) {
        console.error("Error en análisis:", error);
        Swal.fire({
            title: 'Error de Conexión',
            text: 'No pudimos obtener los costos del servidor. Verifica tu conexión.',
            icon: 'error',
            confirmButtonColor: '#ef4444'
        });
    }
}


// --- 7. BUSCADOR (INTACTO) ---
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

// --- 8. ELIMINAR (INTACTO) ---
async function eliminarFactura(id, numero) {
    if (confirm(`¿Estás seguro de eliminar la Orden ${numero}?`)) {
        try {
            const res = await fetch(`/.netlify/functions/server/invoices/${id}`, { 
                method: 'DELETE' 
            });
            if (res.ok) {
                alert("✅ Orden eliminada exitosamente");
                fetchInvoices();
            } else {
                alert("❌ No se pudo eliminar la orden.");
            }
        } catch (error) { 
            console.error("Error al eliminar:", error); 
        }
    }
}

// --- CORRECCIÓN DE BOTÓN AZUL: GESTIÓN DE ABONOS ---
async function abrirModalAbono(id, valorTotal, abonoPrevio) {
    // ... (Mantén toda tu lógica de formatter y saldo igual que antes) ...

    if (nuevoAbono) {
        // ... (Bloqueo visual de "Procesando..." igual) ...

        const nuevoTotalPagado = abonoPrevio + parseFloat(nuevoAbono);
        
        try {
            // CORRECCIÓN VITAL: Eliminamos '/api' de la URL
            const res = await fetch(`/.netlify/functions/server/invoices/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalPagado: nuevoTotalPagado })
            });

            if (res.ok) {
                // ... (Mensaje de éxito y refresco de tabla igual) ...
            } else {
                throw new Error("Error en respuesta del servidor");
            }
        } catch (error) {
            console.error("Error al guardar pago:", error);
            Swal.fire('Error', 'No se pudo guardar el pago. Verifica tu conexión.', 'error');
        }
    }
}

// --- CORRECCIÓN DE BOTÓN ROSA: ANÁLISIS DE COSTOS ---
async function abrirAnalisisCostos(id) {
    if (!id) return;
    try {
        // ... (Carga de Swal igual) ...

        // CORRECCIÓN VITAL: Eliminamos '/api' de la URL
        const res = await fetch(`/.netlify/functions/server/invoices/${id}`);
        if (!res.ok) throw new Error('No se encontró la orden');
        
        const f = await res.json();
        // ... (Mantén todo el resto del diseño del modal intacto) ...

    } catch (error) {
        console.error("Error en análisis:", error);
        Swal.fire('Error', 'No pudimos cargar los costos.', 'error');
    }
}