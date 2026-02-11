const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/statsController');

// Cambiamos '/' para que la ruta completa sea /api/stats
router.get('/', getDashboardStats);

module.exports = router;