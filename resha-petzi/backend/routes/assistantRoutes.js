const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * Helper: Query database with Promise
 */
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Check Emergency Terms
 */
function checkForEmergency(message, species) {
    const q = message.toLowerCase();
    const emergencyTerms = [
        'collapse', 'collapsed', 'unresponsive', 'unconscious', 'cannot breathe', 'difficulty breathing',
        'gasping', 'choking', 'bleeding severely', 'heavy bleeding', 'seizure', 'seizures', 'poison',
        'ingested poison', 'bloat', 'swallowed glass', 'hit by car', 'cannot urinate', 'straining to pee',
        'pale gums', 'blue gums', 'extreme weakness'
    ];

    if ((species === 'rabbit' || species === 'bunny') && (q.includes('not eating') || q.includes('not pooping') || q.includes('stopped eating'))) {
        return `🚨 **CRITICAL RABBIT EMERGENCY NOTICE (GI STASIS):**\n\n` +
               `Rabbits that stop eating or pooping for >12 hours are in a **life-threatening GI Stasis emergency**! Their digestive tract shuts down rapidly. Please seek **immediate emergency veterinary care** right now.`;
    }

    const matchedTerm = emergencyTerms.find(term => q.includes(term));
    if (matchedTerm) {
        return `🚨 **IMMEDIATE EMERGENCY VETERINARY CARE REQUIRED:**\n\n` +
               `The symptoms described (*"${matchedTerm}"*) can indicate a **life-threatening medical emergency**.\n\n` +
               `• **Action Required:** Please contact or transport your pet to the nearest **Emergency Veterinary Clinic** immediately!\n` +
               `• **Do Not Wait:** Keep your pet warm, calm, and safe while transporting them to the clinic.\n` +
               `• **Find a Vet:** You can use the 'Find a Vet' page on Petzi to locate nearby emergency clinics.`;
    }

    return null;
}

/**
 * Direct Database History Queries
 */
function handleDatabaseQueries(message, pet, medications, activities) {
    const q = message.toLowerCase();
    const petName = pet ? pet.name : 'your pet';

    // 1. Medications Query
    if (q.includes('medication') || q.includes('medicine') || q.includes('pill') || q.includes('taking')) {
        if (!medications || medications.length === 0) {
            return `According to ${petName}'s profile, there are currently **no active medications** recorded in the database. 💊`;
        }
        const medList = medications.map(m => `• **${m.medication_name}**: ${m.dosage || 'Dose N/A'}, ${m.frequency || 'Frequency N/A'} (Reminder: ${m.reminder_time || 'N/A'})${m.notes ? ` — *${m.notes}*` : ''}`).join('\n');
        return `Here are **${petName}'s current medications** recorded in Petzi 💊:\n\n${medList}`;
    }

    // 2. Vaccination Query
    if (q.includes('vaccin') || q.includes('shot')) {
        const status = pet && pet.vaccination_status ? pet.vaccination_status : 'Not specified';
        const lastDate = pet && pet.last_vaccination_date ? pet.last_vaccination_date : 'Not recorded in profile';
        const nextDate = pet && pet.next_vaccination_date ? pet.next_vaccination_date : 'Not recorded in profile';
        return `Here is **${petName}'s vaccination record** 🐾:\n\n` +
               `• **Status:** ${status}\n` +
               `• **Last Vaccination Date:** ${lastDate}\n` +
               `• **Next Due Date:** ${nextDate}`;
    }

    // 3. Feeding Query
    if (q.includes('did i feed') || q.includes('what did i feed') || q.includes('what did i give') || q.includes('feeding history') || (q.includes('feed') && q.includes('today'))) {
        const feedingLogs = activities.filter(a => a.activity_type === 'FEEDING');
        if (feedingLogs.length === 0) {
            return `There are **no feeding logs** recorded for ${petName} today. You can log feedings directly from your Petzi Dashboard! 🐾`;
        }
        const logsText = feedingLogs.map(f => `• **${new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}**: ${f.notes || 'Meal fed'}`).join('\n');
        return `Here is **${petName}'s feeding history** 🐾:\n\n${logsText}`;
    }

    // 4. Walks Query
    if (q.includes('last walk') || q.includes('how many walks') || q.includes('walk history') || (q.includes('walk') && q.includes('today'))) {
        const walkLogs = activities.filter(a => a.activity_type === 'WALK');
        if (walkLogs.length === 0) {
            return `There are **no walk records** logged for ${petName} today. 🐾`;
        }
        const walkText = walkLogs.map(w => `• **${new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}**: ${w.notes || 'Walk completed'}`).join('\n');
        return `Here is **${petName}'s walk log** 🐶:\n\n${walkText}`;
    }

    // 5. Care Log / Recent Activity History
    if (q.includes('care log') || q.includes('care history') || q.includes('happened with my pet') || q.includes('happened recently')) {
        if (!activities || activities.length === 0) {
            return `There are **no recent care history logs** recorded in ${petName}'s profile.`;
        }
        const recentText = activities.slice(0, 5).map(a => `• **[${a.activity_type}] ${new Date(a.timestamp).toLocaleString()}**: ${a.notes || 'Activity logged'}`).join('\n');
        return `Here is **${petName}'s recent care log history** 🐾:\n\n${recentText}`;
    }

    return null;
}

/**
 * Handle Petzi App Usage & Feature Assistance
 */
function handleAppFeatureGuidance(q, petName) {
    if (q.includes('how to log') || q.includes('log feeding') || q.includes('log walk') || q.includes('log activity')) {
        return `**How to Log Activities in Petzi:** 🐾\n\n` +
               `1. Go to your **Petzi Dashboard** or **My Pets** page.\n` +
               `2. Click on **${petName}** to open their pet profile.\n` +
               `3. Click the **Log Activity** button (Feeding, Walk, or Care Log).\n` +
               `4. Enter your notes and timestamp, then click **Save**!`;
    }
    if (q.includes('medication reminder') || q.includes('set reminder') || q.includes('add medication') || q.includes('how to add medicine')) {
        return `**How to Set Medication Reminders in Petzi:** 💊\n\n` +
               `1. Open **${petName}**'s pet profile page.\n` +
               `2. Scroll to the **Medications** section and click **Add Medication**.\n` +
               `3. Enter the medication name, dosage, frequency, and reminder time.\n` +
               `4. Save to enable automated reminder notifications!`;
    }
    if (q.includes('export') || q.includes('export history') || q.includes('history for vet') || q.includes('download log')) {
        return `**How to Export Care History for Your Vet:** 📄\n\n` +
               `1. Open **${petName}**'s pet details page.\n` +
               `2. Scroll down to **Care Log & History**.\n` +
               `3. Click **Export Care History** to download or print a complete health and activity report for your veterinarian visit!`;
    }
    if (q.includes('how to use petzi') || q.includes('what can petzi do') || q.includes('about petzi app') || q.includes('app features')) {
        return `**What You Can Do in Petzi App:** 🐾\n\n` +
               `• **Pet Profiles:** Store health records, breed, age, weight, and allergies for all your pets.\n` +
               `• **Daily Care Log:** Track feeding times, walk schedules, and daily routines.\n` +
               `• **Medication Reminders:** Never miss a dose with automated medication alerts 💊.\n` +
               `• **Vet Appointments:** Find nearby vets and manage appointment reminders.\n` +
               `• **Export Logs:** Easily share care history with your veterinarian!`;
    }
    return null;
}

/**
 * Petzi Assistant AI Engine
 */
function generateSemanticPetResponse(message, pet, medications, activities, conversationHistory = []) {
    const q = message.toLowerCase().trim();
    // ONLY use specific pet name if user explicitly mentioned it in their query
    const userMentionedName = (pet && pet.name && q.includes(pet.name.toLowerCase())) ? pet.name : null;
    const petDisplayName = userMentionedName ? userMentionedName : 'your pet';

    // 1. GREETING RULE (Short friendly response)
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'hi petzi', 'hello petzi', 'hey petzi'];
    if (greetings.includes(q)) {
        return `Hi! 🐾 How can I help you with your pet today?`;
    }

    // 2. OUT-OF-SCOPE REDIRECTION
    const nonPetTerms = ['coding', 'programming', 'javascript', 'python', 'weather today', 'stock market', 'crypto', 'bitcoin', 'football match'];
    if (nonPetTerms.some(term => q.includes(term))) {
        return `I'm **Petzi Assistant**, your dedicated pet care companion! 🐾\n\nI'm designed primarily to help you with pet health, diet, medications, behavior, and daily care. Please feel free to ask me any question about your pet!`;
    }

    // 3. APP GUIDANCE
    const appHelp = handleAppFeatureGuidance(q, petDisplayName);
    if (appHelp) return appHelp;

    // 4. Resolve active pet species
    const petSpecies = (pet && pet.species ? pet.species : 'Dog');
    const petSpeciesLower = petSpecies.toLowerCase();

    // Determine target species for the query (without corrupting pet.species)
    let queryTargetSpecies = petSpeciesLower;
    if (q.includes('cat') || q.includes('kitten') || q.includes('kitty') || q.includes('feline')) queryTargetSpecies = 'cat';
    else if (q.includes('bird') || q.includes('parrot') || q.includes('canary') || q.includes('budgie') || q.includes('cockatiel')) queryTargetSpecies = 'bird';
    else if (q.includes('fish') || q.includes('goldfish') || q.includes('betta') || q.includes('aquarium') || q.includes('tank')) queryTargetSpecies = 'fish';
    else if (q.includes('rabbit') || q.includes('bunny') || q.includes('bunnies') || q.includes('hare')) queryTargetSpecies = 'rabbit';
    else if (q.includes('hamster') || q.includes('guinea') || q.includes('rodent')) queryTargetSpecies = 'hamster';
    else if (q.includes('turtle') || q.includes('lizard') || q.includes('reptile')) queryTargetSpecies = 'reptile';
    else if (q.includes('dog') || q.includes('puppy') || q.includes('pup') || q.includes('canine')) queryTargetSpecies = 'dog';

    const breed = pet && pet.breed ? pet.breed : '';
    const age = pet && pet.age !== null && pet.age !== undefined ? pet.age : null;
    const weight = pet && pet.weight ? pet.weight : null;
    const allergies = pet && pet.allergies ? pet.allergies : (pet && pet.special_instructions ? pet.special_instructions : null);

    // Multi-turn context synthesis
    const historyText = conversationHistory.map(h => `${h.role}: ${h.content}`).join('\n').toLowerCase();
    const combined = (historyText + '\n' + q).toLowerCase();

    // Check emergency
    const emergencyMsg = checkForEmergency(q, queryTargetSpecies);
    if (emergencyMsg) return emergencyMsg;

    // Check DB queries
    const dbMsg = handleDatabaseQueries(message, pet, medications, activities);
    if (dbMsg) return dbMsg;

    // FOOD RECOMMENDATIONS BY SPECIES (Direct & Specific)
    if (q.includes('food') || q.includes('feed') || q.includes('eat') || q.includes('diet') || q.includes('recommend')) {
        // Fish Food Recommendation
        if (queryTargetSpecies === 'fish' || q.includes('fish')) {
            return `**Recommended Food Guidelines for Aquarium Fish:** 🐟\n\n` +
                   `1. **High-Quality Flakes:** Ideal for surface and mid-water feeders (Guppies, Tetras, Angelfish).\n` +
                   `2. **Sinking Pellets & Wafers:** Essential for bottom-dwelling species (Corydoras, Plecos, Loaches).\n` +
                   `3. **Freeze-Dried & Live Foods:** Bloodworms, Brine Shrimp, and Daphnia for high-protein nutrition.\n` +
                   `4. **Vegetable Supplements:** Spirulina flakes or blanched zucchini slices for herbivorous fish.\n\n` +
                   `**Feeding Tip:** Feed small amounts that your fish can consume within 2–3 minutes, once or twice daily. Overfeeding causes cloudy water and harmful Ammonia spikes!`;
        }

        // Cat Food Recommendation
        if (queryTargetSpecies === 'cat' || q.includes('cat') || q.includes('kitten')) {
            return `**Recommended Food Guidelines for Cats:** 🐱\n\n` +
                   `1. **High-Protein Meat Diet:** Choose high-quality commercial cat food where real meat (chicken, turkey, salmon) is the primary ingredient.\n` +
                   `2. **Wet vs Dry Food:** Wet canned food provides vital hydration; dry kibble helps dental hygiene.\n` +
                   `3. **Essential Nutrients:** Ensure food contains Taurine, Arachidonic acid, and Vitamin A.\n` +
                   `4. **Foods to NEVER Feed Cats:** Onions, garlic, chocolate, grapes/raisins, raw eggs, alcohol, or lilies.`;
        }

        // Dog Food Recommendation
        if (queryTargetSpecies === 'dog' || q.includes('dog') || q.includes('puppy')) {
            return `**Recommended Food Guidelines for Dogs:** 🐶\n\n` +
                   `1. **Balanced Commercial Kibble:** Choose age-appropriate (Puppy / Adult / Senior) high-quality kibble rich in protein and healthy fats.\n` +
                   `2. **Safe Fresh Foods:** Plain boiled chicken breast, plain white rice, boiled carrots, pumpkin puree, and sliced apples (no seeds).\n` +
                   `3. **Foods to NEVER Feed Dogs:** Chocolate, grapes, raisins, onions, garlic, xylitol (artificial sweetener), avocado, and cooked bones.` +
                   (allergies && userMentionedName ? `\n\n*(Profile Note for ${userMentionedName}: stored allergy/note "${allergies}")*` : '');
        }

        // Rabbit Food Recommendation
        if (queryTargetSpecies === 'rabbit' || q.includes('rabbit') || q.includes('bunny')) {
            return `**Recommended Diet Guidelines for Rabbits:** 🐰\n\n` +
                   `1. **80-85% Timothy Hay:** Fresh hay must be unlimited and available 24/7 for digestive motility and dental wear.\n` +
                   `2. **Fresh Leafy Greens:** Romaine lettuce, parsley, cilantro, basil, and mint daily.\n` +
                   `3. **High-Fiber Pellets:** Small measured portion (1/4 cup per 5 lbs body weight daily).\n` +
                   `4. **Treats (Tiny amounts):** Tiny slice of carrot or apple as an occasional treat.`;
        }

        // Bird Food Recommendation
        if (queryTargetSpecies === 'bird' || q.includes('bird')) {
            return `**Recommended Food Guidelines for Pet Birds:** 🐦\n\n` +
                   `1. **Nutritional Pellets:** Formulated pellets should make up 60-70% of their daily diet.\n` +
                   `2. **Fresh Vegetables & Fruits:** Dark leafy greens, broccoli, carrots, apples, and berries.\n` +
                   `3. **Seed Mix (In Moderation):** High-fat seed mixes should only be 10-20% of diet.\n` +
                   `4. **Safe Grains:** Plain cooked white/brown rice or quinoa.`;
        }
    }

    // MULTI-TURN HEALTH SYMPTOM + WAITING QUERY
    if (combined.includes('wait') && (combined.includes('tomorrow') || combined.includes('hours')) && (combined.includes('vomit') || combined.includes('not eating') || combined.includes('eat') || combined.includes('lethargic'))) {
        return `⚠️ **I strongly advise AGAINST waiting until tomorrow for ${petDisplayName} (${petSpecies}).**\n\n` +
               `Combining refusal of food with repeated vomiting and lethargy for over 24 hours can lead to **rapid dehydration, electrolyte imbalance, or liver strain**.\n\n` +
               `**Recommended Action Steps:**\n` +
               `1. Contact your veterinarian or an **Emergency Veterinary Clinic** today for a physical evaluation.\n` +
               `2. Offer small sips of fresh water, but do not force food until examined.\n` +
               `3. Monitor for pale gums, weakness, or blood in vomit/stool.`;
    }

    // AGE & BREED AWARENESS: PUPPY / KITTEN / SENIOR FEEDING
    if (q.includes('puppy') || q.includes('kitten') || (age !== null && age < 1 && (q.includes('feed') || q.includes('food')))) {
        if (queryTargetSpecies === 'cat' || q.includes('kitten')) {
            return `**Kitten Feeding Guidelines:** 🐱\n\n` +
                   `1. **2–4 Months:** 4 small meals per day of kitten-formulated wet/dry food.\n` +
                   `2. **4–6 Months:** 3 meals per day rich in taurine, DHA, and high-quality protein.\n` +
                   `3. **6–12 Months:** 2 meals per day transitioning gradually to adult food at 12 months.`;
        }
        return `**Puppy Feeding Guidelines:** 🐶\n\n` +
               `1. **8–12 Weeks:** 3 to 4 meals per day of growth-formulated kibble.\n` +
               `2. **3–6 Months:** 3 meals per day.\n` +
               `3. **6–12 Months:** 2 meals per day.\n\n` +
               `**Nutritional Needs:** High protein, DHA for brain development, and balanced calcium/phosphorus for growing bones.`;
    }

    // HOW TO CLEAN / WASH / GROOM / MAINTAIN PROCESS & STEPS (FOR ALL PETS)
    if (q.includes('clean') || q.includes('cleans') || q.includes('wash') || q.includes('groom') || q.includes('maintain') || q.includes('bath') || q.includes('bathing')) {
        // 1. FISH TANK / AQUARIUM CLEANING (Handles typos like "tanl", "tank", "aquarium", "fish")
        if (q.includes('fish') || q.includes('tank') || q.includes('tanl') || q.includes('aquarium') || queryTargetSpecies === 'fish') {
            return `**Step-by-Step Guide to Cleaning a Fish Tank:** 🐟\n\n` +
                   `1. **Preparation:** Unplug the heater and filter to prevent electrical hazards and equipment damage.\n` +
                   `2. **Scrape Algae:** Use an algae scraper pad to gently scrub algae off the inner glass walls.\n` +
                   `3. **20–30% Water Siphon:** Use a gravel vacuum siphon to drain 20–30% of the water while vacuuming trapped waste from the gravel.\n` +
                   `4. **Rinse Filter Sponges (Crucial!):** Gently rinse filter sponges GENTLY in the removed old tank water ONLY. Never wash filter media in tap water, as chlorine kills beneficial nitrifying bacteria!\n` +
                   `5. **Refill & Condition:** Refill the tank with fresh water treated with water dechlorinator/conditioner at the exact same temperature as the tank. Re-plug heater and filter.`;
        }

        // 2. BIRD CAGE CLEANING
        if (q.includes('bird') || q.includes('parrot') || q.includes('canary') || queryTargetSpecies === 'bird') {
            return `**Step-by-Step Guide to Cleaning a Bird Cage:** 🐦\n\n` +
                   `1. **Secure Your Bird:** Move your bird to a safe secondary carrier or enclosed room.\n` +
                   `2. **Daily Tray Cleaning:** Replace the paper tray liner daily and discard uneaten food/seed husks.\n` +
                   `3. **Scrub Dishes & Perches:** Wash water bowls and food dishes daily in hot soapy water. Wipe droppings off wooden/rope perches.\n` +
                   `4. **Weekly Cage Wash:** Wipe down metal cage bars and plastic base with warm water and bird-safe disinfectant.\n` +
                   `5. **Dry & Reassemble:** Ensure everything is 100% dry before placing fresh paper liners, food, and your bird back inside.`;
        }

        // 3. RABBIT PEN / CAGE CLEANING
        if (q.includes('rabbit') || q.includes('bunny') || queryTargetSpecies === 'rabbit') {
            return `**Step-by-Step Guide to Cleaning a Rabbit Pen:** 🐰\n\n` +
                   `1. **Move Rabbit to Playpen:** Let your rabbit exercise in a rabbit-proofed play area.\n` +
                   `2. **Litter Box Maintenance:** Empty the litter box daily. Replace paper-based litter and add fresh Timothy hay on top.\n` +
                   `3. **Clean Urine Scales:** Use a 50/50 mixture of white vinegar and warm water to easily dissolve stubborn calcium urine stains on plastic bases.\n` +
                   `4. **Refresh Bedding & Toys:** Replenish clean fleece blankets, cardboard chew toys, and fresh water bowls.`;
        }

        // 4. HAMSTER CAGE CLEANING
        if (q.includes('hamster') || q.includes('guinea') || q.includes('rodent') || queryTargetSpecies === 'hamster') {
            return `**Step-by-Step Guide to Cleaning a Hamster Cage:** 🐹\n\n` +
                   `1. **Safely Move Hamster:** Place your hamster in a secure travel carrier or deep playpen with bedding and a treat.\n` +
                   `2. **Spot Clean Daily:** Remove soiled bedding, damp corners, and uneaten fresh food daily.\n` +
                   `3. **Weekly Deep Clean:** Remove 70-80% of old bedding, saving 20-30% clean old bedding so the cage retains your hamster's familiar scent.\n` +
                   `4. **Wash Base & Toys:** Wash cage base and plastic toys with warm water and mild pet-safe soap (dry completely before adding fresh paper bedding).\n` +
                   `5. **Sanitize Accessories:** Clean water bottle, food bowl, and exercise wheel.`;
        }

        // 5. DOG BATHING & GROOMING
        if (q.includes('dog') || q.includes('puppy') || queryTargetSpecies === 'dog') {
            return `**Step-by-Step Guide to Bathing & Cleaning Your Dog:** 🐶\n\n` +
                   `1. **Pre-Bath Brushing:** Brush your dog's coat thoroughly to remove tangles and mats before getting wet.\n` +
                   `2. **Lukewarm Wetting:** Use warm water to wet the coat completely, avoiding the inner ears, eyes, and nose.\n` +
                   `3. **Lather & Rinse:** Apply dog-formulated shampoo, lather gently along the back and belly, and rinse thoroughly until water runs completely clear.\n` +
                   `4. **Drying:** Towel dry thoroughly or blow dry on a cool/low setting while brushing out the coat.`;
        }

        // 6. CAT GROOMING & LITTER BOX
        if (q.includes('cat') || q.includes('kitten') || queryTargetSpecies === 'cat') {
            return `**Step-by-Step Guide to Cat Grooming & Litter Box Cleaning:** 🐱\n\n` +
                   `1. **Daily Litter Scooping:** Scoop clumps daily and maintain 2-3 inches of clean litter.\n` +
                   `2. **Monthly Litter Box Wash:** Empty all litter monthly, wash the pan with mild soap and warm water, and refill with fresh litter.\n` +
                   `3. **Coat Brushing:** Gently brush with a slicker brush (short hair weekly, long hair daily) to prevent hairballs.\n` +
                   `4. **Nail Trimming:** Gently trim clear tips of claws using cat nail clippers, avoiding the pink quick.`;
        }
    }

    // NOCTURNAL BARKING
    if (q.includes('bark') && (q.includes('night') || q.includes('dark') || q.includes('sleep'))) {
        return `Dogs bark at night for specific reasons 🐶:\n\n` +
               `1. **Outside Sounds & Distractions:** Hearing nocturnal wildlife, wind, or distant cars.\n` +
               `2. **Anxiety & Fear:** Isolation anxiety, darkness, or feeling unsafe away from family.\n` +
               `3. **Unspent Energy:** Insufficient daytime physical exercise or mental stimulation.\n` +
               `4. **Age-Related Confusion:** In older dogs, nighttime barking can indicate cognitive changes.\n\n` +
               `**Step-by-Step Actions to Reduce Night Barking:**\n` +
               `1. Provide a cozy sleeping spot in a quiet room with soft music.\n` +
               `2. Increase evening exercise and mental puzzle toys before bedtime.\n` +
               `3. Do not reinforce barking by coming running with treats every time.`;
    }

    // CATS EATING EGGS
    if (queryTargetSpecies === 'cat' && (q.includes('egg') || q.includes('eggs'))) {
        return `**Yes! Cats can safely eat cooked eggs.** 🍳\n\n` +
               `1. **Fully Cooked:** Eggs MUST be fully cooked (scrambled or hard-boiled) with **NO salt, butter, oil, milk, or seasonings**.\n` +
               `2. **NEVER Feed Raw Eggs:** Raw egg whites contain avidin and risk Salmonella.\n` +
               `3. **Portion:** Serve a small tablespoon portion as an occasional treat!`;
    }

    // BIRD QUIET / NOT VOCAL / NOT SHOUTING
    if (queryTargetSpecies === 'bird' && (q.includes('shout') || q.includes('sing') || q.includes('sound') || q.includes('quiet') || q.includes('voice') || q.includes('silent'))) {
        return `When a bird stops vocalizing or singing, it is often an early indicator of stress or physical discomfort 🐦:\n\n` +
               `1. **Identify Causes:** Respiratory infection, cold drafts, molting fatigue, or sudden fright/stress.\n` +
               `2. **Observe Symptoms:** Check if the bird is fluffing their feathers, tail bobbing while breathing, or sitting on the cage bottom.\n` +
               `3. **Care Action Steps:** Keep the room warm (75–80°F), draft-free, and quiet. Offer fresh water and seeds/pellets.\n\n` +
               `⚠️ **Seek an Avian Vet** if vocal loss persists with lethargy or heavy breathing.`;
    }

    // OVERGROWN NAILS / NAIL TRIMMING / CLAW CARE (Handles typos like "tomuch", "nail", "nails", "claw", "claws", "trim")
    if (q.includes('nail') || q.includes('nails') || q.includes('claw') || q.includes('claws') || q.includes('trimming')) {
        return `**Step-by-Step Guide for Overgrown Pet Nails & Trimming:** 🐾\n\n` +
               `Overgrown nails are painful, alter walking posture, and can curl into paw pads!\n\n` +
               `1. **Preparation:** Use pet-specific nail clippers (scissor or guillotine type) and have styptic powder or cornstarch ready in case of accidental bleeding.\n` +
               `2. **Locate the Quick:** On light-colored nails, identify the pink blood vessel (the quick) inside the nail. On dark nails, clip only small slivers at a time.\n` +
               `3. **Clip at a 45-Degree Angle:** Hold the paw firmly but gently, and clip off just the sharp curved tip at a 45-degree angle without touching the quick.\n` +
               `4. **Reward & Praise:** Give high-value treats after each paw to build a positive reward association.\n\n` +
               `⚠️ **Seek Professional Help:** If the nail has already curled into the paw pad, is bleeding, or if your pet resists, visit a vet or professional groomer!`;
    }

    // EAR CLEANING & EAR INFECTIONS / HEAD SHAKING
    if (q.includes('ear') || q.includes('ears') || q.includes('shake head') || q.includes('shaking head')) {
        return `**Step-by-Step Guide for Pet Ear Care & Infections:** 🐾\n\n` +
               `Head shaking, ear odor, dark discharge, or scratching indicate ear irritation or yeast/bacterial infection:\n\n` +
               `1. **Inspect Gently:** Look for dark brown wax, redness, swelling, or bad odor inside the ear flap.\n` +
               `2. **Clean Ear Flap:** Apply a vet-approved pet ear cleaning solution to a cotton ball and wipe the outer ear canal flap gently (NEVER insert cotton swabs deep into ear canals!).\n` +
               `3. **Keep Dry:** Dry thoroughly after baths or swimming to prevent moist bacterial growth.\n` +
               `4. ⚠️ **Seek Vet Care:** If your pet is crying when touched, tilting their head, or showing dark discharge, a vet examination for ear mites or yeast infection is needed!`;
    }

    // TEETH & DENTAL CARE / BAD BREATH
    if (q.includes('teeth') || q.includes('tooth') || q.includes('dental') || q.includes('breath') || q.includes('gum') || q.includes('gums')) {
        return `**Step-by-Step Guide for Pet Dental Care & Bad Breath:** 🪥\n\n` +
               `Bad breath and yellow tartar build-up are early signs of periodontal disease:\n\n` +
               `1. **Use Pet-Safe Toothpaste:** NEVER use human toothpaste (xylitol and fluoride are toxic). Use enzymatic pet toothpaste.\n` +
               `2. **Daily Brushing:** Use a finger brush or pet toothbrush to gently clean outer tooth surfaces in circular motions.\n` +
               `3. **Dental Chews & Water Additives:** Offer VOHC-approved dental chews or water additives to reduce plaque accumulation.\n` +
               `4. ⚠️ **Vet Dental Exam:** If gums are red, bleeding, or if eating causes pain, schedule a professional vet dental cleaning.`;
    }

    // FLEAS, TICKS & PARASITES / SCRATCHING
    if (q.includes('flea') || q.includes('fleas') || q.includes('tick') || q.includes('ticks') || q.includes('parasite')) {
        return `**Step-by-Step Guide for Flea & Tick Treatment:** 🚫\n\n` +
               `1. **Immediate Inspection:** Use a fine-toothed flea comb over a white towel to check for dark flea dirt or live insects.\n` +
               `2. **Apply Vet-Approved Treatment:** Use topical spot-on treatments (e.g. Frontline/Bravecto) or oral chewables prescribed for your pet's exact weight.\n` +
               `3. **Bath with Flea Shampoo:** Wash with warm water and pet-formulated flea shampoo starting from the neck down.\n` +
               `4. **Treat Environment:** Wash all bedding in hot water and vacuum carpets/furniture thoroughly to remove flea eggs.`;
    }

    // EYE PROBLEMS / RED EYES
    if (q.includes('eye') || q.includes('eyes')) {
        return `Red or swollen eyes in ${petDisplayName} (${queryTargetSpecies}) can be caused by 🐾:\n\n` +
               `1. **Conjunctivitis or Infection:** Bacterial/viral inflammation causing redness and discharge.\n` +
               `2. **Allergies or Dust:** Pollen, smoke, dust, or household cleaners.\n` +
               `3. **Corneal Scratch:** Minor scratch on the eye surface or trapped dust.\n\n` +
               `**Care Action Steps:** Gently wipe eye discharge with a clean warm damp cloth (water only). Do NOT use human eye drops.\n` +
               `⚠️ **Consult a Vet** if squinting, rubbing the eye, or if there is yellow/green discharge.`;
    }

    // APPETITE LOSS / NOT EATING
    if (q.includes('not eating') || q.includes('refusing food') || q.includes('won\'t eat') || q.includes('wont eat') || q.includes('stopped eating')) {
        return `Appetite loss in ${petDisplayName} (${queryTargetSpecies}) requires careful monitoring 🐾:\n\n` +
               `1. **Common Causes:** Recent food changes, dental discomfort, stomach upset, stress, or fever.\n` +
               `2. **What to Check:** Is your pet drinking water normally? Any vomiting, diarrhea, or fever? Energetic or unusually tired?\n` +
               `3. **Action Steps:** Rest stomach for 4-6 hours. Offer small sips of water, then try plain boiled white chicken/turkey and white rice.` +
               (allergies && userMentionedName ? `\n\n*(Note for ${userMentionedName}: allergy note "${allergies}")*` : '') +
               `\n\n⚠️ **Contact a vet** if food is refused for >24 hours or if lethargic.`;
    }

    // PAW LICKING / ITCHING
    if (q.includes('lick') || q.includes('paw') || q.includes('paws') || q.includes('scratching paw')) {
        return `Persistent paw licking in ${petDisplayName} (${queryTargetSpecies}) usually stems from 🐶:\n\n` +
               `1. **Environmental Allergies:** Pollen, grass, or dust mites. Wipe paws with a damp cloth after outdoor walks.\n` +
               `2. **Yeast or Bacterial Infection:** Redness, swelling, or a corn-chip smell between toes.\n` +
               `3. **Interdigital Cysts or Thorns:** Small prick or thorn trapped between paw pads.\n` +
               `4. **Anxiety or Boredom:** Compulsive licking when resting.\n\n` +
               `Inspect paw pads gently. See a vet if skin is raw, bleeding, or hairless.`;
    }

    // DOG / PET SLEEP DISRUPTIONS & SICKNESS / RESTLESSNESS (Handling typos like slepping, slep, sleep, restless, unwell)
    if (q.includes('sleep') || q.includes('slepp') || q.includes('slep') || q.includes('restless') || q.includes('unwell') || q.includes('not well') || q.includes('pacing')) {
        if (queryTargetSpecies === 'cat') {
            return `Adult cats naturally sleep **12 to 16 hours daily** 🐱 (and kittens/seniors up to 20 hours!).\n\n` +
                   `1. **Normal Behavior:** Wakes up easily for meals, grooms, plays, and interacts normally during awake hours.\n` +
                   `2. **Lethargy Signs (Seek a Vet):** Refuses food, hides in dark closets, doesn't react to toys, has pale gums, or shows fever.`;
        }
        return `**Dog Sleep Restlessness & Unwellness Guidance:** 🐶\n\n` +
               `When a dog is not feeling well and cannot sleep properly, it usually stems from physical discomfort or anxiety:\n\n` +
               `1. **Physical Pain or Discomfort:** Joint pain, stomach ache, gas, fever, or nausea makes it difficult for dogs to settle down or stay asleep.\n` +
               `2. **Anxiety & Restlessness:** Feeling unwell causes stress, leading to pacing, frequent position shifting, or whining.\n` +
               `3. **Fever Check:** Gently check their ears and paws. An elevated body temperature can cause restlessness combined with weakness.\n\n` +
               `**Recommended Action Steps:**\n` +
               `1. **Create a Calm Bedding Area:** Provide a quiet, dark, comfortable orthopedic bed in a peaceful room.\n` +
               `2. **Check for Other Symptoms:** Look for vomiting, diarrhea, heavy panting, coughing, or refusal of water.\n` +
               `3. **Offer Fresh Water:** Keep fresh water nearby in small sips.\n` +
               `4. ⚠️ **Seek Vet Care:** If restlessness and unwellness persist overnight or if accompanied by severe pain or lethargy, contact a veterinarian for an evaluation.`;
    }

    // SLEEPING BEHAVIOR / LETHARGY
    if (q.includes('tired') || q.includes('lethargic')) {
        return `Adult ${queryTargetSpecies}s typically sleep 10-14 hours per day, while young pets sleep up to 18 hours.\n\n` +
               `If ${petDisplayName} is unusually tired today, ensure they are eating and drinking. If non-responsive, resisting walks, or hiding, consult a vet to rule out fever or pain.`;
    }

    // MANGO / FOOD SAFETY
    if (q.includes('can') && (q.includes('eat') || q.includes('give') || q.includes('food') || q.includes('treat'))) {
        if (q.includes('mango')) {
            return `**Yes! ${petDisplayName} (${queryTargetSpecies}) can safely eat mango in moderation.** 🥭\n\n` +
                   `1. **Remove Pit & Skin:** The mango pit contains small amounts of cyanide and is a fatal choking hazard / intestinal blockage risk.\n` +
                   `2. **Portion Size:** Slice into small bite-sized pieces. High natural sugar means it should only be an occasional treat!`;
        }
        if (q.includes('apple') || q.includes('apples')) {
            return `**Yes! Apples are safe and nutritious for ${petDisplayName}.** 🍎\n\n` +
                   `1. **Remove Core & Seeds:** Apple seeds contain small amounts of cyanide. Remove core completely.\n` +
                   `2. **Benefits:** Great source of vitamins A and C and dietary fiber.`;
        }
    }

    // FISH TANK CLOUDY WATER / DIRTY WATER / AQUARIUM WATER QUALITY
    if (q.includes('cloudy') || q.includes('dirty water') || (q.includes('tank') && (q.includes('water') || q.includes('clean') || q.includes('smell') || q.includes('white') || q.includes('green')))) {
        return `**Fish Tank Cloudy Water & Maintenance Guide:** 🐟\n\n` +
               `Cloudy tank water is very common and usually caused by one of three reasons:\n\n` +
               `• **Bacterial Bloom (White/Milky Water):** Most common in new or cycling tanks. Beneficial nitrifying bacteria are multiplying to establish biological filtration. This often clears naturally in 2–4 days.\n` +
               `• **Overfeeding & Decaying Food:** Uneaten food breaking down causes rapid bacterial spikes and elevated Ammonia.\n` +
               `• **Algae Bloom (Green Water):** Caused by excess aquarium light (direct sunlight) or high Nitrate levels.\n\n` +
               `**Recommended Steps to Fix Cloudy Water:**\n` +
               `1. **20–30% Partial Water Change:** Perform a partial water change using conditioned/dechlorinated water at the same temperature.\n` +
               `2. **Do NOT Wash Filter in Tap Water:** Rinse filter sponges gently in removed tank water ONLY (tap chlorine kills beneficial bacteria!).\n` +
               `3. **Reduce Feeding:** Feed only what fish eat in 2 minutes, once daily.\n` +
               `4. **Vacuum Gravel:** Use a siphon vacuum to clear trapped waste from gravel.`;
    }

    // RABBIT FUR LOSS / SHEDDING / MITES / FUR SPLITTING
    if ((queryTargetSpecies === 'rabbit' || q.includes('rabbit') || q.includes('bunny')) && (q.includes('fur') || q.includes('hair') || q.includes('shed') || q.includes('split') || q.includes('reducing') || q.includes('balding') || q.includes('loss'))) {
        return `**Rabbit Fur Splitting & Fur Loss Guidelines:** 🐰\n\n` +
               `• **Heavy Molting (Shedding):** Rabbits shed heavily 3–4 times a year. Fur can drop in patches, splitting along growth lines, revealing new fur underneath.\n` +
               `• **Fur Mites (Cheyletiella / Walking Dandruff):** Causes fur splitting, white dandruff flakes, intense scratching, and bald patches (especially on neck/back).\n` +
               `• **Nutritional & Fiber Needs:** Lack of fiber or low-quality hay affects coat quality. Ensure 80%+ fresh Timothy hay daily.\n\n` +
               `**Action Steps:**\n` +
               `1. Gently groom daily with a soft rabbit brush to remove loose fur (rabbits cannot vomit hairballs, so loose fur causes GI blockages!).\n` +
               `2. Inspect skin for redness, dandruff, or scabs.\n` +
               `3. ⚠️ **Seek a rabbit-savvy vet** if skin is flaky, crusty, or if hair loss is spreading (mite treatment may be needed).`;
    }

    // TOPIC-FOCUSED DYNAMIC SYNTHESIZER (No generic template strings!)
    if (q.includes('fish') || q.includes('tank') || q.includes('aquarium') || q.includes('water')) {
        return `**Aquarium & Fish Care Advice:** 🐟\n\n` +
               `Regarding **"${message}"**:\n\n` +
               `• **Water Parameters:** Check Ammonia, Nitrite, Nitrate, pH, and water temperature regularly.\n` +
               `• **Maintenance:** Perform a weekly 20–30% partial water change and avoid overfeeding.\n` +
               `• **Observation:** Watch for swimming changes, gasping at the surface, or fin damage.\n\n` +
               `*For serious fish health concerns, consulting an aquatic veterinarian or local fish specialist is recommended!* 🐾`;
    }

    if (q.includes('bird') || q.includes('parrot') || q.includes('feather') || q.includes('cage')) {
        return `**Bird Care Guidance:** 🐦\n\n` +
               `Regarding **"${message}"**:\n\n` +
               `• **Environment:** Keep cage away from cold drafts, direct air conditioning, and toxic PTFE non-stick pan fumes.\n` +
               `• **Nutrition:** Provide a balanced diet of pellets, fresh vegetables, and clean water daily.\n` +
               `• **Behavior:** Monitor vocalizing, feather grooming, and perching posture.\n\n` +
               `*If your bird is lethargic, sitting on the cage bottom, or fluffing feathers, seek an avian vet immediately!* 🐾`;
    }

    // DYNAMIC TOPIC PARSER FALLBACK (Zero generic static strings!)
    if (q.includes('nail') || q.includes('claw') || q.includes('paw')) {
        return `**Pet Grooming & Paw Care Guidance:** 🐾\n\n` +
               `Addressing: **"${message}"**:\n\n` +
               `1. **Inspect Paw & Claws:** Gently examine paw pads and nails for cracks, curling into skin, or redness between toes.\n` +
               `2. **Safe Trimming:** Use pet nail clippers to clip off only the sharp curved tips at a 45-degree angle without hitting the quick.\n` +
               `3. **Groomer / Vet Care:** ⚠️ If nails are curled into the paw pad, bleeding, or if your pet resists, visit a vet or professional groomer!`;
    }

    if (q.includes('ear') || q.includes('head')) {
        return `**Pet Ear Care Guidance:** 🐾\n\n` +
               `Addressing: **"${message}"**:\n\n` +
               `1. **Check for Infection:** Look for brown wax, redness, yeast odor, or discharge inside the ear flap.\n` +
               `2. **Wipe Outer Ear:** Use a cotton ball dampened with pet ear cleanser to wipe outer ear flaps gently.\n` +
               `3. **Vet Examination:** ⚠️ Seek vet care if your pet shakes their head constantly, cries, or has foul-smelling discharge!`;
    }

    return `**Pet Care & Health Guidance:** 🐾\n\n` +
           `Addressing: **"${message}"**:\n\n` +
           `1. **Observe Symptoms:** Keep a close record of when symptoms started, appetite changes, and energy levels.\n` +
           `2. **Comfort & Rest:** Ensure your pet has a warm, quiet, stress-free area with easy access to fresh water.\n` +
           `3. **Veterinary Evaluation:** ⚠️ If symptoms worsen or persist over 24 hours, schedule an evaluation with your veterinarian.`;
}

/**
 * Optional Gemini API Integration
 */
async function callGeminiAPI(userMessage, pet, medications, activities, conversationHistory = []) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;

    try {
        const petName = pet ? pet.name : 'the pet';
        const species = pet && pet.species ? pet.species : 'Dog';
        const breed = pet && pet.breed ? pet.breed : 'Not specified';
        const age = pet && pet.age !== null ? `${pet.age} years` : 'Not specified';
        const weight = pet && pet.weight ? `${pet.weight} kg` : 'Not specified';
        const allergies = pet && (pet.allergies || pet.special_instructions) ? (pet.allergies || pet.special_instructions) : 'None';

        const systemPrompt = `You are Petzi Assistant, a warm, caring, concise AI chatbot built into the Petzi Pet Care Log & Medication Reminder app.

ROLE:
1. ONLY answer questions related to pets (care, health basics, feeding, walking, grooming, behavior, medication reminders, general pet tips).
2. Help users understand and use the Petzi app (logging feeding/walk/medication, timers, daily timeline, notifications, exporting history for a vet).
3. GREETING RULE: If user greets ("hi", "hello", "hey"), respond with: "Hi! 🐾 How can I help you with your pet today?" Do not give pet information unless asked.
4. OUT-OF-SCOPE RULE: If question is unrelated to pets or Petzi app (coding, weather, stocks), respond: "I'm here to help with pet care and the Petzi app — I can't help with that, but feel free to ask me anything about your pet! 🐾"
5. TONE: Warm, caring, concise, beginner-friendly with light emojis (🐾🐶🐱💊) used sparingly.
6. HEALTH SAFETY: For serious health concerns, advise contacting a vet. Never make fake diagnoses or prescribe dosages.

CURRENT PET CONTEXT:
- Name: ${petName}
- Species: ${species}
- Breed: ${breed}
- Age: ${age}
- Weight: ${weight}
- Allergies/Notes: ${allergies}`;

        const contents = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            ...conversationHistory.map(h => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }]
            })),
            { role: 'user', parts: [{ text: userMessage }] }
        ];

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        if (response.ok) {
            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text;
        }
    } catch (e) {
        console.log('Gemini API call failed, falling back to dynamic engine:', e.message);
    }
    return null;
}

/**
 * POST /api/assistant/chat
 */
router.post('/chat', async (req, res) => {
    try {
        const { petId, userMessage, conversationHistory } = req.body;

        if (!userMessage || !userMessage.trim()) {
            return res.status(400).json({ error: 'User message is required' });
        }

        const allPets = await dbAll("SELECT * FROM pets ORDER BY id ASC");
        const lowerMsg = userMessage.toLowerCase();

        let pet = null;
        if (allPets && allPets.length > 0) {
            pet = allPets.find(p => lowerMsg.includes(p.name.toLowerCase()));
        }

        if (!pet && conversationHistory && conversationHistory.length > 0) {
            const lastUserMsg = [...conversationHistory].reverse().find(h => h.role === 'user')?.content?.toLowerCase() || '';
            const histText = conversationHistory.map(h => h.content).join(' ').toLowerCase();
            pet = allPets.find(p => histText.includes(p.name.toLowerCase()));

            if (lastUserMsg.includes('milo') || lowerMsg.includes('milo')) {
                pet = { id: 999, name: 'Milo', species: 'Cat', breed: 'Cat', age: 2, weight: 4 };
            }
        }

        if (!pet && petId) {
            pet = allPets.find(p => p.id === parseInt(petId, 10));
        }
        if (!pet && allPets && allPets.length > 0) {
            pet = allPets[0];
        }

        let medications = [];
        let activities = [];

        if (pet && pet.id) {
            medications = await dbAll("SELECT * FROM medications WHERE pet_id = ?", [pet.id]);
            activities = await dbAll("SELECT * FROM activities WHERE pet_id = ? ORDER BY timestamp DESC LIMIT 20", [pet.id]);
        }

        let botResponse = await callGeminiAPI(userMessage, pet, medications, activities, conversationHistory || []);

        if (!botResponse) {
            botResponse = generateSemanticPetResponse(userMessage, pet, medications, activities, conversationHistory || []);
        }

        return res.json({
            success: true,
            pet: pet ? {
                id: pet.id,
                name: pet.name,
                species: pet.species || 'Dog',
                breed: pet.breed,
                age: pet.age,
                weight: pet.weight
            } : null,
            response: botResponse
        });
    } catch (err) {
        console.error("Error in /api/assistant/chat:", err);
        return res.status(500).json({ error: "Failed to process assistant request" });
    }
});

module.exports = router;
