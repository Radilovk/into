// Client Portal Frontend JavaScript
// Backend API: https://workerai.radilov-k.workers.dev

const API_BASE = 'https://workerai.radilov-k.workers.dev';
let currentEmail = '';
let clientData = null;

// Show alert message
function showAlert(message, type = 'info') {
    const alertDiv = document.getElementById('alert');
    alertDiv.className = `alert alert-${type} show`;
    alertDiv.textContent = message;
    
    // Auto-hide after 5 seconds for success/info messages
    if (type !== 'error') {
        setTimeout(() => {
            alertDiv.classList.remove('show');
        }, 5000);
    }
}

// Show/hide loading state
function setLoading(isLoading) {
    document.getElementById('loading').classList.toggle('hidden', !isLoading);
}

// Format date and time
function formatDateTime(datetime) {
    const date = new Date(datetime);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    };
    return date.toLocaleDateString('bg-BG', options);
}

// Load client information
async function loadClientInfo() {
    const emailInput = document.getElementById('email');
    const email = emailInput.value.trim();
    
    if (!email) {
        showAlert('Моля, въведете имейл адрес', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert('Моля, въведете валиден имейл адрес', 'error');
        return;
    }
    
    currentEmail = email;
    setLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/api/me?email=${encodeURIComponent(email)}`);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Грешка при зареждане на информация');
        }
        
        if (result.success) {
            clientData = result.data;
            displayClientInfo();
            showAlert('Информацията е заредена успешно!', 'success');
        } else {
            throw new Error(result.message || 'Неуспешно зареждане');
        }
    } catch (error) {
        console.error('Error loading client info:', error);
        showAlert(error.message || 'Грешка при свързване със сървъра', 'error');
    } finally {
        setLoading(false);
    }
}

// Display client information
function displayClientInfo() {
    // Hide email section, show client sections
    document.getElementById('email-section').classList.add('hidden');
    document.getElementById('client-info-section').classList.remove('hidden');
    document.getElementById('upcoming-section').classList.remove('hidden');
    document.getElementById('past-section').classList.remove('hidden');
    document.getElementById('booking-section').classList.remove('hidden');
    
    // Display email
    document.getElementById('client-email').textContent = currentEmail;
    
    // Display balance
    const balanceEl = document.getElementById('client-balance');
    if (clientData.balance !== null && clientData.balance !== undefined) {
        balanceEl.textContent = clientData.balance;
        document.getElementById('balance-display').style.display = 'block';
    } else {
        balanceEl.textContent = 'Без активна карта';
        balanceEl.style.fontSize = '1.2em';
    }
    
    // Display booking status
    const statusEl = document.getElementById('booking-status');
    const rulesEl = document.getElementById('booking-rules');
    if (clientData.canBook) {
        statusEl.textContent = '✅ Можете да запазите час';
        statusEl.style.color = '#28a745';
        rulesEl.textContent = clientData.reason || 'Можете да запазите час.';
        document.getElementById('book-btn').disabled = false;
    } else {
        statusEl.textContent = '❌ ' + clientData.reason;
        statusEl.style.color = '#dc3545';
        rulesEl.textContent = clientData.reason;
        document.getElementById('book-btn').disabled = true;
    }
    
    // Display upcoming appointments
    displayUpcomingAppointments();
    
    // Display past appointments
    displayPastAppointments();
}

// Display upcoming appointments
function displayUpcomingAppointments() {
    const listEl = document.getElementById('upcoming-list');
    listEl.innerHTML = '';
    
    if (!clientData.upcomingAppointments || clientData.upcomingAppointments.length === 0) {
        listEl.innerHTML = '<div class="empty-state">📅 Нямате предстоящи резервации</div>';
        return;
    }
    
    clientData.upcomingAppointments.forEach(apt => {
        const li = document.createElement('li');
        li.className = 'appointment-item';
        
        li.innerHTML = `
            <div class="appointment-info">
                <div class="appointment-time">📅 ${formatDateTime(apt.datetime)}</div>
                <div class="appointment-type">${apt.type || 'Тренировка'} (${apt.duration} мин)</div>
            </div>
            <div class="appointment-actions">
                <button class="btn btn-danger" onclick="cancelAppointment(${apt.id})">
                    ❌ Отмени
                </button>
            </div>
        `;
        
        listEl.appendChild(li);
    });
}

// Display past appointments
function displayPastAppointments() {
    const listEl = document.getElementById('past-list');
    listEl.innerHTML = '';
    
    if (!clientData.pastAppointments || clientData.pastAppointments.length === 0) {
        listEl.innerHTML = '<div class="empty-state">📋 Нямате минали резервации</div>';
        return;
    }
    
    clientData.pastAppointments.forEach(apt => {
        const li = document.createElement('li');
        li.className = 'appointment-item';
        
        const status = apt.canceled ? '❌ Отменена' : '✅ Завършена';
        const statusColor = apt.canceled ? '#dc3545' : '#28a745';
        
        li.innerHTML = `
            <div class="appointment-info">
                <div class="appointment-time">📅 ${formatDateTime(apt.datetime)}</div>
                <div class="appointment-type">
                    ${apt.type || 'Тренировка'} 
                    <span style="color: ${statusColor}; font-weight: bold;">${status}</span>
                </div>
            </div>
        `;
        
        listEl.appendChild(li);
    });
}

// Book appointment
async function bookAppointment(event) {
    event.preventDefault();
    
    const appointmentTypeID = document.getElementById('appointmentTypeID').value;
    const datetime = document.getElementById('datetime').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const phone = document.getElementById('phone').value;
    
    if (!appointmentTypeID || !datetime) {
        showAlert('Моля, попълнете задължителните полета', 'error');
        return;
    }
    
    // Convert datetime-local to ISO format
    const isoDatetime = new Date(datetime).toISOString();
    
    setLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/api/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: currentEmail,
                appointmentTypeID: parseInt(appointmentTypeID),
                datetime: isoDatetime,
                timezone: 'Europe/Sofia',
                firstName,
                lastName,
                phone,
            }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Грешка при запазване на час');
        }
        
        if (result.success) {
            showAlert(result.message || 'Часът е запазен успешно!', 'success');
            
            // Reset form
            document.getElementById('booking-form').reset();
            
            // Reload client info
            setTimeout(() => loadClientInfo(), 1000);
        } else {
            throw new Error(result.message || 'Неуспешно запазване');
        }
    } catch (error) {
        console.error('Error booking appointment:', error);
        showAlert(error.message || 'Грешка при свързване със сървъра', 'error');
    } finally {
        setLoading(false);
    }
}

// Cancel appointment
async function cancelAppointment(appointmentID) {
    if (!confirm('Сигурни ли сте, че искате да отмените тази резервация?')) {
        return;
    }
    
    setLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/api/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: currentEmail,
                appointmentID: appointmentID,
            }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Грешка при отмяна на резервация');
        }
        
        if (result.success) {
            showAlert(result.message || 'Резервацията е отменена успешно!', 'success');
            
            // Reload client info
            setTimeout(() => loadClientInfo(), 1000);
        } else {
            throw new Error(result.message || 'Неуспешна отмяна');
        }
    } catch (error) {
        console.error('Error canceling appointment:', error);
        showAlert(error.message || 'Грешка при свързване със сървъра', 'error');
    } finally {
        setLoading(false);
    }
}

// Allow Enter key to submit email
document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadClientInfo();
        }
    });
});
