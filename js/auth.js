class Auth {
    static isAuthenticated() {
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        if (!token) return false;

        try {
            // Check if token is expired
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp < Date.now() / 1000) {
                this.logout();
                return false;
            }
            return true;
        } catch (error) {
            this.logout();
            return false;
        }
    }

    static getToken() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    }

    static getUserRole() {
        const token = this.getToken();
        if (!token) return null;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.role;
        } catch (error) {
            return null;
        }
    }

   static async login(username, password, rememberMe = false) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            console.log('Login response:', data);

            if (data.success && data.token) {
                localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.token);
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));

                // Fetch class data which includes subjects
                try {
                    const classResponse = await fetch(`${CONFIG.API_URL}/classes`, {
                        headers: {
                            'Authorization': `Bearer ${data.token}`
                        }
                    });
                    
                    if (!classResponse.ok) {
                        throw new Error(`Failed to fetch class data: ${classResponse.status}`);
                    }

                    const classData = await classResponse.json();
                    console.log('Class data with subjects:', classData);
                    
                    // Store class data (which includes subjects)
                    localStorage.setItem('classData', JSON.stringify(classData));
                } catch (error) {
                    console.error('Error fetching class data:', error);
                }

                if (rememberMe) {
                    localStorage.setItem(CONFIG.STORAGE_KEYS.REMEMBER_ME, 'true');
                }

                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }
    static async signup(userData) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    }

    static logout() {
         localStorage.clear();
        localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.REMEMBER_ME);
        window.location.href = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
    }

    static async getCurrentUser() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`
                }
            });

            const data = await response.json();
            if (data.success) {
                return data.user;
            }
            return null;
        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    }

    static async updateProfile(userData) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            if (data.success) {
                // Update local storage user data
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Update profile error:', error);
            return false;
        }
    }

    static initializeAuthListeners() {
        // Check authentication on every page load
        if (!this.isAuthenticated() && 
            !window.location.pathname.includes('/pages/login.html') && 
            !window.location.pathname.includes('/pages/signup.html')) {
            this.logout();
            return;
        }

        // Add logout event listeners
        const logoutBtns = document.querySelectorAll('#logoutBtn, #adminLogoutBtn');
        logoutBtns.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', (e) => {
                     localStorage.clear();
                    e.preventDefault();
                    this.logout();
                });
            }
        });
    }
}

// Initialize auth listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    Auth.initializeAuthListeners();
});
