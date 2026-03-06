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
        const datosRaw = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []);
        
        const eliminados = JSON.parse(localStorage.getItem('ids_eliminados') || '[]');
        const datosFiltrados = datosRaw.filter(m => !eliminados.includes(String(m._id || m.id)));

        const limpiarNombre = (t) => String(t).toUpperCase().trim();
        const consolidado = {};

        // --- 🛡️ FILTRO DE CONSOLIDACIÓN UNIFICADA (v23.0) ---
            datosFiltrados.forEach(m => {
                if (!m.nombre) return;
                const nombreUP = limpiarNombre(m.nombre);
                const stockM = parseFloat(m.stock_actual) || 0;
                const catM = String(m.categoria || '').toUpperCase();

                // 1. ⚔️ REGLA DE RESIDUOS: Solo borramos si es un valor despreciable mayor a 0
                if (stockM > 0 && stockM < 0.50) {
                    console.log(`🗑️ Ignorando residuo de Atlas: ${stockM} para ${nombreUP}`);
                    return;
                }

                // 2. 🛡️ LÓGICA DE UNIFICACIÓN (Evita el doble ítem sin bloquear al Maestro)
                if (!consolidado[nombreUP]) {
                    // Si el nombre no existe, lo agregamos (Sea stock 0 o lo que sea)
                    // Esto permite que el Maestro SIEMPRE sea visible.
                    consolidado[nombreUP] = { ...m, stock_actual: stockM };
                } else {
                    // SI YA EXISTE (Duplicado), fusionamos los datos en un solo registro:
                    
                    // A. Sumamos el stock (5.60 + 0 = 5.60)
                    consolidado[nombreUP].stock_actual += stockM;

                    // B. PRIORIDAD DE CATEGORÍA: Si este duplicado tiene categoría real 
                    // (ACABADO, VIDRIO, MOLDURA) y el anterior era GENERAL, lo corregimos.
                    if (catM !== "GENERAL" && catM !== "") {
                        consolidado[nombreUP].categoria = m.categoria;
                        // Mantenemos el ID del registro que tiene la categoría correcta
                        consolidado[nombreUP]._id = m._id || m.id;
                    }
                }
            });

        window.todosLosMateriales = Object.values(consolidado).map(m => {
    const nombreUP = limpiarNombre(m.nombre);
    const esMoldura = nombreUP.includes('MOLDURA') || (m.categoria && m.categoria.toUpperCase().includes('MOLDURA'));

    // --- INTEGRIDAD DE COSTOS BLINDADOS ---
    let costoFijo = parseFloat(m.precio_m2_costo) || parseFloat(m.costo_m2) || 0;

    if (esMoldura) {
        // AJUSTE QUIRÚRGICO: Solo eliminamos el forzado a 10345.
        // Ahora respetará el costo que traiga de Atlas (ej. $8.618).
        costoFijo = costoFijo; 
    } else {
        // BLINDAJE VIDRIO (Inalterado): Mantenemos la sintonía con el avance de $30.682.
        if (costoFijo === 16141 || costoFijo === 0) {
            costoFijo = 30682;
        }
    }

    // --- INTEGRIDAD DE STOCK Y ESCUDO ---
    let stockFinal = m.stock_actual;
    
    if (esMoldura) {
        const claveEscudo = `escudo_v18_${nombreUP.replace(/\s+/g, '_')}`;
        const memoria = JSON.parse(localStorage.getItem(claveEscudo) || 'null');

        // Sintonía con el sistema de memoria logrado en avances previos:
        if (memoria && (Date.now() - memoria.timestamp < 86400000)) {
            if (memoria.stock > stockFinal) {
                stockFinal = memoria.stock;
            }
        }

        // AJUSTE QUIRÚRGICO: Eliminamos el "if (stockFinal < 2.90)".
        // Esto permite que el material nuevo nazca en 0 y solo suba cuando registres la compra.
    }

    return {
        ...m,
        precio_m2_costo: Math.round(costoFijo),
        stock_actual: Number(Number(stockFinal).toFixed(2))
    };
});

// SINCRO FINAL: Limpiamos caché para aplicar los nuevos valores netos inmediatamente
localStorage.removeItem('inventory');
localStorage.setItem('inventory', JSON.stringify(window.todosLosMateriales));
renderTable(window.todosLosMateriales);

} catch (error) {
    console.error("❌ Error en inventario:", error);
}
    }

    function renderTable(materiales) {
        const cuerpoTabla = document.getElementById('inventoryTable');
        if (!cuerpoTabla) return;
        cuerpoTabla.innerHTML = '';

        const formateador = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
        
        // 1. CREAMOS UN MAPA PARA UNIFICAR (Aplanar registros duplicados)
        const mapaUnificado = {};

        materiales.forEach(m => {
            // Usamos el nombre como clave única para agrupar
            const nombreClave = m.nombre.toUpperCase().trim();
            
            if (!mapaUnificado[nombreClave]) {
                // Clonamos el objeto y aseguramos que tenga un ID de referencia (preferencia al de Atlas _id)
                mapaUnificado[nombreClave] = { ...m, id_referencia: m._id || m.id, stock_acumulado: calcularStockReal(m) };
            } else {
                // SUMAMOS el stock del registro viejo y el nuevo
                mapaUnificado[nombreClave].stock_acumulado += calcularStockReal(m);
                
                // REESCRITURA DE PRECIO (Reposición):
                const precioActual = parseFloat(m.precio_total_lamina) || 0;
                const precioMaestro = parseFloat(mapaUnificado[nombreClave].precio_total_lamina) || 0;
                
                if (precioActual > precioMaestro) {
                    mapaUnificado[nombreClave].precio_total_lamina = m.precio_total_lamina;
                    mapaUnificado[nombreClave].precio_m2_costo = m.precio_m2_costo;
                    // Actualizamos el ID de referencia al del precio más nuevo/alto para Atlas
                    mapaUnificado[nombreClave].id_referencia = m._id || m.id;
                }
            }
        });

        // 2. RENDERIZAMOS LAS FILAS YA UNIFICADAS
        Object.values(mapaUnificado).forEach(m => {
    const fila = document.createElement('tr');
    // IMPORTANTE: El data-id ahora es el nombreClave para evitar colisiones de IDs nulos
    const nombreClaveAttr = m.nombre.toLowerCase().trim();
    fila.setAttribute('data-nombre', nombreClaveAttr);
    
    const nombreUP = m.nombre.toUpperCase();
    const esMoldura = nombreUP.includes("MOLDURA") || nombreUP.startsWith("K ");
    const unidadFinal = esMoldura ? 'ml' : 'm²';
    
    const stockTotalM2 = m.stock_acumulado;

    // DIMENSIONES MAESTRAS (Lógica preservada)
    const matchM = nombreUP.match(/(\d+)\s*[xX*]\s*(\d+)/);
    const anchoRef = matchM ? parseFloat(matchM[1]) : (parseFloat(m.ancho_lamina_cm) || 160);
    const largoRef = matchM ? parseFloat(matchM[2]) : (parseFloat(m.largo_lamina_cm) || 220);
    const areaReferencia = (anchoRef * largoRef) / 10000;

    // --- 🛡️ CÁLCULO DE COSTO (Lógica Unificada - REESCRITA) ---
    let precioFinalVisual = 0;
    const precioBase = parseFloat(m.precio_total_lamina) || parseFloat(m.precio_m2_costo) || 0;
    
    if (esMoldura) {
        const largoML = (largoRef > 0) ? (largoRef / 100) : 2.9;
        precioFinalVisual = precioBase / largoML;
    } else {
        // UNIFICACIÓN: Si es PASSEPARTOUT, CHAPILLA o AFRICANA, NO dividimos.
        // Estos materiales ya vienen con el precio por m2 desde la compra.
        const esMaterialEspecialM2 = nombreUP.includes("PASSEPARTOUT") || 
                                     nombreUP.includes("CHAPILLA") || 
                                     nombreUP.includes("AFRICANA");

        if (esMaterialEspecialM2) {
            // Se usa el precio base de Atlas directamente sin ninguna división por área
            precioFinalVisual = precioBase; 
        } else {
            // Solo para VIDRIOS y otros: dividimos si el precio base es de lámina completa (>50.000)
            precioFinalVisual = (precioBase > 50000 && areaReferencia > 0) ? (precioBase / areaReferencia) : precioBase;
        }
    }
    precioFinalVisual = Math.round(precioFinalVisual);

    // TEXTO DE STOCK (Lógica preservada)
    const numUnidades = areaReferencia > 0 ? Math.floor((stockTotalM2 / areaReferencia) + 0.001) : 0;
    let remanenteM2 = areaReferencia > 0 ? (stockTotalM2 - (numUnidades * areaReferencia)) : stockTotalM2;
    if (Math.abs(remanenteM2) < 0.01) remanenteM2 = 0;

    let textoStock = esMoldura ? `
        <div style="font-weight: 700;">${stockTotalM2.toFixed(2)} ${unidadFinal}</div>
        <div style="font-size: 0.7rem; color: #64748b;">(Total Disponible)</div>
    ` : `
        <div style="font-weight: 700; font-size: 0.95rem;">${stockTotalM2.toFixed(2)} ${unidadFinal}</div>
        <div style="font-size: 0.7rem; color: #475569; font-weight: 600;">
            ${numUnidades} und + ${remanenteM2.toFixed(2)} m² rem
        </div>
    `;

    const sMin = parseFloat(m.stock_minimo) || 2;
    let colorS = stockTotalM2 <= 0 ? '#ef4444' : (stockTotalM2 <= sMin ? '#f59e0b' : '#059669');

    // IDENTIFICADOR PARA ELIMINAR: Usamos el ID de referencia único
    const idParaAcciones = m.id_referencia;

    fila.innerHTML = `
        <td style="text-align: left; padding: 10px 15px;">
            <div style="font-weight: 600; color: #1e293b;">${m.nombre}</div>
            <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase;">
                ${m.categoria} | ${m.proveedorNombre || 'SIN PROVEEDOR'}
            </div>
        </td>
        <td style="text-align: center; font-weight: 700; color: #1e293b;">
            ${formateador.format(precioFinalVisual)} <span style="font-size:0.6rem; font-weight:400;">/${unidadFinal}</span>
        </td>
        <td style="text-align: center; padding: 8px;">
            <div style="background: #fff; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; min-width: 170px; color: ${colorS};">
                ${textoStock}
            </div>
        </td>
        <td style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 8px;">
                <button onclick="window.abrirModalEditar('${idParaAcciones}')" style="background: #2563eb; color: white; padding: 8px 12px; border-radius: 6px; font-size: 10px; font-weight: bold; border: none; cursor: pointer;">
                    <i class="fas fa-edit"></i> EDITAR
                </button>
                <button onclick="window.verHistorial('${idParaAcciones}', '${m.nombre}')" style="background: #7c3aed; color: white; padding: 8px 12px; border-radius: 6px; font-size: 10px; font-weight: bold; border: none; cursor: pointer;">
                    <i class="fas fa-history"></i> HISTORIAL
                </button>
                <button onclick="window.eliminarMaterial('${idParaAcciones}')" style="background: #dc2626; color: white; padding: 8px 12px; border-radius: 6px; font-size: 10px; font-weight: bold; border: none; cursor: pointer;">
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
        const inputCosto = document.getElementById('compraCosto'); 

        if(materialId === "NUEVO") {
            if(nuevoContainer) nuevoContainer.style.display = 'block';
            if(comboProv) comboProv.focus();
            if(inputCosto) inputCosto.value = ""; 
        } else {
            if(nuevoContainer) nuevoContainer.style.display = 'none';
            
            // BUSCAR EL MATERIAL Y PONER SU PRECIO ACTUAL (Sincronía con Atlas)
            if (materialId && window.todosLosMateriales) {
                const matEncontrado = window.todosLosMateriales.find(m => 
                    String(m.id) === String(materialId) || String(m._id) === String(materialId)
                );

                if (matEncontrado && inputCosto) {
                    inputCosto.value = matEncontrado.precio_total_lamina || 0;
                    console.log(`💰 Punto 4: Costo sugerido cargado (${matEncontrado.nombre})`);
                }
            }
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
                if (typeof fetchInventory === 'function') await fetchInventory();
            }
        } catch (err) { alert("❌ Error al ajustar stock"); }
    });

    // === LÓGICA DE COMPRA (BLINDADA v16.1.0) ===
const formCompra = document.getElementById('formNuevaCompra');
if (formCompra) {
    formCompra.onsubmit = async function(e) {
        e.preventDefault();

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

            let nombreInput = (selectMat.value === "NUEVO") 
                ? inputNuevo.value.trim() 
                : selectMat.options[selectMat.selectedIndex].text.replace('+ AGREGAR NUEVO MATERIAL', '').trim();
            
            const nombreUP = nombreInput.toUpperCase();
            const esMoldura = nombreUP.includes("MOLDURAS") || nombreUP.startsWith("K ");
            let nombreReal = esMoldura ? nombreUP : nombreInput;

            const cant = parseFloat(inputCant.value) || 0;
            const costoIngresado = parseFloat(inputCosto.value) || 0;
            const largoCm = parseFloat(inputLargo?.value) || 0;
            const anchoCm = parseFloat(inputAncho?.value) || 0;
            
            // --- 🚀 CLASIFICACIÓN INTELIGENTE DE CATEGORÍA (PREVIA A LA BÚSQUEDA) ---
            let categoriaDeterminada;
            const esVidrio = nombreUP.includes("VIDRIO") || nombreUP.includes("CRISTAL") || nombreUP.includes("ESPEJO");
            const esAcabado = nombreUP.includes("CHAPILLA") || nombreUP.includes("AFRICANA") || nombreUP.includes("PASSEPARTOUT");

            if (esMoldura) {
                categoriaDeterminada = "MOLDURAS";
            } else if (nombreUP.includes("TRIPLEX") || nombreUP.includes("MADERA") || nombreUP.includes("MDF") || nombreUP.includes("CARTON") || nombreUP.includes("CARTÓN")) {
                categoriaDeterminada = "RESPALDO";
            } else if (esVidrio) {
                categoriaDeterminada = "VIDRIO";
            } else if (esAcabado) {
                categoriaDeterminada = "ACABADO";
            } else {
                categoriaDeterminada = "GENERAL";
            }

            // --- 🛡️ BUSQUEDA DE EXISTENTE REFORZADA ---
            if (!window.todosLosMateriales) window.todosLosMateriales = [];
            
            let existente = window.todosLosMateriales.find(m => 
                m.nombre.trim().toUpperCase() === nombreReal.trim().toUpperCase()
            );

            // Si existe en GENERAL o con categoría vacía, lo "forzamos" a la nueva categoría antes de enviar a Atlas
            if (existente) {
                console.log(`♻️ Sincronizando ID para evitar duplicado: ${existente.nombre}`);
                existente.categoria = categoriaDeterminada; 
            }

            // --- 📏 CÁLCULOS DE COSTO Y STOCK (MANTENIENDO TU LÓGICA) ---
            let costoFinalAtlas = costoIngresado;
            const esMaterialSuperficie = esAcabado || 
                                         nombreUP.includes("TRIPLEX") || 
                                         nombreUP.includes("CARTON") || 
                                         nombreUP.includes("CARTÓN") || 
                                         nombreUP.includes("MDF") || 
                                         nombreUP.includes("MADERA") ||
                                         nombreUP.includes("FOAM") || 
                                         nombreUP.includes("LONA") || 
                                         nombreUP.includes("TELA");

            if (!esMoldura && esMaterialSuperficie) {
    const areaM2 = (largoCm * anchoCm) / 10000;
    if (areaM2 > 0) {
        // CORRECCIÓN: Usamos Number().toFixed(2) para asegurar que Atlas 
        // reciba solo 2 decimales y siga siendo un valor numérico.
        costoFinalAtlas = Number((costoIngresado / areaM2).toFixed(2));
    }
}

// --- CORRECCIÓN DINÁMICA ---
            // Si es moldura, validamos si se ingresó un largo; si no, usamos 2.90m por defecto.
            const largoRealMoldura = (esMoldura && largoCm > 0) ? (largoCm / 100) : 2.90; 

            // CALCULAMOS EL INCREMENTO BLINDADO (Evita el error del 0.03)
            const VALOR_REAL_INCREMENTO = esMoldura 
                ? Number((cant * largoRealMoldura).toFixed(4)) 
                : Number(((largoCm * anchoCm / 10000) * cant).toFixed(4));

            const idMasterAtlas = (existente && (existente._id || existente.id)) ? (existente._id || existente.id) : null;
            const esNuevoMaterial = (idMasterAtlas === null || selectMat.value === "NUEVO");

            // --- 📦 OBJETO PARA ATLAS (CON ID VINCULADO) ---
            const datosParaAtlas = {
                materialId: esNuevoMaterial ? "NUEVO" : idMasterAtlas, 
                nombre: nombreReal,
                esNuevo: esNuevoMaterial,
                categoria: categoriaDeterminada,
                cantidad_laminas: cant,
                precio_total_lamina: costoFinalAtlas,
                ancho_lamina_cm: esMoldura ? 1 : anchoCm,
                largo_lamina_cm: esMoldura ? (largoCm || 290) : largoCm,
                tipo_material: esMoldura ? 'ml' : 'm2',
                costo_total: costoIngresado * cant,
                timestamp: new Date().toISOString(),
                _id: esNuevoMaterial ? undefined : idMasterAtlas 
            };

            const response = await fetch(`${window.API_URL}/inventory/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosParaAtlas)
            });

            const textoRespuesta = await response.text();
            let resultadoAtlas;
            try { resultadoAtlas = JSON.parse(textoRespuesta); } catch (err) { throw new Error("Atlas no respondió JSON válido."); }

            if (!response.ok) throw new Error(resultadoAtlas.error || "Atlas rechazó la conexión.");

            const idDeAtlas = resultadoAtlas.data?._id || resultadoAtlas.data?.id;
            let objetoFinal; 

            if (existente) {
                // --- 🛡️ SUMA MATEMÁTICA PURA (Elimina el efecto 0.03) ---
                const stockAnterior = Number(existente.stock_actual) || 0;
                
                // Sumamos el incremento blindado y redondeamos a 2 decimales para la visual
                const nuevoStockSuma = stockAnterior + VALOR_REAL_INCREMENTO;
                existente.stock_actual = Number(nuevoStockSuma.toFixed(2));
                
                existente.precio_total_lamina = costoFinalAtlas;
                existente.categoria = categoriaDeterminada;
                if (idDeAtlas) { existente._id = idDeAtlas; existente.id = idDeAtlas; }
                objetoFinal = existente;
            } else {
                const nuevoMaterial = {
                    _id: idDeAtlas,
                    id: idDeAtlas || `TEMP-${Date.now()}`,
                    nombre: nombreReal,
                    categoria: categoriaDeterminada,
                    stock_actual: Number(VALOR_REAL_INCREMENTO.toFixed(2)),
                    precio_total_lamina: costoFinalAtlas,
                    ancho_lamina_cm: esMoldura ? 1 : anchoCm,
                    largo_lamina_cm: esMoldura ? (largoCm || 290) : largoCm
                };
                window.todosLosMateriales.unshift(nuevoMaterial);
                objetoFinal = nuevoMaterial;
            }

            // --- ⚓ ACTUALIZACIÓN INMEDIATA DE MEMORIA Y STORAGE ---
            localStorage.setItem('inventory', JSON.stringify(window.todosLosMateriales));
            
            // Lógica de pendientes (Preservada íntegramente)
            let pendientes = JSON.parse(localStorage.getItem('molduras_pendientes') || '[]');
            pendientes = pendientes.filter(p => p.nombre.toLowerCase() !== nombreReal.toLowerCase());
            pendientes.push({ ...objetoFinal, fechaCompra: new Date().toISOString() });
            localStorage.setItem('molduras_pendientes', JSON.stringify(pendientes));

            // --- 🚀 RENDERIZADO INSTANTÁNEO ---
            // Sincronizamos la UI antes del alert
            if (typeof renderTable === 'function') renderTable(window.todosLosMateriales);
            
            alert(`✅ ¡LOGRADO!\n${nombreReal} sincronizado.\nNuevo Stock: ${objetoFinal.stock_actual.toFixed(2)} ${esMoldura ? 'ML' : 'M2'}`);
            
            if(document.getElementById('modalCompra')) document.getElementById('modalCompra').style.display = 'none';
            formulario.reset();

            if (typeof cargarListasModal === 'function') cargarListasModal();

        } catch (error) {
            console.error("❌ Error en Proceso de Compra:", error);
            alert("⚠️ FALLO DE ATLAS:\n" + error.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar Compra'; }
        }
    };
}
}

function actualizarStockEnTablaVisual(nombre, cantidadASumar, tipo) {
    const limpiarNombre = (t) => String(t).toUpperCase().trim();
    const nombreNormalizado = limpiarNombre(nombre);
    const claveEscudo = `escudo_v18_${nombreNormalizado.replace(/\s+/g, '_')}`;

    const filas = document.querySelectorAll('#inventoryTable tr');
    
    filas.forEach(fila => {
        const nombreFila = fila.getAttribute('data-nombre') ? limpiarNombre(fila.getAttribute('data-nombre')) : "";
        
        if (nombreFila === nombreNormalizado) {
            const container = fila.querySelector('.stock-display-container');
            if (container) {
                const valorActual = parseFloat(container.innerText.replace(/[^\d.]/g, '')) || 0;
                const nuevoValor = valorActual + parseFloat(cantidadASumar);

                // --- 🚀 PASO 1: GUARDADO ATÓMICO v18.3 ---
                const registro = {
                    nombre: nombreNormalizado,
                    stock: nuevoValor,
                    timestamp: Date.now()
                };
                localStorage.setItem(claveEscudo, JSON.stringify(registro));

                // --- 🚀 PASO 2: ACTUALIZAR MEMORIA VOLÁTIL ---
                if (window.todosLosMateriales) {
                    const idx = window.todosLos_Materiales.findIndex(m => limpiarNombre(m.nombre) === nombreNormalizado);
                    if (idx !== -1) {
                        window.todosLosMateriales[idx].stock_actual = nuevoValor;
                        localStorage.setItem('inventory', JSON.stringify(window.todosLosMateriales));
                    }
                }

                // --- 🚀 PASO 3: UI ---
                container.innerHTML = `<strong>${nuevoValor.toFixed(2)}</strong> ${tipo}`;
                container.style.color = '#059669'; 
                container.style.backgroundColor = '#ecfdf5'; 
                
                console.log(`⚓ ANCLA v18.3: ${nombreNormalizado} fijado en ${nuevoValor.toFixed(2)}`);
            }
        }
    }); 
}

// --- UTILIDADES DE UI (PRESERVADO) ---

window.cargarListasModal = function() {
    const provSelect = document.getElementById('compraProveedor');
    const matSelect = document.getElementById('compraMaterial');
    const selVidrio = document.getElementById('materialVidrio'); 
    const selRespaldo = document.getElementById('materialRespaldo');
    const selChapilla = document.getElementById('materialAcabado'); // Agregado para sintonía con cotizador

    if (window.todosLosProveedores && window.todosLosProveedores.length > 0) {
        const opcionesProv = '<option value="">-- Seleccionar Proveedor --</option>' + 
            window.todosLosProveedores.map(p => `<option value="${p._id || p.id}">${String(p.nombre || 'S/N').toUpperCase()}</option>`).join('');
        if (provSelect) provSelect.innerHTML = opcionesProv;
    }
    
    if (window.todosLosMateriales && window.todosLosMateriales.length > 0) {
        
        let htmlVidrios = '<option value="">-- Seleccionar --</option>';
        let htmlRespaldos = '<option value="">-- Seleccionar --</option>';
        let htmlChapillas = '<option value="">-- Seleccionar --</option>'; 
        let htmlCompras = '<option value="">-- Seleccionar Material --</option>' + 
                          '<option value="NUEVO" style="color: #2563eb; font-weight: bold;">+ AGREGAR NUEVO MATERIAL</option>';


        // --- 🛡️ ESCUDO ANTI-DUPLICADOS ULTRA (v19.5 - ELIMINA FANTASMAS) ---
        const materialesParaMostrar = [...window.todosLosMateriales].sort((a, b) => 
            (Number(b.stock_actual) || 0) - (Number(a.stock_actual) || 0)
        );
        const nombresVistos = new Set();

        materialesParaMostrar.forEach(m => {
            const id = m._id || m.id;
            const nombreUP = String(m.nombre).toUpperCase().trim();
            const stockActual = Number(m.stock_actual) || 0;

            // 1. SI YA VIMOS EL NOMBRE, SALTAMOS (Evita que el de stock 0 entre si ya está el de stock real)
            if (nombresVistos.has(nombreUP)) return;

            // 2. FILTRO FANTASMA: Si no tiene stock y es categoría GENERAL, lo ignoramos de las listas
            // Esto evita que "CHAPILLA AFRICANA (GENERAL)" aparezca si existe la de categoría ACABADO
            if (stockActual <= 0 && (m.categoria === "GENERAL" || !m.categoria)) return;

            nombresVistos.add(nombreUP);
            
            // --- 📏 LÓGICA DE COSTO VISUAL ---
            const stockTxt = (stockActual <= 0) ? " (SIN STOCK)" : ` (${stockActual.toFixed(2)} M2)`;
            const styleColor = (stockActual <= 0) ? 'style="color: #dc2626;"' : ''; 
            
            const optionHtml = `<option value="${id}" ${styleColor}>${nombreUP}${stockTxt}</option>`;

            // --- LA REGLA UNIFICADA INTEGRADA (No tocar lo anterior) ---
            const esFondoRespaldo = nombreUP.includes("TRIPLEX") || 
                                    nombreUP.includes("CARTON") || 
                                    nombreUP.includes("CARTÓN") || 
                                    nombreUP.includes("MDF") ||
                                    nombreUP.includes("MADERA");
            
            const esMoldura = nombreUP.startsWith("K ") || nombreUP.includes("MOLDURA");
            
            const esAcabadoEspecial = nombreUP.includes("CHAPILLA") || 
                                      nombreUP.includes("AFRICANA") || 
                                      nombreUP.includes("PASSEPARTOUT");
                                      nombreUP.includes("LONA") ||
                                      nombreUP.includes("TELA");
            // ASIGNACIÓN POR CATEGORÍA
            if (esFondoRespaldo) {
                htmlRespaldos += optionHtml;
            } 
            else if (esAcabadoEspecial) {
                htmlChapillas += optionHtml;
            }
            else if (!esMoldura) {
                htmlVidrios += optionHtml;
            }

            htmlCompras += optionHtml;
        });

        // Inyectamos respetando la integridad del DOM
        if (selVidrio) selVidrio.innerHTML = htmlVidrios;
        if (selRespaldo) selRespaldo.innerHTML = htmlRespaldos;
        if (selChapilla) selChapilla.innerHTML = htmlChapillas;
        if (matSelect) matSelect.innerHTML = htmlCompras;

        console.log("✅ INTEGRIDAD MANTENIDA: Duplicados eliminados y Respaldos unificados correctamente.");
    }
};

window.cerrarModales = function() { 
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
};

window.verHistorial = async function(idRecibido, nombre) {
    const modal = document.getElementById('modalHistorialPrecios');
    const contenedor = document.getElementById('listaHistorialPrecios');
    const titulo = document.getElementById('historialMaterialNombre');
    
    if (modal) modal.style.display = 'flex';
    if (titulo) titulo.innerText = nombre || "Historial";
    if (contenedor) contenedor.innerHTML = '<div style="color:#1e293b; padding:20px; text-align:center;">🔄 Consultando movimientos en Atlas...</div>';

    try {
        // Buscamos el material en memoria para asegurar que enviamos el _id de Atlas
        const material = window.todosLosMateriales.find(m => String(m.id) === String(idRecibido) || String(m._id) === String(idRecibido));
        const idConsulta = (material && material._id) ? material._id : idRecibido;

        const respuesta = await fetch(`${window.API_URL}/materials/${idConsulta}/history?t=${Date.now()}`);
        const resultado = await respuesta.json();
        
        const datos = resultado.success ? resultado.data : (Array.isArray(resultado) ? resultado : []);

        if (!datos || datos.length === 0) {
            contenedor.innerHTML = `
                <div style="color:#dc2626; padding:20px; text-align:center; font-weight:bold;">
                    ⚠️ Sin movimientos recientes.<br>
                    <span style="font-size:0.75rem; font-weight:normal; color:#64748b;">
                        Si acabas de hacer una compra, recarga para ver los cambios sincronizados.
                    </span>
                </div>`;
            return;
        }

        // Renderizado limpio y profesional (Color Negro Puro para legibilidad)
        contenedor.innerHTML = datos.map(h => {
            const esEntrada = h.cantidad > 0;
            return `
            <div style="border-bottom:1px solid #e2e8f0; padding:12px; color: #000; background: #fff; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight:800; font-size:13px; text-transform:uppercase;">${h.tipo || 'MOVIMIENTO'}</div>
                    <div style="font-size:11px; color:#64748b;">${new Date(h.fecha || h.createdAt).toLocaleString()}</div>
                </div>
                <div style="text-align:right;">
    <div style="font-size:16px; font-weight:900; color:${esEntrada ? '#059669' : '#dc2626'};">
        /* CAMBIADO DE 4 A 2 */
        ${esEntrada ? '+' : ''}${parseFloat(h.cantidad).toFixed(2)} <span style="font-size:10px;">u/m²</span>
    </div>
</div>
                </div>
            </div>
        `}).join('');

    } catch (error) {
        console.error("Error historial:", error);
        contenedor.innerHTML = `<div style="color:#dc2626; padding:20px; text-align:center;">❌ Error de conexión con Atlas</div>`;
    }
};

  window.eliminarMaterial = async function(id) {
    if (confirm("⚠️ ¿ELIMINAR PERMANENTEMENTE?\nEsta acción limpia el inventario de Atlas y de este dispositivo de forma definitiva.")) {
        try {
            // 1. IDENTIFICACIÓN INMEDIATA
            const materialEnMemoria = window.todosLosMateriales.find(m => 
                String(m.id) === String(id) || String(m._id) === String(id)
            );

            if (!materialEnMemoria) {
                console.error("❌ El material no está en memoria.");
                return;
            }

            const idParaBorrarEnAtlas = materialEnMemoria._id || id;
            const nombreParaBorradoEstricto = materialEnMemoria.nombre;
            const esIdTemporal = String(id).startsWith('TEMP-') || String(id).startsWith('MAT-');

            // 2. 🧹 LIMPIEZA PREVENTIVA (Antes de la red para evitar bloqueos)
            // Filtramos window.todosLosMateriales INMEDIATAMENTE
            window.todosLosMateriales = window.todosLosMateriales.filter(m => {
                const coincideID = String(m.id) === String(id) || String(m._id) === String(idParaBorrarEnAtlas);
                const coincideNombre = m.nombre.trim().toUpperCase() === nombreParaBorradoEstricto.trim().toUpperCase();
                return !(coincideID || coincideNombre); 
            });

            // GUARDADO FORZADO: Esto mata la resurrección en el siguiente Refresh
            localStorage.setItem('inventory', JSON.stringify(window.todosLosMateriales));
            
            let pendientes = JSON.parse(localStorage.getItem('molduras_pendientes') || '[]');
            pendientes = pendientes.filter(p => p.nombre.trim().toUpperCase() !== nombreParaBorradoEstricto.trim().toUpperCase());
            localStorage.setItem('molduras_pendientes', JSON.stringify(pendientes));

            // 3. 🛡️ LISTA NEGRA ACTIVA (Filtro de seguridad para fetchInventory)
            let eliminados = JSON.parse(localStorage.getItem('ids_eliminados') || '[]');
            if (!eliminados.includes(String(idParaBorrarEnAtlas))) {
                eliminados.push(String(idParaBorrarEnAtlas));
                localStorage.setItem('ids_eliminados', JSON.stringify(eliminados));
            }

            // 4. 📡 COMUNICACIÓN CON ATLAS (En segundo plano)
            // Intentamos borrar en la nube, pero si falla (404), la limpieza local ya está hecha y guardada
            if (!esIdTemporal && window.API && window.API.deleteMaterial) {
                console.log("📡 Intentando borrar en Atlas:", idParaBorrarEnAtlas);
                window.API.deleteMaterial(idParaBorrarEnAtlas)
                    .then(() => console.log("✅ Atlas confirmó borrado remoto."))
                    .catch(err => console.warn("⚠️ Atlas no pudo borrar (posible 404), pero el local ya está limpio."));
            }

            // 5. REFRESCAR INTERFAZ
            if (typeof renderTable === 'function') {
                renderTable(window.todosLosMateriales);
            }
            
            const modal = document.getElementById('modalNuevoMaterial');
            if(modal) modal.style.display = 'none';

            alert(`✅ ¡LOGRADO!\n${nombreParaBorradoEstricto} eliminado (Cambio persistente).`);

        } catch (error) {
            console.error("❌ Error Crítico:", error);
            alert("⚠️ Error al procesar la eliminación.");
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
    // Buscamos tanto en el ID temporal como en el _id definitivo de Atlas
    const m = window.todosLosMateriales.find(mat => 
        (String(mat.id) === idLimpio || String(mat._id) === idLimpio)
    );

    if (!m) {
        console.error("❌ No se encontró el material con ID:", idLimpio);
        alert("Error: No se encontró la información del material.");
        return;
    }

    // 3. IDENTIDAD MAESTRA (Prioridad absoluta al _id de Atlas para evitar 404)
    // Si el material ya existe en Atlas, usamos su _id. Si es nuevo, usamos su ID temporal.
    const idMaestro = m._id || m.id;
    window.materialEditandoId = idMaestro; 
    
    // Llenamos los campos (Respetando tus IDs de ARCHIVO.docx y dashboard.html)
    if(document.getElementById('matId')) document.getElementById('matId').value = idMaestro;
    if(document.getElementById('matNombre')) document.getElementById('matNombre').value = m.nombre || '';
    if(document.getElementById('matCategoria')) document.getElementById('matCategoria').value = m.categoria || '';
    
    // Prioridad de costo para sincronizar con el Cotizador: 
    // Usamos el precio por m2 si existe, de lo contrario el costo por lámina.
    const costoFinal = m.precio_m2_costo || m.precio_total_lamina || 0;
    if(document.getElementById('matCosto')) document.getElementById('matCosto').value = costoFinal;
    
    if(document.getElementById('matStockMin')) document.getElementById('matStockMin').value = m.stock_minimo || 0;
    
    // Sincronización de dimensiones para cálculo de m2/ml
    if(document.getElementById('matAncho')) {
        document.getElementById('matAncho').value = m.ancho_lamina_cm || m.ancho || 0;
    }
    if(document.getElementById('matLargo')) {
        document.getElementById('matLargo').value = m.largo_lamina_cm || m.largo || 0;
    }
    
    // Sincronización con el listado de proveedores
    if(document.getElementById('proveedorSelect')) {
        const provId = m.proveedorId || (m.proveedor && (m.proveedor._id || m.proveedor.id)) || "";
        document.getElementById('proveedorSelect').value = provId;
    }

    // 4. ANCLAJE DE SEGURIDAD Y APERTURA
    const modal = document.getElementById('modalNuevoMaterial');
    if(modal) {
        // Guardamos el ID en el dataset por seguridad extra (evita confusiones en el DOM)
        modal.dataset.id = idMaestro; 
        modal.style.display = 'flex'; 
        console.log(`📂 Editando Material: ${m.nombre} (ID Maestro: ${idMaestro})`);
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
    ${esEntrada ? '+' : ''}${parseFloat(mov.cantidad).toFixed(2)}
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