// i18n.js — German / English strings
'use strict';

const STR = {
  de: {
    tagline: 'Das Kartenspiel mit dem besten Gedächtnis gewinnt.',
    yourName: 'Dein Name', create: 'Neues Spiel erstellen', join: 'Spiel beitreten', joinRoom: 'Raum {code} beitreten',
    rules: 'Spielregeln', settings: 'Einstellungen', quick: 'Schnell gegen Bots',
    lobby: 'Lobby', room: 'Raum', shareHint: 'Schick diesen Link an deine Freunde:', copy: 'Kopieren', copied: 'Kopiert!', share: 'Teilen',
    players: 'Spieler', addBot: '+ Bot', start: 'Spiel starten', waitingHost: 'Warte, bis der Host startet…', needTwo: 'Mindestens 2 Spieler',
    easy: 'Gedächtnis-Hilfe', easyHint: 'Karten, die du schon gesehen hast, bleiben für dich offen.',
    offline: 'Keine Verbindung zum Multiplayer-Server – du kannst trotzdem gegen Bots spielen.',
    connecting: 'Verbinde…', reconnecting: 'Verbindung unterbrochen – verbinde neu…', hostGone: 'Der Host ist nicht erreichbar.',
    full: 'Das Spiel ist voll oder läuft bereits.', back: 'Zurück', leave: 'Verlassen',
    you: 'Du', host: 'Host', bot: 'Bot', round: 'Runde', deck: 'Stapel', discardPile: 'Ablage',
    peekTitle: 'Merk dir deine zwei unteren Karten!', ready: 'Bereit', waitingOthers: 'Warte auf die anderen…',
    yourTurn: 'Du bist dran – zieh vom Stapel oder nimm die Ablagekarte.',
    yourTurnCabo: 'Letzte Runde! Zieh eine Karte.',
    drawnDeck: 'Tausche mit einer deiner Karten – oder leg sie ab.',
    drawnDiscard: 'Wähle eine deiner Karten zum Tauschen.',
    act_peek: 'Schau dir eine deiner Karten an.', act_spy: 'Schau dir eine fremde Karte an.',
    act_swap: 'Wähle eine eigene und eine fremde Karte zum blinden Tauschen.',
    act_king: 'Wähle eine eigene und eine fremde Karte – du siehst beide.',
    act_kingDecide: 'Tauschen oder behalten?',
    waitTurn: '{name} ist dran…', waitDrawn: '{name} überlegt…',
    waitAct_peek: '{name} schaut eine eigene Karte an', waitAct_spy: '{name} spioniert…',
    waitAct_swap: '{name} tauscht blind…', waitAct_king: '{name} überlegt einen Königstausch…',
    cabo: 'CABO!', discard: 'Ablegen', skip: 'Überspringen', doSwap: 'Tauschen', keep: 'Behalten',
    snap: 'Abwerfen', snapPick: 'Welche Karte?', cancel: 'Abbrechen',
    name_peek: 'Gucken', name_spy: 'Spionieren', name_swap: 'Blind tauschen', name_king: 'König',
    calledCabo: '{name} ruft CABO!', youCalled: 'Du hast CABO gerufen!', lastRound: 'Letzte Runde',
    snapOk: '{name} wirft ab!', snapFail: 'Fehlwurf! {name} bekommt eine Strafkarte.',
    roundOver: 'Runde {n} vorbei', gameOver: 'Spiel vorbei!', winner: '{name} gewinnt!', youWin: 'Du gewinnst!',
    points: 'Punkte', total: 'Gesamt', caboOk: 'Cabo geschafft – 0 Punkte!', caboFail: 'Cabo verfehlt +10', lucky: 'Genau 100 → 50!',
    nextRound: 'Nächste Runde', newGame: 'Neues Spiel', toLobby: 'Zur Lobby', waitNext: 'Warte auf den Host…',
    hideScores: 'Karten ansehen', showScores: 'Wertung',
    deckStyle: 'Kartenblatt', st_classic: 'Französisch', st_tournament: 'Turnierbild (4 Farben)', st_german: 'Deutsches Blatt',
    sound: 'Sound', language: 'Sprache', close: 'Schließen', scores: 'Punkte', reshuffle: 'Ablage wird neu gemischt',
    disconnected: 'getrennt', you2: 'du', autoplay: '{name} ist weg – ein Bot spielt kurz für sie/ihn.',
    rulesHtml: `
      <h3>Ziel</h3><p>Möglichst <b>wenig Punkte</b> in deinen Karten haben. Wer über 100 Punkte kommt, beendet das Spiel – der mit den wenigsten Punkten gewinnt.</p>
      <h3>Start</h3><p>Jeder bekommt 4 verdeckte Karten. Am Anfang darfst du dir deine <b>zwei unteren</b> Karten einmal ansehen – merk sie dir!</p>
      <h3>Dein Zug</h3><p>Zieh die oberste Karte vom <b>Stapel</b> oder nimm die offene Karte der <b>Ablage</b>.<br>
      • Du kannst sie mit einer deiner Karten <b>tauschen</b> (die alte kommt offen auf die Ablage).<br>
      • Eine Stapelkarte kannst du auch direkt <b>ablegen</b> – dann darfst du ihre Aktion nutzen.</p>
      <h3>Aktionen</h3><p>7, 8 – <b>Gucken</b>: eigene Karte ansehen<br>9, 10 – <b>Spionieren</b>: fremde Karte ansehen<br>Bube, Dame – <b>Blind tauschen</b>: eigene mit fremder Karte<br>König – <b>Gucken & Tauschen</b>: beide ansehen, dann entscheiden</p>
      <h3>Werte</h3><p>Ass 1 · 7–10 nach Zahl · Bube 11 · Dame 12 · König 13 · <b>Herz- & Karo-König 0</b></p>
      <h3>Abwerfen ⚡</h3><p>Liegt oben auf der Ablage eine Karte, deren Wert du in deiner Hand hast? Drück <b>Abwerfen</b> und wirf sie blitzschnell drauf – jederzeit, auch wenn du nicht dran bist! Liegst du falsch, gibt's eine <b>Strafkarte</b>.</p>
      <h3>CABO!</h3><p>Glaubst du, du hast die wenigsten Punkte, rufst du statt zu ziehen <b>CABO</b>. Alle anderen haben noch einen Zug, deine Karten sind geschützt. Hast du wirklich die wenigsten (oder gleich wenig) Punkte, bekommst du <b>0</b>. Sonst: deine Punkte <b>+10</b>.</p>
      <h3>Bonus</h3><p>Landest du genau auf 100 Punkten, fällst du auf 50 zurück.</p>`,
  },
  en: {
    tagline: 'The card game where the best memory wins.',
    yourName: 'Your name', create: 'Create new game', join: 'Join game', joinRoom: 'Join room {code}',
    rules: 'How to play', settings: 'Settings', quick: 'Quick game vs bots',
    lobby: 'Lobby', room: 'Room', shareHint: 'Send this link to your friends:', copy: 'Copy', copied: 'Copied!', share: 'Share',
    players: 'Players', addBot: '+ Bot', start: 'Start game', waitingHost: 'Waiting for the host to start…', needTwo: 'At least 2 players',
    easy: 'Memory aid', easyHint: 'Cards you have already seen stay face-up for you.',
    offline: 'Could not reach the multiplayer server – you can still play against bots.',
    connecting: 'Connecting…', reconnecting: 'Connection lost – reconnecting…', hostGone: 'The host cannot be reached.',
    full: 'The game is full or already running.', back: 'Back', leave: 'Leave',
    you: 'You', host: 'Host', bot: 'Bot', round: 'Round', deck: 'Deck', discardPile: 'Discard',
    peekTitle: 'Memorise your two bottom cards!', ready: 'Ready', waitingOthers: 'Waiting for the others…',
    yourTurn: 'Your turn – draw from the deck or take the discard.',
    yourTurnCabo: 'Final round! Draw a card.',
    drawnDeck: 'Swap it with one of your cards – or discard it.',
    drawnDiscard: 'Pick one of your cards to swap.',
    act_peek: 'Look at one of your own cards.', act_spy: "Look at another player's card.",
    act_swap: 'Pick one of yours and one of theirs to swap blindly.',
    act_king: 'Pick one of yours and one of theirs – you see both.',
    act_kingDecide: 'Swap or keep?',
    waitTurn: "{name}'s turn…", waitDrawn: '{name} is thinking…',
    waitAct_peek: '{name} peeks at their own card', waitAct_spy: '{name} is spying…',
    waitAct_swap: '{name} swaps blindly…', waitAct_king: '{name} considers a king swap…',
    cabo: 'CABO!', discard: 'Discard', skip: 'Skip', doSwap: 'Swap', keep: 'Keep',
    snap: 'Snap', snapPick: 'Which card?', cancel: 'Cancel',
    name_peek: 'Peek', name_spy: 'Spy', name_swap: 'Blind swap', name_king: 'King',
    calledCabo: '{name} calls CABO!', youCalled: 'You called CABO!', lastRound: 'Final round',
    snapOk: '{name} snaps!', snapFail: 'Wrong snap! {name} takes a penalty card.',
    roundOver: 'Round {n} over', gameOver: 'Game over!', winner: '{name} wins!', youWin: 'You win!',
    points: 'Points', total: 'Total', caboOk: 'Cabo made – 0 points!', caboFail: 'Cabo failed +10', lucky: 'Exactly 100 → 50!',
    nextRound: 'Next round', newGame: 'New game', toLobby: 'Back to lobby', waitNext: 'Waiting for the host…',
    hideScores: 'View cards', showScores: 'Scores',
    deckStyle: 'Card deck', st_classic: 'French', st_tournament: 'Tournament (4 colours)', st_german: 'German suits',
    sound: 'Sound', language: 'Language', close: 'Close', scores: 'Scores', reshuffle: 'Reshuffling the discard pile',
    disconnected: 'offline', you2: 'you', autoplay: '{name} left – a bot is covering for them.',
    rulesHtml: `
      <h3>Goal</h3><p>Have as <b>few points</b> as possible in your hand. Once someone goes over 100 points the game ends – lowest total wins.</p>
      <h3>Setup</h3><p>Everyone gets 4 face-down cards. At the start you may look at your <b>two bottom</b> cards once – remember them!</p>
      <h3>Your turn</h3><p>Draw the top card of the <b>deck</b> or take the face-up <b>discard</b>.<br>
      • <b>Swap</b> it with one of your cards (the old one goes face-up onto the discard).<br>
      • A card from the deck can also be <b>discarded</b> right away – then you may use its action.</p>
      <h3>Actions</h3><p>7, 8 – <b>Peek</b>: look at one of your cards<br>9, 10 – <b>Spy</b>: look at someone else's card<br>Jack, Queen – <b>Blind swap</b>: one of yours with one of theirs<br>King – <b>Look & swap</b>: see both, then decide</p>
      <h3>Values</h3><p>Ace 1 · 7–10 face value · Jack 11 · Queen 12 · King 13 · <b>red Kings 0</b></p>
      <h3>Snap ⚡</h3><p>Is the top discard a rank you hold? Hit <b>Snap</b> and throw yours on top – any time, even when it's not your turn! Wrong card = <b>penalty card</b>.</p>
      <h3>CABO!</h3><p>Think you have the lowest hand? Call <b>CABO</b> instead of drawing. Everyone else gets one more turn, your cards are protected. If you really are lowest (or tied), you score <b>0</b>. Otherwise: your points <b>+10</b>.</p>
      <h3>Bonus</h3><p>Land on exactly 100 points and you drop back to 50.</p>`,
  },
};

let LANG = (() => {
  try { const l = localStorage.getItem('cabo-lang'); if (l) return l; } catch (e) {}
  return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
})();

function t(key, vars) {
  let s = (STR[LANG] && STR[LANG][key]) ?? STR.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll('{' + k + '}', vars[k]);
  return s;
}
