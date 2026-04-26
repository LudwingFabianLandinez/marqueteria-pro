/**
 * Script para cargar los 3 nuevos materiales de tipo FOAM/LÁMINA
 * MARQUETERÍA LA CHICA MORALES
 * 
 * MATERIALES: LAMINA DE ESPONJA | LAMINA DE ICOPOR 1CM | LAMINA DE ICOPOR DE 5CM
 * 
 * INSTRUCCIONES:
 * 1. Asegúrate de que MongoDB Compass esté conectado y el servicio activo.
 * 2. Ejecuta: node seedFoamMaterials.js
 * 3. Una vez insertados, registra una compra para cada uno desde el inventario
 *    y así asignarles precio real.
 * 
 * DIMENSIONES: Se usan 100x200 cm (lámina estándar). Puedes ajustar en el inventario.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Material = require('./netlify/functions/models/Material');

dotenv.config();

const nuevosMateriales = [
    {
        nombre: "LAMINA DE ESPONJA",
        categoria: "Foam",
        tipo: "m2",
        ancho_lamina_cm: 100,
        largo_lamina_cm: 200,
        precio_total_lamina: 0,
        stock_actual: 0,
        stock_minimo: 1.0
    },
    {
        nombre: "LAMINA DE ICOPOR 1CM",
        categoria: "Foam",
        tipo: "m2",
        ancho_lamina_cm: 100,
        largo_lamina_cm: 200,
        precio_total_lamina: 0,
        stock_actual: 0,
        stock_minimo: 1.0
    },
    {
        nombre: "LAMINA DE ICOPOR DE 5CM",
        categoria: "Foam",
        tipo: "m2",
        ancho_lamina_cm: 100,
        largo_lamina_cm: 200,
        precio_total_lamina: 0,
        stock_actual: 0,
        stock_minimo: 1.0
    }
];

const seedDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;

        if (!uri) {
            throw new Error("La variable MONGODB_URI no está definida en el archivo .env");
        }

        console.log("⏳ Conectando a MongoDB...");
        await mongoose.connect(uri);
        console.log("🔌 ¡CONECTADO EXITOSAMENTE!");

        let insertados = 0;
        let omitidos = 0;

        for (const mat of nuevosMateriales) {
            const existe = await Material.findOne({
                nombre: { $regex: new RegExp(`^${mat.nombre}$`, 'i') }
            });

            if (existe) {
                console.log(`⚠️  Ya existe: "${mat.nombre}" → Omitido (no se sobreescribe).`);
                omitidos++;
            } else {
                await Material.create(mat);
                console.log(`✅ Creado: "${mat.nombre}"`);
                insertados++;
            }
        }

        console.log(`\n📊 Resumen: ${insertados} creados, ${omitidos} omitidos.`);
        console.log("💡 Recuerda registrar una compra para asignar el precio a cada material.");

        await mongoose.connection.close();
        console.log("🔌 Conexión cerrada. Script finalizado.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
};

seedDB();
