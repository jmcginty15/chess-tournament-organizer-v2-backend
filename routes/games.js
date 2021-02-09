const express = require('express');
const IndGame = require('../models/ind_game');
const TeamGame = require('../models/team_game');

const ExpressError = require('../expressError');

const router = new express.Router();

module.exports = router;