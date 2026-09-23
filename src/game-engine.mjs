export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export function createDeck(random = Math.random) {
  const cards = SUITS.flatMap((suit, suitIndex) =>
    RANKS.map((rank, rankIndex) => ({ suit, rank, value: rankIndex + 2, red: suitIndex === 1 || suitIndex === 2 }))
  );
  for (let index = cards.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
}

export function card(code) {
  const rank = code[0].toUpperCase();
  const suit = { s: '♠', h: '♥', d: '♦', c: '♣' }[code[1].toLowerCase()];
  return { rank, suit, value: RANKS.indexOf(rank) + 2, red: suit === '♥' || suit === '♦' };
}

function combinations(items, count) {
  if (count === 0) return [[]];
  return items.flatMap((item, index) => combinations(items.slice(index + 1), count - 1).map(rest => [item, ...rest]));
}

function compareScores(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) - (right[index] || 0);
  }
  return 0;
}

function evaluateFive(cards) {
  const values = cards.map(item => item.value ?? item.v).sort((a, b) => b - a);
  const counts = values.reduce((result, value) => ({ ...result, [value]: (result[value] || 0) + 1 }), {});
  const groups = Object.entries(counts).map(([value, count]) => [count, Number(value)]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const unique = [...new Set(values)];
  if (unique[0] === 14) unique.push(1);
  let straightHigh = 0;
  for (let index = 0; index <= unique.length - 5; index++) {
    if (unique[index] - unique[index + 4] === 4) { straightHigh = unique[index]; break; }
  }
  const flush = cards.every(item => (item.suit ?? item.s) === (cards[0].suit ?? cards[0].s));
  const result = (category, kickers, name) => ({ score: [category, ...kickers], name, cards });
  if (flush && straightHigh) return result(8, [straightHigh], 'Straight Flush');
  if (groups[0][0] === 4) return result(7, [groups[0][1], groups[1][1]], 'Four of a Kind');
  if (groups[0][0] === 3 && groups[1][0] === 2) return result(6, [groups[0][1], groups[1][1]], 'Full House');
  if (flush) return result(5, values, 'Flush');
  if (straightHigh) return result(4, [straightHigh], 'Straight');
  if (groups[0][0] === 3) return result(3, [groups[0][1], ...groups.slice(1).map(group => group[1]).sort((a, b) => b - a)], 'Three of a Kind');
  if (groups[0][0] === 2 && groups[1][0] === 2) {
    const pairs = [groups[0][1], groups[1][1]].sort((a, b) => b - a);
    return result(2, [...pairs, groups[2][1]], 'Two Pair');
  }
  if (groups[0][0] === 2) return result(1, [groups[0][1], ...groups.slice(1).map(group => group[1]).sort((a, b) => b - a)], 'One Pair');
  return result(0, values, 'High Card');
}

export function evaluateHand(cards) {
  if (cards.length < 5 || cards.length > 7) throw new Error('A hand evaluation requires five to seven cards.');
  return combinations(cards, 5).map(evaluateFive).sort((a, b) => compareScores(b.score, a.score))[0];
}

export function compareHands(left, right) {
  return compareScores(left.score, right.score);
}

export function nextActiveSeat(players, from) {
  for (let offset = 1; offset <= players.length; offset++) {
    const seat = (from + offset) % players.length;
    if (!players[seat].folded && !players[seat].allIn) return seat;
  }
  return -1;
}

export function holdemPositions(players, dealer) {
  const smallBlind = nextActiveSeat(players, dealer);
  const bigBlind = nextActiveSeat(players, smallBlind);
  return {
    smallBlind,
    bigBlind,
    preflop: nextActiveSeat(players, bigBlind),
    postflop: nextActiveSeat(players, dealer)
  };
}

export function resolveRaise({ currentBet, minimumRaise, playerBet, stack, requested }) {
  const available = playerBet + stack;
  if (available <= currentBet) return { kind: 'call', target: available, reopens: false, nextMinimumRaise: minimumRaise, isAllIn: true };
  const target = Math.min(available, Math.max(currentBet + minimumRaise, requested));
  const increase = target - currentBet;
  const reopens = increase >= minimumRaise;
  return { kind: 'raise', target, reopens, nextMinimumRaise: reopens ? increase : minimumRaise, isAllIn: target === available };
}

// Multiple short all-ins cumulatively reopen action once they equal a full raise.
export function raiseIsReopened({ acted, currentBet, lastFacedBet, minimumRaise }) {
  return !acted || currentBet - lastFacedBet >= minimumRaise;
}

export function shouldRunoutBoard(players) {
  const live = players.filter(player => !player.folded);
  return live.length > 1 && live.filter(player => !player.allIn).length <= 1;
}

export function decideBotAction({ equity, need, pot, stack, minimumRaise, currentBet, raisesThisStreet = 0, canRaise = true }) {
  const potOdds = need / Math.max(1, pot + need);
  const raiseThreshold = raisesThisStreet === 0 ? 0.58 : raisesThisStreet === 1 ? 0.7 : 0.82;
  const mayRaise = canRaise && stack >= need + minimumRaise && equity >= raiseThreshold;
  if (need <= 0) {
    if (!mayRaise) return { type: 'call' };
    const raiseBy = Math.max(minimumRaise, Math.round(pot * (equity >= 0.82 ? 0.75 : 0.5) / 100) * 100);
    return { type: 'raise', target: currentBet + raiseBy };
  }
  if (equity + 0.04 < potOdds) return { type: 'fold' };
  if (!mayRaise) return { type: 'call' };
  const raiseBy = Math.max(minimumRaise, Math.round(pot * (equity >= 0.82 ? 0.75 : 0.5) / 100) * 100);
  return { type: 'raise', target: currentBet + raiseBy };
}

// Returns independent main/side-pot awards. Folded players contribute but cannot win.
export function settlePots(players, board, dealerIndex = 0) {
  const levels = [...new Set(players.map(player => player.committed).filter(Boolean))].sort((a, b) => a - b);
  const awards = new Map(players.map(player => [player.id, 0]));
  const pots = [];
  let previous = 0;
  for (const level of levels) {
    const contributors = players.filter(player => player.committed >= level);
    const amount = (level - previous) * contributors.length;
    const eligible = contributors.filter(player => !player.folded);
    if (!amount || !eligible.length) { previous = level; continue; }
    const ranked = eligible.map(player => ({ player, hand: evaluateHand([...player.hole, ...board]) }));
    ranked.sort((a, b) => compareHands(b.hand, a.hand));
    const winners = ranked.filter(entry => compareHands(entry.hand, ranked[0].hand) === 0);
    const share = Math.floor(amount / winners.length);
    let remainder = amount % winners.length;
    const clockwise = [...winners].sort((a, b) => ((a.player.seat - dealerIndex - 1 + players.length) % players.length) - ((b.player.seat - dealerIndex - 1 + players.length) % players.length));
    clockwise.forEach(entry => {
      awards.set(entry.player.id, awards.get(entry.player.id) + share + (remainder > 0 ? 1 : 0));
      remainder--;
    });
    pots.push({ amount, eligible: eligible.map(player => player.id), winners: winners.map(entry => entry.player.id), hand: ranked[0].hand.name, isRefund: contributors.length === 1 });
    previous = level;
  }
  return { awards: Object.fromEntries(awards), pots };
}
