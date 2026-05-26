// API Base URL
function resolveFallbackApiUrl() {
    const { protocol, hostname, port, origin } = window.location;
    const isLocalhost = ['localhost', '127.0.0.1'].includes(hostname);

    if (protocol === 'file:') return 'http://127.0.0.1:5000/api';
    if (isLocalhost && port && port !== '5000') return `${protocol}//${hostname}:5000/api`;
    return `${origin.replace(/\/+$/, '')}/api`;
}

const ACTIVE_CONFIG = window.CONFIG || {
    API_URL: resolveFallbackApiUrl(),
    STORAGE_KEYS: { TOKEN: 'skyview_token' }
};
window.CONFIG = ACTIVE_CONFIG;
var CONFIG = ACTIVE_CONFIG;
const API_BASE_URL = ACTIVE_CONFIG.API_URL;

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

    async getClassesByAcademicYear(academicYear) {
        try {
            const response = await apiCall(`${API_BASE_URL}/classes/year/${encodeURIComponent(academicYear)}`);
            if (!response) return [];
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching classes by academic year:', error);
            return [];
        }
    },

    async createClass(classData) {
        try {
            const response = await apiCall(`${API_BASE_URL}/classes`, {
                method: 'POST',
                body: JSON.stringify(classData)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error creating class:', error);
            throw error;
        }
    },
};

const sessionApi = {
    async getAll() {
        try {
            const response = await apiCall(`${API_BASE_URL}/sessions`);
            if (!response) return [];
            const data = await response.json();
            return data.sessions || data || [];
        } catch (error) {
            console.error('Error fetching sessions:', error);
            return [];
        }
    }
};

const examNameApi = {
    async getBySession(session) {
        try {
            const response = await apiCall(`${API_BASE_URL}/exam-names/${encodeURIComponent(session)}`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching exam names:', error);
            return null;
        }
    },

    async save(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/exam-names`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving exam names:', error);
            throw error;
        }
    }
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

    async getTodayTransactions(date = '') {
        try {
            const query = date ? `?date=${encodeURIComponent(date)}` : '';
            const response = await apiCall(`${API_BASE_URL}/fees/today-transactions${query}`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching today transactions:', error);
            return null;
        }
    },

    async getStudentFeeSummary(admissionNo, session = '') {
        try {
            const query = session ? `?session=${encodeURIComponent(session)}` : '';
            const response = await apiCall(`${API_BASE_URL}/fees/student/${encodeURIComponent(admissionNo)}${query}`);
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

    async getCashbookOpening(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    query.set(key, value);
                }
            });

            const url = query.toString()
                ? `${API_BASE_URL}/fees/cashbook/opening?${query.toString()}`
                : `${API_BASE_URL}/fees/cashbook/opening`;

            const token = getAuthToken();
            if (!token) return null;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.status === 404) {
                return { success: false, routeMissing: true };
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    message: errorData.message || 'Unable to fetch cashbook opening'
                };
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching cashbook opening:', error);
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

    async getParticulars() {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/particulars`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching fee particulars:', error);
            return null;
        }
    },

    async createParticular(name) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fees/particulars`, {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error creating fee particular:', error);
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
            let response;
            try {
                response = await apiCall(`${API_BASE_URL}/fees/expenses/${expenseId}`, {
                    method: 'DELETE',
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                if (!String(error.message || '').includes('Not Found')) {
                    throw error;
                }
                response = await apiCall(`${API_BASE_URL}/fees/expenses/${expenseId}/delete`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }
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

const fuelApi = {
    async getOptions() {
        try {
            const response = await apiCall(`${API_BASE_URL}/fuel/options`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching fuel options:', error);
            return null;
        }
    },

    async createCentre(name) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fuel/centres`, {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error creating fuel centre:', error);
            throw error;
        }
    },

    async createVehicle(vehicleNumber) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fuel/vehicles`, {
                method: 'POST',
                body: JSON.stringify({ vehicleNumber })
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error creating bus vehicle:', error);
            throw error;
        }
    },

    async getEntries(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    query.set(key, value);
                }
            });

            const url = query.toString()
                ? `${API_BASE_URL}/fuel/entries?${query.toString()}`
                : `${API_BASE_URL}/fuel/entries`;

            const response = await apiCall(url);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching fuel ledger:', error);
            return null;
        }
    },

    async saveEntry(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fuel/entries`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving fuel bill:', error);
            throw error;
        }
    },

    async updateEntry(entryId, payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fuel/entries/${entryId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error updating fuel bill:', error);
            throw error;
        }
    },

    async deleteEntry(entryId) {
        try {
            const response = await apiCall(`${API_BASE_URL}/fuel/entries/${entryId}`, {
                method: 'DELETE'
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error deleting fuel bill:', error);
            throw error;
        }
    }
};

const supplierApi = {
    async getOptions() {
        try {
            const response = await apiCall(`${API_BASE_URL}/suppliers/options`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            return null;
        }
    },

    async createSupplier(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/suppliers/suppliers`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error creating supplier:', error);
            throw error;
        }
    },

    async getEntries(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') query.set(key, value);
            });
            const url = query.toString()
                ? `${API_BASE_URL}/suppliers/entries?${query.toString()}`
                : `${API_BASE_URL}/suppliers/entries`;
            const response = await apiCall(url);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching supplier ledger:', error);
            return null;
        }
    },

    async saveEntry(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/suppliers/entries`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving supplier purchase:', error);
            throw error;
        }
    },

    async updateEntry(entryId, payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/suppliers/entries/${entryId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error updating supplier purchase:', error);
            throw error;
        }
    },

    async deleteEntry(entryId) {
        try {
            const response = await apiCall(`${API_BASE_URL}/suppliers/entries/${entryId}`, {
                method: 'DELETE'
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error deleting supplier purchase:', error);
            throw error;
        }
    }
};

const salaryApi = {
    async getColumns() {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/columns`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching salary columns:', error);
            return null;
        }
    },

    async saveColumn(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/columns`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving salary column:', error);
            throw error;
        }
    },

    async deleteColumn(columnKey) {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/columns/${encodeURIComponent(columnKey)}`, {
                method: 'DELETE'
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error deleting salary column:', error);
            throw error;
        }
    },

    async getEmployees(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') query.set(key, value);
            });
            const url = query.toString()
                ? `${API_BASE_URL}/salary/employees?${query.toString()}`
                : `${API_BASE_URL}/salary/employees`;
            const response = await apiCall(url);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching salary employees:', error);
            return null;
        }
    },

    async saveEmployee(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/employees`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving salary employee:', error);
            throw error;
        }
    },

    async updateEmployee(employeeId, payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/employees/${employeeId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error updating salary employee:', error);
            throw error;
        }
    },

    async deleteEmployee(employeeId) {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/employees/${employeeId}`, {
                method: 'DELETE'
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error deleting salary employee:', error);
            throw error;
        }
    },

    async previewSheet(params = {}) {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/sheets/preview`, {
                method: 'POST',
                body: JSON.stringify(params)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error preparing salary sheet preview:', error);
            return null;
        }
    },

    async getSheets(params = {}) {
        try {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') query.set(key, value);
            });
            const url = query.toString()
                ? `${API_BASE_URL}/salary/sheets?${query.toString()}`
                : `${API_BASE_URL}/salary/sheets`;
            const response = await apiCall(url);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching salary sheets:', error);
            return null;
        }
    },

    async saveSheet(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/sheets`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving salary sheet:', error);
            throw error;
        }
    },

    async getSheet(sheetId) {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/sheets/${sheetId}`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching salary sheet:', error);
            return null;
        }
    },

    async deleteSheet(sheetId) {
        try {
            const response = await apiCall(`${API_BASE_URL}/salary/sheets/${sheetId}`, {
                method: 'DELETE'
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error deleting salary sheet:', error);
            throw error;
        }
    }
};

const examRoutineApi = {
    async getAll() {
        try {
            const response = await apiCall(`${API_BASE_URL}/exam-routines`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching exam routines:', error);
            return null;
        }
    },

    async getById(id) {
        try {
            const response = await apiCall(`${API_BASE_URL}/exam-routines/${id}`);
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching exam routine:', error);
            return null;
        }
    },

    async save(payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/exam-routines`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving exam routine:', error);
            throw error;
        }
    },

    async update(id, payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/exam-routines/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error updating exam routine:', error);
            throw error;
        }
    },

    async saveRow(id, payload) {
        try {
            const response = await apiCall(`${API_BASE_URL}/exam-routines/${id}/rows`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error saving exam routine row:', error);
            throw error;
        }
    },

    async delete(id) {
        try {
            const response = await apiCall(`${API_BASE_URL}/exam-routines/${id}`, {
                method: 'DELETE'
            });
            if (!response) return null;
            return await response.json();
        } catch (error) {
            console.error('Error deleting exam routine:', error);
            throw error;
        }
    }
};


// Export the API functions
window.API = {
    BASE_URL: API_BASE_URL,
    call: apiCall,
    sessions: sessionApi,
    examNames: examNameApi,
    class: classApi,
    marks: marksApi,
    exam: examApi,
    fees: feesApi,
    fuel: fuelApi,
    suppliers: supplierApi,
    salary: salaryApi,
    examRoutine: examRoutineApi
};
