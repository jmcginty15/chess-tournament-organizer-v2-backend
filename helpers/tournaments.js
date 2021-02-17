const { cloneDeep } = require('lodash');
const db = require('../db');

const batchify = (entries, batchSize) => {
    const batches = [];
    while (entries.length > batchSize) batches.push(entries.splice(0, batchSize));
    if (entries.length) batches.push(entries);
    return batches;
}

const unbatchify = (batches) => {
    let entries = [];
    let i = 0;
    while (i < batches.length) {
        entries = [...entries, ...batches[i]];
        i++;
    }
    return entries;
}

const delay = (ms) => {
    const now = new Date;
    let later = null;
    do later = new Date;
    while (later - now < ms);
}

const getCategory = (timeControl) => {
    const [startingTimeStr, incrementStr] = timeControl.split('|');
    const startingTime = parseFloat(startingTimeStr);
    const increment = parseFloat(incrementStr);
    const adjustedTime = startingTime + 40 * (increment / 60);

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

const assignInitialPlaces = (entries) => {
    const groupCount = Math.floor(entries.length / 2);
    const groups = [];
    for (let i = 0; i < groupCount; i++) groups.push([]);
    const smallGroupSize = Math.floor(entries.length / groupCount);
    const largeGroupSize = smallGroupSize + 1;
    const largeGroupCount = entries.length % groupCount;

    let groupsFilled = 0;
    for (let entry of entries) {
        const groupSize = groupsFilled < largeGroupCount ? largeGroupSize : smallGroupSize;
        groups[groupsFilled].push(entry);
        if (groups[groupsFilled].length === groupSize) groupsFilled++;
    }

    const orderedEntries = [];
    let group = 0;
    while (orderedEntries.length < entries.length) {
        orderedEntries.push(groups[group].shift());
        group++;
        if (group === groupCount) group = 0;
    }

    return orderedEntries;
}

// TCEC Swiss system pairing algorithm
const generatePairings = (entries, nextRound) => {
    const comma = nextRound === 1 ? '' : ',';

    // STEP 1:
    // if there is an odd number of entries, give a bye to the lowest-ranked player who has not yet received one
    // remove this entry from the list so they will not receive a pairing
    let byeIndex = null;
    if (entries.length % 2 !== 0) byeIndex = findBye(entries);
    let bye = null;
    if (byeIndex) {
        bye = entries.splice(byeIndex, 1)[0];
        bye.prevOpponents += `${comma}B`;
        bye.prevColors += `${comma}-`;
    }

    // STEP 2:
    // generate pairings
    const pairings = [];
    while (entries.length) {
        const e1 = entries.shift();
        const prevOpponents = e1.prevOpponents.split(',');
        const prevColors = e1.prevColors.split(',');
        e1.colorBalance = getColorBalance(prevColors);

        let e2 = null;
        let i = 0;
        while (i < entries.length) {
            const nextEntry = entries[i];

            // if e1 has already played nextEntry, it is not an allowable pairing
            // increment the index and continue to the next entry
            if (nextEntry.player) {
                if (prevOpponents.indexOf(nextEntry.player) !== -1) {
                    i++;
                    continue;
                }
            } else {
                if (prevOpponents.indexOf(nextEntry.id.toString()) !== -1) {
                    i++;
                    continue;
                }
            }

            // if the color balances for each player are not compatible, it is not an allowable pairing
            // increment the index and continue to the next entry
            // the algorithm keeps the color balance for all players always between -2 and 2
            const nextPrevColors = nextEntry.prevColors.split(',');
            nextEntry.colorBalance = getColorBalance(nextPrevColors);
            let compatible = true;
            if ((e1.colorBalance === 2 && nextEntry.colorBalance > 0) || (nextEntry.colorBalance === 2 && e1.colorBalance > 0)) compatible = false;
            if ((e1.colorBalance === -2 && nextEntry.colorBalance < 0) || (nextEntry.colorBalance === -2 && e1.colorBalance < 0)) compatible = false;
            if (!compatible) {
                i++;
                continue;
            }

            // if color balances are compatible,
            // check if the rest of the entries can produce a valid set of pairings
            // if not, it is not an allowable pairing
            // increment the index and continue to the next entry
            const remainingEntries = cloneDeep(entries);
            remainingEntries.splice(i, 1);
            if (remainingEntries.length > 0 && !isValid(remainingEntries, nextRound)) {
                i++;
                continue;
            }

            // if remainder is valid, choose the current entry as the second of the pair
            e2 = entries.splice(i, 1)[0];
            break;
        }

        pairings.push([e1, e2]);
    }

    // STEP 3:
    // determine pairing colors
    const finalPairings = [];
    for (let pairing of pairings) {
        const p1 = pairing[0];
        const p2 = pairing[1];

        if (p1.player && p2.player) {
            p1.prevOpponents += `${comma}${p2.player}`;
            p2.prevOpponents += `${comma}${p1.player}`;
        } else {
            p1.prevOpponents += `${comma}${p2.id}`;
            p2.prevOpponents += `${comma}${p1.id}`;
        }

        // if color balances are unequal, give the white pieces to the player with the lesser color balance
        if (p1.colorBalance > p2.colorBalance) {
            finalPairings.push({ white: p2, black: p1 });
            p1.prevColors += `${comma}B`;
            p2.prevColors += `${comma}W`;
        }
        if (p1.colorBalance < p2.colorBalance) {
            finalPairings.push({ white: p1, black: p2 });
            p1.prevColors += `${comma}W`;
            p2.prevColors += `${comma}B`;
        }

        // if color balances are equal
        // give the white pieces to the higher ranked player on rounds 1, 4, 5, 8, 9, 12, 13, ...
        if (p1.colorBalance === p2.colorBalance) {
            if (nextRound % 4 === 0 || (nextRound - 1) % 4 === 0) {
                finalPairings.push({ white: p1, black: p2 });
                p1.prevColors += `${comma}W`;
                p2.prevColors += `${comma}B`;
            } else {
                // give the white pieces to the lower ranked player on rounds 2, 3, 6, 7, 10, 11, 14, ...
                finalPairings.push({ white: p2, black: p1 });
                p1.prevColors += `${comma}B`;
                p2.prevColors += `${comma}W`;
            }
        }
    }

    if (bye) finalPairings.push({ bye: bye });
    return finalPairings;
}

const findBye = (entries) => {
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i].prevOpponents.indexOf('B') === -1) return i;
    return null;
}

// calculate the difference between games with the white pieces and games with the black pieces
// if a player has more games with the white pieces, the balance will be positive
// if a player has more games with the black pieces, the balance will be negative
// if a player has the same number of games with both colors, the balance will be zero
const getColorBalance = (colorArray) => {
    let balance = 0;
    for (let color of colorArray) {
        if (color === 'W') balance++;
        else if (color === 'B') balance--;
    }
    return balance;
}

const assignTeams = (entries, teamCount) => {
    const teams = [];
    for (let i = 0; i < teamCount; i++) teams.push([]);

    let countingUp = true;
    let i = 0;
    for (let entry of entries) {
        teams[i].push(entry);
        if (countingUp) {
            if (i === teamCount - 1) countingUp = false;
            else i++;
        } else {
            if (i === 0) countingUp = true;
            else i--;
        }
    }
    return teams;
}

const averageRating = (players) => {
    let sum = 0;
    for (let player of players) sum += player.rating;
    return sum / players.length;
}

const isValid = (entries, nextRound) => {
    try {
        generatePairings(entries, nextRound);
        return true;
    } catch {
        return false;
    }
}

const calculateSonnebornBergerScore = async (entry, games) => {
    let sonnebornBergerScore = 0;

    for (let game of games) {
        if (game.white === entry.id) {
            const oppRes = await db.query(`SELECT score
                FROM ind_entries
                WHERE id = $1`, [game.black]);
            const opp = oppRes.rows[0];

            if (game.result === '1-0') sonnebornBergerScore += opp.score;
            else if (game.result === '0.5-0.5') sonnebornBergerScore += opp.score / 2;
        } else if (game.black === entry.id) {
            const oppRes = await db.query(`SELECT score
                FROM ind_entries
                WHERE id = $1`, [game.white]);
            const opp = oppRes.rows[0];

            if (game.result === '0-1') sonnebornBergerScore += opp.score;
            else if (game.result === '0.5-0.5') sonnebornBergerScore += opp.score / 2;
        }
    }

    return sonnebornBergerScore;
}

module.exports = {
    batchify,
    unbatchify,
    delay,
    getCategory,
    getRating,
    assignInitialPlaces,
    generatePairings,
    assignTeams,
    averageRating,
    calculateSonnebornBergerScore
};