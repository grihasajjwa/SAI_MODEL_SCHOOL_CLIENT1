function resolveApiUrl() {
    const override =
        window.__SKYVIEW_API_URL__ ||
        localStorage.getItem('skyview_api_url_override');

    if (override) {
        return override.replace(/\/+$/, '');
    }

    const { protocol, hostname, port, origin } = window.location;
    const isLocalhost = ['localhost', '127.0.0.1'].includes(hostname);
    const isFileProtocol = protocol === 'file:';

    if (isFileProtocol) {
        return 'http://127.0.0.1:5000/api';
    }

    if (isLocalhost) {
        if (port && port !== '5000') {
            return `${protocol}//${hostname}:5000/api`;
        }
        return `${origin.replace(/\/+$/, '')}/api`;
    }

    return 'https://sai-model-school-server-1.vercel.app/api';
}

var CONFIG = {
    API_URL: resolveApiUrl(),
    CLASSES: [
        'Nursery-A', 'Nursery-B',
        'LKG-A', 'LKG-B',
        'UKG-A', 'UKG-B',
        'Class-I(A)', 'Class-I(B)',
        'Class-II(A)', 'Class-II(B)'
    ],
    SUBJECTS: {
        primary: ['English', 'Math', 'Bengali', 'Drawing'],
        middle: ['English Lit.', 'English Lang.', 'Bengali/Hindi', 'Math', 'Science', 'Social Science', 'Computer']
    },
    EXAM_TYPES: ['Term-I', 'Term-II', 'Half Yearly', 'Annual'],
    CURRENT_SESSION: 'Default',
    DEFAULT_ERROR_MESSAGE: 'An error occurred. Please try again.',
    STORAGE_KEYS: {
        TOKEN: 'skyview_token',
        USER: 'skyview_user',
        REMEMBER_ME: 'skyview_remember_me'
    }
};

console.log('CONFIG.API_URL loaded:', CONFIG.API_URL);
