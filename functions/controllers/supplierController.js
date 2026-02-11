const Supplier = require('../models/Supplier');

// Obtener todos los proveedores ordenados de la A a la Z
exports.getSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ nombre: 1 });
        res.status(200).json({ success: true, data: suppliers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Crear un proveedor (SUMA TOTAL DE CAMPOS)
exports.createSupplier = async (req, res) => {
    try {
        // Extraemos todos los campos que normalizamos en la ruta
        const { 
            nombre, 
            nit, 
            telefono, 
            contacto, 
            correo, 
            direccion, 
            categoria 
        } = req.body;

        // Verificamos que al menos el nombre exista antes de intentar guardar
        if (!nombre) {
            return res.status(400).json({ 
                success: false, 
                error: "El nombre del proveedor es obligatorio" 
            });
        }

        // SUMA: Ahora guardamos el objeto completo con todos los datos detallados
        const newSupplier = await Supplier.create({
            nombre,
            nit,
            telefono,
            contacto,
            correo,
            direccion,
            categoria
        });
        
        console.log("✅ Proveedor guardado con éxito en Agenda:", newSupplier.nombre);
        res.status(201).json({ success: true, data: newSupplier });

    } catch (error) {
        console.error("🚨 Error al crear proveedor:", error);
        
        let mensajeError = "Error interno al guardar";
        // Manejo de duplicados (evita que el sistema falle si el nombre ya existe)
        if (error.code === 11000) {
            mensajeError = "Ya existe un proveedor registrado con este nombre";
        }
        
        res.status(400).json({ 
            success: false, 
            error: mensajeError,
            details: error.message 
        });
    }
};

// Eliminar un proveedor
exports.deleteSupplier = async (req, res) => {
    try {
        const result = await Supplier.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ success: false, error: "Proveedor no encontrado" });
        }
        res.status(200).json({ success: true, message: "Proveedor eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};