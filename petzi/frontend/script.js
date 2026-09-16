// Pet Care Log & Medication Reminder - Application Logic
document.addEventListener("DOMContentLoaded", () => {
    // Check authentication guard for protected dashboard
    if (window.Auth && !window.Auth.checkAuthGuard()) return;

    // API Endpoints Base URL
    const API_BASE = "/api";

    // Application State Cache
    let currentPet = null;
    let medicationsList = [];
    let activitiesToday = [];
    let activitiesAll = [];
    let suppliesList = [];
    let vaccinationsList = [];
    let groomingListState = [];
    let vetVisitsListState = [];

    // Reminders state
    const triggeredReminders = {}; // Key: medId_dateStr_time -> 'given' | 'pending'
    const snoozeUntil = {};       // Key: medId -> timestamp
    const triggeredLowStockAlerts = {}; // Key: petId_supplyId_stockValue -> true

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // DOM Elements Cache
    const navButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const toastContainer = document.getElementById("toast-container");

    // Pet Profile Elements
    const displayPetName = document.getElementById("display-pet-name");
    const displayPetAge = document.getElementById("display-pet-age");
    const displayPetBreed = document.getElementById("display-pet-breed");
    const displayPetGender = document.getElementById("display-pet-gender");
    const displayPetWeight = document.getElementById("display-pet-weight");
    const displayPetOwner = document.getElementById("display-pet-owner");
    const displaySpecialInstructions = document.getElementById("display-special-instructions");
    const btnExportPdf = document.getElementById("btn-export-pdf");

    // Forms
    const petProfileForm = document.getElementById("pet-profile-form");
    const medicationForm = document.getElementById("medication-form");
    const quickPetForm = document.getElementById("quick-pet-form");
    const editPetModal = document.getElementById("edit-pet-modal");

    // Quick Edit Triggers
    const btnEditPetQuick = document.getElementById("btn-edit-pet-quick");
    const btnCloseModal = document.getElementById("btn-close-modal");
    const btnCancelModal = document.getElementById("btn-cancel-modal");

    // Supplies DOM Elements
    const addSupplyModal = document.getElementById("add-supply-modal");
    const btnCloseSupplyModal = document.getElementById("btn-close-supply-modal");
    const btnCancelSupplyModal = document.getElementById("btn-cancel-supply-modal");
    const addSupplyForm = document.getElementById("add-supply-form");
    const btnAddSupplyTrigger = document.getElementById("btn-add-supply-trigger");
    const suppliesContainer = document.getElementById("supplies-list-container");
    const suppliesEmpty = document.getElementById("supplies-empty");

    const restockSupplyModal = document.getElementById("restock-supply-modal");
    const btnCloseRestockModal = document.getElementById("btn-close-restock-modal");
    const btnCancelRestockModal = document.getElementById("btn-cancel-restock-modal");
    const restockSupplyForm = document.getElementById("restock-supply-form");
    const restockSupplyId = document.getElementById("restock-supply-id");
    const restockItemLabel = document.getElementById("restock-item-label");

    // Vaccine Elements
    const vaccineModal = document.getElementById("vaccine-modal");
    const vaccineForm = document.getElementById("vaccine-form");
    const vaccinesEmpty = document.getElementById("vaccines-empty");
    const vaccinesList = document.getElementById("vaccines-list");
    const btnAddVaccine = document.getElementById("btn-add-vaccine");
    const btnCloseVaccineModal = document.getElementById("btn-close-vaccine-modal");
    const btnCancelVaccineModal = document.getElementById("btn-cancel-vaccine-modal");

    // Grooming Elements
    const groomingModal = document.getElementById("grooming-modal");
    const groomingForm = document.getElementById("grooming-form");
    const groomingEmpty = document.getElementById("grooming-empty");
    const groomingList = document.getElementById("grooming-list");
    const btnAddGrooming = document.getElementById("btn-add-grooming");
    const btnCloseGroomingModal = document.getElementById("btn-close-grooming-modal");
    const btnCancelGroomingModal = document.getElementById("btn-cancel-grooming-modal");

    // Vet Visits Elements
    const vetVisitModal = document.getElementById("vet-visit-modal");
    const vetVisitForm = document.getElementById("vet-visit-form");
    const vetVisitsEmpty = document.getElementById("vet-visits-empty");
    const vetVisitsList = document.getElementById("vet-visits-list");
    const btnAddVetVisit = document.getElementById("btn-add-vet-visit");
    const btnCloseVetVisitModal = document.getElementById("btn-close-vet-visit-modal");
    const btnCancelVetVisitModal = document.getElementById("btn-cancel-vet-visit-modal");

    // Lightbox Elements
    const vetAttachmentLightbox = document.getElementById("vet-attachment-lightbox");
    const btnCloseVetLightbox = document.getElementById("btn-close-vet-lightbox");
    const vetLightboxContent = document.getElementById("vet-lightbox-content");
    const vetLightboxCaption = document.getElementById("vet-lightbox-caption");

    // Medication Sound Elements
    const medSoundType = document.getElementById("med-sound-type");
    const customSoundContainer = document.getElementById("custom-sound-container");
    const medCustomSoundFile = document.getElementById("med-custom-sound-file");
    const customSoundFilename = document.getElementById("custom-sound-filename");
    const btnPreviewCustomSound = document.getElementById("btn-preview-custom-sound");
    let editingCustomSoundUrl = null;
    let customPreviewAudio = null;
    let isCustomPreviewPlaying = false;

    // Timers Elements
    const timerFeeding = document.getElementById("timer-feeding");
    const timerWalking = document.getElementById("timer-walking");
    const timerMedication = document.getElementById("timer-medication");

    // Timeline & Medications Elements
    const timelineContainer = document.getElementById("timeline-container");
    const timelineEmpty = document.getElementById("timeline-empty");
    const medicationsContainer = document.getElementById("medications-list");
    const medicationsEmpty = document.getElementById("medications-empty");

    // History elements
    const historyTableBody = document.getElementById("history-table-body");
    const historyEmpty = document.getElementById("history-empty");
    const historyTable = document.getElementById("history-table");
    const filterDate = document.getElementById("filter-date");
    const filterType = document.getElementById("filter-type");
    const btnClearFilters = document.getElementById("btn-clear-filters");
    const btnExportHistory = document.getElementById("btn-export-history");

    // Reminder Overlay Elements
    const reminderOverlay = document.getElementById("reminder-overlay");
    const reminderText = document.getElementById("reminder-text");
    const btnReminderGiven = document.getElementById("btn-reminder-given");
    const btnReminderSnooze = document.getElementById("btn-reminder-snooze");
    let activeReminder = null; // Holds medication object currently shown

    // ----------------------------------------------------
    // 1. NAVIGATION & INITIALIZATION
    // ----------------------------------------------------

    // Setup Tab Navigation
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");

            navButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            btn.classList.add("active");

            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add("active");
            }

            // Fetch fresh data based on tab clicked
            if (targetId === "dashboard-section") {
                loadDashboardData();
            } else if (targetId === "medications-section") {
                loadMedications();
            } else if (targetId === "vaccines-section") {
                loadVaccinations();
            } else if (targetId === "grooming-section") {
                loadGroomingData();
            } else if (targetId === "vet-visits-section") {
                loadVetVisitsData();
            } else if (targetId === "history-section") {
                loadHistory();
            }
        });
    });

    // Main App Initialization
    async function initApp() {
        console.log("Initializing Pet Care Log Application...");

        // Set default filter date in history to today
        const todayStr = getLocalDateString(new Date());
        filterDate.value = todayStr;

        // Check if pet_id is provided in URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        let targetPetId = urlParams.get('pet_id');

        // Setup Header Pet Selector Dropdown
        const currentUser = JSON.parse(localStorage.getItem('petziUser') || 'null');
        const petSelector = document.getElementById('header-pet-selector');

        if (petSelector) {
            try {
                let userPetsUrl = `${API_BASE}/pets`;
                if (currentUser && currentUser.id) {
                    userPetsUrl += `?user_id=${currentUser.id}`;
                }
                const allPets = await apiRequest(userPetsUrl);
                petSelector.innerHTML = '';

                if (allPets && allPets.length > 0) {
                    allPets.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = `${p.name} (${p.species || 'Pet'})`;
                        petSelector.appendChild(opt);
                    });

                    if (!targetPetId) {
                        targetPetId = allPets[0].id;
                    }
                    petSelector.value = targetPetId;

                    petSelector.addEventListener('change', async (e) => {
                        const newPetId = e.target.value;
                        const newUrl = new URL(window.location);
                        newUrl.searchParams.set('pet_id', newPetId);
                        window.history.pushState({}, '', newUrl);

                        await loadPetProfile(newPetId);
                        await loadDashboardData();
                        await loadMedications();
                        await loadHistory();
                        await loadVaccinations();
                        await loadGroomingData();
                        await loadVetVisitsData();
                    });
                } else {
                    petSelector.innerHTML = '<option value="1">Bruno (Default)</option>';
                    if (!targetPetId) targetPetId = 1;
                }
            } catch (err) {
                console.error("Failed loading pets for dropdown:", err);
                if (!targetPetId) targetPetId = 1;
            }
        } else {
            if (!targetPetId) targetPetId = 1;
        }

        // Load Pet Profile
        const petLoaded = await loadPetProfile(targetPetId);
        if (petLoaded) {
            loadDashboardData();

            // Set up background timers & medication schedulers
            // Update relative timers every 30 seconds
            setInterval(updateRelativeTimers, 30000);

            // Check medication reminder schedules every 10 seconds
            setInterval(checkMedicationReminders, 10000);

            // Automatic 24-Hour Cycle Day Reset Watcher
            let lastKnownCalendarDay = getLocalDateString(new Date());
            setInterval(() => {
                const currentCalendarDay = getLocalDateString(new Date());
                if (currentCalendarDay !== lastKnownCalendarDay) {
                    console.log(`24-hour cycle boundary triggered (${lastKnownCalendarDay} -> ${currentCalendarDay}). Resetting dashboard daily logs.`);
                    lastKnownCalendarDay = currentCalendarDay;
                    if (filterDate) filterDate.value = currentCalendarDay;
                    loadDashboardData();
                    loadHistory();
                }
            }, 10000);

            // Exact midnight scheduler for instant 00:00:01 rollover
            function scheduleMidnightReset() {
                const now = new Date();
                const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
                const msUntilMidnight = midnight.getTime() - now.getTime();
                setTimeout(() => {
                    lastKnownCalendarDay = getLocalDateString(new Date());
                    if (filterDate) filterDate.value = lastKnownCalendarDay;
                    loadDashboardData();
                    loadHistory();
                    scheduleMidnightReset();
                }, Math.max(msUntilMidnight, 1000));
            }
            scheduleMidnightReset();
        }

        // Check URL hash for direct tab navigation
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            const tabMap = {
                'feeding': 'dashboard-section',
                'walking': 'dashboard-section',
                'dashboard': 'dashboard-section',
                'medication': 'medications-section',
                'medications': 'medications-section',
                'history': 'history-section',
                'profile': 'profile-section',
                'vaccines': 'vaccines-section',
                'vaccine': 'vaccines-section',
                'grooming': 'grooming-section',
                'vet-visits': 'vet-visits-section',
                'vetvisits': 'vet-visits-section'
            };
            const targetSectionId = tabMap[hash];
            if (targetSectionId) {
                const btn = document.querySelector(`.nav-btn[data-target="${targetSectionId}"]`);
                if (btn) btn.click();
            }
        }
    }

    // ----------------------------------------------------
    // 2. HELPER UTILITIES
    // ----------------------------------------------------

    // Show Custom Floating Toast Alert
    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        const icon = document.createElement("span");
        icon.className = "material-icons";
        icon.innerText = type === "success" ? "check_circle" : "error";

        const text = document.createElement("span");
        text.innerText = message;

        toast.appendChild(icon);
        toast.appendChild(text);
        toastContainer.appendChild(toast);

        // Remove toast after 4 seconds
        setTimeout(() => {
            toast.style.animation = "fadeIn 0.3s ease-out reverse";
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Format local Date object to YYYY-MM-DD
    function getLocalDateString(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`; // returns YYYY-MM-DD
    }

    // Disable past dates for medication schedule and future-only date pickers (set min to today)
    function setupDatePickers() {
        const today = getLocalDateString(new Date());

        const medStartInp = document.getElementById('med-start-date');
        const medEndInp = document.getElementById('med-end-date');
        const vacNextDueInp = document.getElementById('vaccine-next-due-date');
        const groomDueInp = document.getElementById('grooming-input-due');

        if (vacNextDueInp) vacNextDueInp.min = today;
        if (groomDueInp) groomDueInp.min = today;

        if (medStartInp) {
            medStartInp.min = today;

            const handleMedStartChange = () => {
                if (!medStartInp.value) return;
                const curToday = getLocalDateString(new Date());
                if (medStartInp.value < curToday) {
                    medStartInp.value = curToday;
                    showToast('Start Date cannot be in the past.', 'error');
                }
                if (medEndInp) {
                    medEndInp.min = medStartInp.value || curToday;
                    if (medEndInp.value && medEndInp.value < medStartInp.value) {
                        medEndInp.value = medStartInp.value;
                    }
                }
            };

            medStartInp.addEventListener('change', handleMedStartChange);
            medStartInp.addEventListener('input', () => {
                if (medStartInp.value && medStartInp.value.length === 10) {
                    handleMedStartChange();
                }
            });
        }

        if (medEndInp) {
            medEndInp.min = (medStartInp && medStartInp.value && medStartInp.value >= today) ? medStartInp.value : today;

            const handleMedEndChange = () => {
                if (!medEndInp.value) return;
                const curToday = getLocalDateString(new Date());
                const minAllowed = (medStartInp && medStartInp.value) ? medStartInp.value : curToday;
                if (medEndInp.value < minAllowed) {
                    medEndInp.value = minAllowed;
                    showToast('End Date cannot be before Start Date or in the past.', 'error');
                }
            };

            medEndInp.addEventListener('change', handleMedEndChange);
            medEndInp.addEventListener('input', () => {
                if (medEndInp.value && medEndInp.value.length === 10) {
                    handleMedEndChange();
                }
            });
        }
    }
    setupDatePickers();

    // Format ISO timestamp to relative time (e.g. "2 hours ago", "Just now", etc.)
    function formatRelativeTime(isoString) {
        if (!isoString) return "Never";
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();

        if (diffMs < 0) return "Just now"; // Handle clock drift

        const diffMins = Math.floor(diffMs / (60 * 1000));
        const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

        if (diffMins < 1) {
            return "Just now";
        }
        if (diffMins < 60) {
            return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
        }
        if (diffHours < 24) {
            const dateDay = date.getDate();
            const nowDay = now.getDate();
            if (dateDay !== nowDay && diffHours >= 12) {
                return "Yesterday";
            }
            return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        }

        // Check if yesterday
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        }

        // Return absolute formatted date
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    // Format ISO string to time (e.g. "09:00 AM")
    function formatTime(isoString) {
        if (!isoString) return "";
        const date = new Date(isoString);
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // The hour '0' should be '12'
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }

    // Format time input string (24-hour HH:MM) to 12-hour AM/PM
    function formatTimeInputTo12Hour(timeStr) {
        if (!timeStr) return "";
        const parts = timeStr.split(":");
        if (parts.length < 2) return timeStr;
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }

    // Format ISO date to nice readable format (e.g. "25 Aug 2026")
    function formatNiceDate(isoString) {
        if (!isoString) return "";
        const d = new Date(isoString);
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // Convert time string to 24-hour HH:MM format for scheduler comparisons
    function convertTo24Hour(timeStr) {
        if (!timeStr) return "";
        timeStr = timeStr.trim();
        if (/^\d{2}:\d{2}$/.test(timeStr)) {
            return timeStr;
        }
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = match[2];
            const ampm = match[3].toUpperCase();
            if (ampm === "PM" && hours < 12) {
                hours += 12;
            } else if (ampm === "AM" && hours === 12) {
                hours = 0;
            }
            return `${String(hours).padStart(2, '0')}:${minutes}`;
        }
        return timeStr;
    }

    // Centralized Request Wrapper for Connection Error Handling
    async function apiRequest(url, options = {}) {
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

                throw new Error("Session expired. Please login again.");
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Request failed on ${url}:`, error.message);
            // Only show the generic connection toast for actual network/connection failures.
            // HTTP 4xx/5xx errors are thrown by the !response.ok branch above; callers handle
            // those with their own contextual messages. Showing the generic toast for every
            // HTTP error caused a double-toast (this toast + the caller's catch toast).
            if (error instanceof TypeError || error.message === "Failed to fetch") {
                showToast("Unable to connect to server. Please check your connection.", "error");
            }
            throw error;
        }
    }

    // ----------------------------------------------------
    // 3. PET PROFILE CONTROLLER
    // ----------------------------------------------------

    // Format Pet Age with user-selected Unit (Years / Months)
    function formatPetAge(petOrAge, ageUnit) {
        let ageVal = null;
        let unitVal = 'years';

        if (typeof petOrAge === 'object' && petOrAge !== null) {
            ageVal = petOrAge.age;
            unitVal = petOrAge.age_unit || petOrAge.ageUnit || 'years';
        } else {
            ageVal = petOrAge;
            unitVal = ageUnit || 'years';
        }

        if (ageVal === null || ageVal === undefined || ageVal === '') {
            return 'Unknown Age';
        }

        const num = parseFloat(ageVal);
        if (isNaN(num)) return 'Unknown Age';

        const normalizedUnit = (unitVal || 'years').toString().toLowerCase().trim();
        const isMonth = normalizedUnit.includes('month');

        if (isMonth) {
            return num === 1 ? '1 Month' : `${num} Months`;
        } else {
            return num === 1 ? '1 Year' : `${num} Years`;
        }
    }

    // Fetch and populate pet profile details
    async function loadPetProfile(petId = 1) {
        try {
            // First try fetching pet 1, if failed fallback to check all pets
            let pet;
            try {
                pet = await apiRequest(`${API_BASE}/pets/${petId}`);
            } catch (err) {
                const petsList = await apiRequest(`${API_BASE}/pets`);
                if (petsList && petsList.length > 0) {
                    pet = petsList[0];
                } else {
                    throw new Error("No pets returned");
                }
            }

            currentPet = pet;

            // Update Dashboard displays
            displayPetName.innerText = pet.name;
            displayPetAge.innerText = formatPetAge(pet);
            displayPetBreed.innerText = pet.breed || "Unknown Breed";
            displayPetGender.innerText = pet.gender || "Unknown Gender";
            displayPetWeight.innerText = pet.weight ? `${pet.weight} kg` : "Unknown Weight";
            displayPetOwner.innerText = pet.owner_name || "Unknown Owner";
            displaySpecialInstructions.innerText = pet.special_instructions || "No special instructions registered.";

            // Update profile avatar image dynamically
            const profileAvatar = document.querySelector(".profile-avatar");
            if (profileAvatar) {
                if (pet.species_image) {
                    profileAvatar.innerHTML = `<img src="${pet.species_image}" alt="${escapeHtml(pet.name)}" style="width:100%; height:100%; object-fit:cover; object-position:center 20%; border-radius:inherit;">`;
                } else {
                    profileAvatar.innerHTML = `<span class="material-icons">pets</span>`;
                }
            }

            // Populate form elements in Pet tab
            if (document.getElementById("pet-name")) document.getElementById("pet-name").value = pet.name || "";
            if (document.getElementById("pet-owner")) document.getElementById("pet-owner").value = pet.owner_name || "";
            if (document.getElementById("pet-breed")) document.getElementById("pet-breed").value = pet.breed || "";
            if (document.getElementById("pet-gender")) document.getElementById("pet-gender").value = pet.gender || "";
            if (document.getElementById("pet-age")) document.getElementById("pet-age").value = pet.age || "";
            if (document.getElementById("pet-age-unit")) document.getElementById("pet-age-unit").value = pet.age_unit || pet.ageUnit || "years";
            if (document.getElementById("pet-weight")) document.getElementById("pet-weight").value = pet.weight || "";
            if (document.getElementById("pet-instructions")) document.getElementById("pet-instructions").value = pet.special_instructions || "";

            // Populate form elements in Quick Edit modal
            if (document.getElementById("quick-pet-name")) document.getElementById("quick-pet-name").value = pet.name || "";
            if (document.getElementById("quick-pet-owner")) document.getElementById("quick-pet-owner").value = pet.owner_name || "";
            if (document.getElementById("quick-pet-breed")) document.getElementById("quick-pet-breed").value = pet.breed || "";
            if (document.getElementById("quick-pet-gender")) document.getElementById("quick-pet-gender").value = pet.gender || "";
            if (document.getElementById("quick-pet-age")) document.getElementById("quick-pet-age").value = pet.age || "";
            if (document.getElementById("quick-pet-age-unit")) document.getElementById("quick-pet-age-unit").value = pet.age_unit || pet.ageUnit || "years";
            if (document.getElementById("quick-pet-weight")) document.getElementById("quick-pet-weight").value = pet.weight || "";
            if (document.getElementById("quick-pet-instructions")) document.getElementById("quick-pet-instructions").value = pet.special_instructions || "";

            const quickPreview = document.getElementById("quick-pet-image-preview");
            if (quickPreview) {
                if (pet.species_image) {
                    quickPreview.innerHTML = `<img src="${pet.species_image}" alt="${escapeHtml(pet.name)}" style="width:100%; height:100%; object-fit:cover;">`;
                } else {
                    quickPreview.innerHTML = `<span class="material-icons" style="color: #A56A3E; font-size: 1.8rem;">pets</span>`;
                }
            }
            if (document.getElementById("quick-pet-image")) document.getElementById("quick-pet-image").value = "";


            // Re-fetch and render activity timeline history for currentPet.id
            if (typeof loadHistory === "function") {
                await loadHistory();
            }

            return true;
        } catch (error) {
            console.error("Failed to load pet details:", error);
            displaySpecialInstructions.innerText = "Error loading pet profile from server.";
            return false;
        }
    }

    // Submit Pet Profile updates from Pet Tab
    petProfileForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentPet) return;

        const submitBtn = petProfileForm.querySelector("button[type='submit']");
        const originalHtml = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="material-icons spinner" style="font-size:1rem; animation: rotation 1s infinite linear; display:inline-block; vertical-align:middle; margin-right:4px;">autorenew</span> Saving...`;
        }

        const updatedData = {
            name: document.getElementById("pet-name").value.trim(),
            owner_name: document.getElementById("pet-owner").value.trim(),
            breed: document.getElementById("pet-breed").value.trim(),
            gender: document.getElementById("pet-gender").value,
            age: document.getElementById("pet-age").value,
            age_unit: document.getElementById("pet-age-unit")?.value || "years",
            weight: document.getElementById("pet-weight").value,
            special_instructions: document.getElementById("pet-instructions").value.trim()
        };

        try {
            await apiRequest(`${API_BASE}/pets/${currentPet.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedData)
            });
            showToast("Pet profile updated successfully!");
            await loadPetProfile(currentPet.id);
        } catch (err) {
            console.error("Failed to update profile:", err);
            showToast(err.message || "Failed to update profile.", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }
    });

    // Quick Edit Modals triggers
    btnEditPetQuick?.addEventListener("click", () => {
        if (!currentPet) return;
        editPetModal?.classList.remove("hidden");
    });

    function closePetModal() {
        editPetModal?.classList.add("hidden");
    }

    btnCloseModal?.addEventListener("click", closePetModal);
    btnCancelModal?.addEventListener("click", closePetModal);

    // Close modal if overlay clicked
    editPetModal?.addEventListener("click", (e) => {
        if (e.target === editPetModal) closePetModal();
    });

    // Live image preview for Quick Edit modal
    const quickPetImgInput = document.getElementById("quick-pet-image");
    quickPetImgInput?.addEventListener("change", (e) => {
        const file = e.target.files[0];
        const previewContainer = document.getElementById("quick-pet-image-preview");
        if (file && previewContainer) {
            const reader = new FileReader();
            reader.onload = (event) => {
                previewContainer.innerHTML = `<img src="${event.target.result}" alt="Preview" style="width:100%; height:100%; object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Submit Quick Edit Modal form
    quickPetForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentPet) return;

        const submitBtn = quickPetForm.querySelector("button[type='submit']");
        const originalHtml = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="material-icons spinner" style="font-size:1rem; animation: rotation 1s infinite linear; display:inline-block; vertical-align:middle; margin-right:4px;">autorenew</span> Saving...`;
        }

        const formData = new FormData();
        formData.append("name", document.getElementById("quick-pet-name").value.trim());
        formData.append("owner_name", document.getElementById("quick-pet-owner").value.trim());
        formData.append("breed", document.getElementById("quick-pet-breed").value.trim());
        formData.append("gender", document.getElementById("quick-pet-gender").value);
        formData.append("age", document.getElementById("quick-pet-age").value);
        formData.append("age_unit", document.getElementById("quick-pet-age-unit")?.value || "years");
        formData.append("weight", document.getElementById("quick-pet-weight").value);
        formData.append("special_instructions", document.getElementById("quick-pet-instructions").value.trim());

        const imageFile = document.getElementById("quick-pet-image")?.files[0];
        if (imageFile) {
            formData.append("image", imageFile);
        }

        try {
            await apiRequest(`${API_BASE}/pets/${currentPet.id}`, {
                method: "PUT",
                body: formData
            });
            closePetModal();
            showToast("Pet profile updated successfully!");
            await loadPetProfile(currentPet.id);
        } catch (err) {
            console.error("Failed to update quick profile:", err);
            showToast(err.message || "Failed to update profile.", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }
    });

    // ----------------------------------------------------
    // 3b. SUPPLIES STOCK MODALS & INTERACTIONS
    // ----------------------------------------------------

    // Open/Close Add Supply Modal
    btnAddSupplyTrigger?.addEventListener("click", () => {
        addSupplyForm.reset();
        addSupplyModal?.classList.remove("hidden");
    });

    function closeSupplyModal() {
        addSupplyModal?.classList.add("hidden");
    }

    btnCloseSupplyModal?.addEventListener("click", closeSupplyModal);
    btnCancelSupplyModal?.addEventListener("click", closeSupplyModal);
    addSupplyModal?.addEventListener("click", (e) => {
        if (e.target === addSupplyModal) closeSupplyModal();
    });

    // Open/Close Restock Modal
    function openRestockModal(id, name) {
        restockSupplyForm.reset();
        if (restockSupplyId) restockSupplyId.value = id;
        if (restockItemLabel) restockItemLabel.innerText = `Quantity to add for: ${name}`;
        restockSupplyModal?.classList.remove("hidden");
    }

    function closeRestockModal() {
        restockSupplyModal?.classList.add("hidden");
    }

    btnCloseRestockModal?.addEventListener("click", closeRestockModal);
    btnCancelRestockModal?.addEventListener("click", closeRestockModal);
    restockSupplyModal?.addEventListener("click", (e) => {
        if (e.target === restockSupplyModal) closeRestockModal();
    });

    // Add Supply Form Submission
    addSupplyForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentPet) return;

        const submitBtn = addSupplyForm.querySelector("button[type='submit']");
        const originalHtml = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="material-icons spinner" style="font-size:1rem; animation: rotation 1s infinite linear; display:inline-block; vertical-align:middle; margin-right:4px;">Adding...</span>`;
        }

        const item_type = document.getElementById("supply-item-type").value;
        const item_name = document.getElementById("supply-item-name").value.trim();
        const current_stock = parseFloat(document.getElementById("supply-current-stock").value);
        const unit = document.getElementById("supply-unit").value;
        const low_stock_threshold_days = parseInt(document.getElementById("supply-low-stock-threshold").value, 10);
        const usageInput = document.getElementById("supply-usage-per-log");
        const usage_per_log = usageInput && usageInput.value && !isNaN(parseFloat(usageInput.value)) ? parseFloat(usageInput.value) : undefined;

        try {
            await apiRequest(`${API_BASE}/supplies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pet_id: currentPet.id,
                    item_type,
                    item_name,
                    unit,
                    current_stock,
                    low_stock_threshold_days,
                    usage_per_log
                })
            });

            closeSupplyModal();
            showToast(`Added ${item_name} supply tracking!`);
            await loadSuppliesData();
        } catch (err) {
            console.error("Failed to add supply:", err);
            showToast(err.message || "Failed to add supply item", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }
    });

    // Restock Form Submission
    restockSupplyForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = restockSupplyId.value;
        const quantity = parseFloat(document.getElementById("restock-quantity").value);

        const submitBtn = restockSupplyForm.querySelector("button[type='submit']");
        const originalHtml = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="material-icons spinner" style="font-size:1rem; animation: rotation 1s infinite linear; display:inline-block; vertical-align:middle; margin-right:4px;">Restocking...</span>`;
        }

        try {
            await apiRequest(`${API_BASE}/supplies/${id}/restock`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quantity })
            });

            closeRestockModal();
            showToast(`Supply item restocked!`);
            await loadSuppliesData();
        } catch (err) {
            console.error("Failed to restock:", err);
            showToast(err.message || "Failed to restock supply item", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }
    });

    // Delete Supply Item Tracker
    async function deleteSupplyItem(id) {
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'Do you want to delete this supply tracker?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#A56A3E',
                cancelButtonColor: '#8E8E93',
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel',
                background: '#FFF3E4',
                color: '#4A2B1A',
                iconColor: '#A56A3E'
            });
            if (!result.isConfirmed) return;
        } else {
            if (!confirm("Are you sure you want to delete this supply tracker?")) return;
        }

        try {
            await apiRequest(`${API_BASE}/supplies/${id}`, {
                method: "DELETE"
            });
            showToast("Supply tracker removed.");
            await loadSuppliesData();
        } catch (err) {
            console.error("Failed to delete supply item:", err);
            showToast(err.message || "Failed to delete supply item", "error");
        }
    }

    // ----------------------------------------------------
    // 4. QUICK ACTIONS & TIMER CONTROLLERS
    // ----------------------------------------------------

    // Handle Quick Action Log Clicks
    const quickButtons = document.querySelectorAll(".quick-action-btn");
    quickButtons.forEach(btn => {
        let isLogging = false;
        btn.addEventListener("click", async () => {
            if (isLogging) return;
            if (!currentPet) {
                showToast("No active pet profile to log activity for.", "error");
                return;
            }

            const activityType = btn.getAttribute("data-activity");
            const notePlaceholder = `Logged ${activityType.toLowerCase()} via quick dashboard action.`;

            isLogging = true;
            btn.disabled = true;
            const originalText = btn.innerHTML;
            btn.innerHTML = `<span class="material-icons spinner" style="font-size:0.9rem; animation: rotation 1s infinite linear; display:inline-block; vertical-align:middle; margin-right:4px;">Logging...</span>`;

            try {
                await apiRequest(`${API_BASE}/activities`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pet_id: currentPet.id,
                        activity_type: activityType,
                        notes: notePlaceholder
                    })
                });

                showToast(`Successfully logged ${activityType}!`);

                // Refresh dashboard widgets without full page reload
                await loadDashboardData();
            } catch (err) {
                console.error("Quick log action failed:", err);
                showToast(err.message || `Failed to log ${activityType}`, "error");
            } finally {
                setTimeout(() => {
                    isLogging = false;
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }, 1000); // 1-second debounce visual feedback
            }
        });
    });

    // ----------------------------------------------------
    // CARE LOG CONTROLLER (Dashboard Care Log)
    // ----------------------------------------------------
    let currentPetLogs = [];
    let currentLogScope = 'today';
    let currentActiveTab = 'all';
    let isLoadingLogs = false;

    // Load pet care logs from API
    async function loadDashboardCareLogs() {
        if (!currentPet) return;

        const titleEl = document.getElementById("display-care-log-title");
        const subEl = document.getElementById("display-care-log-sub");
        if (titleEl) titleEl.textContent = `${currentPet.name}'s Care Log`;
        if (subEl) subEl.textContent = currentPet.name;

        isLoadingLogs = true;
        renderCurrentPetLogs();

        try {
            const fetchedLogs = await apiRequest(`${API_BASE}/pets/${currentPet.id}/logs?scope=all`);
            if (Array.isArray(fetchedLogs)) {
                currentPetLogs = fetchedLogs;
                const todayStr = getLocalDateString(new Date());
                activitiesToday = currentPetLogs.filter(log => {
                    if (!log.timestamp) return false;
                    return getLocalDateString(new Date(log.timestamp)) === todayStr;
                });
            } else {
                currentPetLogs = [];
                activitiesToday = [];
            }
        } catch (err) {
            console.error("Care logs fetch error:", err);
            if (!Array.isArray(currentPetLogs)) currentPetLogs = [];
            activitiesToday = [];
        } finally {
            isLoadingLogs = false;
            renderCurrentPetLogs();
            updateWellnessScore();
        }
    }

    function renderCurrentPetLogs() {
        const listContainer = document.getElementById('pet-logs-list');
        if (!listContainer) return;

        if (isLoadingLogs) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--color-text-muted);">
                    <div class="spinner" style="width:24px; height:24px; border-width:2px; margin:0 auto 12px;"></div>
                    <p style="font-size:0.9rem;">Loading care records...</p>
                </div>
            `;
            return;
        }

        const todayStr = getLocalDateString(new Date());

        // 1. Filter by Scope
        let scopeLogs = currentPetLogs;
        if (currentLogScope === 'today') {
            scopeLogs = currentPetLogs.filter(log => {
                if (!log.timestamp) return false;
                return getLocalDateString(new Date(log.timestamp)) === todayStr;
            });
        }

        // 2. Filter by Active Tab
        let filtered = scopeLogs;
        if (currentActiveTab !== 'all') {
            filtered = scopeLogs.filter(l => l.activity_type && l.activity_type.toLowerCase() === currentActiveTab.toLowerCase());
        }

        if (filtered.length === 0) {
            const petName = currentPet ? currentPet.name : 'your pet';
            let emptyIcon = 'history';
            let emptyTitle = 'No care records found';
            let emptyMsg = `Start logging care activities for ${escapeHtml(petName)}.`;

            if (currentLogScope === 'today') {
                emptyTitle = `No care records logged today`;
                emptyMsg = currentPetLogs.length > 0 ? `You have previous care records available in All History.` : `Start logging ${escapeHtml(petName)}'s activities to keep track of care.`;
            }

            if (currentActiveTab === 'feeding') {
                emptyIcon = 'restaurant';
                emptyTitle = currentLogScope === 'today' ? `No feedings logged today` : `No feeding records found`;
                emptyMsg = `Start tracking ${escapeHtml(petName)}'s feeding routine.`;
            } else if (currentActiveTab === 'walking') {
                emptyIcon = 'directions_walk';
                emptyTitle = currentLogScope === 'today' ? `No walks logged today` : `No walking records found`;
                emptyMsg = `Start tracking ${escapeHtml(petName)}'s daily walks.`;
            } else if (currentActiveTab === 'medication') {
                emptyIcon = 'medication';
                emptyTitle = currentLogScope === 'today' ? `No medications logged today` : `No medication records found`;
                emptyMsg = `Keep track of ${escapeHtml(petName)}'s doses.`;
            }

            listContainer.innerHTML = `
                <div class="log-empty-state" style="text-align:center; padding:32px 16px; background:var(--bg-card-alt); border-radius:12px;">
                    <div class="empty-icon" style="margin-bottom:8px; color:var(--petzi-brown);"><span class="material-icons" style="font-size:2.4rem;">${emptyIcon}</span></div>
                    <h4 style="margin:0 0 4px; font-size:1.05rem; font-family:var(--font-heading); color:var(--petzi-dark-brown);">${emptyTitle}</h4>
                    <p style="margin:0 0 12px; font-size:0.84rem; color:var(--color-text-secondary);">${emptyMsg}</p>
                    <button type="button" class="btn btn-secondary" style="padding:6px 14px; font-size:0.82rem;" onclick="openLogModal('${currentActiveTab === 'all' ? 'Feeding' : (currentActiveTab.charAt(0).toUpperCase() + currentActiveTab.slice(1))}')">
                        <span class="material-icons" style="font-size:0.9rem; vertical-align:middle;">add</span> Add Record
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(log => {
            let icon = 'restaurant';
            let iconClass = 'feeding';
            const typeLower = (log.activity_type || '').toLowerCase();
            if (typeLower === 'walking' || typeLower === 'walk' || typeLower === 'exercise') {
                icon = 'directions_walk';
                iconClass = 'walking';
            } else if (typeLower === 'medication' || typeLower === 'medicine') {
                icon = 'medication';
                iconClass = 'medication';
            } else if (typeLower === 'grooming' || typeLower === 'bath') {
                icon = 'spa';
                iconClass = 'feeding';
            } else if (typeLower === 'water' || typeLower === 'hydration') {
                icon = 'water_drop';
                iconClass = 'feeding';
            }

            const dayLabel = formatNiceDate(log.timestamp);
            const timeLabel = formatTime(log.timestamp);
            const relLabel = formatRelativeTime(log.timestamp);

            html += `
                <div class="log-entry-card" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#FFF9F2; border:1px solid #F2D8BD; border-radius:12px; margin-bottom:10px;">
                    <div class="log-entry-left" style="display:flex; align-items:center; gap:12px;">
                        <div class="log-entry-icon" style="width:36px; height:36px; border-radius:50%; background:#FFF3E4; border:1px solid #D7A46D; display:flex; align-items:center; justify-content:center; color:#4A2B1A;">
                            <span class="material-icons" style="font-size:1.1rem;">${icon}</span>
                        </div>
                        <div>
                            <div style="font-weight:700; font-size:0.92rem; color:#4A2B1A;">${escapeHtml(log.activity_type)}</div>
                            <div style="font-size:0.82rem; color:#8C532B; margin-top:2px;">${escapeHtml(log.notes || 'Logged successfully')}</div>
                        </div>
                    </div>
                    <div class="log-entry-right" style="display:flex; align-items:center; gap:16px;">
                        <div style="text-align:right;">
                            <div style="font-size:0.84rem; font-weight:600; color:#4A2B1A;">${dayLabel}, ${timeLabel}</div>
                            <div style="font-size:0.76rem; color:#8C532B;">${relLabel}</div>
                        </div>
                        <button type="button" class="btn-delete-log" title="Delete log" onclick="deleteLogEntry(${log.id})" style="background:transparent; border:none; color:#DC2626; cursor:pointer; padding:4px; display:flex; align-items:center;">
                            <span class="material-icons" style="font-size:1.15rem;">delete_outline</span>
                        </button>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    }

    // Modal & Action Event Triggers
    const logModal = document.getElementById("log-activity-modal");
    const btnCloseLogModal = document.getElementById("btn-close-log-modal");
    const btnCancelLogModal = document.getElementById("btn-cancel-log-modal");
    const logActivityForm = document.getElementById("log-activity-form");

    function openLogModal(type = "Feeding") {
        if (!logModal) return;
        const heading = document.getElementById("log-modal-heading");
        const icon = document.getElementById("log-modal-icon");
        const typeInput = document.getElementById("log-activity-type");
        const dynamicFields = document.getElementById("dynamic-log-fields");
        const timeInput = document.getElementById("log-time");
        const notesInput = document.getElementById("log-notes");
        const alertBox = document.getElementById("log-modal-alert");

        if (alertBox) {
            alertBox.className = "form-alert hidden";
            alertBox.textContent = "";
        }
        if (notesInput) notesInput.value = "";

        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        if (timeInput) timeInput.value = now.toISOString().slice(0, 16);

        if (typeInput) typeInput.value = type;
        if (heading) heading.textContent = `Log ${type} for ${currentPet ? currentPet.name : 'Pet'}`;

        if (dynamicFields) {
            if (type === "Feeding") {
                if (icon) icon.textContent = "restaurant";
                dynamicFields.innerHTML = `
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Food Type <span style="color:#DC2626;">*</span></label>
                            <select id="feed-food" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                                <option value="">Loading...</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Quantity</label>
                            <input type="text" id="feed-qty" placeholder="e.g., 150g / 1 bowl" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                        </div>
                    </div>
                `;
                if (currentPet) {
                    apiRequest(`${API_BASE}/supplies?pet_id=${currentPet.id}`).then(supplies => {
                        const dropdown = document.getElementById('feed-food');
                        if (dropdown && supplies) {
                            const foodItems = supplies.filter(s => (s.item_type || '').toLowerCase() === 'food');
                            if (foodItems.length > 0) {
                                dropdown.innerHTML = '<option value="" disabled selected>Select food item...</option>' + foodItems.map(s => `<option value="${escapeHtml(s.item_name)}">${escapeHtml(s.item_name)} — ${s.current_stock} ${escapeHtml(s.unit || '')} available</option>`).join('');
                            } else {
                                dropdown.innerHTML = '<option value="" disabled selected>No items available</option>';
                            }
                        }
                    }).catch(() => {});
                }
            } else if (type === "Walking") {
                if (icon) icon.textContent = "directions_walk";
                dynamicFields.innerHTML = `
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Duration</label>
                            <input type="text" id="walk-duration" placeholder="e.g., 30 minutes / 2 km" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Route / Park</label>
                            <input type="text" id="walk-route" placeholder="e.g., Neighborhood park" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                        </div>
                    </div>
                `;
            } else if (type === "Medication") {
                if (icon) icon.textContent = "medication";
                dynamicFields.innerHTML = `
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Medication Name <span style="color:#DC2626;">*</span></label>
                            <select id="log-med-name" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                                <option value="">Loading...</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Dosage</label>
                            <input type="text" id="log-med-dose" placeholder="e.g., 5 ml / 1 tablet" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                        </div>
                    </div>
                `;
                if (currentPet) {
                    apiRequest(`${API_BASE}/supplies?pet_id=${currentPet.id}`).then(supplies => {
                        const dropdown = document.getElementById('log-med-name');
                        if (dropdown && supplies) {
                            const medItems = supplies.filter(s => (s.item_type || '').toLowerCase() === 'medication');
                            if (medItems.length > 0) {
                                dropdown.innerHTML = '<option value="" disabled selected>Select medication...</option>' + medItems.map(s => `<option value="${escapeHtml(s.item_name)}">${escapeHtml(s.item_name)} — ${s.current_stock} ${escapeHtml(s.unit || '')} available</option>`).join('');
                            } else {
                                dropdown.innerHTML = '<option value="" disabled selected>No items available</option>';
                            }
                        }
                    }).catch(() => {});
                }
            } else if (type === "Grooming") {
                if (icon) icon.textContent = "spa";
                dynamicFields.innerHTML = `
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Grooming Activity</label>
                            <input type="text" id="groom-activity-type" placeholder="e.g., Bath / Nail Trim / Brushing" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                        </div>
                    </div>
                `;
            } else if (type === "Water") {
                if (icon) icon.textContent = "water_drop";
                dynamicFields.innerHTML = `
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Water / Hydration</label>
                            <input type="text" id="water-details" placeholder="e.g., Fresh bowl refilled / 250ml" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                        </div>
                    </div>
                `;
            } else if (type === "Exercise") {
                if (icon) icon.textContent = "fitness_center";
                dynamicFields.innerHTML = `
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Exercise Activity</label>
                            <input type="text" id="exercise-details" placeholder="e.g., 20 mins fetch / Agility training" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                        </div>
                    </div>
                `;
            } else {
                if (icon) icon.textContent = "favorite";
                dynamicFields.innerHTML = `
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:700; color:#4A2B1A; display:block; margin-bottom:4px;">Care Details</label>
                            <input type="text" id="general-details" placeholder="e.g., Health checkup, routine care" style="width:100%; padding:8px 12px; border:1.5px solid #D7A46D; border-radius:8px; background:#FFF9F2; font-size:0.9rem;">
                        </div>
                    </div>
                `;
            }
        }

        logModal.classList.remove("hidden");
    }

    function closeLogModal() {
        if (logModal) logModal.classList.add("hidden");
    }

    window.openLogModal = openLogModal;
    window.closeLogModal = closeLogModal;

    btnCloseLogModal?.addEventListener("click", closeLogModal);
    btnCancelLogModal?.addEventListener("click", closeLogModal);
    logModal?.addEventListener("click", (e) => {
        if (e.target === logModal) closeLogModal();
    });

    // Add log buttons handlers
    document.getElementById("btn-dashboard-log-feed")?.addEventListener("click", () => openLogModal("Feeding"));
    document.getElementById("btn-dashboard-log-walk")?.addEventListener("click", () => openLogModal("Walking"));
    document.getElementById("btn-dashboard-log-med")?.addEventListener("click", () => openLogModal("Medication"));
    document.getElementById("btn-dashboard-log-other")?.addEventListener("click", () => openLogModal("Care Activity"));

    // Scope pills handlers
    document.getElementById("btn-log-scope-today")?.addEventListener("click", () => setLogScope("today"));
    document.getElementById("btn-log-scope-all")?.addEventListener("click", () => setLogScope("all"));

    function setLogScope(scope) {
        currentLogScope = scope;
        document.getElementById("btn-log-scope-today")?.classList.toggle("active", scope === "today");
        document.getElementById("btn-log-scope-all")?.classList.toggle("active", scope === "all");
        const scopeText = document.getElementById("log-scope-text");
        if (scopeText) {
            scopeText.textContent = scope === 'today' ? "Showing logs from current 24-hour cycle" : "📚 Showing all historical records";
        }
        renderCurrentPetLogs();
    }

    // Filter tabs handlers
    const logTabBtns = document.querySelectorAll(".log-tab");
    logTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            logTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentActiveTab = tab;
            renderCurrentPetLogs();
        });
    });

    // Helper to parse quantity and unit
    function parseSupplyQuantity(str) {
        if (!str) return { value: 1, unit: "" };
        const cleaned = String(str).replace(/[()]/g, "").trim();
        const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)/);
        if (match) {
            return {
                value: parseFloat(match[1]),
                unit: (match[2] || "").trim().toLowerCase()
            };
        }
        return { value: 1, unit: "" };
    }

    // Helper to convert units
    function convertSupplyUnits(value, fromUnit, toUnit) {
        const f = (fromUnit || "").toLowerCase().trim();
        const t = (toUnit || "").toLowerCase().trim();
        if (!f || !t || f === t) return value;
        if (f === "g" && t === "kg") return value / 1000;
        if (f === "kg" && t === "g") return value * 1000;
        if (f === "mg" && t === "g") return value / 1000;
        if (f === "g" && t === "mg") return value * 1000;
        if (f === "ml" && t === "l") return value / 1000;
        if (f === "l" && t === "ml") return value * 1000;
        if ((f === "tablet" || f === "tablets") && (t === "tablet" || t === "tablets")) return value;
        if ((f === "pill" || f === "pills") && (t === "pill" || t === "pills")) return value;
        if ((f === "capsule" || f === "capsules") && (t === "capsule" || t === "capsules")) return value;
        if ((f === "pc" || f === "pcs") && (t === "pc" || t === "pcs")) return value;
        if ((f === "can" || f === "cans") && (t === "can" || t === "cans")) return value;
        return value;
    }

    // Submit Log Activity Form
    logActivityForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentPet) {
            showToast("No active pet profile selected.", "error");
            return;
        }

        const type = document.getElementById("log-activity-type").value;
        const timeVal = document.getElementById("log-time").value;
        const baseNotes = document.getElementById("log-notes").value.trim();

        let details = [];
        if (type === "Feeding") {
            const food = document.getElementById("feed-food")?.value.trim();
            const qty = document.getElementById("feed-qty")?.value.trim();
            if (!food) {
                showToast("Food Type is required.", "error");
                return;
            }
            if (food) details.push(food);
            if (qty) details.push(qty);

            // Pre-save stock existence & quantity validation
            try {
                const supplies = await apiRequest(`${API_BASE}/supplies?pet_id=${currentPet.id}`);
                const cleanFood = food.toLowerCase().trim();
                let matchedSupply = supplies?.find(s => 
                    (s.item_type || "").toLowerCase().trim() === "food" &&
                    (s.item_name || "").toLowerCase().trim() === cleanFood
                );
                if (!matchedSupply) {
                    matchedSupply = supplies?.find(s => (s.item_name || "").toLowerCase().trim() === cleanFood);
                }

                // 1. Check item existence
                if (!matchedSupply) {
                    showToast("Food not found in Supplies Stock.", "error");
                    return;
                }

                // 2. Check available quantity
                const parsed = parseSupplyQuantity(qty);
                const reqValue = parsed.value > 0 ? parsed.value : 1;
                const converted = convertSupplyUnits(reqValue, parsed.unit, matchedSupply.unit || "");
                if (converted > matchedSupply.current_stock) {
                    showToast("Insufficient stock. Please restock before logging.", "error");
                    return;
                }
            } catch (checkErr) {
                console.error("Supplies stock validation failed:", checkErr);
            }
        } else if (type === "Walking") {
            const dur = document.getElementById("walk-duration")?.value.trim();
            const route = document.getElementById("walk-route")?.value.trim();
            if (dur) details.push(dur);
            if (route) details.push(route);
        } else if (type === "Medication") {
            const nameEl = document.getElementById("log-med-name") || document.getElementById("med-name");
            const doseEl = document.getElementById("log-med-dose") || document.getElementById("med-dose");
            const name = nameEl?.value.trim();
            const dose = doseEl?.value.trim();
            if (!name) {
                showToast("Please enter medication name", "error");
                return;
            }
            details.push(name);
            if (dose) details.push(dose);

            // Pre-save stock existence & quantity validation
            try {
                const supplies = await apiRequest(`${API_BASE}/supplies?pet_id=${currentPet.id}`);
                const cleanMed = name.toLowerCase().trim();
                let matchedSupply = supplies?.find(s => 
                    (s.item_type || "").toLowerCase().trim() === "medication" &&
                    (s.item_name || "").toLowerCase().trim() === cleanMed
                );
                if (!matchedSupply) {
                    matchedSupply = supplies?.find(s => (s.item_name || "").toLowerCase().trim() === cleanMed);
                }

                // 1. Check item existence
                if (!matchedSupply) {
                    showToast("Medication not found in Supplies Stock.", "error");
                    return;
                }

                // 2. Check available quantity
                const parsed = parseSupplyQuantity(dose);
                const reqValue = parsed.value > 0 ? parsed.value : 1;
                const converted = convertSupplyUnits(reqValue, parsed.unit, matchedSupply.unit || "");
                if (converted > matchedSupply.current_stock) {
                    showToast("Insufficient stock. Please restock before logging.", "error");
                    return;
                }
            } catch (checkErr) {
                console.error("Supplies stock validation failed:", checkErr);
            }
        } else if (type === "Grooming") {
            const g = document.getElementById("groom-activity-type")?.value.trim();
            if (g) details.push(g);
        } else if (type === "Water") {
            const w = document.getElementById("water-details")?.value.trim();
            if (w) details.push(w);
        } else if (type === "Exercise") {
            const ex = document.getElementById("exercise-details")?.value.trim();
            if (ex) details.push(ex);
        } else {
            const gen = document.getElementById("general-details")?.value.trim();
            if (gen) details.push(gen);
        }

        let fullNotes = details.join(" • ");
        if (baseNotes) {
            fullNotes = fullNotes ? `${fullNotes} - ${baseNotes}` : baseNotes;
        }

        const timestampIso = timeVal ? new Date(timeVal).toISOString() : new Date().toISOString();

        try {
            await apiRequest(`${API_BASE}/activities`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pet_id: currentPet.id,
                    activity_type: type,
                    notes: fullNotes || `Logged ${type.toLowerCase()}`,
                    timestamp: timestampIso
                })
            });

            closeLogModal();
            showToast(`Logged ${type} successfully!`);
            await loadDashboardCareLogs();
            await loadSuppliesData();
            await updateRelativeTimers();
        } catch (err) {
            console.error("Failed to log activity:", err);
            showToast(err.message || "Failed to log activity", "error");
        }
    });

    // Delete Log Entry function
    const activeDeletingLogs = new Set();
    async function deleteLogEntry(logId) {
        if (!currentPet || !logId) return;
        if (activeDeletingLogs.has(logId)) return;

        let isConfirmed = false;
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Delete this log entry?',
                text: 'This care record will be removed and any deducted stock will be restored.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#DC2626',
                cancelButtonColor: '#4A2B1A',
                confirmButtonText: 'Delete & Restore',
                cancelButtonText: 'Cancel',
                background: '#FFF3E4',
                color: '#4A2B1A'
            });
            isConfirmed = result.isConfirmed;
        } else {
            isConfirmed = confirm("Delete this log entry?\nThis care record will be removed and any deducted stock will be restored.");
        }

        if (!isConfirmed) return;

        activeDeletingLogs.add(logId);
        try {
            console.log("[UNDO FEEDING] API request: DELETE /api/activities/" + logId);
            const res = await apiRequest(`/api/activities/${logId}`, {
                method: "DELETE"
            });
            console.log("[UNDO FEEDING] API response status: 200 (success)");
            console.log("[UNDO FEEDING] API response body:", JSON.stringify(res));
            
            if (res && res.restored_supply) {
                console.log("[UNDO FEEDING] Stock returned from backend:", res.restored_supply.current_stock, res.restored_supply.unit);
                showToast(`Care log removed & ${res.restored_supply.restored_quantity} ${res.restored_supply.unit || ''} stock restored!`);
            } else {
                console.log("[UNDO FEEDING] No restored_supply in response — stock was not changed by backend.");
                showToast("Care log entry removed.");
            }

            await loadDashboardCareLogs();
            await loadSuppliesData();
            console.log("[UNDO FEEDING] Frontend UI refreshed (loadSuppliesData called).");
            await updateRelativeTimers();
        } catch (err) {
            console.error("[UNDO FEEDING] FAILED:", err);
            showToast(err.message || "Failed to delete log entry", "error");
        } finally {
            activeDeletingLogs.delete(logId);
        }
    }
    window.deleteLogEntry = deleteLogEntry;

    // Load dashboard metrics and activity lists
    async function loadDashboardData() {
        if (!currentPet) return;

        // 1. Fetch Care Logs for THIS SPECIFIC PET
        await loadDashboardCareLogs();

        // 2. Fetch supplies stock data
        await loadSuppliesData();

        // 3. Fetch product suggestions
        await loadProductSuggestions();

        // 4. Update relative timers
        await updateRelativeTimers();
    }

    // Update relative timers for quick actions (filtered by current pet)
    async function updateRelativeTimers() {
        if (!currentPet) return;

        const types = ["Feeding", "Walking", "Medication"];
        const timerElements = {
            "Feeding": timerFeeding,
            "Walking": timerWalking,
            "Medication": timerMedication
        };

        for (const type of types) {
            try {
                const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('petziToken');
                const response = await fetch(`${API_BASE}/activities/latest/${type}?pet_id=${currentPet.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (response.status === 200) {
                    const latestActivity = await response.json();
                    if (timerElements[type]) {
                        timerElements[type].innerText = `Last ${type}: ${formatRelativeTime(latestActivity.timestamp)}`;
                    }
                } else if (response.status === 404) {
                    if (timerElements[type]) timerElements[type].innerText = `Last ${type}: Never`;
                } else {
                    if (timerElements[type]) timerElements[type].innerText = `Last ${type}: Error`;
                }
            } catch (err) {
                console.error(`Error loading timer for ${type}:`, err);
                if (timerElements[type]) timerElements[type].innerText = `Last ${type}: Connection Error`;
            }
        }
    }

    // ----------------------------------------------------
    // 4b. SUPPLIES STOCK RENDERER
    // ----------------------------------------------------
    async function loadSuppliesData() {
        if (!currentPet) return;
        try {
            const supplies = await apiRequest(`${API_BASE}/supplies?pet_id=${currentPet.id}`);
            suppliesList = Array.isArray(supplies) ? supplies : [];
            renderSupplies(suppliesList);
            updateWellnessScore();
        } catch (err) {
            console.error("Could not fetch supplies:", err);
        }
    }

    // ----------------------------------------------------
    // 4c. DYNAMIC PET WELLNESS SCORE ENGINE
    // ----------------------------------------------------
    function calculatePetWellnessScore(pet, activities, supplies, medications, vaccinations, grooming, vetVisits) {
        if (!pet) return { score: 0, statusText: "No Pet Selected", statusColor: "#6B3825", tips: [], primaryTip: "Select a pet profile." };

        const acts = Array.isArray(activities) ? activities : [];
        const sups = Array.isArray(supplies) ? supplies : (suppliesList || []);
        const meds = Array.isArray(medications) ? medications : (medicationsList || []);
        const vacs = Array.isArray(vaccinations) ? vaccinations : (vaccinationsList || []);
        const grooms = Array.isArray(grooming) ? grooming : (groomingListState || []);
        const visits = Array.isArray(vetVisits) ? vetVisits : (vetVisitsListState || []);

        let score = 0;
        let tips = [];
        const petName = pet.name || "Your pet";

        // Helper to match activity types safely
        const matchesType = (act, keywords) => {
            const t = (act.activity_type || "").toLowerCase().trim();
            return keywords.some(k => t === k || t.includes(k));
        };

        // 1. Feeding & Nutrition (Max 30 pts)
        const feedingsToday = acts.filter(a => matchesType(a, ["feeding", "feed", "food", "meal", "breakfast", "dinner", "lunch"])).length;
        const waterToday = acts.filter(a => matchesType(a, ["water", "hydration", "drink"])).length;

        if (feedingsToday >= 2) {
            score += 30;
        } else if (feedingsToday === 1) {
            score += 18;
            if (waterToday > 0) score += 5; // bonus for water
            tips.push(`Log one more meal for ${petName} today to reach full nutrition.`);
        } else {
            if (waterToday > 0) score += 5;
            tips.push(`${petName} hasn't had meals logged today yet.`);
        }

        // 2. Physical Activity & Exercise (Max 25 pts)
        const walksToday = acts.filter(a => matchesType(a, ["walking", "walk", "exercise", "play", "run", "training"])).length;
        if (walksToday >= 1) {
            score += 25;
        } else {
            tips.push(`A short walk or play session will keep ${petName} active!`);
        }

        // 3. Medication & Health Status (Max 25 pts)
        const medsToday = acts.filter(a => matchesType(a, ["medication", "medicine", "pill", "dose", "antibiotic", "supplement", "vitamin"])).length;
        const healthActsToday = acts.filter(a => matchesType(a, ["health", "vet", "checkup", "dental"])).length;

        // Check if pet has active medication schedules
        const hasScheduledMeds = meds.length > 0;
        if (hasScheduledMeds) {
            if (medsToday >= 1) {
                score += 25;
            } else {
                score += 10;
                tips.push(`Don't forget to administer ${petName}'s scheduled medication.`);
            }
        } else {
            // No scheduled medications: baseline health compliance
            let healthScore = 20;
            if (healthActsToday > 0 || medsToday > 0 || visits.length > 0) {
                healthScore = 25;
            }
            score += healthScore;
        }

        // Check for overdue vaccinations penalty
        const hasOverdueVac = vacs.some(v => {
            if (!v.next_due_date) return false;
            const due = new Date(v.next_due_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return due < today;
        });
        if (hasOverdueVac) {
            score = Math.max(0, score - 10);
            tips.push(`${petName} has a vaccination that is overdue!`);
        }

        // 4. Grooming & Hygiene (Max 10 pts)
        const groomingToday = acts.filter(a => matchesType(a, ["grooming", "bath", "nail trim", "teeth brushing", "brushing", "ear cleaning", "haircut"])).length;
        const hasRecentGrooming = grooms.length > 0;
        const hasOverdueGrooming = grooms.some(g => {
            if (!g.next_due_date) return false;
            const due = new Date(g.next_due_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return due < today;
        });

        if (groomingToday > 0) {
            score += 10;
        } else if (hasOverdueGrooming) {
            tips.push(`A grooming session for ${petName} is due.`);
        } else if (hasRecentGrooming) {
            score += 8;
        } else {
            score += 7; // general hygiene baseline
        }

        // 5. Supplies Stock Readiness (Max 10 pts)
        let lowStockCount = 0;
        if (sups && sups.length > 0) {
            sups.forEach(s => {
                const thresh = s.low_stock_threshold_days !== undefined ? s.low_stock_threshold_days : 2;
                if (s.current_stock === 0 || s.days_remaining <= thresh) {
                    lowStockCount++;
                }
            });
        }

        if (lowStockCount === 0) {
            score += 10;
        } else if (lowStockCount === 1) {
            score += 5;
            tips.push("One essential supply item is running low on stock.");
        } else {
            tips.push("Multiple supplies are low or out of stock!");
        }

        // Bound score strictly between 0 and 100
        score = Math.min(100, Math.max(0, Math.round(score)));

        let statusText = "Needs Attention ⚠️";
        let statusColor = "#991B1B";
        if (score >= 90) {
            statusText = "Excellent Care! 🌟";
            statusColor = "#2E7D32";
        } else if (score >= 60) {
            statusText = "Good Job! 👍";
            statusColor = "var(--petzi-brown)";
        }

        const primaryTip = tips.length > 0 ? tips[0] : `${petName} is healthy, active, and well-cared for!`;

        return {
            score,
            statusText,
            statusColor,
            tips,
            primaryTip
        };
    }

    function updateWellnessScore(activities, supplies, medications, vaccinations, grooming, vetVisits) {
        if (!currentPet) return;

        const targetActs = activities !== undefined ? activities : activitiesToday;
        const targetSups = supplies !== undefined ? supplies : suppliesList;
        const targetMeds = medications !== undefined ? medications : medicationsList;
        const targetVacs = vaccinations !== undefined ? vaccinations : vaccinationsList;
        const targetGrooms = grooming !== undefined ? grooming : groomingListState;
        const targetVisits = vetVisits !== undefined ? vetVisits : vetVisitsListState;

        const result = calculatePetWellnessScore(
            currentPet,
            targetActs,
            targetSups,
            targetMeds,
            targetVacs,
            targetGrooms,
            targetVisits
        );

        // Render to UI
        const textEl = document.getElementById("wellness-score-text");
        const fillEl = document.getElementById("wellness-gauge-fill");
        const statusEl = document.getElementById("wellness-status");
        const tipEl = document.getElementById("wellness-tip");

        if (textEl) {
            textEl.innerText = `${result.score}%`;
        }

        if (fillEl) {
            // Stroke dasharray of the circle is 2 * PI * r = 2 * 3.14159 * 50 = 314.16
            const offset = 314.16 - (314.16 * result.score / 100);
            fillEl.style.strokeDashoffset = offset;
        }

        if (statusEl) {
            statusEl.innerText = result.statusText;
            statusEl.style.color = result.statusColor;
        }

        if (tipEl) {
            tipEl.innerText = result.primaryTip;
        }

        return result;
    }

    function renderSupplies(supplies) {
        if (!suppliesContainer) return;

        // Remove old dynamic items
        const items = suppliesContainer.querySelectorAll(".supply-item");
        items.forEach(item => item.remove());

        if (!supplies || supplies.length === 0) {
            if (suppliesEmpty) suppliesEmpty.classList.remove("hidden");
            return;
        }

        if (suppliesEmpty) suppliesEmpty.classList.add("hidden");

        supplies.forEach(supply => {
            const supplyItem = document.createElement("div");
            supplyItem.className = "supply-item";
            supplyItem.dataset.id = supply.id;

            const icon = supply.item_type === "Food" ? "restaurant" : "medication";

            // Calculate stock status dynamically
            const threshold = supply.low_stock_threshold_days || 2;
            const days = supply.days_remaining;
            
            let statusLabel = "Normal";
            let statusClass = "normal-stock";
            let progressColorClass = "normal-stock-bar";
            let isLow = false;

            if (supply.current_stock === 0 || days === 0) {
                statusLabel = "Out of Stock";
                statusClass = "out-of-stock";
                progressColorClass = "out-of-stock-bar";
                isLow = true;
            } else if (days <= threshold * 0.5) {
                statusLabel = "Nearly Empty";
                statusClass = "nearly-empty";
                progressColorClass = "nearly-empty-bar";
                isLow = true;
            } else if (days <= threshold) {
                statusLabel = "Low Stock";
                statusClass = "low-stock";
                progressColorClass = "low-stock-bar";
                isLow = true;
            }

            const pct = supply.current_stock === 0 ? 0 : Math.min(100, Math.max(5, days <= threshold
                ? (days / threshold) * 50
                : 50 + ((days - threshold) / (threshold * 3)) * 50
            ));

            const daysLeftClass = isLow ? "low-stock" : "";

            // Trigger alert if low and not already alerted for this specific stock Level
            const alertKey = `${currentPet.id}_${supply.id}_${supply.current_stock}`;
            if (isLow && !triggeredLowStockAlerts[alertKey]) {
                triggeredLowStockAlerts[alertKey] = true;
                if (statusLabel === "Out of Stock") {
                    showToast(`Out of Stock Alert: ${supply.item_name} is empty!`, "error");
                } else {
                    showToast(`${statusLabel} Alert: ${supply.item_name} has only ${days} days left!`, "error");
                }
            }

            const daysLeftText = (supply.current_stock === 0 || days === 0)
                ? '0 days left'
                : (days === 1 ? '1 day left' : (days < 1 ? '< 1 day left' : `${Math.round(days * 10) / 10} days left`));

            const daysLeftContent = isLow
                ? `<span class="material-icons" style="font-size:0.9rem;">warning</span> ${daysLeftText}`
                : `${daysLeftText}`;

            const usageLabel = supply.daily_usage
                ? `~${supply.daily_usage} ${supply.unit || ''}/day`
                : (supply.usage_per_log ? `${supply.usage_per_log} / log` : `~1 ${supply.unit || ''}/day`);

            const supplyMap = {
                "Food": "Premium Pet Food Kibble",
                "Medicine": "Pet Wellness Health Supplements",
                "Toys": "Interactive Toy Range",
                "Accessories": "Comfort Collars & Leashes",
                "Other": "General Pet Accessories"
            };
            const categoryName = supplyMap[supply.item_type] || supplyMap["Other"];
            const speciesVal = currentPet.species || "pet";
            const searchQuery = `${speciesVal} ${categoryName}`;
            const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(searchQuery)}`;
            const flipkartUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(searchQuery)}`;

            const reorderBanner = isLow
                ? `
                <div class="reorder-banner" style="margin-top: 10px; padding: 8px 12px; background: #FFFBEB; border: 1px solid #F59E0B; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #B45309;">
                    <span style="display: flex; align-items: center; gap: 4px; font-weight: 600;">
                        <span class="material-icons" style="font-size: 0.95rem; color: #D97706;">warning</span> Reorder soon
                    </span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <a href="${amazonUrl}" target="_blank" style="color: #B45309; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 2px;">
                            Amazon
                        </a>
                        <span>|</span>
                        <a href="${flipkartUrl}" target="_blank" style="color: #B45309; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 2px;">
                            Flipkart
                        </a>
                    </div>
                </div>
                `
                : "";

            supplyItem.innerHTML = `
                <div class="supply-info" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="supply-name" style="display:inline-flex; align-items:center;">
                        <span class="material-icons" style="font-size: 1.1rem; color: var(--petzi-brown); margin-right:4px;">${icon}</span>
                        ${supply.item_name}
                        <span class="supply-status-badge ${statusClass}">${statusLabel}</span>
                    </span>
                    <span class="supply-days-left ${daysLeftClass}">${daysLeftContent}</span>
                </div>
                <div class="supply-progress-bg">
                    <div class="supply-progress-fill ${progressColorClass}" style="width: ${pct}%;"></div>
                </div>
                <div class="supply-meta">
                    <span>Stock: <strong>${supply.current_stock}</strong> ${supply.unit || ''} (${usageLabel})</span>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-supply-action btn-restock-item" data-id="${supply.id}" data-name="${supply.item_name}">
                            <span class="material-icons" style="font-size:0.8rem;">add</span> Restock
                        </button>
                        <button class="btn-supply-action delete btn-delete-item" data-id="${supply.id}">
                            <span class="material-icons" style="font-size:0.8rem;">delete</span> Delete
                        </button>
                    </div>
                </div>
                ${reorderBanner}
            `;
            suppliesContainer.appendChild(supplyItem);
        });

        // Add event listeners for restock and delete buttons
        suppliesContainer.querySelectorAll(".btn-restock-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const name = btn.getAttribute("data-name");
                openRestockModal(id, name);
            });
        });

        suppliesContainer.querySelectorAll(".btn-delete-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                deleteSupplyItem(id);
            });
        });
    }

    async function loadProductSuggestions() {
        const titleEl = document.getElementById("suggested-products-title");
        const listEl = document.getElementById("suggested-products-list");
        if (!listEl) return;

        if (!currentPet) {
            listEl.innerHTML = `<p style="color: var(--color-text-secondary); font-size: 0.88rem; text-align: center; margin: 10px 0;">Select a pet to see recommendations.</p>`;
            return;
        }

        if (titleEl) {
            titleEl.innerText = `Suggested for ${currentPet.name}`;
        }

        try {
            const data = await apiRequest(`${API_BASE}/products/suggestions?pet_id=${currentPet.id}`);
            listEl.innerHTML = "";

            if (!data.suggestions || data.suggestions.length === 0) {
                listEl.innerHTML = `<p style="color: var(--color-text-secondary); font-size: 0.88rem; text-align: center; margin: 10px 0;">No suggestions available for this pet.</p>`;
                return;
            }

            data.suggestions.forEach(item => {
                const itemDiv = document.createElement("div");
                itemDiv.className = "suggested-product-item";
                itemDiv.style.cssText = "display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px;";
                
                itemDiv.innerHTML = `
                    <div style="font-weight: 700; color: var(--petzi-dark-brown); font-size: 0.95rem;">${escapeHtml(item.category)}</div>
                    <div style="font-size: 0.82rem; color: var(--color-text-secondary); line-height: 1.3;">${escapeHtml(item.notes)}</div>
                    <div style="display: flex; gap: 8px; margin-top: 4px;">
                        <a href="${item.amazonUrl}" target="_blank" class="btn btn-secondary" style="flex: 1; padding: 6px 10px; font-size: 0.78rem; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; background: #FF9900; border-color: #FF9900; color: #000000; font-weight: 700;">
                            <span class="material-icons" style="font-size: 0.95rem;">search</span> Amazon
                        </a>
                        <a href="${item.flipkartUrl}" target="_blank" class="btn btn-secondary" style="flex: 1; padding: 6px 10px; font-size: 0.78rem; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; background: #2874F0; border-color: #2874F0; color: #FFFFFF; font-weight: 700;">
                            <span class="material-icons" style="font-size: 0.95rem;">search</span> Flipkart
                        </a>
                    </div>
                `;
                listEl.appendChild(itemDiv);
            });
        } catch (err) {
            console.error("Failed to load product suggestions:", err);
            listEl.innerHTML = `<p style="color: #6B3825; font-size: 0.88rem; text-align: center; margin: 10px 0;">Error loading suggestions.</p>`;
        }
    }

    // ----------------------------------------------------
    // 5. TIMELINE RENDERER
    // ----------------------------------------------------

    function renderTimeline(activities) {
        timelineContainer.innerHTML = "";

        if (!activities || activities.length === 0) {
            timelineEmpty.classList.remove("hidden");
            timelineContainer.classList.add("hidden");
            return;
        }

        timelineEmpty.classList.add("hidden");
        timelineContainer.classList.remove("hidden");

        // Sort chronologically (earliest first) for daily progression flow
        const sortedActivities = [...activities].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        sortedActivities.forEach(act => {
            const item = document.createElement("div");
            item.className = "timeline-item";

            // Dot color matching activity type
            let typeClass = "neutral-dot";
            let timeColorClass = "";
            let icon = "info";

            if (act.activity_type === "Feeding") {
                typeClass = "feeding-dot";
                timeColorClass = "feeding-time";
                icon = "restaurant";
            } else if (act.activity_type === "Walking") {
                typeClass = "walking-dot";
                timeColorClass = "walking-time";
                icon = "directions_walk";
            } else if (act.activity_type === "Medication") {
                typeClass = "medication-dot";
                timeColorClass = "medication-time";
                icon = "medication";
            }

            item.innerHTML = `
                <div class="timeline-dot ${typeClass}"></div>
                <div class="timeline-content-card">
                    <div class="timeline-meta">
                        <span class="timeline-time ${timeColorClass}">${formatTime(act.timestamp)}</span>
                    </div>
                    <div class="timeline-title">
                        <span class="material-icons" style="font-size:1.1rem; vertical-align:middle;">${icon}</span>
                        ${act.activity_type}
                    </div>
                    ${act.notes ? `<div class="timeline-notes">${act.notes}</div>` : ""}
                </div>
            `;
            timelineContainer.appendChild(item);
        });
    }

    // ----------------------------------------------------
    // 6. MEDICATIONS MANAGEMENT CONTROLLER
    // ----------------------------------------------------

    // Fetch and display medication list in medications panel (for this pet)
    async function loadMedications() {
        if (!currentPet) return;
        try {
            const data = await apiRequest(`${API_BASE}/medications?pet_id=${currentPet.id}`);
            medicationsList = Array.isArray(data) ? data : [];
            renderMedications(medicationsList);
            updateWellnessScore();

            // Populate Medication Scheduler dropdown
            apiRequest(`${API_BASE}/supplies?pet_id=${currentPet.id}`).then(supplies => {
                const dropdown = document.getElementById('med-name');
                if (dropdown && supplies) {
                    const medItems = supplies.filter(s => (s.item_type || '').toLowerCase() === 'medication');
                    if (medItems.length > 0) {
                        dropdown.innerHTML = '<option value="" disabled selected>Select medication...</option>' + medItems.map(s => `<option value="${escapeHtml(s.item_name)}">${escapeHtml(s.item_name)} — ${s.current_stock} ${escapeHtml(s.unit || '')} available</option>`).join('');
                    } else {
                        dropdown.innerHTML = '<option value="" disabled selected>No items available</option>';
                    }
                }
            }).catch(() => {});
        } catch (err) {
            console.error("Could not load medications:", err);
        }
    }

    function renderMedications(meds) {
        medicationsContainer.innerHTML = "";

        if (!meds || meds.length === 0) {
            medicationsEmpty.classList.remove("hidden");
            medicationsContainer.classList.add("hidden");
            return;
        }

        medicationsEmpty.classList.add("hidden");
        medicationsContainer.classList.remove("hidden");

        meds.forEach(med => {
            const card = document.createElement("div");
            card.className = "med-card";

            const startStr = med.start_date ? formatNiceDate(med.start_date) : "N/A";
            const endStr = med.end_date ? formatNiceDate(med.end_date) : "N/A";
            const timeStr12Hr = formatTimeInputTo12Hour(med.reminder_time);

            card.innerHTML = `
                <div class="med-card-header">
                    <div>
                        <div class="med-name">${med.medication_name}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">ID: #${med.id}</div>
                    </div>
                    <div class="med-actions">
                        <button class="med-btn-edit" data-id="${med.id}" title="Edit Schedule">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="med-btn-delete" data-id="${med.id}" title="Delete Schedule">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
                <div class="med-info-row">
                    <div>
                        <span class="med-info-label">Dosage:</span>
                        <span class="med-info-val">${med.dosage}</span>
                    </div>
                    <div>
                        <span class="med-info-label">Time:</span>
                        <span class="med-info-val" style="color:var(--color-medication);">${timeStr12Hr}</span>
                    </div>
                    <div>
                        <span class="med-info-label">Frequency:</span>
                        <span class="med-info-val">${med.frequency || "Once a day"}</span>
                    </div>
                    <div>
                        <span class="med-info-label">Start Date:</span>
                        <span class="med-info-val">${startStr}</span>
                    </div>
                    <div style="grid-column: span 2;">
                        <span class="med-info-label">End Date:</span>
                        <span class="med-info-val">${endStr}</span>
                    </div>
                </div>
                <div style="margin-top: 8px;">
                    <span style="font-size: 0.78rem; padding: 3px 10px; border-radius: 12px; background: #FFF3E4; color: #8C4A00; border: 1.5px solid #D7A46D; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                        ${med.sound_type === 'CUSTOM' ? '🔊 Custom Sound' : '🔊 Default Sound'}
                    </span>
                </div>
                ${med.notes ? `<div class="med-notes-text" style="margin-top:8px;"><strong>Instructions:</strong> ${med.notes}</div>` : ""}
            `;

            // Wire up event listeners
            card.querySelector(".med-btn-edit").addEventListener("click", () => editMedication(med));
            card.querySelector(".med-btn-delete").addEventListener("click", () => deleteMedication(med.id));

            medicationsContainer.appendChild(card);
        });
    }

    // Submit new or updated Medication form
    medicationForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentPet) {
            showToast("No active pet profile to schedule medication for.", "error");
            return;
        }

        const submitBtn = document.getElementById("btn-med-submit");
        const originalHtml = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="material-icons spinner" style="font-size:1rem; animation: rotation 1s infinite linear; display:inline-block; vertical-align:middle; margin-right:4px;">Saving...</span>`;
        }

        const medId = document.getElementById("med-id").value;
        const name = document.getElementById("med-name").value.trim();
        const dosage = document.getElementById("med-dosage").value.trim();
        const frequency = document.getElementById("med-frequency").value.trim();
        const startDate = document.getElementById("med-start-date").value;
        const endDate = document.getElementById("med-end-date").value;
        const reminderTimeRaw = document.getElementById("med-time").value; // Returns HH:MM (24 hr)
        const notes = document.getElementById("med-notes").value.trim();
        const soundType = medSoundType ? medSoundType.value : "DEFAULT";

        const todayStr = getLocalDateString(new Date());
        if (startDate && startDate < todayStr) {
            showToast("Start Date cannot be in the past.", "error");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
            return;
        }

        if (endDate && endDate < todayStr) {
            showToast("End Date cannot be in the past.", "error");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
            return;
        }

        // End date cannot be before start date validation
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end < start) {
                showToast("End Date cannot be before Start Date", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
                return;
            }
        }

        // Validate custom sound selection
        if (soundType === "CUSTOM") {
            const hasNewFile = medCustomSoundFile && medCustomSoundFile.files && medCustomSoundFile.files[0];
            if (!hasNewFile && !editingCustomSoundUrl) {
                showToast("Please select an audio file for the custom reminder sound.", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
                return;
            }
        }

        // Standardize reminder time format in DB as HH:MM
        const reminderTime = convertTo24Hour(reminderTimeRaw);

        const formData = new FormData();
        formData.append("pet_id", currentPet.id);
        formData.append("medication_name", name);
        formData.append("dosage", dosage);
        formData.append("frequency", frequency || "");
        if (startDate) formData.append("start_date", startDate);
        if (endDate) formData.append("end_date", endDate);
        formData.append("reminder_time", reminderTime);
        if (notes) formData.append("notes", notes);
        formData.append("sound_type", soundType);

        if (soundType === "CUSTOM") {
            if (medCustomSoundFile && medCustomSoundFile.files && medCustomSoundFile.files[0]) {
                formData.append("audio_file", medCustomSoundFile.files[0]);
            } else if (editingCustomSoundUrl) {
                formData.append("custom_sound", editingCustomSoundUrl);
            }
        }

        stopCustomSoundPreview();

        try {
            const token = window.Auth ? window.Auth.getToken() : localStorage.getItem("petziToken");
            const url = medId ? `${API_BASE}/medications/${medId}` : `${API_BASE}/medications`;
            const method = medId ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to save medication schedule");
            }

            if (medId) {
                clearMedicationReminderState(medId);
            }

            showToast(medId ? "Medication schedule updated!" : "New medication schedule added!");
            resetMedicationForm();
            await loadMedications();
            checkMedicationReminders();
        } catch (err) {
            console.error("Failed to save medication:", err);
            showToast(err.message || "Failed to save medication", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }
    });

    // Populate form to edit medication
    function editMedication(med) {
        document.getElementById("med-id").value = med.id;

        // For the med-name select dropdown, ensure the edited medication name is present as an option
        const medNameEl = document.getElementById("med-name");
        if (medNameEl && medNameEl.tagName === "SELECT") {
            // Check if the medication name already exists in options
            const existingOption = Array.from(medNameEl.options).find(o => o.value === med.medication_name);
            if (!existingOption) {
                // Add it as the first selectable option (e.g. the medication may not be in stock anymore)
                const opt = document.createElement("option");
                opt.value = med.medication_name;
                opt.textContent = med.medication_name + " (current)";
                medNameEl.insertBefore(opt, medNameEl.firstChild);
            }
            medNameEl.value = med.medication_name;
        } else if (medNameEl) {
            medNameEl.value = med.medication_name;
        }

        document.getElementById("med-dosage").value = med.dosage;
        document.getElementById("med-frequency").value = med.frequency || "";
        const todayStr = getLocalDateString(new Date());
        const medStartInp = document.getElementById("med-start-date");
        const medEndInp = document.getElementById("med-end-date");
        
        if (medStartInp) {
            medStartInp.min = todayStr;
            medStartInp.value = med.start_date || "";
        }
        if (medEndInp) {
            medEndInp.min = (med.start_date && med.start_date >= todayStr) ? med.start_date : todayStr;
            medEndInp.value = med.end_date || "";
        }

        // Input time element expects HH:MM 24-hr format
        document.getElementById("med-time").value = convertTo24Hour(med.reminder_time);
        document.getElementById("med-notes").value = med.notes || "";

        const soundType = med.sound_type || "DEFAULT";
        if (medSoundType) medSoundType.value = soundType;

        if (soundType === "CUSTOM") {
            if (customSoundContainer) customSoundContainer.classList.remove("hidden");
            editingCustomSoundUrl = med.custom_sound || null;
            if (med.custom_sound) {
                const filename = med.custom_sound.split("/").pop();
                if (customSoundFilename) customSoundFilename.innerText = `✓ Current audio: ${filename}`;
                if (btnPreviewCustomSound) btnPreviewCustomSound.classList.remove("hidden");
            } else {
                if (customSoundFilename) customSoundFilename.innerText = "";
                if (btnPreviewCustomSound) btnPreviewCustomSound.classList.add("hidden");
            }
        } else {
            if (customSoundContainer) customSoundContainer.classList.add("hidden");
            editingCustomSoundUrl = null;
            if (customSoundFilename) customSoundFilename.innerText = "";
            if (btnPreviewCustomSound) btnPreviewCustomSound.classList.add("hidden");
        }

        document.getElementById("med-form-title").innerText = `Edit Schedule: ${med.medication_name}`;
        document.getElementById("btn-med-submit").innerHTML = `<span class="material-icons">save</span> Update Schedule`;
        document.getElementById("btn-med-cancel").classList.remove("hidden");

        medicationForm.scrollIntoView({ behavior: "smooth" });
    }

    // Cancel edit
    document.getElementById("btn-med-cancel").addEventListener("click", resetMedicationForm);

    function resetMedicationForm() {
        document.getElementById("med-id").value = "";
        medicationForm.reset();

        const todayStr = getLocalDateString(new Date());
        const medStartInp = document.getElementById("med-start-date");
        const medEndInp = document.getElementById("med-end-date");
        if (medStartInp) medStartInp.min = todayStr;
        if (medEndInp) medEndInp.min = todayStr;

        document.getElementById("med-form-title").innerText = "Schedule New Medication";
        document.getElementById("btn-med-submit").innerHTML = `<span class="material-icons">add_alarm</span> Add Schedule`;
        document.getElementById("btn-med-cancel").classList.add("hidden");

        if (medSoundType) medSoundType.value = "DEFAULT";
        if (customSoundContainer) customSoundContainer.classList.add("hidden");
        if (medCustomSoundFile) medCustomSoundFile.value = "";
        if (customSoundFilename) customSoundFilename.innerText = "";
        if (btnPreviewCustomSound) btnPreviewCustomSound.classList.add("hidden");
        editingCustomSoundUrl = null;
        stopCustomSoundPreview();

        // Repopulate the med-name dropdown from current pet stock
        if (currentPet) {
            const dropdown = document.getElementById("med-name");
            if (dropdown && dropdown.tagName === "SELECT") {
                apiRequest(`${API_BASE}/supplies?pet_id=${currentPet.id}`).then(supplies => {
                    if (supplies) {
                        const medItems = supplies.filter(s => (s.item_type || '').toLowerCase() === 'medication');
                        if (medItems.length > 0) {
                            dropdown.innerHTML = '<option value="" disabled selected>Select medication...</option>' + medItems.map(s => `<option value="${escapeHtml(s.item_name)}">${escapeHtml(s.item_name)} \u2014 ${s.current_stock} ${escapeHtml(s.unit || '')} available</option>`).join('');
                        } else {
                            dropdown.innerHTML = '<option value="" disabled selected>No items available</option>';
                        }
                    }
                }).catch(() => {});
            }
        }
    }

    // Delete Medication Schedule
    async function deleteMedication(id) {
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'Do you want to delete this medication schedule?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#A56A3E',
                cancelButtonColor: '#8E8E93',
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel',
                background: '#FFF3E4',
                color: '#4A2B1A',
                iconColor: '#A56A3E'
            });
            if (!result.isConfirmed) return;
        }

        try {
            await apiRequest(`${API_BASE}/medications/${id}`, {
                method: "DELETE"
            });
            clearMedicationReminderState(id);
            await loadMedications();
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Successfully Deleted!',
                    text: 'Medication schedule has been deleted.',
                    timer: 1800,
                    showConfirmButton: false,
                    background: '#FFF3E4',
                    color: '#4A2B1A',
                    iconColor: '#A56A3E'
                });
            }
        } catch (err) {
            console.error("Failed to delete medication:", err);
        }
    }

    // ----------------------------------------------------
    // 6. VACCINATION RECORDS & HISTORY
    // ----------------------------------------------------

    async function loadVaccinations() {
        if (!currentPet) return;
        try {
            const list = await apiRequest(`${API_BASE}/vaccinations?pet_id=${currentPet.id}`);
            vaccinationsList = Array.isArray(list) ? list : [];
            renderVaccinations(vaccinationsList);
            updateWellnessScore();
        } catch (err) {
            console.error("Could not load vaccinations:", err);
        }
    }

    function renderVaccinations(records) {
        if (!vaccinesList) return;
        vaccinesList.innerHTML = "";

        if (!records || records.length === 0) {
            if (vaccinesEmpty) vaccinesEmpty.classList.remove("hidden");
            vaccinesList.classList.add("hidden");
            return;
        }

        if (vaccinesEmpty) vaccinesEmpty.classList.add("hidden");
        vaccinesList.classList.remove("hidden");

        records.forEach(rec => {
            const card = document.createElement("div");
            card.className = "med-card vaccine-card";
            card.style.cssText = "display: flex; flex-direction: column; justify-content: space-between; padding: 16px; border: 1.5px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-card); transition: var(--transition); box-shadow: var(--shadow-sm);";

            // Status styling
            let statusBg = "var(--petzi-cream)";
            let statusColor = "var(--petzi-dark-brown)";
            let statusText = rec.status || "Up-to-date";
            if (statusText === "Overdue") {
                statusBg = "#FEE2E2";
                statusColor = "#991B1B";
            } else if (statusText === "Due Soon") {
                statusBg = "#FEF3C7";
                statusColor = "#92400E";
            } else {
                statusBg = "#D1FAE5";
                statusColor = "#065F46";
            }

            const adminStr = rec.date_administered ? formatNiceDate(rec.date_administered) : "Not Set";
            const dueStr = rec.next_due_date ? formatNiceDate(rec.next_due_date) : "Not Set";

            card.innerHTML = `
                <div class="med-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div style="flex: 1; min-width: 0; padding-right: 8px;">
                        <div class="med-name" style="font-weight: 700; font-size: 1.1rem; color: var(--petzi-dark-brown); word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(rec.vaccine_name)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Batch: ${escapeHtml(rec.batch_number || "—")}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <span style="font-size: 0.72rem; font-weight: 700; padding: 4px 8px; border-radius: 100px; background: ${statusBg}; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.3px;">
                            ${statusText}
                        </span>
                        <div class="med-actions" style="display: flex; gap: 4px;">
                            <button class="vaccine-btn-edit btn-icon" data-id="${rec.id}" title="Edit Record" style="padding: 4px; border: none; background: transparent; cursor: pointer; color: var(--petzi-brown);">
                                <span class="material-icons" style="font-size: 1.1rem;">edit</span>
                            </button>
                            <button class="vaccine-btn-delete btn-icon" data-id="${rec.id}" title="Delete Record" style="padding: 4px; border: none; background: transparent; cursor: pointer; color: #6B3825;">
                                <span class="material-icons" style="font-size: 1.1rem;">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem; color: var(--text-secondary); padding: 8px 0; border-top: 1px dashed var(--border-color); border-bottom: 1px dashed var(--border-color); margin-bottom: 10px;">
                    <div>
                        <strong style="display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Administered</strong>
                        <span style="font-weight: 600;">${adminStr}</span>
                    </div>
                    <div>
                        <strong style="display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Next Due</strong>
                        <span style="font-weight: 600; color: ${statusText === 'Overdue' ? '#991B1B' : 'inherit'};">${dueStr}</span>
                    </div>
                    <div style="grid-column: span 2;">
                        <strong style="display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Veterinarian / Clinic</strong>
                        <span style="font-weight: 600;">${escapeHtml(rec.veterinarian || "—")}</span>
                    </div>
                </div>
                ${rec.notes ? `<div style="font-size: 0.8rem; color: var(--text-secondary); background: var(--primary-soft); padding: 6px 10px; border-radius: 6px; border-left: 3px solid var(--petzi-caramel); font-style: italic;">"${escapeHtml(rec.notes)}"</div>` : ""}
            `;

            // Bind events
            card.querySelector(".vaccine-btn-edit").addEventListener("click", () => openEditVaccineModal(rec));
            card.querySelector(".vaccine-btn-delete").addEventListener("click", () => deleteVaccineRecord(rec.id));

            vaccinesList.appendChild(card);
        });
    }

    // Modal open handlers
    if (btnAddVaccine) {
        btnAddVaccine.addEventListener("click", () => {
            if (!currentPet) {
                showToast("No active pet profile selected.", "error");
                return;
            }
            openAddVaccineModal();
        });
    }

    if (btnCloseVaccineModal) {
        btnCloseVaccineModal.addEventListener("click", closeVaccineModal);
    }
    if (btnCancelVaccineModal) {
        btnCancelVaccineModal.addEventListener("click", closeVaccineModal);
    }

    function openAddVaccineModal() {
        if (!vaccineForm || !vaccineModal) return;
        vaccineForm.reset();
        document.getElementById("vaccine-id").value = "";
        document.getElementById("vaccine-modal-title").innerText = "Add Vaccine Record";
        vaccineModal.classList.remove("hidden");
    }

    function openEditVaccineModal(rec) {
        if (!vaccineForm || !vaccineModal) return;
        vaccineForm.reset();
        document.getElementById("vaccine-id").value = rec.id;
        document.getElementById("vaccine-name").value = rec.vaccine_name || "";
        document.getElementById("vaccine-date-administered").value = rec.date_administered || "";
        document.getElementById("vaccine-next-due-date").value = rec.next_due_date || "";
        document.getElementById("vaccine-vet").value = rec.veterinarian || "";
        document.getElementById("vaccine-batch").value = rec.batch_number || "";
        document.getElementById("vaccine-notes").value = rec.notes || "";
        
        document.getElementById("vaccine-modal-title").innerText = "Edit Vaccine Record";
        vaccineModal.classList.remove("hidden");
    }

    function closeVaccineModal() {
        if (vaccineModal) vaccineModal.classList.add("hidden");
    }

    // Handle form submit
    if (vaccineForm) {
        vaccineForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentPet) return;

            const submitBtn = document.getElementById("btn-submit-vaccine");
            const originalHtml = submitBtn ? submitBtn.innerHTML : "";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span class="material-icons spinner" style="font-size:1rem; animation: rotation 1s infinite linear; display:inline-block; vertical-align:middle; margin-right:4px;">Saving...</span>`;
            }

            const vacId = document.getElementById("vaccine-id").value;
            const payload = {
                pet_id: currentPet.id,
                vaccine_name: document.getElementById("vaccine-name").value.trim(),
                date_administered: document.getElementById("vaccine-date-administered").value,
                next_due_date: document.getElementById("vaccine-next-due-date").value,
                veterinarian: document.getElementById("vaccine-vet").value.trim(),
                batch_number: document.getElementById("vaccine-batch").value.trim(),
                notes: document.getElementById("vaccine-notes").value.trim()
            };

            const isEdit = !!vacId;
            const url = isEdit ? `${API_BASE}/vaccinations/${vacId}` : `${API_BASE}/vaccinations`;
            const method = isEdit ? "PUT" : "POST";

            try {
                await apiRequest(url, {
                    method: method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                showToast(isEdit ? "Vaccination record updated." : "Vaccine record added successfully!");
                closeVaccineModal();
                await loadVaccinations();
                await loadDashboardData();
            } catch (err) {
                console.error("Failed to save vaccine record:", err);
                showToast(err.message || "Failed to save vaccine record.", "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
            }
        });
    }

    // Delete handler
    async function deleteVaccineRecord(id) {
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'Do you want to delete this vaccine record?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#A56A3E',
                cancelButtonColor: '#8E8E93',
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel',
                background: '#FFF3E4',
                color: '#4A2B1A',
                iconColor: '#A56A3E'
            });
            if (!result.isConfirmed) return;
        }

        try {
            await apiRequest(`${API_BASE}/vaccinations/${id}`, {
                method: "DELETE"
            });
            showToast("Vaccine record deleted.");
            await loadVaccinations();
            await loadDashboardData();
        } catch (err) {
            console.error("Failed to delete vaccine record:", err);
            showToast(err.message || "Failed to delete record.", "error");
        }
    }

    // ----------------------------------------------------
    // 6.3. GROOMING & HYGIENE TRACKING
    // ----------------------------------------------------

    async function loadGroomingData() {
        if (!currentPet) return;
        try {
            const logs = await apiRequest(`${API_BASE}/grooming?pet_id=${currentPet.id}`);
            groomingListState = Array.isArray(logs) ? logs : [];
            renderGroomingList(groomingListState);
            updateWellnessScore();
        } catch (err) {
            console.error("Could not fetch grooming logs:", err);
        }
    }

    function renderGroomingList(records) {
        if (!groomingList) return;
        groomingList.innerHTML = "";

        if (!records || records.length === 0) {
            groomingEmpty.classList.remove("hidden");
            groomingList.classList.add("hidden");
            return;
        }

        groomingEmpty.classList.add("hidden");
        groomingList.classList.remove("hidden");

        const icons = {
            "Bath": "soap",
            "Nail Trim": "content_cut",
            "Teeth Brushing": "brush",
            "Ear Cleaning": "hearing",
            "Haircut": "style",
            "Brushing / Comb": "brush",
            "Other": "spa"
        };

        records.forEach(rec => {
            const card = document.createElement("div");
            card.className = "card vaccine-card";
            card.style.cssText = "background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;";

            // Determine compliance status if next due date is provided
            let statusBadge = "";
            if (rec.next_due_date) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDate = new Date(rec.next_due_date);
                
                const isOverdue = dueDate < today;
                const statusBg = isOverdue ? "rgba(220, 38, 38, 0.1)" : "rgba(16, 185, 129, 0.1)";
                const statusColor = isOverdue ? "#DC2626" : "#10B981";
                const statusText = isOverdue ? "Overdue" : "Up-to-date";

                statusBadge = `
                    <span style="font-size: 0.72rem; font-weight: 700; padding: 4px 8px; border-radius: 100px; background: ${statusBg}; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.3px;">
                        ${statusText}
                    </span>
                `;
            }

            const icon = icons[rec.grooming_type] || "spa";

            card.innerHTML = `
                <div class="med-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div style="display: flex; gap: 8px; align-items: center; min-width: 0;">
                        <span class="material-icons" style="color: var(--petzi-brown); font-size: 1.5rem;">${icon}</span>
                        <div style="min-width: 0;">
                            <div style="font-weight: 700; font-size: 1.05rem; color: var(--petzi-dark-brown); word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(rec.grooming_type)}</div>
                            <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 2px;">Completed: ${formatNiceDate(rec.date_recorded)}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        ${statusBadge}
                        <div class="med-actions" style="display: flex; gap: 4px;">
                            <button class="grooming-btn-edit btn-icon" data-id="${rec.id}" title="Edit Record" style="padding: 4px; border: none; background: transparent; cursor: pointer; color: var(--petzi-brown);">
                                <span class="material-icons" style="font-size: 1.1rem;">edit</span>
                            </button>
                            <button class="grooming-btn-delete btn-icon" data-id="${rec.id}" title="Delete Record" style="padding: 4px; border: none; background: transparent; cursor: pointer; color: #6B3825;">
                                <span class="material-icons" style="font-size: 1.1rem;">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div style="font-size: 0.86rem; color: var(--color-text-secondary); margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                    ${rec.next_due_date ? `<div style="margin-bottom:4px;"><span style="font-weight:600;">Next Due:</span> ${formatNiceDate(rec.next_due_date)}</div>` : ''}
                    <div style="margin-top: 4px; line-height: 1.35; font-style: italic;">
                        "${escapeHtml(rec.notes || "No notes logged.")}"
                    </div>
                </div>
            `;

            // Attach event listeners
            card.querySelector(".grooming-btn-edit").addEventListener("click", () => openEditGroomingModal(rec));
            card.querySelector(".grooming-btn-delete").addEventListener("click", () => deleteGroomingRecord(rec.id));

            groomingList.appendChild(card);
        });
    }

    // Modal open/close listeners
    if (btnAddGrooming) {
        btnAddGrooming.addEventListener("click", () => {
            if (!currentPet) {
                showToast("No active pet profile selected.", "error");
                return;
            }
            openAddGroomingModal();
        });
    }

    if (btnCloseGroomingModal) btnCloseGroomingModal.addEventListener("click", closeGroomingModal);
    if (btnCancelGroomingModal) btnCancelGroomingModal.addEventListener("click", closeGroomingModal);

    function openAddGroomingModal() {
        if (!groomingForm || !groomingModal) return;
        groomingForm.reset();
        document.getElementById("grooming-log-id").value = "";
        document.getElementById("grooming-input-date").value = getLocalDateString(new Date());
        document.getElementById("grooming-modal-title").innerText = "Log Grooming Activity";
        groomingModal.classList.remove("hidden");
    }

    function openEditGroomingModal(rec) {
        if (!groomingForm || !groomingModal) return;
        groomingForm.reset();
        document.getElementById("grooming-log-id").value = rec.id;
        document.getElementById("grooming-input-type").value = rec.grooming_type || "";
        document.getElementById("grooming-input-date").value = rec.date_recorded || "";
        document.getElementById("grooming-input-due").value = rec.next_due_date || "";
        document.getElementById("grooming-input-notes").value = rec.notes || "";
        
        document.getElementById("grooming-modal-title").innerText = "Edit Grooming Activity";
        groomingModal.classList.remove("hidden");
    }

    function closeGroomingModal() {
        if (groomingModal) groomingModal.classList.add("hidden");
    }

    // Handle form submit
    if (groomingForm) {
        groomingForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentPet) return;

            const submitBtn = document.getElementById("btn-submit-grooming");
            const originalHtml = submitBtn ? submitBtn.innerHTML : "";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span class="material-icons spinner" style="font-size:1rem; animation: rotation 1s infinite linear; display:inline-block; vertical-align:middle; margin-right:4px;">autorenew</span> Saving...`;
            }

            const logId = document.getElementById("grooming-log-id").value;
            const payload = {
                pet_id: currentPet.id,
                grooming_type: document.getElementById("grooming-input-type").value,
                date_recorded: document.getElementById("grooming-input-date").value,
                next_due_date: document.getElementById("grooming-input-due").value,
                notes: document.getElementById("grooming-input-notes").value.trim()
            };

            const isEdit = !!logId;
            const url = isEdit ? `${API_BASE}/grooming/${logId}` : `${API_BASE}/grooming`;
            const method = isEdit ? "PUT" : "POST";

            try {
                await apiRequest(url, {
                    method: method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                showToast(isEdit ? "Grooming record updated." : "Grooming record added successfully!");
                closeGroomingModal();
                await loadGroomingData();
            } catch (err) {
                console.error("Failed to save grooming record:", err);
                showToast(err.message || "Failed to save grooming record.", "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
            }
        });
    }

    // Delete handler
    async function deleteGroomingRecord(id) {
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'Do you want to delete this grooming record?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#A56A3E',
                cancelButtonColor: '#8E8E93',
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel',
                background: '#FFF3E4',
                color: '#4A2B1A',
                iconColor: '#A56A3E'
            });
            if (!result.isConfirmed) return;
        }

        try {
            await apiRequest(`${API_BASE}/grooming/${id}`, {
                method: "DELETE"
            });
            showToast("Grooming record deleted.");
            await loadGroomingData();
        } catch (err) {
            console.error("Failed to delete grooming record:", err);
            showToast(err.message || "Failed to delete record.", "error");
        }
    }

    // ----------------------------------------------------
    // 6.4. VET VISIT REPORTS & PRESCRIPTIONS VAULT
    // ----------------------------------------------------

    let currentSelectedAttachment = null; // Stores existing Base64 attachment when editing

    async function loadVetVisitsData() {
        if (!currentPet) return;
        try {
            const logs = await apiRequest(`${API_BASE}/vet-visits?pet_id=${currentPet.id}`);
            vetVisitsListState = Array.isArray(logs) ? logs : [];
            renderVetVisitsList(vetVisitsListState);
            updateWellnessScore();
        } catch (err) {
            console.error("Could not fetch vet visit logs:", err);
        }
    }

    function renderVetVisitsList(records) {
        if (!vetVisitsList) return;
        vetVisitsList.innerHTML = "";

        if (!records || records.length === 0) {
            vetVisitsEmpty.classList.remove("hidden");
            vetVisitsList.classList.add("hidden");
            return;
        }

        vetVisitsEmpty.classList.add("hidden");
        vetVisitsList.classList.remove("hidden");

        records.forEach(rec => {
            const card = document.createElement("div");
            card.className = "card vaccine-card";
            card.style.cssText = "background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;";

            // Check if attachment exists
            let attachmentBadge = "";
            if (rec.attachment_url) {
                const isPdf = rec.attachment_url.startsWith("data:application/pdf");
                const icon = isPdf ? "picture_as_pdf" : "image";
                const label = isPdf ? "View PDF Report" : "View Scan Image";
                
                attachmentBadge = `
                    <div style="margin-top: 10px;">
                        <button class="btn-view-attachment" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.78rem; font-weight: 700; background: #FFF3E4; border: 1px solid #D7A46D; border-radius: 6px; color: var(--petzi-brown); cursor: pointer;">
                            <span class="material-icons" style="font-size: 1rem;">${icon}</span> ${label}
                        </button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="med-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div style="display: flex; gap: 8px; align-items: center; min-width: 0;">
                        <span class="material-icons" style="color: var(--petzi-brown); font-size: 1.5rem;">medical_services</span>
                        <div style="min-width: 0;">
                            <div style="font-weight: 700; font-size: 1.05rem; color: var(--petzi-dark-brown); word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(rec.diagnosis)}</div>
                            <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 2px;">Date: ${formatNiceDate(rec.visit_date)}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <div class="med-actions" style="display: flex; gap: 4px;">
                            <button class="vet-visit-btn-edit btn-icon" data-id="${rec.id}" title="Edit Visit" style="padding: 4px; border: none; background: transparent; cursor: pointer; color: var(--petzi-brown);">
                                <span class="material-icons" style="font-size: 1.1rem;">edit</span>
                            </button>
                            <button class="vet-visit-btn-delete btn-icon" data-id="${rec.id}" title="Delete Visit" style="padding: 4px; border: none; background: transparent; cursor: pointer; color: #6B3825;">
                                <span class="material-icons" style="font-size: 1.1rem;">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div style="font-size: 0.86rem; color: var(--color-text-secondary); margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                    <div>🏥 <span style="font-weight:600;">Clinic:</span> ${escapeHtml(rec.clinic_name || "General Clinic")}</div>
                    <div>🩺 <span style="font-weight:600;">Doctor:</span> ${escapeHtml(rec.veterinarian)}</div>
                    ${rec.treatment_plan ? `<div style="line-height: 1.35; margin-top: 2px;"><span style="font-weight:600;">📋 Treatment:</span> ${escapeHtml(rec.treatment_plan)}</div>` : ''}
                    ${rec.prescription_notes ? `<div style="line-height: 1.35; margin-top: 2px; padding: 6px; background: var(--bg-main); border-left: 2.5px solid var(--petzi-caramel); font-size: 0.82rem;"><span style="font-weight:700; color:var(--petzi-dark-brown);">💊 Prescriptions:</span> ${escapeHtml(rec.prescription_notes)}</div>` : ''}
                    ${attachmentBadge}
                </div>
            `;

            // Attach event listeners
            card.querySelector(".vet-visit-btn-edit").addEventListener("click", () => openEditVetVisitModal(rec));
            card.querySelector(".vet-visit-btn-delete").addEventListener("click", () => deleteVetVisitRecord(rec.id));
            if (rec.attachment_url) {
                card.querySelector(".btn-view-attachment").addEventListener("click", () => openAttachmentLightbox(rec));
            }

            vetVisitsList.appendChild(card);
        });
    }

    // Modal triggers
    if (btnAddVetVisit) {
        btnAddVetVisit.addEventListener("click", () => {
            if (!currentPet) {
                showToast("No active pet profile selected.", "error");
                return;
            }
            openAddVetVisitModal();
        });
    }

    if (btnCloseVetVisitModal) btnCloseVetVisitModal.addEventListener("click", closeVetVisitModal);
    if (btnCancelVetVisitModal) btnCancelVetVisitModal.addEventListener("click", closeVetVisitModal);

    function openAddVetVisitModal() {
        if (!vetVisitForm || !vetVisitModal) return;
        vetVisitForm.reset();
        document.getElementById("vet-visit-id").value = "";
        document.getElementById("vet-visit-input-date").value = getLocalDateString(new Date());
        document.getElementById("vet-visit-modal-title").innerText = "Log Veterinary Visit";
        currentSelectedAttachment = null;
        vetVisitModal.classList.remove("hidden");
    }

    function openEditVetVisitModal(rec) {
        if (!vetVisitForm || !vetVisitModal) return;
        vetVisitForm.reset();
        document.getElementById("vet-visit-id").value = rec.id;
        document.getElementById("vet-visit-input-date").value = rec.visit_date || "";
        document.getElementById("vet-visit-input-doctor").value = rec.veterinarian || "";
        document.getElementById("vet-visit-input-clinic").value = rec.clinic_name || "";
        document.getElementById("vet-visit-input-diagnosis").value = rec.diagnosis || "";
        document.getElementById("vet-visit-input-treatment").value = rec.treatment_plan || "";
        document.getElementById("vet-visit-input-prescription").value = rec.prescription_notes || "";
        
        currentSelectedAttachment = rec.attachment_url || null;
        document.getElementById("vet-visit-modal-title").innerText = "Edit Veterinary Visit";
        vetVisitModal.classList.remove("hidden");
    }

    function closeVetVisitModal() {
        if (vetVisitModal) vetVisitModal.classList.add("hidden");
    }

    // Lightbox triggers
    function openAttachmentLightbox(rec) {
        if (!vetAttachmentLightbox || !vetLightboxContent || !vetLightboxCaption) return;
        
        vetLightboxContent.innerHTML = "";
        vetLightboxCaption.innerText = `${rec.diagnosis} — ${formatNiceDate(rec.visit_date)}`;
        
        const isPdf = rec.attachment_url.startsWith("data:application/pdf");
        if (isPdf) {
            // Load PDF in iframe
            const iframe = document.createElement("iframe");
            iframe.src = rec.attachment_url;
            iframe.style.cssText = "width: 100%; height: 100%; border: none;";
            vetLightboxContent.appendChild(iframe);
        } else {
            // Load Image
            const img = document.createElement("img");
            img.src = rec.attachment_url;
            img.style.cssText = "max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;";
            vetLightboxContent.appendChild(img);
        }

        vetAttachmentLightbox.classList.remove("hidden");
    }

    if (btnCloseVetLightbox) {
        btnCloseVetLightbox.addEventListener("click", () => {
            vetAttachmentLightbox.classList.add("hidden");
            vetLightboxContent.innerHTML = "";
        });
    }
    if (vetAttachmentLightbox) {
        vetAttachmentLightbox.addEventListener("click", (e) => {
            if (e.target === vetAttachmentLightbox) {
                vetAttachmentLightbox.classList.add("hidden");
                vetLightboxContent.innerHTML = "";
            }
        });
    }

    // Submit form handler
    if (vetVisitForm) {
        vetVisitForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentPet) return;

            const submitBtn = document.getElementById("btn-submit-vet-visit");
            const originalHtml = submitBtn ? submitBtn.innerHTML : "";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span class="material-icons spinner" style="font-size:1rem; animation: rotation 1s infinite linear; display:inline-block; vertical-align:middle; margin-right:4px;">autorenew</span> Saving...`;
            }

            const visitId = document.getElementById("vet-visit-id").value;

            // Handle file attachment Base64 loading
            let base64Attachment = currentSelectedAttachment;
            const fileInput = document.getElementById("vet-visit-input-attachment");
            if (fileInput && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                
                // Limit file sizes to 5MB
                if (file.size > 5 * 1024 * 1024) {
                    showToast("Attached document file size exceeds the 5MB limit.", "error");
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalHtml;
                    }
                    return;
                }

                base64Attachment = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
            }

            const payload = {
                pet_id: currentPet.id,
                visit_date: document.getElementById("vet-visit-input-date").value,
                veterinarian: document.getElementById("vet-visit-input-doctor").value.trim(),
                clinic_name: document.getElementById("vet-visit-input-clinic").value.trim(),
                diagnosis: document.getElementById("vet-visit-input-diagnosis").value.trim(),
                treatment_plan: document.getElementById("vet-visit-input-treatment").value.trim(),
                prescription_notes: document.getElementById("vet-visit-input-prescription").value.trim(),
                attachment_url: base64Attachment
            };

            const isEdit = !!visitId;
            const url = isEdit ? `${API_BASE}/vet-visits/${visitId}` : `${API_BASE}/vet-visits`;
            const method = isEdit ? "PUT" : "POST";

            try {
                await apiRequest(url, {
                    method: method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                showToast(isEdit ? "Vet visit record updated." : "Vet visit logged successfully!");
                closeVetVisitModal();
                await loadVetVisitsData();
            } catch (err) {
                console.error("Failed to save vet visit record:", err);
                showToast(err.message || "Failed to save vet visit record.", "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
            }
        });
    }

    // Delete handler
    async function deleteVetVisitRecord(id) {
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'Do you want to delete this vet visit record?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#A56A3E',
                cancelButtonColor: '#8E8E93',
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel',
                background: '#FFF3E4',
                color: '#4A2B1A',
                iconColor: '#A56A3E'
            });
            if (!result.isConfirmed) return;
        }

        try {
            await apiRequest(`${API_BASE}/vet-visits/${id}`, {
                method: "DELETE"
            });
            showToast("Vet visit record deleted.");
            await loadVetVisitsData();
        } catch (err) {
            console.error("Failed to delete vet visit record:", err);
            showToast(err.message || "Failed to delete record.", "error");
        }
    }

    // ----------------------------------------------------
    // 6.5. PET AUDIO & SOUND SYSTEM
    // ----------------------------------------------------

    // Single Source of Truth for Pet Sounds (Local Verified Audio Files)
    const PET_SOUNDS = {
        dog: "assets/sounds/dog.ogg",
        cat: "assets/sounds/cat.ogg",
        bird: "assets/sounds/bird.ogg",
        hen: "assets/sounds/hen.mp3",
        fish: "assets/sounds/fish.ogg",
        cow: "assets/sounds/cow.ogg",
        goat: "assets/sounds/goat.mp3",
        other: "assets/sounds/other.ogg"
    };

    // Shared AudioContext for synthesizer fallback and autoplay unlock
    let sharedAudioContext = null;
    let isAudioUnlocked = false;
    let activeNotificationAudio = null;
    let activeProceduralOscillators = [];
    let activeSoundTimeouts = [];
    let proceduralLoopInterval = null;
    let currentSoundSessionId = 0; // Incremented on every stop/play to invalidate stale async promise/catch callbacks
    let isReminderSoundActive = false; // Strict boolean tracking active sound state

    function getAudioContext() {
        if (!sharedAudioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                sharedAudioContext = new AudioCtx();
            }
        }
        return sharedAudioContext;
    }

    // Gracefully handle browser autoplay restrictions by unlocking on initial user interaction
    function unlockAudio() {
        if (isAudioUnlocked) return;
        try {
            const ctx = getAudioContext();
            if (ctx && ctx.state === "suspended") {
                ctx.resume();
            }
            isAudioUnlocked = true;
        } catch (e) {
            // Ignore autoplay unlock errors
        }
    }

    ["click", "touchstart", "keydown"].forEach(evt => {
        window.addEventListener(evt, unlockAudio, { once: true, passive: true });
    });

    // Stop and clear all active notification audio immediately (for snooze/given/dismiss/pet change)
    function stopNotificationSound() {
        isReminderSoundActive = false;
        currentSoundSessionId++; // Invalidate any pending audio promise/fallback callbacks

        if (proceduralLoopInterval) {
            clearInterval(proceduralLoopInterval);
            proceduralLoopInterval = null;
        }

        // 1. Pause and release active HTML5 audio
        if (activeNotificationAudio) {
            try {
                activeNotificationAudio.pause();
                activeNotificationAudio.currentTime = 0;
                activeNotificationAudio.removeAttribute("src");
                activeNotificationAudio.load();
            } catch (e) {
                console.warn("[Petzi Audio] Could not stop active notification audio:", e);
            }
            activeNotificationAudio = null;
        }

        // 2. Clear any pending scheduled sound timeouts
        if (activeSoundTimeouts && activeSoundTimeouts.length > 0) {
            activeSoundTimeouts.forEach(t => clearTimeout(t));
            activeSoundTimeouts = [];
        }

        // 3. Stop any active procedural oscillators
        if (activeProceduralOscillators && activeProceduralOscillators.length > 0) {
            activeProceduralOscillators.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) { }
            });
            activeProceduralOscillators = [];
        }
    }

    // Clean up sound on window unload / navigation
    window.addEventListener("pagehide", stopNotificationSound);
    window.addEventListener("beforeunload", stopNotificationSound);

    // Identify pet category (species/type/breed) for sound mapping
    function determinePetSoundCategory(petOrType) {
        if (!petOrType) return "other";
        let combined = "";
        if (typeof petOrType === "string") {
            combined = petOrType.toLowerCase().trim();
        } else if (typeof petOrType === "object") {
            const species = (petOrType.species || petOrType.pet_species || petOrType.type || petOrType.petType || "").toLowerCase().trim();
            const breed = (petOrType.breed || petOrType.pet_breed || "").toLowerCase().trim();
            const name = (petOrType.name || petOrType.pet_name || "").toLowerCase().trim();
            combined = `${species} ${breed} ${name}`;
        } else {
            combined = String(petOrType).toLowerCase().trim();
        }

        if (combined.includes("dog") || combined.includes("pup") || combined.includes("canine") || combined.includes("hound") ||
            combined.includes("labrador") || combined.includes("retriever") || combined.includes("terrier") || combined.includes("bulldog")) {
            return "dog";
        }

        if (combined.includes("cat") || combined.includes("kitten") || combined.includes("kitty") || combined.includes("feline") ||
            combined.includes("tabby") || combined.includes("persian") || combined.includes("siamese")) {
            return "cat";
        }

        if (combined.includes("bird") || combined.includes("parrot") || combined.includes("canary") ||
            combined.includes("cockatiel") || combined.includes("parakeet") || combined.includes("budgie") || combined.includes("finch")) {
            return "bird";
        }

        if (combined.includes("hen") || combined.includes("chicken") || combined.includes("rooster") || combined.includes("chick")) {
            return "hen";
        }

        if (combined.includes("fish") || combined.includes("goldfish") || combined.includes("betta") || combined.includes("tetra") || combined.includes("aqua")) {
            return "fish";
        }

        if (combined.includes("cow") || combined.includes("bovine") || combined.includes("cattle") || combined.includes("bull") || combined.includes("calf")) {
            return "cow";
        }

        if (combined.includes("goat") || combined.includes("caprine") || combined.includes("kid")) {
            return "goat";
        }

        return "other";
    }

    // Centralized Notification Sound Service
    window.PetNotificationSoundService = {
        playPetNotificationSound: function (petTypeOrPet) {
            playPetSound(petTypeOrPet);
        },
        stopNotificationSound: function () {
            stopNotificationSound();
        }
    };
    window.playPetNotificationSound = function (petTypeOrPet) {
        playPetSound(petTypeOrPet);
    };
    window.stopNotificationSound = stopNotificationSound;

    // Procedural Web Audio API synthesizer fallback loop
    function playProceduralPetSoundLoop(category, sessionId) {
        if (!isReminderSoundActive || (sessionId !== undefined && sessionId !== currentSoundSessionId)) return;

        if (proceduralLoopInterval) {
            clearInterval(proceduralLoopInterval);
            proceduralLoopInterval = null;
        }

        const currentSession = sessionId || currentSoundSessionId;

        playProceduralPetSound(category);
        proceduralLoopInterval = setInterval(() => {
            if (!isReminderSoundActive || currentSession !== currentSoundSessionId) {
                if (proceduralLoopInterval) {
                    clearInterval(proceduralLoopInterval);
                    proceduralLoopInterval = null;
                }
                return;
            }
            playProceduralPetSound(category);
        }, 2500);
    }

    // Procedural Web Audio API synthesizer fallback (in case network/CDN is offline)
    function playProceduralPetSound(category) {
        if (!isReminderSoundActive) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            if (ctx.state === "suspended") {
                ctx.resume();
            }
            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.35, now);
            masterGain.connect(ctx.destination);

            if (category === "dog") {
                // Procedural dog bark
                const barks = [0, 0.22];
                barks.forEach(startTime => {
                    const t = now + startTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const filter = ctx.createBiquadFilter();

                    osc.type = "sawtooth";
                    osc.frequency.setValueAtTime(320, t);
                    osc.frequency.exponentialRampToValueAtTime(140, t + 0.16);

                    filter.type = "bandpass";
                    filter.frequency.setValueAtTime(800, t);
                    filter.Q.setValueAtTime(3, t);

                    gain.gain.setValueAtTime(0.001, t);
                    gain.gain.linearRampToValueAtTime(0.4, t + 0.03);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    activeProceduralOscillators.push(osc);
                    osc.start(t);
                    osc.stop(t + 0.19);
                });
            } else if (category === "cat") {
                // Procedural cat meow
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.setValueAtTime(450, now);
                osc.frequency.linearRampToValueAtTime(720, now + 0.25);
                osc.frequency.linearRampToValueAtTime(400, now + 0.55);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

                osc.connect(gain);
                gain.connect(masterGain);

                activeProceduralOscillators.push(osc);
                osc.start(now);
                osc.stop(now + 0.6);
            } else if (category === "bird" || category === "chicken") {
                // Procedural bird chirp
                const chirps = [0, 0.15, 0.3];
                chirps.forEach(startTime => {
                    const t = now + startTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = "sine";
                    osc.frequency.setValueAtTime(1800, t);
                    osc.frequency.linearRampToValueAtTime(2800, t + 0.08);

                    gain.gain.setValueAtTime(0.001, t);
                    gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

                    osc.connect(gain);
                    gain.connect(masterGain);

                    activeProceduralOscillators.push(osc);
                    osc.start(t);
                    osc.stop(t + 0.11);
                });
            } else if (category === "fish") {
                // Procedural fish water bubble pop sound
                const pops = [0, 0.12, 0.28];
                pops.forEach(startTime => {
                    const t = now + startTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = "sine";
                    osc.frequency.setValueAtTime(300 + Math.random() * 80, t);
                    osc.frequency.exponentialRampToValueAtTime(750, t + 0.07);

                    gain.gain.setValueAtTime(0.001, t);
                    gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

                    osc.connect(gain);
                    gain.connect(masterGain);

                    activeProceduralOscillators.push(osc);
                    osc.start(t);
                    osc.stop(t + 0.09);
                });
            } else if (category === "cow") {
                // Procedural cow moo (low resonance synth)
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.6);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

                osc.connect(gain);
                gain.connect(masterGain);
                activeProceduralOscillators.push(osc);
                osc.start(now);
                osc.stop(now + 0.66);
            } else if (category === "goat") {
                // Procedural goat bleat (vibrato synth)
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.linearRampToValueAtTime(330, now + 0.15);
                osc.frequency.linearRampToValueAtTime(290, now + 0.35);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

                osc.connect(gain);
                gain.connect(masterGain);
                activeProceduralOscillators.push(osc);
                osc.start(now);
                osc.stop(now + 0.41);
            } else {
                // Digital watch / alarm clock procedural sound for Other
                const freqs = [1046.50, 1318.51, 1567.98]; // C6, E6, G6
                freqs.forEach((freq, idx) => {
                    const t = now + idx * 0.12;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = "square";
                    osc.frequency.setValueAtTime(freq, t);

                    gain.gain.setValueAtTime(0.001, t);
                    gain.gain.linearRampToValueAtTime(0.2, t + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

                    osc.connect(gain);
                    gain.connect(masterGain);

                    activeProceduralOscillators.push(osc);
                    osc.start(t);
                    osc.stop(t + 0.11);
                });
            }
        } catch (e) {
            console.warn("Procedural sound skipped:", e);
        }
    }

    // Play sound associated with a specific pet (loops continuously until stopped)
    function playPetSound(pet) {
        try {
            stopNotificationSound();
            isReminderSoundActive = true;
            const sessionId = ++currentSoundSessionId;

            const category = determinePetSoundCategory(pet);
            const soundFile = PET_SOUNDS[category] || PET_SOUNDS.other;

            const medId = pet?.medication_id || pet?.medicationId || (typeof activeReminderKey === 'string' ? activeReminderKey.split('_')[1] : 'N/A');
            const petId = pet?.id || pet?.pet_id || 'N/A';
            const petName = pet?.name || pet?.pet_name || 'Pet';
            const rawType = pet?.species || pet?.pet_species || pet?.type || 'other';

            console.log(`[PETZI REMINDER]\nMedication ID: ${medId}\nPet ID: ${petId}\nPet Name: ${petName}\nPet Type: ${rawType}\nNormalized Type: ${category}\nSound File: ${soundFile}\nAudio Source: ${soundFile}`);
            console.log(`[PETZI AUDIO]\nAudio loading...`);

            const audio = new Audio(soundFile);
            activeNotificationAudio = audio;
            audio.volume = 0.85;
            audio.loop = true; // MUST loop continuously while reminder is active!

            audio.oncanplaythrough = () => {
                if (isReminderSoundActive && sessionId === currentSoundSessionId) {
                    console.log(`[PETZI AUDIO]\nAudio loaded`);
                }
            };

            audio.onerror = (err) => {
                console.error(`[PETZI AUDIO ERROR]\nAudio load error for ${soundFile}:`, err);
                if (isReminderSoundActive && sessionId === currentSoundSessionId) {
                    playProceduralPetSoundLoop(category, sessionId);
                }
            };

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    if (isReminderSoundActive && sessionId === currentSoundSessionId) {
                        console.log(`[PETZI AUDIO]\nPlayback started`);
                    }
                }).catch(err => {
                    console.error(`[PETZI AUDIO ERROR]\nPlayback failed (Autoplay restriction):`, err);
                    if (isReminderSoundActive && sessionId === currentSoundSessionId) {
                        playProceduralPetSoundLoop(category, sessionId);
                    }
                });
            }
        } catch (error) {
            console.error("[PETZI AUDIO ERROR] Could not play pet sound:", error);
        }
    }

    // Play custom uploaded medication audio sound
    function playCustomMedicationSound(med) {
        try {
            stopNotificationSound();
            stopCustomSoundPreview();
            isReminderSoundActive = true;
            const sessionId = ++currentSoundSessionId;

            const soundUrl = med.custom_sound.startsWith("/") ? med.custom_sound : `/${med.custom_sound}`;

            console.log(`[PETZI REMINDER]\nMedication ID: ${med.id}\nPet ID: ${med.pet_id}\nPet Name: ${med.pet_name || 'Pet'}\nSound Mode: CUSTOM\nCustom Audio URL: ${soundUrl}`);
            console.log(`[PETZI AUDIO]\nLoading custom audio...`);

            const audio = new Audio(soundUrl);
            activeNotificationAudio = audio;
            audio.volume = 0.85;
            audio.loop = true; // Loops continuously while reminder is active

            audio.oncanplaythrough = () => {
                if (isReminderSoundActive && sessionId === currentSoundSessionId) {
                    console.log(`[PETZI AUDIO]\nCustom audio loaded`);
                }
            };

            audio.onerror = (err) => {
                console.error(`[PETZI AUDIO ERROR]\nCustom audio load error for ${soundUrl}:`, err);
                if (isReminderSoundActive && sessionId === currentSoundSessionId) {
                    const category = determinePetSoundCategory(med.pet_species || med.species);
                    playProceduralPetSoundLoop(category, sessionId);
                }
            };

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    if (isReminderSoundActive && sessionId === currentSoundSessionId) {
                        console.log(`[PETZI AUDIO]\nCustom audio playback started`);
                    }
                }).catch(err => {
                    console.error(`[PETZI AUDIO ERROR]\nCustom audio playback failed (Autoplay restriction):`, err);
                    if (isReminderSoundActive && sessionId === currentSoundSessionId) {
                        const category = determinePetSoundCategory(med.pet_species || med.species);
                        playProceduralPetSoundLoop(category, sessionId);
                    }
                });
            }
        } catch (error) {
            console.error("[PETZI AUDIO ERROR] Could not play custom medication sound:", error);
        }
    }

    // Helper to stop custom sound preview
    function stopCustomSoundPreview() {
        if (customPreviewAudio) {
            try {
                customPreviewAudio.pause();
                customPreviewAudio.currentTime = 0;
            } catch (e) { }
            customPreviewAudio = null;
        }
        isCustomPreviewPlaying = false;
        if (btnPreviewCustomSound) {
            btnPreviewCustomSound.innerHTML = `<span class="material-icons" style="font-size: 1rem; vertical-align: middle;">play_arrow</span> Preview`;
        }
    }

    // Sound Selection UI Event Listeners
    if (medSoundType) {
        medSoundType.addEventListener("change", () => {
            stopCustomSoundPreview();
            if (medSoundType.value === "CUSTOM") {
                if (customSoundContainer) customSoundContainer.classList.remove("hidden");
            } else {
                if (customSoundContainer) customSoundContainer.classList.add("hidden");
                if (medCustomSoundFile) medCustomSoundFile.value = "";
                if (customSoundFilename) customSoundFilename.innerText = "";
                if (btnPreviewCustomSound) btnPreviewCustomSound.classList.add("hidden");
                editingCustomSoundUrl = null;
            }
        });
    }

    if (medCustomSoundFile) {
        medCustomSoundFile.addEventListener("change", () => {
            stopCustomSoundPreview();
            if (medCustomSoundFile.files && medCustomSoundFile.files[0]) {
                const file = medCustomSoundFile.files[0];
                const maxBytes = 10 * 1024 * 1024; // 10 MB limit
                if (file.size > maxBytes) {
                    showToast("Audio file must be smaller than 10 MB.", "error");
                    medCustomSoundFile.value = "";
                    if (customSoundFilename) customSoundFilename.innerText = "";
                    if (btnPreviewCustomSound) btnPreviewCustomSound.classList.add("hidden");
                    return;
                }
                if (customSoundFilename) customSoundFilename.innerText = `✓ Selected: ${file.name}`;
                if (btnPreviewCustomSound) btnPreviewCustomSound.classList.remove("hidden");
            } else if (!editingCustomSoundUrl) {
                if (customSoundFilename) customSoundFilename.innerText = "";
                if (btnPreviewCustomSound) btnPreviewCustomSound.classList.add("hidden");
            }
        });
    }

    if (btnPreviewCustomSound) {
        btnPreviewCustomSound.addEventListener("click", () => {
            if (isCustomPreviewPlaying) {
                stopCustomSoundPreview();
                return;
            }

            stopNotificationSound(); // Stop active reminder sound if playing
            unlockAudio();

            let srcUrl = null;
            if (medCustomSoundFile && medCustomSoundFile.files && medCustomSoundFile.files[0]) {
                srcUrl = URL.createObjectURL(medCustomSoundFile.files[0]);
            } else if (editingCustomSoundUrl) {
                srcUrl = editingCustomSoundUrl.startsWith("/") ? editingCustomSoundUrl : `/${editingCustomSoundUrl}`;
            }

            if (!srcUrl) {
                showToast("No audio file selected to preview", "error");
                return;
            }

            customPreviewAudio = new Audio(srcUrl);
            customPreviewAudio.volume = 0.85;

            customPreviewAudio.onended = () => {
                stopCustomSoundPreview();
            };

            customPreviewAudio.onerror = (err) => {
                console.error("Preview sound error:", err);
                showToast("Could not play audio file preview", "error");
                stopCustomSoundPreview();
            };

            customPreviewAudio.play().then(() => {
                isCustomPreviewPlaying = true;
                btnPreviewCustomSound.innerHTML = `<span class="material-icons" style="font-size: 1rem; vertical-align: middle;">stop</span> Stop`;
            }).catch(err => {
                console.error("Preview play failed:", err);
                showToast("Audio preview failed. Check browser audio settings.", "error");
                stopCustomSoundPreview();
            });
        });
    }



    // ----------------------------------------------------
    // 7. MULTI-PET REMINDER QUEUE & SNOOZE SCHEDULER
    // ----------------------------------------------------

    // Central state tracking per occurrence key: `${petId}_${medicationId}_${dateStr}_${scheduledTime}`
    const reminderOccurrences = {};
    let reminderQueue = []; // Queue of occurrence keys waiting to be displayed
    let activeReminderKey = null; // Key of currently displayed reminder
    const snoozeTimerHandles = {}; // Timers per med ID

    // Cancel or reset active reminders, snooze timers, and in-memory queue for a medication
    function clearMedicationReminderState(medId) {
        if (!medId) return;
        const targetMedId = String(medId);

        // 1. Clear any active snooze timer handle
        if (snoozeTimerHandles[targetMedId]) {
            clearTimeout(snoozeTimerHandles[targetMedId]);
            delete snoozeTimerHandles[targetMedId];
        }
        if (snoozeTimerHandles[Number(targetMedId)]) {
            clearTimeout(snoozeTimerHandles[Number(targetMedId)]);
            delete snoozeTimerHandles[Number(targetMedId)];
        }

        // 2. Remove all occurrence keys for this medication from reminderQueue
        reminderQueue = reminderQueue.filter(key => {
            const parts = key.split("_");
            return parts[1] !== targetMedId;
        });

        // 3. If active popup belongs to this medication, hide it
        if (activeReminderKey) {
            const parts = activeReminderKey.split("_");
            if (parts[1] === targetMedId) {
                hideReminderAlert();
            }
        }

        // 4. Delete existing reminderOccurrences entries for this medId
        Object.keys(reminderOccurrences).forEach(key => {
            const parts = key.split("_");
            if (parts[1] === targetMedId) {
                delete reminderOccurrences[key];
            }
        });
    }

    // Periodic reminder scheduler check (runs every 5 seconds)
    async function checkMedicationReminders() {
        try {
            // Fetch all medications across all pets owned by user
            let allMeds = [];
            try {
                allMeds = await apiRequest(`${API_BASE}/medications`);
            } catch (err) {
                return; // Connection error, skip this tick
            }

            if (!allMeds || !Array.isArray(allMeds)) return;

            const now = new Date();
            const currentDateStr = getLocalDateString(now);

            // System current time in HH:MM format
            const currentHours = String(now.getHours()).padStart(2, '0');
            const currentMinutes = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}`;

            for (const med of allMeds) {
                const medId = med.id;
                const petId = med.pet_id;
                const scheduledTime24 = convertTo24Hour(med.reminder_time);

                // Occurrence key uniquely identifies this medication dose today
                const occurrenceKey = `${petId}_${medId}_${currentDateStr}_${scheduledTime24}`;

                // Validate start and end dates
                let dateRangeValid = true;
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);

                if (med.start_date) {
                    const start = new Date(med.start_date);
                    start.setHours(0, 0, 0, 0);
                    if (todayMidnight < start) dateRangeValid = false;
                }
                if (med.end_date) {
                    const end = new Date(med.end_date);
                    end.setHours(23, 59, 59, 999);
                    if (todayMidnight > end) dateRangeValid = false;
                }

                if (!dateRangeValid) continue;

                // Create or reference state object
                if (!reminderOccurrences[occurrenceKey]) {
                    reminderOccurrences[occurrenceKey] = {
                        key: occurrenceKey,
                        medication: med,
                        pet: {
                            id: petId,
                            name: med.pet_name || (currentPet && currentPet.id === petId ? currentPet.name : `Pet #${petId}`),
                            species: med.pet_species || (currentPet && currentPet.id === petId ? currentPet.species : ""),
                            breed: med.pet_breed || (currentPet && currentPet.id === petId ? currentPet.breed : "")
                        },
                        status: med.status === "COMPLETED" ? "GIVEN" : (med.status || "PENDING"),
                        snoozedUntil: med.snoozed_until || null,
                        scheduledTime: scheduledTime24,
                        dateStr: currentDateStr
                    };
                } else {
                    // Update medication & pet references in case details (dosage, sound, notes, name) changed
                    reminderOccurrences[occurrenceKey].medication = med;
                    reminderOccurrences[occurrenceKey].pet = {
                        id: petId,
                        name: med.pet_name || (currentPet && currentPet.id === petId ? currentPet.name : `Pet #${petId}`),
                        species: med.pet_species || (currentPet && currentPet.id === petId ? currentPet.species : ""),
                        breed: med.pet_breed || (currentPet && currentPet.id === petId ? currentPet.breed : "")
                    };
                    // If DB status is PENDING (e.g. after schedule edit re-arm), re-arm occurrence status
                    if (med.status === "PENDING" && reminderOccurrences[occurrenceKey].status !== "ACTIVE" && reminderOccurrences[occurrenceKey].status !== "SNOOZED") {
                        reminderOccurrences[occurrenceKey].status = "PENDING";
                        reminderOccurrences[occurrenceKey].snoozedUntil = null;
                    }
                }

                const occ = reminderOccurrences[occurrenceKey];

                // If marked completed in DB or GIVEN state, do not trigger
                if (med.status === "COMPLETED" || occ.status === "GIVEN") {
                    occ.status = "GIVEN";
                    continue;
                }

                // Re-hydrate backend snooze state if page was refreshed
                if (med.status === "SNOOZED" && med.snoozed_until && occ.status !== "GIVEN") {
                    occ.snoozedUntil = med.snoozed_until;
                    occ.status = "SNOOZED";

                    if (now.getTime() < med.snoozed_until) {
                        if (!snoozeTimerHandles[medId]) {
                            const remainingMs = med.snoozed_until - now.getTime();
                            snoozeTimerHandles[medId] = setTimeout(() => {
                                delete snoozeTimerHandles[medId];
                                if (reminderOccurrences[occurrenceKey] && reminderOccurrences[occurrenceKey].status !== "GIVEN") {
                                    reminderOccurrences[occurrenceKey].status = "PENDING";
                                    reminderOccurrences[occurrenceKey].snoozedUntil = null;
                                    enqueueReminder(occurrenceKey);
                                }
                            }, Math.max(remainingMs, 100));
                        }
                        continue; // Still actively snoozed
                    }
                }

                // Check if snooze timer has expired
                const isSnoozeExpired = occ.status === "SNOOZED" && occ.snoozedUntil && (now.getTime() >= occ.snoozedUntil);
                const isScheduledTime = (currentTimeStr === scheduledTime24) && occ.status === "PENDING";

                if (isSnoozeExpired || isScheduledTime) {
                    occ.status = "PENDING";
                    occ.snoozedUntil = null;
                    enqueueReminder(occurrenceKey);
                }
            }

            // Process any pending items in queue
            processReminderQueue();
        } catch (err) {
            console.error("Error checking medication reminders:", err);
        }
    }

    // Safely add occurrence key to queue if not already active or queued
    function enqueueReminder(occurrenceKey) {
        if (!reminderQueue.includes(occurrenceKey) && activeReminderKey !== occurrenceKey) {
            reminderQueue.push(occurrenceKey);
        }
        processReminderQueue();
    }

    // Controlled Queue Processor: Displays one reminder popup at a time while keeping all tracked
    function processReminderQueue() {
        // If a reminder is currently displayed, do not overwrite it
        if (activeReminderKey !== null) {
            return;
        }

        // Find next PENDING reminder in queue
        while (reminderQueue.length > 0) {
            const nextKey = reminderQueue.shift();
            const occ = reminderOccurrences[nextKey];

            if (occ && occ.status === "PENDING") {
                // Activate this reminder
                activeReminderKey = nextKey;
                occ.status = "ACTIVE";

                // Update backend status to TRIGGERED
                apiRequest(`${API_BASE}/medications/${occ.medication.id}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "TRIGGERED" })
                }).catch(() => { });

                displayReminderUI(occ);
                return;
            }
        }
    }

    // Display medication reminder alert UI for a specific occurrence
    function displayReminderUI(occurrence) {
        const med = occurrence.medication;
        const pet = occurrence.pet;
        const petName = pet.name || "Pet";
        const dosageInfo = `${med.medication_name} — ${med.dosage}`;

        reminderText.innerText = `${petName} needs ${dosageInfo}`;

        // Show banner overlay
        reminderOverlay.classList.remove("hidden");

        // Play custom uploaded sound if configured, otherwise play default pet species sound
        if (med && med.sound_type === "CUSTOM" && med.custom_sound) {
            playCustomMedicationSound(med);
        } else {
            playPetSound(pet);
        }

        // Trigger browser native notification if allowed
        showNativeNotification(`Medication Reminder for ${petName}`, `${petName} needs ${dosageInfo}`);
    }

    // Native browser notification integration
    function showNativeNotification(title, body) {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            new Notification(title, { body: body, icon: "/favicon.ico" });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification(title, { body: body });
                }
            });
        }
    }

    // Handle "Mark as Given" button
    let isMarkingAsGiven = false;
    btnReminderGiven.addEventListener("click", async () => {
        // INSTANT ALARM SHUTDOWN (Runs immediately)
        stopNotificationSound();

        if (activeReminderKey === null || isMarkingAsGiven) {
            hideReminderAlert();
            return;
        }

        isMarkingAsGiven = true;
        btnReminderGiven.disabled = true;

        const currentKey = activeReminderKey;
        const occ = reminderOccurrences[currentKey];
        const med = occ ? occ.medication : null;
        const pet = occ ? occ.pet : currentPet;

        // Immediately update state to GIVEN
        if (occ) {
            occ.status = "GIVEN";
            occ.snoozedUntil = null;
        }

        if (med && med.id) {
            if (snoozeTimerHandles[med.id]) {
                clearTimeout(snoozeTimerHandles[med.id]);
                delete snoozeTimerHandles[med.id];
            }
        }

        // Hide current reminder UI and reset active key
        hideReminderAlert();

        const nowIso = new Date().toISOString();

        try {
            if (med && pet) {
                // 1. Log medication log in SQLite
                await apiRequest(`${API_BASE}/medication-logs`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        medication_id: med.id,
                        pet_id: pet.id,
                        scheduled_time: new Date().toISOString(),
                        given_time: nowIso,
                        status: "given"
                    })
                });

                // 2. Log activity checklist entry
                await apiRequest(`${API_BASE}/activities`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pet_id: pet.id,
                        activity_type: "Medication",
                        notes: `${med.medication_name} • ${med.dosage || '1 dose'}`,
                        timestamp: nowIso
                    })
                });

                // 3. Persist COMPLETED status to backend SQLite database
                await apiRequest(`${API_BASE}/medications/${med.id}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status: "COMPLETED",
                        completed_at: nowIso
                    })
                });

                showToast(`Marked ${med.medication_name} as given!`);
            }

            // Refresh dashboard data without full page reload
            await loadDashboardData();
        } catch (err) {
            console.error("Failed to mark medication as given:", err);
            showToast("Failed to mark medication as given.", "error");
        } finally {
            isMarkingAsGiven = false;
            btnReminderGiven.disabled = false;
            stopNotificationSound();
            // Process next pending reminder in queue, if any
            processReminderQueue();
        }
    });

    // Handle "Snooze" button (Snooze for exactly 5 minutes with independent absolute timestamp)
    btnReminderSnooze.addEventListener("click", async () => {
        stopNotificationSound();
        if (activeReminderKey === null) return;

        const currentKey = activeReminderKey;
        const occ = reminderOccurrences[currentKey];
        if (!occ) {
            hideReminderAlert();
            return;
        }

        const med = occ.medication;
        const medId = med.id;

        // Clear any existing snooze timer for this medication
        if (snoozeTimerHandles[medId]) {
            clearTimeout(snoozeTimerHandles[medId]);
            delete snoozeTimerHandles[medId];
        }

        // Calculate absolute timestamp: exactly 5 minutes (300,000 ms) in future
        const snoozeDurationMs = 5 * 60 * 1000;
        const snoozedUntilMs = Date.now() + snoozeDurationMs;

        occ.status = "SNOOZED";
        occ.snoozedUntil = snoozedUntilMs;

        // Persist SNOOZED status & timestamp to backend SQLite database
        apiRequest(`${API_BASE}/medications/${medId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status: "SNOOZED",
                snoozed_until: snoozedUntilMs
            })
        }).catch(err => console.warn("Failed to persist snooze status:", err));

        // Set explicit 5-minute timer handle
        snoozeTimerHandles[medId] = setTimeout(() => {
            delete snoozeTimerHandles[medId];
            if (reminderOccurrences[currentKey] && reminderOccurrences[currentKey].status !== "GIVEN") {
                reminderOccurrences[currentKey].status = "PENDING";
                reminderOccurrences[currentKey].snoozedUntil = null;
                enqueueReminder(currentKey);
            }
        }, snoozeDurationMs);

        showToast("Reminder snoozed for 5 minutes.");
        hideReminderAlert();
        // Process next pending reminder in queue, if any
        processReminderQueue();
    });

    function hideReminderAlert() {
        stopNotificationSound();
        reminderOverlay.classList.add("hidden");
        activeReminderKey = null;
    }

    // Request browser notification permissions on page load
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    // ----------------------------------------------------
    // 8. HISTORY CONTROLLER
    // ----------------------------------------------------

    // Fetch and filter historical logs (for this pet)
    async function loadHistory() {
        if (!currentPet) return;
        try {
            activitiesAll = await apiRequest(`${API_BASE}/activities?pet_id=${currentPet.id}`);
            applyFilters();
        } catch (err) {
            console.error("Could not load history list:", err);
        }
    }

    // Apply Filter logic on UI changes
    function applyFilters() {
        const filterValDate = filterDate.value; // YYYY-MM-DD
        const filterValType = filterType.value.toLowerCase(); // feeding/walking/medication

        let filtered = [...activitiesAll];

        if (filterValDate) {
            filtered = filtered.filter(act => {
                const actDate = getLocalDateString(new Date(act.timestamp));
                return actDate === filterValDate;
            });
        }

        if (filterValType) {
            filtered = filtered.filter(act => act.activity_type.toLowerCase() === filterValType);
        }

        renderHistoryTable(filtered);
    }

    function renderHistoryTable(rows) {
        historyTableBody.innerHTML = "";

        if (!rows || rows.length === 0) {
            historyTable.classList.add("hidden");
            historyEmpty.classList.remove("hidden");
            return;
        }

        historyTable.classList.remove("hidden");
        historyEmpty.classList.add("hidden");

        rows.forEach(row => {
            const tr = document.createElement("tr");

            const timestampObj = new Date(row.timestamp);
            const dateStr = formatNiceDate(row.timestamp);
            const timeStr = formatTime(row.timestamp);

            let badgeClass = "feeding";
            let icon = "restaurant";

            if (row.activity_type === "Walking") {
                badgeClass = "walking";
                icon = "directions_walk";
            } else if (row.activity_type === "Medication") {
                badgeClass = "medication";
                icon = "medication";
            }

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${dateStr}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${timeStr}</div>
                </td>
                <td>
                    <span class="activity-badge ${badgeClass}">
                        <span class="material-icons" style="font-size: 11px;">${icon}</span>
                        ${row.activity_type}
                    </span>
                </td>
                <td style="color: var(--text-secondary); max-width: 300px; word-break: break-word;">
                    ${row.notes || "—"}
                </td>
            `;
            historyTableBody.appendChild(tr);
        });
    }

    // Trigger filters on form input changes
    filterDate.addEventListener("change", applyFilters);
    filterType.addEventListener("change", applyFilters);

    // Clear Filters
    btnClearFilters.addEventListener("click", () => {
        filterDate.value = "";
        filterType.value = "";
        applyFilters();
    });

    // ----------------------------------------------------
    // 9. EXPORT HISTORY CONTROLLER
    // ----------------------------------------------------

    btnExportHistory.addEventListener("click", () => {
        if (!currentPet) {
            showToast("No active pet profile to export history for.", "error");
            return;
        }

        const rows = historyTableBody.querySelectorAll("tr");
        if (rows.length === 0 || historyTable.classList.contains("hidden")) {
            showToast("There is nothing to export.", "error");
            return;
        }

        // Fetch sorted items displayed based on current filters
        const filterValDate = filterDate.value;
        const filterValType = filterType.value.toLowerCase();
        let filtered = [...activitiesAll];
        if (filterValDate) {
            filtered = filtered.filter(act => getLocalDateString(new Date(act.timestamp)) === filterValDate);
        }
        if (filterValType) {
            filtered = filtered.filter(act => act.activity_type.toLowerCase() === filterValType);
        }

        // Sort chronologically (earliest first)
        filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (filtered.length === 0) {
            showToast("There is nothing to export.", "error");
            return;
        }

        // Check if jsPDF is available
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showToast("PDF generator not loaded yet. Please try again.", "error");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const now = new Date();
        const exportDateStr = getLocalDateString(now).split('-').reverse().join('-'); // DD-MM-YYYY

        // 1. Title
        doc.setFontSize(18);
        doc.setTextColor(51, 51, 51);
        doc.text("Activity History", 14, 22);

        // 2. Subtitle
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        const species = currentPet.species || 'Pet';
        doc.text(`${currentPet.name} (${species}) · Exported ${exportDateStr}`, 14, 30);

        // Prepare table data
        const tableData = filtered.map(act => {
            const timeStr = formatTime(act.timestamp);
            const dateStr = formatNiceDate(act.timestamp);
            return [
                `${dateStr}\n${timeStr}`,
                act.activity_type,
                act.notes || ""
            ];
        });

        // 3. AutoTable
        doc.autoTable({
            startY: 38,
            head: [['Date & Time', 'Activity Type', 'Details & Notes']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: '#4A2B1A',
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: '#FFF3E4'
            },
            styles: {
                font: 'helvetica',
                fontSize: 10,
                cellPadding: 5
            },
            didDrawPage: function (data) {
                doc.setFontSize(9);
                doc.setTextColor(150, 150, 150);
                const footerText = `Generated by Petzi - ${formatNiceDate(now)} at ${formatTime(now)}`;
                const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
                doc.text(footerText, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
            }
        });

        // 4. Download PDF
        const fileDate = getLocalDateString(now); // YYYY-MM-DD
        const fileName = `activity-history-${currentPet.name.replace(/\s+/g, '-')}-${fileDate}.pdf`;
        doc.save(fileName);
    });


    // Client-side PDF Health Report Exporter
    async function exportPetHealthReportPDF() {
        if (!currentPet) {
            showToast("No active pet profile selected to export.", "error");
            return;
        }

        const btn = document.getElementById("btn-export-pdf");
        const originalHtml = btn ? btn.innerHTML : "";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="material-icons spinner" style="font-size:1.1rem; animation: rotation 1s infinite linear;">autorenew</span>`;
        }

        try {
            // Fetch fresh medications and vaccinations data to ensure latest records are included
            const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('petziToken');
            
            // 1. Fetch Medications
            const medsRes = await fetch(`${API_BASE}/medications?pet_id=${currentPet.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const medications = medsRes.ok ? await medsRes.json() : [];

            // 2. Fetch Vaccinations
            const vacsRes = await fetch(`${API_BASE}/vaccinations?pet_id=${currentPet.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const vaccinations = vacsRes.ok ? await vacsRes.json() : [];

            // 3. Compute Wellness Score metrics
            const todayStr = getLocalDateString(new Date());
            const actRes = await fetch(`${API_BASE}/activities/today?pet_id=${currentPet.id}&date=${todayStr}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const activities = actRes.ok ? await actRes.json() : [];

            const supRes = await fetch(`${API_BASE}/supplies?pet_id=${currentPet.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const supplies = supRes.ok ? await supRes.json() : [];

            const groomRes = await fetch(`${API_BASE}/grooming?pet_id=${currentPet.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const grooming = groomRes.ok ? await groomRes.json() : [];

            // Compute score with unified engine
            const wellnessData = calculatePetWellnessScore(currentPet, activities, supplies, medications, vaccinations, grooming);
            const score = wellnessData.score;
            const statusText = wellnessData.statusText;

            // Initialize jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Brand colors
            const primaryColor = [74, 43, 26]; // #4A2B1A (Dark Brown)
            const accentColor = [165, 106, 62]; // #A56A3E (Caramel Brown)
            const textColor = [51, 51, 51]; // #333333

            // Page Header
            doc.setFillColor(74, 43, 26);
            doc.rect(0, 0, 210, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.text("PETZI HEALTH REPORT", 20, 22);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(`Generated: ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}`, 20, 31);
            doc.text(`Owner: ${currentPet.owner_name || "Petzi Member"}`, 140, 31);

            let currentY = 55;

            // Section: Pet Profile Details
            doc.setTextColor(74, 43, 26);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text("Pet Profile Summary", 20, currentY);
            doc.setDrawColor(165, 106, 62);
            doc.setLineWidth(0.5);
            doc.line(20, currentY + 3, 190, currentY + 3);

            currentY += 12;

            // Details Grid
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);

            // Left Column
            doc.setFont('helvetica', 'bold');
            doc.text("Name:", 20, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(currentPet.name || "—", 50, currentY);

            doc.setFont('helvetica', 'bold');
            doc.text("Species:", 20, currentY + 7);
            doc.setFont('helvetica', 'normal');
            doc.text(currentPet.species || "—", 50, currentY + 7);

            doc.setFont('helvetica', 'bold');
            doc.text("Breed:", 20, currentY + 14);
            doc.setFont('helvetica', 'normal');
            doc.text(currentPet.breed || "—", 50, currentY + 14);

            doc.setFont('helvetica', 'bold');
            doc.text("Age:", 20, currentY + 21);
            doc.setFont('helvetica', 'normal');
            doc.text(`${currentPet.age} years`, 50, currentY + 21);

            // Right Column
            doc.setFont('helvetica', 'bold');
            doc.text("Gender:", 110, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(currentPet.gender || "—", 140, currentY);

            doc.setFont('helvetica', 'bold');
            doc.text("Weight:", 110, currentY + 7);
            doc.setFont('helvetica', 'normal');
            doc.text(currentPet.weight ? `${currentPet.weight} kg` : "—", 140, currentY + 7);

            doc.setFont('helvetica', 'bold');
            doc.text("Color:", 110, currentY + 14);
            doc.setFont('helvetica', 'normal');
            doc.text(currentPet.color || "—", 140, currentY + 14);

            doc.setFont('helvetica', 'bold');
            doc.text("Wellness Score:", 110, currentY + 21);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(165, 106, 62);
            doc.text(`${score}% (${statusText})`, 140, currentY + 21);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFont('helvetica', 'normal');

            currentY += 30;

            // Section: Allergies & Special Instructions
            doc.setFont('helvetica', 'bold');
            doc.text("Allergies / Special Concerns:", 20, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(currentPet.allergies || "None reported", 75, currentY);

            doc.setFont('helvetica', 'bold');
            doc.text("Special Instructions:", 20, currentY + 7);
            doc.setFont('helvetica', 'normal');
            
            // Wrap text for special instructions
            const instructionsText = currentPet.special_instructions || "None";
            const splitInstructions = doc.splitTextToSize(instructionsText, 120);
            doc.text(splitInstructions, 75, currentY + 7);

            currentY += 15 + (splitInstructions.length * 4);

            // Section: Medications Schedule
            doc.setTextColor(74, 43, 26);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text("Active Medications Schedule", 20, currentY);
            doc.setDrawColor(165, 106, 62);
            doc.line(20, currentY + 3, 190, currentY + 3);

            currentY += 8;

            if (medications.length === 0) {
                doc.setTextColor(102, 102, 102);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(10);
                doc.text("No active medications schedules configured for this pet.", 20, currentY + 6);
                currentY += 14;
            } else {
                const medRows = medications.map(m => [
                    m.medication_name,
                    `${m.dosage} — ${m.frequency_hours ? `Every ${m.frequency_hours}h` : 'Once daily'}`,
                    `${formatNiceDate(m.start_date)} to ${formatNiceDate(m.end_date)}`,
                    m.instructions || "—"
                ]);

                doc.autoTable({
                    startY: currentY,
                    head: [['Medication Name', 'Dosage & Frequency', 'Duration', 'Instructions']],
                    body: medRows,
                    theme: 'striped',
                    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [255, 248, 240] },
                    styles: { font: 'helvetica', fontSize: 9 },
                    columnStyles: {
                        3: { cellWidth: 50 } // Make instructions wrap nicely
                    }
                });
                currentY = doc.lastAutoTable.finalY + 15;
            }

            // Section: Vaccination History
            doc.setTextColor(74, 43, 26);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text("Vaccination Record & Compliance", 20, currentY);
            doc.setDrawColor(165, 106, 62);
            doc.line(20, currentY + 3, 190, currentY + 3);

            currentY += 8;

            if (vaccinations.length === 0) {
                doc.setTextColor(102, 102, 102);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(10);
                doc.text("No vaccination records logged for this pet.", 20, currentY + 6);
            } else {
                const vacRows = vaccinations.map(v => [
                    v.vaccine_name,
                    formatNiceDate(v.date_administered),
                    formatNiceDate(v.next_due_date),
                    v.veterinarian || "—",
                    v.status
                ]);

                doc.autoTable({
                    startY: currentY,
                    head: [['Vaccine Name', 'Administered', 'Next Due Date', 'Veterinarian / Clinic', 'Status']],
                    body: vacRows,
                    theme: 'striped',
                    headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [255, 248, 240] },
                    styles: { font: 'helvetica', fontSize: 9 }
                });
            }

            // Save PDF
            doc.save(`${currentPet.name.replace(/\s+/g, '_')}_Health_Report.pdf`);
            showToast("Health report PDF exported successfully!", "success");

        } catch (err) {
            console.error("Failed to generate PDF Health Report:", err);
            showToast("Failed to generate PDF Health Report.", "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    }

    // Bind PDF Export Button Click
    if (btnExportPdf) {
        btnExportPdf.addEventListener("click", exportPetHealthReportPDF);
    }

    // Run initialization
    initApp();
});
