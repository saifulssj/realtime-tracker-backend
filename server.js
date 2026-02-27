const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Store latest tracker data
let trackerData = {
  deviceId: 'Train-102',
  latitude: 23.8103,
  longitude: 90.4125,
  speed: 0,
  signal: 'Strong',
  status: 'offline',
  lastUpdate: null
};

// Track connected clients
let connectedClients = 0;

// Socket.io connection
io.on('connection', (socket) => {
  connectedClients++;
  console.log(`Client connected. Total clients: ${connectedClients}`);
  
  // Send current data to newly connected client
  socket.emit('locationUpdate', trackerData);
  
  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`Client disconnected. Total clients: ${connectedClients}`);
  });
});

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'Real-Time Tracker API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      location: '/api/location',
      post_location: 'POST /api/location'
    }
  });
});

// API endpoint for ESP32 to send location data
// ESP32 sends: POST /api/location { latitude, longitude, speed, deviceId }
app.post('/api/location', (req, res) => {
  const { latitude, longitude, speed, deviceId } = req.body;
  
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Latitude and longitude required' });
  }
  
  // Update tracker data
  trackerData = {
    deviceId: deviceId || trackerData.deviceId,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    speed: speed !== undefined ? parseFloat(speed) : trackerData.speed,
    signal: 'Strong',
    status: 'live',
    lastUpdate: new Date().toISOString()
  };
  
  // Broadcast to all connected frontend clients
  io.emit('locationUpdate', trackerData);
  
  console.log(`📍 Location update: ${latitude}, ${longitude} | Speed: ${speed || 0} km/h`);
  
  res.json({ success: true, message: 'Location updated' });
});

// Get current location (for initial load or polling fallback)
app.get('/api/location', (req, res) => {
  res.json(trackerData);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connectedClients,
    lastUpdate: trackerData.lastUpdate 
  });
});

// Check for tracker timeout (mark offline if no update for 90 seconds)
// GPRS + TLS handshake can take 30-60s, so 30s was too aggressive
setInterval(() => {
  if (trackerData.lastUpdate) {
    const lastUpdate = new Date(trackerData.lastUpdate);
    const now = new Date();
    const diffSeconds = (now - lastUpdate) / 1000;
    
    if (diffSeconds > 90 && trackerData.status === 'live') {
      trackerData.status = 'offline';
      trackerData.signal = 'Weak';
      io.emit('locationUpdate', trackerData);
      console.log('⚠️ Tracker went offline (no update for 90s)');
    }
  }
}, 10000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Waiting for ESP32 tracker data...`);
});
