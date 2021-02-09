const getCategory = (timeControl) => {
    const [startingTimeStr, incrementStr] = timeControl.split('|');
    const startingTime = parseFloat(startingTimeStr);
    const increment = parseFloat(incrementStr);
    const adjustedTime = startingTime + 40 * increment;

    let category = '';
    if (adjustedTime < 0.5) category = 'ultrabullet';
    else if (adjustedTime < 3) category = 'bullet';
    else if (adjustedTime < 8) category = 'blitz';
    else if (adjustedTime < 25) category = 'rapid';
    else category = 'classical';

    return category;
}

const getRating = (ratings, category) => {
    const rating = ratings[category].rating;
    return rating;
}

module.exports = { getCategory, getRating };