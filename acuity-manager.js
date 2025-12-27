// Configuration
const WORKER_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8787'
    : 'https://workerai.radilov-k.workers.dev';

// Default Acuity parameters (can be configured)
const DEFAULT_CONFIG = {
    calendarID: '12342518',
    appointmentTypeID: '80052001'
};

// AI System Prompt
const AI_SYSTEM_PROMPT = `Вие сте AI асистент за управление на Acuity Scheduling резервации. Имате достъп до следните данни:

Резервации: {appointments_count} броя
Клиенти: {clients_count} броя
Видове тренировки: {appointment_types}
Календари: {calendars}

Вашата задача е да помагате на потребителя с:
1. Преглед на резервации и клиенти
2. Създаване на нови резервации
3. Проверка на наличност
4. Търсене на информация

Когато потребителят иска да създаде резервация, отговорете с JSON обект в следния формат:
{"action": "create_booking", "data": {"firstName": "Иван", "lastName": "Петров", "phone": "+359...", "email": "...", "datetime": "2024-01-15T10:00", "appointmentTypeID": "...", "calendarID": "..."}}

Отговаряйте на български език. Бъдете полезни, учтиви и точни.`;

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
        // Try to load with default parameters from config
        const response = await fetch(`${WORKER_URL}/acuity?calendarID=${DEFAULT_CONFIG.calendarID}&appointmentTypeID=${DEFAULT_CONFIG.appointmentTypeID}`);
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
    
    // Get blocked clients
    const blockedClients = getBlockedClients();
    updateBlockedCount();
    
    const html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Име</th>
                    <th>Имейл</th>
                    <th>Телефон</th>
                    <th>Статус</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${clients.map(client => {
                    const isBlocked = blockedClients.includes(String(client.id));
                    return `
                        <tr style="${isBlocked ? 'background: #f8d7da;' : ''}">
                            <td>${client.id}</td>
                            <td>${client.firstName} ${client.lastName}</td>
                            <td>${client.email || 'N/A'}</td>
                            <td>${client.phone || 'N/A'}</td>
                            <td>
                                ${isBlocked ? '<span class="status-badge status-cancelled">Блокиран</span>' : '<span class="status-badge status-confirmed">Активен</span>'}
                            </td>
                            <td>
                                <button class="btn btn-primary btn-sm" onclick="viewClientDetails(${client.id})" style="padding: 5px 10px; font-size: 0.85rem;">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Client search and filter
let allClients = [];

function filterClients() {
    const searchTerm = document.getElementById('client-search').value.toLowerCase();
    
    if (!searchTerm) {
        displayClients();
        return;
    }
    
    const filtered = clients.filter(client => {
        const name = `${client.firstName} ${client.lastName}`.toLowerCase();
        const email = (client.email || '').toLowerCase();
        const phone = (client.phone || '').toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm) || phone.includes(searchTerm);
    });
    
    // Temporarily replace clients with filtered
    const originalClients = clients;
    clients = filtered;
    displayClients();
    clients = originalClients;
}

// Client Management Functions
async function searchClientById() {
    const clientId = document.getElementById('client-id-search').value;
    
    if (!clientId) {
        alert('Моля, въведете ID на клиент');
        return;
    }
    
    const client = clients.find(c => c.id == clientId);
    
    if (client) {
        displayClientDetails(client);
    } else {
        alert('Клиент с този ID не е намерен. Моля, презаредете списъка с клиенти.');
    }
}

function viewClientDetails(clientId) {
    const client = clients.find(c => c.id == clientId);
    if (client) {
        displayClientDetails(client);
        // Scroll to details
        document.getElementById('client-details').scrollIntoView({ behavior: 'smooth' });
    }
}

function displayClientDetails(client) {
    const container = document.getElementById('client-details');
    const blockedClients = getBlockedClients();
    const isBlocked = blockedClients.includes(String(client.id));
    
    const html = `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; ${isBlocked ? 'border: 2px solid #dc3545;' : ''}">
            <h4 style="color: #667eea; margin-bottom: 15px;">
                <i class="fas fa-user"></i> Детайли за клиент #${client.id}
                ${isBlocked ? '<span class="status-badge status-cancelled">БЛОКИРАН</span>' : ''}
            </h4>
            <div style="line-height: 2;">
                <p><strong>Име:</strong> ${client.firstName} ${client.lastName}</p>
                <p><strong>Email:</strong> ${client.email || 'N/A'}</p>
                <p><strong>Телефон:</strong> ${client.phone || 'N/A'}</p>
                <p><strong>Създаден:</strong> ${client.created ? new Date(client.created).toLocaleString('bg-BG') : 'N/A'}</p>
            </div>
            <div class="action-buttons" style="margin-top: 20px;">
                ${!isBlocked ? `
                    <button class="btn btn-warning" onclick="blockClient(${client.id})">
                        <i class="fas fa-ban"></i> Блокирай клиент
                    </button>
                ` : `
                    <button class="btn btn-success" onclick="unblockClient(${client.id})">
                        <i class="fas fa-check"></i> Отблокирай клиент
                    </button>
                `}
                <button class="btn btn-danger" onclick="deleteClient(${client.id})">
                    <i class="fas fa-trash"></i> Изтрий клиент
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Blocked Clients Management (using localStorage)
function getBlockedClients() {
    const blocked = localStorage.getItem('blockedClients');
    return blocked ? JSON.parse(blocked) : [];
}

function saveBlockedClients(blockedList) {
    localStorage.setItem('blockedClients', JSON.stringify(blockedList));
    updateBlockedCount();
}

function updateBlockedCount() {
    const count = getBlockedClients().length;
    const countElement = document.getElementById('blocked-count');
    if (countElement) {
        countElement.textContent = count;
    }
}

function blockClient(clientId) {
    const client = clients.find(c => c.id == clientId);
    
    if (!confirm(`Сигурни ли сте, че искате да блокирате ${client.firstName} ${client.lastName}?\n\nБлокираните клиенти няма да могат да правят нови резервации (трябва ръчно да откажете техните заявки).`)) {
        return;
    }
    
    const blockedClients = getBlockedClients();
    if (!blockedClients.includes(String(clientId))) {
        blockedClients.push(String(clientId));
        saveBlockedClients(blockedClients);
        alert(`Клиент ${client.firstName} ${client.lastName} е блокиран успешно!`);
        displayClientDetails(client);
        displayClients();
    } else {
        alert('Този клиент вече е блокиран');
    }
}

function unblockClient(clientId) {
    const client = clients.find(c => c.id == clientId);
    
    if (!confirm(`Искате ли да отблокирате ${client.firstName} ${client.lastName}?`)) {
        return;
    }
    
    let blockedClients = getBlockedClients();
    blockedClients = blockedClients.filter(id => id !== String(clientId));
    saveBlockedClients(blockedClients);
    alert(`Клиент ${client.firstName} ${client.lastName} е отблокиран успешно!`);
    displayClientDetails(client);
    displayClients();
}

function showBlockedClients() {
    const blockedClients = getBlockedClients();
    const container = document.getElementById('blocked-clients-list');
    
    if (blockedClients.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Няма блокирани клиенти</p>';
        return;
    }
    
    const blockedDetails = blockedClients.map(clientId => {
        const client = clients.find(c => String(c.id) === clientId);
        return client || { id: clientId, firstName: 'Неизвестен', lastName: '', email: 'N/A' };
    });
    
    const html = `
        <div style="margin-top: 15px; background: white; padding: 15px; border-radius: 8px;">
            <h4 style="margin-bottom: 15px; color: #856404;">Блокирани клиенти (${blockedClients.length})</h4>
            ${blockedDetails.map(client => `
                <div style="padding: 10px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${client.firstName} ${client.lastName}</strong>
                        <br><small style="color: #666;">${client.email}</small>
                    </div>
                    <button class="btn btn-success btn-sm" onclick="unblockClient(${client.id})">
                        <i class="fas fa-unlock"></i> Отблокирай
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    
    container.innerHTML = html;
}

async function deleteClient(clientId) {
    const client = clients.find(c => c.id == clientId);
    
    if (!confirm(`ВНИМАНИЕ! Това действие е необратимо!\n\nИскате ли да изтриете клиент ${client.firstName} ${client.lastName}?\n\nВсички негови резервации ще останат, но клиентът ще бъде премахнат от системата.`)) {
        return;
    }
    
    const finalConfirm = prompt(`Напишете "ИЗТРИЙ" за финално потвърждение:`);
    
    if (finalConfirm !== 'ИЗТРИЙ') {
        alert('Операцията е отказана');
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/clients/${clientId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Клиентът е изтрит успешно!');
            document.getElementById('client-details').innerHTML = '';
            await loadClients();
        } else {
            const error = await response.text();
            alert('Грешка при изтриване на клиента: ' + error);
        }
    } catch (error) {
        console.error('Error deleting client:', error);
        alert('Грешка при изтриване на клиента');
    }
}

// Quick Schedule Helper Functions
function showQuickScheduleHelper() {
    const helper = document.getElementById('quick-schedule-helper');
    helper.style.display = 'block';
    
    // Update calendar select
    const select = document.getElementById('schedule-helper-calendar');
    select.innerHTML = '<option value="">Избери календар...</option>' + 
        calendars.map(cal => `<option value="${cal.id}">${cal.name || cal.email}</option>`).join('');
    
    // Set default dates (today to 7 days from now)
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    document.getElementById('schedule-start-date').value = today.toISOString().split('T')[0];
    document.getElementById('schedule-end-date').value = nextWeek.toISOString().split('T')[0];
    
    // Handle preset change
    document.getElementById('schedule-preset').addEventListener('change', function() {
        const customHours = document.getElementById('custom-hours');
        customHours.style.display = this.value === 'custom' ? 'block' : 'none';
    });
}

function hideQuickScheduleHelper() {
    document.getElementById('quick-schedule-helper').style.display = 'none';
}

async function applyQuickSchedule() {
    const calendarId = document.getElementById('schedule-helper-calendar').value;
    const startDate = document.getElementById('schedule-start-date').value;
    const endDate = document.getElementById('schedule-end-date').value;
    const preset = document.getElementById('schedule-preset').value;
    const recurring = document.getElementById('schedule-recurring').checked;
    
    if (!calendarId || !startDate || !endDate) {
        alert('Моля, попълнете всички полета');
        return;
    }
    
    let fromTime, toTime;
    
    switch (preset) {
        case 'morning':
            fromTime = '00:00';
            toTime = '09:00';
            break;
        case 'evening':
            fromTime = '18:00';
            toTime = '23:59';
            break;
        case 'fullday':
            fromTime = '00:00';
            toTime = '23:59';
            break;
        case 'custom':
            fromTime = document.getElementById('schedule-from-time').value;
            toTime = document.getElementById('schedule-to-time').value;
            if (!fromTime || !toTime) {
                alert('Моля, задайте от и до час');
                return;
            }
            break;
    }
    
    if (!confirm(`Ще бъдат създадени блокове за календар ${calendarId} от ${startDate} до ${endDate}, ${fromTime}-${toTime}. Продължаваме?`)) {
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let success = 0;
    let failed = 0;
    
    if (recurring) {
        // Create blocks for each day
        const currentDate = new Date(start);
        while (currentDate <= end) {
            const blockStart = new Date(currentDate);
            blockStart.setHours(parseInt(fromTime.split(':')[0]), parseInt(fromTime.split(':')[1]), 0);
            
            const blockEnd = new Date(currentDate);
            blockEnd.setHours(parseInt(toTime.split(':')[0]), parseInt(toTime.split(':')[1]), 0);
            
            try {
                const response = await fetch(`${WORKER_URL}/acuity/blocks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        calendarID: calendarId,
                        start: blockStart.toISOString(),
                        end: blockEnd.toISOString(),
                        notes: 'Quick schedule helper block'
                    })
                });
                
                if (response.ok) {
                    success++;
                } else {
                    failed++;
                }
            } catch (error) {
                failed++;
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } else {
        // Create single block for entire period
        const blockStart = new Date(`${startDate}T${fromTime}:00`);
        const blockEnd = new Date(`${endDate}T${toTime}:00`);
        
        try {
            const response = await fetch(`${WORKER_URL}/acuity/blocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    calendarID: calendarId,
                    start: blockStart.toISOString(),
                    end: blockEnd.toISOString(),
                    notes: 'Quick schedule helper block'
                })
            });
            
            if (response.ok) {
                success = 1;
            } else {
                failed = 1;
            }
        } catch (error) {
            failed = 1;
        }
    }
    
    alert(`График приложен!\nУспешни: ${success}\nНеуспешни: ${failed}`);
    hideQuickScheduleHelper();
    await loadBlocks();
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
    const systemPrompt = AI_SYSTEM_PROMPT
        .replace('{appointments_count}', context.appointments.length)
        .replace('{clients_count}', context.clients.length)
        .replace('{appointment_types}', context.appointmentTypes.map(t => t.name).join(', '))
        .replace('{calendars}', context.calendars.map(c => c.name).join(', '));

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

// Calendar Management Functions
async function loadCalendarsManagement() {
    try {
        const response = await fetch(`${WORKER_URL}/acuity/calendars`);
        if (response.ok) {
            calendars = await response.json();
            displayCalendarsManagement();
            // Also update the calendar select in block form
            updateBlockCalendarSelect();
            // Update export calendar select
            updateExportCalendarSelect();
        } else {
            showError('calendars-management-list', 'Не може да се заредят календарите');
        }
    } catch (error) {
        console.error('Error loading calendars:', error);
        showError('calendars-management-list', 'Грешка при зареждане на календарите');
    }
}

function displayCalendarsManagement() {
    const container = document.getElementById('calendars-management-list');
    
    if (!calendars || calendars.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>Няма намерени календари</p>
            </div>
        `;
        return;
    }
    
    const html = calendars.map(cal => `
        <div class="calendar-item">
            <h4>
                <i class="fas fa-calendar"></i> ${cal.name || cal.email}
                <span class="calendar-status calendar-active">Активен</span>
            </h4>
            <p><strong>Email:</strong> ${cal.email || 'N/A'}</p>
            <p><strong>ID:</strong> ${cal.id}</p>
            <p><strong>Описание:</strong> ${cal.description || 'Няма описание'}</p>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="viewCalendarSchedule(${cal.id})">
                    <i class="fas fa-clock"></i> Виж работно време
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function updateBlockCalendarSelect() {
    const select = document.getElementById('block-calendarID');
    if (calendars.length === 0) {
        select.innerHTML = '<option value="">Няма налични календари</option>';
        return;
    }
    
    select.innerHTML = '<option value="">Избери календар...</option>' + 
        calendars.map(cal => `<option value="${cal.id}">${cal.name || cal.email}</option>`).join('');
}

function updateExportCalendarSelect() {
    const select = document.getElementById('export-calendarID');
    if (calendars.length === 0) {
        select.innerHTML = '<option value="">Няма налични календари</option>';
        return;
    }
    
    select.innerHTML = '<option value="">Всички календари</option>' + 
        calendars.map(cal => `<option value="${cal.id}">${cal.name || cal.email}</option>`).join('');
}

async function viewCalendarSchedule(calendarId) {
    const calendar = calendars.find(c => c.id === calendarId);
    alert(`График за ${calendar.name || calendar.email}:\n\nЗа детайлен преглед и редакция на работните часове, използвайте функцията за блокиране на часове или се свържете с Acuity support за промяна на основния график.`);
}

// Blocks Management Functions
async function loadBlocks() {
    try {
        const response = await fetch(`${WORKER_URL}/acuity/blocks`);
        if (response.ok) {
            const blocks = await response.json();
            displayBlocks(blocks);
        } else {
            showError('blocks-list', 'Не може да се заредят блокираните часове');
        }
    } catch (error) {
        console.error('Error loading blocks:', error);
        showError('blocks-list', 'Грешка при зареждане на блокираните часове');
    }
}

function displayBlocks(blocks) {
    const container = document.getElementById('blocks-list');
    
    if (!blocks || blocks.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Няма блокирани часове</p>';
        return;
    }
    
    const html = blocks.map(block => `
        <div class="block-item">
            <button class="btn btn-danger btn-sm delete-btn" onclick="deleteBlock(${block.id})">
                <i class="fas fa-trash"></i>
            </button>
            <p><strong>Календар:</strong> ${block.calendarID}</p>
            <p><strong>От:</strong> ${new Date(block.start).toLocaleString('bg-BG')}</p>
            <p><strong>До:</strong> ${new Date(block.end).toLocaleString('bg-BG')}</p>
            ${block.notes ? `<p><strong>Причина:</strong> ${block.notes}</p>` : ''}
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function createBlock(event) {
    event.preventDefault();
    
    const blockData = {
        calendarID: document.getElementById('block-calendarID').value,
        start: document.getElementById('block-start').value,
        end: document.getElementById('block-end').value,
        notes: document.getElementById('block-notes').value
    };
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/blocks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(blockData)
        });
        
        if (response.ok) {
            alert('Блокираният период е създаден успешно!');
            document.getElementById('block-form').reset();
            await loadBlocks();
        } else {
            const error = await response.text();
            alert('Грешка при създаване на блокиран период: ' + error);
        }
    } catch (error) {
        console.error('Error creating block:', error);
        alert('Грешка при създаване на блокиран период');
    }
}

async function deleteBlock(blockId) {
    if (!confirm('Сигурни ли сте, че искате да изтриете този блокиран период?')) {
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/blocks/${blockId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Блокираният период е изтрит успешно!');
            await loadBlocks();
        } else {
            alert('Грешка при изтриване на блокиран период');
        }
    } catch (error) {
        console.error('Error deleting block:', error);
        alert('Грешка при изтриване на блокиран период');
    }
}

// Export Functions
async function exportClients(format) {
    if (clients.length === 0) {
        await loadClients();
    }
    
    if (clients.length === 0) {
        alert('Няма данни за експорт');
        return;
    }
    
    if (format === 'csv') {
        exportClientsAsCSV();
    } else {
        exportClientsAsJSON();
    }
}

function exportClientsAsCSV() {
    // Create CSV header
    const headers = ['ID', 'Име', 'Фамилия', 'Email', 'Телефон'];
    const csvRows = [headers.join(',')];
    
    // Add data rows
    clients.forEach(client => {
        const row = [
            client.id || '',
            `"${client.firstName || ''}"`,
            `"${client.lastName || ''}"`,
            `"${client.email || ''}"`,
            `"${client.phone || ''}"`
        ];
        csvRows.push(row.join(','));
    });
    
    // Create and download file
    const csvContent = '\uFEFF' + csvRows.join('\n'); // UTF-8 BOM for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function exportClientsAsJSON() {
    const jsonContent = JSON.stringify(clients, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clients_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

async function exportAppointments(format) {
    if (appointments.length === 0) {
        await loadAppointments();
    }
    
    if (appointments.length === 0) {
        alert('Няма данни за експорт');
        return;
    }
    
    if (format === 'csv') {
        exportAppointmentsAsCSV();
    } else {
        exportAppointmentsAsJSON();
    }
}

function exportAppointmentsAsCSV() {
    const headers = ['ID', 'Дата', 'Час', 'Име', 'Фамилия', 'Телефон', 'Email', 'Тип', 'Статус'];
    const csvRows = [headers.join(',')];
    
    appointments.forEach(apt => {
        const row = [
            apt.id || '',
            `"${apt.date || new Date(apt.datetime).toLocaleDateString('bg-BG')}"`,
            `"${apt.time || new Date(apt.datetime).toLocaleTimeString('bg-BG')}"`,
            `"${apt.firstName || ''}"`,
            `"${apt.lastName || ''}"`,
            `"${apt.phone || ''}"`,
            `"${apt.email || ''}"`,
            `"${apt.type || ''}"`,
            `"${apt.status || 'Confirmed'}"`
        ];
        csvRows.push(row.join(','));
    });
    
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `appointments_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function exportAppointmentsAsJSON() {
    const jsonContent = JSON.stringify(appointments, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `appointments_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

async function exportAppointmentTypes(format) {
    if (appointmentTypes.length === 0) {
        await loadAppointmentTypes();
    }
    
    if (appointmentTypes.length === 0) {
        alert('Няма данни за експорт');
        return;
    }
    
    if (format === 'csv') {
        exportAppointmentTypesAsCSV();
    } else {
        exportAppointmentTypesAsJSON();
    }
}

function exportAppointmentTypesAsCSV() {
    const headers = ['ID', 'Име', 'Описание', 'Продължителност', 'Цена'];
    const csvRows = [headers.join(',')];
    
    appointmentTypes.forEach(type => {
        const row = [
            type.id || '',
            `"${type.name || type.type || ''}"`,
            `"${type.description || ''}"`,
            type.duration || '',
            type.price || ''
        ];
        csvRows.push(row.join(','));
    });
    
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `appointment_types_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function exportAppointmentTypesAsJSON() {
    const jsonContent = JSON.stringify(appointmentTypes, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `appointment_types_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

// Business Info Functions
async function loadBusinessInfo() {
    try {
        const response = await fetch(`${WORKER_URL}/acuity/business-info`);
        if (response.ok) {
            const businessInfo = await response.json();
            displayBusinessInfo(businessInfo);
        } else {
            showError('business-info', 'Не може да се зареди информацията за бизнеса');
        }
    } catch (error) {
        console.error('Error loading business info:', error);
        showError('business-info', 'Грешка при зареждане на информацията за бизнеса');
    }
}

function displayBusinessInfo(info) {
    const container = document.getElementById('business-info');
    
    const html = `
        <div style="line-height: 1.8;">
            <p><strong><i class="fas fa-building"></i> Име на бизнес:</strong> ${info.name || 'N/A'}</p>
            <p><strong><i class="fas fa-envelope"></i> Email:</strong> ${info.email || 'N/A'}</p>
            <p><strong><i class="fas fa-phone"></i> Телефон:</strong> ${info.phone || 'N/A'}</p>
            <p><strong><i class="fas fa-globe"></i> Уебсайт:</strong> ${info.website ? `<a href="${info.website}" target="_blank">${info.website}</a>` : 'N/A'}</p>
            <p><strong><i class="fas fa-map-marker-alt"></i> Адрес:</strong> ${info.address || 'N/A'}</p>
            <p><strong><i class="fas fa-clock"></i> Часова зона:</strong> ${info.timezone || 'N/A'}</p>
        </div>
    `;
    
    container.innerHTML = html;
}

// Appointment Management Functions
async function searchAppointmentById() {
    const appointmentId = document.getElementById('appointment-id-search').value;
    
    if (!appointmentId) {
        alert('Моля, въведете ID на резервация');
        return;
    }
    
    // Find appointment in loaded data first
    const appointment = appointments.find(apt => apt.id == appointmentId);
    
    if (appointment) {
        displayAppointmentDetails(appointment);
    } else {
        alert('Резервация с този ID не е намерена в заредените данни. Моля, презаредете списъка с резервации.');
    }
}

function displayAppointmentDetails(appointment) {
    const container = document.getElementById('appointment-details');
    
    const html = `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h4 style="color: #667eea; margin-bottom: 15px;">
                <i class="fas fa-info-circle"></i> Детайли за резервация #${appointment.id}
            </h4>
            <div style="line-height: 2;">
                <p><strong>Клиент:</strong> ${appointment.firstName} ${appointment.lastName}</p>
                <p><strong>Телефон:</strong> ${appointment.phone || 'N/A'}</p>
                <p><strong>Email:</strong> ${appointment.email || 'N/A'}</p>
                <p><strong>Дата:</strong> ${appointment.date || new Date(appointment.datetime).toLocaleDateString('bg-BG')}</p>
                <p><strong>Час:</strong> ${appointment.time || new Date(appointment.datetime).toLocaleTimeString('bg-BG')}</p>
                <p><strong>Тип:</strong> ${appointment.type || 'N/A'}</p>
                <p><strong>Статус:</strong> <span class="status-badge status-${(appointment.status || 'confirmed').toLowerCase()}">${appointment.status || 'Confirmed'}</span></p>
            </div>
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn btn-warning" onclick="rescheduleAppointment(${appointment.id})">
                    <i class="fas fa-calendar-alt"></i> Пренасрочи
                </button>
                <button class="btn btn-danger" onclick="cancelAppointment(${appointment.id})">
                    <i class="fas fa-times"></i> Отмени
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

async function cancelAppointment(appointmentId) {
    if (!confirm('Сигурни ли сте, че искате да отмените тази резервация?')) {
        return;
    }
    
    const reason = prompt('Причина за отмяна (опционално):');
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/appointments/${appointmentId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cancelNote: reason || 'Cancelled by manager' })
        });
        
        if (response.ok) {
            alert('Резервацията е отменена успешно!');
            document.getElementById('appointment-details').innerHTML = '';
            await loadAppointments();
        } else {
            const error = await response.text();
            alert('Грешка при отмяна на резервацията: ' + error);
        }
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        alert('Грешка при отмяна на резервацията');
    }
}

async function rescheduleAppointment(appointmentId) {
    const newDateTime = prompt('Нова дата и час (формат: YYYY-MM-DDTHH:MM):');
    
    if (!newDateTime) {
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ datetime: newDateTime })
        });
        
        if (response.ok) {
            alert('Резервацията е пренасрочена успешно!');
            document.getElementById('appointment-details').innerHTML = '';
            await loadAppointments();
        } else {
            const error = await response.text();
            alert('Грешка при пренасрочване на резервацията: ' + error);
        }
    } catch (error) {
        console.error('Error rescheduling appointment:', error);
        alert('Грешка при пренасрочване на резервацията');
    }
}

// Bulk Operations
let bulkAppointmentsToCancel = [];

async function previewBulkCancel() {
    const calendarID = document.getElementById('bulk-calendarID').value;
    const startDate = document.getElementById('bulk-start-date').value;
    const endDate = document.getElementById('bulk-end-date').value;
    
    if (!calendarID || !startDate || !endDate) {
        alert('Моля, попълнете всички полета');
        return;
    }
    
    // Filter appointments
    bulkAppointmentsToCancel = appointments.filter(apt => {
        const aptDate = new Date(apt.datetime).toISOString().split('T')[0];
        return apt.calendarID == calendarID && 
               aptDate >= startDate && 
               aptDate <= endDate &&
               apt.canceled !== true;
    });
    
    const container = document.getElementById('bulk-preview');
    
    if (bulkAppointmentsToCancel.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Няма намерени резервации за този период</p>';
        return;
    }
    
    const html = `
        <div style="background: #fff; padding: 15px; border-radius: 8px; border: 2px solid #ffc107;">
            <h4 style="color: #856404; margin-bottom: 15px;">
                <i class="fas fa-exclamation-triangle"></i> Намерени ${bulkAppointmentsToCancel.length} резервации
            </h4>
            <div style="max-height: 300px; overflow-y: auto;">
                ${bulkAppointmentsToCancel.map(apt => `
                    <div style="padding: 8px; border-bottom: 1px solid #e0e0e0;">
                        ${apt.date} ${apt.time} - ${apt.firstName} ${apt.lastName}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

async function executeBulkCancel() {
    if (bulkAppointmentsToCancel.length === 0) {
        alert('Моля, първо прегледайте резервациите за отмяна');
        return;
    }
    
    const confirmation = prompt(`ВНИМАНИЕ! Ще бъдат отменени ${bulkAppointmentsToCancel.length} резервации!\n\nНапишете "ОТМЕНИ" за потвърждение:`);
    
    if (confirmation !== 'ОТМЕНИ') {
        alert('Операцията е отказана');
        return;
    }
    
    let cancelled = 0;
    let failed = 0;
    
    for (const apt of bulkAppointmentsToCancel) {
        try {
            const response = await fetch(`${WORKER_URL}/acuity/appointments/${apt.id}/cancel`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cancelNote: 'Bulk cancellation by manager' })
            });
            
            if (response.ok) {
                cancelled++;
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    alert(`Операция завършена!\nОтменени: ${cancelled}\nНеуспешни: ${failed}`);
    
    bulkAppointmentsToCancel = [];
    document.getElementById('bulk-preview').innerHTML = '';
    await loadAppointments();
}

// Emergency Lockdown Functions
let lockdownBlocks = [];

async function activateLockdown() {
    const confirmed = document.getElementById('lockdown-confirm').checked;
    
    if (!confirmed) {
        alert('Моля, потвърдете че разбирате последствията преди да активирате Lockdown режим');
        return;
    }
    
    if (!confirm('ПОСЛЕДНА ПРОВЕРКА: Наистина ли искате да блокирате ВСИЧКИ календари за следващите 30 дни?')) {
        return;
    }
    
    const statusContainer = document.getElementById('lockdown-status');
    statusContainer.style.display = 'block';
    statusContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Активиране на Lockdown режим...</p>';
    
    // Load calendars if not loaded
    if (calendars.length === 0) {
        await loadCalendarsManagement();
    }
    
    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    lockdownBlocks = [];
    let success = 0;
    let failed = 0;
    
    for (const calendar of calendars) {
        try {
            const blockData = {
                calendarID: calendar.id,
                start: now.toISOString(),
                end: endDate.toISOString(),
                notes: 'EMERGENCY LOCKDOWN - Account security measure'
            };
            
            const response = await fetch(`${WORKER_URL}/acuity/blocks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(blockData)
            });
            
            if (response.ok) {
                const block = await response.json();
                lockdownBlocks.push(block);
                success++;
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    statusContainer.innerHTML = `
        <h4 style="color: white; margin-bottom: 10px;">✓ Lockdown режим активиран!</h4>
        <p>Блокирани календари: ${success}</p>
        <p>Неуспешни: ${failed}</p>
        <p style="margin-top: 10px;">Всички календари са блокирани за следващите 30 дни.</p>
        <p>Съществуващите резервации са запазени.</p>
    `;
    
    // Save lockdown blocks to localStorage for tracking
    localStorage.setItem('lockdownBlocks', JSON.stringify(lockdownBlocks.map(b => b.id)));
}

async function deactivateLockdown() {
    if (!confirm('Искате ли да деактивирате Lockdown режима и да възстановите достъпа за резервации?')) {
        return;
    }
    
    const statusContainer = document.getElementById('lockdown-status');
    statusContainer.style.display = 'block';
    statusContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Деактивиране на Lockdown режим...</p>';
    
    // Get lockdown blocks from localStorage
    const savedBlocks = JSON.parse(localStorage.getItem('lockdownBlocks') || '[]');
    
    if (savedBlocks.length === 0) {
        statusContainer.innerHTML = '<p style="color: #ffc107;">Няма активен Lockdown режим или блоковете не са запазени локално.</p>';
        return;
    }
    
    let success = 0;
    let failed = 0;
    
    for (const blockId of savedBlocks) {
        try {
            const response = await fetch(`${WORKER_URL}/acuity/blocks/${blockId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                success++;
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    statusContainer.innerHTML = `
        <h4 style="color: white; margin-bottom: 10px;">✓ Lockdown режим деактивиран!</h4>
        <p>Премахнати блокове: ${success}</p>
        <p>Неуспешни: ${failed}</p>
        <p style="margin-top: 10px;">Календарите са отново достъпни за резервации.</p>
    `;
    
    localStorage.removeItem('lockdownBlocks');
    lockdownBlocks = [];
}

// Initialize bulk calendar select when calendars are loaded
function updateBulkCalendarSelect() {
    const select = document.getElementById('bulk-calendarID');
    if (calendars.length === 0) {
        select.innerHTML = '<option value="">Няма налични календари</option>';
        return;
    }
    
    select.innerHTML = '<option value="">Избери календар...</option>' + 
        calendars.map(cal => `<option value="${cal.id}">${cal.name || cal.email}</option>`).join('');
}

// Update loadCalendarsManagement to also update bulk select
const originalLoadCalendarsManagement = loadCalendarsManagement;
loadCalendarsManagement = async function() {
    await originalLoadCalendarsManagement();
    updateBulkCalendarSelect();
};

// Export functions for HTML onclick handlers
window.loadAppointments = loadAppointments;
window.loadClients = loadClients;
window.sendMessage = sendMessage;
window.handleBookingSubmit = handleBookingSubmit;
window.loadCalendarsManagement = loadCalendarsManagement;
window.viewCalendarSchedule = viewCalendarSchedule;
window.loadBlocks = loadBlocks;
window.createBlock = createBlock;
window.deleteBlock = deleteBlock;
window.exportClients = exportClients;
window.exportAppointments = exportAppointments;
window.exportAppointmentTypes = exportAppointmentTypes;
window.loadBusinessInfo = loadBusinessInfo;
window.searchAppointmentById = searchAppointmentById;
window.cancelAppointment = cancelAppointment;
window.rescheduleAppointment = rescheduleAppointment;
window.previewBulkCancel = previewBulkCancel;
window.executeBulkCancel = executeBulkCancel;
window.activateLockdown = activateLockdown;
window.deactivateLockdown = deactivateLockdown;
window.filterClients = filterClients;
window.searchClientById = searchClientById;
window.viewClientDetails = viewClientDetails;
window.blockClient = blockClient;
window.unblockClient = unblockClient;
window.showBlockedClients = showBlockedClients;
window.deleteClient = deleteClient;
window.showQuickScheduleHelper = showQuickScheduleHelper;
window.hideQuickScheduleHelper = hideQuickScheduleHelper;
window.applyQuickSchedule = applyQuickSchedule;
