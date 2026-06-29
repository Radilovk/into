(function () {
    'use strict';

    let pannellumViewer = null;

    function destroyPanorama() {
        if (pannellumViewer) {
            try { pannellumViewer.destroy(); } catch (e) { /* ignore */ }
            pannellumViewer = null;
        }
        const el = document.getElementById('panoramaViewer');
        if (el) el.innerHTML = '';
    }

    function initPanorama(url) {
        destroyPanorama();
        const el = document.getElementById('panoramaViewer');
        const hint = document.getElementById('panoramaHint');
        if (!url) {
            el.innerHTML = '<div class="panorama-placeholder"><i class="fas fa-street-view"></i><p>360° изгледът не е наличен за този проект.</p></div>';
            if (hint) hint.style.display = 'none';
            return;
        }
        if (hint) hint.style.display = 'flex';
        if (typeof pannellum === 'undefined') return;
        pannellumViewer = pannellum.viewer('panoramaViewer', {
            type: 'equirectangular',
            panorama: url,
            autoLoad: true,
            showControls: true,
            compass: false,
            hfov: 100
        });
    }

    function initProjectModal() {
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
        const tabs = document.querySelectorAll('.project-tab');
        const panels = document.querySelectorAll('.project-tab-panel');

        let currentProject = null;
        let currentImgIndex = 0;

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
                    renderThumbs(images);
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
                const id = 'panel' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
                p.classList.toggle('active', p.id === id);
            });
            if (tabName === 'panorama' && currentProject) {
                initPanorama(currentProject.panorama || null);
            }
        }

        function openProject(id) {
            const projects = window.PROJECTS || {};
            const project = projects[id];
            if (!project || !modal) return;

            currentProject = project;
            currentImgIndex = 0;
            destroyPanorama();

            titleEl.textContent = project.title;
            catEl.textContent = project.categoryLabel || project.category;
            metaEl.textContent = `${project.location} · ${project.area} · ${project.year} · ${project.style}`;
            descEl.textContent = project.description;

            const images = project.images && project.images.length ? project.images : [project.cover];
            mainImg.src = images[0];
            mainImg.alt = project.title;
            renderThumbs(images);

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
        }

        function bindGallery() {
            document.querySelectorAll('.gallery-item[data-project]').forEach(item => {
                if (item.dataset.modalBound) return;
                item.dataset.modalBound = '1';
                const open = () => openProject(item.dataset.project);
                item.addEventListener('click', open);
                item.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                });
            });
        }

        bindGallery();

        closeBtn.addEventListener('click', closeProject);
        backdrop.addEventListener('click', closeProject);

        document.addEventListener('keydown', e => {
            if (!modal.classList.contains('active')) return;
            if (e.key === 'Escape') closeProject();
            if (!currentProject) return;
            const images = currentProject.images || [currentProject.cover];
            if (e.key === 'ArrowLeft') {
                currentImgIndex = (currentImgIndex - 1 + images.length) % images.length;
                mainImg.src = images[currentImgIndex];
                renderThumbs(images);
            }
            if (e.key === 'ArrowRight') {
                currentImgIndex = (currentImgIndex + 1) % images.length;
                mainImg.src = images[currentImgIndex];
                renderThumbs(images);
            }
        });

        imgPrev.addEventListener('click', () => {
            if (!currentProject) return;
            const images = currentProject.images || [currentProject.cover];
            currentImgIndex = (currentImgIndex - 1 + images.length) % images.length;
            mainImg.src = images[currentImgIndex];
            renderThumbs(images);
        });
        imgNext.addEventListener('click', () => {
            if (!currentProject) return;
            const images = currentProject.images || [currentProject.cover];
            currentImgIndex = (currentImgIndex + 1) % images.length;
            mainImg.src = images[currentImgIndex];
            renderThumbs(images);
        });

        tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

        document.addEventListener('site:rendered', bindGallery);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProjectModal);
    } else {
        initProjectModal();
    }
})();
