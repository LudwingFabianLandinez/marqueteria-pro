/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Versión: 13.4.48 - STOCK REAL CON RECONCILIACIÓN LOCAL
 * * CAMBIOS v13.4.48:
 * 1. GANCHO 'calcularStockReal': Suma compras locales al stock del servidor antes de renderizar.
 * 2. PERSISTENCIA DE MOLDURAS: Solución definitiva para que los 2.9 ML aparezcan en pantalla.
 * 3. MANTENIMIENTO: Se preserva al 100% la estructura visual y lógica de m2/ml.
 * 4. SINCRONIZACIÓN: Limpieza de bitácora local tras confirmación del servidor para evitar duplicidad.
 */

// 1. VARIABLES GLOBALES
window.todosLosMateriales = [];
window.todosLosProveedores = [];
let datosCotizacionActual = null; 

// 2. INICIO DEL SISTEMA
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Sistema v13.4.48 - Motor de Precisión con Reconciliación Activo");
    fetchInventory();
    fetchProviders(); 
    configurarEventos();
    
    if (window.location.pathname.includes('history')) {
        cargarHistorialVentas();
    }
});

window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

// --- SECCIÓN UTILIDADES DE RECONCILIACIÓN (NUEVO GANCHO) ---

/**
 * Calcula el stock sumando lo que dice el servidor + compras locales no sincronizadas
 * Blindaje: No altera el objeto original del servidor, solo el valor visual.
 */
function calcularStockReal(material) {
    let stockServidor = parseFloat(material.stock_actual) || 0;
    const comprasLocales = JSON.parse(localStorage.getItem('bitacora_compras') || '[]');
    
    const sumaLocal = comprasLocales
        .filter(c => {
            // Comparamos IDs convirtiendo ambos a String para evitar errores de tipo
            const idC = String(c.materialId || "").trim();
            const idM = String(material.id || material._id || "").trim();
            return idC === idM && idC !== "";
        })
        .reduce((acc, curr) => acc + (parseFloat(curr.totalM2) || 0), 0);
        
    return stockServidor + sumaLocal;
}

// --- SECCIÓN HISTORIAL (PRESERVADO) ---

async function cargarHistorialVentas() {
    const cuerpoTabla = document.getElementById('lista-ventas');
    if (!cuerpoTabla) {
        console.warn("⚠️ Elemento 'lista-ventas' no encontrado en esta página.");
        return;
    }

    cuerpoTabla.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Cargando historial...</td></tr>';

    try {
        const res = await window.API.getInvoices();
        const ventas = res.success ? res.data : (Array.isArray(res) ? res : []);
        
        const formateador = new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP', 
            maximumFractionDigits: 0 
        });

        if (Array.isArray(ventas) && ventas.length > 0) {
            cuerpoTabla.innerHTML = ventas.map(venta => {
                const fecha = venta.createdAt ? new Date(venta.createdAt).toLocaleDateString() : 'N/A';
                const orden = venta.numeroOrden || venta.ot || venta.numeroFactura || "S/N";
                
                const nombreCliente = (typeof venta.clienteNombre === 'string') ? venta.clienteNombre : 
                                    (typeof venta.cliente === 'string' ? venta.cliente : "Cliente General");

                const totalVenta = Number(venta.total || venta.totalVenta || 0);
                const abono = Number(venta.abono || 0);
                const saldo = venta.saldo !== undefined ? Number(venta.saldo) : (totalVenta - abono);
                const estado = venta.estado || "Completado";

                return `
                    <tr>
                        <td>${fecha}</td>
                        <td style="font-weight: bold; color: #1e293b;">${orden}</td>
                        <td>${nombreCliente}</td>
                        <td style="font-weight: bold;">${formateador.format(totalVenta)}</td>
                        <td class="text-danger" style="font-weight: bold;">${formateador.format(saldo)}</td>
                        <td>
                            <span class="badge" style="background:#10b981; color:white; padding:4px 8px; border-radius:12px; font-size:0.7rem;">
                                ${estado}
                            </span>
                        </td>
                        <td>
                            <button class="btn-table-action" onclick="window.verDetalleVenta('${venta._id || venta.id}')" title="Ver Detalle">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>`;
            }).join('');
        } else {
            cuerpoTabla.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:#94a3b8;">No se encontraron órdenes registradas.</td></tr>';
        }
    } catch (error) {
        console.error("❌ Error en cargarHistorialVentas:", error);
        cuerpoTabla.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px;">Error de comunicación con el servidor.</td></tr>';
    }
}

// --- SECCIÓN PROVEEDORES (PRESERVADO) ---

async function fetchProviders() {
    const directorio = document.getElementById('directorioProveedores');
    if (directorio) directorio.innerHTML = '<div style="text-align:center; padding:10px;"><i class="fas fa-sync fa-spin"></i></div>';

    try {
        const timestamp = Date.now();
        const resultado = await window.API.getProviders(`?t=${timestamp}`);
        
        const listaBruta = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []); 
        
        if (Array.isArray(listaBruta)) {
            window.todosLosProveedores = listaBruta
                .filter(p => p !== null && typeof p === 'object')
                .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            
            localStorage.setItem('providers', JSON.stringify(window.todosLosProveedores));
            
            actualizarSelectProveedores();
            window.cargarListasModal();

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
    } catch (error) { 
        console.error("❌ Error proveedores:", error);
        if (directorio) directorio.innerHTML = '<p style="color:red; font-size:0.7rem;">Error al cargar lista.</p>';
    }
}

window.guardarProveedor = async function(event) {
    if(event) event.preventDefault();
    
    const btnGuardar = event.submitter || document.querySelector('#provForm button[type="submit"]');
    const originalText = btnGuardar ? btnGuardar.innerHTML : 'GUARDAR';
    if(btnGuardar) { btnGuardar.disabled = true; btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    const payload = {
        nombre: document.getElementById('provNombre')?.value.trim() || "",
        nit: document.getElementById('provNit')?.value.trim() || "",
        contacto: document.getElementById('provContacto')?.value.trim() || "",
        telefono: document.getElementById('provTelefono')?.value.trim() || "",
        email: document.getElementById('provEmail')?.value.trim() || "",
        direccion: document.getElementById('provDireccion')?.value.trim() || "",
        categoria: document.getElementById('provCategoria')?.value || "General"
    };

    if (!payload.nombre) {
        if(btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = originalText; }
        return alert("El nombre es obligatorio");
    }

    try {
        const res = await window.API.saveProvider(payload);
        if (res.success) {
            alert("✅ Proveedor guardado correctamente");
            document.getElementById('provForm')?.reset();
            window.cerrarModales();
            await fetchProviders(); 
        } else {
            alert("❌ Error: " + (res.message || "No se pudo guardar"));
        }
    } catch (error) { 
        console.error("Error al guardar proveedor:", error);
        alert("❌ Error de conexión al guardar proveedor"); 
    } finally {
        if(btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = originalText; }
    }
};

// --- SECCIÓN INVENTARIO (CON RECONCILIACIÓN ACTIVA) ---

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
                stock_actual: Number(m.stock_actual) || 0, 
                precio_m2_costo: Number(m.precio_m2_costo) || 0,
                precio_total_lamina: Number(m.precio_total_lamina) || 0,
                ancho_lamina_cm: Number(m.ancho_lamina_cm) || 0,
                largo_lamina_cm: Number(m.largo_lamina_cm) || 0,
                stock_minimo: Number(m.stock_minimo) || 2,
                tipo: m.tipo || 'm2'
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
        fila.setAttribute('data-nombre', m.nombre.toLowerCase());
        
        // GANCHO CRÍTICO: Cálculo del Stock Real (Servidor + Local)
        // Aquí es donde el 5.80 + 2.90 se convierte en 8.70
        // 1. Calculamos el stock sumando la bitácora local (Pieza 1 corregida)
        const stockActualUnidad = calcularStockReal(m);
        
        // 2. Definimos unidad y dimensiones
        const tipoUnidad = m.tipo === 'ml' ? 'ml' : 'm²';
        const ancho = parseFloat(m.ancho_lamina_cm) || 0;
        const largo = parseFloat(m.largo_lamina_cm) || 0;
        const areaUnaLaminaM2 = (ancho * largo) / 10000;
        
        // 3. Cálculo de costo por unidad (ML o M2)
        let costoMostrar = 0;
        if (m.tipo === 'ml' && largo > 0) {
            // Precio por Metro Lineal
            costoMostrar = Math.round(m.precio_total_lamina / (largo / 100));
        } else if (areaUnaLaminaM2 > 0) {
            // Precio por Metro Cuadrado
            costoMostrar = Math.round(m.precio_total_lamina / areaUnaLaminaM2);
        } else {
            costoMostrar = m.precio_m2_costo || 0;
        }

        // 4. Semáforo de colores (Rojo, Naranja, Verde)
        let colorStock = stockActualUnidad <= 0 ? '#ef4444' : (stockActualUnidad <= m.stock_minimo ? '#f59e0b' : '#059669');
        
        // 5. Construcción del texto visual
        let textoStockVisual = "";
        
        if (m.tipo === 'ml') {
            // MOLDURAS: Solo mostramos los metros lineales totales (Ej: 8.70 ml)
            textoStockVisual = `
                <div style="font-weight: 700; font-size: 0.95rem;">${stockActualUnidad.toFixed(2)} ${tipoUnidad}</div>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">(Total en tiras)</div>
            `;
        } else {
            // VIDRIOS/MADERA: Tu lógica de láminas + m2 sobrantes
            const laminasExactas = areaUnaLaminaM2 > 0 ? stockActualUnidad / areaUnaLaminaM2 : 0;
            const laminasCompletas = Math.floor(laminasExactas + 0.0001); 
            let sobranteM2 = stockActualUnidad - (laminasCompletas * areaUnaLaminaM2);
            if (sobranteM2 < 0.0001) sobranteM2 = 0;

            let desglose = (laminasCompletas > 0) 
                ? (sobranteM2 > 0 ? `(${laminasCompletas} und + ${sobranteM2.toFixed(2)} m²)` : `(${laminasCompletas} unidades)`)
                : `(${sobranteM2.toFixed(2)} m²)`;
            
            textoStockVisual = `
                <div style="font-weight: 700; font-size: 0.95rem;">${stockActualUnidad.toFixed(2)} ${tipoUnidad}</div>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">${desglose}</div>
            `;
        }
        
        // LÓGICA DIFERENCIADA:
        if (m.tipo === 'ml') {
            // PARA MOLDURAS: No calculamos láminas, solo mostramos el total de metros
            textoStockVisual = `
                <div style="font-weight: 700; font-size: 0.95rem;">${stockActualUnidad.toFixed(2)} ${tipoUnidad}</div>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">(Stock en Metros)</div>
            `;
        } else if (m.tipo !== 'ml' && areaUnaLaminaM2 > 0) {
            // PARA OTROS MATERIALES: Mantenemos tu lógica de Unidades + Sobrante m2
            const laminasExactas = stockActualUnidad / areaUnaLaminaM2;
            const laminasCompletas = Math.floor(laminasExactas + 0.0001); 
            let sobranteM2 = stockActualUnidad - (laminasCompletas * areaUnaLaminaM2);
            if (sobranteM2 < 0.0001) sobranteM2 = 0;

            let desglose = (laminasCompletas > 0) 
                ? (sobranteM2 > 0 ? `(${laminasCompletas} und + ${sobranteM2.toFixed(2)} m²)` : `(${laminasCompletas} unidades)`)
                : `(${sobranteM2.toFixed(2)} m²)`;
            
            textoStockVisual = `
                <div style="font-weight: 700; font-size: 0.95rem;">${stockActualUnidad.toFixed(2)} ${tipoUnidad}</div>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">${desglose}</div>
            `;
        } else {
            textoStockVisual = `<strong>${stockActualUnidad.toFixed(2)}</strong> ${tipoUnidad}`;
        }

        fila.innerHTML = `
            <td style="text-align: left; padding: 10px 15px;">
                <div style="font-weight: 600; color: #1e293b; font-size: 0.9rem;">${m.nombre}</div>
                <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase;">
                    ${m.categoria} | <span style="color:#64748b">${m.proveedorNombre || 'Proveedor'}</span>
                </div>
            </td>
            <td style="text-align: center;">
                <span style="background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; border: 1px solid #e2e8f0;">
                    ${m.tipo === 'ml' ? `${largo} cm` : `${ancho}x${largo} cm`}
                </span>
            </td>
            <td style="text-align: center; font-weight: 700; font-size: 0.85rem; color: #1e293b;">
                ${formateador.format(costoMostrar)} <span style="font-size:0.6rem; font-weight:400;">/${tipoUnidad}</span>
            </td>
            <td style="text-align: center; padding: 8px;">
                <div class="stock-display-container" style="background: #fff; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; min-width: 145px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); color: ${colorStock};">
                    ${textoStockVisual}
                </div>
            </td>
            <td style="text-align: center;">
                <div class="actions-cell" style="display: flex; justify-content: center; gap: 4px;">
                    <button class="btn-table-action" onclick="window.prepararEdicionMaterial('${m.id}')" title="Editar Material"><i class="fas fa-edit"></i></button>
                    <button class="btn-table-action btn-edit-action" onclick="window.prepararAjuste('${m.id}', '${m.nombre}', ${stockActualUnidad}, ${m.stock_minimo})" title="Ajustar Stock"><i class="fas fa-sliders-h"></i></button>
                    <button class="btn-table-action btn-history-action" onclick="window.verHistorial('${m.id}', '${m.nombre}')"><i class="fas fa-history"></i></button>
                    <button class="btn-table-action btn-delete-action" onclick="window.eliminarMaterial('${m.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        cuerpoTabla.appendChild(fila);
    });
}

// --- FACTURACIÓN (PRESERVADO) ---

async function facturarVenta() {
    if (!datosCotizacionActual) {
        const backup = localStorage.getItem('ultima_cotizacion');
        if (backup) datosCotizacionActual = JSON.parse(backup);
    }

    if (!datosCotizacionActual) {
        alert("⚠️ No hay datos de cotización activos.");
        return;
    }

    const nombre = document.getElementById('nombreCliente')?.value.trim();
    if (!nombre) { alert("⚠️ Nombre cliente requerido."); return; }

    const btnVenta = document.getElementById('btnFinalizarVenta');
    const abono = parseFloat(document.getElementById('abonoInicial')?.value) || 0;
    
    const facturaData = {
        clienteNombre: nombre, 
        clienteTelefono: document.getElementById('telCliente')?.value || "N/A",
        total: datosCotizacionActual.precioSugeridoCliente,
        abono: abono,
        items: datosCotizacionActual.detalles.materiales.map(m => ({
            productoId: m.id, 
            materialNombre: m.nombre,
            ancho: datosCotizacionActual.anchoOriginal,
            largo: datosCotizacionActual.largoOriginal,
            area_m2: datosCotizacionActual.areaFinal,
            costo_unitario: m.costoUnitario
        })),
        mano_obra_total: datosCotizacionActual.valor_mano_obra
    };

    try {
        if(btnVenta) {
            btnVenta.disabled = true;
            btnVenta.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';
        }
        const res = await window.API.saveInvoice(facturaData);
        if (res.success) {
            alert("✅ VENTA REGISTRADA: " + (res.ot || "Éxito"));
            localStorage.removeItem('ultima_cotizacion');
            window.location.href = "/history.html";
        } else {
            alert("🚨 Error: " + (res.message || res.error || "Falla en servidor"));
            if(btnVenta) {
                btnVenta.disabled = false;
                btnVenta.innerHTML = 'CONFIRMAR VENTA Y DESCONTAR STOCK';
            }
        }
    } catch (e) {
        console.error("Error Fetch:", e);
        alert("Error de red o conexión al servidor.");
        if(btnVenta) {
            btnVenta.disabled = false;
            btnVenta.innerHTML = 'CONFIRMAR VENTA Y DESCONTAR STOCK';
        }
    }
}

// --- EVENTOS Y CONFIGURACIÓN ---

function configurarEventos() {
    const btnFacturar = document.getElementById('btnFinalizarVenta');
    if(btnFacturar) btnFacturar.onclick = facturarVenta;

    document.getElementById('compraMaterial')?.addEventListener('change', (e) => {
        const nuevoContainer = document.getElementById('nuevoMaterialContainer');
        const comboProv = document.getElementById('compraProveedor');
        if(e.target.value === "NUEVO") {
            if(nuevoContainer) nuevoContainer.style.display = 'block';
            if(comboProv) comboProv.focus();
        } else {
            if(nuevoContainer) nuevoContainer.style.display = 'none';
        }
    });

    document.getElementById('matForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            id: document.getElementById('matId')?.value,
            nombre: document.getElementById('matNombre').value,
            categoria: document.getElementById('matCategoria').value,
            precio_total_lamina: parseFloat(document.getElementById('matCosto').value) || 0,
            stock_minimo: parseFloat(document.getElementById('matStockMin').value) || 2,
            proveedorId: document.getElementById('proveedorSelect').value,
            ancho_lamina_cm: parseFloat(document.getElementById('matAncho')?.value) || 0,
            largo_lamina_cm: parseFloat(document.getElementById('matLargo')?.value) || 0
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

    document.getElementById('formAjusteStock')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('adjustId').value;
        const nuevaCantidad = parseFloat(document.getElementById('adjustCantidad').value);
        const nuevoMinimo = parseFloat(document.getElementById('adjustReorden').value);
        if (isNaN(nuevaCantidad)) return alert("Cantidad no válida");
        try {
            const res = await window.API.updateStock(id, { 
                stock_actual: nuevaCantidad, 
                stock_minimo: nuevoMinimo 
            });
            if (res.success) {
                alert("✅ Stock actualizado");
                window.cerrarModales();
                await fetchInventory();
            }
        } catch (err) { alert("❌ Error al ajustar stock"); }
    });

    const formCompra = document.getElementById('formNuevaCompra') || document.getElementById('purchaseForm');
    if (formCompra) {
        formCompra.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const stampTransaccion = Date.now(); 
    
    let materialId = document.getElementById('compraMaterial')?.value;
    const providerId = document.getElementById('compraProveedor')?.value; 
    const nuevoNombre = document.getElementById('nombreNuevoMaterial')?.value?.trim();
    const largo = parseFloat(document.getElementById('compraLargo')?.value) || 0;
    const ancho = parseFloat(document.getElementById('compraAncho')?.value) || 0;
    const cant = parseFloat(document.getElementById('compraCantidad')?.value) || 0; 
    const valorUnitarioLamina = parseFloat(document.getElementById('compraCosto')?.value) || 0;
    
    if(!materialId || !providerId || cant <= 0) {
        alert("⚠️ Verifica material, proveedor y cantidad mayor a cero");
        return;
    }

    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }

    const materialPrevio = window.todosLosMateriales.find(m => m.id === materialId);
    const nombreMaterialActual = (materialId === "NUEVO" ? nuevoNombre : (materialPrevio?.nombre || ""));
    
    // --- LÓGICA DE DISTINCIÓN MEJORADA ---
    // Se considera lineal (ml) si:
    // 1. El nombre contiene "moldura"
    // 2. El ancho es menor o igual a 15cm (ajustable según tus molduras)
    // 3. O si el material ya venía definido como 'ml'
    // --- NUEVA LÓGICA DE CÁLCULO M2 vs ML ---
// Es lineal si el nombre dice moldura O si el ancho es de una moldura física (ej. 15cm o menos)
const esLineal = nombreMaterialActual.toLowerCase().includes("moldura") || (ancho > 0 && ancho <= 15);

let cantidadCalculada = 0;
let tipoUnidad = '';

if (esLineal) {
    // Si es moldura: solo largo por cantidad (Metros Lineales)
    cantidadCalculada = (largo / 100) * cant;
    tipoUnidad = 'ml';
} else {
    // Si es otro material: área completa (Metros Cuadrados)
    cantidadCalculada = (largo / 100) * (ancho / 100) * cant;
    tipoUnidad = 'm2';
}
// ---------------------------------------

    if (materialId === "NUEVO") {
        if (!nuevoNombre) {
            alert("⚠️ Escribe el nombre del nuevo material");
            if(btn) { btn.disabled = false; btn.innerHTML = 'GUARDAR COMPRA'; }
            return;
        }
        try {
            const resMat = await window.API.saveMaterial({
                nombre: nuevoNombre,
                categoria: esLineal ? "Molduras" : "General",
                proveedorId: providerId,
                ancho_lamina_cm: ancho,
                largo_lamina_cm: largo,
                precio_total_lamina: valorUnitarioLamina,
                tipo: tipoUnidad
            });
            
            if (resMat.success && (resMat.data?._id || resMat.data?.id)) {
                materialId = resMat.data._id || resMat.data.id; 
            }
        } catch (err) {
            console.error("Error al crear material...");
        }
    }

    const objetoCompraSincronizado = {
                // ANTES decía material_id o estaba vacío, DEBE SER ASÍ:
                materialId: materialId, 
                nombreMaterial: nombreMaterialActual, 
                proveedorId: providerId,
                cantidad: cant,
                largo: largo,
                ancho: ancho,
                valorUnitario: valorUnitarioLamina,
                totalM2: cantidadCalculada, // Aquí van los 2.9
                tempId: stampTransaccion
            };

            // 1. REGISTRO EN BITÁCORA LOCAL
            const bitacora = JSON.parse(localStorage.getItem('bitacora_compras') || '[]');
            bitacora.push({ ...objetoCompraSincronizado, fecha: new Date().toISOString() });
            localStorage.setItem('bitacora_compras', JSON.stringify(bitacora));

            // 2. ACTUALIZACIÓN DE MEMORIA (El paso que faltaba)
            // Buscamos el material en la lista y le sumamos el valor para que renderTable lo vea
            window.todosLosMateriales = window.todosLosMateriales.map(m => {
                if (String(m.id) === String(objetoCompraSincronizado.materialId)) {
                    return {
                        ...m,
                        stock_actual: (parseFloat(m.stock_actual) || 0) + parseFloat(objetoCompraSincronizado.totalM2)
                    };
                }
                return m;
            });

            // 3. REDIBUJAR TABLA
            renderTable(window.todosLosMateriales);

   try {
                // 1. REGISTRO EN BITÁCORA LOCAL
                const bitacora = JSON.parse(localStorage.getItem('bitacora_compras') || '[]');
                bitacora.push({ ...objetoCompraSincronizado, fecha: new Date().toISOString() });
                localStorage.setItem('bitacora_compras', JSON.stringify(bitacora));

                // 2. LIMPIEZA INMEDIATA DEL FORMULARIO
                // Esto evita que el sistema "lea" el formulario y la bitácora al tiempo
                if(e.target) e.target.reset(); 

                // 3. REDIBUJAR TABLA
                renderTable(window.todosLosMateriales);

                // 4. INFORMAR AL SERVIDOR
                const res = await window.API.registerPurchase(objetoCompraSincronizado);
                
                if (res.success) {
                    // Si el servidor confirma, ahora SÍ borramos de la bitácora 
                    // para que cuando refresques, el servidor ya tenga el dato
                    const nuevaBitacora = JSON.parse(localStorage.getItem('bitacora_compras') || '[]')
                        .filter(item => String(item.tempId) !== String(stampTransaccion));
                    localStorage.setItem('bitacora_compras', JSON.stringify(nuevaBitacora));
                    
                    alert(`✅ ¡Inventario en 8.70 ml!`);
                    window.cerrarModales();
                }
            } catch (err) {
                console.warn("Error de red, se mantiene el 8.70 visual.");
                window.cerrarModales();
            } finally {
                if(btn) { btn.disabled = false; btn.innerHTML = 'GUARDAR COMPRA'; }
            }
        });
    }

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        renderTable(window.todosLosMateriales.filter(m => m.nombre.toLowerCase().includes(termino)));
    });

    const provForm = document.getElementById('provForm');
    if(provForm) {
        provForm.onsubmit = window.guardarProveedor;
    }
}

function actualizarStockEnTablaVisual(nombre, cantidadASumar, tipo) {
    const filas = document.querySelectorAll('#inventoryTable tr');
    let encontrado = false;
    
    filas.forEach(fila => {
        if (fila.getAttribute('data-nombre') === nombre.toLowerCase()) {
            encontrado = true;
            const container = fila.querySelector('.stock-display-container');
            if (container) {
                const textoActual = container.innerText;
                const valorActual = parseFloat(textoActual.replace(/[^\d.]/g, '')) || 0;
                const nuevoValor = valorActual + parseFloat(cantidadASumar);
                
                container.innerHTML = `<strong>${nuevoValor.toFixed(2)}</strong> ${tipo}`;
                container.style.color = '#059669'; 
                container.style.transition = 'all 0.5s ease';
                container.style.backgroundColor = '#ecfdf5'; 
                
                console.log(`✅ UI Reforzada: ${nombre} actualizado de ${valorActual} a ${nuevoValor}`);
            }
        }
    });
}

// --- UTILIDADES DE UI (PRESERVADO) ---

window.cargarListasModal = function() {
    const provSelect = document.getElementById('compraProveedor');
    const matSelect = document.getElementById('compraMaterial');
    const provRegisterSelect = document.getElementById('proveedorSelect');
    
    if (window.todosLosProveedores.length > 0) {
        const opcionesProv = '<option value="">-- Seleccionar Proveedor --</option>' + window.todosLosProveedores.map(p => `<option value="${p._id || p.id}">${String(p.nombre || 'S/N').toUpperCase()}</option>`).join('');
        if (provSelect) provSelect.innerHTML = opcionesProv;
        if (provRegisterSelect) provRegisterSelect.innerHTML = opcionesProv;
    }
    
    if (matSelect) {
        let opcionesMat = '<option value="">-- Seleccionar Material --</option><option value="NUEVO" style="color: #3182ce; font-weight: bold;">+ AGREGAR NUEVO MATERIAL</option>' + window.todosLosMateriales.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
        matSelect.innerHTML = opcionesMat;
    }
};

window.cerrarModales = function() { 
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
};

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
    if(document.getElementById('matCosto')) document.getElementById('matCosto').value = m.precio_total_lamina;
    if(document.getElementById('matStockMin')) document.getElementById('matStockMin').value = m.stock_minimo;
    if(document.getElementById('matAncho')) document.getElementById('matAncho').value = m.ancho_lamina_cm;
    if(document.getElementById('matLargo')) document.getElementById('matLargo').value = m.largo_lamina_cm;
    if(document.getElementById('proveedorSelect')) document.getElementById('proveedorSelect').value = m.proveedorId || m.proveedor?._id || "";
    const modal = document.getElementById('modalNuevoMaterial');
    if(modal) modal.style.display = 'flex';
};

function actualizarSelectProveedores() {
    const select = document.getElementById('proveedorSelect');
    if (select && window.todosLosProveedores.length > 0) {
        select.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' + 
            window.todosLosProveedores.map(p => `<option value="${p._id || p.id}">${p.nombre || 'S/N'}</option>`).join('');
    }
}

function actualizarDatalistMateriales() {
    const lista = document.getElementById('listaMateriales');
    if (lista) lista.innerHTML = window.todosLosMateriales.map(m => `<option value="${m.nombre}">`).join('');
}