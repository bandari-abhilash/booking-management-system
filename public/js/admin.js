// Global variables
let currentUser = null;
let allPricing = [];

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
    
    // Load pricing data
    loadPricing();
});

// Navigation functions
function showSection(section) {
    // Hide all sections
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('bookings-section').classList.add('hidden');
    document.getElementById('upcoming-section').classList.add('hidden');
    document.getElementById('bids-section').classList.add('hidden');
    document.getElementById('pricing-section').classList.add('hidden');
    document.getElementById('notifications-section').classList.add('hidden');
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
        case 'bids':
            document.getElementById('bids-section').classList.remove('hidden');
            loadBidsAndCollisions();
            break;
        case 'pricing':
            document.getElementById('pricing-section').classList.remove('hidden');
            loadPricingSection();
            break;
        case 'notifications':
            document.getElementById('notifications-section').classList.remove('hidden');
            loadNotifications();
            break;
        case 'payment-notifications':
            document.getElementById('payment-notifications-section').classList.remove('hidden');
            loadPaymentNotifications();
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
            document.getElementById('pending-bids').textContent = data.pendingBids;
            document.getElementById('unresolved-collisions').textContent = data.unresolvedCollisions;
            document.getElementById('total-revenue').textContent = `₹${data.totalRevenue}`;
            document.getElementById('today-revenue').textContent = `₹${data.todayRevenue}`;
            
            // Update payment notifications badge
            const paymentNotifLink = document.querySelector('a[onclick*="payment-notifications"]');
            if (paymentNotifLink && data.unreadPaymentNotifications > 0) {
                paymentNotifLink.innerHTML = `Payment Confirmations <span class="badge">${data.unreadPaymentNotifications}</span>`;
            } else if (paymentNotifLink) {
                paymentNotifLink.innerHTML = 'Payment Confirmations';
            }
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
    const url = dateFilter ? `/api/admin/bookings/legacy?date=${dateFilter}` : '/api/admin/bookings/legacy';
    
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
        
        let bookingHTML = `
            <div class="booking-header">
                <div>
                    <h4>Booking #${booking.id} - ${new Date(booking.booking_date).toLocaleDateString()}</h4>
                    <p><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</p>
                    <p><strong>Customer:</strong> ${booking.user_name} (${booking.email}, ${booking.phone})</p>
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
            bookingHTML += `<p><strong>⚠️ Has ${booking.collision_count} collision(s)</strong></p>`;
        }
        
        bookingHTML += `
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
                ${booking.status === 'pending' ? `<button onclick="updateBookingStatus(${booking.id}, 'confirmed')" class="btn btn-success btn-sm">Accept</button>` : ''}
                ${booking.status === 'pending' ? `<button onclick="updateBookingStatus(${booking.id}, 'rejected')" class="btn btn-danger btn-sm">Reject</button>` : ''}
                ${booking.is_bid && booking.bid_status === 'pending' ? `<button onclick="handleBid(${booking.id}, 'approve')" class="btn btn-success btn-sm">Approve Bid</button>` : ''}
                ${booking.is_bid && booking.bid_status === 'pending' ? `<button onclick="handleBid(${booking.id}, 'reject')" class="btn btn-danger btn-sm">Reject Bid</button>` : ''}
                <button onclick="editBooking(${booking.id})" class="btn btn-warning btn-sm">Edit</button>
                <button onclick="showPaymentQR(${booking.id})" class="btn btn-primary btn-sm">Payment QR</button>
                ${booking.status === 'pending' || booking.status === 'rejected' ? `<button onclick="deleteBooking(${booking.id})" class="btn btn-danger btn-sm">Delete</button>` : ''}
            </div>
        `;
        
        bookingCard.innerHTML = bookingHTML;
        container.appendChild(bookingCard);
    });
}

// Bids and Collisions functions
async function loadBidsAndCollisions() {
    const container = document.getElementById('bids-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch('/api/admin/bookings', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const bookings = await response.json();
        
        if (response.ok) {
            displayBidsAndCollisions(bookings);
        } else {
            showAlert('Error loading bids and collisions', 'error');
            container.innerHTML = '<p>Error loading data</p>';
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
        container.innerHTML = '<p>Error loading data</p>';
    }
}

function displayBidsAndCollisions(bookings) {
    const container = document.getElementById('bids-container');
    
    // Filter for bids and collisions
    const bidsAndCollisions = bookings.filter(booking => 
        booking.is_bid || booking.collision_count > 0
    );
    
    if (bidsAndCollisions.length === 0) {
        container.innerHTML = '<p>No bids or collisions found</p>';
        return;
    }
    
    container.innerHTML = '';
    
    bidsAndCollisions.forEach(booking => {
        const bookingCard = document.createElement('div');
        bookingCard.className = 'booking-item';
        
        let bookingHTML = `
            <div class="booking-header">
                <div>
                    <h4>Booking #${booking.id} - ${new Date(booking.booking_date).toLocaleDateString()}</h4>
                    <p><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</p>
                    <p><strong>Customer:</strong> ${booking.user_name} (${booking.email}, ${booking.phone})</p>
                </div>
                <div>
                    <span class="booking-status status-${booking.status}">${booking.status.toUpperCase()}</span>
                    ${booking.is_bid ? `<span class="bid-status bid-${booking.bid_status}">BID: ${booking.bid_status.toUpperCase()}</span>` : ''}
                </div>
            </div>
            <p><strong>Amount:</strong> ₹${booking.total_amount}</p>
        `;
        
        if (booking.is_bid && booking.bid_amount) {
            bookingHTML += `<p><strong>Bid Amount:</strong> ₹${booking.bid_amount}</p>`;
        }
        
        if (booking.collision_count > 0) {
            bookingHTML += `<p><strong>⚠️ Collisions:</strong> ${booking.collision_count} time conflict(s)</p>`;
        }
        
        bookingHTML += `
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
                ${booking.is_bid && booking.bid_status === 'pending' ? `<button onclick="handleBid(${booking.id}, 'approve')" class="btn btn-success btn-sm">Approve Bid</button>` : ''}
                ${booking.is_bid && booking.bid_status === 'pending' ? `<button onclick="handleBid(${booking.id}, 'reject')" class="btn btn-danger btn-sm">Reject Bid</button>` : ''}
                ${booking.collision_count > 0 ? `<button onclick="resolveCollision(${booking.id})" class="btn btn-warning btn-sm">Resolve Collision</button>` : ''}
            </div>
        `;
        
        bookingCard.innerHTML = bookingHTML;
        container.appendChild(bookingCard);
    });
}

async function handleBid(bookingId, action) {
    try {
        const response = await fetch('/api/admin/bookings/handle-bid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({ booking_id: bookingId, action })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert(data.message, 'success');
            loadBidsAndCollisions();
            loadBookings();
            loadDashboard();
        } else {
            showAlert(data.error || 'Error handling bid', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

function resolveCollision(bookingId) {
    // This would typically show a modal to select which booking to prefer
    // For now, we'll show a simple confirmation
    if (confirm('This will resolve the collision by confirming this booking and rejecting others. Continue?')) {
        // Implementation would go here
        showAlert('Collision resolution feature coming soon', 'warning');
    }
}

// Pricing functions
async function loadPricing() {
    try {
        const response = await fetch('/api/admin/pricing', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const pricing = await response.json();
        
        if (response.ok) {
            allPricing = pricing;
        }
    } catch (error) {
        console.error('Error loading pricing:', error);
    }
}

async function loadPricingSection() {
    const container = document.getElementById('pricing-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch('/api/admin/pricing', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const pricing = await response.json();
        
        if (response.ok) {
            displayPricing(pricing);
        } else {
            showAlert('Error loading pricing', 'error');
            container.innerHTML = '<p>Error loading pricing</p>';
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
        container.innerHTML = '<p>Error loading pricing</p>';
    }
}

function displayPricing(pricing) {
    const container = document.getElementById('pricing-container');
    
    if (pricing.length === 0) {
        container.innerHTML = '<p>No pricing data found</p>';
        return;
    }
    
    container.innerHTML = '';
    
    pricing.forEach(item => {
        const pricingCard = document.createElement('div');
        pricingCard.className = 'booking-item';
        
        pricingCard.innerHTML = `
            <div class="booking-header">
                <div>
                    <h4>${item.slot_name}</h4>
                    <p><strong>Time:</strong> ${item.start_time} - ${item.end_time}</p>
                </div>
                <span class="booking-status status-${item.is_active ? 'confirmed' : 'rejected'}">
                    ${item.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
            </div>
            <p><strong>Current Price:</strong> ₹${item.base_price}/hour</p>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; align-items: center;">
                <input type="number" id="price-${item.id}" value="${item.base_price}" min="0" step="50" class="form-control" style="width: 150px;">
                <button onclick="updatePricing(${item.id})" class="btn btn-primary btn-sm">Update Price</button>
            </div>
        `;
        
        container.appendChild(pricingCard);
    });
}

async function updatePricing(pricingId) {
    const newPrice = document.getElementById(`price-${pricingId}`).value;
    
    if (!newPrice || newPrice <= 0) {
        showAlert('Please enter a valid price', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/pricing', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({ pricing_id: pricingId, base_price: parseFloat(newPrice) })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Price updated successfully!', 'success');
            loadPricingSection();
        } else {
            showAlert(data.error || 'Error updating price', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

// Notifications functions
async function loadNotifications() {
    const container = document.getElementById('notifications-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch('/api/admin/notifications', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const notifications = await response.json();
        
        if (response.ok) {
            displayNotifications(notifications);
        } else {
            showAlert('Error loading notifications', 'error');
            container.innerHTML = '<p>Error loading notifications</p>';
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
        container.innerHTML = '<p>Error loading notifications</p>';
    }
}

function displayNotifications(notifications) {
    const container = document.getElementById('notifications-container');
    
    if (notifications.length === 0) {
        container.innerHTML = '<p>No new notifications</p>';
        return;
    }
    
    container.innerHTML = '';
    
    notifications.forEach(notification => {
        const notificationCard = document.createElement('div');
        notificationCard.className = 'booking-item';
        
        notificationCard.innerHTML = `
            <div class="booking-header">
                <div>
                    <h4>${notification.notification_type.replace('_', ' ').toUpperCase()}</h4>
                    <p><strong>User:</strong> ${notification.user_name}</p>
                    <p><strong>Email:</strong> ${notification.email}</p>
                    <p><strong>Phone:</strong> ${notification.phone}</p>
                    ${notification.booking_date ? `<p><strong>Date:</strong> ${new Date(notification.booking_date).toLocaleDateString()}</p>` : ''}
                    ${notification.start_time ? `<p><strong>Time:</strong> ${notification.start_time} - ${notification.end_time}</p>` : ''}
                </div>
                <span class="booking-status status-pending">NEW</span>
            </div>
            <p><strong>Message:</strong> ${notification.message}</p>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button onclick="markNotificationRead(${notification.id})" class="btn btn-primary btn-sm">Mark as Read</button>
                ${notification.booking_id ? `<button onclick="viewBooking(${notification.booking_id})" class="btn btn-warning btn-sm">View Booking</button>` : ''}
            </div>
        `;
        
        container.appendChild(notificationCard);
    });
}

async function markNotificationRead(notificationId) {
    try {
        const response = await fetch(`/api/admin/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Notification marked as read', 'success');
            loadNotifications();
            loadDashboard();
        } else {
            showAlert(data.error || 'Error marking notification as read', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

async function markAllNotificationsRead() {
    try {
        const response = await fetch('/api/admin/notifications', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const notifications = await response.json();
        
        if (response.ok) {
            for (const notification of notifications) {
                await markNotificationRead(notification.id);
            }
        } else {
            showAlert('Error loading notifications', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

function viewBooking(bookingId) {
    showSection('bookings');
    // Implementation would filter to show specific booking
    showAlert(`Viewing booking #${bookingId}`, 'info');
}

// Payment Notifications functions
async function loadPaymentNotifications() {
    const container = document.getElementById('payment-notifications-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch('/api/admin/payment-notifications', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const notifications = await response.json();
        
        if (response.ok) {
            displayPaymentNotifications(notifications);
        } else {
            showAlert('Error loading payment notifications', 'error');
            container.innerHTML = '<p>Error loading payment notifications</p>';
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
        container.innerHTML = '<p>Error loading payment notifications</p>';
    }
}

function displayPaymentNotifications(notifications) {
    const container = document.getElementById('payment-notifications-container');
    
    if (notifications.length === 0) {
        container.innerHTML = '<p>No payment confirmations found</p>';
        return;
    }
    
    container.innerHTML = '';
    
    notifications.forEach(notification => {
        const notificationCard = document.createElement('div');
        notificationCard.className = 'booking-item';
        
        notificationCard.innerHTML = `
            <div class="booking-header">
                <div>
                    <h4>Payment Confirmation - Booking #${notification.booking_id}</h4>
                    <p><strong>Payment Method:</strong> ${notification.payment_method}</p>
                    ${notification.user_name ? `<p><strong>Customer:</strong> ${notification.user_name}</p>` : ''}
                    ${notification.email ? `<p><strong>Email:</strong> ${notification.email}</p>` : ''}
                    ${notification.phone ? `<p><strong>Phone:</strong> ${notification.phone}</p>` : ''}
                    <p><strong>Received:</strong> ${new Date(notification.created_at).toLocaleString()}</p>
                </div>
                <span class="booking-status status-${notification.is_read ? 'confirmed' : 'pending'}">
                    ${notification.is_read ? 'READ' : 'NEW'}
                </span>
            </div>
            <p><strong>Message:</strong> ${notification.message}</p>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                ${!notification.is_read ? `<button onclick="markPaymentNotificationRead(${notification.id})" class="btn btn-primary btn-sm">Mark as Read</button>` : ''}
                ${notification.booking_id ? `<button onclick="viewBooking(${notification.booking_id})" class="btn btn-warning btn-sm">View Booking</button>` : ''}
            </div>
        `;
        
        container.appendChild(notificationCard);
    });
}

async function markPaymentNotificationRead(notificationId) {
    try {
        const response = await fetch(`/api/admin/payment-notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Payment notification marked as read', 'success');
            loadPaymentNotifications();
            // Refresh dashboard to update badge count
            loadDashboard();
        } else {
            showAlert(data.error || 'Error marking payment notification as read', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

async function markAllPaymentNotificationsRead() {
    try {
        const response = await fetch('/api/admin/payment-notifications', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        const notifications = await response.json();
        
        if (response.ok) {
            for (const notification of notifications) {
                if (!notification.is_read) {
                    await markPaymentNotificationRead(notification.id);
                }
            }
            // Refresh dashboard to update badge count
            loadDashboard();
        } else {
            showAlert('Error loading payment notifications', 'error');
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

// Legacy booking functions
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
    
    content.innerHTML = `
        <form onsubmit="updateBooking(event, ${booking.id})">
            <div class="form-group">
                <label for="edit-date">Date</label>
                <input type="date" id="edit-date" class="form-control" value="${booking.booking_date}" required>
            </div>
            <div class="form-group">
                <label for="edit-start-time">Start Time</label>
                <input type="time" id="edit-start-time" class="form-control" value="${booking.start_time}" required>
            </div>
            <div class="form-group">
                <label for="edit-end-time">End Time</label>
                <input type="time" id="edit-end-time" class="form-control" value="${booking.end_time}" required>
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
    const start_time = document.getElementById('edit-start-time').value;
    const end_time = document.getElementById('edit-end-time').value;
    
    try {
        const response = await fetch(`/api/admin/bookings/${bookingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({ booking_date, start_time, end_time })
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

// Payment functions
async function showPaymentQR(bookingId) {
    const modal = document.getElementById('payment-modal');
    const content = document.getElementById('payment-content');
    
    content.innerHTML = `
        <div class="qr-container">
            <h3>Payment QR Code</h3>
            <div class="spinner"></div>
            <p class="mt-1">Share this QR code with customer for payment</p>
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

function closeCollisionModal() {
    document.getElementById('collision-modal').style.display = 'none';
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
    const collisionModal = document.getElementById('collision-modal');
    
    if (event.target === editModal) {
        editModal.style.display = 'none';
    }
    if (event.target === paymentModal) {
        paymentModal.style.display = 'none';
    }
    if (event.target === collisionModal) {
        collisionModal.style.display = 'none';
    }
}