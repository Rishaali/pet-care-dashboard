// Check Authentication
if (!window.Auth || !window.Auth.checkAuthGuard()) { throw new Error("Auth required"); }
const currentUser = window.Auth.getUser();

// Global page state
let vetId = null;
let petId = null;
let clinicId = null;
let diseaseName = "";
let vetData = null;
let petData = null;
let selectedSlotTime = null;

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    // Nav Username safely
    const navUsername = document.getElementById('nav-username');
    if (navUsername && currentUser) {
        const displayName = currentUser.name || currentUser.username || currentUser.email || 'User';
        navUsername.textContent = displayName.split(' ')[0];
    }

    // Logout Handler safely
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            window.Auth.logout();
        });
    }

    parseQueryParams();
    setupDatePicker();
    loadVetDetails();
    loadPetDetails();
    setupFormSubmission();
});

// Setup toast notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.padding = '12px 18px';
    toast.style.background = type === 'error' ? '#F1D8D0' : '#E8F1E5';
    toast.style.border = type === 'error' ? '1px solid #E4C7A5' : '1px solid #D7A46D';
    toast.style.color = type === 'error' ? '#6B3825' : '#3D5A3D';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '500';

    const icon = type === 'error' ? 'error' : 'check_circle';
    toast.innerHTML = `<span class="material-icons" style="font-size:1.2rem;">${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Parse URL params
function parseQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    vetId = parseInt(urlParams.get('id'), 10);
    petId = parseInt(urlParams.get('pet_id'), 10);
    diseaseName = urlParams.get('disease') || 'General Checkup';

    if (!vetId) {
        window.location.replace('vets.html');
    }
}

// Set up Date Picker constraints (today to today + 30 days)
function setupDatePicker() {
    const dateInput = document.getElementById('booking-date');
    if (!dateInput) return;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    
    // Disable past dates in calendar picker
    dateInput.min = todayStr;

    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 30);
    const max_yyyy = maxDate.getFullYear();
    const max_mm = String(maxDate.getMonth() + 1).padStart(2, '0');
    const max_dd = String(maxDate.getDate()).padStart(2, '0');
    dateInput.max = `${max_yyyy}-${max_mm}-${max_dd}`;

    const handleDateValidation = () => {
        if (!dateInput.value) return;
        const curToday = new Date().toISOString().split('T')[0];
        if (dateInput.value < curToday) {
            dateInput.value = '';
            showToast('Previous dates cannot be selected. Please choose today or a future date.', 'error');
            const slotsContainer = document.getElementById('slots-container');
            if (slotsContainer) {
                slotsContainer.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">
                        Select a date to load slots.
                    </div>
                `;
            }
            return false;
        }
        return true;
    };

    dateInput.addEventListener('change', () => {
        if (handleDateValidation()) {
            fetchAvailableSlots();
        }
    });
    dateInput.addEventListener('input', () => {
        if (dateInput.value && dateInput.value.length === 10) {
            if (handleDateValidation()) {
                fetchAvailableSlots();
            }
        }
    });
}

// Fetch Vet Profile details
// NOTE: window.apiRequest already returns parsed JSON — do NOT check .ok or call .json() on it
async function loadVetDetails() {
    try {
        vetData = await window.apiRequest('/api/vets/' + vetId);

        clinicId = vetData.clinic_id;

        // Populate elements
        document.getElementById('vet-name').textContent = vetData.name;
        document.getElementById('vet-qualification').textContent = vetData.qualification || '';
        document.getElementById('vet-specialty').textContent = vetData.specialization;
        document.getElementById('vet-rating').textContent = vetData.rating + ' (' + vetData.review_count + ' reviews)';
        document.getElementById('vet-experience').textContent = vetData.experience + ' Years Exp';
        
        document.getElementById('clinic-name').textContent = vetData.clinic_name || 'Independent Clinic';
        document.getElementById('clinic-address').textContent = vetData.address || '';
        document.getElementById('clinic-phone').textContent = vetData.clinic_phone || '';
        document.getElementById('clinic-hours').textContent = (vetData.opening_time || '09:00 AM') + ' - ' + (vetData.closing_time || '08:00 PM');

        document.getElementById('vet-phone').textContent = vetData.phone || 'N/A';
        document.getElementById('vet-email').textContent = vetData.email || 'N/A';

        if (vetData.emergency_available === 1) {
            document.getElementById('vet-emergency-badge').style.display = 'inline-block';
        }

        // Render services
        const servicesContainer = document.getElementById('services-container');
        servicesContainer.innerHTML = '';
        if (vetData.services && vetData.services.length > 0) {
            vetData.services.forEach(serv => {
                const tag = document.createElement('div');
                tag.className = 'service-tag';
                tag.innerHTML = '<span class="material-icons" style="font-size: 1.1rem; color: var(--brand-primary)">check</span> <span>' + serv + '</span>';
                servicesContainer.appendChild(tag);
            });
        } else {
            servicesContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No services listed.</p>';
        }

        // Booking card values
        document.getElementById('booking-disease').textContent = diseaseName;
        document.getElementById('booking-fee').textContent = '₹' + vetData.consultation_fee;
    } catch (err) {
        console.error('loadVetDetails error:', err);
        showToast("Error loading doctor information.", "error");
    }
}

// Fetch Pet details
async function loadPetDetails() {
    if (!petId) {
        document.getElementById('booking-pet-name').textContent = "Unknown Pet";
        return;
    }
    try {
        // apiRequest returns parsed JSON directly — no .ok or .json() needed
        const myPets = await window.apiRequest('/api/pets');
        petData = myPets?.find(p => String(p.id) === String(petId));
        document.getElementById('booking-pet-name').textContent = petData ? petData.name : 'Pet #' + petId;
    } catch (err) {
        console.error('loadPetDetails error:', err);
        document.getElementById('booking-pet-name').textContent = 'Pet #' + petId;
    }
}

// Fetch slots for selected date dynamically
async function fetchAvailableSlots() {
    const dateVal = document.getElementById('booking-date').value;
    const slotsContainer = document.getElementById('slots-container');
    selectedSlotTime = null;

    if (!dateVal) {
        slotsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">
                Select a date to load slots.
            </div>
        `;
        return;
    }

    // Show loading state
    slotsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--brand-primary); font-size: 0.85rem; padding: 12px 0; font-weight: 500;">
            <span class="material-icons animate-spin" style="font-size: 1.2rem; vertical-align: middle; margin-right: 4px;">sync</span> Loading available slots...
        </div>
    `;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    try {
        // apiRequest returns parsed JSON directly (a string array of "HH:MM" times)
        const slots = await window.apiRequest('/api/vets/' + vetId + '/availability?date=' + encodeURIComponent(dateVal));

        slotsContainer.innerHTML = '';

        if (!Array.isArray(slots) || slots.length === 0) {
            const noSlotsMsg = (dateVal === todayStr) ? 'No available slots for today.' : 'No slots available on this date.';
            slotsContainer.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: #DC2626; font-size: 0.85rem; padding: 12px 0; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <span class="material-icons" style="font-size: 1.1rem;">event_busy</span> ${noSlotsMsg}
                </div>
            `;
            return;
        }

        slots.forEach(slot => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'slot-btn';
            btn.textContent = format12HourTime(slot);
            btn.dataset.time = slot;
            btn.addEventListener('click', () => {
                const activeBtn = slotsContainer.querySelector('.slot-btn.active');
                if (activeBtn) activeBtn.classList.remove('active');
                btn.classList.add('active');
                selectedSlotTime = slot;
            });
            slotsContainer.appendChild(btn);
        });
    } catch (err) {
        console.error('fetchAvailableSlots error:', err);
        slotsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; font-size: 0.85rem; padding: 10px 0;">
                <span style="color: #EF4444; font-weight: 600;">Unable to load available slots.</span><br>
                <button type="button" onclick="fetchAvailableSlots()" style="margin-top: 6px; padding: 4px 12px; border: 1px solid var(--brand-primary); background: transparent; color: var(--brand-primary); border-radius: 6px; font-size: 0.8rem; cursor: pointer; font-weight: 600;">↻ Retry</button>
            </div>
        `;
    }
}

// Convert 24h string ("14:30") to 12h string ("2:30 PM")
function format12HourTime(time24) {
    const [hours, minutes] = time24.split(":").map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const finalHours = hours % 12 || 12;
    return finalHours + ':' + String(minutes).padStart(2, '0') + ' ' + ampm;
}

// Format date string ("2026-08-27") to ("27 August 2026")
function formatNiceDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return d + ' ' + months[m - 1] + ' ' + y;
}

// Handle Form booking post
function setupFormSubmission() {
    const form = document.getElementById('booking-form');
    const submitBtn = document.getElementById('btn-submit-appointment');
    let isSubmitting = false;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (isSubmitting) return; // Prevent double-submission

        const dateVal = document.getElementById('booking-date').value;
        const notesVal = document.getElementById('booking-notes').value.trim();

        if (!dateVal) {
            showToast("Please select a date.", "error");
            return;
        }
        const curToday = new Date().toISOString().split('T')[0];
        if (dateVal < curToday) {
            showToast("Previous dates cannot be selected. Please choose today or a future date.", "error");
            return;
        }
        if (!selectedSlotTime) {
            showToast("Please select an available time slot.", "error");
            return;
        }
        if (!clinicId) {
            showToast("Clinic information not loaded. Please refresh.", "error");
            return;
        }

        const payload = {
            pet_id: petId,
            vet_id: vetId,
            clinic_id: clinicId,
            disease: diseaseName,
            appointment_date: dateVal,
            appointment_time: selectedSlotTime,
            notes: notesVal
        };

        isSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Booking Appointment...';

        try {
            // apiRequest returns parsed JSON directly
            const result = await window.apiRequest('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Success — show confirmation view
            showConfirmationView(dateVal, selectedSlotTime);
        } catch (err) {
            console.error('Booking error:', err);
            showToast(err.message || "Failed to schedule appointment.", "error");
            isSubmitting = false;
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="material-icons">check_circle</span> Confirm Appointment';
        }
    });
}

// Display Successful Confirmation Screen
function showConfirmationView(dateVal, timeVal) {
    document.getElementById('details-view').style.display = 'none';
    
    document.getElementById('conf-vet-name').textContent = vetData.name;
    document.getElementById('conf-vet-specialty').textContent = vetData.specialization;
    document.getElementById('conf-clinic-name').textContent = vetData.clinic_name || 'Independent Clinic';
    document.getElementById('conf-clinic-city').textContent = vetData.city || '';
    
    document.getElementById('conf-pet-name').textContent = petData ? petData.name : 'Pet #' + petId;
    document.getElementById('conf-disease').textContent = diseaseName;
    document.getElementById('conf-date').textContent = formatNiceDate(dateVal);
    document.getElementById('conf-time').textContent = format12HourTime(timeVal);

    document.getElementById('confirmation-view').style.display = 'block';
}
