const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');

// Obtener todas las compras
router.get('/', async (req, res) => {
    try {
        const purchases = await Purchase.find().populate('proveedorId', 'nombre').sort({ fecha: -1 });
        res.json({ success: true, data: purchases });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Registrar una nueva compra
router.post('/', async (req, res) => {
    try {
        const newPurchase = new Purchase(req.body);
        await newPurchase.save();
        res.status(201).json({ success: true, data: newPurchase });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;