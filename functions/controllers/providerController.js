const Provider = require('../models/Provider');

/**
 * CONTROLADOR DE PROVEEDORES - MARQUETERÍA LA CHICA MORALES
 * Gestión de la agenda de proveedores para compras y trazabilidad.
 */

// 1. Obtener todos los proveedores (Ordenados A-Z)
exports.getProviders = async (req, res) => {
    try {
        const providers = await Provider.find().sort({ nombre: 1 });
        res.status(200).json({ success: true, data: providers });
    } catch (error) {
        console.error('❌ Error al obtener proveedores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. Obtener un solo proveedor por ID
exports.getProviderById = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) return res.status(404).json({ success: false, error: "Proveedor no encontrado" });
        res.status(200).json({ success: true, data: provider });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. Crear un nuevo proveedor (Con validación de duplicados)
exports.createProvider = async (req, res) => {
    try {
        const { nombre, nit, telefono, contacto, correo, direccion, categoria } = req.body;
        
        // Validación de nombre obligatorio
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: "El nombre del proveedor es obligatorio" 
            });
        }

        // Validación de NIT duplicado para evitar errores de base de datos
        if (nit && nit.trim() !== '') {
            const existente = await Provider.findOne({ nit: nit.trim() });
            if (existente) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Ya existe un proveedor registrado con el NIT: ${nit}` 
                });
            }
        }

        const newProvider = new Provider({ 
            nombre: nombre.trim(), 
            nit: nit ? nit.trim() : undefined, 
            telefono: telefono ? telefono.trim() : 'Sin teléfono',
            contacto: contacto ? contacto.trim() : '',
            correo: correo ? correo.trim() : '',
            direccion: direccion ? direccion.trim() : '',
            categoria: categoria || 'General'
        });
        
        await newProvider.save();
        
        console.log('✅ Proveedor creado con éxito');
        res.status(201).json({ success: true, data: newProvider });
    } catch (error) {
        console.error('❌ Error en createProvider:', error);
        
        // Manejo de error de índice duplicado de MongoDB (11000)
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                error: "El NIT o el nombre ya se encuentran registrados" 
            });
        }
        
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. Eliminar proveedor
exports.deleteProvider = async (req, res) => {
    try {
        const provider = await Provider.findByIdAndDelete(req.params.id);
        
        if (!provider) {
            return res.status(404).json({ 
                success: false, 
                error: "Proveedor no encontrado" 
            });
        }
        
        console.log('🗑️ Proveedor eliminado correctamente');
        res.status(200).json({ 
            success: true, 
            message: "Proveedor eliminado de la base de datos" 
        });
    } catch (error) {
        console.error('❌ Error al eliminar proveedor:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};