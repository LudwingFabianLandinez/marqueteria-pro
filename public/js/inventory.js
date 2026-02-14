/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Lógica de Inventario, Proveedores y Movimientos de Compra
 * Versión: 4.7 - FINAL DESBLOQUEO VISTA
 */

let todosLosMateriales = [];
let todosLosProveedores = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Sistema de Gestión Iniciado v4.7 - Netlify Ready");
    fetchInventory();
    fetchProviders(); 
    configurarEventos();
});

window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

window.abrirAgenda = function() {
    const modal = document.getElementById('modalAgenda');
    if (modal) {
        modal.style.setProperty('display', 'flex', 'important');
        
        // REFUERZO: Si la lista está vacía, la pedimos al servidor primero
        if (!window.todosLosProveedores || window.todosLosProveedores.length === 0) {
            console.log("Buscando proveedores en el servidor...");
            fetchProviders().then(() => {
                window.renderAgendaProveedores();
            });
        } else {
            window.renderAgendaProveedores();
        }
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

async function fetchInventory() {
    try {
        const result = await window.API.getInventory();
        const data = result.success ? result.data : (Array.isArray(result) ? result : []);
        
        todosLosMateriales = data.map(m => ({
            ...m,
            nombre: m.nombre || "Material sin nombre",
            categoria: m.categoria || "General",
            proveedorNombre: m.proveedor ? (m.proveedor.nombre || m.proveedor) : "Sin proveedor",
            // --- CORRECCIÓN DE CAMPOS PARA DESBLOQUEAR VISTA ---
            stock_actual: Number(m.stock_actual_m2 || m.stock_actual || m.cantidad || 0),
            precio_m2_costo: Number(m.precio_m2_costo || m.costo_unitario || 0),
            stock_minimo: Number(m.stock_minimo || 2)
        }));
        
        renderTable(todosLosMateriales);
        actualizarDatalistMateriales();
    } catch (error) {
        console.error("❌ Error inventario:", error);
        const tableBody = document.getElementById('inventoryTable');
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red; padding:20px;">Error al conectar con el servidor.</td></tr>';
    }
}

async function fetchProviders() {
    try {
        const result = await window.API.getProviders();
        const data = result.success ? result.data : (Array.isArray(result) ? result : []); 
        if (Array.isArray(data)) {
            todosLosProveedores = data.sort((a, b) => a.nombre.localeCompare(b.nombre));
            actualizarSelectProveedores();
        }
    } catch (error) { console.error("❌ Error proveedores:", error); }
}

function renderTable(materials) {
    const tableBody = document.getElementById('inventoryTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    materials.forEach(m => {
        const tr = document.createElement('tr');
        const ancho = Number(m.ancho_lamina_cm) || 0;
        const largo = Number(m.largo_lamina_cm) || 0;
        const stockActual = Number(m.stock_actual) || 0;
        const stockMinimo = Number(m.stock_minimo) || 2;
        const tipoUnidad = m.tipo === 'ml' ? 'ml' : 'm²';
        
        let unidadesCompletas = 0;
        let remanente = 0;
        let etiquetaUnidad = 'Láminas';

        if (m.tipo === 'ml') {
            unidadesCompletas = largo > 0 ? Math.floor(stockActual / (largo / 100)) : 0;
            remanente = largo > 0 ? (stockActual % (largo / 100)) : 0;
            etiquetaUnidad = 'Tiras/Varas';
        } else {
            const areaM2 = (ancho * largo) / 10000;
            unidadesCompletas = areaM2 > 0 ? Math.floor(stockActual / areaM2) : 0;
            remanente = areaM2 > 0 ? (stockActual % areaM2) : 0;
        }

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
                    ${m.tipo === 'ml' ? `${largo} cm (Largo)` : `${ancho}x${largo} cm`}
                </span>
            </td>
            <td style="text-align: center; font-weight: 500; font-size: 0.85rem; color: #475569;">
                ${formatter.format(m.precio_m2_costo || 0)} <span style="font-size:0.6rem">/${tipoUnidad}</span>
            </td>
            <td style="text-align: center; padding: 8px;">
                <div style="background: #fff; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block; min-width: 100px;">
                    <div style="font-weight: 700; color: ${stockColor}; font-size: 0.95rem;">${stockActual.toFixed(2)} ${tipoUnidad}</div>
                    ${badgeAlerta}
                    <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 1px;">
                        ${unidadesCompletas} ${etiquetaUnidad} ${remanente > 0.01 ? `+ ${remanente.toFixed(2)}` : ''}
                    </div>
                </div>
            </td>
            <td style="text-align: center;">
                <div class="actions-cell" style="display: flex; justify-content: center; gap: 4px;">
                    <button class="btn-table-action btn-edit-action" onclick="window.prepararAjuste('${m._id}', '${m.nombre}', ${stockActual}, ${stockMinimo})">
                        <i class="fas fa-sliders-h"></i> Ajustar
                    </button>
                    <button class="btn-table-action btn-history-action" onclick="window.verHistorial('${m._id}', '${m.nombre}')">
                        <i class="fas fa-history"></i>
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

function configurarEventos() {
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        renderTable(todosLosMateriales.filter(m => m.nombre.toLowerCase().includes(term)));
    });

    document.getElementById('purchaseForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const nombreMat = document.getElementById('nombreMaterial').value;
        const esMarco = nombreMat.toLowerCase().includes('marco') || nombreMat.toLowerCase().includes('moldura');

        const data = {
            nombre: nombreMat.trim(),
            tipo: esMarco ? 'ml' : 'm2',
            proveedor: document.getElementById('proveedorSelect').value,
            ancho_lamina_cm: parseFloat(document.getElementById('ancho_compra').value) || 0,
            largo_lamina_cm: parseFloat(document.getElementById('largo_compra').value) || 0,
            precio_total_lamina: parseFloat(document.getElementById('precio_compra').value) || 0,
            cantidad_laminas: parseFloat(document.getElementById('cantidad_compra').value) || 0
        };

        if(btn) btn.disabled = true;
        try {
            const res = await window.API.registerPurchase(data);
            if (res.success) { 
                window.cerrarModales(); 
                await fetchInventory(); 
                e.target.reset(); 
                alert("✅ Inventario actualizado");
            }
        } catch (err) { alert("❌ Error al registrar"); } 
        finally { if(btn) btn.disabled = false; }
    });

    document.getElementById('adjustForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            materialId: document.getElementById('adjustId').value,
            nuevaCantidad: parseFloat(document.getElementById('adjustCantidad').value),
            stock_minimo: parseFloat(document.getElementById('adjustReorden')?.value) || 2,
            motivo: document.getElementById('adjustMotivo').value || "Ajuste manual"
        };
        const res = await window.API.adjustStock(payload);
        if (res.success) { 
            window.cerrarModales(); 
            await fetchInventory();
        }
    });
}

window.verHistorial = async function(id, nombre) {
    try {
        const result = await window.API.getHistory(id);
        const modal = document.getElementById('modalHistorialPrecios');
        const contenedor = document.getElementById('listaHistorialPrecios');
        const labelNombre = document.getElementById('historialMaterialNombre');

        if (labelNombre) labelNombre.innerText = nombre;

        const data = result.success ? result.data : result;

        if (Array.isArray(data) && data.length > 0) {
            const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
            contenedor.innerHTML = data.map(h => {
                const esCompra = h.tipo === 'COMPRA';
                const procedencia = h.proveedor?.nombre || (h.tipo === 'VENTA' ? 'Orden Trabajo' : 'Ajuste');
                return `
                    <div class="history-item" style="padding: 10px; font-size: 0.8rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items:center;">
                        <div style="flex: 1;">
                            <strong style="color: #1e40af;">${procedencia}</strong>
                            <div style="font-size: 0.7rem; color: #94a3b8;">${new Date(h.fecha || h.createdAt).toLocaleString()}</div>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-weight: bold; color: ${esCompra ? '#10b981' : '#f43f5e'};">
                                ${esCompra ? formatter.format(h.costo_unitario || h.precio_m2_costo || 0) : h.tipo}
                            </span>
                            <div style="font-size: 0.7rem; color: #64748b;">${Number(h.cantidad || h.cantidad_m2 || 0).toFixed(2)} uds</div>
                        </div>
                    </div>`;
            }).join('');
        } else {
            contenedor.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Sin movimientos.</div>`;
        }
        if (modal) modal.style.display = 'block';
    } catch (error) { console.error("Error historial:", error); }
};

window.eliminarMaterial = async function(id) {
    if (confirm("⚠️ ¿Eliminar este material?")) {
        try {
            const res = await window.API.deleteMaterial(id);
            if (res.success) await fetchInventory();
        } catch (error) { console.error("Error:", error); }
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