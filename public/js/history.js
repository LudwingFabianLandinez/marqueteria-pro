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

// --- 3. REPORTE DIARIO (TU LÓGICA ORIGINAL) ---
async function generarReporteDiario() {
    try {
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

        let filasHTML = facturasHoy.map(f => {
            const vOT = formatearNumeroOT(f);
            const vCliente = (f.cliente?.nombre || f.clienteNombre || "Cliente Genérico").toUpperCase();
            const vDetalle = f.medidas || "Medidas N/A";
            
            const vVenta = Number(f.totalFactura || f.total) || 0;
            const cMat = Number(f.costo_materiales_total) || 0;
            const cMO = Number(f.mano_obra_total || f.manoObraTotal) || 0;
            
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
                    <td style="padding: 12px; font-size: 0.85rem; color: #475569;">${vDetalle}</td>
                    <td style="padding: 12px; text-align: right; color: #444;">
                        <div style="font-size: 0.75rem;">Costos Est.: ${formatter.format(costoEstimadoMat + cMO)}</div>
                        <div style="font-weight: bold; color: #1e3a8a; border-top: 1px solid #eee; margin-top: 4px;">Utilidad: ${formatter.format(vUtilidad)}</div>
                    </td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; color: #15803d; font-size: 1.05rem;">
                        ${formatter.format(vVenta)}
                    </td>
                </tr>`;
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
                    <button onclick="window.print()" style="background: #1e3a8a; color: white; border: none; padding: 12px 30px; border-radius: 8px; cursor: pointer; font-weight: bold;">IMPRIMIR REPORTE</button>
                    <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 12px 30px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-left: 10px;">CERRAR</button>
                </div>
            </div>`;

        const ventana = window.open('', '_blank');
        ventana.document.write(`<html><head><title>Reporte_Diario</title><style>@media print{.no-print{display:none}}</style></head><body>${htmlReporte}</body></html>`);
        ventana.document.close();
        
    } catch (error) {
        console.error("❌ Error al generar reporte:", error);
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
    // ESTA ES LA ÚNICA LÍNEA QUE DEBE EXISTIR
    window.open(`reportes.html?id=${id}`, '_blank');    

    // Buscamos en la variable que ya tiene todas las facturas cargadas
    const f = todasLasFacturas.find(fact => String(fact._id) === String(id));
    
    if (!f) return alert("Información no encontrada en la sesión actual.");

    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    const cMat = Number(f.costo_materiales_total || 0);
    const cMO = Number(f.mano_obra_total || 0);
    const totalCobrado = Number(f.totalFactura || f.total || 0);

    const reporteHTML = `
        <div style="font-family: Arial, sans-serif; padding: 30px; max-width: 500px; margin: auto; border: 2px solid #1e3a8a; border-radius: 12px; background: white;">
            <h2 style="color: #1e3a8a; text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">ANÁLISIS DE RENTABILIDAD</h2>
            <p><strong>OT:</strong> ${formatearNumeroOT(f)}</p>
            <p><strong>Cliente:</strong> ${(f.cliente?.nombre || f.clienteNombre || 'N/A').toUpperCase()}</p>
            <hr>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 10px;">Costo Real Material:</td><td style="text-align: right;">${formatter.format(cMat)}</td></tr>
                <tr style="background: #eff6ff; font-weight: bold; color: #1e40af;"><td style="padding: 10px;">VENTA MATERIAL (x3):</td><td style="text-align: right;">${formatter.format(cMat * 3)}</td></tr>
                <tr><td style="padding: 10px;">Mano de Obra:</td><td style="text-align: right;">${formatter.format(cMO)}</td></tr>
                <tr style="font-size: 1.2em; font-weight: bold; color: #1e3a8a;"><td style="padding: 10px;">TOTAL COBRADO:</td><td style="text-align: right;">${formatter.format(totalCobrado)}</td></tr>
            </table>
            <div style="margin-top: 20px; padding: 15px; background: #dcfce7; border-radius: 8px; text-align: center; border: 1px solid #22c55e;">
                <h3 style="margin: 0; color: #166534;">UTILIDAD: ${formatter.format(totalCobrado - cMat)}</h3>
            </div>
            <button onclick="window.print()" style="width: 100%; margin-top: 20px; padding: 12px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">IMPRIMIR</button>
        </div>`;

    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Análisis OT</title></head><body style="background:#f8fafc; padding:20px;">${reporteHTML}</body></html>`);
    win.document.close();
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