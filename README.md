# Cricket Turf Booking Management System

A comprehensive booking management system for cricket turfs with user-facing booking interface and admin panel.

## Features

### User Features
- User registration and login
- View available time slots for booking
- Book cricket turf slots
- View personal booking history
- Payment QR code generation
- Responsive design

### Admin Features
- Admin authentication
- Dashboard with statistics
- View all bookings with filtering
- Manage booking status (Accept/Reject/Modify)
- View today's and tomorrow's bookings
- Generate payment QR codes
- User management
- Date-wise booking views

## Technology Stack

### Backend
- Node.js with Express.js
- PostgreSQL database
- JWT authentication
- bcryptjs for password hashing
- QR code generation

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Responsive design
- Modern UI with gradients and animations

## Installation

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cricket-turf-booking
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**
   - Create a database named `cricket_turf_booking`
   - Update the database configuration in `.env` file

4. **Configure environment variables**
   Update the following variables in `.env` file:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=cricket_turf_booking
   DB_USER=your_postgres_username
   DB_PASSWORD=your_postgres_password
   JWT_SECRET=your_jwt_secret_key
   ```

5. **Initialize database**
   ```bash
   # Option 1: Use the automated script (recommended)
   ./init-database.sh
   
   # Option 2: Manual setup
   psql -U your_username -d postgres -c "CREATE DATABASE cricket_turf_booking;"
   psql -U your_username -d cricket_turf_booking -f database/schema.sql
   npm run setup
   ```

6. **Start the application**
   ```bash
   # For development
   npm run dev
   
   # For production
   npm start
   ```

7. **Access the application**
   - Main site: http://localhost:3000
   - Admin panel: http://localhost:3000/admin

## Default Admin Account

- Email: admin@cricket.com
- Password: admin123

## Usage

### For Users
1. Register a new account or login
2. Select a date to view available slots
3. Choose your preferred time slot
4. Confirm booking
5. Scan QR code for payment
6. View your booking history

### For Admins
1. Login with admin credentials
2. View dashboard statistics
3. Manage bookings (accept/reject/modify)
4. Generate payment QR codes
5. Filter bookings by date
6. Manage users

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Bookings
- `GET /api/bookings/slots` - Get all available slots
- `GET /api/bookings/available/:date` - Get available slots for specific date
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/my-bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get booking details

### Admin
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/bookings` - Get all bookings
- `GET /api/admin/bookings/upcoming` - Get today's and tomorrow's bookings
- `PUT /api/admin/bookings/:id/status` - Update booking status
- `PUT /api/admin/bookings/:id` - Update booking details
- `DELETE /api/admin/bookings/:id` - Delete booking
- `GET /api/admin/payment/qrcode/:bookingId` - Generate payment QR code
- `GET /api/admin/users` - Get all users

## Database Schema

### Tables
- `users` - User information and authentication
- `turf_slots` - Available time slots with pricing
- `bookings` - Booking records
- `payments` - Payment transaction records

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For any issues or questions, please contact the development team.
