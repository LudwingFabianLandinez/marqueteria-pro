/**
 * Lógica del Historial de Órdenes de Trabajo - MARQUETERÍA LA CHICA MORALES
 * Versión: 13.5.9 - BOTONES BLINDADOS (AZUL Y ROJO)
 * Blindaje: Análisis local para evitar 404 y ruta de eliminación sincronizada.
 */

let todasLasFacturas = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchInvoices();
    configurarBuscador();
    
    // Vinculación robusta del botón de reporte diario
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

// --- 1. FORMATEO DE NÚMERO DE ORDEN (INTACTO) ---
function formatearNumeroOT(f) {
    const num = f.numeroFactura || f.ot || f.numeroOT || f.numeroOrden;
    if (num && num !== "undefined") {
        return num.toString().startsWith('OT-') ? num : `OT-${num.toString().padStart(6, '0')}`;
    }
    const idSufijo = f._id ? f._id.substring(f._id.length - 4).toUpperCase() : '0000';
    return `OT-${idSufijo}`;
}

// --- 2. CARGA DE DATOS (Sincronizado con API_BASE) ---
async function fetchInvoices() {
    try {
        console.log("📡 Conectando con el servidor de órdenes...");
        // Usamos la ruta completa que tu server.js espera recibir
        const response = await fetch('/.netlify/functions/server/invoices');
        
        if (!response.ok) {
            throw new Error(`Servidor respondió con estado ${response.status}`);
        }

        const result = await response.json();
        
        // Manejo de la respuesta según tu server.js (devuelve array o .data)
        todasLasFacturas = result.data || result || [];
        if (!Array.isArray(todasLasFacturas)) todasLasFacturas = [];

        renderTable(todasLasFacturas);
        
        const contador = document.querySelector('.badge-soft-blue');
        if (contador) contador.textContent = `${todasLasFacturas.length} órdenes`;
        
    } catch (error) {
        console.error("❌ Error cargando órdenes:", error);
    }
}

async function generarReporteDiario() {
    try {
        if (typeof todasLasFacturas === 'undefined' || todasLasFacturas.length === 0) {
            alert("❌ No hay datos de facturas cargados.");
            return;
        }

        const hoyDate = new Date();
        const hoyStr = hoyDate.toLocaleDateString();
        
        const facturasHoy = todasLasFacturas.filter(f => {
            const fechaF = new Date(f.fecha).toLocaleDateString();
            return fechaF === hoyStr;
        });

        if (facturasHoy.length === 0) {
            alert("ℹ️ No hay ventas registradas con fecha de hoy.");
            return;
        }

        const formatter = new Intl.NumberFormat('es-CO', { 
            style: 'currency', currency: 'COP', maximumFractionDigits: 0 
        });

        let totalVentas = 0;
        let utilidadTotal = 0;
        let totalCostoMateriales = 0;
        let totalManoObra = 0;

        let filasHTML = facturasHoy.map(f => {
            const vOT = (typeof formatearNumeroOT === 'function') ? formatearNumeroOT(f) : (f.numeroFactura || 'S/N');
            const vCliente = (f.cliente?.nombre || f.clienteNombre || "Cliente Genérico").toUpperCase();
            
            const vVenta = Number(f.totalFactura || f.total) || 0;
            const cMat = Number(f.costo_materiales_total) || 0;
            const cMO = Number(f.mano_obra_total || f.manoObraTotal) || 0;
            
            // Lógica de costos
            const costoMat = cMat > 0 ? cMat : (vVenta - cMO) / 3;
            const sugeridoX3 = costoMat * 3;
            const vUtilidad = vVenta - (costoMat + cMO);

            // Sumatorias para el pie de página
            totalVentas += vVenta;
            utilidadTotal += vUtilidad;
            totalCostoMateriales += costoMat;
            totalManoObra += cMO;

            return `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">
                    <td style="padding: 10px;">
                        <div style="font-weight: bold; color: #1e3a8a;">${vOT}</div>
                        <div style="font-size: 0.75rem; color: #64748b;">${vCliente}</div>
                    </td>
                    <td style="padding: 10px; text-align: center; color: #475569;">
                        ${formatter.format(costoMat)}
                    </td>
                    <td style="padding: 10px; text-align: center; color: #1e3a8a; font-weight: bold;">
                        ${formatter.format(sugeridoX3)}
                    </td>
                    <td style="padding: 10px; text-align: center; color: #64748b;">
                        ${formatter.format(cMO)}
                    </td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #15803d;">
                        ${formatter.format(vVenta)}
                    </td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #1e3a8a; background: #f0fdf4;">
                        ${formatter.format(vUtilidad)}
                    </td>
                </tr>`;
        }).join('');

        const htmlReporte = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 1000px; margin: auto; background: white;">
                <div style="text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
                    <h1 style="color: #1e3a8a; font-size: 20px; margin: 0; text-transform: uppercase;">Análisis de Costos y Rentabilidad - Hoy</h1>
                    <p style="color: #64748b; font-size: 14px; margin: 5px 0;">${hoyDate.toLocaleDateString()}</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background: #1e3a8a; color: white; font-size: 0.75rem;">
                            <th style="padding: 10px; text-align: left;">OT / CLIENTE</th>
                            <th style="padding: 10px; text-align: center;">COSTO MAT.</th>
                            <th style="padding: 10px; text-align: center;">SUGERIDO (x3)</th>
                            <th style="padding: 10px; text-align: center;">M. OBRA</th>
                            <th style="padding: 10px; text-align: right;">P. VENTA</th>
                            <th style="padding: 10px; text-align: right;">UTILIDAD</th>
                        </tr>
                    </thead>
                    <tbody>${filasHTML}</tbody>
                    <tfoot>
                        <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #1e3a8a;">
                            <td style="padding: 10px;">TOTALES</td>
                            <td style="padding: 10px; text-align: center;">${formatter.format(totalCostoMateriales)}</td>
                            <td style="padding: 10px; text-align: center; color: #1e3a8a;">${formatter.format(totalCostoMateriales * 3)}</td>
                            <td style="padding: 10px; text-align: center;">${formatter.format(totalManoObra)}</td>
                            <td style="padding: 10px; text-align: right; color: #15803d;">${formatter.format(totalVentas)}</td>
                            <td style="padding: 10px; text-align: right; color: #1e3a8a; background: #f0fdf4;">${formatter.format(utilidadTotal)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="text-align: center; margin-top: 20px;" class="no-print">
                    <button onclick="window.print()" style="padding: 10px 25px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Imprimir Análisis</button>
                    <button onclick="window.close()" style="padding: 10px 25px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: 10px;">Cerrar</button>
                </div>
            </div>`;

        const ventana = window.open('', '_blank');
        ventana.document.write('<html><head><title>Reporte</title><style>@media print{.no-print{display:none}} body{margin:0;}</style></head><body>' + htmlReporte + '</body></html>');
        ventana.document.close();
        
    } catch (error) {
        console.error("❌ Error detallado:", error);
        alert("Ocurrió un error al generar el reporte. Revisa la consola.");
    }
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

// --- 5. RENDERIZADO DE LA TABLA (AJUSTE DE BOTONES) ---
function renderTable(facturas) {
    const tableBody = document.getElementById('invoiceTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    facturas.forEach(f => {
        const tr = document.createElement('tr');
        const total = Number(f.totalFactura || f.total || 0);
        const pagado = Number(f.totalPagado || f.abono || 0);
        const saldo = total - pagado;
        const numeroOT = formatearNumeroOT(f);
        const clienteVisual = (f.cliente?.nombre || f.clienteNombre || 'Cliente Genérico').toUpperCase();

        tr.innerHTML = `
            <td>${f.fecha ? new Date(f.fecha).toLocaleDateString() : '---'}</td>
            <td style="font-weight: 700; color: #1e3a8a;">${numeroOT}</td>
            <td>${clienteVisual}</td>
            <td style="font-weight: 600;">${formatter.format(total)}</td>
            <td style="color: #e11d48; font-weight: 600;">${formatter.format(saldo)}</td>
            <td><span class="badge-status ${saldo <= 0 ? 'badge-pagado' : 'badge-abonado'}">${saldo <= 0 ? 'PAGADO' : 'ABONADO'}</span></td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button onclick="abrirAnalisisCostos('${f._id}')" class="btn-action-blue"><i class="fas fa-eye"></i></button>
                    <button onclick="eliminarFactura('${f._id}', '${numeroOT}')" class="btn-action-red"><i class="fas fa-trash"></i></button>
                </div>
            </td>`;
        tableBody.appendChild(tr);
    });
}

// --- 6. FUNCIÓN DE ANÁLISIS (AHORA LOCAL PARA EVITAR 404) ---
window.abrirAnalisisCostos = function(id) {
    // Si el ID existe, simplemente cambia la página. Sin trucos raros.
    if (id) window.location.href = `reportes.html?id=${id}`;
};

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

// --- 8. ELIMINAR (Sincronizado con la nueva ruta DELETE) ---
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