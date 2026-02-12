/**
 * LÓGICA DE PROVEEDORES - MARQUETERÍA PRO
 * Conecta el formulario HTML con la base de datos.
 */

// Definición segura de la URL de la API
// Si API_URL ya existe (de api.js), la usa. Si no, usa '/api' por defecto.
const BASE_URL_API = (typeof API_URL !== 'undefined') ? API_URL : '/api';

document.addEventListener('DOMContentLoaded', () => {
    const supplierForm = document.getElementById('supplierForm');

    if (supplierForm) {
        console.log("✅ Formulario de proveedores detectado.");

        supplierForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Capturar el botón para feedback visual
            const btnGuardar = supplierForm.querySelector('.btn-save');
            const originalHTML = btnGuardar ? btnGuardar.innerHTML : "Guardar";

            // 2. Recolectar datos del formulario
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

            // 3. Estado de "Guardando..."
            if (btnGuardar) {
                btnGuardar.disabled = true;
                btnGuardar.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Procesando...`;
            }

            try {
                // 4. Enviar a la base de datos usando la BASE_URL_API segura
                const response = await fetch(`${BASE_URL_API}/providers`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(providerData)
                });

                const result = await response.json();

                if (result.success || response.ok) {
                    alert("✅ Proveedor guardado correctamente en la base de datos.");
                    supplierForm.reset();
                    // Redirigir al dashboard después de guardar
                    window.location.href = 'dashboard.html';
                } else {
                    alert("❌ Error: " + (result.error || "No se pudo guardar"));
                }
            } catch (error) {
                console.error("🚨 Error en la solicitud:", error);
                alert("❌ No se pudo conectar con el servidor. Verifica tu conexión.");
            } finally {
                // 5. Restaurar botón
                if (btnGuardar) {
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = originalHTML;
                }
            }
        });
    }
});

/**
 * Función global para cargar proveedores (útil para selects o tablas)
 */
async function obtenerProveedores() {
    try {
        const response = await fetch(`${BASE_URL_API}/providers`);
        return await response.json();
    } catch (error) {
        console.error("🚨 Error obteniendo proveedores:", error);
        return { success: false, data: [] };
    }
}