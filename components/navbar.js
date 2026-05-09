// Navbar module
const Navbar = {
    loadPromise: null,

    resolveSchoolProfileScriptPath() {
        const path = window.location.pathname || '';
        if (path.includes('/pages/')) {
            return '../js/school-profile.js';
        }
        return './js/school-profile.js';
    },

    ensureSchoolProfileScript() {
        if (window.SchoolProfile) {
            return Promise.resolve();
        }

        const existingScript = document.querySelector('script[data-school-profile-script="true"]');
        if (existingScript) {
            return new Promise((resolve, reject) => {
                existingScript.addEventListener('load', resolve, { once: true });
                existingScript.addEventListener('error', reject, { once: true });
            });
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.resolveSchoolProfileScriptPath();
            script.dataset.schoolProfileScript = 'true';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    resolveNavbarPath() {
        const path = window.location.pathname || '';
        if (path.includes('/pages/')) {
            return '../components/navbar.html';
        }
        return './components/navbar.html';
    },

    // Function to load the navbar
    async loadNavbar() {
        const container = document.getElementById('navbar-container');
        if (!container) {
            return;
        }

        if (container.dataset.navbarLoaded === 'true') {
            return;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = (async () => {
            await this.ensureSchoolProfileScript();
            const response = await fetch(this.resolveNavbarPath());
            if (!response.ok) {
                throw new Error(`Navbar load failed: ${response.status}`);
            }
            const navbarHtml = await response.text();
            container.innerHTML = navbarHtml;
            container.dataset.navbarLoaded = 'true';

            // Initialize Bootstrap dropdowns when Bootstrap JS is available.
            if (window.bootstrap?.Dropdown) {
                const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
                dropdownElementList.forEach(dropdownToggleEl => {
                    new window.bootstrap.Dropdown(dropdownToggleEl);
                });
            }

            // Add logout event listener
            const logoutButton = document.getElementById('logoutButton');
            if (logoutButton) {
                logoutButton.addEventListener('click', this.handleLogout);
            }

            // Highlight current page in navbar
            this.highlightCurrentPage();

            if (window.SchoolProfile?.fetch) {
                await window.SchoolProfile.fetch(true);
            }
        })().catch((error) => {
            // Keep error logging for debugging purposes
            console.error('Error loading navbar:', error);
            container.dataset.navbarLoaded = 'false';
        }).finally(() => {
            this.loadPromise = null;
        });

        return this.loadPromise;
    },

    // Function to handle logout
    handleLogout(e) {
        e.preventDefault();
        Auth.logout();
    },

    // Function to highlight current page in navbar
    highlightCurrentPage() {
        const currentPath = window.location.pathname.replace(/\/+$/, '');
        const navLinks = document.querySelectorAll('.nav-link, .dropdown-item');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href === '#') {
                return;
            }

            const normalizedHref = href.replace(window.location.origin, '').replace(/\/+$/, '');
            if (normalizedHref === currentPath) {
                link.classList.add('active');
                const dropdown = link.closest('.dropdown');
                dropdown?.querySelector('.dropdown-toggle')?.classList.add('active');
            }
        });
    }
};

// Export the Navbar object
window.Navbar = Navbar;

function initializeNavbarWhenReady() {
    const start = () => {
        if (window.Navbar?.loadNavbar) {
            window.Navbar.loadNavbar();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
        return;
    }

    start();
}

initializeNavbarWhenReady();
