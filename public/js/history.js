/**
 * Lógica del Historial de Órdenes de Trabajo - MARQUETERÍA LA CHICA MORALES
 * Versión: 13.0.9 - SINCRONIZACIÓN TOTAL CON PUENTE DE FACTURACIÓN
 * Objetivo: Lectura híbrida de datos para asegurar compatibilidad de OTs nuevas y antiguas.
 */

let todasLasFacturas = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchInvoices();
    configurarBuscador();
    
    // Vinculación robusta del botón de reporte diario (Botón "REPORTE HOY")
    const btnReporte = document.querySelector('.btn-primary') || 
                       document.querySelector('button[onclick*="generarReporte"]') ||
                       Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('REPORTE HOY'));
    
    if (btnReporte) {
        btnReporte.onclick = generarReporteDiario;
    }

    // Vinculación del botón EXCEL
    const btnExcel = document.querySelector('.btn-success') || 
                     document.querySelector('button[onclick*="exportarExcel"]') ||
                     Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('EXCEL'));
    
    if (btnExcel) {
        btnExcel.onclick = exportarAExcel;
    }
});

// --- 1. FORMATEO DE NÚMERO DE ORDEN ---
function formatearNumeroOT(f) {
    // Busca número de factura o usa el ID como respaldo
    const num = f.numeroFactura || f.ot || f.numeroOT;
    if (num && num !== "undefined") {
        return num.toString().startsWith('OT-') ? num : `OT-${num.toString().padStart(6, '0')}`;
    }
    const idSufijo = f._id ? f._id.substring(f._id.length - 4).toUpperCase() : '0000';
    return `OT-${idSufijo}`;
}

// --- 2. CARGA DE DATOS DESDE EL SERVIDOR ---
async function fetchInvoices() {
    try {
        const response = await fetch('/api/invoices');
        const result = await response.json();
        
        if (result.success) {
            todasLasFacturas = result.data || [];
            renderTable(todasLasFacturas);
            
            const contador = document.querySelector('.badge-soft-blue');
            if (contador) contador.textContent = `${todasLasFacturas.length} órdenes`;
        }
    } catch (error) {
        console.error("❌ Error cargando órdenes:", error);
    }
}

// --- 3. REPORTE DIARIO (AUTÓNOMO Y LOCAL) ---
async function generarReporteDiario() {
    try {
        console.log("📊 Generando reporte desde datos locales...");
        
        const hoyDate = new Date();
        const hoyStr = hoyDate.toLocaleDateString();
        
        // Filtro local inmediato
        const facturasHoy = todasLasFacturas.filter(f => {
            const fechaF = new Date(f.fecha).toLocaleDateString();
            return fechaF === hoyStr;
        });

        if (facturasHoy.length === 0) {
            alert("ℹ️ No hay ventas registradas con fecha de hoy en el historial.");
            return;
        }

        const formatter = new Intl.NumberFormat('es-CO', { 
            style: 'currency', currency: 'COP', maximumFractionDigits: 0 
        });

        let totalVentas = 0;
        let utilidadTotal = 0;

        let filasHTML = facturasHoy.map(f => {
            const vOT = formatearNumeroOT(f);
            // Puente de datos: busca en objeto cliente o en propiedad plana clienteNombre
            const vCliente = (f.cliente?.nombre || f.clienteNombre || "Cliente Genérico").toUpperCase();
            const vDetalle = f.medidas || "Medidas N/A";
            
            const vVenta = Number(f.totalFactura || f.total) || 0;
            const cMat = Number(f.costo_materiales_total) || 0;
            const cMO = Number(f.mano_obra_total || f.manoObraTotal) || 0;
            
            // Si no hay costo de materiales guardado, estimamos al 33% (inverso del x3)
            const costoEstimadoMat = cMat > 0 ? cMat : (vVenta - cMO) / 3;
            const vUtilidad = vVenta - (costoEstimadoMat + cMO);

            totalVentas += vVenta;
            utilidadTotal += vUtilidad;

            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px;">
                        <div style="font-weight: bold; color: #1e3a8a;">${vOT}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">${vCliente}</div>
                    </td>
                    <td style="padding: 12px; font-size: 0.85rem; color: #475569;">
                        ${vDetalle}
                    </td>
                    <td style="padding: 12px; text-align: right; color: #444;">
                        <div style="font-size: 0.75rem;">Costos Est.: ${formatter.format(costoEstimadoMat + cMO)}</div>
                        <div style="font-weight: bold; color: #1e3a8a; border-top: 1px solid #eee; margin-top: 4px;">Utilidad: ${formatter.format(vUtilidad)}</div>
                    </td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; color: #15803d; font-size: 1.05rem;">
                        ${formatter.format(vVenta)}
                    </td>
                </tr>
            `;
        }).join('');

        const htmlReporte = `
            <div style="font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; max-width: 900px; margin: auto;">
                <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px;">
                    <h1 style="color: #1e3a8a; margin: 0; font-size: 24px; text-transform: uppercase;">Marquetería La Chica Morales</h1>
                    <h2 style="color: #64748b; margin: 5px 0; font-size: 18px;">Reporte de Operaciones Diario</h2>
                    <p style="background: #f1f5f9; display: inline-block; padding: 5px 20px; border-radius: 50px; font-weight: bold;">
                        ${hoyDate.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #1e3a8a; color: white;">
                            <th style="padding: 15px; text-align: left;">OT / CLIENTE</th>
                            <th style="padding: 15px; text-align: left;">DETALLE</th>
                            <th style="padding: 15px; text-align: right;">DESGLOSE</th>
                            <th style="padding: 15px; text-align: right;">VALOR VENTA</th>
                        </tr>
                    </thead>
                    <tbody>${filasHTML}</tbody>
                </table>
                <div style="margin-top: 30px; padding: 25px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                    <div style="display: flex; justify-content: space-around; align-items: center; text-align: center;">
                        <div>
                            <p style="margin: 0; color: #64748b; text-transform: uppercase; font-size: 0.8rem;">Ingresos Brutos</p>
                            <p style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin: 5px 0;">${formatter.format(totalVentas)}</p>
                        </div>
                        <div style="width: 1px; height: 50px; background: #bbf7d0;"></div>
                        <div>
                            <p style="margin: 0; color: #166534; font-weight: bold; text-transform: uppercase; font-size: 0.8rem;">UTILIDAD TOTAL</p>
                            <p style="font-size: 2rem; font-weight: bold; color: #15803d; margin: 5px 0;">${formatter.format(utilidadTotal)}</p>
                        </div>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 40px;" class="no-print">
                    <button onclick="window.print()" style="background: #1e3a8a; color: white; border: none; padding: 12px 30px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                         <i class="fas fa-print"></i> IMPRIMIR REPORTE
                    </button>
                    <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 12px 30px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-left: 10px;">
                         CERRAR
                    </button>
                </div>
            </div>`;

        const ventana = window.open('', '_blank');
        ventana.document.write(`<html><head><title>Reporte_Diario_${hoyStr}</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"><style>@media print{.no-print{display:none}}</style></head><body>${htmlReporte}</body></html>`);
        ventana.document.close();
        
    } catch (error) {
        console.error("❌ Error al generar reporte:", error);
        alert("Ocurrió un error al procesar el reporte. Intente recargar la página.");
    }
}

// --- 4. EXPORTAR A EXCEL ---
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
            const abono = Number(f.totalPagado || f.abono || f.abonoInicial) || 0;
            const saldo = total - abono;
            const estado = saldo <= 0 ? "PAGADO" : "ABONADO";

            csvContent += `${fecha},${ot},${cliente},${total},${saldo},${estado}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Marqueteria_Reporte_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("Error Excel:", error);
        alert("Error al exportar a Excel.");
    }
}

// --- 5. RENDERIZADO DE LA TABLA ---
function renderTable(facturas) {
    const tableBody = document.getElementById('invoiceTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const formatter = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    });

    facturas.forEach(f => {
        const tr = document.createElement('tr');
        const total = Number(f.totalFactura || f.total) || 0;
        const pagado = Number(f.totalPagado || f.abono || f.abonoInicial) || 0;
        const saldo = total - pagado;
        const numeroOT = formatearNumeroOT(f);
        
        const estadoLabel = (saldo <= 0) ? 'PAGADO' : 'ABONADO';
        const estadoClass = (saldo <= 0) ? 'badge-pagado' : 'badge-abonado';
        const clienteVisual = (f.cliente?.nombre || f.clienteNombre || 'Cliente Genérico').toUpperCase();

        tr.innerHTML = `
            <td>${f.fecha ? new Date(f.fecha).toLocaleDateString() : '---'}</td>
            <td style="font-weight: 700; color: #1e3a8a;">${numeroOT}</td>
            <td>${clienteVisual}</td>
            <td style="font-weight: 600;">${formatter.format(total)}</td>
            <td style="color: #e11d48; font-weight: 600;">${formatter.format(saldo)}</td>
            <td><span class="badge-status ${estadoClass}">${estadoLabel}</span></td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button onclick="verDetalle('${f._id}')" class="btn-action-blue" title="Ver Detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="eliminarFactura('${f._id}', '${numeroOT}')" class="btn-action-red" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>`;
        tableBody.appendChild(tr);
    });
}

// --- 6. BUSCADOR ---
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

// --- 7. ACCIONES ---
async function eliminarFactura(id, numero) {
    if (confirm(`¿Estás seguro de eliminar la Orden ${numero}?`)) {
        try {
            const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert("✅ Orden eliminada exitosamente");
                fetchInvoices();
            }
        } catch (error) {
            console.error("Error al eliminar:", error);
        }
    }
}

function verDetalle(id) {
    window.location.href = `/invoice-detail.html?id=${id}`;
}