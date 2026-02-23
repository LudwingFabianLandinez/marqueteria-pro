/**
 * Lógica del Historial de Órdenes de Trabajo - MARQUETERÍA LA CHICA MORALES
 * Versión: 14.0.0 - REPORTE DE AUDITORÍA DETALLADO
 * Blindaje: Análisis local para evitar 404 y reporte profesional con desglose de costos.
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

// --- 3. NUEVO REPORTE DE AUDITORÍA DETALLADO (PUNTOS 1 AL 5) ---
async function generarReporteDiario() {
    try {
        // Punto 1: Usamos TODAS las facturas cargadas, no filtramos por hoy
        const facturasAReportar = todasLasFacturas;

        if (facturasAReportar.length === 0) {
            alert("❌ No hay datos de facturas para generar el reporte.");
            return;
        }

        const formatter = new Intl.NumberFormat('es-CO', { 
            style: 'currency', currency: 'COP', maximumFractionDigits: 0 
        });

        const nuevaVentana = window.open('', '_blank');
        
        let htmlContenido = `
        <html>
        <head>
            <title>Reporte de Auditoría - La Chica Morales</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: #f1f5f9; }
                .report-header { text-align: center; margin-bottom: 30px; border-bottom: 4px solid #1e3a8a; padding-bottom: 10px; background: white; padding: 20px; border-radius: 10px 10px 0 0; }
                .ot-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); page-break-inside: avoid; }
                .ot-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 15px; }
                .ot-info h2 { margin: 0; color: #1e3a8a; font-size: 1.4rem; }
                .ot-info p { margin: 5px 0; font-weight: 600; color: #475569; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background: #f8fafc; color: #64748b; padding: 12px; text-align: left; font-size: 0.75rem; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
                td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; }
                
                .col-costo { color: #64748b; font-style: italic; }
                .col-x3 { color: #15803d; font-weight: bold; background: #f0fdf4; }
                
                .footer-ot { margin-top: 15px; padding: 15px; background: #f8fafc; border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .total-item { text-align: right; }
                .total-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: bold; }
                .total-val { font-size: 1.1rem; font-weight: 800; display: block; }
                
                .no-print-btn { background: #1e3a8a; color: white; padding: 12px 25px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 20px; }
                @media print { .no-print { display: none; } body { background: white; padding: 0; } .ot-card { box-shadow: none; border: 1px solid #ccc; } }
            </style>
        </head>
        <body>
            <div class="no-print" style="text-align: center;">
                <button class="no-print-btn" onclick="window.print()">IMPRIMIR AUDITORÍA COMPLETA</button>
            </div>
            <div class="report-header">
                <h1 style="margin:0;">MARQUETERÍA LA CHICA MORALES</h1>
                <h3 style="margin:5px 0; color: #64748b;">REPORTE MAESTRO DE COSTOS Y MATERIALES</h3>
                <p>Total de Órdenes Auditadas: ${facturasAReportar.length}</p>
            </div>
        `;

        facturasAReportar.forEach(f => {
            // Punto 2: Nombre real del cliente
            const clienteReal = (f.clienteNombre || f.cliente?.nombre || "Cliente no registrado").toUpperCase();
            const nOT = formatearNumeroOT(f);
            const items = f.items || [];
            
            let sumaCostoBaseOT = 0;
            let sumaCostoX3OT = 0;

            htmlContenido += `
            <div class="ot-card">
                <div class="ot-header">
                    <div class="ot-info">
                        <h2>${nOT}</h2>
                        <p>CLIENTE: ${clienteReal}</p>
                    </div>
                    <div style="text-align: right; color: #64748b; font-size: 0.8rem;">
                        Fecha: ${new Date(f.fecha).toLocaleDateString()}<br>
                        Estado: ${((f.totalFactura || f.total) - (f.totalPagado || f.abono || 0)) <= 0 ? 'PAGADO' : 'PENDIENTE'}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Descripción del Material / Item</th>
                            <th style="text-align: center;">Cant.</th>
                            <th style="text-align: center;">Costo Base Unit.</th>
                            <th style="text-align: center;">Costo Base Total</th>
                            <th style="text-align: center;">Costo x 3 Unit.</th>
                            <th style="text-align: center;">Costo x 3 Total</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Puntos 3 y 4: Detalle de materiales y Costos x3
            items.forEach(item => {
                const cant = Number(item.cantidad || 1);
                const cBaseU = Number(item.costoBase || 0);
                const cBaseT = cBaseU * cant;
                const cX3U = cBaseU * 3;
                const cX3T = cX3U * cant;

                sumaCostoBaseOT += cBaseT;
                sumaCostoX3OT += cX3T;

                htmlContenido += `
                    <tr>
                        <td style="font-weight: 500;">${item.descripcion || item.nombre || 'Material'}</td>
                        <td style="text-align: center;">${cant}</td>
                        <td style="text-align: center;" class="col-costo">${formatter.format(cBaseU)}</td>
                        <td style="text-align: center;" class="col-costo"><strong>${formatter.format(cBaseT)}</strong></td>
                        <td style="text-align: center;" class="col-x3">${formatter.format(cX3U)}</td>
                        <td style="text-align: center;" class="col-x3"><strong>${formatter.format(cX3T)}</strong></td>
                    </tr>
                `;
            });

            htmlContenido += `
                    </tbody>
                </table>

                <div class="footer-ot">
                    <div class="total-item">
                        <span class="total-label">Suma de Costos Materiales</span>
                        <span class="total-val" style="color: #64748b;">${formatter.format(sumaCostoBaseOT)}</span>
                    </div>
                    <div class="total-item">
                        <span class="total-label">Suma Costos x 3 (Base sugerida)</span>
                        <span class="total-val" style="color: #15803d;">${formatter.format(sumaCostoX3OT)}</span>
                    </div>
                </div>
                <div style="text-align: right; margin-top: 10px; font-weight: bold; font-size: 0.9rem; color: #1e3a8a;">
                    VALOR TOTAL FACTURADO: ${formatter.format(f.totalFactura || f.total)}
                </div>
            </div>
            `;
        });

        htmlContenido += `</body></html>`;
        
        nuevaVentana.document.write(htmlContenido);
        nuevaVentana.document.close();

    } catch (error) {
        console.error("❌ Error en reporte:", error);
        alert("Error al procesar el reporte detallado.");
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

// --- 6. FUNCIÓN DE ANÁLISIS ---
window.abrirAnalisisCostos = function(id) {
    if (id) window.location.href = `reportes.html?id=${id}`;
};

// --- 7. BUSCADOR ---
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

// --- 8. ELIMINAR ---
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