/**
 * GESTIÓN DE INVENTARIO - MARQUETERÍA LA CHICA MORALES
 * Versión 4.7 - Sincronizada con Netlify Serverless
 */

// Usamos la variable global de API si existe, o la ruta directa de Netlify
const API_INVENTORY = '/.netlify/functions/server/inventory';

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Sistema de Gestión Iniciado v4.7 - Netlify Ready");
    fetchInventory();
});

async function fetchInventory() {
    try {
        const response = await fetch(API_INVENTORY);
        
        // Verificación de seguridad para evitar el error "Unexpected token <"
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("El servidor no devolvió JSON. Posible error 502 o ruta mal configurada.");
        }

        const result = await response.json();

        if (result.success) {
            renderInventoryTable(result.data);
        } else {
            console.error("❌ Error en la respuesta:", result.error);
        }
    } catch (error) {
        console.error("🚨 Error al cargar inventario:", error);
        document.getElementById('inventory-body').innerHTML = 
            `<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">
                Error al conectar con el servidor. Reintente en unos momentos.
            </td></tr>`;
    }
}

function renderInventoryTable(materiales) {
    const tableBody = document.getElementById('inventory-body');
    if (!tableBody) return;

    if (materiales.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No hay materiales registrados</td></tr>';
        return;
    }

    tableBody.innerHTML = materiales.map(m => {
        // Normalización de campos para que coincidan con tu modelo de Atlas
        const stock = m.stock_actual_m2 || m.stockActual || 0;
        const nombre = m.nombre || 'Sin nombre';
        const categoria = m.categoria || 'General';
        const precio = m.precio_m2 || m.costoM2 || 0;

        return `
            <tr class="inventory-row">
                <td>
                    <div style="font-weight:bold;">${nombre}</div>
                    <div style="font-size:0.75rem; color:#64748b;">${categoria}</div>
                </td>
                <td style="text-align:center;">${m.dimensiones || 'N/A'}</td>
                <td style="text-align:right;">$ ${precio.toLocaleString()}</td>
                <td style="text-align:center;">
                    <span class="stock-badge ${stock <= 0 ? 'stock-empty' : 'stock-ok'}">
                        ${stock.toFixed(2)} m²
                    </span>
                </td>
                <td style="text-align:center;">
                    <button class="btn-adjust" onclick="abrirAjuste('${m._id}')">
                        <i class="fas fa-edit"></i> Ajustar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}