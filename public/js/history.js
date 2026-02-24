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
        const inventarioLocal = JSON.parse(localStorage.getItem('inventory') || '[]');
        const formatter = new Intl.NumberFormat('es-CO', { 
            style: 'currency', currency: 'COP', maximumFractionDigits: 0 
        });

        const nuevaVentana = window.open('', '_blank');
        let htmlContenido = `<html><head><title>Auditoría Final - La Chica Morales</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; background: #f1f5f9; }
                .ot-card { background: white; border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #1e3a8a; color: white; padding: 12px; font-size: 0.75rem; text-align: center; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; text-align: center; }
                .resumen-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #cbd5e1; }
                .label-resumen { font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: bold; }
                .val-resumen { font-size: 1.1rem; font-weight: 800; display: block; }
                .alerta-negativa { color: #e11d48; background: #fff1f2; padding: 10px; border-radius: 5px; font-weight: bold; margin-top: 10px; text-align: right; border: 1px solid #fecaca; }
                .alerta-positiva { color: #15803d; background: #f0fdf4; padding: 10px; border-radius: 5px; font-weight: bold; margin-top: 10px; text-align: right; border: 1px solid #bbf7d0; }
            </style>
        </head><body>
            <h1 style="text-align:center; color:#1e3a8a;">AUDITORÍA DE RENTABILIDAD</h1>`;

        facturasAReportar.forEach(f => {
            let sumaCostoBase = 0;
            let sumaSugeridoX3 = 0;
            // Rescatamos mano de obra de cualquier campo posible
            const manoObraRegistrada = Number(f.manoObra || f.mano_obra_total || f.mano_obra || 0);
            const totalCobrado = Number(f.totalFactura || f.total || 0);

            htmlContenido += `
            <div class="ot-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <div><strong style="font-size:1.3rem;">${formatearNumeroOT(f)}</strong><br>CLIENTE: ${(f.cliente?.nombre || f.clienteNombre || "S/N").toUpperCase()}</div>
                    <div style="text-align:right;">FECHA: ${new Date(f.fecha).toLocaleDateString()}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align:left;">Material</th>
                            <th>Medida (m²/ML)</th>
                            <th>Costo Base Unit.</th>
                            <th>Sugerido (x3)</th>
                            <th>Subtotal Sugerido</th>
                        </tr>
                    </thead>
                    <tbody>`;

            (f.items || []).forEach(item => {
                // 1. RESCATE DE NOMBRE
                const nombreItem = (item.descripcion || item.nombre || item.material || "MATERIAL NO ESPECIFICADO").toUpperCase();
                
                // 2. RESCATE DE MEDIDA
                const medida = Number(item.area_m2 || item.area || item.cantidad || 1);
                
                // 3. SUPER RESCATE DE COSTO (Factura -> Inventario)
                let cBase = Number(item.costoBase || item.costo_base_unitario || item.costo_m2_base || 0);

                if (cBase === 0) {
                    const mInv = inventarioLocal.find(m => 
                        (m.nombre || "").toLowerCase().trim() === nombreItem.toLowerCase().trim()
                    );
                    if (mInv) cBase = Number(mInv.costo_m2 || mInv.precio_m2_costo || mInv.costo || 0);
                }

                const sugeridoU = cBase * 3;
                const sugeridoT = sugeridoU * medida;
                
                sumaCostoBase += (cBase * medida);
                sumaSugeridoX3 += sugeridoT;

                htmlContenido += `
                    <tr>
                        <td style="text-align:left; font-weight:600;">${nombreItem}</td>
                        <td>${medida.toFixed(3)}</td>
                        <td>${formatter.format(cBase)}</td>
                        <td>${formatter.format(sugeridoU)}</td>
                        <td style="background:#f0fdf4; font-weight:bold;">${formatter.format(sugeridoT)}</td>
                    </tr>`;
            });

            const totalSugeridoFinal = sumaSugeridoX3 + manoObraRegistrada;
            const diferencia = totalCobrado - totalSugeridoFinal;

            htmlContenido += `</tbody></table>
                <div class="resumen-grid">
                    <div><span class="label-resumen">Costo Materiales</span><span class="val-resumen">${formatter.format(sumaCostoBase)}</span></div>
                    <div><span class="label-resumen">Sugerido Mat. (x3)</span><span class="val-resumen">${formatter.format(sumaSugeridoX3)}</span></div>
                    <div><span class="label-resumen">Mano de Obra</span><span class="val-resumen">${formatter.format(manoObraRegistrada)}</span></div>
                    <div><span class="label-resumen">Total Sugerido</span><span class="val-resumen" style="color:#1e3a8a;">${formatter.format(totalSugeridoFinal)}</span></div>
                </div>
                <div class="${diferencia < -500 ? 'alerta-negativa' : 'alerta-positiva'}">
                    VALOR COBRADO EN FACTURA: ${formatter.format(totalCobrado)} <br>
                    <span style="font-size:0.85rem;">
                        ${diferencia < -500 ? '⚠️ ATENCIÓN: Se cobraron ' + formatter.format(Math.abs(diferencia)) + ' por debajo del precio sugerido.' : '✅ La venta cubre los costos y el margen x3.'}
                    </span>
                </div>
            </div>`;
        });

        htmlContenido += `</body></html>`;
        nuevaVentana.document.write(htmlContenido);
        nuevaVentana.document.close();
    } catch (error) { console.error("Error en reporte:", error); }
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