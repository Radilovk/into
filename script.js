(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Preloader ----
    const loader = document.getElementById('loader');
    window.addEventListener('load', () => {
        setTimeout(() => loader.classList.add('hidden'), prefersReducedMotion ? 0 : 1600);
    });

    // ---- Navigation Panel ----
    const navToggle = document.getElementById('navToggle');
    const navHolder = document.getElementById('navHolder');
    const navOverlay = document.getElementById('navOverlay');

    function openNav() {
        navHolder.classList.add('active');
        navOverlay.classList.add('active');
        navToggle.classList.add('active');
        navToggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('nav-open');
    }

    function closeNav() {
        navHolder.classList.remove('active');
        navOverlay.classList.remove('active');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-open');
    }

    navToggle.addEventListener('click', () => {
        navHolder.classList.contains('active') ? closeNav() : openNav();
    });

    navOverlay.addEventListener('click', closeNav);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeNav();
            closeVideoModal();
        }
    });

    document.querySelectorAll('.sliding-menu a').forEach(link => {
        link.addEventListener('click', () => closeNav());
    });

    // ---- Hero Slider (init after content render) ----
    let slideInterval;
    let heroPaused = false;
    let currentSlide = 0;
    const SLIDE_DURATION = 7000;

    function initHeroSlider() {
        const slides = document.querySelectorAll('.hero-slide');
        const heroPrev = document.getElementById('heroPrev');
        const heroNext = document.getElementById('heroNext');
        const currentSlideEl = document.getElementById('currentSlide');
        const slideProgress = document.getElementById('slideProgress');
        const heroSlider = document.getElementById('heroSlider');
        if (!slides.length) return;

        currentSlide = 0;

        function goToSlide(index) {
            const dots = document.querySelectorAll('.hero-dot');
            slides[currentSlide].classList.remove('active');
            if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
            currentSlide = (index + slides.length) % slides.length;
            slides[currentSlide].classList.add('active');
            if (dots[currentSlide]) dots[currentSlide].classList.add('active');
            if (currentSlideEl) currentSlideEl.textContent = String(currentSlide + 1).padStart(2, '0');
            resetProgress();
        }

        function nextSlide() { goToSlide(currentSlide + 1); }
        function prevSlide() { goToSlide(currentSlide - 1); }

        function resetProgress() {
            if (!slideProgress || prefersReducedMotion) return;
            slideProgress.style.transition = 'none';
            slideProgress.style.width = '0';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    slideProgress.style.transition = `width ${SLIDE_DURATION}ms linear`;
                    slideProgress.style.width = '100%';
                });
            });
            clearInterval(slideInterval);
            if (!heroPaused) slideInterval = setInterval(nextSlide, SLIDE_DURATION);
        }

        heroNext?.addEventListener('click', nextSlide);
        heroPrev?.addEventListener('click', prevSlide);

        document.querySelectorAll('.hero-dot').forEach((dot, i) => {
            dot.onclick = () => goToSlide(i);
        });

        if (heroSlider) {
            heroSlider.onmouseenter = () => { heroPaused = true; clearInterval(slideInterval); };
            heroSlider.onmouseleave = () => { heroPaused = false; resetProgress(); };
            let touchStartX = 0;
            heroSlider.ontouchstart = e => { touchStartX = e.changedTouches[0].screenX; };
            heroSlider.ontouchend = e => {
                const diff = touchStartX - e.changedTouches[0].screenX;
                if (Math.abs(diff) > 50) diff > 0 ? nextSlide() : prevSlide();
            };
        }

        resetProgress();
    }

    // ---- Hero scroll down ----
    const scrollDown = document.querySelector('.hero-scroll-down-notifer');
    if (scrollDown) {
        const scrollToAbout = () => {
            const about = document.getElementById('about');
            if (about) about.scrollIntoView({ behavior: 'smooth' });
        };
        scrollDown.addEventListener('click', scrollToAbout);
        scrollDown.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToAbout(); }
        });
    }

    // ---- Counter Animation (per element) ----
    function animateCounter(counter) {
        if (counter.dataset.animated) return;
        counter.dataset.animated = 'true';
        const target = parseInt(counter.dataset.target, 10);
        if (prefersReducedMotion) {
            counter.textContent = target.toLocaleString('bg-BG');
            return;
        }
        const duration = 2200;
        const start = performance.now();
        function update(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            counter.textContent = Math.floor(eased * target).toLocaleString('bg-BG');
            if (progress < 1) requestAnimationFrame(update);
            else counter.textContent = target.toLocaleString('bg-BG');
        }
        requestAnimationFrame(update);
    }

    // ---- Portfolio Filters (delegation — works after dynamic render) ----
    const galleryFilters = document.querySelector('.gallery-filters');
    if (galleryFilters && !galleryFilters.dataset.bound) {
        galleryFilters.dataset.bound = '1';
        galleryFilters.addEventListener('click', e => {
            const btn = e.target.closest('.gallery-filter');
            if (!btn) return;
            galleryFilters.querySelectorAll('.gallery-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('.gallery-item').forEach(item => {
                const show = filter === 'all' || item.dataset.category === filter;
                item.style.display = show ? '' : 'none';
            });
        });
    }

    // ---- Testimonials Slider ----
    const testTrack = document.getElementById('testimonialsTrack');
    const testPrev = document.getElementById('testPrev');
    const testNext = document.getElementById('testNext');
    const testDots = document.getElementById('testDots');
    let testIndex = 0;
    let testInterval;

    function getVisibleCount() {
        if (window.innerWidth <= 768) return 1;
        if (window.innerWidth <= 1200) return 1;
        return 2;
    }

    function getMaxTestIndex() {
        if (!testTrack) return 0;
        const items = testTrack.querySelectorAll('.testimonial-item');
        return Math.max(0, items.length - getVisibleCount());
    }

    function updateTestimonials(animate = true) {
        if (!testTrack) return;
        const items = testTrack.querySelectorAll('.testimonial-item');
        if (!items.length) return;
        testIndex = Math.min(testIndex, getMaxTestIndex());
        const gap = parseInt(getComputedStyle(testTrack).gap) || 0;
        const itemWidth = items[0].getBoundingClientRect().width;
        testTrack.style.transition = animate ? 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)' : 'none';
        testTrack.style.transform = `translateX(-${testIndex * (itemWidth + gap)}px)`;

        if (testDots) {
            testDots.querySelectorAll('.test-dot').forEach((dot, i) => {
                dot.classList.toggle('active', i === testIndex);
            });
        }
    }

    function buildTestDots() {
        if (!testDots || !testTrack) return;
        testDots.innerHTML = '';
        const max = getMaxTestIndex();
        for (let i = 0; i <= max; i++) {
            const dot = document.createElement('button');
            dot.className = 'test-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Отзив ${i + 1}`);
            dot.addEventListener('click', () => { testIndex = i; updateTestimonials(); });
            testDots.appendChild(dot);
        }
    }

    if (testNext) {
        testNext.addEventListener('click', () => {
            const max = getMaxTestIndex();
            testIndex = testIndex >= max ? 0 : testIndex + 1;
            updateTestimonials();
        });
    }

    if (testPrev) {
        testPrev.addEventListener('click', () => {
            const max = getMaxTestIndex();
            testIndex = testIndex <= 0 ? max : testIndex - 1;
            updateTestimonials();
        });
    }

    if (testTrack && testNext && testPrev) {
        let tStartX = 0;
        testTrack.addEventListener('touchstart', e => { tStartX = e.changedTouches[0].screenX; }, { passive: true });
        testTrack.addEventListener('touchend', e => {
            const diff = tStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) testNext.click();
                else testPrev.click();
            }
        }, { passive: true });
    }

    function startTestAuto() {
        clearInterval(testInterval);
        if (!prefersReducedMotion && testNext) {
            testInterval = setInterval(() => testNext.click(), 8000);
        }
    }

    // ---- Video Modal ----
    const videoModal = document.getElementById('videoModal');
    const videoPlayBtn = document.querySelector('.video-box-btn');
    const videoModalClose = document.getElementById('videoModalClose');
    const videoIframe = document.getElementById('videoIframe');

    if (videoPlayBtn && videoModal) {
        videoPlayBtn.addEventListener('click', e => {
            e.preventDefault();
            videoModal.classList.add('active');
            document.body.classList.add('nav-open');
            const url = videoPlayBtn.dataset.video;
            if (videoIframe && url) videoIframe.src = url + '?autoplay=1&rel=0';
        });
    }

    function closeVideoModal() {
        if (!videoModal) return;
        videoModal.classList.remove('active');
        document.body.classList.remove('nav-open');
        if (videoIframe) videoIframe.src = '';
    }

    if (videoModalClose) videoModalClose.addEventListener('click', closeVideoModal);
    if (videoModal) {
        videoModal.addEventListener('click', e => {
            if (e.target === videoModal) closeVideoModal();
        });
    }

    // ---- Scroll Animations (re-init after dynamic render) ----
    let fadeObserver;

    function initFadeAnimations() {
        const fadeElements = document.querySelectorAll(
            '.about-grid, .gallery-item, .serv-card, .team-box, .testimonial-item, .video-promo-wrap, .contact-grid, .inline-facts-container'
        );

        fadeElements.forEach((el, i) => {
            if (!el.classList.contains('fade-in')) {
                el.classList.add('fade-in');
                el.style.transitionDelay = `${(i % 6) * 0.08}s`;
            }
        });

        if (!fadeObserver) {
            fadeObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        if (entry.target.classList.contains('inline-facts-container')) {
                            entry.target.querySelectorAll('.counter').forEach(c => animateCounter(c));
                        }
                    }
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        }

        fadeElements.forEach(el => {
            if (!el.classList.contains('visible')) fadeObserver.observe(el);
        });

        document.querySelectorAll('.counter').forEach(c => {
            if (c.dataset.observed) return;
            c.dataset.observed = '1';
            const obs = new IntersectionObserver(entries => {
                entries.forEach(entry => { if (entry.isIntersecting) animateCounter(entry.target); });
            }, { threshold: 0.5 });
            obs.observe(c);
        });
    }

    // ---- To Top Button ----
    const toTop = document.getElementById('toTop');
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // ---- Active Nav on Scroll ----
    const sections = document.querySelectorAll('.scroll-section[id]');
    const navLinks = document.querySelectorAll('.sliding-menu a[data-section], .page-scroll-nav a[data-section]');

    function updateActiveNav() {
        let current = 'home';
        const scrollPos = window.scrollY + 150;
        sections.forEach(section => {
            if (scrollPos >= section.offsetTop) current = section.id;
        });
        navLinks.forEach(link => {
            link.classList.toggle('act-link', link.dataset.section === current);
        });
    }

    // ---- Smooth Scroll ----
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const headerH = document.querySelector('.top-header')?.offsetHeight || 0;
                const top = target.getBoundingClientRect().top + window.pageYOffset - headerH;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    // ---- Scroll progress in top header & sidebar ----
    const scrollProgress = document.getElementById('scrollProgress');
    function updateScrollProgress() {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
        if (scrollProgress) scrollProgress.style.width = pct + '%';
    }

    // ---- Scroll Handler ----
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                toTop.classList.toggle('visible', window.scrollY > 400);
                updateActiveNav();
                updateScrollProgress();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            testIndex = 0;
            buildTestDots();
            updateTestimonials(false);
        }, 150);
    });

    // ---- Form Submit ----
    document.querySelectorAll('.inquiry-form, .subscribe-form').forEach(form => {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Изпратено!';
            btn.disabled = true;
            setTimeout(() => {
                btn.innerHTML = original;
                btn.disabled = false;
                form.reset();
            }, 2800);
        });
    });

    function initAfterRender() {
        initHeroSlider();
        testIndex = 0;
        buildTestDots();
        updateTestimonials(false);
        startTestAuto();
        initFadeAnimations();

        const videoBtn = document.querySelector('.video-box-btn');
        const data = window.SITE_DATA;
        if (videoBtn && data?.video?.youtube) {
            videoBtn.dataset.video = data.video.youtube;
        }
    }

    document.addEventListener('site:rendered', initAfterRender);
    if (window.SITE_DATA) initAfterRender();

    // ---- Init ----
    initFadeAnimations();
    buildTestDots();
    updateTestimonials(false);
    updateActiveNav();
    updateScrollProgress();
    startTestAuto();

    const testSlider = document.getElementById('testimonialsSlider');
    if (testSlider) {
        testSlider.addEventListener('mouseenter', () => clearInterval(testInterval));
        testSlider.addEventListener('mouseleave', startTestAuto);
    }
})();
