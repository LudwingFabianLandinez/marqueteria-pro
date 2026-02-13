const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider'); 

// --- IMPORTACIÓN DEL CONTROLADOR (Esto es lo que faltaba y causaba el error 502) ---
const provCtrl = require('../controllers/providerController');

/**
 * GESTIÓN DE PROVEEDORES - MARQUETERÍA LA CHICA MORALES
 * Este archivo maneja tanto /api/providers como /api/suppliers
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

// --- RUTAS CON PROTECCIÓN DE CALLBACKS ---

// 1. Obtener todos los proveedores
router.get('/', async (req, res, next) => {
    // Buscamos el método en el controlador (ahora que provCtrl ya existe)
    const method = provCtrl.getProviders || provCtrl.getAll;
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    console.error("🚨 Error: Método de consulta de proveedores no encontrado en controlador");
    res.status(500).json({ success: false, error: "Método de consulta no definido en el controlador" });
});

// 2. Crear un nuevo proveedor (con normalización)
router.post('/', normalizeData, async (req, res, next) => {
    const method = provCtrl.createProvider || provCtrl.saveProvider || provCtrl.addProvider;
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    res.status(500).json({ success: false, error: "Método de creación no definido" });
});

// 3. Obtener un solo proveedor por ID
router.get('/:id', async (req, res, next) => {
    const method = provCtrl.getOneProvider || provCtrl.getProviderById;
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    res.status(500).json({ success: false, error: "Método de búsqueda por ID no definido" });
});

// 4. Actualizar un proveedor
router.put('/:id', normalizeData, async (req, res, next) => {
    if (typeof provCtrl.updateProvider === 'function') {
        return provCtrl.updateProvider(req, res, next);
    }
    res.status(500).json({ success: false, error: "Método de actualización no definido" });
});

// 5. Eliminar un proveedor
router.delete('/:id', async (req, res, next) => {
    if (typeof provCtrl.deleteProvider === 'function') {
        return provCtrl.deleteProvider(req, res, next);
    }
    res.status(500).json({ success: false, error: "Método de eliminación no definido" });
});

module.exports = router;