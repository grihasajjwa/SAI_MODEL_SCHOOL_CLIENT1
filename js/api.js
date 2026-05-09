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
            let errorMessage = 'API Error';

try {
    const errorData = await response.json();
    console.error('API Error:', errorData);
    errorMessage = errorData.message || errorMessage;
} catch (e) {
    const errorText = await response.text();
    console.error('API Error:', errorText);
    errorMessage = errorText;
}

throw new Error(errorMessage);
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
    async getStudentMarks(studentId, academicYear = '') {
        try {
            const url = academicYear
                ? `${API_BASE_URL}/marks/${studentId}?academicYear=${encodeURIComponent(academicYear)}`
                : `${API_BASE_URL}/marks/${studentId}`;
            const response = await apiCall(url);
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


const feesApi = {
    async getDashboard() {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/dashboard`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching finance dashboard:', error);
            return null;
        }
    },

    async getFeeCollectionBySession(session) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/collection-by-session?session=${encodeURIComponent(session)}`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching fee collection by session:', error);
            return null;
        }
    },

    async getTodayTransactions() {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/today-transactions`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching today transactions:', error);
            return null;
        }
    },

    async getStudentFeeSummary(admissionNo) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/student/${encodeURIComponent(admissionNo)}`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching fee summary:', error);
            return null;
        }
    },

    async saveReceipt(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/receipt`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving fee receipt:', error);
            throw error;
        }
    },

    async updateReceipt(receiptId, payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/receipt/${receiptId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error updating fee receipt:', error);
            throw error;
        }
    },

    async deleteReceipt(receiptId, payload = {}) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/receipt/${receiptId}`, {
                method: 'DELETE',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error deleting fee receipt:', error);
            throw error;
        }
    },

    async recoverReceipt(receiptId, payload = {}) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/receipt/${receiptId}/recover`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error recovering fee receipt:', error);
            throw error;
        }
    },

    async getReceipt(receiptId) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/receipt/${receiptId}`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching receipt:', error);
            return null;
        }
    },

    async getTransactions(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    query.set(key, value);
                }
            });

            const url = query.toString()
                ? `${API_BASE_URL}/fees/transactions?${query.toString()}`
                : `${API_BASE_URL}/fees/transactions`;

            const response = await apiCall(url);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching fee transactions:', error);
            return null;
        }
    },

    async getAuditLogs(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    query.set(key, value);
                }
            });

            const url = query.toString()
                ? `${API_BASE_URL}/fees/audit-logs?${query.toString()}`
                : `${API_BASE_URL}/fees/audit-logs`;

            const response = await apiCall(url);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching transaction audit logs:', error);
            return null;
        }
    },

    async getAuditSuspicious(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    query.set(key, value);
                }
            });

            const url = query.toString()
                ? `${API_BASE_URL}/fees/audit-suspicious?${query.toString()}`
                : `${API_BASE_URL}/fees/audit-suspicious`;

            const response = await apiCall(url);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching suspicious audit activity:', error);
            return null;
        }
    },

    async getDueReport(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    query.set(key, value);
                }
            });

            const url = query.toString()
                ? `${API_BASE_URL}/fees/due-report?${query.toString()}`
                : `${API_BASE_URL}/fees/due-report`;

            const response = await apiCall(url);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching due report:', error);
            return null;
        }
    },

    async getExpenseHeads() {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/expense-heads`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching expense heads:', error);
            return null;
        }
    },

    async getPaymentAccounts() {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/payment-accounts`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching payment accounts:', error);
            return null;
        }
    },

    async createPaymentAccount(name) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/payment-accounts`, {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error creating payment account:', error);
            return null;
        }
    },

    async createExpenseHead(name) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/expense-heads`, {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error creating expense head:', error);
            return null;
        }
    },

    async getNextExpenseVoucher() {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/expenses/next-voucher`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching next expense voucher:', error);
            return null;
        }
    },

    async saveExpense(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/expenses`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving expense:', error);
            throw error;
        }
    },

    async updateExpense(expenseId, payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/expenses/${expenseId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error updating expense:', error);
            throw error;
        }
    },

    async getExpense(expenseId) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/expenses/${expenseId}`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching expense:', error);
            return null;
        }
    },

    async deleteExpense(expenseId, payload = {}) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/expenses/${expenseId}`, {
                method: 'DELETE',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error deleting expense:', error);
            throw error;
        }
    },

    async recoverExpense(expenseId, payload = {}) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/expenses/${expenseId}/recover`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error recovering expense:', error);
            throw error;
        }
    },

    async getExpenses(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    query.set(key, value);
                }
            });

            const url = query.toString()
                ? `${API_BASE_URL}/fees/expenses?${query.toString()}`
                : `${API_BASE_URL}/fees/expenses`;

            const response = await apiCall(url);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching expenses:', error);
            return null;
        }
    }
};


// Export the API functions
window.API = {
    BASE_URL: API_BASE_URL,
    call: apiCall,
    class: classApi,
    marks: marksApi,
    exam: examApi,
    fees: feesApi
};
