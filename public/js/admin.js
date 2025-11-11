// Global variables
let currentUser = null;
let allSlots = [];

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    // Check if admin is logged in
    const token = localStorage.getItem('adminToken');
    if (token) {
        const user = JSON.parse(localStorage.getItem('adminUser'));
        currentUser = user;
        if (user && user.role === 'admin') {
            showSection('dashboard');
            loadDashboard();
        } else {
            logout();
        }
    } else {
        showSection('login');
    }
    
    // Load slots for editing
    loadSlots();
});

// Navigation functions
function showSection(section) {
    // Hide all sections
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('bookings-section').classList.add('hidden');
    document.getElementById('upcoming-section').classList.add('hidden');
    document.getElementById('users-section').classList.add('hidden');
    
    // Show selected section
    switch(section) {
        case 'login':
            document.getElementById('login-section').classList.remove('hidden');
            break;
        case 'dashboard':
            document.getElementById('dashboard-section').classList.remove('hidden');
            loadDashboard();
            break;
        case 'bookings':
            document.getElementById('bookings-section').classList.remove('hidden');
            loadBookings();
            break;
        case 'upcoming':
            document.getElementById('upcoming-section').classList.remove('hidden');
            loadUpcomingBookings();
            break;
        case 'users':
            document.getElementById('users-section').classList.remove('hidden');
            loadUsers();
            break;
    }
}

// Authentication functions
async function adminLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.user.role === 'admin') {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user));
            currentUser = data.user;
            showAlert('Login successful!', 'success');
            showSection('dashboard');
        } else {
            showAlert(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    currentUser = null;
    showAlert('Logged out successfully', 'success');
    showSection('login');
}

// Dashboard functions
async function loadDashboard() {
    try {
        const response = await fetch('/api/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('today-bookings').textContent = data.todayBookings;
            document.getElementById('pending-bookings').textContent = data.pendingBookings;
            document.getElementById('total-revenue').textContent = `₹${data.totalRevenue}`;
            document.getElementById('today-revenue').textContent = `₹${data.todayRevenue}`;
        } else {
            showAlert('Error loading dashboard', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

// Bookings functions
async function loadBookings() {
    const container = document.getElementById('bookings-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    const dateFilter = document.getElementById('filter-date').value;
    const url = dateFilter ? `/api/admin/bookings?date=${dateFilter}` : '/api/admin/bookings';
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
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

async function loadUpcomingBookings() {
    const container = document.getElementById('upcoming-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch('/api/admin/bookings/upcoming', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const bookings = await response.json();
        
        if (response.ok) {
            displayBookings(bookings, 'upcoming-container');
        } else {
            showAlert('Error loading upcoming bookings', 'error');
            container.innerHTML = '<p>Error loading bookings</p>';
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
        container.innerHTML = '<p>Error loading bookings</p>';
    }
}

function displayBookings(bookings, containerId = 'bookings-container') {
    const container = document.getElementById(containerId);
    
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
                    <h4>Booking #${booking.id} - ${booking.slot_name}</h4>
                    <p><strong>Date:</strong> ${new Date(booking.booking_date).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</p>
                    <p><strong>Customer:</strong> ${booking.user_name} (${booking.email}, ${booking.phone})</p>
                </div>
                <span class="booking-status ${statusClass}">${booking.status.toUpperCase()}</span>
            </div>
            <p><strong>Amount:</strong> ₹${booking.total_amount}</p>
            <p><strong>Payment Status:</strong> ${booking.payment_status}</p>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                ${booking.status === 'pending' ? `<button onclick="updateBookingStatus(${booking.id}, 'confirmed')" class="btn btn-success btn-sm">Accept</button>` : ''}
                ${booking.status === 'pending' ? `<button onclick="updateBookingStatus(${booking.id}, 'rejected')" class="btn btn-danger btn-sm">Reject</button>` : ''}
                <button onclick="editBooking(${booking.id})" class="btn btn-warning btn-sm">Edit</button>
                <button onclick="showPaymentQR(${booking.id})" class="btn btn-primary btn-sm">Payment QR</button>
                ${booking.status === 'pending' || booking.status === 'rejected' ? `<button onclick="deleteBooking(${booking.id})" class="btn btn-danger btn-sm">Delete</button>` : ''}
            </div>
        `;
        
        container.appendChild(bookingCard);
    });
}

async function updateBookingStatus(bookingId, status) {
    try {
        const response = await fetch(`/api/admin/bookings/${bookingId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({ status })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert(`Booking ${status} successfully!`, 'success');
            loadBookings();
            loadUpcomingBookings();
            loadDashboard();
        } else {
            showAlert(data.error || 'Error updating booking', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

async function editBooking(bookingId) {
    try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const booking = await response.json();
        
        if (response.ok) {
            showEditModal(booking);
        } else {
            showAlert('Error loading booking details', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

function showEditModal(booking) {
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-content');
    
    const slotOptions = allSlots.map(slot => 
        `<option value="${slot.id}" ${slot.id === booking.slot_id ? 'selected' : ''}>
            ${slot.slot_name} - ${slot.start_time} to ${slot.end_time} (₹${slot.price})
        </option>`
    ).join('');
    
    content.innerHTML = `
        <form onsubmit="updateBooking(event, ${booking.id})">
            <div class="form-group">
                <label for="edit-date">Date</label>
                <input type="date" id="edit-date" class="form-control" value="${booking.booking_date}" required>
            </div>
            <div class="form-group">
                <label for="edit-slot">Slot</label>
                <select id="edit-slot" class="form-control" required>
                    ${slotOptions}
                </select>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button type="submit" class="btn btn-primary">Update</button>
                <button type="button" onclick="closeEditModal()" class="btn btn-secondary">Cancel</button>
            </div>
        </form>
    `;
    
    modal.style.display = 'block';
}

async function updateBooking(event, bookingId) {
    event.preventDefault();
    
    const booking_date = document.getElementById('edit-date').value;
    const slot_id = document.getElementById('edit-slot').value;
    
    try {
        const response = await fetch(`/api/admin/bookings/${bookingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({ booking_date, slot_id })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Booking updated successfully!', 'success');
            closeEditModal();
            loadBookings();
            loadUpcomingBookings();
        } else {
            showAlert(data.error || 'Error updating booking', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

async function deleteBooking(bookingId) {
    if (!confirm('Are you sure you want to delete this booking?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Booking deleted successfully!', 'success');
            loadBookings();
            loadUpcomingBookings();
            loadDashboard();
        } else {
            showAlert(data.error || 'Error deleting booking', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

// Users functions
async function loadUsers() {
    const container = document.getElementById('users-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const users = await response.json();
        
        if (response.ok) {
            displayUsers(users);
        } else {
            showAlert('Error loading users', 'error');
            container.innerHTML = '<p>Error loading users</p>';
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
        container.innerHTML = '<p>Error loading users</p>';
    }
}

function displayUsers(users) {
    const container = document.getElementById('users-container');
    
    if (users.length === 0) {
        container.innerHTML = '<p>No users found</p>';
        return;
    }
    
    container.innerHTML = '';
    
    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'booking-item';
        
        userCard.innerHTML = `
            <div class="booking-header">
                <div>
                    <h4>${user.name}</h4>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Phone:</strong> ${user.phone}</p>
                    <p><strong>Role:</strong> ${user.role}</p>
                    <p><strong>Joined:</strong> ${new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <span class="booking-status status-${user.role === 'admin' ? 'confirmed' : 'pending'}">${user.role.toUpperCase()}</span>
            </div>
        `;
        
        container.appendChild(userCard);
    });
}

// Payment functions
async function showPaymentQR(bookingId) {
    const modal = document.getElementById('payment-modal');
    const content = document.getElementById('payment-content');
    
    content.innerHTML = `
        <div class="qr-container">
            <h3>Payment QR Code</h3>
            <div class="spinner"></div>
            <p class="mt-1">Share this QR code with the customer for payment</p>
            <button onclick="closePaymentModal()" class="btn btn-secondary">Close</button>
        </div>
    `;
    
    modal.style.display = 'block';
    
    try {
        const response = await fetch(`/api/admin/payment/qrcode/${bookingId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const qrContainer = document.querySelector('.qr-container .spinner');
            qrContainer.innerHTML = `
                <img src="${data.qrCode}" alt="Payment QR Code">
                <p><strong>Payment Details:</strong></p>
                <p>${data.paymentText}</p>
            `;
        } else {
            document.querySelector('.qr-container .spinner').innerHTML = '<p>Error generating QR code</p>';
        }
    } catch (error) {
        document.querySelector('.qr-container .spinner').innerHTML = '<p>Error generating QR code</p>';
    }
}

// Utility functions
async function loadSlots() {
    try {
        const response = await fetch('/api/bookings/slots');
        const slots = await response.json();
        
        if (response.ok) {
            allSlots = slots;
        }
    } catch (error) {
        console.error('Error loading slots:', error);
    }
}

function clearDateFilter() {
    document.getElementById('filter-date').value = '';
    loadBookings();
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
}

function showAlert(message, type) {
    const alertContainers = document.querySelectorAll('#alert-container');
    alertContainers.forEach(container => {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        
        container.appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 5000);
    });
}

// Close modals when clicking outside
window.onclick = function(event) {
    const editModal = document.getElementById('edit-modal');
    const paymentModal = document.getElementById('payment-modal');
    
    if (event.target === editModal) {
        editModal.style.display = 'none';
    }
    if (event.target === paymentModal) {
        paymentModal.style.display = 'none';
    }
}