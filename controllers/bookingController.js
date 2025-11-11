const moment = require('moment');
const db = require('../config/database');
const logger = require('../utils/logger');

const bookingController = {
    // Get all available slots
    getSlots: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching all slots', { traceId });

            const result = await db.query(
                'SELECT * FROM turf_slots WHERE is_active = true ORDER BY start_time'
            );

            logger.info('Slots fetched successfully', { 
                traceId, 
                count: result.rows.length 
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching slots', { 
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

    // Get available slots for a specific date
    getAvailableSlots: async (req, res) => {
        const traceId = req.traceId;
        const { date } = req.params;

        try {
            logger.info('Fetching available slots', { traceId, date });

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

            logger.info('Available slots fetched', { 
                traceId, 
                date, 
                totalSlots: allSlots.rows.length,
                availableSlots: availableSlots.length,
                bookedSlots: bookedSlotIds.length
            });

            res.json(availableSlots);

        } catch (error) {
            logger.error('Error fetching available slots', { 
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

    // Create a new booking
    createBooking: async (req, res) => {
        const traceId = req.traceId;
        const { slot_id, booking_date } = req.body;
        const user_id = req.user.id;

        try {
            logger.info('Creating booking', { 
                traceId, 
                userId: user_id, 
                slot_id, 
                booking_date 
            });

            // Check if slot is available
            const existingBooking = await db.query(
                'SELECT id FROM bookings WHERE slot_id = $1 AND booking_date = $2 AND status IN ($3, $4)',
                [slot_id, booking_date, 'pending', 'confirmed']
            );

            if (existingBooking.rows.length > 0) {
                logger.warn('Slot already booked', { 
                    traceId, 
                    slot_id, 
                    booking_date 
                });
                return res.status(400).json({ 
                    error: 'Slot already booked',
                    traceId 
                });
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

            logger.info('Booking created successfully', { 
                traceId, 
                bookingId: result.rows[0].id,
                userId: user_id,
                amount: total_amount
            });

            res.json(result.rows[0]);

        } catch (error) {
            logger.error('Error creating booking', { 
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

    // Get user's bookings
    getMyBookings: async (req, res) => {
        const traceId = req.traceId;
        const user_id = req.user.id;

        try {
            logger.info('Fetching user bookings', { traceId, userId: user_id });

            const result = await db.query(`
                SELECT b.*, ts.slot_name, ts.start_time, ts.end_time, u.name as user_name
                FROM bookings b
                JOIN turf_slots ts ON b.slot_id = ts.id
                JOIN users u ON b.user_id = u.id
                WHERE b.user_id = $1
                ORDER BY b.booking_date DESC, ts.start_time
            `, [user_id]);

            logger.info('User bookings fetched', { 
                traceId, 
                userId: user_id,
                count: result.rows.length 
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching user bookings', { 
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

    // Get booking details
    getBookingById: async (req, res) => {
        const traceId = req.traceId;
        const { id } = req.params;

        try {
            logger.info('Fetching booking details', { traceId, bookingId: id });

            const result = await db.query(`
                SELECT b.*, ts.slot_name, ts.start_time, ts.end_time, u.name as user_name, u.email, u.phone
                FROM bookings b
                JOIN turf_slots ts ON b.slot_id = ts.id
                JOIN users u ON b.user_id = u.id
                WHERE b.id = $1
            `, [id]);

            if (result.rows.length === 0) {
                logger.warn('Booking not found', { traceId, bookingId: id });
                return res.status(404).json({ 
                    error: 'Booking not found',
                    traceId 
                });
            }

            // Check if user owns the booking or is admin
            if (result.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
                logger.warn('Access denied to booking', { 
                    traceId, 
                    bookingId: id,
                    userId: req.user.id,
                    userRole: req.user.role
                });
                return res.status(403).json({ 
                    error: 'Access denied',
                    traceId 
                });
            }

            logger.info('Booking details fetched', { traceId, bookingId: id });

            res.json(result.rows[0]);

        } catch (error) {
            logger.error('Error fetching booking', { 
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

module.exports = bookingController;