/* =========================================================
   COURTVISION PRO
   PROFESSIONAL BASKETBALL ANALYTICS ENGINE
   app.js
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     STORAGE
     ======================================================= */

  const STORAGE_KEY = "courtv_pro_state_v4";
  const SAVED_KEY = "courtv_pro_saved_games_v4";
  const LEAGUE_KEY = "courtv_pro_league_v4";

  const clone = (obj) => JSON.parse(JSON.stringify(obj));

  function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("localStorage save failed:", err);
    }
  }


  /* =======================================================
     DEFAULT STATE
     ======================================================= */

  const DEFAULT_STATE = {
    mode: "3x3",

    page: "live",

    setupComplete: false,

    meta: {
      tournament: "",
      gameName: "",
      date: new Date().toISOString().slice(0, 10)
    },

    teams: {
      home: {
        id: "home",
        name: "HOME",
        color: "blue"
      },

      away: {
        id: "away",
        name: "AWAY",
        color: "red"
      }
    },

    players: [],

    game: {
      running: false,
      finished: false,

      period: 1,

      clock: 600,

      shotClock: 14,

      lastTick: null
    },

    events: [],

    shots: [],

    passes: [],

    savedGames: [],

    selectedPlayerId: null,

    selectedTeam: "home",

    selectedReportPlayer: null,

    shotFilters: {
      team: "all",
      player: "all",
      period: "all",
      made: "all"
    },

    pendingShot: null,

    pendingPass: null,

    video: {
      name: "",
      url: "",
      currentTime: 0
    },

    league: {
      teams: [],
      games: []
    }
  };


  let state = loadJSON(STORAGE_KEY, clone(DEFAULT_STATE));

  if (!state || typeof state !== "object") {
    state = clone(DEFAULT_STATE);
  }

  state.savedGames = loadJSON(SAVED_KEY, state.savedGames || []);
  state.league = loadJSON(LEAGUE_KEY, state.league || DEFAULT_STATE.league);


  /* =======================================================
     NORMALIZE STATE
     ======================================================= */

  function normalizeState() {
    state.mode ||= "3x3";
    state.page ||= "live";

    state.players ||= [];
    state.events ||= [];
    state.shots ||= [];
    state.passes ||= [];

    state.selectedTeam ||= "home";

    state.shotFilters ||= {
      team: "all",
      player: "all",
      period: "all",
      made: "all"
    };

    state.game ||= {
      running: false,
      finished: false,
      period: 1,
      clock: 600,
      shotClock: 14,
      lastTick: null
    };

    state.teams ||= {
      home: {
        id: "home",
        name: "HOME",
        color: "blue"
      },
      away: {
        id: "away",
        name: "AWAY",
        color: "red"
      }
    };

    state.meta ||= {
      tournament: "",
      gameName: "",
      date: new Date().toISOString().slice(0, 10)
    };

    state.video ||= {
      name: "",
      url: "",
      currentTime: 0
    };

    state.league ||= {
      teams: [],
      games: []
    };

    saveState();
  }


  function saveState() {
    saveJSON(STORAGE_KEY, state);
  }

  normalizeState();


  /* =======================================================
     DOM
     ======================================================= */

  const $ = (selector, root = document) => {
    return root.querySelector(selector);
  };

  const $$ = (selector, root = document) => {
    return [...root.querySelectorAll(selector)];
  };


  /* =======================================================
     ESCAPE HTML
     ======================================================= */

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  /* =======================================================
     TEAM / PLAYER
     ======================================================= */

  function teamPlayers(team) {
    return state.players.filter(p => p.team === team);
  }

  function getPlayer(id) {
    return state.players.find(p => p.id === id);
  }

  function getTeam(team) {
    return state.teams[team];
  }

  function playerName(id) {
    const p = getPlayer(id);
    return p ? `#${p.number} ${p.name}` : "선수";
  }

  function ensureSelectedPlayer() {
    if (
      state.selectedPlayerId &&
      getPlayer(state.selectedPlayerId)
    ) {
      return;
    }

    const home = teamPlayers("home")[0];

    if (home) {
      state.selectedPlayerId = home.id;
      state.selectedTeam = "home";
      return;
    }

    const away = teamPlayers("away")[0];

    if (away) {
      state.selectedPlayerId = away.id;
      state.selectedTeam = "away";
    }
  }


  /* =======================================================
     GAME SETTINGS
     ======================================================= */

  function periodLength() {
    return 600;
  }

  function shotClockLength() {
    return state.mode === "3x3" ? 12 : 24;
  }

  function scoringValue(type) {
    if (type === "FT") return 1;

    if (type === "2PT") {
      return state.mode === "3x3" ? 1 : 2;
    }

    if (type === "3PT") {
      return state.mode === "3x3" ? 2 : 3;
    }

    return 0;
  }


  /* =======================================================
     EVENT ENGINE
     ======================================================= */

  function addEvent(type, payload = {}) {

    const event = {
      id: uid("event"),

      type,

      team:
        payload.team ||
        getPlayer(state.selectedPlayerId)?.team ||
        state.selectedTeam,

      playerId:
        payload.playerId ||
        state.selectedPlayerId ||
        null,

      period:
        payload.period ||
        state.game.period,

      clock:
        typeof payload.clock === "number"
          ? payload.clock
          : state.game.clock,

      timestamp: Date.now(),

      ...payload
    };

    state.events.push(event);

    saveState();

    return event;
  }


  /* =======================================================
     SCORE
     ======================================================= */

  function teamScore(team) {
    return state.events
      .filter(e =>
        e.team === team &&
        e.type === "shot" &&
        e.made
      )
      .reduce((sum, e) => sum + Number(e.points || 0), 0);
  }


  function recordShot({
    playerId,
    team,
    type,
    made,
    x = null,
    y = null,
    zone = null,
    source = "live"
  }) {

    const player = getPlayer(playerId);

    if (!player) {
      toast("먼저 선수를 선택해 주세요.", "error");
      return false;
    }

    team = team || player.team;

    const points = made ? scoringValue(type) : 0;

    const shot = {
      id: uid("shot"),

      playerId,

      team,

      type,

      made: Boolean(made),

      points,

      x,
      y,

      zone:
        zone ||
        (
          x !== null && y !== null
            ? classifyShotZone(x, y)
            : "미지정"
        ),

      period: state.game.period,

      clock: state.game.clock,

      timestamp: Date.now(),

      source
    };

    state.shots.push(shot);

    addEvent("shot", {
      playerId,
      team,
      type,
      made: Boolean(made),
      points,
      shotId: shot.id,
      x,
      y,
      zone: shot.zone
    });

    if (made) {
      resetShotClock();
    }

    saveState();

    render();

    return true;
  }


  /* =======================================================
     LIVE SHOTS
     ======================================================= */

  function liveShot(type, made) {

    ensureSelectedPlayer();

    if (!state.selectedPlayerId) {
      toast("선수를 먼저 선택해 주세요.", "error");
      return;
    }

    recordShot({
      playerId: state.selectedPlayerId,
      team: state.selectedTeam,
      type,
      made,
      source: "live"
    });

    toast(
      made
        ? `${scoringValue(type)}점 성공 기록`
        : `${type} 실패 기록`,
      made ? "success" : "error"
    );
  }


  /* =======================================================
     BASIC STATS
     ======================================================= */

  function recordStat(type) {

    ensureSelectedPlayer();

    const player = getPlayer(state.selectedPlayerId);

    if (!player) {
      toast("선수를 먼저 선택해 주세요.", "error");
      return;
    }

    addEvent(type, {
      playerId: player.id,
      team: player.team
    });

    render();

    const labels = {
      REB: "리바운드",
      ORB: "공격 리바운드",
      DRB: "수비 리바운드",
      AST: "어시스트",
      STL: "스틸",
      BLK: "블록",
      TOV: "턴오버",
      PF: "파울"
    };

    toast(`${labels[type] || type} 기록`);
  }


  /* =======================================================
     PASS NETWORK
     ======================================================= */

  function beginPass() {

    ensureSelectedPlayer();

    const passer = getPlayer(state.selectedPlayerId);

    if (!passer) {
      toast("패스할 선수를 선택해 주세요.", "error");
      return;
    }

    const teammates = teamPlayers(passer.team)
      .filter(p => p.id !== passer.id);

    if (!teammates.length) {
      toast("패스를 받을 같은 팀 선수가 없습니다.", "error");
      return;
    }

    state.pendingPass = {
      passerId: passer.id,
      team: passer.team
    };

    openPassModal();
  }


  function completePass(receiverId) {

    if (!state.pendingPass) return;

    const passerId = state.pendingPass.passerId;
    const team = state.pendingPass.team;

    const receiver = getPlayer(receiverId);

    if (!receiver || receiver.team !== team) {
      toast("같은 팀 선수만 선택할 수 있습니다.", "error");
      return;
    }

    const pass = {
      id: uid("pass"),

      passerId,

      receiverId,

      team,

      period: state.game.period,

      clock: state.game.clock,

      timestamp: Date.now()
    };

    state.passes.push(pass);

    addEvent("pass", {
      playerId: passerId,
      team,
      receiverId,
      passId: pass.id
    });

    state.pendingPass = null;

    closeModal();

    saveState();

    render();

    toast(
      `${playerName(passerId)} → ${playerName(receiverId)} 패스 기록`,
      "success"
    );
  }


  /* =======================================================
     SHOT ZONE
     ======================================================= */

  function classifyShotZone(x, y) {

    /*
      x / y = 0~100

      y = 0 : 공격 골대 방향
      y = 100 : 하프코트 뒤쪽
    */

    const dx = x - 50;

    const distance =
      Math.sqrt(
        Math.pow(dx, 2) +
        Math.pow(y - 4, 2)
      );

    if (distance < 12) {
      return "림";
    }

    if (distance < 23) {
      return "페인트존";
    }

    if (y < 37) {
      if (x < 34) return "좌측 미드레인지";
      if (x > 66) return "우측 미드레인지";
      return "정면 미드레인지";
    }

    if (x < 20) return "좌측 코너 3";
    if (x > 80) return "우측 코너 3";

    if (x < 37) return "좌측 윙 3";
    if (x > 63) return "우측 윙 3";

    return "탑 3";
  }


  /* =======================================================
     SHOT CHART CLICK
     ======================================================= */

  function handleCourtClick(event) {

    const court =
      event.currentTarget;

    if (!state.pendingShot) {
      toast("먼저 성공/실패와 슛 종류를 선택해 주세요.", "error");
      return;
    }

    const rect = court.getBoundingClientRect();

    let x =
      ((event.clientX - rect.left) / rect.width) * 100;

    let y =
      ((event.clientY - rect.top) / rect.height) * 100;

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    const pending = state.pendingShot;

    const player =
      getPlayer(pending.playerId);

    if (!player) {
      toast("슛을 기록할 선수를 선택해 주세요.", "error");
      return;
    }

    recordShot({
      playerId: pending.playerId,
      team: player.team,
      type: pending.type,
      made: pending.made,
      x,
      y,
      zone: classifyShotZone(x, y),
      source: "shotchart"
    });

    state.pendingShot = null;

    saveState();

    render();

    toast("실제 코트 위치에 슛을 기록했습니다.", "success");
  }


  /* =======================================================
     SHOT STATS
     ======================================================= */

  function getPlayerStats(playerId) {

    const playerShots =
      state.shots.filter(
        s => s.playerId === playerId
      );

    const events =
      state.events.filter(
        e => e.playerId === playerId
      );

    const fgShots =
      playerShots.filter(
        s => s.type === "2PT" || s.type === "3PT"
      );

    const twoShots =
      playerShots.filter(
        s => s.type === "2PT"
      );

    const threeShots =
      playerShots.filter(
        s => s.type === "3PT"
      );

    const ftShots =
      playerShots.filter(
        s => s.type === "FT"
      );

    const FGA = fgShots.length;
    const FGM =
      fgShots.filter(s => s.made).length;

    const twoPA = twoShots.length;
    const twoPM =
      twoShots.filter(s => s.made).length;

    const threePA = threeShots.length;
    const threePM =
      threeShots.filter(s => s.made).length;

    const FTA = ftShots.length;
    const FTM =
      ftShots.filter(s => s.made).length;

    const PTS =
      playerShots.reduce(
        (sum, s) => sum + Number(s.points || 0),
        0
      );

    const REB =
      events.filter(
        e =>
          e.type === "REB" ||
          e.type === "ORB" ||
          e.type === "DRB"
      ).length;

    const ORB =
      events.filter(
        e => e.type === "ORB"
      ).length;

    const DRB =
      events.filter(
        e => e.type === "DRB"
      ).length;

    const AST =
      events.filter(
        e => e.type === "AST"
      ).length;

    const STL =
      events.filter(
        e => e.type === "STL"
      ).length;

    const BLK =
      events.filter(
        e => e.type === "BLK"
      ).length;

    const TOV =
      events.filter(
        e => e.type === "TOV"
      ).length;

    const PF =
      events.filter(
        e => e.type === "PF"
      ).length;

    const passesMade =
      state.passes.filter(
        p => p.passerId === playerId
      ).length;

    const passesReceived =
      state.passes.filter(
        p => p.receiverId === playerId
      ).length;

    const FG =
      FGA
        ? FGM / FGA
        : null;

    const twoP =
      twoPA
        ? twoPM / twoPA
        : null;

    const threeP =
      threePA
        ? threePM / threePA
        : null;

    const FT =
      FTA
        ? FTM / FTA
        : null;

    const eFG =
      FGA
        ? (FGM + 0.5 * threePM) / FGA
        : null;

    const TSden =
      2 * (FGA + 0.44 * FTA);

    const TS =
      TSden
        ? PTS / TSden
        : null;

    const usageDen =
      FGA + 0.44 * FTA + TOV;

    const usage =
      usageDen
        ? (FGA + 0.44 * FTA + TOV)
        : null;

    const ASTTO =
      TOV
        ? AST / TOV
        : AST > 0
          ? Infinity
          : null;

    return {
      PTS,

      FGM,
      FGA,
      FG,

      twoPM,
      twoPA,
      twoP,

      threePM,
      threePA,
      threeP,

      FTM,
      FTA,
      FT,

      REB,
      ORB,
      DRB,

      AST,
      STL,
      BLK,
      TOV,
      PF,

      passesMade,
      passesReceived,

      eFG,
      TS,
      usage,
      ASTTO
    };
  }


  /* =======================================================
     TEAM STATS
     ======================================================= */

  function getTeamStats(team) {

    const players =
      teamPlayers(team);

    const stats = players.map(
      p => ({
        player: p,
        stats: getPlayerStats(p.id)
      })
    );

    const sum = key =>
      stats.reduce(
        (total, row) =>
          total + Number(row.stats[key] || 0),
        0
      );

    const FGM = sum("FGM");
    const FGA = sum("FGA");

    const twoPM = sum("twoPM");
    const twoPA = sum("twoPA");

    const threePM = sum("threePM");
    const threePA = sum("threePA");

    const FTM = sum("FTM");
    const FTA = sum("FTA");

    const PTS = sum("PTS");

    const REB = sum("REB");
    const ORB = sum("ORB");
    const DRB = sum("DRB");

    const AST = sum("AST");
    const STL = sum("STL");
    const BLK = sum("BLK");
    const TOV = sum("TOV");
    const PF = sum("PF");

    const FG =
      FGA ? FGM / FGA : null;

    const twoP =
      twoPA ? twoPM / twoPA : null;

    const threeP =
      threePA ? threePM / threePA : null;

    const FT =
      FTA ? FTM / FTA : null;

    const eFG =
      FGA
        ? (FGM + 0.5 * threePM) / FGA
        : null;

    const TS =
      2 * (FGA + 0.44 * FTA)
        ? PTS /
          (2 * (FGA + 0.44 * FTA))
        : null;

    const possessions =
      FGA +
      0.44 * FTA +
      TOV -
      ORB;

    const ORtg =
      possessions > 0
        ? (PTS / possessions) * 100
        : null;

    const opponent =
      team === "home"
        ? "away"
        : "home";

    const opponentPoints =
      teamScore(opponent);

    const opponentPossessions =
      state.shots.filter(
        s =>
          s.team === opponent &&
          (
            s.type === "2PT" ||
            s.type === "3PT"
          )
      ).length +
      state.events.filter(
        e =>
          e.team === opponent &&
          e.type === "TOV"
      ).length;

    const DRtg =
      opponentPossessions > 0
        ? (opponentPoints / opponentPossessions) * 100
        : null;

    const Net =
      ORtg !== null && DRtg !== null
        ? ORtg - DRtg
        : null;

    return {
      PTS,

      FGM,
      FGA,
      FG,

      twoPM,
      twoPA,
      twoP,

      threePM,
      threePA,
      threeP,

      FTM,
      FTA,
      FT,

      REB,
      ORB,
      DRB,

      AST,
      STL,
      BLK,
      TOV,
      PF,

      eFG,
      TS,

      possessions,

      ORtg,
      DRtg,
      Net
    };
  }


  /* =======================================================
     FORMATTING
     ======================================================= */

  function pct(value) {

    if (
      value === null ||
      value === undefined ||
      Number.isNaN(value)
    ) {
      return "기록 없음";
    }

    return `${(value * 100).toFixed(1)}%`;
  }


  function number(value) {
    return Number(value || 0).toLocaleString();
  }


  function clockText(seconds) {

    seconds = Math.max(0, Math.floor(seconds));

    const m =
      Math.floor(seconds / 60);

    const s =
      seconds % 60;

    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }


  /* =======================================================
     GAME CLOCK
     ======================================================= */

  let timer = null;

  function toggleGameClock() {

    if (state.game.finished) {
      toast("종료된 경기입니다.", "error");
      return;
    }

    state.game.running =
      !state.game.running;

    state.game.lastTick =
      Date.now();

    saveState();

    if (state.game.running) {
      startTimer();
    } else {
      stopTimer();
    }

    render();
  }


  function startTimer() {

    stopTimer();

    timer =
      setInterval(() => {

        if (!state.game.running) {
          stopTimer();
          return;
        }

        const now = Date.now();

        const elapsed =
          Math.floor(
            (now - state.game.lastTick) / 1000
          );

        if (elapsed <= 0) return;

        state.game.lastTick = now;

        state.game.clock -= elapsed;
        state.game.shotClock -= elapsed;

        if (state.game.clock <= 0) {
          state.game.clock = 0;
          state.game.running = false;

          stopTimer();

          saveState();

          render();

          toast("구간이 종료되었습니다.", "success");

          return;
        }

        if (state.game.shotClock <= 0) {
          state.game.shotClock = 0;

          addEvent("shot_clock_violation", {
            team: state.selectedTeam
          });

          state.game.shotClock =
            shotClockLength();
        }

        updateClockOnly();

      }, 250);
  }


  function stopTimer() {

    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }


  function updateClockOnly() {

    const clock =
      document.querySelector("[data-game-clock]");

    const shot =
      document.querySelector("[data-shot-clock]");

    const status =
      document.querySelector("[data-game-status]");

    if (clock) {
      clock.textContent =
        clockText(state.game.clock);
    }

    if (shot) {
      shot.textContent =
        state.game.shotClock;
    }

    if (status) {
      status.textContent =
        state.game.running
          ? "경기 진행"
          : "일시정지";
    }
  }


  function resetShotClock() {

    state.game.shotClock =
      shotClockLength();

    saveState();

    updateClockOnly();
  }


  function nextPeriod() {

    if (state.game.period >= 4) {
      finishGame();
      return;
    }

    state.game.period += 1;

    state.game.clock =
      periodLength();

    state.game.shotClock =
      shotClockLength();

    state.game.running = false;

    stopTimer();

    addEvent("period_start", {
      period: state.game.period
    });

    saveState();

    render();

    toast(`${state.game.period}쿼터 시작 준비`);
  }


  function finishGame() {

    state.game.running = false;
    state.game.finished = true;

    stopTimer();

    addEvent("game_end");

    saveState();

    render();

    toast("경기가 종료되었습니다.", "success");
  }


  /* =======================================================
     SETUP
     ======================================================= */

  function openSetupModal() {

    closeModal();

    const modal =
      document.createElement("div");

    modal.id = "cvSetupModal";

    modal.className = "modal-overlay";

    modal.innerHTML = `
      <div class="setup-modal">

        <div class="modal-header">

          <div>
            <div class="modal-kicker">
              COURTVISION PRO
            </div>

            <h2>경기 설정</h2>

            <p>
              ${state.mode === "3x3" ? "3대3" : "5대5"}
              경기 분석을 시작합니다.
            </p>
          </div>

          <button
            class="icon-btn"
            data-action="close-modal"
          >×</button>

        </div>


        <div class="setup-info">
          선수 설정을 완료하지 않아도 기록 엔진은 작동합니다.
          경기 중 선수를 선택하고 슛/리바운드/어시스트 등을
          바로 기록할 수 있습니다.
        </div>


        <div class="setup-section">

          <div class="grid grid-2">

            <label class="field">
              <span>대회명</span>
              <input
                id="setupTournament"
                value="${esc(state.meta.tournament)}"
                placeholder="예: 설천고 농구 리그"
              >
            </label>

            <label class="field">
              <span>경기명</span>
              <input
                id="setupGameName"
                value="${esc(state.meta.gameName)}"
                placeholder="예: A팀 vs B팀"
              >
            </label>

          </div>

        </div>


        <div class="setup-section">

          <div class="setup-grid two">

            ${setupTeamHTML("home")}

            ${setupTeamHTML("away")}

          </div>

        </div>


        <div class="modal-footer">

          <button
            class="btn secondary"
            data-action="close-modal"
          >
            취소
          </button>

          <button
            class="btn primary"
            data-action="apply-setup"
          >
            저장하고 시작하기
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(modal);
  }


  function setupTeamHTML(team) {

    const existing =
      teamPlayers(team);

    const minimum =
      state.mode === "3x3"
        ? 3
        : 5;

    const count =
      Math.max(minimum, existing.length);

    const teamData =
      getTeam(team);

    let rows = "";

    for (let i = 0; i < count; i++) {

      const player =
        existing[i];

      rows += `
        <div class="roster-row">

          <input
            class="setup-number"
            data-team="${team}"
            data-index="${i}"
            value="${esc(player?.number || i + 1)}"
            inputmode="numeric"
            placeholder="번호"
          >

          <input
            class="setup-name"
            data-team="${team}"
            data-index="${i}"
            value="${esc(player?.name || "")}"
            placeholder="${i + 1}번 선수 이름"
          >

        </div>
      `;
    }

    return `
      <div class="team-setup ${team}">

        <div class="team-title">

          <span
            class="team-dot ${team === "home"
              ? "home-dot"
              : "away-dot"}"
          ></span>

          <strong>
            ${team === "home" ? "A팀 / HOME" : "B팀 / AWAY"}
          </strong>

        </div>

        <label class="field">

          <span>팀 이름</span>

          <input
            class="setup-team-name"
            data-team="${team}"
            value="${esc(teamData.name)}"
            placeholder="팀 이름"
          >

        </label>

        <div class="roster-list">
          ${rows}
        </div>

      </div>
    `;
  }


  function applySetup() {

    const tournament =
      $("#setupTournament")?.value.trim() || "";

    const gameName =
      $("#setupGameName")?.value.trim() || "";

    state.meta.tournament =
      tournament;

    state.meta.gameName =
      gameName;

    state.players = [];

    ["home", "away"].forEach(team => {

      const teamName =
        $(`.setup-team-name[data-team="${team}"]`)
          ?.value.trim();

      state.teams[team].name =
        teamName ||
        (team === "home" ? "HOME" : "AWAY");

      const names =
        $$(".setup-name")
          .filter(
            input =>
              input.dataset.team === team
          );

      names.forEach((nameInput, index) => {

        const name =
          nameInput.value.trim();

        const numberInput =
          $(
            `.setup-number[data-team="${team}"][data-index="${index}"]`
          );

        const number =
          numberInput?.value.trim() ||
          String(index + 1);

        if (!name) return;

        state.players.push({
          id: uid("player"),

          team,

          number,

          name,

          active: true
        });
      });
    });

    state.setupComplete = true;

    state.game = {
      running: false,
      finished: false,
      period: 1,
      clock: periodLength(),
      shotClock: shotClockLength(),
      lastTick: null
    };

    state.events = [];
    state.shots = [];
    state.passes = [];

    state.selectedPlayerId =
      state.players[0]?.id || null;

    state.selectedTeam =
      state.players[0]?.team || "home";

    saveState();

    closeModal();

    render();

    toast("경기 설정이 완료되었습니다.", "success");
  }


  /* =======================================================
     MODE
     ======================================================= */

  function changeMode(mode) {

    if (mode === state.mode) return;

    if (
      state.events.length ||
      state.shots.length
    ) {
      const ok =
        confirm(
          "현재 경기 기록이 있습니다.\n모드를 바꾸면 현재 경기 기록이 초기화됩니다. 계속할까요?"
        );

      if (!ok) return;
    }

    stopTimer();

    state.mode = mode;

    state.setupComplete = false;

    state.players = [];

    state.events = [];

    state.shots = [];

    state.passes = [];

    state.selectedPlayerId = null;

    state.game = {
      running: false,
      finished: false,
      period: 1,
      clock: periodLength(),
      shotClock: shotClockLength(),
      lastTick: null
    };

    saveState();

    render();

    openSetupModal();
  }


  /* =======================================================
     SAVE GAME
     ======================================================= */

  function saveCurrentGame() {

    if (
      !state.setupComplete &&
      !state.events.length &&
      !state.shots.length
    ) {
      toast("저장할 경기 기록이 없습니다.", "error");
      return;
    }

    const snapshot =
      clone({
        mode: state.mode,
        meta: state.meta,
        teams: state.teams,
        players: state.players,
        game: state.game,
        events: state.events,
        shots: state.shots,
        passes: state.passes
      });

    snapshot.id =
      uid("game");

    snapshot.savedAt =
      new Date().toISOString();

    state.savedGames.unshift(snapshot);

    state.savedGames =
      state.savedGames.slice(0, 50);

    saveJSON(SAVED_KEY, state.savedGames);

    toast("경기를 저장했습니다.", "success");
  }


  /* =======================================================
     RESET
     ======================================================= */

  function resetApp() {

    const ok =
      confirm(
        "현재 경기와 선수 기록을 모두 초기화할까요?"
      );

    if (!ok) return;

    stopTimer();

    const saved =
      state.savedGames;

    const league =
      state.league;

    state =
      clone(DEFAULT_STATE);

    state.savedGames = saved;
    state.league = league;

    saveState();

    render();

    toast("현재 경기를 초기화했습니다.");
  }


  /* =======================================================
     PLAYER SELECT
     ======================================================= */

  function selectPlayer(playerId) {

    const player =
      getPlayer(playerId);

    if (!player) return;

    state.selectedPlayerId =
      player.id;

    state.selectedTeam =
      player.team;

    saveState();

    render();
  }


  /* =======================================================
     MODALS
     ======================================================= */

  function closeModal() {

    $$(".modal-overlay")
      .forEach(el => el.remove());
  }


  function openPassModal() {

    closeModal();

    const passer =
      getPlayer(
        state.pendingPass?.passerId
      );

    if (!passer) return;

    const teammates =
      teamPlayers(passer.team)
        .filter(p => p.id !== passer.id);

    const modal =
      document.createElement("div");

    modal.className =
      "modal-overlay";

    modal.innerHTML = `

      <div class="small-modal">

        <div class="modal-header">

          <div>
            <div class="modal-kicker">
              PASS NETWORK
            </div>

            <h2>패스 수신 선수</h2>

            <p>
              ${esc(playerName(passer.id))}
              → 수신 선수 선택
            </p>
          </div>

          <button
            class="icon-btn"
            data-action="close-modal"
          >×</button>

        </div>


        <div class="pass-receiver-list">

          ${teammates.map(p => `
            <button
              class="pass-receiver-btn"
              data-action="complete-pass"
              data-player-id="${p.id}"
            >
              #${esc(p.number)}
              ${esc(p.name)}
            </button>
          `).join("")}

        </div>

      </div>
    `;

    document.body.appendChild(modal);
  }


  /* =======================================================
     SHOT MODAL
     ======================================================= */

  function openShotModal() {

    ensureSelectedPlayer();

    const player =
      getPlayer(state.selectedPlayerId);

    if (!player) {
      toast("먼저 선수를 선택해 주세요.", "error");
      return;
    }

    state.pendingShot = {
      playerId: player.id,
      team: player.team,
      made: null,
      type: null
    };

    closeModal();

    const modal =
      document.createElement("div");

    modal.className =
      "modal-overlay";

    modal.innerHTML = `

      <div class="shot-modal">

        <div class="modal-header">

          <div>
            <div class="modal-kicker">
              SHOT CHART
            </div>

            <h2>슛 기록</h2>

            <p>
              ${esc(playerName(player.id))}
              · 실제 코트 위치를 클릭하세요.
            </p>
          </div>

          <button
            class="icon-btn"
            data-action="close-shot-modal"
          >×</button>

        </div>


        <div class="shot-result-grid">

          <button
            class="shot-result success"
            data-action="shot-made"
          >
            ✓ 슛 성공
          </button>

          <button
            class="shot-result miss"
            data-action="shot-missed"
          >
            × 슛 실패
          </button>

        </div>


        <div class="shot-type-grid">

          <button
            class="shot-type-btn"
            data-action="shot-type"
            data-shot-type="FT"
          >
            자유투
          </button>

          <button
            class="shot-type-btn"
            data-action="shot-type"
            data-shot-type="2PT"
          >
            ${state.mode === "3x3" ? "1점 필드골" : "2점 필드골"}
          </button>

          <button
            class="shot-type-btn"
            data-action="shot-type"
            data-shot-type="3PT"
          >
            ${state.mode === "3x3" ? "2점 필드골" : "3점 필드골"}
          </button>

        </div>


        <div class="shot-location-area">

          <div
            id="shotModalCourt"
            class="basketball-court shot-court-container"
            data-court-click
          >

            ${courtHTML()}

          </div>

        </div>

      </div>
    `;

    document.body.appendChild(modal);
  }


  function setPendingMade(value) {

    if (!state.pendingShot) return;

    state.pendingShot.made =
      value;

    renderShotModalState();
  }


  function setPendingType(type) {

    if (!state.pendingShot) return;

    state.pendingShot.type =
      type;

    renderShotModalState();
  }


  function renderShotModalState() {

    const modal =
      $(".shot-modal");

    if (!modal) return;

    $$(".shot-result", modal)
      .forEach(btn => {
        btn.classList.remove("active");
      });

    if (
      state.pendingShot?.made === true
    ) {
      $(".shot-result.success", modal)
        ?.classList.add("active");
    }

    if (
      state.pendingShot?.made === false
    ) {
      $(".shot-result.miss", modal)
        ?.classList.add("active");
    }

    $$(".shot-type-btn", modal)
      .forEach(btn => {

        btn.classList.toggle(
          "active",
          btn.dataset.shotType ===
          state.pendingShot?.type
        );
      });
  }


  /* =======================================================
     COURT HTML
     ======================================================= */

  function courtHTML(markers = []) {

    return `

      <div class="court-line court-boundary"></div>

      <div class="court-line court-paint"></div>

      <div class="free-throw-line"></div>

      <div class="restricted-area"></div>

      <div class="court-backboard"></div>

      <div class="court-rim"></div>

      <div class="three-point-arc"></div>

      <div class="three-left-line"></div>

      <div class="three-right-line"></div>

      <div class="half-court-line"></div>

      <div class="center-circle"></div>

      ${markers.map(renderShotMarker).join("")}

    `;
  }


  function renderShotMarker(shot) {

    if (
      shot.x === null ||
      shot.y === null
    ) {
      return "";
    }

    return `
      <div
        class="shot-marker ${
          shot.made
            ? "made"
            : "missed"
        }"
        style="
          left:${shot.x}%;
          top:${shot.y}%;
        "
        title="${esc(shot.zone)}"
      ></div>
    `;
  }


  /* =======================================================
     SHOT PAGE
     ======================================================= */

  function filteredShots() {

    return state.shots.filter(shot => {

      if (
        state.shotFilters.team !== "all" &&
        shot.team !== state.shotFilters.team
      ) {
        return false;
      }

      if (
        state.shotFilters.player !== "all" &&
        shot.playerId !== state.shotFilters.player
      ) {
        return false;
      }

      if (
        state.shotFilters.period !== "all" &&
        String(shot.period) !==
        String(state.shotFilters.period)
      ) {
        return false;
      }

      if (
        state.shotFilters.made !== "all" &&
        String(shot.made) !==
        String(state.shotFilters.made)
      ) {
        return false;
      }

      return true;
    });
  }


  function renderShotChart() {

    const shots =
      filteredShots();

    const selected =
      state.selectedPlayerId
        ? getPlayerStats(state.selectedPlayerId)
        : null;

    const court =
      courtHTML(shots);

    const FGA =
      shots.filter(
        s =>
          s.type === "2PT" ||
          s.type === "3PT"
      ).length;

    const FGM =
      shots.filter(
        s =>
          s.made &&
          (
            s.type === "2PT" ||
            s.type === "3PT"
          )
      ).length;

    const threePA =
      shots.filter(
        s => s.type === "3PT"
      ).length;

    const threePM =
      shots.filter(
        s =>
          s.type === "3PT" &&
          s.made
      ).length;

    const twoPA =
      shots.filter(
        s => s.type === "2PT"
      ).length;

    const twoPM =
      shots.filter(
        s =>
          s.type === "2PT" &&
          s.made
      ).length;

    const FTA =
      shots.filter(
        s => s.type === "FT"
      ).length;

    const FTM =
      shots.filter(
        s =>
          s.type === "FT" &&
          s.made
      ).length;

    const points =
      shots.reduce(
        (sum, s) =>
          sum + Number(s.points || 0),
        0
      );

    const heat =
      shots.filter(
        s =>
          s.x !== null &&
          s.y !== null
      );

    return `

      <div class="page">

        <div class="page-title">

          <div class="eyebrow">
            COURTVISION PRO / SHOT ANALYTICS
          </div>

          <h1>슛차트</h1>

          <p>
            실제 코트 좌표 기반 슛 분포 · 성공/실패 · 존별 효율
          </p>

        </div>


        <div class="shot-page-layout">

          <section class="card shot-court-card">

            <div class="card-header">

              <div>
                <h2>실제 코트 슛차트</h2>

                <p>
                  성공 = ●
                  · 실패 = ×
                  · 히트맵 = 실제 슛 좌표 밀도
                </p>
              </div>

              <button
                class="btn primary"
                data-action="open-shot-modal"
              >
                + 슛 기록
              </button>

            </div>


            <div
              class="shot-court-container basketball-court"
              data-court-click
            >

              ${court}

              ${heat
                .map(
                  s => `
                    <div
                      class="heat-point"
                      style="
                        left:${s.x}%;
                        top:${s.y}%;
                      "
                    ></div>
                  `
                )
                .join("")}

              ${shots
                .map(renderShotMarker)
                .join("")}

            </div>


            <div class="shot-instruction">
              <strong>기록 방법:</strong>
              선수 선택 → 성공/실패 → 슛 종류 →
              실제 슛 위치 클릭
            </div>

          </section>


          <section>

            <div class="card">

              <div class="card-header">

                <div>
                  <h2>필터</h2>
                  <p>분석할 슛 데이터를 선택하세요.</p>
                </div>

              </div>

              <div class="card-body">

                ${shotFiltersHTML()}

              </div>

            </div>


            <div
              class="card"
              style="margin-top:16px;"
            >

              <div class="card-header">

                <div>
                  <h2>슈팅 요약</h2>
                </div>

              </div>

              <div class="card-body">

                <div class="stat-grid">

                  ${statTile("시도", FGA + FTA)}

                  ${statTile("성공", FGM + FTM)}

                  ${statTile(
                    "FG%",
                    FGA
                      ? pct(FGM / FGA)
                      : "기록 없음"
                  )}

                  ${statTile(
                    "2P",
                    `${twoPM}/${twoPA}`
                  )}

                  ${statTile(
                    "3P",
                    `${threePM}/${threePA}`
                  )}

                  ${statTile(
                    "득점",
                    points
                  )}

                </div>

              </div>

            </div>


            <div
              class="card"
              style="margin-top:16px;"
            >

              <div class="card-header">

                <div>
                  <h2>구역별 슛 기록</h2>
                  <p>실제 입력된 좌표를 자동 분류합니다.</p>
                </div>

              </div>

              <div class="card-body">

                ${zoneTableHTML(shots)}

              </div>

            </div>

          </section>

        </div>

      </div>
    `;
  }


  function statTile(label, value) {

    return `
      <div class="stat-tile">

        <div class="label">
          ${esc(label)}
        </div>

        <div class="value">
          ${esc(value)}
        </div>

      </div>
    `;
  }


  function shotFiltersHTML() {

    return `

      <div class="filter-bar">

        <select
          class="filter-select"
          data-shot-filter="team"
        >

          <option value="all"
            ${state.shotFilters.team === "all" ? "selected" : ""}
          >
            전체 팀
          </option>

          <option value="home"
            ${state.shotFilters.team === "home" ? "selected" : ""}
          >
            ${esc(state.teams.home.name)}
          </option>

          <option value="away"
            ${state.shotFilters.team === "away" ? "selected" : ""}
          >
            ${esc(state.teams.away.name)}
          </option>

        </select>


        <select
          class="filter-select"
          data-shot-filter="player"
        >

          <option value="all">
            전체 선수
          </option>

          ${state.players.map(p => `
            <option
              value="${p.id}"
              ${state.shotFilters.player === p.id ? "selected" : ""}
            >
              #${esc(p.number)} ${esc(p.name)}
            </option>
          `).join("")}

        </select>


        <select
          class="filter-select"
          data-shot-filter="period"
        >

          <option value="all">전체 구간</option>

          ${[1,2,3,4].map(q => `
            <option
              value="${q}"
              ${String(state.shotFilters.period) === String(q) ? "selected" : ""}
            >
              ${q}Q
            </option>
          `).join("")}

        </select>


        <select
          class="filter-select"
          data-shot-filter="made"
        >

          <option value="all"
            ${state.shotFilters.made === "all" ? "selected" : ""}
          >
            성공 + 실패
          </option>

          <option value="true"
            ${state.shotFilters.made === "true" ? "selected" : ""}
          >
            성공
          </option>

          <option value="false"
            ${state.shotFilters.made === "false" ? "selected" : ""}
          >
            실패
          </option>

        </select>

      </div>
    `;
  }


  function zoneTableHTML(shots) {

    const zones = [
      "림",
      "페인트존",
      "좌측 미드레인지",
      "정면 미드레인지",
      "우측 미드레인지",
      "좌측 코너 3",
      "우측 코너 3",
      "좌측 윙 3",
      "탑 3",
      "우측 윙 3",
      "미지정"
    ];

    return `

      <div class="table-wrap">

        <table class="zone-table">

          <thead>
            <tr>
              <th>구역</th>
              <th>시도</th>
              <th>성공</th>
              <th>실패</th>
              <th>FG%</th>
            </tr>
          </thead>

          <tbody>

            ${zones.map(zone => {

              const list =
                shots.filter(
                  s => s.zone === zone
                );

              const attempts =
                list.length;

              const makes =
                list.filter(
                  s => s.made
                ).length;

              return `
                <tr>

                  <td>${esc(zone)}</td>

                  <td>${attempts}</td>

                  <td>${makes}</td>

                  <td>${attempts - makes}</td>

                  <td>
                    ${
                      attempts
                        ? pct(makes / attempts)
                        : "기록 없음"
                    }
                  </td>

                </tr>
              `;

            }).join("")}

          </tbody>

        </table>

      </div>
    `;
  }


  /* =======================================================
     RECORD PAGE
     ======================================================= */

  function renderRecords() {

    return `

      <div class="page">

        <div class="page-title">

          <div class="eyebrow">
            BOX SCORE
          </div>

          <h1>선수 기록</h1>

          <p>
            현재 경기에서 실제 입력된 기록만 표시합니다.
          </p>

        </div>


        <div class="card">

          <div class="card-header">

            <div>
              <h2>
                ${esc(state.meta.gameName || "현재 경기")}
              </h2>

              <p>
                ${esc(state.teams.home.name)}
                vs
                ${esc(state.teams.away.name)}
              </p>
            </div>

            <button
              class="btn secondary"
              data-action="export-csv"
            >
              CSV 내보내기
            </button>

          </div>


          <div class="card-body">

            ${recordTableHTML("home")}

            <div style="height:16px;"></div>

            ${recordTableHTML("away")}

          </div>

        </div>

      </div>
    `;
  }


  function recordTableHTML(team) {

    const players =
      teamPlayers(team);

    return `

      <div class="table-wrap">

        <table class="data-table">

          <thead>
            <tr>

              <th>선수</th>
              <th>팀</th>
              <th>PTS</th>
              <th>FG</th>
              <th>FG%</th>
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

            ${
              players.length
                ? players.map(p => {

                    const s =
                      getPlayerStats(p.id);

                    return `
                      <tr>

                        <td>
                          #${esc(p.number)}
                          ${esc(p.name)}
                        </td>

                        <td>
                          ${team === "home"
                            ? "HOME"
                            : "AWAY"}
                        </td>

                        <td>${s.PTS}</td>

                        <td>
                          ${s.FGM}/${s.FGA}
                        </td>

                        <td>
                          ${pct(s.FG)}
                        </td>

                        <td>
                          ${s.twoPM}/${s.twoPA}
                        </td>

                        <td>
                          ${s.threePM}/${s.threePA}
                        </td>

                        <td>
                          ${s.FTM}/${s.FTA}
                        </td>

                        <td>${s.REB}</td>

                        <td>${s.AST}</td>

                        <td>${s.STL}</td>

                        <td>${s.BLK}</td>

                        <td>${s.TOV}</td>

                        <td>${s.PF}</td>

                      </tr>
                    `;

                  }).join("")
                : `
                  <tr>
                    <td colspan="14">
                      기록 없음
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;
  }


  /* =======================================================
     STRATEGY
     ======================================================= */

  function renderStrategy() {

    const home =
      getTeamStats("home");

    const away =
      getTeamStats("away");

    return `

      <div class="page">

        <div class="page-title">

          <div class="eyebrow">
            TEAM ANALYTICS
          </div>

          <h1>전력분석</h1>

          <p>
            공격 · 수비 · 슈팅 · 패스 네트워크를
            실제 경기 데이터로 분석합니다.
          </p>

        </div>


        <div class="grid grid-2">

          ${teamAnalyticsCard(
            "home",
            home
          )}

          ${teamAnalyticsCard(
            "away",
            away
          )}

        </div>


        <div
          class="grid grid-2"
          style="margin-top:16px;"
        >

          <div class="card">

            <div class="card-header">
              <div>
                <h2>팀 비교</h2>
                <p>현재 경기 입력 데이터</p>
              </div>
            </div>

            <div class="card-body">

              ${comparisonHTML(home, away)}

            </div>

          </div>


          <div class="card">

            <div class="card-header">
              <div>
                <h2>패스 네트워크</h2>
                <p>실제 패스 기록 기반</p>
              </div>
            </div>

            <div class="card-body">

              ${passNetworkHTML()}

            </div>

          </div>

        </div>


        <div
          class="card"
          style="margin-top:16px;"
        >

          <div class="card-header">

            <div>
              <h2>선수별 전력 지표</h2>
            </div>

          </div>

          <div class="card-body">

            ${playerAnalyticsTable()}

          </div>

        </div>

      </div>
    `;
  }


  function teamAnalyticsCard(team, stats) {

    return `

      <div class="card">

        <div class="card-header">

          <div>
            <h2>
              ${esc(getTeam(team).name)}
            </h2>

            <p>
              ${team === "home" ? "HOME" : "AWAY"}
            </p>
          </div>

          <span
            class="badge ${team === "home" ? "blue" : "red"}"
          >
            TEAM
          </span>

        </div>

        <div class="card-body">

          ${metricRow("PTS", stats.PTS)}

          ${metricRow(
            "FG%",
            pct(stats.FG)
          )}

          ${metricRow(
            "2P%",
            pct(stats.twoP)
          )}

          ${metricRow(
            "3P%",
            pct(stats.threeP)
          )}

          ${metricRow(
            "FT%",
            pct(stats.FT)
          )}

          ${metricRow(
            "eFG%",
            pct(stats.eFG)
          )}

          ${metricRow(
            "TS%",
            pct(stats.TS)
          )}

          ${metricRow(
            "ORtg",
            stats.ORtg === null
              ? "기록 없음"
              : stats.ORtg.toFixed(1)
          )}

          ${metricRow(
            "DRtg",
            stats.DRtg === null
              ? "기록 없음"
              : stats.DRtg.toFixed(1)
          )}

          ${metricRow(
            "Net Rating",
            stats.Net === null
              ? "기록 없음"
              : stats.Net.toFixed(1)
          )}

        </div>

      </div>
    `;
  }


  function metricRow(label, value) {

    return `
      <div class="metric-row">

        <span>${esc(label)}</span>

        <span>${esc(value)}</span>

      </div>
    `;
  }


  function comparisonHTML(home, away) {

    const rows = [
      ["득점", home.PTS, away.PTS],
      ["FG%", home.FG, away.FG],
      ["2P%", home.twoP, away.twoP],
      ["3P%", home.threeP, away.threeP],
      ["REB", home.REB, away.REB],
      ["AST", home.AST, away.AST],
      ["STL", home.STL, away.STL],
      ["BLK", home.BLK, away.BLK],
      ["TOV", home.TOV, away.TOV]
    ];

    return rows.map(([label, h, a]) => {

      const hn =
        typeof h === "number"
          ? h
          : 0;

      const an =
        typeof a === "number"
          ? a
          : 0;

      const max =
        Math.max(hn, an, 1);

      return `

        <div class="comparison-row">

          <div class="comparison-value home">
            ${
              label.includes("%")
                ? pct(h)
                : h
            }
          </div>

          <div class="comparison-bar home">
            <div style="width:${(hn / max) * 100}%"></div>
          </div>

          <div class="comparison-label">
            ${esc(label)}
          </div>

          <div class="comparison-bar away">
            <div style="width:${(an / max) * 100}%"></div>
          </div>

          <div class="comparison-value away">
            ${
              label.includes("%")
                ? pct(a)
                : a
            }
          </div>

        </div>
      `;

    }).join("");
  }


  function playerAnalyticsTable() {

    return `

      <div class="table-wrap">

        <table class="data-table">

          <thead>

            <tr>
              <th>선수</th>
              <th>PTS</th>
              <th>FG%</th>
              <th>2P%</th>
              <th>3P%</th>
              <th>eFG%</th>
              <th>TS%</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TOV</th>
              <th>패스</th>
            </tr>

          </thead>

          <tbody>

            ${state.players.map(p => {

              const s =
                getPlayerStats(p.id);

              return `

                <tr>

                  <td>
                    #${esc(p.number)}
                    ${esc(p.name)}
                  </td>

                  <td>${s.PTS}</td>

                  <td>${pct(s.FG)}</td>

                  <td>${pct(s.twoP)}</td>

                  <td>${pct(s.threeP)}</td>

                  <td>${pct(s.eFG)}</td>

                  <td>${pct(s.TS)}</td>

                  <td>${s.REB}</td>

                  <td>${s.AST}</td>

                  <td>${s.STL}</td>

                  <td>${s.BLK}</td>

                  <td>${s.TOV}</td>

                  <td>
                    ${s.passesMade}
                  </td>

                </tr>
              `;

            }).join("")}

          </tbody>

        </table>

      </div>
    `;
  }


  /* =======================================================
     PASS NETWORK
     ======================================================= */

  function passNetworkHTML() {

    if (!state.passes.length) {
      return `
        <div class="empty-state">
          패스 기록 없음
        </div>
      `;
    }

    const counts = {};

    state.passes.forEach(p => {

      const key =
        `${p.passerId}_${p.receiverId}`;

      counts[key] =
        (counts[key] || 0) + 1;
    });

    return `

      <div class="leader-list">

        ${Object.entries(counts)
          .sort((a,b) => b[1] - a[1])
          .map(([key, count]) => {

            const [
              passer,
              receiver
            ] = key.split("_");

            return `

              <div class="leader-item">

                <div class="leader-left">

                  <div class="leader-rank">
                    PASS
                  </div>

                  <div class="leader-name">
                    ${esc(playerName(passer))}
                    →
                    ${esc(playerName(receiver))}
                  </div>

                </div>

                <div class="leader-value">
                  ${count}
                </div>

              </div>
            `;

          }).join("")}

      </div>
    `;
  }


  /* =======================================================
     REPORT
     ======================================================= */

  function renderReport() {

    const home =
      getTeamStats("home");

    const away =
      getTeamStats("away");

    const allPlayers =
      state.players;

    const top =
      [...allPlayers]
        .sort(
          (a,b) =>
            getPlayerStats(b.id).PTS -
            getPlayerStats(a.id).PTS
        );

    return `

      <div class="page">

        <div class="page-title">

          <div class="eyebrow">
            GAME + TEAM REPORT
          </div>

          <h1>경기 + 팀 리포트</h1>

          <p>
            실제 입력된 경기 데이터를 종합 분석합니다.
          </p>

        </div>


        <div class="grid grid-main">

          <div class="card">

            <div class="card-header">

              <div>
                <h2>경기 요약</h2>
                <p>
                  ${esc(state.meta.gameName || "현재 경기")}
                </p>
              </div>

            </div>

            <div class="scoreboard">

              ${reportTeamScore(
                "home",
                home.PTS
              )}

              <div class="score-center">

                <div class="period-label">
                  ${state.mode === "3x3"
                    ? "3X3"
                    : "5X5"}
                </div>

                <div class="game-clock">
                  ${home.PTS} - ${away.PTS}
                </div>

                <div class="game-status">
                  ${
                    state.game.finished
                      ? "경기 종료"
                      : "현재 경기"
                  }
                </div>

              </div>

              ${reportTeamScore(
                "away",
                away.PTS
              )}

            </div>

          </div>


          <div class="card">

            <div class="card-header">
              <div>
                <h2>주요 기록 비교</h2>
              </div>
            </div>

            <div class="card-body">

              ${comparisonHTML(home, away)}

            </div>

          </div>

        </div>


        <div
          class="grid grid-2"
          style="margin-top:16px;"
        >

          <div class="card">

            <div class="card-header">
              <div>
                <h2>팀 공격 지표</h2>
              </div>
            </div>

            <div class="card-body">

              ${metricRow("HOME FG%", pct(home.FG))}
              ${metricRow("HOME 3P%", pct(home.threeP))}
              ${metricRow("HOME eFG%", pct(home.eFG))}
              ${metricRow("HOME TS%", pct(home.TS))}
              ${metricRow(
                "HOME ORtg",
                home.ORtg === null
                  ? "기록 없음"
                  : home.ORtg.toFixed(1)
              )}

              <div style="height:10px;"></div>

              ${metricRow("AWAY FG%", pct(away.FG))}
              ${metricRow("AWAY 3P%", pct(away.threeP))}
              ${metricRow("AWAY eFG%", pct(away.eFG))}
              ${metricRow("AWAY TS%", pct(away.TS))}
              ${metricRow(
                "AWAY ORtg",
                away.ORtg === null
                  ? "기록 없음"
                  : away.ORtg.toFixed(1)
              )}

            </div>

          </div>


          <div class="card">

            <div class="card-header">
              <div>
                <h2>주요 선수</h2>
              </div>
            </div>

            <div class="card-body">

              ${
                top.length
                  ? `
                    <div class="leader-list">

                      ${top.map(p => {

                        const s =
                          getPlayerStats(p.id);

                        return `
                          <div class="leader-item">

                            <div class="leader-left">

                              <div class="leader-rank">
                                #${esc(p.number)}
                              </div>

                              <div class="leader-name">
                                ${esc(p.name)}
                              </div>

                            </div>

                            <div class="leader-value">
                              ${s.PTS}점
                              · ${s.REB}R
                              · ${s.AST}A
                            </div>

                          </div>
                        `;

                      }).join("")}

                    </div>
                  `
                  : `
                    <div class="empty-state">
                      기록 없음
                    </div>
                  `
              }

            </div>

          </div>

        </div>


        <div
          class="card"
          style="margin-top:16px;"
        >

          <div class="card-header">

            <div>
              <h2>개인 리포트</h2>
              <p>선수를 선택하면 상세 분석을 확인합니다.</p>
            </div>

          </div>

          <div class="card-body">

            <div class="filter-bar">

              <select
                class="filter-select"
                data-report-player
              >

                <option value="">
                  선수 선택
                </option>

                ${state.players.map(p => `
                  <option
                    value="${p.id}"
                    ${state.selectedReportPlayer === p.id
                      ? "selected"
                      : ""}
                  >
                    #${esc(p.number)}
                    ${esc(p.name)}
                  </option>
                `).join("")}

              </select>

            </div>


            ${
              state.selectedReportPlayer
                ? individualReportHTML(
                    state.selectedReportPlayer
                  )
                : `
                  <div
                    class="empty-state"
                    style="margin-top:12px;"
                  >
                    선수를 선택하세요.
                  </div>
                `
            }

          </div>

        </div>

      </div>
    `;
  }


  function reportTeamScore(team, score) {

    return `

      <div class="score-team ${team}">

        <div class="team-label">
          ${team === "home" ? "A TEAM" : "B TEAM"}
        </div>

        <div class="team-name">
          ${esc(getTeam(team).name)}
        </div>

        <div class="score">
          ${score}
        </div>

      </div>
    `;
  }


  function individualReportHTML(playerId) {

    const player =
      getPlayer(playerId);

    if (!player) {
      return "";
    }

    const s =
      getPlayerStats(playerId);

    const shots =
      state.shots.filter(
        x => x.playerId === playerId
      );

    return `

      <div
        class="grid grid-2"
        style="margin-top:16px;"
      >

        <div>

          <h3
            style="
              margin-bottom:12px;
              font-size:18px;
            "
          >
            #${esc(player.number)}
            ${esc(player.name)}
          </h3>

          <div class="stat-grid">

            ${statTile("PTS", s.PTS)}

            ${statTile("REB", s.REB)}

            ${statTile("AST", s.AST)}

            ${statTile("STL", s.STL)}

            ${statTile("BLK", s.BLK)}

            ${statTile("TOV", s.TOV)}

          </div>

        </div>


        <div>

          ${metricRow("FG%", pct(s.FG))}
          ${metricRow("2P%", pct(s.twoP))}
          ${metricRow("3P%", pct(s.threeP))}
          ${metricRow("FT%", pct(s.FT))}
          ${metricRow("eFG%", pct(s.eFG))}
          ${metricRow("TS%", pct(s.TS))}
          ${metricRow("패스", s.passesMade)}
          ${metricRow("패스 수신", s.passesReceived)}

        </div>

      </div>


      <div style="margin-top:16px;">

        <div class="basketball-court">

          ${courtHTML()}

          ${shots
            .filter(
              s =>
                s.x !== null &&
                s.y !== null
            )
            .map(renderShotMarker)
            .join("")}

        </div>

      </div>

    `;
  }


  /* =======================================================
     VIDEO
     ======================================================= */

  function renderVideo() {

    return `

      <div class="page">

        <div class="page-title">

          <div class="eyebrow">
            VIDEO ANALYSIS
          </div>

          <h1>영상 분석</h1>

          <p>
            경기 영상을 불러와 재생 · 일시정지 · 구간 분석을 할 수 있습니다.
          </p>

        </div>


        <div class="video-layout">

          <div class="card">

            <div class="card-header">

              <div>
                <h2>영상 업로드</h2>
                <p>
                  브라우저에서만 처리됩니다.
                </p>
              </div>

            </div>

            <div class="card-body">

              <div class="video-upload">

                <div class="video-upload-icon">
                  ▶
                </div>

                <h3>
                  분석할 영상을 선택하세요.
                </h3>

                <p>
                  MP4 / MOV / AVI 등 브라우저가 지원하는 영상
                </p>

                <label
                  class="btn primary"
                  style="margin-top:18px;"
                >
                  영상 선택

                  <input
                    type="file"
                    accept="video/*"
                    data-video-input
                    hidden
                  >

                </label>

                ${
                  state.video.name
                    ? `
                      <div
                        style="
                          margin-top:12px;
                          color:#7f9ab3;
                          font-size:11px;
                        "
                      >
                        ${esc(state.video.name)}
                      </div>
                    `
                    : ""
                }

              </div>

            </div>

          </div>


          <div class="card">

            <div class="card-header">

              <div>
                <h2>재생 화면</h2>
              </div>

              <span class="badge">
                VIDEO
              </span>

            </div>

            <div class="card-body">

              <div class="video-player">

                ${
                  state.video.url
                    ? `
                      <video
                        id="analysisVideo"
                        controls
                        playsinline
                        src="${state.video.url}"
                      ></video>
                    `
                    : `
                      <div class="video-placeholder">
                        영상을 선택하면 여기에 표시됩니다.
                      </div>
                    `
                }

              </div>


              <div class="video-tools">

                <button
                  class="btn"
                  data-action="video-slower"
                >
                  0.5×
                </button>

                <button
                  class="btn"
                  data-action="video-normal"
                >
                  1.0×
                </button>

                <button
                  class="btn"
                  data-action="video-faster"
                >
                  2.0×
                </button>

              </div>

            </div>

          </div>

        </div>

      </div>
    `;
  }


  /* =======================================================
     LEAGUE
     ======================================================= */

  function renderLeague() {

    const teams =
      state.league.teams;

    return `

      <div class="page">

        <div class="page-title">

          <div class="eyebrow">
            LEAGUE MANAGEMENT
          </div>

          <h1>리그</h1>

          <p>
            팀 · 경기 · 순위 데이터를 관리합니다.
          </p>

        </div>


        <div class="league-layout">

          <div class="card">

            <div class="card-header">

              <div>
                <h2>팀 등록</h2>
              </div>

              <button
                class="btn primary"
                data-action="add-league-team"
              >
                + 팀 추가
              </button>

            </div>

            <div class="card-body">

              ${
                teams.length
                  ? `
                    <div class="league-team-list">

                      ${teams.map((team, i) => `
                        <div class="league-team-item">

                          <strong>
                            ${i + 1}.
                            ${esc(team.name)}
                          </strong>

                          <span>
                            ${team.wins || 0}승
                            ${team.losses || 0}패
                          </span>

                        </div>
                      `).join("")}

                    </div>
                  `
                  : `
                    <div class="empty-state">
                      등록된 리그 팀이 없습니다.
                    </div>
                  `
              }

            </div>

          </div>


          <div class="card">

            <div class="card-header">

              <div>
                <h2>순위</h2>
                <p>승률 기준</p>
              </div>

            </div>

            <div class="card-body">

              ${leagueStandingsHTML()}

            </div>

          </div>

        </div>

      </div>
    `;
  }


  function leagueStandingsHTML() {

    const sorted =
      [...state.league.teams]
        .sort(
          (a,b) =>
            (
              (b.wins || 0) -
              (a.wins || 0)
            )
        );

    if (!sorted.length) {
      return `
        <div class="empty-state">
          기록 없음
        </div>
      `;
    }

    return `

      <div class="table-wrap">

        <table class="data-table">

          <thead>
            <tr>
              <th>순위</th>
              <th>팀</th>
              <th>승</th>
              <th>패</th>
              <th>승률</th>
            </tr>
          </thead>

          <tbody>

            ${sorted.map((team, i) => {

              const w =
                team.wins || 0;

              const l =
                team.losses || 0;

              const total =
                w + l;

              const rate =
                total
                  ? w / total
                  : null;

              return `
                <tr>

                  <td>${i + 1}</td>

                  <td>
                    ${esc(team.name)}
                  </td>

                  <td>${w}</td>

                  <td>${l}</td>

                  <td>
                    ${pct(rate)}
                  </td>

                </tr>
              `;

            }).join("")}

          </tbody>

        </table>

      </div>
    `;
  }


  function addLeagueTeam() {

    const name =
      prompt("팀 이름을 입력하세요.");

    if (!name?.trim()) return;

    state.league.teams.push({
      id: uid("league"),
      name: name.trim(),
      wins: 0,
      losses: 0
    });

    saveJSON(
      LEAGUE_KEY,
      state.league
    );

    render();

    toast("리그 팀을 추가했습니다.", "success");
  }


  /* =======================================================
     LIVE PAGE
     ======================================================= */

  function renderLive() {

    ensureSelectedPlayer();

    const selected =
      getPlayer(state.selectedPlayerId);

    return `

      <div class="page live-page">

        <div class="card">

          <div class="card-header">

            <div>

              <div class="eyebrow">
                ${state.mode === "3x3"
                  ? "3V3"
                  : "5V5"}
                · LIVE ANALYSIS
              </div>

              <h2>
                ${esc(
                  state.meta.gameName ||
                  "경기 미설정"
                )}
              </h2>

              <p>
                ${esc(
                  state.meta.tournament ||
                  "대회 미설정"
                )}
              </p>

            </div>

            <span class="badge green">
              ● LIVE
            </span>

          </div>


          <div class="scoreboard">

            ${liveTeamScore(
              "home"
            )}

            <div class="score-center">

              <div class="period-label">
                ${state.period || state.game.period}Q
              </div>

              <div
                class="game-clock"
                data-game-clock
              >
                ${clockText(state.game.clock)}
              </div>

              <div
                class="game-status"
                data-game-status
              >
                ${
                  state.game.running
                    ? "경기 진행"
                    : state.game.finished
                      ? "경기 종료"
                      : "일시정지"
                }
              </div>

              <div class="shot-clock">

                <span>SHOT CLOCK</span>

                <strong data-shot-clock>
                  ${state.game.shotClock}
                </strong>

              </div>

            </div>

            ${liveTeamScore(
              "away"
            )}

          </div>


          <div class="live-controls">

            <button
              class="btn"
              data-action="toggle-clock"
            >
              ${
                state.game.running
                  ? "일시정지"
                  : "경기 진행"
              }
            </button>

            <button
              class="btn"
              data-action="next-period"
            >
              다음 구간
            </button>

            <button
              class="btn"
              data-action="reset-shot-clock"
            >
              샷클락 리셋
            </button>

            <button
              class="btn danger"
              data-action="finish-game"
            >
              경기 종료
            </button>

          </div>

        </div>


        <div class="live-top">

          <div class="card">

            <div class="card-header">

              <div>
                <h2>선수 선택</h2>
                <p>
                  경기 시작 여부와 관계없이 기록할 수 있습니다.
                </p>
              </div>

            </div>

            <div class="card-body">

              <div class="live-players">

                ${livePlayersHTML("home")}

                ${livePlayersHTML("away")}

              </div>

            </div>

          </div>


          <div class="card">

            <div class="card-header">

              <div>
                <h2>미니 슛차트</h2>
                <p>
                  전체 슛 위치
                </p>
              </div>

              <button
                class="btn"
                data-action="go-shotchart"
              >
                전체 보기
              </button>

            </div>

            <div class="mini-shot-wrap">

              <div class="basketball-court">

                ${courtHTML()}

                ${state.shots
                  .filter(
                    s =>
                      s.x !== null &&
                      s.y !== null
                  )
                  .map(renderShotMarker)
                  .join("")}

              </div>

            </div>

          </div>

        </div>


        <div class="card">

          <div class="card-header">

            <div>

              <h2>선수 액션</h2>

              <p>
                ${
                  selected
                    ? `${playerName(selected.id)} 선택`
                    : "선수를 선택하세요."
                }
              </p>

            </div>

          </div>


          <div class="card-body">

            <div class="action-grid">

              <button
                class="action-btn shoot-made"
                data-action="quick-shot"
                data-shot-type="FT"
                data-made="true"
              >
                자유투 성공
              </button>

              <button
                class="action-btn shoot-made"
                data-action="quick-shot"
                data-shot-type="2PT"
                data-made="true"
              >
                ${
                  state.mode === "3x3"
                    ? "1점 필드골 성공"
                    : "2점 필드골 성공"
                }
              </button>

              <button
                class="action-btn shoot-made"
                data-action="quick-shot"
                data-shot-type="3PT"
                data-made="true"
              >
                ${
                  state.mode === "3x3"
                    ? "2점 필드골 성공"
                    : "3점 필드골 성공"
                }
              </button>


              <button
                class="action-btn shoot-miss"
                data-action="quick-shot"
                data-shot-type="FT"
                data-made="false"
              >
                자유투 실패
              </button>

              <button
                class="action-btn shoot-miss"
                data-action="quick-shot"
                data-shot-type="2PT"
                data-made="false"
              >
                ${
                  state.mode === "3x3"
                    ? "1점 필드골 실패"
                    : "2점 필드골 실패"
                }
              </button>

              <button
                class="action-btn shoot-miss"
                data-action="quick-shot"
                data-shot-type="3PT"
                data-made="false"
              >
                ${
                  state.mode === "3x3"
                    ? "2점 필드골 실패"
                    : "3점 필드골 실패"
                }
              </button>


              <button
                class="action-btn"
                data-action="stat"
                data-stat="REB"
              >
                리바운드
              </button>

              <button
                class="action-btn pass"
                data-action="begin-pass"
              >
                패스
              </button>

              <button
                class="action-btn"
                data-action="stat"
                data-stat="AST"
              >
                어시스트
              </button>

              <button
                class="action-btn"
                data-action="stat"
                data-stat="STL"
              >
                스틸
              </button>

              <button
                class="action-btn"
                data-action="stat"
                data-stat="BLK"
              >
                블록
              </button>

              <button
                class="action-btn"
                data-action="stat"
                data-stat="TOV"
              >
                턴오버
              </button>

              <button
                class="action-btn"
                data-action="stat"
                data-stat="PF"
              >
                파울
              </button>

              <button
                class="action-btn"
                data-action="open-shot-modal"
              >
                위치 지정 슛
              </button>

            </div>

          </div>

        </div>


        <div class="grid grid-2">

          <div class="card">

            <div class="card-header">
              <div>
                <h2>라이브 리더</h2>
              </div>
            </div>

            <div class="card-body">

              ${liveLeaderHTML()}

            </div>

          </div>


          <div class="card">

            <div class="card-header">
              <div>
                <h2>팀 요약</h2>
              </div>
            </div>

            <div class="card-body">

              ${teamSummaryHTML()}

            </div>

          </div>

        </div>

      </div>
    `;
  }


  function liveTeamScore(team) {

    return `

      <div class="score-team ${team}">

        <div class="team-label">
          ${team === "home" ? "HOME" : "AWAY"}
        </div>

        <div class="team-name">
          ${esc(getTeam(team).name)}
        </div>

        <div class="score">
          ${teamScore(team)}
        </div>

        <div class="score-meta">
          <span>
            ${teamPlayers(team).length}명
          </span>

          <span>
            ${getTeamStats(team).REB} REB
          </span>
        </div>

      </div>
    `;
  }


  function livePlayersHTML(team) {

    const players =
      teamPlayers(team);

    return `

      <div>

        <div
          style="
            margin-bottom:9px;
            font-size:12px;
            font-weight:850;
            color:${team === "home"
              ? "#54b4ff"
              : "#ff657d"};
          "
        >
          ${team === "home" ? "HOME" : "AWAY"}
        </div>

        <div class="player-grid">

          ${
            players.length
              ? players.map(p => {

                  const s =
                    getPlayerStats(p.id);

                  return `

                    <button
                      class="
                        player-card
                        ${
                          state.selectedPlayerId === p.id
                            ? "selected"
                            : ""
                        }
                      "
                      data-action="select-player"
                      data-player-id="${p.id}"
                    >

                      <div class="player-number">
                        #${esc(p.number)}
                      </div>

                      <div class="player-name">
                        ${esc(p.name)}
                      </div>

                      <div class="player-mini-stats">
                        ${s.PTS} PTS
                        · ${s.REB} REB
                        · ${s.AST} AST
                      </div>

                    </button>
                  `;

                }).join("")
              : `
                <div class="empty-state">
                  선수 설정에서 등록하세요.
                </div>
              `
          }

        </div>

      </div>
    `;
  }


  function liveLeaderHTML() {

    const rows =
      state.players
        .map(p => ({
          p,
          s: getPlayerStats(p.id)
        }))
        .sort(
          (a,b) =>
            b.s.PTS - a.s.PTS ||
            b.s.REB - a.s.REB
        );

    if (!rows.length) {
      return `
        <div class="empty-state">
          선수 기록 없음
        </div>
      `;
    }

    return `
      <div class="leader-list">

        ${rows.map(row => `

          <div class="leader-item">

            <div class="leader-left">

              <div class="leader-rank">
                #${esc(row.p.number)}
              </div>

              <div class="leader-name">
                ${esc(row.p.name)}
              </div>

            </div>

            <div class="leader-value">
              ${row.s.PTS}점
              · ${row.s.REB}R
              · ${row.s.AST}A
            </div>

          </div>

        `).join("")}

      </div>
    `;
  }


  function teamSummaryHTML() {

    return `

      ${["home", "away"].map(team => {

        const s =
          getTeamStats(team);

        return `

          <div
            style="
              padding:12px 0;
              border-bottom:
                1px solid rgba(27,54,76,.6);
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
              "
            >

              <strong>
                ${esc(getTeam(team).name)}
              </strong>

              <strong>
                ${s.PTS}점
              </strong>

            </div>

            ${metricRow(
              "FG%",
              pct(s.FG)
            )}

            ${metricRow(
              "3P%",
              pct(s.threeP)
            )}

            ${metricRow(
              "REB",
              s.REB
            )}

          </div>
        `;

      }).join("")}
    `;
  }


  /* =======================================================
     CSV
     ======================================================= */

  function exportCSV() {

    const rows = [
      [
        "팀",
        "번호",
        "선수",
        "PTS",
        "FGM",
        "FGA",
        "FG%",
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

    state.players.forEach(p => {

      const s =
        getPlayerStats(p.id);

      rows.push([
        p.team === "home"
          ? state.teams.home.name
          : state.teams.away.name,

        p.number,

        p.name,

        s.PTS,

        s.FGM,

        s.FGA,

        s.FG === null
          ? ""
          : (s.FG * 100).toFixed(1),

        s.twoPM,

        s.twoPA,

        s.threePM,

        s.threePA,

        s.FTM,

        s.FTA,

        s.REB,

        s.AST,

        s.STL,

        s.BLK,

        s.TOV,

        s.PF
      ]);
    });

    const csv =
      rows
        .map(
          row =>
            row
              .map(
                value =>
                  `"${String(value ?? "")
                    .replaceAll('"', '""')}"`
              )
              .join(",")
        )
        .join("\n");

    const blob =
      new Blob(
        ["\uFEFF" + csv],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `COURTVISION_${state.meta.gameName || "GAME"}.csv`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);

    toast("CSV 파일을 생성했습니다.", "success");
  }


  /* =======================================================
     VIDEO
     ======================================================= */

  function loadVideo(file) {

    if (!file) return;

    if (state.video.url) {
      try {
        URL.revokeObjectURL(
          state.video.url
        );
      } catch {}
    }

    state.video.name =
      file.name;

    state.video.url =
      URL.createObjectURL(file);

    state.video.currentTime = 0;

    saveState();

    render();

    toast("영상을 불러왔습니다.", "success");
  }


  /* =======================================================
     RENDER
     ======================================================= */

  function render() {

    normalizeState();

    const root =
      $("#app") ||
      $("#pageRoot");

    if (!root) {
      console.error(
        "COURTVISION PRO: #app 또는 #pageRoot가 없습니다."
      );
      return;
    }

    const pageHTML =
      renderCurrentPage();

    if (root.id === "app") {

      root.innerHTML =
        headerHTML() +
        `<main id="pageRoot">${pageHTML}</main>`;

    } else {

      root.innerHTML =
        headerHTML() +
        pageHTML;
    }

    bindStateAfterRender();
  }


  function renderCurrentPage() {

    switch (state.page) {

      case "live":
        return renderLive();

      case "records":
        return renderRecords();

      case "shots":
        return renderShotChart();

      case "video":
        return renderVideo();

      case "strategy":
        return renderStrategy();

      case "report":
        return renderReport();

      case "league":
        return renderLeague();

      default:
        state.page = "live";
        return renderLive();
    }
  }


  /* =======================================================
     HEADER
     ======================================================= */

  function headerHTML() {

    const nav = [
      ["live", "라이브"],
      ["records", "기록"],
      ["shots", "슛차트"],
      ["video", "영상 분석"],
      ["strategy", "전력분석"],
      ["report", "리포트"],
      ["league", "리그"]
    ];

    return `

      <header class="top-header">

        <div class="brand">

          <div class="brand-ball">
            🏀
          </div>

          <div class="brand-text">

            <div class="brand-name">
              COURTVISION <span>PRO</span>
            </div>

            <div class="brand-sub">
              BASKETBALL ANALYTICS
            </div>

          </div>

        </div>


        <div class="mode-switch">

          <button
            class="mode-btn ${
              state.mode === "3x3"
                ? "active"
                : ""
            }"
            data-action="mode"
            data-mode="3x3"
          >
            3대3
          </button>

          <button
            class="mode-btn ${
              state.mode === "5x5"
                ? "active"
                : ""
            }"
            data-action="mode"
            data-mode="5x5"
          >
            5대5
          </button>

        </div>


        <nav class="main-nav">

          ${nav.map(([key, label]) => `

            <button
              class="nav-btn ${
                state.page === key
                  ? "active"
                  : ""
              }"
              data-action="nav"
              data-page="${key}"
            >
              ${label}
            </button>

          `).join("")}

        </nav>


        <div class="header-actions">

          <button
            class="header-btn"
            data-action="open-setup"
          >
            선수 설정
          </button>

          <button
            class="header-btn primary"
            data-action="save-game"
          >
            경기 저장
          </button>

          <button
            class="header-btn danger"
            data-action="reset"
          >
            초기화
          </button>

        </div>

      </header>
    `;
  }


  /* =======================================================
     EVENT DELEGATION
     ======================================================= */

  function bindStateAfterRender() {

    /*
      모든 버튼은 document 하나에서 위임 처리.
      렌더링될 때마다 이벤트를 다시 붙일 필요가 없음.
    */

    ensureSelectedPlayer();
  }


  document.addEventListener(
    "click",
    event => {

      const target =
        event.target.closest(
          "[data-action]"
        );

      if (!target) {

        const court =
          event.target.closest(
            "[data-court-click]"
          );

        if (court) {
          handleCourtClick({
            currentTarget: court,
            clientX: event.clientX,
            clientY: event.clientY
          });
        }

        return;
      }

      const action =
        target.dataset.action;


      /* -------------------------------
         NAV
      -------------------------------- */

      if (action === "nav") {

        state.page =
          target.dataset.page;

        saveState();

        render();

        return;
      }


      /* -------------------------------
         MODE
      -------------------------------- */

      if (action === "mode") {

        changeMode(
          target.dataset.mode
        );

        return;
      }


      /* -------------------------------
         SETUP
      -------------------------------- */

      if (action === "open-setup") {

        openSetupModal();

        return;
      }


      if (action === "apply-setup") {

        applySetup();

        return;
      }


      /* -------------------------------
         MODAL
      -------------------------------- */

      if (action === "close-modal") {

        closeModal();

        return;
      }


      if (action === "close-shot-modal") {

        state.pendingShot = null;

        closeModal();

        return;
      }


      /* -------------------------------
         PLAYER
      -------------------------------- */

      if (action === "select-player") {

        selectPlayer(
          target.dataset.playerId
        );

        return;
      }


      /* -------------------------------
         CLOCK
      -------------------------------- */

      if (action === "toggle-clock") {

        toggleGameClock();

        return;
      }


      if (action === "next-period") {

        nextPeriod();

        return;
      }


      if (action === "reset-shot-clock") {

        resetShotClock();

        render();

        toast("샷클락을 리셋했습니다.");

        return;
      }


      if (action === "finish-game") {

        finishGame();

        return;
      }


      /* -------------------------------
         QUICK SHOT
      -------------------------------- */

      if (action === "quick-shot") {

        const type =
          target.dataset.shotType;

        const made =
          target.dataset.made === "true";

        liveShot(
          type,
          made
        );

        return;
      }


      /* -------------------------------
         BASIC STAT
      -------------------------------- */

      if (action === "stat") {

        recordStat(
          target.dataset.stat
        );

        return;
      }


      /* -------------------------------
         PASS
      -------------------------------- */

      if (action === "begin-pass") {

        beginPass();

        return;
      }


      if (action === "complete-pass") {

        completePass(
          target.dataset.playerId
        );

        return;
      }


      /* -------------------------------
         SHOT MODAL
      -------------------------------- */

      if (action === "open-shot-modal") {

        openShotModal();

        return;
      }


      if (action === "shot-made") {

        setPendingMade(true);

        return;
      }


      if (action === "shot-missed") {

        setPendingMade(false);

        return;
      }


      if (action === "shot-type") {

        setPendingType(
          target.dataset.shotType
        );

        return;
      }


      /* -------------------------------
         SHOT CHART
      -------------------------------- */

      if (action === "go-shotchart") {

        state.page = "shots";

        saveState();

        render();

        return;
      }


      /* -------------------------------
         SAVE / RESET
      -------------------------------- */

      if (action === "save-game") {

        saveCurrentGame();

        return;
      }


      if (action === "reset") {

        resetApp();

        return;
      }


      /* -------------------------------
         CSV
      -------------------------------- */

      if (action === "export-csv") {

        exportCSV();

        return;
      }


      /* -------------------------------
         VIDEO SPEED
      -------------------------------- */

      if (
        action === "video-slower" ||
        action === "video-normal" ||
        action === "video-faster"
      ) {

        const video =
          $("#analysisVideo");

        if (!video) return;

        if (action === "video-slower") {
          video.playbackRate = 0.5;
        }

        if (action === "video-normal") {
          video.playbackRate = 1;
        }

        if (action === "video-faster") {
          video.playbackRate = 2;
        }

        return;
      }


      /* -------------------------------
         LEAGUE
      -------------------------------- */

      if (action === "add-league-team") {

        addLeagueTeam();

        return;
      }

    }
  );


  /* =======================================================
     CHANGE EVENTS
     ======================================================= */

  document.addEventListener(
    "change",
    event => {

      const filter =
        event.target.closest(
          "[data-shot-filter]"
        );

      if (filter) {

        state.shotFilters[
          filter.dataset.shotFilter
        ] = filter.value;

        saveState();

        render();

        return;
      }


      const reportPlayer =
        event.target.closest(
          "[data-report-player]"
        );

      if (reportPlayer) {

        state.selectedReportPlayer =
          reportPlayer.value || null;

        saveState();

        render();

        return;
      }


      const videoInput =
        event.target.closest(
          "[data-video-input]"
        );

      if (
        videoInput &&
        videoInput.files?.[0]
      ) {

        loadVideo(
          videoInput.files[0]
        );

      }

    }
  );


  /* =======================================================
     KEYBOARD
     ======================================================= */

  document.addEventListener(
    "keydown",
    event => {

      if (event.key === "Escape") {
        closeModal();
      }

      /*
        Space:
        라이브 페이지에서 경기 시계만 제어.
        input/select/textarea에서는 작동하지 않음.
      */

      if (
        event.code === "Space" &&
        state.page === "live" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName
        )
      ) {

        event.preventDefault();

        toggleGameClock();
      }

    }
  );


  /* =======================================================
     INITIALIZE
     ======================================================= */

  function initialize() {

    normalizeState();

    ensureSelectedPlayer();

    render();

    /*
      선수 데이터가 아예 없다면
      시작할 때 자동으로 선수 설정창을 띄움.
    */

    if (!state.setupComplete) {
      setTimeout(
        () => openSetupModal(),
        100
      );
    }

    if (state.game.running) {
      state.game.lastTick =
        Date.now();

      startTimer();
    }
  }


  initialize();

})();