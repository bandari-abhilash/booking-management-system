const express = require('express');
const moment = require('moment');
const QRCode = require('qrcode');
const db = require('../config/database');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateToken, authenticateAdmin);

// Get all bookings
router.get('/bookings', async (req, res) => {
  try {
    const { date } = req.query;
    let query = `
      SELECT b.*, ts.slot_name, ts.start_time, ts.end_time, u.name as user_name, u.email, u.phone
      FROM bookings b
      JOIN turf_slots ts ON b.slot_id = ts.id
      JOIN users u ON b.user_id = u.id
    `;
    
    let params = [];
    if (date) {
      query += ' WHERE b.booking_date = $1 ORDER BY ts.start_time';
      params.push(date);
    } else {
      query += ' ORDER BY b.booking_date DESC, ts.start_time';
    }
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get today's and tomorrow's bookings
router.get('/bookings/upcoming', async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    
    const result = await db.query(`
      SELECT b.*, ts.slot_name, ts.start_time, ts.end_time, u.name as user_name, u.email, u.phone
      FROM bookings b
      JOIN turf_slots ts ON b.slot_id = ts.id
      JOIN users u ON b.user_id = u.id
      WHERE b.booking_date IN ($1, $2)
      ORDER BY b.booking_date, ts.start_time
    `, [today, tomorrow]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching upcoming bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update booking status
router.put('/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'cancelled', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = await db.query(
      'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update booking details
router.put('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { slot_id, booking_date } = req.body;
    
    // Check if new slot is available
    const existingBooking = await db.query(
      'SELECT id FROM bookings WHERE slot_id = $1 AND booking_date = $2 AND id != $3 AND status IN ($4, $5)',
      [slot_id, booking_date, id, 'pending', 'confirmed']
    );
    
    if (existingBooking.rows.length > 0) {
      return res.status(400).json({ error: 'Slot already booked' });
    }
    
    // Get new slot price
    const slotResult = await db.query(
      'SELECT price FROM turf_slots WHERE id = $1',
      [slot_id]
    );
    
    const total_amount = slotResult.rows[0].price;
    
    const result = await db.query(
      'UPDATE bookings SET slot_id = $1, booking_date = $2, total_amount = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [slot_id, booking_date, total_amount, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete booking
router.delete('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM bookings WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate QR code for payment
router.get('/payment/qrcode/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    // Get booking details
    const bookingResult = await db.query(`
      SELECT b.*, u.name, u.phone
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.id = $1
    `, [bookingId]);
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const booking = bookingResult.rows[0];
    
    // Create payment text for QR code
    const paymentText = `Cricket Turf Booking - ID: ${booking.id}, Amount: ₹${booking.total_amount}, Name: ${booking.name}, Phone: ${booking.phone}`;
    
    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(paymentText);
    
    res.json({ qrCode: qrCodeDataUrl, paymentText });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    
    // Today's bookings
    const todayBookings = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE booking_date = $1',
      [today]
    );
    
    // Pending bookings
    const pendingBookings = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE status = $1',
      ['pending']
    );
    
    // Total revenue
    const totalRevenue = await db.query(
      'SELECT SUM(total_amount) as revenue FROM bookings WHERE status = $1',
      ['confirmed']
    );
    
    // Today's revenue
    const todayRevenue = await db.query(
      'SELECT SUM(total_amount) as revenue FROM bookings WHERE booking_date = $1 AND status = $2',
      [today, 'confirmed']
    );
    
    res.json({
      todayBookings: todayBookings.rows[0].count,
      pendingBookings: pendingBookings.rows[0].count,
      totalRevenue: totalRevenue.rows[0].revenue || 0,
      todayRevenue: todayRevenue.rows[0].revenue || 0
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;