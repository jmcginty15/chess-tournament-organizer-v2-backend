const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../config');

function createToken(user) {
    /** Creates a jwt for a user upon login */
    const payload = { username: user.username };
    return jwt.sign(payload, SECRET_KEY);
}

module.exports = { createToken };