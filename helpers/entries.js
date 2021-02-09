const axios = require('axios');
const { API_URL } = require('../config');

const updateIndRating = async (entry, category) => {
    const res = await axios.get(`${API_URL}/user/${entry.player}`);
    let newRating = res.data.perfs[category].rating;
    if (!newRating) newRating = 0;
    entry.rating = newRating;
    return entry;
}

module.exports = { updateIndRating };