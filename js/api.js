// API Base URL
const API_BASE_URL = CONFIG.API_URL;

// Function to get authentication token
function getAuthToken() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    if (!token) {
        console.error('No authentication token found');
        const currentPath = window.location.pathname;
        const redirectParam = encodeURIComponent(currentPath);
        window.location.href = window.location.pathname.includes('/pages/') 
            ? `login.html?redirect=${redirectParam}`
            : `pages/login.html?redirect=${redirectParam}`;
        return null;
    }
    return token;
}

// Function to make authenticated API calls
async function apiCall(url, options = {}) {
    const token = getAuthToken();
    if (!token) return null;

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    };

    try {
        const response = await fetch(url, finalOptions);
        if (!response.ok) {
            if (response.status === 401) {
                // Token expired or invalid, redirect to login
                localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
                const currentPath = window.location.pathname;
                const redirectParam = encodeURIComponent(currentPath);
                window.location.href = window.location.pathname.includes('/pages/') 
                    ? `login.html?redirect=${redirectParam}`
                    : `pages/login.html?redirect=${redirectParam}`;
                return null;
            }
            const errorText = await response.text();
            console.error('API Error:', errorText);
            throw new Error(errorText);
        }
        return response;
    } catch (error) {
        console.error('API Call Error:', error);
        throw error;
    }
}

// Class-related API calls
const classApi = {
    // Get all classes
    async getClassDetails() {
        try {
            const response = await apiCall(`${API_BASE_URL}/classes`);
            if (!response) return [];
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching classes:', error);
            return [];
        }
    },
};

// Marks-related API calls
const marksApi = {
    // Get student marks
    async getStudentMarks(studentId) {
        try {
            const response = await apiCall(`${API_BASE_URL}/marks/${studentId}`);
            if (!response) return [];
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching student marks:', error);
            return [];
        }
    },

    // Save student marks
    async saveMarks(studentId, marksData) {
        try {
            const response = await apiCall(`${API_BASE_URL}/marks/${studentId}`, {
                method: 'PUT',
                body: JSON.stringify(marksData)
            });
            if (!response) return null;
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error saving student marks:', error);
            return null;
        }
    }
};

// Exam-related API calls
const examApi = {
    // Get exam configuration
    getExamConfig: async (className, section, academicYear) => {
        const response = await apiCall(`${API_BASE_URL}/exam/config/${encodeURIComponent(className)}/${encodeURIComponent(section)}/${encodeURIComponent(academicYear)}`);
        if (!response.ok) throw new Error('Failed to fetch exam configuration');
        return response.json();
    },
    // Save exam configuration
    saveExamConfig: async (data) => {
        const response = await apiCall(`${API_BASE_URL}/exam/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to save exam configuration');
        return response.json();
    }
};

// Export the API functions
window.API = {
    BASE_URL: API_BASE_URL,
    call: apiCall,
    class: classApi,
    marks: marksApi,
    exam: examApi
};
