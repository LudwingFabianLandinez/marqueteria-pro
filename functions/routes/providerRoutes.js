const express = require('express');
const router = express.Router();
// 🛠️ AJUSTE DE RUTA: Subimos un nivel para encontrar la carpeta controllers
const provCtrl = require('../controllers/providerController');

/**
 * GESTIÓN DE PROVEEDORES - MARQUETERÍA LA CHICA MORALES
 * Rutas para el control de entidades de suministro.
 */

// 1. Obtener todos los proveedores (Para llenar selects y tablas)
router.get('/', provCtrl.getProviders);

// 2. Obtener un solo proveedor por ID (Opcional, para consultas específicas)
router.get('/:id', provCtrl.getProviderById || ((req, res) => res.status(501).json({msg: "No implementado"})));

// 3. Crear un nuevo proveedor
router.post('/', provCtrl.createProvider);

// 4. Eliminar un proveedor
router.delete('/:id', provCtrl.deleteProvider);

module.exports = router;