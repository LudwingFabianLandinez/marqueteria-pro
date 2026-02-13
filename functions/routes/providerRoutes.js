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

// --- RUTAS CON PROTECCIÓN DE CALLBACKS ---

// 1. Obtener todos los proveedores
// Intentamos usar getProviders o getAll según se haya definido en el controlador
router.get('/', provCtrl.getProviders || provCtrl.getAll || ((req, res) => res.status(500).json({error: "Método getProviders no definido"})));

// 2. Crear un nuevo proveedor (con normalización)
router.post('/', normalizeData, provCtrl.createProvider || provCtrl.saveProvider || ((req, res) => res.status(500).json({error: "Método createProvider no definido"})));

// 3. Obtener un solo proveedor por ID
router.get('/:id', provCtrl.getOneProvider || provCtrl.getProviderById || ((req, res) => res.status(500).json({error: "Método getOneProvider no definido"})));

// 4. Actualizar un proveedor
router.put('/:id', normalizeData, provCtrl.updateProvider || ((req, res) => res.status(500).json({error: "Método updateProvider no definido"})));

// 5. Eliminar un proveedor
router.delete('/:id', provCtrl.deleteProvider || ((req, res) => res.status(500).json({error: "Método deleteProvider no definido"})));

module.exports = router;