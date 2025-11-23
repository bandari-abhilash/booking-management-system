// Global variables
let currentUser = null;
let selectedDate = null;
let selectedStartTime = null;
let selectedEndTime = null;
let currentPrice = 0;
let hasCollisions = false;
let collisionData = null;
let isPlacingBid = false;
let operatingHours = null;
let currentBooking = null;

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
    
    // Load operating hours and populate time options
    loadOperatingHours();
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
function onDateChange() {
    const date = document.getElementById('booking-date').value;
    if (!date) return;
    
    selectedDate = date;
    // Reset time selections
    selectedStartTime = null;
    selectedEndTime = null;
    
    // Generate time options for the selected date
    generateTimeOptions();
    
    // Hide previous results
    hideAllBookingSections();
}

async function onTimeChange() {
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    
    if (!selectedDate || !startTime || !endTime) {
        hideAllBookingSections();
        return;
    }
    
    // Validate time range
    if (startTime >= endTime) {
        showAlert('End time must be after start time', 'error');
        hideAllBookingSections();
        return;
    }
    
    selectedStartTime = startTime;
    selectedEndTime = endTime;
    
    // Calculate price
    await calculatePrice();
    
    // Check for collisions
    await checkCollisions();
    
    // Show booking summary
    showBookingSummary();
}

async function calculatePrice() {
    try {
        const response = await fetch('/api/bookings/calculate-price', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start_time: selectedStartTime,
                end_time: selectedEndTime
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentPrice = data.totalPrice;
            showPricingDetails(data);
        } else {
            showAlert('Error calculating price', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

function showPricingDetails(data) {
    const pricingInfo = document.getElementById('pricing-info');
    const pricingContent = document.getElementById('pricing-content');
    
    let pricingHTML = '<div class="pricing-details">';
    
    if (data.pricingDetails && data.pricingDetails.length > 0) {
        data.pricingDetails.forEach(detail => {
            pricingHTML += `
                <div class="pricing-item">
                    <span>${detail.timeRange} (${detail.duration}h @ ₹${detail.rate}/h)</span>
                    <span>₹${detail.price}</span>
                </div>
            `;
        });
        
        pricingHTML += `
            <div class="pricing-item">
                <strong>Total Amount</strong>
                <strong>₹${data.totalPrice}</strong>
            </div>
        `;
    } else {
        pricingHTML += `
            <div class="pricing-item">
                <strong>Total Amount</strong>
                <strong>₹${data.totalPrice}</strong>
            </div>
        `;
    }
    
    pricingHTML += '</div>';
    
    pricingContent.innerHTML = pricingHTML;
    pricingInfo.classList.remove('hidden');
}

async function checkCollisions() {
    try {
        const response = await fetch('/api/bookings/check-collisions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                date: selectedDate,
                start_time: selectedStartTime,
                end_time: selectedEndTime
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            hasCollisions = data.hasCollisions;
            collisionData = data.collisions;
            
            if (hasCollisions) {
                showCollisionWarning(data.collisions);
            } else {
                hideCollisionWarning();
            }
        } else {
            showAlert('Error checking collisions', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

function showCollisionWarning(collisions) {
    const collisionWarning = document.getElementById('collision-warning');
    const collisionContent = document.getElementById('collision-content');
    
    let collisionHTML = '<div class="collision-details">';
    collisionHTML += '<p><strong>The following bookings conflict with your selected time:</strong></p>';
    
    collisions.forEach(collision => {
        collisionHTML += `
            <div class="collision-item">
                <div><strong>User:</strong> ${collision.user_name}</div>
                <div><strong>Time:</strong> ${collision.start_time} - ${collision.end_time}</div>
                <div><strong>Amount:</strong> ₹${collision.total_amount}</div>
                <div><strong>Status:</strong> ${collision.status.toUpperCase()}</div>
            </div>
        `;
    });
    
    collisionHTML += '</div>';
    collisionContent.innerHTML = collisionHTML;
    collisionWarning.classList.remove('hidden');
}

function hideCollisionWarning() {
    document.getElementById('collision-warning').classList.add('hidden');
}

function hideAllBookingSections() {
    document.getElementById('pricing-info').classList.add('hidden');
    document.getElementById('collision-warning').classList.add('hidden');
    document.getElementById('booking-summary').classList.add('hidden');
}

function proceedWithBid() {
    const bidAmount = document.getElementById('bid-amount').value;
    
    if (!bidAmount || bidAmount <= currentPrice) {
        showAlert('Bid amount must be greater than the current price', 'error');
        return;
    }
    
    isPlacingBid = true;
    currentPrice = parseFloat(bidAmount);
    showBookingSummary();
}

function proceedWithoutBid() {
    isPlacingBid = false;
    showBookingSummary();
}

function showBookingSummary() {
    if (!selectedDate || !selectedStartTime || !selectedEndTime) return;
    
    const summaryContainer = document.getElementById('booking-summary');
    const summaryContent = document.getElementById('summary-content');
    
    let summaryHTML = `
        <p><strong>Date:</strong> ${new Date(selectedDate).toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${selectedStartTime} - ${selectedEndTime}</p>
        <p><strong>Amount:</strong> ₹${currentPrice}</p>
    `;
    
    if (hasCollisions) {
        summaryHTML += `<p><strong>Status:</strong> <span class="alert alert-warning">Pending (Time conflict detected)</span></p>`;
    }
    
    if (isPlacingBid) {
        summaryHTML += `<p><strong>Bid Amount:</strong> ₹${document.getElementById('bid-amount').value}</p>`;
    }
    
    summaryContent.innerHTML = summaryHTML;
    summaryContainer.classList.remove('hidden');
}

async function confirmBooking() {
    if (!selectedDate || !selectedStartTime || !selectedEndTime) {
        showAlert('Please select date and time', 'warning');
        return;
    }
    
    const bookingData = {
        booking_date: selectedDate,
        start_time: selectedStartTime,
        end_time: selectedEndTime
    };
    
    if (isPlacingBid) {
        bookingData.is_bid = true;
        bookingData.bid_amount = parseFloat(document.getElementById('bid-amount').value);
    }
    
    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(bookingData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            let message = 'Booking confirmed!';
            if (data.hasCollisions) {
                message = isPlacingBid 
                    ? 'Bid placed successfully! Admin will review your request.'
                    : 'Booking submitted! Admin will review due to time conflict.';
            }
            showAlert(message, 'success');
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
        
        let bookingHTML = `
            <div class="booking-header">
                <div>
                    <h4>${new Date(booking.booking_date).toLocaleDateString()}</h4>
                    <p>${booking.start_time} to ${booking.end_time}</p>
                </div>
                <div>
                    <span class="booking-status ${statusClass}">${booking.status.toUpperCase()}</span>
                    ${booking.is_bid ? `<span class="bid-status bid-${booking.bid_status}">BID: ${booking.bid_status.toUpperCase()}</span>` : ''}
                </div>
            </div>
            <p><strong>Amount:</strong> ₹${booking.total_amount}</p>
            <p><strong>Payment Status:</strong> ${booking.payment_status}</p>
        `;
        
        if (booking.is_bid && booking.bid_amount) {
            bookingHTML += `<p><strong>Bid Amount:</strong> ₹${booking.bid_amount}</p>`;
        }
        
        if (booking.collision_count > 0) {
            bookingHTML += `<p><strong>⚠️ Has time conflicts</strong></p>`;
        }
        
        if (booking.status === 'pending') {
            bookingHTML += `<button onclick="showPaymentModal(${JSON.stringify(booking).replace(/"/g, '"')})" class="btn btn-primary btn-sm mt-1">Pay Now</button>`;
        }
        
        bookingCard.innerHTML = bookingHTML;
        container.appendChild(bookingCard);
    });
}

// Payment functions
function showPaymentModal(booking) {
    const modal = document.getElementById('payment-modal');
    const content = document.getElementById('payment-content');
    
    let paymentHTML = `
        <div class="qr-container">
            <h3>Booking Confirmed</h3>
    `;
    
    if (booking.is_bid) {
        paymentHTML += `<p><strong>Bid Amount:</strong> ₹${booking.bid_amount}</p>`;
        paymentHTML += `<p><strong>Status:</strong> Bid ${booking.bid_status} - Awaiting admin approval</p>`;
    } else if (booking.hasCollisions) {
        paymentHTML += `<p><strong>Status:</strong> Awaiting admin review due to time conflict</p>`;
    } else {
        paymentHTML += `<p>Please scan the QR code below to complete the payment:</p>`;
        paymentHTML += `
            <div class="qr-code-container">
                <img src="qr-code.png" alt="Payment QR Code" class="qr-code-image">
                <p class="qr-payment-details">
                    <strong>Payment Details:</strong><br>
                    Pay to: Cricket Turf Booking<br>
                    Amount: ₹${booking.total_amount}<br>
                    Booking ID: ${booking.id}
                </p>
            </div>
        `;
    }
    
    paymentHTML += `
            <p class="mt-1">After payment, your booking will be confirmed by the admin.</p>
            <button onclick="closePaymentModal()" class="btn btn-secondary">Close</button>
        </div>
    `;
    
    content.innerHTML = paymentHTML;
    modal.style.display = 'block';
}


function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
}

function confirmPayment() {
    // Close payment modal
    closePaymentModal();
    
    // Set current booking for admin notification
    currentBooking = {
        id: document.querySelector('#payment-content strong:nth-child(1)')?.textContent?.replace('Booking ID:', '').trim(),
        booking_date: selectedDate,
        start_time: selectedStartTime,
        end_time: selectedEndTime,
        total_amount: currentPrice,
        payment_status: 'confirmed',
        payment_method: document.getElementById('payment-status-text')?.textContent?.replace('Paid via ', '').trim() || 'Unknown'
    };
    
    // Show success message
    showAlert('Payment confirmed! Your booking will be processed by the admin.', 'success');
    
    // Notify admin about payment confirmation
    notifyAdminPaymentConfirmation();
    
    console.log('Payment confirmed by user');
}

async function notifyAdminPaymentConfirmation() {
    try {
        const response = await fetch('/api/admin/payment-confirmation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                message: 'Payment confirmed by user',
                bookingId: currentBooking ? currentBooking.id : null,
                paymentMethod: document.getElementById('payment-status-text') ? document.getElementById('payment-status-text').textContent : 'Unknown'
            })
        });
        
        if (response.ok) {
            console.log('Admin notified successfully about payment');
        } else {
            console.log('Failed to notify admin about payment');
        }
    } catch (error) {
        console.error('Error notifying admin about payment:', error);
    }
}

// Load operating hours from the server
async function loadOperatingHours() {
    try {
        const response = await fetch('/api/bookings/operating-hours');
        const data = await response.json();
        
        if (response.ok) {
            operatingHours = data;
            // Generate time options once operating hours are loaded
            generateTimeOptions();
        } else {
            console.error('Error loading operating hours');
            // Use default operating hours if API fails
            operatingHours = [
                { day_of_week: 0, opening_time: '06:00:00', closing_time: '22:00:00' }, // Sunday
                { day_of_week: 1, opening_time: '06:00:00', closing_time: '22:00:00' }, // Monday
                { day_of_week: 2, opening_time: '06:00:00', closing_time: '22:00:00' }, // Tuesday
                { day_of_week: 3, opening_time: '06:00:00', closing_time: '22:00:00' }, // Wednesday
                { day_of_week: 4, opening_time: '06:00:00', closing_time: '22:00:00' }, // Thursday
                { day_of_week: 5, opening_time: '06:00:00', closing_time: '22:00:00' }, // Friday
                { day_of_week: 6, opening_time: '06:00:00', closing_time: '22:00:00' }  // Saturday
            ];
            generateTimeOptions();
        }
    } catch (error) {
        console.error('Error loading operating hours:', error);
        // Use default operating hours if API fails
        operatingHours = [
            { day_of_week: 0, opening_time: '06:00:00', closing_time: '22:00:00' }, // Sunday
            { day_of_week: 1, opening_time: '06:00:00', closing_time: '22:00:00' }, // Monday
            { day_of_week: 2, opening_time: '06:00:00', closing_time: '22:00:00' }, // Tuesday
            { day_of_week: 3, opening_time: '06:00:00', closing_time: '22:00:00' }, // Wednesday
            { day_of_week: 4, opening_time: '06:00:00', closing_time: '22:00:00' }, // Thursday
            { day_of_week: 5, opening_time: '06:00:00', closing_time: '22:00:00' }, // Friday
            { day_of_week: 6, opening_time: '06:00:00', closing_time: '22:00:00' }  // Saturday
        ];
        generateTimeOptions();
    }
}

// Generate time options for the selected date
function generateTimeOptions() {
    if (!selectedDate || !operatingHours) return;
    
    const dayOfWeek = new Date(selectedDate).getDay();
    const dayOperatingHours = operatingHours.find(hours => hours.day_of_week === dayOfWeek);
    
    if (!dayOperatingHours) {
        console.error('No operating hours found for selected day');
        return;
    }
    
    const openingTime = dayOperatingHours.opening_time.substring(0, 5); // Remove seconds
    const closingTime = dayOperatingHours.closing_time.substring(0, 5); // Remove seconds
    
    const startTimeSelect = document.getElementById('start-time');
    const endTimeSelect = document.getElementById('end-time');
    
    // Clear existing options
    startTimeSelect.innerHTML = '<option value="">Select start time</option>';
    endTimeSelect.innerHTML = '<option value="">Select end time</option>';
    
    // Generate time slots in 30-minute intervals
    const [openHour, openMinute] = openingTime.split(':').map(Number);
    const [closeHour, closeMinute] = closingTime.split(':').map(Number);
    
    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;
    
    // Generate start time options
    for (let minutes = openMinutes; minutes < closeMinutes; minutes += 30) {
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        const option = document.createElement('option');
        option.value = timeString;
        option.textContent = timeString;
        startTimeSelect.appendChild(option);
    }
    
    // Generate end time options (start from 30 minutes after opening time)
    for (let minutes = openMinutes + 30; minutes <= closeMinutes; minutes += 30) {
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        const option = document.createElement('option');
        option.value = timeString;
        option.textContent = timeString;
        endTimeSelect.appendChild(option);
    }
    
    // Reset selected times
    selectedStartTime = null;
    selectedEndTime = null;
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