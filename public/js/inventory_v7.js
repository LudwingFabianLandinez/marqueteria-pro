/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Versión: 9.7.0 - FIX QUIRÚRGICO: COMPRAS Y PROTECCIÓN TOTAL
 */

// 1. VARIABLES GLOBALES
window.todosLosMateriales = [];
window.todosLosProveedores = [];

// 2. INICIO DEL SISTEMA
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

// --- SECCIÓN PROVEEDORES (Directorio Lateral y Registro) ---

async function fetchProviders() {
    try {
        const resultado = await window.API.getProviders();
        const listaBruta = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []); 
        
        if (Array.isArray(listaBruta)) {
            // Ordenamos y limpiamos
            window.todosLosProveedores = listaBruta
                .filter(p => p !== null)
                .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            
            localStorage.setItem('providers', JSON.stringify(window.todosLosProveedores));
            
            actualizarSelectProveedores();
            window.cargarListasModal();

            const directorio = document.getElementById('directorioProveedores');
            if (directorio) {
                directorio.innerHTML = ''; 
                if (window.todosLosProveedores.length === 0) {
                    directorio.innerHTML = '<p style="text-align:center; padding:15px; color:#94a3b8; font-size:0.8rem;">Sin proveedores registrados.</p>';
                } else {
                    directorio.innerHTML = window.todosLosProveedores.map(p => `
                        <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            <div style="overflow: hidden;">
                                <div style="font-weight: bold; color: #1e293b; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.nombre || 'S/N'}</div>
                                <div style="font-size: 0.7rem; color: #64748b;">${p.telefono || 'Sin Tel.'}</div>
                                <div style="font-size: 0.6rem; color: #94a3b8;">${p.categoria || 'General'}</div>
                            </div>
                            <a href="tel:${p.telefono}" style="background: #3498db; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-decoration: none; flex-shrink: 0;">
                                <i class="fas fa-phone-alt" style="font-size: 0.7rem;"></i>
                            </a>
                        </div>
                    `).join('');
                }
            }
            console.log("✅ Lista lateral actualizada");
        }
    } catch (error) { console.error("❌ Error proveedores:", error); }
}

window.guardarProveedor = async function(event) {
    if(event) event.preventDefault();
    
    const payload = {
        nombre: document.getElementById('provNombre')?.value.trim() || "",
        nit: document.getElementById('provNit')?.value.trim() || "",
        contacto: document.getElementById('provContacto')?.value.trim() || "",
        telefono: document.getElementById('provTelefono')?.value.trim() || "",
        email: document.getElementById('provEmail')?.value.trim() || "",
        direccion: document.getElementById('provDireccion')?.value.trim() || "",
        categoria: document.getElementById('provCategoria')?.value || "General"
    };
    
    if (!payload.nombre) return alert("El nombre es obligatorio");
    
    try {
        const res = await window.API.saveProvider(payload);
        if (res.success) {
            alert("✅ Proveedor guardado");
            document.getElementById('provForm')?.reset();
            window.cerrarModales();
            await fetchProviders(); 
        } else {
            alert("❌ Error: " + (res.message || "No se pudo guardar (Estado 400)"));
        }
    } catch (error) { 
        console.error("Error al guardar:", error); 
        alert("❌ Error de conexión al guardar");
    }
};

// --- SECCIÓN INVENTARIO ---

async function fetchInventory() {
    try {
        const resultado = await window.API.getInventory();
        const datos = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []);
        
        window.todosLosMateriales = datos.map(m => {
            const stockReal = m.stock_actual_m2 ?? m.stock_actual ?? 0;
            const stockMin = m.stock_minimo_m2 ?? m.stock_minimo ?? 2;
            const precioCosto = m.precio_m2_costo ?? m.precio_total_lamina ?? 0;

            return {
                ...m,
                id: m._id,
                nombre: m.nombre || "Sin nombre",
                categoria: m.categoria || "General",
                proveedorNombre: m.proveedor?.nombre || "Sin proveedor",
                stock_actual: Number(stockReal), 
                precio_m2_costo: Number(precioCosto),
                stock_minimo: Number(stockMin)
            };
        });
        
        localStorage.setItem('inventory', JSON.stringify(window.todosLosMateriales));
        renderTable(window.todosLosMateriales);
        actualizarDatalistMateriales();
        window.cargarListasModal();
        console.log("📦 Inventario cargado");
    } catch (error) { console.error("❌ Error inventario:", error); }
}

function renderTable(materiales) {
    const cuerpoTabla = document.getElementById('inventoryTable');
    if (!cuerpoTabla) return;
    cuerpoTabla.innerHTML = '';
    
    const formateador = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    
    materiales.forEach(m => {
        const fila = document.createElement('tr');
        const stockActual = m.stock_actual || 0;
        const stockMinimo = m.stock_minimo || 2;
        const tipoUnidad = m.tipo === 'ml' ? 'ml' : 'm²';
        let colorStock = stockActual <= 0 ? '#ef4444' : (stockActual <= stockMinimo ? '#f59e0b' : '#059669');
        
        fila.innerHTML = `
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
                ${formateador.format(m.precio_m2_costo || 0)} <span style="font-size:0.6rem">/${tipoUnidad}</span>
            </td>
            <td style="text-align: center; padding: 8px;">
                <div style="background: #fff; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block; min-width: 100px;">
                    <div style="font-weight: 700; color: ${colorStock}; font-size: 0.95rem;">${stockActual.toFixed(2)} ${tipoUnidad}</div>
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
        cuerpoTabla.appendChild(fila);
    });
}

// --- LÓGICA DE CARGA PARA EL MODAL DE COMPRA ---

window.cargarListasModal = function() {
    const provSelect = document.getElementById('compraProveedor') || document.getElementById('proveedorSelect');
    const matSelect = document.getElementById('compraMaterial');

    if (provSelect) {
        provSelect.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' + 
            window.todosLosProveedores.map(p => {
                // BLINDAJE QUIRÚRGICO contra toUpperCase de null
                const nombreSeguro = p && p.nombre ? String(p.nombre).toUpperCase() : "PROVEEDOR SIN NOMBRE";
                return `<option value="${p._id || ''}">${nombreSeguro}</option>`;
            }).join('');
    }

    if (matSelect) {
        matSelect.innerHTML = '<option value="">-- Seleccionar Material --</option>' + 
            window.todosLosMateriales.map(m => `<option value="${m._id}">${m.nombre}</option>`).join('');
    }
};

// --- EVENTOS Y UTILIDADES ---

function configurarEventos() {
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        renderTable(window.todosLosMateriales.filter(m => m.nombre.toLowerCase().includes(termino)));
    });

    document.getElementById('provForm')?.addEventListener('submit', window.guardarProveedor);

    // FIX COMPRA: Detección robusta de formulario
    const formCompra = document.getElementById('formNuevaCompra') || document.getElementById('purchaseForm') || document.querySelector('form[id*="Compra"]');
    
    if (formCompra) {
        formCompra.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            if(btn) btn.disabled = true;

            // Captura de datos con IDs alternativos para máxima compatibilidad
            const materialId = document.getElementById('compraMaterial')?.value;
            const providerId = document.getElementById('compraProveedor')?.value || document.getElementById('proveedorSelect')?.value;
            const largo = parseFloat(document.getElementById('compraLargo')?.value) || 0;
            const ancho = parseFloat(document.getElementById('compraAncho')?.value) || 0;
            const cant = parseFloat(document.getElementById('compraCantidad')?.value) || 0;
            const costoTotal = parseFloat(document.getElementById('compraCosto')?.value) || 0;
            
            if(!materialId || !providerId) {
                alert("Selecciona material y proveedor");
                if(btn) btn.disabled = false;
                return;
            }

            const m2Calculados = ((largo * ancho) / 10000) * cant;

            // OBJETO REESTRUCTURADO (Sabiduría Quirúrgica para evitar Error 400)
            const objetoCompra = {
                materialId: materialId,
                proveedorId: providerId,
                cantidad_m2: Number(m2Calculados.toFixed(4)),
                precio_total: Number(costoTotal),
                detalles: {
                    largo_cm: largo,
                    ancho_cm: ancho,
                    cantidad_laminas: cant
                },
                fecha: new Date().toISOString()
            };

            try {
                const res = await window.API.registerPurchase(objetoCompra);
                if (res.success) { 
                    window.cerrarModales(); 
                    await fetchInventory(); 
                    e.target.reset(); 
                    alert("✅ Compra registrada con éxito");
                } else {
                    alert("❌ Error del Servidor: " + (res.message || "Datos incompatibles (400)"));
                }
            } catch (err) { 
                console.error("Error en Fetch Compra:", err);
                alert("❌ Error de conexión: El servidor no respondió"); 
            } finally { 
                if(btn) btn.disabled = false; 
            }
        });
    }

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
        const resultado = await window.API.getHistory(id);
        const modal = document.getElementById('modalHistorialPrecios');
        const contenedorHistorial = document.getElementById('listaHistorialPrecios');
        const etiquetaNombre = document.getElementById('historialMaterialNombre');
        
        if (etiquetaNombre) etiquetaNombre.innerText = nombre;
        const datos = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []);
        
        if (Array.isArray(datos) && datos.length > 0) {
            const formateador = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
            contenedorHistorial.innerHTML = datos.map(h => `
                <div class="history-item" style="padding: 10px; font-size: 0.8rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items:center;">
                    <div><strong>${h.proveedor?.nombre || 'Movimiento'}</strong><div style="font-size: 0.7rem; color: #94a3b8;">${new Date(h.fecha || h.createdAt).toLocaleString()}</div></div>
                    <div style="text-align: right;"><span style="font-weight: bold; color: ${h.tipo === 'COMPRA' ? '#10b981' : '#f43f5e'};">${formateador.format(h.costo_unitario || h.precio_total || 0)}</span></div>
                </div>`).join('');
        } else { contenedorHistorial.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Sin movimientos.</div>`; }
        
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
    const modal = document.getElementById('modalAjuste');
    if(modal) modal.style.setProperty('display', 'flex', 'important');
};

function actualizarSelectProveedores() {
    const select = document.getElementById('proveedorSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' + 
            window.todosLosProveedores.map(p => `<option value="${p._id}">${p.nombre || 'S/N'}</option>`).join('');
    }
}

function actualizarDatalistMateriales() {
    const lista = document.getElementById('listaMateriales');
    if (lista) lista.innerHTML = window.todosLosMateriales.map(m => `<option value="${m.nombre}">`).join('');
}