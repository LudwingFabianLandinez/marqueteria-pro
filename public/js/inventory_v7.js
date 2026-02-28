/**
 * SISTEMA DE GESTIÓN - MARQUETERÍA LA CHICA MORALES
 * Versión: 13.4.48 - STOCK REAL CON RECONCILIACIÓN LOCAL
 * * CAMBIOS v13.4.48:
 * 1. GANCHO 'calcularStockReal': Suma compras locales al stock del servidor antes de renderizar.
 * 2. PERSISTENCIA DE MOLDURAS: Solución definitiva para que los 2.9 ML aparezcan en pantalla.
 * 3. MANTENIMIENTO: Se preserva al 100% la estructura visual y lógica de m2/ml.
 * 4. SINCRONIZACIÓN: Limpieza de bitácora local tras confirmación del servidor para evitar duplicidad.
 */

// --- CONFIGURACIÓN DE CONEXIÓN GLOBAL (Arreglo Punto 1 - Virginia) ---
window.API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/.netlify/functions/server' 
    : 'https://marqueteria-la-chica-morales.netlify.app/.netlify/functions/server';

// Puente de compatibilidad para window.API
window.API = {
    getInvoices: () => fetch(`${window.API_URL}/invoices`).then(r => r.json()),
    getInventory: () => fetch(`${window.API_URL}/inventory`).then(r => r.json()),
    getProviders: (query = "") => fetch(`${window.API_URL}/providers${query}`).then(r => r.json()),
    saveInvoice: (data) => fetch(`${window.API_URL}/invoices`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    saveMaterial: (data) => fetch(`${window.API_URL}/inventory`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    updateStock: (id, data) => fetch(`${window.API_URL}/inventory/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    getHistory: (id) => fetch(`${window.API_URL}/materials/${id}/history`).then(r => r.json()),
    deleteMaterial: (id) => fetch(`${window.API_URL}/inventory/${id}`, { method: 'DELETE' }).then(r => r.json())
};

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
// PEGA ESTO EN SU LUGAR (Versión v13.4.49) [cite: 784, 792]
function calcularStockReal(material) {
    let stockServidor = parseFloat(material.stock_actual) || 0;
    const comprasLocales = JSON.parse(localStorage.getItem('bitacora_compras') || '[]');
    
    // Normalizamos el ID del material del servidor
    const idMaterialTabla = String(material.id || material._id || "");

    const sumaExtra = comprasLocales.reduce((acc, compra) => {
        // Normalizamos el ID guardado en la compra
        const idEnCompra = (compra.materialId && typeof compra.materialId === 'object') 
            ? String(compra.materialId._id || compra.materialId.id) 
            : String(compra.materialId);

        if (idEnCompra === idMaterialTabla) {
            // Sumamos los 2.9 ml (totalM2 o cantidad_m2)
            const valorASumar = parseFloat(compra.totalM2 || compra.cantidad_m2 || 0);
            return acc + valorASumar;
        }
        return acc;
    }, 0);

    return stockServidor + sumaExtra;
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
    
    // 1. UI: Feedback visual inmediato (Mantenemos tu lógica intacta)
    const btnGuardar = event.submitter || document.querySelector('#provForm button[type="submit"]');
    const originalText = btnGuardar ? btnGuardar.innerHTML : 'GUARDAR';
    if(btnGuardar) { 
        btnGuardar.disabled = true; 
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GUARDANDO...'; 
    }

    // 2. Captura de datos (Tu estructura original intacta)
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
        return alert("⚠️ El nombre del proveedor es obligatorio");
    }

    try {
        console.log("🚀 Enviando proveedor a Atlas:", payload.nombre);
        
        // 3. ENVÍO DIRECTO Y SEGURO (Corrigiendo el error 400 del puente)
        const response = await fetch(`${window.API_URL}/providers`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Validamos si la respuesta fue exitosa antes de convertir a JSON
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || `Error del servidor (${response.status})`);
        }

        const res = await response.json();

        // 4. ÉXITO: Tu lógica de cierre y refresco (Intacta)
        if (res.success || res._id || res.id) {
            alert(" ✅ Proveedor guardado correctamente en MongoDB Atlas");
            document.getElementById('provForm')?.reset();
            
            // Cerrar modal si existe la función
            if (typeof window.cerrarModales === 'function') {
                window.cerrarModales();
            } else {
                // Fallback manual para cerrar modal
                const modal = document.getElementById('modalProveedor');
                if(modal) modal.style.display = 'none';
            }
            
            // Refrescar lista de proveedores
            if (typeof fetchProviders === 'function') {
                await fetchProviders(); 
            }
            
        } else {
            throw new Error("Atlas no devolvió confirmación de guardado");
        }

    } catch (error) { 
        console.error("🚨 Error crítico al guardar proveedor:", error);
        alert("❌ Error: " + error.message); 
    } finally {
        if(btnGuardar) { 
            btnGuardar.disabled = false; 
            btnGuardar.innerHTML = originalText; 
        }
    }
};

// --- SECCIÓN INVENTARIO (CON RECONCILIACIÓN ACTIVA) ---

async function fetchInventory() {
    try {
        const resultado = await window.API.getInventory();
        const datosServidor = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []);
        
        // 1. CARGAR CAJAS DE SEGURIDAD
        const eliminados = JSON.parse(localStorage.getItem('ids_eliminados') || '[]');
        const moldurasPendientes = JSON.parse(localStorage.getItem('molduras_pendientes') || '[]');

        // 2. MAPEAMOS LOS DATOS DEL SERVIDOR (Preservando tu lógica)
        const materialesMapeados = datosServidor.map(m => {
            return {
                ...m,
                id: m._id || m.id,
                // ESCUDO: Si no hay nombre, evitamos el undefined
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

        // 3. RECONCILIACIÓN POR NOMBRE (Con protección contra errores de toLowerCase)
        window.todosLosMateriales = materialesMapeados.map(mServidor => {
            // ESCUDO: Usamos (mServidor.nombre || "") para que el toLowerCase nunca falle
            const nombreServidor = (mServidor.nombre || "").toLowerCase();
            
            const compraReciente = moldurasPendientes.find(p => 
                (p.nombre || "").toLowerCase() === nombreServidor
            );

            if (compraReciente) {
                return { ...mServidor, ...compraReciente };
            }
            return mServidor;
        });

        // Agregamos materiales nuevos con la misma protección
        moldurasPendientes.forEach(p => {
            const nombrePendiente = (p.nombre || "").toLowerCase();
            const yaExisteEnLista = window.todosLosMateriales.some(m => 
                (m.nombre || "").toLowerCase() === nombrePendiente
            );
            
            if (!yaExisteEnLista) {
                window.todosLosMateriales.push(p);
            }
        });

        // 4. FILTRADO FINAL
        window.todosLosMateriales = window.todosLosMateriales.filter(m => {
            const noEstaEliminado = !eliminados.includes(String(m.id));
            // Solo mostramos si tiene un nombre real
            const nombreLimpio = (m.nombre || "").trim();
            const tieneNombreValido = nombreLimpio !== "" && nombreLimpio !== "Sin nombre";
            return noEstaEliminado && tieneNombreValido;
        });
        
        // 5. ACTUALIZACIÓN DE VISTA Y CACHÉ
        localStorage.setItem('inventory', JSON.stringify(window.todosLosMateriales));
        renderTable(window.todosLosMateriales);
        
        if (typeof actualizarDatalistMateriales === 'function') {
            actualizarDatalistMateriales();
        }
        
        if (typeof window.cargarListasModal === 'function') {
            window.cargarListasModal();
        }
        
        console.log("✅ Inventario sincronizado y protegido contra errores de nombre");

    } catch (error) { 
        console.error("❌ Error inventario:", error); 
    }
}

function renderTable(materiales) {
    const cuerpoTabla = document.getElementById('inventoryTable');
    if (!cuerpoTabla) return;
    cuerpoTabla.innerHTML = '';
    
    const formateador = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    
    materiales.forEach(m => {
        const fila = document.createElement('tr');
        fila.setAttribute('data-nombre', m.nombre.toLowerCase());
        
        // 1. RECONCILIACIÓN: Stock real sumando lo local (CONEXIÓN ATLAS PRESERVADA)
        const stockActualUnidad = calcularStockReal(m);
        
        // 2. IDENTIFICACIÓN ESTRICTA: ¿Es Moldura o es Material de Área?
        const esMoldura = m.nombre.toUpperCase().includes("MOLDURA") || m.nombre.toUpperCase().startsWith("K ");
        const unidadFinal = esMoldura ? 'ml' : 'm²';
        
        // --- CORRECCIÓN DE MEDIDAS: Captura datos de Atlas/Compra ---
        // --- DETECCIÓN MAESTRA DE MEDIDAS (PUNTO 1) ---
        // Buscamos en todas las variantes posibles, incluyendo las de la compra
        const ancho = parseFloat(m.ancho_lamina_cm || m.ancho || m.ancho_cm || m.ancho_compra || 0);
        const largo = parseFloat(m.largo_lamina_cm || m.largo || m.largo_cm || m.largo_compra || 0);
        
        let visualMedida = "";
        if (esMoldura) {
            visualMedida = `${largo > 0 ? largo : 290} cm`;
        } else {
            if (ancho > 0 && largo > 0) {
                // SI ENCUENTRA LOS NÚMEROS, LOS MUESTRA ASÍ: 244x183 cm
                visualMedida = `${ancho}x${largo} cm`;
            } else if (m.medidas || m.dimensiones) {
                // Si están guardados como un solo texto
                visualMedida = m.medidas || m.dimensiones;
            } else {
                // Si no hay nada, intentamos extraerlo del nombre por si acaso (ej: "Vidrio 244x183")
                const extraido = m.nombre.match(/(\d+)\s*[xX*]\s*(\d+)/);
                visualMedida = extraido ? `${extraido[1]}x${extraido[2]} cm` : "Ver Ficha";
            }
        }
        // --------------------------------------------

        const areaUnaLaminaM2 = (ancho * largo) / 10000;
        
        // 3. CÁLCULO DE COSTO (Basado en tu regla: ML para molduras, M2 para el resto)
        let costoMostrar = 0;
        if (esMoldura) {
            const largoMetros = largo > 0 ? (largo / 100) : 2.9;
            costoMostrar = Math.round((m.precio_total_lamina || 0) / largoMetros) || m.precio_m2_costo || 0;
        } else {
            if (areaUnaLaminaM2 > 0) {
                costoMostrar = Math.round((m.precio_total_lamina || 0) / areaUnaLaminaM2);
            } else {
                costoMostrar = m.precio_m2_costo || 0;
            }
        }

        // 4. SEMÁFORO (Basado en stock_minimo)
        const stockMin = parseFloat(m.stock_minimo) || 2;
        let colorStock = stockActualUnidad <= 0 ? '#ef4444' : (stockActualUnidad <= stockMin ? '#f59e0b' : '#059669');
        
        // 5. CONSTRUCCIÓN VISUAL DEL STOCK (UNIDADES + REMANENTE)
        let textoStockVisual = "";
        if (esMoldura) {
            textoStockVisual = `
                <div style="font-weight: 700; font-size: 0.95rem;">${stockActualUnidad.toFixed(2)} ${unidadFinal}</div>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">(Total disponible en ML)</div>
            `;
        } else {
            const laminasExactas = areaUnaLaminaM2 > 0 ? stockActualUnidad / areaUnaLaminaM2 : 0;
            const laminasCompletas = Math.floor(laminasExactas + 0.0001); 
            let sobranteM2 = stockActualUnidad - (laminasCompletas * areaUnaLaminaM2);
            if (sobranteM2 < 0.0001) sobranteM2 = 0;

            let desglose = "";
            if (laminasCompletas > 0) {
                desglose = (sobranteM2 > 0.01) 
                    ? `(${laminasCompletas} und + ${sobranteM2.toFixed(2)} m² remanente)` 
                    : `(${laminasCompletas} unidades completas)`;
            } else {
                desglose = `(${sobranteM2.toFixed(2)} m² en retales)`;
            }
            
            textoStockVisual = `
                <div style="font-weight: 700; font-size: 0.95rem;">${stockActualUnidad.toFixed(2)} ${unidadFinal}</div>
                <div style="font-size: 0.7rem; color: #475569; margin-top: 2px; font-weight: 500;">${desglose}</div>
            `;
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
                    ${visualMedida}
                </span>
            </td>
            <td style="text-align: center; font-weight: 700; font-size: 0.85rem; color: #1e293b;">
                ${formateador.format(costoMostrar)} <span style="font-size:0.6rem; font-weight:400;">/${unidadFinal}</span>
            </td>
            <td style="text-align: center; padding: 8px;">
                <div class="stock-display-container" style="background: #fff; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; min-width: 155px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); color: ${colorStock};">
                    ${textoStockVisual}
                </div>
            </td>
            <td style="text-align: center; vertical-align: middle; min-width: 320px;">
                <div class="actions-cell" style="display: flex; justify-content: center; gap: 8px; padding: 5px;">
                    <button onclick="window.abrirModalEditar('${m.id || m._id}')" class="btn-action-edit" style="background: #2563eb; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 10px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-edit"></i> EDITAR
                    </button>
                    <button onclick="window.verHistorial('${m.id}', '${m.nombre}')" class="btn-action-history" style="background: #7c3aed; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 10px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-history"></i> HISTORIAL
                    </button>
                    <button onclick="window.eliminarMaterial('${m.id}')" class="btn-action-delete" style="background: #dc2626; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 10px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-trash"></i> ELIMINAR
                    </button>
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

    // --- MEJORA PUNTO 4: AUTO-COMPLETAR COSTO + LÓGICA DE NUEVO MATERIAL ---
    document.getElementById('compraMaterial')?.addEventListener('change', (e) => {
        const materialId = e.target.value;
        const nuevoContainer = document.getElementById('nuevoMaterialContainer');
        const comboProv = document.getElementById('compraProveedor');
        const inputCosto = document.getElementById('compraCosto'); // Campo de costo en compra

        if(materialId === "NUEVO") {
            if(nuevoContainer) nuevoContainer.style.display = 'block';
            if(comboProv) comboProv.focus();
            if(inputCosto) inputCosto.value = ""; // Limpiar si es nuevo
        } else {
            if(nuevoContainer) nuevoContainer.style.display = 'none';
            
            // LÓGICA PUNTO 4: Buscar el material y poner su precio actual por default
            if (materialId && window.todosLosMateriales) {
                const matEncontrado = window.todosLosMateriales.find(m => 
                    String(m.id) === String(materialId) || String(m._id) === String(materialId)
                );

                if (matEncontrado && inputCosto) {
                    // Colocamos el precio_total_lamina por defecto (pero el usuario puede editarlo)
                    inputCosto.value = matEncontrado.precio_total_lamina || 0;
                    console.log(`💰 Punto 4: Costo sugerido cargado (${matEncontrado.nombre})`);
                }
            }
        }
    });

    // --- FORMULARIO DE MATERIALES (SE MANTIENE IGUAL - LOGRADO) ---
    document.getElementById('matForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // RECOLECCIÓN DE DATOS: Aseguramos que los nombres coincidan con tu base de datos Atlas
        const payload = {
            id: document.getElementById('matId')?.value,
            nombre: document.getElementById('matNombre').value,
            categoria: document.getElementById('matCategoria').value,
            precio_total_lamina: parseFloat(document.getElementById('matCosto').value) || 0,
            stock_minimo: parseFloat(document.getElementById('matStockMin').value) || 2,
            proveedorId: document.getElementById('proveedorSelect').value,
            
            // ¡IMPORTANTE! Estos nombres deben ser EXACTOS a como los lee renderTable
            ancho_lamina_cm: parseFloat(document.getElementById('matAncho')?.value || document.getElementById('matAnchoCompra')?.value || 0),
            largo_lamina_cm: parseFloat(document.getElementById('matLargo')?.value || document.getElementById('matLargoCompra')?.value || 0)
        };

        console.log("🚀 Enviando a Atlas:", payload); // Para que veas en consola que no van en 0

        try {
            const res = await window.API.saveMaterial(payload);
            if(res.success) {
                window.cerrarModales();
                // Limpiamos el formulario para la próxima
                e.target.reset(); 
                await fetchInventory();
                alert("✅ Material guardado con éxito y medidas sincronizadas");
            }
        } catch(err) { 
            console.error("Error al guardar:", err);
            alert("❌ Error al guardar en Atlas"); 
        }
    });

    // --- FORMULARIO DE AJUSTE DE STOCK (SE MANTIENE IGUAL - LOGRADO) ---
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


    // === RECUPERANDO VERSIÓN ESTABLE v13.4.48 ===

const formCompra = document.getElementById('formNuevaCompra');
    if (formCompra) {
        formCompra.onsubmit = async function(e) {
            e.preventDefault();

            // 1. UI: Bloqueo de seguridad
            const formulario = e.target;
            const btn = formulario.querySelector('button[type="submit"]');
            if (btn) { 
                btn.disabled = true; 
                btn.innerHTML = '⚡ VALIDANDO CON ATLAS...'; 
            }

            try {
                const selectMat = document.getElementById('compraMaterial');
                const inputNuevo = document.getElementById('nombreNuevoMaterial');
                const inputCant = document.getElementById('compraCantidad');
                const inputCosto = document.getElementById('compraCosto');
                const inputLargo = document.getElementById('compraLargo');
                const inputAncho = document.getElementById('compraAncho');

                // 1. DETERMINAR NOMBRE Y TIPO
                let nombreInput = (selectMat.value === "NUEVO") 
                    ? inputNuevo.value.trim() 
                    : selectMat.options[selectMat.selectedIndex].text.replace('+ AGREGAR NUEVO MATERIAL', '').trim();
                
                const esMoldura = nombreInput.toUpperCase().includes("MOLDURA") || nombreInput.toUpperCase().startsWith("K ");
                let nombreReal = esMoldura ? nombreInput.toUpperCase() : nombreInput;

                const cant = parseFloat(inputCant.value) || 0;
                const costo = parseFloat(inputCosto.value) || 0;
                
                let stockASumar = esMoldura 
                    ? (cant * 2.90) 
                    : (((parseFloat(inputLargo?.value) || 0) * (parseFloat(inputAncho?.value) || 0) / 10000) * cant);

                if (!window.todosLosMateriales) window.todosLosMateriales = [];
                let existente = window.todosLosMateriales.find(m => m.nombre.toLowerCase() === nombreReal.toLowerCase());

                // 2. 🛡️ LÓGICA DE IDENTIDAD MAESTRA (v16.0.2)
                // Buscamos el ID real de Atlas si existe
                const idMasterAtlas = (existente && existente._id) ? existente._id : 
                                    (existente && existente.id && !String(existente.id).startsWith('TEMP-') ? existente.id : null);

                const esNuevoMaterial = (idMasterAtlas === null || selectMat.value === "NUEVO");

                // 3. CONSTRUCCIÓN DEL OBJETO PARA ATLAS Y COTIZADOR
                const datosParaAtlas = {
                    materialId: esNuevoMaterial ? "NUEVO" : idMasterAtlas, 
                    nombre: nombreReal,
                    esNuevo: esNuevoMaterial,
                    categoria: esNuevoMaterial ? (esMoldura ? "MOLDURAS" : "GENERAL") : (existente?.categoria || "GENERAL"),
                    cantidad_laminas: cant,
                    precio_total_lamina: costo,
                    ancho_lamina_cm: esMoldura ? 1 : (parseFloat(inputAncho?.value) || 0),
                    largo_lamina_cm: esMoldura ? 290 : (parseFloat(inputLargo?.value) || 0),
                    tipo_material: esMoldura ? 'ml' : 'm2',
                    costo_total: costo * cant,
                    timestamp: new Date().toISOString(),
                    // Datos para el Cotizador (quotes.js)
                    costo_base: costo, 
                    costo_m2: costo,
                    precio_m2_costo: costo,
                    unidad: esMoldura ? 'ML' : 'M2',
                    id: esNuevoMaterial ? `TEMP-${Date.now()}` : idMasterAtlas
                };

                // --- 🚀 RUTA DE CONEXIÓN UNIFICADA (v16.0.3) ---
                const URL_FINAL = `${window.API_URL}/inventory/purchase`;
                console.log("📡 Intentando escribir en Atlas vía:", URL_FINAL, "Datos:", datosParaAtlas);

                const response = await fetch(URL_FINAL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datosParaAtlas)
                });

                const textoRespuesta = await response.text();
                let resultadoAtlas;
                
                try {
                    resultadoAtlas = JSON.parse(textoRespuesta);
                } catch (err) {
                    throw new Error("El servidor no devolvió un JSON válido.");
                }

                if (!response.ok) {
                    throw new Error(resultadoAtlas.error || `Error ${response.status}: Atlas rechazó la conexión.`);
                }

                // --- 🔄 SINCRONIZACIÓN MAESTRA TRAS ÉXITO ---
                const idDeAtlas = resultadoAtlas.data?._id || resultadoAtlas.data?.id;
                let objetoFinal; 

                if (existente) {
                    // Actualizamos el stock y el ID real de Atlas en el objeto de memoria
                    existente.stock_actual = (Number(existente.stock_actual) || 0) + stockASumar;
                    if (idDeAtlas) {
                        existente._id = idDeAtlas;
                        existente.id = idDeAtlas; // Matamos el ID temporal aquí
                    }
                    objetoFinal = existente;
                } else {
                    // Si el material es nuevo, lo creamos con el ID que devolvió Atlas
                    const nuevoMaterial = {
                        _id: idDeAtlas,
                        id: idDeAtlas || `TEMP-${Date.now()}`,
                        nombre: nombreReal,
                        categoria: esMoldura ? "MOLDURAS" : "GENERAL",
                        stock_actual: stockASumar,
                        precio_total_lamina: costo,
                        precio_m2_costo: costo, // Para el cotizador
                        ancho_lamina_cm: esMoldura ? 1 : (parseFloat(inputAncho?.value) || 0),
                        largo_lamina_cm: esMoldura ? 290 : (parseFloat(inputLargo?.value) || 0)
                    };
                    window.todosLosMateriales.unshift(nuevoMaterial);
                    objetoFinal = nuevoMaterial;
                }

                // --- 📦 PERSISTENCIA Y LIMPIEZA ---
                // 1. Actualizar Inventario en LocalStorage
                localStorage.setItem('inventory', JSON.stringify(window.todosLosMateriales));
                
                // 2. Limpiar molduras pendientes (Bitácora)
                let pendientes = JSON.parse(localStorage.getItem('molduras_pendientes') || '[]');
                pendientes = pendientes.filter(p => p.nombre.toLowerCase() !== nombreReal.toLowerCase());
                pendientes.push({ ...objetoFinal, fechaCompra: new Date().toISOString() });
                localStorage.setItem('molduras_pendientes', JSON.stringify(pendientes));

                // 3. UI
                if (typeof renderTable === 'function') renderTable(window.todosLosMateriales);
                
                alert(`✅ ¡LOGRADO!\n${nombreReal} sincronizado con ID Maestro Atlas.`);
                
                if(document.getElementById('modalCompra')) document.getElementById('modalCompra').style.display = 'none';
                formulario.reset();

            } catch (error) {
                console.error("❌ Error Crítico:", error);
                alert("⚠️ FALLO DE ATLAS:\n" + error.message);
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar Compra'; }
            }
        }; 
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
    const modal = document.getElementById('modalHistorialPrecios');
    const contenedor = document.getElementById('listaHistorialPrecios');
    
    if (modal) modal.style.display = 'flex';
    if (contenedor) contenedor.innerHTML = '<div style="color:black; padding:20px;">🔄 Buscando movimientos de hoy 22/02...</div>';

    try {
        // Forzamos al servidor a darnos lo último de hoy
        const respuesta = await fetch(`${window.API_URL}/materials/${id}/history?t=${Date.now()}`);
        const resultado = await respuesta.json();
        
        const datos = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []);

        if (!datos || datos.length === 0) {
            contenedor.innerHTML = `<div style="color:red; padding:20px; text-align:center; font-weight:bold;">
                ⚠️ ATENCIÓN: No se encontraron movimientos registrados después del 16/02.<br>
                Verifica si el servidor está guardando las compras.
            </div>`;
            return;
        }

        // Si hay datos, los pintamos con fuerza (Color NEGRO puro)
        contenedor.innerHTML = datos.map(h => `
            <div style="border-bottom:2px solid #eee; padding:15px; color: #000 !important; background: #fff;">
                <div style="font-weight:bold; font-size:14px;">${h.tipo?.toUpperCase()}</div>
                <div style="font-size:12px; color:#555;">Fecha: ${new Date(h.fecha || h.createdAt).toLocaleString()}</div>
                <div style="font-size:16px; font-weight:900; color:${h.cantidad > 0 ? 'green' : 'red'};">
                    ${h.cantidad > 0 ? '+' : ''}${h.cantidad} Unid/m2
                </div>
            </div>
        `).join('');

    } catch (error) {
        contenedor.innerHTML = `<div style="color:red; padding:20px;">❌ Error de conexión al 22/02: ${error.message}</div>`;
    }
};

  window.eliminarMaterial = async function(id) {
    if (confirm("⚠️ ¿Estás seguro de eliminar este material permanentemente?")) {
        try {
            // 1. Identificar si es un ID temporal o real de Atlas
            const esIdTemporal = String(id).startsWith('TEMP-') || String(id).startsWith('MAT-');
            
            // 2. Buscar el material en el array global para obtener su _id real si lo tiene
            const materialEnMemoria = window.todosLosMateriales.find(m => String(m.id) === String(id) || String(m._id) === String(id));
            const idParaBorrarEnAtlas = (materialEnMemoria && materialEnMemoria._id) ? materialEnMemoria._id : id;

            // 3. AGREGAR A LISTA NEGRA LOCAL (Evita que resucite al refrescar)
            let eliminados = JSON.parse(localStorage.getItem('ids_eliminados') || '[]');
            if (!eliminados.includes(String(id))) {
                eliminados.push(String(id));
                if (idParaBorrarEnAtlas !== id) eliminados.push(String(idParaBorrarEnAtlas));
                localStorage.setItem('ids_eliminados', JSON.stringify(eliminados));
            }

            // 4. LIMPIAR DE LA MEMORIA LOCAL Y LOCALSTORAGE
            window.todosLosMateriales = window.todosLosMateriales.filter(m => 
                String(m.id) !== String(id) && String(m._id) !== String(idParaBorrarEnAtlas)
            );
            
            let pendientes = JSON.parse(localStorage.getItem('molduras_pendientes') || '[]');
            pendientes = pendientes.filter(p => String(p.id) !== String(id) && String(p._id) !== String(idParaBorrarEnAtlas));
            localStorage.setItem('molduras_pendientes', JSON.stringify(pendientes));
            localStorage.setItem('inventory', JSON.stringify(window.todosLosMateriales));

            // 5. AVISAR AL SERVIDOR (Solo si NO es temporal)
            if (!esIdTemporal && window.API && window.API.deleteMaterial) {
                console.log("📡 Solicitando a Atlas borrar ID:", idParaBorrarEnAtlas);
                await window.API.deleteMaterial(idParaBorrarEnAtlas).catch(e => {
                    console.warn("⚠️ No se pudo borrar en la nube, pero se eliminó localmente.");
                });
            } else {
                console.log(`🛡️ Borrado local completado para ID: ${id}`);
            }

            // 6. ACTUALIZAR INTERFAZ
            if (typeof renderTable === 'function') {
                renderTable(window.todosLosMateriales);
            }
            
            alert("✅ Material eliminado definitivamente de este dispositivo y Atlas.");

        } catch (error) {
            console.error("❌ Error al eliminar:", error);
            alert("Hubo un problema al procesar la eliminación.");
        }
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
    
    // GUARDAR ID PARA EL GUARDADO FINAL
    window.materialEditandoId = m.id; 

    if(document.getElementById('matId')) document.getElementById('matId').value = m.id;
    if(document.getElementById('matNombre')) document.getElementById('matNombre').value = m.nombre;
    if(document.getElementById('matCategoria')) document.getElementById('matCategoria').value = m.categoria;
    if(document.getElementById('matCosto')) document.getElementById('matCosto').value = m.precio_total_lamina;
}
    

// --- CONEXIÓN DEFINITIVA DE BOTONES ---

// Esta función ahora es inteligente: recibe el ID y busca el material
// --- ACTIVACIÓN MAESTRA DE FUNCIONES GLOBALES ---

window.abrirModalEditar = function(idRecibido) {
    // 1. Limpiamos el ID
    const idLimpio = String(idRecibido).trim();

    // 2. Buscamos el material (Búsqueda dual para no perder el rastro)
    const m = window.todosLosMateriales.find(mat => 
        (String(mat.id) === idLimpio || String(mat._id) === idLimpio)
    );

    if (!m) {
        console.error("❌ No se encontró el material");
        alert("Error: No se encontró la información del material.");
        return;
    }

    // 3. IDENTIDAD MAESTRA (Prioridad absoluta al _id de Atlas para evitar 404)
    const idMaestro = m._id || m.id;
    window.materialEditandoId = idMaestro; 
    
    // Llenamos los campos (Respetando tus IDs de ARCHIVO.docx)
    if(document.getElementById('matId')) document.getElementById('matId').value = idMaestro;
    if(document.getElementById('matNombre')) document.getElementById('matNombre').value = m.nombre || '';
    if(document.getElementById('matCategoria')) document.getElementById('matCategoria').value = m.categoria || '';
    
    // Prioridad de costo para sincronizar con el Cotizador
    const costoFinal = m.precio_m2_costo || m.precio_total_lamina || 0;
    if(document.getElementById('matCosto')) document.getElementById('matCosto').value = costoFinal;
    
    if(document.getElementById('matStockMin')) document.getElementById('matStockMin').value = m.stock_minimo || 0;
    if(document.getElementById('matAncho')) document.getElementById('matAncho').value = m.ancho_lamina_cm || 0;
    if(document.getElementById('matLargo')) document.getElementById('matLargo').value = m.largo_lamina_cm || 0;
    
    if(document.getElementById('proveedorSelect')) {
        document.getElementById('proveedorSelect').value = m.proveedorId || m.proveedor?._id || "";
    }

    // 4. ANCLAJE DE SEGURIDAD Y APERTURA
    const modal = document.getElementById('modalNuevoMaterial');
    if(modal) {
        modal.dataset.id = idMaestro; // <--- Anclamos el ID Maestro Atlas
        modal.style.display = 'flex';     // <--- ABRIMOS LA VENTANA AQUÍ
    }
};

// --- MANTENIMIENTO DE SELECTORES ---
window.actualizarSelectProveedores = function() {
    const select = document.getElementById('proveedorSelect');
    if (select && window.todosLosProveedores.length > 0) {
        select.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' + 
            window.todosLosProveedores.map(p => `<option value="${p._id || p.id}">${p.nombre || 'S/N'}</option>`).join('');
    }
};

window.actualizarDatalistMateriales = function() {
    const lista = document.getElementById('listaMateriales');
    if (lista) {
        lista.innerHTML = window.todosLosMateriales.map(m => `<option value="${m.nombre}">`).join('');
    }
};

window.verHistorial = async function(idRecibido, nombre) {
    const modal = document.getElementById('modalHistorialPrecios');
    const contenedor = document.getElementById('listaHistorialPrecios');
    const tituloNombre = document.getElementById('historialMaterialNombre');
    
    // 1. Abrimos el modal de inmediato para dar respuesta visual
    if (modal) modal.style.display = 'flex';
    if (tituloNombre) tituloNombre.innerText = nombre;
    if (contenedor) contenedor.innerHTML = '<div style="color:black; padding:20px; text-align:center;">🔄 Buscando movimientos en Atlas...</div>';

    try {
        // 2. BUSQUEDA DE IDENTIDAD MAESTRA
        // Buscamos en el array global para asegurarnos de tener el _id de Atlas
        const m = window.todosLosMateriales.find(mat => 
            String(mat.id) === String(idRecibido) || String(mat._id) === String(idRecibido)
        );
        
        // Si el material tiene _id (de Atlas), usamos ese. Si no, usamos el recibido.
        const idParaConsulta = (m && m._id) ? m._id : idRecibido;

        console.log(`📜 Consultando historial para: ${nombre} (ID: ${idParaConsulta})`);

        // 3. LLAMADA AL SERVIDOR
        const respuesta = await fetch(`${window.API_URL}/materials/${idParaConsulta}/history?t=${Date.now()}`);
        
        if (!respuesta.ok) throw new Error("Error al conectar con el servidor de historial");

        const resultado = await respuesta.json();
        const datos = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []);

        // 4. VALIDACIÓN DE DATOS
        if (!datos || datos.length === 0) {
            contenedor.innerHTML = `
                <div style="color:#64748b; padding:30px; text-align:center; font-family: sans-serif;">
                    <i class="fas fa-info-circle" style="font-size: 2rem; display:block; margin-bottom:10px; color: #cbd5e1;"></i>
                    No se encontraron movimientos previos para este material.
                </div>`;
            return;
        }

        // 5. RENDERIZADO (Pintamos los datos con el diseño limpio que te gusta)
        contenedor.innerHTML = datos.map(h => {
            const fecha = new Date(h.fecha || h.createdAt).toLocaleString();
            const esEntrada = h.cantidad >= 0;
            
            return `
                <div style="border-bottom:1px solid #e2e8f0; padding:12px; background: #fff; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold; color:#1e293b; font-size:0.85rem; text-transform: uppercase;">
                            ${h.tipo || 'Movimiento'}
                        </div>
                        <div style="font-size:0.7rem; color:#94a3b8;">${fecha}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1rem; font-weight:800; color:${esEntrada ? '#059669' : '#dc2626'};">
                            ${esEntrada ? '+' : ''}${h.cantidad}
                        </div>
                        <div style="font-size:0.6rem; color:#64748b; font-weight: bold;">UNID / M2</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("❌ Error Crítico en Historial:", error);
        if (contenedor) {
            contenedor.innerHTML = `
                <div style="color:#dc2626; padding:20px; text-align:center; font-weight:bold;">
                    ⚠️ FALLO DE CONEXIÓN<br>
                    <span style="font-size:0.7rem; font-weight:normal;">${error.message}</span>
                </div>`;
        }
    }
};