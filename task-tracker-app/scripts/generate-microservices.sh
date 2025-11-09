#!/bin/bash

# Microservices Generator Script
# Creates skeleton structure for all microservices

BASE_DIR="services-microservices"

# Service definitions: name:port
SERVICES=(
  "excel-service:5002"
  "project-service:5003"
  "subproject-service:5004"
  "structural-elements-service:5005"
  "jobs-service:5006"
  "metrics-service:5007"
)

create_service() {
  local SERVICE_NAME=$1
  local PORT=$2
  local SERVICE_DIR="$BASE_DIR/$SERVICE_NAME"
  
  echo "Creating $SERVICE_NAME on port $PORT..."
  
  mkdir -p "$SERVICE_DIR"/{models,routes,middleware,utils}
  
  # package.json
  cat > "$SERVICE_DIR/package.json" <<EOF
{
  "name": "$SERVICE_NAME",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.3",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "redis": "^4.6.0"
  }
}
EOF

  # server.js
  cat > "$SERVICE_DIR/server.js" <<EOF
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || $PORT;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const MONGODB_PASSWORD = fs.existsSync('/run/secrets/mongodb_password') 
  ? fs.readFileSync('/run/secrets/mongodb_password', 'utf8').trim()
  : process.env.MONGODB_PASSWORD || '';

const mongoUri = MONGODB_PASSWORD 
  ? \`mongodb://admin:\${MONGODB_PASSWORD}@mongodb:27017/tasktracker?authSource=admin&replicaSet=rs0\`
  : 'mongodb://mongodb:27017/tasktracker';

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected to $SERVICE_NAME');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Routes
app.use('/health', require('./routes/health'));
// TODO: Add your routes here

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 $SERVICE_NAME running on port \${PORT}\`);
});

module.exports = app;
EOF

  # health.js
  cat > "$SERVICE_DIR/routes/health.js" <<EOF
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      service: '$SERVICE_NAME',
      status: 'healthy',
      mongodb: mongoStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      service: '$SERVICE_NAME',
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
EOF

  # Dockerfile
  cat > "$SERVICE_DIR/Dockerfile" <<EOF
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE $PORT

CMD ["node", "server.js"]
EOF

  # .dockerignore
  cat > "$SERVICE_DIR/.dockerignore" <<EOF
node_modules
npm-debug.log
.env
.git
EOF

  echo "✅ Created $SERVICE_NAME"
}

# Create all services
for service_def in "${SERVICES[@]}"; do
  IFS=':' read -r name port <<< "$service_def"
  create_service "$name" "$port"
done

echo ""
echo "🎉 All microservices created!"
echo ""
echo "Next steps:"
echo "1. Copy business logic from services/backend-api/routes to each service"
echo "2. Copy models from services/backend-api/models to each service"
echo "3. Run: cd services-microservices/[service-name] && npm install"
echo "4. Update docker-compose.microservices.yml"
