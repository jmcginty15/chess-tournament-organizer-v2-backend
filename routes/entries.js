const express = require('express');
const IndEntry = require('../models/ind_entry');
const TeamEntry = require('../models/team_entry');

const ExpressError = require('../expressError');

const router = new express.Router();

module.exports = router;