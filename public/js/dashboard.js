/**
 * Lógica del Dashboard Principal - MARQUETERÍA LA CHICA MORALES
 * Incluye: Estadísticas, Alertas de Stock, Saneamiento Automático de Negativos
 * Versión: 4.3 - Estabilización de Rutas y Funciones Globales
 */

// Definición de URL base para evitar errores de ruta en Netlify
const API_BASE_DASH = (window.API && window.API.url) ? window.API.url : '/api';

document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    // Ejecutar limpieza de negativos inmediatamente al cargar
    sanearInventarioNegativo();
    
    // Cargar proveedores en segundo plano para tener la agenda lista
    fetchProvidersForAgenda();

    // Vincular cierre de modales al hacer clic fuera de ellos
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            window.cerrarModales();
        }
    };
});

// Variable global para la agenda
let proveedoresAgenda = [];

// --- 1. CARGA DE ESTADÍSTICAS Y ALERTAS ---
async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE_DASH}/stats`);
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
                if (alertas && alertas.length > 0) {
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
        const response = await fetch(`${API_BASE_DASH}/inventory`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const materialesNegativos = result.data.filter(m => (m.stock_actual_m2 || m.stockActual || m.cantidad) < 0);
            
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
        const res = await fetch(`${API_BASE_DASH}/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                stock_actual_m2: 0, 
                cantidad: 0,
                notas: "Corrección automática: El stock era negativo." 
            })
        });
        if (res.ok) console.log(`✅ ${nombre}: Stock reseteado a 0.`);
    } catch (error) {
        console.error(`❌ Falló la corrección de ${nombre}:`, error);
    }
}

// --- 4. CONTROL DE BOTONES Y MODALES (GLOBALIZADOS) ---

window.nuevaCotizacion = function() {
    console.log("📝 Abriendo Nueva Cotización...");
    window.location.href = 'facturacion.html?tipo=cotizacion';
};

window.nuevaCompra = function() {
    console.log("📦 Abriendo Nueva Compra...");
    const modal = document.getElementById('modalCompra');
    if (modal) {
        modal.style.display = 'block';
    } else {
        alert("ID 'modalCompra' no encontrado en el HTML.");
    }
};

window.abrirAgenda = function() {
    console.log("🟢 Abriendo agenda desde dashboard...");
    const modal = document.getElementById('modalAgenda');
    if (modal) {
        modal.style.display = 'block';
        // Disparamos la carga de la tabla de proveedores si la función existe
        if (typeof window.cargarTablaProveedores === 'function') {
            window.cargarTablaProveedores();
        } else if (typeof renderAgendaProveedores === 'function') {
            window.renderAgendaProveedores();
        }
    } else {
        console.error("❌ No se encontró el modal 'modalAgenda'");
    }
};

// --- 5. INTEGRACIÓN GLOBAL DE AGENDA ---

async function fetchProvidersForAgenda() {
    try {
        const response = await fetch(`${API_BASE_DASH}/providers`);
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
    const contenedor = document.getElementById('agendaContent') || document.getElementById('lista-proveedores-body');
    if (!contenedor) return;

    if (proveedoresAgenda.length === 0) {
        contenedor.innerHTML = '<tr><td colspan="6" class="text-center">No hay proveedores registrados.</td></tr>';
        return;
    }

    // Adaptamos el renderizado según el contenedor detectado
    if (contenedor.tagName === 'TBODY') {
        contenedor.innerHTML = proveedoresAgenda.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.nit || 'N/A'}</td>
                <td>${p.contacto || 'N/A'}</td>
                <td>${p.telefono || 'Sin número'}</td>
                <td>${p.categoria || 'General'}</td>
                <td><button class="btn-edit" onclick="alert('ID: ${p._id}')"><i class="fas fa-edit"></i></button></td>
            </tr>
        `).join('');
    }
};

window.cerrarModales = function() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
};

window.cerrarModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
};