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
router.get('/bookings/pricing', bookingController.getTimeSlotPricing);
router.get('/bookings/operating-hours', bookingController.getOperatingHours);
router.post('/bookings/check-collisions', authenticateToken, bookingController.checkCollisions);
router.post('/bookings/calculate-price', bookingController.calculatePrice);
router.post('/bookings', authenticateToken, bookingController.createBooking);
router.get('/bookings/my-bookings', authenticateToken, bookingController.getMyBookings);
router.get('/bookings/:id', authenticateToken, bookingController.getBookingById);

// Admin routes
router.get('/admin/dashboard', authenticateToken, authenticateAdmin, adminController.getDashboardStats);
router.get('/admin/bookings', authenticateToken, authenticateAdmin, adminController.getAllBookings);
router.get('/admin/bookings/legacy', authenticateToken, authenticateAdmin, adminController.getLegacyBookings);
router.get('/admin/bookings/upcoming', authenticateToken, authenticateAdmin, adminController.getUpcomingBookings);
router.put('/admin/bookings/:id/status', authenticateToken, authenticateAdmin, adminController.updateBookingStatus);
router.put('/admin/bookings/:id', authenticateToken, authenticateAdmin, adminController.updateBooking);
router.delete('/admin/bookings/:id', authenticateToken, authenticateAdmin, adminController.deleteBooking);
router.get('/admin/payment/qrcode/:bookingId', authenticateToken, adminController.generatePaymentQR);
router.post('/admin/payment-confirmation', authenticateToken, authenticateAdmin, adminController.handlePaymentConfirmation);
router.get('/admin/users', authenticateToken, authenticateAdmin, adminController.getAllUsers);

// Notification management
router.get('/admin/notifications', authenticateToken, authenticateAdmin, adminController.getNotifications);
router.put('/admin/notifications/:notification_id/read', authenticateToken, authenticateAdmin, adminController.markNotificationRead);

// Bid and collision management
router.post('/admin/bookings/handle-bid', authenticateToken, authenticateAdmin, adminController.handleBid);
router.post('/admin/bookings/resolve-collision', authenticateToken, authenticateAdmin, adminController.resolveCollision);

// Pricing management
router.get('/admin/pricing', authenticateToken, authenticateAdmin, adminController.getAllPricing);
router.put('/admin/pricing', authenticateToken, authenticateAdmin, adminController.updatePricing);

// Operating hours management
router.get('/admin/operating-hours', authenticateToken, authenticateAdmin, adminController.getOperatingHours);
router.put('/admin/operating-hours', authenticateToken, authenticateAdmin, adminController.updateOperatingHours);

module.exports = router;