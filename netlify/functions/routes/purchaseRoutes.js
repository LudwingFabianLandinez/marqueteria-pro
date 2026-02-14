const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');

/**
 * GESTIÓN DE COMPRAS - MARQUETERÍA LA CHICA MORALES
 * Este archivo maneja el historial de adquisiciones de suministros.
 */

// 1. Obtener todas las compras
router.get('/', async (req, res) => {
    try {
        console.log("📥 Consultando historial de compras...");
        
        // Verificamos si el modelo existe para evitar crash
        if (!Purchase) {
            throw new Error("El modelo Purchase no está cargado correctamente.");
        }

        const purchases = await Purchase.find()
            .populate('proveedorId', 'nombre')
            .sort({ fecha: -1 })
            .lean(); // .lean() mejora el rendimiento en Netlify

        res.json({ 
            success: true, 
            count: purchases.length,
            data: purchases 
        });
    } catch (err) {
        console.error("🚨 Error en GET /purchases:", err.message);
        res.status(500).json({ 
            success: false, 
            error: "No se pudo obtener el historial de compras.",
            detail: err.message 
        });
    }
});

// 2. Registrar una nueva compra
router.post('/', async (req, res) => {
    try {
        const { proveedorId, montoTotal, items } = req.body;

        // Validación básica de integridad
        if (!proveedorId) {
            return res.status(400).json({ 
                success: false, 
                error: "El ID del proveedor es obligatorio." 
            });
        }

        if (!montoTotal || montoTotal <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: "El monto total debe ser mayor a cero." 
            });
        }

        console.log(`📝 Registrando nueva compra para proveedor ID: ${proveedorId}`);
        
        const newPurchase = new Purchase(req.body);
        await newPurchase.save();
        
        res.status(201).json({ 
            success: true, 
            data: newPurchase 
        });
    } catch (err) {
        console.error("🚨 Error en POST /purchases:", err.message);
        res.status(400).json({ 
            success: false, 
            error: "Error al guardar el registro de compra.",
            detail: err.message 
        });
    }
});

module.exports = router;