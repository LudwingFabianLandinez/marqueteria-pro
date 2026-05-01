/**
 * LÓGICA PARA EL HISTORIAL DE COMPRAS - v13.3.62
 * Marquetería La Chica Morales
 * Blindaje: Estructura visual y lógica de búsqueda 100% INTACTA.
 * Ajuste: Compatibilidad con unidades (m2/ml) y alias de costo.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("📥 Cargando historial de adquisiciones...");
    fetchPurchases();
    setupSearch();
    setupPrintButton();
    setupChartButton();
});

/**
 * Obtiene los datos del servidor y maneja los estados de la tabla
 */
async function fetchPurchases() {
    const tableBody = document.getElementById('purchasesTableBody');
    if (!tableBody) return;
    
    try {
        const base = (typeof window.resolveApiBase === 'function')
            ? window.resolveApiBase()
            : ((['localhost','127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:')
                ? 'https://marqueterialachica.netlify.app/.netlify/functions/server'
                : `${window.location.origin}/.netlify/functions/server`);

        const response = await fetch(base + '/inventory/all-purchases?t=' + Date.now());
        const result = await response.json();

        console.log("🔍 Respuesta del servidor:", result);

        if (result.success && result.data && result.data.length > 0) {
            // store raw data for charting
            window._comprasCache = result.data;
            renderPurchasesTable(result.data);
            actualizarResumen(result.data);
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 60px; color: #94a3b8;">
                        <i class="fas fa-box-open fa-3x" style="margin-bottom: 15px; opacity: 0.5;"></i><br>
                        No hay registros de compras en el sistema.
                    </td>
                </tr>`;
            actualizarResumen([]); 
        }
    } catch (error) {
        console.error("❌ Error al cargar compras:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 60px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 15px;"></i><br>
                    Error de conexión con el servidor. Por favor, recarga la página.
                </td>
            </tr>`;
    }
}
    const btn = document.getElementById('chartReportBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        // Ensure we have purchases cached
        if (!window._comprasCache || window._comprasCache.length === 0) {
            await fetchPurchases();
        }
        renderPurchasesChart(window._comprasCache || []);
        showChartModal();
    });

    const closeBtn = document.getElementById('closeChartModal');
    if (closeBtn) closeBtn.addEventListener('click', hideChartModal);
}

function showChartModal() {
    const m = document.getElementById('purchasesChartModal');
    if (m) m.style.display = 'flex';
}

function hideChartModal() {
    const m = document.getElementById('purchasesChartModal');
    if (m) m.style.display = 'none';
}

let __purchasesChart = null;
function renderPurchasesChart(compras) {
    const canvas = document.getElementById('purchasesChart');
    if (!canvas) return;

    // Aggregate by YYYY-MM (month)
    const sums = {};
    compras.forEach(c => {
        const date = c.fecha ? new Date(c.fecha) : null;
        if (!date) return;
        const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
        const value = Number(parseFloat(c.costo_total || c.costo || c.total || 0) || 0);
        sums[key] = (sums[key] || 0) + value;
    });

    const labels = Object.keys(sums).sort();
    const data = labels.map(k => sums[k]);

    // Format labels as 'MMM YYYY' in Spanish
    const labelFmt = labels.map(l => {
        const [y,m] = l.split('-');
        const d = new Date(Number(y), Number(m)-1, 1);
        return d.toLocaleString('es-ES', { month: 'short', year: 'numeric' });
    });

    if (__purchasesChart) {
        __purchasesChart.destroy();
        __purchasesChart = null;
    }

    __purchasesChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labelFmt,
            datasets: [{
                label: 'Compras (COP)',
                data,
                backgroundColor: 'rgba(3,169,244,0.75)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const v = context.raw || 0;
                            return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val)
                    }
                }
            }
        }
    });
}

/**
 * Genera el HTML de las filas de la tabla
 */
function renderPurchasesTable(compras) {
    const tableBody = document.getElementById('purchasesTableBody');
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    
    tableBody.innerHTML = compras.map(c => {
        const fechaFormateada = c.fecha 
            ? new Date(c.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '--/--/----';

        // --- 🎯 GANCHO DE COMPATIBILIDAD DE NOMBRE (SINCRO REAL V12.1.9) ---
        
        // 1. BÚSQUEDA DE MATERIAL (Blindada)
        // Buscamos en materialId (objeto), luego en nombres directos enviados por el server
        const nombreMaterial = (c.materialId && typeof c.materialId === 'object') 
            ? (c.materialId.nombre || c.materialId.descripcion || "Material") 
            : (c.nombreMaterial || c.materialNombre || c.material || c.motivo || 'Material');
        
        // 2. BÚSQUEDA DE PROVEEDOR (Ultra-Compatible)
        // Resolvemos nombre del proveedor desde cualquier forma: objeto, id, o campo directo
        function resolverNombreProveedorRegistro(reg) {
            if (!reg) return null;
            // 1) Si el backend pobló un objeto 'proveedor' o 'proveedorId', usar su nombre
            const provObj = reg.proveedor || reg.proveedorId || reg.provider || reg.proveedorId || null;
            if (provObj && typeof provObj === 'object') {
                return provObj.nombre || provObj.nombre_comercial || provObj.contacto || provObj.name || null;
            }

            // 2) Si viene un string directamente en alguno de estos campos, úsalo
            const posibleString = reg.proveedor || reg.proveedorId || reg.provider || reg.proveedorNombre || reg.providerName || reg.nombreProveedor;
            if (typeof posibleString === 'string' && posibleString.trim().length > 0) {
                // Si parece un ObjectId corto o largo, igual lo devolvemos (se muestra como ID)
                return posibleString.trim();
            }

            return null;
        }

        let nombreProveedor = resolverNombreProveedorRegistro(c) || 'Proveedor General';

        // --- GANCHO DE UNIDADES Y COSTO (M2 vs ML) ---
        // Buscamos el valor en cantidad_m2 o totalM2 (para el 2.8)
        const cantidadValor = parseFloat(c.cantidad_m2 || c.totalM2 || 0);
        const unidadTexto = c.unidad || (c.tipo === 'ml' ? 'ml' : 'm²');
        
        // Buscamos el costo en múltiples alias y priorizamos el total pagado
        const costoFinal = Number(
            c.costo_total ?? c.costo_pagado ?? c.costoPagado ?? c.total_pagado ?? c.totalPagado ?? c.total ?? c.costo ?? c.precio_total ?? 0
        ) || 0;

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 15px; color: #64748b; font-size: 0.85rem;">
                    <i class="far fa-calendar-alt" style="margin-right: 5px; opacity: 0.5;"></i> ${fechaFormateada}
                </td>
                <td style="padding: 15px;">
                    <span style="background: #f1f5f9; color: #1e293b; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; border: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${nombreProveedor}
                    </span>
                </td>
                <td style="padding: 15px;">
                    <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
                        ${nombreMaterial}
                    </span>
                </td>
                <td style="padding: 15px; text-align: center; font-weight: 700; color: #334155;">
                    <span style="font-size: 0.95rem;">${cantidadValor.toFixed(2)}</span> 
                    <small style="color: #64748b; font-weight: 500;">${unidadTexto}</small>
                </td>
                <td style="padding: 15px; text-align: right;">
                    <span style="font-weight: 800; color: #059669; font-size: 1.05rem; background: rgba(5, 150, 105, 0.1); padding: 4px 8px; border-radius: 6px;">
                        ${formatter.format(costoFinal)}
                    </span>
                </td>
                <td style="padding: 15px; text-align: center; width: 120px;">
                    <button class="btn-delete-purchase" data-id="${c._id}" style="background: #ef4444; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 700;">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach delete handlers after rendering
    setupDeleteButtons();
}

function setupDeleteButtons() {
    const buttons = document.querySelectorAll('.btn-delete-purchase');
    if (!buttons) return;
    buttons.forEach(b => {
        b.removeEventListener('click', onDeleteClick);
        b.addEventListener('click', onDeleteClick);
    });

    async function onDeleteClick(e) {
        const id = e.currentTarget.getAttribute('data-id');
        if (!id) return;
        if (!confirm('¿Confirmas eliminar esta compra? Esto disminuirá el stock del material.')) return;

        try {
            const base = (typeof window.resolveApiBase === 'function')
                ? window.resolveApiBase()
                : ((['localhost','127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:')
                    ? 'https://marqueterialachica.netlify.app/.netlify/functions/server'
                    : `${window.location.origin}/.netlify/functions/server`);

            const res = await fetch(base + '/inventory/purchase/' + id, { method: 'DELETE' });
            const json = await res.json();
            if (json && json.success) {
                alert('Compra eliminada correctamente. Inventario actualizado.');
                fetchPurchases();
            } else {
                alert('Error al eliminar la compra: ' + (json && json.message ? json.message : 'Respuesta inesperada'));
            }
        } catch (err) {
            console.error('Error eliminando compra:', err);
            alert('Error de conexión eliminando la compra. Revisa la consola.');
        }
    }
}

/**
 * Actualiza los cuadros de texto superiores
 */
function actualizarResumen(compras) {
    const totalInversion = compras.reduce((sum, c) => sum + (Number(
        c.costo_total ?? c.costo_pagado ?? c.costoPagado ?? c.total_pagado ?? c.totalPagado ?? c.total ?? c.costo ?? c.precio_total ?? 0
    ) || 0), 0);
    const totalMaterial = compras.reduce((sum, c) => sum + (parseFloat(c.cantidad_m2 || c.totalM2 || 0)), 0);
    
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    
    const inversionEl = document.getElementById('totalInversionValue') || document.querySelector('.inversion-total h2');
    const materialEl = document.getElementById('totalMaterialValue') || document.querySelector('.material-ingresado h2');
    const ultimaCompraEl = document.getElementById('ultimaCompraFecha') || document.querySelector('.ultima-compra h2');

    if (inversionEl) inversionEl.innerText = formatter.format(totalInversion);
    if (materialEl) materialEl.innerText = `${totalMaterial.toFixed(2)} Und/m²`;
    
    if (ultimaCompraEl && compras.length > 0) {
        const ultimaFecha = new Date(compras[0].fecha).toLocaleDateString('es-ES');
        ultimaCompraEl.innerText = ultimaFecha;
    }
}

function setupSearch() {
    const searchInput = document.getElementById('purchaseSearch') || document.querySelector('input[placeholder*="Buscar"]');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#purchasesTableBody tr');
        
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    });
}

function setupPrintButton() {
    const printBtn = document.getElementById('printReportBtn') || document.querySelector('.btn-imprimir');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}