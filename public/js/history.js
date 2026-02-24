/**
 * Lógica del Historial de Órdenes de Trabajo - MARQUETERÍA LA CHICA MORALES
 * Versión: 18.6.0 - REPORTE MAESTRO DEFINITIVO
 */

let todasLasFacturas = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchInvoices();
    configurarBuscador();
    
    // Vinculación del botón de reporte diario
    const btnReporte = document.querySelector('.btn-primary') || 
                    document.querySelector('button[onclick*="generarReporte"]') ||
                    Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('REPORTE HOY'));
    
    if (btnReporte) {
        btnReporte.onclick = (e) => {
            e.preventDefault(); 
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

// --- 1. FORMATEO DE NÚMERO DE ORDEN ---
function formatearNumeroOT(f) {
    const num = f.numeroFactura || f.ot || f.numeroOT || f.numeroOrden;
    if (num && num !== "undefined") {
        return num.toString().startsWith('OT-') ? num : `OT-${num.toString().padStart(6, '0')}`;
    }
    const idSufijo = f._id ? f._id.substring(f._id.length - 4).toUpperCase() : '0000';
    return `OT-${idSufijo}`;
}

// --- 2. CARGA DE DATOS ---
async function fetchInvoices() {
    try {
        const response = await fetch('/.netlify/functions/server/invoices');
        if (!response.ok) throw new Error(`Servidor respondió con estado ${response.status}`);
        const result = await response.json();
        todasLasFacturas = result.data || result || [];
        renderTable(todasLasFacturas);
    } catch (error) {
        console.error("❌ Error cargando órdenes:", error);
    }
}

// --- 3. REPORTE DE VENTAS GENERADAS (MARQUETERÍA LA CHICA MORALES) ---
async function generarReporteDiario() {
    try {
        const fechaInput = prompt("Ingrese la fecha (AAAA-MM-DD) para filtrar:", new Date().toISOString().split('T')[0]);
        if (!fechaInput) return;

        const buscada = fechaInput.replace(/-/g, "");

        const facturasAReportar = todasLasFacturas.filter(f => {
            if (!f.fecha) return false;
            const p = f.fecha.split('/');
            if (p.length < 3) return false;
            const fechaNormalizada = `${p[2]}${p[1].padStart(2,'0')}${p[0].padStart(2,'0')}`;
            return fechaNormalizada === buscada;
        });

        if (facturasAReportar.length === 0) {
            alert("No hay ventas registradas para: " + fechaInput);
            return;
        }

        const inventarioLocal = JSON.parse(localStorage.getItem('inventory') || '[]');
        const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

        const nuevaVentana = window.open('', '_blank');
        let htmlContenido = `<html><head><title>Ventas - La Chica Morales</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; background: #f1f5f9; color: #1e293b; }
                .header-brand { text-align: center; border-bottom: 3px solid #1e3a8a; margin-bottom: 30px; padding-bottom: 10px; }
                .header-brand h1 { margin: 0; color: #1e3a8a; }
                .no-print { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }
                .btn { padding: 10px 20px; cursor: pointer; border-radius: 8px; font-weight: bold; color: white; border: none; }
                .ot-card { background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; border: 1px solid #cbd5e1; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background: #1e3a8a; color: white; padding: 10px; font-size: 0.8rem; }
                td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; }
                .rentabilidad-box { background: #f0fdf4; padding: 15px; margin-top: 15px; text-align: right; color: #15803d; font-weight: bold; font-size: 1.2rem; border-radius: 8px; }
                @media print { .no-print { display: none; } }
            </style>
        </head><body>
            <div class="no-print">
                <button class="btn" style="background:#64748b" onclick="window.close()">CERRAR</button>
                <button class="btn" style="background:#16a34a" onclick="window.print()">IMPRIMIR / PDF</button>
            </div>
            <div class="header-brand">
                <h1>MARQUETERIA LA CHICA MORALES</h1>
                <h2>VENTAS GENERADAS</h2>
                <p>Fecha de Reporte: ${fechaInput}</p>
            </div>`;

        facturasAReportar.forEach(f => {
            let sumaCostoMateriales = 0;
            // RASTREADOR DE CLIENTE (Busca en todos los campos posibles)
            const nombreCliente = (f.clienteNombre || (f.cliente && f.cliente.nombre) || f.nombre_cliente || "CLIENTE GENERAL").toUpperCase();

            htmlContenido += `<div class="ot-card">
                <div style="display:flex; justify-content:space-between; font-weight:bold; border-bottom: 1px solid #eee; padding-bottom:5px;">
                    <span style="color:#1e3a8a;">OT: ${formatearNumeroOT(f)}</span>
                    <span>CLIENTE: ${nombreCliente}</span>
                </div>
                <table>
                    <thead><tr><th>Material</th><th>Medida</th><th>Costo Base</th><th>Subtotal (x3)</th></tr></thead>
                    <tbody>`;

            (f.items || []).forEach(item => {
                const area = Number(item.area_m2 || item.area || 1);
                const costoU = Number(item.costoBase || item.precioUnitario || 0);
                let nombreMat = (item.nombre || item.material || item.descripcion || "MATERIAL").toUpperCase();
                
                // Traductor por costo si el nombre es genérico
                if (nombreMat === "MATERIAL" && costoU > 0) {
                    const match = inventarioLocal.find(inv => Math.abs((inv.costo_m2 || inv.precio_m2_costo) - costoU) < 10);
                    if (match) nombreMat = match.nombre.toUpperCase();
                }

                const cFila = costoU * area;
                sumaCostoMateriales += cFila;
                htmlContenido += `<tr><td>${nombreMat}</td><td>${area.toFixed(3)}</td><td>${formatter.format(cFila)}</td><td>${formatter.format(cFila*3)}</td></tr>`;
            });

            const rent = (Number(f.total || f.totalFactura || 0)) - sumaCostoMateriales;
            htmlContenido += `</tbody></table>
                <div class="rentabilidad-box">RENTABILIDAD OBTENIDA: ${formatter.format(rent)} ✅</div>
            </div>`;
        });

        htmlContenido += `</body></html>`;
        nuevaVentana.document.write(htmlContenido);
        nuevaVentana.document.close();
    } catch (e) { console.error(e); }
}

// --- 4. EXPORTAR A EXCEL (CSV COMPATIBLE) ---
function exportarAExcel() {
    if (todasLasFacturas.length === 0) return alert("No hay datos para exportar");
    try {
        let csvContent = "\uFEFFFecha,OT,Cliente,Total Venta,Saldo,Estado\n";
        todasLasFacturas.forEach(f => {
            const fecha = f.fecha || '---';
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
        link.href = url;
        link.download = `Ventas_LaChicaMorales.csv`;
        link.click();
    } catch (error) { console.error("Error Excel:", error); }
}

// --- 5. RENDERIZADO DE LA TABLA ---
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
            <td>${f.fecha || '---'}</td>
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

window.abrirAnalisisCostos = function(id) {
    if (id) window.location.href = `reportes.html?id=${id}`;
};

async function eliminarFactura(id, numero) {
    if (confirm(`¿Estás seguro de eliminar la Orden ${numero}?`)) {
        try {
            const res = await fetch(`/.netlify/functions/server/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) fetchInvoices();
        } catch (error) { console.error(error); }
    }
}