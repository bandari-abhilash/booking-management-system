const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

const authController = {
    // Register user
    register: async (req, res) => {
        const traceId = req.traceId;
        const { name, email, phone, password } = req.body;

        try {
            logger.info('User registration attempt', { traceId, email });

            // Check if user already exists
            const userExists = await db.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );

            if (userExists.rows.length > 0) {
                logger.warn('User already exists', { traceId, email });
                return res.status(400).json({
                    error: 'User already exists',
                    traceId
                });
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Create user
            const result = await db.query(
                'INSERT INTO users (name, email, phone, password) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
                [name, email, phone, hashedPassword]
            );

            const user = result.rows[0];
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            logger.info('User registered successfully', { traceId, userId: user.id, email });

            res.json({ user, token });

        } catch (error) {
            logger.error('Registration error', {
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

    // Login user
    login: async (req, res) => {
        const traceId = req.traceId;
        const { email, password } = req.body;

        try {
            logger.info('User login attempt', { traceId, email });

            // Check user exists
            const result = await db.query(
                'SELECT id, name, email, password, role FROM users WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                logger.warn('Login failed - user not found', { traceId, email });
                return res.status(400).json({
                    error: 'Invalid credentials',
                    traceId
                });
            }

            const user = result.rows[0];
            const isMatch = await bcrypt.compare(password, user.password);
            console.log("isMatch:", isMatch);
            if (!isMatch) {
                logger.warn('Login failed - invalid password', { traceId, email });
                return res.status(400).json({
                    error: 'Invalid credentials',
                    traceId
                });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            logger.info('User logged in successfully', {
                traceId,
                userId: user.id,
                email,
                role: user.role
            });

            res.json({
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token
            });

        } catch (error) {
            logger.error('Login error', {
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

module.exports = authController;