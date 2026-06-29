(function () {
    'use strict';

    // ---- Preloader ----
    const loader = document.getElementById('loader');
    window.addEventListener('load', () => {
        setTimeout(() => loader.classList.add('hidden'), 1800);
    });

    // ---- Navigation Panel ----
    const navToggle = document.getElementById('navToggle');
    const navHolder = document.getElementById('navHolder');
    const navOverlay = document.getElementById('navOverlay');

    function openNav() {
        navHolder.classList.add('active');
        navOverlay.classList.add('active');
        navToggle.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeNav() {
        navHolder.classList.remove('active');
        navOverlay.classList.remove('active');
        navToggle.classList.remove('active');
        document.body.style.overflow = '';
    }

    navToggle.addEventListener('click', () => {
        navHolder.classList.contains('active') ? closeNav() : openNav();
    });

    navOverlay.addEventListener('click', closeNav);

    document.querySelectorAll('.sliding-menu a').forEach(link => {
        link.addEventListener('click', () => {
            closeNav();
            document.querySelectorAll('.sliding-menu a').forEach(a => a.classList.remove('act-link'));
            if (link.dataset.section) link.classList.add('act-link');
        });
    });

    // ---- Hero Slider ----
    const slides = document.querySelectorAll('.hero-slide');
    const heroPrev = document.getElementById('heroPrev');
    const heroNext = document.getElementById('heroNext');
    const currentSlideEl = document.getElementById('currentSlide');
    const slideProgress = document.getElementById('slideProgress');
    let currentSlide = 0;
    let slideInterval;
    const SLIDE_DURATION = 6000;
    const totalSlides = slides.length;

    function goToSlide(index) {
        slides[currentSlide].classList.remove('active');
        currentSlide = (index + totalSlides) % totalSlides;
        slides[currentSlide].classList.add('active');
        currentSlideEl.textContent = String(currentSlide + 1).padStart(2, '0');
        resetProgress();
    }

    function nextSlide() { goToSlide(currentSlide + 1); }
    function prevSlide() { goToSlide(currentSlide - 1); }

    function resetProgress() {
        slideProgress.style.transition = 'none';
        slideProgress.style.width = '0';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                slideProgress.style.transition = `width ${SLIDE_DURATION}ms linear`;
                slideProgress.style.width = '100%';
            });
        });
        clearInterval(slideInterval);
        slideInterval = setInterval(nextSlide, SLIDE_DURATION);
    }

    heroNext.addEventListener('click', () => { nextSlide(); });
    heroPrev.addEventListener('click', () => { prevSlide(); });

    if (slides.length > 0) resetProgress();

    // ---- Counter Animation ----
    const counters = document.querySelectorAll('.counter');
    let countersAnimated = false;

    function animateCounters() {
        if (countersAnimated) return;
        counters.forEach(counter => {
            const rect = counter.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                countersAnimated = true;
                const target = parseInt(counter.dataset.target, 10);
                const duration = 2000;
                const start = performance.now();

                function update(now) {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    counter.textContent = Math.floor(eased * target).toLocaleString('bg-BG');
                    if (progress < 1) requestAnimationFrame(update);
                    else counter.textContent = target.toLocaleString('bg-BG');
                }

                requestAnimationFrame(update);
            }
        });
    }

    // ---- Testimonials Slider ----
    const testTrack = document.getElementById('testimonialsTrack');
    const testPrev = document.getElementById('testPrev');
    const testNext = document.getElementById('testNext');
    let testIndex = 0;

    function getTestimonialStep() {
        return window.innerWidth <= 992 ? 1 : 2;
    }

    function updateTestimonials() {
        const items = testTrack.querySelectorAll('.testimonial-item');
        const step = getTestimonialStep();
        const maxIndex = Math.max(0, items.length - step);
        testIndex = Math.min(testIndex, maxIndex);
        const itemWidth = items[0].offsetWidth;
        testTrack.style.transform = `translateX(-${testIndex * itemWidth}px)`;
    }

    testNext.addEventListener('click', () => {
        const items = testTrack.querySelectorAll('.testimonial-item');
        const step = getTestimonialStep();
        const maxIndex = Math.max(0, items.length - step);
        testIndex = testIndex >= maxIndex ? 0 : testIndex + 1;
        updateTestimonials();
    });

    testPrev.addEventListener('click', () => {
        const items = testTrack.querySelectorAll('.testimonial-item');
        const step = getTestimonialStep();
        const maxIndex = Math.max(0, items.length - step);
        testIndex = testIndex <= 0 ? maxIndex : testIndex - 1;
        updateTestimonials();
    });

    // ---- Scroll Animations ----
    const fadeElements = document.querySelectorAll(
        '.about-grid, .gallery-item, .serv-item, .team-box, .testimonial-item, .video-promo-wrap, .contact-grid, .inline-facts-container'
    );

    fadeElements.forEach(el => el.classList.add('fade-in'));

    function checkScroll() {
        fadeElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.85) {
                el.classList.add('visible');
            }
        });
        animateCounters();
    }

    // ---- To Top Button ----
    const toTop = document.getElementById('toTop');

    toTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ---- Active Nav on Scroll ----
    const sections = document.querySelectorAll('.scroll-section[id]');
    const navLinks = document.querySelectorAll('.sliding-menu a[data-section]');

    function updateActiveNav() {
        let current = '';
        sections.forEach(section => {
            const top = section.offsetTop - 200;
            if (window.scrollY >= top) current = section.id;
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
                const offset = 0;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    // ---- Scroll Handler ----
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                toTop.classList.toggle('visible', window.scrollY > 500);
                updateActiveNav();
                checkScroll();
                ticking = false;
            });
            ticking = true;
        }
    });

    window.addEventListener('resize', () => {
        updateTestimonials();
    });

    // ---- Form Submit (demo) ----
    document.querySelectorAll('.inquiry-form, .subscribe-form').forEach(form => {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.textContent || btn.innerHTML;
            btn.textContent = 'Изпратено!';
            btn.style.background = '#4a4';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
                form.reset();
            }, 2500);
        });
    });

    // ---- Init ----
    checkScroll();
    updateTestimonials();
    updateActiveNav();
})();
