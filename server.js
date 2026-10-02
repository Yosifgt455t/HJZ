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

let inMemoryReservations = [];

// Load reservations from file with in-memory fallback
function loadReservations() {
  try {
    const targetFile = fs.existsSync(DATA_FILE)
      ? DATA_FILE
      : (fs.existsSync(path.join('/tmp', 'reservations.json')) ? path.join('/tmp', 'reservations.json') : null);

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

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Get all reservations
app.get('/api/reservations', (req, res) => {
  const reservations = loadReservations();
  res.json(reservations);
});

// API: Add a reservation
app.post('/api/reservations', (req, res) => {
  const { name } = req.body;

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

  res.status(201).json(reservation);
});

// API: Delete a reservation
app.delete('/api/reservations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  let reservations = loadReservations();
  reservations = reservations.filter(r => r.id !== id);
  saveReservations(reservations);
  res.json({ success: true });
});

// API: Clear all reservations
app.delete('/api/reservations', (req, res) => {
  saveReservations([]);
  res.json({ success: true });
});

// Start server only when running directly (not on Vercel)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏟️  Court Reservations server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
