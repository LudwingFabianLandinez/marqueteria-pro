/**
 * Lógica del Dashboard Principal - MARQUETERÍA LA CHICA MORALES
 * Incluye: Estadísticas, Alertas de Stock, Saneamiento Automático de Negativos
 * Versión: 4.2 - Activación de Botones y Control de Vistas
 */

document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    // Ejecutar limpieza de negativos inmediatamente al cargar
    sanearInventarioNegativo();
    
    // Cargar proveedores en segundo plano para tener la agenda lista
    fetchProvidersForAgenda();

    // Vincular cierre de modales al hacer clic fuera de ellos
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            cerrarModales();
        }
    };
});

// Variable global para la agenda
let proveedoresAgenda = [];

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
async function sanearInventarioNegativo() {
    try {
        const response = await fetch('/api/inventory');
        const result = await response.json();
        
        if (result.success) {
            const materialesNegativos = result.data.filter(m => (m.stock_actual_m2 || m.stockActual) < 0);
            
            if (materialesNegativos.length > 0) {
                console.warn(`🚨 Saneando ${materialesNegativos.length} negativos...`);
                for (const mat of materialesNegativos) {
                    await corregirStockCero(mat._id, mat.nombre);
                }
                fetchStats();
            }
        }
    } catch (error) {
        console.error("❌ Error en saneamiento de inventario:", error);
    }
}

async function corregirStockCero(id, nombre) {
    try {
        const res = await fetch(`/api/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                stock_actual_m2: 0, 
                notas: "Corrección automática: El stock era negativo." 
            })
        });
        if (res.ok) console.log(`✅ ${nombre}: Stock reseteado a 0.`);
    } catch (error) {
        console.error(`❌ Falló la corrección de ${nombre}:`, error);
    }
}

// --- 4. CONTROL DE BOTONES Y MODALES ---

// Botón: Nueva Cotización
window.nuevaCotizacion = function() {
    console.log("📝 Abriendo Nueva Cotización...");
    // Redirige a la página de facturación/cotización o abre modal
    window.location.href = 'facturacion.html?tipo=cotizacion';
};

// Botón: Nueva Compra (Ingreso de Mercancía)
window.nuevaCompra = function() {
    console.log("📦 Abriendo Nueva Compra...");
    const modal = document.getElementById('modalCompra'); // Asegúrate que este ID existe en tu HTML
    if (modal) modal.style.display = 'block';
    else alert("Módulo de compras en desarrollo o ID 'modalCompra' no encontrado.");
};

// Botón: Consultar Proveedores (Agenda)
window.abrirAgenda = function() {
    console.log("🟢 Abriendo agenda desde dashboard...");
    const modal = document.getElementById('modalAgenda');
    if (modal) {
        modal.style.display = 'block';
        // ASOCIACIÓN CLAVE: Al abrir el modal, disparamos la carga de datos
        if (typeof cargarTablaProveedores === 'function') {
            cargarTablaProveedores();
        }
    } else {
        console.error("❌ No se encontró el modal 'modalAgenda'");
    }
};

// --- 5. INTEGRACIÓN GLOBAL DE AGENDA ---

async function fetchProvidersForAgenda() {
    try {
        const response = await fetch('/api/providers');
        const result = await response.json();
        const data = result.success ? result.data : result;
        if (Array.isArray(data)) {
            proveedoresAgenda = data.sort((a, b) => a.nombre.localeCompare(b.nombre));
        }
    } catch (error) {
        console.error("❌ Error agenda dashboard:", error);
    }
}

window.renderAgendaProveedores = function() {
    const contenedor = document.getElementById('agendaContent');
    if (!contenedor) return;

    if (proveedoresAgenda.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; padding:20px;">No hay proveedores registrados.</p>';
        return;
    }

    contenedor.innerHTML = proveedoresAgenda.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee;">
            <div>
                <div style="font-weight:bold; color: #1e3a8a;">${p.nombre}</div>
                <div style="font-size:0.8rem; color:#64748b;">${p.telefono || 'Sin número'}</div>
            </div>
            <div style="display: flex; gap: 10px;">
                <a href="tel:${p.telefono}" style="background:#10b981; color:white; width:35px; height:35px; border-radius:8px; display:flex; align-items:center; justify-content:center; text-decoration:none;">
                    <i class="fas fa-phone-alt"></i>
                </a>
            </div>
        </div>
    `).join('');
};

window.cerrarModales = function() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
};