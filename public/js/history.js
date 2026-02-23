/**
 * Lógica del Historial de Órdenes de Trabajo - MARQUETERÍA LA CHICA MORALES
 * Versión: 13.1.1 - CORRECCIÓN DE RUTA NETLIFY Y BLINDAJE JSON
 * Objetivo: Lectura híbrida de datos y estabilidad en producción.
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
        console.log("📡 Intentando conectar con la API de órdenes...");
        
        // CORRECCIÓN: Usamos la ruta directa de Netlify Functions para evitar el Error 404/JSON
        const response = await fetch('/.netlify/functions/invoices');
        
        // Validamos que la respuesta no sea un error 404 de página HTML
        if (!response.ok) {
            throw new Error(`Servidor respondió con estado ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            todasLasFacturas = result.data || [];
            renderTable(todasLasFacturas);
            
            const contador = document.querySelector('.badge-soft-blue');
            if (contador) contador.textContent = `${todasLasFacturas.length} órdenes`;
        }
    } catch (error) {
        console.error("❌ Error cargando órdenes:", error);
        // Notificación visual discreta en la consola para depuración
        console.warn("Sugerencia: Revisa si la función 'invoices' está desplegada en Netlify.");
    }
}

// --- 3. REPORTE DIARIO (AUTÓNOMO Y LOCAL) ---
async function generarReporteDiario() {
    try {
        const hoyDate = new Date();
        const hoyStr = hoyDate.toLocaleDateString();
        
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
                    <button onclick="window.print()" style="background: #1e3a8a; color: white; border: none; padding: 12px 30px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                         IMPRIMIR REPORTE
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
        alert("Ocurrió un error al procesar el reporte.");
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
            csvContent += `${fecha},${ot},${cliente},${total},${saldo},${saldo <= 0 ? "PAGADO" : "ABONADO"}\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Marqueteria_Reporte_${new Date().toISOString().split('T')[0]}.csv`);
        link.click();
    } catch (error) { console.error("Error Excel:", error); }
}

// --- 5. RENDERIZADO DE LA TABLA ---
// --- FUNCIÓN DE REPORTE (Pégala al final de history.js) ---
window.abrirAnalisisCostos = function(id) {
    if (window.event) window.event.preventDefault();

    // Buscamos la OT en la lista 'todasLasFacturas' que ya tiene el navegador
    const f = todasLasFacturas.find(fact => String(fact._id) === String(id));
    
    if (!f) {
        return alert("No se encontró la información de esta orden. Por favor, intenta recargar la página.");
    }

    const formatter = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    });

    // REGLA DE NEGOCIO: Costo Material x 3 + Mano de Obra
    // Usamos los nombres de campos que vienen de tu servidor v13.4.45
    const cMat = Number(f.costo_materiales_total || 0);
    const cMO = Number(f.mano_obra_total || 0);
    const cX3 = cMat * 3;
    const totalCobrado = Number(f.totalFactura || f.total || 0);

    const reporteHTML = `
        <div style="font-family: Arial, sans-serif; padding: 30px; max-width: 550px; margin: auto; border: 2px solid #1e3a8a; border-radius: 12px; background: white; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <h2 style="color: #1e3a8a; text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">ANÁLISIS DE RENTABILIDAD</h2>
            
            <div style="margin-bottom: 15px;">
                <p><strong>OT:</strong> ${f.numeroFactura || f.numeroOrden || 'S/N'}</p>
                <p><strong>Cliente:</strong> ${(f.cliente?.nombre || f.clienteNombre || 'N/A').toUpperCase()}</p>
                <p><strong>Medidas:</strong> ${f.medidas || 'No registradas'}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">Costo Real Material (Prorrateado):</td>
                    <td style="padding: 10px; text-align: right;">${formatter.format(cMat)}</td>
                </tr>
                <tr style="background: #eff6ff; font-weight: bold; color: #1e40af; border-bottom: 1px solid #3b82f6;">
                    <td style="padding: 10px;">VENTA MATERIAL (COSTO X3):</td>
                    <td style="padding: 10px; text-align: right;">${formatter.format(cX3)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">Mano de Obra (Adicional):</td>
                    <td style="padding: 10px; text-align: right;">${formatter.format(cMO)}</td>
                </tr>
                <tr style="font-size: 1.2em; font-weight: bold; color: #1e3a8a;">
                    <td style="padding: 10px;">TOTAL COBRADO AL CLIENTE:</td>
                    <td style="padding: 10px; text-align: right;">${formatter.format(totalCobrado)}</td>
                </tr>
            </table>

            <div style="margin-top: 25px; padding: 15px; background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; text-align: center;">
                <h3 style="margin: 0; color: #166534;">UTILIDAD BRUTA ESTIMADA:</h3>
                <h2 style="margin: 5px 0 0 0; color: #15803d;">${formatter.format(totalCobrado - cMat)}</h2>
                <p style="margin: 5px 0 0 0; font-size: 0.8em; color: #166534;">(Total Cobrado - Costo Real Material)</p>
            </div>
            
            <div style="margin-top: 25px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 25px; background: #1e3a8a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ IMPRIMIR REPORTE</button>
            </div>
        </div>
    `;

    const win = window.open("", "_blank");
    if (!win) return alert("El navegador bloqueó la ventana emergente. Por favor permítelas.");
    
    win.document.write(`<html><head><title>Reporte Rentabilidad</title></head><body style="background:#f8fafc; padding:20px;">${reporteHTML}</body></html>`);
    win.document.close();
};

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
            // CORRECCIÓN: También en eliminar usamos la ruta de Netlify
            const res = await fetch(`/.netlify/functions/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert("✅ Orden eliminada exitosamente");
                fetchInvoices();
            }
        } catch (error) { console.error("Error al eliminar:", error); }
    }
}

