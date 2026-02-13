const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Configuraciones críticas para que los botones no se bloqueen
        mongoose.set('strictQuery', false);
        mongoose.set('bufferCommands', false); // Detiene la espera de 10 segundos

        if (mongoose.connection.readyState >= 1) {
            return;
        }

        console.log("☁️ Intentando conectar a MongoDB Atlas...");
        
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000, // Si no conecta en 5s, avisa (no espera 10s)
            socketTimeoutMS: 45000,
        });

        console.log("✅ Conexión establecida y lista para consultas");
    } catch (err) {
        console.error("❌ Error en config/db.js:", err.message);
        throw err;
    }
};

module.exports = connectDB;