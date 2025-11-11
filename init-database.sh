#!/bin/bash

# Database initialization script for Cricket Turf Booking System

echo "🏏 Cricket Turf Booking - Database Initialization"
echo "================================================"

# Read database credentials from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Error: .env file not found!"
    echo "Please create .env file with database configuration."
    exit 1
fi

echo "📋 Database Configuration:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Create database if it doesn't exist
echo "🔧 Creating database '$DB_NAME' if it doesn't exist..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database already exists or creation failed"

# Run the schema
echo "🏗️  Creating database schema..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database schema created successfully!"
else
    echo "❌ Error creating database schema!"
    exit 1
fi

# Run the setup script to initialize data
echo "🚀 Initializing data..."
node setup.js

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Database initialization completed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Start the server: npm run dev"
    echo "   2. Open browser: http://localhost:3000"
    echo "   3. Admin panel: http://localhost:3000/admin"
    echo "   4. Default admin: admin@cricket.com / admin123"
else
    echo "❌ Error initializing data!"
    exit 1
fi