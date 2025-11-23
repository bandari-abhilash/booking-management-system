const moment = require('moment');
const db = require('../config/database');
const logger = require('../utils/logger');

const bookingController = {
    // Get all time slot pricing
    getTimeSlotPricing: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching time slot pricing', { traceId });

            const result = await db.query(
                'SELECT * FROM time_slot_pricing WHERE is_active = true ORDER BY start_time'
            );

            logger.info('Time slot pricing fetched successfully', { 
                traceId, 
                count: result.rows.length 
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching time slot pricing', { 
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

    // Get operating hours
    getOperatingHours: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching operating hours', { traceId });

            const result = await db.query(
                'SELECT * FROM operating_hours WHERE is_active = true ORDER BY day_of_week'
            );

            logger.info('Operating hours fetched successfully', {
                traceId,
                count: result.rows.length
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching operating hours', {
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

    // Get all slots (legacy function for backward compatibility)
    getSlots: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching all slots (legacy)', { traceId });

            // Return time slot pricing as slots for backward compatibility
            const result = await db.query(
                'SELECT * FROM time_slot_pricing WHERE is_active = true ORDER BY start_time'
            );

            // Transform to match old slot structure
            const slots = result.rows.map((pricing, index) => ({
                id: pricing.id,
                slot_name: pricing.slot_name,
                start_time: pricing.start_time,
                end_time: pricing.end_time,
                price: pricing.base_price,
                is_active: pricing.is_active
            }));

            logger.info('Slots fetched successfully', {
                traceId,
                count: slots.length
            });

            res.json(slots);

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

    // Get available slots for a specific date (legacy function)
    getAvailableSlots: async (req, res) => {
        const traceId = req.traceId;
        const { date } = req.params;

        try {
            logger.info('Fetching available slots', { traceId, date });

            // Get all time slot pricing
            const allSlots = await db.query(
                'SELECT * FROM time_slot_pricing WHERE is_active = true ORDER BY start_time'
            );

            // Get booked slots for the date
            const bookedSlots = await db.query(`
                SELECT DISTINCT
                    CASE
                        WHEN tp.start_time <= b.start_time AND tp.end_time > b.start_time THEN tp.start_time
                        WHEN tp.start_time < b.end_time AND tp.end_time >= b.end_time THEN tp.start_time
                        WHEN tp.start_time >= b.start_time AND tp.end_time <= b.end_time THEN tp.start_time
                    END as slot_start_time
                FROM bookings b
                CROSS JOIN time_slot_pricing tp
                WHERE b.booking_date = $1
                AND b.status IN ($2, $3)
                AND (
                    (b.start_time <= tp.start_time AND b.end_time > tp.start_time) OR
                    (b.start_time < tp.end_time AND b.end_time >= tp.end_time) OR
                    (b.start_time >= tp.start_time AND b.end_time <= tp.end_time)
                )
            `, [date, 'pending', 'confirmed']);

            const bookedSlotTimes = bookedSlots.rows.map(row => row.slot_start_time);
            const availableSlots = allSlots.rows.filter(slot => !bookedSlotTimes.includes(slot.start_time));

            // Transform to match old slot structure
            const slots = availableSlots.map(pricing => ({
                id: pricing.id,
                slot_name: pricing.slot_name,
                start_time: pricing.start_time,
                end_time: pricing.end_time,
                price: pricing.base_price,
                is_active: pricing.is_active
            }));

            logger.info('Available slots fetched', {
                traceId,
                date,
                totalSlots: allSlots.rows.length,
                availableSlots: slots.length,
                bookedSlots: bookedSlotTimes.length
            });

            res.json(slots);

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

    // Check for booking collisions
    checkCollisions: async (req, res) => {
        const traceId = req.traceId;
        const { date, start_time, end_time } = req.body;

        try {
            logger.info('Checking for booking collisions', { 
                traceId, 
                date, 
                start_time, 
                end_time 
            });

            // Check for overlapping bookings
            const collisionResult = await db.query(`
                SELECT b.*, u.name as user_name, u.email, u.phone
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                WHERE b.booking_date = $1 
                AND (
                    (b.start_time <= $2 AND b.end_time > $2) OR
                    (b.start_time < $3 AND b.end_time >= $3) OR
                    (b.start_time >= $2 AND b.end_time <= $3)
                )
                AND b.status IN ('pending', 'confirmed')
            `, [date, start_time, end_time]);

            logger.info('Collision check completed', { 
                traceId, 
                date, 
                collisions: collisionResult.rows.length 
            });

            res.json({
                hasCollisions: collisionResult.rows.length > 0,
                collisions: collisionResult.rows
            });

        } catch (error) {
            logger.error('Error checking collisions', { 
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

    // Calculate booking price based on time
    calculatePrice: async (req, res) => {
        const traceId = req.traceId;
        const { start_time, end_time } = req.body;

        try {
            logger.info('Calculating booking price', { 
                traceId, 
                start_time, 
                end_time 
            });

            // Get the pricing rules that cover the requested time range
            const pricingResult = await db.query(`
                SELECT * FROM time_slot_pricing 
                WHERE is_active = true 
                AND (
                    (start_time <= $1 AND end_time > $1) OR
                    (start_time < $2 AND end_time >= $2) OR
                    (start_time >= $1 AND end_time <= $2)
                )
                ORDER BY start_time
            `, [start_time, end_time]);

            let totalPrice = 0;
            const pricingDetails = [];

            // Calculate price for the exact time range
            const bookingStart = moment(start_time, 'HH:mm');
            const bookingEnd = moment(end_time, 'HH:mm');
            const totalDuration = moment.duration(bookingEnd.diff(bookingStart)).asHours();
            
            // Find the exact pricing slot that matches the booking time
            const matchingPricing = pricingResult.rows.find(pricing => {
                const pricingStart = moment(pricing.start_time, 'HH:mm');
                const pricingEnd = moment(pricing.end_time, 'HH:mm');
                
                // Check if booking time is exactly within this pricing slot
                return (bookingStart.isSameOrAfter(pricingStart) && bookingEnd.isSameOrBefore(pricingEnd));
            });
            
            if (matchingPricing) {
                // Calculate price for exact time range
                const segmentPrice = totalDuration * matchingPricing.base_price;
                totalPrice = segmentPrice;
                pricingDetails.push({
                    timeRange: `${bookingStart.format('HH:mm')}-${bookingEnd.format('HH:mm')}`,
                    duration: totalDuration,
                    rate: matchingPricing.base_price,
                    price: segmentPrice
                });
            } else {
                // Fallback: use first available pricing slot
                const fallbackPricing = pricingResult.rows[0];
                if (fallbackPricing) {
                    const segmentPrice = totalDuration * fallbackPricing.base_price;
                    totalPrice = segmentPrice;
                    pricingDetails.push({
                        timeRange: `${bookingStart.format('HH:mm')}-${bookingEnd.format('HH:mm')}`,
                        duration: totalDuration,
                        rate: fallbackPricing.base_price,
                        price: segmentPrice
                    });
                }
            }

            logger.info('Price calculated successfully', { 
                traceId, 
                totalPrice,
                pricingDetails
            });

            res.json({
                totalPrice,
                pricingDetails
            });

        } catch (error) {
            logger.error('Error calculating price', { 
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

    // Create a new booking with collision detection and bidding support
    createBooking: async (req, res) => {
        const traceId = req.traceId;
        const { booking_date, start_time, end_time, is_bid, bid_amount } = req.body;
        const user_id = req.user.id;

        try {
            logger.info('Creating booking', { 
                traceId, 
                userId: user_id, 
                booking_date, 
                start_time, 
                end_time, 
                is_bid,
                bid_amount 
            });

            // Calculate the base price
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

            const base_price = parseFloat(priceResult.rows[0].total_price);
            const total_amount = is_bid && bid_amount ? Math.max(base_price, bid_amount) : base_price;

            // Check for collisions
            const collisionResult = await db.query(`
                SELECT id, user_id, start_time, end_time, total_amount
                FROM bookings
                WHERE booking_date = $1 
                AND (
                    (start_time <= $2 AND end_time > $2) OR
                    (start_time < $3 AND end_time >= $3) OR
                    (start_time >= $2 AND end_time <= $3)
                )
                AND status IN ('pending', 'confirmed')
            `, [booking_date, start_time, end_time]);

            // Create booking
            const bookingResult = await db.query(`
                INSERT INTO bookings (
                    user_id, booking_date, start_time, end_time, 
                    status, total_amount, is_bid, bid_amount, bid_status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
            `, [
                user_id, booking_date, start_time, end_time, 
                collisionResult.rows.length > 0 ? 'pending' : 'confirmed',
                total_amount, is_bid || false, bid_amount, 
                is_bid ? 'pending' : null
            ]);

            const newBooking = bookingResult.rows[0];

            // Handle collisions
            if (collisionResult.rows.length > 0) {
                for (const collision of collisionResult.rows) {
                    // Create collision record
                    await db.query(`
                        INSERT INTO booking_collisions 
                        (original_booking_id, colliding_booking_id, collision_status)
                        VALUES ($1, $2, 'pending')
                    `, [collision.id, newBooking.id]);

                    // Create admin notification
                    await db.query(`
                        INSERT INTO admin_notifications 
                        (booking_id, user_id, notification_type, message)
                        VALUES ($1, $2, $3, $4)
                    `, [
                        newBooking.id,
                        user_id,
                        is_bid ? 'bid_request' : 'collision_detected',
                        is_bid 
                            ? `New bid request for ${booking_date} from ${start_time} to ${end_time}. Bid amount: ₹${bid_amount}`
                            : `Booking collision detected for ${booking_date} from ${start_time} to ${end_time}`
                    ]);
                }
            }

            logger.info('Booking created successfully', { 
                traceId, 
                bookingId: newBooking.id,
                userId: user_id,
                amount: total_amount,
                hasCollisions: collisionResult.rows.length > 0
            });

            res.json({
                ...newBooking,
                hasCollisions: collisionResult.rows.length > 0,
                collisions: collisionResult.rows
            });

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
                SELECT b.*,
                       COALESCE(
                           (SELECT bc.collision_status
                            FROM booking_collisions bc
                            WHERE bc.colliding_booking_id = b.id
                            LIMIT 1),
                           'none'
                       ) as collision_status,
                       (SELECT COUNT(*)
                        FROM booking_collisions bc
                        WHERE bc.colliding_booking_id = b.id) as collision_count
                FROM bookings b
                WHERE b.user_id = $1
                ORDER BY b.booking_date DESC, b.start_time
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
                SELECT b.*, u.name as user_name, u.email, u.phone
                FROM bookings b
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
    },

    // Update time slot pricing (admin only)
    updatePricing: async (req, res) => {
        const traceId = req.traceId;
        const { pricing_id, base_price } = req.body;

        try {
            logger.info('Updating time slot pricing', { 
                traceId, 
                pricing_id, 
                base_price 
            });

            const result = await db.query(`
                UPDATE time_slot_pricing 
                SET base_price = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `, [base_price, pricing_id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Pricing not found',
                    traceId 
                });
            }

            logger.info('Pricing updated successfully', { 
                traceId, 
                pricing_id,
                new_price: base_price
            });

            res.json(result.rows[0]);

        } catch (error) {
            logger.error('Error updating pricing', { 
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