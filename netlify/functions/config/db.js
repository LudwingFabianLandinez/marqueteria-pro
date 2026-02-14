const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Configuraciones críticas para evitar que Netlify deje la función "colgada"
        mongoose.set('strictQuery', false);
        mongoose.set('bufferCommands', false); 

        // Si ya está conectado (readyState 1) o conectando (readyState 2), no hacemos nada
        if (mongoose.connection.readyState >= 1) {
            console.log("⏩ Usando conexión de base de datos existente");
            return;
        }

        // Priorizamos MONGODB_URI pero buscamos MONGO_URI como respaldo
        const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI;

        if (!dbURI) {
            console.error("🚨 ERROR: No se encontró la URL de conexión (MONGODB_URI) en las variables de entorno.");
            throw new Error("Falta la variable de entorno MONGODB_URI");
        }

        console.log("☁️ Iniciando conexión con MongoDB Atlas...");
        
        await mongoose.connect(dbURI, {
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 45000,
            // Estas opciones ayudan a mantener la conexión estable en serverless
            heartbeatFrequencyMS: 10000,
        });

        console.log("✅ Conexión establecida con éxito");
    } catch (err) {
        console.error("❌ Fallo crítico en config/db.js:", err.message);
        throw err;
    }
};

module.exports = connectDB;