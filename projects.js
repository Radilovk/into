const PROJECTS = {
    'aura': {
        title: 'Aura',
        category: 'Апартамент',
        location: 'Бургас',
        area: '142 кв.м.',
        year: '2024',
        style: 'Модерен класик',
        description: 'Модерен дизайн с класически елементи. Топли неутрални тонове, естествени материали и внимателно подбрано осветление създават уютен и елегантен интериор с панорамна гледка.',
        images: [
            'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80',
            'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1200&q=80',
            'https://images.unsplash.com/photo-1600566752225-53762df0b979?w=1200&q=80',
            'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80'
        ],
        panorama: 'https://pannellum.org/images/cerro-toco-0.jpg'
    },
    'sea-view': {
        title: 'Sea View',
        category: 'Апартамент',
        location: 'Бургас',
        area: '72 кв.м.',
        year: '2024',
        style: 'Морски минимализъм',
        description: 'Компактен апартамент с панорамни гледки към морето. Светла палитра, отворено разпределение и функционални решения за максимално усещане за пространство.',
        images: [
            'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=80',
            'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80'
        ],
        panorama: 'https://pannellum.org/images/cerro-toco-0.jpg'
    },
    'gold-coast': {
        title: 'Gold Coast',
        category: 'Къща',
        location: 'Сарафово',
        area: '352 кв.м.',
        year: '2023',
        style: 'Japandi',
        description: 'Japandi стил с естествени материали — дърво, камък и лен. Просторна къща с плавен преход между вътрешните и външните зони.',
        images: [
            'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1200&q=80',
            'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=1200&q=80',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
            'https://images.unsplash.com/photo-1600566752225-53762df0b979?w=1200&q=80'
        ],
        panorama: 'https://pannellum.org/images/cerro-toco-0.jpg'
    },
    'coziness': {
        title: 'Coziness',
        category: 'Апартамент',
        location: 'Central Park',
        area: '75 кв.м.',
        year: '2024',
        style: 'Топъл минимализъм',
        description: 'Топли неутрални тонове и меки текстури за уютен домашен интериор. Функционално зониране и персонализирани мебели.',
        images: [
            'https://images.unsplash.com/photo-1600566752225-53762df0b979?w=1200&q=80',
            'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80',
            'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=80'
        ],
        panorama: null
    },
    'wabi-sabi': {
        title: 'Modern Wabi Sabi',
        category: 'Къща',
        location: 'Крайморие',
        area: '194 кв.м.',
        year: '2023',
        style: 'Wabi Sabi',
        description: 'Wabi Sabi стил с естествени материали и несъвършена красота. Органични форми, ръчна изработка и спокойна атмосфера.',
        images: [
            'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=1200&q=80',
            'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1200&q=80',
            'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80'
        ],
        panorama: 'https://pannellum.org/images/cerro-toco-0.jpg'
    },
    'back-to-black': {
        title: 'Back to Black',
        category: 'Къща',
        location: 'Лозово',
        area: '268 кв.м.',
        year: '2023',
        style: 'Смел модерн',
        description: 'Смел модерен дизайн с черни акценти и контрастни материали. Драматично осветление и архитектурни детайли.',
        images: [
            'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80',
            'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=1200&q=80',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80'
        ],
        panorama: null
    }
};

(function () {
    'use strict';

    const modal = document.getElementById('projectModal');
    const backdrop = document.getElementById('projectModalBackdrop');
    const closeBtn = document.getElementById('projectModalClose');
    const titleEl = document.getElementById('projectModalTitle');
    const catEl = document.getElementById('projectModalCat');
    const metaEl = document.getElementById('projectModalMeta');
    const descEl = document.getElementById('projectModalDesc');
    const mainImg = document.getElementById('modalMainImg');
    const thumbsEl = document.getElementById('modalThumbs');
    const imgPrev = document.getElementById('modalImgPrev');
    const imgNext = document.getElementById('modalImgNext');
    const panoramaEl = document.getElementById('panoramaViewer');
    const panoramaUpload = document.getElementById('panoramaUpload');
    const tabs = document.querySelectorAll('.project-tab');
    const panels = document.querySelectorAll('.project-tab-panel');

    let currentProject = null;
    let currentImgIndex = 0;
    let pannellumViewer = null;
    let uploadedPanoramaUrl = null;

    function destroyPanorama() {
        if (pannellumViewer) {
            try { pannellumViewer.destroy(); } catch (e) { /* ignore */ }
            pannellumViewer = null;
        }
        if (uploadedPanoramaUrl) {
            URL.revokeObjectURL(uploadedPanoramaUrl);
            uploadedPanoramaUrl = null;
        }
        panoramaEl.innerHTML = '';
    }

    function initPanorama(url) {
        destroyPanorama();
        if (!url || typeof pannellum === 'undefined') {
            panoramaEl.innerHTML = '<div class="panorama-placeholder"><i class="fas fa-street-view"></i><p>Няма 360° изображение за този проект.<br>Качете equirectangular файл по-долу.</p></div>';
            return;
        }
        pannellumViewer = pannellum.viewer('panoramaViewer', {
            type: 'equirectangular',
            panorama: url,
            autoLoad: true,
            showControls: true,
            compass: false,
            hfov: 100
        });
    }

    function renderThumbs(images) {
        thumbsEl.innerHTML = '';
        images.forEach((src, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'modal-thumb' + (i === currentImgIndex ? ' active' : '');
            btn.innerHTML = `<img src="${src.replace('w=1200', 'w=200')}" alt="">`;
            btn.addEventListener('click', () => {
                currentImgIndex = i;
                mainImg.src = images[i];
                thumbsEl.querySelectorAll('.modal-thumb').forEach((t, j) => {
                    t.classList.toggle('active', j === i);
                });
            });
            thumbsEl.appendChild(btn);
        });
    }

    function switchTab(tabName) {
        tabs.forEach(t => {
            const active = t.dataset.tab === tabName;
            t.classList.toggle('active', active);
            t.setAttribute('aria-selected', active);
        });
        panels.forEach(p => {
            p.classList.toggle('active', p.id === 'panel' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
        });
        if (tabName === 'panorama' && currentProject) {
            const url = uploadedPanoramaUrl || currentProject.panorama;
            initPanorama(url);
        }
    }

    function openProject(id) {
        const project = PROJECTS[id];
        if (!project || !modal) return;

        currentProject = project;
        currentImgIndex = 0;
        destroyPanorama();

        titleEl.textContent = project.title;
        catEl.textContent = project.category;
        metaEl.textContent = `${project.location} · ${project.area} · ${project.year} · ${project.style}`;
        descEl.textContent = project.description;

        mainImg.src = project.images[0];
        mainImg.alt = project.title;
        renderThumbs(project.images);

        switchTab('gallery');
        modal.classList.add('active');
        document.body.classList.add('nav-open');
        closeBtn.focus();
    }

    function closeProject() {
        modal.classList.remove('active');
        document.body.classList.remove('nav-open');
        destroyPanorama();
        currentProject = null;
        if (panoramaUpload) panoramaUpload.value = '';
    }

    document.querySelectorAll('.gallery-item[data-project]').forEach(item => {
        const open = () => openProject(item.dataset.project);
        item.addEventListener('click', open);
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });

    closeBtn.addEventListener('click', closeProject);
    backdrop.addEventListener('click', closeProject);

    document.addEventListener('keydown', e => {
        if (!modal.classList.contains('active')) return;
        if (e.key === 'Escape') closeProject();
        if (e.key === 'ArrowLeft' && currentProject) {
            currentImgIndex = (currentImgIndex - 1 + currentProject.images.length) % currentProject.images.length;
            mainImg.src = currentProject.images[currentImgIndex];
            renderThumbs(currentProject.images);
        }
        if (e.key === 'ArrowRight' && currentProject) {
            currentImgIndex = (currentImgIndex + 1) % currentProject.images.length;
            mainImg.src = currentProject.images[currentImgIndex];
            renderThumbs(currentProject.images);
        }
    });

    imgPrev.addEventListener('click', () => {
        if (!currentProject) return;
        currentImgIndex = (currentImgIndex - 1 + currentProject.images.length) % currentProject.images.length;
        mainImg.src = currentProject.images[currentImgIndex];
        renderThumbs(currentProject.images);
    });

    imgNext.addEventListener('click', () => {
        if (!currentProject) return;
        currentImgIndex = (currentImgIndex + 1) % currentProject.images.length;
        mainImg.src = currentProject.images[currentImgIndex];
        renderThumbs(currentProject.images);
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    panoramaUpload.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        if (uploadedPanoramaUrl) URL.revokeObjectURL(uploadedPanoramaUrl);
        uploadedPanoramaUrl = URL.createObjectURL(file);
        switchTab('panorama');
        initPanorama(uploadedPanoramaUrl);
    });

    document.querySelector('.panorama-upload-label')?.addEventListener('click', () => {
        panoramaUpload.click();
    });
})();
