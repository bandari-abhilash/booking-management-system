// Global variables
let currentUser = null;
let selectedSlot = null;
let selectedDate = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
        const user = JSON.parse(localStorage.getItem('user'));
        currentUser = user;
        updateNavigation();
        showSection('booking');
    } else {
        showSection('login');
    }
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('booking-date').setAttribute('min', today);
});

// Navigation functions
function showSection(section) {
    // Hide all sections
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('booking-section').classList.add('hidden');
    document.getElementById('my-bookings-section').classList.add('hidden');
    
    // Show selected section
    switch(section) {
        case 'login':
            document.getElementById('login-section').classList.remove('hidden');
            break;
        case 'booking':
            if (!currentUser) {
                showAlert('Please login to book a slot', 'warning');
                showSection('login');
                return;
            }
            document.getElementById('booking-section').classList.remove('hidden');
            loadAvailableSlots();
            break;
        case 'my-bookings':
            if (!currentUser) {
                showAlert('Please login to view your bookings', 'warning');
                showSection('login');
                return;
            }
            document.getElementById('my-bookings-section').classList.remove('hidden');
            loadMyBookings();
            break;
    }
}

function updateNavigation() {
    const navLinks = document.querySelector('.nav-links');
    if (currentUser) {
        navLinks.innerHTML = `
            <li><a href="#" onclick="showSection('booking')">Book Slot</a></li>
            <li><a href="#" onclick="showSection('my-bookings')">My Bookings</a></li>
            <li><a href="#" onclick="logout()">Logout</a></li>
            <li><a href="/admin">Admin Panel</a></li>
        `;
    } else {
        navLinks.innerHTML = `
            <li><a href="#" onclick="showSection('booking')">Book Slot</a></li>
            <li><a href="#" onclick="showSection('my-bookings')">My Bookings</a></li>
            <li><a href="#" onclick="showSection('login')">Login</a></li>
            <li><a href="/admin">Admin Panel</a></li>
        `;
    }
}

// Authentication functions
function toggleForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm.classList.contains('hidden')) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }
}

async function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            updateNavigation();
            showAlert('Login successful!', 'success');
            showSection('booking');
        } else {
            showAlert(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

async function register(event) {
    event.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, phone, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            updateNavigation();
            showAlert('Registration successful!', 'success');
            showSection('booking');
        } else {
            showAlert(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    updateNavigation();
    showAlert('Logged out successfully', 'success');
    showSection('login');
}

// Booking functions
async function loadAvailableSlots() {
    const date = document.getElementById('booking-date').value;
    if (!date) return;
    
    selectedDate = date;
    const container = document.getElementById('slots-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch(`/api/bookings/available/${date}`);
        const slots = await response.json();
        
        if (response.ok) {
            displaySlots(slots);
        } else {
            showAlert('Error loading slots', 'error');
            container.innerHTML = '<p>Error loading slots</p>';
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
        container.innerHTML = '<p>Error loading slots</p>';
    }
}

function displaySlots(slots) {
    const container = document.getElementById('slots-container');
    
    if (slots.length === 0) {
        container.innerHTML = '<p>No available slots for this date</p>';
        return;
    }
    
    const slotsGrid = document.createElement('div');
    slotsGrid.className = 'grid grid-3';
    
    slots.forEach(slot => {
        const slotCard = document.createElement('div');
        slotCard.className = 'slot-card';
        slotCard.onclick = () => selectSlot(slot);
        
        slotCard.innerHTML = `
            <div class="slot-time">${slot.slot_name}</div>
            <div class="slot-time">${slot.start_time} - ${slot.end_time}</div>
            <div class="slot-price">₹${slot.price}</div>
        `;
        
        slotsGrid.appendChild(slotCard);
    });
    
    container.innerHTML = '';
    container.appendChild(slotsGrid);
}

function selectSlot(slot) {
    // Remove previous selection
    document.querySelectorAll('.slot-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selection to clicked slot
    event.target.closest('.slot-card').classList.add('selected');
    selectedSlot = slot;
    
    // Show booking summary
    showBookingSummary();
}

function showBookingSummary() {
    if (!selectedSlot || !selectedDate) return;
    
    const summaryContainer = document.getElementById('booking-summary');
    const summaryContent = document.getElementById('summary-content');
    
    summaryContent.innerHTML = `
        <p><strong>Date:</strong> ${new Date(selectedDate).toLocaleDateString()}</p>
        <p><strong>Slot:</strong> ${selectedSlot.slot_name}</p>
        <p><strong>Time:</strong> ${selectedSlot.start_time} - ${selectedSlot.end_time}</p>
        <p><strong>Amount:</strong> ₹${selectedSlot.price}</p>
    `;
    
    summaryContainer.classList.remove('hidden');
}

async function confirmBooking() {
    if (!selectedSlot || !selectedDate) {
        showAlert('Please select a slot', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                slot_id: selectedSlot.id,
                booking_date: selectedDate
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Booking confirmed! Please proceed with payment.', 'success');
            showPaymentModal(data);
        } else {
            showAlert(data.error || 'Booking failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

async function loadMyBookings() {
    const container = document.getElementById('bookings-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch('/api/bookings/my-bookings', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const bookings = await response.json();
        
        if (response.ok) {
            displayBookings(bookings);
        } else {
            showAlert('Error loading bookings', 'error');
            container.innerHTML = '<p>Error loading bookings</p>';
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
        container.innerHTML = '<p>Error loading bookings</p>';
    }
}

function displayBookings(bookings) {
    const container = document.getElementById('bookings-container');
    
    if (bookings.length === 0) {
        container.innerHTML = '<p>No bookings found</p>';
        return;
    }
    
    container.innerHTML = '';
    
    bookings.forEach(booking => {
        const bookingCard = document.createElement('div');
        bookingCard.className = 'booking-item';
        
        const statusClass = `status-${booking.status}`;
        
        bookingCard.innerHTML = `
            <div class="booking-header">
                <div>
                    <h4>${booking.slot_name}</h4>
                    <p>${new Date(booking.booking_date).toLocaleDateString()} - ${booking.start_time} to ${booking.end_time}</p>
                </div>
                <span class="booking-status ${statusClass}">${booking.status.toUpperCase()}</span>
            </div>
            <p><strong>Amount:</strong> ₹${booking.total_amount}</p>
            <p><strong>Payment Status:</strong> ${booking.payment_status}</p>
            ${booking.status === 'pending' ? `<button onclick="showPaymentModal(${JSON.stringify(booking).replace(/"/g, '"')})" class="btn btn-primary btn-sm mt-1">Pay Now</button>` : ''}
        `;
        
        container.appendChild(bookingCard);
    });
}

// Payment functions
function showPaymentModal(booking) {
    const modal = document.getElementById('payment-modal');
    const content = document.getElementById('payment-content');
    
    content.innerHTML = `
        <div class="qr-container">
            <h3>Booking Confirmed!</h3>
            <p><strong>Booking ID:</strong> ${booking.id}</p>
            <p><strong>Amount:</strong> ₹${booking.total_amount}</p>
            <p>Please scan the QR code below to complete the payment:</p>
            <div class="spinner"></div>
            <p class="mt-1">After payment, your booking will be confirmed by the admin.</p>
            <button onclick="closePaymentModal()" class="btn btn-secondary">Close</button>
        </div>
    `;
    
    modal.style.display = 'block';
    
    // Generate QR code
    generateQRCode(booking.id);
}

async function generateQRCode(bookingId) {
    try {
        const response = await fetch(`/api/admin/payment/qrcode/${bookingId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const qrContainer = document.querySelector('.qr-container .spinner');
            qrContainer.innerHTML = `<img src="${data.qrCode}" alt="Payment QR Code">`;
        } else {
            document.querySelector('.qr-container .spinner').innerHTML = '<p>Error generating QR code</p>';
        }
    } catch (error) {
        document.querySelector('.qr-container .spinner').innerHTML = '<p>Error generating QR code</p>';
    }
}

function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
}

// Utility functions
function showAlert(message, type) {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('payment-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}