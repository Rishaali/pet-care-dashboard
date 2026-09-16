/**
 * PETZI ASSISTANT - Pure Client-Side Intelligent Pet Care Bot
 * 
 * Features:
 * - Domain-restricted: Answers ONLY pet and pet-care related inquiries
 * - Responds to non-pet queries with the exact required disclaimer
 * - Typo-tolerant, fuzzy matching, and intent recognition
 * - Isolated DOM & Styles, non-intrusive to any page logic
 */

(function () {
    'use strict';

    // Prevent duplicate initialization if script loaded multiple times
    if (window.__PetziAssistantInitialized) return;
    window.__PetziAssistantInitialized = true;

    /* ==========================================================================
       1. PET CARE Q&A KNOWLEDGE BASE & INTENTS (ALL SPECIES)
       ========================================================================== */
    const PET_QA_DATASET = [
        {
            id: 'cat_sleeping_habits',
            intent: 'cat_sleep',
            keywords: ['cat', 'cats', 'kitten', 'kittens', 'sleep', 'sleeping', 'sleeps', 'lazy', 'tired', 'lethargic', 'nap', 'napping', 'why cat sleep', 'always sleeping'],
            matchPatterns: [
                /cat.*(sleep|sleeping|sleeps|lazy|tired|lethargic|nap|always sleeping)/i,
                /why (does|is) (my )?cat (sleep|always sleeping|so lazy|tired)/i,
                /how much (does|do) (a )?cat (sleep|nap)/i
            ],
            answer: `**Why Cats Sleep So Much & When to Concern:**\n\n` +
                    `• **Normal Feline Sleep (12–16 Hours Daily):** Cats are natural predators hardwired to conserve energy for hunting. It is completely normal for healthy adult cats to sleep 12 to 16 hours a day, while kittens and seniors can sleep up to 20 hours!\n` +
                    `• **Active at Dawn & Dusk:** Cats are crepuscular, meaning they snooze during the day when humans are awake and become active early morning or evening.\n` +
                    `• **Normal Sleep vs. Lethargy:**\n` +
                    `  - **Normal:** Your cat wakes up easily for meals, plays, grooms, and interacts normally.\n` +
                    `  - **Lethargy (Seek a Vet):** Your cat refuses food, hides in dark corners, won't react to toys, has pale gums, or shows signs of fever/pain.\n` +
                    `• **Enrichment:** Provide scratching posts, window perches, and interactive toys during awake hours.`
        },
        {
            id: 'dog_licking_paws_allergies',
            intent: 'dog_paws',
            keywords: ['dog', 'dogs', 'puppy', 'puppies', 'lick', 'licking', 'paw', 'paws', 'itch', 'itchy', 'scratching', 'chewing paws'],
            matchPatterns: [
                /dog.*(lick|licking|chewing|itchy).*(paw|paws)/i,
                /why (is|does) (my )?dog (licking|chewing) (his|her|its)? (paw|paws)/i
            ],
            answer: `**Why Dogs Lick Their Paws & How to Help:**\n\n` +
                    `• **Environmental Allergies (Most Common):** Pollen, grass, dust mites, or lawn chemicals cause itchy paws. Wipe paws with a damp cloth after walks.\n` +
                    `• **Food Sensitivities:** Protein allergies (chicken/beef) trigger itchy paws and ear inflammation.\n` +
                    `• **Boredom or Anxiety:** Repetitive paw licking acts as a self-soothing habit.\n` +
                    `• **Paw Infection:** Redness or a corn-chip odor between toes indicates a yeast/bacterial infection requiring vet treatment.`
        },
        {
            id: 'fish_floating_surface',
            intent: 'fish_floating',
            keywords: ['fish', 'fishes', 'goldfish', 'betta', 'float', 'floating', 'top', 'surface', 'gasping', 'swim bladder', 'upside down'],
            matchPatterns: [
                /fish.*(float|floating|surface|top|upside down)/i,
                /why (is|are) (my )?fish (floating|gasping|swimming upside down)/i
            ],
            answer: `**Why Fish Float Near the Water Surface:**\n\n` +
                    `• **Low Oxygen Levels:** Gasping at the surface indicates low dissolved oxygen. Increase filter aeration or add an air stone.\n` +
                    `• **Ammonia / Nitrite Spike:** High toxic waste burns gills. Perform an immediate 25-30% water change with dechlorinated water.\n` +
                    `• **Swim Bladder Disorder:** Floating upside down or struggling to submerge is caused by gulping air or dry flake constipation. Fast fish for 24 hours, then feed a cooked peeled green pea.`
        },
        {
            id: 'bird_diet_care',
            intent: 'bird_care',
            keywords: ['bird', 'birds', 'parrot', 'parrots', 'canary', 'canaries', 'budgie', 'budgies', 'cockatiel', 'cockatiels', 'finch', 'finches', 'feather', 'feathers', 'cage', 'cages', 'perch', 'perches', 'seed', 'seeds', 'pellet', 'pellets', 'singing', 'beak', 'avocado', 'teflon'],
            matchPatterns: [
                /bird|parrot|canary|budgie|cockatiel|finch|feather|beak|cage/i
            ],
            answer: `**Bird Care, Diet & Housing Guide:**\n\n` +
                    `• **Nutrition:** 60-70% high-quality formulated bird pellets, 20-30% fresh veggies (spinach, carrots, broccoli), and small portions of safe fruits (apples without seeds, berries). Limit seeds to occasional treats to prevent fatty liver disease.\n` +
                    `• **Toxic for Birds:** Avocado (fatal!), chocolate, caffeine, fruit seeds/pits, onions, garlic, and fumes from overheated Teflon/PTFE non-stick cookware (fatal to bird lungs!).\n` +
                    `• **Housing:** Provide the largest flight cage possible with non-toxic natural perches of varied thickness to keep feet healthy.\n` +
                    `• **Hygiene:** Replace cage lining daily, clean water/food bowls daily, and offer misting/shallow bath water.\n` +
                    `• **Signs of Illness:** Fluffed feathers, sitting on cage bottom, tail bobbing while breathing, change in droppings, or discharge from nostrils.`
        },
        {
            id: 'fish_aquarium_care',
            intent: 'fish_care',
            keywords: ['fish', 'fishes', 'aquarium', 'aquariums', 'tank', 'tanks', 'goldfish', 'betta', 'bettas', 'tetra', 'tetras', 'water', 'filter', 'filters', 'flakes', 'pellets', 'swim', 'swimming', 'fin', 'fins', 'bubbles', 'water change'],
            matchPatterns: [
                /fish|goldfish|betta|tetra|aquarium|fish tank|water change|fin rot|swim bladder/i
            ],
            answer: `**Fish & Aquarium Care Guide:**\n\n` +
                    `• **Feeding:** Feed species-specific flakes or pellets 1-2 times daily. Only feed what your fish can consume completely in 2 to 3 minutes to avoid polluting the water.\n` +
                    `• **Water Maintenance:** Perform 20-30% partial water changes weekly using water treated with tap water conditioner/dechlorinator.\n` +
                    `• **Filter & Nitrogen Cycle:** Clean filter media in removed tank water (never tap water) to protect beneficial filter bacteria. Keep Ammonia = 0 ppm, Nitrite = 0 ppm, Nitrates < 20 ppm.\n` +
                    `• **Betta vs Goldfish:** Bettas need warm tropical water (78-80°F) and low water flow. Goldfish require large tanks (20+ gallons per fish) and cooler water.\n` +
                    `• **Illness Signs:** Swimming upside down or floating (swim bladder constipation), white salt-like spots (Ich parasite), or ragged/frayed fins (fin rot).`
        },
        {
            id: 'rabbit_bunny_care',
            intent: 'rabbit_care',
            keywords: ['rabbit', 'rabbits', 'bunny', 'bunnies', 'hare', 'hares', 'hay', 'timothy', 'pellets', 'greens', 'litter', 'chew', 'chewing', 'teeth', 'gi stasis', 'poop', 'pooping'],
            matchPatterns: [
                /rabbit|bunny|bunnies|hare|timothy hay|gi stasis/i
            ],
            answer: `**Rabbit & Bunny Care & Diet Guide:**\n\n` +
                    `• **Core Diet (80-90%):** Unlimited fresh Timothy or meadow hay is critical for rabbit digestion and wearing down continuously growing teeth.\n` +
                    `• **Fresh Greens:** Offer daily fresh dark leafy greens (romaine lettuce, cilantro, parsley, carrot tops). Avoid iceberg lettuce.\n` +
                    `• **Pellets & Water:** High-fiber plain rabbit pellets (approx. 1/4 cup per 5 lbs body weight) and constant fresh water in a heavy ceramic bowl.\n` +
                    `• **Housing & Toys:** Bunny-proof electrical cords! Provide large exercise pens, paper-bedding litter boxes, and cardboard/wood chew toys.\n` +
                    `• **🚨 GI STASIS EMERGENCY:** If a rabbit stops eating or pooping for >12 hours, it is a life-threatening GI stasis emergency requiring immediate veterinary intervention!`
        },
        {
            id: 'hamster_small_rodent_care',
            intent: 'hamster_care',
            keywords: ['hamster', 'hamsters', 'guinea', 'guinea pig', 'pig', 'mouse', 'rat', 'gerbil', 'wheel', 'bedding', 'burrow', 'rodent', 'wet tail', 'cage'],
            matchPatterns: [
                /hamster|guinea pig|gerbil|mouse|rat|rodent|wet tail/i
            ],
            answer: `**Hamster & Small Pet Care Guide:**\n\n` +
                    `• **Diet:** High-quality commercial seed and pellet mix supplemented with small treats of fresh cucumber, broccoli, or apple. Always provide fresh water in a gravity bottle.\n` +
                    `• **Housing:** Minimum 450+ sq inches of continuous floor space with 6+ inches of deep paper bedding for burrowing.\n` +
                    `• **Exercise Wheel:** Provide a large, solid-surface running wheel (no wire/mesh rungs to prevent broken limbs).\n` +
                    `• **Behavior:** Hamsters are nocturnal and solitary (keep Syrian hamsters alone in their cage).\n` +
                    `• **Wet Tail Warning:** Diarrhea and lethargy in hamsters ("wet tail") is severe and fatal if not treated quickly by a vet.`
        },
        {
            id: 'turtle_reptile_care',
            intent: 'reptile_care',
            keywords: ['turtle', 'turtles', 'tortoise', 'tortoises', 'lizard', 'lizards', 'gecko', 'geckos', 'bearded dragon', 'snake', 'snakes', 'reptile', 'reptiles', 'uvb', 'basking', 'heat lamp'],
            matchPatterns: [
                /turtle|tortoise|lizard|gecko|reptile|uvb|basking/i
            ],
            answer: `**Turtle & Reptile Care Essentials:**\n\n` +
                    `• **UVB Lighting & Heating:** Essential for calcium absorption and metabolic bone disease prevention. Replace UVB bulbs every 6-12 months.\n` +
                    `• **Basking Gradient:** Maintain a warm basking area and cooler side in the terrarium.\n` +
                    `• **Diet:** Aquatic turtles need aquatic turtle pellets, leafy greens, and feeder insects. Tortoises need high-fiber grasses and greens.\n` +
                    `• **Water Quality:** Turtles produce heavy waste; use powerful filtration and change 50% water weekly.`
        },
        {
            id: 'toxic_foods',
            intent: 'toxic_foods',
            keywords: ['toxic', 'toxik', 'poison', 'poisonous', 'harmful', 'bad', 'dangerous', 'cannot', 'cant', 'eat', 'chocolate', 'grape', 'grapes', 'raisin', 'raisins', 'onion', 'onions', 'garlic', 'xylitol', 'avocado', 'caffeine', 'alcohol', 'macadamia'],
            matchPatterns: [
                /what (foods|things|items)?\s*(are|r)?\s*(toxic|toxik|poisonous|bad|dangerous|harmful)/i,
                /can (dogs|cats|pets|dgs) eat (chocolate|grapes|raisins|onions|garlic|avocado|xylitol)/i,
                /is (chocolate|grape|raisin|onion|garlic|avocado|xylitol) (toxic|toxik|bad|dangerous|harmful|poisonous|safe)/i,
                /(dog|cat|pet|dg) ate (chocolate|grapes|raisin|onion|garlic)/i
            ],
            answer: `**Toxic & Dangerous Foods for Pets:**\n\n` +
                    `• **Chocolate & Caffeine:** Contains theobromine and caffeine which cause heart and nervous system toxicity.\n` +
                    `• **Grapes & Raisins:** Can trigger acute kidney failure even in tiny amounts.\n` +
                    `• **Onions, Garlic, Leeks & Chives:** Cause damage to red blood cells resulting in anemia.\n` +
                    `• **Xylitol (Artificial Sweetener):** Found in sugar-free gum, candy, and peanut butter. Causes rapid hypoglycemia and liver failure.\n` +
                    `• **Avocado (for Birds/Rabbits):** Extremely toxic to birds, rabbits, and small animals.\n` +
                    `• **Cooked Bones:** Can splinter and puncture stomach or intestines.\n` +
                    `*If your pet ingested any of these, contact an emergency vet immediately.*`
        },
        {
            id: 'safe_human_foods',
            intent: 'safe_foods',
            keywords: ['safe', 'human', 'food', 'foods', 'snacks', 'treats', 'healthy', 'chicken', 'carrot', 'carrots', 'apple', 'apples', 'rice', 'pumpkin', 'banana', 'bananas', 'egg', 'eggs'],
            matchPatterns: [
                /what (human )?foods are safe for (dogs|cats|pets)/i,
                /can (dogs|cats|pets) eat (carrots|apples|chicken|rice|pumpkin|eggs|bananas)/i,
                /healthy (treats|snacks) for (dogs|cats|pets)/i
            ],
            answer: `**Safe & Healthy Human Foods for Pets (in moderation):**\n\n` +
                    `• **Plain Boiled Chicken/Turkey:** Excellent lean protein for dogs and cats (boneless, unseasoned).\n` +
                    `• **Carrots:** Great low-calorie crunch rich in vitamin A for dogs and rabbits.\n` +
                    `• **Apples (without seeds/core):** Rich in vitamins A and C for dogs, rabbits, and birds.\n` +
                    `• **Plain Canned Pumpkin:** Excellent for digestion during mild diarrhea or constipation.\n` +
                    `• **Plain Cooked White Rice:** Gentle on an upset stomach.\n` +
                    `• **Plain Cooked Eggs:** High in protein and essential fatty acids.\n\n` +
                    `*Treats should make up no more than 10% of your pet's daily caloric intake.*`
        },
        {
            id: 'dog_feeding_routine',
            intent: 'feeding_routine',
            keywords: ['feed', 'feeding', 'food', 'how often', 'how much', 'diet', 'kibble', 'meal', 'meals', 'portion', 'schedule', 'puppy', 'adult', 'dog', 'dogs'],
            matchPatterns: [
                /how (often|much) should i feed my (dog|puppy)/i,
                /(dog|puppy) (feeding|meal) (schedule|routine|portion)/i,
                /when to feed (dog|puppy)/i
            ],
            answer: `**Dog & Puppy Feeding Guidelines:**\n\n` +
                    `• **Puppies (8-12 weeks):** 3 to 4 meals per day of puppy-formulated kibble.\n` +
                    `• **Puppies (3-6 months):** 3 meals per day.\n` +
                    `• **Adult Dogs (6+ months):** 2 balanced meals per day (morning and evening).\n` +
                    `• **Portions:** Always follow guidelines on high-quality pet food packaging based on your dog's ideal weight and activity level.\n` +
                    `• **Consistency:** Feed at regular scheduled times each day to assist digestion and potty routines.`
        },
        {
            id: 'cat_feeding_routine',
            intent: 'cat_feeding',
            keywords: ['feed', 'feeding', 'cat', 'cats', 'kitten', 'kittens', 'wet', 'dry', 'kibble', 'how often', 'diet', 'meal', 'meals'],
            matchPatterns: [
                /how (often|much) should i feed my (cat|kitten)/i,
                /(cat|kitten) (feeding|meal) (schedule|routine)/i,
                /wet (vs|or) dry (cat )?food/i
            ],
            answer: `**Cat & Kitten Feeding Guidelines:**\n\n` +
                    `• **Kittens (under 6 months):** 3 to 4 meals per day of nutrient-rich kitten formula.\n` +
                    `• **Adult Cats:** 2 meals per day (or measured portions if using puzzle feeders).\n` +
                    `• **Wet vs Dry Food:** Wet food provides vital hydration for cats and supports kidney health. A combination of wet food and measured dry kibble works best for most cats.\n` +
                    `• **Clean Water:** Always ensure fresh water is available.`
        },
        {
            id: 'hydration_water',
            intent: 'hydration',
            keywords: ['water', 'drink', 'drinking', 'hydration', 'dehydration', 'thirsty', 'how much water'],
            matchPatterns: [
                /how much water (should|does) (my )?(dog|cat|pet) (drink|need)/i,
                /is my (dog|cat|pet) (drinking enough|dehydrated)/i,
                /signs of dehydration in (dogs|cats|pets)/i
            ],
            answer: `**Pet Hydration & Daily Water Needs:**\n\n` +
                    `• **Dogs:** Typically need approximately 50 to 60 ml of water per kg of body weight daily.\n` +
                    `• **Cats:** Need approximately 40 to 50 ml per kg daily.\n` +
                    `• **Birds & Small Pets:** Require fresh, clean water daily in clean bowls or bottles.\n` +
                    `• **Dehydration Test:** Gently lift the skin over your pet's shoulder blades. If it snaps back immediately, they are hydrated; if it returns slowly, they may be dehydrated.\n` +
                    `*Always provide clean, fresh water daily.*`
        },
        {
            id: 'dog_walking_exercise',
            intent: 'exercise',
            keywords: ['walk', 'walks', 'walking', 'exercise', 'play', 'energy', 'how long', 'how often walk'],
            matchPatterns: [
                /how (often|long) (should|do) i walk my dog/i,
                /dog (walking|exercise) (needs|routine|duration)/i,
                /how much exercise (does|for) a (dog|puppy) (need)?/i
            ],
            answer: `**Dog Walking & Daily Exercise Needs:**\n\n` +
                    `• **Adult Dogs:** Most dogs require 30 to 60 minutes of exercise daily, split into 1-2 walks plus playtime.\n` +
                    `• **High Energy Breeds:** Require 60 to 90+ minutes including mental stimulation (fetch, sniff walks, agility).\n` +
                    `• **Puppies (5-minute rule):** Roughly 5 minutes of structured walking per month of age, twice a day, to protect growing joints.\n` +
                    `• **Weather Safety:** Check pavement heat with your hand during summer to prevent paw burns.`
        },
        {
            id: 'bathing_grooming',
            intent: 'grooming',
            keywords: ['bathe', 'bath', 'bathing', 'groom', 'grooming', 'wash', 'brush', 'brushing', 'nails', 'nail trim', 'shedding'],
            matchPatterns: [
                /how (often|frequently) (should|do) i (bathe|wash) my (dog|cat|pet)/i,
                /(dog|cat|pet) (grooming|bathing|brushing|nail trimming) (tips|frequency)/i,
                /how to (trim|clip) pet nails/i
            ],
            answer: `**Bathing & Grooming Recommendations:**\n\n` +
                    `• **Dogs:** Bathing once every 4 to 8 weeks is usually ideal. Over-bathing can strip natural skin oils. Always use pet-formulated shampoo.\n` +
                    `• **Cats:** Cats self-groom efficiently and rarely need full baths unless dirty or medically required.\n` +
                    `• **Birds:** Provide shallow water bath bowls or gentle misting with room-temperature water.\n` +
                    `• **Brushing:** Brushing 2-3 times a week minimizes shedding and prevents mats.`
        },
        {
            id: 'vaccinations_routine',
            intent: 'vaccinations',
            keywords: ['vaccine', 'vaccines', 'vaccination', 'shots', 'rabies', 'dhpp', 'fvrcp', 'immunization', 'booster'],
            matchPatterns: [
                /what (vaccines|shots) does my (dog|puppy|cat|kitten|pet) need/i,
                /(dog|cat|pet) (vaccine|vaccination) (schedule|list)/i,
                /when to (vaccinate|get shots)/i
            ],
            answer: `**Essential Pet Vaccination Schedule:**\n\n` +
                    `**Dogs:**\n` +
                    `• Core Vaccines: Rabies and DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza) starting at 6-8 weeks.\n` +
                    `• Non-Core: Bordetella, Leptospirosis, Lyme based on lifestyle.\n\n` +
                    `**Cats:**\n` +
                    `• Core Vaccines: Rabies and FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia).\n` +
                    `• Non-Core: FeLV (Feline Leukemia Virus).\n\n` +
                    `*Consult your veterinarian to maintain an up-to-date immunization schedule.*`
        },
        {
            id: 'fleas_ticks_deworming',
            intent: 'parasites',
            keywords: ['flea', 'fleas', 'tick', 'ticks', 'worm', 'worms', 'deworm', 'deworming', 'parasite', 'scratching', 'itchy'],
            matchPatterns: [
                /how to (prevent|treat|get rid of) (fleas|ticks|worms)/i,
                /(flea|tick|deworming) (treatment|prevention|schedule)/i,
                /why is my (dog|cat|pet) (scratching|itching) so much/i
            ],
            answer: `**Flea, Tick & Worm Prevention:**\n\n` +
                    `• **Year-Round Prevention:** Use vet-approved monthly topical spot-on or oral treatments.\n` +
                    `• **Symptoms of Fleas/Ticks:** Intense scratching, biting near tail base, hair loss, or tiny black specks in coat.\n` +
                    `• **Deworming:** Puppies and kittens require regular deworming starting at 2-3 weeks of age. Adults should be checked or dewormed periodically.\n` +
                    `• **Safety Note:** Never use dog flea medication on cats or small animals as certain ingredients are fatal.`
        },
        {
            id: 'vomiting_diarrhea_illness',
            intent: 'sickness',
            keywords: ['vomit', 'vomiting', 'throw up', 'diarrhea', 'loose stool', 'sick', 'lethargic', 'fever', 'coughing', 'appetite', 'not eating', 'poop'],
            matchPatterns: [
                /my (dog|cat|pet) is (vomiting|throwing up|having diarrhea|sick|not eating|lethargic)/i,
                /what to do if (dog|cat|pet) (vomits|has diarrhea)/i,
                /signs of (illness|sickness) in (dogs|cats|pets)/i
            ],
            answer: `**Pet Illness & Sickness Care:**\n\n` +
                    `• **Mild cases (Dogs/Cats):** Rest the stomach for a few hours, then offer a bland diet of plain boiled chicken and white rice in small portions. Ensure fresh water is accessible.\n\n` +
                    `**Emergency Signs (See a Vet Immediately):**\n` +
                    `• Repeated vomiting or inability to retain water.\n` +
                    `• Blood in vomit or dark bloody stool.\n` +
                    `• Extreme lethargy, collapse, pale gums, or distended abdomen.\n` +
                    `• Rabbit/small animal not eating or pooping for >12 hours (GI stasis emergency).\n` +
                    `• Suspected toxic ingestion or foreign object swallowed.`
        },
        {
            id: 'medication_tips',
            intent: 'medication',
            keywords: ['medication', 'medicine', 'pill', 'pills', 'tablet', 'antibiotic', 'give pill', 'dose', 'reminder'],
            matchPatterns: [
                /how to give (a )?(dog|cat|pet) (a )?(pill|medicine|medication|tablet)/i,
                /pet (medication|medicine) (reminder|schedule|tips)/i,
                /missed pet (medication|dose)/i
            ],
            answer: `**Tips for Giving Pet Medication:**\n\n` +
                    `• **Dogs:** Hide the pill inside a small dollop of peanut butter (xylitol-free), cheese, or pill pocket treats.\n` +
                    `• **Cats:** Use pill pockets, coat with tuna juice, or gently wrap in a towel using a vet-approved pill popper.\n` +
                    `• **Complete Course:** Always complete full prescribed antibiotic courses even if symptoms improve early.\n` +
                    `• **Reminders:** Track dosages and log administration on your Petzi Dashboard.`
        },
        {
            id: 'potty_training_behavior',
            intent: 'behavior',
            keywords: ['potty', 'pee', 'poop', 'housebreak', 'training', 'crate', 'barking', 'scratching', 'biting', 'chewing', 'litter box'],
            matchPatterns: [
                /how to (potty train|housebreak) a (puppy|dog)/i,
                /how to stop (barking|biting|chewing|scratching)/i,
                /cat (not using|avoiding) litter box/i
            ],
            answer: `**Pet Training & Behavior Essentials:**\n\n` +
                    `• **Puppy Potty Training:** Take puppy outside immediately after waking up, eating, drinking, or play. Reward instantly with praise when they go in the designated area.\n` +
                    `• **Cat Litter Box:** Maintain one box per cat plus one extra. Scoop daily and place in quiet areas.\n` +
                    `• **Chewing & Scratching:** Provide designated chew toys for dogs and sturdy scratching posts for cats. Redirect unwanted behavior with appropriate alternatives.\n` +
                    `• **Positive Reinforcement:** Consistency and gentle rewards yield the best long-term results.`
        },
        {
            id: 'petzi_app_features',
            intent: 'petzi_help',
            keywords: ['petzi', 'app', 'dashboard', 'feature', 'help', 'use', 'how to log', 'reminder', 'find vet', 'book appointment', 'add pet'],
            matchPatterns: [
                /what can (i do on|petzi do)/i,
                /how (do|to) (use petzi|add pet|log activity|set medication reminder|find vet|book appointment)/i,
                /petzi (features|guide|help)/i
            ],
            answer: `**Welcome to Petzi. How to use the application:**\n\n` +
                    `• **My Pets:** Add and manage detailed health profiles for your pets.\n` +
                    `• **Dashboard:** Log daily feeding, walking, and medications, and track medication reminders.\n` +
                    `• **Find a Vet:** Search certified veterinarians and clinic locations.\n` +
                    `• **Appointments:** Schedule and track upcoming vet visits.\n` +
                    `• **Petzi Assistant:** Ask any pet health, diet, routine, or care question anytime.`
        },
        {
            id: 'general_pet_greetings',
            intent: 'greeting',
            keywords: ['hi', 'hello', 'hey', 'greetings', 'morning', 'afternoon', 'evening', 'who are you', 'what are you'],
            matchPatterns: [
                /^(hi|hello|hey|greetings|good (morning|afternoon|evening)|howdy)\b/i,
                /who are you/i,
                /what (can you do|are you)/i
            ],
            answer: `Hello. I'm **Petzi Assistant**, your dedicated pet-care assistant. How can I help you with your pet's health, diet, daily routine, or care today?`
        }
    ];

    // Active Conversation Memory State
    let conversationState = {
        lastSpecies: null,   // null until species is explicitly mentioned
        lastTopic: null,
        lastIntentId: null
    };

    /**
     * Compute Levenshtein distance for typo tolerance
     */
    function levenshteinDistance(s1, s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    /**
     * Check if a token fuzzy matches a target word (allowing 1-2 typos)
     */
    function fuzzyTokenMatch(token, target) {
        if (token === target) return true;
        if (Math.abs(token.length - target.length) > 2) return false;
        const maxDist = target.length > 5 ? 2 : (target.length >= 4 ? 1 : 0);
        return levenshteinDistance(token, target) <= maxDist;
    }

    /**
     * Normalize query text
     */
    function normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extract token list from query
     */
    function tokenize(text) {
        const norm = normalizeText(text);
        if (!norm) return [];
        return norm.split(' ').filter(t => t.length > 1);
    }

    /**
     * Determine if a query is a pure follow-up question without a new topic
     */
    function isFollowUpQuery(query) {
        const q = query.toLowerCase().trim();
        // Only return true for short pure follow-up phrases that contain NO explicit topic words
        const hasTopicWord = /sleep|sleeping|food|eat|feed|diet|water|paw|paws|lick|scratch|litter|vomit|diarrhea|fish|bird|dog|cat|rabbit|hamster|swim|tank|cage/i.test(q);
        if (hasTopicWord) return false;

        const followUpPatterns = [
            /what (is|are) the (reason|reasons|cause|causes|why|benefit|benefits)/i,
            /^why\b/i,
            /tell me (more|why|how|details)/i,
            /^explain\b/i,
            /how (so|does it work|come)/i,
            /is it (safe|dangerous|good|bad)/i
        ];
        return followUpPatterns.some(pat => pat.test(q));
    }

    /**
     * Determine if the query is pet-related
     */
    function isPetRelated(query) {
        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) return false;

        if (isFollowUpQuery(cleanQuery)) {
            return true;
        }

        const tokens = tokenize(cleanQuery);
        for (const np of [
            'python', 'javascript', 'html', 'css', 'java', 'c++', 'code', 'programming', 'software',
            'capital', 'president', 'minister', 'weather', 'forecast', 'stock', 'bitcoin', 'crypto',
            'movie', 'actor', 'actress', 'song', 'lyrics', 'album', 'singer', 'cricket', 'football',
            'car', 'mechanic', 'flight', 'hotel', 'iphone', 'android', 'laptop', 'math', 'calculate',
            'translate', 'french', 'spanish', 'german', 'philosophy', 'politics', 'election', 'recipe', 'pizza'
        ]) {
            if (cleanQuery.includes(np)) {
                const hasPetAnchor = tokens.some(t => ['pet', 'pets', 'dog', 'dogs', 'cat', 'cats', 'bird', 'birds', 'fish', 'rabbit', 'hamster', 'puppy', 'kitten'].includes(t));
                if (!hasPetAnchor) return false;
            }
        }

        for (const item of PET_QA_DATASET) {
            for (const pat of item.matchPatterns) {
                if (pat.test(cleanQuery)) return true;
            }
        }

        if (tokens.length === 0) return false;
        return true;
    }

    /**
     * Species-Aware & Topic-Aware Dynamic Synthesizer
     */
    function generateSpeciesSpecificResponse(query) {
        const q = query.toLowerCase().trim();

        // 1. Detect target species
        let species = conversationState.lastSpecies || 'dog';
        if (q.includes('cat') || q.includes('kitten') || q.includes('kitty') || q.includes('feline')) species = 'cat';
        else if (q.includes('dog') || q.includes('puppy') || q.includes('pup') || q.includes('canine')) species = 'dog';
        else if (q.includes('bird') || q.includes('parrot') || q.includes('canary') || q.includes('budgie') || q.includes('cockatiel') || q.includes('finch')) species = 'bird';
        else if (q.includes('chicken') || q.includes('hen') || q.includes('rooster')) species = 'chicken';
        else if (q.includes('fish') || q.includes('goldfish') || q.includes('betta') || q.includes('aquarium') || q.includes('tank')) species = 'fish';
        else if (q.includes('cow') || q.includes('bovine') || q.includes('cattle')) species = 'cow';
        else if (q.includes('goat') || q.includes('caprine') || q.includes('kid')) species = 'goat';
        else if (q.includes('turtle') || q.includes('tortoise') || q.includes('lizard') || q.includes('reptile')) species = 'reptile';

        conversationState.lastSpecies = species;

        // 2. CAT TOPICS
        if (species === 'cat') {
            if (q.includes('sleep') || q.includes('sleeping') || q.includes('lazy') || q.includes('tired') || q.includes('lethargic') || q.includes('nap')) {
                return `**Why Cats Sleep So Much & When to Concern:**\n\n` +
                       `• **Normal Feline Sleep (12–16 Hours Daily):** Cats are crepuscular predators hardwired to conserve energy. Healthy adult cats sleep 12 to 16 hours a day, while kittens and seniors sleep up to 20 hours!\n` +
                       `• **Active at Dawn & Dusk:** Cats snooze during the day when humans are awake and become active early morning or evening.\n` +
                       `• **Normal Sleep vs. Lethargy:**\n` +
                       `  - **Normal:** Wakes up easily for food, plays, grooms, and interacts.\n` +
                       `  - **Lethargy (Seek a Vet):** Refuses food, hides in dark corners, won't react to toys, has pale gums, or fever.\n` +
                       `• **Tip:** Provide scratching posts, window perches, and interactive toys during awake hours.`;
            }
            if (q.includes('meow') || q.includes('crying') || q.includes('yelling') || q.includes('vocal')) {
                return `**Why Cats Meow & Vocalize:**\n\n` +
                       `• **Communication:** Adult cats meow to communicate with humans for food, affection, or opening doors.\n` +
                       `• **Stress/Pain:** Sudden excessive meowing can signal urinary discomfort, pain, or anxiety.\n` +
                       `• **Senior Cats:** Elderly cats may vocalize at night due to disorientation.`;
            }
            if (q.includes('scratch') || q.includes('bite') || q.includes('biting') || q.includes('claw')) {
                return `**Cat Scratching & Biting Behavior:**\n\n` +
                       `• **Scratching Need:** Essential for shedding claw sheaths and marking territory with paw scent glands.\n` +
                       `• **Solution:** Place sturdy sisal/cardboard scratching posts near furniture and reward usage.`;
            }
            if (q.includes('litter') || q.includes('pee') || q.includes('poop')) {
                return `**Cat Litter Box Troubleshooting:**\n\n` +
                       `• **Box Rule:** Maintain 1 box per cat plus 1 extra in quiet, easily accessible locations.\n` +
                       `• **Medical Warning:** Urinating outside the box often indicates urinary tract infections (UTIs). Consult a vet.`;
            }
            if (q.includes('eat') || q.includes('food') || q.includes('feed') || q.includes('diet') || q.includes('kibble') || q.includes('wet')) {
                return `**Cat Feeding & Nutrition Guide:**\n\n` +
                       `• **Wet Food Hydration:** Wet food provides 70-80% moisture, protecting cats against kidney disease and urinary crystals.\n` +
                       `• **High Protein:** Protein feeds lean muscle without excess carbs, preventing feline obesity and diabetes.\n` +
                       `• **Toxic:** Lilies (fatal!), onions, garlic, chocolate, caffeine, and human pain meds.`;
            }
        }

        // 3. DOG TOPICS
        if (species === 'dog') {
            if (q.includes('sleep') || q.includes('sleeping') || q.includes('lazy') || q.includes('tired') || q.includes('lethargic')) {
                return `**Dog Sleeping Habits & Lethargy:**\n\n` +
                       `• **Normal Sleep (10–14 Hours Daily):** Adult dogs sleep 10-14 hours daily; puppies and large breeds sleep up to 18 hours.\n` +
                       `• **Lethargy Signs:** If your dog refuses food, has pale gums, or resists walking, consult a vet to rule out fever or illness.`;
            }
            if (q.includes('lick') || q.includes('paw') || q.includes('paws') || q.includes('itch')) {
                return `**Why Dogs Lick Their Paws & How to Help:**\n\n` +
                       `• **Environmental Allergies:** Pollen, grass, or dust mites make paws itchy. Wipe paws with a damp cloth after outdoor walks.\n` +
                       `• **Food Sensitivities:** Protein allergies (chicken/beef) trigger itchy skin and ears.\n` +
                       `• **Infections:** Redness or corn-chip odor between toes indicates yeast/bacterial infection requiring vet treatment.`;
            }
            if (q.includes('bark') || q.includes('bite') || q.includes('chew')) {
                return `**Dog Barking & Chewing Solutions:**\n\n` +
                       `• **Boredom & Energy:** Walk 30-60 mins daily and provide Kong/puzzle chew toys.\n` +
                       `• **Training:** Use positive reinforcement; reward calm behavior and never hit or yell.`;
            }
            if (q.includes('eat') || q.includes('food') || q.includes('feed') || q.includes('diet') || q.includes('kibble')) {
                return `**Dog Feeding & Diet Guide:**\n\n` +
                       `• **Meals:** 2 balanced meals daily for adults; 3-4 meals for young puppies.\n` +
                       `• **Safe Human Treats:** Plain boiled chicken, carrots, apples (no seeds), plain pumpkin.\n` +
                       `• **Toxic:** Chocolate, grapes/raisins, onions, garlic, xylitol sweetener, macadamia nuts.`;
            }
        }

        // 4. FISH TOPICS
        if (species === 'fish') {
            if (q.includes('float') || q.includes('top') || q.includes('surface') || q.includes('upside') || q.includes('swim')) {
                return `**Why Fish Float Near the Water Surface:**\n\n` +
                       `• **Low Oxygen:** Gasping at the surface indicates low dissolved oxygen. Increase filter aeration or add an air stone.\n` +
                       `• **Ammonia / Nitrite Spike:** High toxic waste burns gills. Perform an immediate 25-30% water change.\n` +
                       `• **Swim Bladder Disorder:** Floating upside down is caused by constipation or gulping air. Fast fish for 24 hours, then feed a cooked peeled green pea.`;
            }
            if (q.includes('clean') || q.includes('water') || q.includes('tank') || q.includes('filter')) {
                return `**Fish Tank & Water Maintenance:**\n\n` +
                       `• **Weekly Water Changes:** Perform a 20-30% partial water change weekly using dechlorinated water.\n` +
                       `• **Filter Care:** Clean filter sponges in old tank water (never tap water) to preserve good bacteria.\n` +
                       `• **Parameters:** Keep Ammonia = 0 ppm, Nitrite = 0 ppm, Nitrates < 20 ppm.`;
            }
        }

        // 5. PURE FOLLOW-UP REASON EXPLANATION (When query is "what is the reason", "why", "tell me more")
        if (isFollowUpQuery(q) || q.includes('reason')) {
            const s = species || conversationState.lastSpecies;
            if (s === 'cat') {
                return `**Key Reasons & Health Insights (Cat Care & Behavior):**\n\n` +
                       `• **Evolutionary Instincts:** Cats are crepuscular predators designed to sleep 12-16 hours to conserve energy for hunting bursts.\n` +
                       `• **Hydration Importance:** Low thirst drive makes wet food essential (70-80% water) to protect against kidney disease.\n` +
                       `• **Stress & Environment:** Cats are sensitive to routine changes; subtle behavioral changes signal health or stress issues.`;
            }
            if (s === 'dog') {
                return `**Key Reasons & Health Insights (Dog Care & Routine):**\n\n` +
                       `• **Physical & Mental Outlet:** Daily walks prevent joint stiffness, obesity, and destructive behavioral habits.\n` +
                       `• **Dietary Balance:** Consistent feeding times stabilize blood sugar and establish clean potty routines.`;
            }
        }

        // 6. UNKNOWN SPECIES — ask which pet before giving species-specific advice
        if (!species && !conversationState.lastSpecies) {
            return `I'd love to help! Could you tell me which pet you're asking about? 🐾\n\n` +
                   `For example: dog, cat, bird, fish, rabbit, or another animal?`;
        }
        // 7. GENERAL FALLBACK — directed clarification, not generic dump
        return `I'm not sure I understood that fully. Could you give me a bit more detail? 😊\n\n` +
               `I can help with:\n` +
               `• **Health & symptoms** — e.g. "My dog is scratching a lot"\n` +
               `• **Food & diet** — e.g. "What can my cat eat?"\n` +
               `• **Petzi features** — e.g. "How do I add a medication?"\n` +
               `• **Vet & appointments** — e.g. "How do I book a vet appointment?"`;
    }

    /**
     * Intelligent Pet Matcher: finds the best Q&A response with confidence scoring
     */
    function findBestPetAnswer(query) {
        const cleanQuery = query.toLowerCase().trim();
        const tokens = tokenize(cleanQuery);

        // 0. Greetings, Farewells & Gratitude
        const exactGreetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'hi petzi', 'hello petzi', 'hey petzi', 'hi there', 'hello there', 'howdy', 'hey there'];
        if (exactGreetings.some(g => cleanQuery === g || cleanQuery === `${g}!` || cleanQuery === `${g}.`)) {
            return {
                isPet: true,
                confidence: 100,
                text: "Hi! 👋 How can I help you and your pet today?"
            };
        }

        const exactGratitude = ['thanks', 'thank you', 'thank you so much', 'thanks a lot', 'thx', 'ty', 'appreciate it'];
        if (exactGratitude.some(g => cleanQuery === g || cleanQuery === `${g}!` || cleanQuery === `${g}.` || cleanQuery === `ok ${g}`)) {
            return {
                isPet: true,
                confidence: 100,
                text: "You're welcome! 😊 Let me know if you have any other questions about your pet."
            };
        }

        const exactFarewells = ['bye', 'goodbye', 'see you', 'cya', 'bye bye', 'good bye', 'have a good day'];
        if (exactFarewells.some(f => cleanQuery === f || cleanQuery === `${f}!` || cleanQuery === `${f}.`)) {
            return {
                isPet: true,
                confidence: 100,
                text: "You're welcome! Take great care of your pet! 🐾"
            };
        }

        if (cleanQuery === 'how are you' || cleanQuery === 'how are you?' || cleanQuery === 'how are you doing' || cleanQuery === 'how are you doing?') {
            return {
                isPet: true,
                confidence: 100,
                text: "I'm doing great, thank you! 🐾 How can I help you with your pet today?"
            };
        }

        // Vague Sickness Clarification
        const vagueSickness = ['my pet is sick', 'pet is sick', 'my pet is not well', 'my pet is unwell', 'my dog is sick', 'my cat is sick'];
        if (vagueSickness.some(v => cleanQuery === v || cleanQuery === `${v}.` || cleanQuery === `${v}!`)) {
            return {
                isPet: true,
                confidence: 100,
                text: "I'm sorry to hear that your pet isn't feeling well! 🐾 Could you tell me what type of pet you have and what specific symptoms you're noticing (such as vomiting, diarrhea, lethargy, coughing, or loss of appetite)?"
            };
        }

        // Follow-up context: "What should I check first?"
        if (cleanQuery.includes('what should i check first') || cleanQuery.includes('what to check first')) {
            return {
                isPet: true,
                confidence: 90,
                text: "Here is what to check first for your pet:\n\n1. **Check for Fleas & Parasites:** Part the fur along the lower back and tail base to look for live insects or black flea dirt.\n2. **Inspect Ears & Paws:** Look for redness, dark wax, or yeasty odor in ears and raw spots between paw pads.\n3. **Monitor Vital Signs:** Check if your pet is drinking water, eating, and alert or lethargic."
            };
        }

        if (cleanQuery.includes('what about fleas') || cleanQuery.includes('could it be fleas')) {
            return {
                isPet: true,
                confidence: 90,
                text: "**How to Check for & Treat Fleas:** 🚫\n\n1. **Flea Comb Test:** Run a fine-toothed flea comb over your pet's lower back onto a damp paper towel. If black specks turn reddish, it is flea dirt.\n2. **Vet-Approved Treatment:** Use a weight-appropriate spot-on or chewable flea preventative (e.g. Bravecto/Frontline).\n3. **Wash Bedding:** Wash pet bedding in hot water and vacuum carpets thoroughly."
            };
        }

        if (cleanQuery.includes('what about carrots') || cleanQuery.includes('can dog eat carrots') || cleanQuery === 'carrots' || cleanQuery === 'carrots?') {
            return {
                isPet: true,
                confidence: 90,
                text: "**Yes! Carrots are safe, healthy, and low-calorie treats for dogs.** 🥕 You can feed them raw (which cleans teeth and satisfies chewing) or steamed without salt or seasonings. Cut into bite-sized pieces."
            };
        }

        // 1. Only reject if explicitly matching technical/political non-pet indicators
        if (!isPetRelated(query)) {
            const capitalMatch = cleanQuery.match(/capital of ([a-zA-Z\s]+)/i);
            if (capitalMatch) {
                const c = capitalMatch[1].trim();
                const cap = c.includes('france') ? 'Paris' : (c.includes('germany') ? 'Berlin' : (c.includes('italy') ? 'Rome' : 'the capital'));
                return {
                    isPet: false,
                    confidence: 0,
                    text: `The capital of ${c} is **${cap}**! 🌍 I'm mainly here to help with pet care and the Petzi app — how can I help you with your pet today? 🐾`
                };
            }
            return {
                isPet: false,
                confidence: 0,
                text: "I'm Petzi Assistant, your pet-care assistant. I can help only with questions related to pets and pet care. 🐾"
            };
        }

        // 2. Update species memory if species mentioned
        if (cleanQuery.includes('cat') || cleanQuery.includes('kitten') || cleanQuery.includes('kitty') || cleanQuery.includes('feline')) {
            conversationState.lastSpecies = 'cat';
        } else if (cleanQuery.includes('dog') || cleanQuery.includes('puppy') || cleanQuery.includes('pup') || cleanQuery.includes('canine')) {
            conversationState.lastSpecies = 'dog';
        } else if (cleanQuery.includes('bird') || cleanQuery.includes('parrot') || cleanQuery.includes('canary') || cleanQuery.includes('budgie')) {
            conversationState.lastSpecies = 'bird';
        } else if (cleanQuery.includes('fish') || cleanQuery.includes('goldfish') || cleanQuery.includes('betta')) {
            conversationState.lastSpecies = 'fish';
        } else if (cleanQuery.includes('rabbit') || cleanQuery.includes('bunny')) {
            conversationState.lastSpecies = 'rabbit';
        } else if (cleanQuery.includes('hamster')) {
            conversationState.lastSpecies = 'hamster';
        }

        // 3. Search PET_QA_DATASET for high confidence intent match
        let bestMatch = null;
        let highestScore = 0;

        for (const item of PET_QA_DATASET) {
            let score = 0;

            for (const pat of item.matchPatterns) {
                if (pat.test(cleanQuery)) {
                    score += 50;
                    break;
                }
            }

            for (const kw of item.keywords) {
                for (const t of tokens) {
                    if (t === kw) {
                        score += 8;
                    } else if (fuzzyTokenMatch(t, kw)) {
                        score += 5;
                    }
                }
            }

            if (score > highestScore) {
                highestScore = score;
                bestMatch = item;
            }
        }

        if (bestMatch && highestScore >= 12) {
            conversationState.lastIntentId = bestMatch.id;
            return {
                isPet: true,
                confidence: highestScore,
                text: bestMatch.answer
            };
        }

        // 4. Dynamic species/topic synthesizer
        const dynamicAnswer = generateSpeciesSpecificResponse(cleanQuery);
        return {
            isPet: true,
            confidence: 5,
            text: dynamicAnswer
        };
    }

    /* ==========================================================================
       3. DOM INJECTION & UI INTERACTION & API INTEGRATION
       ========================================================================== */

    let chatHistory = [];
    let currentSelectedPet = null;

    function getActivePetId() {
        // 1. Check URL parameters (e.g. pet.html?id=2)
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') || urlParams.get('petId');
        if (urlId) return parseInt(urlId, 10);

        // 2. Check localStorage
        const localId = localStorage.getItem('selectedPetId') || localStorage.getItem('currentPetId');
        if (localId) return parseInt(localId, 10);

        return null;
    }

    async function fetchActivePetInfo() {
        try {
            const petId = getActivePetId();
            let url = '/api/pets';
            if (petId) {
                url = `/api/pets/${petId}`;
            }
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();

            let pet = null;
            if (Array.isArray(data)) {
                pet = data.find(p => p.id === petId) || data[0];
            } else {
                pet = data;
            }

            if (pet && pet.id) {
                currentSelectedPet = pet;
                updatePetBadgeInUI(pet);
                return pet;
            }
        } catch (e) {
            console.log('Error fetching active pet for assistant:', e);
        }
        return null;
    }

    function updatePetBadgeInUI(pet) {
        const badge = document.querySelector('#petzi-bot-pet-badge');
        if (badge) {
            badge.textContent = `🐾 Pet Care Companion`;
            badge.style.display = 'inline-block';
        }
    }

    function createPetziAssistantDOM() {
        // Floating Action Button (Paw icon ONLY)
        const fab = document.createElement('button');
        fab.id = 'petzi-bot-fab';
        fab.setAttribute('aria-label', 'Open Petzi Assistant');
        fab.setAttribute('title', 'Petzi Assistant');
        fab.innerHTML = '<span class="bot-paw-icon">🐾</span>';

        // Chat Widget Window
        const widget = document.createElement('div');
        widget.id = 'petzi-chat-widget';
        widget.innerHTML = `
            <div class="petzi-chat-header">
                <div class="petzi-chat-header-info">
                    <div class="petzi-chat-avatar">🐾</div>
                    <div class="petzi-chat-title-wrap">
                        <span class="petzi-chat-title">Petzi Assistant</span>
                        <span class="petzi-chat-pet-badge" id="petzi-bot-pet-badge">🐾 Pet Companion</span>
                    </div>
                </div>
                <button class="petzi-chat-close-btn" id="petzi-bot-close" aria-label="Close Petzi Assistant">✕</button>
            </div>

            <div class="petzi-chat-body" id="petzi-chat-messages">
                <div class="petzi-msg bot">
                    <div class="petzi-msg-bubble">
                        Hi! 🐾 I'm <strong>Petzi Assistant</strong>, your pet care & app companion. How can I help you with your pet today?
                    </div>
                    <span class="petzi-msg-time">Just now</span>
                </div>
            </div>

            <div class="petzi-chat-footer">
                <input type="text" id="petzi-chat-input" class="petzi-chat-input" placeholder="Ask anything about your pet..." autocomplete="off" />
                <button id="petzi-chat-send" class="petzi-chat-send-btn" aria-label="Send message">
                    <svg viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </div>
        `;

        document.body.appendChild(fab);
        document.body.appendChild(widget);

        // Fetch pet info for badge
        fetchActivePetInfo();

        // Bind Events
        bindPetziEvents(fab, widget);
    }

    function bindPetziEvents(fab, widget) {
        const closeBtn = widget.querySelector('#petzi-bot-close');
        const input = widget.querySelector('#petzi-chat-input');
        const sendBtn = widget.querySelector('#petzi-chat-send');
        const messagesContainer = widget.querySelector('#petzi-chat-messages');

        // Toggle Widget
        fab.addEventListener('click', () => {
            const isActive = widget.classList.contains('active');
            if (isActive) {
                widget.classList.remove('active');
            } else {
                widget.classList.add('active');
                fetchActivePetInfo();
                setTimeout(() => input.focus(), 150);
            }
        });

        closeBtn.addEventListener('click', () => {
            widget.classList.remove('active');
        });

        // Send on Button Click
        sendBtn.addEventListener('click', () => {
            const text = input.value.trim();
            if (text) {
                handleUserSend(text);
                input.value = '';
            }
        });

        // Send on Enter Key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = input.value.trim();
                if (text) {
                    handleUserSend(text);
                    input.value = '';
                }
            }
        });

        async function handleUserSend(text) {
            // Append user message
            appendMessage('user', text);
            chatHistory.push({ role: 'user', content: text });

            // Show Typing indicator
            const typingElem = showTypingIndicator();

            try {
                const petId = getActivePetId() || (currentSelectedPet ? currentSelectedPet.id : null);
                const token = localStorage.getItem('petziToken');
                const headers = { 'Content-Type': 'application/json' };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch('/api/assistant/chat', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        petId: petId,
                        userMessage: text,
                        token: token,
                        conversationHistory: chatHistory.slice(-10)
                    })
                });

                if (typingElem && typingElem.parentNode) {
                    typingElem.parentNode.removeChild(typingElem);
                }

                if (response.ok) {
                    const data = await response.json();
                    if (data.pet) {
                        currentSelectedPet = data.pet;
                        updatePetBadgeInUI(data.pet);
                    }
                    const reply = data.response || "I'm here to help with your Petzi pet care. What would you like to know?";
                    chatHistory.push({ role: 'assistant', content: reply });
                    appendMessage('bot', reply);
                } else {
                    const fallbackReply = "I'm having trouble accessing your Petzi information right now. Please try again in a moment. 🐾";
                    chatHistory.push({ role: 'assistant', content: fallbackReply });
                    appendMessage('bot', fallbackReply);
                }
            } catch (err) {
                if (typingElem && typingElem.parentNode) {
                    typingElem.parentNode.removeChild(typingElem);
                }
                const fallbackReply = "I'm having trouble connecting to Petzi right now. Please check your connection or try again in a moment. 🐾";
                chatHistory.push({ role: 'assistant', content: fallbackReply });
                appendMessage('bot', fallbackReply);
            }
        }

        function appendMessage(sender, text) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `petzi-msg ${sender}`;

            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Format markdown-like bold, italic, line breaks, and emergency alerts
            let formatted = text
                .replace(/🚨\s*\*\*(.*?)\*\*/g, '<div class="petzi-emergency-banner">🚨 <strong>$1</strong></div>')
                .replace(/⚠️\s*\*\*(.*?)\*\*/g, '<div class="petzi-warning-banner">⚠️ <strong>$1</strong></div>')
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');

            msgDiv.innerHTML = `
                <div class="petzi-msg-bubble">${formatted}</div>
                <span class="petzi-msg-time">${timeStr}</span>
            `;

            messagesContainer.appendChild(msgDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function showTypingIndicator() {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'petzi-msg bot';
            typingDiv.innerHTML = `
                <div class="petzi-typing-bubble">
                    <span class="petzi-typing-dot"></span>
                    <span class="petzi-typing-dot"></span>
                    <span class="petzi-typing-dot"></span>
                </div>
            `;
            messagesContainer.appendChild(typingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return typingDiv;
        }
    }

    // Auto-inject when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createPetziAssistantDOM);
    } else {
        createPetziAssistantDOM();
    }
})();
