"use strict";

/* =========================================================
   COURTVISION PRO
   Basketball Analytics System
   APP.JS
   ---------------------------------------------------------
   핵심
   1. 3대3 / 5대5 데이터 완전 분리
   2. 경기 타이머
   3. 샷클락
   4. 선수 기록
   5. BOX SCORE
   6. +/- 자동 계산
   7. 슛 위치 기록
   8. 슛차트
   9. 히트맵
   10. Undo
   11. 경기 저장 / 불러오기
   12. CSV
   13. MVP / Leaders
========================================================= */


/* =========================================================
   GLOBAL
========================================================= */

const STORAGE_KEY = "COURTVISION_PRO_V3";

let currentMode = "3x3";
let currentPage = "live";

let game = null;

let gameClockTimer = null;
let shotClockTimer = null;

let shotMode = null;

let undoStack = [];

let toastTimer = null;


/* =========================================================
   UTIL
========================================================= */

const $ = (id) => document.getElementById(id);

function q(selector) {
  return document.querySelector(selector);
}

function qa(selector) {
  return [...document.querySelectorAll(selector)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function now() {
  return Date.now();
}

function uid(prefix = "id") {
  return `${prefix}_${now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(Number(seconds) || 0));

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function percent(made, attempts) {
  return attempts > 0
    ? Math.round((made / attempts) * 100)
    : 0;
}

function showToast(message) {
  let el = $("toast");

  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 1800);
}


/* =========================================================
   DEFAULT GAME
========================================================= */

function createPlayer(team, number, index) {
  return {
    id: uid("player"),

    team,

    number,

    name:
      team === "A"
        ? `선수 A${index + 1}`
        : `선수 B${index + 1}`,

    position: "",

    starter: true,

    onCourt: true,

    stats: {
      pts: 0,

      reb: 0,
      oreb: 0,
      dreb: 0,

      ast: 0,
      stl: 0,
      blk: 0,

      to: 0,
      pf: 0,

      fgm: 0,
      fga: 0,

      twoMade: 0,
      twoAtt: 0,

      threeMade: 0,
      threeAtt: 0,

      ftm: 0,
      fta: 0,

      plusMinus: 0,

      minutes: 0
    }
  };
}


function createTeam(team, count) {
  const players = [];

  for (let i = 0; i < count; i++) {
    players.push(
      createPlayer(
        team,
        team === "A" ? i + 1 : i + 1,
        i
      )
    );
  }

  return {
    id: uid(`team${team}`),

    name:
      team === "A"
        ? "설천고 A"
        : "설천고 B",

    color:
      team === "A"
        ? "blue"
        : "red",

    players,

    score: 0,

    fouls: 0,

    timeouts: 1
  };
}


function createGame(mode = "3x3") {

  const is3x3 = mode === "3x3";

  return {
    id: uid("game"),

    mode,

    createdAt: new Date().toISOString(),

    gameName:
      is3x3
        ? "설천고 3대3 리그전"
        : "설천고 5대5 경기",

    location: "설천고 체육관",

    date:
      new Date().toISOString().slice(0, 10),

    settings: {

      gameMinutes:
        is3x3 ? 10 : 10,

      shotClock:
        is3x3 ? 14 : 24,

      winScore:
        is3x3 ? 21 : 0
    },

    period: 1,

    clock: is3x3 ? 600 : 600,

    shotClock:
      is3x3 ? 14 : 24,

    running: false,

    shotClockRunning: false,

    ended: false,

    possession: "A",

    teams: {

      A: createTeam(
        "A",
        is3x3 ? 3 : 5
      ),

      B: createTeam(
        "B",
        is3x3 ? 3 : 5
      )
    },

    events: [],

    shots: [],

    selectedPlayerId: null,

    selectedShotType: null,

    lastEvent: null
  };
}


/* =========================================================
   INIT
========================================================= */

function initApp() {

  loadSavedState();

  if (!game) {
    game = createGame(currentMode);
  }

  bindEvents();

  renderAll();

  window.addEventListener(
    "beforeunload",
    () => saveState()
  );
}


/* =========================================================
   MODE
========================================================= */

function setMode(mode) {

  if (
    mode !== "3x3" &&
    mode !== "5x5"
  ) {
    return;
  }

  if (
    game &&
    game.events.length > 0 &&
    game.mode !== mode
  ) {

    const ok = confirm(
      "현재 경기 기록이 있습니다.\n\n" +
      "모드를 변경하면 다른 모드의 경기 데이터로 전환합니다.\n" +
      "계속할까요?"
    );

    if (!ok) return;
  }

  stopGameClock();
  stopShotClock();

  currentMode = mode;

  const saved = loadModeGame(mode);

  game =
    saved ||
    createGame(mode);

  game.mode = mode;

  undoStack = [];

  shotMode = null;

  renderAll();

  saveState();

  showToast(
    mode === "3x3"
      ? "3대3 모드"
      : "5대5 모드"
  );
}


/* =========================================================
   MODE STORAGE
========================================================= */

function getStorage() {

  try {

    return JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    ) || {};

  } catch (error) {

    console.warn(
      "Storage read error",
      error
    );

    return {};
  }
}


function saveState() {

  try {

    const storage = getStorage();

    storage[game.mode] = game;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(storage)
    );

  } catch (error) {

    console.warn(
      "Storage save error",
      error
    );
  }
}


function loadModeGame(mode) {

  const storage = getStorage();

  const saved = storage[mode];

  if (!saved) {
    return null;
  }

  return hydrateGame(saved);
}


function loadSavedState() {

  const storage = getStorage();

  const mode =
    storage[currentMode];

  if (mode) {

    game = hydrateGame(mode);

  } else {

    game = createGame(currentMode);

  }
}


function hydrateGame(saved) {

  const fresh =
    createGame(
      saved.mode || currentMode
    );

  return {

    ...fresh,

    ...saved,

    settings: {
      ...fresh.settings,
      ...(saved.settings || {})
    },

    teams: {

      A: {
        ...fresh.teams.A,
        ...(saved.teams?.A || {}),

        players:
          saved.teams?.A?.players ||
          fresh.teams.A.players
      },

      B: {
        ...fresh.teams.B,
        ...(saved.teams?.B || {}),

        players:
          saved.teams?.B?.players ||
          fresh.teams.B.players
      }
    },

    events:
      Array.isArray(saved.events)
        ? saved.events
        : [],

    shots:
      Array.isArray(saved.shots)
        ? saved.shots
        : []
  };
}


/* =========================================================
   EVENT BINDING
========================================================= */

function bindEvents() {

  /*
    기존 HTML에서
    data-mode="3x3"
    data-mode="5x5"
    를 사용하면 자동 연결
  */

  qa("[data-mode]").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const mode =
            button.dataset.mode;

          setMode(mode);
        }
      );
    }
  );


  /*
    페이지
  */

  qa("[data-page]").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;

          setPage(page);
        }
      );
    }
  );


  /*
    선수 선택
  */

  qa("[data-player-id]").forEach(
    (element) => {

      element.addEventListener(
        "click",
        () => {

          selectPlayer(
            element.dataset.playerId
          );
        }
      );
    }
  );


  /*
    액션 버튼
  */

  qa("[data-action]").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          handleAction(
            button.dataset.action
          );
        }
      );
    }
  );


  /*
    경기 시계
  */

  qa("[data-game-clock]").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const action =
            button.dataset.gameClock;

          if (action === "start") {
            startGameClock();
          }

          if (action === "pause") {
            stopGameClock();
          }

          if (action === "reset") {
            resetGameClock();
          }
        }
      );
    }
  );


  /*
    샷클락
  */

  qa("[data-shot-clock]").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const action =
            button.dataset.shotClock;

          if (action === "start") {
            startShotClock();
          }

          if (action === "pause") {
            stopShotClock();
          }

          if (action === "reset") {
            resetShotClock();
          }
        }
      );
    }
  );


  /*
    저장
  */

  qa("[data-save-game]").forEach(
    button => {

      button.addEventListener(
        "click",
        saveGame
      );

    }
  );


  /*
    초기화
  */

  qa("[data-reset-game]").forEach(
    button => {

      button.addEventListener(
        "click",
        resetGame
      );

    }
  );


  /*
    Undo
  */

  qa("[data-undo]").forEach(
    button => {

      button.addEventListener(
        "click",
        undoLastEvent
      );

    }
  );


  /*
    슛차트
  */

  qa("[data-shot]").forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          shotMode =
            button.dataset.shot;

          showToast(
            "코트에서 슛 위치를 선택하세요"
          );
        }
      );
    }
  );


  /*
    선수 추가
  */

  qa("[data-add-player]").forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          addPlayer(
            button.dataset.addPlayer
          );

        }
      );
    }
  );


  /*
    CSV
  */

  qa("[data-export-csv]").forEach(
    button => {

      button.addEventListener(
        "click",
        exportCSV
      );

    }
  );


  /*
    저장된 경기 불러오기
  */

  qa("[data-load-game]").forEach(
    button => {

      button.addEventListener(
        "click",
        loadGameFromStorage
      );

    }
  );


  /*
    문서 전체에서
    동적으로 생성된 버튼도 처리
  */

  document.addEventListener(
    "click",
    handleDelegatedClick
  );
}


/* =========================================================
   PAGE
========================================================= */

function setPage(page) {

  currentPage = page;

  qa(".page").forEach(
    element => {

      element.classList.toggle(
        "active",
        element.id ===
          `page-${page}`
      );

    }
  );

  qa("[data-page]").forEach(
    button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    }
  );

  renderPage(page);
}


function renderPage(page) {

  if (page === "live") {
    renderLive();
  }

  if (page === "records") {
    renderRecords();
  }

  if (page === "shotchart") {
    renderShotChart();
  }

  if (page === "strategy") {
    renderStrategy();
  }

  if (page === "report") {
    renderReport();
  }

  if (page === "league") {
    renderLeague();
  }
}


/* =========================================================
   PLAYER
========================================================= */

function getPlayerById(id) {

  if (!id) return null;

  return (
    game.teams.A.players.find(
      p => p.id === id
    ) ||

    game.teams.B.players.find(
      p => p.id === id
    ) ||

    null
  );
}


function getTeamByPlayer(player) {

  if (!player) return null;

  return game.teams[player.team];
}


function getPlayers(team) {

  return game.teams[team].players;
}


function selectPlayer(id) {

  const player =
    getPlayerById(id);

  if (!player) return;

  game.selectedPlayerId =
    player.id;

  renderAll();

  showToast(
    `#${player.number} ${player.name} 선택`
  );
}


/* =========================================================
   ADD PLAYER
========================================================= */

function addPlayer(team) {

  if (
    team !== "A" &&
    team !== "B"
  ) {
    return;
  }

  const players =
    game.teams[team].players;

  const maxPlayers =
    game.mode === "3x3"
      ? 12
      : 15;

  if (players.length >= maxPlayers) {

    showToast(
      "등록 가능한 선수 수를 초과했습니다."
    );

    return;
  }

  const number =
    players.length
      ? Math.max(
          ...players.map(
            p => Number(p.number) || 0
          )
        ) + 1
      : 1;

  players.push(
    createPlayer(
      team,
      number,
      players.length
    )
  );

  saveState();

  renderAll();

  showToast("선수를 추가했습니다.");
}


/* =========================================================
   GAME CLOCK
========================================================= */

function startGameClock() {

  if (game.ended) return;

  if (game.running) return;

  game.running = true;

  gameClockTimer =
    setInterval(
      () => {

        if (!game.running) return;

        game.clock--;

        updateClockUI();

        updateMinutes();

        if (game.clock <= 0) {

          game.clock = 0;

          stopGameClock();

          endPeriod();

        }

        saveState();

      },
      1000
    );

  startShotClock();

  updateClockUI();
}


function stopGameClock() {

  game.running = false;

  clearInterval(
    gameClockTimer
  );

  gameClockTimer = null;

  updateClockUI();
}


function resetGameClock() {

  stopGameClock();

  game.clock =
    Number(
      game.settings.gameMinutes
    ) * 60;

  game.period = 1;

  resetShotClock();

  updateClockUI();

  saveState();

  showToast("경기 시계를 초기화했습니다.");
}


/* =========================================================
   PERIOD
========================================================= */

function endPeriod() {

  stopShotClock();

  game.period++;

  const maxPeriod =
    game.mode === "3x3"
      ? 1
      : 4;

  if (
    game.mode === "3x3" ||
    game.period > maxPeriod
  ) {

    endGame();

    return;
  }

  game.clock =
    Number(
      game.settings.gameMinutes
    ) * 60;

  resetShotClock();

  showToast(
    `${game.period}쿼터 시작`
  );

  renderAll();
}


/* =========================================================
   SHOT CLOCK
========================================================= */

function startShotClock() {

  if (game.ended) return;

  if (game.shotClockRunning) return;

  game.shotClockRunning = true;

  shotClockTimer =
    setInterval(
      () => {

        if (
          !game.shotClockRunning
        ) {
          return;
        }

        game.shotClock--;

        updateClockUI();

        if (game.shotClock <= 0) {

          game.shotClock = 0;

          stopShotClock();

          handleShotClockViolation();

        }

      },
      1000
    );

  updateClockUI();
}


function stopShotClock() {

  game.shotClockRunning = false;

  clearInterval(
    shotClockTimer
  );

  shotClockTimer = null;

  updateClockUI();
}


function resetShotClock() {

  stopShotClock();

  game.shotClock =
    Number(
      game.settings.shotClock
    );

  updateClockUI();

  saveState();
}


function handleShotClockViolation() {

  const event = {

    id: uid("event"),

    type: "shotclock",

    team: game.possession,

    playerId: null,

    points: 0,

    time: game.clock,

    period: game.period,

    createdAt: new Date().toISOString(),

    label:
      `${game.possession}팀 샷클락 바이얼레이션`

  };

  pushEvent(event);

  changePossession();

  showToast(
    "샷클락 바이얼레이션"
  );
}


/* =========================================================
   ACTION
========================================================= */

function handleAction(action) {

  if (game.ended) {

    showToast("종료된 경기입니다.");

    return;
  }

  const player =
    getPlayerById(
      game.selectedPlayerId
    );

  if (
    !player &&
    ![
      "timeoutA",
      "timeoutB"
    ].includes(action)
  ) {

    showToast(
      "먼저 선수를 선택하세요."
    );

    return;
  }


  switch (action) {

    case "ftMade":
      recordShot(player, 1, true, true);
      break;

    case "twoMade":
      recordShot(player, 2, true, false);
      break;

    case "threeMade":
      recordShot(player, 3, true, false);
      break;

    case "shotMiss":
      recordShot(player, 2, false, false);
      break;

    case "ftMiss":
      recordShot(player, 1, false, true);
      break;

    case "reb":
      addStat(player, "reb");
      break;

    case "oreb":
      addStat(player, "oreb");
      break;

    case "dreb":
      addStat(player, "dreb");
      break;

    case "ast":
      addStat(player, "ast");
      break;

    case "stl":
      addStat(player, "stl");
      break;

    case "blk":
      addStat(player, "blk");
      break;

    case "to":
      addStat(player, "to");
      changePossession();
      break;

    case "pf":
      addFoul(player);
      break;

    case "in":
      substituteIn(player);
      break;

    case "out":
      substituteOut(player);
      break;

    case "timeoutA":
      useTimeout("A");
      break;

    case "timeoutB":
      useTimeout("B");
      break;
  }

  renderAll();

  saveState();
}


/* =========================================================
   RECORD SHOT
========================================================= */

function recordShot(
  player,
  points,
  made,
  freeThrow
) {

  saveUndoState();

  const stats =
    player.stats;

  stats.fga++;

  if (made) {

    stats.fgm++;

    stats.pts += points;

    game.teams[
      player.team
    ].score += points;

    updatePlusMinus(
      player.team,
      points
    );

  } else {

    /*
      실패한 슛에서는
      상대팀 +/- 변화 없음
    */

  }

  if (freeThrow) {

    stats.fta++;

    if (made) {
      stats.ftm++;
    }

  } else if (points === 2) {

    stats.twoAtt++;

    if (made) {
      stats.twoMade++;
    }

  } else if (points === 3) {

    stats.threeAtt++;

    if (made) {
      stats.threeMade++;
    }
  }


  /*
    이벤트
  */

  const event = {

    id: uid("event"),

    type: made
      ? "shotMade"
      : "shotMiss",

    team: player.team,

    playerId: player.id,

    points,

    made,

    freeThrow,

    time: game.clock,

    period: game.period,

    createdAt:
      new Date().toISOString(),

    label:
      `${player.name} · ${
        made
          ? `+${points}`
          : "슛 실패"
      }`

  };

  pushEvent(event);


  /*
    성공 득점이면 공격권 변경
    3x3에서는 득점 후 체크
  */

  if (made) {

    game.possession =
      player.team === "A"
        ? "B"
        : "A";

    resetShotClock();

  }


  /*
    승리 점수
  */

  checkWinCondition();

  renderAll();

  saveState();

  showToast(
    made
      ? `${player.name} +${points}`
      : `${player.name} 슛 실패`
  );
}


/* =========================================================
   STAT
========================================================= */

function addStat(
  player,
  stat
) {

  saveUndoState();

  if (
    typeof player.stats[stat] !==
    "number"
  ) {
    return;
  }

  player.stats[stat]++;

  const event = {

    id: uid("event"),

    type: stat,

    team: player.team,

    playerId: player.id,

    points: 0,

    time: game.clock,

    period: game.period,

    createdAt:
      new Date().toISOString(),

    label:
      `${player.name} · ${statLabel(stat)}`
  };

  pushEvent(event);

  renderAll();

  saveState();

  showToast(
    `${player.name} · ${statLabel(stat)}`
  );
}


function statLabel(stat) {

  const labels = {

    reb: "리바운드",

    oreb: "공격 리바운드",

    dreb: "수비 리바운드",

    ast: "어시스트",

    stl: "스틸",

    blk: "블록",

    to: "턴오버",

    pf: "파울"
  };

  return labels[stat] || stat;
}


/* =========================================================
   FOUL
========================================================= */

function addFoul(player) {

  saveUndoState();

  player.stats.pf++;

  game.teams[
    player.team
  ].fouls++;

  const event = {

    id: uid("event"),

    type: "pf",

    team: player.team,

    playerId: player.id,

    points: 0,

    time: game.clock,

    period: game.period,

    createdAt:
      new Date().toISOString(),

    label:
      `${player.name} · 파울`
  };

  pushEvent(event);

  renderAll();

  saveState();

  showToast(
    `${player.name} 파울`
  );
}


/* =========================================================
   +/- 
========================================================= */

function updatePlusMinus(
  scoringTeam,
  points
) {

  const opponent =
    scoringTeam === "A"
      ? "B"
      : "A";

  game.teams[
    scoringTeam
  ].players
    .filter(p => p.onCourt)
    .forEach(
      p => {
        p.stats.plusMinus += points;
      }
    );

  game.teams[
    opponent
  ].players
    .filter(p => p.onCourt)
    .forEach(
      p => {
        p.stats.plusMinus -= points;
      }
    );
}


/* =========================================================
   SUBSTITUTION
========================================================= */

function substituteIn(player) {

  saveUndoState();

  player.onCourt = true;

  renderAll();

  saveState();

  showToast(
    `${player.name} 투입`
  );
}


function substituteOut(player) {

  const onCourt =
    game.teams[
      player.team
    ].players.filter(
      p => p.onCourt
    );

  const minimum =
    game.mode === "3x3"
      ? 3
      : 5;

  if (
    onCourt.length <= minimum
  ) {

    showToast(
      `최소 ${minimum}명은 출전해야 합니다.`
    );

    return;
  }

  saveUndoState();

  player.onCourt = false;

  renderAll();

  saveState();

  showToast(
    `${player.name} 교체 아웃`
  );
}


/* =========================================================
   TIMEOUT
========================================================= */

function useTimeout(team) {

  if (
    game.teams[team].timeouts <= 0
  ) {

    showToast(
      `${team}팀 타임아웃이 없습니다.`
    );

    return;
  }

  saveUndoState();

  game.teams[
    team
  ].timeouts--;

  pushEvent({

    id: uid("event"),

    type: "timeout",

    team,

    playerId: null,

    points: 0,

    time: game.clock,

    period: game.period,

    createdAt:
      new Date().toISOString(),

    label:
      `${team}팀 타임아웃`

  });

  stopGameClock();
  stopShotClock();

  renderAll();

  saveState();
}


/* =========================================================
   POSSESSION
========================================================= */

function changePossession() {

  game.possession =
    game.possession === "A"
      ? "B"
      : "A";

  resetShotClock();
}


/* =========================================================
   EVENT
========================================================= */

function pushEvent(event) {

  game.events.push(event);

  game.lastEvent =
    event;

  undoStack.push(
    event.id
  );

  /*
    너무 길어지는 것을 방지
  */

  if (
    game.events.length > 1000
  ) {

    game.events =
      game.events.slice(-1000);

  }
}


/* =========================================================
   UNDO
========================================================= */

function saveUndoState() {

  const snapshot =
    JSON.parse(
      JSON.stringify(game)
    );

  undoStack.push({
    snapshot
  });

  if (
    undoStack.length > 100
  ) {
    undoStack.shift();
  }
}


function undoLastEvent() {

  if (
    !undoStack.length
  ) {

    showToast(
      "취소할 기록이 없습니다."
    );

    return;
  }

  let entry =
    undoStack.pop();

  /*
    이벤트 ID만 저장된 오래된 방식 방어
  */

  if (
    entry &&
    typeof entry === "string"
  ) {

    const index =
      game.events.findIndex(
        e => e.id === entry
      );

    if (index >= 0) {
      game.events.splice(
        index,
        1
      );
    }

    recalculateGame();

  } else if (
    entry?.snapshot
  ) {

    game =
      hydrateGame(
        entry.snapshot
      );

  }

  renderAll();

  saveState();

  showToast(
    "최근 기록을 취소했습니다."
  );
}


/* =========================================================
   RECALCULATE
========================================================= */

function recalculateGame() {

  const fresh =
    createGame(game.mode);

  fresh.id =
    game.id;

  fresh.gameName =
    game.gameName;

  fresh.location =
    game.location;

  fresh.date =
    game.date;

  fresh.settings =
    game.settings;

  fresh.teams.A.name =
    game.teams.A.name;

  fresh.teams.B.name =
    game.teams.B.name;


  /*
    선수 정보 유지
  */

  for (
    const team of ["A", "B"]
  ) {

    fresh.teams[
      team
    ].players =
      game.teams[
        team
      ].players.map(
        p => ({
          ...p,

          stats: {
            pts: 0,
            reb: 0,
            oreb: 0,
            dreb: 0,
            ast: 0,
            stl: 0,
            blk: 0,
            to: 0,
            pf: 0,
            fgm: 0,
            fga: 0,
            twoMade: 0,
            twoAtt: 0,
            threeMade: 0,
            threeAtt: 0,
            ftm: 0,
            fta: 0,
            plusMinus: 0,
            minutes: 0
          }
        })
      );

    fresh.teams[
      team
    ].players.forEach(
      p => {

        const original =
          game.teams[
            team
          ].players.find(
            x => x.id === p.id
          );

        p.onCourt =
          original?.onCourt ??
          true;

        p.starter =
          original?.starter ??
          true;

        p.name =
          original?.name ??
          p.name;

        p.number =
          original?.number ??
          p.number;

      }
    );
  }


  /*
    이벤트 재생
  */

  for (
    const event of game.events
  ) {

    const player =
      fresh.teams[
        event.team
      ]?.players.find(
        p => p.id === event.playerId
      );

    if (
      event.type === "shotMade" ||
      event.type === "shotMiss"
    ) {

      if (!player) continue;

      player.stats.fga++;

      if (event.made) {

        player.stats.fgm++;

        player.stats.pts +=
          event.points;

        fresh.teams[
          event.team
        ].score +=
          event.points;

      }

      if (event.freeThrow) {

        player.stats.fta++;

        if (event.made) {
          player.stats.ftm++;
        }

      } else if (
        event.points === 2
      ) {

        player.stats.twoAtt++;

        if (event.made) {
          player.stats.twoMade++;
        }

      } else if (
        event.points === 3
      ) {

        player.stats.threeAtt++;

        if (event.made) {
          player.stats.threeMade++;
        }

      }

    } else if (
      player &&
      typeof player.stats[
        event.type
      ] === "number"
    ) {

      player.stats[
        event.type
      ]++;

    }

    if (
      event.type === "pf"
    ) {

      fresh.teams[
        event.team
      ].fouls++;

    }

    if (
      event.type === "timeout"
    ) {

      fresh.teams[
        event.team
      ].timeouts--;

    }
  }


  /*
    +/- 다시 계산
  */

  const runningPlayers = {
    A: fresh.teams.A.players,
    B: fresh.teams.B.players
  };

  for (
    const event of game.events
  ) {

    if (
      event.type !== "shotMade" ||
      !event.made
    ) continue;

    const scoring =
      event.team;

    const other =
      scoring === "A"
        ? "B"
        : "A";

    runningPlayers[
      scoring
    ]
      .filter(p => p.onCourt)
      .forEach(
        p => {
          p.stats.plusMinus +=
            event.points;
        }
      );

    runningPlayers[
      other
    ]
      .filter(p => p.onCourt)
      .forEach(
        p => {
          p.stats.plusMinus -=
            event.points;
        }
      );
  }


  fresh.clock =
    game.clock;

  fresh.shotClock =
    game.shotClock;

  fresh.period =
    game.period;

  fresh.possession =
    game.possession;

  fresh.selectedPlayerId =
    game.selectedPlayerId;

  fresh.shots =
    game.shots;

  fresh.events =
    game.events;

  fresh.ended =
    game.ended;

  game =
    fresh;
}


/* =========================================================
   WIN CONDITION
========================================================= */

function checkWinCondition() {

  if (
    game.mode !== "3x3"
  ) {
    return;
  }

  const target =
    Number(
      game.settings.winScore
    ) || 21;

  if (
    game.teams.A.score >= target
  ) {

    endGame("A");

  } else if (
    game.teams.B.score >= target
  ) {

    endGame("B");

  }
}


function endGame(winner = null) {

  stopGameClock();

  stopShotClock();

  game.ended = true;

  game.running = false;

  pushEvent({

    id: uid("event"),

    type: "gameEnd",

    team: winner,

    playerId: null,

    points: 0,

    time: game.clock,

    period: game.period,

    createdAt:
      new Date().toISOString(),

    label:
      winner
        ? `${winner}팀 경기 종료`
        : "경기 종료"

  });

  renderAll();

  saveState();

  showToast(
    winner
      ? `${winner}팀 승리!`
      : "경기가 종료되었습니다."
  );
}


/* =========================================================
   MINUTES
========================================================= */

function updateMinutes() {

  /*
    현재 코트 선수에게
    실제 경기 시간 1초 반영
  */

  ["A", "B"].forEach(
    team => {

      game.teams[
        team
      ].players
        .filter(
          p => p.onCourt
        )
        .forEach(
          p => {
            p.stats.minutes +=
              1 / 60;
          }
        );
    }
  );
}


/* =========================================================
   SHOT CHART
========================================================= */

function startShotRecord(
  type
) {

  if (
    !game.selectedPlayerId
  ) {

    showToast(
      "먼저 선수를 선택하세요."
    );

    return;
  }

  shotMode = type;

  showToast(
    "코트 위치를 눌러주세요."
  );
}


function recordShotLocation(
  x,
  y,
  made,
  points
) {

  const player =
    getPlayerById(
      game.selectedPlayerId
    );

  if (!player) {

    showToast(
      "선수를 먼저 선택하세요."
    );

    return;
  }

  const shot = {

    id: uid("shot"),

    playerId:
      player.id,

    team:
      player.team,

    x:
      clamp(
        Number(x),
        0,
        1
      ),

    y:
      clamp(
        Number(y),
        0,
        1
      ),

    made:
      Boolean(made),

    points:
      Number(points) || 2,

    period:
      game.period,

    clock:
      game.clock,

    createdAt:
      new Date().toISOString()

  };

  game.shots.push(shot);

  shotMode = null;

  saveState();

  renderShotChart();

  showToast(
    made
      ? "성공 위치 저장"
      : "실패 위치 저장"
  );
}


/* =========================================================
   COURT CLICK
========================================================= */

function handleCourtClick(
  event
) {

  if (!shotMode) {
    return;
  }

  const canvas =
    event.currentTarget;

  const rect =
    canvas.getBoundingClientRect();

  const x =
    (event.clientX - rect.left) /
    rect.width;

  const y =
    (event.clientY - rect.top) /
    rect.height;


  let made =
    shotMode === "made" ||
    shotMode === "success";

  let points = 2;


  /*
    3x3
    아크 기준 간단 판정
  */

  if (
    game.mode === "3x3"
  ) {

    const cx = 0.5;
    const cy = 0.72;

    const dx =
      x - cx;

    const dy =
      y - cy;

    const distance =
      Math.sqrt(
        dx * dx +
        dy * dy
      );

    points =
      distance < 0.30
        ? 1
        : 2;

  }


  recordShotLocation(
    x,
    y,
    made,
    points
  );
}


/* =========================================================
   HEATMAP
========================================================= */

function calculateHeatmap() {

  const grid = [];

  const size = 12;

  for (
    let y = 0;
    y < size;
    y++
  ) {

    grid[y] = [];

    for (
      let x = 0;
      x < size;
      x++
    ) {

      grid[y][x] = 0;

    }
  }


  const shots =
    game.shots;

  shots.forEach(
    shot => {

      const gx =
        clamp(
          Math.floor(
            shot.x * size
          ),
          0,
          size - 1
        );

      const gy =
        clamp(
          Math.floor(
            shot.y * size
          ),
          0,
          size - 1
        );

      grid[gy][gx] += 1;

    }
  );

  return grid;
}


/* =========================================================
   DRAW COURT
========================================================= */

function drawCourt(
  canvas,
  options = {}
) {

  if (!canvas) return;

  const rect =
    canvas.getBoundingClientRect();

  const width =
    canvas.width =
      Math.max(
        600,
        rect.width || 600
      );

  const height =
    canvas.height =
      Math.max(
        400,
        rect.height || 400
      );

  const ctx =
    canvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  /*
    background
  */

  ctx.fillStyle =
    "#07131d";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );


  /*
    court
  */

  ctx.strokeStyle =
    "#426074";

  ctx.lineWidth = 3;


  ctx.strokeRect(
    20,
    20,
    width - 40,
    height - 40
  );


  /*
    paint
  */

  const paintWidth =
    width * 0.22;

  const paintHeight =
    height * 0.32;

  const paintX =
    (width - paintWidth) / 2;

  const paintY =
    height - paintHeight - 20;

  ctx.strokeRect(
    paintX,
    paintY,
    paintWidth,
    paintHeight
  );


  /*
    free throw circle
  */

  ctx.beginPath();

  ctx.arc(
    width / 2,
    paintY,
    paintWidth / 2,
    0,
    Math.PI,
    true
  );

  ctx.stroke();


  /*
    rim
  */

  ctx.beginPath();

  ctx.arc(
    width / 2,
    height - 55,
    13,
    0,
    Math.PI * 2
  );

  ctx.stroke();


  /*
    backboard
  */

  ctx.beginPath();

  ctx.moveTo(
    width / 2 - 30,
    height - 31
  );

  ctx.lineTo(
    width / 2 + 30,
    height - 31
  );

  ctx.stroke();


  /*
    three point arc
  */

  ctx.beginPath();

  ctx.arc(
    width / 2,
    height - 55,
    width * 0.38,
    Math.PI * 1.18,
    Math.PI * 1.82
  );

  ctx.stroke();


  /*
    half-court center
  */

  ctx.beginPath();

  ctx.arc(
    width / 2,
    20,
    45,
    0,
    Math.PI
  );

  ctx.stroke();


  /*
    shots
  */

  game.shots.forEach(
    shot => {

      const sx =
        shot.x * width;

      const sy =
        shot.y * height;

      if (shot.made) {

        ctx.fillStyle =
          "#4aa8ff";

        ctx.beginPath();

        ctx.arc(
          sx,
          sy,
          7,
          0,
          Math.PI * 2
        );

        ctx.fill();

      } else {

        ctx.strokeStyle =
          "#ff4058";

        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.moveTo(
          sx - 6,
          sy - 6
        );

        ctx.lineTo(
          sx + 6,
          sy + 6
        );

        ctx.moveTo(
          sx + 6,
          sy - 6
        );

        ctx.lineTo(
          sx - 6,
          sy + 6
        );

        ctx.stroke();

      }

    }
  );
}


/* =========================================================
   DRAW HEATMAP
========================================================= */

function drawHeatmap(
  canvas
) {

  if (!canvas) return;

  drawCourt(
    canvas
  );

  const ctx =
    canvas.getContext("2d");

  const width =
    canvas.width;

  const height =
    canvas.height;

  const grid =
    calculateHeatmap();

  const size =
    grid.length;

  let max = 0;

  grid.forEach(
    row =>
      row.forEach(
        value => {
          max =
            Math.max(
              max,
              value
            );
        }
      )
  );

  if (!max) return;

  const cellW =
    width / size;

  const cellH =
    height / size;

  /*
    heatmap는
    투명도 중심으로 표현
  */

  for (
    let y = 0;
    y < size;
    y++
  ) {

    for (
      let x = 0;
      x < size;
      x++
    ) {

      const value =
        grid[y][x];

      if (!value) continue;

      const intensity =
        value / max;

      ctx.fillStyle =
        `rgba(255,80,45,${
          0.08 +
          intensity * 0.25
        })`;

      ctx.fillRect(
        x * cellW,
        y * cellH,
        cellW,
        cellH
      );
    }
  }

  /*
    코트 라인을 다시 위에 그리기
  */

  drawCourt(
    canvas,
    {
      shots: false
    }
  );
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderMode();

  renderGameInfo();

  renderScoreboard();

  renderOnCourt();

  renderSelectedPlayer();

  renderRecentLogs();

  renderLeaders();

  renderMVP();

  renderTeamComparison();

  renderRecords();

  renderShotChart();

  renderReport();

  renderSettings();

  updateClockUI();
}


/* =========================================================
   MODE UI
========================================================= */

function renderMode() {

  qa("[data-mode]").forEach(
    button => {

      button.classList.toggle(
        "active",
        button.dataset.mode ===
          game.mode
      );

    }
  );


  const modeLabels =
    qa(
      ".mode-label"
    );

  modeLabels.forEach(
    element => {

      element.textContent =
        game.mode === "3x3"
          ? "3대3 분석"
          : "5대5 분석";

    }
  );
}


/* =========================================================
   GAME INFO
========================================================= */

function renderGameInfo() {

  const map = {

    homeTeamName:
      game.teams.A.name,

    awayTeamName:
      game.teams.B.name,

    gameName:
      game.gameName,

    location:
      game.location,

    gameDate:
      game.date,

    gameMode:
      game.mode === "3x3"
        ? "3대3"
        : "5대5",

    gameMinutes:
      game.settings.gameMinutes,

    shotClockSetting:
      game.settings.shotClock,

    winScore:
      game.settings.winScore

  };


  Object.entries(map)
    .forEach(
      ([id, value]) => {

        const element =
          $(id);

        if (!element) return;

        if (
          "value" in element
        ) {

          element.value =
            value;

        } else {

          element.textContent =
            value;

        }
      }
    );
}


/* =========================================================
   SCOREBOARD
========================================================= */

function renderScoreboard() {

  const values = {

    homeScore:
      game.teams.A.score,

    awayScore:
      game.teams.B.score,

    homeFouls:
      game.teams.A.fouls,

    awayFouls:
      game.teams.B.fouls,

    homeTimeouts:
      game.teams.A.timeouts,

    awayTimeouts:
      game.teams.B.timeouts,

    period:
      game.mode === "3x3"
        ? "GAME"
        : `${game.period}Q`
  };


  Object.entries(values)
    .forEach(
      ([id, value]) => {

        const element =
          $(id);

        if (element) {
          element.textContent =
            value;
        }
      }
    );
}


/* =========================================================
   CLOCK UI
========================================================= */

function updateClockUI() {

  const clock =
    formatTime(
      game.clock
    );

  const shot =
    String(
      Math.max(
        0,
        Math.floor(
          game.shotClock
        )
      )
    );


  const ids = {

    gameClock:
      clock,

    clockDisplay:
      clock,

    shotClock:
      shot,

    shotClockDisplay:
      shot
  };


  Object.entries(ids)
    .forEach(
      ([id, value]) => {

        const element =
          $(id);

        if (element) {

          element.textContent =
            value;

        }
      }
    );


  qa("[data-clock-running]")
    .forEach(
      el => {

        el.textContent =
          game.running
            ? "경기 진행 중"
            : "정지";

      }
    );
}


/* =========================================================
   ON COURT
========================================================= */

function renderOnCourt() {

  renderCourtTeam(
    "A"
  );

  renderCourtTeam(
    "B"
  );
}


function renderCourtTeam(team) {

  const container =
    $(
      `onCourt${team}`
    ) ||
    $(
      `team${team}OnCourt`
    );

  if (!container) return;

  const players =
    game.teams[
      team
    ].players.filter(
      p => p.onCourt
    );


  container.innerHTML =
    players
      .map(
        player => {

          const selected =
            player.id ===
            game.selectedPlayerId;

          return `
            <button
              class="
                player-slot
                team-${team.toLowerCase()}
                ${selected ? "selected" : ""}
              "
              data-player-id="${player.id}"
            >

              <span class="player-number">
                ${escapeHTML(player.number)}
              </span>

              <span class="player-name">
                ${escapeHTML(player.name)}
              </span>

              <span class="player-slot-meta">
                PTS ${player.stats.pts}
                · +/− ${player.stats.plusMinus}
              </span>

            </button>
          `;
        }
      )
      .join("");
}


/* =========================================================
   SELECTED PLAYER
========================================================= */

function renderSelectedPlayer() {

  const player =
    getPlayerById(
      game.selectedPlayerId
    );

  const title =
    $("selectedPlayerName");

  const meta =
    $("selectedPlayerMeta");


  if (!player) {

    if (title) {
      title.textContent =
        "선수를 선택해주세요";
    }

    if (meta) {
      meta.textContent =
        "출전 선수 선택 후 기록을 입력하세요.";
    }

    return;
  }


  if (title) {

    title.textContent =
      `#${player.number} ${player.name}`;

  }


  if (meta) {

    meta.textContent =
      `TEAM ${player.team} · PTS ${player.stats.pts} · +/− ${player.stats.plusMinus}`;

  }


  const statMap = {

    selectedPTS:
      player.stats.pts,

    selectedREB:
      player.stats.reb,

    selectedAST:
      player.stats.ast,

    selectedSTL:
      player.stats.stl,

    selectedBLK:
      player.stats.blk,

    selectedTO:
      player.stats.to,

    selectedPF:
      player.stats.pf,

    selectedFG:
      `${player.stats.fgm}/${player.stats.fga}`,

    selectedFGPercent:
      `${percent(
        player.stats.fgm,
        player.stats.fga
      )}%`

  };


  Object.entries(statMap)
    .forEach(
      ([id, value]) => {

        const el =
          $(id);

        if (el) {
          el.textContent =
            value;
        }
      }
    );
}


/* =========================================================
   RECENT LOG
========================================================= */

function renderRecentLogs() {

  const container =
    $("recentLog") ||
    $("recentLogs") ||
    $("recentLogList");

  if (!container) return;


  if (!game.events.length) {

    container.innerHTML =
      `<div class="empty-state">
        아직 기록이 없습니다.
      </div>`;

    return;
  }


  container.innerHTML =
    [...game.events]
      .slice(-15)
      .reverse()
      .map(
        event => {

          const player =
            getPlayerById(
              event.playerId
            );

          return `
            <div class="log-item">

              <span class="log-type">
                ${escapeHTML(
                  event.type
                )}
              </span>

              <span class="log-text">
                ${escapeHTML(
                  event.label ||
                  player?.name ||
                  "-"
                )}
              </span>

              <span class="log-team">
                ${escapeHTML(
                  event.team || "-"
                )}
              </span>

            </div>
          `;
        }
      )
      .join("");
}


/* =========================================================
   LEADERS
========================================================= */

function getAllPlayers() {

  return [
    ...game.teams.A.players,
    ...game.teams.B.players
  ];
}


function leaderBy(stat) {

  const players =
    getAllPlayers();

  if (!players.length) {
    return null;
  }

  return players.reduce(
    (best, player) => {

      if (!best) return player;

      return player.stats[stat] >
        best.stats[stat]
        ? player
        : best;

    },
    null
  );
}


function renderLeaders() {

  const container =
    $("leaderList") ||
    $("leadersList");

  if (!container) return;


  const categories = [

    ["득점", "pts"],

    ["리바운드", "reb"],

    ["어시스트", "ast"],

    ["스틸", "stl"],

    ["블록", "blk"]

  ];


  container.innerHTML =
    categories
      .map(
        ([label, stat]) => {

          const player =
            leaderBy(stat);

          const value =
            player
              ? player.stats[stat]
              : 0;

          return `
            <div class="leader-row">

              <span>
                ${label}
              </span>

              <strong>
                ${
                  player
                    ? `#${player.number} ${escapeHTML(player.name)}`
                    : "기록 없음"
                }
              </strong>

              <b>
                ${value}
              </b>

            </div>
          `;
        }
      )
      .join("");
}


/* =========================================================
   MVP
========================================================= */

function calculateMVPScore(
  player
) {

  const s =
    player.stats;

  return (
    s.pts * 1.0 +
    s.reb * 1.2 +
    s.ast * 1.5 +
    s.stl * 2.0 +
    s.blk * 2.0 -
    s.to * 1.2 -
    s.pf * 0.5
  );
}


function getMVP() {

  const players =
    getAllPlayers();

  if (!players.length) {
    return null;
  }

  return players.reduce(
    (best, player) => {

      if (!best) return player;

      return calculateMVPScore(
        player
      ) >
        calculateMVPScore(
          best
        )
        ? player
        : best;

    },
    null
  );
}


function renderMVP() {

  const container =
    $("mvpCard") ||
    $("liveMVP") ||
    $("mvp");

  if (!container) return;


  const player =
    getMVP();

  if (!player) {

    container.innerHTML =
      `<div class="empty-state">
        선수를 기다리는 중
      </div>`;

    return;
  }


  const s =
    player.stats;

  const score =
    calculateMVPScore(
      player
    );


  container.innerHTML = `

    <div class="mvp-card">

      <div class="mvp-avatar">
        🏀
      </div>

      <div class="mvp-info">

        <span class="mvp-team">
          TEAM ${player.team}
        </span>

        <strong>
          #${player.number}
          ${escapeHTML(player.name)}
        </strong>

        <small>
          PTS ${s.pts}
          · REB ${s.reb}
          · AST ${s.ast}
        </small>

      </div>

      <div class="mvp-score">
        ${score.toFixed(1)}
      </div>

    </div>

  `;
}


/* =========================================================
   TEAM COMPARISON
========================================================= */

function teamStat(
  team,
  stat
) {

  return game.teams[
    team
  ].players.reduce(
    (sum, p) =>
      sum +
      (
        Number(
          p.stats[stat]
        ) || 0
      ),
    0
  );
}


function renderTeamComparison() {

  const container =
    $("teamComparison") ||
    $("comparisonStats");

  if (!container) return;


  const stats = [

    ["PTS", "pts"],

    ["REB", "reb"],

    ["AST", "ast"],

    ["STL", "stl"],

    ["BLK", "blk"],

    ["TO", "to"]

  ];


  container.innerHTML =
    stats
      .map(
        ([label, stat]) => {

          const a =
            teamStat("A", stat);

          const b =
            teamStat("B", stat);

          const total =
            a + b;

          const aPercent =
            total
              ? Math.round(
                  a /
                  total *
                  100
                )
              : 50;

          return `

            <div class="comparison-item">

              <div class="comparison-values">

                <strong>
                  ${a}
                </strong>

                <span>
                  ${label}
                </span>

                <strong>
                  ${b}
                </strong>

              </div>

              <div class="comparison-bar">

                <div
                  class="bar-a"
                  style="width:${aPercent}%"
                ></div>

                <div
                  class="bar-b"
                  style="width:${100 - aPercent}%"
                ></div>

              </div>

            </div>

          `;
        }
      )
      .join("");
}


/* =========================================================
   RECORDS
========================================================= */

function renderRecords() {

  const body =
    $("recordTableBody") ||
    $("recordsBody");

  if (!body) return;


  const players =
    getAllPlayers();


  body.innerHTML =
    players
      .map(
        player => {

          const s =
            player.stats;

          const fg =
            `${s.fgm}/${s.fga}`;

          return `

            <tr>

              <td>
                ${player.team}
              </td>

              <td>
                ${player.number}
              </td>

              <td>
                ${escapeHTML(
                  player.name
                )}
              </td>

              <td>
                ${formatMinutes(
                  s.minutes
                )}
              </td>

              <td>
                ${s.pts}
              </td>

              <td>
                ${s.reb}
              </td>

              <td>
                ${s.ast}
              </td>

              <td>
                ${s.stl}
              </td>

              <td>
                ${s.blk}
              </td>

              <td>
                ${s.to}
              </td>

              <td>
                ${s.pf}
              </td>

              <td>
                ${fg}
              </td>

              <td>
                ${percent(
                  s.fgm,
                  s.fga
                )}%
              </td>

              <td>
                ${
                  s.plusMinus >= 0
                    ? "+"
                    : ""
                }${s.plusMinus}
              </td>

            </tr>

          `;
        }
      )
      .join("");
}


function formatMinutes(
  minutes
) {

  const total =
    Math.floor(
      Number(minutes) || 0
    );

  const m =
    Math.floor(
      total
    );

  const s =
    Math.floor(
      (
        Number(minutes) -
        m
      ) * 60
    );

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}


/* =========================================================
   SHOT CHART RENDER
========================================================= */

function renderShotChart() {

  const canvas =
    $("shotCanvas") ||
    $("shotChartCanvas") ||
    $("fullCourtCanvas");

  if (!canvas) return;

  drawCourt(
    canvas
  );


  /*
    캔버스 클릭
  */

  if (!canvas.dataset.bound) {

    canvas.addEventListener(
      "click",
      handleCourtClick
    );

    canvas.dataset.bound =
      "true";
  }


  renderShotStats();
}


function renderShotStats() {

  const shots =
    game.shots;

  const made =
    shots.filter(
      s => s.made
    ).length;

  const attempts =
    shots.length;


  const two =
    shots.filter(
      s => s.points === 2
    );

  const three =
    shots.filter(
      s => s.points === 3
    );


  const data = {

    totalShots:
      attempts,

    madeShots:
      made,

    shotPercentage:
      `${percent(
        made,
        attempts
      )}%`,

    twoMade:
      two.filter(
        s => s.made
      ).length,

    twoAttempts:
      two.length,

    twoPercentage:
      `${percent(
        two.filter(
          s => s.made
        ).length,
        two.length
      )}%`,

    threeMade:
      three.filter(
        s => s.made
      ).length,

    threeAttempts:
      three.length,

    threePercentage:
      `${percent(
        three.filter(
          s => s.made
        ).length,
        three.length
      )}%`

  };


  Object.entries(data)
    .forEach(
      ([id, value]) => {

        const el =
          $(id);

        if (el) {
          el.textContent =
            value;
        }
      }
    );
}


/* =========================================================
   SHOT RESET
========================================================= */

function resetShots() {

  if (!game.shots.length) {
    showToast(
      "삭제할 슛 기록이 없습니다."
    );
    return;
  }

  const ok =
    confirm(
      "현재 슛차트 기록을 모두 삭제할까요?"
    );

  if (!ok) return;

  saveUndoState();

  game.shots = [];

  saveState();

  renderShotChart();

  showToast(
    "슛차트를 초기화했습니다."
  );
}


/* =========================================================
   REPORT
========================================================= */

function renderReport() {

  const container =
    $("reportContainer");

  if (!container) return;


  const mvp =
    getMVP();

  const scoreA =
    game.teams.A.score;

  const scoreB =
    game.teams.B.score;


  container.innerHTML = `

    <div class="report-card">

      <h3>
        ${escapeHTML(
          game.gameName
        )}
      </h3>

      <p>
        ${game.date}
        ·
        ${game.location}
        ·
        ${game.mode === "3x3"
          ? "3대3"
          : "5대5"}
      </p>

    </div>


    <div class="report-card">

      <h3>
        최종 스코어
      </h3>

      <p>
        ${escapeHTML(
          game.teams.A.name
        )}
        ${scoreA}
        :
        ${scoreB}
        ${escapeHTML(
          game.teams.B.name
        )}
      </p>

    </div>


    ${
      mvp
        ? `
          <div class="report-card">

            <h3>
              경기 MVP
            </h3>

            <p>
              #${mvp.number}
              ${escapeHTML(mvp.name)}
              ·
              PTS ${mvp.stats.pts}
              ·
              REB ${mvp.stats.reb}
              ·
              AST ${mvp.stats.ast}
            </p>

          </div>
        `
        : ""
    }

  `;
}


/* =========================================================
   SETTINGS
========================================================= */

function renderSettings() {

  qa(
    "[data-setting-team]"
  ).forEach(
    input => {

      const team =
        input.dataset.settingTeam;

      if (
        game.teams[team]
      ) {

        input.value =
          game.teams[
            team
          ].name;

      }

    }
  );


  qa(
    "[data-player-setting]"
  ).forEach(
    input => {

      const player =
        getPlayerById(
          input.dataset.playerSetting
        );

      if (!player) return;

      if (
        input.dataset.field ===
        "name"
      ) {

        input.value =
          player.name;

      }

      if (
        input.dataset.field ===
        "number"
      ) {

        input.value =
          player.number;

      }

    }
  );
}


/* =========================================================
   STRATEGY
========================================================= */

function renderStrategy() {

  const container =
    $("strategyContainer");

  if (!container) return;


  const a =
    game.teams.A;

  const b =
    game.teams.B;


  const aTO =
    teamStat("A", "to");

  const bTO =
    teamStat("B", "to");


  let comment =
    "양 팀의 기록이 아직 부족합니다.";


  if (
    aTO > bTO
  ) {

    comment =
      "A팀은 턴오버 관리가 핵심입니다.";

  } else if (
    bTO > aTO
  ) {

    comment =
      "B팀은 턴오버 관리가 핵심입니다.";

  } else if (
    a.score > b.score
  ) {

    comment =
      "A팀이 현재 공격 효율에서 앞서고 있습니다.";

  } else if (
    b.score > a.score
  ) {

    comment =
      "B팀이 현재 공격 효율에서 앞서고 있습니다.";

  }


  container.innerHTML = `

    <div class="analysis-card">

      <div class="analysis-card-title">
        자동 전력 분석
      </div>

      <div class="analysis-card-text">
        ${comment}
      </div>

    </div>

    <div class="coach-insight">
      ${comment}
    </div>

  `;
}


/* =========================================================
   LEAGUE
========================================================= */

function renderLeague() {

  const container =
    $("leagueContainer");

  if (!container) return;

  /*
    리그 모듈에서
    별도의 데이터 저장 구조를
    사용할 수 있도록 공간만 분리.
  */

  container.innerHTML = `
    <div class="empty-state">
      리그 관리 데이터를 준비 중입니다.
    </div>
  `;
}


/* =========================================================
   SAVE GAME
========================================================= */

function saveGame() {

  /*
    설정 input 반영
  */

  const homeInput =
    $("homeTeamName");

  const awayInput =
    $("awayTeamName");


  if (homeInput?.value.trim()) {

    game.teams.A.name =
      homeInput.value.trim();

  }


  if (awayInput?.value.trim()) {

    game.teams.B.name =
      awayInput.value.trim();

  }


  const gameName =
    $("gameName");

  const location =
    $("location");

  const gameMinutes =
    $("gameMinutes");

  const shotClock =
    $("shotClockSetting");

  const winScore =
    $("winScore");


  if (gameName?.value.trim()) {

    game.gameName =
      gameName.value.trim();

  }

  if (location?.value.trim()) {

    game.location =
      location.value.trim();

  }

  if (
    gameMinutes?.value
  ) {

    game.settings.gameMinutes =
      Number(
        gameMinutes.value
      );

  }

  if (
    shotClock?.value
  ) {

    game.settings.shotClock =
      Number(
        shotClock.value
      );

  }

  if (
    winScore?.value
  ) {

    game.settings.winScore =
      Number(
        winScore.value
      );

  }


  saveState();

  renderAll();

  showToast(
    "경기를 저장했습니다."
  );
}


/* =========================================================
   LOAD GAME
========================================================= */

function loadGameFromStorage() {

  const storage =
    getStorage();

  const saved =
    storage[
      game.mode
    ];

  if (!saved) {

    showToast(
      "저장된 경기가 없습니다."
    );

    return;
  }

  game =
    hydrateGame(
      saved
    );

  renderAll();

  showToast(
    "저장된 경기를 불러왔습니다."
  );
}


/* =========================================================
   RESET
========================================================= */

function resetGame() {

  const ok =
    confirm(
      "현재 경기의 모든 기록을 초기화할까요?"
    );

  if (!ok) return;

  stopGameClock();

  stopShotClock();

  game =
    createGame(
      currentMode
    );

  undoStack = [];

  shotMode = null;

  saveState();

  renderAll();

  showToast(
    "경기를 초기화했습니다."
  );
}


/* =========================================================
   CSV EXPORT
========================================================= */

function exportCSV() {

  const players =
    getAllPlayers();

  const header = [

    "Team",
    "Number",
    "Player",
    "MIN",
    "PTS",
    "REB",
    "OREB",
    "DREB",
    "AST",
    "STL",
    "BLK",
    "TO",
    "PF",
    "FGM",
    "FGA",
    "FG%",
    "2PM",
    "2PA",
    "3PM",
    "3PA",
    "FTM",
    "FTA",
    "+/-"

  ];


  const rows =
    players.map(
      p => {

        const s =
          p.stats;

        return [

          p.team,

          p.number,

          p.name,

          formatMinutes(
            s.minutes
          ),

          s.pts,

          s.reb,

          s.oreb,

          s.dreb,

          s.ast,

          s.stl,

          s.blk,

          s.to,

          s.pf,

          s.fgm,

          s.fga,

          percent(
            s.fgm,
            s.fga
          ),

          s.twoMade,

          s.twoAtt,

          s.threeMade,

          s.threeAtt,

          s.ftm,

          s.fta,

          s.plusMinus

        ];
      }
    );


  const csv = [

    header,

    ...rows

  ]
    .map(
      row =>
        row
          .map(
            value =>
              `"${String(
                value ?? ""
              ).replaceAll(
                '"',
                '""'
              )}"`
          )
          .join(",")
    )
    .join("\n");


  const blob =
    new Blob(
      [
        "\uFEFF" +
        csv
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );

  const a =
    document.createElement(
      "a"
    );

  a.href =
    url;

  a.download =
    `COURTVISION_${game.mode}_${game.date}.csv`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(
    url
  );

  showToast(
    "CSV를 저장했습니다."
  );
}


/* =========================================================
   DELEGATED CLICK
========================================================= */

function handleDelegatedClick(
  event
) {

  const player =
    event.target.closest(
      "[data-player-id]"
    );

  if (
    player &&
    !event.target.closest(
      "input,button"
    )
  ) {

    selectPlayer(
      player.dataset.playerId
    );

  }


  const shotMade =
    event.target.closest(
      "[data-shot-made]"
    );

  if (shotMade) {

    startShotRecord(
      "made"
    );

  }


  const shotMiss =
    event.target.closest(
      "[data-shot-miss]"
    );

  if (shotMiss) {

    startShotRecord(
      "miss"
    );

  }


  const resetShotsButton =
    event.target.closest(
      "[data-reset-shots]"
    );

  if (
    resetShotsButton
  ) {

    resetShots();

  }
}


/* =========================================================
   PUBLIC API
========================================================= */

window.COURTVISION = {

  getGame() {
    return game;
  },

  setMode,

  setPage,

  selectPlayer,

  handleAction,

  startGameClock,

  stopGameClock,

  resetGameClock,

  startShotClock,

  stopShotClock,

  resetShotClock,

  undoLastEvent,

  saveGame,

  resetGame,

  exportCSV,

  recordShotLocation,

  resetShots,

  renderAll

};


/* =========================================================
   GLOBAL COMPATIBILITY
========================================================= */

window.setMode =
  setMode;

window.selectPlayer =
  selectPlayer;

window.handleAction =
  handleAction;

window.startGameClock =
  startGameClock;

window.stopGameClock =
  stopGameClock;

window.resetGameClock =
  resetGameClock;

window.startShotClock =
  startShotClock;

window.stopShotClock =
  stopShotClock;

window.resetShotClock =
  resetShotClock;

window.undoLastEvent =
  undoLastEvent;

window.saveGame =
  saveGame;

window.resetGame =
  resetGame;

window.exportCSV =
  exportCSV;


/* =========================================================
   AUTO INIT
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initApp
  );

} else {

  initApp();

}