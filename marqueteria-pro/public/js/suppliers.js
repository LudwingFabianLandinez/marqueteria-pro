/**
 * LÓGICA DE PROVEEDORES - MARQUETERÍA PRO
 * Conecta el formulario HTML con la base de datos a través de api.js
 */

document.addEventListener('DOMContentLoaded', () => {
    const supplierForm = document.getElementById('supplierForm');

    if (supplierForm) {
        supplierForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Capturar el botón para feedback visual
            const btnGuardar = supplierForm.querySelector('.btn-save');
            const originalHTML = btnGuardar.innerHTML;

            // 2. Recolectar datos del formulario
            const formData = new FormData(supplierForm);
            const supplierData = {
                nombre: formData.get('nombre'),
                nit: formData.get('nit') || "N/A",
                contacto: formData.get('contacto') || "N/A",
                telefono: formData.get('telefono') || "Sin teléfono",
                correo: formData.get('correo') || "n/a",
                direccion: formData.get('direccion') || "Dirección no registrada",
                categoria: formData.get('categoria') || "General"
            };

            // 3. Estado de "Guardando..."
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Procesando...`;

            try {
                // 4. Enviar a la base de datos usando api.js
                const result = await API.saveSupplier(supplierData);

                if (result.success) {
                    alert("✅ Proveedor guardado correctamente en la base de datos.");
                    supplierForm.reset();
                    // Redirigir o cerrar si es necesario
                    window.location.href = 'dashboard.html';
                } else {
                    alert("❌ Error: " + result.message);
                }
            } catch (error) {
                console.error("Error en la solicitud:", error);
                alert("❌ No se pudo conectar con el servidor.");
            } finally {
                // 5. Restaurar botón
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = originalHTML;
            }
        });
    }
});