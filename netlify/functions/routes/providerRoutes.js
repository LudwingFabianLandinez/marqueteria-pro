const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider'); 

// --- IMPORTACIÓN DEL CONTROLADOR ---
const provCtrl = require('../controllers/providerController');

/**
 * GESTIÓN DE PROVEEDORES - MARQUETERÍA LA CHICA MORALES
 * Ajuste v12.2.13: Validación de NIT único y liberación de duplicidad de nombres.
 */

// Middleware de normalización
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
    const method = provCtrl.getProviders || provCtrl.getAll || provCtrl.list || provCtrl.getProvidersAll;
    if (typeof method === 'function') return method(req, res, next);
    res.status(500).json({ success: false, error: "Función de lectura no encontrada" });
});

// 2. Crear un nuevo proveedor (POST /) - ¡AJUSTE CLAVE AQUÍ!
router.post('/', normalizeData, async (req, res, next) => {
    try {
        const { nit, nombre } = req.body;

        // VALIDACIÓN DE NIT MAESTRO
        if (nit) {
            const existeNit = await Provider.findOne({ nit: nit.trim() });
            if (existeNit) {
                // Devolvemos el error exacto que solicitaste
                return res.status(400).json({ 
                    success: false, 
                    message: `El NIT ${nit} ya pertenece al proveedor ${existeNit.nombre}` 
                });
            }
        }

        // Si el NIT no existe, procedemos al controlador original
        const method = provCtrl.createProvider || provCtrl.saveProvider || provCtrl.addProvider || provCtrl.create;
        
        if (typeof method === 'function') {
            return method(req, res, next);
        }
        
        res.status(500).json({ success: false, error: "Función de guardado no encontrada" });

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