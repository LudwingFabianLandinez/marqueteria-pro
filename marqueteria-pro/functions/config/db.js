const mongoose = require('mongoose');

const connectDB = async () => {
    // Si ya hay una conexión activa, no creamos una nueva (Optimización para Serverless)
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    try {
        // Busca la URL de Atlas en Netlify; si no existe, usa la local
        const dbUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/marqueteria-pro";
        
        const isLocal = !process.env.MONGODB_URI && !process.env.MONGO_URI;
        console.log(isLocal ? '🏠 MODO LOCAL: Conectando a PC' : '☁️ MODO NUBE: Conectando a MongoDB Atlas');

        // Configuraciones de conexión para mayor estabilidad en la nube
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 // Falla rápido si no hay internet para evitar el lag
        };

        await mongoose.connect(dbUri, options);
        console.log('✅ Base de datos conectada correctamente');
        
    } catch (error) {
        console.error('❌ Error crítico de conexión:', error.message);
        // No cerramos el proceso aquí para que Netlify no mate la función de golpe
    }
};

module.exports = connectDB;