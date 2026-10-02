const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_FILE = isVercel
  ? path.join('/tmp', 'reservations.json')
  : path.join(__dirname, 'db', 'reservations.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS and Preflight support
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Restore original path if rewritten by Vercel edge
app.use((req, res, next) => {
  const matched = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.headers['x-vercel-matched-path'];
  if (matched && matched !== req.url) {
    req.url = matched.split('?')[0];
  }
  next();
});

let inMemoryReservations = [];

// Load reservations from file with in-memory fallback
function loadReservations() {
  try {
    const tmpFile = path.join('/tmp', 'reservations.json');
    const localFile = path.join(__dirname, 'db', 'reservations.json');
    const targetFile = fs.existsSync(DATA_FILE)
      ? DATA_FILE
      : (fs.existsSync(tmpFile) ? tmpFile : (fs.existsSync(localFile) ? localFile : null));

    if (targetFile) {
      const data = fs.readFileSync(targetFile, 'utf8');
      inMemoryReservations = JSON.parse(data);
      return inMemoryReservations;
    }
  } catch (e) {
    console.warn('Notice reading reservations file:', e.message);
  }
  return inMemoryReservations;
}

// Save reservations to file with safe fallback
function saveReservations(reservations) {
  inMemoryReservations = reservations;
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(reservations, null, 2), 'utf8');
  } catch (e) {
    // If saving to target file fails (e.g. read-only filesystem on serverless), attempt /tmp
    try {
      const tmpFile = path.join('/tmp', 'reservations.json');
      fs.writeFileSync(tmpFile, JSON.stringify(reservations, null, 2), 'utf8');
    } catch (tmpError) {
      console.warn('Saved in memory (filesystem read-only):', tmpError.message);
    }
  }
}

// Handler functions
function getAllReservations(req, res) {
  const reservations = loadReservations();
  return res.json(reservations);
}

function createReservation(req, res) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { name } = body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'الاسم مطلوب' });
  }

  const reservations = loadReservations();

  // Check duplicate
  if (reservations.find(r => r.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    return res.status(400).json({ error: 'هذا الاسم موجود بالفعل' });
  }

  const reservation = {
    id: Date.now(),
    name: name.trim(),
    createdAt: new Date().toISOString()
  };

  reservations.push(reservation);
  saveReservations(reservations);

  return res.status(201).json(reservation);
}

function deleteReservationById(req, res, idParam) {
  const id = parseInt(idParam !== undefined ? idParam : (req.params.id || req.query.id));
  if (isNaN(id)) {
    return res.status(400).json({ error: 'معرف غير صالح' });
  }
  let reservations = loadReservations();
  reservations = reservations.filter(r => r.id !== id);
  saveReservations(reservations);
  return res.json({ success: true });
}

function clearAllReservations(req, res) {
  saveReservations([]);
  return res.json({ success: true });
}

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Primary API routes
app.get('/api/reservations', getAllReservations);
app.post('/api/reservations', createReservation);
app.delete('/api/reservations/:id', (req, res) => deleteReservationById(req, res, req.params.id));
app.delete('/api/reservations', clearAllReservations);

// Aliases for Vercel rewrites to /api or /api/index.js
app.get(['/api', '/api/index.js', '/api/index', '/reservations'], getAllReservations);
app.post(['/api', '/api/index.js', '/api/index', '/reservations'], createReservation);
app.delete(['/api', '/api/index.js', '/api/index', '/reservations'], (req, res) => {
  if (req.query.id || req.params.id) {
    return deleteReservationById(req, res, req.query.id || req.params.id);
  }
  return clearAllReservations(req, res);
});

// Start server only when running directly (not on Vercel)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏟️  Court Reservations server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
module.exports.loadReservations = loadReservations;
module.exports.saveReservations = saveReservations;
module.exports.getAllReservations = getAllReservations;
module.exports.createReservation = createReservation;
module.exports.deleteReservationById = deleteReservationById;
module.exports.clearAllReservations = clearAllReservations;
