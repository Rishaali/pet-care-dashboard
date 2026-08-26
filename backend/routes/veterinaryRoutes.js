const express = require("express");

const router = express.Router();
const db = require("../database");

const DEFAULT_RADIUS_METERS = 10000;
const MAX_RADIUS_METERS = 20000;
const GEOCODING_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter"
];

function isCoordinate(value, min, max) {
    if (value === null || value === undefined || value === "") return false;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max;
}

function distanceKm(latitude, longitude, clinicLatitude, clinicLongitude) {
    const earthRadius = 6371;
    const latDelta = (clinicLatitude - latitude) * Math.PI / 180;
    const lonDelta = (clinicLongitude - longitude) * Math.PI / 180;
    const a = Math.sin(latDelta / 2) ** 2 + Math.cos(latitude * Math.PI / 180) * Math.cos(clinicLatitude * Math.PI / 180) * Math.sin(lonDelta / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clinicFromElement(element, latitude, longitude) {
    const tags = element.tags || {};
    const clinicLatitude = element.lat ?? element.center?.lat;
    const clinicLongitude = element.lon ?? element.center?.lon;
    if (!Number.isFinite(clinicLatitude) || !Number.isFinite(clinicLongitude)) return null;

    const servicesText = [tags.healthcare, tags.description, tags.operator, tags.name].filter(Boolean).join(" ").toLowerCase();
    const services = [];
    if (/emergency|24.?hour|24\/7|notfall/.test(servicesText)) services.push("Emergency / 24-hour");
    if (/dermat|allerg/.test(servicesText)) services.push("Dermatology / Allergy");
    if (/dental|tooth/.test(servicesText)) services.push("Dental care");
    if (/orthop|surgery|surgical/.test(servicesText)) services.push("Orthopedic care");
    if (/ophthalm|eye/.test(servicesText)) services.push("Ophthalmology");
    if (!services.length) services.push("General veterinary care");

    return {
        id: `${element.type}-${element.id}`,
        name: tags.name || "Veterinary clinic",
        latitude: clinicLatitude,
        longitude: clinicLongitude,
        distanceKm: Number(distanceKm(latitude, longitude, clinicLatitude, clinicLongitude).toFixed(1)),
        address: tags["addr:full"] || [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", ") || "Address unavailable",
        phone: tags.phone || tags["contact:phone"] || null,
        openingHours: tags.opening_hours || null,
        website: tags.website || tags["contact:website"] || null,
        rating: null,
        services,
        emergency: services.includes("Emergency / 24-hour"),
        mapUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${clinicLatitude},${clinicLongitude}`
    };
}

async function geocodeLocation(location) {
    const url = `${GEOCODING_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(location)}`;
    const response = await fetch(url, { headers: { "User-Agent": "Petzi veterinary clinic finder/1.0" } });
    if (!response.ok) throw new Error(`Geocoding returned ${response.status}`);
    const results = await response.json();
    if (!results.length) throw new Error("Location could not be found");
    return { latitude: Number(results[0].lat), longitude: Number(results[0].lon), address_label: results[0].display_name };
}

function resolveOwnerLocation(ownerId, callback) {
    db.get("SELECT latitude, longitude, address_label, location FROM users WHERE id = ?", [ownerId], async (error, owner) => {
        if (error) return callback(error);
        if (!owner) return callback(Object.assign(new Error("Owner not found"), { status: 404 }));
        const label = owner.location || owner.address_label;
        if (!label) return callback(Object.assign(new Error("Please add your location before searching for clinics"), { status: 409, code: "OWNER_LOCATION_REQUIRED" }));
        if (isCoordinate(owner.latitude, -90, 90) && isCoordinate(owner.longitude, -180, 180)) return callback(null, { ...owner, location: label });
        try {
            const coordinates = await geocodeLocation(label);
            db.run("UPDATE users SET latitude = ?, longitude = ?, address_label = ?, location = ? WHERE id = ?", [coordinates.latitude, coordinates.longitude, coordinates.address_label, label, ownerId], updateError => {
                if (updateError) return callback(updateError);
                callback(null, { ...owner, ...coordinates, location: label });
            });
        } catch (geocodeError) {
            console.error("Owner location geocoding failed:", geocodeError.message);
            geocodeError.status = 422;
            callback(geocodeError);
        }
    });
}

async function searchClinics(latitude, longitude, radius) {
    const query = `[out:json][timeout:20];(nwr[amenity=veterinary](around:${radius},${latitude},${longitude});nwr[healthcare=veterinary](around:${radius},${latitude},${longitude}););out center tags;`;
    let data;
    let lastError;
    for (const overpassUrl of OVERPASS_URLS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        try {
            const response = await fetch(overpassUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal
            });
            if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
            data = await response.json();
            break;
        } catch (error) {
            lastError = new Error(`${overpassUrl}: ${error.name === "AbortError" ? "request timed out after 25 seconds" : error.message}`);
            console.error("Veterinary provider attempt failed:", lastError.message);
        } finally {
            clearTimeout(timeout);
        }
    }
    if (!data) throw lastError || new Error("No Overpass service responded");
    return (data.elements || []).map(element => clinicFromElement(element, latitude, longitude)).filter(Boolean)
        .sort((first, second) => first.distanceKm - second.distanceKm)
        .filter((clinic, index, clinics) => clinics.findIndex(item => item.name === clinic.name && item.latitude === clinic.latitude) === index);
}

async function searchWithExpansion(latitude, longitude, radius) {
    let clinics = await searchClinics(latitude, longitude, radius);
    let expanded = false;
    if (!clinics.length && radius < MAX_RADIUS_METERS) {
        clinics = await searchClinics(latitude, longitude, MAX_RADIUS_METERS);
        expanded = true;
    }
    return { clinics, searchedRadius: expanded ? MAX_RADIUS_METERS : radius, expanded };
}

function getRecommendationCategories(history, medications) {
    const text = [history.health_condition, history.allergies, history.medical_history, history.current_medications, ...(medications || []).map(item => `${item.medication_name} ${item.notes || ""}`)].filter(Boolean).join(" ").toLowerCase();
    const categories = [];
    if (/skin|dermat|itch|rash|allerg/.test(text)) categories.push("dermatology");
    if (/dental|tooth|teeth|gum/.test(text)) categories.push("dental");
    if (/orthop|fracture|injur|arthritis|joint|bone|surgery/.test(text)) categories.push("orthopedic");
    if (/eye|ocular|ophthalm/.test(text)) categories.push("ophthalmology");
    if (/emergency|urgent|trauma/.test(text)) categories.push("emergency");
    if (!categories.length) categories.push("general");
    return categories;
}

function rankClinics(clinics, categories) {
    return clinics.map(clinic => {
        const matchingCategory = categories.find(category => clinic.services.join(" ").toLowerCase().includes(category === "general" ? "general" : category));
        const specialtyPoints = matchingCategory && matchingCategory !== "general" ? 55 : clinic.services.includes("General veterinary care") ? 28 : 0;
        const emergencyPoints = categories.includes("emergency") && clinic.emergency ? 20 : 0;
        const distancePoints = Math.max(0, 25 - clinic.distanceKm * 2.5);
        const score = Math.round(specialtyPoints + emergencyPoints + distancePoints);
        const reason = matchingCategory && matchingCategory !== "general"
            ? `Recommended because this clinic lists ${matchingCategory} care relevant to your pet's history.`
            : "Recommended for accessible general veterinary care near your location.";
        return { ...clinic, relevanceScore: score, recommendationReason: reason };
    }).sort((first, second) => second.relevanceScore - first.relevanceScore || first.distanceKm - second.distanceKm);
}

router.get("/nearby", async (req, res) => {
    const ownerId = Number(req.query.user_id);
    const requestedRadius = Number(req.query.radius || DEFAULT_RADIUS_METERS);
    if (!Number.isInteger(ownerId) || ownerId < 1) return res.status(400).json({ error: "A valid logged-in owner ID is required" });
    if (!Number.isFinite(requestedRadius) || requestedRadius < 500 || requestedRadius > MAX_RADIUS_METERS) return res.status(400).json({ error: "Radius must be between 500 and 20000 meters" });

    resolveOwnerLocation(ownerId, async (ownerError, owner) => {
        if (ownerError) return res.status(ownerError.status || 500).json({ error: ownerError.message, code: ownerError.code });
        try {
            const result = await searchWithExpansion(owner.latitude, owner.longitude, requestedRadius);
            res.status(200).json({ latitude: owner.latitude, longitude: owner.longitude, address_label: owner.address_label || owner.location, radius: result.searchedRadius, expandedRadius: result.expanded, source: "OpenStreetMap Overpass", clinics: result.clinics });
        } catch (error) {
            console.error("Veterinary clinic search failed:", error.stack || error.message);
            res.status(502).json({ error: `Clinic provider unavailable: ${error.message}` });
        }
    });
});

router.get("/recommendations/:petId", async (req, res) => {
    const ownerId = Number(req.query.user_id);
    const radius = Number(req.query.radius || DEFAULT_RADIUS_METERS);
    if (!Number.isFinite(radius) || radius < 500 || radius > MAX_RADIUS_METERS) return res.status(400).json({ error: "Radius must be between 500 and 20000 meters" });
    if (!Number.isInteger(ownerId) || ownerId < 1) return res.status(400).json({ error: "A valid logged-in owner ID is required" });

    db.get("SELECT * FROM pets WHERE id = ?", [req.params.petId], async (petError, pet) => {
        if (petError) return res.status(500).json({ error: "Failed to fetch pet" });
        if (!pet) return res.status(404).json({ error: "Pet not found" });
        resolveOwnerLocation(ownerId, (ownerError, owner) => {
            if (ownerError) return res.status(ownerError.status || 500).json({ error: ownerError.message, code: ownerError.code });
            db.all("SELECT medication_name, dosage, frequency, notes FROM medications WHERE pet_id = ? ORDER BY id DESC", [req.params.petId], async (medicationError, medications) => {
            if (medicationError) return res.status(500).json({ error: "Failed to fetch medical history" });
            try {
                const categories = getRecommendationCategories(pet, medications);
                const result = await searchWithExpansion(owner.latitude, owner.longitude, radius);
                res.status(200).json({ owner_location: owner, searchedRadius: result.searchedRadius, expandedRadius: result.expanded, pet: { id: pet.id, name: pet.name, age: pet.age, breed: pet.breed, species: pet.species, health_condition: pet.health_condition, allergies: pet.allergies, medical_history: pet.medical_history, vaccination_status: pet.vaccination_status }, categories, clinics: rankClinics(result.clinics, categories) });
            } catch (error) {
                console.error("Veterinary recommendation search failed:", error.stack || error.message);
                res.status(502).json({ error: `Clinic provider unavailable: ${error.message}` });
            }
            });
        });
    });
});

module.exports = router;