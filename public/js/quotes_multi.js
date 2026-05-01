/**
 * Cotizador Multi-Cuadro - MARQUETERÍA LA CHICA MORALES
 * Versión: 1.0.0
 * Permite agregar varios cuadros con medidas distintas y genera UNA sola cotización.
 */

// ─── ESTADO GLOBAL ───────────────────────────────────────────────────────────
let materialesOriginalesMulti = [];
let cuadros = [];          // Array de objetos calculados, uno por cuadro
let cuadroCounter = 0;     // Contador para asignar IDs únicos a cada formulario

const MULTI_API_BASE =
    typeof window.resolveApiBase === 'function'
        ? window.resolveApiBase()
        : ((['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:')
            ? 'https://marqueterialachica.netlify.app/.netlify/functions/server'
            : `${window.location.origin}/.netlify/functions/server`);

// ─── UTILIDADES ──────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

function obtenerMLConDesperdicioMulti(ancho, largo, desperdicioCM) {
    const perimetroCM = (parseFloat(ancho) + parseFloat(largo)) * 2;
    const totalML = (perimetroCM + parseFloat(desperdicioCM || 0)) / 100;
    return Number(totalML.toFixed(3));
}

// ─── CARGA DE MATERIALES DESDE API ───────────────────────────────────────────
async function cargarMaterialesMulti() {
    try {
        const response = await fetch(`${MULTI_API_BASE}/quotes/materials`);
        const result = await response.json();

        if (!result.success) throw new Error('API no respondió con success');

        let inventarioHibrido = result.data.todos || [];

        // Rescate desde localStorage (igual que el cotizador original)
        const localMaterials = JSON.parse(localStorage.getItem('inventory') || '[]');
        localMaterials.forEach(lm => {
            const nombreLimpio = (lm.nombre || '').trim().toUpperCase();
            const yaExiste = inventarioHibrido.some(m => (m.nombre || '').trim().toUpperCase() === nombreLimpio);
            if (!yaExiste && nombreLimpio !== '') {
                inventarioHibrido.push({
                    ...lm,
                    costo_base: lm.costo_m2 || lm.precio_m2_costo || 0,
                    stock_actual: lm.stock_actual || 0,
                    unidad: (lm.tipo || 'm2').toUpperCase()
                });
            }
        });

        // Anti-duplicados
        const vistos = new Set();
        materialesOriginalesMulti = [];
        inventarioHibrido.forEach(m => {
            const key = (m.nombre || '').trim().toUpperCase();
            if (!vistos.has(key) && key !== '' && !key.includes('UNDEFINED')) {
                vistos.add(key);
                materialesOriginalesMulti.push(m);
            }
        });

        console.log('✅ Multi-cotizador: materiales cargados:', materialesOriginalesMulti.length);
        const cuadrosExistentes = document.querySelectorAll('.cuadro-form');
        if (cuadrosExistentes.length > 0) {
            cuadrosExistentes.forEach(form => {
                const id = parseInt(form.id.replace('cuadro-form-', ''));
                if (!Number.isNaN(id)) poblarSelectsCuadro(id);
            });
            actualizarBotones();
        } else {
            agregarCuadro();
        }

    } catch (err) {
        console.error('🚨 Error cargando materiales (multi-cotizador):', err);
        const listaCuadros = document.getElementById('lista-cuadros');
        if (listaCuadros && listaCuadros.children.length === 0) {
            listaCuadros.innerHTML =
                '<p style="color:red;padding:20px;">Error al cargar materiales. Verifica tu conexión.</p>';
        }
    }
}

// ─── LLENADO DE SELECTS ───────────────────────────────────────────────────────
function llenarSelectMulti(select, filtroBusqueda, esParaBuscador = false, datalist = null) {
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccionar --</option>';

    const filtrados = materialesOriginalesMulti.filter(filtroBusqueda);
    if (filtrados.length === 0) {
        select.innerHTML = '<option value="">-- No disponible --</option>';
        return;
    }

    const frag = document.createDocumentFragment();
    const fragDl = datalist ? document.createDocumentFragment() : null;

    filtrados.forEach(m => {
        if (!m.nombre || m.nombre.trim() === '' || m.nombre.includes('undefined')) return;

        const stock = m.stock_actual || 0;
        let unidad = (m.unidad || m.tipo || 'm2').toUpperCase();
        const nombreM = m.nombre.toUpperCase();
        const categoriaM = (m.categoria || '').toUpperCase();

        const esML =
            unidad === 'ML' ||
            nombreM.includes('MOLDURA') ||
            nombreM.includes('MARCO') ||
            nombreM.startsWith('K ') ||
            nombreM.includes('2312') ||
            categoriaM.includes('MOLDURA');

        if (esML) unidad = 'ML';

        const avisoStock = stock <= 0 ? '(SIN STOCK)' : `(${stock.toFixed(2)} ${unidad})`;

        const option = document.createElement('option');
        option.value = m._id || m.id;
        if (stock <= 0) option.style.cssText = 'color:#ef4444;font-weight:bold;';

        const precio = m.precio_m2_costo || m.costo_m2 || m.costo_base || 0;
        option.dataset.costo = precio;

        let desperdicio = parseFloat(m.desperdicio_total_cm || m.desperdicio || m.merma || m.desperdicio_ml || 0);
        if (esML && desperdicio === 0 && m.ancho_lamina_cm && m.ancho_lamina_cm !== 100) {
            desperdicio = parseFloat(m.ancho_lamina_cm);
        }

        option.dataset.desperdicio = desperdicio;
        option.dataset.unidad = unidad;
        option.dataset.categoria = categoriaM;
        // NOTA: dataset.full eliminado — era la causa del congelamiento
        option.textContent = `${nombreM} ${avisoStock}`;

        frag.appendChild(option);

        // Si es moldura y hay datalist, la agregamos para el buscador
        if (esML && fragDl && esParaBuscador) {
            const opt = document.createElement('option');
            opt.value = nombreM;
            opt.dataset.id = m._id || m.id;
            fragDl.appendChild(opt);
        }
    });

    select.appendChild(frag);
    if (datalist && fragDl) datalist.appendChild(fragDl);
}

// ─── CREAR FORMULARIO DE CUADRO ───────────────────────────────────────────────
function crearFormularioCuadro(id) {
    const div = document.createElement('div');
    div.id = `cuadro-form-${id}`;
    div.className = 'cuadro-form';
    div.innerHTML = `
        <div class="cuadro-header">
            <span class="cuadro-numero">🖼️ Cuadro #${id}</span>
            <button class="btn-eliminar-cuadro" onclick="eliminarCuadro(${id})" title="Eliminar este cuadro">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <div class="cuadro-descripcion-row">
            <div class="input-group" style="flex:2">
                <label>Descripción / Referencia</label>
                <input type="text" id="desc-${id}" placeholder="Ej: Foto familiar, Óleo abstracto...">
            </div>
            <div class="input-group" style="flex:1">
                <label>Ancho (cm)</label>
                <input type="number" id="ancho-${id}" placeholder="Ej: 70">
            </div>
            <div class="input-group" style="flex:1">
                <label>Largo (cm)</label>
                <input type="number" id="largo-${id}" placeholder="Ej: 100">
            </div>
        </div>

        <div class="materiales-grid-multi">
            <div class="input-group">
                <label style="font-size:0.85em;">Vidrio / Espejo</label>
                <select id="vidrio-${id}" class="mat-sel-multi"></select>
            </div>
            <div class="input-group">
                <label style="font-size:0.85em;">Respaldo (MDF/Triplex)</label>
                <select id="respaldo-${id}" class="mat-sel-multi"></select>
            </div>
            <div class="input-group">
                <label style="font-size:0.85em;">Passepartout</label>
                <select id="paspartu-${id}" class="mat-sel-multi"></select>
            </div>
            <div class="input-group" style="position:relative;">
                <label style="font-size:0.85em; color:#1e3a8a; font-weight:800;">
                    <i class="fas fa-search"></i> Marco / Moldura 1 (Escriba Código o Use Flecha)
                </label>
                <div style="position:relative;">
                    <input type="text"
                           list="lista-molduras-${id}"
                           id="input-moldura-${id}"
                           placeholder="Ej: K 2312..."
                           oninput="sincronizarMolduraMulti(${id}, this.value)"
                           style="border:2px solid #3498db; background:#fff; width:100%; padding:12px; border-radius:8px; box-sizing:border-box; font-weight:bold; padding-right:30px;">
                    <i class="fas fa-chevron-down" style="position:absolute; right:10px; top:15px; color:#3498db; pointer-events:none;"></i>
                </div>
                <datalist id="lista-molduras-${id}"></datalist>
                <select id="marco-${id}" style="display:none;"></select>
            </div>
            <div class="input-group" style="position:relative;">
                <label style="font-size:0.85em; color:#7c3aed; sfont-weight:800;">
                    <i class="fas fa-search"></i> Marco / Moldura 2 (Escriba Código o Use Flecha)
                </label>
                <div style="position:relative;">
                    <input type="text"
                           list="lista-molduras2-${id}"
                           id="input-moldura2-${id}"
                           placeholder="Ej: K 2311..."
                           oninput="sincronizarMoldura2Multi(${id}, this.value)"
                           style="border:2px solid #7c3aed; background:#fff; width:100%; padding:12px; border-radius:8px; box-sizing:border-box; font-weight:bold; padding-right:30px;">
                    <i class="fas fa-chevron-down" style="position:absolute; right:10px; top:15px; color:#7c3aed; pointer-events:none;"></i>
                </div>
                <datalist id="lista-molduras2-${id}"></datalist>
                <select id="marco2-${id}" style="display:none;"></select>
            </div>
            <div class="input-group">
                <label style="font-size:0.85em;">Foam Board</label>
                <select id="foam-${id}" class="mat-sel-multi"></select>
            </div>
            <div class="input-group">
                <label style="font-size:0.85em;">Láminas (Esponja / Icopor)</label>
                <select id="lamina-${id}" class="mat-sel-multi"></select>
            </div>
            <div class="input-group">
                <label style="font-size:0.85em;">Tela / Lona</label>
                <select id="tela-${id}" class="mat-sel-multi"></select>
            </div>
            <div class="input-group">
                <label style="font-size:0.85em;">Acabado Especial (Chapilla)</label>
                <select id="chapilla-${id}" class="mat-sel-multi"></select>
            </div>
        </div>

        <div class="cuadro-footer-row">
            <div class="input-group" style="flex:1">
                <label>Mano de Obra ($)</label>
                <input type="number" id="mo-${id}" value="0">
            </div>
            <div class="input-group" style="flex:1">
                <label>Abono Parcial ($)</label>
                <input type="number" id="abono-cuadro-${id}" value="0" min="0" style="border:2px solid #fbbf24; font-weight:700;">
            </div>
            <div class="input-group" style="flex:0 0 110px;">
                <label>Cantidad</label>
                <input type="number" id="cantidad-${id}" value="1" min="1" step="1"
                       style="border:2px solid #10b981; font-weight:800; font-size:1.1rem; text-align:center;">
            </div>
            <button class="btn-calcular-cuadro" onclick="calcularCuadro(${id})">
                <i class="fas fa-calculator"></i> Calcular este cuadro
            </button>
        </div>

        <div id="resultado-cuadro-${id}" class="resultado-cuadro" style="display:none;"></div>
    `;
    return div;
}

// ─── SINCRONIZADOR DE MOLDURA 1 (igual lógica que el original) ─────────────────
function sincronizarMolduraMulti(id, valor) {
    const selectMarco = document.getElementById(`marco-${id}`);
    const datalist = document.getElementById(`lista-molduras-${id}`);
    if (!datalist || !selectMarco) return;
    for (let i = 0; i < datalist.options.length; i++) {
        if (datalist.options[i].value === valor.toUpperCase()) {
            selectMarco.value = datalist.options[i].dataset.id;
            selectMarco.style.backgroundColor = '#e0f2fe';
            setTimeout(() => (selectMarco.style.backgroundColor = ''), 500);
            return;
        }
    }
}

// ─── SINCRONIZADOR DE MOLDURA 2 ───────────────────────────────────────────────
function sincronizarMoldura2Multi(id, valor) {
    const selectMarco2 = document.getElementById(`marco2-${id}`);
    const datalist2 = document.getElementById(`lista-molduras2-${id}`);
    if (!datalist2 || !selectMarco2) return;
    for (let i = 0; i < datalist2.options.length; i++) {
        if (datalist2.options[i].value === valor.toUpperCase()) {
            selectMarco2.value = datalist2.options[i].dataset.id;
            selectMarco2.style.backgroundColor = '#f3e8ff';
            setTimeout(() => (selectMarco2.style.backgroundColor = ''), 500);
            return;
        }
    }
}

// ─── POBLAR SELECTS DE UN CUADRO ──────────────────────────────────────────────
function poblarSelectsCuadro(id) {
    const datalist = document.getElementById(`lista-molduras-${id}`);
    if (datalist) datalist.innerHTML = '';

    llenarSelectMulti(document.getElementById(`vidrio-${id}`), m => {
        const n = (m.nombre || '').toUpperCase();
        const esRespaldo = n.includes('TRIPLEX') || n.includes('CARTON') || n.includes('CARTÓN') || n.includes('MDF');
        return (n.includes('VIDRIO') || n.includes('ESPEJO') || n.includes('3MM') || n.includes('2MM')) && !esRespaldo;
    });

    llenarSelectMulti(document.getElementById(`respaldo-${id}`), m => {
        const n = (m.nombre || '').toUpperCase();
        return n.includes('RESPALDO') || n.includes('MDF') || n.includes('CARTON') || n.includes('CARTÓN') || n.includes('TRIPLEX') || n.includes('CELTEX');
    });

    llenarSelectMulti(document.getElementById(`paspartu-${id}`), m => {
        const n = (m.nombre || '').toUpperCase();
        return n.includes('PASPARTU') || n.includes('PASSEPARTOUT') || n.includes('CARTULINA');
    });

    // Marco/Moldura 1 (hidden select + datalist)
    llenarSelectMulti(document.getElementById(`marco-${id}`), m => {
        const n = (m.nombre || '').toUpperCase();
        const u = (m.unidad || m.tipo || '').toUpperCase();
        const c = (m.categoria || '').toUpperCase();
        return (
            n.startsWith('K ') ||
            n.includes('MOLDURA') || n.includes('MARCO') || n.includes('MADERA') || n.includes('2312') ||
            u === 'ML' ||
            c.includes('MOLDURA') || c.includes('MARCO')
        );
    }, true, datalist);

    // Marco/Moldura 2 (hidden select + datalist)
    const datalist2 = document.getElementById(`lista-molduras2-${id}`);
    if (datalist2) datalist2.innerHTML = '';
    llenarSelectMulti(document.getElementById(`marco2-${id}`), m => {
        const n = (m.nombre || '').toUpperCase();
        const u = (m.unidad || m.tipo || '').toUpperCase();
        const c = (m.categoria || '').toUpperCase();
        return (
            n.startsWith('K ') ||
            n.includes('MOLDURA') || n.includes('MARCO') || n.includes('MADERA') || n.includes('2312') ||
            u === 'ML' ||
            c.includes('MOLDURA') || c.includes('MARCO')
        );
    }, true, datalist2);

    llenarSelectMulti(document.getElementById(`foam-${id}`), m => (m.nombre || '').toUpperCase().includes('FOAM'));

    llenarSelectMulti(document.getElementById(`lamina-${id}`), m => {
        const n = (m.nombre || '').toUpperCase();
        return n.includes('ICOPOR') || n.includes('ESPONJA');
    });

    llenarSelectMulti(document.getElementById(`tela-${id}`), m => {
        const n = (m.nombre || '').toUpperCase();
        return n.includes('TELA') || n.includes('LONA') || n.includes('CANVAS');
    });

    llenarSelectMulti(document.getElementById(`chapilla-${id}`), m => (m.nombre || '').toUpperCase().includes('CHAPILLA'));
}

// ─── AGREGAR CUADRO ───────────────────────────────────────────────────────────
function agregarCuadro() {
    // Buscar el menor ID positivo disponible entre los formularios existentes
    const contenedor = document.getElementById('lista-cuadros');
    const existentes = Array.from(document.querySelectorAll('.cuadro-form')).map(f => {
        const nid = parseInt(f.id.replace('cuadro-form-', ''));
        return Number.isNaN(nid) ? null : nid;
    }).filter(Boolean).sort((a,b)=>a-b);

    let id = 1;
    for (let i = 0; i < existentes.length; i++) {
        if (existentes[i] === id) id++;
        else if (existentes[i] > id) break;
    }

    // Mantener cuadroCounter como máximo usado (por compatibilidad)
    if (id > cuadroCounter) cuadroCounter = id;

    const formDiv = crearFormularioCuadro(id);
    contenedor.appendChild(formDiv);
    poblarSelectsCuadro(id);
    actualizarBotones();
}

// ─── ELIMINAR CUADRO ─────────────────────────────────────────────────────────
function eliminarCuadro(id) {
    const form = document.getElementById(`cuadro-form-${id}`);
    if (form) form.remove();
    // Eliminar del array de resultados si ya estaba calculado
    cuadros = cuadros.filter(c => c.cuadroId !== id);
    actualizarResumenGlobal();
    actualizarBotones();
}

// ─── ACTUALIZAR ESTADO DE BOTONES ────────────────────────────────────────────
function actualizarBotones() {
    const hayFormularios = document.querySelectorAll('.cuadro-form').length > 0;
    const btnCotizar = document.getElementById('btn-cotizar-todo');
    if (btnCotizar) btnCotizar.disabled = !hayFormularios;
}

// ─── CALCULAR UN CUADRO INDIVIDUAL ───────────────────────────────────────────
function calcularCuadro(id) {
    const ancho = parseFloat(document.getElementById(`ancho-${id}`)?.value) || 0;
    const largo = parseFloat(document.getElementById(`largo-${id}`)?.value) || 0;
    const manoObra = parseFloat(document.getElementById(`mo-${id}`)?.value) || 0;
    const desc = document.getElementById(`desc-${id}`)?.value.trim() || `Cuadro #${id}`;
    const cantidad = Math.max(1, parseInt(document.getElementById(`cantidad-${id}`)?.value) || 1);

    if (!ancho || !largo) {
        alert('⚠️ Ingresa ancho y largo para el Cuadro #' + id);
        return null;
    }

    const idsSelects = ['vidrio', 'respaldo', 'paspartu', 'marco', 'foam', 'lamina', 'tela', 'chapilla'];
    let materiales = [];

    idsSelects.forEach(tipo => {
        // marco2 se maneja aparte, se omite aquí
        const sel = document.getElementById(`${tipo}-${id}`);
        if (!sel || !sel.value) return;
        const opt = sel.options[sel.selectedIndex];
        if (!opt) return;

        const costo = parseFloat(opt.dataset.costo) || 0;
        const unidadDataset = (opt.dataset.unidad || '').toLowerCase();
        const categoriaM = (opt.dataset.categoria || '').toUpperCase();
        const nombreM = (opt.text || '').toUpperCase();
        const desp = parseFloat(opt.dataset.desperdicio) || 0;

        const esML =
            unidadDataset === 'ml' ||
            categoriaM.includes('MOLDURA') ||
            nombreM.includes('MOLDURA') ||
            nombreM.includes('MARCO') ||
            nombreM.startsWith('K ') ||
            nombreM.includes('2312') ||
            nombreM.includes('2311');

        if (costo > 0) {
            materiales.push({
                id: sel.value,
                nombre: opt.text.split('(')[0].trim(),
                costoUnitario: costo,
                unidad: esML ? 'ML' : 'M2',
                desperdicio: esML ? desp : 0
            });
        }
    });

    // Verificar buscador de moldura 1
    const inputMoldura = document.getElementById(`input-moldura-${id}`);
    const selectMarco = document.getElementById(`marco-${id}`);
    if (inputMoldura && inputMoldura.value.trim() !== '' && selectMarco && selectMarco.value) {
        const yaIncluido = materiales.find(m => m.id === selectMarco.value);
        if (!yaIncluido) {
            const optM = selectMarco.options[selectMarco.selectedIndex];
            if (optM) {
                const costoM = parseFloat(optM.dataset.costo) || 0;
                const despM = parseFloat(optM.dataset.desperdicio) || 0;
                if (costoM > 0) {
                    materiales.push({
                        id: selectMarco.value,
                        nombre: inputMoldura.value.split('(')[0].trim(),
                        costoUnitario: costoM,
                        unidad: 'ML',
                        desperdicio: despM
                    });
                }
            }
        }
    }

    // Verificar buscador de moldura 2
    const inputMoldura2 = document.getElementById(`input-moldura2-${id}`);
    const selectMarco2 = document.getElementById(`marco2-${id}`);
    if (inputMoldura2 && inputMoldura2.value.trim() !== '' && selectMarco2 && selectMarco2.value) {
        const optM2 = selectMarco2.options[selectMarco2.selectedIndex];
        if (optM2) {
            const costoM2 = parseFloat(optM2.dataset.costo) || 0;
            const despM2 = parseFloat(optM2.dataset.desperdicio) || 0;
            if (costoM2 > 0) {
                materiales.push({
                    id: selectMarco2.value,
                    nombre: inputMoldura2.value.split('(')[0].trim() + ' (Marco 2)',
                    costoUnitario: costoM2,
                    unidad: 'ML',
                    desperdicio: despM2
                });
            }
        }
    }

    if (materiales.length === 0) {
        alert('⚠️ Selecciona al menos un material con costo para el Cuadro #' + id);
        return null;
    }

    const area = Number(((ancho * largo) / 10000).toFixed(3));
    let costoBase = 0;
    let totalVenta = 0;

    materiales.forEach(m => {
        const costoU = parseFloat(m.costoUnitario) || 0;
        let costoItem, ventaItem;
        let consumoBase;

        if (m.unidad === 'ML') {
            consumoBase = obtenerMLConDesperdicioMulti(ancho, largo, m.desperdicio);
            costoItem = Math.round(costoU * consumoBase);
            ventaItem = Math.round(costoItem * 2.5);
        } else {
            consumoBase = area;
            costoItem = Math.round(costoU * consumoBase);
            ventaItem = Math.round(costoItem * 3);
        }
        m.cantidadUsadaBase = Number(consumoBase.toFixed(3));
        m.cantidadUsada = Number((consumoBase * cantidad).toFixed(3));
        m.cantidadUsadaTotal = m.cantidadUsada;
        m.costoItemUnit = costoItem;
        m.costoItemTotal = Math.round(costoItem * cantidad);
        m.subtotalVenta = ventaItem;
        m.subtotalVentaTotal = Math.round(ventaItem * cantidad);
        costoBase += costoItem;
        totalVenta += ventaItem;
    });

    const totalFinal = Math.round(totalVenta + manoObra);   // valor de 1 cuadro
    const totalFinalTotal = totalFinal * cantidad;            // valor de todos iguales
    const costoBaseTotal = Math.round(costoBase * cantidad);
    const manoObraTotal = Math.round(manoObra * cantidad);

    const abonoCuadro = parseFloat(document.getElementById(`abono-cuadro-${id}`)?.value) || 0;
    const saldoCuadro = Math.max(0, totalFinalTotal - abonoCuadro);

    const resultado = {
        cuadroId: id,
        descripcion: desc,
        ancho,
        largo,
        area,
        materiales,
        costoBase,
        costoBaseTotal,
        totalVenta,
        manoObra,
        manoObraTotal,
        totalFinal,        // valor unitario (1 cuadro)
        cantidad,
        totalFinalTotal,   // valor × cantidad
        abono: abonoCuadro,
        saldo: saldoCuadro
    };

    // Actualizar o agregar al array
    const idx = cuadros.findIndex(c => c.cuadroId === id);
    if (idx > -1) cuadros[idx] = resultado;
    else cuadros.push(resultado);

    // Mostrar mini-resultado en el formulario
    mostrarResultadoCuadro(id, resultado);
    actualizarResumenGlobal();
    return resultado;
}

// ─── MINI RESULTADO POR CUADRO ───────────────────────────────────────────────
function mostrarResultadoCuadro(id, res) {
    const div = document.getElementById(`resultado-cuadro-${id}`);
    if (!div) return;

    const itemsHTML = res.materiales.map(m => {
        const nombre = m.nombre.toUpperCase().split('(')[0].trim();
        const costoUnit = Number(m.costoItemUnit || 0);
        const costoTotal = Number(m.costoItemTotal || 0);
        if (costoUnit > 0) {
            return `<li><i class="fas fa-check-circle" style="color:#10b981;"></i> 
                <strong>${nombre}</strong> — ${fmt.format(costoUnit)} / ${fmt.format(costoTotal)}</li>`;
        }
        return `<li><i class="fas fa-check-circle" style="color:#10b981;"></i> 
            <strong>${nombre}</strong> — ${m.cantidadUsada} ${m.unidad}</li>`;
    }).join('');

    div.style.display = 'block';
    div.innerHTML = `
        <div class="mini-resultado">
            <div class="mini-resultado-header">
                <span>📐 ${res.descripcion} &nbsp;|&nbsp; ${res.ancho} × ${res.largo} cm (${res.area} m²)${res.cantidad > 1 ? ` &nbsp;×&nbsp; <strong>${res.cantidad} uds</strong>` : ''}</span>
                <span class="mini-total">${fmt.format(res.totalFinalTotal)}</span>
            </div>
            ${res.cantidad > 1 ? `<div style="font-size:0.83rem; color:#475569; margin-bottom:6px; text-align:right;">Valor unitario: ${fmt.format(res.totalFinal)} &nbsp;×&nbsp; ${res.cantidad} = <strong>${fmt.format(res.totalFinalTotal)}</strong></div>` : ''}
            <ul class="mini-materiales">${itemsHTML}</ul>
            ${res.abono > 0 ? `
            <div style="display:flex; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:1px dashed #6ee7b7; font-size:0.88rem; flex-wrap:wrap; gap:6px;">
                <span style="color:#059669; font-weight:600;">✅ Abono: ${fmt.format(res.abono)}</span>
                <span style="color:#dc2626; font-weight:700;">Saldo pendiente: ${fmt.format(res.saldo)}</span>
            </div>` : ''}
        </div>
    `;
}

// ─── ACTUALIZAR RESUMEN GLOBAL (BARRA INFERIOR) ───────────────────────────────
function actualizarResumenGlobal() {
    const barraTotal = document.getElementById('barra-total-global');
    if (!barraTotal) return;

    if (cuadros.length === 0) {
        barraTotal.style.display = 'none';
        return;
    }

    const sumTotal = cuadros.reduce((acc, c) => acc + (c.totalFinalTotal || c.totalFinal), 0);
    const sumAbonos = cuadros.reduce((acc, c) => acc + (c.abono || 0), 0);
    const sumSaldo = sumTotal - sumAbonos;
    barraTotal.style.display = 'flex';
    document.getElementById('global-num-cuadros').textContent = cuadros.length;
    document.getElementById('global-total').textContent = fmt.format(sumTotal);
    const elSaldo = document.getElementById('global-saldo');
    if (elSaldo) elSaldo.textContent = sumAbonos > 0 ? `Saldo: ${fmt.format(sumSaldo)}` : '';
}

// ─── GENERAR COTIZACIÓN COMPLETA ──────────────────────────────────────────────
function generarCotizacionCompleta() {
    // Calcular cualquier cuadro pendiente
    const forms = document.querySelectorAll('.cuadro-form');
    let alguno = false;
    forms.forEach(f => {
        const id = parseInt(f.id.replace('cuadro-form-', ''));
        const yaCalculado = cuadros.find(c => c.cuadroId === id);
        if (!yaCalculado) {
            const res = calcularCuadro(id);
            if (res) alguno = true;
        } else {
            alguno = true;
        }
    });

    if (!alguno || cuadros.length === 0) {
        alert('⚠️ Agrega al menos un cuadro válido antes de generar la cotización.');
        return;
    }

    const areaImpresion = document.getElementById('area-impresion');
    if (!areaImpresion) return;

    const nombreCliente = document.getElementById('nombre-cliente-multi')?.value.trim() || 'CLIENTE';
    const telefono = document.getElementById('tel-cliente-multi')?.value.trim() || '';

    const sumTotal = cuadros.reduce((acc, c) => acc + (c.totalFinalTotal || c.totalFinal), 0);
    const sumAbonos = cuadros.reduce((acc, c) => acc + (c.abono || 0), 0);
    const saldoGlobal = sumTotal - sumAbonos;
    const fmtMedida = (valor) => new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }).format(Number(valor || 0));

    const resumenCuadros = cuadros.map(c =>
        `${(c.descripcion || 'CUADRO').toString().toUpperCase()} - ${c.cantidad} CUADRO(S) DE ${c.ancho} CM X ${c.largo} CM`
    ).join('\n');

    const totalUnidades = cuadros.reduce((acc, c) => acc + (Number(c.cantidad) || 0), 0);

    const cuadrosHTML = cuadros.map((c, idx) => {
        const itemsHTML = c.materiales.map(m => `
            <li style="margin:0; padding:3px 0; border-bottom:1px solid #f1f5f9; font-size:0.8rem; display:flex; justify-content:space-between; align-items:baseline; gap:6px;">
                <span style="font-weight:600; color:#1e3a8a;">${m.nombre.toUpperCase().split('(')[0].trim()}</span>
                <span class="no-print" style="color:#64748b; white-space:nowrap; font-size:0.75rem;">
                    ${fmtMedida(m.cantidadUsadaBase)} ${m.unidad}${Number(m.cantidadUsada) !== Number(m.cantidadUsadaBase) ? ` / ${fmtMedida(m.cantidadUsada)} ${m.unidad}` : ''}
                </span>
            </li>`).join('');

        const totalMostrar = c.totalFinalTotal || c.totalFinal;
        const etiquetaCantidad = c.cantidad > 1
            ? `<span style="background:#e0f2fe; color:#1e3a8a; padding:2px 10px; border-radius:12px; font-size:0.82rem; font-weight:700;">${c.cantidad} uds</span>`
            : '';

        return `
        <div style="margin-bottom:10px; padding:10px 14px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; page-break-inside:avoid;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; gap:8px;">
                <span style="font-weight:800; color:#1e3a8a; font-size:0.9rem;">
                    🖼️ Cuadro ${c.cuadroId}: ${c.descripcion} ${etiquetaCantidad}
                </span>
                <span class="no-print" style="background:#1e3a8a; color:white; padding:2px 10px; border-radius:20px; font-weight:700; font-size:0.88rem; white-space:nowrap;">
                    ${fmt.format(totalMostrar)}
                </span>
            </div>
            <p style="margin:0 0 5px 0; color:#475569; font-size:0.78rem; background:#e0f2fe; padding:4px 8px; border-radius:4px; border-left:3px solid #1e3a8a;">
                <strong>Medidas:</strong> ${c.ancho} × ${c.largo} cm — Área: ${c.area} m²
            </p>
            <ul style="list-style:none; padding:0; margin:0;">
                ${itemsHTML}
            </ul>
            ${c.cantidad > 1 ? `<div class="calc-cantidad-print" style="margin-top:5px; padding:4px 8px; background:#fffbeb; border-radius:6px; border-left:3px solid #fbbf24; font-size:0.78rem;">Valor unitario: <strong>${fmt.format(c.totalFinal)}</strong> × ${c.cantidad} uds = <strong>${fmt.format(c.totalFinalTotal)}</strong></div>` : ''}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding-top:5px; border-top:1px dashed #cbd5e1; font-size:0.82rem;">
                <span style="color:#10b981; font-weight:700;">✅ Abono: ${fmt.format(c.abono || 0)}</span>
                <span class="no-print" style="color:#dc2626; font-weight:800;">Saldo: ${fmt.format(c.saldo ?? totalMostrar)}</span>
            </div>
        </div>`;
    }).join('');

    // Observaciones previas (independientes del resumen automático)
    const obs1 = document.getElementById('obs-multi-1')?.value || '';
    const obs2 = document.getElementById('obs-multi-2')?.value || '';
    const obs3 = document.getElementById('obs-multi-3')?.value || '';

    areaImpresion.innerHTML = `
        <div id="printAreaMulti" style="background:#ffffff; padding:16px 20px; border-radius:12px; border:1px solid #e2e8f0; font-family:'Segoe UI',sans-serif; width:100%; box-sizing:border-box;">

            <!-- ENCABEZADO -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1e3a8a; padding-bottom:8px; margin-bottom:12px;">
                <div>
                    <h2 style="margin:0; color:#1e3a8a; font-size:1.2rem; line-height:1.2;">COTIZACIÓN MÚLTIPLE</h2>
                    <p style="margin:1px 0 0 0; color:#475569; font-size:0.82rem; font-weight:600;">MARQUETERÍA LA CHICA MORALES</p>
                    <p style="margin:6px 0 0 0; font-weight:bold; color:#1e293b; font-size:0.95rem;">Sr(a). ${nombreCliente.toUpperCase()}</p>
                    ${telefono ? `<p style="margin:2px 0 0 0; color:#64748b; font-size:0.82rem;">📞 ${telefono}</p>` : ''}
                </div>
                <div style="text-align:right;">
                    <span style="display:block; font-weight:bold; color:#1e3a8a; font-size:1rem;">COTIZACIÓN</span>
                    <span style="color:#64748b; font-size:0.82rem;">${new Date().toLocaleDateString()}</span>
                    <span style="display:block; color:#64748b; font-size:0.78rem;">${totalUnidades} cuadro(s)</span>
                </div>
            </div>

            <!-- CUADROS -->
            ${cuadrosHTML}

            <!-- TOTALES GLOBALES -->
            <div style="margin-top:20px; padding:20px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:#64748b; font-weight:600;">VALOR TOTAL (${totalUnidades} cuadro${totalUnidades !== 1 ? 's' : ''}):</span>
                    <span style="font-weight:700; color:#1e293b; font-size:1.4rem;">${fmt.format(sumTotal)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:#10b981; font-weight:700;">TOTAL ABONOS RECIBIDOS:</span>
                    <span style="font-weight:700; color:#10b981; font-size:1.2rem;">- ${fmt.format(sumAbonos)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:2px dashed #cbd5e1;">
                    <span style="font-weight:800; color:#1e293b;">SALDO TOTAL PENDIENTE:</span>
                    <span style="font-size:1.8rem; font-weight:900; color:${saldoGlobal > 0 ? '#dc2626' : '#059669'};">${fmt.format(saldoGlobal)}</span>
                </div>
            </div>

            <!-- OBSERVACIONES -->
            <div style="margin-top:12px; border-top:1px solid #e2e8f0; padding-top:8px;">
                <h4 style="margin:0 0 10px 0; font-size:0.85rem; color:#475569; font-weight:bold; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
                    <i class="fas fa-pencil-alt" style="font-size:0.75rem; color:#3498db;"></i> Observaciones:
                </h4>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <textarea id="obs-multi-1" rows="1" placeholder="✏️  Observación 1..." oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'" style="width:100%; overflow:hidden; resize:none; border:1.5px solid #cbd5e1; border-radius:6px; padding:8px 10px; font-size:0.93rem; color:#1e293b; background:#f8fafc; font-family:inherit; box-sizing:border-box;">${obs1}</textarea>
                    <textarea id="obs-multi-2" rows="1" placeholder="✏️  Observación 2..." oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'" style="width:100%; overflow:hidden; resize:none; border:1.5px solid #cbd5e1; border-radius:6px; padding:8px 10px; font-size:0.93rem; color:#1e293b; background:#f8fafc; font-family:inherit; box-sizing:border-box;">${obs2}</textarea>
                    <textarea id="obs-multi-3" rows="1" placeholder="✏️  Observación 3..." oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'" style="width:100%; overflow:hidden; resize:none; border:1.5px solid #cbd5e1; border-radius:6px; padding:8px 10px; font-size:0.93rem; color:#1e293b; background:#f8fafc; font-family:inherit; box-sizing:border-box;">${obs3}</textarea>
                </div>
            </div>
        </div>

        <div class="no-print" style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap;">
            <button onclick="imprimirCotizacionMulti()" style="background:#1e3a8a; color:white; border:none; padding:15px; border-radius:8px; cursor:pointer; font-weight:600; flex:1; font-size:1rem; min-width:180px;">
                <i class="fas fa-print"></i> IMPRIMIR COTIZACIÓN
            </button>
            <button id="btn-confirmar-venta-multi" onclick="confirmarVentaMulti()" style="background:#2ecc71; color:white; border:none; padding:15px; border-radius:8px; cursor:pointer; font-weight:800; flex:2; font-size:1.1rem; min-width:220px; letter-spacing:0.5px;">
                <i class="fas fa-lock"></i> CONFIRMAR VENTA
            </button>
            <button onclick="limpiarTodo()" style="background:#ef4444; color:white; border:none; padding:15px; border-radius:8px; cursor:pointer; font-weight:600; flex:1; font-size:1rem; min-width:180px;">
                <i class="fas fa-redo"></i> NUEVA COTIZACIÓN
            </button>
        </div>
    `;

    areaImpresion.scrollIntoView({ behavior: 'smooth' });
}

// ─── CONFIRMAR VENTA MÚLTIPLE ────────────────────────────────────────────────
async function confirmarVentaMulti() {
    if (cuadros.length === 0) {
        alert('⚠️ No hay cuadros calculados para confirmar.');
        return;
    }

    const nombre = document.getElementById('nombre-cliente-multi')?.value.trim();
    const telefono = document.getElementById('tel-cliente-multi')?.value.trim() || 'N/A';

    if (!nombre) {
        alert('⚠️ Por favor ingresa el nombre del cliente antes de confirmar la venta.');
        document.getElementById('nombre-cliente-multi')?.focus();
        return;
    }

    const btnVenta = document.getElementById('btn-confirmar-venta-multi');
    if (btnVenta) {
        btnVenta.disabled = true;
        btnVenta.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GUARDANDO...';
    }

    let errores = 0;
    const itemsProcesados = cuadros.flatMap(c => {
        return c.materiales.map(m => {
            const cantidadReal = parseFloat(m.cantidadUsada) || parseFloat(c.area) || 0;
            const unidadVisual = (m.unidad || '').toUpperCase();
            const factor = unidadVisual === 'ML' ? 2.5 : 3;
            const valorVenta = Math.round((parseFloat(m.costoUnitario) || 0) * cantidadReal * factor);
            const cantidadBase = parseFloat(m.cantidadUsadaBase ?? (cantidadReal / (c.cantidad || 1))) || 0;
            return {
                productoId: m.id,
                materialNombre: `${c.descripcion} - ${m.nombre}`.toUpperCase(),
                descripcion: `${c.descripcion} - ${m.nombre}`.toUpperCase(),
                nombre: `${c.descripcion} - ${m.nombre}`.toUpperCase(),
                costo_base_unitario: m.costoUnitario,
                costoBase: m.costoUnitario,
                costo_unitario: m.costoUnitario,
                valor_material: Math.round((parseFloat(m.costoUnitario) || 0) * cantidadReal),
                precio_venta_item: valorVenta,
                subtotalVenta: valorVenta,
                valor_venta: valorVenta,
                subtotal: valorVenta,
                total_item: valorVenta,
                cantidad: Number(cantidadReal.toFixed(3)),
                unidad: unidadVisual,
                ancho: Number((c.ancho || 0).toFixed(2)),
                largo: Number((c.largo || 0).toFixed(2)),
                area_m2: unidadVisual === 'ML'
                    ? Number(cantidadReal.toFixed(3))
                    : Number(cantidadReal.toFixed(3)),
                area_m2_base: unidadVisual === 'ML'
                    ? Number(cantidadBase.toFixed(3))
                    : Number(cantidadBase.toFixed(3)),
                cantidadUsadaBase: Number(cantidadBase.toFixed(3)),
                cantidadUsada: Number(cantidadReal.toFixed(3)),
                unidadesCuadro: Number(c.cantidad || 1),
                desperdicioAplicado: m.desperdicio || 0
            };
        });
    });

    const totalFactura = cuadros.reduce((acc, c) => acc + (c.totalFinalTotal || c.totalFinal || 0), 0);
    const totalPagado = cuadros.reduce((acc, c) => acc + (c.abono || 0), 0);
    const totalManoObra = cuadros.reduce((acc, c) => acc + (c.manoObraTotal || Math.round((c.manoObra || 0) * (c.cantidad || 1))), 0);
    const totalCostos = cuadros.reduce((acc, c) => acc + (c.costoBaseTotal || Math.round((c.costoBase || 0) * (c.cantidad || 1))), 0);
    const rentabilidad = totalFactura - totalCostos - totalManoObra;

    const facturaData = {
        cliente: { nombre, telefono },
        medidas: cuadros.map(c => `${(c.descripcion || 'CUADRO').toString().toUpperCase()}: ${c.ancho} x ${c.largo} cm${c.cantidad > 1 ? ` × ${c.cantidad}` : ''}`).join(' | '),
        observacionResumen: cuadros.map(c => `${(c.descripcion || 'CUADRO').toString().toUpperCase()} - ${c.cantidad} CUADRO(S) DE ${c.ancho} CM X ${c.largo} CM`).join(' | '),
        items: itemsProcesados,
        totalFactura,
        totalPagado,
        manoObra: totalManoObra,
        mano_obra_total: totalManoObra,
        suma_costos: totalCostos,
        rentabilidad,
        fecha: new Date().toISOString()
    };

    try {
        const response = await fetch(`${MULTI_API_BASE}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(facturaData)
        });
        const result = await response.json();
        if (result.success) {
            const historyUrl = new URL('history.html', window.location.href).href;
            alert(`✅ VENTA EXITOSA\n1 orden registrada.\n\nOT: ${result.ot || 'Generada'}`);
            window.location.href = historyUrl;
        } else {
            errores++;
            console.error('Error al guardar venta multi', result.error);
        }
    } catch (err) {
        errores++;
        console.error('Error red venta multi', err);
    }

    if (errores > 0) {
        alert('⚠️ No se pudo guardar la cotización completa. Revisa la consola.');
        if (btnVenta) {
            btnVenta.disabled = false;
            btnVenta.innerHTML = '<i class="fas fa-lock"></i> REINTENTAR';
        }
    }
}

// ─── IMPRIMIR ────────────────────────────────────────────────────────────────
function imprimirCotizacionMulti() {
    const printArea = document.getElementById('printAreaMulti');
    if (!printArea) return;

    const clone = printArea.cloneNode(true);

    ['obs-multi-1', 'obs-multi-2', 'obs-multi-3'].forEach(id => {
        const orig = document.getElementById(id);
        const dest = clone.querySelector('#' + id);
        if (orig && dest) {
            const p = document.createElement('p');
            p.textContent = orig.value;
            p.style.cssText = 'margin:0; padding:6px 4px; font-size:0.95rem; color:#334155; border-bottom:1.5px solid #94a3b8; box-sizing:border-box; width:100%; white-space:pre-wrap;';
            dest.parentNode.replaceChild(p, dest);
        }
    });

    // Eliminar la línea de cálculo (valor unitario × N) solo en la impresión
    clone.querySelectorAll('.calc-cantidad-print').forEach(el => el.remove());

    const ventana = window.open('', '', 'height=1050,width=830');
    ventana.document.write(`<html><head>
        <title>Cotización Multi-Cuadro</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>
            @page { size: A4 portrait; margin: 10mm 12mm; }
            body { font-family: 'Segoe UI', sans-serif; padding: 0; margin: 0; }
            /* ocultar elementos marcados como no-print en la impresión */
            .no-print { display: none !important; }
            @media print { body { padding: 0; } }
        </style>
        <script>
        window.addEventListener('load', function() {
            /* A4 portrait: 297mm - 20mm márgenes = 277mm.
               zoom afecta al motor de impresión (a diferencia de transform). */
            var pageH = 277 * 3.7795; /* px a 96 dpi */
            var bodyH = document.body.scrollHeight;
            if (bodyH > pageH) {
                document.body.style.zoom = (pageH / bodyH).toFixed(4);
            }
            setTimeout(function() { window.print(); window.close(); }, 400);
        });
        <\/script>
    </head><body>`);
    ventana.document.write(clone.innerHTML);
    ventana.document.write('</body></html>');
    ventana.document.close();
}

// ─── LIMPIAR TODO ────────────────────────────────────────────────────────────
function limpiarTodo() {
    if (!confirm('¿Deseas iniciar una nueva cotización? Se borrará todo lo actual.')) return;
    cuadros = [];
    cuadroCounter = 0;
    document.getElementById('lista-cuadros').innerHTML = '';
    document.getElementById('area-impresion').innerHTML = '';
    const barraTotal = document.getElementById('barra-total-global');
    if (barraTotal) barraTotal.style.display = 'none';
    // Resetear campos de cliente
    const nc = document.getElementById('nombre-cliente-multi');
    const tc = document.getElementById('tel-cliente-multi');
    const ab = document.getElementById('abono-multi');
    if (nc) nc.value = '';
    if (tc) tc.value = '';
    if (ab) ab.value = '0';
    agregarCuadro();
}

// ─── INICIALIZACIÓN ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    agregarCuadro();
    cargarMaterialesMulti();
});
