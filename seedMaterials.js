/**
 * Script para cargar materiales iniciales (Vidrios, Espejos, MDF, etc.)
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Material = require('./models/Material');

dotenv.config();

const materialesIniciales = [
    {
        nombre: "Vidrio 3mm",
        ancho_lamina_cm: 183,
        largo_lamina_cm: 244,
        precio_total_lamina: 131378, // Precio basado en tus cálculos
        stock_actual_m2: 4.46, // Una lámina completa
        stock_minimo_m2: 1.0,
        tipo: 'm2'
    },
    {
        nombre: "Espejo 3mm",
        ancho_lamina_cm: 183,
        largo_lamina_cm: 244,
        precio_total_lamina: 150000,
        stock_actual_m2: 4.46,
        stock_minimo_m2: 1.0,
        tipo: 'm2'
    },
    {
        nombre: "Passepartout",
        ancho_lamina_cm: 80,
        largo_lamina_cm: 120,
        precio_total_lamina: 27428,
        stock_actual_m2: 0.96,
        stock_minimo_m2: 0.2,
        tipo: 'm2'
    },
    {
        nombre: "MDF 3mm",
        ancho_lamina_cm: 183,
        largo_lamina_cm: 244,
        precio_total_lamina: 45000,
        stock_actual_m2: 4.46,
        stock_minimo_m2: 1.0,
        tipo: 'm2'
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("🔌 Conectado a MongoDB para la carga de datos...");

        // Limpiamos la colección actual para evitar duplicados
        await Material.deleteMany({});
        console.log("🗑️ Inventario antiguo limpiado.");

        // Insertamos los nuevos materiales
        await Material.insertMany(materialesIniciales);
        console.log("✅ Materiales cargados exitosamente:");
        materialesIniciales.forEach(m => console.log(`   - ${m.nombre}`));

        mongoose.connection.close();
        console.log("🔌 Conexión cerrada. Script finalizado.");
    } catch (error) {
        console.error("❌ Error al cargar materiales:", error);
        process.exit(1);
    }
};

seedDB();