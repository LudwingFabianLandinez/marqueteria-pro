/**
 * LÓGICA PARA EL HISTORIAL DE COMPRAS
 * Marquetería La Chica Morales
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("📥 Cargando historial de adquisiciones...");
    fetchPurchases();
    setupSearch();
    setupPrintButton();
});

/**
 * Obtiene los datos del servidor y maneja los estados de la tabla
 */
async function fetchPurchases() {
    const tableBody = document.getElementById('purchasesTableBody');
    if (!tableBody) return;
    
    try {
        // Agregamos un timestamp para evitar que el navegador cargue datos viejos de la caché
        const response = await fetch(`/api/inventory/all-purchases?t=${Date.now()}`); 
        const result = await response.json();

        // LOG DE DEPURACIÓN: Si la tabla está vacía, mira este mensaje en tu consola (F12)
        console.log("🔍 Respuesta del servidor:", result);

        if (result.success && result.data && result.data.length > 0) {
            // Renderizamos la tabla con los datos del servidor
            renderPurchasesTable(result.data);
            
            // Actualizamos los indicadores superiores (KPIs)
            actualizarResumen(result.data);
        } else {
            // Estado vacío
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 60px; color: #94a3b8;">
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
                <td colspan="5" style="text-align: center; padding: 60px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 15px;"></i><br>
                    Error de conexión con el servidor. Por favor, recarga la página.
                </td>
            </tr>`;
    }
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

        // Verificación de seguridad para evitar errores de renderizado si el objeto no cargó bien
        const nombreMaterial = c.materialId?.nombre || c.motivo || 'Material no especificado';
        const nombreProveedor = c.proveedorId?.nombre || 'Proveedor General';

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 15px; color: #64748b;">${fechaFormateada}</td>
                <td style="padding: 15px; font-weight: 600; color: #1e3a8a;">
                    ${nombreProveedor}
                </td>
                <td style="padding: 15px;">
                    <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 500;">
                        ${nombreMaterial}
                    </span>
                </td>
                <td style="padding: 15px; text-align: center; font-weight: 700; color: #334155;">
                    ${c.cantidad_m2 ? c.cantidad_m2.toFixed(2) : '0.00'} m²
                </td>
                <td style="padding: 15px; text-align: right; font-weight: 800; color: #059669;">
                    ${formatter.format(c.costo_total || 0)}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Actualiza los cuadros de texto superiores con los totales de la compra
 */
function actualizarResumen(compras) {
    const totalInversion = compras.reduce((sum, c) => sum + (c.costo_total || 0), 0);
    const totalM2 = compras.reduce((sum, c) => sum + (c.cantidad_m2 || 0), 0);
    
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    
    const inversionEl = document.getElementById('totalInversionValue') || document.querySelector('.inversion-total h2');
    const materialEl = document.getElementById('totalMaterialValue') || document.querySelector('.material-ingresado h2');
    const ultimaCompraEl = document.getElementById('ultimaCompraFecha') || document.querySelector('.ultima-compra h2');

    if (inversionEl) inversionEl.innerText = formatter.format(totalInversion);
    if (materialEl) materialEl.innerText = `${totalM2.toFixed(2)} m²`;
    
    if (ultimaCompraEl && compras.length > 0) {
        // Obtenemos la fecha de la transacción más reciente [cite: 2026-02-05]
        const ultimaFecha = new Date(compras[0].fecha).toLocaleDateString('es-ES');
        ultimaCompraEl.innerText = ultimaFecha;
    }
}

/**
 * Filtrado en tiempo real en la tabla
 */
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

/**
 * Lógica para el botón "Imprimir Reporte"
 */
function setupPrintButton() {
    const printBtn = document.getElementById('printReportBtn') || document.querySelector('.btn-imprimir');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}