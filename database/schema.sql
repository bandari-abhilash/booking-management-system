-- Create database if it doesn't exist
-- CREATE DATABASE cricket_turf_booking;

-- Enable btree_gist extension for tsrange
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time slots pricing table (for dynamic pricing based on time of day)
CREATE TABLE IF NOT EXISTS time_slot_pricing (
    id SERIAL PRIMARY KEY,
    slot_name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Turf slots table (for predefined time slots)
CREATE TABLE IF NOT EXISTS turf_slots (
    id SERIAL PRIMARY KEY,
    slot_name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table (updated to support custom time ranges and bidding)
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    is_bid BOOLEAN DEFAULT false,
    bid_amount DECIMAL(10,2),
    bid_status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
    admin_notified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Note: Collision detection is handled in application logic
    -- to allow pending bookings with time conflicts
);

-- Booking collisions table (to track conflicts)
CREATE TABLE IF NOT EXISTS booking_collisions (
    id SERIAL PRIMARY KEY,
    original_booking_id INTEGER REFERENCES bookings(id),
    colliding_booking_id INTEGER REFERENCES bookings(id),
    collision_status VARCHAR(20) DEFAULT 'pending', -- pending, resolved, rejected
    resolved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment records table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id),
    user_id INTEGER REFERENCES users(id),
    notification_type VARCHAR(50) NOT NULL, -- bid_request, collision_detected, etc.
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment notifications table
CREATE TABLE IF NOT EXISTS payment_notifications (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id),
    payment_method VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Operating hours table
CREATE TABLE IF NOT EXISTS operating_hours (
    id SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(day_of_week)
);

-- Insert default time slot pricing
INSERT INTO time_slot_pricing (slot_name, start_time, end_time, base_price) VALUES
('Early Morning', '06:00:00', '08:00:00', 500.00),
('Morning', '08:00:00', '10:00:00', 500.00),
('Mid Morning', '10:00:00', '12:00:00', 600.00),
('Afternoon', '12:00:00', '14:00:00', 600.00),
('Late Afternoon', '14:00:00', '16:00:00', 700.00),
('Evening', '16:00:00', '18:00:00', 700.00),
('Prime Evening', '18:00:00', '20:00:00', 800.00),
('Night', '20:00:00', '22:00:00', 800.00)
ON CONFLICT DO NOTHING;

-- Create default admin user (password: admin123)
INSERT INTO users (name, email, phone, password, role) VALUES
('Admin', 'admin@cricket.com', '9999999999', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert default operating hours (6 AM to 10 PM)
INSERT INTO operating_hours (day_of_week, opening_time, closing_time, is_active) VALUES
(0, '06:00:00', '22:00:00', true),  -- Sunday
(1, '06:00:00', '22:00:00', true),  -- Monday
(2, '06:00:00', '22:00:00', true),  -- Tuesday
(3, '06:00:00', '22:00:00', true),  -- Wednesday
(4, '06:00:00', '22:00:00', true),  -- Thursday
(5, '06:00:00', '22:00:00', true),  -- Friday
(6, '06:00:00', '22:00:00', true)   -- Saturday
ON CONFLICT (day_of_week) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings(booking_date, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_read ON payment_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_operating_hours_day ON operating_hours(day_of_week);

-- End of schema