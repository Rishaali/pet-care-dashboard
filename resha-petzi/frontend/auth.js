/**
 * auth.js
 * Centralized authentication state management for Petzi
 */

const Auth = {
    // Get the JWT token from localStorage
    getToken() {
        const token = localStorage.getItem('petziToken');
        if (!token || token === "undefined" || token === "null") {
            // Actively clear corrupted state to prevent lingering undefined values
            if (token === "undefined" || token === "null") {
                localStorage.removeItem('petziToken');
                localStorage.removeItem('petziUser');
            }
            return null;
        }
        return token;
    },

    // Get the authenticated user object from localStorage
    getUser() {
        try {
            const userJson = localStorage.getItem('petziUser');
            return userJson ? JSON.parse(userJson) : null;
        } catch (e) {
            console.error("Failed to parse user from localStorage", e);
            return null;
        }
    },

    // Check if the user is currently authenticated
    isAuthenticated() {
        return !!this.getToken() && !!this.getUser();
    },

    // Save the authentication state upon successful login/signup
    setAuth(token, user) {
        if (!token || typeof token !== "string" || !token.trim() || token === "undefined") {
            throw new Error("Authentication token was not returned by the server.");
        }
        localStorage.setItem('petziToken', token);
        localStorage.setItem('petziUser', JSON.stringify(user));
    },

    // Clear the authentication state (e.g. on 401 Unauthorized or manual logout)
    clearAuth() {
        localStorage.removeItem('petziToken');
        localStorage.removeItem('petziUser');
    },

    // Logout and redirect to auth page without reload loops
    logout() {
        this.clearAuth();
        // Avoid reload loop if already on home or auth
        if (window.location.pathname.endsWith('home.html') || window.location.pathname === '/') {
            window.location.href = 'home.html';
        } else {
            window.location.href = 'auth.html?mode=login';
        }
    },

    // Guard function to run on protected pages (pets.html, pet.html)
    checkAuthGuard() {
        if (!this.isAuthenticated()) {
            window.location.replace('auth.html?mode=login');
            return false; // Indicating the caller should stop execution
        }
        return true;
    }
};

window.Auth = Auth;

// Centralized API Request Wrapper
window.apiRequest = async function(url, options = {}) {
    try {
        const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('petziToken');
        if (token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }

        const response = await fetch(url, options);
        if (response.status === 401 || response.status === 403) {
            if (window.Auth) {
                window.Auth.clearAuth();
            } else {
                localStorage.removeItem('petziToken');
                localStorage.removeItem('petziUser');
            }
            
            // Navigate safely to auth without loop
            if (!window.location.pathname.endsWith('auth.html')) {
                window.location.href = 'auth.html?mode=login';
            }
            
            throw new Error('Session expired. Please login again.');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API Request failed on ${url}:`, error.message);
        throw error;
    }
};
