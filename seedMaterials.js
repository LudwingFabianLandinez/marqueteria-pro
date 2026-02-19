/**
 * Script para cargar materiales iniciales en MONGODB LOCAL (Compass)
 * Versión Consolidada - Ajuste de Ruta para estructura Netlify
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// CORRECCIÓN DE RUTA: Sincronizada con tu estructura real de carpetas
// Antes: ./functions/models/Material -> Ahora: ./netlify/functions/models/Material
const Material = require('./netlify/functions/models/Material');

// Carga las variables del archivo .env
dotenv.config();

const materialesIniciales = [
    {
        nombre: "Vidrio 3mm",
        ancho_lamina_cm: 183,
        largo_lamina_cm: 244,
        precio_total_lamina: 131378,
        stock_actual_m2: 4.46,
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
        // En tu .env local DEBE decir: MONGODB_URI=mongodb://localhost:27017/marqueteria
        const uri = process.env.MONGODB_URI;
        
        if (!uri) {
            throw new Error("La variable MONGODB_URI no está definida en el archivo .env");
        }

        console.log("⏳ Conectando a MongoDB Compass (Entorno Local)...");
        
        // Conexión directa a Localhost
        await mongoose.connect(uri);

        console.log("🔌 ¡CONECTADO EXITOSAMENTE AL COMPASS!");

        // Limpiamos la colección para evitar que los datos se dupliquen cada vez que corras el script
        await Material.deleteMany({});
        console.log("🗑️ Inventario local anterior limpiado.");

        // Insertamos los materiales del array
        await Material.insertMany(materialesIniciales);
        console.log("✅ DATOS CARGADOS EN COMPASS:");
        materialesIniciales.forEach(m => console.log(`   - ${m.nombre}`));

        // Cerramos la conexión para liberar la terminal
        await mongoose.connection.close();
        console.log("🔌 Conexión cerrada. Script finalizado con éxito.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Error en la carga local:");
        console.error(error.message);
        console.log("\n💡 TIP: Asegúrate de que MongoDB Compass esté conectado y el servicio activo.");
        process.exit(1);
    }
};

seedDB();