const moment = require('moment');
const QRCode = require('qrcode');
const db = require('../config/database');
const logger = require('../utils/logger');

const adminController = {
    // Get all bookings
    getAllBookings: async (req, res) => {
        const traceId = req.traceId;
        const { date } = req.query;

        try {
            logger.info('Fetching all bookings', { traceId, date });

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

            logger.info('All bookings fetched', { 
                traceId, 
                count: result.rows.length,
                dateFilter: date || 'none'
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching bookings', { 
                traceId, 
                error: error.message, 
                stack: error.stack 
            });
            res.status(500).json({ 
                error: 'Server error',
                traceId 
            });
        }
    },

    // Get today's and tomorrow's bookings
    getUpcomingBookings: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching upcoming bookings', { traceId });

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

            logger.info('Upcoming bookings fetched', { 
                traceId, 
                today,
                tomorrow,
                count: result.rows.length
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching upcoming bookings', { 
                traceId, 
                error: error.message, 
                stack: error.stack 
            });
            res.status(500).json({ 
                error: 'Server error',
                traceId 
            });
        }
    },

    // Update booking status
    updateBookingStatus: async (req, res) => {
        const traceId = req.traceId;
        const { id } = req.params;
        const { status } = req.body;

        try {
            logger.info('Updating booking status', { 
                traceId, 
                bookingId: id, 
                newStatus: status 
            });

            if (!['pending', 'confirmed', 'cancelled', 'rejected'].includes(status)) {
                logger.warn('Invalid status provided', { 
                    traceId, 
                    bookingId: id, 
                    status 
                });
                return res.status(400).json({ 
                    error: 'Invalid status',
                    traceId 
                });
            }
            
            const result = await db.query(
                'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                [status, id]
            );

            if (result.rows.length === 0) {
                logger.warn('Booking not found for status update', { 
                    traceId, 
                    bookingId: id 
                });
                return res.status(404).json({ 
                    error: 'Booking not found',
                    traceId 
                });
            }

            logger.info('Booking status updated successfully', { 
                traceId, 
                bookingId: id, 
                newStatus: status 
            });

            res.json(result.rows[0]);

        } catch (error) {
            logger.error('Error updating booking status', { 
                traceId, 
                error: error.message, 
                stack: error.stack 
            });
            res.status(500).json({ 
                error: 'Server error',
                traceId 
            });
        }
    },

    // Update booking details
    updateBooking: async (req, res) => {
        const traceId = req.traceId;
        const { id } = req.params;
        const { slot_id, booking_date } = req.body;

        try {
            logger.info('Updating booking', { 
                traceId, 
                bookingId: id, 
                newSlotId: slot_id, 
                newDate: booking_date 
            });

            // Check if new slot is available
            const existingBooking = await db.query(
                'SELECT id FROM bookings WHERE slot_id = $1 AND booking_date = $2 AND id != $3 AND status IN ($4, $5)',
                [slot_id, booking_date, id, 'pending', 'confirmed']
            );

            if (existingBooking.rows.length > 0) {
                logger.warn('Slot already booked for update', { 
                    traceId, 
                    slot_id, 
                    booking_date 
                });
                return res.status(400).json({ 
                    error: 'Slot already booked',
                    traceId 
                });
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
                logger.warn('Booking not found for update', { 
                    traceId, 
                    bookingId: id 
                });
                return res.status(404).json({ 
                    error: 'Booking not found',
                    traceId 
                });
            }

            logger.info('Booking updated successfully', { 
                traceId, 
                bookingId: id,
                newAmount: total_amount
            });

            res.json(result.rows[0]);

        } catch (error) {
            logger.error('Error updating booking', { 
                traceId, 
                error: error.message, 
                stack: error.stack 
            });
            res.status(500).json({ 
                error: 'Server error',
                traceId 
            });
        }
    },

    // Delete booking
    deleteBooking: async (req, res) => {
        const traceId = req.traceId;
        const { id } = req.params;

        try {
            logger.info('Deleting booking', { traceId, bookingId: id });

            const result = await db.query(
                'DELETE FROM bookings WHERE id = $1 RETURNING *',
                [id]
            );

            if (result.rows.length === 0) {
                logger.warn('Booking not found for deletion', { 
                    traceId, 
                    bookingId: id 
                });
                return res.status(404).json({ 
                    error: 'Booking not found',
                    traceId 
                });
            }

            logger.info('Booking deleted successfully', { 
                traceId, 
                bookingId: id 
            });

            res.json({ 
                message: 'Booking deleted successfully',
                traceId 
            });

        } catch (error) {
            logger.error('Error deleting booking', { 
                traceId, 
                error: error.message, 
                stack: error.stack 
            });
            res.status(500).json({ 
                error: 'Server error',
                traceId 
            });
        }
    },

    // Generate QR code for payment
    generatePaymentQR: async (req, res) => {
        const traceId = req.traceId;
        const { bookingId } = req.params;

        try {
            logger.info('Generating payment QR code', { traceId, bookingId });

            // Get booking details
            const bookingResult = await db.query(`
                SELECT b.*, u.name, u.phone
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                WHERE b.id = $1
            `, [bookingId]);

            if (bookingResult.rows.length === 0) {
                logger.warn('Booking not found for QR generation', { 
                    traceId, 
                    bookingId 
                });
                return res.status(404).json({ 
                    error: 'Booking not found',
                    traceId 
                });
            }

            const booking = bookingResult.rows[0];

            // Create payment text for QR code
            const paymentText = `Cricket Turf Booking - ID: ${booking.id}, Amount: ₹${booking.total_amount}, Name: ${booking.name}, Phone: ${booking.phone}`;

            // Generate QR code
            const qrCodeDataUrl = await QRCode.toDataURL(paymentText);

            logger.info('Payment QR code generated successfully', { 
                traceId, 
                bookingId,
                amount: booking.total_amount
            });

            res.json({ 
                qrCode: qrCodeDataUrl, 
                paymentText,
                traceId 
            });

        } catch (error) {
            logger.error('Error generating QR code', { 
                traceId, 
                error: error.message, 
                stack: error.stack 
            });
            res.status(500).json({ 
                error: 'Server error',
                traceId 
            });
        }
    },

    // Get all users
    getAllUsers: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching all users', { traceId });

            const result = await db.query(
                'SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC'
            );

            logger.info('All users fetched', { 
                traceId, 
                count: result.rows.length 
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching users', { 
                traceId, 
                error: error.message, 
                stack: error.stack 
            });
            res.status(500).json({ 
                error: 'Server error',
                traceId 
            });
        }
    },

    // Get dashboard statistics
    getDashboardStats: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching dashboard statistics', { traceId });

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

            const stats = {
                todayBookings: todayBookings.rows[0].count,
                pendingBookings: pendingBookings.rows[0].count,
                totalRevenue: totalRevenue.rows[0].revenue || 0,
                todayRevenue: todayRevenue.rows[0].revenue || 0
            };

            logger.info('Dashboard statistics fetched', { traceId, stats });

            res.json(stats);

        } catch (error) {
            logger.error('Error fetching dashboard stats', { 
                traceId, 
                error: error.message, 
                stack: error.stack 
            });
            res.status(500).json({ 
                error: 'Server error',
                traceId 
            });
        }
    }
};

module.exports = adminController;