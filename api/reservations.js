const {
  getAllReservations,
  createReservation,
  clearAllReservations,
  deleteReservationById
} = require('../server.js');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse body if string
  if (typeof req.body === 'string' && req.body) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      // ignore
    }
  }

  if (req.method === 'GET') {
    return getAllReservations(req, res);
  }

  if (req.method === 'POST') {
    return createReservation(req, res);
  }

  if (req.method === 'DELETE') {
    if (req.query && req.query.id) {
      return deleteReservationById(req, res, req.query.id);
    }
    return clearAllReservations(req, res);
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
