/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Lógica de Inventario, Proveedores y Movimientos de Compra
 * Versión: 4.8.7 - CORRECCIÓN DEFINITIVA DE VARIABLES
 */

let todosLosMateriales = [];
let todosLosProveedores = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Sistema Iniciado - Netlify Ready");
    fetchInventory();
    fetchProviders(); 
    configurarEventos();
});

window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

// --- MODALES DE PROVEEDORES ---

window.abrirAgenda = function() {
    const modal = document.getElementById('modalAgenda');
    if (modal) {
        modal.style.setProperty('display', 'flex', 'important');
        const contenedor = document.getElementById('agendaContent');
        if (contenedor) {
            contenedor.innerHTML = '<p style="text-align:center; padding:20px;">Sincronizando datos...</p>';
        }
        
        // Carga forzada inmediata
        fetchProviders().then(() => {
            window.renderAgendaProveedores();
        });
    }
};

window.renderAgendaProveedores = function() {
    console.log("🔍 Iniciando renderizado de emergencia...");
    const contenedor = document.getElementById('agendaContent');
    
    if (!contenedor) {
        console.error("❌ ERROR: El contenedor 'agendaContent' no existe en el HTML.");
        return;
    }

    // Si la variable global falló, intentamos recuperarla de la base de datos de nuevo
    if (!window.todosLosProveedores || window.todosLosProveedores.length === 0) {
        contenedor.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">No hay proveedores cargados. Reintentando...</div>';
        fetchProviders().then(() => window.renderAgendaProveedores());
        return;
    }

    // DIBUJAR LA TABLA CON LOS DATOS REALES DE ATLAS
    contenedor.innerHTML = window.todosLosProveedores.map(p => `
        <div style="display: grid; grid-template-columns: 1.2fr 1.2fr 1fr 45px; align-items: center; padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; text-align: left; background: white;">
            <div style="font-weight: bold; color: #1e293b;">${p.nombre || 'Sin nombre'}</div>
            <div style="color: #64748b;">${p.contacto || 'Sin contacto'}</div>
            <div style="color: #94a3b8; font-size: 0.75rem;">General</div>
            <div style="text-align: right;">
                <a href="tel:${p.telefono || ''}" style="background:#3498db; color:white; width:28px; height:28px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; text-decoration:none;">
                    <i class="fas fa-phone-alt" style="font-size: 0.7rem;"></i>
                </a>
            </div>
        </div>
    `).join('');
    
    console.log("✅ Renderizado exitoso.");
};

// --- RESTO DEL CÓDIGO (SIN CAMBIOS PARA NO DAÑAR NADA) ---

window.guardarProveedor = async function(event) {
    if(event) event.preventDefault();
    const nombre = document.getElementById('provNombre')?.value;
    const telefono = document.getElementById('provTelefono')?.value;
    const contacto = document.getElementById('provContacto')?.value;
    if (!nombre) return alert("El nombre es obligatorio");
    try {
        const res = await window.API.saveProvider({ nombre, telefono, contacto });
        if (res.success) {
            alert("✅ Proveedor guardado");
            document.getElementById('provForm')?.reset();
            await fetchProviders();
            window.renderAgendaProveedores();
        }
    } catch (error) { console.error("Error al guardar:", error); }
};

window.abrirModalCompra = function() {
    const modal = document.getElementById('modalCompra');
    if (modal) {
        modal.style.setProperty('display', 'flex', 'important');
        actualizarSelectProveedores(); 
    }
};

async function fetchInventory() {
    try {
        const result = await window.API.getInventory();
        const data = result.success ? result.data : (Array.isArray(result) ? result : []);
        todosLosMateriales = data.map(m => ({
            ...m,
            nombre: m.nombre || "Material sin nombre",
            categoria: m.categoria || "General",
            proveedorNombre: m.proveedor?.nombre || "Sin proveedor",
            stock_actual: Number(m.stock_actual || 0),
            precio_m2_costo: Number(m.precio_total_lamina || 0),
            stock_minimo: Number(m.stock_minimo || 2)
        }));
        renderTable(todosLosMateriales);
        actualizarDatalistMateriales();
    } catch (error) { console.error("❌ Error inventario:", error); }
}

async function fetchProviders() {
    try {
        const result = await window.API.getProviders();
        const listaBruta = result.success ? result.data : (Array.isArray(result) ? result : []); 
        if (Array.isArray(listaBruta)) {
            todosLosProveedores = listaBruta.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            actualizarSelectProveedores();
            console.log("✅ Sincronizado con Atlas:", todosLosProveedores.length);
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
        const stockActual = Number(m.stock_actual) || 0;
        const stockMinimo = Number(m.stock_minimo) || 2;
        const tipoUnidad = m.tipo === 'ml' ? 'ml' : 'm²';
        let stockColor = stockActual <= 0 ? '#ef4444' : (stockActual <= stockMinimo ? '#f59e0b' : '#059669');
        tr.innerHTML = `
            <td style="text-align: left; padding: 10px 15px;">
                <div style="font-weight: 600; color: #1e293b; font-size: 0.9rem;">${m.nombre}</div>
                <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase;">
                    ${m.categoria} | <span style="color:#64748b">${m.proveedorNombre}</span>
                </div>
            </td>
            <td style="text-align: center;">
                <span style="background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; border: 1px solid #e2e8f0;">
                    ${m.tipo === 'ml' ? `${m.largo_lamina_cm || 0} cm` : `${m.ancho_lamina_cm || 0}x${m.largo_lamina_cm || 0} cm`}
                </span>
            </td>
            <td style="text-align: center; font-weight: 500; font-size: 0.85rem; color: #475569;">
                ${formatter.format(m.precio_m2_costo || 0)} <span style="font-size:0.6rem">/${tipoUnidad}</span>
            </td>
            <td style="text-align: center; padding: 8px;">
                <div style="background: #fff; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block; min-width: 100px;">
                    <div style="font-weight: 700; color: ${stockColor}; font-size: 0.95rem;">${stockActual.toFixed(2)} ${tipoUnidad}</div>
                </div>
            </td>
            <td style="text-align: center;">
                <div class="actions-cell" style="display: flex; justify-content: center; gap: 4px;">
                    <button class="btn-table-action btn-edit-action" onclick="window.prepararAjuste('${m._id}', '${m.nombre}', ${stockActual}, ${stockMinimo})"><i class="fas fa-sliders-h"></i></button>
                    <button class="btn-table-action btn-history-action" onclick="window.verHistorial('${m._id}', '${m.nombre}')"><i class="fas fa-history"></i></button>
                    <button class="btn-table-action btn-delete-action" onclick="window.eliminarMaterial('${m._id}')"><i class="fas fa-trash"></i></button>
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
    document.getElementById('provForm')?.addEventListener('submit', window.guardarProveedor);
    document.getElementById('purchaseForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const nombreMat = document.getElementById('nombreMaterial').value;
        const data = {
            nombre: nombreMat.trim(),
            tipo: (nombreMat.toLowerCase().includes('marco') || nombreMat.toLowerCase().includes('moldura')) ? 'ml' : 'm2',
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
        if (res.success) { window.cerrarModales(); await fetchInventory(); }
    });
}

window.verHistorial = async function(id, nombre) {
    try {
        const result = await window.API.getHistory(id);
        const modal = document.getElementById('modalHistorialPrecios');
        const contenedor = document.getElementById('listaHistorialPrecios');
        const labelNombre = document.getElementById('historialMaterialNombre');
        if (labelNombre) labelNombre.innerText = nombre;
        const data = result.success ? result.data : (Array.isArray(result) ? result : []);
        if (Array.isArray(data) && data.length > 0) {
            const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
            contenedor.innerHTML = data.map(h => `
                <div class="history-item" style="padding: 10px; font-size: 0.8rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items:center;">
                    <div><strong>${h.proveedor?.nombre || 'Movimiento'}</strong><div style="font-size: 0.7rem; color: #94a3b8;">${new Date(h.fecha || h.createdAt).toLocaleString()}</div></div>
                    <div style="text-align: right;"><span style="font-weight: bold; color: ${h.tipo === 'COMPRA' ? '#10b981' : '#f43f5e'};">${formatter.format(h.costo_unitario || 0)}</span></div>
                </div>`).join('');
        } else { contenedor.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Sin movimientos.</div>`; }
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

window.cerrarModales = function() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); };

window.prepararAjuste = function(id, nombre, stockActual, stockMinimo) {
    if(document.getElementById('adjustId')) document.getElementById('adjustId').value = id;
    if(document.getElementById('adjustMaterialNombre')) document.getElementById('adjustMaterialNombre').innerText = nombre;
    if(document.getElementById('adjustCantidad')) document.getElementById('adjustCantidad').value = stockActual;
    if(document.getElementById('adjustReorden')) document.getElementById('adjustReorden').value = stockMinimo;
    const modal = document.getElementById('modalAjuste');
    if(modal) modal.style.setProperty('display', 'flex', 'important');
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

// SENSOR DE CLIC REFORZADO PARA RE-RENDERIZAR
document.addEventListener('click', (e) => {
    if (e.target.closest('[onclick*="abrirAgenda"]')) {
        setTimeout(() => { window.renderAgendaProveedores(); }, 300);
    }
});