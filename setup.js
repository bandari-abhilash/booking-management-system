const db = require('./config/database');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
    try {
        console.log('Initializing database...');
        
        // Test database connection
        const result = await db.query('SELECT NOW()');
        console.log('Database connected successfully:', result.rows[0].now);
        
        // Check if admin user exists
        const adminCheck = await db.query('SELECT id FROM users WHERE email = $1', ['admin@cricket.com']);
        
        if (adminCheck.rows.length === 0) {
            console.log('Creating default admin user...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            await db.query(
                'INSERT INTO users (name, email, phone, password, role) VALUES ($1, $2, $3, $4, $5)',
                ['Admin', 'admin@cricket.com', '9999999999', hashedPassword, 'admin']
            );
            console.log('Default admin user created successfully');
        } else {
            console.log('Admin user already exists');
        }
        
        // Check if slots exist
        const slotsCheck = await db.query('SELECT COUNT(*) as count FROM turf_slots');
        
        if (parseInt(slotsCheck.rows[0].count) === 0) {
            console.log('Creating default turf slots...');
            const slots = [
                ['Morning 6-8', '06:00:00', '08:00:00', 500.00],
                ['Morning 8-10', '08:00:00', '10:00:00', 500.00],
                ['Forenoon 10-12', '10:00:00', '12:00:00', 600.00],
                ['Afternoon 12-2', '12:00:00', '14:00:00', 600.00],
                ['Afternoon 2-4', '14:00:00', '16:00:00', 700.00],
                ['Evening 4-6', '16:00:00', '18:00:00', 700.00],
                ['Evening 6-8', '18:00:00', '20:00:00', 800.00],
                ['Night 8-10', '20:00:00', '22:00:00', 800.00]
            ];
            
            for (const slot of slots) {
                await db.query(
                    'INSERT INTO turf_slots (slot_name, start_time, end_time, price) VALUES ($1, $2, $3, $4)',
                    slot
                );
            }
            console.log('Default turf slots created successfully');
        } else {
            console.log('Turf slots already exist');
        }
        
        console.log('Database initialization completed successfully!');
        
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
}

// Run initialization if this file is executed directly
if (require.main === module) {
    initializeDatabase().then(() => {
        process.exit(0);
    });
}

module.exports = initializeDatabase;