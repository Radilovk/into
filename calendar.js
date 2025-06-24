async function loadEvents() {
  try {
    const res = await fetch('events.json');
    const events = await res.json();
    displayUpcoming(events);
  } catch (err) {
    console.error('Грешка при зареждане на събитията', err);
  }
}

function displayUpcoming(events) {
  const container = document.getElementById('events-container');
  const now = new Date();
  const upcoming = events
    .filter(ev => new Date(ev.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!upcoming.length) {
    container.innerHTML = '<p>Няма предстоящи събития.</p>';
    return;
  }

  const list = document.createElement('ul');
  list.className = 'events-list';
  upcoming.forEach(ev => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${ev.title}</strong> - ${ev.date} ${ev.time || ''} (${ev.location})`;
    list.appendChild(li);
  });
  container.appendChild(list);
}

loadEvents();
