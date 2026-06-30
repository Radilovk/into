(function () {
    'use strict';

    const API_URL = 'https://workerai.radilov-k.workers.dev';
    const STORAGE_TOKEN = 'intodesign_admin_token';
    const STORAGE_PREVIEW = 'intodesign_site_preview';
    const INQUIRIES_LOCAL_KEY = 'intodesign_inquiries_local';
    const QUICK_ENTRY_KEY = 'intodesign_admin_quick';
    const QUICK_ENTRY_TTL = 24 * 60 * 60 * 1000;

    const SECTION_TITLES = {
        meta: 'Общи настройки',
        header: 'Хедър',
        hero: 'Слайдер (начална страница)',
        about: 'За нас',
        portfolio: 'Портфолио',
        services: 'Услуги',
        video: 'Видео секция',
        team: 'Екип',
        testimonials: 'Отзиви',
        inquiries: 'Клиентски запитвания',
        contact: 'Контакти',
        footer: 'Футър'
    };

    let siteData = null;
    let inquiriesCache = [];
    let currentSection = 'meta';

    const $ = id => document.getElementById(id);

    function toast(msg, type = 'success') {
        const el = $('toast');
        el.textContent = msg;
        el.className = 'admin-toast visible ' + type;
        setTimeout(() => el.classList.remove('visible'), 3500);
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    async function loadSiteData() {
        const token = sessionStorage.getItem(STORAGE_TOKEN);
        try {
            const res = await fetch(`${API_URL}/api/site-content`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data && data.portfolio) return data;
            }
        } catch (e) { /* fallback */ }
        const res = await fetch('site-data.json', { cache: 'no-store' });
        return res.json();
    }

    async function authenticate(password) {
        try {
            const res = await fetch(`${API_URL}/api/site-auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.token) {
                    sessionStorage.setItem(STORAGE_TOKEN, data.token);
                    return true;
                }
            }
            if (res.status === 401) return false;
        } catch (e) { /* offline fallback below */ }
        if (password === 'intodesign2024') {
            sessionStorage.setItem(STORAGE_TOKEN, 'local-offline');
            return true;
        }
        return false;
    }

    function isQuickEntry() {
        const t = sessionStorage.getItem(QUICK_ENTRY_KEY);
        return t && Date.now() - parseInt(t, 10) < QUICK_ENTRY_TTL;
    }

    function hasRealToken() {
        const token = sessionStorage.getItem(STORAGE_TOKEN);
        return token && token !== 'quick-entry' && token !== 'local-offline';
    }

    function formatDate(iso) {
        try {
            return new Date(iso).toLocaleString('bg-BG', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) { return iso; }
    }

    function syncLocalInquiries(list) {
        try {
            localStorage.setItem(INQUIRIES_LOCAL_KEY, JSON.stringify(list.slice(0, 100)));
        } catch (e) { /* ignore */ }
    }

    async function loadInquiries() {
        const local = JSON.parse(localStorage.getItem(INQUIRIES_LOCAL_KEY) || '[]');
        if (hasRealToken()) {
            try {
                const res = await fetch(`${API_URL}/api/inquiries`, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem(STORAGE_TOKEN)}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const remote = data.data || [];
                    const merged = [...remote];
                    local.forEach(item => {
                        if (!merged.find(r => r.id === item.id)) merged.push(item);
                    });
                    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    return merged;
                }
            } catch (e) { /* fallback local */ }
        }
        return local.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async function patchInquiry(action, id) {
        if (hasRealToken()) {
            try {
                const res = await fetch(`${API_URL}/api/inquiries`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${sessionStorage.getItem(STORAGE_TOKEN)}`
                    },
                    body: JSON.stringify({ action, id })
                });
                if (res.ok) {
                    const data = await res.json();
                    inquiriesCache = data.data || [];
                    syncLocalInquiries(inquiriesCache);
                    return;
                }
            } catch (e) { /* local fallback */ }
        }
        if (action === 'markRead' && id) {
            inquiriesCache = inquiriesCache.map(i => i.id === id ? { ...i, read: true } : i);
        } else if (action === 'markAllRead') {
            inquiriesCache = inquiriesCache.map(i => ({ ...i, read: true }));
        } else if (action === 'delete' && id) {
            inquiriesCache = inquiriesCache.filter(i => i.id !== id);
        }
        syncLocalInquiries(inquiriesCache);
    }

    function updateInquiriesBadge() {
        const badge = $('inquiriesBadge');
        if (!badge) return;
        const unread = inquiriesCache.filter(i => !i.read).length;
        if (unread > 0) {
            badge.textContent = unread > 99 ? '99+' : String(unread);
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    }

    function renderInquiryCard(inq, compact = false) {
        return `
            <div class="inquiry-card${inq.read ? '' : ' unread'}" data-inquiry-id="${escAttr(inq.id)}">
                <div class="inquiry-card-header">
                    <h4>${escHtml(inq.name)} — ${escHtml(inq.subject || 'Общо запитване')}</h4>
                    <span class="inquiry-meta">${formatDate(inq.createdAt)}</span>
                </div>
                <div class="inquiry-meta">
                    <span><i class="fas fa-envelope"></i> ${escHtml(inq.email)}</span>
                    <span><i class="fas fa-phone"></i> ${escHtml(inq.phone)}</span>
                </div>
                <p class="inquiry-message">${escHtml(inq.message)}</p>
                ${compact ? '' : `<div class="inquiry-actions">
                    ${!inq.read ? `<button type="button" class="btn btn-secondary btn-sm" data-mark-read="${escAttr(inq.id)}"><i class="fas fa-check"></i> Прочетено</button>` : ''}
                    <a href="mailto:${escAttr(inq.email)}" class="btn btn-secondary btn-sm"><i class="fas fa-reply"></i> Отговори</a>
                    <button type="button" class="btn btn-danger btn-sm" data-delete-inquiry="${escAttr(inq.id)}"><i class="fas fa-trash"></i> Изтрий</button>
                </div>`}
            </div>`;
    }

    async function showInquiriesAlertModal() {
        const unread = inquiriesCache.filter(i => !i.read);
        if (!unread.length) return;
        const body = $('inquiriesAlertBody');
        body.innerHTML = unread.slice(0, 5).map(i => renderInquiryCard(i, true)).join('');
        if (unread.length > 5) {
            body.innerHTML += `<p style="text-align:center;color:#888;margin-top:12px;font-size:13px;">+ още ${unread.length - 5} непрочетени</p>`;
        }
        $('inquiriesAlertModal').hidden = false;
    }

    function hideInquiriesAlertModal() {
        $('inquiriesAlertModal').hidden = true;
    }

    function bindInquiryActions(container) {
        container.querySelectorAll('[data-mark-read]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await patchInquiry('markRead', btn.dataset.markRead);
                updateInquiriesBadge();
                if (currentSection === 'inquiries') await renderInquiriesSection($('adminContent'));
            });
        });
        container.querySelectorAll('[data-delete-inquiry]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Изтриване на запитването?')) return;
                await patchInquiry('delete', btn.dataset.deleteInquiry);
                updateInquiriesBadge();
                if (currentSection === 'inquiries') await renderInquiriesSection($('adminContent'));
            });
        });
    }

    async function renderInquiriesSection(container) {
        inquiriesCache = await loadInquiries();
        updateInquiriesBadge();
        const unread = inquiriesCache.filter(i => !i.read).length;
        container.innerHTML = `
            <div class="help-box"><i class="fas fa-inbox"></i> Всички запитвания от контактната форма на сайта. Имейл и телефон са задължителни за клиентите.</div>
            <div class="admin-panel">
                <div class="admin-panel-header">
                    <h3>Клиентски запитвания ${unread ? `(${unread} нови)` : ''}</h3>
                    <p>Общо: ${inquiriesCache.length}</p>
                </div>
                <div class="admin-panel-body">
                    ${inquiriesCache.length
                        ? `<div class="inquiry-actions" style="margin-bottom:20px">
                            <button type="button" class="btn btn-secondary btn-sm" id="markAllInquiriesRead"><i class="fas fa-check-double"></i> Маркирай всички като прочетени</button>
                           </div>
                           ${inquiriesCache.map(i => renderInquiryCard(i)).join('')}`
                        : `<div class="empty-state"><i class="fas fa-inbox"></i><p>Няма запитвания все още.</p></div>`}
                </div>
            </div>`;
        $('markAllInquiriesRead')?.addEventListener('click', async () => {
            await patchInquiry('markAllRead');
            updateInquiriesBadge();
            await renderInquiriesSection(container);
        });
        bindInquiryActions(container);
    }

    async function publishData(data) {
        const token = sessionStorage.getItem(STORAGE_TOKEN);
        const res = await fetch(`${API_URL}/api/site-content`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Грешка при публикуване');
        }
        return res.json();
    }

    function field(label, hint, inner) {
        return `<div class="field"><label>${label}</label>${inner}${hint ? `<p class="field-hint">${hint}</p>` : ''}</div>`;
    }

    function textInput(path, value = '', placeholder = '') {
        return `<input type="text" data-path="${path}" value="${escAttr(value)}" placeholder="${escAttr(placeholder)}">`;
    }

    function textareaInput(path, value = '') {
        return `<textarea data-path="${path}">${escHtml(value)}</textarea>`;
    }

    function escAttr(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function escHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function getByPath(obj, path) {
        return path.split('.').reduce((o, k) => o?.[k], obj);
    }

    function setByPath(obj, path, value) {
        const keys = path.split('.');
        let cur = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!cur[keys[i]]) cur[keys[i]] = {};
            cur = cur[keys[i]];
        }
        cur[keys[keys.length - 1]] = value;
    }

    function imageField(path, value, label, hint, panorama = false) {
        const id = 'img_' + path.replace(/\./g, '_');
        return field(label, hint, `
            <div class="image-field">
                <div class="image-preview${panorama ? ' panorama' : ''}" id="${id}_preview">
                    ${value ? `<img src="${escAttr(value)}" alt="">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:11px;">Няма</div>'}
                </div>
                <div class="image-controls">
                    ${textInput(path, value, 'URL на изображение или качете файл')}
                    <div class="btn-row">
                        <button type="button" class="btn btn-secondary btn-sm" data-upload="${path}" data-preview="${id}_preview"><i class="fas fa-upload"></i> Качи файл</button>
                        <button type="button" class="btn btn-danger btn-sm" data-clear-img="${path}" data-preview="${id}_preview"><i class="fas fa-trash"></i> Премахни</button>
                    </div>
                </div>
            </div>`);
    }

    function bindFields(container) {
        container.querySelectorAll('[data-path]').forEach(el => {
            el.addEventListener('input', () => {
                let val = el.value;
                if (el.type === 'number') val = Number(val);
                if (el.type === 'checkbox') val = el.checked;
                setByPath(siteData, el.dataset.path, val);
            });
            el.addEventListener('change', () => {
                if (el.type === 'checkbox') {
                    setByPath(siteData, el.dataset.path, el.checked);
                }
            });
        });

        container.querySelectorAll('[data-upload]').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = () => {
                    const file = input.files[0];
                    if (!file) return;
                    if (file.size > 3 * 1024 * 1024) {
                        toast('Файлът е твърде голям (макс. 3MB). Използвайте URL.', 'error');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                        const path = btn.dataset.upload;
                        setByPath(siteData, path, reader.result);
                        const textEl = container.querySelector(`[data-path="${path}"]`);
                        if (textEl) textEl.value = reader.result.substring(0, 60) + '...';
                        updatePreview(btn.dataset.preview, reader.result);
                        toast('Изображението е качено');
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            });
        });

        container.querySelectorAll('[data-clear-img]').forEach(btn => {
            btn.addEventListener('click', () => {
                setByPath(siteData, btn.dataset.clearImg, '');
                const textEl = container.querySelector(`[data-path="${btn.dataset.clearImg}"]`);
                if (textEl) textEl.value = '';
                updatePreview(btn.dataset.preview, '');
                toast('Изображението е премахнато');
            });
        });
    }

    function updatePreview(previewId, url) {
        const el = document.getElementById(previewId);
        if (!el) return;
        el.innerHTML = url
            ? `<img src="${url}" alt="">`
            : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:11px;">Няма</div>';
    }

    function renderMeta() {
        const m = siteData.meta;
        return `
            <div class="help-box"><i class="fas fa-lightbulb"></i> Тук променяте заглавието на страницата и описанието, което търсачките виждат.</div>
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>SEO и заглавие</h3></div>
                <div class="admin-panel-body">
                    ${field('Заглавие на сайта (tab)', '', textInput('meta.title', m.title))}
                    ${field('Описание (meta description)', 'Кратко описание за Google и социални мрежи', textareaInput('meta.description', m.description))}
                </div>
            </div>`;
    }

    function renderHeader() {
        const h = siteData.header;
        return `
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Горен хедър</h3><p>Таглайн в центъра и бутон „Свържете се“ вдясно</p></div>
                <div class="admin-panel-body">
                    ${field('Таглайн (център)', 'напр. Архитектура · Дизайн · Интериор', textInput('header.subtitle', h.subtitle))}
                    ${field('Текст на бутона', '', textInput('header.ctaText', h.ctaText))}
                    <div class="field-row">
                        ${field('Facebook линк', '', textInput('header.social.facebook', h.social.facebook))}
                        ${field('Instagram линк', '', textInput('header.social.instagram', h.social.instagram))}
                    </div>
                    ${field('Pinterest линк', '', textInput('header.social.pinterest', h.social.pinterest))}
                    <div class="field-row">
                        ${field('Имейл (меню)', '', textInput('header.contacts.email', h.contacts.email))}
                        ${field('Телефон (меню)', '', textInput('header.contacts.phone', h.contacts.phone))}
                    </div>
                </div>
            </div>`;
    }

    function renderHero() {
        const hero = siteData.hero;
        let slides = hero.slides.map((s, i) => `
            <div class="list-item" data-hero-index="${i}">
                <div class="list-item-header" data-toggle-item>
                    <h4>Слайд ${i + 1}: ${escHtml(s.title)} ${escHtml(s.subtitle)}</h4>
                    <div class="item-actions">
                        <button type="button" class="btn btn-danger btn-sm" data-delete-hero="${i}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="list-item-body">
                    <div class="field-row">
                        ${field('Година', '', textInput(`hero.slides.${i}.date`, s.date))}
                        ${field('Заглавие', '', textInput(`hero.slides.${i}.title`, s.title))}
                    </div>
                    ${field('Подзаглавие', '', textInput(`hero.slides.${i}.subtitle`, s.subtitle))}
                    ${field('Описание', '', textareaInput(`hero.slides.${i}.desc`, s.desc))}
                    ${imageField(`hero.slides.${i}.image`, s.image, 'Фоново изображение', 'Препоръчителен размер: 1920×1080 px')}
                </div>
            </div>`).join('');

        return `
            <div class="help-box"><i class="fas fa-lightbulb"></i> Слайдерът е първото нещо, което посетителите виждат. Добавете 2–4 слайда с най-добрите ви проекти.</div>
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Общи настройки на слайдера</h3></div>
                <div class="admin-panel-body">
                    ${field('Приветствен текст', '', textInput('hero.welcome', hero.welcome))}
                    ${field('Текст „скрол надолу“', '', textInput('hero.scrollText', hero.scrollText))}
                </div>
            </div>
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Слайдове</h3></div>
                <div class="admin-panel-body" id="heroSlides">${slides}</div>
                <div class="admin-panel-body add-item-bar">
                    <button type="button" class="btn btn-secondary" id="addHeroSlide"><i class="fas fa-plus"></i> Добави слайд</button>
                </div>
            </div>`;
    }

    function renderAbout() {
        const a = siteData.about;
        const servicesList = a.services.map((s, i) => `
            <div class="gallery-image-row">
                ${textInput(`about.services.${i}`, s)}
                <button type="button" class="btn btn-danger btn-sm" data-delete-about-service="${i}"><i class="fas fa-times"></i></button>
            </div>`).join('');

        const counters = a.counters.map((c, i) => `
            <div class="field-row" style="margin-bottom:12px">
                ${field('Число', '', textInput(`about.counters.${i}.value`, c.value))}
                ${field('Етикет', '', textInput(`about.counters.${i}.label`, c.label))}
            </div>`).join('');

        return `
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Секция „За нас“</h3></div>
                <div class="admin-panel-body">
                    ${field('Заглавие на секцията', '', textInput('about.title', a.title))}
                    ${field('Подзаглавие', '', textareaInput('about.subtitle', a.subtitle))}
                    ${field('Заглавие на текста', '', textInput('about.heading', a.heading))}
                    ${field('Първи параграф', '', textareaInput('about.text1', a.text1))}
                    ${field('Втори параграф', '', textareaInput('about.text2', a.text2))}
                    ${imageField('about.image', a.image, 'Снимка', 'Портретна или интериорна снимка')}
                    <div class="field"><label>Какво правим (списък)</label><div class="gallery-images-list" id="aboutServices">${servicesList}</div>
                        <button type="button" class="btn btn-secondary btn-sm" id="addAboutService" style="margin-top:10px"><i class="fas fa-plus"></i> Добави</button>
                    </div>
                    <div class="field"><label>Броячи (статистика)</label>${counters}
                        <button type="button" class="btn btn-secondary btn-sm" id="addCounter" style="margin-top:10px"><i class="fas fa-plus"></i> Добави брояч</button>
                    </div>
                </div>
            </div>`;
    }

    function renderPortfolio() {
        const p = siteData.portfolio;
        const projects = p.projects.map((proj, i) => {
            const galleryRows = (proj.images || []).map((img, j) => `
                <div class="gallery-image-row">
                    <img class="thumb" src="${escAttr(img)}" alt="">
                    <input type="text" data-path="portfolio.projects.${i}.images.${j}" value="${escAttr(img)}">
                    <button type="button" class="btn btn-danger btn-sm" data-delete-gallery="${i}.${j}"><i class="fas fa-times"></i></button>
                </div>`).join('');

            return `
            <div class="list-item" data-project-index="${i}">
                <div class="list-item-header" data-toggle-item>
                    <h4>${escHtml(proj.title)} — ${escHtml(proj.categoryLabel)}</h4>
                    <div class="item-actions">
                        <button type="button" class="btn btn-danger btn-sm" data-delete-project="${i}"><i class="fas fa-trash"></i> Изтрий</button>
                    </div>
                </div>
                <div class="list-item-body">
                    <div class="field-row">
                        ${field('ID (латиница, без интервали)', 'напр. aura, sea-view', textInput(`portfolio.projects.${i}.id`, proj.id))}
                        ${field('Заглавие', '', textInput(`portfolio.projects.${i}.title`, proj.title))}
                    </div>
                    <div class="field-row">
                        ${field('Категория (код)', 'apartment или house', textInput(`portfolio.projects.${i}.category`, proj.category))}
                        ${field('Категория (етикет)', '', textInput(`portfolio.projects.${i}.categoryLabel`, proj.categoryLabel))}
                    </div>
                    <div class="field-row">
                        ${field('Локация', '', textInput(`portfolio.projects.${i}.location`, proj.location))}
                        ${field('Площ', '', textInput(`portfolio.projects.${i}.area`, proj.area))}
                    </div>
                    <div class="field-row">
                        ${field('Година', '', textInput(`portfolio.projects.${i}.year`, proj.year))}
                        ${field('Стил', '', textInput(`portfolio.projects.${i}.style`, proj.style))}
                    </div>
                    ${field('Описание', '', textareaInput(`portfolio.projects.${i}.description`, proj.description))}
                    ${field('Широк елемент в мрежата', '', `<label><input type="checkbox" data-path="portfolio.projects.${i}.wide" ${proj.wide ? 'checked' : ''}> Да — заема 2 колони</label>`)}
                    ${imageField(`portfolio.projects.${i}.cover`, proj.cover, 'Корица', 'Основната снимка в портфолио мрежата')}
                    <div class="field">
                        <label>Галерия (снимки в модала)</label>
                        <div class="gallery-images-list" id="gallery_${i}">${galleryRows}</div>
                        <div class="btn-row" style="margin-top:10px">
                            <button type="button" class="btn btn-secondary btn-sm" data-add-gallery="${i}"><i class="fas fa-plus"></i> Добави снимка (URL)</button>
                            <button type="button" class="btn btn-secondary btn-sm" data-upload-gallery="${i}"><i class="fas fa-upload"></i> Качи снимка</button>
                        </div>
                    </div>
                    ${imageField(`portfolio.projects.${i}.panorama`, proj.panorama, '360° панорама', 'Equirectangular изображение (2:1). Качва се само оттук — на сайта е само преглед.', true)}
                </div>
            </div>`;
        }).join('');

        return `
            <div class="help-box"><i class="fas fa-lightbulb"></i> Всеки проект се отваря в модал с галерия и 360° изглед. Качването на панорама става само оттук.</div>
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Портфолио</h3></div>
                <div class="admin-panel-body">
                    ${field('Заглавие на секцията', '', textInput('portfolio.title', p.title))}
                    ${field('Подзаглавие', '', textareaInput('portfolio.subtitle', p.subtitle))}
                </div>
            </div>
            <div id="portfolioProjects">${projects}</div>
            <button type="button" class="btn btn-secondary" id="addProject"><i class="fas fa-plus"></i> Добави нов проект</button>`;
    }

    function renderServices() {
        const s = siteData.services;
        const items = s.items.map((item, i) => `
            <div class="list-item">
                <div class="list-item-header" data-toggle-item>
                    <h4>${escHtml(item.num)} — ${escHtml(item.title)}</h4>
                    <button type="button" class="btn btn-danger btn-sm" data-delete-service="${i}"><i class="fas fa-trash"></i></button>
                </div>
                <div class="list-item-body">
                    <div class="field-row">
                        ${field('Номер', '', textInput(`services.items.${i}.num`, item.num))}
                        ${field('Икона (Font Awesome)', 'напр. fa-star', textInput(`services.items.${i}.icon`, item.icon))}
                    </div>
                    ${field('Заглавие', '', textInput(`services.items.${i}.title`, item.title))}
                    ${field('Описание', '', textareaInput(`services.items.${i}.desc`, item.desc))}
                    ${field('Цена (число)', '', textInput(`services.items.${i}.price`, item.price))}
                    ${field('Препоръчан пакет', '', `<label><input type="checkbox" data-path="services.items.${i}.featured" ${item.featured ? 'checked' : ''}> Да</label>`)}
                    <div class="field"><label>Характеристики (по един на ред)</label>
                        <textarea data-path="services.items.${i}.features" rows="4">${escHtml((item.features || []).join('\n'))}</textarea>
                        <p class="field-hint">Всяка характеристика на нов ред</p>
                    </div>
                </div>
            </div>`).join('');

        return `
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Услуги</h3></div>
                <div class="admin-panel-body">
                    ${field('Заглавие', '', textInput('services.title', s.title))}
                    ${field('Подзаглавие', '', textareaInput('services.subtitle', s.subtitle))}
                </div>
            </div>
            <div id="servicesItems">${items}</div>
            <button type="button" class="btn btn-secondary" id="addService"><i class="fas fa-plus"></i> Добави услуга</button>`;
    }

    function renderVideo() {
        const v = siteData.video;
        return `
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Видео секция</h3></div>
                <div class="admin-panel-body">
                    ${field('Заглавие', '', textInput('video.title', v.title))}
                    ${field('Текст', '', textareaInput('video.text', v.text))}
                    ${imageField('video.image', v.image, 'Корица на видеото', '')}
                    ${field('YouTube embed URL', 'напр. https://www.youtube.com/embed/VIDEO_ID', textInput('video.youtube', v.youtube))}
                    ${field('YouTube канал', '', textInput('video.channelUrl', v.channelUrl))}
                </div>
            </div>`;
    }

    function renderTeam() {
        const t = siteData.team;
        const members = t.members.map((m, i) => `
            <div class="list-item">
                <div class="list-item-header" data-toggle-item>
                    <h4>${escHtml(m.name)}</h4>
                    <button type="button" class="btn btn-danger btn-sm" data-delete-member="${i}"><i class="fas fa-trash"></i></button>
                </div>
                <div class="list-item-body">
                    <div class="field-row">
                        ${field('Номер', '', textInput(`team.members.${i}.num`, m.num))}
                        ${field('Име', '', textInput(`team.members.${i}.name`, m.name))}
                    </div>
                    ${field('Длъжност', '', textInput(`team.members.${i}.role`, m.role))}
                    ${field('Биография', '', textareaInput(`team.members.${i}.bio`, m.bio))}
                    <div class="field-row">
                        ${field('Телефон', '', textInput(`team.members.${i}.phone`, m.phone))}
                        ${field('Имейл', '', textInput(`team.members.${i}.email`, m.email))}
                    </div>
                    ${imageField(`team.members.${i}.image`, m.image, 'Снимка', '')}
                </div>
            </div>`).join('');

        return `
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Екип</h3></div>
                <div class="admin-panel-body">
                    ${field('Заглавие', '', textInput('team.title', t.title))}
                    ${field('Подзаглавие', '', textareaInput('team.subtitle', t.subtitle))}
                </div>
            </div>
            <div id="teamMembers">${members}</div>
            <button type="button" class="btn btn-secondary" id="addMember"><i class="fas fa-plus"></i> Добави член</button>`;
    }

    function renderTestimonials() {
        const t = siteData.testimonials;
        const items = t.items.map((item, i) => `
            <div class="list-item">
                <div class="list-item-header" data-toggle-item>
                    <h4>${escHtml(item.name)}</h4>
                    <button type="button" class="btn btn-danger btn-sm" data-delete-testimonial="${i}"><i class="fas fa-trash"></i></button>
                </div>
                <div class="list-item-body">
                    ${field('Име', '', textInput(`testimonials.items.${i}.name`, item.name))}
                    ${field('Текст на отзива', '', textareaInput(`testimonials.items.${i}.text`, item.text))}
                    ${field('Източник', 'напр. .01 Чрез Facebook', textInput(`testimonials.items.${i}.source`, item.source))}
                    ${imageField(`testimonials.items.${i}.avatar`, item.avatar, 'Аватар', '')}
                </div>
            </div>`).join('');

        return `
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Отзиви</h3></div>
                <div class="admin-panel-body">
                    ${field('Заглавие', '', textInput('testimonials.title', t.title))}
                    ${field('Подзаглавие', '', textareaInput('testimonials.subtitle', t.subtitle))}
                </div>
            </div>
            <div id="testimonialItems">${items}</div>
            <button type="button" class="btn btn-secondary" id="addTestimonial"><i class="fas fa-plus"></i> Добави отзив</button>`;
    }

    function renderContact() {
        const c = siteData.contact;
        return `
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Контакти</h3></div>
                <div class="admin-panel-body">
                    ${field('Заглавие', '', textInput('contact.title', c.title))}
                    ${field('Подзаглавие', '', textareaInput('contact.subtitle', c.subtitle))}
                    ${field('Адрес', '', textInput('contact.address', c.address))}
                    <div class="field-row">
                        ${field('Телефон', '', textInput('contact.phone', c.phone))}
                        ${field('Имейл', '', textInput('contact.email', c.email))}
                    </div>
                    ${field('Работно време', '', textInput('contact.hours', c.hours))}
                </div>
            </div>`;
    }

    function renderFooter() {
        const f = siteData.footer;
        const s = f.social || {};
        return `
            <div class="admin-panel">
                <div class="admin-panel-header"><h3>Футър</h3></div>
                <div class="admin-panel-body">
                    ${field('Кратко описание', '', textareaInput('footer.about', f.about))}
                    ${field('Текст за бюлетин', '', textareaInput('footer.newsletterText', f.newsletterText))}
                    ${field('Авторски права', '', textInput('footer.copyright', f.copyright))}
                    <div class="field-row">
                        ${field('Facebook', '', textInput('footer.social.facebook', s.facebook || ''))}
                        ${field('Instagram', '', textInput('footer.social.instagram', s.instagram || ''))}
                    </div>
                    <div class="field-row">
                        ${field('Pinterest', '', textInput('footer.social.pinterest', s.pinterest || ''))}
                        ${field('YouTube', '', textInput('footer.social.youtube', s.youtube || ''))}
                    </div>
                </div>
            </div>`;
    }

    const RENDERERS = {
        meta: renderMeta,
        header: renderHeader,
        hero: renderHero,
        about: renderAbout,
        portfolio: renderPortfolio,
        services: renderServices,
        video: renderVideo,
        team: renderTeam,
        testimonials: renderTestimonials,
        contact: renderContact,
        footer: renderFooter
    };

    function renderSection(section) {
        currentSection = section;
        $('sectionTitle').textContent = SECTION_TITLES[section] || section;
        document.querySelectorAll('.admin-nav button').forEach(b => {
            b.classList.toggle('active', b.dataset.section === section);
        });
        const content = $('adminContent');
        if (section === 'inquiries') {
            renderInquiriesSection(content);
            return;
        }
        content.innerHTML = RENDERERS[section]();
        bindFields(content);
        bindSectionActions(content, section);
    }

    function bindSectionActions(container, section) {
        container.querySelectorAll('[data-toggle-item]').forEach(header => {
            header.addEventListener('click', e => {
                if (e.target.closest('button')) return;
                header.parentElement.classList.toggle('open');
            });
        });

        if (section === 'hero') {
            $('addHeroSlide')?.addEventListener('click', () => {
                siteData.hero.slides.push({
                    date: '2024', title: 'Нов', subtitle: 'Проект',
                    desc: 'Описание на проекта', image: ''
                });
                renderSection('hero');
            });
            container.querySelectorAll('[data-delete-hero]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    if (!confirm('Изтриване на слайда?')) return;
                    siteData.hero.slides.splice(+btn.dataset.deleteHero, 1);
                    renderSection('hero');
                });
            });
        }

        if (section === 'about') {
            $('addAboutService')?.addEventListener('click', () => {
                siteData.about.services.push('Нова услуга');
                renderSection('about');
            });
            container.querySelectorAll('[data-delete-about-service]').forEach(btn => {
                btn.addEventListener('click', () => {
                    siteData.about.services.splice(+btn.dataset.deleteAboutService, 1);
                    renderSection('about');
                });
            });
            $('addCounter')?.addEventListener('click', () => {
                siteData.about.counters.push({ value: 0, label: 'Нов брояч' });
                renderSection('about');
            });
        }

        if (section === 'portfolio') {
            $('addProject')?.addEventListener('click', () => {
                siteData.portfolio.projects.push({
                    id: 'new-project-' + Date.now(),
                    title: 'Нов проект', category: 'apartment', categoryLabel: 'Апартамент',
                    location: 'Бургас', area: '100 кв.м.', year: '2024', style: 'Модерен',
                    description: '', cover: '', images: [], panorama: '', wide: false
                });
                renderSection('portfolio');
            });
            container.querySelectorAll('[data-delete-project]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    if (!confirm('Изтриване на проекта?')) return;
                    siteData.portfolio.projects.splice(+btn.dataset.deleteProject, 1);
                    renderSection('portfolio');
                });
            });
            container.querySelectorAll('[data-add-gallery]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const i = +btn.dataset.addGallery;
                    siteData.portfolio.projects[i].images.push('');
                    renderSection('portfolio');
                });
            });
            container.querySelectorAll('[data-upload-gallery]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const i = +btn.dataset.uploadGallery;
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = () => {
                        const file = input.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                            siteData.portfolio.projects[i].images.push(reader.result);
                            renderSection('portfolio');
                            toast('Снимката е добавена в галерията');
                        };
                        reader.readAsDataURL(file);
                    };
                    input.click();
                });
            });
            container.querySelectorAll('[data-delete-gallery]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const [pi, gi] = btn.dataset.deleteGallery.split('.').map(Number);
                    siteData.portfolio.projects[pi].images.splice(gi, 1);
                    renderSection('portfolio');
                });
            });
        }

        if (section === 'services') {
            $('addService')?.addEventListener('click', () => {
                siteData.services.items.push({
                    num: '0' + (siteData.services.items.length + 1),
                    icon: 'fa-star', title: 'Нова услуга', desc: '', price: '0',
                    features: [], featured: false
                });
                renderSection('services');
            });
            container.querySelectorAll('[data-delete-service]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    siteData.services.items.splice(+btn.dataset.deleteService, 1);
                    renderSection('services');
                });
            });
            container.querySelectorAll('[data-path*="features"]').forEach(ta => {
                ta.addEventListener('input', () => {
                    const path = ta.dataset.path;
                    setByPath(siteData, path, ta.value.split('\n').filter(Boolean));
                });
            });
        }

        if (section === 'team') {
            $('addMember')?.addEventListener('click', () => {
                siteData.team.members.push({
                    num: '0' + (siteData.team.members.length + 1),
                    name: 'Ново име', role: 'ДЛЪЖНОСТ', bio: '',
                    phone: '', email: '', image: ''
                });
                renderSection('team');
            });
            container.querySelectorAll('[data-delete-member]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    siteData.team.members.splice(+btn.dataset.deleteMember, 1);
                    renderSection('team');
                });
            });
        }

        if (section === 'testimonials') {
            $('addTestimonial')?.addEventListener('click', () => {
                siteData.testimonials.items.push({
                    name: 'Име', text: 'Текст на отзива', source: '.01 Чрез Facebook', avatar: ''
                });
                renderSection('testimonials');
            });
            container.querySelectorAll('[data-delete-testimonial]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    siteData.testimonials.items.splice(+btn.dataset.deleteTestimonial, 1);
                    renderSection('testimonials');
                });
            });
        }
    }

    function collectFormData() {
        const content = $('adminContent');
        content.querySelectorAll('[data-path]').forEach(el => {
            let val = el.type === 'checkbox' ? el.checked : el.value;
            if (el.dataset.path.includes('.features') && el.tagName === 'TEXTAREA') {
                val = el.value.split('\n').filter(Boolean);
            }
            setByPath(siteData, el.dataset.path, val);
        });
    }

    function savePreview() {
        collectFormData();
        localStorage.setItem(STORAGE_PREVIEW, JSON.stringify(siteData));
        toast('Прегледът е запазен — отворете main.html');
    }

    function downloadJson() {
        collectFormData();
        const blob = new Blob([JSON.stringify(siteData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'site-data.json';
        a.click();
        toast('Файлът site-data.json е изтеглен');
    }

    async function publish() {
        if (!hasRealToken()) {
            toast('За публикуване онлайн е необходим вход с парола (не само *admin).', 'error');
            return;
        }
        collectFormData();
        try {
            await publishData(siteData);
            localStorage.removeItem(STORAGE_PREVIEW);
            toast('Сайтът е публикуван успешно!');
        } catch (e) {
            savePreview();
            toast(e.message + ' — запазен е локален преглед.', 'error');
        }
    }

    function showAdmin() {
        document.body.classList.add('admin-logged-in');
        const login = $('loginScreen');
        login.hidden = true;
        login.style.display = 'none';
        const app = $('adminApp');
        app.hidden = false;
        app.style.display = 'flex';
        renderSection('meta');
        refreshInquiriesAndAlert();
    }

    async function refreshInquiriesAndAlert() {
        inquiriesCache = await loadInquiries();
        updateInquiriesBadge();
        await showInquiriesAlertModal();
    }

    async function init() {
        document.querySelectorAll('.admin-nav button').forEach(btn => {
            btn.addEventListener('click', () => {
                collectFormData();
                renderSection(btn.dataset.section);
            });
        });

        $('loginForm').addEventListener('submit', async e => {
            e.preventDefault();
            const pwd = $('adminPassword').value;
            const ok = await authenticate(pwd);
            if (ok) {
                $('loginError').classList.remove('visible');
                siteData = await loadSiteData();
                showAdmin();
            } else {
                $('loginError').classList.add('visible');
            }
        });

        $('logoutBtn').addEventListener('click', e => {
            e.preventDefault();
            sessionStorage.removeItem(STORAGE_TOKEN);
            sessionStorage.removeItem(QUICK_ENTRY_KEY);
            document.body.classList.remove('admin-logged-in');
            $('adminApp').hidden = true;
            $('adminApp').style.display = '';
            const login = $('loginScreen');
            login.hidden = false;
            login.style.display = '';
            $('adminPassword').value = '';
            hideInquiriesAlertModal();
        });

        $('closeInquiriesAlert')?.addEventListener('click', hideInquiriesAlertModal);
        $('goToInquiriesBtn')?.addEventListener('click', () => {
            hideInquiriesAlertModal();
            collectFormData();
            renderSection('inquiries');
        });
        $('markAllReadBtn')?.addEventListener('click', async () => {
            await patchInquiry('markAllRead');
            updateInquiriesBadge();
            hideInquiriesAlertModal();
            if (currentSection === 'inquiries') await renderInquiriesSection($('adminContent'));
        });

        $('btnPreview').addEventListener('click', () => {
            savePreview();
            window.open('main.html', '_blank');
        });

        $('btnDownload').addEventListener('click', downloadJson);
        $('btnPublish').addEventListener('click', publish);

        if (isQuickEntry()) {
            if (!sessionStorage.getItem(STORAGE_TOKEN)) {
                sessionStorage.setItem(STORAGE_TOKEN, 'quick-entry');
            }
            siteData = await loadSiteData();
            showAdmin();
            return;
        }

        if (sessionStorage.getItem(STORAGE_TOKEN)) {
            siteData = await loadSiteData();
            showAdmin();
        }
    }

    init();
})();
