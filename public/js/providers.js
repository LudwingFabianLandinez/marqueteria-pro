/**
 * LÓGICA DE PROVEEDORES - MARQUETERÍA PRO
 * Conecta el formulario HTML y los botones de consulta con la base de datos.
 */

// Definición segura de la URL de la API
const BASE_URL_API = (window.API && window.API.url) ? window.API.url : '/api';

document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE REGISTRO ---
    const supplierForm = document.getElementById('supplierForm');

    if (supplierForm) {
        console.log("✅ Formulario de proveedores detectado.");

        supplierForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btnGuardar = supplierForm.querySelector('.btn-save');
            const originalHTML = btnGuardar ? btnGuardar.innerHTML : "Guardar";

            const formData = new FormData(supplierForm);
            const providerData = {
                nombre: formData.get('nombre'),
                nit: formData.get('nit') || "N/A",
                contacto: formData.get('contacto') || "N/A",
                telefono: formData.get('telefono') || "Sin teléfono",
                correo: formData.get('correo') || "n/a",
                direccion: formData.get('direccion') || "Dirección no registrada",
                categoria: formData.get('categoria') || "General"
            };

            if (btnGuardar) {
                btnGuardar.disabled = true;
                btnGuardar.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Procesando...`;
            }

            try {
                const response = await fetch(`${BASE_URL_API}/providers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(providerData)
                });

                const result = await response.json();

                if (result.success || response.ok) {
                    alert("✅ Proveedor guardado correctamente.");
                    supplierForm.reset();
                    window.location.href = 'dashboard.html';
                } else {
                    alert("❌ Error: " + (result.error || "No se pudo guardar"));
                }
            } catch (error) {
                console.error("🚨 Error en la solicitud:", error);
                alert("❌ No se pudo conectar con el servidor.");
            } finally {
                if (btnGuardar) {
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = originalHTML;
                }
            }
        });
    }

    // --- LÓGICA DE CONSULTA (Vinculación por ID) ---
    const btnConsultar = document.getElementById('btnConsultarProv');
    
    if (btnConsultar) {
        btnConsultar.addEventListener('click', async (e) => {
            e.preventDefault(); // Evitar cualquier recarga accidental
            console.log("🖱️ Clic detectado en btnConsultarProv: Consultando...");
            await window.cargarTablaProveedores();
        });
    }
});

/**
 * Función GLOBAL para cargar y renderizar la tabla de proveedores
 * Se asigna a window para que dashboard.js pueda verla.
 */
window.cargarTablaProveedores = async function() {
    const tablaBody = document.getElementById('lista-proveedores-body');
    if (!tablaBody) {
        console.warn("⚠️ No se encontró el elemento 'lista-proveedores-body' en el DOM.");
        return;
    }

    tablaBody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-sync fa-spin"></i> Conectando con Atlas...</td></tr>';

    try {
        const result = await obtenerProveedores();
        
        // Verificamos result.success o si result es un array directamente (depende de tu API)
        const proveedores = result.success ? result.data : result;

        if (proveedores && proveedores.length > 0) {
            tablaBody.innerHTML = ''; // Limpiar mensaje de carga
            proveedores.forEach(prov => {
                const fila = `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${prov.nombre}</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${prov.nit || 'N/A'}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${prov.contacto || 'N/A'}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${prov.telefono}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${prov.categoria}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                            <button class="btn-edit-action" title="Editar" onclick="alert('Función editar próximamente')">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>
                `;
                tablaBody.innerHTML += fila;
            });
            console.log("✅ Tabla de proveedores actualizada con éxito.");
        } else {
            tablaBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay proveedores registrados en la base de datos.</td></tr>';
        }
    } catch (error) {
        console.error("🚨 Error al renderizar tabla:", error);
        tablaBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error de conexión con el servidor.</td></tr>';
    }
};

/**
 * Función para obtener datos de la API (Interna)
 */
async function obtenerProveedores() {
    try {
        const url = `${BASE_URL_API}/providers?t=${Date.now()}`;
        console.log("📡 Petición a:", url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("🚨 Error obteniendo proveedores:", error);
        return { success: false, data: [] };
    }
}