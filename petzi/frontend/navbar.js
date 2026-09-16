/**
 * navbar.js
 * Core Navbar, Secondary Popover, & Notifications & Reminders Component for Petzi
 */

(function () {
    // Dynamic stylesheet injection
    if (!document.querySelector('link[href="navbar.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'navbar.css';
        document.head.appendChild(link);
    }

    // Identify current page path
    const path = window.location.pathname.toLowerCase();
    const isDashboard = path.endsWith('index.html') || path.endsWith('dashboard') || path.endsWith('/') || path.split('/').pop() === '';

    let notificationPollingTimer = null;
    let currentNotificationFilter = 'all';

    // Initialize navbar injection when DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        injectNavbar();
        setupMobileMenu();
        setupNotificationSystem();
        if (!isDashboard) {
            populatePetSelector();
        }
        highlightActiveLink();
    });

    // Helper for exact local time formatting
    function formatExactTime(dateString) {
        if (!dateString) return '';
        let normalized = String(dateString).trim();
        if (!normalized.includes('T') && !normalized.endsWith('Z')) {
            normalized = normalized.replace(' ', 'T') + 'Z';
        }
        const date = new Date(normalized);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Helper for relative timestamps with timezone normalization
    function formatRelativeTime(dateString) {
        if (!dateString) return 'Recently';
        let normalized = String(dateString).trim();
        if (!normalized.includes('T') && !normalized.endsWith('Z')) {
            normalized = normalized.replace(' ', 'T') + 'Z';
        }
        const date = new Date(normalized);
        if (isNaN(date.getTime())) return 'Recently';

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    // Main HTML generation and replacement
    function injectNavbar() {
        const user = JSON.parse(localStorage.getItem('petziUser') || 'null');
        const username = user ? (user.name || user.email || 'User') : 'User';
        const urlParams = new URLSearchParams(window.location.search);
        const currentPetId = urlParams.get('pet_id') || urlParams.get('id') || '1';
        const hash = window.location.hash.replace('#', '') || 'dashboard';

        // Main Desktop Navigation (Core items: Dashboard, My Pets, Profile, Feeding)
        const navHtml = `
            <div class="header-container">
                <div class="header-left">
                    <button class="back-btn" title="Previous" onclick="if (history.length > 1) { history.back(); } else { window.location.href='index.html'; }"><span class="material-icons">arrow_back</span></button>
                    <h1 class="app-title" onclick="window.location.href='index.html'" style="cursor:pointer;">
                        <span class="material-icons title-icon">pets</span>
                        Petzi
                    </h1>
                </div>
                
                <nav class="app-nav desktop-nav">
                    <button class="nav-btn ${isDashboard && hash === 'dashboard' ? 'active' : ''}" data-target="dashboard-section" data-tab-name="dashboard">
                        <span class="material-icons">dashboard</span> Dashboard
                    </button>
                    <a href="pets.html" class="nav-btn ${path.includes('pets.html') ? 'active' : ''}">
                        <span class="material-icons">pets</span> My Pets
                    </a>
                    <a href="pet.html?id=${currentPetId}" class="nav-btn ${path.includes('pet.html') && !isDashboard ? 'active' : ''}">
                        <span class="material-icons">assignment</span> Profile
                    </a>
                    <button class="nav-btn ${isDashboard && hash === 'feeding' ? 'active' : ''}" data-target="dashboard-section" data-tab-name="feeding">
                        <span class="material-icons">restaurant</span> Care Log
                    </button>

                    <!-- Hidden secondary target buttons to enable programmatically switching tabs on index.html -->
                    <button class="nav-btn ${isDashboard && hash === 'medications' ? 'active' : ''}" data-target="medications-section" data-tab-name="medications" style="display: none !important;"></button>
                    <button class="nav-btn ${isDashboard && hash === 'vaccines' ? 'active' : ''}" data-target="vaccines-section" data-tab-name="vaccines" style="display: none !important;"></button>
                    <button class="nav-btn ${isDashboard && hash === 'grooming' ? 'active' : ''}" data-target="grooming-section" data-tab-name="grooming" style="display: none !important;"></button>
                    <button class="nav-btn ${isDashboard && hash === 'vet-visits' ? 'active' : ''}" data-target="vet-visits-section" data-tab-name="vet-visits" style="display: none !important;"></button>
                    <button class="nav-btn ${isDashboard && hash === 'history' ? 'active' : ''}" data-target="history-section" data-tab-name="history" style="display: none !important;"></button>

                    <select id="header-pet-selector" class="nav-pet-selector">
                        <option value="">Loading Pets...</option>
                    </select>
                </nav>

                <div class="header-right" style="position: relative;">
                    <!-- Notification Bell Button with Unread Badge -->
                    <button class="nav-notification-btn" id="nav-notification-btn" aria-label="Notifications" title="Notifications & Reminders">
                        <span class="material-icons">notifications</span>
                        <span class="notification-badge" id="nav-notification-badge" style="display: none;">0</span>
                    </button>

                    <div class="nav-user-pill desktop-only">
                        <span class="material-icons">account_circle</span>
                        <span>${username}</span>
                    </div>
                    <button class="nav-logout-btn desktop-only" id="btn-logout-navbar" title="Logout">
                        <span class="material-icons">logout</span>
                    </button>
                    <button class="hamburger-btn" id="hamburger-btn" aria-label="Extra Features" title="Extra Features">
                        <span class="material-icons">menu</span>
                    </button>

                    <!-- Notifications Dropdown Panel -->
                    <div class="petzi-notification-panel" id="petzi-notification-panel">
                        <div class="notification-panel-header">
                            <div class="header-title-group">
                                <span class="material-icons header-icon">notifications_active</span>
                                <span class="header-title">Notifications</span>
                            </div>
                            <div class="header-actions">
                                <button class="panel-action-btn" id="btn-mark-all-read" title="Mark all as read">
                                    <span class="material-icons">done_all</span> Mark read
                                </button>
                                <button class="panel-action-btn icon-only" id="btn-notification-settings" title="Notification Preferences">
                                    <span class="material-icons">settings</span>
                                </button>
                            </div>
                        </div>

                        <div class="notification-filter-tabs">
                            <button class="tab-filter active" id="tab-filter-all" data-filter="all">All</button>
                            <button class="tab-filter" id="tab-filter-unread" data-filter="unread">Unread (<span id="unread-tab-count">0</span>)</button>
                        </div>

                        <div class="notification-list-container" id="notification-list-container">
                            <div class="notification-loading">
                                <span class="material-icons spinning">sync</span> Loading notifications...
                            </div>
                        </div>
                    </div>

                    <!-- Floating Popover Dropdown positioned directly below hamburger button -->
                    <div class="petzi-hamburger-dropdown" id="petzi-hamburger-dropdown">
                        <div class="dropdown-header mobile-only">
                            <select id="mobile-pet-selector" class="nav-pet-selector mobile-pet-dropdown">
                                <option value="">Loading Pets...</option>
                            </select>
                        </div>
                        
                        <div class="dropdown-section mobile-only">
                            <div class="dropdown-divider">Main Navigation</div>
                            <a href="index.html#dashboard" class="dropdown-item tab-link ${isDashboard && hash === 'dashboard' ? 'active' : ''}" data-tab-name="dashboard">
                                <span class="material-icons">dashboard</span><span>Dashboard</span>
                            </a>
                            <a href="pets.html" class="dropdown-item ${path.includes('pets.html') ? 'active' : ''}">
                                <span class="material-icons">pets</span><span>My Pets</span>
                            </a>
                            <a href="pet.html?id=${currentPetId}" class="dropdown-item ${path.includes('pet.html') && !isDashboard ? 'active' : ''}">
                                <span class="material-icons">assignment</span><span>Profile</span>
                            </a>
                            <a href="index.html#feeding" class="dropdown-item tab-link ${isDashboard && hash === 'feeding' ? 'active' : ''}" data-tab-name="dashboard">
                                <span class="material-icons">restaurant</span><span>Feeding</span>
                            </a>
                        </div>

                        <!-- Secondary Extra Features ONLY -->
                        <div class="dropdown-section">
                            <div class="dropdown-divider">Extra Features</div>
                            <a href="index.html#medications" class="dropdown-item tab-link ${isDashboard && hash === 'medications' ? 'active' : ''}" data-tab-name="medications">
                                <span class="material-icons">vaccines</span><span>Medication Scheduling</span>
                            </a>
                            <a href="index.html#dashboard" class="dropdown-item tab-link ${isDashboard && hash === 'dashboard' ? 'active' : ''}" data-tab-name="dashboard">
                                <span class="material-icons">inventory_2</span><span>Supplies Stock</span>
                            </a>
                            <a href="index.html#vaccines" class="dropdown-item tab-link ${isDashboard && hash === 'vaccines' ? 'active' : ''}" data-tab-name="vaccines">
                                <span class="material-icons">shield</span><span>Vaccines</span>
                            </a>
                            <a href="index.html#grooming" class="dropdown-item tab-link ${isDashboard && hash === 'grooming' ? 'active' : ''}" data-tab-name="grooming">
                                <span class="material-icons">spa</span><span>Grooming</span>
                            </a>
                            <a href="index.html#vet-visits" class="dropdown-item tab-link ${isDashboard && hash === 'vet-visits' ? 'active' : ''}" data-tab-name="vet-visits">
                                <span class="material-icons">medical_services</span><span>Vet Visits</span>
                            </a>
                            <a href="vets.html" class="dropdown-item ${path.includes('vets.html') || path.includes('vet-details.html') ? 'active' : ''}">
                                <span class="material-icons">local_hospital</span><span>Find a Vet</span>
                            </a>
                            <a href="appointments.html" class="dropdown-item ${path.includes('appointments.html') ? 'active' : ''}">
                                <span class="material-icons">event</span><span>Appointments</span>
                            </a>
                            <a href="index.html#history" class="dropdown-item tab-link ${isDashboard && hash === 'history' ? 'active' : ''}" data-tab-name="history">
                                <span class="material-icons">history</span><span>History Logs</span>
                            </a>
                        </div>

                        <div class="dropdown-user-section mobile-only">
                            <button class="nav-logout-btn-full" id="btn-logout-navbar-mobile">
                                <span class="material-icons">logout</span><span>Logout (${username})</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Notification Preferences Modal -->
            <div class="petzi-modal-backdrop" id="notification-prefs-modal" style="display: none;">
                <div class="petzi-modal-card">
                    <div class="modal-header">
                        <h3><span class="material-icons">tune</span> Notification Preferences</h3>
                        <button class="modal-close-btn" id="close-prefs-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-subtitle">Configure in-app alerts and automatic email reminders.</p>
                        
                        <div class="pref-toggle-row">
                            <div>
                                <label class="pref-label" for="pref-in-app">In-App Notifications</label>
                                <div class="pref-desc">Show notification bell badge & live popover alerts</div>
                            </div>
                            <input type="checkbox" id="pref-in-app" class="petzi-switch" checked>
                        </div>

                        <div class="pref-toggle-row">
                            <div>
                                <label class="pref-label" for="pref-email">Email Reminders</label>
                                <div class="pref-desc">Send reminders to your registered account email</div>
                            </div>
                            <input type="checkbox" id="pref-email" class="petzi-switch" checked>
                        </div>

                        <div class="pref-divider"></div>

                        <div class="pref-toggle-row">
                            <div>
                                <label class="pref-label" for="pref-appts">Appointment Reminders</label>
                                <div class="pref-desc">24 hours and 1 hour before booked vet visits</div>
                            </div>
                            <input type="checkbox" id="pref-appts" class="petzi-switch" checked>
                        </div>

                        <div class="pref-toggle-row">
                            <div>
                                <label class="pref-label" for="pref-meds">Medication Reminders</label>
                                <div class="pref-desc">Daily scheduled dose times for active prescriptions</div>
                            </div>
                            <input type="checkbox" id="pref-meds" class="petzi-switch" checked>
                        </div>

                        <div class="pref-toggle-row">
                            <div>
                                <label class="pref-label" for="pref-vax">Vaccination Reminders</label>
                                <div class="pref-desc">Upcoming & due vaccination reminders</div>
                            </div>
                            <input type="checkbox" id="pref-vax" class="petzi-switch" checked>
                        </div>

                        <div class="pref-divider"></div>

v>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancel" id="cancel-prefs-modal">Close</button>
                        <button class="btn-save" id="save-prefs-btn">Save Notification Preferences</button>
                    </div>
                </div>
            </div>
        `;

        // Find existing navigation container and replace/inject
        let targetHeader = document.querySelector("header.app-header");
        let targetNav = document.querySelector("nav.petzi-nav");

        if (targetHeader) {
            targetHeader.className = "app-header petzi-global-header";
            targetHeader.innerHTML = navHtml;
        } else if (targetNav) {
            const header = document.createElement("header");
            header.className = "app-header petzi-global-header";
            header.innerHTML = navHtml;
            targetNav.parentNode.replaceChild(header, targetNav);
        } else {
            const header = document.createElement("header");
            header.className = "app-header petzi-global-header";
            header.innerHTML = navHtml;
            document.body.insertBefore(header, document.body.firstChild);
        }

        // Clean up legacy sidebar or backdrop elements if present
        const legacySidebar = document.getElementById("petzi-mobile-sidebar");
        if (legacySidebar) legacySidebar.remove();
        const legacyBackdrop = document.getElementById("sidebar-backdrop");
        if (legacyBackdrop) legacyBackdrop.remove();

        // Bind logout actions
        const handleLogout = () => {
            if (window.Auth) {
                window.Auth.logout();
            } else {
                localStorage.removeItem('petziToken');
                localStorage.removeItem('petziUser');
                window.location.replace('home.html');
            }
        };

        const logoutBtn = document.getElementById("btn-logout-navbar");
        const logoutBtnMobile = document.getElementById("btn-logout-navbar-mobile");
        if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
        if (logoutBtnMobile) logoutBtnMobile.addEventListener("click", handleLogout);

        // Map tab buttons if not on dashboard
        if (!isDashboard) {
            const tabs = document.querySelectorAll(".desktop-nav button.nav-btn");
            tabs.forEach(btn => {
                const tabName = btn.getAttribute("data-tab-name");
                if (tabName) {
                    const a = document.createElement("a");
                    a.className = btn.className;
                    a.href = `index.html#${tabName}`;
                    a.innerHTML = btn.innerHTML;
                    if (btn.style.display) {
                        a.style.display = btn.style.display;
                    }
                    btn.parentNode.replaceChild(a, btn);
                }
            });
        }
    }

    // Set up responsive popover dropdown toggle, click-outside, and ESC handlers
    function setupMobileMenu() {
        const hamburger = document.getElementById("hamburger-btn");
        const dropdown = document.getElementById("petzi-hamburger-dropdown");

        if (hamburger && dropdown) {
            const toggleDropdown = (e) => {
                e.stopPropagation();
                // Close notification panel if open
                const notifPanel = document.getElementById("petzi-notification-panel");
                if (notifPanel) notifPanel.classList.remove("open");

                dropdown.classList.toggle("open");
            };

            const closeDropdown = () => {
                dropdown.classList.remove("open");
            };

            hamburger.addEventListener("click", toggleDropdown);

            // Close on click outside
            document.addEventListener("click", (e) => {
                if (!dropdown.contains(e.target) && !hamburger.contains(e.target)) {
                    closeDropdown();
                }
            });

            // Close on ESC key
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    closeDropdown();
                }
            });

            // Auto close dropdown when ANY link is clicked
            const items = dropdown.querySelectorAll(".dropdown-item");
            items.forEach(item => {
                item.addEventListener("click", () => {
                    closeDropdown();

                    if (isDashboard && item.classList.contains("tab-link")) {
                        const tabName = item.getAttribute("data-tab-name");
                        if (tabName) {
                            window.location.hash = tabName;
                            const targetSectionId = {
                                'dashboard': 'dashboard-section',
                                'profile': 'profile-section',
                                'medications': 'medications-section',
                                'vaccines': 'vaccines-section',
                                'grooming': 'grooming-section',
                                'vet-visits': 'vet-visits-section',
                                'history': 'history-section'
                            }[tabName];

                            if (targetSectionId) {
                                const desktopBtn = document.querySelector(`.desktop-nav [data-target="${targetSectionId}"]`);
                                if (desktopBtn) desktopBtn.click();
                            }
                        }
                    }
                });
            });
        }
    }

    // Set up Notification System
    function setupNotificationSystem() {
        const notifBtn = document.getElementById("nav-notification-btn");
        const notifPanel = document.getElementById("petzi-notification-panel");
        const badge = document.getElementById("nav-notification-badge");
        const markAllBtn = document.getElementById("btn-mark-all-read");
        const settingsBtn = document.getElementById("btn-notification-settings");

        // Filter tabs
        const tabAll = document.getElementById("tab-filter-all");
        const tabUnread = document.getElementById("tab-filter-unread");

        // Preferences modal elements
        const prefsModal = document.getElementById("notification-prefs-modal");
        const closePrefsModal = document.getElementById("close-prefs-modal");
        const cancelPrefsModal = document.getElementById("cancel-prefs-modal");
        const savePrefsBtn = document.getElementById("save-prefs-btn");

        const token = localStorage.getItem('petziToken');
        if (!token) return; // User not logged in, skip

        // Initial fetch of unread count
        fetchUnreadCount();

        // Start background polling (every 20s)
        if (notificationPollingTimer) clearInterval(notificationPollingTimer);
        notificationPollingTimer = setInterval(fetchUnreadCount, 20000);

        // Toggle notifications dropdown
        if (notifBtn && notifPanel) {
            notifBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                // Close hamburger if open
                const hamburgerMenu = document.getElementById("petzi-hamburger-dropdown");
                if (hamburgerMenu) hamburgerMenu.classList.remove("open");

                const isOpen = notifPanel.classList.toggle("open");
                if (isOpen) {
                    loadNotifications(currentNotificationFilter);
                }
            });

            // Click outside closes panel
            document.addEventListener("click", (e) => {
                if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
                    notifPanel.classList.remove("open");
                }
            });

            // ESC key closes panel
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    notifPanel.classList.remove("open");
                }
            });
        }

        // Filter tabs clicks
        if (tabAll && tabUnread) {
            tabAll.addEventListener("click", () => {
                tabAll.classList.add("active");
                tabUnread.classList.remove("active");
                currentNotificationFilter = 'all';
                loadNotifications('all');
            });

            tabUnread.addEventListener("click", () => {
                tabUnread.classList.add("active");
                tabAll.classList.remove("active");
                currentNotificationFilter = 'unread';
                loadNotifications('unread');
            });
        }

        // Mark all as read
        if (markAllBtn) {
            markAllBtn.addEventListener("click", async () => {
                try {
                    const res = await fetch("/api/notifications/read-all", {
                        method: "PATCH",
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (res.ok) {
                        updateBadgeCount(0);
                        loadNotifications(currentNotificationFilter);
                    }
                } catch (err) {
                    console.error("Error marking all read:", err);
                }
            });
        }

        // Preferences modal handlers
        if (settingsBtn && prefsModal) {
            settingsBtn.addEventListener("click", async () => {
                notifPanel.classList.remove("open");
                prefsModal.style.display = "flex";
                if (statusBox) {
                    statusBox.className = "email-status-box";
                    statusBox.style.display = "none";
                }

                // Load notification preferences
                try {
                    const res = await fetch("/api/notifications/preferences", {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const prefs = await res.json();
                        document.getElementById("pref-in-app").checked = Boolean(prefs.in_app_enabled);
                        document.getElementById("pref-email").checked = Boolean(prefs.email_enabled);
                        document.getElementById("pref-appts").checked = Boolean(prefs.appointment_reminders);
                        document.getElementById("pref-meds").checked = Boolean(prefs.medication_reminders);
                        document.getElementById("pref-vax").checked = Boolean(prefs.vaccine_reminders);
                    }
                } catch (err) {
                    console.error("Error loading notification preferences:", err);
                }

                // Load email server configuration
                try {
                    const cfgRes = await fetch("/api/notifications/email-config", {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (cfgRes.ok) {
                        const cfg = await cfgRes.json();
                        const btnGmail = document.getElementById("btn-mode-gmail");
                        const btnEthereal = document.getElementById("btn-mode-ethereal");
                        const gmailFields = document.getElementById("gmail-config-fields");
                        const etherealFields = document.getElementById("ethereal-config-fields");
                        const emailInput = document.getElementById("cfg-petzi-email");

                        if (emailInput && cfg.sender_email) emailInput.value = cfg.sender_email;

                        if (cfg.mode === "ethereal") {
                            if (btnGmail) btnGmail.classList.remove("active");
                            if (btnEthereal) btnEthereal.classList.add("active");
                            if (gmailFields) gmailFields.style.display = "none";
                            if (etherealFields) etherealFields.style.display = "flex";
                        } else {
                            if (btnGmail) btnGmail.classList.add("active");
                            if (btnEthereal) btnEthereal.classList.remove("active");
                            if (gmailFields) gmailFields.style.display = "flex";
                            if (etherealFields) etherealFields.style.display = "none";
                        }
                    }
                } catch (err) {
                    console.error("Error loading email config:", err);
                }
            });

            const hidePrefsModal = () => { prefsModal.style.display = "none"; };
            if (closePrefsModal) closePrefsModal.addEventListener("click", hidePrefsModal);
            if (cancelPrefsModal) cancelPrefsModal.addEventListener("click", hidePrefsModal);

            // Mode switching handlers
            const btnGmail = document.getElementById("btn-mode-gmail");
            const btnEthereal = document.getElementById("btn-mode-ethereal");
            const gmailFields = document.getElementById("gmail-config-fields");
            const etherealFields = document.getElementById("ethereal-config-fields");

            if (btnGmail && btnEthereal) {
                btnGmail.addEventListener("click", () => {
                    btnGmail.classList.add("active");
                    btnEthereal.classList.remove("active");
                    if (gmailFields) gmailFields.style.display = "flex";
                    if (etherealFields) etherealFields.style.display = "none";
                });

                btnEthereal.addEventListener("click", () => {
                    btnEthereal.classList.add("active");
                    btnGmail.classList.remove("active");
                    if (gmailFields) gmailFields.style.display = "none";
                    if (etherealFields) etherealFields.style.display = "flex";
                });
            }

            // Save Gmail Config
            const saveEmailCfgBtn = document.getElementById("btn-save-email-config");
            const saveEtherealCfgBtn = document.getElementById("btn-save-ethereal-config");

            if (saveEmailCfgBtn) {
                saveEmailCfgBtn.addEventListener("click", async () => {
                    const emailVal = document.getElementById("cfg-petzi-email").value.trim();
                    const passVal = document.getElementById("cfg-petzi-pass").value.trim();

                    if (!emailVal) {
                        alert("Please enter a valid Gmail address.");
                        return;
                    }
                    if (!passVal) {
                        alert("Please enter the 16-character Google App Password.");
                        return;
                    }

                    saveEmailCfgBtn.disabled = true;
                    saveEmailCfgBtn.innerHTML = '<span class="material-icons icon-tiny spinning">sync</span> Verifying...';
                    if (statusBox) {
                        statusBox.className = "email-status-box info";
                        statusBox.textContent = "Verifying Gmail connection...";
                    }

                    try {
                        const res = await fetch("/api/notifications/email-config", {
                            method: "PUT",
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({ mode: "gmail", email: emailVal, app_password: passVal })
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                            if (statusBox) {
                                statusBox.className = "email-status-box success";
                                statusBox.innerHTML = `<strong>✓ Connected:</strong> ${data.message}`;
                            }
                        } else {
                            if (statusBox) {
                                statusBox.className = "email-status-box error";
                                statusBox.innerHTML = `<strong>⚠ Connection Failed:</strong> ${data.message || 'Authentication error'}<br><small>${data.hint || ''}</small>`;
                            }
                        }
                    } catch (err) {
                        if (statusBox) {
                            statusBox.className = "email-status-box error";
                            statusBox.textContent = "Network error verifying email configuration.";
                        }
                    } finally {
                        saveEmailCfgBtn.disabled = false;
                        saveEmailCfgBtn.innerHTML = '<span class="material-icons icon-tiny">check_circle</span> Save & Verify Connection';
                    }
                });
            }

            if (saveEtherealCfgBtn) {
                saveEtherealCfgBtn.addEventListener("click", async () => {
                    saveEtherealCfgBtn.disabled = true;
                    saveEtherealCfgBtn.innerHTML = '<span class="material-icons icon-tiny spinning">sync</span> Activating...';
                    try {
                        const res = await fetch("/api/notifications/email-config", {
                            method: "PUT",
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({ mode: "ethereal" })
                        });
                        const data = await res.json();
                        if (statusBox) {
                            statusBox.className = "email-status-box success";
                            statusBox.innerHTML = `<strong>✓ Active:</strong> Free Test Mailbox enabled! All reminders will generate instant preview links.`;
                        }
                    } catch (err) {
                        if (statusBox) {
                            statusBox.className = "email-status-box error";
                            statusBox.textContent = "Error enabling test mailbox.";
                        }
                    } finally {
                        saveEtherealCfgBtn.disabled = false;
                        saveEtherealCfgBtn.innerHTML = '<span class="material-icons icon-tiny">bolt</span> Activate Test Mailbox';
                    }
                });
            }

            // Test Email Button Handler
            const testEmailBtn = document.getElementById("btn-test-email");
            const retryAllBtn = document.getElementById("btn-retry-failed-emails");
            const statusBox = document.getElementById("email-status-box");

            if (testEmailBtn) {
                testEmailBtn.addEventListener("click", async () => {
                    testEmailBtn.disabled = true;
                    testEmailBtn.innerHTML = '<span class="material-icons icon-tiny spinning">sync</span> Testing...';
                    if (statusBox) {
                        statusBox.className = "email-status-box info";
                        statusBox.textContent = "Sending test email...";
                    }

                    try {
                        const res = await fetch("/api/notifications/test-email", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        const data = await res.json();

                        if (res.ok && data.success) {
                            if (statusBox) {
                                statusBox.className = "email-status-box success";
                                let previewHtml = "";
                                if (data.previewUrl) {
                                    previewHtml = `<br><a href="${data.previewUrl}" target="_blank" class="btn-preview-link"><span class="material-icons icon-tiny">visibility</span> View Delivered Test Email ↗</a>`;
                                }
                                statusBox.innerHTML = `<strong>✓ Success:</strong> ${data.message}${previewHtml}`;
                            }
                        } else {
                            if (statusBox) {
                                statusBox.className = "email-status-box error";
                                statusBox.innerHTML = `<strong>⚠ Delivery Issue:</strong> ${data.error || 'Failed to send'}<br><small>${data.hint || ''}</small>`;
                            }
                        }
                    } catch (err) {
                        if (statusBox) {
                            statusBox.className = "email-status-box error";
                            statusBox.textContent = "Network error while attempting to send test email.";
                        }
                    } finally {
                        testEmailBtn.disabled = false;
                        testEmailBtn.innerHTML = '<span class="material-icons icon-tiny">send</span> Send Test Email';
                    }
                });
            }

            if (retryAllBtn) {
                retryAllBtn.addEventListener("click", async () => {
                    retryAllBtn.disabled = true;
                    retryAllBtn.innerHTML = '<span class="material-icons icon-tiny spinning">sync</span> Retrying...';
                    if (statusBox) {
                        statusBox.className = "email-status-box info";
                        statusBox.textContent = "Retrying failed email reminders...";
                    }

                    try {
                        const res = await fetch("/api/notifications/retry-failed", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        const data = await res.json();
                        if (statusBox) {
                            if (data.sent > 0) {
                                statusBox.className = "email-status-box success";
                                statusBox.innerHTML = `<strong>✓ Processed:</strong> ${data.message}`;
                            } else if (data.total === 0) {
                                statusBox.className = "email-status-box info";
                                statusBox.textContent = "No failed email reminders to retry.";
                            } else {
                                statusBox.className = "email-status-box error";
                                statusBox.innerHTML = `<strong>⚠ Retry Result:</strong> ${data.message}`;
                            }
                        }
                        loadNotifications(currentNotificationFilter);
                    } catch (err) {
                        if (statusBox) {
                            statusBox.className = "email-status-box error";
                            statusBox.textContent = "Error retrying failed emails.";
                        }
                    } finally {
                        retryAllBtn.disabled = false;
                        retryAllBtn.innerHTML = '<span class="material-icons icon-tiny">sync</span> Retry Failed Reminders';
                    }
                });
            }

            if (savePrefsBtn) {
                savePrefsBtn.addEventListener("click", async () => {
                    savePrefsBtn.disabled = true;
                    savePrefsBtn.textContent = "Saving...";

                    const updatedPrefs = {
                        in_app_enabled: document.getElementById("pref-in-app").checked ? 1 : 0,
                        email_enabled: document.getElementById("pref-email").checked ? 1 : 0,
                        appointment_reminders: document.getElementById("pref-appts").checked ? 1 : 0,
                        medication_reminders: document.getElementById("pref-meds").checked ? 1 : 0,
                        vaccine_reminders: document.getElementById("pref-vax").checked ? 1 : 0
                    };

                    try {
                        const res = await fetch("/api/notifications/preferences", {
                            method: "PUT",
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(updatedPrefs)
                        });
                        if (res.ok) {
                            hidePrefsModal();
                        }
                    } catch (err) {
                        console.error("Error saving notification preferences:", err);
                    } finally {
                        savePrefsBtn.disabled = false;
                        savePrefsBtn.textContent = "Save Notification Preferences";
                    }
                });
            }
        }
    }

    // Fetch unread count for navbar badge
    async function fetchUnreadCount() {
        const token = localStorage.getItem('petziToken');
        const badge = document.getElementById("nav-notification-badge");
        const unreadTabCount = document.getElementById("unread-tab-count");
        if (!token) return;

        try {
            const res = await fetch("/api/notifications/unread-count", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                updateBadgeCount(data.unread_count || 0);
            }
        } catch (err) {
            // Silently handle offline/fetch errors
        }
    }

    function updateBadgeCount(count) {
        const badge = document.getElementById("nav-notification-badge");
        const unreadTabCount = document.getElementById("unread-tab-count");
        if (unreadTabCount) unreadTabCount.textContent = count;

        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-flex';
                badge.classList.add('pulse');
                setTimeout(() => badge.classList.remove('pulse'), 600);
            } else {
                badge.textContent = '0';
                badge.style.display = 'none';
            }
        }
    }

    // Fetch and render notification list
    async function loadNotifications(filter = 'all') {
        const token = localStorage.getItem('petziToken');
        const container = document.getElementById("notification-list-container");
        if (!token || !container) return;

        container.innerHTML = `
            <div class="notification-loading">
                <span class="material-icons spinning">sync</span> Loading notifications...
            </div>
        `;

        try {
            const url = filter === 'unread' ? '/api/notifications?unread_only=true' : '/api/notifications';
            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Failed to load notifications");

            const data = await res.json();
            const notifications = data.notifications || [];
            updateBadgeCount(data.unread_count || 0);

            if (notifications.length === 0) {
                container.innerHTML = `
                    <div class="notification-empty">
                        <span class="material-icons empty-icon">notifications_off</span>
                        <p class="empty-title">${filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
                        <p class="empty-subtitle">You're all caught up on your pet care schedule!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = notifications.map(n => renderNotificationCard(n)).join('');

            // Bind click actions to mark read, retry email, and navigate
            container.querySelectorAll(".notification-card").forEach(card => {
                const id = card.getAttribute("data-id");
                const actionUrl = card.getAttribute("data-url");

                card.addEventListener("click", async (e) => {
                    // If clicked retry single email specifically
                    const retryBtn = e.target.closest(".btn-retry-single-email");
                    if (retryBtn) {
                        e.stopPropagation();
                        retryBtn.disabled = true;
                        retryBtn.innerHTML = '<span class="material-icons icon-micro spinning">sync</span>';
                        try {
                            const res = await fetch(`/api/notifications/${id}/resend`, {
                                method: "POST",
                                headers: { "Authorization": `Bearer ${token}` }
                            });
                            const resData = await res.json();
                            if (res.ok && resData.success) {
                                loadNotifications(currentNotificationFilter);
                                if (resData.previewUrl) {
                                    window.open(resData.previewUrl, '_blank');
                                }
                            } else {
                                // Open Settings Modal with informative guidance instead of a harsh browser alert
                                const notifPanel = document.getElementById("petzi-notification-panel");
                                const prefsModal = document.getElementById("notification-prefs-modal");
                                const statusBox = document.getElementById("email-status-box");
                                if (notifPanel) notifPanel.classList.remove("open");
                                if (prefsModal) prefsModal.style.display = "flex";
                                if (statusBox) {
                                    statusBox.className = "email-status-box error";
                                    statusBox.innerHTML = `<strong>⚠ Email Delivery Issue:</strong> ${resData.error || 'Authentication error'}<br><small>${resData.hint || 'Update your 16-character Google App Password or switch to Free Test Mailbox below.'}</small>`;
                                }
                                retryBtn.disabled = false;
                                retryBtn.innerHTML = '<span class="material-icons icon-micro">refresh</span> Retry';
                            }
                        } catch (err) {
                            alert("Error resending email");
                            retryBtn.disabled = false;
                            retryBtn.innerHTML = '<span class="material-icons icon-micro">refresh</span> Retry';
                        }
                        return;
                    }

                    // If clicked the mark-read checkmark specifically
                    if (e.target.closest(".btn-card-read")) {
                        e.stopPropagation();
                        await markSingleRead(id, card);
                        return;
                    }

                    // Mark as read and navigate
                    if (!card.classList.contains("read")) {
                        await markSingleRead(id, card);
                    }

                    if (actionUrl) {
                        window.location.href = actionUrl;
                    }
                });
            });

        } catch (err) {
            console.error("Error loading notifications:", err);
            container.innerHTML = `
                <div class="notification-empty">
                    <span class="material-icons empty-icon" style="color:#EF4444;">error_outline</span>
                    <p class="empty-title">Could not load notifications</p>
                    <p class="empty-subtitle">Please check your connection and try again.</p>
                </div>
            `;
        }
    }

    async function markSingleRead(id, cardEl) {
        const token = localStorage.getItem('petziToken');
        try {
            const res = await fetch(`/api/notifications/${id}/read`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                if (cardEl) {
                    cardEl.classList.remove("unread");
                    cardEl.classList.add("read");
                    const markBtn = cardEl.querySelector(".btn-card-read");
                    if (markBtn) markBtn.remove();
                }
                fetchUnreadCount();
            }
        } catch (err) {
            console.error("Error marking notification read:", err);
        }
    }

    function renderNotificationCard(n) {
        const isRead = Boolean(n.is_read);
        const iconMap = {
            appointment: "event",
            medication: "vaccines",
            vaccination: "shield",
            grooming: "spa",
            supply: "inventory_2",
            general: "notifications"
        };
        const icon = iconMap[n.type] || "notifications";
        const relativeTime = formatRelativeTime(n.created_at);
        const exactTime = formatExactTime(n.created_at);
        const timeDisplay = exactTime ? `${relativeTime} &bull; ${exactTime}` : relativeTime;

        // Email status is handled silently — no badge shown to the user
        const emailBadgeHtml = "";

        return `
            <div class="notification-card ${isRead ? 'read' : 'unread'}" data-id="${n.id}" data-url="${n.action_url || ''}">
                <div class="card-icon-wrapper type-${n.type}">
                    <span class="material-icons">${icon}</span>
                </div>
                <div class="card-content">
                    <div class="card-header-row">
                        <span class="card-title">${escapeHtml(n.title)}</span>
                        ${!isRead ? '<span class="unread-dot" title="Unread"></span>' : ''}
                    </div>
                    <p class="card-message">${escapeHtml(n.message)}</p>
                    <div class="card-footer-row">
                        <span class="card-time" title="${exactTime ? 'Received at ' + exactTime : ''}"><span class="material-icons icon-tiny">schedule</span> ${timeDisplay}</span>
                        ${n.pet_name ? `<span class="card-pet-tag"><span class="material-icons icon-tiny">pets</span> ${escapeHtml(n.pet_name)}</span>` : ''}
                        ${emailBadgeHtml}
                    </div>
                </div>
                ${!isRead ? `
                    <button class="btn-card-read" title="Mark as read">
                        <span class="material-icons">check</span>
                    </button>
                ` : ''}
            </div>
        `;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Fetch and populate pet options when on non-dashboard pages
    async function populatePetSelector() {
        const desktopSelector = document.getElementById("header-pet-selector");
        const mobileSelector = document.getElementById("mobile-pet-selector");

        // Helper: set both selectors to a given single-option state
        function setSelectorsState(text) {
            [desktopSelector, mobileSelector].forEach(selector => {
                if (!selector) return;
                selector.innerHTML = '';
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = text;
                selector.appendChild(opt);
            });
        }

        const user = JSON.parse(localStorage.getItem('petziUser') || 'null');
        const urlParams = new URLSearchParams(window.location.search);
        let selectedPetId = urlParams.get('pet_id') || urlParams.get('id');

        // No user/session: clear loading state and bail
        if (!user || !user.id) {
            setSelectorsState("No session");
            return;
        }

        try {
            // Use window.apiRequest which correctly handles 401 (clears auth & redirects)
            const pets = await window.apiRequest('/api/pets');

            [desktopSelector, mobileSelector].forEach(selector => {
                if (!selector) return;
                selector.innerHTML = '';

                if (pets && pets.length > 0) {
                    pets.forEach(p => {
                        const opt = document.createElement("option");
                        opt.value = p.id;
                        opt.textContent = `${p.name} (${p.species || 'Pet'})`;
                        selector.appendChild(opt);
                    });

                    // Select the pet whose ID is in the URL (works for both ?id= and ?pet_id=)
                    if (!selectedPetId || !pets.some(p => String(p.id) === String(selectedPetId))) {
                        selectedPetId = pets[0].id;
                    }
                    selector.value = selectedPetId;

                    // Sync selector change → navigate to selected pet
                    selector.addEventListener("change", (e) => {
                        const newId = e.target.value;
                        const url = new URL(window.location);
                        url.searchParams.set('pet_id', newId);

                        if (path.includes('pet.html')) {
                            url.searchParams.set('id', newId);
                        }

                        window.location.href = url.toString();
                    });
                } else {
                    const opt = document.createElement("option");
                    opt.value = "";
                    opt.textContent = "No pets added";
                    selector.appendChild(opt);
                }
            });
        } catch (err) {
            console.error("Error populating pet navigation selector:", err);
            // Always resolve the loading state — never leave "Loading Pets..." on error
            setSelectorsState("Could not load pets");
        }
    }

    // Dynamic active state styling
    function highlightActiveLink() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';

        if (isDashboard) {
            const highlightDashboardTab = (tabName) => {
                // Highlight desktop buttons
                document.querySelectorAll(".desktop-nav button.nav-btn, .desktop-nav a.nav-btn").forEach(btn => {
                    const name = btn.getAttribute("data-tab-name");
                    if (name === tabName) {
                        btn.classList.add("active");
                    } else {
                        btn.classList.remove("active");
                    }
                });

                // Highlight popover dropdown items
                document.querySelectorAll(".petzi-hamburger-dropdown a.dropdown-item").forEach(item => {
                    const name = item.getAttribute("data-tab-name");
                    if (name === tabName) {
                        item.classList.add("active");
                    } else {
                        item.classList.remove("active");
                    }
                });
            };

            // Initial highlight
            highlightDashboardTab(hash);

            // Watch hashchange
            window.addEventListener("hashchange", () => {
                const newHash = window.location.hash.replace('#', '') || 'dashboard';
                highlightDashboardTab(newHash);
            });

            // Listen to tab clicks locally
            document.addEventListener("click", (e) => {
                const btn = e.target.closest(".desktop-nav button.nav-btn, .desktop-nav a.nav-btn");
                if (btn) {
                    const name = btn.getAttribute("data-tab-name");
                    if (name) highlightDashboardTab(name);
                }
            });
        }
    }
})();
