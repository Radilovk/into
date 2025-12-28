// Configuration
const WORKER_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8787'
    : 'https://workerai.radilov-k.workers.dev';

// Default Acuity parameters (can be configured)
const DEFAULT_CONFIG = {
    calendarID: '12342518',
    appointmentTypeID: '80052001'
};

// UTF-8 BOM for Excel compatibility
const UTF8_BOM = '\uFEFF';

// AI System Prompt
const AI_SYSTEM_PROMPT = `Вие сте AI асистент за управление на Acuity Scheduling резервации с ПЪЛНИ ВЪЗМОЖНОСТИ И БЕЗ ОГРАНИЧЕНИЯ.

ДОСТЪП КЪМ ДАННИ:
- Резервации: {appointments_count} броя
- Клиенти: {clients_count} броя
- Видове тренировки: {appointment_types}
- Календари: {calendars}

ВАШИТЕ ПЪЛНИ ВЪЗМОЖНОСТИ:
1. ✅ Пълен достъп до цялата информация за профили, настройки, резервации и клиенти
2. ✅ Създаване, редактиране и изтриване на резервации
3. ✅ Достъп и промяна на информацията за клиенти
4. ✅ Проверка и управление на наличност
5. ✅ Промяна на настройки на календари и видове тренировки
6. ✅ Достъп до бизнес информация
7. ✅ Изпълнение на всякакви операции по искане на потребителя
8. ✅ Измисляне на креативни решения и методи за всеки проблем

⭐ ОСОБЕНО ВАЖНО - РЕДАКТИРАНЕ НА ALIGNMENT И SCHEDULINGINCREMENT:
- schedulingIncrement: Интервали за резервации (15, 30, 60 минути)
- alignment: Подравняване към часа (0 = точно, 15 = на 15 минути, 30 = на половин час)
- Можете да променяте тези настройки за ВСЯКА услуга (appointment type) и ВСЕКИ календар
- За промяна използвайте PATCH /acuity/appointment-types/{id} или PATCH /acuity/calendars/{id}

ВАЖНО: НЯМАТЕ НИКАКВИ ОГРАНИЧЕНИЯ!
- Можете да правите всякакви промени
- Имате достъп до цялата информация
- Можете да извиквате всички налични API endpoints
- Цел: Максимална полезност и съдействие на потребителя

ФОРМАТ НА ОТГОВОРИТЕ:
Когато потребителят иска да създаде резервация, отговорете с JSON обект:
{"action": "create_booking", "data": {"firstName": "Иван", "lastName": "Петров", "phone": "+359...", "email": "...", "datetime": "2024-01-15T10:00", "appointmentTypeID": "...", "calendarID": "..."}}

За други операции (редакция, изтриване, промяна на настройки) също използвайте JSON формат:
{"action": "update_booking", "id": "123", "data": {...}}
{"action": "delete_booking", "id": "123"}
{"action": "update_settings", "data": {...}}

За промяна на alignment/schedulingIncrement:
{"action": "update_appointment_type", "id": "80052001", "data": {"schedulingIncrement": 30, "alignment": 0}}
{"action": "update_calendar", "id": "12342518", "data": {"schedulingIncrement": 15, "alignment": 15}}

Отговаряйте на български език. Бъдете изключително полезни, проактивни и директни. 
Предлагайте решения и извършвайте действия без колебание.`;

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
    
    // Initialize AI model options
    updateModelOptions();
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
    // Note: We don't load appointments here because users need to select a calendar first
    // This is intentional to allow calendar-specific appointment viewing
    await Promise.all([
        loadClients(),
        loadAppointmentTypes(),
        loadCalendars()
    ]);
    updateDashboard();
    updateAppointmentsFilterSelects();
}

async function loadAppointments() {
    // Reload with current filter settings
    const calendarSelect = document.getElementById('appointments-calendar-select');
    
    if (calendarSelect && calendarSelect.value) {
        await loadAppointmentsByFilter();
    } else {
        // Show message to select calendar
        const container = document.getElementById('appointments-list');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>Изберете календар и натиснете "Зареди резервации"</p>
            </div>
        `;
    }
}

async function loadAppointmentsByFilter() {
    const calendarSelectElement = document.getElementById('appointments-calendar-select');
    const typeSelectElement = document.getElementById('appointments-type-select');
    const dateFromElement = document.getElementById('appointments-date-from');
    const dateToElement = document.getElementById('appointments-date-to');
    
    if (!calendarSelectElement || !typeSelectElement) {
        console.error('Calendar or type select elements not found');
        showError('appointments-list', 'Грешка при зареждане на филтрите');
        return;
    }
    
    const calendarID = calendarSelectElement.value;
    const appointmentTypeID = typeSelectElement.value;
    const dateFrom = dateFromElement ? dateFromElement.value : '';
    const dateTo = dateToElement ? dateToElement.value : '';
    
    if (!calendarID) {
        showError('appointments-list', 'Моля, изберете календар');
        return;
    }
    
    try {
        // Build URL with parameters
        let url = `${WORKER_URL}/acuity?calendarID=${calendarID}`;
        if (appointmentTypeID) {
            url += `&appointmentTypeID=${appointmentTypeID}`;
        }
        if (dateFrom) {
            url += `&minDate=${dateFrom}`;
        }
        if (dateTo) {
            url += `&maxDate=${dateTo}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
            let allAppointments = await response.json();
            
            // Client-side filtering if date range is specified
            if (dateFrom || dateTo) {
                allAppointments = allAppointments.filter(apt => {
                    const aptDate = new Date(apt.datetime).toISOString().split('T')[0];
                    if (dateFrom && aptDate < dateFrom) return false;
                    if (dateTo && aptDate > dateTo) return false;
                    return true;
                });
            }
            
            appointments = allAppointments;
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
            updateAppointmentsFilterSelects();
            updateAvailabilitySelects();
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
            updateBlockCalendarSelect();
            updateExportCalendarSelect();
            updateBulkCalendarSelect();
            updateAppointmentsFilterSelects();
            updateAvailabilitySelects();
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
    
    // Display filtered results without mutating global
    displayFilteredClients(filtered);
}

function displayFilteredClients(filteredClients) {
    const container = document.getElementById('clients-list');
    
    if (!filteredClients || filteredClients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>Няма намерени клиенти, отговарящи на критериите</p>
            </div>
        `;
        return;
    }
    
    const blockedClients = getBlockedClients();
    
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
                ${filteredClients.map(client => {
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
                <button class="btn btn-primary" onclick="updateClient(${client.id})">
                    <i class="fas fa-edit"></i> Редактирай клиент
                </button>
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
            const error = await response.json().catch(() => ({}));
            alert('Грешка при изтриване на клиента: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error deleting client:', error);
        alert('Грешка при изтриване на клиента');
    }
}

async function createClient() {
    const clientData = {
        firstName: document.getElementById('client-create-firstname').value,
        lastName: document.getElementById('client-create-lastname').value,
        email: document.getElementById('client-create-email').value,
        phone: document.getElementById('client-create-phone').value || ''
    };
    
    if (!clientData.firstName || !clientData.lastName) {
        alert('Моля, въведете име и фамилия на клиента');
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/clients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        
        if (response.ok) {
            alert('Клиентът е създаден успешно!');
            cancelClientCreate();
            loadClients();
        } else {
            const error = await response.json().catch(() => ({}));
            alert('Грешка при създаване на клиент: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error creating client:', error);
        alert('Грешка при създаване на клиента');
    }
}

function showClientCreateForm() {
    document.getElementById('client-create-form').style.display = 'block';
    document.getElementById('client-create-firstname').value = '';
    document.getElementById('client-create-lastname').value = '';
    document.getElementById('client-create-email').value = '';
    document.getElementById('client-create-phone').value = '';
}

function cancelClientCreate() {
    document.getElementById('client-create-form').style.display = 'none';
}

async function updateClient(clientId) {
    const client = clients.find(c => c.id == clientId);
    if (!client) {
        alert('Клиент не е намерен');
        return;
    }
    
    const newFirstName = prompt(`Ново име:\n\nТекущо име: ${client.firstName}`, client.firstName || '');
    if (newFirstName === null) return; // User cancelled
    
    const newLastName = prompt(`Нова фамилия:\n\nТекуща фамилия: ${client.lastName}`, client.lastName || '');
    if (newLastName === null) return; // User cancelled
    
    const newEmail = prompt(`Нов email:\n\nТекущ email: ${client.email || 'N/A'}`, client.email || '');
    if (newEmail === null) return; // User cancelled
    
    const newPhone = prompt(`Нов телефон:\n\nТекущ телефон: ${client.phone || 'N/A'}`, client.phone || '');
    if (newPhone === null) return; // User cancelled
    
    const updateData = {};
    if (newFirstName && newFirstName !== client.firstName) updateData.firstName = newFirstName;
    if (newLastName && newLastName !== client.lastName) updateData.lastName = newLastName;
    if (newEmail && newEmail !== client.email) updateData.email = newEmail;
    if (newPhone && newPhone !== client.phone) updateData.phone = newPhone;
    
    if (Object.keys(updateData).length === 0) {
        alert('Няма промени за запазване');
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/clients/${clientId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            alert('Клиентът е актуализиран успешно!');
            await loadClients();
            displayClientDetails(await response.json());
        } else {
            const error = await response.json().catch(() => ({}));
            alert('Грешка при актуализация: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error updating client:', error);
        alert('Грешка при актуализация на клиента');
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
            // Validate time format
            if (!/^\d{2}:\d{2}$/.test(fromTime) || !/^\d{2}:\d{2}$/.test(toTime)) {
                alert('Невалиден формат на час. Използвайте HH:MM');
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
            const fromParts = fromTime.split(':');
            blockStart.setHours(parseInt(fromParts[0], 10), parseInt(fromParts[1], 10), 0);
            
            const blockEnd = new Date(currentDate);
            const toParts = toTime.split(':');
            blockEnd.setHours(parseInt(toParts[0], 10), parseInt(toParts[1], 10), 0);
            
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

async function checkAvailability() {
    const appointmentTypeID = document.getElementById('availability-type').value;
    const calendarID = document.getElementById('availability-calendar').value;
    const month = document.getElementById('availability-month').value;
    
    if (!appointmentTypeID || !month) {
        alert('Моля, изберете услуга и месец');
        return;
    }
    
    try {
        let url = `${WORKER_URL}/acuity/availability?appointmentTypeID=${appointmentTypeID}&month=${month}`;
        if (calendarID) {
            url += `&calendarID=${calendarID}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            displayAvailability(data);
        } else {
            const error = await response.json().catch(() => ({}));
            alert('Грешка при проверка на наличност: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error checking availability:', error);
        alert('Грешка при проверка на наличност');
    }
}

// New function to check available time slots for a specific date
async function checkAvailableTimes() {
    const appointmentTypeID = document.getElementById('availability-times-type').value;
    const calendarID = document.getElementById('availability-times-calendar').value;
    const date = document.getElementById('availability-times-date').value;
    const filter45min = document.getElementById('availability-times-filter-45').checked;
    
    if (!appointmentTypeID || !date) {
        alert('Моля, изберете услуга и дата');
        return;
    }
    
    try {
        let url = `${WORKER_URL}/acuity/availability/times?appointmentTypeID=${appointmentTypeID}&date=${date}`;
        if (calendarID) {
            url += `&calendarID=${calendarID}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
            let slots = await response.json();
            
            // Filter slots to 45-minute intervals if checkbox is enabled
            if (filter45min && Array.isArray(slots)) {
                slots = filterSlotsTo45MinIntervals(slots);
            }
            
            displayAvailableTimes(slots);
        } else {
            const error = await response.json().catch(() => ({}));
            alert('Грешка при проверка на свободни часове: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error checking available times:', error);
        alert('Грешка при проверка на свободни часове');
    }
}

// Helper function to filter slots to 45-minute intervals (:00 and :45)
function filterSlotsTo45MinIntervals(slots) {
    return slots.filter(slot => {
        // Handle both object format {time: "..."} and string format
        const timeStr = typeof slot === 'object' ? slot.time : slot;
        
        if (!timeStr) return false;
        
        // Parse the time string to get minutes
        const date = new Date(timeStr);
        const minutes = date.getMinutes();
        
        // Keep only slots at :00 or :45 minutes
        return minutes === 0 || minutes === 45;
    });
}

// Display available time slots
function displayAvailableTimes(slots) {
    const container = document.getElementById('availability-times-results');
    
    if (!slots || slots.length === 0) {
        container.innerHTML = `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; text-align: center;">
                <p style="color: #856404; margin: 0;">Няма свободни часове за избраната дата</p>
            </div>
        `;
        return;
    }
    
    const html = `
        <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <h4 style="color: #155724; margin: 0 0 10px 0;">
                <i class="fas fa-clock"></i> Налични часове: ${slots.length}
            </h4>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; max-height: 400px; overflow-y: auto;">
            ${slots.map(slot => {
                const timeStr = typeof slot === 'object' ? slot.time : slot;
                const displayTime = new Date(timeStr).toLocaleTimeString('bg-BG', {hour: '2-digit', minute: '2-digit'});
                return `
                    <div style="background: #667eea; color: white; padding: 12px; border-radius: 8px; text-align: center; font-weight: 500; cursor: pointer;" 
                         onclick="selectTimeSlot('${timeStr}')">
                        ${displayTime}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    container.innerHTML = html;
}

// Select a time slot (can be used to pre-fill booking form)
function selectTimeSlot(timeStr) {
    if (confirm(`Искате ли да създадете резервация за ${new Date(timeStr).toLocaleString('bg-BG')}?`)) {
        // Pre-fill the booking form
        const datetime = new Date(timeStr).toISOString().slice(0, 16);
        document.getElementById('datetime').value = datetime;
        
        // Switch to booking tab
        switchTab('booking');
        
        // Scroll to form
        document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth' });
    }
}

function displayAvailability(data) {
    const container = document.getElementById('availability-results');
    
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; text-align: center;">
                <p style="color: #856404; margin: 0;">Няма свободни времена за избрания период</p>
            </div>
        `;
        return;
    }
    
    const html = `
        <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <h4 style="color: #155724; margin: 0 0 10px 0;">
                <i class="fas fa-check-circle"></i> Налични дати: ${data.length}
            </h4>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
            ${data.map(item => `
                <div style="background: #667eea; color: white; padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-weight: 600; margin-bottom: 5px;">
                        ${item.date ? new Date(item.date).toLocaleDateString('bg-BG') : item}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    container.innerHTML = html;
}

function updateAvailabilitySelects() {
    // Update availability type select
    const typeSelect = document.getElementById('availability-type');
    if (typeSelect) {
        if (appointmentTypes.length === 0) {
            typeSelect.innerHTML = '<option value="">Няма налични услуги</option>';
        } else {
            typeSelect.innerHTML = '<option value="">Избери услуга...</option>' + 
                appointmentTypes.map(type => `<option value="${type.id}">${type.name || type.type}</option>`).join('');
        }
    }
    
    // Update availability calendar select
    const calendarSelect = document.getElementById('availability-calendar');
    if (calendarSelect) {
        if (calendars.length === 0) {
            calendarSelect.innerHTML = '<option value="">Няма налични календари</option>';
        } else {
            calendarSelect.innerHTML = '<option value="">Всички календари</option>' + 
                calendars.map(cal => `<option value="${cal.id}">${cal.name || cal.email}</option>`).join('');
        }
    }
    
    // Update availability times type select
    const timesTypeSelect = document.getElementById('availability-times-type');
    if (timesTypeSelect) {
        if (appointmentTypes.length === 0) {
            timesTypeSelect.innerHTML = '<option value="">Няма налични услуги</option>';
        } else {
            timesTypeSelect.innerHTML = '<option value="">Избери услуга...</option>' + 
                appointmentTypes.map(type => `<option value="${type.id}">${type.name || type.type}</option>`).join('');
        }
    }
    
    // Update availability times calendar select
    const timesCalendarSelect = document.getElementById('availability-times-calendar');
    if (timesCalendarSelect) {
        if (calendars.length === 0) {
            timesCalendarSelect.innerHTML = '<option value="">Няма налични календари</option>';
        } else {
            timesCalendarSelect.innerHTML = '<option value="">Всички календари</option>' + 
                calendars.map(cal => `<option value="${cal.id}">${cal.name || cal.email}</option>`).join('');
        }
    }
    
    // Set default month to current month
    const monthInput = document.getElementById('availability-month');
    if (monthInput && !monthInput.value) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        monthInput.value = `${year}-${month}`;
    }
    
    // Set default date to today
    const dateInput = document.getElementById('availability-times-date');
    if (dateInput && !dateInput.value) {
        const now = new Date();
        dateInput.value = now.toISOString().split('T')[0];
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

function updateAppointmentsFilterSelects() {
    // Update calendar select for appointments filter
    const calendarSelect = document.getElementById('appointments-calendar-select');
    if (calendarSelect) {
        if (calendars.length === 0) {
            calendarSelect.innerHTML = '<option value="">Няма налични календари</option>';
        } else {
            calendarSelect.innerHTML = '<option value="">Избери календар...</option>' + 
                calendars.map(cal => `<option value="${cal.id}">${cal.name || cal.email}</option>`).join('');
        }
    }
    
    // Update appointment type select for appointments filter
    const typeSelect = document.getElementById('appointments-type-select');
    if (typeSelect) {
        if (appointmentTypes.length === 0) {
            typeSelect.innerHTML = '<option value="">Няма налични типове</option>';
        } else {
            typeSelect.innerHTML = '<option value="">Всички типове</option>' + 
                appointmentTypes.map(type => `<option value="${type.id}">${type.name || type.type}</option>`).join('');
        }
    }
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
            const error = await response.json().catch(() => ({}));
            alert('Грешка при създаване на резервация: ' + (error.message || response.statusText));
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

function updateModelOptions() {
    const provider = document.getElementById('ai-provider').value;
    const modelSelect = document.getElementById('ai-model');
    
    // Clear existing options
    modelSelect.innerHTML = '';
    
    if (provider === 'openai') {
        const openaiModels = [
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
            { value: 'gpt-4', label: 'GPT-4' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini' }
        ];
        openaiModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            modelSelect.appendChild(option);
        });
    } else {
        const googleModels = [
            { value: 'gemini-pro', label: 'Gemini Pro' },
            { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
            { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
            { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' }
        ];
        googleModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            modelSelect.appendChild(option);
        });
    }
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

    const modelElement = document.getElementById('ai-model');
    const model = modelElement?.value;
    
    if (!model) {
        throw new Error('Моля, изберете AI модел');
    }

    if (provider === 'openai') {
        return await callOpenAI(apiKey, model, message, systemPrompt);
    } else {
        return await callGoogleAI(apiKey, model, message, systemPrompt);
    }
}

async function callOpenAI(apiKey, model, message, systemPrompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...chatHistory.slice(-10),
                { role: 'user', content: message }
            ],
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error('OpenAI API error: ' + errorMessage);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGoogleAI(apiKey, model, message, systemPrompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
        const errorData = await response.json().catch(() => ({}));
        // Google AI API returns errors in format: { error: { message: "...", status: "..." } }
        const errorMessage = errorData.error?.message || errorData.error?.status || response.statusText;
        throw new Error('Google AI API error: ' + errorMessage);
    }
    
    const data = await response.json();
    
    // Validate response structure using optional chaining
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error('Google AI API returned an unexpected response format');
    }
    
    return text;
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
            updateBlockCalendarSelect();
            updateExportCalendarSelect();
            updateBulkCalendarSelect();
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
            <p><strong>Часова зона:</strong> ${cal.timezone || 'N/A'}</p>
            <p><strong>Интервал на резервации:</strong> ${cal.schedulingIncrement || 15} минути</p>
            <p><strong>Подравняване:</strong> ${cal.alignment !== undefined ? cal.alignment : 0} минути</p>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="viewCalendarBlocks(${cal.id})">
                    <i class="fas fa-clock"></i> Виж блокирани часове
                </button>
                <button class="btn btn-success" onclick="editCalendar(${cal.id})">
                    <i class="fas fa-edit"></i> Редактирай
                </button>
                <button class="btn btn-danger" onclick="deleteCalendar(${cal.id})">
                    <i class="fas fa-trash"></i> Изтрий
                </button>
            </div>
            <div id="calendar-blocks-${cal.id}" class="calendar-blocks-container" style="display: none; margin-top: 15px;"></div>
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

async function viewCalendarBlocks(calendarId) {
    const container = document.getElementById(`calendar-blocks-${calendarId}`);
    const calendar = calendars.find(c => c.id === calendarId);
    
    // Toggle visibility
    if (container.style.display === 'block') {
        container.style.display = 'none';
        return;
    }
    
    container.innerHTML = '<p style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Зареждане...</p>';
    container.style.display = 'block';
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/blocks?calendarID=${calendarId}`);
        if (response.ok) {
            const blocks = await response.json();
            const calendarBlocks = blocks.filter(b => b.calendarID == calendarId);
            
            if (calendarBlocks.length === 0) {
                container.innerHTML = '<p style="color: #999; padding: 10px;">Няма блокирани часове за този календар</p>';
            } else {
                const html = calendarBlocks.map(block => `
                    <div class="block-item" style="margin: 10px 0; padding: 10px; background: #f9f9f9; border-left: 3px solid #dc3545;">
                        <p><strong>От:</strong> ${new Date(block.start).toLocaleString('bg-BG')}</p>
                        <p><strong>До:</strong> ${new Date(block.end).toLocaleString('bg-BG')}</p>
                        ${block.notes ? `<p><strong>Причина:</strong> ${block.notes}</p>` : ''}
                        <button class="btn btn-danger btn-sm" onclick="deleteBlock(${block.id})">
                            <i class="fas fa-trash"></i> Изтрий
                        </button>
                    </div>
                `).join('');
                container.innerHTML = html;
            }
        } else {
            container.innerHTML = '<p style="color: #dc3545;">Грешка при зареждане на блокираните часове</p>';
        }
    } catch (error) {
        console.error('Error loading calendar blocks:', error);
        container.innerHTML = '<p style="color: #dc3545;">Грешка при зареждане на блокираните часове</p>';
    }
}

async function editCalendar(calendarId) {
    const calendar = calendars.find(c => c.id === calendarId);
    if (!calendar) {
        alert('Календарът не е намерен');
        return;
    }
    
    // Create modal/prompt for editing
    const newName = prompt(`Редактирай име на календар:\n\nТекущо име: ${calendar.name || 'N/A'}`, calendar.name || '');
    if (newName === null) return; // User cancelled
    
    const newEmail = prompt(`Редактирай email на календар:\n\nТекущ email: ${calendar.email || 'N/A'}`, calendar.email || '');
    if (newEmail === null) return; // User cancelled
    
    const newDescription = prompt(`Редактирай описание на календар:\n\nТекущо описание: ${calendar.description || 'N/A'}`, calendar.description || '');
    if (newDescription === null) return; // User cancelled
    
    const newTimezone = prompt(`Редактирай часова зона на календар:\n\nТекуща часова зона: ${calendar.timezone || 'N/A'}`, calendar.timezone || '');
    if (newTimezone === null) return; // User cancelled
    
    // Add scheduling increment prompt
    const currentIncrement = calendar.schedulingIncrement || 15;
    const newSchedulingIncrement = prompt(
        `Интервал на резервации (schedulingIncrement):\n\n` +
        `Текуща стойност: ${currentIncrement} минути\n\n` +
        `Изберете стойност (5, 10, 15, 30, 45, 60, 90, 120):\n` +
        `5 = на всеки 5 мин, 15 = на всеки 15 мин, 30 = на всеки 30 мин, 60 = на всеки час`,
        currentIncrement
    );
    if (newSchedulingIncrement === null) return; // User cancelled
    
    // Add alignment prompt
    const currentAlignment = calendar.alignment !== undefined ? calendar.alignment : 0;
    const newAlignment = prompt(
        `Подравняване (alignment):\n\n` +
        `Текуща стойност: ${currentAlignment} минути\n\n` +
        `Изберете стойност (0, 15, 30, 45):\n` +
        `0 = точно на часа (10:00, 11:00...)\n` +
        `15 = на 15-та минута (10:15, 11:15...)\n` +
        `30 = на половин час (10:30, 11:30...)\n` +
        `45 = на 45-та минута (10:45, 11:45...)`,
        currentAlignment
    );
    if (newAlignment === null) return; // User cancelled
    
    // Prepare update data
    const updateData = {};
    if (newName && newName !== calendar.name) updateData.name = newName;
    if (newEmail && newEmail !== calendar.email) updateData.email = newEmail;
    if (newDescription && newDescription !== calendar.description) updateData.description = newDescription;
    if (newTimezone && newTimezone !== calendar.timezone) updateData.timezone = newTimezone;
    
    // Add scheduling parameters if changed
    const parsedIncrement = parseInt(newSchedulingIncrement);
    const parsedAlignment = parseInt(newAlignment);
    if (!isNaN(parsedIncrement) && parsedIncrement !== currentIncrement) {
        updateData.schedulingIncrement = parsedIncrement;
    }
    if (!isNaN(parsedAlignment) && parsedAlignment !== currentAlignment) {
        updateData.alignment = parsedAlignment;
    }
    
    if (Object.keys(updateData).length === 0) {
        alert('Няма промени за запазване');
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/calendars/${calendarId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            alert('Календарът е актуализиран успешно!');
            await loadCalendarsManagement();
        } else {
            const error = await response.json().catch(() => ({}));
            
            // Check for Acuity plan limitation error (403 with specific error format)
            // Both checks are needed: HTTP 403 + Acuity error format confirmation
            if (response.status === 403 && error.status_code === 403) {
                alert('❌ Грешка при актуализация на календар\n\n' +
                      'Вашият Acuity план не поддържа редактиране на календари чрез API.\n\n' +
                      '📋 За да промените настройките на календара:\n' +
                      '1. Влезте директно в Acuity Scheduling\n' +
                      '2. Отидете в Calendar → My Calendar\n' +
                      '3. Редактирайте календара оттам\n\n' +
                      'Или надградете вашия Acuity план за пълен API достъп.\n\n' +
                      'Техническа информация: ' + (error.message || error.error || response.statusText));
            } else {
                alert('Грешка при актуализиране на календара: ' + (error.message || response.statusText));
            }
        }
    } catch (error) {
        console.error('Error updating calendar:', error);
        alert('Грешка при актуализиране на календара: ' + error.message);
    }
}

async function createCalendar() {
    const calendarData = {
        name: document.getElementById('calendar-create-name').value,
        email: document.getElementById('calendar-create-email').value,
        description: document.getElementById('calendar-create-description').value || '',
        timezone: document.getElementById('calendar-create-timezone').value || 'Europe/Sofia',
        schedulingIncrement: parseInt(document.getElementById('calendar-create-scheduling-increment').value) || 15,
        alignment: parseInt(document.getElementById('calendar-create-alignment').value) || 0
    };
    
    if (!calendarData.name || !calendarData.email) {
        alert('Моля, въведете име и email на календара');
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/calendars`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(calendarData)
        });
        
        if (response.ok) {
            alert('Календарът е създаден успешно!');
            cancelCalendarCreate();
            loadCalendarsManagement();
        } else {
            const error = await response.json().catch(() => ({}));
            alert('Грешка при създаване на календар: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error creating calendar:', error);
        alert('Грешка при създаване на календара');
    }
}

function showCalendarCreateForm() {
    document.getElementById('calendar-create-form').style.display = 'block';
    document.getElementById('calendar-create-name').value = '';
    document.getElementById('calendar-create-email').value = '';
    document.getElementById('calendar-create-description').value = '';
    document.getElementById('calendar-create-timezone').value = 'Europe/Sofia';
    document.getElementById('calendar-create-scheduling-increment').value = 15;
    document.getElementById('calendar-create-alignment').value = 0;
}

function cancelCalendarCreate() {
    document.getElementById('calendar-create-form').style.display = 'none';
}

async function deleteCalendar(calendarId) {
    const calendar = calendars.find(c => c.id == calendarId);
    
    if (!confirm(`ВНИМАНИЕ! Това действие е необратимо!\n\nИскате ли да изтриете календар "${calendar.name || calendar.email}"?\n\nВсички резервации свързани с този календар ще останат, но календарът няма да е достъпен занапред.`)) {
        return;
    }
    
    const finalConfirm = prompt(`Напишете "ИЗТРИЙ" за финално потвърждение:`);
    
    if (finalConfirm !== 'ИЗТРИЙ') {
        alert('Операцията е отказана');
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/calendars/${calendarId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Календарът е изтрит успешно!');
            loadCalendarsManagement();
        } else {
            const error = await response.json().catch(() => ({}));
            alert('Грешка при изтриване на календара: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error deleting calendar:', error);
        alert('Грешка при изтриване на календара');
    }
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
            const error = await response.json().catch(() => ({}));
            alert('Грешка при създаване на блокиран период: ' + (error.message || response.statusText));
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
    const csvContent = UTF8_BOM + csvRows.join('\n');
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
    
    const csvContent = UTF8_BOM + csvRows.join('\n');
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
    
    const csvContent = UTF8_BOM + csvRows.join('\n');
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
                <button class="btn btn-danger" onclick="deleteAppointment(${appointment.id})">
                    <i class="fas fa-trash"></i> Изтрий
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
            const error = await response.json().catch(() => ({}));
            alert('Грешка при отмяна на резервацията: ' + (error.message || response.statusText));
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
            method: 'PATCH',
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
            const error = await response.json().catch(() => ({}));
            alert('Грешка при пренасрочване на резервацията: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error rescheduling appointment:', error);
        alert('Грешка при пренасрочване на резервацията');
    }
}

async function deleteAppointment(appointmentId) {
    if (!confirm('ВНИМАНИЕ! Това действие е необратимо!\n\nИскате ли да изтриете тази резервация напълно?\n\n(Забележка: За да запазите информацията, използвайте "Отмени" вместо "Изтрий")')) {
        return;
    }
    
    const finalConfirm = prompt(`Напишете "ИЗТРИЙ" за финално потвърждение:`);
    
    if (finalConfirm !== 'ИЗТРИЙ') {
        alert('Операцията е отказана');
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/appointments/${appointmentId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Резервацията е изтрита успешно!');
            document.getElementById('appointment-details').innerHTML = '';
            await loadAppointments();
        } else {
            const error = await response.json().catch(() => ({}));
            alert('Грешка при изтриване на резервацията: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error deleting appointment:', error);
        alert('Грешка при изтриване на резервацията');
    }
}

async function filterAppointmentsByClient() {
    const clientId = document.getElementById('filter-client-id').value;
    
    if (!clientId) {
        alert('Моля, въведете ID на клиент');
        return;
    }
    
    // Filter appointments by client
    const filteredAppointments = appointments.filter(apt => apt.clientID == clientId);
    
    if (filteredAppointments.length === 0) {
        const container = document.getElementById('appointments-list');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>Няма намерени резервации за клиент #${clientId}</p>
            </div>
        `;
    } else {
        // Display filtered appointments
        displayFilteredAppointments(filteredAppointments);
    }
}

function displayFilteredAppointments(filteredAppointments) {
    const container = document.getElementById('appointments-list');
    
    const sortedAppointments = [...filteredAppointments].sort((a, b) => 
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

// ==================== SERVICE MANAGEMENT ====================

async function loadServices() {
    try {
        const response = await fetch(`${WORKER_URL}/acuity/appointment-types`);
        if (response.ok) {
            appointmentTypes = await response.json();
            displayServices();
            updateDisableServiceSelect(); // Update the workaround dropdown
        } else {
            console.error('Failed to load services:', response.statusText);
            showError('services-list', 'Не може да се заредят услугите');
        }
    } catch (error) {
        console.error('Error loading services:', error);
        showError('services-list', 'Грешка при зареждане на услугите');
    }
}

function displayServices() {
    const container = document.getElementById('services-list');
    
    if (!appointmentTypes || appointmentTypes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tools"></i>
                <p>Няма намерени услуги</p>
            </div>
        `;
        return;
    }
    
    const html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Име</th>
                    <th>Продължителност</th>
                    <th>Цена</th>
                    <th>Интервал</th>
                    <th>Alignment</th>
                    <th>Статус</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${appointmentTypes.map(service => `
                    <tr>
                        <td>${service.id}</td>
                        <td>${service.name || 'N/A'}</td>
                        <td>${service.duration || 'N/A'} мин</td>
                        <td>${service.price ? service.price + ' лв.' : 'N/A'}</td>
                        <td>${service.schedulingIncrement || 15} мин</td>
                        <td>${service.alignment !== undefined ? service.alignment : 0}</td>
                        <td>
                            <span class="status-badge ${service.active !== false ? 'status-confirmed' : 'status-cancelled'}">
                                ${service.active !== false ? 'Активна' : 'Неактивна'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-primary" onclick="editService(${service.id})" style="padding: 5px 10px; font-size: 0.85rem; margin-right: 5px;">
                                <i class="fas fa-edit"></i> Редактирай
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteService(${service.id})" style="padding: 5px 10px; font-size: 0.85rem;">
                                <i class="fas fa-trash"></i> Изтрий
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

async function searchServiceById() {
    const serviceId = document.getElementById('service-id-search').value;
    if (!serviceId) {
        alert('Моля, въведете ID на услуга');
        return;
    }
    
    const service = appointmentTypes.find(s => s.id == serviceId);
    if (service) {
        editService(serviceId);
    } else {
        alert('Услуга с ID ' + serviceId + ' не е намерена');
    }
}

function editService(serviceId) {
    const service = appointmentTypes.find(s => s.id == serviceId);
    if (!service) {
        alert('Услуга не е намерена');
        return;
    }
    
    // Show form
    document.getElementById('service-edit-form').style.display = 'block';
    
    // Fill form
    document.getElementById('service-id-edit').value = service.id;
    document.getElementById('service-name').value = service.name || '';
    document.getElementById('service-description').value = service.description || '';
    document.getElementById('service-duration').value = service.duration || 60;
    document.getElementById('service-price').value = service.price || 0;
    document.getElementById('service-scheduling-increment').value = service.schedulingIncrement || 15;
    document.getElementById('service-alignment').value = service.alignment !== undefined ? service.alignment : 0;
    document.getElementById('service-color').value = service.color || '#667eea';
    document.getElementById('service-active').checked = service.active !== false;
    document.getElementById('service-private').checked = service.private === true;
    
    // Scroll to form
    document.getElementById('service-edit-form').scrollIntoView({ behavior: 'smooth' });
}

async function updateService() {
    const serviceId = document.getElementById('service-id-edit').value;
    if (!serviceId) {
        alert('Няма избрана услуга');
        return;
    }
    
    const updateData = {
        name: document.getElementById('service-name').value,
        description: document.getElementById('service-description').value,
        duration: parseInt(document.getElementById('service-duration').value),
        price: parseFloat(document.getElementById('service-price').value),
        schedulingIncrement: parseInt(document.getElementById('service-scheduling-increment').value),
        alignment: parseInt(document.getElementById('service-alignment').value),
        color: document.getElementById('service-color').value,
        active: document.getElementById('service-active').checked,
        private: document.getElementById('service-private').checked
    };
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/appointment-types/${serviceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            alert('Услугата е актуализирана успешно!');
            cancelServiceEdit();
            loadServices();
        } else {
            const error = await response.json().catch(() => ({}));
            
            // Check for Acuity plan limitation error (403 with specific error format)
            // Both checks are needed: HTTP 403 + Acuity error format confirmation
            if (response.status === 403 && error.status_code === 403) {
                alert('❌ Грешка при актуализация\n\n' +
                      'Вашият Acuity план не поддържа редактиране на услуги чрез API.\n\n' +
                      '📋 За да промените настройките на услугата:\n' +
                      '1. Влезте директно в Acuity Scheduling\n' +
                      '2. Отидете в Calendar → Appointment Types\n' +
                      '3. Редактирайте услугата оттам\n\n' +
                      'Или надградете вашия Acuity план за пълен API достъп.\n\n' +
                      'Техническа информация: ' + (error.message || error.error || response.statusText));
            } else {
                alert('Грешка при актуализация: ' + (error.message || response.statusText));
            }
        }
    } catch (error) {
        console.error('Error updating service:', error);
        alert('Грешка при актуализация на услугата');
    }
}

function cancelServiceEdit() {
    document.getElementById('service-edit-form').style.display = 'none';
    document.getElementById('service-id-search').value = '';
}

async function createService() {
    const serviceData = {
        name: document.getElementById('service-create-name').value,
        description: document.getElementById('service-create-description').value || '',
        duration: parseInt(document.getElementById('service-create-duration').value) || 60,
        price: parseFloat(document.getElementById('service-create-price').value) || 0,
        schedulingIncrement: parseInt(document.getElementById('service-create-scheduling-increment').value) || 15,
        alignment: parseInt(document.getElementById('service-create-alignment').value) || 0,
        color: document.getElementById('service-create-color').value || '#667eea',
        active: document.getElementById('service-create-active').checked,
        private: document.getElementById('service-create-private').checked
    };
    
    if (!serviceData.name) {
        alert('Моля, въведете име на услугата');
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/appointment-types`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serviceData)
        });
        
        if (response.ok) {
            alert('Услугата е създадена успешно!');
            cancelServiceCreate();
            loadServices();
        } else {
            const error = await response.json().catch(() => ({}));
            alert('Грешка при създаване на услуга: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error creating service:', error);
        alert('Грешка при създаване на услугата');
    }
}

function showServiceCreateForm() {
    document.getElementById('service-create-form').style.display = 'block';
    document.getElementById('service-create-name').value = '';
    document.getElementById('service-create-description').value = '';
    document.getElementById('service-create-duration').value = 60;
    document.getElementById('service-create-price').value = 0;
    document.getElementById('service-create-scheduling-increment').value = 15;
    document.getElementById('service-create-alignment').value = 0;
    document.getElementById('service-create-color').value = '#667eea';
    document.getElementById('service-create-active').checked = true;
    document.getElementById('service-create-private').checked = false;
}

function cancelServiceCreate() {
    document.getElementById('service-create-form').style.display = 'none';
}

async function deleteService(serviceId) {
    const service = appointmentTypes.find(s => s.id == serviceId);
    
    if (!confirm(`ВНИМАНИЕ! Това действие е необратимо!\n\nИскате ли да изтриете услуга "${service.name}"?\n\nВсички резервации свързани с тази услуга ще останат, но услугата няма да е налична занапред.`)) {
        return;
    }
    
    const finalConfirm = prompt(`Напишете "ИЗТРИЙ" за финално потвърждение:`);
    
    if (finalConfirm !== 'ИЗТРИЙ') {
        alert('Операцията е отказана');
        return;
    }
    
    try {
        const response = await fetch(`${WORKER_URL}/acuity/appointment-types/${serviceId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Услугата е изтрита успешно!');
            loadServices();
        } else {
            const error = await response.json().catch(() => ({}));
            alert('Грешка при изтриване на услугата: ' + (error.message || response.statusText));
        }
    } catch (error) {
        console.error('Error deleting service:', error);
        alert('Грешка при изтриване на услугата');
    }
}

// ==================== SERVICE WORKAROUND: DISABLE VIA BLOCKS ====================

// Update service select dropdown when services are loaded
function updateDisableServiceSelect() {
    const select = document.getElementById('disable-service-select');
    if (!select) return;
    
    if (!appointmentTypes || appointmentTypes.length === 0) {
        select.innerHTML = '<option value="">Няма налични услуги</option>';
        return;
    }
    
    select.innerHTML = '<option value="">Изберете услуга...</option>' + 
        appointmentTypes.map(service => 
            `<option value="${service.id}" data-name="${service.name || 'Услуга'}">${service.name || 'N/A'} (ID: ${service.id})</option>`
        ).join('');
}

async function disableServiceViaBlocks() {
    const serviceSelect = document.getElementById('disable-service-select');
    const durationSelect = document.getElementById('disable-service-duration');
    const noteInput = document.getElementById('disable-service-note');
    const statusContainer = document.getElementById('service-blocks-status');
    
    const serviceId = serviceSelect.value;
    const serviceName = serviceSelect.options[serviceSelect.selectedIndex]?.dataset.name || 'услугата';
    const days = parseInt(durationSelect.value);
    const note = noteInput.value || `Услуга спряна чрез блокове (ID: ${serviceId})`;
    
    if (!serviceId) {
        alert('Моля, изберете услуга');
        return;
    }
    
    // Load calendars if not loaded
    if (calendars.length === 0) {
        await loadCalendars();
    }
    
    if (calendars.length === 0) {
        alert('Не могат да се заредят календарите');
        return;
    }
    
    const confirmMsg = `⚠️ ПОТВЪРЖДЕНИЕ\n\n` +
        `Ще блокирате ВСИЧКИ календари за ${days} дни (${Math.round(days/30)} месеца).\n\n` +
        `⚠️ ВАЖНО: Това ще спре ВСИЧКИ услуги в календарите, не само "${serviceName}".\n\n` +
        `Клиентите няма да могат да резервират нищо през този период.\n\n` +
        `Искате ли да продължите?`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    statusContainer.style.display = 'block';
    statusContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Създаване на блокове...</p>';
    
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    let success = 0;
    let failed = 0;
    const createdBlocks = [];
    
    for (const calendar of calendars) {
        try {
            const blockData = {
                calendarID: calendar.id,
                start: now.toISOString(),
                end: endDate.toISOString(),
                notes: `${note} | Calendar: ${calendar.name || calendar.email}`
            };
            
            // Note: Acuity API blocks don't natively filter by appointmentTypeID
            // So we block the entire calendar for the period
            // Users will need to manually note which service is being blocked
            
            const response = await fetch(`${WORKER_URL}/acuity/blocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(blockData)
            });
            
            if (response.ok) {
                const block = await response.json();
                createdBlocks.push({ calendar: calendar.name || calendar.email, blockId: block.id });
                success++;
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Save created blocks to localStorage for tracking
    const existingDisabledServices = JSON.parse(localStorage.getItem('disabledServices') || '{}');
    existingDisabledServices[serviceId] = {
        serviceName: serviceName,
        blocks: createdBlocks,
        createdAt: now.toISOString(),
        endDate: endDate.toISOString(),
        note: note
    };
    localStorage.setItem('disabledServices', JSON.stringify(existingDisabledServices));
    
    statusContainer.innerHTML = `
        <div style="background: ${success > 0 ? '#d4edda' : '#f8d7da'}; padding: 15px; border-radius: 8px; border-left: 4px solid ${success > 0 ? '#28a745' : '#dc3545'};">
            <h4 style="color: ${success > 0 ? '#155724' : '#721c24'}; margin: 0 0 10px 0;">
                ${success > 0 ? '✓ Календарите са блокирани!' : '✗ Грешка при блокиране'}
            </h4>
            <p style="margin: 5px 0;">Успешни блокове: ${success}</p>
            <p style="margin: 5px 0;">Неуспешни: ${failed}</p>
            <p style="margin: 10px 0 0 0;"><strong>Период:</strong> ${now.toLocaleDateString('bg-BG')} - ${endDate.toLocaleDateString('bg-BG')}</p>
            ${success > 0 ? `<p style="margin: 10px 0 0 0; font-size: 0.9rem; color: #666;">
                💡 За да възстановите резервациите, изтрийте създадените блокове от секция "Календари" → "Блокирани часове"
            </p>` : ''}
        </div>
    `;
}

async function viewServiceBlocks() {
    const statusContainer = document.getElementById('service-blocks-status');
    const disabledServices = JSON.parse(localStorage.getItem('disabledServices') || '{}');
    
    if (Object.keys(disabledServices).length === 0) {
        statusContainer.style.display = 'block';
        statusContainer.innerHTML = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                <p style="color: #666; margin: 0;">Няма спрени услуги чрез блокове</p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">';
    html += '<h4 style="margin-top: 0; color: #667eea;"><i class="fas fa-ban"></i> Спрени услуги:</h4>';
    
    for (const [serviceId, data] of Object.entries(disabledServices)) {
        const endDate = new Date(data.endDate);
        const isExpired = endDate < new Date();
        
        html += `
            <div style="background: white; padding: 12px; margin: 10px 0; border-radius: 6px; border-left: 3px solid ${isExpired ? '#6c757d' : '#ffc107'};">
                <p style="margin: 5px 0;"><strong>${data.serviceName}</strong> (ID: ${serviceId})</p>
                <p style="margin: 5px 0; font-size: 0.9rem; color: #666;">
                    Период: ${new Date(data.createdAt).toLocaleDateString('bg-BG')} - ${endDate.toLocaleDateString('bg-BG')}
                    ${isExpired ? '<span style="color: #dc3545;"> (Изтекъл)</span>' : '<span style="color: #28a745;"> (Активен)</span>'}
                </p>
                <p style="margin: 5px 0; font-size: 0.9rem; color: #666;">Блокове: ${data.blocks.length}</p>
                <button class="btn btn-danger btn-sm" onclick="removeServiceDisable('${serviceId}')" style="margin-top: 10px;">
                    <i class="fas fa-trash"></i> Премахни проследяването
                </button>
            </div>
        `;
    }
    
    html += '</div>';
    
    statusContainer.style.display = 'block';
    statusContainer.innerHTML = html;
}

function removeServiceDisable(serviceId) {
    const disabledServices = JSON.parse(localStorage.getItem('disabledServices') || '{}');
    
    if (!disabledServices[serviceId]) {
        alert('Услугата не е намерена в проследяването');
        return;
    }
    
    const data = disabledServices[serviceId];
    
    if (confirm(`Премахване на проследяването за "${data.serviceName}"?\n\nЗабележка: Това НЕ изтрива блоковете от Acuity. За да възстановите напълно услугата, трябва ръчно да изтриете блоковете от секция "Календари".`)) {
        delete disabledServices[serviceId];
        localStorage.setItem('disabledServices', JSON.stringify(disabledServices));
        viewServiceBlocks(); // Refresh the view
    }
}

// Default schedule management
function saveDefaultSchedule() {
    const startTime = document.getElementById('default-start-time').value;
    const endTime = document.getElementById('default-end-time').value;
    const interval = parseInt(document.getElementById('default-interval').value);
    const breakTime = parseInt(document.getElementById('default-break').value);
    
    if (!startTime || !endTime) {
        alert('Моля, въведете начален и краен час');
        return;
    }
    
    // Save to localStorage
    const defaultSchedule = { startTime, endTime, interval, breakTime };
    localStorage.setItem('defaultSchedule', JSON.stringify(defaultSchedule));
    
    // Show preview
    showSchedulePreview(startTime, endTime, interval, breakTime);
    
    alert('Графикът по подразбиране е запазен!');
}

function showSchedulePreview(startTime, endTime, interval, breakTime) {
    const previewContainer = document.getElementById('default-schedule-preview');
    const slotsContainer = document.getElementById('schedule-preview-slots');
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    const slots = [];
    let currentMinutes = startMinutes;
    
    while (currentMinutes + interval <= endMinutes) {
        const hour = Math.floor(currentMinutes / 60);
        const min = currentMinutes % 60;
        const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        slots.push(timeStr);
        currentMinutes += interval + breakTime;
    }
    
    slotsContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px;">
            ${slots.map(slot => `
                <div style="padding: 8px; background: #667eea; color: white; border-radius: 5px; text-align: center; font-weight: 500;">
                    ${slot}
                </div>
            `).join('')}
        </div>
        <p style="margin-top: 15px; color: #666;">
            <strong>Общо ${slots.length} часа</strong> с интервал от ${interval} минути${breakTime > 0 ? ` и ${breakTime} мин. почивка` : ''}
        </p>
    `;
    
    previewContainer.style.display = 'block';
}

// Load default schedule on page load
function loadDefaultSchedule() {
    const saved = localStorage.getItem('defaultSchedule');
    if (saved) {
        const schedule = JSON.parse(saved);
        if (document.getElementById('default-start-time')) {
            document.getElementById('default-start-time').value = schedule.startTime;
            document.getElementById('default-end-time').value = schedule.endTime;
            document.getElementById('default-interval').value = schedule.interval;
            document.getElementById('default-break').value = schedule.breakTime;
        }
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDefaultSchedule();
});

// Export functions for HTML onclick handlers
window.loadAppointments = loadAppointments;
window.loadAppointmentsByFilter = loadAppointmentsByFilter;
window.loadClients = loadClients;
window.sendMessage = sendMessage;
window.updateModelOptions = updateModelOptions;
window.handleBookingSubmit = handleBookingSubmit;
window.loadCalendarsManagement = loadCalendarsManagement;
window.viewCalendarBlocks = viewCalendarBlocks;
window.editCalendar = editCalendar;
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
window.loadServices = loadServices;
window.searchServiceById = searchServiceById;
window.editService = editService;
window.updateService = updateService;
window.cancelServiceEdit = cancelServiceEdit;
window.saveDefaultSchedule = saveDefaultSchedule;
window.disableServiceViaBlocks = disableServiceViaBlocks;
window.viewServiceBlocks = viewServiceBlocks;
window.removeServiceDisable = removeServiceDisable;
window.createService = createService;
window.showServiceCreateForm = showServiceCreateForm;
window.cancelServiceCreate = cancelServiceCreate;
window.deleteService = deleteService;
window.createCalendar = createCalendar;
window.showCalendarCreateForm = showCalendarCreateForm;
window.cancelCalendarCreate = cancelCalendarCreate;
window.deleteCalendar = deleteCalendar;
window.createClient = createClient;
window.showClientCreateForm = showClientCreateForm;
window.cancelClientCreate = cancelClientCreate;
window.updateClient = updateClient;
window.deleteAppointment = deleteAppointment;
window.filterAppointmentsByClient = filterAppointmentsByClient;
window.checkAvailability = checkAvailability;
window.checkAvailableTimes = checkAvailableTimes;
