(function () {
    'use strict';

    let pannellumViewer = null;
    let lightboxPannellum = null;
    let lightboxMode = null;
    let pinchCleanup = null;

    function toFullQualityUrl(url) {
        if (!url) return url;
        try {
            const u = new URL(url, window.location.href);
            if (u.hostname.includes('unsplash.com')) {
                u.searchParams.set('w', '2400');
                u.searchParams.set('q', '90');
                u.searchParams.set('auto', 'format');
                u.searchParams.set('fit', 'max');
            }
            return u.toString();
        } catch (e) {
            return url
                .replace(/([?&])w=\d+/g, '$1w=2400')
                .replace(/([?&])q=\d+/g, '$1q=90');
        }
    }

    function destroyPanorama() {
        if (pannellumViewer) {
            try { pannellumViewer.destroy(); } catch (e) { /* ignore */ }
            pannellumViewer = null;
        }
        const el = document.getElementById('panoramaViewer');
        if (el) el.innerHTML = '';
    }

    function destroyLightboxPanorama() {
        if (lightboxPannellum) {
            try { lightboxPannellum.destroy(); } catch (e) { /* ignore */ }
            lightboxPannellum = null;
        }
    }

    function initPanorama(url, targetId = 'panoramaViewer') {
        const el = document.getElementById(targetId);
        const hint = document.getElementById('panoramaHint');
        if (!el) return null;

        if (targetId === 'panoramaViewer') {
            destroyPanorama();
        } else {
            destroyLightboxPanorama();
        }

        if (!url) {
            el.innerHTML = '<div class="panorama-placeholder"><i class="fas fa-street-view"></i><p>360° изгледът не е наличен за този проект.</p></div>';
            if (hint) hint.style.display = 'none';
            return null;
        }

        if (hint && targetId === 'panoramaViewer') hint.style.display = 'flex';
        if (typeof pannellum === 'undefined') return null;

        const viewer = pannellum.viewer(targetId, {
            type: 'equirectangular',
            panorama: url,
            autoLoad: true,
            showControls: true,
            compass: false,
            hfov: 100,
            mouseZoom: true,
            draggable: true,
            friction: 0.15
        });

        if (targetId === 'panoramaViewer') {
            pannellumViewer = viewer;
        } else {
            lightboxPannellum = viewer;
        }
        return viewer;
    }

    function attachPinchZoom(wrap, img) {
        let scale = 1;
        let panX = 0;
        let panY = 0;
        let startDist = 0;
        let startScale = 1;
        let startPanX = 0;
        let startPanY = 0;
        let lastPanX = 0;
        let lastPanY = 0;
        let isPanning = false;
        let lastTap = 0;

        const minScale = 1;
        const maxScale = 4;

        function clampPan() {
            const rect = wrap.getBoundingClientRect();
            const imgW = img.naturalWidth * scale;
            const imgH = img.naturalHeight * scale;
            const maxX = Math.max(0, (imgW - rect.width) / 2);
            const maxY = Math.max(0, (imgH - rect.height) / 2);
            panX = Math.min(maxX, Math.max(-maxX, panX));
            panY = Math.min(maxY, Math.max(-maxY, panY));
        }

        function apply() {
            clampPan();
            img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        }

        function reset() {
            scale = 1;
            panX = 0;
            panY = 0;
            apply();
        }

        function dist(t1, t2) {
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            return Math.hypot(dx, dy);
        }

        function onTouchStart(e) {
            if (e.touches.length === 2) {
                isPanning = false;
                startDist = dist(e.touches[0], e.touches[1]);
                startScale = scale;
                startPanX = panX;
                startPanY = panY;
            } else if (e.touches.length === 1 && scale > 1) {
                isPanning = true;
                lastPanX = e.touches[0].clientX;
                lastPanY = e.touches[0].clientY;
            }
        }

        function onTouchMove(e) {
            if (e.touches.length === 2) {
                e.preventDefault();
                const ratio = dist(e.touches[0], e.touches[1]) / startDist;
                scale = Math.min(maxScale, Math.max(minScale, startScale * ratio));
                apply();
            } else if (e.touches.length === 1 && isPanning && scale > 1) {
                e.preventDefault();
                const dx = e.touches[0].clientX - lastPanX;
                const dy = e.touches[0].clientY - lastPanY;
                panX += dx;
                panY += dy;
                lastPanX = e.touches[0].clientX;
                lastPanY = e.touches[0].clientY;
                apply();
            }
        }

        function onTouchEnd(e) {
            if (e.touches.length < 2) {
                startDist = 0;
            }
            if (e.touches.length === 0) {
                isPanning = false;
                const now = Date.now();
                if (now - lastTap < 300) {
                    if (scale > 1) reset();
                    else {
                        scale = 2;
                        apply();
                    }
                }
                lastTap = now;
            }
        }

        function onWheel(e) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.12 : -0.12;
            scale = Math.min(maxScale, Math.max(minScale, scale + delta));
            if (scale === 1) {
                panX = 0;
                panY = 0;
            }
            apply();
        }

        let drag = false;
        let dragX = 0;
        let dragY = 0;

        function onMouseDown(e) {
            if (scale <= 1) return;
            drag = true;
            dragX = e.clientX;
            dragY = e.clientY;
        }

        function onMouseMove(e) {
            if (!drag) return;
            panX += e.clientX - dragX;
            panY += e.clientY - dragY;
            dragX = e.clientX;
            dragY = e.clientY;
            apply();
        }

        function onMouseUp() {
            drag = false;
        }

        function onDblClick() {
            if (scale > 1) reset();
            else {
                scale = 2;
                apply();
            }
        }

        wrap.addEventListener('touchstart', onTouchStart, { passive: false });
        wrap.addEventListener('touchmove', onTouchMove, { passive: false });
        wrap.addEventListener('touchend', onTouchEnd);
        wrap.addEventListener('wheel', onWheel, { passive: false });
        wrap.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        img.addEventListener('dblclick', onDblClick);

        reset();

        return () => {
            wrap.removeEventListener('touchstart', onTouchStart);
            wrap.removeEventListener('touchmove', onTouchMove);
            wrap.removeEventListener('touchend', onTouchEnd);
            wrap.removeEventListener('wheel', onWheel);
            wrap.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            img.removeEventListener('dblclick', onDblClick);
            img.style.transform = '';
        };
    }

    function initMediaLightbox() {
        const lightbox = document.getElementById('mediaLightbox');
        const stage = document.getElementById('mediaLightboxStage');
        const backBtn = document.getElementById('mediaLightboxBack');
        const hint = document.getElementById('mediaLightboxHint');
        if (!lightbox || !stage || !backBtn) return { openImage() {}, openPanorama() {}, close() {}, isOpen: () => false };

        let onCloseCallback = null;

        function setHint(text) {
            if (!hint) return;
            if (text) {
                hint.textContent = text;
                hint.hidden = false;
            } else {
                hint.hidden = true;
            }
        }

        function close() {
            if (pinchCleanup) {
                pinchCleanup();
                pinchCleanup = null;
            }
            destroyLightboxPanorama();
            stage.innerHTML = '';
            lightbox.classList.remove('active');
            lightbox.setAttribute('aria-hidden', 'true');
            setHint('');
            lightboxMode = null;
            document.body.classList.remove('media-lightbox-open');
            const cb = onCloseCallback;
            onCloseCallback = null;
            if (cb) cb();
        }

        function openImage(src, alt) {
            close();
            lightboxMode = 'image';
            onCloseCallback = null;

            const wrap = document.createElement('div');
            wrap.className = 'media-lightbox-image-wrap';
            const img = document.createElement('img');
            img.src = toFullQualityUrl(src);
            img.alt = alt || '';
            wrap.appendChild(img);
            stage.appendChild(wrap);

            const startView = () => {
                pinchCleanup = attachPinchZoom(wrap, img);
            };
            if (img.complete) startView();
            else img.addEventListener('load', startView, { once: true });

            setHint('Щипнете или двойно докосване за zoom · плъзнете за преместване');
            lightbox.classList.add('active');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.classList.add('media-lightbox-open');
            backBtn.focus();
        }

        function openPanorama(url, onClose) {
            if (!url) return;
            close();
            lightboxMode = 'panorama';
            onCloseCallback = onClose || null;

            const container = document.createElement('div');
            container.className = 'media-lightbox-panorama';
            container.id = 'mediaLightboxPanorama';
            stage.appendChild(container);

            initPanorama(url, 'mediaLightboxPanorama');
            setHint('Плъзнете за 360° преглед · щипнете за zoom');
            lightbox.classList.add('active');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.classList.add('media-lightbox-open');
            backBtn.focus();
        }

        backBtn.addEventListener('click', close);

        document.addEventListener('keydown', e => {
            if (!lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        });

        return {
            openImage,
            openPanorama,
            close,
            isOpen: () => lightbox.classList.contains('active')
        };
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
        const panoramaViewerEl = document.getElementById('panoramaViewer');

        const mediaLightbox = initMediaLightbox();

        let currentProject = null;
        let currentImgIndex = 0;
        let activeTab = 'gallery';

        function getImages() {
            if (!currentProject) return [];
            return currentProject.images && currentProject.images.length
                ? currentProject.images
                : [currentProject.cover];
        }

        function openCurrentImageFullscreen() {
            const images = getImages();
            if (!images.length || !mainImg) return;
            mediaLightbox.openImage(images[currentImgIndex], currentProject?.title || '');
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
                    renderThumbs(images);
                });
                thumbsEl.appendChild(btn);
            });
        }

        function switchTab(tabName) {
            activeTab = tabName;
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
            } else {
                destroyPanorama();
            }
        }

        function openPanoramaFullscreen() {
            if (!currentProject?.panorama) return;
            const url = currentProject.panorama;
            destroyPanorama();
            mediaLightbox.openPanorama(url, () => {
                if (modal.classList.contains('active') && activeTab === 'panorama') {
                    initPanorama(url);
                }
            });
        }

        function openProject(id) {
            const projects = window.PROJECTS || {};
            const project = projects[id];
            if (!project || !modal) return;

            currentProject = project;
            currentImgIndex = 0;
            destroyPanorama();
            mediaLightbox.close();

            titleEl.textContent = project.title;
            catEl.textContent = project.categoryLabel || project.category;
            metaEl.textContent = `${project.location} · ${project.area} · ${project.year} · ${project.style}`;
            descEl.textContent = project.description;

            const images = getImages();
            mainImg.src = images[0];
            mainImg.alt = project.title;
            renderThumbs(images);

            switchTab('gallery');
            modal.classList.add('active');
            document.body.classList.add('nav-open');
            closeBtn.focus();
        }

        function closeProject() {
            mediaLightbox.close();
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

        mainImg.addEventListener('click', openCurrentImageFullscreen);

        if (panoramaViewerEl) {
            panoramaViewerEl.addEventListener('click', () => {
                if (currentProject?.panorama) openPanoramaFullscreen();
            });
        }

        document.addEventListener('keydown', e => {
            if (mediaLightbox.isOpen()) return;
            if (!modal.classList.contains('active')) return;
            if (e.key === 'Escape') closeProject();
            if (!currentProject) return;
            const images = getImages();
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

        imgPrev.addEventListener('click', e => {
            e.stopPropagation();
            if (!currentProject) return;
            const images = getImages();
            currentImgIndex = (currentImgIndex - 1 + images.length) % images.length;
            mainImg.src = images[currentImgIndex];
            renderThumbs(images);
        });
        imgNext.addEventListener('click', e => {
            e.stopPropagation();
            if (!currentProject) return;
            const images = getImages();
            currentImgIndex = (currentImgIndex + 1) % images.length;
            mainImg.src = images[currentImgIndex];
            renderThumbs(images);
        });

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                switchTab(tabName);
                if (tabName === 'panorama' && currentProject?.panorama) {
                    openPanoramaFullscreen();
                }
            });
        });

        document.addEventListener('site:rendered', bindGallery);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProjectModal);
    } else {
        initProjectModal();
    }
})();
