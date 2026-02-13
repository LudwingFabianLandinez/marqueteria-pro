const express = require('express');
const router = express.Router();

/**
 * GESTIÓN DE CLIENTES - MARQUETERÍA LA CHICA MORALES
 * Esta ruta maneja el directorio de clientes para facturación y cotizaciones.
 */

// Middleware de monitoreo para Clientes
router.use((req, res, next) => {
    console.log(`👤 [ClientRoute] ${req.method} ${req.url}`);
    next();
});

/**
 * 1. OBTENER LISTA DE CLIENTES
 * Por ahora devuelve un mensaje de éxito, pero está lista para conectar un controlador.
 */
router.get('/', (req, res) => {
    try {
        // Aquí podrías en el futuro llamar a: clientController.getClients
        res.json({ 
            success: true, 
            message: "Módulo de clientes activo",
            data: [] // Lista vacía para que el frontend no de error al iterar
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 2. BUSCAR CLIENTE POR NOMBRE O TELÉFONO
 * Útil para el buscador rápido en la pantalla de facturación.
 */
router.get('/search', (req, res) => {
    const { q } = req.query;
    console.log(`🔍 Buscando cliente: ${q}`);
    res.json({ success: true, data: [] });
});

/**
 * 3. REGISTRAR CLIENTE (Placeholder)
 */
router.post('/', (req, res) => {
    const { nombre } = req.body;
    console.log(`📝 Intento de registro de cliente: ${nombre}`);
    res.status(201).json({ 
        success: true, 
        message: "Simulación de registro exitosa (Modo desarrollo)" 
    });
});

module.exports = router;