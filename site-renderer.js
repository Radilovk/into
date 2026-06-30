window.SITE_DATA = null;

async function loadSiteData() {
    const cached = localStorage.getItem('intodesign_site_preview');
    if (cached) {
        try { return JSON.parse(cached); } catch (e) { /* fall through */ }
    }
    const apiUrl = window.SITE_API_URL || 'https://workerai.radilov-k.workers.dev/api/site-content';
    try {
        const res = await fetch(apiUrl, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data && data.portfolio) return data;
        }
    } catch (e) { /* fallback */ }
    const res = await fetch('site-data.json', { cache: 'no-store' });
    return res.json();
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function renderSite(data) {
    window.SITE_DATA = data;
    window.PROJECTS = {};
    data.portfolio.projects.forEach(p => { window.PROJECTS[p.id] = p; });

    document.title = data.meta.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = data.meta.description;

    const h = data.header;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('headerSubtitle', h.subtitle);
    const ctaSpan = document.querySelector('#headerCta span');
    if (ctaSpan) ctaSpan.textContent = h.ctaText;
    if (document.getElementById('socialFb')) document.getElementById('socialFb').href = h.social.facebook;
    if (document.getElementById('socialIg')) document.getElementById('socialIg').href = h.social.instagram;
    if (document.getElementById('socialPin')) document.getElementById('socialPin').href = h.social.pinterest;

    const navContacts = document.querySelector('.nav-footer-contacts');
    if (navContacts) navContacts.innerHTML = `<p>${esc(h.contacts.email)}</p><p>${esc(h.contacts.phone)}</p>`;

    renderHero(data.hero);
    renderAbout(data.about);
    renderPortfolio(data.portfolio);
    renderServices(data.services);
    renderVideo(data.video);
    renderTeam(data.team);
    renderTestimonials(data.testimonials);
    renderContact(data.contact);
    renderFooter(data.footer, h);
}

function renderHero(hero) {
    const slider = document.getElementById('heroSlider');
    if (!slider) return;
    slider.innerHTML = hero.slides.map((s, i) => `
        <div class="hero-slide${i === 0 ? ' active' : ''}" data-index="${i}">
            <div class="hero-slide-bg" style="background-image:url('${s.image}')"></div>
            <div class="hero-slide-overlay"></div>
            <div class="hero-slide-content">
                <span class="hero-welcome">${esc(hero.welcome)}</span>
                <span class="hero-slide-date">${esc(s.date)}</span>
                <h2 class="hero-slide-title"><span class="title-line">${esc(s.title)}</span><span class="title-line accent">${esc(s.subtitle)}</span></h2>
                <p class="hero-slide-desc">${esc(s.desc)}</p>
                <a href="#portfolio" class="hero_btn">Виж детайли</a>
            </div>
        </div>`).join('');

    const scrollEl = document.querySelector('.hero-scroll-down-notifer span');
    if (scrollEl) scrollEl.textContent = hero.scrollText;
    const totalEl = document.querySelector('.total-slides');
    if (totalEl) totalEl.textContent = `/ ${String(hero.slides.length).padStart(2, '0')}`;

    const dots = document.querySelector('.hero-dots');
    if (dots) {
        dots.innerHTML = hero.slides.map((_, i) =>
            `<button class="hero-dot${i === 0 ? ' active' : ''}" aria-label="Слайд ${i + 1}"></button>`
        ).join('');
    }
}

function renderAbout(about) {
    const section = document.getElementById('about');
    if (!section) return;
    const t = section.querySelector('.section-title');
    if (t) { t.querySelector('h2').textContent = about.title; t.querySelector('p').textContent = about.subtitle; }
    const at = section.querySelector('.about-text');
    if (at) {
        at.querySelector('h4').textContent = about.heading;
        const ps = at.querySelectorAll('p');
        if (ps[0]) ps[0].textContent = about.text1;
        if (ps[1]) ps[1].textContent = about.text2;
        const ul = at.querySelector('.about-services-list ul');
        if (ul) ul.innerHTML = about.services.map(s => `<li>${esc(s)}</li>`).join('');
    }
    const img = section.querySelector('.about-image img');
    if (img) { img.src = about.image; img.alt = about.title; }
    const facts = section.querySelector('.inline-facts-container');
    if (facts) {
        facts.innerHTML = about.counters.map(c => `
            <div class="inline-facts-wrap">
                <div class="num counter" data-target="${c.value}">0</div>
                <h6>${esc(c.label)}</h6>
            </div>`).join('');
    }
}

function renderPortfolio(portfolio) {
    const t = document.querySelector('#portfolio .section-title');
    if (t) { t.querySelector('h2').textContent = portfolio.title; t.querySelector('p').textContent = portfolio.subtitle; }
    const grid = document.querySelector('.gallery-items');
    if (!grid) return;
    grid.innerHTML = portfolio.projects.map((p, i) => `
        <article class="gallery-item${p.wide ? ' gallery-item-second' : ''}" data-category="${p.category}" data-project="${p.id}" tabindex="0" role="button">
            <div class="grid-item-holder">
                <img src="${p.cover}" alt="${esc(p.title)}" loading="lazy">
                <div class="folio-overlay">
                    <span class="folio-num">${String(i + 1).padStart(2, '0')}</span>
                    <div class="folio-content">
                        <span class="folio-cat">${esc(p.categoryLabel)}</span>
                        <h3>${esc(p.title)}</h3>
                        <p>${esc(p.location)} | ${esc(p.area)}</p>
                        <span class="folio-view"><i class="fas fa-expand"></i> Виж проекта</span>
                    </div>
                </div>
            </div>
        </article>`).join('');
}

function renderServices(services) {
    const section = document.getElementById('services');
    if (!section) return;
    const t = section.querySelector('.section-title');
    if (t) { t.querySelector('h2').textContent = services.title; t.querySelector('p').textContent = services.subtitle; }
    const grid = section.querySelector('.services-grid');
    if (!grid) return;
    grid.innerHTML = services.items.map(s => `
        <div class="serv-card${s.featured ? ' serv-featured' : ''}">
            ${s.featured ? '<div class="serv-badge">Препоръчан</div>' : ''}
            <div class="serv-card-head">
                <span class="serv-num">${s.num}</span>
                <div class="serv-icon"><i class="fas ${s.icon}"></i></div>
            </div>
            <h4>${esc(s.title)}</h4>
            <p class="serv-desc">${esc(s.desc)}</p>
            <div class="serv-price">${esc(s.price)}<span>€/кв.м.</span></div>
            <ul class="serv-features">${s.features.map(f => `<li><i class="fas fa-check"></i> ${esc(f)}</li>`).join('')}</ul>
            <a href="#contact" class="serv-btn${s.featured ? ' serv-btn-accent' : ''}">Запитване <i class="fas fa-arrow-right"></i></a>
        </div>`).join('');
}

function renderVideo(video) {
    const section = document.querySelector('.video-section');
    if (!section) return;
    section.querySelector('.video-promo-text h3').textContent = video.title;
    section.querySelector('.video-promo-text p').textContent = video.text;
    section.querySelector('.video-box img').src = video.image;
    const btn = section.querySelector('.video-box-btn');
    if (btn) btn.dataset.video = video.youtube;
    const ch = section.querySelector('.video-channel-btn');
    if (ch) ch.href = video.channelUrl;
}

function renderTeam(team) {
    const section = document.getElementById('team');
    if (!section) return;
    const t = section.querySelector('.section-title');
    if (t) { t.querySelector('h2').textContent = team.title; t.querySelector('p').textContent = team.subtitle; }
    const grid = section.querySelector('.team-grid');
    if (!grid) return;
    grid.innerHTML = team.members.map(m => `
        <div class="team-box">
            <div class="team-photo">
                <img src="${m.image}" alt="${esc(m.name)}" loading="lazy">
                <div class="overlay"></div>
                <div class="team-social">
                    <a href="#"><i class="fab fa-facebook-f"></i></a>
                    <a href="#"><i class="fab fa-instagram"></i></a>
                    <a href="#"><i class="fab fa-linkedin-in"></i></a>
                </div>
            </div>
            <span class="team-num">${m.num}</span>
            <h3>${esc(m.name)}</h3>
            <h4>${esc(m.role)}</h4>
            <p>${esc(m.bio)}</p>
            <div class="team-contact">
                <span><i class="fas fa-phone"></i> ${esc(m.phone)}</span>
                <span><i class="fas fa-envelope"></i> ${esc(m.email)}</span>
            </div>
        </div>`).join('');
}

function renderTestimonials(testimonials) {
    const section = document.getElementById('testimonials');
    if (!section) return;
    const t = section.querySelector('.section-title');
    if (t) { t.querySelector('h2').textContent = testimonials.title; t.querySelector('p').textContent = testimonials.subtitle; }
    const track = document.getElementById('testimonialsTrack');
    if (!track) return;
    track.innerHTML = testimonials.items.map(item => `
        <div class="testimonial-item">
            <div class="testimonilas-text">
                <div class="testimonial-avatar"><img src="${item.avatar}" alt=""></div>
                <h3>${esc(item.name)}</h3>
                <p>"${esc(item.text)}"</p>
                <span class="testimonial-source">${esc(item.source)}</span>
            </div>
        </div>`).join('');
}

function renderContact(contact) {
    const section = document.getElementById('contact');
    if (!section) return;
    const t = section.querySelector('.section-title');
    if (t) { t.querySelector('h2').textContent = contact.title; t.querySelector('p').textContent = contact.subtitle; }
    const items = section.querySelectorAll('.contact-details li div');
    const vals = [contact.address, contact.phone, contact.email, contact.hours];
    items.forEach((el, i) => { if (vals[i]) el.textContent = vals[i]; });
}

function renderFooter(footer, header) {
    const fw = document.querySelector('.footer-widget p');
    if (fw) fw.textContent = footer.about;
    document.querySelector('.subfooter p').textContent = footer.copyright;
    const nl = document.querySelectorAll('.footer-widget p');
    if (nl[1]) nl[1].textContent = footer.newsletterText;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const data = await loadSiteData();
        renderSite(data);
        document.dispatchEvent(new CustomEvent('site:rendered', { detail: data }));
    } catch (e) {
        console.error('Грешка при зареждане на съдържанието:', e);
    }
});
