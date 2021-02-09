const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../config');
const ExpressError = require('../expressError');

const authenticateJWT = (req, res, next) => {
    try {
        const token = req.body._token;
        if (token) req.user = jwt.verify(token, SECRET_KEY);
        return next();
    } catch (err) {
        return next(err);
    }
}

const ensureLoggedIn = (req, res, next) => {
    try {
        if (!req.user) throw new ExpressError('Unauthorized', 401);
        return next();
    } catch (err) {
        return next(err);
    }
}

const ensureCorrectUser = (req, res, next) => {
    try {
        if (req.user.username !== req.params.username) throw new ExpressError('Unauthorized', 401);
        return next();
    } catch (err) {
        return next(err);
    }
}

module.exports = { authenticateJWT, ensureLoggedIn, ensureCorrectUser };