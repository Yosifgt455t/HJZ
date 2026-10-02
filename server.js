const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'db', 'reservations.json');

app.use(express.json());
app.use(express.static('public'));

// Load reservations from file
function loadReservations() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading reservations:', e.message);
  }
  return [];
}

// Save reservations to file
function saveReservations(reservations) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(reservations, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving reservations:', e.message);
  }
}

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
