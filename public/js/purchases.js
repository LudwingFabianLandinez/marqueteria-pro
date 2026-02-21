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
});

/**
 * Obtiene los datos del servidor y maneja los estados de la tabla
 */
async function fetchPurchases() {
    const tableBody = document.getElementById('purchasesTableBody');
    if (!tableBody) return;
    
    try {
        const response = await fetch(`/api/inventory/all-purchases?t=${Date.now()}`); 
        const result = await response.json();

        console.log("🔍 Respuesta del servidor:", result);

        if (result.success && result.data && result.data.length > 0) {
            renderPurchasesTable(result.data);
            actualizarResumen(result.data);
        } else {
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

        // --- GANCHO DE COMPATIBILIDAD DE NOMBRE ---
        const nombreMaterial = (c.materialId && typeof c.materialId === 'object') 
            ? c.materialId.nombre 
            : (c.nombreMaterial || c.materialNombre || c.motivo || 'Material');
        
        const nombreProveedor = (c.proveedorId && typeof c.proveedorId === 'object') 
            ? c.proveedorId.nombre 
            : 'Proveedor General';

        // --- GANCHO DE UNIDADES Y COSTO (M2 vs ML) ---
        // Buscamos el valor en cantidad_m2 o totalM2 (para el 2.9)
        const cantidadValor = parseFloat(c.cantidad_m2 || c.totalM2 || 0);
        const unidadTexto = c.unidad || (c.tipo === 'ml' ? 'ml' : 'm²');
        
        // Buscamos el costo en costo_total o costo o precio_total
        const costoFinal = c.costo_total || c.costo || c.precio_total || 0;

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
                    ${cantidadValor.toFixed(2)} ${unidadTexto}
                </td>
                <td style="padding: 15px; text-align: right; font-weight: 800; color: #059669;">
                    ${formatter.format(costoFinal)}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Actualiza los cuadros de texto superiores
 */
function actualizarResumen(compras) {
    const totalInversion = compras.reduce((sum, c) => sum + (c.costo_total || c.costo || c.precio_total || 0), 0);
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