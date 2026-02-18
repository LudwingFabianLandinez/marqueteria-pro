const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider'); 

// --- IMPORTACIÓN DEL CONTROLADOR ---
const provCtrl = require('../controllers/providerController');

/**
 * GESTIÓN DE PROVEEDORES - MARQUETERÍA LA CHICA MORALES
 * Ajuste v12.2.13: Validación de NIT único y liberación de duplicidad de nombres.
 * Objetivo: Eliminar errores 404 asegurando que el router encuentre el controlador.
 */

// Middleware de normalización (Mantenido 100% original)
const normalizeData = (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        const { nombre, telefono, correo } = req.body;
        
        if (nombre) req.body.nombre = nombre.trim();
        if (telefono) req.body.telefono = telefono.trim();
        if (correo && typeof correo === 'string') req.body.correo = correo.toLowerCase().trim();
        
        console.log(`📦 Procesando datos para proveedor: ${req.body.nombre || 'Sin nombre'}`);
    }
    next();
};

// --- RUTAS ---

// 1. Obtener todos los proveedores (GET /)
router.get('/', async (req, res, next) => {
    // Intentamos los nombres de función que ya tienes definidos
    const method = provCtrl.getProviders || provCtrl.getAll || provCtrl.list || provCtrl.getProvidersAll;
    
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    
    // Si no encuentra el método, devolvemos un error JSON claro para evitar el 404 HTML
    res.status(500).json({ success: false, error: "Función de lectura no encontrada en providerController" });
});

// 2. Crear un nuevo proveedor (POST /) - ¡VALIDACIÓN NIT MAESTRO!
router.post('/', normalizeData, async (req, res, next) => {
    try {
        const { nit } = req.body;

        // VALIDACIÓN DE NIT MAESTRO (Tu blindaje de datos)
        if (nit && nit !== "N/A") {
            const existeNit = await Provider.findOne({ nit: nit.trim() });
            if (existeNit) {
                return res.status(400).json({ 
                    success: false, 
                    message: `El NIT ${nit} ya pertenece al proveedor ${existeNit.nombre}` 
                });
            }
        }

        // Ejecución del controlador
        const method = provCtrl.createProvider || provCtrl.saveProvider || provCtrl.addProvider || provCtrl.create;
        
        if (typeof method === 'function') {
            return method(req, res, next);
        }
        
        res.status(500).json({ success: false, error: "Función de guardado no encontrada en providerController" });

    } catch (error) {
        console.error("🚨 Error en validación de ruta:", error);
        res.status(500).json({ success: false, error: "Error interno al validar el NIT" });
    }
});

// 3. Obtener un solo proveedor por ID (GET /:id)
router.get('/:id', async (req, res, next) => {
    const method = provCtrl.getOneProvider || provCtrl.getProviderById || provCtrl.getById;
    if (typeof method === 'function') return method(req, res, next);
    res.status(500).json({ success: false, error: "Método por ID no definido" });
});

// 4. Actualizar un proveedor (PUT /:id)
router.put('/:id', normalizeData, async (req, res, next) => {
    const method = provCtrl.updateProvider || provCtrl.editProvider || provCtrl.update;
    if (typeof method === 'function') return method(req, res, next);
    res.status(500).json({ success: false, error: "Método de actualización no definido" });
});

// 5. Eliminar un proveedor (DELETE /:id)
router.delete('/:id', async (req, res, next) => {
    const method = provCtrl.deleteProvider || provCtrl.removeProvider || provCtrl.destroy;
    if (typeof method === 'function') return method(req, res, next);
    res.status(500).json({ success: false, error: "Método de eliminación no definido" });
});

module.exports = router;