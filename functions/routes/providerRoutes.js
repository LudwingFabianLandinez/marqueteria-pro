const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider'); 

// --- IMPORTACIÓN DEL CONTROLADOR ---
const provCtrl = require('../controllers/providerController');

/**
 * GESTIÓN DE PROVEEDORES - MARQUETERÍA LA CHICA MORALES
 * Sincronizado con server.js y api.js (v4.8+)
 */

// Middleware de normalización: Limpia los datos antes de enviarlos al controlador
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

// --- RUTAS CON PROTECCIÓN DE CALLBACKS Y MULTI-NOMBRE ---

// 1. Obtener todos los proveedores (GET /)
router.get('/', async (req, res, next) => {
    // Buscamos cualquier variante del nombre de la función en el controlador
    const method = provCtrl.getProviders || provCtrl.getAll || provCtrl.list || provCtrl.getProvidersAll;
    
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    
    console.error("🚨 Error: Método de consulta no encontrado en providerController");
    res.status(500).json({ 
        success: false, 
        error: "El servidor no encontró la función de lectura de proveedores" 
    });
});

// 2. Crear un nuevo proveedor (POST /)
router.post('/', normalizeData, async (req, res, next) => {
    const method = provCtrl.createProvider || provCtrl.saveProvider || provCtrl.addProvider || provCtrl.create;
    
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    
    console.error("🚨 Error: Método de creación no encontrado en providerController");
    res.status(500).json({ success: false, error: "El servidor no encontró la función para guardar proveedores" });
});

// 3. Obtener un solo proveedor por ID (GET /:id)
router.get('/:id', async (req, res, next) => {
    const method = provCtrl.getOneProvider || provCtrl.getProviderById || provCtrl.getById;
    
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    res.status(500).json({ success: false, error: "Método de búsqueda por ID no definido" });
});

// 4. Actualizar un proveedor (PUT /:id)
router.put('/:id', normalizeData, async (req, res, next) => {
    const method = provCtrl.updateProvider || provCtrl.editProvider || provCtrl.update;
    
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    res.status(500).json({ success: false, error: "Método de actualización no definido" });
});

// 5. Eliminar un proveedor (DELETE /:id)
router.delete('/:id', async (req, res, next) => {
    const method = provCtrl.deleteProvider || provCtrl.removeProvider || provCtrl.destroy;
    
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    res.status(500).json({ success: false, error: "Método de eliminación no definido" });
});

module.exports = router;