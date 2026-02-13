const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider'); // <--- ASEGÚRATE DE QUE ESTÉ AQUÍ

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
        if (correo) req.body.correo = correo.toLowerCase().trim();
        
        console.log(`📦 Procesando datos para proveedor: ${req.body.nombre || 'Sin nombre'}`);
    }
    next();
};

// --- RUTAS CON PROTECCIÓN DE CALLBACKS ---

// 1. Obtener todos los proveedores
// AJUSTE: Forzamos la ejecución de la función de consulta
router.get('/', async (req, res, next) => {
    const method = provCtrl.getProviders || provCtrl.getAll;
    if (typeof method === 'function') {
        return method(req, res, next);
    }
    console.error("🚨 Error: Método de consulta de proveedores no encontrado en controlador");
    res.status(500).json({ success: false, error: "Método de consulta no definido" });
});

// 2. Crear un nuevo proveedor (con normalización)
router.post('/', normalizeData, async (req, res, next) => {
    const method = provCtrl.createProvider || provCtrl.saveProvider;
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