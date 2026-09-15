const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");
const productSuggestions = require("../data/productSuggestions");

// Helper to build Amazon search URL
function getAmazonSearchUrl(category, species) {
    const query = `${species} ${category}`.trim();
    return `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
}

// Helper to build Flipkart search URL
function getFlipkartSearchUrl(category, species) {
    const query = `${species} ${category}`.trim();
    return `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
}

// GET /api/products/suggestions?pet_id=
router.get("/suggestions", authMiddleware, (req, res) => {
    const { pet_id } = req.query;
    if (!pet_id) {
        return res.status(400).json({ error: "pet_id query parameter is required" });
    }

    // Verify pet existence and ownership
    db.get("SELECT id, user_id, name, species, breed, age FROM pets WHERE id = ?", [pet_id], (err, pet) => {
        if (err) {
            console.error("Failed to query pet details:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!pet) {
            return res.status(404).json({ error: "Pet not found" });
        }
        if (String(pet.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const speciesNormalized = pet.species ? pet.species.toLowerCase().trim() : "other";
        const breedNormalized = pet.breed ? pet.breed.toLowerCase().trim() : "";
        const age = parseInt(pet.age, 10) || 0;

        let suggestions = [];

        // 1. Species default suggestions
        const defaults = productSuggestions.speciesDefaults[speciesNormalized] || productSuggestions.speciesDefaults.other;
        suggestions.push(...defaults);

        // 2. Breed specific additions
        if (breedNormalized && productSuggestions.breedSuggestions[breedNormalized]) {
            suggestions.push(...productSuggestions.breedSuggestions[breedNormalized]);
        }

        // 3. Age specific additions
        if (age <= 1) {
            suggestions.push(...productSuggestions.ageSuggestions.puppyOrKitten);
        } else if (age >= 8) {
            suggestions.push(...productSuggestions.ageSuggestions.senior);
        }

        // De-duplicate suggestions based on category
        const seen = new Set();
        const uniqueSuggestions = suggestions.filter(item => {
            const k = item.category.toLowerCase();
            return seen.has(k) ? false : seen.add(k);
        });

        // 4. Map to output structure, including search URLs
        const responseData = uniqueSuggestions.map(item => ({
            category: item.category,
            notes: item.notes,
            amazonUrl: getAmazonSearchUrl(item.category, pet.species || "pet"),
            flipkartUrl: getFlipkartSearchUrl(item.category, pet.species || "pet")
        }));

        res.json({
            pet_id: pet.id,
            pet_name: pet.name,
            suggestions: responseData
        });
    });
});

module.exports = router;
