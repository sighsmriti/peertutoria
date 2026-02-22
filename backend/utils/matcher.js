function calculateMatch(tutor, request) {
    let score = 0;

    // Skill match (40%)
    if (tutor.skills.includes(request.subject)) {
        score += 40;
    }

    // Rating quality (25%)
    score += (tutor.rating / 5) * 25;

    // Rating confidence (10%) → more ratings = more trust
    const confidence = Math.min(tutor.rating_count / 20, 1);
    score += confidence * 10;

    // Experience XP (20%) → smooth scale
    const expNormalized = Math.min(tutor.xp / 300, 1);
    score += expNormalized * 20;

    // Online bonus (5%)
    if (tutor.is_online) score += 5;

    return Math.round(score);
}

function rankTutors(tutors, request) {
    return tutors
        .map(t => ({
            ...t,
            matchPercent: calculateMatch(t, request)
        }))
        .sort((a, b) => b.matchPercent - a.matchPercent);
}

module.exports = { rankTutors };
