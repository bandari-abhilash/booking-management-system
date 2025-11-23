const express = require('express');
const moment = require('moment');
const QRCode = require('qrcode');
const db = require('../config/database');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateToken, authenticateAdmin);

// Notification management
router.get('/notifications', adminController.getNotifications);
router.put('/notifications/:notification_id/read', adminController.markNotificationRead);

// Payment notification management
router.get('/payment-notifications', adminController.getPaymentNotifications);
router.put('/payment-notifications/:id/read', adminController.markPaymentNotificationRead);
router.post('/payment-confirmation', adminController.handlePaymentConfirmation);

// Booking management with collision and bid support
router.get('/bookings', adminController.getAllBookings);
router.post('/bookings/handle-bid', adminController.handleBid);
router.post('/bookings/resolve-collision', adminController.resolveCollision);

// Pricing management
router.get('/pricing', adminController.getAllPricing);
router.put('/pricing', adminController.updatePricing);

// Legacy routes for backward compatibility
router.get('/bookings/legacy', async (req, res) => {
  try {
    const { date } = req.query;
    let query = `
      SELECT b.*, u.name as user_name, u.email, u.phone
      FROM bookings b
      JOIN users u ON b.user_id = u.id
    `;
    
    let params = [];
    if (date) {
      query += ' WHERE b.booking_date = $1 ORDER BY b.start_time';
      params.push(date);
    } else {
      query += ' ORDER BY b.booking_date DESC, b.start_time';
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
      SELECT b.*, u.name as user_name, u.email, u.phone
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.booking_date IN ($1, $2)
      ORDER BY b.booking_date, b.start_time
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
    const { booking_date, start_time, end_time } = req.body;
    
    // Check for collisions with existing bookings
    const existingBooking = await db.query(`
      SELECT id FROM bookings 
      WHERE booking_date = $1 
      AND (
        (start_time <= $2 AND end_time > $2) OR
        (start_time < $3 AND end_time >= $3) OR
        (start_time >= $2 AND end_time <= $3)
      )
      AND id != $4 
      AND status IN ($5, $6)
    `, [booking_date, start_time, end_time, id, 'pending', 'confirmed']);
    
    if (existingBooking.rows.length > 0) {
      return res.status(400).json({ error: 'Time slot already booked' });
    }
    
    // Calculate new price
    const priceResult = await db.query(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN tp.start_time <= $1 AND tp.end_time > $1 THEN 
            LEAST(EXTRACT(EPOCH FROM (LEAST(tp.end_time, $3) - GREATEST(tp.start_time, $1))) / 3600, 
                 EXTRACT(EPOCH FROM (tp.end_time - tp.start_time)) / 3600) * tp.base_price
          WHEN tp.start_time < $2 AND tp.end_time >= $2 THEN 
            LEAST(EXTRACT(EPOCH FROM (LEAST(tp.end_time, $3) - GREATEST(tp.start_time, $1))) / 3600, 
                 EXTRACT(EPOCH FROM (tp.end_time - tp.start_time)) / 3600) * tp.base_price
          ELSE 0
        END
      ), 0) as total_price
      FROM time_slot_pricing tp
      WHERE tp.is_active = true
      AND (
        (tp.start_time <= $1 AND tp.end_time > $1) OR
        (tp.start_time < $2 AND tp.end_time >= $2) OR
        (tp.start_time >= $1 AND tp.end_time <= $2)
      )
    `, [start_time, end_time, end_time]);
    
    const total_amount = parseFloat(priceResult.rows[0].total_price);
    
    const result = await db.query(
      'UPDATE bookings SET booking_date = $1, start_time = $2, end_time = $3, total_amount = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [booking_date, start_time, end_time, total_amount, id]
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
    
    // Pending bids
    const pendingBids = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE is_bid = true AND bid_status = $1',
      ['pending']
    );
    
    // Unresolved collisions
    const unresolvedCollisions = await db.query(
      'SELECT COUNT(*) as count FROM booking_collisions WHERE collision_status = $1',
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
    
    // Unread notifications
    const unreadNotifications = await db.query(
      'SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = false',
      []
    );
    
    // Unread payment notifications
    const unreadPaymentNotifications = await db.query(
      'SELECT COUNT(*) as count FROM payment_notifications WHERE is_read = false',
      []
    );
    
    res.json({
      todayBookings: todayBookings.rows[0].count,
      pendingBookings: pendingBookings.rows[0].count,
      pendingBids: pendingBids.rows[0].count,
      unresolvedCollisions: unresolvedCollisions.rows[0].count,
      totalRevenue: totalRevenue.rows[0].revenue || 0,
      todayRevenue: todayRevenue.rows[0].revenue || 0,
      unreadNotifications: unreadNotifications.rows[0].count,
      unreadPaymentNotifications: unreadPaymentNotifications.rows[0].count
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Operating hours management
router.get('/operating-hours', adminController.getOperatingHours);
router.put('/operating-hours', adminController.updateOperatingHours);

module.exports = router;