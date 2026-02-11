const express = require('express');
const router = express.Router();
const { getSuppliers, createSupplier, deleteSupplier } = require('../controllers/supplierController');

/**
 * MIDDLEWARE DE NORMALIZACIÓN PRO
 * Ahora captura todos los campos del nuevo formulario de Marquetería Pro.
 */
const normalizeSupplierData = (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        const { nombre, nit, telefono, contacto, correo, direccion, categoria } = req.body;
        
        // Mantenemos los campos separados para que el modelo Supplier los reciba correctamente
        req.body.nombre = nombre ? nombre.trim() : "";
        req.body.nit = nit || "N/A";
        req.body.telefono = telefono || "Sin teléfono";
        req.body.contacto = contacto || "N/A";
        req.body.correo = correo || "n/a";
        req.body.direccion = direccion || "Dirección no registrada";
        req.body.categoria = categoria || "General";
        
        // Log detallado para confirmar que los datos viajan completos al controlador
        console.log(`✅ Procesando Proveedor: ${req.body.nombre}`);
        console.log(`   ID Fiscal (NIT): ${req.body.nit} | Tel: ${req.body.telefono}`);
    }
    next();
};

// --- DEFINICIÓN DE RUTAS ---

// Obtener todos los proveedores para la agenda
router.get('/', getSuppliers);

// Crear proveedor con la nueva estructura de datos completa
router.post('/', normalizeSupplierData, createSupplier);

// Eliminar proveedor de forma permanente
router.delete('/:id', deleteSupplier);

module.exports = router;