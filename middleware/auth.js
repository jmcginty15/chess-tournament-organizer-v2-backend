const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../config');
const ExpressError = require('../expressError');
const IndTournament = require('../models/ind_tournament');
const TeamTournament = require('../models/team_tournament');
const IndGame = require('../models/ind_game');
const TeamGame = require('../models/team_game');
const Match = require('../models/match');
const Team = require('../models/team');

const authenticateJWT = (req, res, next) => {
    /** Checks the validity of the jwt sent with the request and assigns a user property to the request */
    try {
        const token = req.body._token;
        if (token) req.user = jwt.verify(token, SECRET_KEY);
        return next();
    } catch (err) {
        return next(err);
    }
}

const ensureLoggedIn = (req, res, next) => {
    /** Throws an error if no token is sent with the request */
    try {
        if (!req.user) throw new ExpressError('Unauthorized', 401);
        return next();
    } catch (err) {
        return next(err);
    }
}

const ensureCorrectUser = (req, res, next) => {
    /** Throws an error if the token sent with the request does not belong to the user in the request params  */
    try {
        if (req.user.username !== req.params.username) throw new ExpressError('Unauthorized', 401);
        return next();
    } catch (err) {
        return next(err);
    }
}

const ensureTournamentDirector = async (req, res, next) => {
    /** Throws an error if the token sent with the request does not belong to the director of the tournament */
    try {
        if (req.params.id) {
            const { id } = req.params;
            const tournament = await IndTournament.getById(id);
            if (!req.user || req.user.username !== tournament.director) throw new ExpressError('Unauthorized', 401);
        } else if (req.params.gameId) {
            const { gameId } = req.params;
            const game = await IndGame.getById(gameId);
            const tournament = await IndTournament.getById(game.tournament);
            if (!req.user || req.user.username !== tournament.director) throw new ExpressError('Unauthorized', 401);
        }
        return next();
    } catch (err) {
        return next(err);
    }
}

const ensureTeamTournamentDirector = async (req, res, next) => {
    /** Throws an error if the token sent with the request does not belong to the director of the team tournament */
    try {
        if (req.params.id) {
            const { id } = req.params;
            const tournament = await TeamTournament.getById(id);
            if (!req.user || req.user.username !== tournament.director) throw new ExpressError('Unauthorized', 404);
        } else if (req.params.gameId) {
            const { gameId } = req.params;
            const game = await TeamGame.getById(gameId);
            const match = await Match.getById(game.match);
            const tournament = await TeamTournament.getById(match.tournament);
            if (!req.user || req.user.username !== tournament.director) throw new ExpressError('Unauthorized', 404);
        }
        return next();
    } catch (err) {
        return next(err);
    }
}

const ensureGameParticipant = async (req, res, next) => {
    /** Throws an error if the token sent with the request does not belong to one of the game participants */
    try {
        const { id } = req.params;
        const participants = await IndGame.getParticipants(id);
        if (!req.user || (req.user.username !== participants.white.player && req.user.username !== participants.black.player)) {
            throw new ExpressError('Unauthorized', 401);
        }
        return next();
    } catch (err) {
        return next(err);
    }
}

const ensureTeamGameParticipant = async (req, res, next) => {
    /** Throws an error if the token sent with the request does not belong to one of the participants in a team game */
    try {
        const { id } = req.params;
        const participants = await TeamGame.getParticipants(id);
        if (!req.user || (req.user.username !== participants.white.player && req.user.username !== participants.black.player)) {
            throw new ExpressError('Unauthorized', 401);
        }
        return next();
    } catch (err) {
        return next(err);
    }
}

const ensureTeamMember = async (req, res, next) => {
    /** Throws an error if the token sent with the request does not belong to a member of the team */
    try {
        const { id } = req.params;
        const team = await Team.getById(id);
        for (let member of team.members) if (member.player === req.user.username) return next();
        throw new ExpressError('Unauthorized', 401);
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    authenticateJWT,
    ensureLoggedIn,
    ensureCorrectUser,
    ensureTournamentDirector,
    ensureTeamTournamentDirector,
    ensureGameParticipant,
    ensureTeamGameParticipant,
    ensureTeamMember
};