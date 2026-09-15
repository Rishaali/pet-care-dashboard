function formatPetAge(petOrAge, dob) {
    let ageVal = null;
    let dobVal = null;

    if (typeof petOrAge === 'object' && petOrAge !== null) {
        ageVal = petOrAge.age;
        dobVal = petOrAge.date_of_birth || petOrAge.dob;
    } else {
        ageVal = petOrAge;
        dobVal = dob;
    }

    if (dobVal && !isNaN(Date.parse(dobVal))) {
        const dobDate = new Date(dobVal);
        const today = new Date();
        let years = today.getFullYear() - dobDate.getFullYear();
        let months = today.getMonth() - dobDate.getMonth();
        if (today.getDate() < dobDate.getDate()) months--;
        if (months < 0) { years--; months += 12; }
        if (years < 0) years = 0;

        if (years > 0 && months > 0) return `${years} ${years === 1 ? 'yr' : 'yrs'}, ${months} ${months === 1 ? 'mo' : 'mos'}`;
        if (years > 0) return `${years} ${years === 1 ? 'year' : 'years'}`;
        if (months > 0) return `${months} ${months === 1 ? 'month' : 'months'}`;
        return `Less than 1 mo`;
    }

    if (ageVal !== null && ageVal !== undefined && ageVal !== "") {
        const num = parseFloat(ageVal);
        if (!isNaN(num) && num >= 0) {
            const years = Math.floor(num);
            const fraction = num - years;
            let months = Math.round(fraction * 12);
            let finalYears = years;
            if (months === 12) { finalYears += 1; months = 0; }

            if (finalYears > 0 && months > 0) return `${finalYears} ${finalYears === 1 ? 'yr' : 'yrs'}, ${months} ${months === 1 ? 'mo' : 'mos'}`;
            if (finalYears > 0) return `${finalYears} ${finalYears === 1 ? 'year' : 'years'}`;
            if (months > 0) return `${months} ${months === 1 ? 'month' : 'months'}`;
            return `0 yrs`;
        }
    }

    return "Unknown Age";
}

console.log("Age 3 ->", formatPetAge({ age: 3 }));
console.log("Age 2.5 ->", formatPetAge({ age: 2.5 }));
console.log("Age 0.5 ->", formatPetAge({ age: 0.5 }));
console.log("Age 1.2 ->", formatPetAge({ age: 1.2 }));
console.log("DOB 2024-03-15 ->", formatPetAge({ date_of_birth: "2024-03-15" }));
