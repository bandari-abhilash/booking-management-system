const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const bookingController = require('../controllers/bookingController');
const router = express.Router();

// Get time slot pricing
router.get('/pricing', bookingController.getTimeSlotPricing);

// Get operating hours
router.get('/operating-hours', bookingController.getOperatingHours);

// Check for booking collisions
router.post('/check-collisions', authenticateToken, bookingController.checkCollisions);

// Calculate booking price
router.post('/calculate-price', bookingController.calculatePrice);

// Create a new booking
router.post('/', authenticateToken, bookingController.createBooking);

// Get user's bookings
router.get('/my-bookings', authenticateToken, bookingController.getMyBookings);

// Get booking details
router.get('/:id', authenticateToken, bookingController.getBookingById);

module.exports = router;