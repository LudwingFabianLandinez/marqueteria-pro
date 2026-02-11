/**
 * LÓGICA DE PROVEEDORES - MARQUETERÍA PRO
 * Conecta el formulario HTML con la base de datos a través de API_URL
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
                // 4. Enviar a la base de datos (CORREGIDO: Usando fetch directo a la API_URL)
                // Esto reemplaza al antiguo 'API.saveSupplier' que no existía
                const response = await fetch(`${API_URL}/providers`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(supplierData)
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
                console.error("Error en la solicitud:", error);
                alert("❌ No se pudo conectar con el servidor. Verifica tu conexión.");
            } finally {
                // 5. Restaurar botón
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = originalHTML;
            }
        });
    }
});

/**
 * Sugerencia Adicional: Función para cargar proveedores (por si necesitas listarlos)
 */
async function obtenerProveedores() {
    try {
        const response = await fetch(`${API_URL}/providers`);
        return await response.json();
    } catch (error) {
        console.error("Error obteniendo proveedores:", error);
        return { success: false, data: [] };
    }
}