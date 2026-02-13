const Provider = require('../models/Provider');

/**
 * CONTROLADOR ÚNICO DE PROVEEDORES - MARQUETERÍA LA CHICA MORALES
 * Sincronizado con MongoDB Atlas (Colección: proveedores)
 */

// 1. Obtener todos los proveedores (Ordenados A-Z)
const getProviders = async (req, res) => {
    try {
        const providers = await Provider.find().sort({ nombre: 1 }).lean();
        res.status(200).json({ success: true, data: providers || [] });
    } catch (error) {
        console.error('❌ Error al obtener proveedores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. Obtener un solo proveedor por ID (Necesario para el modal de edición)
const getOneProvider = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id).lean();
        if (!provider) return res.status(404).json({ success: false, error: "Proveedor no encontrado" });
        res.status(200).json({ success: true, data: provider });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. Crear un nuevo proveedor (Con validación de duplicados)
const createProvider = async (req, res) => {
    try {
        const { nombre, nit, telefono, contacto, correo, direccion, categoria } = req.body;
        
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: "El nombre del proveedor es obligatorio" 
            });
        }

        // Validación de NIT duplicado (solo si se proporciona NIT)
        if (nit && nit.trim() !== '') {
            const existente = await Provider.findOne({ nit: nit.trim() });
            if (existente) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Ya existe un proveedor con el NIT: ${nit}` 
                });
            }
        }

        const newProvider = await Provider.create({
            nombre: nombre.trim(),
            nit: nit ? nit.trim() : undefined,
            telefono: telefono ? telefono.trim() : 'Sin teléfono',
            contacto: contacto ? contacto.trim() : '',
            correo: correo ? correo.trim() : '',
            direccion: direccion ? direccion.trim() : '',
            categoria: categoria || 'General'
        });
        
        console.log("✅ Proveedor guardado con éxito:", newProvider.nombre);
        res.status(201).json({ success: true, data: newProvider });

    } catch (error) {
        console.error("🚨 Error al crear proveedor:", error);
        let mensajeError = "Error al guardar";
        if (error.code === 11000) mensajeError = "El nombre o NIT ya existe";
        
        res.status(400).json({ success: false, error: mensajeError });
    }
};

// 4. Actualizar proveedor (Crucial para corregir datos sin borrar)
const updateProvider = async (req, res) => {
    try {
        const updatedProvider = await Provider.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!updatedProvider) return res.status(404).json({ success: false, error: "No encontrado" });
        res.status(200).json({ success: true, data: updatedProvider });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// 5. Eliminar proveedor
const deleteProvider = async (req, res) => {
    try {
        const result = await Provider.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, error: "No encontrado" });
        
        res.status(200).json({ success: true, message: "Proveedor eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// EXPORTACIÓN UNIFICADA (Compatible con los alias de las rutas)
module.exports = {
    getProviders,
    getAll: getProviders,
    getOneProvider,
    createProvider,
    saveProvider: createProvider,
    updateProvider,
    deleteProvider
};