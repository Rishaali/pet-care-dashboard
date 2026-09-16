// Pet Care Log & Medication Reminder - Application Logic
document.addEventListener("DOMContentLoaded", () => {

    // API Endpoints Base URL
    const API_BASE = "/api";

    // Application State Cache
    let currentPet = null;
    let medicationsList = [];
    let activitiesToday = [];
    let activitiesAll = [];

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

        // Check URL hash for direct tab navigation (e.g. #feeding, #walking, #medications, #history)
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            const tabMap = {
                'feeding': 'dashboard-section',
                'walking': 'dashboard-section',
                'medication': 'medications-section',
                'medications': 'medications-section',
                'history': 'history-section',
                'profile': 'profile-section'
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
        return `${y}-${m}-${d}`;
    }

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
            showToast("Unable to connect to server or unauthorized. Please try again.", "error");
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

            // Render photo carousel for the pet
            if (typeof renderPhotoCarousel === "function") {
                renderPhotoCarousel();
            }

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

        const updatedData = {
            name: document.getElementById("quick-pet-name").value.trim(),
            owner_name: document.getElementById("quick-pet-owner").value.trim(),
            breed: document.getElementById("quick-pet-breed").value.trim(),
            gender: document.getElementById("quick-pet-gender").value,
            age: document.getElementById("quick-pet-age").value,
            age_unit: document.getElementById("quick-pet-age-unit")?.value || "years",
            weight: document.getElementById("quick-pet-weight").value,
            special_instructions: document.getElementById("quick-pet-instructions").value.trim()
        };

        try {
            await apiRequest(`${API_BASE}/pets/${currentPet.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedData)
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
        const usage_per_log = parseFloat(document.getElementById("supply-usage-per-log").value);
        const low_stock_threshold_days = parseInt(document.getElementById("supply-low-stock-threshold").value, 10);

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
                    usage_per_log,
                    low_stock_threshold_days
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

    // Load dashboard metrics and activity lists
    async function loadDashboardData() {
        if (!currentPet) return;

        // 1. Fetch Today's activities for THIS SPECIFIC PET
        const todayStr = getLocalDateString(new Date());
        try {
            activitiesToday = await apiRequest(`${API_BASE}/activities/today?pet_id=${currentPet.id}&date=${todayStr}`);
            renderTimeline(activitiesToday);
        } catch (err) {
            console.error("Could not fetch today's activities:", err);
        }

        // 2. Fetch latest timers for THIS SPECIFIC PET
        await updateRelativeTimers();

        // 3. Fetch supplies stock data
        await loadSuppliesData();

        // 4. Fetch product suggestions
        await loadProductSuggestions();
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
                    timerElements[type].innerText = `Last ${type}: ${formatRelativeTime(latestActivity.timestamp)}`;
                } else if (response.status === 404) {
                    timerElements[type].innerText = `Last ${type}: Never`;
                } else {
                    timerElements[type].innerText = `Last ${type}: Error`;
                }
            } catch (err) {
                console.error(`Error loading timer for ${type}:`, err);
                timerElements[type].innerText = `Last ${type}: Connection Error`;
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
            renderSupplies(supplies);
            updateWellnessScore(activitiesToday, supplies);
        } catch (err) {
            console.error("Could not fetch supplies:", err);
        }
    }

    function updateWellnessScore(activities, supplies) {
        if (!currentPet) return;
        
        let score = 0;
        let tips = [];
        
        // 1. Feeding (Max 30)
        const feedingsToday = (activities || []).filter(act => act.activity_type === "Feeding").length;
        if (feedingsToday >= 2) {
            score += 30;
        } else if (feedingsToday === 1) {
            score += 15;
            tips.push(`Try logging one more feed for ${currentPet.name} today.`);
        } else {
            tips.push(`${currentPet.name} hasn't been fed today.`);
        }
        
        // 2. Walking (Max 30)
        const walksToday = (activities || []).filter(act => act.activity_type === "Walking").length;
        if (walksToday >= 1) {
            score += 30;
        } else {
            tips.push(`A short walk would keep ${currentPet.name} active!`);
        }
        
        // 3. Medications (Max 20)
        const medsToday = (activities || []).filter(act => act.activity_type === "Medication").length;
        score += 20; // Default medication compliance points
        
        // 4. Supplies Stock (Max 20)
        let lowStockCount = 0;
        if (supplies && supplies.length > 0) {
            supplies.forEach(s => {
                if (s.days_remaining <= s.low_stock_threshold_days) {
                    lowStockCount++;
                }
            });
        }
        if (lowStockCount === 0) {
            score += 20;
        } else if (lowStockCount === 1) {
            score += 10;
            tips.push("One supply item is running low.");
        } else {
            tips.push("Multiple supplies are running low!");
        }
        
        // Render to UI
        const textEl = document.getElementById("wellness-score-text");
        const fillEl = document.getElementById("wellness-gauge-fill");
        const statusEl = document.getElementById("wellness-status");
        const tipEl = document.getElementById("wellness-tip");
        
        if (textEl && fillEl && statusEl && tipEl) {
            textEl.innerText = `${score}%`;
            
            // Stroke dasharray of the circle is 2 * PI * r = 2 * 3.14159 * 50 = 314.16
            const offset = 314.16 - (314.16 * score / 100);
            fillEl.style.strokeDashoffset = offset;
            
            // Set status messages
            if (score >= 90) {
                statusEl.innerText = "Excellent Care! 🌟";
                statusEl.style.color = "#3D5A3D";
                tipEl.innerText = `${currentPet.name} is healthy, happy, and fully stocked!`;
            } else if (score >= 60) {
                statusEl.innerText = "Good Job! 👍";
                statusEl.style.color = "var(--petzi-brown)";
                tipEl.innerText = tips.length > 0 ? tips[0] : "Looking good today!";
            } else {
                statusEl.innerText = "Needs Attention ⚠️";
                statusEl.style.color = "#6B3825";
                tipEl.innerText = tips.length > 0 ? tips[0] : "Let's log some care activities.";
            }
        }
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

            // Calculate percentage
            const pct = Math.min(100, Math.max(0, supply.days_remaining <= supply.low_stock_threshold_days
                ? (supply.days_remaining / supply.low_stock_threshold_days) * 50
                : 50 + ((supply.days_remaining - supply.low_stock_threshold_days) / (supply.low_stock_threshold_days * 3)) * 50
            ));

            const isLow = supply.days_remaining <= supply.low_stock_threshold_days;
            const progressColorClass = isLow ? "low" : "";
            const daysLeftClass = isLow ? "low-stock" : "";

            // Trigger alert if low and not already alerted for this specific stock Level
            const alertKey = `${currentPet.id}_${supply.id}_${supply.current_stock}`;
            if (isLow && !triggeredLowStockAlerts[alertKey]) {
                triggeredLowStockAlerts[alertKey] = true;
                showToast(`Low Stock Alert: ${supply.item_name} has only ${supply.days_remaining} days left!`, "error");
            }

            const daysLeftContent = isLow
                ? `<span class="material-icons" style="font-size:0.9rem;">warning</span> ${supply.days_remaining} days left`
                : `${supply.days_remaining} days left`;

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
                <div class="supply-info">
                    <span class="supply-name">
                        <span class="material-icons" style="font-size: 1.1rem; color: var(--petzi-brown);">${icon}</span>
                        ${supply.item_name}
                    </span>
                    <span class="supply-days-left ${daysLeftClass}">${daysLeftContent}</span>
                </div>
                <div class="supply-progress-bg">
                    <div class="supply-progress-fill ${progressColorClass}" style="width: ${pct}%;"></div>
                </div>
                <div class="supply-meta">
                    <span>Stock: <strong>${supply.current_stock}</strong> ${supply.unit || ''} (uses ${supply.usage_per_log} / log)</span>
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
            medicationsList = await apiRequest(`${API_BASE}/medications?pet_id=${currentPet.id}`);
            renderMedications(medicationsList);
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
            const token = window.Auth ? window.Auth.getToken() : localStorage.getItem("petzi_token");
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

            showToast(medId ? "Medication schedule updated!" : "New medication schedule added!");
            resetMedicationForm();
            await loadMedications();
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
        document.getElementById("med-name").value = med.medication_name;
        document.getElementById("med-dosage").value = med.dosage;
        document.getElementById("med-frequency").value = med.frequency || "";
        document.getElementById("med-start-date").value = med.start_date || "";
        document.getElementById("med-end-date").value = med.end_date || "";

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
            renderVaccinations(list);
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
            renderGroomingList(logs);
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
                    ${rec.next_due_date ? `<div style="margin-bottom:4px;">📅 <span style="font-weight:600;">Next Due:</span> ${formatNiceDate(rec.next_due_date)}</div>` : ''}
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
            renderVetVisitsList(logs);
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
                        notes: `${med.medication_name} (${med.dosage}) marked as given.`,
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

    // ----------------------------------------------------
    // 10. PHOTO TIMELINE CAROUSEL & MEDIA MANAGEMENT
    // ----------------------------------------------------
    const photoCarouselTrack = document.getElementById("photo-carousel-track");
    const carouselPrev = document.getElementById("carousel-prev");
    const carouselNext = document.getElementById("carousel-next");
    const carouselDots = document.getElementById("carousel-dots");
    const btnViewAllPhotos = document.getElementById("btn-view-all-photos");

    // Add/Edit Photo Modal Elements
    const addPhotoModal = document.getElementById("add-photo-modal");
    const btnCloseAddPhoto = document.getElementById("btn-close-add-photo");
    const btnCancelAddPhoto = document.getElementById("btn-cancel-add-photo");
    const addPhotoForm = document.getElementById("add-photo-form");
    const modalPhotoUpload = document.getElementById("modal-photo-upload");
    const photoPreviewImg = document.getElementById("photo-preview-img");
    const photoPreviewBox = document.getElementById("photo-preview-box");
    const modalPhotoAge = document.getElementById("modal-photo-age");
    const modalPhotoCaption = document.getElementById("modal-photo-caption");
    const btnSavePhoto = document.getElementById("btn-save-photo");

    // Lightbox & Archive Modals
    const photoLightboxModal = document.getElementById("photo-lightbox-modal");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxCaption = document.getElementById("lightbox-caption");
    const btnCloseLightbox = document.getElementById("btn-close-lightbox");

    const archivedPhotosModal = document.getElementById("archived-photos-modal");
    const archivedPhotosGrid = document.getElementById("archived-photos-grid");
    const btnCloseArchived = document.getElementById("btn-close-archived");

    let currentPhotoIndex = 0;
    let photoCarouselInterval = null;
    let parsedPhotos = [];

    function parsePetPhotos() {
        parsedPhotos = [];
        if (currentPet && currentPet.photos) {
            try {
                parsedPhotos = typeof currentPet.photos === 'string' ? JSON.parse(currentPet.photos) : currentPet.photos;
                if (!Array.isArray(parsedPhotos)) parsedPhotos = [];
            } catch (e) {
                console.error("Error parsing pet photos", e);
            }
        }
    }

    // Helper: format photo entry date cleanly for display
    function formatPhotoTimelineDate(photo) {
        if (!photo) return "Photo Entry";

        if (photo.date && typeof photo.date === 'string' && photo.date.trim() !== '') {
            const parts = photo.date.split('-');
            if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const d = parseInt(parts[2], 10);
                const dateObj = new Date(y, m, d);
                if (!isNaN(dateObj.getTime())) {
                    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
                    return `${monthName} ${d}, ${y}`;
                }
            } else if (parts.length === 2) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const dateObj = new Date(y, m, 1);
                if (!isNaN(dateObj.getTime())) {
                    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
                    return `${monthName} ${y}`;
                }
            }
        }

        if (photo.month && photo.year) {
            return `${photo.month} ${photo.year}`;
        }

        if (photo.dateLabel && photo.dateLabel !== 'Photo') return photo.dateLabel;
        if (photo.ageLabel && photo.ageLabel !== 'Unknown age') return photo.ageLabel;
        if (photo.year) return String(photo.year);

        return "Photo Entry";
    }

    // Helper: sort photos chronologically
    function sortPhotoEntries(photos) {
        return [...photos].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : (a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0);
            const dateB = b.date ? new Date(b.date).getTime() : (b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0);
            if (dateA !== dateB && !isNaN(dateA) && !isNaN(dateB)) {
                return dateA - dateB;
            }
            const yearA = parseInt(a.year || a.ageLabel, 10);
            const yearB = parseInt(b.year || b.ageLabel, 10);
            if (!isNaN(yearA) && !isNaN(yearB) && yearA !== yearB) {
                return yearA - yearB;
            }
            return String(a.id || "").localeCompare(String(b.id || ""));
        });
    }

    function renderPhotoCarousel() {
        if (!photoCarouselTrack) return;
        photoCarouselTrack.innerHTML = "";
        if (carouselDots) carouselDots.innerHTML = "";

        parsePetPhotos();

        const sortedPhotos = sortPhotoEntries(parsedPhotos);
        const activePhotos = sortedPhotos.slice(-6); // Last 6 active entries

        activePhotos.forEach((photo, idx) => {
            const slide = document.createElement("div");
            slide.className = "carousel-slide";
            slide.dataset.id = photo.id;

            const dateStr = formatPhotoTimelineDate(photo);
            const captionStr = photo.caption ? photo.caption.trim() : "";

            const imgWrapper = document.createElement("div");
            imgWrapper.style.position = "relative";
            imgWrapper.style.width = "100%";

            const img = document.createElement("img");
            img.src = photo.url;
            img.alt = captionStr || dateStr;
            imgWrapper.appendChild(img);

            // Hover action overlay (Edit & Delete icons)
            const overlay = document.createElement("div");
            overlay.className = "slide-overlay-actions";
            overlay.style.cssText = "position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; z-index: 5;";

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.title = "Edit Entry";
            editBtn.style.cssText = "background: rgba(74, 43, 26, 0.85); color: #fff; border: none; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer;";
            editBtn.innerHTML = `<span class="material-icons" style="font-size: 0.9rem;">edit</span>`;
            editBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openEditPhotoModal(photo);
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.title = "Delete Entry";
            deleteBtn.style.cssText = "background: rgba(220, 38, 38, 0.85); color: #fff; border: none; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer;";
            deleteBtn.innerHTML = `<span class="material-icons" style="font-size: 0.9rem;">delete</span>`;
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deletePhotoEntry(photo.id);
            });

            overlay.appendChild(editBtn);
            overlay.appendChild(deleteBtn);
            imgWrapper.appendChild(overlay);

            slide.appendChild(imgWrapper);

            // Date Label Pill
            const label = document.createElement("div");
            label.className = "age-label";
            label.textContent = dateStr;
            slide.appendChild(label);

            // Visible Age Label
            const photoAgeStr = photo.ageLabel || photo.age || (currentPet ? formatPetAge(currentPet) : "");
            if (photoAgeStr && photoAgeStr !== "Unknown Age") {
                const ageDiv = document.createElement("div");
                ageDiv.className = "photo-age-label";
                ageDiv.style.cssText = "font-size: 0.85rem; font-weight: 700; color: #B35C1E; text-align: center; margin-top: 3px; margin-bottom: 2px;";
                ageDiv.textContent = photoAgeStr;
                slide.appendChild(ageDiv);
            }

            // Brief Note / Caption
            if (captionStr) {
                const capDiv = document.createElement("div");
                capDiv.className = "caption-label";
                capDiv.style.cssText = "font-size: 0.82rem; font-weight: 600; color: #4A2B1A; text-align: center; max-width: 100%; word-break: break-word; line-height: 1.2; margin-top: 2px;";
                capDiv.textContent = captionStr;
                slide.appendChild(capDiv);
            }

            img.addEventListener("click", () => openLightbox(photo));

            photoCarouselTrack.appendChild(slide);

            if (carouselDots) {
                const dot = document.createElement("div");
                dot.className = "carousel-dot";
                if (idx === 0) dot.classList.add("active");
                dot.addEventListener("click", () => goToCarouselSlide(idx));
                carouselDots.appendChild(dot);
            }
        });

        // Add Photo button slide
        const addSlide = document.createElement("div");
        addSlide.className = "carousel-slide";
        const addBtn = document.createElement("div");
        addBtn.className = "slide-add-btn";
        addBtn.innerHTML = `<span class="material-icons">add_a_photo</span><span>Add Photo</span>`;
        addBtn.addEventListener("click", () => openAddPhotoModal());
        addSlide.appendChild(addBtn);
        photoCarouselTrack.appendChild(addSlide);

        updateCarouselControls();
        startCarouselRotation();
    }

    window.renderPhotoCarousel = renderPhotoCarousel;

    // Open Add Photo Modal
    function openAddPhotoModal() {
        if (!addPhotoModal) return;
        addPhotoForm.reset();
        const idField = document.getElementById("modal-photo-id");
        if (idField) idField.value = "";
        const titleEl = document.getElementById("modal-photo-title");
        if (titleEl) titleEl.textContent = "Add Photo Entry";
        const btnTextEl = document.getElementById("btn-save-photo-text");
        if (btnTextEl) btnTextEl.textContent = "Save Photo";

        const dateInput = document.getElementById("modal-photo-date");
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        const ageInput = document.getElementById("modal-photo-age");
        if (ageInput) ageInput.value = (currentPet ? formatPetAge(currentPet) : "");

        if (photoPreviewImg) {
            photoPreviewImg.src = "";
            photoPreviewImg.classList.add("hidden");
        }
        addPhotoModal.classList.remove("hidden");
    }

    // Open Edit Photo Modal for single item
    function openEditPhotoModal(photo) {
        if (!addPhotoModal || !photo) return;
        addPhotoForm.reset();

        const idField = document.getElementById("modal-photo-id");
        if (idField) idField.value = photo.id;
        const titleEl = document.getElementById("modal-photo-title");
        if (titleEl) titleEl.textContent = "Edit Photo Entry";
        const btnTextEl = document.getElementById("btn-save-photo-text");
        if (btnTextEl) btnTextEl.textContent = "Update Entry";

        const dateInput = document.getElementById("modal-photo-date");
        if (dateInput) {
            dateInput.value = photo.date || new Date().toISOString().split('T')[0];
        }

        const captionInput = document.getElementById("modal-photo-caption");
        if (captionInput) {
            captionInput.value = photo.caption || "";
        }

        const ageInput = document.getElementById("modal-photo-age");
        if (ageInput) {
            ageInput.value = photo.ageLabel || photo.age || (currentPet ? formatPetAge(currentPet) : "");
        }

        if (photoPreviewImg) {
            photoPreviewImg.src = photo.url;
            photoPreviewImg.classList.remove("hidden");
        }

        addPhotoModal.classList.remove("hidden");
    }

    // Close Add Photo Modal
    const closeAddModal = () => addPhotoModal?.classList.add("hidden");
    btnCloseAddPhoto?.addEventListener("click", closeAddModal);
    btnCancelAddPhoto?.addEventListener("click", closeAddModal);
    addPhotoModal?.addEventListener("click", (e) => {
        if (e.target === addPhotoModal) closeAddModal();
    });

    // Handle Image Preview
    modalPhotoUpload?.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                photoPreviewImg.src = event.target.result;
                photoPreviewImg.classList.remove("hidden");
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle Add/Edit Form Submit (Item-Level Operations)
    addPhotoForm?.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!currentPet) {
            showToast("No active pet selected", "error");
            return;
        }

        const photoId = document.getElementById("modal-photo-id")?.value.trim();
        const file = modalPhotoUpload.files[0];
        const dateVal = document.getElementById("modal-photo-date")?.value.trim();
        const captionVal = modalPhotoCaption?.value.trim();

        if (!photoId && !file) {
            showToast("Please select a photo file to upload", "error");
            return;
        }

        if (!dateVal) {
            showToast("Please select a date for the timeline photo", "error");
            return;
        }

        if (!captionVal) {
            showToast("Please enter a brief note/caption", "error");
            return;
        }

        let yearStr = "";
        let monthStr = "";
        let dateLabel = dateVal;

        const parts = dateVal.split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            const dateObj = new Date(y, m, d);
            if (!isNaN(dateObj.getTime())) {
                yearStr = String(y);
                monthStr = dateObj.toLocaleString('en-US', { month: 'long' });
                dateLabel = `${monthStr} ${d}, ${y}`;
            }
        }

        // Set loading state
        btnSavePhoto.disabled = true;
        const spinner = btnSavePhoto.querySelector(".spinner");
        if (spinner) spinner.classList.remove("hidden");

        try {
            const formData = new FormData();
            if (file) {
                formData.append("photo", file);
            }
            const photoAgeVal = document.getElementById("modal-photo-age")?.value.trim() || (currentPet ? formatPetAge(currentPet) : "");
            formData.append("date", dateVal);
            formData.append("month", monthStr);
            formData.append("year", yearStr);
            formData.append("dateLabel", dateLabel);
            formData.append("ageLabel", photoAgeVal || dateLabel);
            formData.append("caption", captionVal);

            let response;
            if (photoId) {
                // Item-level EDIT
                response = await apiRequest(`${API_BASE}/pets/${currentPet.id}/photos/${photoId}`, {
                    method: "PUT",
                    body: formData
                });
                showToast("Photo entry updated successfully.", "success");
            } else {
                // Item-level ADD
                response = await apiRequest(`${API_BASE}/pets/${currentPet.id}/photos`, {
                    method: "POST",
                    body: formData
                });
                showToast("Photo entry added successfully.", "success");
            }

            if (response && response.photos !== undefined) {
                currentPet.photos = response.photos;
            }

            closeAddModal();
            renderPhotoCarousel();

        } catch (err) {
            console.error(err);
            showToast(err.message || "Failed to save photo entry.", "error");
        } finally {
            btnSavePhoto.disabled = false;
            if (spinner) spinner.classList.add("hidden");
        }
    });

    // Delete single photo entry (Item-Level DELETE) with SweetAlert2
    async function deletePhotoEntry(photoId) {
        if (!photoId || !currentPet) return;

        let isConfirmed = false;
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Delete Photo Entry?',
                text: 'Are you sure you want to delete this photo entry? This action cannot be undone.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#DC2626',
                cancelButtonColor: '#4A2B1A',
                confirmButtonText: 'Yes, delete photo',
                cancelButtonText: 'Cancel',
                background: '#FFF3E4',
                color: '#4A2B1A'
            });
            isConfirmed = result.isConfirmed;
        } else {
            isConfirmed = confirm("Are you sure you want to delete this photo entry?");
        }

        if (!isConfirmed) return;

        try {
            const response = await apiRequest(`${API_BASE}/pets/${currentPet.id}/photos/${photoId}`, {
                method: "DELETE"
            });

            if (response && response.photos !== undefined) {
                currentPet.photos = response.photos;
            }

            photoLightboxModal?.classList.add("hidden");
            renderPhotoCarousel();

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Photo entry has been removed.',
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#FFF3E4',
                    color: '#4A2B1A'
                });
            } else {
                showToast("Photo entry deleted successfully.", "success");
            }

        } catch (err) {
            console.error(err);
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message || "Failed to delete photo entry.",
                    background: '#FFF3E4',
                    color: '#4A2B1A'
                });
            } else {
                showToast(err.message || "Failed to delete photo entry.", "error");
            }
        }
    }

    function getSlidesPerView() {
        if (window.innerWidth <= 480) return 2;
        if (window.innerWidth <= 768) return 3;
        return 6;
    }

    function goToCarouselSlide(index) {
        if (!photoCarouselTrack) return;
        const slides = photoCarouselTrack.querySelectorAll('.carousel-slide');
        if (!slides.length) return;

        const maxIndex = Math.max(0, slides.length - getSlidesPerView());
        currentPhotoIndex = Math.min(Math.max(0, index), maxIndex);

        const slideWidth = slides[0].offsetWidth + 15; // gap 15px
        photoCarouselTrack.style.transform = `translateX(-${currentPhotoIndex * slideWidth}px)`;

        updateCarouselControls();
    }

    function updateCarouselControls() {
        const slides = photoCarouselTrack?.querySelectorAll('.carousel-slide') || [];
        const maxIndex = Math.max(0, slides.length - getSlidesPerView());

        if (carouselPrev) carouselPrev.disabled = currentPhotoIndex === 0;
        if (carouselNext) carouselNext.disabled = currentPhotoIndex >= maxIndex;

        const dots = carouselDots?.querySelectorAll('.carousel-dot') || [];
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === currentPhotoIndex);
        });
    }

    carouselPrev?.addEventListener("click", () => goToCarouselSlide(currentPhotoIndex - 1));
    carouselNext?.addEventListener("click", () => goToCarouselSlide(currentPhotoIndex + 1));

    function startCarouselRotation() {
        stopCarouselRotation();
        photoCarouselInterval = setInterval(() => {
            const slides = photoCarouselTrack?.querySelectorAll('.carousel-slide') || [];
            const maxIndex = Math.max(0, slides.length - getSlidesPerView());
            if (maxIndex > 0) {
                let nextIndex = currentPhotoIndex + 1;
                if (nextIndex > maxIndex) nextIndex = 0;
                goToCarouselSlide(nextIndex);
            }
        }, 4000);
    }

    function stopCarouselRotation() {
        if (photoCarouselInterval) {
            clearInterval(photoCarouselInterval);
            photoCarouselInterval = null;
        }
    }

    const carouselContainer = document.querySelector(".carousel-container");
    if (carouselContainer) {
        carouselContainer.addEventListener("mouseenter", stopCarouselRotation);
        carouselContainer.addEventListener("mouseleave", startCarouselRotation);

        let touchStartX = 0;
        carouselContainer.addEventListener("touchstart", e => {
            touchStartX = e.changedTouches[0].screenX;
        });
        carouselContainer.addEventListener("touchend", e => {
            const touchEndX = e.changedTouches[0].screenX;
            if (touchEndX < touchStartX - 50) goToCarouselSlide(currentPhotoIndex + 1);
            if (touchEndX > touchStartX + 50) goToCarouselSlide(currentPhotoIndex - 1);
        });
    }

    window.addEventListener("resize", () => goToCarouselSlide(currentPhotoIndex));

    // Open Lightbox for single photo entry
    function openLightbox(photo) {
        if (!photo) return;
        if (lightboxImg) lightboxImg.src = photo.url;

        const dateStr = formatPhotoTimelineDate(photo);
        const captionStr = photo.caption ? photo.caption.trim() : "";

        const photoAgeStr = photo.ageLabel || photo.age || (currentPet ? formatPetAge(currentPet) : "");

        if (lightboxCaption) {
            lightboxCaption.innerHTML = `<div style="font-weight:700; font-size:1.1rem; color:#4A2B1A;">${escapeHtml(dateStr)}</div>` +
                (photoAgeStr && photoAgeStr !== "Unknown Age" ? `<div style="margin-top:2px; font-size:0.95rem; color:#B35C1E; font-weight:700;">Age: ${escapeHtml(photoAgeStr)}</div>` : '') +
                (captionStr ? `<div style="margin-top:6px; font-size:1rem; color:#4A2B1A; font-weight:500;">"${escapeHtml(captionStr)}"</div>` : '');
        }

        const btnEdit = document.getElementById("lightbox-btn-edit");
        const btnDelete = document.getElementById("lightbox-btn-delete");

        if (btnEdit) {
            btnEdit.onclick = () => {
                photoLightboxModal?.classList.add("hidden");
                openEditPhotoModal(photo);
            };
        }

        if (btnDelete) {
            btnDelete.onclick = () => {
                photoLightboxModal?.classList.add("hidden");
                deletePhotoEntry(photo.id);
            };
        }

        photoLightboxModal?.classList.remove("hidden");
    }

    btnCloseLightbox?.addEventListener("click", () => photoLightboxModal.classList.add("hidden"));
    photoLightboxModal?.addEventListener("click", (e) => {
        if (e.target === photoLightboxModal) photoLightboxModal.classList.add("hidden");
    });

    // View All Photos (Archived Photos Grid)
    btnViewAllPhotos?.addEventListener("click", () => {
        if (!archivedPhotosGrid) return;
        archivedPhotosGrid.innerHTML = "";
        parsePetPhotos();

        const sortedPhotos = sortPhotoEntries(parsedPhotos);

        if (sortedPhotos.length === 0) {
            archivedPhotosGrid.innerHTML = "<p style='grid-column:1/-1; text-align:center; color:#666;'>No photos found.</p>";
        } else {
            sortedPhotos.forEach(photo => {
                const dateStr = formatPhotoTimelineDate(photo);
                const captionStr = photo.caption ? photo.caption.trim() : "";
                const photoAgeStr = photo.ageLabel || photo.age || (currentPet ? formatPetAge(currentPet) : "");

                const div = document.createElement("div");
                div.className = "archived-photo-item";
                div.style.cssText = "position: relative; border-radius: 10px; overflow: hidden; background: #FFF3E4; border: 1.5px solid #D7A46D; padding: 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;";

                div.innerHTML = `
                    <img src="${photo.url}" alt="${escapeHtml(captionStr || dateStr)}" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px;">
                    <span style="font-size: 0.85rem; font-weight: 700; color: #4A2B1A; margin-top: 4px;">${escapeHtml(dateStr)}</span>
                    ${(photoAgeStr && photoAgeStr !== "Unknown Age") ? `<span style="font-size: 0.8rem; font-weight: 700; color: #B35C1E;">${escapeHtml(photoAgeStr)}</span>` : ''}
                    ${captionStr ? `<span style="font-size: 0.8rem; font-weight: 500; color: #666; text-align: center;">${escapeHtml(captionStr)}</span>` : ''}
                `;
                div.addEventListener("click", () => {
                    archivedPhotosModal?.classList.add("hidden");
                    openLightbox(photo);
                });
                archivedPhotosGrid.appendChild(div);
            });
        }

        archivedPhotosModal?.classList.remove("hidden");
    });

    btnCloseArchived?.addEventListener("click", () => archivedPhotosModal.classList.add("hidden"));
    archivedPhotosModal?.addEventListener("click", (e) => {
        if (e.target === archivedPhotosModal) archivedPhotosModal.classList.add("hidden");
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

            // Compute score
            let score = 0;
            const feedingsToday = (activities || []).filter(act => act.activity_type === "Feeding").length;
            score += feedingsToday >= 2 ? 30 : (feedingsToday === 1 ? 15 : 0);

            const walksToday = (activities || []).filter(act => act.activity_type === "Walking").length;
            score += walksToday >= 1 ? 30 : 0;

            score += 20; // meds points

            let lowStockCount = 0;
            if (supplies && supplies.length > 0) {
                supplies.forEach(s => {
                    if (s.days_remaining <= s.low_stock_threshold_days) lowStockCount++;
                });
            }
            score += lowStockCount === 0 ? 20 : (lowStockCount === 1 ? 10 : 0);

            let statusText = "Needs Attention";
            if (score >= 90) statusText = "Excellent Care!";
            else if (score >= 60) statusText = "Good Job!";

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
