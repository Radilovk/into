let eventsData = [];

async function loadEvents() {
  try {
    const res = await fetch('events.json');
    eventsData = await res.json();
    setupDateInputs();
    filterEvents();
  } catch (err) {
    console.error('Грешка при зареждане на събитията', err);
  }
}

function setupDateInputs() {
  if (!eventsData.length) return;
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');

  const dates = eventsData.map(ev => new Date(ev.date));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  const format = d => d.toISOString().split('T')[0];

  startInput.min = format(minDate);
  startInput.max = format(maxDate);
  endInput.min = format(minDate);
  endInput.max = format(maxDate);

  startInput.value = format(minDate);
  endInput.value = format(maxDate);

  document.getElementById('filter-btn').addEventListener('click', e => {
    e.preventDefault();
    filterEvents();
  });
}

function filterEvents() {
  const container = document.getElementById('events-container');
  container.innerHTML = '';

  if (!eventsData.length) return;

  const startVal = document.getElementById('start-date').value;
  const endVal = document.getElementById('end-date').value;
  const start = startVal ? new Date(startVal) : null;
  const end = endVal ? new Date(endVal) : null;

  const filtered = eventsData
    .filter(ev => {
      const d = new Date(ev.date);
      return (!start || d >= start) && (!end || d <= end);
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!filtered.length) {
    container.innerHTML = '<p>Няма събития в посочения период.</p>';
    return;
  }

  const list = document.createElement('ul');
  list.className = 'events-list';
  filtered.forEach(ev => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${ev.title}</strong> - ${ev.date} ${ev.time || ''} (${ev.location})`;
    list.appendChild(li);
  });
  container.appendChild(list);
}

loadEvents();
