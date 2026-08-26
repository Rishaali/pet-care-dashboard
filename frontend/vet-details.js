// Check Authentication
const currentUser = JSON.parse(localStorage.getItem('petziUser') || 'null');
if (!currentUser || !currentUser.id) {
    window.location.replace('auth.html?mode=login');
}

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
    // Nav Username
    document.getElementById('nav-username').textContent = currentUser.name.split(' ')[0];

    // Logout Handler
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('petziUser');
        window.location.replace('home.html');
    });

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
    toast.style.background = type === 'error' ? '#FEF2F2' : '#ECFDF5';
    toast.style.border = type === 'error' ? '1px solid #FCA5A5' : '1px solid #A7F3D0';
    toast.style.color = type === 'error' ? '#991B1B' : '#065F46';
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

// Set up Date Picker constraints (today to today + 6 days)
function setupDatePicker() {
    const dateInput = document.getElementById('booking-date');
    const today = new Date();
    
    // Format min date
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;

    // Format max date (today + 6 days)
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 6);
    const max_yyyy = maxDate.getFullYear();
    const max_mm = String(maxDate.getMonth() + 1).padStart(2, '0');
    const max_dd = String(maxDate.getDate()).padStart(2, '0');
    dateInput.max = `${max_yyyy}-${max_mm}-${max_dd}`;

    // Hook listener
    dateInput.addEventListener('change', fetchAvailableSlots);
}

// Fetch Vet Profile details
async function loadVetDetails() {
    try {
        const response = await fetch(`/api/vets/${vetId}`);
        if (!response.ok) throw new Error("Vet details not found");
        vetData = await response.json();

        clinicId = vetData.clinic_id;

        // Populate elements
        document.getElementById('vet-name').textContent = vetData.name;
        document.getElementById('vet-qualification').textContent = vetData.qualification || '';
        document.getElementById('vet-specialty').textContent = vetData.specialization;
        document.getElementById('vet-rating').textContent = `${vetData.rating} (${vetData.review_count} reviews)`;
        document.getElementById('vet-experience').textContent = `${vetData.experience} Years Exp`;
        
        document.getElementById('clinic-name').textContent = vetData.clinic_name || 'Independent Clinic';
        document.getElementById('clinic-address').textContent = vetData.address || '';
        document.getElementById('clinic-phone').textContent = vetData.clinic_phone || '';
        document.getElementById('clinic-hours').textContent = `${vetData.opening_time || '09:00 AM'} - ${vetData.closing_time || '08:00 PM'}`;

        document.getElementById('vet-phone').textContent = vetData.phone || 'N/A';
        document.getElementById('vet-email').textContent = vetData.email || 'N/A';

        // Check emergency badge
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
                tag.innerHTML = `<span class="material-icons" style="font-size: 1.1rem; color: var(--brand-primary)">check</span> <span>${serv}</span>`;
                servicesContainer.appendChild(tag);
            });
        } else {
            servicesContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No services listed.</p>';
        }

        // Booking card values
        document.getElementById('booking-disease').textContent = diseaseName;
        document.getElementById('booking-fee').textContent = `₹${vetData.consultation_fee}`;
    } catch (err) {
        console.error(err);
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
        const response = await fetch(`/api/pets/${petId}`);
        if (!response.ok) throw new Error("Pet not found");
        petData = await response.json();

        document.getElementById('booking-pet-name').textContent = petData.name;
    } catch (err) {
        console.error(err);
        document.getElementById('booking-pet-name').textContent = `Pet #${petId}`;
    }
}

// Fetch slots for selected date
async function fetchAvailableSlots() {
    const dateVal = document.getElementById('booking-date').value;
    const slotsContainer = document.getElementById('slots-container');
    selectedSlotTime = null;

    if (!dateVal) return;

    slotsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--brand-primary); font-size: 0.85rem; padding: 10px 0;">
            <span class="material-icons animate-spin" style="font-size: 1.2rem;">sync</span> Loading slots...
        </div>
    `;

    try {
        const response = await fetch(`/api/vets/${vetId}/availability?date=${dateVal}`);
        if (!response.ok) throw new Error("Slots fetch failed");
        
        const slots = await response.json();
        slotsContainer.innerHTML = '';

        if (slots.length === 0) {
            slotsContainer.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: #EF4444; font-size: 0.85rem; padding: 10px 0; font-weight: 600;">
                    ✗ No slots available on this date.
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
                // Toggle active styles
                const activeBtn = slotsContainer.querySelector('.slot-btn.active');
                if (activeBtn) activeBtn.classList.remove('active');
                
                btn.classList.add('active');
                selectedSlotTime = slot;
            });
            slotsContainer.appendChild(btn);
        });
    } catch (err) {
        console.error(err);
        slotsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #EF4444; font-size: 0.85rem; padding: 10px 0;">
                Failed to load slot times.
            </div>
        `;
    }
}

// Convert 24h string ("14:30") to 12h string ("2:30 PM")
function format12HourTime(time24) {
    const [hours, minutes] = time24.split(":").map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const finalHours = hours % 12 || 12;
    return `${finalHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

// Format date string ("2026-08-27") to ("27 August 2026")
function formatNiceDate(dateStr) {
    const date = new Date(dateStr);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Handle Form booking post
function setupFormSubmission() {
    const form = document.getElementById('booking-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const dateVal = document.getElementById('booking-date').value;
        const notesVal = document.getElementById('booking-notes').value.trim();

        if (!selectedSlotTime) {
            showToast("Please pick a time slot for the appointment.", "error");
            return;
        }

        const bodyData = {
            pet_id: petId,
            vet_id: vetId,
            clinic_id: clinicId,
            disease: diseaseName,
            appointment_date: dateVal,
            appointment_time: selectedSlotTime,
            notes: notesVal
        };

        const submitBtn = document.getElementById('btn-submit-appointment');
        submitBtn.disabled = true;
        submitBtn.textContent = "Booking...";

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bodyData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Booking failed");
            }

            // Transition to confirmation
            showConfirmationView(dateVal, selectedSlotTime);
        } catch (err) {
            console.error(err);
            showToast(err.message || "Failed to schedule appointment.", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="material-icons">check_circle</span> Confirm Appointment';
        }
    });
}

// Display Successful Confirmation Screen
function showConfirmationView(dateVal, timeVal) {
    document.getElementById('details-view').style.display = 'none';
    
    // Populate Confirmation elements
    document.getElementById('conf-vet-name').textContent = vetData.name;
    document.getElementById('conf-vet-specialty').textContent = vetData.specialization;
    document.getElementById('conf-clinic-name').textContent = vetData.clinic_name || 'Independent Clinic';
    document.getElementById('conf-clinic-city').textContent = vetData.city || '';
    
    document.getElementById('conf-pet-name').textContent = petData ? petData.name : `Pet #${petId}`;
    document.getElementById('conf-disease').textContent = diseaseName;
    document.getElementById('conf-date').textContent = formatNiceDate(dateVal);
    document.getElementById('conf-time').textContent = format12HourTime(timeVal);

    // Show Confirmation View
    document.getElementById('confirmation-view').style.display = 'block';
}
