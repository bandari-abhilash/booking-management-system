const express = require('express');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Auth routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Booking routes
router.get('/bookings/slots', bookingController.getSlots);
router.get('/bookings/available/:date', bookingController.getAvailableSlots);
router.post('/bookings', authenticateToken, bookingController.createBooking);
router.get('/bookings/my-bookings', authenticateToken, bookingController.getMyBookings);
router.get('/bookings/:id', authenticateToken, bookingController.getBookingById);

// Admin routes
router.get('/admin/dashboard', authenticateToken, authenticateAdmin, adminController.getDashboardStats);
router.get('/admin/bookings', authenticateToken, authenticateAdmin, adminController.getAllBookings);
router.get('/admin/bookings/upcoming', authenticateToken, authenticateAdmin, adminController.getUpcomingBookings);
router.put('/admin/bookings/:id/status', authenticateToken, authenticateAdmin, adminController.updateBookingStatus);
router.put('/admin/bookings/:id', authenticateToken, authenticateAdmin, adminController.updateBooking);
router.delete('/admin/bookings/:id', authenticateToken, authenticateAdmin, adminController.deleteBooking);
router.get('/admin/payment/qrcode/:bookingId', authenticateToken, adminController.generatePaymentQR);
router.get('/admin/users', authenticateToken, authenticateAdmin, adminController.getAllUsers);

module.exports = router;