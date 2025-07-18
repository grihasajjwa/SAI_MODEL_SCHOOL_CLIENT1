const CONFIG = {
    // API_URL: 'http://localhost:5000/api',
    //API_URL: 'https://skyview-server-1.vercel.app/api',
    API_URL: 'https://skyview-server-3.vercel.app/api',
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
    CURRENT_SESSION: '2023-2024',
    DEFAULT_ERROR_MESSAGE: 'An error occurred. Please try again.',
    STORAGE_KEYS: {
        TOKEN: 'skyview_token',
        USER: 'skyview_user',
        REMEMBER_ME: 'skyview_remember_me'
    }
};
