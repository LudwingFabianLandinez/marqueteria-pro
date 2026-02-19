/**
 * LÓGICA DE PROVEEDORES - MARQUETERÍA PRO
 * Versión Consolidada: Sincronización Total con Backend (Diseño Cards)
 * Mantiene estructura visual y blindaje original.
 */

// Definición segura de la URL de la API - Ajustada para Netlify/Local
const BASE_URL_API = (window.API && window.API.url) ? window.API.url : '/.netlify/functions/server';

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
                    // Ejecutamos la carga automática tras guardar
                    await window.cargarTablaProveedores();
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

    // --- LÓGICA DE CONSULTA ---
    const btnConsultar = document.getElementById('btnConsultarProv');
    
    if (btnConsultar) {
        btnConsultar.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("🖱️ Clic detectado en btnConsultarProv: Consultando...");
            await window.cargarTablaProveedores();
        });
    }
    
    // Carga inicial automática al entrar a la sección
    window.cargarTablaProveedores();
});

/**
 * Función GLOBAL para cargar y renderizar el DIRECTORIO de proveedores (Cards)
 */
window.cargarTablaProveedores = async function() {
    // 1. Buscamos el contenedor del Directorio (Panel oscuro a la derecha)
    // Se usa el ID si existe, o el selector de clase del contenedor de fondo oscuro
    const directorioContainer = document.getElementById('lista-proveedores-body') || 
                                 document.querySelector('.bg-slate-800.p-4') ||
                                 document.querySelector('aside .bg-slate-800');

    if (!directorioContainer) {
        console.warn("⚠️ No se encontró el contenedor del Directorio en el DOM.");
        return;
    }

    // Guardamos el título para no borrarlo
    const tituloHtml = '<h3 class="text-white font-bold mb-4 flex items-center"><i class="fas fa-address-book mr-2"></i> DIRECTORIO</h3>';
    directorioContainer.innerHTML = tituloHtml + '<div class="text-white text-xs p-2"><i class="fas fa-sync fa-spin"></i> Sincronizando con Atlas...</div>';

    try {
        const result = await obtenerProveedores();
        
        // Blindaje de datos
        const proveedores = (result && result.success) ? result.data : (Array.isArray(result) ? result : []);

        // Limpiamos el mensaje de carga, mantenemos el título
        directorioContainer.innerHTML = tituloHtml;

        if (proveedores && proveedores.length > 0) {
            proveedores.forEach(prov => {
                // Creamos la "Card" blanca respetando tu diseño visual
                const card = `
                    <div class="bg-white rounded-lg p-3 mb-3 shadow-md border-l-4 border-blue-600 transition-all hover:shadow-lg">
                        <div class="flex justify-between items-start">
                            <h4 class="text-blue-900 font-bold uppercase text-[11px] leading-tight mb-1">${prov.nombre}</h4>
                            <button onclick="alert('Próximamente')" class="text-gray-400 hover:text-blue-600 text-[10px]">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                        <div class="space-y-0.5">
                            <p class="text-[10px] text-gray-600 flex items-center">
                                <i class="fas fa-id-card w-4 text-blue-400"></i> NIT: ${prov.nit || 'N/A'}
                            </p>
                            <p class="text-[10px] text-gray-600 flex items-center">
                                <i class="fas fa-phone w-4 text-blue-400"></i> ${prov.telefono}
                            </p>
                            <p class="text-[10px] text-gray-600 flex items-center">
                                <i class="fas fa-user w-4 text-blue-400"></i> ${prov.contacto || 'N/A'}
                            </p>
                        </div>
                        <div class="mt-2 pt-1 border-t border-gray-100">
                            <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider">
                                ${prov.categoria.toUpperCase()}
                            </span>
                        </div>
                    </div>
                `;
                directorioContainer.insertAdjacentHTML('beforeend', card);
            });
            console.log("✅ Directorio actualizado con éxito.");
        } else {
            directorioContainer.insertAdjacentHTML('beforeend', '<p class="text-gray-400 text-xs p-2 italic">No hay proveedores registrados.</p>');
        }
    } catch (error) {
        console.error("🚨 Error al renderizar directorio:", error);
        directorioContainer.insertAdjacentHTML('beforeend', '<p class="text-red-400 text-xs p-2">Error de conexión.</p>');
    }
};

/**
 * Función para obtener datos de la API (Interna)
 */
async function obtenerProveedores() {
    try {
        const url = `${BASE_URL_API}/providers?t=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            if (errorText.includes('<!DOCTYPE html>')) throw new Error("404");
            throw new Error(`Status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("🚨 Error fetch:", error);
        return { success: false, data: [] };
    }
}