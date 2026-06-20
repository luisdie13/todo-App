require('dotenv').config();
const mongoose = require('mongoose');

// Importar todos los modelos para asegurar que se registren en Mongoose
require('./models/user.model');
require('./models/organization.model');
require('./models/project.model');
require('./models/membership.model');
require('./models/auditLog.model');
require('./models/task.model');
require('./models/comment.model');

const app = require('./app');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/todo_app';

// Iniciar servidor incluso si MongoDB falla (para demostración)
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Intentar conectar a MongoDB con reintentos
let mongoRetries = 0;
const maxRetries = 5;

function connectMongo() {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('✅ Conectado a MongoDB');
      mongoRetries = 0;
    })
    .catch(err => {
      mongoRetries++;
      console.error(`❌ Error conectando a MongoDB (intento ${mongoRetries}/${maxRetries}):`, err.message);
      if (mongoRetries < maxRetries) {
        setTimeout(connectMongo, 5000); // Reintentar en 5 segundos
      } else {
        console.warn('⚠️ No se pudo conectar a MongoDB después de varios intentos. El servidor funcionará sin base de datos.');
      }
    });
}

connectMongo();
