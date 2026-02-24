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
        const fechaInput = prompt("Ingrese la fecha (AAAA-MM-DD):", "2026-02-23");
        if (!fechaInput) return;

        // Limpieza de fecha para comparar (elimina guiones)
        const fechaBuscada = fechaInput.replace(/-/g, ""); 

        const facturasAReportar = todasLasFacturas.filter(f => {
            if (!f.fecha) return false;
            // Convierte "23/2/2026" a "20260223"
            const partes = f.fecha.split('/');
            if(partes.length < 3) return false;
            const d = partes[0].padStart(2, '0');
            const m = partes[1].padStart(2, '0');
            const a = partes[2];
            return `${a}${m}${d}` === fechaBuscada;
        });

        if (facturasAReportar.length === 0) {
            alert("No se encontraron ventas para esa fecha específica.");
            return;
        }

        const inventarioLocal = JSON.parse(localStorage.getItem('inventory') || '[]');
        const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

        const nuevaVentana = window.open('', '_blank');
        
        let htmlContenido = `<html><head><title>Ventas - La Chica Morales</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #1e293b; background: #f1f5f9; }
                .no-print { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }
                .btn { padding: 12px 20px; cursor: pointer; border-radius: 8px; font-weight: bold; border: none; color: white; }
                .btn-regresar { background: #64748b; }
                .btn-excel { background: #16a34a; }
                .header-brand { text-align: center; border-bottom: 3px solid #1e3a8a; margin-bottom: 25px; padding-bottom: 15px; }
                .ot-card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 25px; border: 1px solid #cbd5e1; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background: #1e3a8a; color: white; padding: 10px; font-size: 0.8rem; }
                td { padding: 10px; border: 1px solid #e2e8f0; text-align: center; }
                .rentabilidad-box { background: #f0fdf4; padding: 15px; margin-top: 10px; text-align: right; color: #15803d; font-weight: bold; font-size: 1.2rem; border-radius: 8px; }
            </style>
        </head><body>
            <div class="no-print">
                <button class="btn btn-regresar" onclick="window.close()">← REGRESAR</button>
                <button class="btn btn-excel" onclick="exportarExcel()">BAJAR A EXCEL (.XLS)</button>
            </div>
            <div class="header-brand">
                <h1>MARQUETERIA LA CHICA MORALES</h1>
                <h2>VENTAS GENERADAS</h2>
                <p>Fecha: <strong>${fechaInput}</strong></p>
            </div>
            <div id="contenedor-reporte">`;

        facturasAReportar.forEach(f => {
            let sumaCostoMateriales = 0;
            
            // --- BÚSQUEDA SEGURA DEL NOMBRE (No se rompe) ---
            let cliente = "CLIENTE GENERAL";
            try {
                if (f.clienteNombre) cliente = f.clienteNombre;
                else if (f.cliente && f.cliente.nombre) cliente = f.cliente.nombre;
                else if (f.nombre_cliente) cliente = f.nombre_cliente;
            } catch(e) { cliente = "CLIENTE GENERAL"; }

            htmlContenido += `<div class="ot-card">
                <div style="display:flex; justify-content:space-between;">
                    <strong>OT: ${f.n_orden || f.id || '---'}</strong>
                    <strong>CLIENTE: ${cliente.toUpperCase()}</strong>
                </div>
                <table>
                    <thead><tr><th>Material</th><th>Medida</th><th>Costo</th><th>Venta Sug.</th></tr></thead>
                    <tbody>`;

            (f.items || []).forEach(item => {
                const area = Number(item.area_m2 || item.area || 1);
                const costoU = Number(item.costoBase || item.precioUnitario || 0);
                let nom = (item.nombre || item.material || item.descripcion || "MATERIAL").toUpperCase();
                
                if (nom === "MATERIAL" && costoU > 0) {
                    const match = inventarioLocal.find(inv => Math.abs((inv.costo_m2 || inv.precio_m2_costo) - costoU) < 10);
                    if (match) nom = match.nombre.toUpperCase();
                }

                const cFila = costoU * area;
                sumaCostoMateriales += cFila;
                htmlContenido += `<tr><td>${nom}</td><td>${area.toFixed(3)}</td><td>${formatter.format(cFila)}</td><td>${formatter.format(cFila*3)}</td></tr>`;
            });

            const rent = (Number(f.total || f.totalFactura || 0)) - sumaCostoMateriales;
            htmlContenido += `</tbody></table>
                <div class="rentabilidad-box">RENTABILIDAD OBTENIDA: ${formatter.format(rent)} ✅</div>
            </div>`;
        });

        htmlContenido += `</div>
            <script>
                function exportarExcel() {
                    const contenido = document.getElementById('contenedor-reporte').innerHTML;
                    window.open('data:application/vnd.ms-excel,' + encodeURIComponent(contenido));
                }
            </script>
        </body></html>`;

        nuevaVentana.document.write(htmlContenido);
        nuevaVentana.document.close();
    } catch (err) { alert("Error al generar: " + err.message); }
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