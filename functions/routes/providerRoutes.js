const express = require('express');
const router = express.Router();
// Importamos el controlador definitivo
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
        if (correo) req.body.correo = correo.toLowerCase().trim();
        
        console.log(`📦 Procesando datos para proveedor: ${req.body.nombre || 'Sin nombre'}`);
    }
    next();
};

// --- RUTAS ---

// 1. Obtener todos los proveedores
// GET /api/providers
router.get('/', provCtrl.getProviders);

// 2. Crear un nuevo proveedor (con normalización)
// POST /api/providers
router.post('/', normalizeData, provCtrl.createProvider);

// 3. Obtener un solo proveedor por ID (Útil para ediciones futuras)
// GET /api/providers/:id
router.get('/:id', provCtrl.getOneProvider);

// 4. Actualizar un proveedor
// PUT /api/providers/:id
router.put('/:id', normalizeData, provCtrl.updateProvider);

// 5. Eliminar un proveedor
// DELETE /api/providers/:id
router.delete('/:id', provCtrl.deleteProvider);

module.exports = router;