/**
 * LÓGICA DE PROVEEDORES - MARQUETERÍA PRO
 * Conecta el formulario HTML y los botones de consulta con la base de datos.
 */

// Definición segura de la URL de la API
// Priorizamos window.API.url que configuramos en api.js para Netlify
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

    // --- LÓGICA DE CONSULTA (Activación de botones) ---
    // Buscamos el botón por ID o por clase según lo que tengas en el HTML
    const btnConsultar = document.getElementById('btnConsultarProveedores') || document.querySelector('.btn-consultar');
    
    if (btnConsultar) {
        btnConsultar.addEventListener('click', async () => {
            console.log("🖱️ Clic detectado: Consultando proveedores...");
            // Llamamos a la función global
            await window.cargarTablaProveedores();
        });
    }
});

/**
 * Función GLOBAL para cargar y renderizar la tabla de proveedores.
 * Al usar window. la hacemos visible para dashboard.js
 */
window.cargarTablaProveedores = async function() {
    const tablaBody = document.getElementById('lista-proveedores-body');
    if (!tablaBody) {
        console.warn("⚠️ No se encontró el elemento 'lista-proveedores-body'");
        return;
    }

    tablaBody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-sync fa-spin"></i> Cargando datos desde Atlas...</td></tr>';

    try {
        const result = await obtenerProveedores();
        
        if (result.success && result.data && result.data.length > 0) {
            tablaBody.innerHTML = ''; // Limpiar mensaje de carga
            result.data.forEach(prov => {
                const fila = `
                    <tr>
                        <td style="font-weight: bold;">${prov.nombre}</td>
                        <td>${prov.nit || 'N/A'}</td>
                        <td>${prov.contacto || 'N/A'}</td>
                        <td>${prov.telefono}</td>
                        <td><span class="badge">${prov.categoria || 'General'}</span></td>
                        <td>
                            <button class="btn-edit" onclick="alert('ID: ${prov._id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>
                `;
                tablaBody.innerHTML += fila;
            });
            console.log("✅ Tabla de proveedores actualizada.");
        } else {
            tablaBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay proveedores registrados.</td></tr>';
        }
    } catch (error) {
        console.error("🚨 Error en cargarTablaProveedores:", error);
        tablaBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar proveedores.</td></tr>';
    }
};

/**
 * Función interna para obtener datos de la API
 */
async function obtenerProveedores() {
    try {
        // Añadimos un timestamp para evitar caché y forzar respuesta fresca de Netlify
        const url = `${BASE_URL_API}/providers?t=${Date.now()}`;
        console.log("📡 Petición a:", url);
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error("🚨 Error obteniendo proveedores:", error);
        return { success: false, data: [] };
    }
}