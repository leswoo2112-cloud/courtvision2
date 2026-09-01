/* =========================================================
   COURTVISION PRO
   app.js
   3대3 / 5대5 농구 기록·분석 시스템
========================================================= */

"use strict";

/* =========================================================
   1. 기본 상태
========================================================= */

const STORAGE_KEY = "courtvision_pro_games_v2";

let state = {
  mode: "3v3",

  game: {
    date: "",
    title: "농구 경기",
    location: "",
    competition: "",
    teamA: "설천고 A",
    teamB: "설천고 B",
    minutes: 10,
    shotClock: 14,
    periodType: "single",
    targetScore: 21,

    currentPeriod: 1,
    gameSeconds: 600,
    shotSeconds: 14,

    running: false,
    ended: false
  },

  teams: {
    A: {
      name: "설천고 A",
      fouls: 0,
      timeouts: 1,
      players: []
    },

    B: {
      name: "설천고 B",
      fouls: 0,
      timeouts: 1,
      players: []
    }
  },

  selectedPlayerId: null,

  logs: [],
  shots: [],
  videoTags: [],

  substitutions: [],

  lineupHistory: [],

  league: {
    teams: [],
    schedules: [],
    results: []
  },

  undoStack: []
};

/* =========================================================
   2. 초기 선수
========================================================= */

function createPlayer(team, number, name, onCourt = false) {
  return {
    id:
      team +
      "_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2),

    team,
    number: String(number),
    name,

    onCourt,

    stats: {
      points: 0,

      ftMade: 0,
      ftAttempt: 0,

      twoMade: 0,
      twoAttempt: 0,

      threeMade: 0,
      threeAttempt: 0,

      fgMade: 0,
      fgAttempt: 0,

      reb: 0,
      off: 0,
      def: 0,

      ast: 0,
      stl: 0,
      blk: 0,
      to: 0,
      pf: 0,

      minutes: 0,

      plusMinus: 0
    },

    periods: {},

    shotHistory: [],

    lineupTime: 0
  };
}

/* =========================================================
   3. 기본 선수 생성
========================================================= */

function createDefaultPlayers() {
  state.teams.A.players = [
    createPlayer("A", 1, "A 선수 1", true),
    createPlayer("A", 2, "A 선수 2", true),
    createPlayer("A", 3, "A 선수 3", true),
    createPlayer("A", 4, "A 선수 4", false),
    createPlayer("A", 5, "A 선수 5", false)
  ];

  state.teams.B.players = [
    createPlayer("B", 1, "B 선수 1", true),
    createPlayer("B", 2, "B 선수 2", true),
    createPlayer("B", 3, "B 선수 3", true),
    createPlayer("B", 4, "B 선수 4", false),
    createPlayer("B", 5, "B 선수 5", false)
  ];
}

createDefaultPlayers();

/* =========================================================
   4. DOM 헬퍼
========================================================= */

const $ = (id) => document.getElementById(id);

function q(selector) {
  return document.querySelector(selector);
}

function qa(selector) {
  return [...document.querySelectorAll(selector)];
}

/* =========================================================
   5. 안전한 HTML 처리
========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   6. 모드
========================================================= */

function setMode(mode) {
  state.mode = mode;

  const is3 = mode === "3v3";

  $("mode3v3Btn")?.classList.toggle("active", is3);
  $("mode5v5Btn")?.classList.toggle("active", !is3);

  if ($("liveGameMode")) {
    $("liveGameMode").textContent = is3 ? "3대3" : "5대5";
  }

  if ($("liveModeLabel")) {
    $("liveModeLabel").textContent =
      is3 ? "3대3 모드" : "5대5 모드";
  }

  renderOnCourt();
  renderPlayerSetup();
  renderAll();

  saveLocalState();
}

/* =========================================================
   7. 선수 찾기
========================================================= */

function getAllPlayers() {
  return [
    ...state.teams.A.players,
    ...state.teams.B.players
  ];
}

function getPlayer(id) {
  return getAllPlayers().find((p) => p.id === id);
}

function getTeamPlayers(team) {
  return state.teams[team].players;
}

function getSelectedPlayer() {
  return getPlayer(state.selectedPlayerId);
}

/* =========================================================
   8. 선수 선택
========================================================= */

function selectPlayer(id) {
  state.selectedPlayerId = id;
  renderOnCourt();
  renderActionPanel();
}

/* =========================================================
   9. 현재 출전 인원
========================================================= */

function getRequiredPlayers() {
  return state.mode === "3v3" ? 3 : 5;
}

/* =========================================================
   10. 선수 기록 추가
========================================================= */

function snapshot() {
  state.undoStack.push(
    JSON.stringify({
      teams: state.teams,
      logs: state.logs,
      shots: state.shots,
      substitutions: state.substitutions
    })
  );

  if (state.undoStack.length > 30) {
    state.undoStack.shift();
  }
}

function restoreSnapshot() {
  if (!state.undoStack.length) return;

  const raw = state.undoStack.pop();

  const old = JSON.parse(raw);

  state.teams = old.teams;
  state.logs = old.logs;
  state.shots = old.shots;
  state.substitutions = old.substitutions;

  renderAll();
}

/* =========================================================
   11. 포인트 처리
========================================================= */

function recordPoints(player, type) {
  snapshot();

  const s = player.stats;

  /*
    3대3 규칙:
    자유투 = 1점
    2점슛 = 1점
    3점슛 = 2점
  */

  if (type === "points1") {
    s.ftAttempt++;
    s.ftMade++;

    s.points += 1;
  }

  if (type === "points2") {
    s.twoAttempt++;
    s.twoMade++;

    if (state.mode === "3v3") {
      s.points += 1;
    } else {
      s.points += 2;
    }
  }

  if (type === "points3") {
    s.threeAttempt++;
    s.threeMade++;

    if (state.mode === "3v3") {
      s.points += 2;
    } else {
      s.points += 3;
    }
  }

  s.fgMade =
    s.twoMade +
    s.threeMade;

  s.fgAttempt =
    s.twoAttempt +
    s.threeAttempt;

  applyPlusMinus(player.team, s.points);

  addLog(
    player,
    type === "points1"
      ? "자유투 성공 +1"
      : type === "points2"
      ? state.mode === "3v3"
        ? "2점 성공 +1"
        : "2점 성공 +2"
      : state.mode === "3v3"
      ? "3점 성공 +2"
      : "3점 성공 +3"
  );

  addPeriodStat(player);
  checkGameEnd();

  renderAll();
}

/* =========================================================
   12. 실패
========================================================= */

function recordMiss(player) {
  snapshot();

  /*
    실패 버튼은 기본적으로
    일반 필드골 실패로 처리.
  */

  player.stats.fgAttempt++;

  addLog(player, "슛 실패");

  addShot(player, false);

  addPeriodStat(player);

  renderAll();
}

/* =========================================================
   13. 일반 스탯
========================================================= */

function recordStat(action) {
  const player = getSelectedPlayer();

  if (!player) {
    alert("먼저 선수를 선택해주세용.");
    return;
  }

  if (
    action !== "subIn" &&
    action !== "subOut"
  ) {
    snapshot();
  }

  const s = player.stats;

  const map = {
    reb: "reb",
    ast: "ast",
    stl: "stl",
    blk: "blk",
    to: "to",
    pf: "pf"
  };

  if (map[action]) {
    s[map[action]]++;
  }

  if (action === "reb") {
    /*
      공격/수비 리바운드는
      별도 구분 버튼이 없기 때문에
      기본 리바운드로 저장.
    */
  }

  if (action === "pf") {
    state.teams[player.team].fouls++;
  }

  if (action === "subIn") {
    substituteIn(player);
    return;
  }

  if (action === "subOut") {
    substituteOut(player);
    return;
  }

  addLog(
    player,
    {
      reb: "리바운드",
      ast: "어시스트",
      stl: "스틸",
      blk: "블록",
      to: "턴오버",
      pf: "파울"
    }[action]
  );

  addPeriodStat(player);

  renderAll();
}

/* =========================================================
   14. 팀 점수
========================================================= */

function getTeamScore(team) {
  return getTeamPlayers(team).reduce(
    (sum, p) => sum + p.stats.points,
    0
  );
}

/* =========================================================
   15. +/- 처리
========================================================= */

function applyPlusMinus(team, pointsAdded) {
  const opposingTeam = team === "A" ? "B" : "A";

  getTeamPlayers(team)
    .filter((p) => p.onCourt)
    .forEach((p) => {
      p.stats.plusMinus += pointsAdded;
    });

  getTeamPlayers(opposingTeam)
    .filter((p) => p.onCourt)
    .forEach((p) => {
      p.stats.plusMinus -= pointsAdded;
    });
}

/* =========================================================
   16. 로그
========================================================= */

function addLog(player, action) {
  state.logs.unshift({
    id: Date.now() + Math.random(),

    time: formatGameClock(),

    period: state.game.currentPeriod,

    playerId: player.id,

    playerName: player.name,

    number: player.number,

    team: player.team,

    action,

    mode: state.mode
  });

  if (state.logs.length > 200) {
    state.logs.length = 200;
  }
}

/* =========================================================
   17. 구간 기록
========================================================= */

function addPeriodStat(player) {
  const period = state.game.currentPeriod;

  if (!player.periods[period]) {
    player.periods[period] = {
      points: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      to: 0,
      pf: 0
    };
  }

  const p = player.periods[period];

  p.points = player.stats.points;
  p.reb = player.stats.reb;
  p.ast = player.stats.ast;
  p.stl = player.stats.stl;
  p.blk = player.stats.blk;
  p.to = player.stats.to;
  p.pf = player.stats.pf;
}

/* =========================================================
   18. 슛차트
========================================================= */

function addShot(player, made, x = null, y = null) {
  const shot = {
    id: Date.now() + Math.random(),

    playerId: player.id,

    playerName: player.name,

    team: player.team,

    made,

    x,
    y,

    period: state.game.currentPeriod,

    time: formatGameClock(),

    mode: state.mode
  };

  state.shots.push(shot);

  player.shotHistory.push(shot);
}

/* =========================================================
   19. 경기 종료
========================================================= */

function checkGameEnd() {
  if (state.mode !== "3v3") return;

  const target = Number(state.game.targetScore) || 21;

  const a = getTeamScore("A");
  const b = getTeamScore("B");

  if (a >= target || b >= target) {
    state.game.ended = true;
    state.game.running = false;
  }
}

/* =========================================================
   20. 교체
========================================================= */

function substituteIn(player) {
  const teamPlayers = getTeamPlayers(player.team);

  const current =
    teamPlayers.filter((p) => p.onCourt).length;

  const max =
    getRequiredPlayers();

  if (player.onCourt) return;

  if (current >= max) {
    alert(
      `${state.mode === "3v3" ? "3" : "5"}명 이상은 동시에 출전할 수 없어용.`
    );
    return;
  }

  snapshot();

  player.onCourt = true;

  state.substitutions.unshift({
    time: formatGameClock(),
    period: state.game.currentPeriod,
    team: player.team,
    playerId: player.id,
    playerName: player.name,
    type: "IN"
  });

  addLog(player, "선수 투입");

  renderAll();
}

function substituteOut(player) {
  if (!player.onCourt) return;

  snapshot();

  player.onCourt = false;

  state.substitutions.unshift({
    time: formatGameClock(),
    period: state.game.currentPeriod,
    team: player.team,
    playerId: player.id,
    playerName: player.name,
    type: "OUT"
  });

  addLog(player, "교체 아웃");

  renderAll();
}

/* =========================================================
   21. 시계
========================================================= */

let clockTimer = null;
let lastTick = null;

function startClock() {
  if (state.game.running || state.game.ended) return;

  state.game.running = true;
  lastTick = Date.now();

  clockTimer = setInterval(() => {
    const now = Date.now();

    const delta =
      Math.max(0, now - lastTick) / 1000;

    lastTick = now;

    state.game.gameSeconds -= delta;
    state.game.shotSeconds -= delta;

    if (state.game.gameSeconds <= 0) {
      state.game.gameSeconds = 0;
      pauseClock();

      if (state.game.periodType === "single") {
        state.game.ended = true;
      }
    }

    if (state.game.shotSeconds <= 0) {
      state.game.shotSeconds = 0;
    }

    updateClockUI();
  }, 100);
}

function pauseClock() {
  state.game.running = false;

  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

function resetShotClock() {
  state.game.shotSeconds =
    Number(state.game.shotClock) || 14;

  updateClockUI();
}

function nextPeriod() {
  pauseClock();

  state.game.currentPeriod++;

  state.game.gameSeconds =
    Number(state.game.minutes) * 60;

  resetShotClock();

  renderAll();
}

function formatClock(seconds) {
  seconds = Math.max(0, Number(seconds) || 0);

  const min = Math.floor(seconds / 60);

  const sec = Math.floor(seconds % 60);

  return (
    String(min).padStart(2, "0") +
    ":" +
    String(sec).padStart(2, "0")
  );
}

function formatGameClock() {
  return formatClock(state.game.gameSeconds);
}

function updateClockUI() {
  if ($("gameClock")) {
    $("gameClock").textContent =
      formatClock(state.game.gameSeconds);
  }

  if ($("shotClock")) {
    $("shotClock").textContent =
      Math.ceil(state.game.shotSeconds);
  }
}

/* =========================================================
   22. 선수 설정 UI
========================================================= */

function renderPlayerSetup() {
  renderTeamPlayerSetup("A");
  renderTeamPlayerSetup("B");
}

function renderTeamPlayerSetup(team) {
  const container =
    team === "A"
      ? $("teamAPlayers")
      : $("teamBPlayers");

  if (!container) return;

  container.innerHTML = "";

  getTeamPlayers(team).forEach((player) => {
    const row = document.createElement("div");

    row.className = "player-form-row";

    row.innerHTML = `
      <input
        type="text"
        value="${escapeHTML(player.number)}"
        data-number="${player.id}"
        aria-label="등번호"
      >

      <input
        type="text"
        value="${escapeHTML(player.name)}"
        data-name="${player.id}"
        aria-label="선수 이름"
      >

      <button
        type="button"
        data-oncourt-player="${player.id}"
      >
        ${player.onCourt ? "출전" : "벤치"}
      </button>

      <button
        type="button"
        data-remove-player="${player.id}"
      >
        ✕
      </button>
    `;

    container.appendChild(row);
  });
}

/* =========================================================
   23. 선수 추가
========================================================= */

function addPlayer(team) {
  const players = getTeamPlayers(team);

  const number =
    players.length + 1;

  const player =
    createPlayer(
      team,
      number,
      `${team} 선수 ${number}`,
      players.filter((p) => p.onCourt).length <
        getRequiredPlayers()
    );

  players.push(player);

  renderPlayerSetup();
  renderOnCourt();
  updatePlayerSelects();

  saveLocalState();
}

/* =========================================================
   24. 선수 삭제
========================================================= */

function removePlayer(id) {
  const player = getPlayer(id);

  if (!player) return;

  const team = player.team;

  state.teams[team].players =
    state.teams[team].players.filter(
      (p) => p.id !== id
    );

  if (state.selectedPlayerId === id) {
    state.selectedPlayerId = null;
  }

  renderAll();
}

/* =========================================================
   25. 출전 버튼
========================================================= */

function toggleOnCourt(id) {
  const player = getPlayer(id);

  if (!player) return;

  if (player.onCourt) {
    substituteOut(player);
  } else {
    substituteIn(player);
  }
}

/* =========================================================
   26. UI 선수 카드
========================================================= */

function renderOnCourt() {
  renderOnCourtTeam("A");
  renderOnCourtTeam("B");

  const countA =
    getTeamPlayers("A").length;

  const countB =
    getTeamPlayers("B").length;

  if ($("teamAPlayerCount")) {
    $("teamAPlayerCount").textContent =
      `선수 ${countA}명`;
  }

  if ($("teamBPlayerCount")) {
    $("teamBPlayerCount").textContent =
      `선수 ${countB}명`;
  }
}

function renderOnCourtTeam(team) {
  const container =
    team === "A"
      ? $("teamAOnCourt")
      : $("teamBOnCourt");

  if (!container) return;

  container.innerHTML = "";

  getTeamPlayers(team).forEach((player) => {
    if (!player.onCourt) return;

    const card =
      document.createElement("button");

    card.type = "button";

    card.className =
      "player-live-card " +
      (team === "A"
        ? "team-a-card "
        : "team-b-card ") +
      (state.selectedPlayerId === player.id
        ? "selected"
        : "");

    card.innerHTML = `
      <span class="number">
        ${escapeHTML(player.number)}
      </span>

      <span class="name">
        ${escapeHTML(player.name)}
      </span>

      <span class="points">
        ${player.stats.points} PTS
      </span>
    `;

    card.addEventListener("click", () => {
      selectPlayer(player.id);
    });

    container.appendChild(card);
  });
}

/* =========================================================
   27. 선택 선수 패널
========================================================= */

function renderActionPanel() {
  const player = getSelectedPlayer();

  if (!player) {
    if ($("selectedPlayerName")) {
      $("selectedPlayerName").textContent =
        "선수를 선택해주세용";
    }

    if ($("selectedPlayerLiveInfo")) {
      $("selectedPlayerLiveInfo").textContent =
        "출전 시간 00:00 · +/- 0";
    }

    if ($("selectedPlayerTeamTag")) {
      $("selectedPlayerTeamTag").textContent =
        "팀 선택 대기";
    }

    return;
  }

  $("selectedPlayerName").textContent =
    `#${player.number} ${player.name}`;

  $("selectedPlayerLiveInfo").textContent =
    `출전 시간 ${formatClock(
      player.stats.minutes
    )} · +/- ${player.stats.plusMinus}`;

  $("selectedPlayerTeamTag").textContent =
    player.team === "A"
      ? "TEAM A"
      : "TEAM B";
}

/* =========================================================
   28. 점수판
========================================================= */

function renderScoreboard() {
  const scoreA = getTeamScore("A");
  const scoreB = getTeamScore("B");

  if ($("teamAScore"))
    $("teamAScore").textContent = scoreA;

  if ($("teamBScore"))
    $("teamBScore").textContent = scoreB;

  if ($("scoreboardAValue"))
    $("scoreboardAValue").textContent = scoreA;

  if ($("scoreboardBValue"))
    $("scoreboardBValue").textContent = scoreB;

  if ($("teamANameDisplay"))
    $("teamANameDisplay").textContent =
      state.teams.A.name;

  if ($("teamBNameDisplay"))
    $("teamBNameDisplay").textContent =
      state.teams.B.name;

  if ($("scoreboardTeamA"))
    $("scoreboardTeamA").textContent =
      state.teams.A.name;

  if ($("scoreboardTeamB"))
    $("scoreboardTeamB").textContent =
      state.teams.B.name;

  if ($("teamAFouls"))
    $("teamAFouls").textContent =
      state.teams.A.fouls;

  if ($("teamBFouls"))
    $("teamBFouls").textContent =
      state.teams.B.fouls;

  if ($("scoreboardAFouls"))
    $("scoreboardAFouls").textContent =
      state.teams.A.fouls;

  if ($("scoreboardBFouls"))
    $("scoreboardBFouls").textContent =
      state.teams.B.fouls;

  if ($("teamATimeouts"))
    $("teamATimeouts").textContent =
      state.teams.A.timeouts;

  if ($("teamBTimeouts"))
    $("teamBTimeouts").textContent =
      state.teams.B.timeouts;

  if ($("scoreboardATimeouts"))
    $("scoreboardATimeouts").textContent =
      state.teams.A.timeouts;

  if ($("scoreboardBTimeouts"))
    $("scoreboardBTimeouts").textContent =
      state.teams.B.timeouts;

  if ($("quarterLabel")) {
    $("quarterLabel").textContent =
      getPeriodLabel();
  }
}

function getPeriodLabel() {
  if (
    state.game.periodType === "quarter"
  ) {
    return `${state.game.currentPeriod}Q`;
  }

  if (
    state.game.periodType === "half"
  ) {
    return state.game.currentPeriod === 1
      ? "전반"
      : "후반";
  }

  return "LIVE";
}

/* =========================================================
   29. 팀 비교
========================================================= */

function renderComparison() {
  const stats = [
    ["Pts", "points"],
    ["Reb", "reb"],
    ["Ast", "ast"],
    ["Stl", "stl"],
    ["Blk", "blk"],
    ["To", "to"]
  ];

  stats.forEach(([id, key]) => {
    const a =
      getTeamPlayers("A").reduce(
        (sum, p) => sum + p.stats[key],
        0
      );

    const b =
      getTeamPlayers("B").reduce(
        (sum, p) => sum + p.stats[key],
        0
      );

    const elA = $(
      `compare${id}A`
    );

    const elB = $(
      `compare${id}B`
    );

    if (elA) elA.textContent = a;
    if (elB) elB.textContent = b;

    const total = a + b || 1;

    const barA = $(
      `compareBar${id}A`
    );

    const barB = $(
      `compareBar${id}B`
    );

    if (barA)
      barA.style.width =
        `${(a / total) * 100}%`;

    if (barB)
      barB.style.width =
        `${(b / total) * 100}%`;
  });
}

/* =========================================================
   30. 최근 기록
========================================================= */

function renderRecentLogs() {
  const container =
    $("recentLogList");

  if (!container) return;

  if (!state.logs.length) {
    container.innerHTML =
      `<div class="empty-message">
        아직 기록이 없습니다.
      </div>`;
    return;
  }

  container.innerHTML =
    state.logs
      .slice(0, 30)
      .map(
        (log) => `
        <div class="recent-log-row">
          <time>${escapeHTML(log.time)}</time>

          <strong>
            ${escapeHTML(log.playerName)}
            · ${escapeHTML(log.action)}
          </strong>

          <span>
            ${log.team}
          </span>
        </div>
      `
      )
      .join("");
}

/* =========================================================
   31. MVP
========================================================= */

function calculateMvpScore(player) {
  const s = player.stats;

  return (
    s.points +
    s.reb * 1.2 +
    s.ast * 1.5 +
    s.stl * 2 +
    s.blk * 2 -
    s.to * 1.2 -
    s.pf * 0.5
  );
}

function renderMVP() {
  const players =
    getAllPlayers()
      .filter(
        (p) =>
          p.stats.points ||
          p.stats.reb ||
          p.stats.ast ||
          p.stats.stl ||
          p.stats.blk
      )
      .sort(
        (a, b) =>
          calculateMvpScore(b) -
          calculateMvpScore(a)
      );

  const container = $("mvpCard");

  if (!container) return;

  if (!players.length) {
    container.innerHTML = `
      <div class="mvp-icon">🏀</div>

      <div class="mvp-info">
        <div class="mvp-team">TEAM</div>
        <div class="mvp-name">
          선수를 기다리는 중
        </div>
        <div class="mvp-stats">
          PTS 0 · REB 0 · AST 0
        </div>
      </div>

      <div class="mvp-score">0.0</div>
    `;

    return;
  }

  const p = players[0];
  const s = p.stats;

  container.innerHTML = `
    <div class="mvp-icon">🏀</div>

    <div class="mvp-info">
      <div class="mvp-team">
        TEAM ${p.team}
      </div>

      <div class="mvp-name">
        #${escapeHTML(p.number)}
        ${escapeHTML(p.name)}
      </div>

      <div class="mvp-stats">
        PTS ${s.points}
        · REB ${s.reb}
        · AST ${s.ast}
      </div>
    </div>

    <div class="mvp-score">
      ${calculateMvpScore(p).toFixed(1)}
    </div>
  `;
}

/* =========================================================
   32. LIVE LEADERS
========================================================= */

function renderLiveLeaders() {
  const container =
    $("liveLeaderCards");

  if (!container) return;

  const categories = [
    ["득점", "points"],
    ["리바운드", "reb"],
    ["어시스트", "ast"],
    ["스틸", "stl"],
    ["블록", "blk"]
  ];

  const players = getAllPlayers();

  container.innerHTML =
    categories
      .map(([label, key]) => {
        const leader =
          [...players].sort(
            (a, b) =>
              b.stats[key] -
              a.stats[key]
          )[0];

        if (!leader || !leader.stats[key]) {
          return `
            <div class="live-leader-card">
              <span>${label}</span>
              <strong>기록 없음</strong>
              <b>0</b>
            </div>
          `;
        }

        return `
          <div class="live-leader-card">
            <span>${label}</span>

            <strong>
              #${escapeHTML(leader.number)}
              ${escapeHTML(leader.name)}
            </strong>

            <b>${leader.stats[key]}</b>
          </div>
        `;
      })
      .join("");
}

/* =========================================================
   33. 미니 슛차트
========================================================= */

function drawMiniCourt() {
  const canvas =
    $("miniCourtCanvas");

  if (!canvas) return;

  const ctx =
    canvas.getContext("2d");

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "#314656";
  ctx.lineWidth = 2;

  ctx.strokeRect(
    10,
    10,
    w - 20,
    h - 20
  );

  ctx.beginPath();

  ctx.arc(
    w / 2,
    h - 38,
    55,
    Math.PI,
    2 * Math.PI
  );

  ctx.stroke();

  state.shots
    .filter(
      (shot) =>
        shot.x !== null &&
        shot.y !== null
    )
    .slice(-80)
    .forEach((shot) => {
      ctx.beginPath();

      ctx.arc(
        shot.x * w,
        shot.y * h,
        5,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        shot.made
          ? "#2f93ff"
          : "#ff4c55";

      ctx.fill();
    });
}

/* =========================================================
   34. 전체 기록표
========================================================= */

function renderStatsTable() {
  const tbody =
    $("statsTableBody");

  if (!tbody) return;

  const teamFilter =
    $("recordFilterTeam")?.value || "all";

  let players = getAllPlayers();

  if (teamFilter !== "all") {
    players =
      players.filter(
        (p) => p.team === teamFilter
      );
  }

  if (!players.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="16"
            class="empty-cell">
          아직 선수가 없습니다.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    players
      .map((p) => {
        const s = p.stats;

        const fgPct =
          s.fgAttempt
            ? (
                (s.fgMade /
                  s.fgAttempt) *
                100
              ).toFixed(1)
            : "0.0";

        return `
          <tr>
            <td>${p.team}</td>
            <td>${escapeHTML(p.number)}</td>
            <td>${escapeHTML(p.name)}</td>
            <td>${formatClock(s.minutes)}</td>
            <td>${s.points}</td>
            <td>${s.reb}</td>
            <td>${s.ast}</td>
            <td>${s.stl}</td>
            <td>${s.blk}</td>
            <td>${s.to}</td>
            <td>${s.pf}</td>
            <td>${s.fgMade}/${s.fgAttempt}</td>
            <td>${fgPct}%</td>
            <td>${s.plusMinus}</td>
            <td>${s.off}</td>
            <td>${s.def}</td>
          </tr>
        `;
      })
      .join("");
}

/* =========================================================
   35. 팀 요약
========================================================= */

function renderTeamSummary() {
  const container =
    $("teamSummaryCards");

  if (!container) return;

  container.innerHTML =
    ["A", "B"]
      .map((team) => {
        const players =
          getTeamPlayers(team);

        const points =
          getTeamScore(team);

        const reb =
          players.reduce(
            (a, p) => a + p.stats.reb,
            0
          );

        const ast =
          players.reduce(
            (a, p) => a + p.stats.ast,
            0
          );

        const stl =
          players.reduce(
            (a, p) => a + p.stats.stl,
            0
          );

        const to =
          players.reduce(
            (a, p) => a + p.stats.to,
            0
          );

        return `
          <div class="summary-stat-card">
            <span>TEAM ${team} PTS</span>
            <strong>${points}</strong>
          </div>

          <div class="summary-stat-card">
            <span>TEAM ${team} REB</span>
            <strong>${reb}</strong>
          </div>

          <div class="summary-stat-card">
            <span>TEAM ${team} AST</span>
            <strong>${ast}</strong>
          </div>

          <div class="summary-stat-card">
            <span>TEAM ${team} STL</span>
            <strong>${stl}</strong>
          </div>

          <div class="summary-stat-card">
            <span>TEAM ${team} TO</span>
            <strong>${to}</strong>
          </div>
        `;
      })
      .join("");
}

/* =========================================================
   36. 선수 상세
========================================================= */

function renderPlayerDetail() {
  const player =
    getPlayer(
      $("playerDetailSelect")?.value
    );

  const container =
    $("playerDetailCard");

  if (!container) return;

  if (!player) {
    container.innerHTML =
      `<div class="empty-message">
        선수를 선택하면 상세 기록이 표시돼용.
      </div>`;

    return;
  }

  const s = player.stats;

  container.innerHTML = `
    <div class="player-detail-grid">

      <div class="player-detail-stat">
        <span>PTS</span>
        <strong>${s.points}</strong>
      </div>

      <div class="player-detail-stat">
        <span>REB</span>
        <strong>${s.reb}</strong>
      </div>

      <div class="player-detail-stat">
        <span>AST</span>
        <strong>${s.ast}</strong>
      </div>

      <div class="player-detail-stat">
        <span>STL</span>
        <strong>${s.stl}</strong>
      </div>

      <div class="player-detail-stat">
        <span>BLK</span>
        <strong>${s.blk}</strong>
      </div>

      <div class="player-detail-stat">
        <span>TO</span>
        <strong>${s.to}</strong>
      </div>

      <div class="player-detail-stat">
        <span>PF</span>
        <strong>${s.pf}</strong>
      </div>

      <div class="player-detail-stat">
        <span>+/-</span>
        <strong>${s.plusMinus}</strong>
      </div>
    </div>
  `;
}

/* =========================================================
   37. 슛차트
========================================================= */

let shotMode = "made";

function drawShotChart() {
  const canvas =
    $("shotChartCanvas");

  if (!canvas) return;

  const ctx =
    canvas.getContext("2d");

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "#314656";
  ctx.lineWidth = 3;

  ctx.strokeRect(
    20,
    20,
    w - 40,
    h - 40
  );

  /*
    골대
  */

  ctx.beginPath();

  ctx.arc(
    w / 2,
    h - 70,
    28,
    0,
    Math.PI * 2
  );

  ctx.stroke();

  /*
    페인트
  */

  ctx.strokeRect(
    w / 2 - 100,
    h - 220,
    200,
    170
  );

  /*
    슛 기록
  */

  const view =
    $("shotViewMode")?.value || "player";

  const selected =
    $("shotPlayerSelect")?.value;

  let shots =
    state.shots.filter((shot) => {
      if (
        view === "player" &&
        selected &&
        shot.playerId !== selected
      ) {
        return false;
      }

      if (
        view === "teamA" &&
        shot.team !== "A"
      ) {
        return false;
      }

      if (
        view === "teamB" &&
        shot.team !== "B"
      ) {
        return false;
      }

      return true;
    });

  shots.forEach((shot) => {
    if (
      shot.x === null ||
      shot.y === null
    ) {
      return;
    }

    ctx.beginPath();

    ctx.arc(
      shot.x * w,
      shot.y * h,
      9,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      shot.made
        ? "#2f93ff"
        : "#ff4c55";

    ctx.fill();
  });
}

/* =========================================================
   38. 슛 위치 기록
========================================================= */

function recordShotAtCanvas(event, made) {
  const canvas =
    $("shotChartCanvas");

  const player =
    getSelectedPlayer();

  if (!player) {
    alert("먼저 선수를 선택해주세용.");
    return;
  }

  const rect =
    canvas.getBoundingClientRect();

  const x =
    (event.clientX - rect.left) /
    rect.width;

  const y =
    (event.clientY - rect.top) /
    rect.height;

  snapshot();

  addShot(
    player,
    made,
    Math.max(0, Math.min(1, x)),
    Math.max(0, Math.min(1, y))
  );

  if (made) {
    /*
      슛차트 위치 기록은
      별도의 점수 버튼과 중복되지 않게
      위치만 기록.
    */
  }

  renderShotChart();
}

/* =========================================================
   39. 슛 요약
========================================================= */

function renderShotSummary() {
  const container =
    $("shotSummaryCard");

  if (!container) return;

  const selected =
    $("shotPlayerSelect")?.value;

  if (!selected) {
    container.innerHTML =
      `<div class="empty-message">
        선수를 선택하면 슛 기록이 표시돼용.
      </div>`;

    return;
  }

  const shots =
    state.shots.filter(
      (s) =>
        s.playerId === selected
    );

  const made =
    shots.filter((s) => s.made).length;

  const total =
    shots.length;

  const pct =
    total
      ? ((made / total) * 100).toFixed(1)
      : "0.0";

  container.innerHTML = `
    <div class="shot-summary-stat">
      <span>전체 슛</span>
      <strong>${total}</strong>
    </div>

    <div class="shot-summary-stat">
      <span>성공</span>
      <strong>${made}</strong>
    </div>

    <div class="shot-summary-stat">
      <span>성공률</span>
      <strong>${pct}%</strong>
    </div>
  `;
}

/* =========================================================
   40. 구역 분석
========================================================= */

function getShotZone(shot) {
  if (shot.x === null || shot.y === null) {
    return "미지정";
  }

  const x = shot.x;
  const y = shot.y;

  if (y > 0.72) return "골밑";

  if (x < 0.32) return "왼쪽";

  if (x > 0.68) return "오른쪽";

  if (y < 0.4) return "탑";

  return "중앙";
}

function renderZoneAnalysis() {
  const container =
    $("zoneAnalysisCards");

  if (!container) return;

  const zones = [
    "골밑",
    "왼쪽",
    "오른쪽",
    "탑",
    "중앙"
  ];

  const selected =
    $("shotPlayerSelect")?.value;

  const shots =
    state.shots.filter(
      (s) =>
        !selected ||
        s.playerId === selected
    );

  if (!shots.length) {
    container.innerHTML =
      `<div class="empty-message">
        슛 위치를 기록하면 구역별 분석이 표시돼용.
      </div>`;

    return;
  }

  container.innerHTML =
    zones
      .map((zone) => {
        const list =
          shots.filter(
            (s) =>
              getShotZone(s) === zone
          );

        const made =
          list.filter(
            (s) => s.made
          ).length;

        const pct =
          list.length
            ? (
                (made /
                  list.length) *
                100
              ).toFixed(0)
            : "0";

        return `
          <div class="zone-card">
            <span>${zone}</span>

            <strong>
              ${pct}%
            </strong>

            <small>
              ${made}/${list.length}
            </small>
          </div>
        `;
      })
      .join("");
}

/* =========================================================
   41. 선수 선택 Select
========================================================= */

function updatePlayerSelects() {
  const selects = [
    $("playerDetailSelect"),
    $("shotPlayerSelect"),
    $("videoPlayerSelect"),
    $("reportPlayerSelect")
  ];

  selects.forEach((select) => {
    if (!select) return;

    const old =
      select.value;

    select.innerHTML = `
      <option value="">
        선수를 선택해주세용
      </option>
    `;

    getAllPlayers().forEach((player) => {
      const option =
        document.createElement("option");

      option.value =
        player.id;

      option.textContent =
        `#${player.number} ${player.name} (TEAM ${player.team})`;

      select.appendChild(option);
    });

    if (
      getPlayer(old)
    ) {
      select.value = old;
    }
  });
}

/* =========================================================
   42. 기간 Select
========================================================= */

function updatePeriodSelects() {
  const selects = [
    $("recordFilterPeriod"),
    $("shotPeriodFilter")
  ];

  selects.forEach((select) => {
    if (!select) return;

    const current =
      select.value;

    select.innerHTML =
      `<option value="all">
        전체 구간
      </option>`;

    for (
      let i = 1;
      i <= state.game.currentPeriod;
      i++
    ) {
      const option =
        document.createElement("option");

      option.value = i;

      option.textContent =
        `${i}구간`;

      select.appendChild(option);
    }

    select.value =
      current || "all";
  });
}

/* =========================================================
   43. 리포트
========================================================= */

function generateGameReport() {
  const a = getTeamScore("A");
  const b = getTeamScore("B");

  const winner =
    a === b
      ? "무승부"
      : a > b
      ? state.teams.A.name
      : state.teams.B.name;

  const all =
    getAllPlayers();

  const mvp =
    [...all].sort(
      (x, y) =>
        calculateMvpScore(y) -
        calculateMvpScore(x)
    )[0];

  $("gameReportOutput").innerHTML = `
    <div class="report-highlight">
      <strong>최종 스코어</strong><br>
      ${escapeHTML(state.teams.A.name)}
      ${a}
      :
      ${b}
      ${escapeHTML(state.teams.B.name)}
      <br>
      승자: ${escapeHTML(winner)}
    </div>

    <h4>경기 모드</h4>

    <p>
      ${state.mode === "3v3" ? "3대3" : "5대5"}
    </p>

    <h4>경기 핵심</h4>

    <p>
      총 기록 ${state.logs.length}개,
      슛 기록 ${state.shots.length}개가 저장되었습니다.
    </p>

    <h4>현재 MVP</h4>

    <p>
      ${
        mvp
          ? `#${escapeHTML(mvp.number)}
             ${escapeHTML(mvp.name)}
             · PTS ${mvp.stats.points}
             · REB ${mvp.stats.reb}
             · AST ${mvp.stats.ast}`
          : "기록 없음"
      }
    </p>
  `;
}

function generatePlayerReport() {
  const id =
    $("reportPlayerSelect")?.value;

  const player =
    getPlayer(id);

  if (!player) {
    alert("선수를 선택해주세용.");
    return;
  }

  const s =
    player.stats;

  const fg =
    s.fgAttempt
      ? (
          (s.fgMade /
            s.fgAttempt) *
          100
        ).toFixed(1)
      : "0.0";

  $("playerReportOutput").innerHTML = `
    <div class="report-blue-box">
      <strong>
        #${escapeHTML(player.number)}
        ${escapeHTML(player.name)}
      </strong>

      <p>
        TEAM ${player.team}
        · ${state.mode === "3v3" ? "3대3" : "5대5"}
      </p>
    </div>

    <h4>공격</h4>

    <p>
      PTS ${s.points}
      · FG ${s.fgMade}/${s.fgAttempt}
      · FG% ${fg}%
    </p>

    <h4>수비·플레이</h4>

    <p>
      REB ${s.reb}
      · STL ${s.stl}
      · BLK ${s.blk}
      · PF ${s.pf}
    </p>

    <h4>플레이메이킹</h4>

    <p>
      AST ${s.ast}
      · TO ${s.to}
    </p>

    <h4>Plus / Minus</h4>

    <p>
      ${s.plusMinus >= 0 ? "+" : ""}
      ${s.plusMinus}
    </p>
  `;

  generateAIComment(player);
}

function generateAIComment(player) {
  const s =
    player.stats;

  const comments = [];

  if (s.points >= 10) {
    comments.push(
      "득점 생산력이 돋보였어용."
    );
  }

  if (s.ast >= 4) {
    comments.push(
      "동료를 살리는 플레이가 좋았어용."
    );
  }

  if (s.reb >= 5) {
    comments.push(
      "리바운드 참여도가 좋았어용."
    );
  }

  if (
    s.stl + s.blk >= 3
  ) {
    comments.push(
      "수비에서 적극적인 영향력을 보여줬어용."
    );
  }

  if (s.to >= 4) {
    comments.push(
      "턴오버를 줄이는 것이 다음 과제예용."
    );
  }

  if (!comments.length) {
    comments.push(
      "기록이 더 쌓이면 세부 분석을 제공할 수 있어용."
    );
  }

  $("aiCommentOutput").innerHTML = `
    <div class="report-highlight">
      ${comments.join(" ")}
    </div>
  `;
}

function generateTrainingPlan() {
  const all =
    getAllPlayers();

  const topTO =
    [...all].sort(
      (a, b) =>
        b.stats.to -
        a.stats.to
    )[0];

  const topMiss =
    [...all].sort(
      (a, b) =>
        b.stats.fgAttempt -
        b.stats.fgMade -
        (a.stats.fgAttempt -
          a.stats.fgMade)
    )[0];

  $("trainingPlanOutput").innerHTML = `
    <div class="training-card">
      <h4>① 슈팅</h4>
      <p>
        기록된 슛 성공률을 기준으로
        약점 구역 반복 슈팅을 추천해용.
      </p>
    </div>

    <div class="training-card">
      <h4>② 볼 핸들링</h4>
      <p>
        압박 상황에서 턴오버를 줄이는
        드리블·패스 훈련을 추천해용.
        ${
          topTO
            ? `현재 TO가 가장 많은 선수:
               ${escapeHTML(topTO.name)}`
            : ""
        }
      </p>
    </div>

    <div class="training-card">
      <h4>③ 게임 상황 훈련</h4>
      <p>
        ${state.mode === "3v3"
          ? "3대3 공간 활용과 빠른 공격 전환"
          : "5대5 세트 오펜스와 도움수비"}
        중심으로 구성해용.
      </p>
    </div>

    <div class="training-card">
      <h4>④ 약점 슈팅 구역</h4>
      <p>
        ${
          topMiss
            ? `${escapeHTML(topMiss.name)}의
               미스가 많은 슈팅 상황을
               우선 보완해보세용.`
            : "슛 기록이 쌓이면 자동 분석해용."
        }
      </p>
    </div>
  `;
}

/* =========================================================
   44. 영상 태그
========================================================= */

function saveVideoTag() {
  const video =
    $("analysisVideo");

  const player =
    getPlayer(
      $("videoPlayerSelect")?.value
    );

  const team =
    $("videoTeamSelect")?.value ||
    "A";

  const memo =
    $("videoTagMemo")?.value ||
    "";

  const selectedTag =
    q(".tag-btn.selected");

  if (!selectedTag) {
    alert("장면 태그를 선택해주세용.");
    return;
  }

  const tag =
    selectedTag.dataset.tag;

  state.videoTags.unshift({
    id: Date.now(),
    time: video
      ? video.currentTime
      : 0,
    playerId:
      player?.id || null,
    playerName:
      player?.name || "선수 미지정",
    team,
    tag,
    memo
  });

  if ($("videoTagMemo")) {
    $("videoTagMemo").value = "";
  }

  renderVideoTags();
  saveLocalState();
}

function renderVideoTags() {
  const container =
    $("videoTagList");

  if (!container) return;

  if (!state.videoTags.length) {
    container.innerHTML =
      `<div class="empty-message">
        저장된 영상 태그가 없습니다.
      </div>`;

    return;
  }

  container.innerHTML =
    state.videoTags
      .map(
        (tag) => `
          <div class="video-tag-row">

            <strong>
              ${formatClock(tag.time)}
            </strong>

            <div>
              <strong>
                ${escapeHTML(tag.tag)}
              </strong>

              <p>
                ${escapeHTML(tag.playerName)}
                · TEAM ${escapeHTML(tag.team)}
                ${
                  tag.memo
                    ? ` · ${escapeHTML(tag.memo)}`
                    : ""
                }
              </p>
            </div>

            <button
              type="button"
              data-delete-video-tag="${tag.id}"
            >
              삭제
            </button>

          </div>
        `
      )
      .join("");
}

/* =========================================================
   45. 전력분석
========================================================= */

function renderAnalysis() {
  renderPlusMinusRanking();
  renderOffenseRanking();
  renderDefenseRanking();
  renderTeamStyle();
  renderLineupAnalysis();
  drawPassNetwork();
}

function renderRanking(
  containerId,
  players,
  valueFn
) {
  const container =
    $(containerId);

  if (!container) return;

  const sorted =
    [...players]
      .sort(
        (a, b) =>
          valueFn(b) -
          valueFn(a)
      )
      .slice(0, 10);

  container.innerHTML =
    sorted
      .map(
        (p, i) => `
          <div class="ranking-row">

            <span class="rank-number">
              ${i + 1}
            </span>

            <div>
              <strong>
                #${escapeHTML(p.number)}
                ${escapeHTML(p.name)}
              </strong>

              <span>
                TEAM ${p.team}
              </span>
            </div>

            <b>
              ${valueFn(p).toFixed
                ? valueFn(p).toFixed(1)
                : valueFn(p)}
            </b>

          </div>
        `
      )
      .join("");
}

function renderPlusMinusRanking() {
  renderRanking(
    "plusMinusRanking",
    getAllPlayers(),
    (p) => p.stats.plusMinus
  );
}

function renderOffenseRanking() {
  renderRanking(
    "offenseRanking",
    getAllPlayers(),
    (p) =>
      p.stats.points +
      p.stats.ast * 1.5 +
      p.stats.reb * 0.5 -
      p.stats.to
  );
}

function renderDefenseRanking() {
  renderRanking(
    "defenseRanking",
    getAllPlayers(),
    (p) =>
      p.stats.stl * 2 +
      p.stats.blk * 2 +
      p.stats.reb -
      p.stats.pf * 0.5
  );
}

function renderLineupAnalysis() {
  const container =
    $("lineupAnalysisList");

  if (!container) return;

  const groups = {};

  ["A", "B"].forEach((team) => {
    const on =
      getTeamPlayers(team)
        .filter(
          (p) => p.onCourt
        );

    if (!on.length) return;

    const key =
      on
        .map((p) => p.id)
        .sort()
        .join("|");

    if (!groups[key]) {
      groups[key] = {
        team,
        players: on,
        count: 0
      };
    }

    groups[key].count++;
  });

  const entries =
    Object.values(groups);

  if (!entries.length) {
    container.innerHTML =
      `<div class="empty-message">
        선수 교체와 기록이 쌓이면 라인업 분석이 표시돼용.
      </div>`;

    return;
  }

  container.innerHTML =
    entries
      .map(
        (entry) => `
          <div class="lineup-analysis-row">

            <strong>
              TEAM ${entry.team}
              ·
              ${entry.players
                .map(
                  (p) =>
                    "#" +
                    p.number +
                    " " +
                    p.name
                )
                .join(", ")}
            </strong>

            <span>
              현재 라인업
            </span>

            <span>
              ${entry.players.length}명
            </span>

            <span>
              ${entry.count}회
            </span>

            <span>
              ${state.mode === "3v3"
                ? "3대3"
                : "5대5"}
            </span>

          </div>
        `
      )
      .join("");
}

function renderTeamStyle() {
  const container =
    $("teamStyleAnalysis");

  if (!container) return;

  container.innerHTML =
    ["A", "B"]
      .map((team) => {
        const players =
          getTeamPlayers(team);

        const points =
          getTeamScore(team);

        const ast =
          players.reduce(
            (a, p) =>
              a + p.stats.ast,
            0
          );

        const reb =
          players.reduce(
            (a, p) =>
              a + p.stats.reb,
            0
          );

        const to =
          players.reduce(
            (a, p) =>
              a + p.stats.to,
            0
          );

        const offense =
          points +
          ast * 1.5 -
          to;

        const meter =
          Math.max(
            0,
            Math.min(
              100,
              50 + offense * 2
            )
          );

        return `
          <div class="team-style-card">

            <h4>
              TEAM ${team}
            </h4>

            <p>
              득점 ${points} ·
              어시스트 ${ast} ·
              리바운드 ${reb} ·
              턴오버 ${to}
            </p>

            <div class="style-meter">
              <div
                style="width:${meter}%"
              ></div>
            </div>

          </div>
        `;
      })
      .join("");
}

/* =========================================================
   46. 패스 네트워크
========================================================= */

function drawPassNetwork() {
  const canvas =
    $("passNetworkCanvas");

  if (!canvas) return;

  const ctx =
    canvas.getContext("2d");

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "#314656";
  ctx.lineWidth = 2;

  ctx.strokeRect(
    10,
    10,
    w - 20,
    h - 20
  );

  const team =
    $("passNetworkTeam")?.value ||
    "A";

  const players =
    getTeamPlayers(team);

  if (!players.length) return;

  const centerX = w / 2;
  const centerY = h / 2;

  const radius =
    Math.min(w, h) * 0.32;

  players.forEach((player, index) => {
    const angle =
      (Math.PI * 2 * index) /
      players.length -
      Math.PI / 2;

    player.__networkX =
      centerX +
      Math.cos(angle) * radius;

    player.__networkY =
      centerY +
      Math.sin(angle) * radius;
  });

  /*
    현재는 실제 패스 상대 기록이 없기 때문에
    어시스트 기반 연결을 시각화.
  */

  players.forEach((player, i) => {
    players
      .slice(i + 1)
      .forEach((other) => {
        const strength =
          Math.min(
            player.stats.ast,
            other.stats.points
          );

        if (!strength) return;

        ctx.beginPath();

        ctx.moveTo(
          player.__networkX,
          player.__networkY
        );

        ctx.lineTo(
          other.__networkX,
          other.__networkY
        );

        ctx.globalAlpha =
          Math.min(
            0.8,
            0.15 + strength * 0.12
          );

        ctx.stroke();

        ctx.globalAlpha = 1;
      });
  });

  players.forEach((player) => {
    ctx.beginPath();

    ctx.arc(
      player.__networkX,
      player.__networkY,
      25,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      team === "A"
        ? "#2f93ff"
        : "#ff4c55";

    ctx.fill();

    ctx.fillStyle = "#ffffff";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font =
      "bold 12px sans-serif";

    ctx.fillText(
      player.number,
      player.__networkX,
      player.__networkY
    );
  });
}

/* =========================================================
   47. 리그
========================================================= */

function renderLeague() {
  renderLeagueTeams();
  renderLeagueStandings();
  renderSchedule();
  renderSeasonLeaders();
  renderSavedGames();
}

function renderLeagueTeams() {
  const container =
    $("leagueTeamList");

  if (!container) return;

  if (!state.league.teams.length) {
    container.innerHTML =
      `<div class="empty-message">
        등록된 리그 팀이 없습니다.
      </div>`;

    return;
  }

  container.innerHTML =
    state.league.teams
      .map(
        (team) => `
          <div class="league-team-row">

            <strong>
              ${escapeHTML(team.name)}
            </strong>

            <button
              type="button"
              data-remove-league-team="${team.id}"
            >
              삭제
            </button>

          </div>
        `
      )
      .join("");
}

function addLeagueTeam() {
  const input =
    $("leagueTeamNameInput");

  const name =
    input?.value.trim();

  if (!name) return;

  state.league.teams.push({
    id:
      Date.now() +
      Math.random(),
    name
  });

  input.value = "";

  renderLeague();
  saveLocalState();
}

function renderLeagueStandings() {
  const tbody =
    $("leagueStandingsBody");

  if (!tbody) return;

  const rows =
    state.league.teams.map(
      (team) => {
        const results =
          state.league.results.filter(
            (r) =>
              r.teamA === team.name ||
              r.teamB === team.name
          );

        let wins = 0;
        let losses = 0;
        let pts = 0;
        let opp = 0;

        results.forEach((r) => {
          const isA =
            r.teamA === team.name;

          const own =
            isA
              ? r.scoreA
              : r.scoreB;

          const other =
            isA
              ? r.scoreB
              : r.scoreA;

          pts += own;
          opp += other;

          if (own > other)
            wins++;
          else if (own < other)
            losses++;
        });

        return {
          name: team.name,
          games: results.length,
          wins,
          losses,
          pts,
          opp,
          diff: pts - opp
        };
      }
    );

  rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.diff - a.diff
  );

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9"
            class="empty-cell">
          리그 결과가 없습니다.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    rows
      .map(
        (r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHTML(r.name)}</td>
            <td>${r.games}</td>
            <td>${r.wins}</td>
            <td>${r.losses}</td>
            <td>${r.pts}</td>
            <td>${r.opp}</td>
            <td>${r.diff}</td>
            <td>
              ${
                r.games
                  ? (
                      (r.wins /
                        r.games) *
                      100
                    ).toFixed(1)
                  : "0.0"
              }%
            </td>
          </tr>
        `
      )
      .join("");
}

function renderSchedule() {
  const container =
    $("scheduleList");

  if (!container) return;

  if (!state.league.schedules.length) {
    container.innerHTML =
      `<div class="empty-message">
        등록된 경기 일정이 없습니다.
      </div>`;

    return;
  }

  container.innerHTML =
    state.league.schedules
      .map(
        (s) => `
          <div class="schedule-row">

            <time>
              ${escapeHTML(s.date)}
              ${escapeHTML(s.time)}
            </time>

            <strong>
              ${escapeHTML(s.teamA)}
              vs
              ${escapeHTML(s.teamB)}
            </strong>

            <span>
              예정
            </span>

            <button
              type="button"
              data-delete-schedule="${s.id}"
            >
              삭제
            </button>

          </div>
        `
      )
      .join("");
}

function updateScheduleSelects() {
  const selects = [
    $("scheduleTeamASelect"),
    $("scheduleTeamBSelect")
  ];

  selects.forEach((select) => {
    if (!select) return;

    const current =
      select.value;

    select.innerHTML =
      `<option value="">
        팀 선택
      </option>`;

    state.league.teams.forEach(
      (team) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          team.name;

        option.textContent =
          team.name;

        select.appendChild(
          option
        );
      }
    );

    select.value = current;
  });
}

function addSchedule() {
  const teamA =
    $("scheduleTeamASelect")?.value;

  const teamB =
    $("scheduleTeamBSelect")?.value;

  const date =
    $("scheduleDateInput")?.value;

  const time =
    $("scheduleTimeInput")?.value;

  if (
    !teamA ||
    !teamB ||
    !date
  ) {
    alert("대진과 날짜를 입력해주세용.");
    return;
  }

  if (teamA === teamB) {
    alert("같은 팀끼리는 대진할 수 없어용.");
    return;
  }

  state.league.schedules.push({
    id:
      Date.now() +
      Math.random(),
    teamA,
    teamB,
    date,
    time
  });

  renderLeague();
  saveLocalState();
}

/* =========================================================
   48. 시즌 리더
========================================================= */

function getSeasonStats() {
  /*
    현재 저장된 경기 데이터를 기반으로
    시즌 누적을 계산하는 구조.
  */

  return getAllPlayers();
}

function leaderNameBy(key) {
  const players =
    getSeasonStats();

  if (!players.length)
    return "기록 없음";

  const p =
    [...players].sort(
      (a, b) =>
        b.stats[key] -
        a.stats[key]
    )[0];

  if (!p || !p.stats[key])
    return "기록 없음";

  return `${p.name} (${p.stats[key]})`;
}

function renderSeasonLeaders() {
  if ($("seasonPointsLeader"))
    $("seasonPointsLeader").textContent =
      leaderNameBy("points");

  if ($("seasonReboundLeader"))
    $("seasonReboundLeader").textContent =
      leaderNameBy("reb");

  if ($("seasonAssistLeader"))
    $("seasonAssistLeader").textContent =
      leaderNameBy("ast");

  if ($("seasonDefenseLeader")) {
    const p =
      [...getSeasonStats()].sort(
        (a, b) =>
          b.stats.stl +
          b.stats.blk -
          (a.stats.stl +
            a.stats.blk)
      )[0];

    $("seasonDefenseLeader").textContent =
      p
        ? `${p.name} (${p.stats.stl + p.stats.blk})`
        : "기록 없음";
  }

  if ($("seasonMvpLeader")) {
    const p =
      [...getSeasonStats()].sort(
        (a, b) =>
          calculateMvpScore(b) -
          calculateMvpScore(a)
      )[0];

    $("seasonMvpLeader").textContent =
      p
        ? `${p.name} (${calculateMvpScore(p).toFixed(1)})`
        : "기록 없음";
  }
}

/* =========================================================
   49. 저장
========================================================= */

function serializeState() {
  return {
    ...state,
    game: {
      ...state.game,
      running: false
    }
  };
}

function saveLocalState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        serializeState()
      )
    );
  } catch (error) {
    console.warn(
      "localStorage 저장 실패",
      error
    );
  }
}

function loadLocalState() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) return;

    const saved =
      JSON.parse(raw);

    state = {
      ...state,
      ...saved,

      game: {
        ...state.game,
        ...saved.game,
        running: false
      }
    };

    renderAll();
  } catch (error) {
    console.warn(
      "저장 데이터 불러오기 실패",
      error
    );
  }
}

/* =========================================================
   50. 경기 저장 목록
========================================================= */

function getSavedGames() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "courtvision_saved_games"
      ) || "[]"
    );
  } catch {
    return [];
  }
}

function saveGameSnapshot() {
  const games =
    getSavedGames();

  games.unshift({
    id:
      Date.now(),
    savedAt:
      new Date().toISOString(),

    mode:
      state.mode,

    game:
      state.game,

    teams:
      state.teams,

    logs:
      state.logs,

    shots:
      state.shots,

    videoTags:
      state.videoTags,

    substitutions:
      state.substitutions
  });

  localStorage.setItem(
    "courtvision_saved_games",
    JSON.stringify(
      games.slice(0, 50)
    )
  );

  renderSavedGames();

  alert("경기가 저장되었어용.");
}

function renderSavedGames() {
  const container =
    $("savedGameList");

  if (!container) return;

  const games =
    getSavedGames();

  if (!games.length) {
    container.innerHTML =
      `<div class="empty-message">
        저장된 경기가 없습니다.
      </div>`;

    return;
  }

  container.innerHTML =
    games
      .map(
        (game) => `
          <div class="saved-game-row">

            <div>
              <strong>
                ${escapeHTML(
                  game.game.title ||
                    "농구 경기"
                )}
              </strong>

              <span>
                ${
                  game.mode === "3v3"
                    ? "3대3"
                    : "5대5"
                }
                ·
                ${escapeHTML(
                  game.game.date ||
                    ""
                )}
              </span>
            </div>

            <button
              type="button"
              data-load-game="${game.id}"
            >
              불러오기
            </button>

            <button
              type="button"
              data-delete-game="${game.id}"
            >
              삭제
            </button>

          </div>
        `
      )
      .join("");
}

function loadSavedGame(id) {
  const game =
    getSavedGames().find(
      (g) => String(g.id) === String(id)
    );

  if (!game) return;

  state.mode =
    game.mode;

  state.game =
    game.game;

  state.teams =
    game.teams;

  state.logs =
    game.logs || [];

  state.shots =
    game.shots || [];

  state.videoTags =
    game.videoTags || [];

  state.substitutions =
    game.substitutions || [];

  state.selectedPlayerId =
    null;

  renderAll();

  alert("저장된 경기를 불러왔어용.");
}

function deleteSavedGame(id) {
  const games =
    getSavedGames().filter(
      (g) =>
        String(g.id) !== String(id)
    );

  localStorage.setItem(
    "courtvision_saved_games",
    JSON.stringify(games)
  );

  renderSavedGames();
}

/* =========================================================
   51. JSON 내보내기
========================================================= */

function exportJSON() {
  const data =
    JSON.stringify(
      serializeState(),
      null,
      2
    );

  const blob =
    new Blob(
      [data],
      {
        type:
          "application/json"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;

  a.download =
    `courtvision_${state.mode}_${Date.now()}.json`;

  a.click();

  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader =
    new FileReader();

  reader.onload = () => {
    try {
      const imported =
        JSON.parse(
          reader.result
        );

      state = {
        ...state,
        ...imported,
        game: {
          ...state.game,
          ...imported.game,
          running: false
        }
      };

      renderAll();

      alert("JSON 데이터를 불러왔어용.");
    } catch {
      alert("JSON 파일을 읽을 수 없어용.");
    }
  };

  reader.readAsText(file);
}

/* =========================================================
   52. CSV
========================================================= */

function exportCSV() {
  const rows = [
    [
      "팀",
      "번호",
      "선수",
      "MIN",
      "PTS",
      "REB",
      "AST",
      "STL",
      "BLK",
      "TO",
      "PF",
      "FG",
      "FG%",
      "+/-"
    ]
  ];

  getAllPlayers().forEach(
    (p) => {
      const s =
        p.stats;

      const fgPct =
        s.fgAttempt
          ? (
              (s.fgMade /
                s.fgAttempt) *
              100
            ).toFixed(1)
          : "0.0";

      rows.push([
        p.team,
        p.number,
        p.name,
        formatClock(s.minutes),
        s.points,
        s.reb,
        s.ast,
        s.stl,
        s.blk,
        s.to,
        s.pf,
        `${s.fgMade}/${s.fgAttempt}`,
        `${fgPct}%`,
        s.plusMinus
      ]);
    }
  );

  const csv =
    rows
      .map(
        (row) =>
          row
            .map(
              (cell) =>
                `"${String(cell)
                  .replaceAll(
                    '"',
                    '""'
                  )}"`
            )
            .join(",")
      )
      .join("\n");

  const blob =
    new Blob(
      ["\uFEFF" + csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;

  a.download =
    `courtvision_${state.mode}_stats.csv`;

  a.click();

  URL.revokeObjectURL(url);
}

/* =========================================================
   53. 설정값 적용
========================================================= */

function applySetup() {
  state.game.date =
    $("gameDate")?.value ||
    "";

  state.game.title =
    $("gameTitle")?.value ||
    "농구 경기";

  state.game.location =
    $("gameLocation")?.value ||
    "";

  state.game.competition =
    $("competitionName")?.value ||
    "";

  state.game.teamA =
    $("teamAName")?.value ||
    "설천고 A";

  state.game.teamB =
    $("teamBName")?.value ||
    "설천고 B";

  state.game.minutes =
    Number(
      $("gameMinutes")?.value
    ) || 10;

  state.game.shotClock =
    Number(
      $("shotClockSeconds")?.value
    ) || 14;

  state.game.periodType =
    $("periodType")?.value ||
    "single";

  state.game.targetScore =
    Number(
      $("targetScore")?.value
    ) || 21;

  state.teams.A.name =
    state.game.teamA;

  state.teams.B.name =
    state.game.teamB;

  state.game.gameSeconds =
    state.game.minutes * 60;

  state.game.shotSeconds =
    state.game.shotClock;

  renderAll();

  saveLocalState();

  $("setupPanel")?.classList.remove(
    "open"
  );
}

/* =========================================================
   54. 설정값 표시
========================================================= */

function fillSetupInputs() {
  if ($("gameDate"))
    $("gameDate").value =
      state.game.date;

  if ($("gameTitle"))
    $("gameTitle").value =
      state.game.title;

  if ($("gameLocation"))
    $("gameLocation").value =
      state.game.location;

  if ($("competitionName"))
    $("competitionName").value =
      state.game.competition;

  if ($("teamAName"))
    $("teamAName").value =
      state.teams.A.name;

  if ($("teamBName"))
    $("teamBName").value =
      state.teams.B.name;

  if ($("gameMinutes"))
    $("gameMinutes").value =
      state.game.minutes;

  if ($("shotClockSeconds"))
    $("shotClockSeconds").value =
      state.game.shotClock;

  if ($("periodType"))
    $("periodType").value =
      state.game.periodType;

  if ($("targetScore"))
    $("targetScore").value =
      state.game.targetScore;
}

/* =========================================================
   55. 리그 모드 결과 연결
========================================================= */

function addCurrentGameToLeague() {
  const a =
    getTeamScore("A");

  const b =
    getTeamScore("B");

  state.league.results.push({
    id:
      Date.now(),
    teamA:
      state.teams.A.name,
    teamB:
      state.teams.B.name,
    scoreA: a,
    scoreB: b,
    mode:
      state.mode,
    date:
      state.game.date
  });

  renderLeague();
  saveLocalState();
}

/* =========================================================
   56. 초기화
========================================================= */

function resetGame() {
  const ok =
    confirm(
      "현재 경기 기록을 모두 초기화할까용?"
    );

  if (!ok) return;

  pauseClock();

  state.logs = [];
  state.shots = [];
  state.videoTags = [];
  state.substitutions = [];
  state.undoStack = [];

  state.game.currentPeriod = 1;
  state.game.gameSeconds =
    Number(state.game.minutes) * 60;
  state.game.shotSeconds =
    Number(state.game.shotClock);
  state.game.ended = false;

  state.teams.A.fouls = 0;
  state.teams.B.fouls = 0;

  state.teams.A.timeouts = 1;
  state.teams.B.timeouts = 1;

  getAllPlayers().forEach(
    (player) => {
      player.onCourt =
        Number(player.number) <=
        getRequiredPlayers();

      player.stats = {
        points: 0,
        ftMade: 0,
        ftAttempt: 0,
        twoMade: 0,
        twoAttempt: 0,
        threeMade: 0,
        threeAttempt: 0,
        fgMade: 0,
        fgAttempt: 0,
        reb: 0,
        off: 0,
        def: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        to: 0,
        pf: 0,
        minutes: 0,
        plusMinus: 0
      };

      player.periods = {};
      player.shotHistory = [];
    }
  );

  state.selectedPlayerId = null;

  renderAll();
  saveLocalState();
}

/* =========================================================
   57. 최근 로그 삭제
========================================================= */

function clearRecentLogs() {
  state.logs = [];

  renderRecentLogs();
  saveLocalState();
}

/* =========================================================
   58. 타임아웃
========================================================= */

function useTimeout(team) {
  if (
    state.teams[team].timeouts <= 0
  ) {
    alert("남은 타임아웃이 없어용.");
    return;
  }

  snapshot();

  state.teams[team].timeouts--;

  addLog(
    {
      id: "",
      name:
        state.teams[team].name,
      number: "",
      team
    },
    "타임아웃"
  );

  renderAll();
}

/* =========================================================
   59. 탭
========================================================= */

function switchTab(tabId) {
  qa(".tab-section").forEach(
    (section) => {
      section.classList.toggle(
        "active",
        section.id === tabId
      );
    }
  );

  qa(".nav-btn").forEach(
    (button) => {
      button.classList.toggle(
        "active",
        button.dataset.tab === tabId
      );
    }
  );

  if (tabId === "shotchartSection") {
    renderShotChart();
  }

  if (tabId === "analysisSection") {
    renderAnalysis();
  }

  if (tabId === "leagueSection") {
    renderLeague();
  }
}

/* =========================================================
   60. 영상 컨트롤
========================================================= */

function getVideo() {
  return $("analysisVideo");
}

function seekVideo(seconds) {
  const video =
    getVideo();

  if (!video) return;

  video.currentTime =
    Math.max(
      0,
      Math.min(
        video.duration || Infinity,
        video.currentTime + seconds
      )
    );
}

function setVideoSpeed(speed) {
  const video =
    getVideo();

  if (!video) return;

  video.playbackRate =
    speed;
}

/* =========================================================
   61. 유튜브
========================================================= */

let youtubePlayer = null;

function getYoutubeId(url) {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/
  ];

  for (const pattern of patterns) {
    const match =
      url.match(pattern);

    if (match) {
      return match[1];
    }
  }

  return null;
}

function loadYoutube() {
  const input =
    $("youtubeUrlInput");

  const url =
    input?.value.trim();

  const id =
    getYoutubeId(url);

  if (!id) {
    alert("유효한 유튜브 주소를 입력해주세용.");
    return;
  }

  if (
    typeof YT === "undefined" ||
    !YT.Player
  ) {
    alert(
      "유튜브 플레이어가 아직 준비되지 않았어용."
    );
    return;
  }

  $("youtubePlayerWrap")?.classList.remove(
    "hidden"
  );

  $("analysisVideo")?.classList.add(
    "hidden"
  );

  youtubePlayer =
    new YT.Player(
      "youtubePlayer",
      {
        videoId: id,
        width: "100%",
        height: "430"
      }
    );
}

/* =========================================================
   62. 전체 렌더링
========================================================= */

function renderGameInfo() {
  if ($("liveGameTitle"))
    $("liveGameTitle").textContent =
      state.game.title;

  if ($("liveGameLocation"))
    $("liveGameLocation").textContent =
      state.game.location ||
      "미입력";

  if ($("liveGameDate"))
    $("liveGameDate").textContent =
      state.game.date ||
      "미입력";
}

function renderAll() {
  fillSetupInputs();

  renderGameInfo();

  renderPlayerSetup();

  updatePlayerSelects();

  updatePeriodSelects();

  renderOnCourt();

  renderScoreboard();

  renderActionPanel();

  renderRecentLogs();

  renderComparison();

  renderMVP();

  renderLiveLeaders();

  renderStatsTable();

  renderTeamSummary();

  renderPlayerDetail();

  renderShotChart();

  renderShotSummary();

  renderZoneAnalysis();

  renderVideoTags();

  renderAnalysis();

  renderLeague();

  updateScheduleSelects();

  updateClockUI();

  drawMiniCourt();
}

/* =========================================================
   63. 이벤트 연결
========================================================= */

function bindEvents() {

  /* 모드 */

  $("mode3v3Btn")
    ?.addEventListener(
      "click",
      () => setMode("3v3")
    );

  $("mode5v5Btn")
    ?.addEventListener(
      "click",
      () => setMode("5v5")
    );

  /* 탭 */

  qa(".nav-btn").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () =>
          switchTab(
            button.dataset.tab
          )
      );
    }
  );

  /* 설정 */

  $("toggleSetupBtn")
    ?.addEventListener(
      "click",
      () =>
        $("setupPanel")?.classList.toggle(
          "open"
        )
    );

  $("closeSetupBtn")
    ?.addEventListener(
      "click",
      () =>
        $("setupPanel")?.classList.remove(
          "open"
        )
    );

  $("saveSetupBtn")
    ?.addEventListener(
      "click",
      applySetup
    );

  $("addTeamAPlayerBtn")
    ?.addEventListener(
      "click",
      () => addPlayer("A")
    );

  $("addTeamBPlayerBtn")
    ?.addEventListener(
      "click",
      () => addPlayer("B")
    );

  /* 빠른 기능 */

  $("undoLastActionBtn")
    ?.addEventListener(
      "click",
      restoreSnapshot
    );

  $("nextPeriodBtn")
    ?.addEventListener(
      "click",
      nextPeriod
    );

  $("teamATimeoutBtn")
    ?.addEventListener(
      "click",
      () => useTimeout("A")
    );

  $("teamBTimeoutBtn")
    ?.addEventListener(
      "click",
      () => useTimeout("B")
    );

  $("clearRecentLogsBtn")
    ?.addEventListener(
      "click",
      clearRecentLogs
    );

  $("clearRecentOnlyBtn")
    ?.addEventListener(
      "click",
      clearRecentLogs
    );

  $("endGameBtn")
    ?.addEventListener(
      "click",
      () => {
        pauseClock();
        state.game.ended = true;
        renderAll();
      }
    );

  /* 시계 */

  $("startClockBtn")
    ?.addEventListener(
      "click",
      startClock
    );

  $("pauseClockBtn")
    ?.addEventListener(
      "click",
      pauseClock
    );

  $("resetShotClockBtn")
    ?.addEventListener(
      "click",
      resetShotClock
    );

  /* 선수 기록 버튼 */

  qa(".stat-btn").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          const action =
            button.dataset.action;

          if (
            action === "points1" ||
            action === "points2" ||
            action === "points3"
          ) {
            const player =
              getSelectedPlayer();

            if (!player) {
              alert(
                "먼저 선수를 선택해주세용."
              );
              return;
            }

            recordPoints(
              player,
              action
            );

            return;
          }

          if (action === "miss") {
            const player =
              getSelectedPlayer();

            if (!player) {
              alert(
                "먼저 선수를 선택해주세용."
              );
              return;
            }

            recordMiss(player);

            return;
          }

          recordStat(action);
        }
      );
    }
  );

  /* 설정 패널 이벤트 */

  document.addEventListener(
    "click",
    (event) => {

      const onCourt =
        event.target.closest(
          "[data-oncourt-player]"
        );

      if (onCourt) {
        toggleOnCourt(
          onCourt.dataset.oncourtPlayer
        );
        return;
      }

      const remove =
        event.target.closest(
          "[data-remove-player]"
        );

      if (remove) {
        removePlayer(
          remove.dataset.removePlayer
        );
        return;
      }

      const load =
        event.target.closest(
          "[data-load-game]"
        );

      if (load) {
        loadSavedGame(
          load.dataset.loadGame
        );
        return;
      }

      const del =
        event.target.closest(
          "[data-delete-game]"
        );

      if (del) {
        deleteSavedGame(
          del.dataset.deleteGame
        );
        return;
      }

      const delTag =
        event.target.closest(
          "[data-delete-video-tag]"
        );

      if (delTag) {
        state.videoTags =
          state.videoTags.filter(
            (tag) =>
              String(tag.id) !==
              String(
                delTag.dataset
                  .deleteVideoTag
              )
          );

        renderVideoTags();
        saveLocalState();

        return;
      }

      const delSchedule =
        event.target.closest(
          "[data-delete-schedule]"
        );

      if (delSchedule) {
        state.league.schedules =
          state.league.schedules.filter(
            (s) =>
              String(s.id) !==
              String(
                delSchedule.dataset
                  .deleteSchedule
              )
          );

        renderLeague();
        saveLocalState();

        return;
      }

      const delLeague =
        event.target.closest(
          "[data-remove-league-team]"
        );

      if (delLeague) {
        state.league.teams =
          state.league.teams.filter(
            (t) =>
              String(t.id) !==
              String(
                delLeague.dataset
                  .removeLeagueTeam
              )
          );

        renderLeague();
        saveLocalState();

        return;
      }
    }
  );

  /* 선수 설정 입력 */

  document.addEventListener(
    "input",
    (event) => {
      const name =
        event.target.dataset.name;

      const number =
        event.target.dataset.number;

      if (name) {
        const p =
          getPlayer(name);

        if (p) {
          p.name =
            event.target.value;
        }
      }

      if (number) {
        const p =
          getPlayer(number);

        if (p) {
          p.number =
            event.target.value;
        }
      }
    }
  );

  /* 선택 */

  $("playerDetailSelect")
    ?.addEventListener(
      "change",
      renderPlayerDetail
    );

  $("shotPlayerSelect")
    ?.addEventListener(
      "change",
      () => {
        renderShotChart();
        renderShotSummary();
        renderZoneAnalysis();
      }
    );

  $("shotViewMode")
    ?.addEventListener(
      "change",
      renderShotChart
    );

  $("shotPeriodFilter")
    ?.addEventListener(
      "change",
      renderShotChart
    );

  $("recordFilterTeam")
    ?.addEventListener(
      "change",
      renderStatsTable
    );

  $("passNetworkTeam")
    ?.addEventListener(
      "change",
      drawPassNetwork
    );

  /* 슛차트 */

  $("recordMadeShotBtn")
    ?.addEventListener(
      "click",
      () => {
        shotMode = "made";
        alert(
          "슛차트에서 위치를 눌러 성공 위치를 기록해주세용."
        );
      }
    );

  $("recordMissShotBtn")
    ?.addEventListener(
      "click",
      () => {
        shotMode = "miss";
        alert(
          "슛차트에서 위치를 눌러 실패 위치를 기록해주세용."
        );
      }
    );

  $("shotChartCanvas")
    ?.addEventListener(
      "click",
      (event) =>
        recordShotAtCanvas(
          event,
          shotMode === "made"
        )
    );

  $("clearShotChartBtn")
    ?.addEventListener(
      "click",
      () => {
        state.shots = [];

        getAllPlayers().forEach(
          (p) => {
            p.shotHistory = [];
          }
        );

        renderShotChart();
        saveLocalState();
      }
    );

  $("toggleHeatmapBtn")
    ?.addEventListener(
      "click",
      () => {
        $("shotChartCanvas")
          ?.classList.toggle(
            "heatmap-on"
          );
      }
    );

  /* 영상 */

  $("videoFileInput")
    ?.addEventListener(
      "change",
      (event) => {
        const file =
          event.target.files?.[0];

        if (!file) return;

        $("videoFileName").textContent =
          file.name;

        const video =
          $("analysisVideo");

        video.src =
          URL.createObjectURL(file);

        video.classList.remove(
          "hidden"
        );

        $("youtubePlayerWrap")
          ?.classList.add(
            "hidden"
          );
      }
    );

  $("back10Btn")
    ?.addEventListener(
      "click",
      () => seekVideo(-10)
    );

  $("back5Btn")
    ?.addEventListener(
      "click",
      () => seekVideo(-5)
    );

  $("forward5Btn")
    ?.addEventListener(
      "click",
      () => seekVideo(5)
    );

  $("forward10Btn")
    ?.addEventListener(
      "click",
      () => seekVideo(10)
    );

  $("playPauseBtn")
    ?.addEventListener(
      "click",
      () => {
        const video =
          getVideo();

        if (!video) return;

        if (video.paused)
          video.play();
        else
          video.pause();
      }
    );

  $("speed05Btn")
    ?.addEventListener(
      "click",
      () => setVideoSpeed(0.5)
    );

  $("speed10Btn")
    ?.addEventListener(
      "click",
      () => setVideoSpeed(1)
    );

  $("speed15Btn")
    ?.addEventListener(
      "click",
      () => setVideoSpeed(1.5)
    );

  $("speed20Btn")
    ?.addEventListener(
      "click",
      () => setVideoSpeed(2)
    );

  $("loadYoutubeBtn")
    ?.addEventListener(
      "click",
      loadYoutube
    );

  qa(".tag-btn").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          qa(".tag-btn").forEach(
            (b) =>
              b.classList.remove(
                "selected"
              )
          );

          button.classList.add(
            "selected"
          );
        }
      );
    }
  );

  $("saveVideoTagBtn")
    ?.addEventListener(
      "click",
      saveVideoTag
    );

  $("clearVideoTagsBtn")
    ?.addEventListener(
      "click",
      () => {
        state.videoTags = [];
        renderVideoTags();
        saveLocalState();
      }
    );

  /* 리포트 */

  $("generateGameReportBtn")
    ?.addEventListener(
      "click",
      generateGameReport
    );

  $("generatePlayerReportBtn")
    ?.addEventListener(
      "click",
      generatePlayerReport
    );

  $("generateTrainingBtn")
    ?.addEventListener(
      "click",
      generateTrainingPlan
    );

  $("printReportBtn")
    ?.addEventListener(
      "click",
      () => window.print()
    );

  /* 리그 */

  $("addLeagueTeamBtn")
    ?.addEventListener(
      "click",
      addLeagueTeam
    );

  $("addScheduleBtn")
    ?.addEventListener(
      "click",
      addSchedule
    );

  $("resetLeagueBtn")
    ?.addEventListener(
      "click",
      () => {
        if (
          !confirm(
            "리그 데이터를 모두 초기화할까용?"
          )
        )
          return;

        state.league = {
          teams: [],
          schedules: [],
          results: []
        };

        renderLeague();
        saveLocalState();
      }
    );

  /* 저장 */

  $("saveGameBtn")
    ?.addEventListener(
      "click",
      saveGameSnapshot
    );

  $("resetGameBtn")
    ?.addEventListener(
      "click",
      resetGame
    );

  $("exportCsvBtn")
    ?.addEventListener(
      "click",
      exportCSV
    );

  $("exportJsonBtn")
    ?.addEventListener(
      "click",
      exportJSON
    );

  $("importJsonInput")
    ?.addEventListener(
      "change",
      (event) => {
        const file =
          event.target.files?.[0];

        if (file) {
          importJSON(file);
        }
      }
    );

  $("loadGameDataBtn")
    ?.addEventListener(
      "click",
      () => {
        switchTab(
          "leagueSection"
        );

        $("setupPanel")
          ?.classList.remove(
            "open"
          );
      }
    );
}

/* =========================================================
   64. 시작
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    loadLocalState();

    bindEvents();

    renderAll();

    /*
      기존 저장 데이터가 없다면
      기본 설정을 사용.
    */

    if (
      !state.game.date
    ) {
      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      state.game.date =
        today;
    }

    renderAll();
  }
);