const STORAGE_KEY = "courtvision_pro_game_v1";
const SAVED_GAMES_KEY = "courtvision_pro_saved_games_v1";
const LEAGUE_KEY = "courtvision_pro_league_v1";

let gameTimer = null;
let selectedVideoTag = "";
let youtubePlayer = null;
let youtubeReady = false;
let currentVideoType = "file";

const defaultState = {
  mode: "3x3",

  gameTitle: "설천고 3대3 리그전",
  gameDate: "",
  gameLocation: "설천고 체육관",
  competitionName: "교내 농구 리그",

  teamAName: "설천고 A",
  teamBName: "설천고 B",

  gameMinutes: 10,
  gameSeconds: 600,

  shotClockMax: 14,
  shotClock: 14,

  periodType: "single",
  currentPeriod: 1,
  periodLabel: "GAME",

  targetScore: 21,

  teamAFouls: 0,
  teamBFouls: 0,

  teamATimeouts: 1,
  teamBTimeouts: 1,

  clockRunning: false,
  gameEnded: false,

  selectedPlayerId: null,

  players: [],
  logs: [],
  shots: [],
  videoTags: [],
  substitutions: [],
  periodStats: [],
  lineupRecords: [],
  passConnections: [],

  history: [],

  shotMode: null,
  heatmap: false,

  startedAt: null,
  endedAt: null
};

let state = structuredClone(defaultState);

let leagueState = {
  teams: [],
  schedule: [],
  results: [],
  seasonPlayers: []
};

/* =========================
   선수 데이터
========================= */

function createPlayer(team, index) {
  return {
    id: createId(`player-${team}`),

    team,
    number: index + 1,
    name: `${team}팀 선수 ${index + 1}`,

    onCourt: true,
    courtSeconds: 0,

    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    to: 0,
    pf: 0,

    fgm: 0,
    fga: 0,

    plusMinus: 0,
    offenseScore: 0,
    defenseScore: 0,

    periodStats: {}
  };
}

function createPlayersForMode(mode) {
  const count = mode === "3x3" ? 3 : 5;
  const players = [];

  for (let index = 0; index < count; index += 1) {
    players.push(createPlayer("A", index));
  }

  for (let index = 0; index < count; index += 1) {
    players.push(createPlayer("B", index));
  }

  return players;
}

function initializePlayers() {
  if (!Array.isArray(state.players) || state.players.length === 0) {
    state.players = createPlayersForMode(state.mode);
  }

  state.players = state.players.map(player => ({
    courtSeconds: 0,
    plusMinus: 0,
    offenseScore: 0,
    defenseScore: 0,
    periodStats: {},
    ...player
  }));

  if (!state.selectedPlayerId) {
    state.selectedPlayerId = state.players[0]?.id || null;
  }
}

/* =========================
   ID·복사·문자 처리
========================= */

function createId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   저장·불러오기
========================= */

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("경기 저장 실패:", error);
  }
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    state = deepClone(defaultState);
    initializePlayers();
    return;
  }

  try {
    const parsed = JSON.parse(saved);

    state = {
      ...deepClone(defaultState),
      ...parsed
    };

    normalizeStateArrays();
    initializePlayers();
  } catch (error) {
    console.error("경기 불러오기 실패:", error);

    state = deepClone(defaultState);
    initializePlayers();
  }
}

function normalizeStateArrays() {
  const arrayKeys = [
    "players",
    "logs",
    "shots",
    "videoTags",
    "substitutions",
    "periodStats",
    "lineupRecords",
    "passConnections",
    "history"
  ];

  arrayKeys.forEach(key => {
    if (!Array.isArray(state[key])) {
      state[key] = [];
    }
  });
}

function saveLeagueState() {
  try {
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(leagueState));
  } catch (error) {
    console.error("리그 저장 실패:", error);
  }
}

function loadLeagueState() {
  const saved = localStorage.getItem(LEAGUE_KEY);

  if (!saved) {
    return;
  }

  try {
    const parsed = JSON.parse(saved);

    leagueState = {
      teams: [],
      schedule: [],
      results: [],
      seasonPlayers: [],
      ...parsed
    };
  } catch (error) {
    console.error("리그 데이터 불러오기 실패:", error);
  }
}

/* =========================
   선수·팀 조회
========================= */

function getPlayer(playerId) {
  return state.players.find(player => player.id === playerId);
}

function getSelectedPlayer() {
  return getPlayer(state.selectedPlayerId);
}

function getTeamPlayers(team) {
  return state.players.filter(player => player.team === team);
}

function getOnCourtPlayers(team) {
  return state.players.filter(
    player => player.team === team && player.onCourt
  );
}

function getTeamName(team) {
  return team === "A" ? state.teamAName : state.teamBName;
}

function getTeamScore(team) {
  return getTeamPlayers(team).reduce(
    (total, player) => total + player.pts,
    0
  );
}

function getTeamStats(team) {
  return getTeamPlayers(team).reduce(
    (total, player) => {
      total.pts += player.pts;
      total.reb += player.reb;
      total.ast += player.ast;
      total.stl += player.stl;
      total.blk += player.blk;
      total.to += player.to;
      total.pf += player.pf;
      total.fgm += player.fgm;
      total.fga += player.fga;
      total.plusMinus += player.plusMinus;
      total.courtSeconds += player.courtSeconds;

      return total;
    },
    {
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      to: 0,
      pf: 0,
      fgm: 0,
      fga: 0,
      plusMinus: 0,
      courtSeconds: 0
    }
  );
}

/* =========================
   시간 표시
========================= */

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return "-";
  }

  return new Date(timestamp).toLocaleString("ko-KR");
}

function getCurrentClockText() {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

/* =========================
   경기 구간
========================= */

function getPeriodLabels() {
  if (state.periodType === "quarter") {
    return ["1Q", "2Q", "3Q", "4Q"];
  }

  if (state.periodType === "half") {
    return ["전반", "후반"];
  }

  return ["GAME"];
}

function updateCurrentPeriodLabel() {
  const labels = getPeriodLabels();
  const safeIndex = Math.min(
    Math.max(state.currentPeriod - 1, 0),
    labels.length - 1
  );

  state.periodLabel = labels[safeIndex];
}

function getPeriodKey() {
  return state.periodLabel || "GAME";
}

/* =========================
   기록 스냅샷
========================= */

function createHistorySnapshot() {
  return deepClone({
    players: state.players,
    logs: state.logs,
    shots: state.shots,
    substitutions: state.substitutions,
    periodStats: state.periodStats,
    lineupRecords: state.lineupRecords,
    passConnections: state.passConnections,

    teamAFouls: state.teamAFouls,
    teamBFouls: state.teamBFouls,

    teamATimeouts: state.teamATimeouts,
    teamBTimeouts: state.teamBTimeouts
  });
}

function pushHistory() {
  state.history.push(createHistorySnapshot());

  if (state.history.length > 60) {
    state.history.shift();
  }
}

function restoreHistorySnapshot(snapshot) {
  state.players = snapshot.players;
  state.logs = snapshot.logs;
  state.shots = snapshot.shots;
  state.substitutions = snapshot.substitutions;
  state.periodStats = snapshot.periodStats;
  state.lineupRecords = snapshot.lineupRecords;
  state.passConnections = snapshot.passConnections;

  state.teamAFouls = snapshot.teamAFouls;
  state.teamBFouls = snapshot.teamBFouls;

  state.teamATimeouts = snapshot.teamATimeouts;
  state.teamBTimeouts = snapshot.teamBTimeouts;
}

/* =========================
   로그
========================= */

function addLog({
  player = null,
  team = null,
  text,
  category = "기록"
}) {
  const resolvedTeam = team || player?.team || "-";

  state.logs.unshift({
    id: createId("log"),
    createdAt: Date.now(),
    time: getCurrentClockText(),
    gameSeconds: state.gameSeconds,
    period: getPeriodKey(),

    playerId: player?.id || null,
    playerName: player?.name || "",

    team: resolvedTeam,
    category,
    text
  });

  if (state.logs.length > 100) {
    state.logs.pop();
  }
}

/* =========================
   탭 이동
========================= */

function bindNavigation() {
  document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
      const tabId = button.dataset.tab;

      document.querySelectorAll(".nav-btn").forEach(item => {
        item.classList.remove("active");
      });

      document.querySelectorAll(".tab-section").forEach(section => {
        section.classList.remove("active");
      });

      button.classList.add("active");

      const targetSection = document.getElementById(tabId);

      if (targetSection) {
        targetSection.classList.add("active");
      }

      if (typeof drawAllCourts === "function") {
        drawAllCourts();
      }

      if (typeof drawPassNetwork === "function") {
        drawPassNetwork();
      }
    });
  });
}

/* =========================
   모드 변경
========================= */

function updateModeButtons() {
  document
    .getElementById("mode3v3Btn")
    .classList.toggle("active", state.mode === "3x3");

  document
    .getElementById("mode5v5Btn")
    .classList.toggle("active", state.mode === "5x5");

  document.getElementById("liveModeLabel").textContent =
    state.mode === "3x3" ? "3대3 모드" : "5대5 모드";

  document.getElementById("liveGameMode").textContent =
    state.mode === "3x3" ? "3대3" : "5대5";
}

function changeMode(mode) {
  if (state.mode === mode) {
    return;
  }

  const confirmed = confirm(
    `${mode} 모드로 변경하면 현재 선수 명단과 경기 기록이 초기화돼용. 변경할까용?`
  );

  if (!confirmed) {
    return;
  }

  stopGameClock();

  state = {
    ...deepClone(defaultState),
    mode,
    shotClockMax: mode === "3x3" ? 14 : 24,
    shotClock: mode === "3x3" ? 14 : 24
  };

  state.players = createPlayersForMode(mode);
  state.selectedPlayerId = state.players[0]?.id || null;

  fillSetupInputs();
  renderSetupPlayerForms();
  updateModeButtons();

  saveState();
  renderAll();
}

function bindModeButtons() {
  document
    .getElementById("mode3v3Btn")
    .addEventListener("click", () => {
      changeMode("3x3");
    });

  document
    .getElementById("mode5v5Btn")
    .addEventListener("click", () => {
      changeMode("5x5");
    });
}

/* =========================
   설정 패널
========================= */

const setupPanel = document.getElementById("setupPanel");

function openSetupPanel() {
  fillSetupInputs();
  renderSetupPlayerForms();
  setupPanel.classList.add("open");
}

function closeSetupPanel() {
  setupPanel.classList.remove("open");
}

function bindSetupPanelButtons() {
  document
    .getElementById("toggleSetupBtn")
    .addEventListener("click", openSetupPanel);

  document
    .getElementById("closeSetupBtn")
    .addEventListener("click", closeSetupPanel);

  document
    .getElementById("addTeamAPlayerBtn")
    .addEventListener("click", () => {
      addPlayerToTeam("A");
    });

  document
    .getElementById("addTeamBPlayerBtn")
    .addEventListener("click", () => {
      addPlayerToTeam("B");
    });

  document
    .getElementById("saveSetupBtn")
    .addEventListener("click", saveSetup);
}

/* =========================
   선수 설정 폼
========================= */

function addPlayerToTeam(team) {
  const teamPlayers = getTeamPlayers(team);

  const player = createPlayer(team, teamPlayers.length);
  player.onCourt =
    teamPlayers.filter(item => item.onCourt).length <
    getRequiredOnCourtCount();

  state.players.push(player);

  if (!state.selectedPlayerId) {
    state.selectedPlayerId = player.id;
  }

  renderSetupPlayerForms();
}

function getRequiredOnCourtCount() {
  return state.mode === "3x3" ? 3 : 5;
}

function removePlayer(playerId) {
  const player = getPlayer(playerId);

  if (!player) {
    return;
  }

  const teamPlayers = getTeamPlayers(player.team);

  if (teamPlayers.length <= 1) {
    alert("각 팀에는 최소 1명의 선수가 있어야 해용.");
    return;
  }

  state.players = state.players.filter(
    item => item.id !== playerId
  );

  if (state.selectedPlayerId === playerId) {
    state.selectedPlayerId = state.players[0]?.id || null;
  }

  renderSetupPlayerForms();
}

function toggleSetupOnCourt(playerId) {
  const player = getPlayer(playerId);

  if (!player) {
    return;
  }

  if (!player.onCourt) {
    const currentOnCourtCount = getOnCourtPlayers(player.team).length;

    if (currentOnCourtCount >= getRequiredOnCourtCount()) {
      alert(
        `${state.mode} 모드에서는 한 팀당 ${getRequiredOnCourtCount()}명까지만 출전할 수 있어용.`
      );

      return;
    }
  }

  player.onCourt = !player.onCourt;

  renderSetupPlayerForms();
}

function renderSetupPlayerForms() {
  renderTeamPlayerForm("A", "teamAPlayers");
  renderTeamPlayerForm("B", "teamBPlayers");
}

function renderTeamPlayerForm(team, containerId) {
  const container = document.getElementById(containerId);
  const players = getTeamPlayers(team);

  container.innerHTML = "";

  players.forEach(player => {
    const row = document.createElement("div");
    row.className = "player-form-row";

    row.innerHTML = `
      <input
        type="number"
        min="0"
        max="99"
        value="${player.number}"
        data-player-number="${player.id}"
        aria-label="등번호"
      />

      <input
        type="text"
        value="${escapeHtml(player.name)}"
        data-player-name="${player.id}"
        placeholder="선수 이름"
        aria-label="선수 이름"
      />

      <button
        type="button"
        data-oncourt-player="${player.id}"
      >
        ${player.onCourt ? "출전" : "벤치"}
      </button>

      <button
        type="button"
        data-remove-player="${player.id}"
        aria-label="선수 삭제"
      >
        ✕
      </button>
    `;

    container.appendChild(row);
  });
}

/* =========================
   설정 입력 반영
========================= */

function bindSetupFormEvents() {
  document.addEventListener("input", event => {
    const numberId = event.target.dataset.playerNumber;
    const nameId = event.target.dataset.playerName;

    if (numberId) {
      const player = getPlayer(numberId);

      if (player) {
        player.number = Number(event.target.value) || 0;
      }
    }

    if (nameId) {
      const player = getPlayer(nameId);

      if (player) {
        player.name =
          event.target.value.trimStart() || "이름 미입력";
      }
    }
  });

  document.addEventListener("click", event => {
    const removeId = event.target.dataset.removePlayer;
    const onCourtId = event.target.dataset.oncourtPlayer;

    if (removeId) {
      removePlayer(removeId);
    }

    if (onCourtId) {
      toggleSetupOnCourt(onCourtId);
    }
  });
}

/* =========================
   설정 저장
========================= */

function fillSetupInputs() {
  document.getElementById("gameDate").value =
    state.gameDate || "";

  document.getElementById("gameTitle").value =
    state.gameTitle || "";

  document.getElementById("gameLocation").value =
    state.gameLocation || "";

  document.getElementById("competitionName").value =
    state.competitionName || "";

  document.getElementById("teamAName").value =
    state.teamAName || "";

  document.getElementById("teamBName").value =
    state.teamBName || "";

  document.getElementById("gameMinutes").value =
    state.gameMinutes;

  document.getElementById("shotClockSeconds").value =
    state.shotClockMax;

  document.getElementById("periodType").value =
    state.periodType;

  document.getElementById("targetScore").value =
    state.targetScore;
}

function validateOnCourtPlayers() {
  const required = getRequiredOnCourtCount();

  const teamACount = getOnCourtPlayers("A").length;
  const teamBCount = getOnCourtPlayers("B").length;

  if (teamACount !== required || teamBCount !== required) {
    alert(
      `${state.mode} 모드는 각 팀 출전 선수가 정확히 ${required}명이어야 해용.\n현재 A팀 ${teamACount}명, B팀 ${teamBCount}명이에용.`
    );

    return false;
  }

  return true;
}

function saveSetup() {
  state.gameDate =
    document.getElementById("gameDate").value;

  state.gameTitle =
    document.getElementById("gameTitle").value.trim() ||
    "농구 경기";

  state.gameLocation =
    document.getElementById("gameLocation").value.trim() ||
    "장소 미입력";

  state.competitionName =
    document.getElementById("competitionName").value.trim() ||
    "대회명 미입력";

  state.teamAName =
    document.getElementById("teamAName").value.trim() ||
    "A팀";

  state.teamBName =
    document.getElementById("teamBName").value.trim() ||
    "B팀";

  state.gameMinutes = Math.max(
    1,
    Number(document.getElementById("gameMinutes").value) || 10
  );

  state.shotClockMax = Math.max(
    1,
    Number(
      document.getElementById("shotClockSeconds").value
    ) || (state.mode === "3x3" ? 14 : 24)
  );

  state.periodType =
    document.getElementById("periodType").value;

  state.targetScore = Math.max(
    0,
    Number(document.getElementById("targetScore").value) || 0
  );

  if (!validateOnCourtPlayers()) {
    return;
  }

  state.gameSeconds = state.gameMinutes * 60;
  state.shotClock = state.shotClockMax;

  state.currentPeriod = 1;
  updateCurrentPeriodLabel();

  state.startedAt = state.startedAt || Date.now();
  state.gameEnded = false;

  addLog({
    text: "경기 설정 저장",
    category: "시스템"
  });

  saveState();
  closeSetupPanel();
  renderAll();

  alert("경기와 선수 설정을 저장했어용.");
}

/* =========================
   초기 실행
========================= */

function initializeAppPartOne() {
  loadState();
  loadLeagueState();

  updateCurrentPeriodLabel();

  fillSetupInputs();
  renderSetupPlayerForms();

  bindNavigation();
  bindModeButtons();
  bindSetupPanelButtons();
  bindSetupFormEvents();

  updateModeButtons();
}

initializeAppPartOne();
/* =========================
   점수 이벤트와 구간 기록
========================= */

function ensurePlayerPeriodStats(player, period = getPeriodKey()) {
  if (!player.periodStats) {
    player.periodStats = {};
  }

  if (!player.periodStats[period]) {
    player.periodStats[period] = {
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      to: 0,
      pf: 0,
      fgm: 0,
      fga: 0,
      courtSeconds: 0,
      plusMinus: 0
    };
  }

  return player.periodStats[period];
}

function addPlayerPeriodStat(player, key, amount = 1) {
  const periodStats = ensurePlayerPeriodStats(player);

  if (typeof periodStats[key] !== "number") {
    periodStats[key] = 0;
  }

  periodStats[key] += amount;
}

function getCurrentPeriodTeamScore(team) {
  return getTeamPlayers(team).reduce((total, player) => {
    const stats = player.periodStats?.[getPeriodKey()];
    return total + (stats?.pts || 0);
  }, 0);
}

function updatePeriodSummaryRecord() {
  const period = getPeriodKey();

  let record = state.periodStats.find(
    item => item.period === period
  );

  if (!record) {
    record = {
      id: createId("period"),
      period,
      teamAScore: 0,
      teamBScore: 0,
      teamAReb: 0,
      teamBReb: 0,
      teamAAst: 0,
      teamBAst: 0,
      teamAStl: 0,
      teamBStl: 0,
      teamABlk: 0,
      teamBBlk: 0,
      teamATo: 0,
      teamBTo: 0
    };

    state.periodStats.push(record);
  }

  const teamAPlayers = getTeamPlayers("A");
  const teamBPlayers = getTeamPlayers("B");

  function sumPeriod(players, key) {
    return players.reduce((total, player) => {
      return (
        total +
        (player.periodStats?.[period]?.[key] || 0)
      );
    }, 0);
  }

  record.teamAScore = sumPeriod(teamAPlayers, "pts");
  record.teamBScore = sumPeriod(teamBPlayers, "pts");

  record.teamAReb = sumPeriod(teamAPlayers, "reb");
  record.teamBReb = sumPeriod(teamBPlayers, "reb");

  record.teamAAst = sumPeriod(teamAPlayers, "ast");
  record.teamBAst = sumPeriod(teamBPlayers, "ast");

  record.teamAStl = sumPeriod(teamAPlayers, "stl");
  record.teamBStl = sumPeriod(teamBPlayers, "stl");

  record.teamABlk = sumPeriod(teamAPlayers, "blk");
  record.teamBBlk = sumPeriod(teamBPlayers, "blk");

  record.teamATo = sumPeriod(teamAPlayers, "to");
  record.teamBTo = sumPeriod(teamBPlayers, "to");
}

/* =========================
   공격·수비 기여도
========================= */

function calculateOffenseScore(player) {
  const missedShots = Math.max(player.fga - player.fgm, 0);

  return (
    player.pts +
    player.ast * 1.5 +
    player.reb * 0.3 -
    player.to * 1.5 -
    missedShots * 0.5
  );
}

function calculateDefenseScore(player) {
  return (
    player.stl * 2.3 +
    player.blk * 2.2 +
    player.reb * 0.8 -
    player.pf * 0.6
  );
}

function updatePlayerImpactScores() {
  state.players.forEach(player => {
    player.offenseScore = calculateOffenseScore(player);
    player.defenseScore = calculateDefenseScore(player);
  });
}

/* =========================
   현재 라인업
========================= */

function getLineupPlayerIds(team) {
  return getOnCourtPlayers(team)
    .map(player => player.id)
    .sort();
}

function getLineupPlayerNames(team) {
  return getOnCourtPlayers(team)
    .map(player => `#${player.number} ${player.name}`)
    .join(", ");
}

function getLineupKey(team) {
  return `${team}:${getLineupPlayerIds(team).join("|")}`;
}

function getOrCreateLineupRecord(team) {
  const lineupKey = getLineupKey(team);

  let lineup = state.lineupRecords.find(
    item => item.key === lineupKey
  );

  if (!lineup) {
    lineup = {
      id: createId("lineup"),
      key: lineupKey,
      team,
      playerIds: getLineupPlayerIds(team),
      playerNames: getLineupPlayerNames(team),
      seconds: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      plusMinus: 0
    };

    state.lineupRecords.push(lineup);
  }

  return lineup;
}

function updateCurrentLineupTime() {
  ["A", "B"].forEach(team => {
    const lineup = getOrCreateLineupRecord(team);
    lineup.seconds += 1;
  });
}

function applyLineupScoreChange(scoringTeam, points) {
  const opponent = scoringTeam === "A" ? "B" : "A";

  const scoringLineup = getOrCreateLineupRecord(scoringTeam);
  const opponentLineup = getOrCreateLineupRecord(opponent);

  scoringLineup.pointsFor += points;
  scoringLineup.plusMinus += points;

  opponentLineup.pointsAgainst += points;
  opponentLineup.plusMinus -= points;
}

function getCurrentLineupPlusMinus(team) {
  const lineupKey = getLineupKey(team);

  const lineup = state.lineupRecords.find(
    item => item.key === lineupKey
  );

  return lineup?.plusMinus || 0;
}

/* =========================
   선수 플러스마이너스
========================= */

function applyPlayerPlusMinus(scoringTeam, points) {
  state.players.forEach(player => {
    if (!player.onCourt) {
      return;
    }

    const amount =
      player.team === scoringTeam ? points : -points;

    player.plusMinus += amount;
    addPlayerPeriodStat(player, "plusMinus", amount);
  });
}

/* =========================
   패스 연결
========================= */

function recordAssistConnection(assister) {
  const teammateId =
    state.lastScorerId &&
    getPlayer(state.lastScorerId)?.team === assister.team
      ? state.lastScorerId
      : null;

  if (!teammateId || teammateId === assister.id) {
    return;
  }

  let connection = state.passConnections.find(
    item =>
      item.fromPlayerId === assister.id &&
      item.toPlayerId === teammateId
  );

  if (!connection) {
    connection = {
      id: createId("pass"),
      team: assister.team,
      fromPlayerId: assister.id,
      toPlayerId: teammateId,
      count: 0
    };

    state.passConnections.push(connection);
  }

  connection.count += 1;
}

/* =========================
   선수 기록 입력
========================= */

function bindStatButtons() {
  document.querySelectorAll(".stat-btn").forEach(button => {
    button.addEventListener("click", () => {
      applyStatAction(button.dataset.action);
    });
  });
}

function applyStatAction(action) {
  const player = getSelectedPlayer();

  if (!player) {
    alert("먼저 기록할 선수를 선택해주세용.");
    return;
  }

  if (state.gameEnded) {
    alert("이미 종료된 경기예용.");
    return;
  }

  pushHistory();

  const handlers = {
    points1() {
      applyScoring(player, 1, "자유투 1점 성공", false);
    },

    points2() {
      applyScoring(player, 2, "2점슛 성공", true);
    },

    points3() {
      applyScoring(player, 3, "3점슛 성공", true);
    },

    miss() {
      player.fga += 1;
      addPlayerPeriodStat(player, "fga", 1);

      addLog({
        player,
        text: "슛 실패",
        category: "슛"
      });
    },

    reb() {
      player.reb += 1;
      addPlayerPeriodStat(player, "reb", 1);

      addLog({
        player,
        text: "리바운드",
        category: "기록"
      });
    },

    ast() {
      player.ast += 1;
      addPlayerPeriodStat(player, "ast", 1);

      recordAssistConnection(player);

      addLog({
        player,
        text: "어시스트",
        category: "패스"
      });
    },

    stl() {
      player.stl += 1;
      addPlayerPeriodStat(player, "stl", 1);

      addLog({
        player,
        text: "스틸",
        category: "수비"
      });
    },

    blk() {
      player.blk += 1;
      addPlayerPeriodStat(player, "blk", 1);

      addLog({
        player,
        text: "블록",
        category: "수비"
      });
    },

    to() {
      player.to += 1;
      addPlayerPeriodStat(player, "to", 1);

      addLog({
        player,
        text: "턴오버",
        category: "실책"
      });
    },

    pf() {
      player.pf += 1;
      addPlayerPeriodStat(player, "pf", 1);

      if (player.team === "A") {
        state.teamAFouls += 1;
      } else {
        state.teamBFouls += 1;
      }

      addLog({
        player,
        text: "개인 파울",
        category: "파울"
      });

      checkFoulWarning(player);
    },

    subIn() {
      substitutePlayerIn(player);
    },

    subOut() {
      substitutePlayerOut(player);
    }
  };

  if (!handlers[action]) {
    return;
  }

  handlers[action]();

  updatePeriodSummaryRecord();
  updatePlayerImpactScores();

  saveState();
  renderAll();
}

function applyScoring(
  player,
  points,
  description,
  countAsFieldGoal = true
) {
  player.pts += points;
  addPlayerPeriodStat(player, "pts", points);

  if (countAsFieldGoal) {
    player.fgm += 1;
    player.fga += 1;

    addPlayerPeriodStat(player, "fgm", 1);
    addPlayerPeriodStat(player, "fga", 1);
  }

  applyPlayerPlusMinus(player.team, points);
  applyLineupScoreChange(player.team, points);

  state.lastScorerId = player.id;

  addLog({
    player,
    text: description,
    category: "득점"
  });

  checkTargetScore();
}

function checkFoulWarning(player) {
  const warningLimit =
    state.mode === "3x3" ? 4 : 5;

  if (player.pf === warningLimit - 1) {
    alert(
      `${player.name} 선수는 파울 ${player.pf}개로 퇴장 경고 상태예용.`
    );
  }

  if (player.pf >= warningLimit) {
    alert(
      `${player.name} 선수의 파울이 ${player.pf}개예용. 교체 여부를 확인해주세용.`
    );
  }
}

function checkTargetScore() {
  if (!state.targetScore || state.targetScore <= 0) {
    return;
  }

  const scoreA = getTeamScore("A");
  const scoreB = getTeamScore("B");

  if (
    scoreA >= state.targetScore ||
    scoreB >= state.targetScore
  ) {
    stopGameClock();

    const winner =
      scoreA > scoreB
        ? state.teamAName
        : scoreB > scoreA
        ? state.teamBName
        : "동점";

    alert(
      `목표 점수 ${state.targetScore}점에 도달했어용.\n현재 결과: ${winner}`
    );
  }
}

/* =========================
   선수 교체
========================= */

function substitutePlayerOut(player) {
  if (!player.onCourt) {
    alert(`${player.name} 선수는 이미 벤치에 있어용.`);
    return;
  }

  const onCourtCount = getOnCourtPlayers(player.team).length;

  if (onCourtCount <= 1) {
    alert("코트에는 최소 1명의 선수가 있어야 해용.");
    return;
  }

  player.onCourt = false;

  const substitution = {
    id: createId("sub"),
    createdAt: Date.now(),
    period: getPeriodKey(),
    gameSeconds: state.gameSeconds,
    team: player.team,
    outPlayerId: player.id,
    outPlayerName: player.name,
    inPlayerId: null,
    inPlayerName: "",
    type: "OUT"
  };

  state.substitutions.unshift(substitution);

  addLog({
    player,
    text: "교체 아웃",
    category: "교체"
  });
}

function substitutePlayerIn(player) {
  if (player.onCourt) {
    alert(`${player.name} 선수는 이미 출전 중이에용.`);
    return;
  }

  const required = getRequiredOnCourtCount();
  const currentOnCourt = getOnCourtPlayers(player.team);

  if (currentOnCourt.length >= required) {
    alert(
      `${player.team}팀은 현재 ${currentOnCourt.length}명이 출전 중이에용. 먼저 교체 아웃할 선수를 선택해주세용.`
    );
    return;
  }

  player.onCourt = true;

  const pendingOut = state.substitutions.find(
    item =>
      item.team === player.team &&
      item.type === "OUT" &&
      !item.inPlayerId
  );

  if (pendingOut) {
    pendingOut.inPlayerId = player.id;
    pendingOut.inPlayerName = player.name;
    pendingOut.type = "CHANGE";
  } else {
    state.substitutions.unshift({
      id: createId("sub"),
      createdAt: Date.now(),
      period: getPeriodKey(),
      gameSeconds: state.gameSeconds,
      team: player.team,
      outPlayerId: null,
      outPlayerName: "",
      inPlayerId: player.id,
      inPlayerName: player.name,
      type: "IN"
    });
  }

  addLog({
    player,
    text: "선수 투입",
    category: "교체"
  });
}

/* =========================
   선수 선택 카드
========================= */

function renderOnCourtPlayers() {
  renderOnCourtTeam("A", "teamAOnCourt");
  renderOnCourtTeam("B", "teamBOnCourt");
}

function renderOnCourtTeam(team, containerId) {
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  const players = getTeamPlayers(team);

  container.innerHTML = "";

  players.forEach(player => {
    const button = document.createElement("button");

    button.type = "button";

    button.className = [
      "player-live-card",
      team === "A" ? "team-a-card" : "team-b-card",
      state.selectedPlayerId === player.id
        ? "selected"
        : "",
      player.onCourt ? "" : "out"
    ]
      .filter(Boolean)
      .join(" ");

    button.innerHTML = `
      <span class="number">${player.number}</span>

      <span class="name">
        ${escapeHtml(player.name)}
      </span>

      <span class="points">
        ${player.pts} PTS · ${formatTime(player.courtSeconds)}
      </span>
    `;

    button.addEventListener("click", () => {
      state.selectedPlayerId = player.id;

      saveState();
      renderAll();
    });

    container.appendChild(button);
  });
}

/* =========================
   경기 시계
========================= */

function bindClockButtons() {
  document
    .getElementById("startClockBtn")
    .addEventListener("click", startGameClock);

  document
    .getElementById("pauseClockBtn")
    .addEventListener("click", stopGameClock);

  document
    .getElementById("resetShotClockBtn")
    .addEventListener("click", resetShotClock);
}

function startGameClock() {
  if (state.gameEnded) {
    alert("종료된 경기예용.");
    return;
  }

  if (gameTimer) {
    return;
  }

  if (state.gameSeconds <= 0) {
    alert("경기 시간이 0초예용. 다음 구간으로 이동해주세용.");
    return;
  }

  state.clockRunning = true;
  state.startedAt = state.startedAt || Date.now();

  gameTimer = window.setInterval(() => {
    gameClockTick();
  }, 1000);

  saveState();
  renderScoreboard();
}

function gameClockTick() {
  if (!state.clockRunning) {
    return;
  }

  if (state.gameSeconds > 0) {
    state.gameSeconds -= 1;
  }

  if (state.shotClock > 0) {
    state.shotClock -= 1;
  }

  state.players.forEach(player => {
    if (player.onCourt) {
      player.courtSeconds += 1;
      addPlayerPeriodStat(player, "courtSeconds", 1);
    }
  });

  updateCurrentLineupTime();

  if (state.shotClock <= 0) {
    state.shotClock = 0;
    stopGameClock();

    addLog({
      text: "샷클락 종료",
      category: "시계"
    });

    alert("샷클락이 종료됐어용.");
  }

  if (state.gameSeconds <= 0) {
    state.gameSeconds = 0;
    stopGameClock();

    addLog({
      text: `${getPeriodKey()} 경기 시간 종료`,
      category: "시계"
    });

    alert(`${getPeriodKey()} 경기 시간이 종료됐어용.`);
  }

  saveState();
  renderScoreboard();
  renderSelectedPlayerHeader();
  renderOnCourtPlayers();
}

function stopGameClock() {
  state.clockRunning = false;

  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }

  saveState();
  renderScoreboard();
}

function resetShotClock() {
  state.shotClock = state.shotClockMax;

  addLog({
    text: `샷클락 ${state.shotClockMax}초 재설정`,
    category: "시계"
  });

  saveState();
  renderScoreboard();
  renderRecentLogs();
}

/* =========================
   다음 구간
========================= */

function bindPeriodButtons() {
  document
    .getElementById("nextPeriodBtn")
    .addEventListener("click", moveToNextPeriod);
}

function moveToNextPeriod() {
  const labels = getPeriodLabels();

  if (state.currentPeriod >= labels.length) {
    alert("마지막 경기 구간이에용.");
    return;
  }

  stopGameClock();
  updatePeriodSummaryRecord();

  state.currentPeriod += 1;
  updateCurrentPeriodLabel();

  state.gameSeconds = state.gameMinutes * 60;
  state.shotClock = state.shotClockMax;

  state.teamAFouls = 0;
  state.teamBFouls = 0;

  addLog({
    text: `${getPeriodKey()} 시작`,
    category: "구간"
  });

  saveState();
  renderAll();
}

/* =========================
   타임아웃
========================= */

function bindTimeoutButtons() {
  document
    .getElementById("teamATimeoutBtn")
    .addEventListener("click", () => {
      useTimeout("A");
    });

  document
    .getElementById("teamBTimeoutBtn")
    .addEventListener("click", () => {
      useTimeout("B");
    });
}

function useTimeout(team) {
  const key =
    team === "A"
      ? "teamATimeouts"
      : "teamBTimeouts";

  if (state[key] <= 0) {
    alert(`${getTeamName(team)}의 남은 타임아웃이 없어용.`);
    return;
  }

  state[key] -= 1;
  stopGameClock();

  addLog({
    team,
    text: "타임아웃 사용",
    category: "타임아웃"
  });

  saveState();
  renderAll();
}

/* =========================
   실행 취소·기록 삭제
========================= */

function bindHistoryButtons() {
  document
    .getElementById("undoLastActionBtn")
    .addEventListener("click", undoLastAction);

  document
    .getElementById("clearRecentLogsBtn")
    .addEventListener("click", clearRecentLogs);

  document
    .getElementById("clearRecentOnlyBtn")
    .addEventListener("click", clearRecentLogs);
}

function undoLastAction() {
  const snapshot = state.history.pop();

  if (!snapshot) {
    alert("취소할 기록이 없어용.");
    return;
  }

  restoreHistorySnapshot(snapshot);

  saveState();
  renderAll();
}

function clearRecentLogs() {
  const confirmed = confirm(
    "최근 기록 목록을 모두 삭제할까용?"
  );

  if (!confirmed) {
    return;
  }

  state.logs = [];

  saveState();
  renderRecentLogs();
}

/* =========================
   경기 종료·초기화
========================= */

function bindGameControlButtons() {
  document
    .getElementById("endGameBtn")
    .addEventListener("click", endGame);

  document
    .getElementById("resetGameBtn")
    .addEventListener("click", resetCurrentGame);
}

function endGame() {
  const confirmed = confirm(
    "현재 경기를 종료할까용?"
  );

  if (!confirmed) {
    return;
  }

  stopGameClock();
  updatePeriodSummaryRecord();
  updatePlayerImpactScores();

  state.gameEnded = true;
  state.endedAt = Date.now();

  addLog({
    text: "경기 종료",
    category: "시스템"
  });

  saveState();
  renderAll();

  alert("경기를 종료했어용. 리포트와 경기 저장을 확인해용.");
}

function resetCurrentGame() {
  const confirmed = confirm(
    "현재 경기 기록을 모두 초기화할까용?\n리그 데이터는 유지돼용."
  );

  if (!confirmed) {
    return;
  }

  stopGameClock();

  const previousMode = state.mode;

  state = {
    ...deepClone(defaultState),
    mode: previousMode,
    shotClockMax: previousMode === "3x3" ? 14 : 24,
    shotClock: previousMode === "3x3" ? 14 : 24
  };

  state.players = createPlayersForMode(previousMode);
  state.selectedPlayerId = state.players[0]?.id || null;

  updateCurrentPeriodLabel();

  localStorage.removeItem(STORAGE_KEY);
  saveState();

  fillSetupInputs();
  renderSetupPlayerForms();
  renderAll();
  openSetupPanel();
}

/* =========================
   헤더와 점수판 렌더링
========================= */

function renderLiveGameInfo() {
  document.getElementById("liveGameTitle").textContent =
    state.gameTitle || "농구 경기";

  document.getElementById("liveGameMode").textContent =
    state.mode === "3x3" ? "3대3" : "5대5";

  document.getElementById("liveGameLocation").textContent =
    state.gameLocation || "미입력";

  document.getElementById("liveGameDate").textContent =
    state.gameDate || "미입력";
}

function renderTeamHeaders() {
  const teamAPlayers = getTeamPlayers("A");
  const teamBPlayers = getTeamPlayers("B");

  document.getElementById("teamANameDisplay").textContent =
    state.teamAName;

  document.getElementById("teamBNameDisplay").textContent =
    state.teamBName;

  document.getElementById("scoreboardTeamA").textContent =
    state.teamAName;

  document.getElementById("scoreboardTeamB").textContent =
    state.teamBName;

  document.getElementById("teamAPlayerCount").textContent =
    `선수 ${teamAPlayers.length}명`;

  document.getElementById("teamBPlayerCount").textContent =
    `선수 ${teamBPlayers.length}명`;
}

function renderScoreboard() {
  const scoreA = getTeamScore("A");
  const scoreB = getTeamScore("B");

  document.getElementById("teamAScore").textContent = scoreA;
  document.getElementById("teamBScore").textContent = scoreB;

  document.getElementById("scoreboardAValue").textContent =
    scoreA;

  document.getElementById("scoreboardBValue").textContent =
    scoreB;

  document.getElementById("gameClock").textContent =
    formatTime(state.gameSeconds);

  document.getElementById("shotClock").textContent =
    state.shotClock;

  document.getElementById("quarterLabel").textContent =
    getPeriodKey();

  document.getElementById("teamAFouls").textContent =
    state.teamAFouls;

  document.getElementById("teamBFouls").textContent =
    state.teamBFouls;

  document.getElementById("scoreboardAFouls").textContent =
    state.teamAFouls;

  document.getElementById("scoreboardBFouls").textContent =
    state.teamBFouls;

  document.getElementById("teamATimeouts").textContent =
    state.teamATimeouts;

  document.getElementById("teamBTimeouts").textContent =
    state.teamBTimeouts;

  document.getElementById("scoreboardATimeouts").textContent =
    state.teamATimeouts;

  document.getElementById("scoreboardBTimeouts").textContent =
    state.teamBTimeouts;

  document.getElementById(
    "teamALineupPlusMinus"
  ).textContent = formatSignedNumber(
    getCurrentLineupPlusMinus("A")
  );

  document.getElementById(
    "teamBLineupPlusMinus"
  ).textContent = formatSignedNumber(
    getCurrentLineupPlusMinus("B")
  );
}

function formatSignedNumber(value) {
  const number = Number(value) || 0;

  if (number > 0) {
    return `+${number}`;
  }

  return String(number);
}

/* =========================
   선택 선수 표시
========================= */

function renderSelectedPlayerHeader() {
  const player = getSelectedPlayer();

  if (!player) {
    document.getElementById(
      "selectedPlayerName"
    ).textContent = "선수를 선택해주세용";

    document.getElementById(
      "selectedPlayerLiveInfo"
    ).textContent = "출전 시간 00:00 · +/- 0";

    document.getElementById(
      "selectedPlayerTeamTag"
    ).textContent = "팀 선택 대기";

    return;
  }

  document.getElementById(
    "selectedPlayerName"
  ).textContent = `#${player.number} ${player.name}`;

  document.getElementById(
    "selectedPlayerLiveInfo"
  ).textContent =
    `출전 시간 ${formatTime(player.courtSeconds)} · +/- ${formatSignedNumber(
      player.plusMinus
    )}`;

  document.getElementById(
    "selectedPlayerTeamTag"
  ).textContent =
    `${getTeamName(player.team)} · ${
      player.onCourt ? "출전 중" : "벤치"
    }`;
}

/* =========================
   최근 기록 렌더링
========================= */

function renderRecentLogs() {
  const container = document.getElementById(
    "recentLogList"
  );

  if (!container) {
    return;
  }

  if (state.logs.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        아직 기록이 없습니다.
      </div>
    `;

    return;
  }

  container.innerHTML = state.logs
    .slice(0, 30)
    .map(log => {
      const playerText = log.playerName
        ? `<b>${escapeHtml(log.playerName)}</b> · `
        : "";

      return `
        <div class="recent-log-row">
          <time>${escapeHtml(log.period)}</time>

          <span>
            ${playerText}${escapeHtml(log.text)}
          </span>

          <strong>
            ${escapeHtml(log.team)}
          </strong>
        </div>
      `;
    })
    .join("");
}

/* =========================
   팀 비교
========================= */

function renderTeamComparison() {
  const teamA = getTeamStats("A");
  const teamB = getTeamStats("B");

  const rows = [
    {
      name: "Pts",
      valueA: teamA.pts,
      valueB: teamB.pts
    },
    {
      name: "Reb",
      valueA: teamA.reb,
      valueB: teamB.reb
    },
    {
      name: "Ast",
      valueA: teamA.ast,
      valueB: teamB.ast
    },
    {
      name: "Stl",
      valueA: teamA.stl,
      valueB: teamB.stl
    },
    {
      name: "Blk",
      valueA: teamA.blk,
      valueB: teamB.blk
    },
    {
      name: "To",
      valueA: teamA.to,
      valueB: teamB.to
    }
  ];

  rows.forEach(row => {
    const total = Math.max(
      row.valueA + row.valueB,
      1
    );

    const widthA = (row.valueA / total) * 100;
    const widthB = (row.valueB / total) * 100;

    const valueAElement = document.getElementById(
      `compare${row.name}A`
    );

    const valueBElement = document.getElementById(
      `compare${row.name}B`
    );

    const barAElement = document.getElementById(
      `compareBar${row.name}A`
    );

    const barBElement = document.getElementById(
      `compareBar${row.name}B`
    );

    if (valueAElement) {
      valueAElement.textContent = row.valueA;
    }

    if (valueBElement) {
      valueBElement.textContent = row.valueB;
    }

    if (barAElement) {
      barAElement.style.width = `${widthA}%`;
    }

    if (barBElement) {
      barBElement.style.width = `${widthB}%`;
    }
  });
}

/* =========================
   MVP·실시간 리더
========================= */

function calculateMvpScore(player) {
  return (
    player.pts +
    player.reb * 1.2 +
    player.ast * 1.5 +
    player.stl * 2 +
    player.blk * 2 -
    player.to * 1.3 -
    player.pf * 0.5 +
    player.plusMinus * 0.15
  );
}

function renderLiveMvp() {
  const container = document.getElementById("mvpCard");

  if (!container || state.players.length === 0) {
    return;
  }

  const player = [...state.players].sort(
    (a, b) =>
      calculateMvpScore(b) -
      calculateMvpScore(a)
  )[0];

  container.innerHTML = `
    <div class="mvp-icon">🏀</div>

    <div class="mvp-info">
      <div class="mvp-team">
        ${escapeHtml(getTeamName(player.team))}
      </div>

      <div class="mvp-name">
        #${player.number} ${escapeHtml(player.name)}
      </div>

      <div class="mvp-stats">
        PTS ${player.pts} · REB ${player.reb} · AST ${player.ast}
      </div>
    </div>

    <div class="mvp-score">
      ${calculateMvpScore(player).toFixed(1)}
    </div>
  `;
}

function findStatLeader(key) {
  if (state.players.length === 0) {
    return null;
  }

  return [...state.players].sort(
    (a, b) => (b[key] || 0) - (a[key] || 0)
  )[0];
}

function renderLiveLeaders() {
  const container = document.getElementById(
    "liveLeaderCards"
  );

  if (!container) {
    return;
  }

  const categories = [
    {
      label: "득점",
      key: "pts"
    },
    {
      label: "리바운드",
      key: "reb"
    },
    {
      label: "어시스트",
      key: "ast"
    },
    {
      label: "수비",
      key: "defenseScore"
    }
  ];

  container.innerHTML = categories
    .map(category => {
      const leader = findStatLeader(category.key);

      if (!leader) {
        return "";
      }

      const value =
        category.key === "defenseScore"
          ? leader.defenseScore.toFixed(1)
          : leader[category.key];

      return `
        <div class="live-leader-card">
          <span>${category.label}</span>

          <strong>
            #${leader.number} ${escapeHtml(leader.name)}
          </strong>

          <b>${value}</b>
        </div>
      `;
    })
    .join("");
}

/* =========================
   2부 렌더링 묶음
========================= */

function renderLivePartTwo() {
  updatePlayerImpactScores();

  renderLiveGameInfo();
  renderTeamHeaders();
  renderScoreboard();
  renderSelectedPlayerHeader();
  renderOnCourtPlayers();
  renderRecentLogs();
  renderTeamComparison();
  renderLiveMvp();
  renderLiveLeaders();
}

/* =========================
   2부 이벤트 시작
========================= */

function initializeAppPartTwo() {
  bindStatButtons();
  bindClockButtons();
  bindPeriodButtons();
  bindTimeoutButtons();
  bindHistoryButtons();
  bindGameControlButtons();

  renderLivePartTwo();
}

initializeAppPartTwo();
/* =========================
   선수 선택 옵션
========================= */

function renderPlayerSelectOptions() {
  const selectIds = [
    "playerDetailSelect",
    "shotPlayerSelect",
    "videoPlayerSelect",
    "reportPlayerSelect"
  ];

  selectIds.forEach(selectId => {
    const select = document.getElementById(selectId);

    if (!select) {
      return;
    }

    const previousValue = select.value;

    select.innerHTML = `
      <option value="">
        선수를 선택해주세용
      </option>
    `;

    state.players.forEach(player => {
      const option = document.createElement("option");

      option.value = player.id;
      option.textContent =
        `${player.team}팀 #${player.number} ${player.name}`;

      select.appendChild(option);
    });

    if (
      previousValue &&
      state.players.some(player => player.id === previousValue)
    ) {
      select.value = previousValue;
    }
  });
}

/* =========================
   기록표
========================= */

function bindRecordFilters() {
  const teamFilter = document.getElementById(
    "recordFilterTeam"
  );

  const periodFilter = document.getElementById(
    "recordFilterPeriod"
  );

  const playerDetailSelect = document.getElementById(
    "playerDetailSelect"
  );

  if (teamFilter) {
    teamFilter.addEventListener("change", renderStatsTable);
  }

  if (periodFilter) {
    periodFilter.addEventListener("change", renderStatsTable);
  }

  if (playerDetailSelect) {
    playerDetailSelect.addEventListener(
      "change",
      renderPlayerDetail
    );
  }
}

function updatePeriodFilterOptions() {
  const filterIds = [
    "recordFilterPeriod",
    "shotPeriodFilter"
  ];

  const labels = getPeriodLabels();

  filterIds.forEach(filterId => {
    const select = document.getElementById(filterId);

    if (!select) {
      return;
    }

    const previousValue = select.value || "all";

    select.innerHTML = `
      <option value="all">전체 구간</option>
    `;

    labels.forEach(label => {
      const option = document.createElement("option");

      option.value = label;
      option.textContent = label;

      select.appendChild(option);
    });

    if (
      previousValue === "all" ||
      labels.includes(previousValue)
    ) {
      select.value = previousValue;
    }
  });
}

function getPlayerStatsForPeriod(player, periodFilter) {
  if (periodFilter === "all") {
    return {
      courtSeconds: player.courtSeconds,
      pts: player.pts,
      reb: player.reb,
      ast: player.ast,
      stl: player.stl,
      blk: player.blk,
      to: player.to,
      pf: player.pf,
      fgm: player.fgm,
      fga: player.fga,
      plusMinus: player.plusMinus
    };
  }

  const period =
    player.periodStats?.[periodFilter] || {};

  return {
    courtSeconds: period.courtSeconds || 0,
    pts: period.pts || 0,
    reb: period.reb || 0,
    ast: period.ast || 0,
    stl: period.stl || 0,
    blk: period.blk || 0,
    to: period.to || 0,
    pf: period.pf || 0,
    fgm: period.fgm || 0,
    fga: period.fga || 0,
    plusMinus: period.plusMinus || 0
  };
}

function renderStatsTable() {
  const tbody = document.getElementById("statsTableBody");

  if (!tbody) {
    return;
  }

  const teamFilter =
    document.getElementById("recordFilterTeam")?.value ||
    "all";

  const periodFilter =
    document.getElementById("recordFilterPeriod")?.value ||
    "all";

  const filteredPlayers = state.players.filter(player => {
    return (
      teamFilter === "all" ||
      player.team === teamFilter
    );
  });

  if (filteredPlayers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="16" class="empty-cell">
          표시할 선수가 없습니다.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = filteredPlayers
    .map(player => {
      const stats = getPlayerStatsForPeriod(
        player,
        periodFilter
      );

      const fieldGoalPercentage =
        stats.fga === 0
          ? 0
          : Math.round((stats.fgm / stats.fga) * 100);

      const offense =
        periodFilter === "all"
          ? player.offenseScore
          : calculatePeriodOffenseScore(stats);

      const defense =
        periodFilter === "all"
          ? player.defenseScore
          : calculatePeriodDefenseScore(stats);

      return `
        <tr>
          <td>${player.team}</td>
          <td>${player.number}</td>
          <td>${escapeHtml(player.name)}</td>
          <td>${formatTime(stats.courtSeconds)}</td>
          <td>${stats.pts}</td>
          <td>${stats.reb}</td>
          <td>${stats.ast}</td>
          <td>${stats.stl}</td>
          <td>${stats.blk}</td>
          <td>${stats.to}</td>
          <td>${stats.pf}</td>
          <td>${stats.fgm}/${stats.fga}</td>
          <td>${fieldGoalPercentage}%</td>
          <td>${formatSignedNumber(stats.plusMinus)}</td>
          <td>${offense.toFixed(1)}</td>
          <td>${defense.toFixed(1)}</td>
        </tr>
      `;
    })
    .join("");
}

function calculatePeriodOffenseScore(stats) {
  const missedShots = Math.max(
    stats.fga - stats.fgm,
    0
  );

  return (
    stats.pts +
    stats.ast * 1.5 +
    stats.reb * 0.3 -
    stats.to * 1.5 -
    missedShots * 0.5
  );
}

function calculatePeriodDefenseScore(stats) {
  return (
    stats.stl * 2.3 +
    stats.blk * 2.2 +
    stats.reb * 0.8 -
    stats.pf * 0.6
  );
}

/* =========================
   팀 기록 요약
========================= */

function renderTeamSummaryCards() {
  const container = document.getElementById(
    "teamSummaryCards"
  );

  if (!container) {
    return;
  }

  const teamA = getTeamStats("A");
  const teamB = getTeamStats("B");

  const teamAFg =
    teamA.fga === 0
      ? 0
      : Math.round((teamA.fgm / teamA.fga) * 100);

  const teamBFg =
    teamB.fga === 0
      ? 0
      : Math.round((teamB.fgm / teamB.fga) * 100);

  container.innerHTML = `
    ${createSummaryCard(
      `${state.teamAName} 득점`,
      teamA.pts
    )}

    ${createSummaryCard(
      `${state.teamBName} 득점`,
      teamB.pts
    )}

    ${createSummaryCard(
      `${state.teamAName} 야투율`,
      `${teamAFg}%`
    )}

    ${createSummaryCard(
      `${state.teamBName} 야투율`,
      `${teamBFg}%`
    )}

    ${createSummaryCard(
      `${state.teamAName} 리바운드`,
      teamA.reb
    )}

    ${createSummaryCard(
      `${state.teamBName} 리바운드`,
      teamB.reb
    )}

    ${createSummaryCard(
      `${state.teamAName} 어시스트`,
      teamA.ast
    )}

    ${createSummaryCard(
      `${state.teamBName} 어시스트`,
      teamB.ast
    )}
  `;
}

function createSummaryCard(label, value) {
  return `
    <div class="summary-stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

/* =========================
   선수 상세 기록
========================= */

function renderPlayerDetail() {
  const card = document.getElementById(
    "playerDetailCard"
  );

  if (!card) {
    return;
  }

  const playerId =
    document.getElementById("playerDetailSelect")
      ?.value || "";

  const player = getPlayer(playerId);

  if (!player) {
    card.innerHTML = `
      <div class="empty-message">
        선수를 선택하면 상세 기록이 표시돼용.
      </div>
    `;

    return;
  }

  const fieldGoalPercentage =
    player.fga === 0
      ? 0
      : Math.round((player.fgm / player.fga) * 100);

  card.innerHTML = `
    <h3>
      #${player.number} ${escapeHtml(player.name)}
    </h3>

    <p class="panel-help">
      ${escapeHtml(getTeamName(player.team))}
      · ${player.onCourt ? "출전 중" : "벤치"}
    </p>

    <div class="player-detail-grid">
      ${createPlayerDetailStat("MIN", formatTime(player.courtSeconds))}
      ${createPlayerDetailStat("PTS", player.pts)}
      ${createPlayerDetailStat("REB", player.reb)}
      ${createPlayerDetailStat("AST", player.ast)}
      ${createPlayerDetailStat("STL", player.stl)}
      ${createPlayerDetailStat("BLK", player.blk)}
      ${createPlayerDetailStat("TO", player.to)}
      ${createPlayerDetailStat("PF", player.pf)}
      ${createPlayerDetailStat("FG", `${player.fgm}/${player.fga}`)}
      ${createPlayerDetailStat("FG%", `${fieldGoalPercentage}%`)}
      ${createPlayerDetailStat(
        "+/-",
        formatSignedNumber(player.plusMinus)
      )}
      ${createPlayerDetailStat(
        "OFF",
        player.offenseScore.toFixed(1)
      )}
      ${createPlayerDetailStat(
        "DEF",
        player.defenseScore.toFixed(1)
      )}
    </div>
  `;
}

function createPlayerDetailStat(label, value) {
  return `
    <div class="player-detail-stat">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

/* =========================
   구간별 기록
========================= */

function renderPeriodStatsList() {
  const container = document.getElementById(
    "periodStatsList"
  );

  if (!container) {
    return;
  }

  updatePeriodSummaryRecord();

  if (state.periodStats.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        구간별 기록이 없습니다.
      </div>
    `;

    return;
  }

  container.innerHTML = state.periodStats
    .map(record => {
      return `
        <div class="period-stat-row">
          <strong>${escapeHtml(record.period)}</strong>

          <span>
            ${escapeHtml(state.teamAName)}
            ${record.teamAScore}
            :
            ${record.teamBScore}
            ${escapeHtml(state.teamBName)}
          </span>

          <span>
            REB ${record.teamAReb}-${record.teamBReb}
            · AST ${record.teamAAst}-${record.teamBAst}
          </span>
        </div>
      `;
    })
    .join("");
}

/* =========================
   교체 기록
========================= */

function renderSubstitutionLog() {
  const container = document.getElementById(
    "substitutionLogList"
  );

  if (!container) {
    return;
  }

  if (state.substitutions.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        선수 교체 기록이 없습니다.
      </div>
    `;

    return;
  }

  container.innerHTML = state.substitutions
    .map(substitution => {
      let text = "";

      if (substitution.type === "CHANGE") {
        text =
          `${escapeHtml(substitution.outPlayerName)} OUT · ` +
          `${escapeHtml(substitution.inPlayerName)} IN`;
      } else if (substitution.type === "OUT") {
        text =
          `${escapeHtml(substitution.outPlayerName)} OUT`;
      } else {
        text =
          `${escapeHtml(substitution.inPlayerName)} IN`;
      }

      return `
        <div class="substitution-log-row">
          <strong>
            ${escapeHtml(substitution.period)}
          </strong>

          <span>
            ${escapeHtml(getTeamName(substitution.team))}
            · ${text}
          </span>

          <span>
            ${formatTime(substitution.gameSeconds)}
          </span>
        </div>
      `;
    })
    .join("");
}

/* =========================
   라인업 분석
========================= */

function renderLineupAnalysis() {
  const container = document.getElementById(
    "lineupAnalysisList"
  );

  if (!container) {
    return;
  }

  const validLineups = state.lineupRecords
    .filter(lineup => lineup.seconds > 0)
    .sort((a, b) => {
      if (b.plusMinus !== a.plusMinus) {
        return b.plusMinus - a.plusMinus;
      }

      return b.seconds - a.seconds;
    });

  if (validLineups.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        선수 교체와 득점 기록이 쌓이면 라인업 분석이 표시돼용.
      </div>
    `;

    return;
  }

  container.innerHTML = validLineups
    .map(lineup => {
      return `
        <div class="lineup-analysis-row">
          <strong>
            ${escapeHtml(getTeamName(lineup.team))}
            · ${escapeHtml(lineup.playerNames)}
          </strong>

          <span>
            시간
            <b>${formatTime(lineup.seconds)}</b>
          </span>

          <span>
            득점
            <b>${lineup.pointsFor}</b>
          </span>

          <span>
            실점
            <b>${lineup.pointsAgainst}</b>
          </span>

          <span>
            +/-
            <b>${formatSignedNumber(lineup.plusMinus)}</b>
          </span>
        </div>
      `;
    })
    .join("");
}

/* =========================
   순위 공통 렌더링
========================= */

function renderRankingList(
  containerId,
  players,
  valueGetter,
  valueFormatter = value => value
) {
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  if (!players || players.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        기록이 없습니다.
      </div>
    `;

    return;
  }

  container.innerHTML = players
    .map((player, index) => {
      const value = valueGetter(player);

      return `
        <div class="ranking-row">
          <div class="rank-number">
            ${index + 1}
          </div>

          <div>
            <strong>
              #${player.number}
              ${escapeHtml(player.name)}
            </strong>

            <span>
              ${escapeHtml(getTeamName(player.team))}
            </span>
          </div>

          <b>${valueFormatter(value)}</b>
        </div>
      `;
    })
    .join("");
}

/* =========================
   플러스마이너스·기여도
========================= */

function renderImpactRankings() {
  const plusMinusPlayers = [...state.players]
    .sort((a, b) => b.plusMinus - a.plusMinus);

  const offensePlayers = [...state.players]
    .sort((a, b) => b.offenseScore - a.offenseScore);

  const defensePlayers = [...state.players]
    .sort((a, b) => b.defenseScore - a.defenseScore);

  renderRankingList(
    "plusMinusRanking",
    plusMinusPlayers,
    player => player.plusMinus,
    value => formatSignedNumber(value)
  );

  renderRankingList(
    "offenseRanking",
    offensePlayers,
    player => player.offenseScore,
    value => Number(value).toFixed(1)
  );

  renderRankingList(
    "defenseRanking",
    defensePlayers,
    player => player.defenseScore,
    value => Number(value).toFixed(1)
  );
}

/* =========================
   팀 플레이 성향
========================= */

function renderTeamStyleAnalysis() {
  const container = document.getElementById(
    "teamStyleAnalysis"
  );

  if (!container) {
    return;
  }

  const teamA = getTeamStats("A");
  const teamB = getTeamStats("B");

  container.innerHTML = `
    ${createTeamStyleCard("A", teamA)}
    ${createTeamStyleCard("B", teamB)}
  `;
}

function createTeamStyleCard(team, stats) {
  const totalActions = Math.max(
    stats.pts +
      stats.reb +
      stats.ast +
      stats.stl +
      stats.blk +
      stats.to,
    1
  );

  const passingRate = Math.min(
    100,
    Math.round((stats.ast / totalActions) * 260)
  );

  const defenseRate = Math.min(
    100,
    Math.round(
      ((stats.stl + stats.blk + stats.reb * 0.4) /
        totalActions) *
        180
    )
  );

  const controlRate = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          (stats.to / Math.max(stats.ast + stats.pts, 1)) *
            100
      )
    )
  );

  const styleText = createTeamStyleText(
    stats,
    passingRate,
    defenseRate,
    controlRate
  );

  return `
    <div class="team-style-card">
      <h4>
        ${escapeHtml(getTeamName(team))}
      </h4>

      <p>${styleText}</p>

      ${createStyleMeter("패스 전개", passingRate)}
      ${createStyleMeter("수비 활동량", defenseRate)}
      ${createStyleMeter("볼 관리", controlRate)}
    </div>
  `;
}

function createTeamStyleText(
  stats,
  passingRate,
  defenseRate,
  controlRate
) {
  const descriptions = [];

  if (passingRate >= 60) {
    descriptions.push("패스를 통한 공격 전개가 활발해용.");
  } else {
    descriptions.push("개인 공격 비중이 비교적 높은 편이에용.");
  }

  if (defenseRate >= 60) {
    descriptions.push("수비 활동량과 볼 압박이 좋아용.");
  } else {
    descriptions.push("수비 리바운드와 도움수비 보완이 필요해용.");
  }

  if (controlRate < 55 || stats.to >= 5) {
    descriptions.push("턴오버 관리가 중요한 과제예용.");
  } else {
    descriptions.push("공격 과정에서 볼 관리가 안정적이에용.");
  }

  return descriptions.join(" ");
}

function createStyleMeter(label, value) {
  return `
    <p>${escapeHtml(label)} ${value}%</p>

    <div class="style-meter">
      <div style="width: ${value}%"></div>
    </div>
  `;
}

/* =========================
   패스 네트워크
========================= */

function bindPassNetworkControls() {
  const teamSelect = document.getElementById(
    "passNetworkTeam"
  );

  if (!teamSelect) {
    return;
  }

  teamSelect.addEventListener("change", drawPassNetwork);
}

function drawPassNetwork() {
  const canvas = document.getElementById(
    "passNetworkCanvas"
  );

  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  context.clearRect(0, 0, width, height);

  context.fillStyle = "#07121b";
  context.fillRect(0, 0, width, height);

  const selectedTeam =
    document.getElementById("passNetworkTeam")?.value ||
    "A";

  const players = getTeamPlayers(selectedTeam);

  if (players.length === 0) {
    return;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.32;

  const positions = new Map();

  players.forEach((player, index) => {
    const angle =
      -Math.PI / 2 +
      (Math.PI * 2 * index) / players.length;

    positions.set(player.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    });
  });

  const connections = state.passConnections.filter(
    connection => connection.team === selectedTeam
  );

  connections.forEach(connection => {
    const from = positions.get(connection.fromPlayerId);
    const to = positions.get(connection.toPlayerId);

    if (!from || !to) {
      return;
    }

    context.strokeStyle = "rgba(246,186,63,0.75)";
    context.lineWidth = Math.min(
      12,
      2 + connection.count * 1.6
    );

    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();

    const middleX = (from.x + to.x) / 2;
    const middleY = (from.y + to.y) / 2;

    context.fillStyle = "#f6ba3f";
    context.font = "bold 18px sans-serif";
    context.textAlign = "center";
    context.fillText(
      String(connection.count),
      middleX,
      middleY
    );
  });

  players.forEach(player => {
    const position = positions.get(player.id);

    if (!position) {
      return;
    }

    context.beginPath();
    context.arc(
      position.x,
      position.y,
      42,
      0,
      Math.PI * 2
    );

    context.fillStyle =
      selectedTeam === "A"
        ? "#2f93ff"
        : "#ff4c55";

    context.fill();

    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.stroke();

    context.fillStyle = "#ffffff";
    context.textAlign = "center";

    context.font = "bold 19px sans-serif";
    context.fillText(
      `#${player.number}`,
      position.x,
      position.y - 3
    );

    context.font = "12px sans-serif";

    const shortName =
      player.name.length > 7
        ? `${player.name.slice(0, 7)}…`
        : player.name;

    context.fillText(
      shortName,
      position.x,
      position.y + 18
    );
  });
}

/* =========================
   3부 렌더링 묶음
========================= */

function renderRecordAndAnalysisPartThree() {
  updatePlayerImpactScores();

  renderPlayerSelectOptions();
  updatePeriodFilterOptions();

  renderStatsTable();
  renderTeamSummaryCards();
  renderPlayerDetail();

  renderPeriodStatsList();
  renderSubstitutionLog();

  renderLineupAnalysis();
  renderImpactRankings();
  renderTeamStyleAnalysis();

  drawPassNetwork();
}

/* =========================
   3부 실행
========================= */

function initializeAppPartThree() {
  bindRecordFilters();
  bindPassNetworkControls();

  renderRecordAndAnalysisPartThree();
}

initializeAppPartThree();
/* =========================
   슛차트 기본 설정
========================= */

const shotChartCanvas = document.getElementById(
  "shotChartCanvas"
);

const miniCourtCanvas = document.getElementById(
  "miniCourtCanvas"
);

function bindShotChartButtons() {
  const madeButton = document.getElementById(
    "recordMadeShotBtn"
  );

  const missButton = document.getElementById(
    "recordMissShotBtn"
  );

  const heatmapButton = document.getElementById(
    "toggleHeatmapBtn"
  );

  const clearButton = document.getElementById(
    "clearShotChartBtn"
  );

  const playerSelect = document.getElementById(
    "shotPlayerSelect"
  );

  const viewModeSelect = document.getElementById(
    "shotViewMode"
  );

  const periodFilter = document.getElementById(
    "shotPeriodFilter"
  );

  if (madeButton) {
    madeButton.addEventListener("click", () => {
      state.shotMode = "made";

      alert("코트에서 슛 성공 위치를 눌러주세용.");
    });
  }

  if (missButton) {
    missButton.addEventListener("click", () => {
      state.shotMode = "miss";

      alert("코트에서 슛 실패 위치를 눌러주세용.");
    });
  }

  if (heatmapButton) {
    heatmapButton.addEventListener("click", () => {
      state.heatmap = !state.heatmap;

      heatmapButton.textContent = state.heatmap
        ? "히트맵 끄기"
        : "히트맵 켜기";

      saveState();
      drawAllCourts();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", clearSelectedShots);
  }

  if (playerSelect) {
    playerSelect.addEventListener("change", () => {
      drawAllCourts();
      renderShotSummary();
      renderZoneAnalysis();
      renderShotTrend();
    });
  }

  if (viewModeSelect) {
    viewModeSelect.addEventListener("change", () => {
      drawAllCourts();
      renderShotSummary();
      renderZoneAnalysis();
      renderShotTrend();
    });
  }

  if (periodFilter) {
    periodFilter.addEventListener("change", () => {
      drawAllCourts();
      renderShotSummary();
      renderZoneAnalysis();
      renderShotTrend();
    });
  }

  if (shotChartCanvas) {
    shotChartCanvas.addEventListener(
      "click",
      handleShotChartClick
    );
  }
}

/* =========================
   슛 기록
========================= */

function handleShotChartClick(event) {
  if (!state.shotMode) {
    alert("먼저 성공 또는 실패 버튼을 눌러주세용.");
    return;
  }

  const selectedPlayerId =
    document.getElementById("shotPlayerSelect")?.value ||
    state.selectedPlayerId;

  const player = getPlayer(selectedPlayerId);

  if (!player) {
    alert("슛을 기록할 선수를 선택해주세용.");
    return;
  }

  const rectangle =
    shotChartCanvas.getBoundingClientRect();

  const x =
    ((event.clientX - rectangle.left) /
      rectangle.width) *
    100;

  const y =
    ((event.clientY - rectangle.top) /
      rectangle.height) *
    100;

  const zone = getShotZone(x, y);
  const shotType = getShotPointValue(x, y);

  pushHistory();

  const shot = {
    id: createId("shot"),
    playerId: player.id,
    playerName: player.name,
    team: player.team,

    x,
    y,

    made: state.shotMode === "made",
    pointValue: shotType,
    zone,

    period: getPeriodKey(),
    gameSeconds: state.gameSeconds,
    createdAt: Date.now()
  };

  state.shots.push(shot);

  if (shot.made) {
    player.fgm += 1;
    player.fga += 1;
    player.pts += shot.pointValue;

    addPlayerPeriodStat(player, "fgm", 1);
    addPlayerPeriodStat(player, "fga", 1);
    addPlayerPeriodStat(
      player,
      "pts",
      shot.pointValue
    );

    applyPlayerPlusMinus(
      player.team,
      shot.pointValue
    );

    applyLineupScoreChange(
      player.team,
      shot.pointValue
    );

    state.lastScorerId = player.id;

    addLog({
      player,
      text:
        `${shot.pointValue}점슛 성공 · ${zone}`,
      category: "슛차트"
    });
  } else {
    player.fga += 1;
    addPlayerPeriodStat(player, "fga", 1);

    addLog({
      player,
      text: `슛 실패 · ${zone}`,
      category: "슛차트"
    });
  }

  state.shotMode = null;

  updatePeriodSummaryRecord();
  updatePlayerImpactScores();

  saveState();
  renderAll();
}

/* =========================
   슛 거리·구역 계산
========================= */

function getShotPointValue(x, y) {
  const basketX = 50;
  const basketY = 8;

  const distance = Math.sqrt(
    Math.pow(x - basketX, 2) +
    Math.pow(y - basketY, 2)
  );

  const cornerThree =
    y < 38 && (x < 15 || x > 85);

  if (cornerThree || distance > 42) {
    return 3;
  }

  return 2;
}

function getShotZone(x, y) {
  const basketX = 50;
  const basketY = 8;

  const distance = Math.sqrt(
    Math.pow(x - basketX, 2) +
    Math.pow(y - basketY, 2)
  );

  if (distance <= 14) {
    return "골밑";
  }

  if (y < 40 && x < 20) {
    return "왼쪽 코너 3점";
  }

  if (y < 40 && x > 80) {
    return "오른쪽 코너 3점";
  }

  if (distance > 42) {
    if (x < 38) {
      return "왼쪽 외곽";
    }

    if (x > 62) {
      return "오른쪽 외곽";
    }

    return "정면 외곽";
  }

  if (x < 33) {
    return "왼쪽 미드레인지";
  }

  if (x > 67) {
    return "오른쪽 미드레인지";
  }

  return "정면 미드레인지";
}

/* =========================
   슛 필터
========================= */

function getFilteredShots() {
  const viewMode =
    document.getElementById("shotViewMode")?.value ||
    "player";

  const playerId =
    document.getElementById("shotPlayerSelect")?.value ||
    "";

  const period =
    document.getElementById("shotPeriodFilter")?.value ||
    "all";

  let shots = [...state.shots];

  if (viewMode === "player") {
    shots = shots.filter(
      shot => shot.playerId === playerId
    );
  }

  if (viewMode === "teamA") {
    shots = shots.filter(
      shot => shot.team === "A"
    );
  }

  if (viewMode === "teamB") {
    shots = shots.filter(
      shot => shot.team === "B"
    );
  }

  if (period !== "all") {
    shots = shots.filter(
      shot => shot.period === period
    );
  }

  return shots;
}

function clearSelectedShots() {
  const viewMode =
    document.getElementById("shotViewMode")?.value ||
    "player";

  const playerId =
    document.getElementById("shotPlayerSelect")?.value ||
    "";

  if (viewMode === "player" && !playerId) {
    alert("초기화할 선수를 선택해주세용.");
    return;
  }

  const confirmed = confirm(
    "현재 선택된 슛 기록을 삭제할까용?"
  );

  if (!confirmed) {
    return;
  }

  if (viewMode === "player") {
    state.shots = state.shots.filter(
      shot => shot.playerId !== playerId
    );
  } else if (viewMode === "teamA") {
    state.shots = state.shots.filter(
      shot => shot.team !== "A"
    );
  } else if (viewMode === "teamB") {
    state.shots = state.shots.filter(
      shot => shot.team !== "B"
    );
  } else {
    state.shots = [];
  }

  saveState();
  renderAll();
}

/* =========================
   코트 그리기
========================= */

function drawCourt(canvas, shots, options = {}) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  context.clearRect(0, 0, width, height);

  context.fillStyle = "#07121b";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "#71889b";
  context.lineWidth = Math.max(2, width * 0.004);

  context.strokeRect(
    5,
    5,
    width - 10,
    height - 10
  );

  const basketX = width / 2;
  const basketY = height * 0.08;

  context.beginPath();
  context.arc(
    basketX,
    basketY,
    width * 0.025,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.beginPath();
  context.moveTo(
    width * 0.46,
    basketY - 5
  );
  context.lineTo(
    width * 0.54,
    basketY - 5
  );
  context.stroke();

  context.strokeRect(
    width * 0.34,
    5,
    width * 0.32,
    height * 0.37
  );

  context.beginPath();
  context.arc(
    width / 2,
    height * 0.37,
    width * 0.1,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.beginPath();
  context.arc(
    basketX,
    basketY,
    width * 0.43,
    0,
    Math.PI,
    false
  );
  context.stroke();

  context.beginPath();
  context.moveTo(width * 0.07, 5);
  context.lineTo(width * 0.07, height * 0.35);

  context.moveTo(width * 0.93, 5);
  context.lineTo(width * 0.93, height * 0.35);
  context.stroke();

  context.beginPath();
  context.arc(
    width / 2,
    height,
    width * 0.12,
    Math.PI,
    0
  );
  context.stroke();

  if (options.heatmap) {
    drawShotHeatmap(context, canvas, shots);
  }

  drawShotMarkers(context, canvas, shots);
}

function drawShotHeatmap(context, canvas, shots) {
  shots.forEach(shot => {
    const x = (shot.x / 100) * canvas.width;
    const y = (shot.y / 100) * canvas.height;

    const radius =
      Math.max(canvas.width, canvas.height) * 0.05;

    const gradient =
      context.createRadialGradient(
        x,
        y,
        2,
        x,
        y,
        radius
      );

    if (shot.made) {
      gradient.addColorStop(
        0,
        "rgba(47,147,255,0.48)"
      );
    } else {
      gradient.addColorStop(
        0,
        "rgba(255,76,85,0.45)"
      );
    }

    gradient.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    context.fillStyle = gradient;

    context.beginPath();
    context.arc(
      x,
      y,
      radius,
      0,
      Math.PI * 2
    );
    context.fill();
  });
}

function drawShotMarkers(context, canvas, shots) {
  const markerSize =
    Math.max(6, canvas.width * 0.011);

  shots.forEach(shot => {
    const x = (shot.x / 100) * canvas.width;
    const y = (shot.y / 100) * canvas.height;

    context.lineWidth =
      Math.max(2, canvas.width * 0.004);

    if (shot.made) {
      context.strokeStyle =
        shot.team === "A"
          ? "#2f93ff"
          : "#f6ba3f";

      context.beginPath();
      context.arc(
        x,
        y,
        markerSize,
        0,
        Math.PI * 2
      );
      context.stroke();
    } else {
      context.strokeStyle = "#ff4c55";

      context.beginPath();
      context.moveTo(
        x - markerSize,
        y - markerSize
      );

      context.lineTo(
        x + markerSize,
        y + markerSize
      );

      context.moveTo(
        x + markerSize,
        y - markerSize
      );

      context.lineTo(
        x - markerSize,
        y + markerSize
      );

      context.stroke();
    }
  });
}

function drawAllCourts() {
  const filteredShots = getFilteredShots();

  drawCourt(
    shotChartCanvas,
    filteredShots,
    {
      heatmap: state.heatmap
    }
  );

  drawCourt(
    miniCourtCanvas,
    state.shots,
    {
      heatmap: false
    }
  );
}

/* =========================
   슛 요약
========================= */

function renderShotSummary() {
  const container = document.getElementById(
    "shotSummaryCard"
  );

  if (!container) {
    return;
  }

  const shots = getFilteredShots();

  const madeShots = shots.filter(
    shot => shot.made
  ).length;

  const attempts = shots.length;

  const percentage =
    attempts === 0
      ? 0
      : Math.round(
          (madeShots / attempts) * 100
        );

  const twoPointShots = shots.filter(
    shot => shot.pointValue === 2
  );

  const threePointShots = shots.filter(
    shot => shot.pointValue === 3
  );

  const twoMade = twoPointShots.filter(
    shot => shot.made
  ).length;

  const threeMade = threePointShots.filter(
    shot => shot.made
  ).length;

  container.innerHTML = `
    ${createShotSummaryStat(
      "전체 성공률",
      `${percentage}%`
    )}

    ${createShotSummaryStat(
      "성공 / 시도",
      `${madeShots} / ${attempts}`
    )}

    ${createShotSummaryStat(
      "2점슛",
      `${twoMade} / ${twoPointShots.length}`
    )}

    ${createShotSummaryStat(
      "3점슛",
      `${threeMade} / ${threePointShots.length}`
    )}
  `;
}

function createShotSummaryStat(label, value) {
  return `
    <div class="shot-summary-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

/* =========================
   구역별 성공률
========================= */

function renderZoneAnalysis() {
  const container = document.getElementById(
    "zoneAnalysisCards"
  );

  if (!container) {
    return;
  }

  const shots = getFilteredShots();

  if (shots.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        슛 위치를 기록하면 구역별 분석이 표시돼용.
      </div>
    `;

    return;
  }

  const zones = {};

  shots.forEach(shot => {
    if (!zones[shot.zone]) {
      zones[shot.zone] = {
        attempts: 0,
        made: 0
      };
    }

    zones[shot.zone].attempts += 1;

    if (shot.made) {
      zones[shot.zone].made += 1;
    }
  });

  container.innerHTML = Object.entries(zones)
    .sort((a, b) => {
      return b[1].attempts - a[1].attempts;
    })
    .map(([zoneName, values]) => {
      const percentage = Math.round(
        (values.made /
          Math.max(values.attempts, 1)) *
          100
      );

      return `
        <div class="zone-card">
          <span>${escapeHtml(zoneName)}</span>

          <strong>${percentage}%</strong>

          <small>
            ${values.made} / ${values.attempts}
          </small>
        </div>
      `;
    })
    .join("");
}

/* =========================
   구간별 슛 추세
========================= */

function renderShotTrend() {
  const container = document.getElementById(
    "shotTrendList"
  );

  if (!container) {
    return;
  }

  const shots = getFilteredShots();

  if (shots.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        슛 기록이 없습니다.
      </div>
    `;

    return;
  }

  const periodGroups = {};

  shots.forEach(shot => {
    const period = shot.period || "GAME";

    if (!periodGroups[period]) {
      periodGroups[period] = {
        attempts: 0,
        made: 0,
        points: 0
      };
    }

    periodGroups[period].attempts += 1;

    if (shot.made) {
      periodGroups[period].made += 1;
      periodGroups[period].points +=
        shot.pointValue;
    }
  });

  container.innerHTML = Object.entries(
    periodGroups
  )
    .map(([period, values]) => {
      const percentage = Math.round(
        (values.made /
          Math.max(values.attempts, 1)) *
          100
      );

      return `
        <div class="shot-trend-row">
          <strong>${escapeHtml(period)}</strong>

          <span>
            성공 ${values.made} · 시도 ${values.attempts}
          </span>

          <strong>
            ${percentage}% · ${values.points}점
          </strong>
        </div>
      `;
    })
    .join("");
}

/* =========================
   영상 파일 불러오기
========================= */

const analysisVideo = document.getElementById(
  "analysisVideo"
);

function bindVideoControls() {
  const fileInput = document.getElementById(
    "videoFileInput"
  );

  const youtubeButton = document.getElementById(
    "loadYoutubeBtn"
  );

  if (fileInput) {
    fileInput.addEventListener(
      "change",
      handleVideoFile
    );
  }

  if (youtubeButton) {
    youtubeButton.addEventListener(
      "click",
      loadYoutubeVideo
    );
  }

  bindVideoSeekButton("back10Btn", -10);
  bindVideoSeekButton("back5Btn", -5);
  bindVideoSeekButton("forward5Btn", 5);
  bindVideoSeekButton("forward10Btn", 10);

  bindVideoSpeedButton("speed05Btn", 0.5);
  bindVideoSpeedButton("speed10Btn", 1);
  bindVideoSpeedButton("speed15Btn", 1.5);
  bindVideoSpeedButton("speed20Btn", 2);

  const playButton = document.getElementById(
    "playPauseBtn"
  );

  if (playButton) {
    playButton.addEventListener(
      "click",
      toggleVideoPlayback
    );
  }

  document.querySelectorAll(".tag-btn").forEach(
    button => {
      button.addEventListener("click", () => {
        selectVideoTag(button);
      });
    }
  );

  document
    .getElementById("saveVideoTagBtn")
    ?.addEventListener(
      "click",
      saveCurrentVideoTag
    );

  document
    .getElementById("clearVideoTagsBtn")
    ?.addEventListener(
      "click",
      clearAllVideoTags
    );
}

function handleVideoFile(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const objectUrl =
    URL.createObjectURL(file);

  analysisVideo.src = objectUrl;
  analysisVideo.classList.remove("hidden");

  document
    .getElementById("youtubePlayerWrap")
    ?.classList.add("hidden");

  document.getElementById(
    "videoFileName"
  ).textContent = file.name;

  currentVideoType = "file";
}

function bindVideoSeekButton(buttonId, seconds) {
  const button = document.getElementById(buttonId);

  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    seekVideo(seconds);
  });
}

function bindVideoSpeedButton(buttonId, speed) {
  const button = document.getElementById(buttonId);

  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    setVideoSpeed(speed);
  });
}

function seekVideo(seconds) {
  if (
    currentVideoType === "youtube" &&
    youtubePlayer
  ) {
    const currentTime =
      youtubePlayer.getCurrentTime() || 0;

    youtubePlayer.seekTo(
      Math.max(0, currentTime + seconds),
      true
    );

    return;
  }

  if (!analysisVideo) {
    return;
  }

  analysisVideo.currentTime = Math.max(
    0,
    analysisVideo.currentTime + seconds
  );
}

function setVideoSpeed(speed) {
  if (
    currentVideoType === "youtube" &&
    youtubePlayer
  ) {
    youtubePlayer.setPlaybackRate(speed);
    return;
  }

  if (analysisVideo) {
    analysisVideo.playbackRate = speed;
  }
}

function toggleVideoPlayback() {
  if (
    currentVideoType === "youtube" &&
    youtubePlayer
  ) {
    const status =
      youtubePlayer.getPlayerState();

    if (status === 1) {
      youtubePlayer.pauseVideo();
    } else {
      youtubePlayer.playVideo();
    }

    return;
  }

  if (!analysisVideo) {
    return;
  }

  if (analysisVideo.paused) {
    analysisVideo.play();
  } else {
    analysisVideo.pause();
  }
}

function getCurrentVideoTime() {
  if (
    currentVideoType === "youtube" &&
    youtubePlayer
  ) {
    return youtubePlayer.getCurrentTime() || 0;
  }

  return analysisVideo?.currentTime || 0;
}

/* =========================
   유튜브
========================= */

window.onYouTubeIframeAPIReady = function () {
  youtubeReady = true;
};

function loadYoutubeVideo() {
  const input = document.getElementById(
    "youtubeUrlInput"
  );

  const videoId = extractYoutubeId(
    input?.value.trim() || ""
  );

  if (!videoId) {
    alert("올바른 유튜브 주소를 입력해주세용.");
    return;
  }

  if (
    !youtubeReady ||
    typeof YT === "undefined"
  ) {
    alert("유튜브 플레이어를 불러오는 중이에용.");
    return;
  }

  analysisVideo?.classList.add("hidden");

  document
    .getElementById("youtubePlayerWrap")
    ?.classList.remove("hidden");

  if (youtubePlayer) {
    youtubePlayer.loadVideoById(videoId);
  } else {
    youtubePlayer = new YT.Player(
      "youtubePlayer",
      {
        videoId,
        playerVars: {
          playsinline: 1,
          controls: 1
        }
      }
    );
  }

  currentVideoType = "youtube";
}

function extractYoutubeId(url) {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match) {
      return match[1];
    }
  }

  return "";
}

/* =========================
   영상 태그
========================= */

function selectVideoTag(button) {
  document.querySelectorAll(".tag-btn").forEach(
    item => {
      item.classList.remove("selected");
    }
  );

  button.classList.add("selected");
  selectedVideoTag = button.dataset.tag || "";
}

function saveCurrentVideoTag() {
  const playerId =
    document.getElementById("videoPlayerSelect")
      ?.value || "";

  const player = getPlayer(playerId);

  if (!player) {
    alert("장면과 연결할 선수를 선택해주세용.");
    return;
  }

  if (!selectedVideoTag) {
    alert("장면 태그를 선택해주세용.");
    return;
  }

  const memo =
    document.getElementById("videoTagMemo")
      ?.value.trim() || "";

  state.videoTags.unshift({
    id: createId("video-tag"),
    playerId: player.id,
    playerName: player.name,
    team: player.team,

    tag: selectedVideoTag,
    memo,

    seconds: getCurrentVideoTime(),
    videoType: currentVideoType,

    period: getPeriodKey(),
    createdAt: Date.now()
  });

  selectedVideoTag = "";

  document.querySelectorAll(".tag-btn").forEach(
    item => {
      item.classList.remove("selected");
    }
  );

  const memoInput = document.getElementById(
    "videoTagMemo"
  );

  if (memoInput) {
    memoInput.value = "";
  }

  saveState();
  renderVideoTags();
}

function clearAllVideoTags() {
  const confirmed = confirm(
    "저장된 영상 장면 태그를 모두 삭제할까용?"
  );

  if (!confirmed) {
    return;
  }

  state.videoTags = [];

  saveState();
  renderVideoTags();
}

function renderVideoTags() {
  const container = document.getElementById(
    "videoTagList"
  );

  if (!container) {
    return;
  }

  if (state.videoTags.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        저장된 영상 태그가 없습니다.
      </div>
    `;

    return;
  }

  container.innerHTML = state.videoTags
    .map(tag => {
      return `
        <div class="video-tag-row">
          <button
            type="button"
            data-seek-video-tag="${tag.seconds}"
          >
            ${formatTime(Math.floor(tag.seconds))}
          </button>

          <div>
            <strong>
              ${escapeHtml(tag.playerName)}
              · ${escapeHtml(tag.tag)}
            </strong>

            ${
              tag.memo
                ? `<p>${escapeHtml(tag.memo)}</p>`
                : ""
            }
          </div>

          <button
            type="button"
            data-delete-video-tag="${tag.id}"
          >
            삭제
          </button>
        </div>
      `;
    })
    .join("");
}

function bindVideoTagListEvents() {
  document.addEventListener("click", event => {
    const seekTime =
      event.target.dataset.seekVideoTag;

    const deleteId =
      event.target.dataset.deleteVideoTag;

    if (seekTime !== undefined) {
      jumpToVideoTime(Number(seekTime));
    }

    if (deleteId) {
      deleteVideoTag(deleteId);
    }
  });
}

function jumpToVideoTime(seconds) {
  if (
    currentVideoType === "youtube" &&
    youtubePlayer
  ) {
    youtubePlayer.seekTo(seconds, true);
    return;
  }

  if (analysisVideo) {
    analysisVideo.currentTime = seconds;
  }
}

function deleteVideoTag(tagId) {
  state.videoTags = state.videoTags.filter(
    tag => tag.id !== tagId
  );

  saveState();
  renderVideoTags();
}

/* =========================
   4부 렌더링 묶음
========================= */

function renderShotAndVideoPartFour() {
  drawAllCourts();
  renderShotSummary();
  renderZoneAnalysis();
  renderShotTrend();
  renderVideoTags();

  const heatmapButton = document.getElementById(
    "toggleHeatmapBtn"
  );

  if (heatmapButton) {
    heatmapButton.textContent = state.heatmap
      ? "히트맵 끄기"
      : "히트맵 켜기";
  }
}

/* =========================
   4부 실행
========================= */

function initializeAppPartFour() {
  bindShotChartButtons();
  bindVideoControls();
  bindVideoTagListEvents();

  renderShotAndVideoPartFour();
}

initializeAppPartFour();
/* =========================
   리포트 버튼 연결
========================= */

function bindReportButtons() {
  document
    .getElementById("generateGameReportBtn")
    ?.addEventListener("click", generateGameReport);

  document
    .getElementById("generatePlayerReportBtn")
    ?.addEventListener("click", generatePlayerReport);

  document
    .getElementById("generateTrainingBtn")
    ?.addEventListener("click", generateTrainingPlan);

  document
    .getElementById("printReportBtn")
    ?.addEventListener("click", () => {
      window.print();
    });
}

/* =========================
   공통 분석 계산
========================= */

function calculateFieldGoalPercentage(player) {
  if (!player || player.fga === 0) {
    return 0;
  }

  return Math.round(
    (player.fgm / player.fga) * 100
  );
}

function calculateTeamFieldGoalPercentage(teamStats) {
  if (!teamStats || teamStats.fga === 0) {
    return 0;
  }

  return Math.round(
    (teamStats.fgm / teamStats.fga) * 100
  );
}

function getWinningTeam() {
  const scoreA = getTeamScore("A");
  const scoreB = getTeamScore("B");

  if (scoreA === scoreB) {
    return null;
  }

  return scoreA > scoreB ? "A" : "B";
}

function getBestPlayer() {
  if (state.players.length === 0) {
    return null;
  }

  return [...state.players].sort((a, b) => {
    return (
      calculateMvpScore(b) -
      calculateMvpScore(a)
    );
  })[0];
}

function getPlayerShotData(playerId) {
  const shots = state.shots.filter(
    shot => shot.playerId === playerId
  );

  const made = shots.filter(
    shot => shot.made
  ).length;

  return {
    shots,
    made,
    attempts: shots.length,
    percentage:
      shots.length === 0
        ? 0
        : Math.round(
            (made / shots.length) * 100
          )
  };
}

function getPlayerVideoTagSummary(playerId) {
  const tags = state.videoTags.filter(
    tag => tag.playerId === playerId
  );

  const summary = {};

  tags.forEach(tag => {
    summary[tag.tag] =
      (summary[tag.tag] || 0) + 1;
  });

  return {
    tags,
    summary
  };
}

/* =========================
   경기 리포트
========================= */

function generateGameReport() {
  updatePlayerImpactScores();
  updatePeriodSummaryRecord();

  const teamA = getTeamStats("A");
  const teamB = getTeamStats("B");

  const scoreA = teamA.pts;
  const scoreB = teamB.pts;

  const fieldGoalA =
    calculateTeamFieldGoalPercentage(teamA);

  const fieldGoalB =
    calculateTeamFieldGoalPercentage(teamB);

  const winningTeam = getWinningTeam();
  const mvp = getBestPlayer();

  const output = document.getElementById(
    "gameReportOutput"
  );

  if (!output) {
    return;
  }

  const resultText = winningTeam
    ? `${escapeHtml(
        getTeamName(winningTeam)
      )} 승리`
    : "무승부";

  const scoreDifference = Math.abs(
    scoreA - scoreB
  );

  const gameFlowText = createGameFlowText(
    teamA,
    teamB,
    scoreDifference
  );

  const keyFactors = createGameKeyFactors(
    teamA,
    teamB
  );

  const periodReport = createPeriodReportHtml();

  output.innerHTML = `
    <div class="report-highlight">
      <strong>
        ${escapeHtml(state.gameTitle)}
      </strong>

      <p>
        ${escapeHtml(state.teamAName)}
        ${scoreA}
        :
        ${scoreB}
        ${escapeHtml(state.teamBName)}
      </p>

      <p>${resultText}</p>
    </div>

    <h4>경기 정보</h4>

    <p>
      경기 날짜:
      ${escapeHtml(state.gameDate || "미입력")}
    </p>

    <p>
      경기 장소:
      ${escapeHtml(state.gameLocation || "미입력")}
    </p>

    <p>
      경기 방식:
      ${escapeHtml(state.mode)}
    </p>

    <h4>경기 흐름</h4>

    <p>${gameFlowText}</p>

    <h4>팀 기록 비교</h4>

    <p>
      ${escapeHtml(state.teamAName)}:
      야투율 ${fieldGoalA}%,
      리바운드 ${teamA.reb}개,
      어시스트 ${teamA.ast}개,
      스틸 ${teamA.stl}개,
      턴오버 ${teamA.to}개예용.
    </p>

    <p>
      ${escapeHtml(state.teamBName)}:
      야투율 ${fieldGoalB}%,
      리바운드 ${teamB.reb}개,
      어시스트 ${teamB.ast}개,
      스틸 ${teamB.stl}개,
      턴오버 ${teamB.to}개예용.
    </p>

    <h4>승부의 핵심 요인</h4>

    <ul>
      ${keyFactors
        .map(
          factor =>
            `<li>${escapeHtml(factor)}</li>`
        )
        .join("")}
    </ul>

    ${periodReport}

    <h4>경기 MVP</h4>

    ${
      mvp
        ? `
          <div class="report-blue-box">
            <strong>
              #${mvp.number}
              ${escapeHtml(mvp.name)}
            </strong>

            <p>
              ${mvp.pts}득점,
              ${mvp.reb}리바운드,
              ${mvp.ast}어시스트,
              ${mvp.stl}스틸,
              ${mvp.blk}블록,
              +/- ${formatSignedNumber(
                mvp.plusMinus
              )}
            </p>

            <p>
              MVP 지수:
              ${calculateMvpScore(mvp).toFixed(1)}
            </p>
          </div>
        `
        : `
          <p>선수 기록이 없습니다.</p>
        `
    }
  `;

  document.getElementById(
    "aiCommentOutput"
  ).innerHTML = `
    <div class="report-highlight">
      ${escapeHtml(
        createGameAiComment(teamA, teamB)
      )}
    </div>
  `;
}

function createGameFlowText(
  teamA,
  teamB,
  scoreDifference
) {
  if (teamA.pts === 0 && teamB.pts === 0) {
    return "아직 득점 기록이 없어 경기 흐름을 분석하기 어려워용.";
  }

  if (scoreDifference <= 3) {
    return "경기 종료까지 작은 실수 하나가 결과를 바꿀 수 있었던 접전이었어용. 턴오버 관리와 마지막 공격 선택이 특히 중요했어용.";
  }

  if (scoreDifference <= 8) {
    return "한 팀이 조금씩 우위를 만들었지만 상대 팀도 충분히 추격할 수 있었던 경기였어용. 리바운드와 공격 효율에서 차이가 나타났어용.";
  }

  return "점수 차가 크게 벌어진 경기였으며 공격 효율, 수비 활동량 또는 턴오버 관리에서 뚜렷한 차이가 나타났어용.";
}

function createGameKeyFactors(teamA, teamB) {
  const factors = [];

  const fieldGoalA =
    calculateTeamFieldGoalPercentage(teamA);

  const fieldGoalB =
    calculateTeamFieldGoalPercentage(teamB);

  if (Math.abs(fieldGoalA - fieldGoalB) >= 8) {
    const betterTeam =
      fieldGoalA > fieldGoalB
        ? state.teamAName
        : state.teamBName;

    factors.push(
      `${betterTeam}의 야투 성공률이 더 높았어용.`
    );
  }

  if (Math.abs(teamA.reb - teamB.reb) >= 3) {
    const betterTeam =
      teamA.reb > teamB.reb
        ? state.teamAName
        : state.teamBName;

    factors.push(
      `${betterTeam}이 리바운드에서 우위를 보였어용.`
    );
  }

  if (Math.abs(teamA.ast - teamB.ast) >= 3) {
    const betterTeam =
      teamA.ast > teamB.ast
        ? state.teamAName
        : state.teamBName;

    factors.push(
      `${betterTeam}의 패스 전개와 동료 활용이 더 좋았어용.`
    );
  }

  if (Math.abs(teamA.to - teamB.to) >= 2) {
    const betterTeam =
      teamA.to < teamB.to
        ? state.teamAName
        : state.teamBName;

    factors.push(
      `${betterTeam}이 턴오버를 더 적게 기록하며 공격 기회를 지켰어용.`
    );
  }

  if (
    Math.abs(
      teamA.stl +
        teamA.blk -
        (teamB.stl + teamB.blk)
    ) >= 3
  ) {
    const betterTeam =
      teamA.stl + teamA.blk >
      teamB.stl + teamB.blk
        ? state.teamAName
        : state.teamBName;

    factors.push(
      `${betterTeam}의 스틸과 블록 등 수비 활동량이 높았어용.`
    );
  }

  if (factors.length === 0) {
    factors.push(
      "두 팀의 주요 기록 차이가 크지 않아 집중력과 세부 플레이가 승부에 영향을 줬어용."
    );
  }

  return factors;
}

function createPeriodReportHtml() {
  if (state.periodStats.length === 0) {
    return "";
  }

  return `
    <h4>구간별 결과</h4>

    <ul>
      ${state.periodStats
        .map(
          period => `
            <li>
              ${escapeHtml(period.period)}:
              ${escapeHtml(state.teamAName)}
              ${period.teamAScore}
              -
              ${period.teamBScore}
              ${escapeHtml(state.teamBName)}
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function createGameAiComment(teamA, teamB) {
  const totalTurnovers =
    teamA.to + teamB.to;

  const totalAssists =
    teamA.ast + teamB.ast;

  const totalDefense =
    teamA.stl +
    teamA.blk +
    teamB.stl +
    teamB.blk;

  if (totalTurnovers >= 10) {
    return "양 팀 모두 공격 기회는 많았지만 턴오버 관리가 경기의 가장 큰 과제였어용.";
  }

  if (totalAssists >= 12) {
    return "개인 공격보다 패스와 팀플레이가 돋보인 경기였어용.";
  }

  if (totalDefense >= 10) {
    return "스틸과 블록이 많이 나온 수비 중심의 경기였어용.";
  }

  if (
    Math.abs(teamA.pts - teamB.pts) <= 3
  ) {
    return "마지막까지 집중력을 유지한 팀이 승리에 가까웠던 접전이었어용.";
  }

  return "공격 효율과 리바운드 참여가 경기 결과를 결정한 경기였어용.";
}

/* =========================
   선수 리포트
========================= */

function generatePlayerReport() {
  updatePlayerImpactScores();

  const playerId =
    document.getElementById(
      "reportPlayerSelect"
    )?.value || "";

  const player = getPlayer(playerId);

  if (!player) {
    alert("리포트를 생성할 선수를 선택해주세용.");
    return;
  }

  const output = document.getElementById(
    "playerReportOutput"
  );

  if (!output) {
    return;
  }

  const fieldGoalPercentage =
    calculateFieldGoalPercentage(player);

  const shotData = getPlayerShotData(
    player.id
  );

  const videoData =
    getPlayerVideoTagSummary(player.id);

  const strengths =
    createPlayerStrengths(
      player,
      fieldGoalPercentage
    );

  const weaknesses =
    createPlayerWeaknesses(
      player,
      fieldGoalPercentage
    );

  output.innerHTML = `
    <div class="report-highlight">
      <strong>
        #${player.number}
        ${escapeHtml(player.name)}
      </strong>

      <p>
        ${escapeHtml(getTeamName(player.team))}
        · 출전 시간
        ${formatTime(player.courtSeconds)}
      </p>
    </div>

    <h4>기록 요약</h4>

    <p>
      ${player.pts}득점,
      ${player.reb}리바운드,
      ${player.ast}어시스트,
      ${player.stl}스틸,
      ${player.blk}블록,
      ${player.to}턴오버,
      ${player.pf}파울을 기록했어용.
    </p>

    <p>
      야투 ${player.fgm}/${player.fga},
      야투율 ${fieldGoalPercentage}%,
      플러스·마이너스
      ${formatSignedNumber(
        player.plusMinus
      )}예용.
    </p>

    <p>
      공격 기여도
      ${player.offenseScore.toFixed(1)},
      수비 기여도
      ${player.defenseScore.toFixed(1)}예용.
    </p>

    <h4>슛차트 기록</h4>

    <p>
      위치가 기록된 슛은
      ${shotData.made}/${shotData.attempts},
      성공률 ${shotData.percentage}%예용.
    </p>

    <h4>선수 강점</h4>

    <ul>
      ${strengths
        .map(
          strength =>
            `<li>${escapeHtml(strength)}</li>`
        )
        .join("")}
    </ul>

    <h4>보완할 부분</h4>

    <ul>
      ${weaknesses
        .map(
          weakness =>
            `<li>${escapeHtml(weakness)}</li>`
        )
        .join("")}
    </ul>

    <h4>영상 분석 기록</h4>

    ${
      videoData.tags.length > 0
        ? `
          <p>
            총 ${videoData.tags.length}개의 장면이 저장됐어용.
          </p>

          <ul>
            ${Object.entries(
              videoData.summary
            )
              .map(
                ([tag, count]) => `
                  <li>
                    ${escapeHtml(tag)}:
                    ${count}회
                  </li>
                `
              )
              .join("")}
          </ul>
        `
        : `
          <p>
            저장된 영상 분석 장면이 없습니다.
          </p>
        `
    }
  `;

  document.getElementById(
    "aiCommentOutput"
  ).innerHTML = `
    <div class="report-highlight">
      ${escapeHtml(
        createPlayerAiComment(
          player,
          fieldGoalPercentage
        )
      )}
    </div>
  `;
}

function createPlayerStrengths(
  player,
  fieldGoalPercentage
) {
  const strengths = [];

  if (player.pts >= 10) {
    strengths.push(
      "팀 공격을 이끄는 득점 생산력이 좋았어용."
    );
  }

  if (
    fieldGoalPercentage >= 50 &&
    player.fga >= 4
  ) {
    strengths.push(
      "높은 야투 성공률로 효율적인 공격을 보여줬어용."
    );
  }

  if (player.reb >= 5) {
    strengths.push(
      "적극적인 리바운드 참여가 돋보였어용."
    );
  }

  if (player.ast >= 4) {
    strengths.push(
      "동료의 득점 기회를 만드는 패스가 좋았어용."
    );
  }

  if (player.stl >= 2) {
    strengths.push(
      "적극적인 압박 수비와 패스 차단이 좋았어용."
    );
  }

  if (player.blk >= 2) {
    strengths.push(
      "골밑과 림 근처 수비에서 영향력이 있었어용."
    );
  }

  if (player.plusMinus >= 5) {
    strengths.push(
      "출전 시간 동안 팀의 득실에 긍정적인 영향을 줬어용."
    );
  }

  if (player.to <= 1 && player.ast >= 2) {
    strengths.push(
      "패스와 볼 관리가 안정적이었어용."
    );
  }

  if (strengths.length === 0) {
    strengths.push(
      "경기에 꾸준히 참여하며 기본 역할을 수행했어용."
    );
  }

  return strengths;
}

function createPlayerWeaknesses(
  player,
  fieldGoalPercentage
) {
  const weaknesses = [];

  if (
    fieldGoalPercentage < 40 &&
    player.fga >= 4
  ) {
    weaknesses.push(
      "슛 선택과 마무리 성공률을 높일 필요가 있어용."
    );
  }

  if (player.to >= 3) {
    weaknesses.push(
      "압박 상황에서 볼 보호와 판단 속도를 보완해야 해용."
    );
  }

  if (player.ast === 0) {
    weaknesses.push(
      "동료 위치를 확인하고 패스를 활용하는 플레이가 필요해용."
    );
  }

  if (player.reb <= 1) {
    weaknesses.push(
      "슛 이후 박스아웃과 리바운드 참여를 높이면 좋아용."
    );
  }

  if (
    player.stl === 0 &&
    player.blk === 0
  ) {
    weaknesses.push(
      "수비 스텝과 도움수비에서 더 적극적인 움직임이 필요해용."
    );
  }

  if (player.pf >= 4) {
    weaknesses.push(
      "불필요한 손 사용을 줄이고 수비 위치를 먼저 잡아야 해용."
    );
  }

  if (player.plusMinus <= -5) {
    weaknesses.push(
      "출전 구간에서 공격과 수비의 연결을 더 안정적으로 유지해야 해용."
    );
  }

  if (weaknesses.length === 0) {
    weaknesses.push(
      "큰 약점은 없었으며 현재 장점을 더 확실하게 발전시키면 좋아용."
    );
  }

  return weaknesses;
}

function createPlayerAiComment(
  player,
  fieldGoalPercentage
) {
  if (
    player.pts >= 10 &&
    player.to <= 2 &&
    fieldGoalPercentage >= 45
  ) {
    return "효율적인 득점과 안정적인 볼 관리가 돋보인 경기였어용.";
  }

  if (player.ast >= 5) {
    return "패스로 동료를 살리고 경기 흐름을 만든 플레이메이커였어용.";
  }

  if (
    player.stl + player.blk >= 4
  ) {
    return "수비 활동량과 집중력으로 팀에 큰 영향을 준 선수였어용.";
  }

  if (player.reb >= 6) {
    return "적극적인 리바운드 참여로 팀의 공격 기회를 늘린 선수였어용.";
  }

  if (
    fieldGoalPercentage < 35 &&
    player.fga >= 5
  ) {
    return "공격 적극성은 좋았지만 더 좋은 슛 선택과 마무리가 필요해용.";
  }

  if (player.to >= 4) {
    return "경기 운영에 적극적이었지만 압박 상황의 볼 관리가 아쉬웠어용.";
  }

  return "기본 역할을 수행했으며 자신의 대표 강점을 하나 더 확실하게 만들면 좋아용.";
}

/* =========================
   추천 훈련
========================= */

function generateTrainingPlan() {
  const playerId =
    document.getElementById(
      "reportPlayerSelect"
    )?.value || "";

  const player = getPlayer(playerId);

  const output = document.getElementById(
    "trainingPlanOutput"
  );

  if (!output) {
    return;
  }

  if (!player) {
    output.innerHTML =
      createTeamTrainingPlanHtml();

    return;
  }

  output.innerHTML =
    createPlayerTrainingPlanHtml(player);
}

function createPlayerTrainingPlanHtml(player) {
  const fieldGoalPercentage =
    calculateFieldGoalPercentage(player);

  const trainingList = [];

  if (
    fieldGoalPercentage < 40 &&
    player.fga >= 3
  ) {
    trainingList.push({
      title: "게임 스피드 슈팅",
      content:
        "양쪽 45도, 코너, 정면에서 패스를 받은 뒤 빠르게 슛하는 훈련을 진행해용. 각 구역에서 성공 개수를 기록해용."
    });
  }

  if (player.to >= 3) {
    trainingList.push({
      title: "압박 상황 볼 핸들링",
      content:
        "약한 손 드리블, 방향 전환, 수비 압박을 받으며 공을 지키는 훈련을 진행해용."
    });
  }

  if (player.ast <= 1) {
    trainingList.push({
      title: "패스 시야 훈련",
      content:
        "드리블 중 고개를 들고 코너와 컷인 선수를 확인하는 2대2 또는 3대3 패스 훈련을 진행해용."
    });
  }

  if (player.reb <= 1) {
    trainingList.push({
      title: "박스아웃·리바운드",
      content:
        "슛과 동시에 상대를 먼저 막고 공의 방향을 확인하는 박스아웃 훈련을 진행해용."
    });
  }

  if (
    player.stl === 0 &&
    player.blk === 0
  ) {
    trainingList.push({
      title: "수비 스텝·도움수비",
      content:
        "사이드 스텝, 클로즈아웃, 도움수비 후 복귀 동작을 반복해용."
    });
  }

  if (player.pf >= 4) {
    trainingList.push({
      title: "파울 없는 수비",
      content:
        "손보다 발을 먼저 움직이고 공격수의 진행 방향을 막는 수비 훈련을 진행해용."
    });
  }

  if (trainingList.length === 0) {
    trainingList.push({
      title: "약한 손 마무리",
      content:
        "약한 손 레이업, 플로터, 리버스 마무리를 양쪽에서 반복해용."
    });

    trainingList.push({
      title: "실전 체력",
      content:
        "짧은 전력 질주 후 바로 슛과 수비를 수행하는 실전형 체력 훈련을 진행해용."
    });
  }

  return `
    <div class="report-highlight">
      <strong>
        #${player.number}
        ${escapeHtml(player.name)}
        추천 훈련
      </strong>
    </div>

    ${trainingList
      .map(
        training => `
          <div class="training-card">
            <h4>
              ${escapeHtml(training.title)}
            </h4>

            <p>
              ${escapeHtml(training.content)}
            </p>
          </div>
        `
      )
      .join("")}
  `;
}

function createTeamTrainingPlanHtml() {
  const teamA = getTeamStats("A");
  const teamB = getTeamStats("B");

  const totalTurnovers =
    teamA.to + teamB.to;

  const totalAssists =
    teamA.ast + teamB.ast;

  const totalRebounds =
    teamA.reb + teamB.reb;

  const trainingList = [];

  if (totalTurnovers >= 8) {
    trainingList.push({
      title: "압박 탈출·볼 관리",
      content:
        "수비 압박을 받는 상황에서 안전한 패스 각도와 볼 보호를 연습해용."
    });
  }

  if (totalAssists <= 5) {
    trainingList.push({
      title: "엑스트라 패스",
      content:
        "좋은 슛보다 더 좋은 슛을 만들기 위해 한 번 더 패스하는 훈련을 진행해용."
    });
  }

  if (totalRebounds <= 8) {
    trainingList.push({
      title: "팀 박스아웃",
      content:
        "모든 선수가 자신의 상대를 확인하고 박스아웃한 뒤 리바운드에 참여해용."
    });
  }

  if (trainingList.length === 0) {
    trainingList.push({
      title: "전환 공격",
      content:
        "수비 리바운드 후 빠르게 코트를 넓게 사용하며 속공을 전개해용."
    });

    trainingList.push({
      title: "실전 슈팅",
      content:
        "패스, 컷인, 스크린 이후 실제 경기와 같은 속도로 슛을 시도해용."
    });
  }

  return `
    <div class="report-highlight">
      <strong>팀 추천 훈련</strong>
    </div>

    ${trainingList
      .map(
        training => `
          <div class="training-card">
            <h4>
              ${escapeHtml(training.title)}
            </h4>

            <p>
              ${escapeHtml(training.content)}
            </p>
          </div>
        `
      )
      .join("")}
  `;
}

/* =========================
   리포트 초기 표시
========================= */

function renderReportDefaults() {
  const gameOutput = document.getElementById(
    "gameReportOutput"
  );

  const playerOutput = document.getElementById(
    "playerReportOutput"
  );

  const aiOutput = document.getElementById(
    "aiCommentOutput"
  );

  const trainingOutput =
    document.getElementById(
      "trainingPlanOutput"
    );

  if (
    gameOutput &&
    gameOutput.innerHTML.trim() === ""
  ) {
    gameOutput.innerHTML = `
      <div class="empty-message">
        경기 리포트를 생성해주세용.
      </div>
    `;
  }

  if (
    playerOutput &&
    playerOutput.innerHTML.trim() === ""
  ) {
    playerOutput.innerHTML = `
      <div class="empty-message">
        선수 리포트를 생성해주세용.
      </div>
    `;
  }

  if (
    aiOutput &&
    aiOutput.innerHTML.trim() === ""
  ) {
    aiOutput.innerHTML = `
      <div class="empty-message">
        리포트를 생성하면 한줄평이 표시돼용.
      </div>
    `;
  }

  if (
    trainingOutput &&
    trainingOutput.innerHTML.trim() === ""
  ) {
    trainingOutput.innerHTML = `
      <div class="empty-message">
        추천 훈련을 생성해주세용.
      </div>
    `;
  }
}

/* =========================
   5부 실행
========================= */

function initializeAppPartFive() {
  bindReportButtons();
  renderReportDefaults();
}

initializeAppPartFive();
/* =========================
   저장 경기 관리
========================= */

function getSavedGames() {
  try {
    const saved = localStorage.getItem(SAVED_GAMES_KEY);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("저장 경기 목록 불러오기 실패:", error);
    return [];
  }
}

function setSavedGames(games) {
  try {
    localStorage.setItem(
      SAVED_GAMES_KEY,
      JSON.stringify(games)
    );
  } catch (error) {
    console.error("저장 경기 목록 저장 실패:", error);
  }
}

function createSavedGameData() {
  updatePeriodSummaryRecord();
  updatePlayerImpactScores();

  return {
    id: createId("saved-game"),
    savedAt: Date.now(),

    title: state.gameTitle,
    date: state.gameDate,
    competitionName: state.competitionName,
    location: state.gameLocation,

    mode: state.mode,

    teamAName: state.teamAName,
    teamBName: state.teamBName,

    teamAScore: getTeamScore("A"),
    teamBScore: getTeamScore("B"),

    gameEnded: state.gameEnded,
    state: deepClone(state)
  };
}

function bindGameSaveButtons() {
  document
    .getElementById("saveGameBtn")
    ?.addEventListener("click", saveCurrentGameToHistory);

  document
    .getElementById("loadGameDataBtn")
    ?.addEventListener("click", () => {
      closeSetupPanel();

      document
        .querySelector('[data-tab="leagueSection"]')
        ?.click();

      setTimeout(() => {
        document
          .getElementById("savedGameList")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
      }, 150);
    });
}

function saveCurrentGameToHistory() {
  const savedGames = getSavedGames();

  const savedGame = createSavedGameData();

  savedGames.unshift(savedGame);

  if (savedGames.length > 30) {
    savedGames.length = 30;
  }

  setSavedGames(savedGames);

  addGameResultToLeague(savedGame);
  addPlayersToSeason(savedGame);

  saveLeagueState();
  renderLeagueAll();

  alert("현재 경기를 저장했어용.");
}

function loadSavedGame(gameId) {
  const savedGames = getSavedGames();

  const savedGame = savedGames.find(
    game => game.id === gameId
  );

  if (!savedGame?.state) {
    alert("저장된 경기 데이터를 찾지 못했어용.");
    return;
  }

  const confirmed = confirm(
    "현재 경기 기록을 저장된 경기로 교체할까용?"
  );

  if (!confirmed) {
    return;
  }

  stopGameClock();

  state = {
    ...deepClone(defaultState),
    ...deepClone(savedGame.state)
  };

  normalizeStateArrays();
  initializePlayers();
  updateCurrentPeriodLabel();

  saveState();

  fillSetupInputs();
  renderSetupPlayerForms();
  renderAll();

  alert("저장된 경기를 불러왔어용.");
}

function deleteSavedGame(gameId) {
  const confirmed = confirm(
    "이 저장 경기를 삭제할까용?"
  );

  if (!confirmed) {
    return;
  }

  const savedGames = getSavedGames().filter(
    game => game.id !== gameId
  );

  setSavedGames(savedGames);
  renderSavedGameList();
}

function renderSavedGameList() {
  const container = document.getElementById(
    "savedGameList"
  );

  if (!container) {
    return;
  }

  const savedGames = getSavedGames();

  if (savedGames.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        저장된 경기가 없습니다.
      </div>
    `;

    return;
  }

  container.innerHTML = savedGames
    .map(game => {
      return `
        <div class="saved-game-row">
          <div>
            <strong>
              ${escapeHtml(game.title || "농구 경기")}
            </strong>

            <span>
              ${escapeHtml(game.teamAName)}
              ${game.teamAScore}
              :
              ${game.teamBScore}
              ${escapeHtml(game.teamBName)}
              · ${formatDateTime(game.savedAt)}
            </span>
          </div>

          <button
            type="button"
            data-load-saved-game="${game.id}"
          >
            불러오기
          </button>

          <button
            type="button"
            data-delete-saved-game="${game.id}"
          >
            삭제
          </button>
        </div>
      `;
    })
    .join("");
}

function bindSavedGameListEvents() {
  document.addEventListener("click", event => {
    const loadGameId =
      event.target.dataset.loadSavedGame;

    const deleteGameId =
      event.target.dataset.deleteSavedGame;

    if (loadGameId) {
      loadSavedGame(loadGameId);
    }

    if (deleteGameId) {
      deleteSavedGame(deleteGameId);
    }
  });
}

/* =========================
   리그 팀 관리
========================= */

function bindLeagueTeamControls() {
  document
    .getElementById("addLeagueTeamBtn")
    ?.addEventListener("click", addLeagueTeam);

  document
    .getElementById("resetLeagueBtn")
    ?.addEventListener("click", resetLeagueData);
}

function addLeagueTeam() {
  const input = document.getElementById(
    "leagueTeamNameInput"
  );

  const teamName = input?.value.trim() || "";

  if (!teamName) {
    alert("추가할 팀 이름을 입력해주세용.");
    return;
  }

  const alreadyExists = leagueState.teams.some(
    team =>
      team.name.toLowerCase() ===
      teamName.toLowerCase()
  );

  if (alreadyExists) {
    alert("이미 등록된 팀 이름이에용.");
    return;
  }

  leagueState.teams.push({
    id: createId("league-team"),
    name: teamName,

    games: 0,
    wins: 0,
    losses: 0,

    pointsFor: 0,
    pointsAgainst: 0
  });

  input.value = "";

  saveLeagueState();
  renderLeagueAll();
}

function deleteLeagueTeam(teamId) {
  const team = leagueState.teams.find(
    item => item.id === teamId
  );

  if (!team) {
    return;
  }

  const confirmed = confirm(
    `${team.name} 팀을 리그에서 삭제할까용?`
  );

  if (!confirmed) {
    return;
  }

  leagueState.teams = leagueState.teams.filter(
    item => item.id !== teamId
  );

  leagueState.schedule =
    leagueState.schedule.filter(
      game =>
        game.teamAId !== teamId &&
        game.teamBId !== teamId
    );

  leagueState.results =
    leagueState.results.filter(
      result =>
        result.teamAId !== teamId &&
        result.teamBId !== teamId
    );

  saveLeagueState();
  renderLeagueAll();
}

function resetLeagueData() {
  const confirmed = confirm(
    "리그 팀, 일정, 순위, 시즌 기록을 모두 초기화할까용?"
  );

  if (!confirmed) {
    return;
  }

  leagueState = {
    teams: [],
    schedule: [],
    results: [],
    seasonPlayers: []
  };

  localStorage.removeItem(LEAGUE_KEY);

  saveLeagueState();
  renderLeagueAll();
}

function renderLeagueTeamList() {
  const container = document.getElementById(
    "leagueTeamList"
  );

  if (!container) {
    return;
  }

  if (leagueState.teams.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        등록된 리그 팀이 없습니다.
      </div>
    `;

    return;
  }

  container.innerHTML = leagueState.teams
    .map(team => {
      return `
        <div class="league-team-row">
          <strong>
            ${escapeHtml(team.name)}
          </strong>

          <button
            type="button"
            data-delete-league-team="${team.id}"
          >
            삭제
          </button>
        </div>
      `;
    })
    .join("");
}

function bindLeagueTeamListEvents() {
  document.addEventListener("click", event => {
    const teamId =
      event.target.dataset.deleteLeagueTeam;

    if (teamId) {
      deleteLeagueTeam(teamId);
    }
  });
}

/* =========================
   리그 순위표
========================= */

function getSortedLeagueTeams() {
  return [...leagueState.teams].sort(
    (a, b) => {
      const winRateA =
        a.games === 0
          ? 0
          : a.wins / a.games;

      const winRateB =
        b.games === 0
          ? 0
          : b.wins / b.games;

      if (winRateB !== winRateA) {
        return winRateB - winRateA;
      }

      const diffA =
        a.pointsFor - a.pointsAgainst;

      const diffB =
        b.pointsFor - b.pointsAgainst;

      if (diffB !== diffA) {
        return diffB - diffA;
      }

      return b.pointsFor - a.pointsFor;
    }
  );
}

function renderLeagueStandings() {
  const tbody = document.getElementById(
    "leagueStandingsBody"
  );

  if (!tbody) {
    return;
  }

  const teams = getSortedLeagueTeams();

  if (teams.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">
          리그 결과가 없습니다.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = teams
    .map((team, index) => {
      const difference =
        team.pointsFor - team.pointsAgainst;

      const winRate =
        team.games === 0
          ? 0
          : Math.round(
              (team.wins / team.games) * 100
            );

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(team.name)}</td>
          <td>${team.games}</td>
          <td>${team.wins}</td>
          <td>${team.losses}</td>
          <td>${team.pointsFor}</td>
          <td>${team.pointsAgainst}</td>
          <td>${formatSignedNumber(difference)}</td>
          <td>${winRate}%</td>
        </tr>
      `;
    })
    .join("");
}

/* =========================
   경기 결과 리그 반영
========================= */

function getLeagueTeamByName(name) {
  return leagueState.teams.find(
    team =>
      team.name.trim().toLowerCase() ===
      String(name).trim().toLowerCase()
  );
}

function ensureLeagueTeamByName(name) {
  let team = getLeagueTeamByName(name);

  if (!team) {
    team = {
      id: createId("league-team"),
      name,

      games: 0,
      wins: 0,
      losses: 0,

      pointsFor: 0,
      pointsAgainst: 0
    };

    leagueState.teams.push(team);
  }

  return team;
}

function addGameResultToLeague(savedGame) {
  const existingResult =
    leagueState.results.find(
      result =>
        result.savedGameId === savedGame.id
    );

  if (existingResult) {
    return;
  }

  const teamA = ensureLeagueTeamByName(
    savedGame.teamAName
  );

  const teamB = ensureLeagueTeamByName(
    savedGame.teamBName
  );

  teamA.games += 1;
  teamB.games += 1;

  teamA.pointsFor += savedGame.teamAScore;
  teamA.pointsAgainst += savedGame.teamBScore;

  teamB.pointsFor += savedGame.teamBScore;
  teamB.pointsAgainst += savedGame.teamAScore;

  if (
    savedGame.teamAScore >
    savedGame.teamBScore
  ) {
    teamA.wins += 1;
    teamB.losses += 1;
  } else if (
    savedGame.teamBScore >
    savedGame.teamAScore
  ) {
    teamB.wins += 1;
    teamA.losses += 1;
  }

  leagueState.results.push({
    id: createId("league-result"),
    savedGameId: savedGame.id,

    teamAId: teamA.id,
    teamBId: teamB.id,

    teamAName: teamA.name,
    teamBName: teamB.name,

    teamAScore: savedGame.teamAScore,
    teamBScore: savedGame.teamBScore,

    playedAt:
      savedGame.date || savedGame.savedAt
  });
}

/* =========================
   대진표·일정
========================= */

function bindScheduleControls() {
  document
    .getElementById("addScheduleBtn")
    ?.addEventListener("click", addScheduleGame);
}

function renderScheduleTeamOptions() {
  const selectIds = [
    "scheduleTeamASelect",
    "scheduleTeamBSelect"
  ];

  selectIds.forEach(selectId => {
    const select = document.getElementById(
      selectId
    );

    if (!select) {
      return;
    }

    const previousValue = select.value;

    select.innerHTML = `
      <option value="">
        팀 선택
      </option>
    `;

    leagueState.teams.forEach(team => {
      const option =
        document.createElement("option");

      option.value = team.id;
      option.textContent = team.name;

      select.appendChild(option);
    });

    if (
      previousValue &&
      leagueState.teams.some(
        team => team.id === previousValue
      )
    ) {
      select.value = previousValue;
    }
  });
}

function addScheduleGame() {
  const teamAId =
    document.getElementById(
      "scheduleTeamASelect"
    )?.value || "";

  const teamBId =
    document.getElementById(
      "scheduleTeamBSelect"
    )?.value || "";

  const date =
    document.getElementById(
      "scheduleDateInput"
    )?.value || "";

  const time =
    document.getElementById(
      "scheduleTimeInput"
    )?.value || "";

  if (!teamAId || !teamBId) {
    alert("대진에 들어갈 두 팀을 선택해주세용.");
    return;
  }

  if (teamAId === teamBId) {
    alert("서로 다른 두 팀을 선택해주세용.");
    return;
  }

  const teamA = leagueState.teams.find(
    team => team.id === teamAId
  );

  const teamB = leagueState.teams.find(
    team => team.id === teamBId
  );

  if (!teamA || !teamB) {
    return;
  }

  leagueState.schedule.push({
    id: createId("schedule"),

    teamAId,
    teamBId,

    teamAName: teamA.name,
    teamBName: teamB.name,

    date,
    time,
    status: "예정"
  });

  saveLeagueState();
  renderScheduleList();
}

function deleteScheduleGame(scheduleId) {
  leagueState.schedule =
    leagueState.schedule.filter(
      game => game.id !== scheduleId
    );

  saveLeagueState();
  renderScheduleList();
}

function renderScheduleList() {
  const container = document.getElementById(
    "scheduleList"
  );

  if (!container) {
    return;
  }

  if (leagueState.schedule.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        등록된 경기 일정이 없습니다.
      </div>
    `;

    return;
  }

  const schedule = [...leagueState.schedule].sort(
    (a, b) => {
      const aText = `${a.date || "9999"} ${
        a.time || "23:59"
      }`;

      const bText = `${b.date || "9999"} ${
        b.time || "23:59"
      }`;

      return aText.localeCompare(bText);
    }
  );

  container.innerHTML = schedule
    .map(game => {
      return `
        <div class="schedule-row">
          <time>
            ${escapeHtml(game.date || "날짜 미정")}
            ${escapeHtml(game.time || "")}
          </time>

          <strong>
            ${escapeHtml(game.teamAName)}
            VS
            ${escapeHtml(game.teamBName)}
          </strong>

          <span>
            ${escapeHtml(game.status)}
          </span>

          <button
            type="button"
            data-delete-schedule="${game.id}"
          >
            삭제
          </button>
        </div>
      `;
    })
    .join("");
}

function bindScheduleListEvents() {
  document.addEventListener("click", event => {
    const scheduleId =
      event.target.dataset.deleteSchedule;

    if (scheduleId) {
      deleteScheduleGame(scheduleId);
    }
  });
}

/* =========================
   시즌 선수 기록
========================= */

function getSeasonPlayerKey(player, savedGame) {
  return [
    player.name.trim().toLowerCase(),
    getTeamNameFromSavedGame(
      player.team,
      savedGame
    )
      .trim()
      .toLowerCase()
  ].join("|");
}

function getTeamNameFromSavedGame(
  team,
  savedGame
) {
  return team === "A"
    ? savedGame.teamAName
    : savedGame.teamBName;
}

function addPlayersToSeason(savedGame) {
  const players =
    savedGame.state?.players || [];

  players.forEach(player => {
    const key = getSeasonPlayerKey(
      player,
      savedGame
    );

    let seasonPlayer =
      leagueState.seasonPlayers.find(
        item => item.key === key
      );

    if (!seasonPlayer) {
      seasonPlayer = {
        id: createId("season-player"),
        key,

        name: player.name,
        number: player.number,

        teamName:
          getTeamNameFromSavedGame(
            player.team,
            savedGame
          ),

        games: 0,

        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        to: 0,

        mvpScore: 0
      };

      leagueState.seasonPlayers.push(
        seasonPlayer
      );
    }

    seasonPlayer.games += 1;

    seasonPlayer.pts += player.pts || 0;
    seasonPlayer.reb += player.reb || 0;
    seasonPlayer.ast += player.ast || 0;
    seasonPlayer.stl += player.stl || 0;
    seasonPlayer.blk += player.blk || 0;
    seasonPlayer.to += player.to || 0;

    seasonPlayer.mvpScore +=
      calculateMvpScore(player);
  });
}

function getSeasonLeader(key) {
  if (
    leagueState.seasonPlayers.length === 0
  ) {
    return null;
  }

  return [...leagueState.seasonPlayers].sort(
    (a, b) => (b[key] || 0) - (a[key] || 0)
  )[0];
}

function renderSeasonLeaders() {
  const pointsLeader =
    getSeasonLeader("pts");

  const reboundLeader =
    getSeasonLeader("reb");

  const assistLeader =
    getSeasonLeader("ast");

  const defenseLeader =
    [...leagueState.seasonPlayers].sort(
      (a, b) =>
        b.stl +
          b.blk -
        (a.stl + a.blk)
    )[0] || null;

  const mvpLeader =
    getSeasonLeader("mvpScore");

  setSeasonLeaderText(
    "seasonPointsLeader",
    pointsLeader,
    "pts",
    "점"
  );

  setSeasonLeaderText(
    "seasonReboundLeader",
    reboundLeader,
    "reb",
    "개"
  );

  setSeasonLeaderText(
    "seasonAssistLeader",
    assistLeader,
    "ast",
    "개"
  );

  if (defenseLeader) {
    document.getElementById(
      "seasonDefenseLeader"
    ).textContent =
      `${defenseLeader.name} · ${
        defenseLeader.stl +
        defenseLeader.blk
      }개`;
  } else {
    document.getElementById(
      "seasonDefenseLeader"
    ).textContent = "기록 없음";
  }

  if (mvpLeader) {
    document.getElementById(
      "seasonMvpLeader"
    ).textContent =
      `${mvpLeader.name} · ${mvpLeader.mvpScore.toFixed(
        1
      )}`;
  } else {
    document.getElementById(
      "seasonMvpLeader"
    ).textContent = "기록 없음";
  }
}

function setSeasonLeaderText(
  elementId,
  player,
  key,
  suffix
) {
  const element = document.getElementById(
    elementId
  );

  if (!element) {
    return;
  }

  if (!player) {
    element.textContent = "기록 없음";
    return;
  }

  element.textContent =
    `${player.name} · ${player[key]}${suffix}`;
}

/* =========================
   CSV 내보내기
========================= */

function bindCsvExport() {
  document
    .getElementById("exportCsvBtn")
    ?.addEventListener("click", exportCurrentGameCsv);
}

function escapeCsvValue(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function exportCurrentGameCsv() {
  updatePlayerImpactScores();

  const rows = [
    [
      "팀",
      "등번호",
      "선수",
      "출전시간",
      "득점",
      "리바운드",
      "어시스트",
      "스틸",
      "블록",
      "턴오버",
      "파울",
      "야투성공",
      "야투시도",
      "야투율",
      "플러스마이너스",
      "공격기여도",
      "수비기여도"
    ]
  ];

  state.players.forEach(player => {
    const fieldGoalPercentage =
      calculateFieldGoalPercentage(player);

    rows.push([
      getTeamName(player.team),
      player.number,
      player.name,
      formatTime(player.courtSeconds),
      player.pts,
      player.reb,
      player.ast,
      player.stl,
      player.blk,
      player.to,
      player.pf,
      player.fgm,
      player.fga,
      `${fieldGoalPercentage}%`,
      player.plusMinus,
      player.offenseScore.toFixed(1),
      player.defenseScore.toFixed(1)
    ]);
  });

  const csvContent =
    "\uFEFF" +
    rows
      .map(row =>
        row.map(escapeCsvValue).join(",")
      )
      .join("\n");

  downloadTextFile(
    `${sanitizeFileName(
      state.gameTitle
    )}_기록.csv`,
    csvContent,
    "text/csv;charset=utf-8"
  );
}

/* =========================
   JSON 내보내기·불러오기
========================= */

function bindJsonControls() {
  document
    .getElementById("exportJsonBtn")
    ?.addEventListener("click", exportAllJson);

  document
    .getElementById("importJsonInput")
    ?.addEventListener("change", importJsonFile);
}

function exportAllJson() {
  const exportData = {
    exportedAt: Date.now(),
    version: 1,

    currentGame: state,
    savedGames: getSavedGames(),
    league: leagueState
  };

  const json = JSON.stringify(
    exportData,
    null,
    2
  );

  downloadTextFile(
    `courtvision_backup_${Date.now()}.json`,
    json,
    "application/json;charset=utf-8"
  );
}

function importJsonFile(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(
        String(reader.result)
      );

      const confirmed = confirm(
        "JSON 데이터를 불러오면 현재 데이터가 교체될 수 있어용. 계속할까용?"
      );

      if (!confirmed) {
        event.target.value = "";
        return;
      }

      if (parsed.currentGame) {
        state = {
          ...deepClone(defaultState),
          ...parsed.currentGame
        };

        normalizeStateArrays();
        initializePlayers();
        updateCurrentPeriodLabel();

        saveState();
      }

      if (Array.isArray(parsed.savedGames)) {
        setSavedGames(parsed.savedGames);
      }

      if (parsed.league) {
        leagueState = {
          teams: [],
          schedule: [],
          results: [],
          seasonPlayers: [],
          ...parsed.league
        };

        saveLeagueState();
      }

      fillSetupInputs();
      renderSetupPlayerForms();
      renderAll();

      alert("JSON 데이터를 불러왔어용.");
    } catch (error) {
      console.error(error);
      alert("JSON 파일을 읽지 못했어용.");
    } finally {
      event.target.value = "";
    }
  };

  reader.onerror = () => {
    alert("파일을 읽는 중 오류가 발생했어용.");
    event.target.value = "";
  };

  reader.readAsText(file);
}

function sanitizeFileName(name) {
  return String(name || "courtvision")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
}

function downloadTextFile(
  fileName,
  content,
  mimeType
) {
  const blob = new Blob(
    [content],
    {
      type: mimeType
    }
  );

  const url = URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/* =========================
   리그 전체 렌더링
========================= */

function renderLeagueAll() {
  renderLeagueTeamList();
  renderLeagueStandings();
  renderScheduleTeamOptions();
  renderScheduleList();
  renderSeasonLeaders();
  renderSavedGameList();
}

/* =========================
   전체 렌더링
========================= */

function renderAll() {
  updateCurrentPeriodLabel();
  updatePlayerImpactScores();

  updateModeButtons();

  renderLivePartTwo();
  renderRecordAndAnalysisPartThree();
  renderShotAndVideoPartFour();

  renderLeagueAll();

  saveState();
}

/* =========================
   페이지 종료 전 저장
========================= */

function bindAutoSave() {
  window.addEventListener(
    "beforeunload",
    () => {
      saveState();
      saveLeagueState();
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        saveState();
        saveLeagueState();
      }
    }
  );
}

/* =========================
   6부 이벤트 연결
========================= */

function initializeAppPartSix() {
  bindGameSaveButtons();
  bindSavedGameListEvents();

  bindLeagueTeamControls();
  bindLeagueTeamListEvents();

  bindScheduleControls();
  bindScheduleListEvents();

  bindCsvExport();
  bindJsonControls();

  bindAutoSave();

  renderAll();
}

initializeAppPartSix();