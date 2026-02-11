/**
 * Lógica del Dashboard Principal - MARQUETERÍA LA CHICA MORALES
 * Incluye: Estadísticas, Alertas de Stock y Saneamiento Automático de Negativos
 */

document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    // Ejecutar limpieza de negativos inmediatamente al cargar
    sanearInventarioNegativo();
});

// --- 1. CARGA DE ESTADÍSTICAS Y ALERTAS ---
async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const result = await response.json();

        if (result.success) {
            const { ventasHoy, numVentasHoy, alertas, ultimasVentas } = result.data;

            // Actualizar tarjetas superiores
            const salesDisplay = document.getElementById('sales-today');
            if (salesDisplay) salesDisplay.textContent = `$ ${ventasHoy.toLocaleString()}`;

            const countDisplay = document.getElementById('sales-count');
            if (countDisplay) countDisplay.textContent = `${numVentasHoy} ventas hoy`;

            // Manejar alertas de inventario
            const statusLabel = document.getElementById('inventory-status');
            const alertMsg = document.getElementById('low-stock-msg');

            if (statusLabel && alertMsg) {
                if (alertas.length > 0) {
                    statusLabel.innerHTML = `⚠️ Alerta de Stock`;
                    statusLabel.style.color = '#e11d48'; // Rojo
                    alertMsg.innerHTML = `Tienes <b>${alertas.length}</b> materiales bajo el mínimo o en negativo.`;
                } else {
                    statusLabel.innerHTML = `✅ Stock al día`;
                    statusLabel.style.color = '#10b981'; // Verde
                    alertMsg.textContent = `Todos los materiales disponibles`;
                }
            }

            // Llenar tabla de ventas recientes
            renderRecentSales(ultimasVentas);
        }
    } catch (error) {
        console.error("❌ Error al cargar estadísticas:", error);
    }
}

// --- 2. RENDERIZADO DE VENTAS RECIENTES ---
function renderRecentSales(ventas) {
    const tableBody = document.getElementById('recent-sales-table');
    if (!tableBody || !ventas) return;

    if (ventas.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #64748b;">No hay ventas registradas hoy</td></tr>';
        return;
    }

    tableBody.innerHTML = ventas.map(v => {
        const numOT = v.numeroFactura || 'OT-000000';
        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; font-weight: bold; color: #1e3a8a;">${numOT}</td>
                <td style="padding: 12px;">${v.nombreCliente || 'Consumidor Final'}</td>
                <td style="padding: 12px; color: #64748b;">${new Date(v.createdAt).toLocaleDateString()}</td>
                <td style="padding: 12px; text-align: right;"><strong style="color: #15803d;">$ ${v.totalFactura.toLocaleString()}</strong></td>
            </tr>
        `;
    }).join('');
}

// --- 3. CORRECCIÓN DE INVENTARIOS NEGATIVOS ---
/**
 * Detecta materiales con stock < 0 y los resetea a 0 en la base de datos.
 */
async function sanearInventarioNegativo() {
    try {
        const response = await fetch('/api/inventory');
        const result = await response.json();
        
        if (result.success) {
            // Buscamos materiales con stock menor a cero
            // Nota: usamos stock_actual_m2 que es el nombre en tu modelo
            const materialesNegativos = result.data.filter(m => (m.stock_actual_m2 || m.stockActual) < 0);
            
            if (materialesNegativos.length > 0) {
                console.warn(`🚨 Saneando ${materialesNegativos.length} negativos...`);
                
                for (const mat of materialesNegativos) {
                    await corregirStockCero(mat._id, mat.nombre);
                }
                
                // Una vez corregidos, refrescamos las estadísticas para que las alertas desaparezcan
                fetchStats();
            }
        }
    } catch (error) {
        console.error("❌ Error en saneamiento de inventario:", error);
    }
}

async function corregirStockCero(id, nombre) {
    try {
        // Enviamos la corrección al servidor
        const res = await fetch(`/api/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                stock_actual_m2: 0, 
                notas: "Corrección automática: El stock era negativo." 
            })
        });

        if (res.ok) {
            console.log(`✅ ${nombre}: Stock reseteado a 0.`);
        }
    } catch (error) {
        console.error(`❌ Falló la corrección de ${nombre}:`, error);
    }
}