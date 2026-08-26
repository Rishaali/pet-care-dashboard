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
    
    // Forms
    const petProfileForm = document.getElementById("pet-profile-form");
    const medicationForm = document.getElementById("medication-form");
    const quickPetForm = document.getElementById("quick-pet-form");
    const editPetModal = document.getElementById("edit-pet-modal");
    
    // Quick Edit Triggers
    const btnEditPetQuick = document.getElementById("btn-edit-pet-quick");
    const btnCloseModal = document.getElementById("btn-close-modal");
    const btnCancelModal = document.getElementById("btn-cancel-modal");

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
        const dashboardOwnerName = document.getElementById('dashboard-owner-name');
        if (dashboardOwnerName && currentUser && currentUser.name) {
            dashboardOwnerName.textContent = currentUser.name.split(' ')[0];
        }
        
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
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Request failed on ${url}:`, error.message);
            showToast("Unable to connect to server. Please try again.", "error");
            throw error;
        }
    }

    // ----------------------------------------------------
    // 3. PET PROFILE CONTROLLER
    // ----------------------------------------------------

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
            displayPetAge.innerText = pet.age ? `${pet.age} years` : "Unknown Age";
            displayPetBreed.innerText = pet.breed || "Unknown Breed";
            displayPetGender.innerText = pet.gender || "Unknown Gender";
            displayPetWeight.innerText = pet.weight ? `${pet.weight} kg` : "Unknown Weight";
            displayPetOwner.innerText = pet.owner_name || "Unknown Owner";
            displaySpecialInstructions.innerText = pet.special_instructions || "No special instructions registered.";
            
            // Populate form elements in Pet tab
            document.getElementById("pet-name").value = pet.name || "";
            document.getElementById("pet-owner").value = pet.owner_name || "";
            document.getElementById("pet-breed").value = pet.breed || "";
            document.getElementById("pet-gender").value = pet.gender || "";
            document.getElementById("pet-age").value = pet.age || "";
            document.getElementById("pet-weight").value = pet.weight || "";
            document.getElementById("pet-instructions").value = pet.special_instructions || "";

            // Populate form elements in Quick Edit modal
            document.getElementById("quick-pet-name").value = pet.name || "";
            document.getElementById("quick-pet-owner").value = pet.owner_name || "";
            document.getElementById("quick-pet-breed").value = pet.breed || "";
            document.getElementById("quick-pet-gender").value = pet.gender || "";
            document.getElementById("quick-pet-age").value = pet.age || "";
            document.getElementById("quick-pet-weight").value = pet.weight || "";
            document.getElementById("quick-pet-instructions").value = pet.special_instructions || "";

            return true;
        } catch (error) {
            console.error("Failed to load pet details:", error);
            displaySpecialInstructions.innerText = "Error loading pet profile from server.";
            return false;
        }
    }

    // Submit Pet Profile updates from Pet Tab
    petProfileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentPet) return;

        const updatedData = {
            name: document.getElementById("pet-name").value.trim(),
            owner_name: document.getElementById("pet-owner").value.trim(),
            breed: document.getElementById("pet-breed").value.trim(),
            gender: document.getElementById("pet-gender").value,
            age: document.getElementById("pet-age").value,
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
        }
    });

    // Quick Edit Modals triggers
    btnEditPetQuick.addEventListener("click", () => {
        if (!currentPet) return;
        editPetModal.classList.remove("hidden");
    });

    function closePetModal() {
        editPetModal.classList.add("hidden");
    }

    btnCloseModal.addEventListener("click", closePetModal);
    btnCancelModal.addEventListener("click", closePetModal);
    
    // Close modal if overlay clicked
    editPetModal.addEventListener("click", (e) => {
        if (e.target === editPetModal) closePetModal();
    });

    // Submit Quick Edit Modal form
    quickPetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentPet) return;

        const updatedData = {
            name: document.getElementById("quick-pet-name").value.trim(),
            owner_name: document.getElementById("quick-pet-owner").value.trim(),
            breed: document.getElementById("quick-pet-breed").value.trim(),
            gender: document.getElementById("quick-pet-gender").value,
            age: document.getElementById("quick-pet-age").value,
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
        }
    });

    // ----------------------------------------------------
    // 4. QUICK ACTIONS & TIMER CONTROLLERS
    // ----------------------------------------------------

    // Handle Quick Action Log Clicks
    const quickButtons = document.querySelectorAll(".quick-action-btn");
    quickButtons.forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!currentPet) {
                showToast("No active pet profile to log activity for.", "error");
                return;
            }
            
            const activityType = btn.getAttribute("data-activity");
            const notePlaceholder = `Logged ${activityType.toLowerCase()} via quick dashboard action.`;
            
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
                const response = await fetch(`${API_BASE}/activities/latest/${type}?pet_id=${currentPet.id}`);
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
                ${med.notes ? `<div class="med-notes-text"><strong>Instructions:</strong> ${med.notes}</div>` : ""}
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

        const medId = document.getElementById("med-id").value;
        const name = document.getElementById("med-name").value.trim();
        const dosage = document.getElementById("med-dosage").value.trim();
        const frequency = document.getElementById("med-frequency").value.trim();
        const startDate = document.getElementById("med-start-date").value;
        const endDate = document.getElementById("med-end-date").value;
        const reminderTimeRaw = document.getElementById("med-time").value; // Returns HH:MM (24 hr)
        const notes = document.getElementById("med-notes").value.trim();

        // End date cannot be before start date validation
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end < start) {
                showToast("End Date cannot be before Start Date", "error");
                return;
            }
        }

        // Standardize reminder time format in DB as HH:MM
        const reminderTime = convertTo24Hour(reminderTimeRaw);

        const data = {
            pet_id: currentPet.id,
            medication_name: name,
            dosage: dosage,
            frequency: frequency,
            start_date: startDate || null,
            end_date: endDate || null,
            reminder_time: reminderTime,
            notes: notes || null
        };

        try {
            if (medId) {
                // Update
                await apiRequest(`${API_BASE}/medications/${medId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                showToast("Medication schedule updated!");
            } else {
                // Create new
                await apiRequest(`${API_BASE}/medications`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                showToast("New medication schedule added!");
            }

            resetMedicationForm();
            await loadMedications();
        } catch (err) {
            console.error("Failed to save medication:", err);
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

        document.getElementById("med-form-title").innerText = `Edit Schedule: ${med.medication_name}`;
        document.getElementById("btn-med-submit").innerHTML = `<span class="material-icons">save</span> Update Schedule`;
        document.getElementById("btn-med-cancel").classList.remove("hidden");
    }

    // Cancel edit
    document.getElementById("btn-med-cancel").addEventListener("click", resetMedicationForm);

    function resetMedicationForm() {
        document.getElementById("med-id").value = "";
        medicationForm.reset();
        document.getElementById("med-form-title").innerText = "Schedule New Medication";
        document.getElementById("btn-med-submit").innerHTML = `<span class="material-icons">add_alarm</span> Add Schedule`;
        document.getElementById("btn-med-cancel").classList.add("hidden");
    }

    // Delete Medication Schedule
    async function deleteMedication(id) {
        if (!confirm("Are you sure you want to delete this medication schedule? This action cannot be undone.")) return;

        try {
            await apiRequest(`${API_BASE}/medications/${id}`, {
                method: "DELETE"
            });
            showToast("Medication schedule deleted.");
            await loadMedications();
        } catch (err) {
            console.error("Failed to delete medication:", err);
        }
    }

    // ----------------------------------------------------
    // 6.5. PET AUDIO & SOUND SYSTEM
    // ----------------------------------------------------

    // Publicly available audio sources categorized by pet type/species
    const PET_SOUND_SOURCES = {
        dog: [
            "https://actions.google.com/sounds/v1/animals/dog_barking.ogg",
            "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3"
        ],
        cat: [
            "https://assets.mixkit.co/active_storage/sfx/77/77-preview.mp3",
            "https://actions.google.com/sounds/v1/animals/cat_purr.ogg"
        ],
        bird: [
            "https://assets.mixkit.co/active_storage/sfx/28/28-preview.mp3",
            "https://assets.mixkit.co/active_storage/sfx/24/24-preview.mp3"
        ],
        rabbit: [
            "https://assets.mixkit.co/active_storage/sfx/68/68-preview.mp3",
            "https://actions.google.com/sounds/v1/cartoon/pop.ogg"
        ],
        hamster: [
            "https://assets.mixkit.co/active_storage/sfx/68/68-preview.mp3",
            "https://actions.google.com/sounds/v1/cartoon/pop.ogg"
        ],
        fish: [
            "https://assets.mixkit.co/active_storage/sfx/93/93-preview.mp3",
            "https://actions.google.com/sounds/v1/cartoon/pop.ogg"
        ],
        default: [
            "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3",
            "https://actions.google.com/sounds/v1/cartoon/pop.ogg"
        ]
    };

    // Shared AudioContext for synthesizer fallback and autoplay unlock
    let sharedAudioContext = null;
    let isAudioUnlocked = false;
    let activeNotificationAudio = null;
    let activeProceduralOscillators = [];
    let activeSoundTimeouts = [];

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

    // Stop and clear all active notification audio immediately (for snooze/given/dismiss)
    function stopNotificationSound() {
        // 1. Pause and release active HTML5 audio
        if (activeNotificationAudio) {
            try {
                activeNotificationAudio.pause();
                activeNotificationAudio.currentTime = 0;
                activeNotificationAudio.src = "";
            } catch (e) {
                console.warn("Could not stop active notification audio:", e);
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
                } catch (e) {}
            });
            activeProceduralOscillators = [];
        }
    }

    // Identify pet category (species/type/breed) for sound mapping
    function determinePetSoundCategory(pet) {
        if (!pet) return "default";
        const species = (pet.species || "").toLowerCase().trim();
        const breed = (pet.breed || "").toLowerCase().trim();
        const name = (pet.name || "").toLowerCase().trim();
        const combined = `${species} ${breed} ${name}`;

        if (combined.includes("dog") || combined.includes("pup") || combined.includes("labrador") || 
            combined.includes("golden") || combined.includes("retriever") || combined.includes("terrier") || 
            combined.includes("bulldog") || combined.includes("shepherd") || combined.includes("poodle") || 
            combined.includes("beagle") || combined.includes("husky") || combined.includes("pug") ||
            combined.includes("rottweiler") || combined.includes("chihuahua") || combined.includes("boxer") ||
            combined.includes("dachshund") || combined.includes("hound")) {
            return "dog";
        }

        if (combined.includes("cat") || combined.includes("kitten") || combined.includes("kitty") || 
            combined.includes("feline") || combined.includes("persian") || combined.includes("siamese") || 
            combined.includes("maine") || combined.includes("tabby") || combined.includes("sphynx") ||
            combined.includes("ragdoll") || combined.includes("bengal") || combined.includes("shorthair")) {
            return "cat";
        }

        if (combined.includes("bird") || combined.includes("parrot") || combined.includes("canary") || 
            combined.includes("cockatiel") || combined.includes("finch") || combined.includes("parakeet") || 
            combined.includes("budgie") || combined.includes("cockatoo") || combined.includes("macaw") ||
            combined.includes("lovebird") || combined.includes("pigeon") || combined.includes("sparrow")) {
            return "bird";
        }

        if (combined.includes("rabbit") || combined.includes("bunny") || combined.includes("hare") || combined.includes("lop")) {
            return "rabbit";
        }

        if (combined.includes("hamster") || combined.includes("guinea") || combined.includes("mouse") || 
            combined.includes("rat") || combined.includes("gerbil") || combined.includes("rodent") || 
            combined.includes("chinchilla") || combined.includes("ferret")) {
            return "hamster";
        }

        if (combined.includes("fish") || combined.includes("goldfish") || combined.includes("betta") || combined.includes("aquarium") || combined.includes("tetra")) {
            return "fish";
        }

        return "default";
    }

    // Procedural Web Audio API synthesizer fallback (in case network is offline or CDN is unavailable)
    function playProceduralPetSound(category) {
        try {
            stopNotificationSound();
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
                // Procedural dog bark (two quick woofs)
                const barks = [0, 0.22];
                barks.forEach(startTime => {
                    const t = now + startTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const filter = ctx.createBiquadFilter();

                    osc.type = "sawtooth";
                    osc.frequency.setValueAtTime(320, t);
                    osc.frequency.exponentialRampToValueAtTime(80, t + 0.14);

                    filter.type = "bandpass";
                    filter.frequency.setValueAtTime(550, t);
                    filter.Q.setValueAtTime(2.5, t);

                    gain.gain.setValueAtTime(0.001, t);
                    gain.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);

                    activeProceduralOscillators.push(osc);
                    osc.start(t);
                    osc.stop(t + 0.16);
                });
            } else if (category === "cat") {
                // Procedural cat meow
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = "triangle";
                osc.frequency.setValueAtTime(450, now);
                osc.frequency.exponentialRampToValueAtTime(780, now + 0.22);
                osc.frequency.exponentialRampToValueAtTime(420, now + 0.65);

                filter.type = "lowpass";
                filter.frequency.setValueAtTime(1400, now);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.exponentialRampToValueAtTime(0.8, now + 0.1);
                gain.gain.setValueAtTime(0.7, now + 0.45);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(masterGain);

                activeProceduralOscillators.push(osc);
                osc.start(now);
                osc.stop(now + 0.7);
            } else if (category === "bird") {
                // Procedural bird chirps
                const chirps = [0, 0.12, 0.26];
                chirps.forEach(startTime => {
                    const t = now + startTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = "sine";
                    osc.frequency.setValueAtTime(2400, t);
                    osc.frequency.exponentialRampToValueAtTime(3600, t + 0.04);
                    osc.frequency.exponentialRampToValueAtTime(2600, t + 0.08);

                    gain.gain.setValueAtTime(0.001, t);
                    gain.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

                    osc.connect(gain);
                    gain.connect(masterGain);

                    activeProceduralOscillators.push(osc);
                    osc.start(t);
                    osc.stop(t + 0.1);
                });
            } else if (category === "rabbit" || category === "hamster") {
                // Procedural gentle squeak
                const chirps = [0, 0.14];
                chirps.forEach(startTime => {
                    const t = now + startTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = "sine";
                    osc.frequency.setValueAtTime(1400, t);
                    osc.frequency.exponentialRampToValueAtTime(2100, t + 0.05);
                    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.09);

                    gain.gain.setValueAtTime(0.001, t);
                    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

                    osc.connect(gain);
                    gain.connect(masterGain);

                    activeProceduralOscillators.push(osc);
                    osc.start(t);
                    osc.stop(t + 0.11);
                });
            } else {
                // Melodic chime
                const notes = [523.25, 659.25, 783.99];
                notes.forEach((freq, i) => {
                    const t = now + (i * 0.12);
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = "sine";
                    osc.frequency.setValueAtTime(freq, t);

                    gain.gain.setValueAtTime(0.001, t);
                    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

                    osc.connect(gain);
                    gain.connect(masterGain);

                    activeProceduralOscillators.push(osc);
                    osc.start(t);
                    osc.stop(t + 0.38);
                });
            }
        } catch (e) {
            console.warn("Procedural sound skipped:", e);
        }
    }

    // Play sound associated with a specific pet
    function playPetSound(pet) {
        try {
            stopNotificationSound();
            const category = determinePetSoundCategory(pet);
            const sources = PET_SOUND_SOURCES[category] || PET_SOUND_SOURCES.default;

            if (!sources || sources.length === 0) {
                playProceduralPetSound(category);
                return;
            }

            let sourceIndex = 0;
            function tryPlaySource() {
                if (sourceIndex >= sources.length) {
                    // Fallback to procedural web audio synthesizer
                    playProceduralPetSound(category);
                    return;
                }

                const audio = new Audio();
                activeNotificationAudio = audio;
                audio.src = sources[sourceIndex];
                audio.volume = 0.5;
                audio.loop = false;

                audio.onended = () => {
                    if (activeNotificationAudio === audio) {
                        activeNotificationAudio = null;
                    }
                };

                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(err => {
                        console.warn(`Audio playback issue with ${sources[sourceIndex]}:`, err.message);
                        if (activeNotificationAudio === audio) {
                            activeNotificationAudio = null;
                        }
                        sourceIndex++;
                        tryPlaySource();
                    });
                }

                audio.onerror = () => {
                    if (activeNotificationAudio === audio) {
                        activeNotificationAudio = null;
                    }
                    sourceIndex++;
                    tryPlaySource();
                };
            }

            tryPlaySource();
        } catch (error) {
            console.warn("Could not play pet sound:", error);
        }
    }

    // ----------------------------------------------------
    // 7. MEDICATION REMINDERS (SCHEDULER & NOTIFIER)
    // ----------------------------------------------------

    // Periodic reminder scheduler check
    async function checkMedicationReminders() {
        if (!currentPet) return;

        // Fetch current medications from API if cache is empty
        if (medicationsList.length === 0) {
            try {
                medicationsList = await apiRequest(`${API_BASE}/medications?pet_id=${currentPet.id}`);
            } catch (err) {
                return; // Server connection error, skip this tick
            }
        }

        const now = new Date();
        const currentDateStr = getLocalDateString(now);
        
        // System current time in HH:MM format
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`; // YYYY-MM-DD HH:MM
        
        for (const med of medicationsList) {
            const medId = med.id;
            const scheduledTime24 = convertTo24Hour(med.reminder_time);
            
            // Check if reminder is scheduled for this minute
            const timeMatches = (currentTimeStr === scheduledTime24);
            
            // Generate distinct occurrence ID for today's dose (prevent duplicate fires)
            const occurrenceKey = `${medId}_${currentDateStr}_${scheduledTime24}`;
            
            // Validate start and end dates
            let dateRangeValid = true;
            const todayMidnight = new Date();
            todayMidnight.setHours(0,0,0,0);
            
            if (med.start_date) {
                const start = new Date(med.start_date);
                start.setHours(0,0,0,0);
                if (todayMidnight < start) dateRangeValid = false;
            }
            if (med.end_date) {
                const end = new Date(med.end_date);
                end.setHours(23,59,59,999);
                if (todayMidnight > end) dateRangeValid = false;
            }

            if (!dateRangeValid) continue;

            // Check if reminder is snoozed
            const isSnoozed = snoozeUntil[medId] && (Date.now() < snoozeUntil[medId]);
            const snoozeExpired = snoozeUntil[medId] && (Date.now() >= snoozeUntil[medId]);

            // Determine if reminder should trigger:
            // 1. Time matches and hasn't been triggered/shown/pending yet.
            // 2. OR Snooze just expired, and we haven't marked it as 'given' yet for today.
            const shouldTriggerStandard = timeMatches && !triggeredReminders[occurrenceKey];
            const shouldTriggerSnooze = snoozeExpired && triggeredReminders[occurrenceKey] !== "given";

            if ((shouldTriggerStandard || shouldTriggerSnooze) && !activeReminder) {
                // If standard trigger matches, mark it as pending to prevent infinite alerts
                if (shouldTriggerStandard) {
                    triggeredReminders[occurrenceKey] = "pending";
                }
                
                // Clear snooze timer if we are firing it
                if (shouldTriggerSnooze) {
                    delete snoozeUntil[medId];
                }

                // Show reminder to user
                triggerReminderAlert(med, occurrenceKey);
            }
        }
    }

    // Display medication reminder alert UI
    function triggerReminderAlert(medication, occurrenceKey) {
        activeReminder = {
            medication: medication,
            key: occurrenceKey
        };

        const dosageInfo = `${medication.medication_name} — ${medication.dosage}`;
        reminderText.innerText = `${currentPet.name} needs ${dosageInfo}`;
        
        // Show banner overlay
        reminderOverlay.classList.remove("hidden");

        // Play the pet-specific sound for this reminder
        playPetSound(currentPet);
        
        // Trigger browser native notification if allowed
        showNativeNotification(`Medication Reminder for ${currentPet.name}`, `${currentPet.name} needs ${dosageInfo}`);
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
    btnReminderGiven.addEventListener("click", async () => {
        stopNotificationSound();
        if (!activeReminder || !currentPet) return;
        
        const med = activeReminder.medication;
        const key = activeReminder.key;
        
        const now = new Date().toISOString();
        
        try {
            // 1. Log medication log in SQLite
            await apiRequest(`${API_BASE}/medication-logs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    medication_id: med.id,
                    pet_id: currentPet.id,
                    scheduled_time: new Date().toISOString(), // Today at reminder minute
                    given_time: now,
                    status: "given"
                })
            });

            // 2. Log activity checklist entry
            await apiRequest(`${API_BASE}/activities`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pet_id: currentPet.id,
                    activity_type: "Medication",
                    notes: `${med.medication_name} (${med.dosage}) marked as given.`,
                    timestamp: now
                })
            });

            // Set final status in triggered cache to prevent repeat alerts
            triggeredReminders[key] = "given";
            
            showToast(`Marked ${med.medication_name} as given!`);
            
            // Clean up UI & stop sound
            hideReminderAlert();
            
            // Refresh dashboard
            await loadDashboardData();
        } catch (err) {
            console.error("Failed to mark medication as given:", err);
        }
    });

    // Handle "Snooze" button (Snooze for 5 minutes)
    btnReminderSnooze.addEventListener("click", () => {
        stopNotificationSound();
        if (!activeReminder) return;

        const medId = activeReminder.medication.id;
        
        // Set snooze target: 5 minutes in future
        snoozeUntil[medId] = Date.now() + 5 * 60 * 1000;
        
        showToast("Reminder snoozed for 5 minutes.");
        hideReminderAlert();
    });

    function hideReminderAlert() {
        stopNotificationSound();
        reminderOverlay.classList.add("hidden");
        activeReminder = null;
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

        // We export the filtered list of activities displayed in the table, or the current selected date's history
        const filterValDate = filterDate.value;
        const selectedDateStr = filterValDate ? formatNiceDate(filterValDate) : getLocalDateString(new Date());

        let exportText = `PET CARE HISTORY\n\n`;
        exportText += `Pet: ${currentPet.name}\n`;
        exportText += `Breed: ${currentPet.breed || "Labrador"}\n`;
        exportText += `Age: ${currentPet.age ? currentPet.age + ' years' : 'N/A'}\n`;
        exportText += `Owner: ${currentPet.owner_name || "N/A"}\n`;
        exportText += `Date Exported: ${formatNiceDate(new Date())}\n`;
        exportText += `--------------------------------------------------\n\n`;

        // Loop through activities shown in current filtered table
        const rows = historyTableBody.querySelectorAll("tr");
        if (rows.length === 0 || historyTable.classList.contains("hidden")) {
            exportText += "No activities recorded for this period.\n";
        } else {
            // Fetch sorted items displayed
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

            filtered.forEach(act => {
                const timeStr = formatTime(act.timestamp);
                const dateStr = getLocalDateString(new Date(act.timestamp));
                
                // Construct clean lines matching prompt requirement:
                // "09:00 AM - Feeding"
                // "10:30 AM - Walk"
                // "02:00 PM - Medication - Antibiotic 5 ml"
                let line = `${dateStr} ${timeStr} - ${act.activity_type}`;
                if (act.notes) {
                    line += ` - ${act.notes}`;
                }
                exportText += `${line}\n`;
            });
        }

        // Try writing to user's clipboard
        navigator.clipboard.writeText(exportText)
            .then(() => {
                showToast("History exported to clipboard successfully!");
                alert(`Pet Care History Copied to Clipboard!\n\nYou can now paste and send this to your vet.\n\nPreview:\n\n${exportText}`);
            })
            .catch(err => {
                console.error("Clipboard copy failed:", err);
                // Fallback: show in an alert or dialog
                alert(`Pet Care History:\n\n${exportText}\n\n(Select and copy the text above)`);
            });
    });

    // Run initialization
    initApp();
});
