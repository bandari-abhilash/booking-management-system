const db = require('../config/database');
const logger = require('../utils/logger');

const adminController = {
    // Get all admin notifications
    getNotifications: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching admin notifications', { traceId });

            const result = await db.query(`
                SELECT an.*, b.booking_date, b.start_time, b.end_time, b.total_amount, b.is_bid, b.bid_amount,
                       u.name as user_name, u.email, u.phone
                FROM admin_notifications an
                LEFT JOIN bookings b ON an.booking_id = b.id
                LEFT JOIN users u ON an.user_id = u.id
                WHERE an.is_read = false
                ORDER BY an.created_at DESC
            `);

            logger.info('Admin notifications fetched', { 
                traceId, 
                count: result.rows.length 
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching admin notifications', { 
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

    // Mark notification as read
    markNotificationRead: async (req, res) => {
        const traceId = req.traceId;
        const { notification_id } = req.params;

        try {
            logger.info('Marking notification as read', { traceId, notification_id });

            const result = await db.query(`
                UPDATE admin_notifications 
                SET is_read = true 
                WHERE id = $1
                RETURNING *
            `, [notification_id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Notification not found',
                    traceId 
                });
            }

            logger.info('Notification marked as read', { 
                traceId, 
                notification_id 
            });

            res.json(result.rows[0]);

        } catch (error) {
            logger.error('Error marking notification as read', { 
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

    // Get all bookings with collision details
    getAllBookings: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching all bookings for admin', { traceId });

            const result = await db.query(`
                SELECT b.*, u.name as user_name, u.email, u.phone,
                       COUNT(bc.id) as collision_count,
                       COALESCE(
                           JSON_AGG(
                               JSON_BUILD_OBJECT(
                                   'collision_id', bc.id,
                                   'original_booking_id', bc.original_booking_id,
                                   'collision_status', bc.collision_status
                               )
                           ) FILTER (WHERE bc.id IS NOT NULL), 
                           '[]'
                       ) as collisions
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                LEFT JOIN booking_collisions bc ON b.id = bc.colliding_booking_id
                GROUP BY b.id, u.name, u.email, u.phone
                ORDER BY b.booking_date DESC, b.start_time
            `);

            logger.info('All bookings fetched', { 
                traceId, 
                count: result.rows.length 
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching all bookings', { 
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

    // Handle bid approval/rejection
    handleBid: async (req, res) => {
        const traceId = req.traceId;
        const { booking_id, action } = req.body; // action: 'approve' or 'reject'
        const admin_id = req.user.id;

        try {
            logger.info('Handling bid', { 
                traceId, 
                booking_id, 
                action, 
                admin_id 
            });

            // Get booking details
            const bookingResult = await db.query(`
                SELECT * FROM bookings WHERE id = $1 AND is_bid = true
            `, [booking_id]);

            if (bookingResult.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'Bid not found',
                    traceId 
                });
            }

            const booking = bookingResult.rows[0];
            const newStatus = action === 'approve' ? 'accepted' : 'rejected';
            const bookingStatus = action === 'approve' ? 'confirmed' : 'rejected';

            // Update bid status
            await db.query(`
                UPDATE bookings 
                SET bid_status = $1, status = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [newStatus, bookingStatus, booking_id]);

            // Resolve collisions if approved
            if (action === 'approve') {
                // Get all collisions for this booking
                const collisionResult = await db.query(`
                    SELECT * FROM booking_collisions WHERE colliding_booking_id = $1
                `, [booking_id]);

                for (const collision of collisionResult.rows) {
                    // Reject the original booking
                    await db.query(`
                        UPDATE bookings 
                        SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                    `, [collision.original_booking_id]);

                    // Update collision record
                    await db.query(`
                        UPDATE booking_collisions 
                        SET collision_status = 'resolved', resolved_by = $1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2
                    `, [admin_id, collision.id]);
                }
            }

            // Create notification for user
            const notificationMessage = action === 'approve' 
                ? `Your bid for ${booking.booking_date} from ${booking.start_time} to ${booking.end_time} has been approved!`
                : `Your bid for ${booking.booking_date} from ${booking.start_time} to ${booking.end_time} has been rejected.`;

            await db.query(`
                INSERT INTO admin_notifications 
                (booking_id, user_id, notification_type, message, is_read)
                VALUES ($1, $2, $3, $4, true)
            `, [
                booking_id,
                booking.user_id,
                `bid_${action}`,
                notificationMessage
            ]);

            logger.info('Bid handled successfully', { 
                traceId, 
                booking_id, 
                action 
            });

            res.json({
                success: true,
                message: `Bid ${action}d successfully`,
                booking_id,
                action
            });

        } catch (error) {
            logger.error('Error handling bid', { 
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

    // Handle collision resolution
    resolveCollision: async (req, res) => {
        const traceId = req.traceId;
        const { collision_id, preferred_booking_id, rejected_booking_id } = req.body;
        const admin_id = req.user.id;

        try {
            logger.info('Resolving collision', { 
                traceId, 
                collision_id, 
                preferred_booking_id, 
                rejected_booking_id,
                admin_id 
            });

            // Update collision record
            await db.query(`
                UPDATE booking_collisions 
                SET collision_status = 'resolved', resolved_by = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [admin_id, collision_id]);

            // Confirm preferred booking
            await db.query(`
                UPDATE bookings 
                SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [preferred_booking_id]);

            // Reject other booking
            await db.query(`
                UPDATE bookings 
                SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [rejected_booking_id]);

            // Get booking details for notifications
            const preferredResult = await db.query(`
                SELECT b.*, u.name as user_name, u.email
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                WHERE b.id = $1
            `, [preferred_booking_id]);

            const rejectedResult = await db.query(`
                SELECT b.*, u.name as user_name, u.email
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                WHERE b.id = $1
            `, [rejected_booking_id]);

            // Create notifications
            if (preferredResult.rows.length > 0) {
                const booking = preferredResult.rows[0];
                await db.query(`
                    INSERT INTO admin_notifications 
                    (booking_id, user_id, notification_type, message, is_read)
                    VALUES ($1, $2, $3, $4, true)
                `, [
                    preferred_booking_id,
                    booking.user_id,
                    'collision_resolved_approved',
                    `Your booking for ${booking.booking_date} from ${booking.start_time} to ${booking.end_time} has been confirmed!`
                ]);
            }

            if (rejectedResult.rows.length > 0) {
                const booking = rejectedResult.rows[0];
                await db.query(`
                    INSERT INTO admin_notifications 
                    (booking_id, user_id, notification_type, message, is_read)
                    VALUES ($1, $2, $3, $4, true)
                `, [
                    rejected_booking_id,
                    booking.user_id,
                    'collision_resolved_rejected',
                    `Your booking for ${booking.booking_date} from ${booking.start_time} to ${booking.end_time} has been rejected due to a time conflict.`
                ]);
            }

            logger.info('Collision resolved successfully', { 
                traceId, 
                collision_id 
            });

            res.json({
                success: true,
                message: 'Collision resolved successfully',
                collision_id
            });

        } catch (error) {
            logger.error('Error resolving collision', { 
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

    // Update time slot pricing
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
    },

    // Get all time slot pricing
    getAllPricing: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching all time slot pricing', { traceId });

            const result = await db.query(`
                SELECT * FROM time_slot_pricing 
                ORDER BY start_time
            `);

            logger.info('Time slot pricing fetched', { 
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

    // Get dashboard statistics
    getDashboardStats: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching dashboard statistics', { traceId });

            const today = new Date().toISOString().split('T')[0];
            
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
            
            const stats = {
                todayBookings: todayBookings.rows[0].count,
                pendingBookings: pendingBookings.rows[0].count,
                pendingBids: pendingBids.rows[0].count,
                unresolvedCollisions: unresolvedCollisions.rows[0].count,
                totalRevenue: totalRevenue.rows[0].revenue || 0,
                todayRevenue: todayRevenue.rows[0].revenue || 0,
                unreadNotifications: unreadNotifications.rows[0].count
            };

            logger.info('Dashboard statistics fetched', { traceId, stats });

            res.json(stats);

        } catch (error) {
            logger.error('Error fetching dashboard statistics', {
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

    // Get upcoming bookings (today and tomorrow)
    getUpcomingBookings: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching upcoming bookings', { traceId });

            const today = new Date().toISOString().split('T')[0];
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            const result = await db.query(`
                SELECT b.*, u.name as user_name, u.email, u.phone
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                WHERE b.booking_date IN ($1, $2)
                ORDER BY b.booking_date, b.start_time
            `, [today, tomorrow]);
            
            logger.info('Upcoming bookings fetched', {
                traceId,
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
        const admin_id = req.user.id;

        try {
            logger.info('Updating booking status', {
                traceId,
                bookingId: id,
                status,
                admin_id
            });
            
            if (!['pending', 'confirmed', 'cancelled', 'rejected'].includes(status)) {
                return res.status(400).json({
                    error: 'Invalid status',
                    traceId
                });
            }
            
            const result = await db.query(`
                UPDATE bookings
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `, [status, id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Booking not found',
                    traceId
                });
            }
            
            logger.info('Booking status updated', {
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
        const { booking_date, start_time, end_time } = req.body;
        const admin_id = req.user.id;

        try {
            logger.info('Updating booking', {
                traceId,
                bookingId: id,
                booking_date,
                start_time,
                end_time,
                admin_id
            });
            
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
                return res.status(400).json({
                    error: 'Time slot already booked',
                    traceId
                });
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
            
            const result = await db.query(`
                UPDATE bookings
                SET booking_date = $1, start_time = $2, end_time = $3, total_amount = $4, updated_at = CURRENT_TIMESTAMP
                WHERE id = $5
                RETURNING *
            `, [booking_date, start_time, end_time, total_amount, id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Booking not found',
                    traceId
                });
            }
            
            logger.info('Booking updated', {
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
        const admin_id = req.user.id;

        try {
            logger.info('Deleting booking', {
                traceId,
                bookingId: id,
                admin_id
            });
            
            const result = await db.query(`
                DELETE FROM bookings
                WHERE id = $1
                RETURNING *
            `, [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Booking not found',
                    traceId
                });
            }
            
            logger.info('Booking deleted', {
                traceId,
                bookingId: id
            });

            res.json({
                message: 'Booking deleted successfully',
                booking: result.rows[0]
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

    // Generate payment QR code
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
                return res.status(404).json({
                    error: 'Booking not found',
                    traceId
                });
            }
            
            const booking = bookingResult.rows[0];
            
            // Create payment text for QR code
            const paymentText = `Cricket Turf Booking - ID: ${booking.id}, Amount: ₹${booking.total_amount}, Name: ${booking.name}, Phone: ${booking.phone}`;
            
            // Generate QR code
            const QRCode = require('qrcode');
            const qrCodeDataUrl = await QRCode.toDataURL(paymentText);
            
            logger.info('QR code generated', { traceId, bookingId });
            
            res.json({
                qrCode: qrCodeDataUrl,
                paymentText
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
            
            const result = await db.query(`
                SELECT id, name, email, phone, role, created_at
                FROM users
                ORDER BY created_at DESC
            `);
            
            logger.info('Users fetched', {
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

    // Get operating hours
    getOperatingHours: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching operating hours', { traceId });

            const result = await db.query(`
                SELECT * FROM operating_hours
                ORDER BY day_of_week
            `);

            logger.info('Operating hours fetched', {
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

    // Update operating hours
    updateOperatingHours: async (req, res) => {
        const traceId = req.traceId;
        const { operating_hours } = req.body; // Array of { day_of_week, opening_time, closing_time, is_active }

        try {
            logger.info('Updating operating hours', {
                traceId,
                operating_hours
            });

            // Update each day's operating hours
            for (const hours of operating_hours) {
                await db.query(`
                    INSERT INTO operating_hours (day_of_week, opening_time, closing_time, is_active, updated_at)
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                    ON CONFLICT (day_of_week)
                    DO UPDATE SET
                        opening_time = EXCLUDED.opening_time,
                        closing_time = EXCLUDED.closing_time,
                        is_active = EXCLUDED.is_active,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    hours.day_of_week,
                    hours.opening_time,
                    hours.closing_time,
                    hours.is_active
                ]);
            }

            logger.info('Operating hours updated successfully', { traceId });

            res.json({
                success: true,
                message: 'Operating hours updated successfully'
            });

        } catch (error) {
            logger.error('Error updating operating hours', {
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

    // Get legacy bookings (for backward compatibility)
    getLegacyBookings: async (req, res) => {
        const traceId = req.traceId;
        const { date } = req.query;

        try {
            logger.info('Fetching legacy bookings', { traceId, date });

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

            logger.info('Legacy bookings fetched', {
                traceId,
                count: result.rows.length,
                date: date || 'all'
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching legacy bookings', {
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

    // Handle payment confirmation from user
    handlePaymentConfirmation: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Payment confirmation received', { traceId });

            const { bookingId, paymentMethod, message } = req.body;

            // Validate required fields
            if (!bookingId || !paymentMethod || !message) {
                return res.status(400).json({
                    error: 'Missing required fields: bookingId, paymentMethod, or message',
                    traceId
                });
            }

            logger.info('Processing payment confirmation', {
                traceId,
                bookingId,
                paymentMethod,
                message
            });

            // Here you can add business logic
            // For example, update booking status in database, send email notifications, etc.
            
            // Log the confirmation
            await db.query(`
                INSERT INTO payment_notifications (booking_id, payment_method, message, created_at, is_read)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, false)
            `, [bookingId, paymentMethod, message]);

            logger.info('Payment confirmation processed', {
                traceId,
                bookingId,
                paymentMethod
            });

            res.json({
                success: true,
                message: 'Payment confirmation received successfully',
                bookingId,
                paymentMethod,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error handling payment confirmation', {
                traceId,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: 'Server error',
                traceId
            });
        }
    },

    // Get payment notifications
    getPaymentNotifications: async (req, res) => {
        const traceId = req.traceId;

        try {
            logger.info('Fetching payment notifications', { traceId });

            const result = await db.query(`
                SELECT pn.*, b.id as booking_id, u.name as user_name, u.email, u.phone
                FROM payment_notifications pn
                LEFT JOIN bookings b ON pn.booking_id = b.id
                LEFT JOIN users u ON b.user_id = u.id
                ORDER BY pn.created_at DESC
            `);

            logger.info('Payment notifications fetched', {
                traceId,
                count: result.rows.length
            });

            res.json(result.rows);

        } catch (error) {
            logger.error('Error fetching payment notifications', {
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

    // Mark payment notification as read
    markPaymentNotificationRead: async (req, res) => {
        const traceId = req.traceId;
        const { id } = req.params;

        try {
            logger.info('Marking payment notification as read', { traceId, id });

            await db.query(`
                UPDATE payment_notifications
                SET is_read = true
                WHERE id = $1
            `, [id]);

            logger.info('Payment notification marked as read', { traceId, id });

            res.json({
                success: true,
                message: 'Payment notification marked as read'
            });

        } catch (error) {
            logger.error('Error marking payment notification as read', {
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