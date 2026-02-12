/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Lógica de Inventario, Proveedores y Movimientos de Compra
 * Versión: 4.4 - FIX DEFINITIVO: Sincronización de Modelos y Nombres
 */

// --- VARIABLES DE ESTADO ---
let todosLosMateriales = [];
let todosLosProveedores = [];

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Sistema de Gestión Iniciado v4.4");
    fetchInventory();
    fetchProviders(); 
    configurarEventos();
});

// --- FUNCIONES DE NAVEGACIÓN (GLOBALES) ---
window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

window.abrirAgenda = function() {
    console.log("🔔 Abriendo agenda de proveedores...");
    const modal = document.getElementById('modalAgenda');
    if (modal) {
        modal.style.display = 'block';
        window.renderAgendaProveedores();
    }
};

window.renderAgendaProveedores = function() {
    const contenedor = document.getElementById('agendaContent');
    if (!contenedor) return;

    if (todosLosProveedores.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;">No hay proveedores registrados.</p>';
        return;
    }

    contenedor.innerHTML = todosLosProveedores.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f1f5f9;">
            <div>
                <div style="font-weight:bold; color:#1e293b;">${p.nombre}</div>
                <div style="font-size:0.8rem; color:#64748b;">
                    <i class="fas fa-phone"></i> ${p.telefono || 'Sin teléfono'} | 
                    <i class="fas fa-tag"></i> ${p.contacto || 'Sin contacto'}
                </div>
            </div>
            <a href="tel:${p.telefono}" style="background:#3498db; color:white; width:35px; height:35px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none;">
                <i class="fas fa-phone-alt"></i>
            </a>
        </div>
    `).join('');
};

// --- CARGA DE DATOS ---
async function fetchInventory() {
    try {
        const result = await window.API.getInventory();
        
        if (result.success) {
            todosLosMateriales = result.data.map(m => ({
                ...m,
                nombre: m.nombre || "Material sin nombre",
                categoria: m.categoria || "General",
                // Aseguramos que lea 'proveedor' (en español) que viene poblado del backend
                proveedorNombre: m.proveedor ? m.proveedor.nombre : "Sin proveedor",
                stock_actual_m2: Number(m.stock_actual_m2) || 0,
                precio_m2_costo: Number(m.precio_m2_costo) || 0,
                stock_minimo_m2: Number(m.stock_minimo_m2) || 1.5
            }));
            renderTable(todosLosMateriales);
            actualizarDatalistMateriales();
        }
    } catch (error) {
        console.error("❌ Error inventario:", error);
        const tableBody = document.getElementById('inventoryTable');
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red; padding:20px;">Error al cargar datos.</td></tr>';
    }
}

async function fetchProviders() {
    try {
        const data = await window.API.getProviders();
        if (Array.isArray(data)) {
            todosLosProveedores = data.sort((a, b) => a.nombre.localeCompare(b.nombre));
            actualizarSelectProveedores();
        }
    } catch (error) { 
        console.error("❌ Error proveedores:", error); 
    }
}

// --- RENDERIZADO DE TABLA ---
function renderTable(materials) {
    const tableBody = document.getElementById('inventoryTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    materials.forEach(m => {
        const tr = document.createElement('tr');
        const ancho = Number(m.ancho_lamina_cm) || 0;
        const largo = Number(m.largo_lamina_cm) || 0;
        const areaUnaLaminaM2 = (ancho * largo) / 10000;
        const stockActual = Number(m.stock_actual_m2) || 0;
        const stockMinimo = Number(m.stock_minimo_m2) || 1.5;
        
        const unidadesCompletas = areaUnaLaminaM2 > 0 ? Math.floor(stockActual / areaUnaLaminaM2) : 0;
        const remanenteM2 = areaUnaLaminaM2 > 0 ? (stockActual % areaUnaLaminaM2) : 0;
        const etiquetaUnidad = (m.categoria && m.categoria.toLowerCase().includes('marco')) ? 'Tiras' : 'Láminas';

        let stockColor = '#059669'; 
        let badgeAlerta = '';
        if (stockActual <= 0) {
            stockColor = '#ef4444'; 
            badgeAlerta = '<div style="color:#ef4444; font-size:0.6rem; font-weight:700;">⚠️ AGOTADO</div>';
        } else if (stockActual <= stockMinimo) {
            stockColor = '#f59e0b';
            badgeAlerta = `<div style="color:#f59e0b; font-size:0.6rem; font-weight:700;">⏳ REORDEN</div>`;
        }

        tr.innerHTML = `
            <td style="text-align: left; padding: 10px 15px;">
                <div style="font-weight: 600; color: #1e293b; font-size: 0.9rem;">${m.nombre}</div>
                <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase;">
                    ${m.categoria} | <span style="color:#64748b">${m.proveedorNombre}</span>
                </div>
            </td>
            <td style="text-align: center;">
                <span style="background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; border: 1px solid #e2e8f0;">
                    ${ancho} x ${largo} cm
                </span>
            </td>
            <td style="text-align: center; font-weight: 500; font-size: 0.85rem; color: #475569;">
                ${formatter.format(m.precio_m2_costo || 0)}
            </td>
            <td style="text-align: center; padding: 8px;">
                <div style="background: #fff; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block; min-width: 100px;">
                    <div style="font-weight: 700; color: ${stockColor}; font-size: 0.95rem;">${stockActual.toFixed(2)} m²</div>
                    ${badgeAlerta}
                    <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 1px;">
                        ${unidadesCompletas} ${etiquetaUnidad} ${remanenteM2 > 0.01 ? `+ ${remanenteM2.toFixed(2)}` : ''}
                    </div>
                </div>
            </td>
            <td style="text-align: center;">
                <div class="actions-cell" style="display: flex; justify-content: center; gap: 4px;">
                    <button class="btn-table-action btn-edit-action" onclick="window.prepararAjuste('${m._id}', '${m.nombre}', ${stockActual}, ${stockMinimo})">
                        <i class="fas fa-sliders-h"></i> Ajustar
                    </button>
                    <button class="btn-table-action btn-history-action" onclick="window.verHistorial('${m._id}', '${m.nombre}')">
                        <i class="fas fa-history"></i> Historial
                    </button>
                    <button class="btn-table-action btn-delete-action" onclick="window.eliminarMaterial('${m._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// --- CONFIGURACIÓN DE EVENTOS ---
function configurarEventos() {
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        renderTable(todosLosMateriales.filter(m => m.nombre.toLowerCase().includes(term)));
    });

    document.getElementById('purchaseForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        
        const data = {
            nombre: document.getElementById('nombreMaterial').value.trim(),
            proveedor: document.getElementById('proveedorSelect').value, // Sincronizado con el backend
            ancho_lamina_cm: parseFloat(document.getElementById('ancho_compra').value),
            largo_lamina_cm: parseFloat(document.getElementById('largo_compra').value),
            precio_total_lamina: parseFloat(document.getElementById('precio_compra').value),
            cantidad_laminas: parseFloat(document.getElementById('cantidad_compra').value)
        };

        if(btn) btn.disabled = true;
        try {
            const res = await window.API.registerPurchase(data);
            if (res.success) { 
                window.cerrarModales(); 
                await fetchInventory(); 
                e.target.reset(); 
                alert("✅ Stock actualizado exitosamente");
            }
        } catch (err) { 
            alert("❌ Error al registrar compra"); 
        } finally { 
            if(btn) btn.disabled = false; 
        }
    });

    document.getElementById('adjustForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            materialId: document.getElementById('adjustId').value,
            nuevaCantidadM2: parseFloat(document.getElementById('adjustCantidad').value),
            stock_minimo_m2: parseFloat(document.getElementById('adjustReorden')?.value) || 2,
            motivo: document.getElementById('adjustMotivo').value || "Ajuste manual"
        };
        const res = await window.API.adjustStock(payload);
        if (res.success) { 
            window.cerrarModales(); 
            await fetchInventory();
        }
    });
}

// --- UTILIDADES GLOBALES ---
window.verHistorial = async function(id, nombre) {
    try {
        const result = await window.API.getHistory(id);
        const modal = document.getElementById('modalHistorialPrecios');
        const contenedor = document.getElementById('listaHistorialPrecios');
        const labelNombre = document.getElementById('historialMaterialNombre');

        if (labelNombre) labelNombre.innerText = nombre;

        if (result.success && result.data.length > 0) {
            const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
            contenedor.innerHTML = result.data.map(h => {
                const esCompra = h.tipo === 'COMPRA';
                const procedencia = h.proveedor ? h.proveedor.nombre : (h.tipo === 'VENTA' ? 'Orden Trabajo' : 'Ajuste');
                return `
                    <div class="history-item" style="padding: 8px; font-size: 0.8rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                        <div style="flex: 1;">
                            <strong style="color: #1e3a8a;">${procedencia}</strong>
                            <div style="font-size: 0.7rem; color: #64748b;">${new Date(h.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-weight: bold; color: ${esCompra ? '#2ecc71' : '#e74c3c'};">
                                ${esCompra ? formatter.format(h.precio_m2_costo || 0) : h.tipo}
                            </span>
                            <div style="font-size: 0.7rem; color: #94a3b8;">${Number(h.cantidad_m2 || 0).toFixed(2)} m²</div>
                        </div>
                    </div>`;
            }).join('');
        } else {
            contenedor.innerHTML = `<div style="text-align:center; padding:10px; font-size:0.8rem;">Sin movimientos registrados.</div>`;
        }
        if (modal) modal.style.display = 'block';
    } catch (error) { console.error("Error historial:", error); }
};

window.eliminarMaterial = async function(id) {
    if (confirm("⚠️ ¿Eliminar este material permanentemente?")) {
        try {
            const res = await window.API.deleteMaterial(id);
            if (res.success) await fetchInventory();
        } catch (error) { console.error("Error al eliminar:", error); }
    }
};

window.cerrarModales = function() { 
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
};

window.prepararAjuste = function(id, nombre, stockActual, stockMinimo) {
    if(document.getElementById('adjustId')) document.getElementById('adjustId').value = id;
    if(document.getElementById('adjustMaterialNombre')) document.getElementById('adjustMaterialNombre').innerText = nombre;
    if(document.getElementById('adjustCantidad')) document.getElementById('adjustCantidad').value = stockActual;
    if(document.getElementById('adjustReorden')) document.getElementById('adjustReorden').value = stockMinimo;
    if(document.getElementById('modalAjuste')) document.getElementById('modalAjuste').style.display = 'block';
};

function actualizarSelectProveedores() {
    const select = document.getElementById('proveedorSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' + 
            todosLosProveedores.map(p => `<option value="${p._id}">${p.nombre}</option>`).join('');
    }
}

function actualizarDatalistMateriales() {
    const list = document.getElementById('listaMateriales');
    if (list) list.innerHTML = todosLosMateriales.map(m => `<option value="${m.nombre}">`).join('');
}