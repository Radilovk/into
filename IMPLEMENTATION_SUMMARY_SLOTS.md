# Резюме на Имплементацията: Филтриране на Слотове и Управление на Работно Време

## Преглед

Имплементирахме две основни функционалности съгласно изискванията в problem statement:

1. **Филтриране на свободни часове** - Клиентско филтриране на слотовете за показване само на тези на :00 и :45 минути (45-минутни интервали)
2. **Управление на работно време на календара** - Актуализиране на работните часове чрез API

## Какво беше добавено

### 1. Backend (worker-backend.js)

#### Нов Endpoint за Свободни Часове

```javascript
// GET /acuity/availability/times - проверка на налични часове
if (pathname === '/acuity/availability/times' && request.method === 'GET') {
    const url = new URL(request.url);
    const appointmentTypeID = url.searchParams.get('appointmentTypeID');
    const date = url.searchParams.get('date');
    const calendarID = url.searchParams.get('calendarID');
    
    if (!appointmentTypeID || !date) {
        return new Response('Missing appointmentTypeID or date', { status: 400 });
    }
    
    const params = new URLSearchParams({ appointmentTypeID, date });
    if (calendarID) params.append('calendarID', calendarID);
    
    const acuityUrl = `https://acuityscheduling.com/api/v1/availability/times?${params.toString()}`;
    return callAcuityAPI(acuityUrl);
}
```

**Особености:**
- Връща списък със свободни часове за конкретна дата
- Изисква `appointmentTypeID` и `date`
- Опционален параметър `calendarID`
- Използва същата `callAcuityAPI` helper функция

### 2. Frontend (acuity-manager.js)

#### Функции за Филтриране на Слотове

**`checkAvailableTimes()`** - Зарежда свободни часове
```javascript
async function checkAvailableTimes() {
    const appointmentTypeID = document.getElementById('availability-times-type').value;
    const calendarID = document.getElementById('availability-times-calendar').value;
    const date = document.getElementById('availability-times-date').value;
    const filter45min = document.getElementById('availability-times-filter-45').checked;
    
    // Fetch slots from API
    let slots = await response.json();
    
    // Apply 45-minute filter if enabled
    if (filter45min && Array.isArray(slots)) {
        slots = filterSlotsTo45MinIntervals(slots);
    }
    
    displayAvailableTimes(slots);
}
```

**`filterSlotsTo45MinIntervals()`** - Филтрира слотовете
```javascript
function filterSlotsTo45MinIntervals(slots) {
    return slots.filter(slot => {
        const timeStr = typeof slot === 'object' ? slot.time : slot;
        if (!timeStr) return false;
        
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) return false; // Валидация
        
        const minutes = date.getMinutes();
        return minutes === 0 || minutes === 45; // Само :00 и :45
    });
}
```

**`formatTimeSlot()`** - Helper за форматиране
```javascript
function formatTimeSlot(timeStr) {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) {
        return 'Invalid time';
    }
    return date.toLocaleTimeString('bg-BG', {hour: '2-digit', minute: '2-digit'});
}
```

#### Функции за Управление на Работно Време

**`loadCalendarTimeRanges()`** - Зарежда текущото работно време
```javascript
function loadCalendarTimeRanges() {
    const calendarId = document.getElementById('calendar-timerange-select').value;
    
    fetch(`${WORKER_URL}/acuity/calendars/${calendarId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(calendar => {
            displayCalendarTimeRanges(calendar);
        });
}
```

**`updateCalendarTimeRanges()`** - Запазва новото работно време
```javascript
async function updateCalendarTimeRanges() {
    const timeRanges = [];
    const startInputs = document.querySelectorAll('.timerange-start');
    const endInputs = document.querySelectorAll('.timerange-end');
    
    // Валидация на дължините
    if (startInputs.length !== endInputs.length) {
        alert('Грешка: Несъответствие в броя на полетата');
        return;
    }
    
    // Събиране на времеви диапазони
    for (let i = 0; i < startInputs.length; i++) {
        const start = startInputs[i].value;
        const end = endInputs[i].value;
        if (start && end) {
            timeRanges.push({ start, end });
        }
    }
    
    // Валидация на времевите диапазони
    for (const range of timeRanges) {
        const startMinutes = convertTimeToMinutes(range.start);
        const endMinutes = convertTimeToMinutes(range.end);
        if (startMinutes >= endMinutes) {
            alert(`Невалиден времеви диапазон: ${range.start} - ${range.end}`);
            return;
        }
    }
    
    // PATCH заявка към API
    const response = await fetch(`${WORKER_URL}/acuity/calendars/${calendarId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeRanges })
    });
}
```

**`convertTimeToMinutes()`** - Helper за сравнение на времена
```javascript
function convertTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0; // Валидация
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) return 0; // Валидация
    
    return hours * 60 + minutes;
}
```

**`addTimeRangeInput()` / `removeTimeRangeInput()`** - Динамично управление на полета
```javascript
function addTimeRangeInput(startValue = '', endValue = '') {
    const container = document.getElementById('timerange-inputs');
    timeRangeInputCount++;
    
    const div = document.createElement('div');
    div.id = `timerange-${timeRangeInputCount}`;
    div.innerHTML = `
        <input type="time" class="timerange-start" value="${startValue}">
        <input type="time" class="timerange-end" value="${endValue}">
        <button onclick="removeTimeRangeInput(${timeRangeInputCount})">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(div);
}
```

### 3. UI (acuity-manager.html)

#### Нова Секция за Филтриране на Слотове

```html
<div class="card">
    <div class="card-header">
        <i class="fas fa-clock"></i> Свободни часове с филтриране (45-мин. интервали)
    </div>
    
    <select id="availability-times-type" class="form-control">
        <option value="">Избери услуга...</option>
    </select>
    
    <select id="availability-times-calendar" class="form-control">
        <option value="">Всички календари</option>
    </select>
    
    <input type="date" id="availability-times-date" class="form-control">
    
    <div class="form-group">
        <input type="checkbox" id="availability-times-filter-45" checked>
        <label>
            <i class="fas fa-filter"></i> Филтрирай само :00 и :45 минути
        </label>
    </div>
    
    <button onclick="checkAvailableTimes()">
        <i class="fas fa-search"></i> Виж свободни часове
    </button>
    
    <div id="availability-times-results"></div>
</div>
```

#### Нова Секция за Работно Време

```html
<div class="card">
    <div class="card-header">
        <i class="fas fa-clock"></i> Обновяване на работно време (чрез API)
    </div>
    
    <select id="calendar-timerange-select" class="form-control">
        <option value="">Избери календар...</option>
    </select>
    
    <button onclick="loadCalendarTimeRanges()">
        <i class="fas fa-sync"></i> Зареди текущо работно време
    </button>
    
    <div id="calendar-timeranges-display"></div>
    
    <div id="timerange-inputs">
        <!-- Dynamic time range inputs -->
    </div>
    
    <button onclick="addTimeRangeInput()">
        <i class="fas fa-plus"></i> Добави времеви диапазон
    </button>
    
    <button onclick="updateCalendarTimeRanges()">
        <i class="fas fa-save"></i> Запази работно време
    </button>
</div>
```

### 4. Документация

#### README.md

Добавихме секция за новите функционалности:

```markdown
### Филтриране на свободни часове с 45-минутни интервали (НОВ)

API ще върне всички слотове през 15 минути, но клиентският интерфейс ще покаже 
само тези, които съвпадат с 45-минутна стъпка (:00 и :45).

### Промяна на работно време на календара чрез API (НОВ)

Можете да обновите работното време (availability) на календара директно чрез API:

PATCH /acuity/calendars/{calendarId}
{
  "timeRanges": [
    { "start": "08:00", "end": "12:00" },
    { "start": "13:00", "end": "17:00" }
  ]
}
```

#### SLOT_FILTERING_GUIDE.md

Създадохме подробно ръководство с:

1. **Обяснение на филтрирането на часове**
   - Как работи
   - Как да се използва
   - Примери за филтриране
   - Предимства и ограничения

2. **Обяснение на управлението на работно време**
   - Как работи API-то
   - Стъпка-по-стъпка инструкции
   - Примерни сценарии
   - Алтернативи при липса на API права

3. **Технически детайли**
   - API endpoints
   - JavaScript функции
   - Примерен код

4. **FAQ секция**
   - Отговори на често задавани въпроси
   - Troubleshooting съвети
   - Примери за персонализация

## Валидации и Обработка на Грешки

Имплементирахме надеждна валидация на всяко ниво:

### Валидация на Дати
```javascript
const date = new Date(timeStr);
if (isNaN(date.getTime())) {
    return false; // или подходящ fallback
}
```

### Валидация на Време
```javascript
function convertTimeToMinutes(timeStr) {
    // Проверка на типа
    if (!timeStr || typeof timeStr !== 'string') return 0;
    
    // Проверка на формата
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    
    // Проверка на стойностите
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    
    return hours * 60 + minutes;
}
```

### HTTP Валидация
```javascript
fetch(url).then(response => {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
});
```

### Валидация на Масиви
```javascript
if (startInputs.length !== endInputs.length) {
    alert('Грешка: Несъответствие в броя на полетата');
    return;
}
```

## Използване

### 1. Филтриране на Свободни Часове

1. Отворете Acuity Manager
2. Отидете в таб "Нова резервация"
3. Намерете "Свободни часове с филтриране (45-мин. интервали)"
4. Изберете услуга и дата
5. Поставете отметка на филтъра
6. Натиснете "Виж свободни часове"

**Резултат:** Ще видите само часовете на :00 и :45 минути

### 2. Управление на Работно Време

1. Отворете Acuity Manager
2. Отидете в таб "Календари"
3. Намерете "Обновяване на работно време (чрез API)"
4. Изберете календар
5. Натиснете "Зареди текущо работно време"
6. Добавете/редактирайте времеви диапазони
7. Натиснете "Запази работно време"

**Резултат:** Календарът ще има обновено работно време в Acuity

## Предимства на Имплементацията

### Филтриране на Слотове
- ✅ Не променя настройките в Acuity
- ✅ Работи със всички Acuity планове
- ✅ Лесно да се включи/изключи
- ✅ Не изисква API права за редакция

### Управление на Работно Време
- ✅ Програмна промяна на работните часове
- ✅ Не изисква достъп до Acuity UI
- ✅ Може да се автоматизира
- ✅ Визуализация на текущите настройки

## Технически Спецификации

### API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/acuity/availability/times` | GET | Връща свободни часове за дата |
| `/acuity/calendars/{id}` | GET | Връща информация за календар |
| `/acuity/calendars/{id}` | PATCH | Актуализира календара |

### Параметри

**GET /acuity/availability/times:**
- `appointmentTypeID` (задължителен)
- `date` (задължителен) - формат YYYY-MM-DD
- `calendarID` (опционален)

**PATCH /acuity/calendars/{id}:**
```json
{
  "timeRanges": [
    {"start": "HH:MM", "end": "HH:MM"}
  ]
}
```

## Заключение

Имплементацията предоставя две мощни инструменти за управление на Acuity Scheduling:

1. **Клиентско филтриране** - за визуален контрол без промяна на настройките
2. **API управление** - за програмна промяна на работното време

Двете функции могат да се използват заедно за максимален контрол върху наличността на календара, без нужда от достъп до Acuity UI.

Всички функции са напълно документирани, валидирани и готови за production използване.
