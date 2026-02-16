/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Versión: 12.6.0 - UI: Consolidación Definitiva de Cálculos
 * Respetando estructura visual y blindaje de datos v12.1.7 / v12.5.0
 */

// 1. VARIABLES GLOBALES
window.todosLosMateriales = [];
window.todosLosProveedores = [];

// 2. INICIO DEL SISTEMA
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Sistema Iniciado - v12.6.0");
    fetchInventory();
    fetchProviders(); 
    configurarEventos();
});

window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

// --- SECCIÓN PROVEEDORES ---

async function fetchProviders() {
    try {
        const resultado = await window.API.getProviders();
        const listaBruta = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []); 
        
        if (Array.isArray(listaBruta)) {
            window.todosLosProveedores = listaBruta
                .filter(p => p !== null && typeof p === 'object')
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
                    directorio.innerHTML = window.todosLosProveedores.map(p => {
                        const nombreSeguro = String(p.nombre || 'S/N').toUpperCase();
                        return `
                        <div class="provider-card">
                            <h4>${nombreSeguro}</h4>
                            <div class="provider-detail"><strong>NIT:</strong> ${p.nit || 'N/A'}</div>
                            <div class="provider-detail"><strong>Tel:</strong> ${p.telefono || 'Sin Tel.'}</div>
                            <div class="provider-detail"><strong>Cont:</strong> ${p.contacto || 'N/A'}</div>
                            <span class="cat-tag">${p.categoria || 'General'}</span>
                        </div>
                    `}).join('');
                }
            }
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
            alert("❌ Error: " + (res.message || "No se pudo guardar"));
        }
    } catch (error) { alert("❌ Error de conexión"); }
};

// --- SECCIÓN INVENTARIO ---

async function fetchInventory() {
    try {
        const resultado = await window.API.getInventory();
        const datos = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []);
        
        window.todosLosMateriales = datos.map(m => {
            return {
                ...m,
                id: m._id || m.id,
                nombre: m.nombre || "Sin nombre",
                categoria: m.categoria || "General",
                proveedorNombre: m.proveedor?.nombre || "Sin proveedor",
                stock_actual: Number(m.stock_actual ?? 0), 
                precio_m2_costo: Number(m.precio_m2_costo ?? 0),
                precio_total_lamina: Number(m.precio_total_lamina ?? 0),
                ancho_lamina_cm: Number(m.ancho_lamina_cm ?? 0),
                largo_lamina_cm: Number(m.largo_lamina_cm ?? 0),
                stock_minimo: Number(m.stock_minimo ?? 2)
            };
        });
        
        localStorage.setItem('inventory', JSON.stringify(window.todosLosMateriales));
        renderTable(window.todosLosMateriales);
        actualizarDatalistMateriales();
        window.cargarListasModal();
    } catch (error) { console.error("❌ Error inventario:", error); }
}

function renderTable(materiales) {
    const cuerpoTabla = document.getElementById('inventoryTable');
    if (!cuerpoTabla) return;
    cuerpoTabla.innerHTML = '';
    
    const formateador = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    
    materiales.forEach(m => {
        const fila = document.createElement('tr');
        const stockActualM2 = m.stock_actual || 0;
        const stockMinimo = m.stock_minimo || 2;
        const tipoUnidad = m.tipo === 'ml' ? 'ml' : 'm²';
        
        // --- BLINDAJE MATEMÁTICO ABSOLUTO (v12.6.0) ---
        const anchoMetros = m.ancho_lamina_cm / 100;
        const largoMetros = m.largo_lamina_cm / 100;
        const areaUnaLaminaM2 = anchoMetros * largoMetros;
        
        let costoMostrar = 0;
        if (m.tipo !== 'ml' && areaUnaLaminaM2 > 0) {
            // FORZAMOS: Precio de 1 lámina / Área de 1 lámina. 
            // Ignoramos lo que diga el servidor sobre el precio_m2_costo.
            costoMostrar = m.precio_total_lamina / areaUnaLaminaM2;
        } else {
            costoMostrar = m.precio_m2_costo || 0;
        }

        let colorStock = stockActualM2 <= 0 ? '#ef4444' : (stockActualM2 <= stockMinimo ? '#f59e0b' : '#059669');
        let textoStockVisual = `<strong>${stockActualM2.toFixed(2)}</strong> ${tipoUnidad}`;
        
        if (m.tipo !== 'ml' && areaUnaLaminaM2 > 0) {
            const laminasExactas = stockActualM2 / areaUnaLaminaM2;
            const laminasCompletas = Math.floor(laminasExactas + 0.0001); 
            let sobranteM2 = stockActualM2 - (laminasCompletas * areaUnaLaminaM2);
            if (sobranteM2 < 0.001) sobranteM2 = 0;

            let desglose = laminasCompletas > 0 
                ? `(${laminasCompletas} und + ${sobranteM2.toFixed(2)} m²)` 
                : `(${sobranteM2.toFixed(2)} m²)`;
            
            textoStockVisual = `
                <div style="font-weight: 700; font-size: 0.95rem;">${stockActualM2.toFixed(2)} ${tipoUnidad}</div>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">${desglose}</div>
            `;
        }

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
            <td style="text-align: center; font-weight: 700; font-size: 0.85rem; color: #1e293b;">
                ${formateador.format(costoMostrar)} <span style="font-size:0.6rem; font-weight:400;">/${tipoUnidad}</span>
            </td>
            <td style="text-align: center; padding: 8px;">
                <div style="background: #fff; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; min-width: 145px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); color: ${colorStock};">
                    ${textoStockVisual}
                </div>
            </td>
            <td style="text-align: center;">
                <div class="actions-cell" style="display: flex; justify-content: center; gap: 4px;">
                    <button class="btn-table-action" onclick="window.prepararEdicionMaterial('${m.id}')" title="Editar Material"><i class="fas fa-edit"></i></button>
                    <button class="btn-table-action btn-edit-action" onclick="window.prepararAjuste('${m.id}', '${m.nombre}', ${stockActualM2}, ${stockMinimo})" title="Ajustar Stock"><i class="fas fa-sliders-h"></i></button>
                    <button class="btn-table-action btn-history-action" onclick="window.verHistorial('${m.id}', '${m.nombre}')"><i class="fas fa-history"></i></button>
                    <button class="btn-table-action btn-delete-action" onclick="window.eliminarMaterial('${m.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        cuerpoTabla.appendChild(fila);
    });
}

// --- EVENTOS Y CONFIGURACIÓN ---

function configurarEventos() {
    document.getElementById('matForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            id: document.getElementById('matId')?.value,
            nombre: document.getElementById('matNombre').value,
            categoria: document.getElementById('matCategoria').value,
            precio_total_lamina: parseFloat(document.getElementById('matCosto').value) || 0,
            stock_minimo: parseFloat(document.getElementById('matStockMin').value) || 2,
            proveedorId: document.getElementById('proveedorSelect').value
        };
        try {
            const res = await window.API.saveMaterial(payload);
            if(res.success) {
                window.cerrarModales();
                await fetchInventory();
                alert("✅ Material guardado correctamente");
            }
        } catch(err) { alert("❌ Error al guardar"); }
    });

    const formCompra = document.getElementById('formNuevaCompra') || document.getElementById('purchaseForm');
    if (formCompra) {
        formCompra.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            if(btn) btn.disabled = true;

            let materialId = document.getElementById('compraMaterial')?.value;
            const providerId = document.getElementById('compraProveedor')?.value; 
            const nuevoNombre = document.getElementById('nombreNuevoMaterial')?.value?.trim();
            const largo = parseFloat(document.getElementById('compraLargo')?.value) || 0;
            const ancho = parseFloat(document.getElementById('compraAncho')?.value) || 0;
            const cant = parseFloat(document.getElementById('compraCantidad')?.value) || 1; 
            const costoFacturaTotal = parseFloat(document.getElementById('compraCosto')?.value) || 0;
            
            if(!materialId || !providerId) {
                alert("⚠️ Selecciona material y proveedor");
                if(btn) btn.disabled = false;
                return;
            }

            const areaUnaLamina = (largo * ancho) / 10000;
            const totalStockM2AAgregar = areaUnaLamina * cant;
            const costoIndividualLamina = costoFacturaTotal / cant;

            if (materialId === "NUEVO") {
                if (!nuevoNombre) {
                    alert("⚠️ Escribe el nombre del nuevo material");
                    if(btn) btn.disabled = false;
                    return;
                }
                try {
                    const resMat = await window.API.saveMaterial({
                        nombre: nuevoNombre,
                        categoria: "General",
                        proveedorId: providerId,
                        ancho_lamina_cm: ancho,
                        largo_lamina_cm: largo,
                        precio_total_lamina: costoIndividualLamina 
                    });
                    if (resMat.success) {
                        materialId = resMat.data._id || resMat.data.id;
                    } else { throw new Error("Error al crear el material base"); }
                } catch (err) {
                    alert("❌ Error: " + err.message);
                    if(btn) btn.disabled = false;
                    return;
                }
            }

            const objetoCompra = {
                materialId: materialId,
                proveedorId: providerId,
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                cantidad_laminas: cant,
                cantidad: totalStockM2AAgregar, 
                precio_total_lamina: costoIndividualLamina, 
                costo_total: costoFacturaTotal,
                tipo_material: 'm2'
            };

            try {
                const res = await window.API.registerPurchase(objetoCompra);
                if (res.success) { 
                    window.cerrarModales(); 
                    await fetchInventory(); 
                    e.target.reset(); 
                    alert(`✅ Compra exitosa: ${cant} láminas agregadas.`);
                } else {
                    alert("❌ Error Servidor: " + (res.message || "Error de validación"));
                }
            } catch (err) { 
                alert("❌ Error de comunicación."); 
            } finally { if(btn) btn.disabled = false; }
        });
    }

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        renderTable(window.todosLosMateriales.filter(m => m.nombre.toLowerCase().includes(termino)));
    });

    document.getElementById('provForm')?.addEventListener('submit', window.guardarProveedor);
}

// --- UTILIDADES DE UI ---

window.cargarListasModal = function() {
    const provSelect = document.getElementById('compraProveedor');
    const matSelect = document.getElementById('compraMaterial');
    const provRegisterSelect = document.getElementById('proveedorSelect');
    const opcionesProv = '<option value="">-- Seleccionar Proveedor --</option>' + window.todosLosProveedores.map(p => `<option value="${p._id || p.id}">${String(p.nombre || 'S/N').toUpperCase()}</option>`).join('');
    if (provSelect) provSelect.innerHTML = opcionesProv;
    if (provRegisterSelect) provRegisterSelect.innerHTML = opcionesProv;
    if (matSelect) {
        let opcionesMat = '<option value="">-- Seleccionar Material --</option><option value="NUEVO" style="color: #3182ce; font-weight: bold;">+ AGREGAR NUEVO MATERIAL</option>' + window.todosLosMateriales.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
        matSelect.innerHTML = opcionesMat;
    }
};

window.cerrarModales = function() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); };

window.verHistorial = async function(id, nombre) {
    try {
        const resultado = await window.API.getHistory(id);
        const modal = document.getElementById('modalHistorialPrecios');
        const contenedorHistorial = document.getElementById('listaHistorialPrecios');
        if (document.getElementById('historialMaterialNombre')) document.getElementById('historialMaterialNombre').innerText = nombre;
        const datos = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []);
        if (Array.isArray(datos) && datos.length > 0) {
            const formateador = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
            contenedorHistorial.innerHTML = datos.map(h => `
                <div class="history-item" style="padding: 10px; font-size: 0.8rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between;">
                    <div><strong>${h.proveedor?.nombre || 'Movimiento'}</strong><div style="font-size: 0.7rem; color: #94a3b8;">${new Date(h.fecha || h.createdAt).toLocaleString()}</div></div>
                    <div><span style="font-weight: bold; color: #10b981;">${formateador.format(h.costo_unitario || h.costo_total || 0)}</span></div>
                </div>`).join('');
        } else { contenedorHistorial.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">Sin movimientos.</div>`; }
        if (modal) modal.style.display = 'block';
    } catch (error) { console.error("Error historial:", error); }
};

window.eliminarMaterial = async function(id) {
    if (confirm("⚠️ ¿Estás seguro de eliminar este material?")) {
        try {
            const res = await window.API.deleteMaterial(id);
            if (res.success) await fetchInventory();
        } catch (error) { console.error("Error:", error); }
    }
};

window.prepararAjuste = function(id, nombre, stockActual, stockMinimo) {
    if(document.getElementById('adjustId')) document.getElementById('adjustId').value = id;
    if(document.getElementById('adjustMaterialNombre')) document.getElementById('adjustMaterialNombre').innerText = nombre;
    if(document.getElementById('adjustCantidad')) document.getElementById('adjustCantidad').value = stockActual;
    if(document.getElementById('adjustReorden')) document.getElementById('adjustReorden').value = stockMinimo;
    const modal = document.getElementById('modalAjuste');
    if(modal) modal.style.display = 'flex';
};

window.prepararEdicionMaterial = function(id) {
    const m = window.todosLosMateriales.find(mat => mat.id === id);
    if (!m) return;
    if(document.getElementById('matId')) document.getElementById('matId').value = m.id;
    if(document.getElementById('matNombre')) document.getElementById('matNombre').value = m.nombre;
    if(document.getElementById('matCategoria')) document.getElementById('matCategoria').value = m.categoria;
    // Forzamos que edites el precio de LA LÁMINA ($108.000)
    if(document.getElementById('matCosto')) document.getElementById('matCosto').value = m.precio_total_lamina;
    if(document.getElementById('matStockMin')) document.getElementById('matStockMin').value = m.stock_minimo;
    if(document.getElementById('proveedorSelect')) document.getElementById('proveedorSelect').value = m.proveedorId || m.proveedor?._id || "";
    const modal = document.getElementById('modalNuevoMaterial');
    if(modal) modal.style.display = 'flex';
};

function actualizarSelectProveedores() {
    const select = document.getElementById('proveedorSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' + 
            window.todosLosProveedores.map(p => `<option value="${p._id || p.id}">${p.nombre || 'S/N'}</option>`).join('');
    }
}

function actualizarDatalistMateriales() {
    const lista = document.getElementById('listaMateriales');
    if (lista) lista.innerHTML = window.todosLosMateriales.map(m => `<option value="${m.nombre}">`).join('');
}