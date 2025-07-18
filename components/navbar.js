// Navbar module
const Navbar = {
    // Function to load the navbar
    async loadNavbar() {
        try {
            const response = await fetch('/components/navbar.html');
            const navbarHtml = await response.text();
            document.getElementById('navbar-container').innerHTML = navbarHtml;

            // Initialize Bootstrap dropdowns
            const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
            dropdownElementList.forEach(dropdownToggleEl => {
                new bootstrap.Dropdown(dropdownToggleEl);
            });

            // Add logout event listener
            const logoutButton = document.getElementById('logoutButton');
            if (logoutButton) {
                logoutButton.addEventListener('click', this.handleLogout);
            }

            // Highlight current page in navbar
            this.highlightCurrentPage();
        } catch (error) {
            // Keep error logging for debugging purposes
            console.error('Error loading navbar:', error);
        }
    },

    // Function to handle logout
    handleLogout(e) {
        e.preventDefault();
        Auth.logout();
        // Check if we're in a subdirectory
        const isInPagesDir = window.location.pathname.includes('/pages/');
        const loginPath = isInPagesDir ? '../pages/login.html' : 'pages/login.html';
        window.location.href = loginPath;
    },

    // Function to highlight current page in navbar
    highlightCurrentPage() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });
    }
};

// Export the Navbar object
window.Navbar = Navbar;

// Check if we're authenticated before loading navbar
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in a subdirectory
    const isInPagesDir = window.location.pathname.includes('/pages/');
    const loginPath = isInPagesDir ? '../pages/login.html' : 'pages/login.html';
    
    if (!Auth.isAuthenticated()) {
        window.location.href = loginPath;
        return;
    }
    Navbar.loadNavbar();
});