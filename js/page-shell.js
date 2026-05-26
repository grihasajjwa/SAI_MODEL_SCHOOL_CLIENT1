(function () {
    const path = window.location.pathname || '';
    const isPagesDir = path.includes('/pages/');
    const isPublicPage = /\/pages\/(login|signup)\.html$/i.test(path) || /\/(login|signup)\.html$/i.test(path);

    function resolvePath(target) {
        return `${isPagesDir ? '../' : './'}${target}`;
    }

    function ensureNavbarStyles() {
        const href = resolvePath('css/navbar.css');
        const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .find((link) => (link.getAttribute('href') || '').includes('css/navbar.css'));

        if (existing) {
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function ensureBootstrapCss() {
        const hasBootstrapCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .some((link) => (link.getAttribute('href') || '').includes('bootstrap'));

        if (hasBootstrapCss) {
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css';
        document.head.appendChild(link);
    }

    function ensureFontAwesomeCss() {
        const hasFontAwesome = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .some((link) => {
                const href = (link.getAttribute('href') || '').toLowerCase();
                return href.includes('font-awesome') || href.includes('fontawesome');
            });

        if (hasFontAwesome) {
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    }

    function ensureBootstrapScript() {
        if (window.bootstrap) {
            return Promise.resolve();
        }

        const existing = Array.from(document.querySelectorAll('script'))
            .find((script) => (script.getAttribute('src') || '').includes('bootstrap.bundle'));

        if (existing) {
            return new Promise((resolve, reject) => {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
            });
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    function ensureNumberInputGuardScript() {
        if (window.NumberInputGuard?.initialized) {
            return;
        }

        const existing = document.querySelector('script[data-number-input-guard="true"]');
        if (existing) {
            return;
        }

        const script = document.createElement('script');
        script.src = resolvePath('js/number-input-guard.js');
        script.dataset.numberInputGuard = 'true';
        document.head.appendChild(script);
    }

    function ensureNavbarContainer() {
        if (document.getElementById('navbar-container')) {
            return;
        }

        const container = document.createElement('div');
        container.id = 'navbar-container';
        document.body.insertBefore(container, document.body.firstChild);
    }

    function ensureAuthenticated() {
        if (!window.Auth || typeof window.Auth.isAuthenticated !== 'function') {
            return false;
        }

        if (window.Auth.isAuthenticated()) {
            return true;
        }

        if (typeof window.Auth.redirectToLogin === 'function') {
            window.Auth.redirectToLogin();
        }
        return false;
    }

    function ensureNavbarScript() {
        if (window.Navbar) {
            return Promise.resolve(window.Navbar);
        }

        const existing = document.querySelector('script[data-navbar-script="true"]');
        if (existing) {
            return new Promise((resolve, reject) => {
                existing.addEventListener('load', () => resolve(window.Navbar), { once: true });
                existing.addEventListener('error', reject, { once: true });
            });
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = resolvePath('components/navbar.js');
            script.dataset.navbarScript = 'true';
            script.onload = () => resolve(window.Navbar);
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    async function initializeShell() {
        ensureNumberInputGuardScript();

        if (isPublicPage) {
            return;
        }

        ensureNavbarStyles();
        ensureBootstrapCss();
        ensureFontAwesomeCss();
        ensureNavbarContainer();

        if (!ensureAuthenticated()) {
            return;
        }

        try {
            await ensureBootstrapScript();
            const navbar = await ensureNavbarScript();
            if (navbar?.loadNavbar) {
                await navbar.loadNavbar();
            }
        } catch (error) {
            console.error('Page shell initialization failed:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeShell, { once: true });
    } else {
        initializeShell();
    }
})();
