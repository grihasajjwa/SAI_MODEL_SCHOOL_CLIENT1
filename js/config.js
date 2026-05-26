const SKYVIEW_DEFAULT_API_URL = 'https://sai-model-school-server-1.vercel.app/api';

function resolveApiUrl() {
    // 1. Optional manual override.
    // Use this only when you want to test another server without changing code:
    // localStorage.setItem('skyview_api_url_override', 'https://your-server.com/api')
    const override = window.__SKYVIEW_API_URL__ || localStorage.getItem('skyview_api_url_override');

    if (override) {
        const cleanOverride = String(override).trim().replace(/\/+$/, '');

        // Old server URL should not be used anymore.
        // If it is saved in the browser, remove it and continue with the normal settings below.
        if (cleanOverride.includes('skyview-server-7-0.vercel.app')) {
            localStorage.removeItem('skyview_api_url_override');
        } else {
            return cleanOverride;
        }
    }

    const { protocol, hostname, port, origin } = window.location;
    const isLocalComputer = hostname === 'localhost' || hostname === '127.0.0.1';

    // 2. If you open HTML directly from your computer, connect to local server.
    if (protocol === 'file:') {
        return 'http://127.0.0.1:5000/api';
    }

    // 3. If frontend is running locally, always connect to backend port 5000.
    // Example: frontend http://localhost:8080 -> backend http://localhost:5000/api
    if (isLocalComputer && port !== '5000') {
        return `${protocol}//${hostname}:5000/api`;
    }

    // 4. If frontend and backend are on the same local server, use same origin.
    // Example: http://localhost:5000 -> http://localhost:5000/api
    if (isLocalComputer) {
        return `${origin.replace(/\/+$/, '')}/api`;
    }

    // 5. For the live website, use the deployed server.
    return SKYVIEW_DEFAULT_API_URL;
}

// Main app configuration.
// All pages should use CONFIG.API_URL instead of writing server links directly.
window.CONFIG = {
    API_URL: resolveApiUrl(),
    CURRENT_SESSION: 'Default',
    STORAGE_KEYS: {
        TOKEN: 'skyview_token',
        USER: 'skyview_user',
        REMEMBER_ME: 'skyview_remember_me',
        CLASS_DATA: 'classData',
        SUBJECT_DATA: 'subjectData'
    }
};

var CONFIG = window.CONFIG;
