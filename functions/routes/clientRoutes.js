const express = require('express');
const router = express.Router();

// Ruta temporal para que no explote el server
router.get('/', (req, res) => {
    res.json({ message: "Ruta de clientes funcionando" });
});

module.exports = router;