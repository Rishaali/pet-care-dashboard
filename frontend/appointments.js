// Check Authentication
const currentUser = JSON.parse(localStorage.getItem('petziUser') || 'null');
if (!currentUser || !currentUser.id) {
    window.location.replace('auth.html?mode=login');
}

// Global state
let appointmentsList = [];
let selectedRescheduleApp = null;
let selectedRescheduleSlot = null;

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    // Nav Username
    document.getElementById('nav-username').textContent = currentUser.name.split(' ')[0];

    // Logout Handler
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('petziUser');
        window.location.replace('home.html');
    });

    loadAppointments();
    setupRescheduleModal();
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

// Load user's appointments
async function loadAppointments() {
    try {
        const response = await fetch(`/api/appointments?user_id=${currentUser.id}`);
        if (!response.ok) throw new Error("Failed to load appointments");

        appointmentsList = await response.json();
        renderAppointments();
    } catch (err) {
        console.error(err);
        showToast("Could not load your appointments.", "error");
    }
}

// Render appointments to sections
function renderAppointments() {
    const listUpcoming = document.getElementById('list-upcoming');
    const listCompleted = document.getElementById('list-completed');
    const listCancelled = document.getElementById('list-cancelled');

    // Reset lists
    listUpcoming.innerHTML = '';
    listCompleted.innerHTML = '';
    listCancelled.innerHTML = '';

    // Get today's date string YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];

    let countUpcoming = 0;
    let countCompleted = 0;
    let countCancelled = 0;

    appointmentsList.forEach(app => {
        const appDate = app.appointment_date;
        const isCancelled = app.status === 'Cancelled';
        const isCompleted = app.status === 'Completed' || (!isCancelled && appDate < todayStr);
        const isUpcoming = !isCancelled && !isCompleted;

        const card = createAppointmentCard(app, isUpcoming, isCompleted, isCancelled);

        if (isUpcoming) {
            listUpcoming.appendChild(card);
            countUpcoming++;
        } else if (isCompleted) {
            listCompleted.appendChild(card);
            countCompleted++;
        } else if (isCancelled) {
            listCancelled.appendChild(card);
            countCancelled++;
        }
    });

    // Update section counts
    document.getElementById('count-upcoming').textContent = countUpcoming;
    document.getElementById('count-completed').textContent = countCompleted;
    document.getElementById('count-cancelled').textContent = countCancelled;

    // Show empty states if counts are 0
    if (countUpcoming === 0) {
        listUpcoming.innerHTML = '<div class="empty-section-state">No upcoming appointments scheduled.</div>';
    }
    if (countCompleted === 0) {
        listCompleted.innerHTML = '<div class="empty-section-state">No past appointments recorded.</div>';
    }
    if (countCancelled === 0) {
        listCancelled.innerHTML = '<div class="empty-section-state">No cancelled appointments.</div>';
    }
}

// Create Card DOM element
function createAppointmentCard(app, isUpcoming, isCompleted, isCancelled) {
    const card = document.createElement('div');
    card.className = 'app-card';

    // Status classes
    let statusClass = 'booked';
    let displayStatus = app.status;
    if (isCancelled) {
        statusClass = 'cancelled';
        displayStatus = 'Cancelled';
    } else if (isCompleted) {
        statusClass = 'completed';
        displayStatus = 'Completed';
    } else if (app.status === 'Rescheduled') {
        statusClass = 'booked';
        displayStatus = 'Rescheduled';
    }

    // Convert time
    const timeDisplay = format12HourTime(app.appointment_time);
    const dateDisplay = formatNiceDate(app.appointment_date);

    // Actions block based on category
    let actionsHtml = '';
    if (isUpcoming) {
        actionsHtml = `
            <div class="app-actions">
                <button class="btn-app-action" onclick="openRescheduleModal(${app.id})">
                    <span class="material-icons" style="font-size:1.1rem;">edit_calendar</span> Reschedule
                </button>
                <button class="btn-app-action btn-danger-app" onclick="cancelAppointment(${app.id})">
                    <span class="material-icons" style="font-size:1.1rem;">cancel</span> Cancel
                </button>
            </div>
        `;
    } else {
        // Option to delete record
        actionsHtml = `
            <div class="app-actions">
                <button class="btn-app-action btn-danger-app" style="flex: none; width: 100%;" onclick="deleteAppointment(${app.id})">
                    <span class="material-icons" style="font-size:1.1rem;">delete</span> Delete Record
                </button>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="app-card-header">
            <div>
                <h4 class="app-doc-name">${app.vet_name}</h4>
                <div class="app-doc-specialty">${app.vet_specialization}</div>
            </div>
            <span class="app-status ${statusClass}">${displayStatus}</span>
        </div>

        <div class="app-details">
            <div class="app-details-row">
                <span>Pet Name:</span>
                <strong>${app.pet_name}</strong>
            </div>
            <div class="app-details-row">
                <span>Problem:</span>
                <strong>${app.disease}</strong>
            </div>
            <div class="app-details-row" style="margin-top: 4px; border-top: 1px dashed var(--border-light); padding-top: 4px;">
                <span>Clinic:</span>
                <strong>${app.clinic_name}</strong>
            </div>
            <div class="app-details-row">
                <span>Location:</span>
                <strong>${app.clinic_city}</strong>
            </div>
            <div class="app-details-row" style="margin-top: 4px; border-top: 1px dashed var(--border-light); padding-top: 4px; color: var(--brand-primary);">
                <span>Date:</span>
                <strong>${dateDisplay}</strong>
            </div>
            <div class="app-details-row" style="color: var(--brand-primary);">
                <span>Time Slot:</span>
                <strong>${timeDisplay}</strong>
            </div>
        </div>

        ${app.notes ? `<div class="app-notes">"${app.notes}"</div>` : ''}

        ${actionsHtml}
    `;

    return card;
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

// Cancel appointment API request
window.cancelAppointment = async function(id) {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    try {
        const response = await fetch(`/api/appointments/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'Cancelled' })
        });

        if (!response.ok) throw new Error("Cancel request failed");

        showToast("Appointment successfully cancelled.");
        loadAppointments();
    } catch (err) {
        console.error(err);
        showToast("Could not cancel the appointment.", "error");
    }
};

// Hard Delete appointment record API request
window.deleteAppointment = async function(id) {
    if (!confirm("Are you sure you want to permanently delete this appointment record?")) return;

    try {
        const response = await fetch(`/api/appointments/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error("Delete request failed");

        showToast("Appointment record deleted.");
        loadAppointments();
    } catch (err) {
        console.error(err);
        showToast("Could not delete appointment record.", "error");
    }
};

// Setup reschedule modal elements
function setupRescheduleModal() {
    const modal = document.getElementById('reschedule-modal');
    const form = document.getElementById('reschedule-form');
    const dateInput = document.getElementById('reschedule-date');

    // Dates limit: today to today + 6 days
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;

    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 6);
    const max_yyyy = maxDate.getFullYear();
    const max_mm = String(maxDate.getMonth() + 1).padStart(2, '0');
    const max_dd = String(maxDate.getDate()).padStart(2, '0');
    dateInput.max = `${max_yyyy}-${max_mm}-${max_dd}`;

    // Listener for datepicker slot changes
    dateInput.addEventListener('change', fetchRescheduleSlots);

    // Close button
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        modal.classList.remove('show');
    });
    document.getElementById('btn-cancel-reschedule').addEventListener('click', () => {
        modal.classList.remove('show');
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!selectedRescheduleSlot) {
            showToast("Please select a new time slot.", "error");
            return;
        }

        const dateVal = dateInput.value;
        const notesVal = document.getElementById('reschedule-notes').value.trim();

        try {
            const response = await fetch(`/api/appointments/${selectedRescheduleApp.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    appointment_date: dateVal,
                    appointment_time: selectedRescheduleSlot,
                    notes: notesVal,
                    status: 'Rescheduled'
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Update request failed");

            showToast("Appointment successfully rescheduled.");
            modal.classList.remove('show');
            loadAppointments();
        } catch (err) {
            console.error(err);
            showToast(err.message || "Failed to reschedule appointment.", "error");
        }
    });
}

// Open Reschedule Dialog
window.openRescheduleModal = function(id) {
    const app = appointmentsList.find(a => a.id === id);
    if (!app) return;

    selectedRescheduleApp = app;
    selectedRescheduleSlot = null;

    // Populate displays
    document.getElementById('reschedule-app-id').value = id;
    document.getElementById('reschedule-vet-display').innerHTML = `Rescheduling visit with: <strong>${app.vet_name}</strong> (${app.vet_specialization})`;
    document.getElementById('reschedule-notes').value = app.notes || '';
    
    // Clear slots
    document.getElementById('reschedule-date').value = '';
    document.getElementById('reschedule-slots-container').innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">
            Select a date to check availability.
        </div>
    `;

    document.getElementById('reschedule-modal').classList.add('show');
};

// Fetch slots for reschedule date change
async function fetchRescheduleSlots() {
    const dateVal = document.getElementById('reschedule-date').value;
    const container = document.getElementById('reschedule-slots-container');
    selectedRescheduleSlot = null;

    if (!dateVal || !selectedRescheduleApp) return;

    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--brand-primary); font-size: 0.8rem; padding: 10px 0;">
            <span class="material-icons animate-spin" style="font-size: 1.1rem;">sync</span> Checking slots...
        </div>
    `;

    try {
        const response = await fetch(`/api/vets/${selectedRescheduleApp.vet_id}/availability?date=${dateVal}`);
        if (!response.ok) throw new Error("Slots fetch failed");
        
        const slots = await response.json();
        container.innerHTML = '';

        if (slots.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: #EF4444; font-size: 0.8rem; padding: 10px 0; font-weight: 600;">
                    ✗ No slots available on this date.
                </div>
            `;
            return;
        }

        slots.forEach(slot => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'slot-pill';
            btn.textContent = format12HourTime(slot);
            btn.dataset.time = slot;
            btn.addEventListener('click', () => {
                const activeBtn = container.querySelector('.slot-pill.active');
                if (activeBtn) activeBtn.classList.remove('active');
                
                btn.classList.add('active');
                selectedRescheduleSlot = slot;
            });
            container.appendChild(btn);
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #EF4444; font-size: 0.8rem; padding: 10px 0;">
                Failed to check availability.
            </div>
        `;
    }
}
