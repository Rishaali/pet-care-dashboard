// Check Authentication
const currentUser = JSON.parse(localStorage.getItem('petziUser') || 'null');
if (!currentUser || !currentUser.id) {
    window.location.replace('auth.html?mode=login');
}

// Global state variables
let myPets = [];
let allVets = [];
let filteredVets = [];
let selectedVetsForCompare = [];

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    // Nav Username
    document.getElementById('nav-username').textContent = currentUser.name.split(' ')[0];

    // Logout Handler
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('petziUser');
        window.location.replace('home.html');
    });

    loadPets();
    setupEventHandlers();
});

// Setup toast notification helper
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

// Load Pets for selection
async function loadPets() {
    try {
        const response = await fetch(`/api/pets?user_id=${currentUser.id}`);
        if (!response.ok) throw new Error("Failed to load pets");
        myPets = await response.json();
        
        const petSelect = document.getElementById('pet-select');
        petSelect.innerHTML = '<option value="">Choose a Pet...</option>';
        
        myPets.forEach(pet => {
            const option = document.createElement('option');
            option.value = pet.id;
            option.textContent = `${pet.name} (${pet.breed || pet.species || 'Pet'})`;
            petSelect.appendChild(option);
        });

        // Pre-select pet if pet_id query param exists
        const urlParams = new URLSearchParams(window.location.search);
        const petParam = urlParams.get('pet_id');
        if (petParam) {
            petSelect.value = petParam;
        }
    } catch (err) {
        console.error("Error loading pets:", err);
        showToast("Could not load your pet list. Please try again.", "error");
    }
}

// Setup elements and triggers
function setupEventHandlers() {
    const searchForm = document.getElementById('search-form');
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch();
    });

    // Client-side filtering & sorting hooks
    const filterTriggers = document.querySelectorAll('.filter-trigger');
    filterTriggers.forEach(el => {
        el.addEventListener('change', applyFiltersAndSort);
    });

    const sortSelect = document.getElementById('sort-select');
    sortSelect.addEventListener('change', applyFiltersAndSort);

    // Compare bar & Modal actions
    document.getElementById('btn-compare-now').addEventListener('click', showCompareModal);
    document.getElementById('btn-close-compare').addEventListener('click', () => {
        document.getElementById('compare-modal').classList.remove('show');
    });

    // Dismiss modal on clicking background
    document.getElementById('compare-modal').addEventListener('click', (e) => {
        if (e.target.id === 'compare-modal') {
            document.getElementById('compare-modal').classList.remove('show');
        }
    });
}

// Perform AJAX search for Vets
async function performSearch() {
    const petId = document.getElementById('pet-select').value;
    const diseaseDrop = document.getElementById('disease-select').value;
    const diseaseManual = document.getElementById('disease-manual').value.trim();
    const city = document.getElementById('city-select').value;

    const disease = diseaseManual || diseaseDrop;

    if (!petId) {
        showToast("Please select a pet.", "error");
        return;
    }
    if (!disease) {
        showToast("Please select a problem or enter one manually.", "error");
        return;
    }

    // Update Safety Disclaimer
    updateSafetyBanner(disease);

    try {
        const vetsList = document.getElementById('vets-list');
        vetsList.innerHTML = `
            <div style="text-align: center; padding: 48px;">
                <span class="material-icons animate-spin" style="font-size: 3rem; color: var(--brand-primary)">sync</span>
                <p style="margin-top: 10px; font-weight: 500;">Searching matching doctors...</p>
            </div>
        `;

        const response = await fetch(`/api/vets/recommendations?disease=${encodeURIComponent(disease)}&city=${encodeURIComponent(city)}`);
        if (!response.ok) throw new Error("Search API failed");
        
        allVets = await response.json();
        
        // Show filters sidebar & results header
        document.getElementById('sidebar-filters').style.display = 'block';
        document.getElementById('results-header').style.display = 'flex';

        // Pre-fill filter specialty if matched disease
        const filterSpecialty = document.getElementById('filter-specialty');
        // Reset compare selections on a new search
        selectedVetsForCompare = [];
        updateCompareBar();

        applyFiltersAndSort();
    } catch (err) {
        console.error(err);
        document.getElementById('vets-list').innerHTML = `
            <div class="empty-results">
                <span class="material-icons" style="color: #EF4444;">error</span>
                <h3>Search Error</h3>
                <p>Failed to retrieve veterinarian recommendations. Please try again.</p>
            </div>
        `;
    }
}

// Update Safety warning based on input
function updateSafetyBanner(disease) {
    const banner = document.getElementById('safety-banner');
    const icon = document.getElementById('safety-icon');
    const title = document.getElementById('safety-title');
    const text = document.getElementById('safety-text');

    const isEmergency = disease.toLowerCase().includes('emergency') || 
                        disease.toLowerCase().includes('accident') || 
                        disease.toLowerCase().includes('fracture') || 
                        disease.toLowerCase().includes('bleeding') || 
                        disease.toLowerCase().includes('seizure');

    if (isEmergency) {
        banner.className = 'safety-banner emergency';
        icon.textContent = 'warning';
        title.textContent = '🚨 EMERGENCY WARNING — URGENT';
        text.textContent = 'Your pet may require urgent veterinary attention. Please contact an emergency veterinary clinic immediately. Do not delay professional help while using this matching tool.';
    } else {
        banner.className = 'safety-banner';
        icon.textContent = 'info';
        title.textContent = 'Information & Safety Advisory';
        text.textContent = 'This tool maps pet health problems to appropriate veterinary specializations. It is NOT a medical diagnosis tool, does not recommend prescription dosages, and should not replace clinical veterinarian evaluations.';
    }
}

// Client-side filtering & sorting
function applyFiltersAndSort() {
    const specialty = document.getElementById('filter-specialty').value;
    const rating = parseFloat(document.getElementById('filter-rating').value);
    const experience = parseInt(document.getElementById('filter-experience').value, 10);
    const fee = parseFloat(document.getElementById('filter-fee').value);
    const emergencyOnly = document.getElementById('filter-emergency').checked;

    const sortBy = document.getElementById('sort-select').value;

    // Filter
    filteredVets = allVets.filter(vet => {
        if (specialty !== 'all' && vet.specialization !== specialty) return false;
        if (vet.rating < rating) return false;
        if (vet.experience < experience) return false;
        if (vet.consultation_fee > fee) return false;
        if (emergencyOnly && vet.emergency_available !== 1) return false;
        return true;
    });

    // Sort
    filteredVets.sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score;
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'experience') return b.experience - a.experience;
        if (sortBy === 'fee') return a.consultation_fee - b.consultation_fee;
        return 0;
    });

    renderVets();
}

// Render Vets list
function renderVets() {
    const container = document.getElementById('vets-list');
    const resultsCount = document.getElementById('results-title').querySelector('span');

    resultsCount.textContent = `(${filteredVets.length} found)`;

    if (filteredVets.length === 0) {
        const city = document.getElementById('city-select').value;
        container.innerHTML = `
            <div class="empty-results">
                <span class="material-icons">info</span>
                <h3>No Suitable Veterinarians Found</h3>
                <p>No matches found in ${city} matching your filters.</p>
                <div style="margin-top: 16px; font-size: 0.9rem; color: var(--text-secondary); text-align: left; display: inline-block;">
                    <p>Try options:</p>
                    <p>✓ Change city/location to another nearby area</p>
                    <p>✓ Broaden filters (e.g. any fee, any rating)</p>
                    <p>✓ Check "General Veterinary Medicine" in specialization filter</p>
                </div>
            </div>
        `;
        return;
    }

    const petId = document.getElementById('pet-select').value;
    const diseaseDrop = document.getElementById('disease-select').value;
    const diseaseManual = document.getElementById('disease-manual').value.trim();
    const disease = diseaseManual || diseaseDrop;

    let html = '';
    filteredVets.forEach(vet => {
        const isBestMatch = vet.isBestMatch ? 'best-match' : '';
        const bestMatchBadge = vet.isBestMatch ? `<div class="best-match-badge"><span class="material-icons" style="font-size:0.9rem;">stars</span> Recommended</div>` : '';
        
        // Availability date preview (Today & tomorrow)
        const availabilityText = vet.availability_count > 0 ? '✓ Available This Week' : '✗ Unscheduled';

        // Check if already selected for comparison
        const isCompared = selectedVetsForCompare.some(sv => sv.id === vet.id);
        const compareBtnText = isCompared ? 'Compared' : 'Compare';
        const compareBtnClass = isCompared ? 'btn-vet-card btn-compare active' : 'btn-vet-card btn-compare';

        html += `
            <div class="vet-card ${isBestMatch}">
                ${bestMatchBadge}
                
                <div class="vet-image">
                    <span class="material-icons">person</span>
                </div>
                
                <div class="vet-details">
                    <div class="vet-name">
                        ${vet.name} 
                        <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">${vet.qualification || ''}</span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                        <span class="vet-specialty">${vet.specialization}</span>
                        ${vet.emergency_available === 1 ? '<span style="font-size: 0.75rem; font-weight: 700; color: #DC2626; background: #FEF2F2; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px;"><span class="material-icons" style="font-size: 0.8rem;">error</span> Emergency Care</span>' : ''}
                    </div>
                    <div class="vet-clinic">
                        <span class="material-icons" style="font-size:1rem; color: var(--brand-primary)">business</span>
                        <strong>${vet.clinic_name || 'Independent Clinic'}</strong> — ${vet.address || ''}, ${vet.city || ''}
                    </div>
                    
                    <div class="vet-stats">
                        <div class="vet-stat-item rating">
                            <span class="material-icons" style="font-size:1.1rem; color:#D97706;">star</span>
                            <span>${vet.rating} (${vet.review_count} reviews)</span>
                        </div>
                        <div class="vet-stat-item">
                            <span class="material-icons" style="font-size:1.1rem;">badge</span>
                            <span>${vet.experience} Years Exp</span>
                        </div>
                        <div class="vet-stat-item">
                            <span class="material-icons" style="font-size:1.1rem;">payments</span>
                            <span>₹${vet.consultation_fee} Fee</span>
                        </div>
                        <div class="vet-stat-item" style="color: ${vet.availability_count > 0 ? '#16A34A' : '#EF4444'}; font-weight: 600;">
                            <span class="material-icons" style="font-size:1.1rem;">schedule</span>
                            <span>${availabilityText}</span>
                        </div>
                    </div>

                    <div class="vet-reasons">
                        <div class="vet-reasons-title">Matching Profile Details</div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 4px;">
                            ${vet.reasons.slice(0, 3).map(r => `<div class="vet-reason-item">${r}</div>`).join('')}
                        </div>
                    </div>
                </div>

                <div class="vet-actions">
                    <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; text-align: right;">
                        ${vet.isBestMatch ? '<span style="color: var(--brand-primary); display: flex; align-items: center; gap: 4px; justify-content: flex-end;"><span class="material-icons" style="font-size:1rem;">stars</span> Recommended</span>' : 'Suitable Partner'}
                    </div>

                    <div class="action-buttons">
                        <a href="vet-details.html?id=${vet.id}&pet_id=${petId}&disease=${encodeURIComponent(disease)}" class="btn-vet-card btn-primary-vet">
                            <span class="material-icons">event</span> Book Appointment
                        </a>
                        <div style="display: flex; gap: 8px;">
                            <a href="vet-details.html?id=${vet.id}&pet_id=${petId}&disease=${encodeURIComponent(disease)}" class="btn-vet-card" style="flex: 1; padding: 6px;">
                                Details
                            </a>
                            <button class="${compareBtnClass}" onclick="toggleCompare(${vet.id})" style="flex: 1; padding: 6px;">
                                ${compareBtnText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Toggle veterinarian in comparison array
window.toggleCompare = function(vetId) {
    const vet = allVets.find(v => v.id === vetId);
    if (!vet) return;

    const index = selectedVetsForCompare.findIndex(sv => sv.id === vetId);
    if (index > -1) {
        selectedVetsForCompare.splice(index, 1);
        showToast(`Removed ${vet.name} from comparison.`);
    } else {
        if (selectedVetsForCompare.length >= 3) {
            showToast("You can compare up to 3 veterinarians at a time.", "error");
            return;
        }
        selectedVetsForCompare.push(vet);
        showToast(`Added ${vet.name} to comparison.`);
    }

    updateCompareBar();
    renderVets();
};

// Update Bottom Compare Drawer
function updateCompareBar() {
    const bar = document.getElementById('compare-bar');
    const container = document.getElementById('compare-pills-container');

    if (selectedVetsForCompare.length === 0) {
        bar.classList.remove('show');
        return;
    }

    bar.classList.add('show');
    container.innerHTML = '';

    selectedVetsForCompare.forEach(vet => {
        const pill = document.createElement('div');
        pill.className = 'compare-item-pill';
        pill.innerHTML = `
            <span>${vet.name}</span>
            <span class="material-icons compare-item-remove" onclick="toggleCompare(${vet.id})">cancel</span>
        `;
        container.appendChild(pill);
    });

    document.getElementById('compare-bar-subtitle').textContent = `${selectedVetsForCompare.length} of 3 veterinarians selected.`;
}

// Generate Comparison Table Modal
function showCompareModal() {
    if (selectedVetsForCompare.length < 2) {
        showToast("Please select at least 2 veterinarians to compare.", "error");
        return;
    }

    const table = document.getElementById('compare-table-element');
    const petId = document.getElementById('pet-select').value;
    const diseaseDrop = document.getElementById('disease-select').value;
    const diseaseManual = document.getElementById('disease-manual').value.trim();
    const disease = diseaseManual || diseaseDrop;

    // Build Headers
    let headerHtml = '<tr><th>Attribute</th>';
    selectedVetsForCompare.forEach(vet => {
        headerHtml += `
            <th style="text-align: center;">
                <div style="font-weight: 800; font-family: var(--font-heading); font-size: 1.1rem; color: var(--text-primary);">${vet.name}</div>
                <div style="font-size: 0.8rem; color: var(--brand-primary); font-weight: 600;">${vet.specialization}</div>
            </th>
        `;
    });
    headerHtml += '</tr>';

    // Find Best Match Score
    const maxScore = Math.max(...selectedVetsForCompare.map(v => v.score));

    // Rows mapping
    const rows = [
        { label: 'Recommendation', key: 'score', formatter: (val, vetObj) => vetObj.isBestMatch ? `<span class="compare-highlight">🏆 Recommended Vet</span>` : 'Suitable Option' },
        { label: 'Specialization', key: 'specialization' },
        { label: 'Experience', key: 'experience', formatter: (val) => `${val} Years` },
        { label: 'Rating', key: 'rating', formatter: (val, rowObj) => `<span style="color:#D97706; font-weight: 600;">⭐ ${val}</span> (${rowObj.review_count} reviews)` },
        { label: 'Consultation Fee', key: 'consultation_fee', formatter: (val) => `₹${val}` },
        { label: 'Clinic', key: 'clinic_name' },
        { label: 'Location', key: 'city' },
        { label: 'Emergency Support', key: 'emergency_available', formatter: (val) => val === 1 ? '<span style="color: #DC2626; font-weight: 700;">Yes</span>' : 'No' },
        { label: 'Availability', key: 'availability_count', formatter: (val) => val > 0 ? '<span style="color: #16A34A; font-weight: 700;">Slots Available</span>' : 'Unscheduled' }
    ];

    let bodyHtml = '';
    rows.forEach(r => {
        bodyHtml += `<tr><td><strong>${r.label}</strong></td>`;
        selectedVetsForCompare.forEach(vet => {
            let val = vet[r.key];
            if (r.formatter) {
                val = r.formatter(val, vet);
            }
            if (r.key === 'score' && vet.isBestMatch) {
                bodyHtml += `<td style="text-align: center; background: #ECFDF5;">${val}</td>`;
            } else {
                bodyHtml += `<td style="text-align: center;">${val || 'N/A'}</td>`;
            }
        });
        bodyHtml += '</tr>';
    });

    // Booking Button Row
    bodyHtml += '<tr><td><strong>Selection</strong></td>';
    selectedVetsForCompare.forEach(vet => {
        bodyHtml += `
            <td style="text-align: center; padding: 16px;">
                <a href="vet-details.html?id=${vet.id}&pet_id=${petId}&disease=${encodeURIComponent(disease)}" class="btn-primary" style="padding: 8px 16px; font-size: 0.82rem; text-decoration: none; border-radius: var(--radius-sm); font-weight: 700;">
                    Select This Doctor
                </a>
            </td>
        `;
    });
    bodyHtml += '</tr>';

    table.innerHTML = headerHtml + bodyHtml;
    document.getElementById('compare-modal').classList.add('show');
}
