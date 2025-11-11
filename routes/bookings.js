const express = require('express');
const moment = require('moment');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all available slots
router.get('/slots', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM turf_slots WHERE is_active = true ORDER BY start_time'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available slots for a specific date
router.get('/available/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Get all slots
    const allSlots = await db.query(
      'SELECT * FROM turf_slots WHERE is_active = true ORDER BY start_time'
    );
    
    // Get booked slots for the date
    const bookedSlots = await db.query(
      'SELECT slot_id FROM bookings WHERE booking_date = $1 AND status IN ($2, $3)',
      [date, 'pending', 'confirmed']
    );
    
    const bookedSlotIds = bookedSlots.rows.map(row => row.slot_id);
    const availableSlots = allSlots.rows.filter(slot => !bookedSlotIds.includes(slot.id));
    
    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new booking
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { slot_id, booking_date } = req.body;
    const user_id = req.user.id;
    
    // Check if slot is available
    const existingBooking = await db.query(
      'SELECT id FROM bookings WHERE slot_id = $1 AND booking_date = $2 AND status IN ($3, $4)',
      [slot_id, booking_date, 'pending', 'confirmed']
    );
    
    if (existingBooking.rows.length > 0) {
      return res.status(400).json({ error: 'Slot already booked' });
    }
    
    // Get slot price
    const slotResult = await db.query(
      'SELECT price FROM turf_slots WHERE id = $1',
      [slot_id]
    );
    
    const total_amount = slotResult.rows[0].price;
    
    // Create booking
    const result = await db.query(
      'INSERT INTO bookings (user_id, slot_id, booking_date, total_amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, slot_id, booking_date, total_amount]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    
    const result = await db.query(`
      SELECT b.*, ts.slot_name, ts.start_time, ts.end_time, u.name as user_name
      FROM bookings b
      JOIN turf_slots ts ON b.slot_id = ts.id
      JOIN users u ON b.user_id = u.id
      WHERE b.user_id = $1
      ORDER BY b.booking_date DESC, ts.start_time
    `, [user_id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get booking details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT b.*, ts.slot_name, ts.start_time, ts.end_time, u.name as user_name, u.email, u.phone
      FROM bookings b
      JOIN turf_slots ts ON b.slot_id = ts.id
      JOIN users u ON b.user_id = u.id
      WHERE b.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check if user owns the booking or is admin
    if (result.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;