// Configuration
const WORKER_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8787'
    : 'https://workerai.radilov-k.workers.dev';

// State
let appointments = [];
let clients = [];
let appointmentTypes = [];
let calendars = [];
let chatHistory = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    loadAllData();
    loadAppointmentTypes();
    loadCalendars();
    
    // Setup booking form
    document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
});

// Tab Management
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
}

// Data Loading Functions
async function loadAllData() {
    await Promise.all([
        loadAppointments(),
        loadClients(),
        loadAppointmentTypes()
    ]);
    updateDashboard();
}

async function loadAppointments() {
    try {
        // Try to load with default parameters from acuity-report
        const response = await fetch(`${WORKER_URL}/acuity?calendarID=12342518&appointmentTypeID=80052001`);
        if (response.ok) {
            appointments = await response.json();
            displayAppointments();
            updateDashboard();
        } else {
            console.error('Failed to load appointments:', response.statusText);
            showError('appointments-list', 'Не може да се заредят резервациите');
        }
    } catch (error) {
        console.error('Error loading appointments:', error);
        showError('appointments-list', 'Грешка при зареждане на резервациите');
    }
}

async function loadClients() {
    try {
        const response = await fetch(`${WORKER_URL}/acuity/clients`);
        if (response.ok) {
            clients = await response.json();
            displayClients();
            updateDashboard();
        } else {
            console.error('Failed to load clients:', response.statusText);
            showError('clients-list', 'Не може да се заредят клиентите');
        }
    } catch (error) {
        console.error('Error loading clients:', error);
        showError('clients-list', 'Грешка при зареждане на клиентите');
    }
}

async function loadAppointmentTypes() {
    try {
        const response = await fetch(`${WORKER_URL}/acuity/appointment-types`);
        if (response.ok) {
            appointmentTypes = await response.json();
            updateAppointmentTypeSelect();
            updateDashboard();
        } else {
            console.error('Failed to load appointment types');
        }
    } catch (error) {
        console.error('Error loading appointment types:', error);
    }
}

async function loadCalendars() {
    try {
        const response = await fetch(`${WORKER_URL}/acuity/calendars`);
        if (response.ok) {
            calendars = await response.json();
            updateCalendarSelect();
        } else {
            console.error('Failed to load calendars');
        }
    } catch (error) {
        console.error('Error loading calendars:', error);
    }
}

// Display Functions
function displayAppointments() {
    const container = document.getElementById('appointments-list');
    
    if (!appointments || appointments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>Няма намерени резервации</p>
            </div>
        `;
        return;
    }
    
    const sortedAppointments = [...appointments].sort((a, b) => 
        new Date(b.datetime) - new Date(a.datetime)
    );
    
    const html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Час</th>
                    <th>Клиент</th>
                    <th>Телефон</th>
                    <th>Тип</th>
                    <th>Статус</th>
                </tr>
            </thead>
            <tbody>
                ${sortedAppointments.map(apt => `
                    <tr>
                        <td>${apt.date || new Date(apt.datetime).toLocaleDateString('bg-BG')}</td>
                        <td>${apt.time || new Date(apt.datetime).toLocaleTimeString('bg-BG', {hour: '2-digit', minute: '2-digit'})}</td>
                        <td>${apt.firstName} ${apt.lastName}</td>
                        <td>${apt.phone || 'N/A'}</td>
                        <td>${apt.type || 'N/A'}</td>
                        <td><span class="status-badge status-${(apt.status || 'confirmed').toLowerCase()}">${apt.status || 'Confirmed'}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

function displayClients() {
    const container = document.getElementById('clients-list');
    
    if (!clients || clients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-times"></i>
                <p>Няма намерени клиенти</p>
            </div>
        `;
        return;
    }
    
    const html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Име</th>
                    <th>Имейл</th>
                    <th>Телефон</th>
                </tr>
            </thead>
            <tbody>
                ${clients.map(client => `
                    <tr>
                        <td>${client.firstName} ${client.lastName}</td>
                        <td>${client.email || 'N/A'}</td>
                        <td>${client.phone || 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

function updateDashboard() {
    // Update stats
    document.getElementById('stat-appointments').textContent = appointments.length;
    document.getElementById('stat-clients').textContent = clients.length;
    document.getElementById('stat-types').textContent = appointmentTypes.length;
    
    // Update upcoming appointments
    const upcomingContainer = document.getElementById('upcoming-appointments');
    const now = new Date();
    const upcoming = appointments
        .filter(apt => new Date(apt.datetime) > now)
        .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
        .slice(0, 5);
    
    if (upcoming.length === 0) {
        upcomingContainer.innerHTML = '<p style="color: #999; text-align: center;">Няма предстоящи резервации</p>';
    } else {
        upcomingContainer.innerHTML = `
            <table class="data-table">
                <tbody>
                    ${upcoming.map(apt => `
                        <tr>
                            <td>${apt.date || new Date(apt.datetime).toLocaleDateString('bg-BG')}</td>
                            <td>${apt.time || new Date(apt.datetime).toLocaleTimeString('bg-BG', {hour: '2-digit', minute: '2-digit'})}</td>
                            <td>${apt.firstName} ${apt.lastName}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function updateAppointmentTypeSelect() {
    const select = document.getElementById('appointmentTypeID');
    if (appointmentTypes.length === 0) {
        select.innerHTML = '<option value="">Няма налични типове</option>';
        return;
    }
    
    select.innerHTML = appointmentTypes.map(type => 
        `<option value="${type.id}">${type.name || type.type}</option>`
    ).join('');
}

function updateCalendarSelect() {
    const select = document.getElementById('calendarID');
    if (calendars.length === 0) {
        select.innerHTML = '<option value="">Няма налични календари</option>';
        return;
    }
    
    select.innerHTML = calendars.map(cal => 
        `<option value="${cal.id}">${cal.name || cal.email}</option>`
    ).join('');
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc3545;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <p>${message}</p>
        </div>
    `;
}

// Booking Form Handler
async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const formData = {
        appointmentTypeID: document.getElementById('appointmentTypeID').value,
        calendarID: document.getElementById('calendarID').value,
        datetime: document.getElementById('datetime').value,
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value
    };
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const result = await response.json();
            alert('Резервацията е създадена успешно!');
            document.getElementById('booking-form').reset();
            await loadAppointments();
            switchTab('appointments');
        } else {
            const error = await response.text();
            alert('Грешка при създаване на резервация: ' + error);
        }
    } catch (error) {
        console.error('Error creating booking:', error);
        alert('Грешка при създаване на резервация');
    }
}

// AI Chat Functions
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    const apiKey = document.getElementById('ai-api-key').value.trim();
    const provider = document.getElementById('ai-provider').value;
    
    if (!apiKey) {
        alert('Моля, въведете API ключ за AI модела');
        return;
    }
    
    // Add user message
    addMessage('user', message);
    input.value = '';
    
    // Disable send button
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="loading"></span>';
    
    try {
        // Prepare context for AI
        const context = prepareAIContext();
        
        // Call AI API
        const response = await callAI(provider, apiKey, message, context);
        
        // Add assistant response
        addMessage('assistant', response);
        
        // Check if AI wants to perform an action
        await handleAIActions(response);
        
    } catch (error) {
        console.error('AI Error:', error);
        addMessage('system', 'Грешка при комуникация с AI: ' + error.message);
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

function addMessage(type, content) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const labels = {
        user: 'Вие',
        assistant: 'AI Асистент',
        system: 'Система'
    };
    
    messageDiv.innerHTML = `
        <div class="label">${labels[type]}</div>
        ${content}
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Add to history
    chatHistory.push({ role: type === 'user' ? 'user' : 'assistant', content });
}

function prepareAIContext() {
    return {
        appointments: appointments.map(apt => ({
            date: apt.date,
            time: apt.time,
            client: `${apt.firstName} ${apt.lastName}`,
            phone: apt.phone,
            type: apt.type
        })),
        clients: clients.map(client => ({
            name: `${client.firstName} ${client.lastName}`,
            email: client.email,
            phone: client.phone
        })),
        appointmentTypes: appointmentTypes.map(type => ({
            id: type.id,
            name: type.name || type.type
        })),
        calendars: calendars.map(cal => ({
            id: cal.id,
            name: cal.name || cal.email
        }))
    };
}

async function callAI(provider, apiKey, message, context) {
    const systemPrompt = `Вие сте AI асистент за управление на Acuity Scheduling резервации. Имате достъп до следните данни:

Резервации: ${context.appointments.length} броя
Клиенти: ${context.clients.length} броя
Видове тренировки: ${context.appointmentTypes.map(t => t.name).join(', ')}
Календари: ${context.calendars.map(c => c.name).join(', ')}

Вашата задача е да помагате на потребителя с:
1. Преглед на резервации и клиенти
2. Създаване на нови резервации
3. Проверка на наличност
4. Търсене на информация

Когато потребителят иска да създаде резервация, отговорете с JSON обект в следния формат:
{"action": "create_booking", "data": {"firstName": "Иван", "lastName": "Петров", "phone": "+359...", "email": "...", "datetime": "2024-01-15T10:00", "appointmentTypeID": "...", "calendarID": "..."}}

Отговаряйте на български език. Бъдете полезни, учтиви и точни.`;

    if (provider === 'openai') {
        return await callOpenAI(apiKey, message, systemPrompt);
    } else {
        return await callGoogleAI(apiKey, message, systemPrompt);
    }
}

async function callOpenAI(apiKey, message, systemPrompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                ...chatHistory.slice(-10),
                { role: 'user', content: message }
            ],
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        throw new Error('OpenAI API error: ' + response.statusText);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGoogleAI(apiKey, message, systemPrompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\nПотребител: ${message}`
                }]
            }]
        })
    });
    
    if (!response.ok) {
        throw new Error('Google AI API error: ' + response.statusText);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function handleAIActions(response) {
    // Check if response contains action JSON
    const jsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (!jsonMatch) return;
    
    try {
        const action = JSON.parse(jsonMatch[0]);
        
        if (action.action === 'create_booking') {
            const confirmCreate = confirm('AI асистентът предлага да създаде резервация. Искате ли да продължите?');
            
            if (confirmCreate) {
                // Fill in the booking form
                document.getElementById('firstName').value = action.data.firstName || '';
                document.getElementById('lastName').value = action.data.lastName || '';
                document.getElementById('phone').value = action.data.phone || '';
                document.getElementById('email').value = action.data.email || '';
                document.getElementById('datetime').value = action.data.datetime || '';
                
                if (action.data.appointmentTypeID) {
                    document.getElementById('appointmentTypeID').value = action.data.appointmentTypeID;
                }
                if (action.data.calendarID) {
                    document.getElementById('calendarID').value = action.data.calendarID;
                }
                
                // Switch to booking tab
                switchTab('booking');
                
                addMessage('system', 'Формата за резервация е попълнена. Моля, проверете данните и натиснете "Създай резервация".');
            }
        }
    } catch (e) {
        // Not a valid action JSON, ignore
    }
}

// Export functions for HTML onclick handlers
window.loadAppointments = loadAppointments;
window.loadClients = loadClients;
window.sendMessage = sendMessage;
window.handleBookingSubmit = handleBookingSubmit;
