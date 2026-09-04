/* =========================================================
   COURTVISION PRO
   Basketball Analytics Engine
   v4.0
   ---------------------------------------------------------
   - 3v3 / 5v5 완전 분리
   - 경기 시작 전에도 기록 가능
   - 실시간 득점 자동 반영
   - 최근 기록 / 삭제 / Undo
   - 실제 슛 좌표 기반 Shot Chart
   - 실제 좌표 기반 Heatmap
   - Pass Network
   - 경기 저장 / 불러오기
   - Video Analysis 구조
   - AI Analysis 연결 구조
   - Game / Team / Player Report
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const STORAGE_KEY = "COURTVISION_PRO_V4_20260904";

  const MODE_CONFIG = {
    "3v3": {
      label: "3대3",
      rosterSize: 3,
      periods: 1,
      periodMinutes: 10,
      shotClock: 12
    },
    "5v5": {
      label: "5대5",
      rosterSize: 5,
      periods: 4,
      periodMinutes: 10,
      shotClock: 24
    }
  };

  const EVENT_LABELS = {
    ft_made: "자유투 성공",
    ft_miss: "자유투 실패",

    fg2_made: "2점 성공",
    fg2_miss: "2점 실패",

    fg3_made: "3점 성공",
    fg3_miss: "3점 실패",

    reb: "리바운드",
    orb: "공격 리바운드",
    drb: "수비 리바운드",

    ast: "어시스트",
    stl: "스틸",
    blk: "블록",
    tov: "턴오버",
    pf: "파울",

    pass: "패스"
  };

  /* =========================================================
     STATE
     ========================================================= */

  let state = createInitialState();

  let clockTimer = null;
  let shotClockTimer = null;

  let pendingShot = null;
  let pendingPass = null;

  let videoObjectUrl = null;

  /* =========================================================
     DOM
     ========================================================= */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const pageContainer = $("#pageContainer");

  /* =========================================================
     INITIAL STATE
     ========================================================= */

  function createInitialState() {
    return {
      version: 4,

      mode: "3v3",

      page: "live",

      setupComplete: false,

      game: {
        name: "새 경기",
        tournament: "",
        venue: "",
        date: new Date().toISOString().slice(0, 10),

        home: {
          name: "HOME",
          score: 0
        },

        away: {
          name: "AWAY",
          score: 0
        },

        period: 1,

        clock: MODE_CONFIG["3v3"].periodMinutes * 60,

        shotClock: MODE_CONFIG["3v3"].shotClock,

        running: false,

        shotClockRunning: false,

        ended: false
      },

      players: [],

      events: [],

      shots: [],

      passes: [],

      history: [],

      savedGames: [],

      selectedPlayerId: null,

      selectedTeam: "home",

      selectedShotType: "2PT",

      filters: {
        team: "all",
        player: "all"
      },

      video: {
        name: "",
        url: "",
        duration: 0,
        markers: []
      },

      ai: {
        status: "not-connected",
        confidence: 0,
        results: []
      }
    };
  }

  /* =========================================================
     PLAYER
     ========================================================= */

  function createPlayer({
    id,
    team,
    number,
    name
  }) {
    return {
      id,
      team,
      number,
      name,

      stats: {
        pts: 0,

        fgm: 0,
        fga: 0,

        fg2m: 0,
        fg2a: 0,

        fg3m: 0,
        fg3a: 0,

        ftm: 0,
        fta: 0,

        reb: 0,
        orb: 0,
        drb: 0,

        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        pf: 0
      }
    };
  }

  function getPlayer(id) {
    return state.players.find(p => p.id === id);
  }

  function getPlayers(team) {
    return state.players.filter(p => p.team === team);
  }

  function getSelectedPlayer() {
    return getPlayer(state.selectedPlayerId);
  }

  /* =========================================================
     TEAM
     ========================================================= */

  function getTeamName(team) {
    return state.game[team]?.name || team;
  }

  function getTeamScore(team) {
    return state.game[team]?.score || 0;
  }

  function getTeamStats(team) {
    const players = getPlayers(team);

    const result = {
      pts: 0,
      fgm: 0,
      fga: 0,
      fg2m: 0,
      fg2a: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      reb: 0,
      orb: 0,
      drb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pf: 0
    };

    players.forEach(player => {
      Object.keys(result).forEach(key => {
        result[key] += Number(player.stats[key] || 0);
      });
    });

    return result;
  }

  /* =========================================================
     SNAPSHOT / HISTORY
     ========================================================= */

  function snapshot() {
    return JSON.parse(
      JSON.stringify({
        game: state.game,
        players: state.players,
        events: state.events,
        shots: state.shots,
        passes: state.passes
      })
    );
  }

  function pushHistory() {
    state.history.push(snapshot());

    if (state.history.length > 100) {
      state.history.shift();
    }
  }

  function restoreSnapshot(snap) {
    if (!snap) return;

    state.game = snap.game;
    state.players = snap.players;
    state.events = snap.events;
    state.shots = snap.shots;
    state.passes = snap.passes;

    render();
  }

  function undoLast() {
    if (!state.history.length) {
      toast("취소할 기록이 없습니다.", "info");
      return;
    }

    const previous = state.history.pop();

    restoreSnapshot(previous);

    toast("마지막 기록을 취소했습니다.", "success");
  }

  /* =========================================================
     ID
     ========================================================= */

  function uid(prefix = "id") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  /* =========================================================
     SETUP
     ========================================================= */

  function openSetup() {
    const overlay = $("#setupOverlay");

    if (!overlay) return;

    const config = MODE_CONFIG[state.mode];

    $("#setupModeText").textContent = config.label;

    $("#setupGameName").value =
      state.game.name === "새 경기"
        ? ""
        : state.game.name;

    $("#setupTournament").value =
      state.game.tournament || "";

    $("#homeTeamName").value =
      state.game.home.name || "HOME";

    $("#awayTeamName").value =
      state.game.away.name || "AWAY";

    renderRosterInputs("home");
    renderRosterInputs("away");

    overlay.classList.add("show");
  }

  function closeSetup() {
    $("#setupOverlay")?.classList.remove("show");
  }

  function renderRosterInputs(team) {
    const container =
      team === "home"
        ? $("#homeRoster")
        : $("#awayRoster");

    if (!container) return;

    const count =
      MODE_CONFIG[state.mode].rosterSize;

    const existing = getPlayers(team);

    container.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const player = existing[i];

      const row = document.createElement("div");

      row.className = "roster-input-row";

      row.innerHTML = `
        <input
          class="roster-number"
          type="number"
          min="0"
          max="99"
          placeholder="#"
          value="${player?.number ?? i + 1}"
          data-team="${team}"
          data-index="${i}"
        />

        <input
          class="roster-name"
          type="text"
          placeholder="선수 이름"
          value="${escapeHtml(player?.name || "")}"
          data-team="${team}"
          data-index="${i}"
        />
      `;

      container.appendChild(row);
    }
  }

  function saveSetup() {
    const gameName =
      ($("#setupGameName")?.value || "").trim();

    const tournament =
      ($("#setupTournament")?.value || "").trim();

    const homeName =
      ($("#homeTeamName")?.value || "").trim();

    const awayName =
      ($("#awayTeamName")?.value || "").trim();

    if (!homeName || !awayName) {
      toast("팀 이름을 입력해주세요.", "error");
      return;
    }

    const config = MODE_CONFIG[state.mode];

    const players = [];

    ["home", "away"].forEach(team => {
      const numbers = $$(
        `.roster-number[data-team="${team}"]`,
        $("#setupOverlay")
      );

      const names = $$(
        `.roster-name[data-team="${team}"]`,
        $("#setupOverlay")
      );

      for (let i = 0; i < config.rosterSize; i++) {
        const number =
          numbers[i]?.value?.trim() ||
          String(i + 1);

        const name =
          names[i]?.value?.trim() ||
          `${team === "home" ? "HOME" : "AWAY"} ${i + 1}`;

        const oldPlayer =
          state.players.find(
            p =>
              p.team === team &&
              String(p.number) === String(number) &&
              p.name === name
          );

        players.push(
          oldPlayer ||
          createPlayer({
            id: uid("player"),
            team,
            number,
            name
          })
        );
      }
    });

    state.game.name =
      gameName || "새 경기";

    state.game.tournament =
      tournament;

    state.game.home.name =
      homeName;

    state.game.away.name =
      awayName;

    state.players = players;

    state.setupComplete = true;

    state.selectedPlayerId =
      state.players[0]?.id || null;

    state.selectedTeam = "home";

    resetGameClockOnly();

    closeSetup();

    render();

    toast("선수 등록 및 경기 설정이 저장되었습니다.", "success");
  }

  /* =========================================================
     RESET
     ========================================================= */

  function resetGameClockOnly() {
    const config = MODE_CONFIG[state.mode];

    state.game.period = 1;

    state.game.clock =
      config.periodMinutes * 60;

    state.game.shotClock =
      config.shotClock;

    state.game.running = false;

    state.game.shotClockRunning = false;

    stopClock();
  }

  function resetEntireGame() {
    if (
      state.events.length &&
      !confirm("현재 경기 기록을 모두 초기화할까요?")
    ) {
      return;
    }

    const mode = state.mode;

    state = createInitialState();

    state.mode = mode;

    render();

    toast("경기가 초기화되었습니다.", "success");
  }

  /* =========================================================
     RECORD EVENT
     ========================================================= */

  function recordEvent({
    type,
    playerId,
    team,
    points = 0,
    value = null,
    description = ""
  }) {
    const player = getPlayer(playerId);

    if (!player) {
      toast("먼저 선수를 선택해주세요.", "error");
      return null;
    }

    pushHistory();

    const event = {
      id: uid("event"),

      type,

      playerId,

      team,

      points,

      value,

      description,

      period: state.game.period,

      clock: state.game.clock,

      timestamp: Date.now()
    };

    state.events.push(event);

    applyEventToStats(event);

    render();

    return event;
  }

  function applyEventToStats(event) {
    const player = getPlayer(event.playerId);

    if (!player) return;

    const s = player.stats;

    switch (event.type) {
      case "ft_made":
        s.ftm++;
        s.fta++;
        s.pts += 1;

        state.game[event.team].score += 1;
        break;

      case "ft_miss":
        s.fta++;
        break;

      case "fg2_made":
        s.fgm++;
        s.fga++;
        s.fg2m++;
        s.fg2a++;
        s.pts += 2;

        state.game[event.team].score +=
          state.mode === "3v3" ? 1 : 2;
        break;

      case "fg2_miss":
        s.fga++;
        s.fg2a++;
        break;

      case "fg3_made":
        s.fgm++;
        s.fga++;
        s.fg3m++;
        s.fg3a++;

        s.pts +=
          state.mode === "3v3" ? 2 : 3;

        state.game[event.team].score +=
          state.mode === "3v3" ? 2 : 3;
        break;

      case "fg3_miss":
        s.fga++;
        s.fg3a++;
        break;

      case "reb":
        s.reb++;
        break;

      case "orb":
        s.reb++;
        s.orb++;
        break;

      case "drb":
        s.reb++;
        s.drb++;
        break;

      case "ast":
        s.ast++;
        break;

      case "stl":
        s.stl++;
        break;

      case "blk":
        s.blk++;
        break;

      case "tov":
        s.tov++;
        break;

      case "pf":
        s.pf++;
        break;
    }
  }

  /* =========================================================
     QUICK ACTION
     ========================================================= */

  function quickAction(type) {
    const player = getSelectedPlayer();

    if (!player) {
      toast("선수를 먼저 선택해주세요.", "error");
      return;
    }

    recordEvent({
      type,
      playerId: player.id,
      team: player.team
    });
  }

  /* =========================================================
     SHOT RECORD
     ========================================================= */

  function startShot(type) {
    const player = getSelectedPlayer();

    if (!player) {
      toast("슛을 기록할 선수를 먼저 선택해주세요.", "error");
      return;
    }

    pendingShot = {
      playerId: player.id,
      team: player.team,
      type
    };

    openShotModal();
  }

  function openShotModal() {
    const overlay = $("#shotOverlay");

    if (!overlay) return;

    overlay.classList.add("show");

    const hint = $("#shotHint");

    if (hint) {
      hint.textContent =
        "코트에서 실제 슛 위치를 클릭하세요.";
    }

    $$(".shot-result-btn").forEach(btn => {
      btn.classList.remove("active");
    });
  }

  function closeShotModal() {
    $("#shotOverlay")?.classList.remove("show");

    pendingShot = null;
  }

  function selectShotResult(result) {
    if (!pendingShot) return;

    const type = pendingShot.type;

    const made =
      result === "made";

    let eventType = "";

    if (type === "FT") {
      eventType =
        made ? "ft_made" : "ft_miss";
    }

    if (type === "2PT") {
      eventType =
        made ? "fg2_made" : "fg2_miss";
    }

    if (type === "3PT") {
      eventType =
        made ? "fg3_made" : "fg3_miss";
    }

    const event = recordEvent({
      type: eventType,
      playerId: pendingShot.playerId,
      team: pendingShot.team,
      points: made
        ? getShotPoints(type)
        : 0
    });

    if (!event) return;

    pendingShot.eventId = event.id;

    $("#shotHint").textContent =
      "이제 실제 슛 위치를 클릭하세요.";

    $$(".shot-result-btn").forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.shotResult === result
      );
    });

    pendingShot.result = result;
  }

  function getShotPoints(type) {
    if (type === "FT") return 1;

    if (type === "2PT") {
      return state.mode === "3v3" ? 1 : 2;
    }

    if (type === "3PT") {
      return state.mode === "3v3" ? 2 : 3;
    }

    return 0;
  }

  function registerShotCoordinate(x, y) {
    if (!pendingShot || !pendingShot.result) {
      toast("성공/실패를 먼저 선택해주세요.", "info");
      return;
    }

    const zone = classifyShotZone(x, y);

    const shot = {
      id: uid("shot"),

      eventId: pendingShot.eventId,

      playerId: pendingShot.playerId,

      team: pendingShot.team,

      type: pendingShot.type,

      made: pendingShot.result === "made",

      points:
        pendingShot.result === "made"
          ? getShotPoints(pendingShot.type)
          : 0,

      x,

      y,

      zone,

      period: state.game.period,

      clock: state.game.clock,

      timestamp: Date.now()
    };

    pushHistory();

    state.shots.push(shot);

    closeShotModal();

    render();

    toast("실제 슛 위치가 기록되었습니다.", "success");
  }

  /* =========================================================
     SHOT ZONE
     ========================================================= */

  function classifyShotZone(x, y) {
    /*
      Court coordinate:
      x = 0 ~ 1
      y = 0 ~ 1

      코트는 가로형으로 표현.
    */

    const dx = x - 0.5;

    const distanceFromCenter =
      Math.sqrt(
        Math.pow(dx, 2) +
        Math.pow((y - 0.5) * 0.55, 2)
      );

    if (distanceFromCenter < 0.09) {
      return "Restricted Area";
    }

    if (
      Math.abs(dx) < 0.18 &&
      y > 0.32 &&
      y < 0.68
    ) {
      return "Paint";
    }

    if (
      Math.abs(dx) < 0.28 &&
      y > 0.25 &&
      y < 0.75
    ) {
      return "Mid-Range";
    }

    if (distanceFromCenter < 0.36) {
      return "Mid-Range";
    }

    if (y < 0.22 || y > 0.78) {
      return "Corner 3";
    }

    return "Above Break 3";
  }

  /* =========================================================
     PASS NETWORK
     ========================================================= */

  function startPass() {
    const player = getSelectedPlayer();

    if (!player) {
      toast("패스하는 선수를 먼저 선택해주세요.", "error");
      return;
    }

    pendingPass = {
      fromPlayerId: player.id,
      team: player.team
    };

    openPassModal();
  }

  function openPassModal() {
    const overlay = $("#passOverlay");

    if (!overlay) return;

    const list = $("#passTargetList");

    list.innerHTML = "";

    const teammates =
      getPlayers(pendingPass.team)
        .filter(p =>
          p.id !== pendingPass.fromPlayerId
        );

    if (!teammates.length) {
      list.innerHTML =
        `<div class="empty-state">패스 대상 선수가 없습니다.</div>`;
    }

    teammates.forEach(player => {
      const button =
        document.createElement("button");

      button.className = "pass-target";

      button.dataset.playerId = player.id;

      button.innerHTML = `
        <span class="player-number">#${escapeHtml(player.number)}</span>
        <span class="player-name">${escapeHtml(player.name)}</span>
      `;

      list.appendChild(button);
    });

    overlay.classList.add("show");
  }

  function closePassModal() {
    $("#passOverlay")?.classList.remove("show");

    pendingPass = null;
  }

  function registerPass(targetPlayerId) {
    if (!pendingPass) return;

    const from = getPlayer(
      pendingPass.fromPlayerId
    );

    const to = getPlayer(targetPlayerId);

    if (!from || !to) return;

    pushHistory();

    const pass = {
      id: uid("pass"),

      fromPlayerId: from.id,

      toPlayerId: to.id,

      team: from.team,

      period: state.game.period,

      clock: state.game.clock,

      timestamp: Date.now()
    };

    state.passes.push(pass);

    state.events.push({
      id: uid("event"),

      type: "pass",

      playerId: from.id,

      team: from.team,

      targetPlayerId: to.id,

      period: state.game.period,

      clock: state.game.clock,

      timestamp: Date.now()
    });

    closePassModal();

    render();

    toast(
      `${from.name} → ${to.name} 패스 기록`,
      "success"
    );
  }

  /* =========================================================
     CLOCK
     ========================================================= */

  function toggleClock() {
    if (state.game.running) {
      stopClock();
    } else {
      startClock();
    }

    renderClockOnly();
  }

  function startClock() {
    if (state.game.ended) return;

    state.game.running = true;

    clearInterval(clockTimer);

    clockTimer = setInterval(() => {
      if (!state.game.running) return;

      if (state.game.clock <= 0) {
        nextPeriod();
        return;
      }

      state.game.clock--;

      renderClockOnly();
    }, 1000);
  }

  function stopClock() {
    state.game.running = false;

    clearInterval(clockTimer);

    clockTimer = null;
  }

  function resetShotClock() {
    state.game.shotClock =
      MODE_CONFIG[state.mode].shotClock;

    renderClockOnly();
  }

  function toggleShotClock() {
    if (state.game.shotClockRunning) {
      stopShotClock();
    } else {
      startShotClock();
    }

    renderClockOnly();
  }

  function startShotClock() {
    state.game.shotClockRunning = true;

    clearInterval(shotClockTimer);

    shotClockTimer = setInterval(() => {
      if (!state.game.shotClockRunning) return;

      if (state.game.shotClock <= 0) {
        stopShotClock();
        return;
      }

      state.game.shotClock--;

      renderClockOnly();
    }, 1000);
  }

  function stopShotClock() {
    state.game.shotClockRunning = false;

    clearInterval(shotClockTimer);

    shotClockTimer = null;
  }

  function nextPeriod() {
    const config = MODE_CONFIG[state.mode];

    stopClock();

    if (
      state.game.period >= config.periods
    ) {
      state.game.ended = true;

      toast("경기가 종료되었습니다.", "success");

      render();
      return;
    }

    state.game.period++;

    state.game.clock =
      config.periodMinutes * 60;

    state.game.shotClock =
      config.shotClock;

    render();

    toast(
      `${state.game.period}쿼터 시작 준비`,
      "info"
    );
  }

  function formatTime(seconds) {
    const s =
      Math.max(0, Math.floor(seconds));

    const min =
      Math.floor(s / 60);

    const sec =
      s % 60;

    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  /* =========================================================
     DELETE EVENT
     ========================================================= */

  function deleteEvent(eventId) {
    const event =
      state.events.find(
        e => e.id === eventId
      );

    if (!event) return;

    pushHistory();

    /*
      해당 이벤트를 제외한 상태를
      다시 계산하는 방식으로 정확하게 복구.
    */

    state.events =
      state.events.filter(
        e => e.id !== eventId
      );

    state.shots =
      state.shots.filter(
        s => s.eventId !== eventId
      );

    rebuildStats();

    render();

    toast("기록을 삭제했습니다.", "success");
  }

  function rebuildStats() {
    state.players.forEach(player => {
      player.stats = {
        pts: 0,
        fgm: 0,
        fga: 0,
        fg2m: 0,
        fg2a: 0,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        reb: 0,
        orb: 0,
        drb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        pf: 0
      };
    });

    state.game.home.score = 0;
    state.game.away.score = 0;

    state.events.forEach(event => {
      applyEventToStats(event);
    });
  }

  /* =========================================================
     SAVE / LOAD
     ========================================================= */

  function saveGame() {
    const data = {
      ...JSON.parse(JSON.stringify(state)),
      savedAt: Date.now()
    };

    const saved =
      JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

    const id = uid("game");

    data.savedId = id;

    saved.unshift(data);

    if (saved.length > 50) {
      saved.length = 50;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(saved)
    );

    state.savedGames = saved;

    const status = $("#saveStatus");

    if (status) {
      status.textContent = "저장됨";
    }

    toast("경기 데이터가 저장되었습니다.", "success");
  }

  function loadSavedGames() {
    try {
      state.savedGames =
        JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "[]"
        );
    } catch {
      state.savedGames = [];
    }
  }

  function loadGame(savedId) {
    const saved =
      state.savedGames.find(
        g => g.savedId === savedId
      );

    if (!saved) return;

    state = JSON.parse(
      JSON.stringify(saved)
    );

    state.history = [];

    state.savedGames =
      JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

    stopClock();

    render();

    toast("저장된 경기를 불러왔습니다.", "success");
  }

  /* =========================================================
     EXPORT CSV
     ========================================================= */

  function exportCSV() {
    const rows = [
      [
        "팀",
        "번호",
        "선수",
        "PTS",
        "FGM",
        "FGA",
        "2PM",
        "2PA",
        "3PM",
        "3PA",
        "FTM",
        "FTA",
        "REB",
        "AST",
        "STL",
        "BLK",
        "TOV",
        "PF"
      ]
    ];

    state.players.forEach(player => {
      const s = player.stats;

      rows.push([
        getTeamName(player.team),
        player.number,
        player.name,
        s.pts,
        s.fgm,
        s.fga,
        s.fg2m,
        s.fg2a,
        s.fg3m,
        s.fg3a,
        s.ftm,
        s.fta,
        s.reb,
        s.ast,
        s.stl,
        s.blk,
        s.tov,
        s.pf
      ]);
    });

    const csv =
      rows
        .map(row =>
          row
            .map(csvEscape)
            .join(",")
        )
        .join("\n");

    const blob =
      new Blob(
        ["\ufeff" + csv],
        { type: "text/csv;charset=utf-8;" }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `${state.game.name || "game"}_boxscore.csv`;

    a.click();

    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const text = String(value ?? "");

    return `"${text.replace(/"/g, '""')}"`;
  }

  /* =========================================================
     ADVANCED METRICS
     ========================================================= */

  function pct(made, attempts) {
    if (!attempts) return null;

    return made / attempts;
  }

  function getPlayerAdvanced(player) {
    const s = player.stats;

    const fgPct =
      pct(s.fgm, s.fga);

    const fg2Pct =
      pct(s.fg2m, s.fg2a);

    const fg3Pct =
      pct(s.fg3m, s.fg3a);

    const ftPct =
      pct(s.ftm, s.fta);

    const efg =
      s.fga
        ? (s.fgm + 0.5 * s.fg3m) / s.fga
        : null;

    const tsa =
      s.fga +
      0.44 * s.fta;

    const ts =
      tsa
        ? s.pts / (2 * tsa)
        : null;

    return {
      fgPct,
      fg2Pct,
      fg3Pct,
      ftPct,
      efg,
      ts
    };
  }

  function getTeamAdvanced(team) {
    const s = getTeamStats(team);

    const opp =
      getTeamStats(
        team === "home"
          ? "away"
          : "home"
      );

    const possessions =
      s.fga -
      s.orb +
      s.tov +
      0.44 * s.fta;

    const opponentPossessions =
      opp.fga -
      opp.orb +
      opp.tov +
      0.44 * opp.fta;

    const ortg =
      possessions > 0
        ? (s.pts / possessions) * 100
        : null;

    const drtg =
      opponentPossessions > 0
        ? (opp.pts / opponentPossessions) * 100
        : null;

    return {
      fgPct: pct(s.fgm, s.fga),

      fg2Pct: pct(
        s.fg2m,
        s.fg2a
      ),

      fg3Pct: pct(
        s.fg3m,
        s.fg3a
      ),

      ftPct: pct(
        s.ftm,
        s.fta
      ),

      efg:
        s.fga
          ? (s.fgm + 0.5 * s.fg3m) /
            s.fga
          : null,

      ts:
        s.fga + 0.44 * s.fta > 0
          ? s.pts /
            (2 *
              (s.fga +
                0.44 * s.fta))
          : null,

      ortg,

      drtg,

      netRating:
        ortg !== null &&
        drtg !== null
          ? ortg - drtg
          : null
    };
  }

  /* =========================================================
     RENDER ROOT
     ========================================================= */

  function render() {
    loadSavedGames();

    updateHeader();

    if (!pageContainer) return;

    switch (state.page) {
      case "live":
        renderLive();
        break;

      case "records":
        renderRecords();
        break;

      case "shots":
        renderShots();
        break;

      case "video":
        renderVideo();
        break;

      case "analysis":
        renderAnalysis();
        break;

      case "reports":
        renderReports();
        break;

      case "league":
        renderLeague();
        break;

      default:
        renderLive();
    }
  }

  /* =========================================================
     HEADER
     ========================================================= */

  function updateHeader() {
    const mode =
      $("#statusMode");

    if (mode) {
      mode.textContent =
        MODE_CONFIG[state.mode].label;
    }

    const game =
      $("#statusGame");

    if (game) {
      game.textContent =
        state.game.name || "새 경기";
    }

    $$(".mode-btn").forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.mode === state.mode
      );
    });

    $$(".nav-btn").forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.page === state.page
      );
    });
  }

  /* =========================================================
     LIVE PAGE
     ========================================================= */

  function renderLive() {
    const homePlayers =
      getPlayers("home");

    const awayPlayers =
      getPlayers("away");

    pageContainer.innerHTML = `
      <section class="page live-page">

        <div class="scoreboard card">

          <div class="score-team home">
            <span class="team-label">HOME</span>
            <strong>${escapeHtml(getTeamName("home"))}</strong>
            <div class="score">${getTeamScore("home")}</div>
          </div>

          <div class="game-center">

            <div class="period">
              Q${state.game.period}
            </div>

            <button
              class="clock-display"
              id="clockToggle"
            >
              ${formatTime(state.game.clock)}
            </button>

            <div class="clock-status">
              ${state.game.running ? "RUNNING" : "STOPPED"}
            </div>

            <div class="shot-clock">
              <span>SHOT CLOCK</span>
              <strong id="shotClockValue">
                ${state.game.shotClock}
              </strong>
            </div>

            <div class="clock-actions">
              <button class="btn" id="resetShotClock">
                RESET
              </button>

              <button class="btn" id="nextPeriod">
                NEXT
              </button>
            </div>

          </div>

          <div class="score-team away">
            <span class="team-label">AWAY</span>
            <strong>${escapeHtml(getTeamName("away"))}</strong>
            <div class="score">${getTeamScore("away")}</div>
          </div>

        </div>


        <div class="live-grid">

          <div class="card player-card">

            <div class="card-header">
              <div>
                <h2>ON COURT</h2>
                <span>기록 대상 선수</span>
              </div>

              <select id="teamSelector">
                <option value="home"
                  ${state.selectedTeam === "home" ? "selected" : ""}>
                  ${escapeHtml(getTeamName("home"))}
                </option>

                <option value="away"
                  ${state.selectedTeam === "away" ? "selected" : ""}>
                  ${escapeHtml(getTeamName("away"))}
                </option>
              </select>
            </div>

            <div class="player-list">

              ${renderPlayerButtons(
                state.selectedTeam
              )}

            </div>

          </div>


          <div class="card action-card">

            <div class="card-header">
              <div>
                <h2>LIVE ACTION</h2>
                <span>
                  ${state.setupComplete
                    ? "버튼을 누르면 즉시 기록됩니다."
                    : "선수 설정 후 기록을 시작하세요."}
                </span>
              </div>

              <button
                class="btn btn-danger"
                id="undoBtn"
              >
                마지막 기록 취소
              </button>
            </div>

            <div class="action-player">

              ${
                getSelectedPlayer()
                  ? `
                    <strong>
                      #${escapeHtml(
                        getSelectedPlayer().number
                      )}
                      ${escapeHtml(
                        getSelectedPlayer().name
                      )}
                    </strong>
                  `
                  : `<span>선수 미선택</span>`
              }

            </div>

            <div class="action-grid">

              <button
                class="action-btn made"
                data-action="ft_made"
              >
                <b>FT</b>
                <span>성공 +1</span>
              </button>

              <button
                class="action-btn miss"
                data-action="ft_miss"
              >
                <b>FT</b>
                <span>실패</span>
              </button>

              <button
                class="action-btn made"
                data-action="fg2_made"
              >
                <b>2PT</b>
                <span>
                  성공 +${state.mode === "3v3" ? 1 : 2}
                </span>
              </button>

              <button
                class="action-btn miss"
                data-action="fg2_miss"
              >
                <b>2PT</b>
                <span>실패</span>
              </button>

              <button
                class="action-btn made"
                data-action="fg3_made"
              >
                <b>3PT</b>
                <span>
                  성공 +${state.mode === "3v3" ? 2 : 3}
                </span>
              </button>

              <button
                class="action-btn miss"
                data-action="fg3_miss"
              >
                <b>3PT</b>
                <span>실패</span>
              </button>

              <button
                class="action-btn"
                data-action="orb"
              >
                <b>ORB</b>
                <span>공격 리바운드</span>
              </button>

              <button
                class="action-btn"
                data-action="drb"
              >
                <b>DRB</b>
                <span>수비 리바운드</span>
              </button>

              <button
                class="action-btn"
                data-action="ast"
              >
                <b>AST</b>
                <span>어시스트</span>
              </button>

              <button
                class="action-btn"
                data-action="stl"
              >
                <b>STL</b>
                <span>스틸</span>
              </button>

              <button
                class="action-btn"
                data-action="blk"
              >
                <b>BLK</b>
                <span>블록</span>
              </button>

              <button
                class="action-btn"
                data-action="tov"
              >
                <b>TOV</b>
                <span>턴오버</span>
              </button>

              <button
                class="action-btn"
                data-action="pf"
              >
                <b>PF</b>
                <span>파울</span>
              </button>

              <button
                class="action-btn pass-action"
                id="passBtn"
              >
                <b>PASS</b>
                <span>패스 기록</span>
              </button>

            </div>

          </div>


          <div class="card recent-card">

            <div class="card-header">
              <div>
                <h2>최근 기록</h2>
                <span>실시간 이벤트 로그</span>
              </div>

              <span class="live-badge">
                LIVE
              </span>
            </div>

            <div id="recentEvents">
              ${renderRecentEvents()}
            </div>

          </div>


          <div class="card leaders-card">

            <div class="card-header">
              <div>
                <h2>LIVE LEADERS</h2>
                <span>현재 경기 기준</span>
              </div>
            </div>

            ${renderLeaders()}

          </div>

        </div>

      </section>
    `;

    bindLiveEvents();
  }

  function renderPlayerButtons(team) {
    const players = getPlayers(team);

    if (!players.length) {
      return `
        <div class="empty-state">
          선수 설정을 먼저 해주세요.
        </div>
      `;
    }

    return players
      .map(player => `
        <button
          class="player-select ${
            state.selectedPlayerId === player.id
              ? "active"
              : ""
          }"
          data-player-id="${player.id}"
        >

          <span class="player-number">
            #${escapeHtml(player.number)}
          </span>

          <span class="player-name">
            ${escapeHtml(player.name)}
          </span>

          <span class="player-pts">
            ${player.stats.pts} PTS
          </span>

        </button>
      `)
      .join("");
  }

  function renderRecentEvents() {
    const events =
      [...state.events]
        .sort(
          (a, b) =>
            b.timestamp - a.timestamp
        )
        .slice(0, 15);

    if (!events.length) {
      return `
        <div class="empty-state">
          아직 기록된 이벤트가 없습니다.
        </div>
      `;
    }

    return `
      <div class="event-list">

        ${events
          .map(event => {

            const player =
              getPlayer(event.playerId);

            return `
              <div class="event-row">

                <div class="event-time">
                  Q${event.period}
                  ${formatTime(event.clock)}
                </div>

                <div class="event-player">
                  #${escapeHtml(
                    player?.number || "-"
                  )}
                  ${escapeHtml(
                    player?.name || "알 수 없음"
                  )}
                </div>

                <div class="event-type">
                  ${EVENT_LABELS[event.type] || event.type}
                </div>

                ${
                  event.points
                    ? `
                      <strong class="event-points">
                        +${event.points}
                      </strong>
                    `
                    : ""
                }

                <button
                  class="event-delete"
                  data-delete-event="${event.id}"
                  title="삭제"
                >
                  ×
                </button>

              </div>
            `;
          })
          .join("")}

      </div>
    `;
  }

  function renderLeaders() {
    const players =
      [...state.players]
        .sort(
          (a, b) =>
            b.stats.pts - a.stats.pts
        )
        .slice(0, 5);

    if (!players.length) {
      return `
        <div class="empty-state">
          선수 데이터가 없습니다.
        </div>
      `;
    }

    return `
      <div class="leader-list">

        ${players
          .map((p, i) => `
            <div class="leader-row">

              <span class="rank">
                ${i + 1}
              </span>

              <span class="leader-player">
                #${escapeHtml(p.number)}
                ${escapeHtml(p.name)}
              </span>

              <strong>
                ${p.stats.pts}
              </strong>

            </div>
          `)
          .join("")}

      </div>
    `;
  }

  function bindLiveEvents() {
    $("#clockToggle")?.addEventListener(
      "click",
      toggleClock
    );

    $("#resetShotClock")?.addEventListener(
      "click",
      resetShotClock
    );

    $("#nextPeriod")?.addEventListener(
      "click",
      nextPeriod
    );

    $("#undoBtn")?.addEventListener(
      "click",
      undoLast
    );

    $("#passBtn")?.addEventListener(
      "click",
      startPass
    );

    $("#teamSelector")?.addEventListener(
      "change",
      e => {
        state.selectedTeam =
          e.target.value;

        const first =
          getPlayers(state.selectedTeam)[0];

        state.selectedPlayerId =
          first?.id || null;

        render();
      }
    );

    $$(".player-select").forEach(btn => {
      btn.addEventListener(
        "click",
        () => {
          state.selectedPlayerId =
            btn.dataset.playerId;

          render();
        }
      );
    });

    $$("[data-action]").forEach(btn => {
      btn.addEventListener(
        "click",
        () => {

          const action =
            btn.dataset.action;

          /*
            슛은 라이브에서도 바로 기록.
            좌표가 필요하면 Shot Chart에서
            별도로 실제 위치를 기록할 수 있음.
          */

          quickAction(action);
        }
      );
    });

    $$("[data-delete-event]").forEach(btn => {
      btn.addEventListener(
        "click",
        () =>
          deleteEvent(
            btn.dataset.deleteEvent
          )
      );
    });
  }

  /* =========================================================
     RECORDS PAGE
     ========================================================= */

  function renderRecords() {
    pageContainer.innerHTML = `
      <section class="page">

        <div class="page-title">
          <div>
            <h1>경기 기록</h1>
            <p>
              ${escapeHtml(state.game.name)}
            </p>
          </div>

          <div class="page-actions">

            <button class="btn" id="saveGame">
              경기 저장
            </button>

            <button class="btn" id="exportCSV">
              CSV 내보내기
            </button>

          </div>
        </div>


        <div class="stats-grid">

          <div class="card">
            ${renderTeamBox("home")}
          </div>

          <div class="card">
            ${renderTeamBox("away")}
          </div>

        </div>


        <div class="card">

          <div class="card-header">
            <h2>선수 Box Score</h2>
          </div>

          <div class="table-wrap">

            <table class="data-table">

              <thead>
                <tr>
                  <th>팀</th>
                  <th>선수</th>
                  <th>PTS</th>
                  <th>FG</th>
                  <th>2P</th>
                  <th>3P</th>
                  <th>FT</th>
                  <th>REB</th>
                  <th>AST</th>
                  <th>STL</th>
                  <th>BLK</th>
                  <th>TOV</th>
                  <th>PF</th>
                </tr>
              </thead>

              <tbody>

                ${state.players
                  .map(p => `
                    <tr>

                      <td>
                        ${escapeHtml(
                          getTeamName(p.team)
                        )}
                      </td>

                      <td>
                        #${escapeHtml(p.number)}
                        ${escapeHtml(p.name)}
                      </td>

                      <td>${p.stats.pts}</td>

                      <td>
                        ${p.stats.fgm}/
                        ${p.stats.fga}
                      </td>

                      <td>
                        ${p.stats.fg2m}/
                        ${p.stats.fg2a}
                      </td>

                      <td>
                        ${p.stats.fg3m}/
                        ${p.stats.fg3a}
                      </td>

                      <td>
                        ${p.stats.ftm}/
                        ${p.stats.fta}
                      </td>

                      <td>${p.stats.reb}</td>
                      <td>${p.stats.ast}</td>
                      <td>${p.stats.stl}</td>
                      <td>${p.stats.blk}</td>
                      <td>${p.stats.tov}</td>
                      <td>${p.stats.pf}</td>

                    </tr>
                  `)
                  .join("")}

              </tbody>

            </table>

          </div>

        </div>


        <div class="card">

          <div class="card-header">
            <h2>저장된 경기</h2>
          </div>

          ${renderSavedGames()}

        </div>

      </section>
    `;

    $("#saveGame")?.addEventListener(
      "click",
      saveGame
    );

    $("#exportCSV")?.addEventListener(
      "click",
      exportCSV
    );

    $$("[data-load-game]").forEach(btn => {
      btn.addEventListener(
        "click",
        () =>
          loadGame(
            btn.dataset.loadGame
          )
      );
    });
  }

  function renderTeamBox(team) {
    const s =
      getTeamStats(team);

    const adv =
      getTeamAdvanced(team);

    return `
      <div class="team-box">

        <div class="team-box-title">
          <span>${escapeHtml(
            getTeamName(team)
          )}</span>

          <strong>
            ${getTeamScore(team)}
          </strong>
        </div>

        <div class="mini-stat-grid">

          <div>
            <span>FG%</span>
            <strong>
              ${formatPct(adv.fgPct)}
            </strong>
          </div>

          <div>
            <span>3P%</span>
            <strong>
              ${formatPct(adv.fg3Pct)}
            </strong>
          </div>

          <div>
            <span>FT%</span>
            <strong>
              ${formatPct(adv.ftPct)}
            </strong>
          </div>

          <div>
            <span>REB</span>
            <strong>${s.reb}</strong>
          </div>

          <div>
            <span>AST</span>
            <strong>${s.ast}</strong>
          </div>

          <div>
            <span>TOV</span>
            <strong>${s.tov}</strong>
          </div>

        </div>

      </div>
    `;
  }

  function renderSavedGames() {
    if (!state.savedGames.length) {
      return `
        <div class="empty-state">
          저장된 경기가 없습니다.
        </div>
      `;
    }

    return `
      <div class="saved-game-list">

        ${state.savedGames
          .map(game => `
            <div class="saved-game-row">

              <div>
                <strong>
                  ${escapeHtml(
                    game.name ||
                    game.game?.name ||
                    "경기"
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    game.game?.home?.name || ""
                  )}
                  ${game.game?.home?.score ?? 0}
                  :
                  ${game.game?.away?.score ?? 0}
                  ${escapeHtml(
                    game.game?.away?.name || ""
                  )}
                </span>
              </div>

              <button
                class="btn"
                data-load-game="${game.savedId}"
              >
                불러오기
              </button>

            </div>
          `)
          .join("")}

      </div>
    `;
  }

  /* =========================================================
     SHOT PAGE
     ========================================================= */

  function renderShots() {
    const filtered =
      getFilteredShots();

    pageContainer.innerHTML = `
      <section class="page">

        <div class="page-title">

          <div>
            <h1>슛 차트</h1>
            <p>
              실제 코트 좌표 기반 Shot Chart / Heatmap
            </p>
          </div>

          <div class="filter-bar">

            <select id="shotTeamFilter">

              <option value="all">
                전체 팀
              </option>

              <option value="home"
                ${state.filters.team === "home" ? "selected" : ""}>
                ${escapeHtml(
                  getTeamName("home")
                )}
              </option>

              <option value="away"
                ${state.filters.team === "away" ? "selected" : ""}>
                ${escapeHtml(
                  getTeamName("away")
                )}
              </option>

            </select>


            <select id="shotPlayerFilter">

              <option value="all">
                전체 선수
              </option>

              ${state.players
                .map(p => `
                  <option
                    value="${p.id}"
                    ${state.filters.player === p.id
                      ? "selected"
                      : ""}
                  >
                    #${escapeHtml(p.number)}
                    ${escapeHtml(p.name)}
                  </option>
                `)
                .join("")}

            </select>

          </div>

        </div>


        <div class="shot-layout">

          <div class="card shot-chart-card">

            <div class="card-header">

              <div>
                <h2>SHOT LOCATION</h2>
                <span>
                  실제 기록된 좌표만 표시
                </span>
              </div>

              <div class="shot-legend">
                <span>● 성공</span>
                <span>× 실패</span>
              </div>

            </div>

            <div
              class="basketball-court shot-court"
              id="mainShotCourt"
            >

              ${renderCourtMarkup()}

              ${renderShotMarkers(filtered)}

              ${renderHeatPoints(filtered)}

            </div>

          </div>


          <div class="shot-side">

            <div class="card">

              <div class="card-header">
                <h2>SHOOTING SUMMARY</h2>
              </div>

              ${renderShotSummary(filtered)}

            </div>


            <div class="card">

              <div class="card-header">
                <h2>ZONE DISTRIBUTION</h2>
              </div>

              ${renderZoneDistribution(filtered)}

            </div>

          </div>

        </div>


        <div class="card">

          <div class="card-header">
            <div>
              <h2>슛 위치 직접 기록</h2>
              <span>
                선수 선택 → 슛 종류 → 성공/실패 → 실제 코트 위치
              </span>
            </div>
          </div>

          <div class="shot-record-controls">

            <select id="shotPlayerInput">

              <option value="">
                선수 선택
              </option>

              ${state.players
                .map(p => `
                  <option value="${p.id}">
                    ${escapeHtml(
                      getTeamName(p.team)
                    )}
                    · #${escapeHtml(p.number)}
                    ${escapeHtml(p.name)}
                  </option>
                `)
                .join("")}

            </select>


            <button
              class="btn"
              data-shot-type="FT"
            >
              FT
            </button>

            <button
              class="btn"
              data-shot-type="2PT"
            >
              2PT
            </button>

            <button
              class="btn"
              data-shot-type="3PT"
            >
              3PT
            </button>

          </div>

        </div>

      </section>
    `;

    bindShotEvents();
  }

  function getFilteredShots() {
    return state.shots.filter(shot => {

      if (
        state.filters.team !== "all" &&
        shot.team !== state.filters.team
      ) {
        return false;
      }

      if (
        state.filters.player !== "all" &&
        shot.playerId !== state.filters.player
      ) {
        return false;
      }

      return true;
    });
  }

  function renderCourtMarkup() {
    return `
      <div class="court-boundary"></div>

      <div class="half-court-line"></div>

      <div class="center-circle"></div>

      <div class="court-paint home-paint"></div>
      <div class="court-paint away-paint"></div>

      <div class="free-throw-line home-ft"></div>
      <div class="free-throw-line away-ft"></div>

      <div class="restricted-area home-ra"></div>
      <div class="restricted-area away-ra"></div>

      <div class="three-point-arc home-3pt"></div>
      <div class="three-point-arc away-3pt"></div>

      <div class="three-left-line"></div>
      <div class="three-right-line"></div>

      <div class="court-backboard home-board"></div>
      <div class="court-backboard away-board"></div>

      <div class="court-rim home-rim"></div>
      <div class="court-rim away-rim"></div>
    `;
  }

  function renderShotMarkers(shots) {
    return shots
      .map(shot => `
        <div
          class="shot-marker ${
            shot.made
              ? "made"
              : "miss"
          }"
          style="
            left:${shot.x * 100}%;
            top:${shot.y * 100}%;
          "
          title="${escapeHtml(
            `${shot.zone} · ${
              shot.made ? "성공" : "실패"
            }`
          )}"
        >
          ${shot.made ? "●" : "×"}
        </div>
      `)
      .join("");
  }

  function renderHeatPoints(shots) {
    if (!shots.length) return "";

    return shots
      .map(shot => `
        <div
          class="heat-point"
          style="
            left:${shot.x * 100}%;
            top:${shot.y * 100}%;
          "
        ></div>
      `)
      .join("");
  }

  function renderShotSummary(shots) {
    const attempts =
      shots.length;

    const makes =
      shots.filter(
        s => s.made
      ).length;

    const misses =
      attempts - makes;

    const fgPct =
      attempts
        ? makes / attempts
        : null;

    const points =
      shots.reduce(
        (sum, s) =>
          sum + (s.made ? s.points : 0),
        0
      );

    return `
      <div class="shot-summary">

        <div>
          <span>ATTEMPTS</span>
          <strong>${attempts}</strong>
        </div>

        <div>
          <span>MADE</span>
          <strong>${makes}</strong>
        </div>

        <div>
          <span>MISSED</span>
          <strong>${misses}</strong>
        </div>

        <div>
          <span>FG%</span>
          <strong>${formatPct(fgPct)}</strong>
        </div>

        <div>
          <span>POINTS</span>
          <strong>${points}</strong>
        </div>

      </div>
    `;
  }

  function renderZoneDistribution(shots) {
    const zones = {};

    shots.forEach(shot => {
      if (!zones[shot.zone]) {
        zones[shot.zone] = {
          attempts: 0,
          makes: 0
        };
      }

      zones[shot.zone].attempts++;

      if (shot.made) {
        zones[shot.zone].makes++;
      }
    });

    const entries =
      Object.entries(zones)
        .sort(
          (a, b) =>
            b[1].attempts -
            a[1].attempts
        );

    if (!entries.length) {
      return `
        <div class="empty-state">
          실제 슛 데이터가 없습니다.
        </div>
      `;
    }

    return `
      <div class="zone-list">

        ${entries
          .map(([zone, data]) => `
            <div class="zone-row">

              <span>${escapeHtml(zone)}</span>

              <strong>
                ${data.makes}/${data.attempts}
              </strong>

              <span>
                ${formatPct(
                  pct(
                    data.makes,
                    data.attempts
                  )
                )}
              </span>

            </div>
          `)
          .join("")}

      </div>
    `;
  }

  function bindShotEvents() {
    $("#shotTeamFilter")?.addEventListener(
      "change",
      e => {
        state.filters.team =
          e.target.value;

        renderShots();
      }
    );

    $("#shotPlayerFilter")?.addEventListener(
      "change",
      e => {
        state.filters.player =
          e.target.value;

        renderShots();
      }
    );

    const court =
      $("#mainShotCourt");

    court?.addEventListener(
      "click",
      e => {

        if (
          e.target.closest(".shot-marker")
        ) {
          return;
        }

        const rect =
          court.getBoundingClientRect();

        const x =
          (e.clientX - rect.left) /
          rect.width;

        const y =
          (e.clientY - rect.top) /
          rect.height;

        /*
          Shot chart의 직접 좌표 입력.
          실제 좌표를 저장한다.
        */

        openDirectShotCoordinate(
          x,
          y
        );
      }
    );

    $("[data-shot-type]") &&
      $$("[data-shot-type]").forEach(btn => {
        btn.addEventListener(
          "click",
          () => {
            const playerId =
              $("#shotPlayerInput")?.value;

            if (!playerId) {
              toast(
                "선수를 선택해주세요.",
                "error"
              );
              return;
            }

            state.selectedPlayerId =
              playerId;

            startShot(
              btn.dataset.shotType
            );
          }
        );
      });
  }

  function openDirectShotCoordinate(
    x,
    y
  ) {
    const player =
      getSelectedPlayer();

    if (!player) {
      toast(
        "먼저 라이브 선수 또는 슛 기록 선수를 선택해주세요.",
        "info"
      );
      return;
    }

    pendingShot = {
      playerId: player.id,
      team: player.team,
      type: state.selectedShotType,
      directCoordinate: true,
      x,
      y
    };

    openShotModal();
  }

  /* =========================================================
     VIDEO ANALYSIS
     ========================================================= */

  function renderVideo() {
    pageContainer.innerHTML = `
      <section class="page">

        <div class="page-title">

          <div>
            <h1>영상 분석</h1>
            <p>
              경기 영상 · 이벤트 타임라인 · AI 분석
            </p>
          </div>

        </div>


        <div class="video-layout">

          <div class="card video-player-card">

            <div class="card-header">
              <div>
                <h2>GAME VIDEO</h2>
                <span id="videoFileName">
                  영상이 업로드되지 않았습니다.
                </span>
              </div>

              <label class="btn upload-btn">
                영상 업로드
                <input
                  id="videoInput"
                  type="file"
                  accept="video/*"
                  hidden
                />
              </label>
            </div>

            <video
              id="gameVideo"
              controls
              playsinline
            ></video>

            <div class="video-controls">

              <button
                class="btn"
                data-speed="0.5"
              >
                0.5×
              </button>

              <button
                class="btn"
                data-speed="1"
              >
                1×
              </button>

              <button
                class="btn"
                data-speed="1.5"
              >
                1.5×
              </button>

              <button
                class="btn"
                data-speed="2"
              >
                2×
              </button>

              <button
                class="btn"
                id="addVideoMarker"
              >
                현재 위치 마커
              </button>

            </div>

          </div>


          <div class="card ai-card">

            <div class="card-header">

              <div>
                <h2>AI VIDEO ANALYSIS</h2>
                <span>
                  선수 추적 · 이벤트 검출 · 통계 생성
                </span>
              </div>

              <span class="ai-status">
                ${getAIStatusLabel()}
              </span>

            </div>

            <div class="ai-panel">

              <div class="ai-info">
                <strong>
                  실제 AI 엔진 연결 구조
                </strong>

                <p>
                  영상만으로 자동 생성된 가짜 통계를
                  사용하지 않습니다.
                  AI 엔진이 연결되면 분석 결과를
                  검토 후 경기 기록에 반영합니다.
                </p>
              </div>

              <button
                class="btn btn-primary"
                id="startAIAnalysis"
              >
                AI 분석 시작
              </button>

              <div id="aiResults">
                ${renderAIResults()}
              </div>

            </div>

          </div>

        </div>


        <div class="card">

          <div class="card-header">
            <h2>VIDEO EVENT TIMELINE</h2>
          </div>

          ${renderVideoMarkers()}

        </div>

      </section>
    `;

    bindVideoEvents();
  }

  function bindVideoEvents() {
    const input =
      $("#videoInput");

    input?.addEventListener(
      "change",
      e => {
        const file =
          e.target.files?.[0];

        if (!file) return;

        if (videoObjectUrl) {
          URL.revokeObjectURL(
            videoObjectUrl
          );
        }

        videoObjectUrl =
          URL.createObjectURL(file);

        state.video.name =
          file.name;

        state.video.url =
          videoObjectUrl;

        const video =
          $("#gameVideo");

        if (video) {
          video.src =
            videoObjectUrl;
        }

        const name =
          $("#videoFileName");

        if (name) {
          name.textContent =
            file.name;
        }
      }
    );

    $$("[data-speed]").forEach(btn => {
      btn.addEventListener(
        "click",
        () => {
          const video =
            $("#gameVideo");

          if (!video) return;

          video.playbackRate =
            Number(
              btn.dataset.speed
            );
        }
      );
    });

    $("#addVideoMarker")?.addEventListener(
      "click",
      addVideoMarker
    );

    $("#startAIAnalysis")?.addEventListener(
      "click",
      startAIAnalysis
    );
  }

  function addVideoMarker() {
    const video =
      $("#gameVideo");

    if (!video) return;

    const marker = {
      id: uid("marker"),
      time: video.currentTime,
      label: `이벤트 ${state.video.markers.length + 1}`
    };

    state.video.markers.push(marker);

    renderVideo();
  }

  function renderVideoMarkers() {
    if (!state.video.markers.length) {
      return `
        <div class="empty-state">
          아직 영상 마커가 없습니다.
        </div>
      `;
    }

    return `
      <div class="video-marker-list">

        ${state.video.markers
          .map(marker => `
            <button
              class="video-marker-row"
              data-video-time="${marker.time}"
            >

              <strong>
                ${formatVideoTime(
                  marker.time
                )}
              </strong>

              <span>
                ${escapeHtml(
                  marker.label
                )}
              </span>

            </button>
          `)
          .join("")}

      </div>
    `;
  }

  function formatVideoTime(seconds) {
    const min =
      Math.floor(seconds / 60);

    const sec =
      Math.floor(seconds % 60);

    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  /* =========================================================
     AI
     ========================================================= */

  function getAIStatusLabel() {
    switch (state.ai.status) {
      case "processing":
        return "분석 중";

      case "connected":
        return "AI CONNECTED";

      case "completed":
        return "분석 완료";

      default:
        return "AI ENGINE 미연결";
    }
  }

  function startAIAnalysis() {
    if (!state.video.url) {
      toast(
        "먼저 경기 영상을 업로드해주세요.",
        "error"
      );
      return;
    }

    /*
      현재 프론트엔드에는 실제 AI 모델이 연결되어 있지 않음.
      따라서 가짜 분석 결과를 생성하지 않는다.
    */

    state.ai.status =
      "not-connected";

    renderVideo();

    toast(
      "AI 엔진 연결이 필요합니다. 현재는 영상 재생·마커 분석만 사용할 수 있습니다.",
      "info"
    );
  }

  function renderAIResults() {
    if (!state.ai.results.length) {
      return `
        <div class="empty-state">
          AI 분석 결과 없음
        </div>
      `;
    }

    return state.ai.results
      .map(result => `
        <div class="ai-result-row">

          <strong>
            ${escapeHtml(
              result.type
            )}
          </strong>

          <span>
            ${escapeHtml(
              result.status
            )}
          </span>

          <span>
            ${Math.round(
              result.confidence * 100
            )}%
          </span>

        </div>
      `)
      .join("");
  }

  /* =========================================================
     ANALYSIS
     ========================================================= */

  function renderAnalysis() {
    const home =
      getTeamAdvanced("home");

    const away =
      getTeamAdvanced("away");

    pageContainer.innerHTML = `
      <section class="page">

        <div class="page-title">

          <div>
            <h1>전력분석</h1>
            <p>
              Team Efficiency · Shot Profile · Pass Network
            </p>
          </div>

        </div>


        <div class="comparison-grid">

          <div class="card">
            ${renderAdvancedTeamCard(
              "home",
              home
            )}
          </div>

          <div class="card">
            ${renderAdvancedTeamCard(
              "away",
              away
            )}
          </div>

        </div>


        <div class="analysis-grid">

          <div class="card">

            <div class="card-header">
              <h2>TEAM COMPARISON</h2>
            </div>

            ${renderComparison(home, away)}

          </div>


          <div class="card">

            <div class="card-header">
              <h2>PASS NETWORK</h2>
            </div>

            ${renderPassNetwork()}

          </div>

        </div>


        <div class="card">

          <div class="card-header">
            <h2>SCORING FLOW</h2>
          </div>

          ${renderScoringFlow()}

        </div>


        <div class="card">

          <div class="card-header">
            <h2>LINEUP / PLAYER IMPACT</h2>
          </div>

          ${renderPlayerImpact()}

        </div>

      </section>
    `;
  }

  function renderAdvancedTeamCard(
    team,
    adv
  ) {
    return `
      <div class="advanced-team-card">

        <div class="team-box-title">
          <span>
            ${escapeHtml(
              getTeamName(team)
            )}
          </span>

          <strong>
            ${getTeamScore(team)}
          </strong>
        </div>

        <div class="advanced-metric-grid">

          ${metricBox(
            "FG%",
            formatPct(adv.fgPct)
          )}

          ${metricBox(
            "2P%",
            formatPct(adv.fg2Pct)
          )}

          ${metricBox(
            "3P%",
            formatPct(adv.fg3Pct)
          )}

          ${metricBox(
            "FT%",
            formatPct(adv.ftPct)
          )}

          ${metricBox(
            "eFG%",
            formatPct(adv.efg)
          )}

          ${metricBox(
            "TS%",
            formatPct(adv.ts)
          )}

          ${metricBox(
            "ORtg",
            formatMetric(adv.ortg)
          )}

          ${metricBox(
            "DRtg",
            formatMetric(adv.drtg)
          )}

          ${metricBox(
            "Net",
            formatMetric(adv.netRating)
          )}

        </div>

      </div>
    `;
  }

  function metricBox(label, value) {
    return `
      <div class="metric-box">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `;
  }

  function renderComparison(home, away) {
    const rows = [
      ["FG%", home.fgPct, away.fgPct],
      ["3P%", home.fg3Pct, away.fg3Pct],
      ["FT%", home.ftPct, away.ftPct],
      ["eFG%", home.efg, away.efg],
      ["TS%", home.ts, away.ts],
      ["ORtg", home.ortg, away.ortg],
      ["DRtg", home.drtg, away.drtg],
      ["Net Rating", home.netRating, away.netRating]
    ];

    return `
      <div class="comparison-list">

        ${rows
          .map(row => `
            <div class="comparison-row">

              <strong>
                ${row[0]}
              </strong>

              <span>
                ${formatMetric(row[1])}
              </span>

              <div class="comparison-bar">
                <i
                  style="width:${comparisonWidth(
                    row[1],
                    row[2]
                  )}%"
                ></i>
              </div>

              <span>
                ${formatMetric(row[2])}
              </span>

            </div>
          `)
          .join("")}

      </div>
    `;
  }

  function comparisonWidth(a, b) {
    if (
      a === null ||
      b === null ||
      (a === 0 && b === 0)
    ) {
      return 0;
    }

    const absA = Math.abs(a);
    const absB = Math.abs(b);

    return Math.min(
      100,
      (absA /
        Math.max(absA, absB)) *
        100
    );
  }

  /* =========================================================
     PASS NETWORK
     ========================================================= */

  function renderPassNetwork() {
    if (!state.passes.length) {
      return `
        <div class="empty-state">
          패스 데이터가 없습니다.
        </div>
      `;
    }

    const counts = {};

    state.passes.forEach(pass => {
      const key =
        `${pass.fromPlayerId}_${pass.toPlayerId}`;

      counts[key] =
        (counts[key] || 0) + 1;
    });

    return `
      <div class="pass-network-list">

        ${Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([key, count]) => {

            const [
              fromId,
              toId
            ] = key.split("_");

            const from =
              getPlayer(fromId);

            const to =
              getPlayer(toId);

            if (!from || !to) {
              return "";
            }

            return `
              <div class="pass-edge">

                <span>
                  #${escapeHtml(from.number)}
                  ${escapeHtml(from.name)}
                </span>

                <strong>
                  ${count}
                </strong>

                <span>
                  #${escapeHtml(to.number)}
                  ${escapeHtml(to.name)}
                </span>

              </div>
            `;
          })
          .join("")}

      </div>
    `;
  }

  /* =========================================================
     SCORING FLOW
     ========================================================= */

  function renderScoringFlow() {
    if (!state.events.length) {
      return `
        <div class="empty-state">
          경기 이벤트가 없습니다.
        </div>
      `;
    }

    const periods =
      {};

    state.events.forEach(event => {

      if (!periods[event.period]) {
        periods[event.period] = {
          home: 0,
          away: 0
        };
      }

      if (
        event.points &&
        periods[event.period][event.team] !== undefined
      ) {
        periods[event.period][event.team] +=
          event.points;
      }

    });

    return `
      <div class="scoring-flow-list">

        ${Object.entries(periods)
          .map(([period, score]) => `
            <div class="flow-row">

              <span>Q${period}</span>

              <strong>
                ${score.home}
              </strong>

              <span>:</span>

              <strong>
                ${score.away}
              </strong>

            </div>
          `)
          .join("")}

      </div>
    `;
  }

  /* =========================================================
     PLAYER IMPACT
     ========================================================= */

  function renderPlayerImpact() {
    return `
      <div class="table-wrap">

        <table class="data-table">

          <thead>
            <tr>
              <th>선수</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TOV</th>
              <th>FG%</th>
              <th>TS%</th>
            </tr>
          </thead>

          <tbody>

            ${state.players
              .map(player => {

                const adv =
                  getPlayerAdvanced(
                    player
                  );

                return `
                  <tr>

                    <td>
                      #${escapeHtml(
                        player.number
                      )}
                      ${escapeHtml(
                        player.name
                      )}
                    </td>

                    <td>${player.stats.pts}</td>
                    <td>${player.stats.reb}</td>
                    <td>${player.stats.ast}</td>
                    <td>${player.stats.stl}</td>
                    <td>${player.stats.blk}</td>
                    <td>${player.stats.tov}</td>

                    <td>
                      ${formatPct(
                        adv.fgPct
                      )}
                    </td>

                    <td>
                      ${formatPct(
                        adv.ts
                      )}
                    </td>

                  </tr>
                `;
              })
              .join("")}

          </tbody>

        </table>

      </div>
    `;
  }

  /* =========================================================
     REPORTS
     ========================================================= */

  function renderReports() {
    pageContainer.innerHTML = `
      <section class="page">

        <div class="page-title">

          <div>
            <h1>리포트</h1>
            <p>
              경기 + 팀 리포트 / 개인 리포트
            </p>
          </div>

          <div class="page-actions">

            <button
              class="btn"
              id="reportCSV"
            >
              CSV
            </button>

            <button
              class="btn btn-primary"
              id="printReport"
            >
              인쇄 / PDF
            </button>

          </div>

        </div>


        <div class="card">

          <div class="card-header">
            <h2>경기 + 팀 리포트</h2>
          </div>

          ${renderGameReport()}

        </div>


        <div class="card">

          <div class="card-header">

            <h2>개인 리포트</h2>

            <select id="reportPlayer">

              ${state.players
                .map(p => `
                  <option value="${p.id}">
                    #${escapeHtml(p.number)}
                    ${escapeHtml(p.name)}
                  </option>
                `)
                .join("")}

            </select>

          </div>

          <div id="individualReport">
            ${renderIndividualReport(
              state.players[0]
            )}
          </div>

        </div>

      </section>
    `;

    $("#reportCSV")?.addEventListener(
      "click",
      exportCSV
    );

    $("#printReport")?.addEventListener(
      "click",
      () => window.print()
    );

    $("#reportPlayer")?.addEventListener(
      "change",
      e => {

        const player =
          getPlayer(
            e.target.value
          );

        const target =
          $("#individualReport");

        if (target) {
          target.innerHTML =
            renderIndividualReport(
              player
            );
        }
      }
    );
  }

  function renderGameReport() {
    const home =
      getTeamAdvanced("home");

    const away =
      getTeamAdvanced("away");

    return `
      <div class="report-grid">

        <div>
          <span>경기</span>
          <strong>
            ${escapeHtml(
              state.game.name
            )}
          </strong>
        </div>

        <div>
          <span>대회</span>
          <strong>
            ${escapeHtml(
              state.game.tournament ||
              "기록 없음"
            )}
          </strong>
        </div>

        <div>
          <span>결과</span>
          <strong>
            ${getTeamName("home")}
            ${getTeamScore("home")}
            :
            ${getTeamScore("away")}
            ${getTeamName("away")}
          </strong>
        </div>

      </div>


      <div class="report-section">

        <h3>Team Efficiency</h3>

        ${renderComparison(
          home,
          away
        )}

      </div>


      <div class="report-section">

        <h3>Scoring Type</h3>

        ${renderScoringTypeDistribution()}

      </div>


      <div class="report-section">

        <h3>Key Analysis</h3>

        ${renderKeyAnalysis()}

      </div>

    `;
  }

  function renderScoringTypeDistribution() {
    const types = {
      "자유투": 0,
      "2점": 0,
      "3점": 0
    };

    state.events.forEach(event => {

      if (
        !event.points
      ) return;

      if (
        event.type.startsWith("ft")
      ) {
        types["자유투"] +=
          event.points;
      }

      if (
        event.type.startsWith("fg2")
      ) {
        types["2점"] +=
          event.points;
      }

      if (
        event.type.startsWith("fg3")
      ) {
        types["3점"] +=
          event.points;
      }

    });

    return `
      <div class="distribution-list">

        ${Object.entries(types)
          .map(([name, value]) => `
            <div class="distribution-row">

              <span>
                ${name}
              </span>

              <strong>
                ${value} PTS
              </strong>

            </div>
          `)
          .join("")}

      </div>
    `;
  }

  function renderKeyAnalysis() {
    if (!state.events.length) {
      return `
        <div class="empty-state">
          분석할 경기 데이터가 없습니다.
        </div>
      `;
    }

    const home =
      getTeamStats("home");

    const away =
      getTeamStats("away");

    const lines = [];

    if (
      home.ast > away.ast
    ) {
      lines.push(
        `${getTeamName("home")}이(가) 어시스트에서 우위입니다.`
      );
    } else if (
      away.ast > home.ast
    ) {
      lines.push(
        `${getTeamName("away")}이(가) 어시스트에서 우위입니다.`
      );
    }

    if (
      home.tov < away.tov
    ) {
      lines.push(
        `${getTeamName("home")}의 턴오버 관리가 더 좋습니다.`
      );
    } else if (
      away.tov < home.tov
    ) {
      lines.push(
        `${getTeamName("away")}의 턴오버 관리가 더 좋습니다.`
      );
    }

    if (!lines.length) {
      lines.push(
        "현재 기록에서 뚜렷한 팀 지표 우위가 충분하지 않습니다."
      );
    }

    return `
      <ul class="analysis-points">
        ${lines
          .map(line =>
            `<li>${escapeHtml(line)}</li>`
          )
          .join("")}
      </ul>
    `;
  }

  function renderIndividualReport(
    player
  ) {
    if (!player) {
      return `
        <div class="empty-state">
          선수가 없습니다.
        </div>
      `;
    }

    const s =
      player.stats;

    const adv =
      getPlayerAdvanced(
        player
      );

    const playerShots =
      state.shots.filter(
        shot =>
          shot.playerId ===
          player.id
      );

    return `
      <div class="individual-report">

        <div class="player-report-header">

          <div>
            <span>
              #${escapeHtml(
                player.number
              )}
            </span>

            <h3>
              ${escapeHtml(
                player.name
              )}
            </h3>
          </div>

          <strong>
            ${s.pts} PTS
          </strong>

        </div>


        <div class="advanced-metric-grid">

          ${metricBox(
            "FG%",
            formatPct(adv.fgPct)
          )}

          ${metricBox(
            "2P%",
            formatPct(adv.fg2Pct)
          )}

          ${metricBox(
            "3P%",
            formatPct(adv.fg3Pct)
          )}

          ${metricBox(
            "FT%",
            formatPct(adv.ftPct)
          )}

          ${metricBox(
            "eFG%",
            formatPct(adv.efg)
          )}

          ${metricBox(
            "TS%",
            formatPct(adv.ts)
          )}

          ${metricBox(
            "REB",
            s.reb
          )}

          ${metricBox(
            "AST",
            s.ast
          )}

          ${metricBox(
            "STL",
            s.stl
          )}

          ${metricBox(
            "BLK",
            s.blk
          )}

          ${metricBox(
            "TOV",
            s.tov
          )}

        </div>


        <div class="report-section">

          <h3>Shot Profile</h3>

          ${renderShotSummary(
            playerShots
          )}

        </div>


        <div class="report-section">

          <h3>Pass Partners</h3>

          ${renderPlayerPassPartners(
            player.id
          )}

        </div>


        <div class="report-section">

          <h3>개선 포인트</h3>

          ${renderTrainingRecommendations(
            player
          )}

        </div>

      </div>
    `;
  }

  function renderPlayerPassPartners(
    playerId
  ) {
    const counts = {};

    state.passes.forEach(pass => {

      if (
        pass.fromPlayerId !== playerId &&
        pass.toPlayerId !== playerId
      ) {
        return;
      }

      const other =
        pass.fromPlayerId === playerId
          ? pass.toPlayerId
          : pass.fromPlayerId;

      counts[other] =
        (counts[other] || 0) + 1;
    });

    const entries =
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1]);

    if (!entries.length) {
      return `
        <div class="empty-state">
          패스 데이터 없음
        </div>
      `;
    }

    return `
      <div class="pass-partner-list">

        ${entries
          .map(([id, count]) => {

            const p =
              getPlayer(id);

            return `
              <div>
                <span>
                  #${escapeHtml(
                    p?.number || "-"
                  )}
                  ${escapeHtml(
                    p?.name || "-"
                  )}
                </span>

                <strong>
                  ${count}
                </strong>
              </div>
            `;
          })
          .join("")}

      </div>
    `;
  }

  function renderTrainingRecommendations(
    player
  ) {
    const s =
      player.stats;

    const adv =
      getPlayerAdvanced(
        player
      );

    const recommendations = [];

    if (
      adv.fgPct !== null &&
      adv.fgPct < 0.4
    ) {
      recommendations.push(
        "필드골 성공률 개선을 위한 슈팅 반복 훈련"
      );
    }

    if (
      adv.fg3Pct !== null &&
      adv.fg3Pct < 0.33 &&
      s.fg3a >= 3
    ) {
      recommendations.push(
        "3점 슈팅 정확도 및 밸런스 훈련"
      );
    }

    if (
      s.tov >= 3
    ) {
      recommendations.push(
        "압박 상황 볼핸들링 및 의사결정 훈련"
      );
    }

    if (
      s.reb === 0
    ) {
      recommendations.push(
        "박스아웃 및 리바운드 참여 강화"
      );
    }

    if (!recommendations.length) {
      recommendations.push(
        "현재 기록에서 뚜렷한 개선 지표가 부족합니다."
      );
    }

    return `
      <ul class="recommendation-list">

        ${recommendations
          .map(text =>
            `<li>${escapeHtml(text)}</li>`
          )
          .join("")}

      </ul>
    `;
  }

  /* =========================================================
     LEAGUE
     ========================================================= */

  function renderLeague() {
    pageContainer.innerHTML = `
      <section class="page">

        <div class="page-title">

          <div>
            <h1>리그</h1>
            <p>
              ${MODE_CONFIG[state.mode].label}
              경기 관리
            </p>
          </div>

        </div>


        <div class="card">

          <div class="card-header">
            <h2>현재 경기</h2>
          </div>

          <div class="league-current-game">

            <div>
              ${escapeHtml(
                getTeamName("home")
              )}
            </div>

            <strong>
              ${getTeamScore("home")}
              :
              ${getTeamScore("away")}
            </strong>

            <div>
              ${escapeHtml(
                getTeamName("away")
              )}
            </div>

          </div>

        </div>


        <div class="card">

          <div class="card-header">
            <h2>리그 기능 준비</h2>
          </div>

          <div class="empty-state">
            팀 등록 · 일정 · 순위 · 경기 결과 ·
            시즌 누적 DB를 연결할 수 있습니다.
          </div>

        </div>

      </section>
    `;
  }

  /* =========================================================
     MODALS
     ========================================================= */

  function bindModalEvents() {
    $("#openSetupBtn")?.addEventListener(
      "click",
      openSetup
    );

    $("#setupClose")?.addEventListener(
      "click",
      closeSetup
    );

    $("#setupCancel")?.addEventListener(
      "click",
      closeSetup
    );

    $("#setupSave")?.addEventListener(
      "click",
      saveSetup
    );

    $("#saveGameBtn")?.addEventListener(
      "click",
      saveGame
    );

    $("#resetGameBtn")?.addEventListener(
      "click",
      resetEntireGame
    );

    $("#modalClose")?.addEventListener(
      "click",
      closeGenericModal
    );

    $("#shotClose")?.addEventListener(
      "click",
      closeShotModal
    );

    $("#shotCancel")?.addEventListener(
      "click",
      closeShotModal
    );

    $("#passClose")?.addEventListener(
      "click",
      closePassModal
    );

    $("#passCancel")?.addEventListener(
      "click",
      closePassModal
    );

    $$("[data-shot-result]").forEach(btn => {
      btn.addEventListener(
        "click",
        () => {

          const result =
            btn.dataset.shotResult;

          /*
            직접 좌표 기록 모드
          */

          if (
            pendingShot?.directCoordinate
          ) {
            const x =
              pendingShot.x;

            const y =
              pendingShot.y;

            const player =
              getPlayer(
                pendingShot.playerId
              );

            if (!player) return;

            const eventType =
              pendingShot.type === "FT"
                ? result === "made"
                  ? "ft_made"
                  : "ft_miss"
                : pendingShot.type === "2PT"
                  ? result === "made"
                    ? "fg2_made"
                    : "fg2_miss"
                  : result === "made"
                    ? "fg3_made"
                    : "fg3_miss";

            pushHistory();

            const event = {
              id: uid("event"),

              type: eventType,

              playerId:
                pendingShot.playerId,

              team:
                pendingShot.team,

              points:
                result === "made"
                  ? getShotPoints(
                      pendingShot.type
                    )
                  : 0,

              period:
                state.game.period,

              clock:
                state.game.clock,

              timestamp: Date.now()
            };

            state.events.push(event);

            applyEventToStats(event);

            state.shots.push({
              id: uid("shot"),

              eventId: event.id,

              playerId:
                pendingShot.playerId,

              team:
                pendingShot.team,

              type:
                pendingShot.type,

              made:
                result === "made",

              points:
                result === "made"
                  ? getShotPoints(
                      pendingShot.type
                    )
                  : 0,

              x,

              y,

              zone:
                classifyShotZone(
                  x,
                  y
                ),

              period:
                state.game.period,

              clock:
                state.game.clock,

              timestamp: Date.now()
            });

            closeShotModal();

            render();

            toast(
              "실제 슛 위치가 기록되었습니다.",
              "success"
            );

            return;
          }

          selectShotResult(result);
        }
      );
    });

    $("#passTargetList")?.addEventListener(
      "click",
      e => {

        const button =
          e.target.closest(
            "[data-player-id]"
          );

        if (!button) return;

        registerPass(
          button.dataset.playerId
        );
      }
    );

    $$(".nav-btn").forEach(btn => {
      btn.addEventListener(
        "click",
        () => {
          state.page =
            btn.dataset.page;

          render();
        }
      );
    });

    $$(".mode-btn").forEach(btn => {
      btn.addEventListener(
        "click",
        () => {

          const newMode =
            btn.dataset.mode;

          if (
            newMode === state.mode
          ) {
            return;
          }

          if (
            state.events.length &&
            !confirm(
              "3대3/5대5 모드를 변경하면 현재 경기 기록 구조가 초기화됩니다. 계속할까요?"
            )
          ) {
            return;
          }

          state =
            createInitialState();

          state.mode =
            newMode;

          render();

          openSetup();
        }
      );
    });
  }

  function closeGenericModal() {
    $("#modalOverlay")?.classList.remove(
      "show"
    );
  }

  /* =========================================================
     CLOCK-ONLY RENDER
     ========================================================= */

  function renderClockOnly() {
    const clock =
      $(".clock-display");

    if (clock) {
      clock.textContent =
        formatTime(
          state.game.clock
        );
    }

    const shot =
      $("#shotClockValue");

    if (shot) {
      shot.textContent =
        state.game.shotClock;
    }

    const status =
      $(".clock-status");

    if (status) {
      status.textContent =
        state.game.running
          ? "RUNNING"
          : "STOPPED";
    }

    const homeScore =
      $(".score-team.home .score");

    if (homeScore) {
      homeScore.textContent =
        getTeamScore("home");
    }

    const awayScore =
      $(".score-team.away .score");

    if (awayScore) {
      awayScore.textContent =
        getTeamScore("away");
    }
  }

  /* =========================================================
     TOAST
     ========================================================= */

  function toast(
    message,
    type = "info"
  ) {
    const el =
      $("#toast");

    if (!el) return;

    const icon =
      $("#toastIcon");

    const text =
      $("#toastMessage");

    if (icon) {
      icon.textContent =
        type === "success"
          ? "✓"
          : type === "error"
            ? "!"
            : "i";
    }

    if (text) {
      text.textContent =
        message;
    }

    el.classList.remove(
      "show",
      "success",
      "error",
      "info"
    );

    el.classList.add(
      "show",
      type
    );

    clearTimeout(
      toast.timer
    );

    toast.timer =
      setTimeout(() => {
        el.classList.remove(
          "show"
        );
      }, 2500);
  }

  /* =========================================================
     UTILITIES
     ========================================================= */

  function formatPct(value) {
    if (
      value === null ||
      value === undefined ||
      Number.isNaN(value)
    ) {
      return "기록 없음";
    }

    return `${(value * 100).toFixed(1)}%`;
  }

  function formatMetric(value) {
    if (
      value === null ||
      value === undefined ||
      Number.isNaN(value)
    ) {
      return "기록 없음";
    }

    return Number(value).toFixed(1);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* =========================================================
     GLOBAL EVENTS
     ========================================================= */

  function bindGlobalEvents() {
    bindModalEvents();

    $("#confirmCancel")?.addEventListener(
      "click",
      () => {
        $("#confirmOverlay")
          ?.classList.remove("show");
      }
    );

    document.addEventListener(
      "keydown",
      e => {

        /*
          Ctrl/Cmd + Z
          마지막 기록 취소
        */

        if (
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === "z"
        ) {
          e.preventDefault();

          undoLast();
        }

        /*
          Space
          경기 시계
        */

        if (
          e.code === "Space" &&
          !isTypingTarget(e.target)
        ) {
          e.preventDefault();

          if (
            state.page === "live"
          ) {
            toggleClock();
          }
        }

      }
    );
  }

  function isTypingTarget(target) {
    if (!target) return false;

    const tag =
      target.tagName?.toLowerCase();

    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      target.isContentEditable
    );
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    loadSavedGames();

    bindGlobalEvents();

    render();

    /*
      저장된 영상 URL은 새로고침하면
      보안상 유지되지 않으므로
      파일을 다시 업로드해야 한다.
    */

    window.COURTVISION_PRO = {
      state,

      recordEvent,

      undoLast,

      saveGame,

      loadGame,

      startShot,

      startPass,

      getPlayerAdvanced,

      getTeamAdvanced,

      render
    };

    console.log(
      "%cCOURTVISION PRO v4.0 READY",
      "font-weight:bold;font-size:16px;"
    );
  }

  /* =========================================================
     START
     ========================================================= */

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();