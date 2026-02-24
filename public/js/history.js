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
        let htmlContenido = `<html><head><title>Auditoría - La Chica Morales</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #1e293b; background: #f1f5f9; }
                .ot-card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                table { width: 100%; border-collapse: collapse; }
                th { background: #1e3a8a; color: white; padding: 10px; font-size: 0.8rem; text-transform: uppercase; }
                td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
                .resumen-financiero { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                .valor-alerta { color: #dc2626; font-weight: 800; } /* Rojo si cobraste menos de lo sugerido */
                .valor-exito { color: #15803d; font-weight: 800; }
            </style>
        </head><body>`;

        facturasAReportar.forEach(f => {
            const items = f.items || [];
            let sumaCostoX3OT = 0;
            let sumaCostoBaseOT = 0;

            // 1. Calculamos la Mano de Obra (Diferencia entre total y lo que suman los items)
            // Si no está guardada explícitamente, la detectamos
            const valorTotalFactura = Number(f.totalFactura || f.total || 0);

            htmlContenido += `
            <div class="ot-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <div><strong>${formatearNumeroOT(f)}</strong><br>CLIENTE: ${(f.clienteNombre || "S/N").toUpperCase()}</div>
                    <div style="text-align:right">FECHA: ${new Date(f.fecha).toLocaleDateString()}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Material</th>
                            <th style="text-align:center;">Medida (m²/ml)</th>
                            <th style="text-align:center;">Costo Unit.</th>
                            <th style="text-align:center;">Sugerido (x3)</th>
                            <th style="text-align:center;">Subtotal Sugerido</th>
                        </tr>
                    </thead>
                    <tbody>`;

            items.forEach(item => {
                // RESCATE DE NOMBRE: Probamos todas las rutas posibles
                const nombre = (item.descripcion || item.nombre || item.material || "Material no especificado").toUpperCase();
                
                // MEDIDA: Buscamos el área o cantidad guardada
                const medida = item.area || item.cantidad || 1;
                
                // COSTO:
                let cBase = Number(item.costoBase || 0);
                if (cBase === 0) {
                    const mInv = inventarioLocal.find(m => (m.nombre || "").toLowerCase().trim() === nombre.toLowerCase().trim());
                    if (mInv) cBase = Number(mInv.costo_m2 || mInv.precio_m2_costo || 0);
                }

                const sugeridoU = cBase * 3;
                const sugeridoT = sugeridoU * medida;
                
                sumaCostoBaseOT += (cBase * medida);
                sumaCostoX3OT += sugeridoT;

                htmlContenido += `
                    <tr>
                        <td>${nombre}</td>
                        <td style="text-align:center;">${medida.toFixed(2)}</td>
                        <td style="text-align:center;">${formatter.format(cBase)}</td>
                        <td style="text-align:center;">${formatter.format(sugeridoU)}</td>
                        <td style="text-align:center; background:#f0fdf4;"><strong>${formatter.format(sugeridoT)}</strong></td>
                    </tr>`;
            });

            // Supongamos que la Mano de Obra se calcula por la diferencia o se lee de la factura
            const manoObra = f.manoObra || 35000; // Aquí podrías poner f.manoObra si lo guardas
            const totalSugeridoFinal = sumaCostoX3OT + manoObra;
            const diferencia = valorTotalFactura - totalSugeridoFinal;

            htmlContenido += `</tbody></table>
                <div class="resumen-financiero">
                    <div><span style="font-size:0.7rem">COSTO MATERIALES</span><br><strong>${formatter.format(sumaCostoBaseOT)}</strong></div>
                    <div><span style="font-size:0.7rem">MANO DE OBRA (MANUAL)</span><br><strong>${formatter.format(manoObra)}</strong></div>
                    <div><span style="font-size:0.7rem">TOTAL SUGERIDO (COSTOSx3 + M.O)</span><br><span class="valor-exito">${formatter.format(totalSugeridoFinal)}</span></div>
                </div>
                <div style="margin-top:15px; text-align:right; font-size:1.2rem; border-top: 2px solid #1e3a8a; padding-top:10px;">
                    VALOR COBRADO EN FACTURA: <strong>${formatter.format(valorTotalFactura)}</strong><br>
                    <span style="font-size:0.9rem; color: ${diferencia < 0 ? '#dc2626' : '#15803d'}">
                        ${diferencia < 0 ? '⚠️ ESTÁS COBRANDO ' + formatter.format(Math.abs(diferencia)) + ' POR DEBAJO DEL SUGERIDO' : '✅ COBRO CORRECTO'}
                    </span>
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