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
async function fetchInvoices() {
    try {
        console.log("📡 Conectando con el servidor de órdenes...");
        const response = await fetch('/.netlify/functions/server/invoices');
        
        if (!response.ok) {
            throw new Error(`Servidor respondió con estado ${response.status}`);
        }

        const result = await response.json();
        todasLasFacturas = result.data || result || [];
        if (!Array.isArray(todasLasFacturas)) todasLasFacturas = [];

        renderTable(todasLasFacturas);
        
        const contador = document.querySelector('.badge-soft-blue');
        if (contador) contador.textContent = `${todasLasFacturas.length} órdenes`;
        
    } catch (error) {
        console.error("❌ Error cargando órdenes:", error);
    }
}

// --- 3. REPORTE DE AUDITORÍA DETALLADO (PUNTOS 1 AL 5 CORREGIDO) ---
async function generarReporteDiario() {
    try {
        const facturasAReportar = todasLasFacturas;
        const formatter = new Intl.NumberFormat('es-CO', { 
            style: 'currency', currency: 'COP', maximumFractionDigits: 0 
        });

        const nuevaVentana = window.open('', '_blank');
        let htmlContenido = `<html><head><title>Auditoría Final - La Chica Morales</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; background: #f1f5f9; }
                .ot-card { background: white; border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                th { background: #1e3a8a; color: white; padding: 12px; font-size: 0.75rem; text-align: center; text-transform: uppercase; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; text-align: center; }
                .tfoot-sumas td { background: #f8fafc; font-weight: 800; color: #1e3a8a; border-top: 2px solid #1e3a8a; }
                .resumen-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #cbd5e1; margin-top: 15px; }
                .label-resumen { font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 5px; }
                .val-resumen { font-size: 1.1rem; font-weight: 800; color: #1e293b; }
                .footer-rentabilidad { background: #f0fdf4; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: right; border: 1px solid #bbf7d0; }
                .rentabilidad-texto { color: #15803d; font-weight: bold; font-size: 1.2rem; }
            </style>
        </head><body>
            <h1 style="text-align:center; color:#1e3a8a; margin-bottom:30px;">AUDITORÍA DE RENTABILIDAD</h1>`;

        facturasAReportar.forEach(f => {
            let sumaCostoMateriales = 0;
            let sumaMaterialesX3 = 0;
            const manoObra = Number(f.manoObra || f.mano_obra_total || 0);
            const totalCobrado = Number(f.totalFactura || f.total || 0);
            const medidaTexto = f.medidas ? `(${f.medidas} cm)` : '';

            htmlContenido += `
            <div class="ot-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <div><strong style="font-size:1.4rem; color:#1e3a8a;">${formatearNumeroOT(f)}</strong><br>
                    <span style="color:#64748b">CLIENTE:</span> <strong>${(f.clienteNombre || "S/N").toUpperCase()}</strong></div>
                    <div style="text-align:right; color:#64748b"><strong>FECHA:</strong> ${new Date(f.fecha).toLocaleDateString()}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align:left;">Descripción Material</th>
                            <th>Medida Usada (m²)</th>
                            <th>Costo por Medida</th>
                            <th>Subtotal Material (x3)</th>
                        </tr>
                    </thead>
                    <tbody>`;

            (f.items || []).forEach(item => {
                // --- AJUSTE QUIRÚRGICO DE NOMBRE ---
                // Buscamos en orden: nombre -> material -> descripcion
                const nombreReal = (item.nombre || item.material || item.descripcion || "MATERIAL").toUpperCase();
                
                const area = Number(item.area_m2 || item.area || 1);
                const costoBaseUnitario = Number(item.costoBase || item.precioUnitario || item.costo_base_unitario || 0);
                
                const costoFila = (costoBaseUnitario > 0) ? (costoBaseUnitario * area) : 0;
                const sugeridoFila = costoFila * 3;

                sumaCostoMateriales += costoFila;
                sumaMaterialesX3 += sugeridoFila;

                htmlContenido += `
                    <tr>
                        <td style="text-align:left; font-weight:600;">${nombreReal}</td>
                        <td>${area.toFixed(3)} ${medidaTexto}</td>
                        <td>${formatter.format(costoFila)}</td>
                        <td style="background:#f0fdf4; font-weight:bold;">${formatter.format(sugeridoFila)}</td>
                    </tr>`;
            });

            const totalOrden = sumaMaterialesX3 + manoObra;
            const rentabilidadReal = totalCobrado - sumaCostoMateriales;

            htmlContenido += `
                    </tbody>
                    <tfoot class="tfoot-sumas">
                        <tr>
                            <td colspan="2" style="text-align:right;">TOTALES MATERIALES:</td>
                            <td>${formatter.format(sumaCostoMateriales)}</td>
                            <td>${formatter.format(sumaMaterialesX3)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="resumen-grid">
                    <div><span class="label-resumen">SUMA COSTOS MATERIALES</span><span class="val-resumen">${formatter.format(sumaCostoMateriales)}</span></div>
                    <div><span class="label-resumen">SUMA COSTOS MATERIALES (X3)</span><span class="val-resumen">${formatter.format(sumaMaterialesX3)}</span></div>
                    <div><span class="label-resumen">MANO DE OBRA</span><span class="val-resumen">${formatter.format(manoObra)}</span></div>
                    <div><span class="label-resumen" style="color:#1e3a8a;">TOTAL ORDEN</span><span class="val-resumen" style="color:#1e3a8a; font-size:1.3rem;">${formatter.format(totalOrden)}</span></div>
                </div>

                <div class="footer-rentabilidad">
                    <span class="rentabilidad-texto">RENTABILIDAD OBTENIDA: ${formatter.format(rentabilidadReal)} ✅</span>
                </div>
            </div>`;
        });

        htmlContenido += `</body></html>`;
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

// --- 5. RENDERIZADO DE LA TABLA (INTACTO) ---
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

// --- 6. FUNCIÓN DE ANÁLISIS (INTACTO) ---
window.abrirAnalisisCostos = function(id) {
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