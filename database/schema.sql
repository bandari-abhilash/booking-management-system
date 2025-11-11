-- Create database if it doesn't exist
-- CREATE DATABASE cricket_turf_booking;

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

-- Turf slots table
CREATE TABLE IF NOT EXISTS turf_slots (
    id SERIAL PRIMARY KEY,
    slot_name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    slot_id INTEGER REFERENCES turf_slots(id),
    booking_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, slot_id, booking_date)
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

-- Insert default turf slots
INSERT INTO turf_slots (slot_name, start_time, end_time, price) VALUES
('Morning 6-8', '06:00:00', '08:00:00', 500.00),
('Morning 8-10', '08:00:00', '10:00:00', 500.00),
('Forenoon 10-12', '10:00:00', '12:00:00', 600.00),
('Afternoon 12-2', '12:00:00', '14:00:00', 600.00),
('Afternoon 2-4', '14:00:00', '16:00:00', 700.00),
('Evening 4-6', '16:00:00', '18:00:00', 700.00),
('Evening 6-8', '18:00:00', '20:00:00', 800.00),
('Night 8-10', '20:00:00', '22:00:00', 800.00)
ON CONFLICT DO NOTHING;

-- Create default admin user (password: admin123)
INSERT INTO users (name, email, phone, password, role) VALUES
('Admin', 'admin@cricket.com', '9999999999', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (email) DO NOTHING;