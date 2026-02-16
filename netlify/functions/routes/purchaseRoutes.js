const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');

/**
 * GESTIÓN DE COMPRAS - MARQUETERÍA LA CHICA MORALES
 * Versión: 12.1.9 - SINCRO TOTAL DE CAMPOS (costo_total / proveedor)
 */

// 1. Obtener todas las compras
router.get('/', async (req, res) => {
    try {
        console.log("📥 Consultando historial de compras...");
        
        if (!Purchase) {
            throw new Error("El modelo Purchase no está cargado correctamente.");
        }

        const purchases = await Purchase.find()
            .populate('proveedor', 'nombre') // Ajustado a 'proveedor' según el nuevo estándar
            .sort({ fecha: -1 })
            .lean(); 

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
        console.log("📝 Procesando cuerpo de compra recibida:", req.body);

        /**
         * GANCHO DE COMPATIBILIDAD V12.1.9
         * Mapeamos las variaciones de nombres de campos para que coincidan con el Schema
         */
        const data = {
            proveedor: req.body.proveedor || req.body.proveedorId || req.body.providerId,
            costo_total: req.body.costo_total || req.body.precio_total || req.body.montoTotal,
            cantidad: req.body.cantidad || req.body.cantidad_m2 || 0,
            materialId: req.body.materialId,
            tipo: req.body.tipo || "COMPRA",
            detalles: req.body.detalles || {},
            fecha: req.body.fecha || new Date()
        };

        // Validación de integridad con los nuevos nombres
        if (!data.proveedor) {
            return res.status(400).json({ 
                success: false, 
                error: "El ID del proveedor (proveedor) es obligatorio." 
            });
        }

        if (data.costo_total === undefined || data.costo_total < 0) {
            return res.status(400).json({ 
                success: false, 
                error: "El monto total (costo_total) es inválido." 
            });
        }

        console.log(`✅ Validado: Registrando compra para proveedor: ${data.proveedor}`);
        
        // Creamos la instancia con el objeto normalizado
        const newPurchase = new Purchase(data);
        await newPurchase.save();
        
        res.status(201).json({ 
            success: true, 
            message: "Compra registrada correctamente",
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