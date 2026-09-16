// Mapping file for recommended product categories based on species, breed, age, and supply types
module.exports = {
    // Default suggestions by species
    speciesDefaults: {
        dog: [
            { category: "Premium Adult Dog Food", notes: "Nutritious balanced dry kibble for daily energy." },
            { category: "Durable Chew Toys", notes: "Keeps teeth clean and helps reduce boredom." },
            { category: "Pet Grooming Brush", notes: "Maintains healthy coat and removes shedding hair." }
        ],
        cat: [
            { category: "Premium Cat Litter", notes: "Odour-controlling, high-clumping litter." },
            { category: "Cat Scratching Post", notes: "Helps trim claws and save your furniture." },
            { category: "Hairball Control Treats", notes: "Supports digestive health and reduces hairballs." }
        ],
        other: [
            { category: "Multivitamin Supplements", notes: "Provides general wellness and nutritional support." },
            { category: "Cozy Pet Bedding", notes: "Soft comfort padding for deep rest for pets." }
        ]
    },

    // Breed specific additions
    breedSuggestions: {
        "labrador": [
            { category: "Joint Supplements (Glucosamine)", notes: "Essential hip and joint support for large active breeds." },
            { category: "Tough Rubber Fetch Toy", notes: "Stands up to powerful chewers and high retrieve drive." }
        ],
        "german shepherd": [
            { category: "High-Activity Training Treats", notes: "Highly palatable rewards for active mental working sessions." },
            { category: "Joint Care Formula", notes: "Maintains strong hips and mobility." }
        ],
        "golden retriever": [
            { category: "Deshedding Slicker Brush", notes: "Removes loose undercoat and prevents mats in long fur." },
            { category: "Joint Support Soft Chews", notes: "Keeps joints agile and healthy." }
        ],
        "persian": [
            { category: "Long-Hair Coat Grooming Comb", notes: "Specially designed for long dense coats to prevent tangles." },
            { category: "Anti-Hairball Wet Food", notes: "Eases digestion of swallowed long fur." }
        ],
        "siamese": [
            { category: "Interactive Feeder Toy", notes: "Stimulates highly intelligent and active Siamese minds." },
            { category: "Cozy Heated Pet Bed", notes: "Siamese cats love warm resting spots." }
        ]
    },

    // Age specific additions
    ageSuggestions: {
        puppyOrKitten: [ // age <= 1
            { category: "High-Protein Puppy/Kitten Chow", notes: "Supports rapid growth phase and bone development." },
            { category: "Soothing Teething Gel/Toy", notes: "Relieves gum irritation during tooth growth." }
        ],
        senior: [ // age >= 8
            { category: "Orthopedic Memory Foam Bed", notes: "Alleviates pressure points and supports aging joints." },
            { category: "Senior Mobility Supplements", notes: "Boosts joint health and general senior vitality." }
        ]
    },

    // Supply type reorder suggestions
    supplySuggestions: {
        "Food": "Premium Pet Food Kibble",
        "Medicine": "Pet Wellness Health Supplements",
        "Toys": "Interactive Toy Range",
        "Accessories": "Comfort Collars & Leashes",
        "Other": "General Pet Accessories"
    }
};
