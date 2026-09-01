/* =========================================================
   COURTVISION PRO
   Basketball Analytics System
   - 3대3 / 5대5 데이터 완전 분리
   - 라이브 기록
   - 3대3 점수: 자유투 1 / 일반슛 1 / 3점 2
   - 5대5 점수: 자유투 1 / 2점 2 / 3점 3
   - 슛차트
   - 선수 기록
   - +/- 
   - 교체
   - 전력분석
   - 리포트
   - 경기 저장/불러오기
   - 리그
========================================================= */

(() => {
  "use strict";

  /* =======================================================
     기본 상수
  ======================================================= */

  const STORAGE_KEY = "courtvision_pro_v3";

  const MODE = {
    THREE: "3v3",
    FIVE: "5v5"
  };

  const ACTION_LABEL = {
    points1: "자유투 성공",
    points2: "2점 성공",
    points3: "3점 성공",
    miss: "슛 실패",
    reb: "리바운드",
    ast: "어시스트",
    stl: "스틸",
    blk: "블록",
    to: "턴오버",
    pf: "파울",
    subIn: "선수 투입",
    subOut: "교체 아웃"
  };

  /* =======================================================
     DOM
  ======================================================= */

  const $ = (id) => document.getElementById(id);

  const qs = (selector) => document.querySelector(selector);

  const qsa = (selector) => [...document.querySelectorAll(selector)];

  /* =======================================================
     유틸
  ======================================================= */

  function uid(prefix = "id") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));

    const m = Math.floor(sec / 60);
    const s = sec % 60;

    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowText() {
    return new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function percent(made, total) {
    if (!total) return "0%";
    return `${Math.round((made / total) * 100)}%`;
  }

  function average(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /* =======================================================
     기본 데이터
  ======================================================= */

  function createPlayer(team, number, name) {
    return {
      id: uid("player"),
      team,
      number,
      name,
      onCourt: true,

      stats: {
        min: 0,
        pts: 0,

        reb: 0,
        off: 0,
        def: 0,

        ast: 0,
        stl: 0,
        blk: 0,
        to: 0,
        pf: 0,

        fgMade: 0,
        fgAttempt: 0,

        fg2Made: 0,
        fg2Attempt: 0,

        fg3Made: 0,
        fg3Attempt: 0,

        ftMade: 0,
        ftAttempt: 0,

        plusMinus: 0
      },

      timeOnCourt: 0,
      lastSubIn: null
    };
  }

  function createGameMode(mode) {
    const is3 = mode === MODE.THREE;

    return {
      mode,

      gameInfo: {
        date: today(),
        title: "",
        location: "",
        competition: "",
        teamA: is3 ? "설천고 A" : "설천고 A",
        teamB: is3 ? "설천고 B" : "설천고 B",

        minutes: is3 ? 10 : 10,
        shotClock: is3 ? 14 : 24,

        periodType: is3 ? "single" : "quarter",
        targetScore: is3 ? 21 : 0
      },

      players: {
        A: [
          createPlayer("A", "4", "선수 A1"),
          createPlayer("A", "5", "선수 A2"),
          createPlayer("A", "6", "선수 A3")
        ],

        B: [
          createPlayer("B", "7", "선수 B1"),
          createPlayer("B", "8", "선수 B2"),
          createPlayer("B", "9", "선수 B3")
        ]
      },

      score: {
        A: 0,
        B: 0
      },

      fouls: {
        A: 0,
        B: 0
      },

      timeouts: {
        A: 1,
        B: 1
      },

      period: 1,

      gameClock: is3
        ? 10 * 60
        : 10 * 60,

      shotClock: is3
        ? 14
        : 24,

      running: false,

      logs: [],

      shots: [],

      videoTags: [],

      substitutions: [],

      lineupSnapshots: [],

      history: []
    };
  }

  const defaultState = {
    currentMode: MODE.THREE,

    modes: {
      [MODE.THREE]: createGameMode(MODE.THREE),
      [MODE.FIVE]: createGameMode(MODE.FIVE)
    },

    league: {
      teams: [],
      schedule: [],
      results: []
    },

    savedGames: []
  };

  /* =======================================================
     STATE
  ======================================================= */

  let state = loadState();

  let clockInterval = null;

  let selectedPlayerId = null;

  let selectedVideoTag = null;

  let heatmapEnabled = false;

  let youtubePlayer = null;

  /* =======================================================
     저장 / 불러오기
  ======================================================= */

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return structuredClone(defaultState);
      }

      const parsed = JSON.parse(raw);

      return normalizeState(parsed);
    } catch (error) {
      console.error(error);

      return structuredClone(defaultState);
    }
  }

  function normalizeState(data) {
    const base = structuredClone(defaultState);

    if (!data || typeof data !== "object") {
      return base;
    }

    base.currentMode =
      data.currentMode === MODE.FIVE
        ? MODE.FIVE
        : MODE.THREE;

    for (const mode of [MODE.THREE, MODE.FIVE]) {
      if (data.modes?.[mode]) {
        base.modes[mode] = {
          ...base.modes[mode],
          ...data.modes[mode],

          gameInfo: {
            ...base.modes[mode].gameInfo,
            ...(data.modes[mode].gameInfo || {})
          },

          players: {
            A: data.modes[mode].players?.A || base.modes[mode].players.A,
            B: data.modes[mode].players?.B || base.modes[mode].players.B
          }
        };
      }
    }

    base.league = {
      ...base.league,
      ...(data.league || {})
    };

    base.savedGames = Array.isArray(data.savedGames)
      ? data.savedGames
      : [];

    return base;
  }

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  }

  function game() {
    return state.modes[state.currentMode];
  }

  function players() {
    return game().players;
  }

  /* =======================================================
     모드 전환
  ======================================================= */

  function switchMode(mode) {
    if (![MODE.THREE, MODE.FIVE].includes(mode)) {
      return;
    }

    stopClock();

    state.currentMode = mode;

    selectedPlayerId = null;

    heatmapEnabled = false;

    const g = game();

    if (g.shotClock <= 0) {
      g.shotClock = g.gameInfo.shotClock;
    }

    renderAll();

    saveState();
  }

  /* =======================================================
     설정값 읽기
  ======================================================= */

  function readSetup() {
    const g = game();

    g.gameInfo.date =
      $("gameDate")?.value || today();

    g.gameInfo.title =
      $("gameTitle")?.value || "";

    g.gameInfo.location =
      $("gameLocation")?.value || "";

    g.gameInfo.competition =
      $("competitionName")?.value || "";

    g.gameInfo.teamA =
      $("teamAName")?.value || "설천고 A";

    g.gameInfo.teamB =
      $("teamBName")?.value || "설천고 B";

    g.gameInfo.minutes =
      Number($("gameMinutes")?.value || 10);

    g.gameInfo.shotClock =
      Number($("shotClockSeconds")?.value || 14);

    g.gameInfo.periodType =
      $("periodType")?.value || "single";

    g.gameInfo.targetScore =
      Number($("targetScore")?.value || 0);

    const playersA =
      qsa("#teamAPlayers .player-form-row");

    const playersB =
      qsa("#teamBPlayers .player-form-row");

    g.players.A = readPlayerRows(
      playersA,
      "A"
    );

    g.players.B = readPlayerRows(
      playersB,
      "B"
    );

    resetCurrentLineup(g);

    g.gameClock =
      g.gameInfo.minutes * 60;

    g.shotClock =
      g.gameInfo.shotClock;

    saveState();

    renderAll();
  }

  function readPlayerRows(rows, team) {
    return rows.map((row, index) => {
      const number =
        row.querySelector("[data-player-number]")?.value ||
        String(index + 1);

      const name =
        row.querySelector("[data-player-name]")?.value ||
        `${team} 선수 ${index + 1}`;

      const existingId =
        row.dataset.playerId;

      const old =
        game().players[team].find(
          p => p.id === existingId
        );

      return old
        ? {
            ...old,
            number,
            name,
            team
          }
        : createPlayer(
            team,
            number,
            name
          );
    });
  }

  function resetCurrentLineup(g) {
    const limit =
      g.mode === MODE.THREE ? 3 : 5;

    ["A", "B"].forEach(team => {
      g.players[team].forEach(
        (player, index) => {
          player.onCourt =
            index < limit;

          player.lastSubIn =
            player.onCourt
              ? performance.now()
              : null;
        }
      );
    });
  }

  /* =======================================================
     선수 설정 렌더링
  ======================================================= */

  function renderPlayerSetup() {
    renderPlayerSetupTeam(
      "A",
      $("teamAPlayers")
    );

    renderPlayerSetupTeam(
      "B",
      $("teamBPlayers")
    );
  }

  function renderPlayerSetupTeam(
    team,
    container
  ) {
    if (!container) return;

    const list = players()[team];

    container.innerHTML = list
      .map(
        player => `
        <div
          class="player-form-row"
          data-player-id="${player.id}"
        >
          <input
            data-player-number
            value="${escapeHTML(player.number)}"
            placeholder="번호"
          />

          <input
            data-player-name
            value="${escapeHTML(player.name)}"
            placeholder="선수 이름"
          />

          <button
            type="button"
            data-oncourt-player
            data-id="${player.id}"
          >
            ${
              player.onCourt
                ? "출전"
                : "벤치"
            }
          </button>

          <button
            type="button"
            data-remove-player
            data-id="${player.id}"
          >
            ✕
          </button>
        </div>
      `
      )
      .join("");
  }

  function addPlayer(team) {
    const list = players()[team];

    const nextNumber =
      String(
        Math.max(
          0,
          ...list.map(
            p => Number(p.number) || 0
          )
        ) + 1
      );

    list.push(
      createPlayer(
        team,
        nextNumber,
        `${team} 선수 ${list.length + 1}`
      )
    );

    renderPlayerSetup();

    saveState();
  }

  function removePlayer(team, id) {
    const list = players()[team];

    if (list.length <= 1) {
      alert("팀에는 최소 1명의 선수가 있어야 해용.");
      return;
    }

    const index =
      list.findIndex(p => p.id === id);

    if (index >= 0) {
      list.splice(index, 1);
    }

    if (selectedPlayerId === id) {
      selectedPlayerId = null;
    }

    renderAll();

    saveState();
  }

  function toggleOnCourt(team, id) {
    const list = players()[team];

    const player =
      list.find(p => p.id === id);

    if (!player) return;

    const current =
      list.filter(p => p.onCourt).length;

    const limit =
      game().mode === MODE.THREE
        ? 3
        : 5;

    if (!player.onCourt && current >= limit) {
      alert(
        `${game().mode === MODE.THREE ? "3대3" : "5대5"}에서는 동시에 ${limit}명까지만 출전할 수 있어용.`
      );
      return;
    }

    player.onCourt = !player.onCourt;

    saveState();

    renderAll();
  }

  /* =======================================================
     선택 선수
  ======================================================= */

  function getAllPlayers() {
    return [
      ...players().A,
      ...players().B
    ];
  }

  function getPlayer(id) {
    return getAllPlayers()
      .find(p => p.id === id);
  }

  function selectPlayer(id) {
    const player = getPlayer(id);

    if (!player) return;

    selectedPlayerId = id;

    renderLive();

    renderShotChart();
  }

  /* =======================================================
     득점 규칙
  ======================================================= */

  function pointValue(action) {
    if (action === "points1") return 1;

    if (action === "points2") {
      return game().mode === MODE.THREE
        ? 1
        : 2;
    }

    if (action === "points3") {
      return game().mode === MODE.THREE
        ? 2
        : 3;
    }

    return 0;
  }

  /* =======================================================
     액션 처리
  ======================================================= */

  function recordAction(action) {
    const player =
      getPlayer(selectedPlayerId);

    if (!player) {
      alert("먼저 선수를 선택해주세용.");
      return;
    }

    const g = game();

    const before =
      structuredClone({
        score: g.score,
        fouls: g.fouls,
        players: g.players,
        logs: g.logs,
        substitutions: g.substitutions
      });

    const team = player.team;

    switch (action) {
      case "points1":
        recordMadeShot(
          player,
          1,
          "FT"
        );
        break;

      case "points2":
        recordMadeShot(
          player,
          pointValue("points2"),
          "2PT"
        );
        break;

      case "points3":
        recordMadeShot(
          player,
          pointValue("points3"),
          "3PT"
        );
        break;

      case "miss":
        recordMiss(player);
        break;

      case "reb":
        player.stats.reb++;

        player.stats.def++;

        break;

      case "ast":
        player.stats.ast++;
        break;

      case "stl":
        player.stats.stl++;
        break;

      case "blk":
        player.stats.blk++;
        break;

      case "to":
        player.stats.to++;
        break;

      case "pf":
        player.stats.pf++;

        g.fouls[team]++;

        break;

      case "subIn":
        substituteIn(player);
        break;

      case "subOut":
        substituteOut(player);
        break;

      default:
        return;
    }

    const log = {
      id: uid("log"),
      time: nowText(),
      gameClock: g.gameClock,
      shotClock: g.shotClock,
      period: g.period,

      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,

      team,

      action,

      label:
        ACTION_LABEL[action],

      value:
        pointValue(action)
    };

    g.logs.push(log);

    g.history.push({
      before,
      action
    });

    updatePlusMinus();

    renderAll();

    saveState();
  }

  /* =======================================================
     성공 슛
  ======================================================= */

  function recordMadeShot(
    player,
    points,
    type
  ) {
    const s = player.stats;

    if (type === "FT") {
      s.ftMade++;
      s.ftAttempt++;
    } else if (type === "2PT") {
      s.fgMade++;
      s.fgAttempt++;

      s.fg2Made++;
      s.fg2Attempt++;
    } else {
      s.fgMade++;
      s.fgAttempt++;

      s.fg3Made++;
      s.fg3Attempt++;
    }

    s.pts += points;

    game().score[player.team] += points;
  }

  function recordMiss(player) {
    const s = player.stats;

    s.fgAttempt++;
  }

  /* =======================================================
     슛차트 기록
  ======================================================= */

  function addShotAt(
    x,
    y,
    made,
    type = "2PT"
  ) {
    const player =
      getPlayer(selectedPlayerId);

    if (!player) {
      alert("먼저 선수를 선택해주세용.");
      return;
    }

    const g = game();

    g.shots.push({
      id: uid("shot"),

      playerId: player.id,

      playerName: player.name,

      team: player.team,

      period: g.period,

      x,
      y,

      made,

      type,

      points:
        made
          ? pointValue(
              type === "3PT"
                ? "points3"
                : type === "FT"
                ? "points1"
                : "points2"
            )
          : 0,

      timestamp: Date.now()
    });

    renderShotChart();

    renderMiniCourt();

    renderShotSummary();

    renderZoneAnalysis();

    renderShotTrend();

    saveState();
  }

  function recordShotFromButton(made) {
    const canvas =
      $("shotChartCanvas");

    if (!canvas) return;

    const x =
      canvas.width / 2;

    const y =
      canvas.height / 2;

    addShotAt(
      x,
      y,
      made,
      "2PT"
    );
  }

  /* =======================================================
     교체
  ======================================================= */

  function substituteIn(player) {
    const g = game();

    const limit =
      g.mode === MODE.THREE
        ? 3
        : 5;

    const onCourt =
      players()[player.team]
        .filter(p => p.onCourt)
        .length;

    if (player.onCourt) {
      alert("이미 출전 중인 선수예용.");
      return;
    }

    if (onCourt >= limit) {
      alert(
        `${g.mode === MODE.THREE ? "3대3" : "5대5"}는 ${limit}명까지 출전 가능해용.`
      );
      return;
    }

    player.onCourt = true;

    player.lastSubIn =
      performance.now();

    g.substitutions.push({
      id: uid("sub"),
      type: "IN",
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      period: g.period,
      time: g.gameClock,
      timestamp: Date.now()
    });
  }

  function substituteOut(player) {
    if (!player.onCourt) {
      alert("현재 벤치 선수예용.");
      return;
    }

    player.onCourt = false;

    player.lastSubIn = null;

    game().substitutions.push({
      id: uid("sub"),
      type: "OUT",
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      period: game().period,
      time: game().gameClock,
      timestamp: Date.now()
    });
  }

  /* =======================================================
     +/- 계산
  ======================================================= */

  function updatePlusMinus() {
    const g = game();

    const latest =
      g.logs[g.logs.length - 1];

    if (!latest) return;

    if (
      ![
        "points1",
        "points2",
        "points3"
      ].includes(latest.action)
    ) {
      return;
    }

    const scoringTeam =
      latest.team;

    const points =
      latest.value || 0;

    const opponent =
      scoringTeam === "A"
        ? "B"
        : "A";

    players()[scoringTeam]
      .filter(p => p.onCourt)
      .forEach(p => {
        p.stats.plusMinus += points;
      });

    players()[opponent]
      .filter(p => p.onCourt)
      .forEach(p => {
        p.stats.plusMinus -= points;
      });
  }

  /* =======================================================
     시계
  ======================================================= */

  function startClock() {
    if (clockInterval) return;

    game().running = true;

    clockInterval =
      setInterval(() => {
        const g = game();

        if (!g.running) return;

        if (g.gameClock > 0) {
          g.gameClock--;
        }

        if (g.shotClock > 0) {
          g.shotClock--;
        }

        updateMinutes();

        if (g.gameClock <= 0) {
          stopClock();

          alert("경기 시간이 종료되었어용.");
        }

        renderClock();
      }, 1000);
  }

  function stopClock() {
    game().running = false;

    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }

    updateMinutes();

    saveState();
  }

  function resetShotClock() {
    game().shotClock =
      game().gameInfo.shotClock;

    renderClock();

    saveState();
  }

  function updateMinutes() {
    const g = game();

    const elapsed =
      g.gameInfo.minutes * 60 -
      g.gameClock;

    getAllPlayers().forEach(
      player => {
        if (
          player.onCourt &&
          player.lastSubIn !== null
        ) {
          player.timeOnCourt =
            Math.max(
              0,
              elapsed -
                (
                  player.lastSubInGameTime ||
                  elapsed
                )
            );
        }
      }
    );
  }

  /* =======================================================
     구간
  ======================================================= */

  function nextPeriod() {
    stopClock();

    game().period++;

    game().gameClock =
      game().gameInfo.minutes * 60;

    resetShotClock();

    saveState();

    renderAll();
  }

  /* =======================================================
     타임아웃
  ======================================================= */

  function takeTimeout(team) {
    if (game().timeouts[team] <= 0) {
      alert("남은 타임아웃이 없어용.");
      return;
    }

    game().timeouts[team]--;

    stopClock();

    saveState();

    renderAll();
  }

  /* =======================================================
     Undo
  ======================================================= */

  function undoLastAction() {
    const g = game();

    const last =
      g.history.pop();

    if (!last) {
      alert("취소할 기록이 없어용.");
      return;
    }

    g.score =
      structuredClone(last.before.score);

    g.fouls =
      structuredClone(last.before.fouls);

    g.players =
      structuredClone(last.before.players);

    g.logs =
      structuredClone(last.before.logs);

    g.substitutions =
      structuredClone(last.before.substitutions);

    renderAll();

    saveState();
  }

  /* =======================================================
     최근 기록
  ======================================================= */

  function renderRecentLogs() {
    const el =
      $("recentLogList");

    if (!el) return;

    const logs =
      game().logs.slice(-20).reverse();

    if (!logs.length) {
      el.innerHTML =
        `<div class="empty-message">
          아직 기록이 없습니다.
        </div>`;

      return;
    }

    el.innerHTML =
      logs.map(
        log => `
        <div class="recent-log-row">
          <time>${escapeHTML(log.time)}</time>

          <strong>
            ${escapeHTML(log.playerName)}
            · ${escapeHTML(log.label)}
          </strong>

          <span>
            ${
              log.value
                ? `+${log.value}`
                : ""
            }
          </span>
        </div>
      `
      ).join("");
  }

  function clearRecentLogs() {
    game().logs = [];

    saveState();

    renderRecentLogs();
  }

  /* =======================================================
     라이브 렌더링
  ======================================================= */

  function renderLive() {
    const g = game();

    const info = g.gameInfo;

    $("liveGameTitle") &&
      ($("liveGameTitle").textContent =
        info.title || "농구 경기");

    $("liveGameMode") &&
      ($("liveGameMode").textContent =
        g.mode === MODE.THREE
          ? "3대3"
          : "5대5");

    $("liveGameLocation") &&
      ($("liveGameLocation").textContent =
        info.location || "미입력");

    $("liveGameDate") &&
      ($("liveGameDate").textContent =
        info.date || "미입력");

    $("teamANameDisplay") &&
      ($("teamANameDisplay").textContent =
        info.teamA);

    $("teamBNameDisplay") &&
      ($("teamBNameDisplay").textContent =
        info.teamB);

    $("scoreboardTeamA") &&
      ($("scoreboardTeamA").textContent =
        info.teamA);

    $("scoreboardTeamB") &&
      ($("scoreboardTeamB").textContent =
        info.teamB);

    setText(
      "teamAScore",
      g.score.A
    );

    setText(
      "teamBScore",
      g.score.B
    );

    setText(
      "scoreboardAValue",
      g.score.A
    );

    setText(
      "scoreboardBValue",
      g.score.B
    );

    setText(
      "teamAFouls",
      g.fouls.A
    );

    setText(
      "teamBFouls",
      g.fouls.B
    );

    setText(
      "scoreboardAFouls",
      g.fouls.A
    );

    setText(
      "scoreboardBFouls",
      g.fouls.B
    );

    setText(
      "teamATimeouts",
      g.timeouts.A
    );

    setText(
      "teamBTimeouts",
      g.timeouts.B
    );

    setText(
      "scoreboardATimeouts",
      g.timeouts.A
    );

    setText(
      "scoreboardBTimeouts",
      g.timeouts.B
    );

    setText(
      "quarterLabel",
      `${g.period}Q`
    );

    setText(
      "liveModeLabel",
      g.mode === MODE.THREE
        ? "3대3 모드"
        : "5대5 모드"
    );

    renderOnCourt("A");
    renderOnCourt("B");

    renderSelectedPlayer();

    renderRecentLogs();

    renderComparison();

    renderMvp();

    renderLiveLeaders();
  }

  function renderOnCourt(team) {
    const el =
      team === "A"
        ? $("teamAOnCourt")
        : $("teamBOnCourt");

    if (!el) return;

    const list =
      players()[team];

    el.innerHTML =
      list.map(
        player => `
        <div
          class="
            player-live-card
            ${
              team === "A"
                ? "team-a-card"
                : "team-b-card"
            }
            ${
              player.id === selectedPlayerId
                ? "selected"
                : ""
            }
            ${
              player.onCourt
                ? ""
                : "out"
            }
          "
          data-select-player="${player.id}"
        >
          <span class="number">
            ${escapeHTML(player.number)}
          </span>

          <span class="name">
            ${escapeHTML(player.name)}
          </span>

          <span class="points">
            PTS ${player.stats.pts}
            · +/- ${player.stats.plusMinus}
          </span>
        </div>
      `
      ).join("");
  }

  function renderSelectedPlayer() {
    const player =
      getPlayer(selectedPlayerId);

    if (!player) {
      setText(
        "selectedPlayerName",
        "선수를 선택해주세용"
      );

      setText(
        "selectedPlayerLiveInfo",
        "출전 시간 00:00 · +/- 0"
      );

      setText(
        "selectedPlayerTeamTag",
        "팀 선택 대기"
      );

      return;
    }

    setText(
      "selectedPlayerName",
      `#${player.number} ${player.name}`
    );

    setText(
      "selectedPlayerLiveInfo",
      `출전 시간 ${formatTime(
        player.timeOnCourt
      )} · +/- ${player.stats.plusMinus}`
    );

    setText(
      "selectedPlayerTeamTag",
      player.team === "A"
        ? "TEAM A"
        : "TEAM B"
    );
  }

  /* =======================================================
     비교
  ======================================================= */

  function teamStat(team, stat) {
    return players()[team]
      .reduce(
        (sum, p) =>
          sum + (Number(p.stats[stat]) || 0),
        0
      );
  }

  function renderComparison() {
    const stats = [
      ["Pts", "pts"],
      ["Reb", "reb"],
      ["Ast", "ast"],
      ["Stl", "stl"],
      ["Blk", "blk"],
      ["To", "to"]
    ];

    stats.forEach(
      ([key, stat]) => {
        const a =
          teamStat("A", stat);

        const b =
          teamStat("B", stat);

        setText(
          `compare${key}A`,
          a
        );

        setText(
          `compare${key}B`,
          b
        );

        const total =
          a + b || 1;

        setWidth(
          `compareBar${key}A`,
          `${(a / total) * 100}%`
        );

        setWidth(
          `compareBar${key}B`,
          `${(b / total) * 100}%`
        );
      }
    );
  }

  /* =======================================================
     MVP
  ======================================================= */

  function playerImpact(player) {
    const s = player.stats;

    return (
      s.pts * 1 +
      s.reb * 1.2 +
      s.ast * 1.5 +
      s.stl * 2 +
      s.blk * 2 -
      s.to * 1.2 -
      s.pf * 0.5
    );
  }

  function renderMvp() {
    const el =
      $("mvpCard");

    if (!el) return;

    const all =
      getAllPlayers();

    if (!all.length) return;

    const best =
      [...all]
        .sort(
          (a, b) =>
            playerImpact(b) -
            playerImpact(a)
        )[0];

    if (
      !best ||
      playerImpact(best) === 0
    ) {
      el.querySelector(".mvp-name") &&
        (el.querySelector(".mvp-name").textContent =
          "선수를 기다리는 중");

      return;
    }

    const teamName =
      best.team === "A"
        ? game().gameInfo.teamA
        : game().gameInfo.teamB;

    const nameEl =
      el.querySelector(".mvp-name");

    const teamEl =
      el.querySelector(".mvp-team");

    const statsEl =
      el.querySelector(".mvp-stats");

    const scoreEl =
      el.querySelector(".mvp-score");

    if (teamEl)
      teamEl.textContent =
        teamName;

    if (nameEl)
      nameEl.textContent =
        `#${best.number} ${best.name}`;

    if (statsEl)
      statsEl.textContent =
        `PTS ${best.stats.pts} · REB ${best.stats.reb} · AST ${best.stats.ast}`;

    if (scoreEl)
      scoreEl.textContent =
        playerImpact(best).toFixed(1);
  }

  /* =======================================================
     실시간 리더
  ======================================================= */

  function renderLiveLeaders() {
    const el =
      $("liveLeaderCards");

    if (!el) return;

    const all =
      getAllPlayers();

    if (!all.length) {
      el.innerHTML =
        `<div class="empty-message">
          아직 기록이 없습니다.
        </div>`;

      return;
    }

    const categories = [
      ["득점", "pts"],
      ["리바운드", "reb"],
      ["어시스트", "ast"],
      ["스틸", "stl"],
      ["블록", "blk"]
    ];

    el.innerHTML =
      categories.map(
        ([label, stat]) => {
          const best =
            [...all]
              .sort(
                (a, b) =>
                  b.stats[stat] -
                  a.stats[stat]
              )[0];

          return `
            <div class="live-leader-card">
              <span>${label}</span>

              <strong>
                #${escapeHTML(best.number)}
                ${escapeHTML(best.name)}
              </strong>

              <b>${best.stats[stat]}</b>
            </div>
          `;
        }
      ).join("");
  }

  /* =======================================================
     기록표
  ======================================================= */

  function renderRecords() {
    const body =
      $("statsTableBody");

    if (!body) return;

    const teamFilter =
      $("recordFilterTeam")?.value ||
      "all";

    let list =
      getAllPlayers();

    if (teamFilter !== "all") {
      list =
        list.filter(
          p => p.team === teamFilter
        );
    }

    if (!list.length) {
      body.innerHTML =
        `<tr>
          <td colspan="16" class="empty-cell">
            기록이 없습니다.
          </td>
        </tr>`;

      return;
    }

    body.innerHTML =
      list.map(
        p => {
          const s = p.stats;

          return `
          <tr>
            <td>
              ${
                p.team === "A"
                  ? "A"
                  : "B"
              }
            </td>

            <td>${escapeHTML(p.number)}</td>

            <td>${escapeHTML(p.name)}</td>

            <td>${formatTime(p.timeOnCourt)}</td>

            <td>${s.pts}</td>

            <td>${s.reb}</td>

            <td>${s.ast}</td>

            <td>${s.stl}</td>

            <td>${s.blk}</td>

            <td>${s.to}</td>

            <td>${s.pf}</td>

            <td>
              ${s.fgMade}/${s.fgAttempt}
            </td>

            <td>
              ${percent(
                s.fgMade,
                s.fgAttempt
              )}
            </td>

            <td>${s.plusMinus}</td>

            <td>${s.off}</td>

            <td>${s.def}</td>
          </tr>
          `;
        }
      ).join("");

    renderPlayerDetailSelect();

    renderTeamSummary();

    renderPeriodStats();

    renderSubstitutionLog();
  }

  function renderPlayerDetailSelect() {
    const select =
      $("playerDetailSelect");

    if (!select) return;

    const current =
      select.value;

    select.innerHTML =
      `<option value="">
        선수를 선택해주세용
      </option>` +
      getAllPlayers()
        .map(
          p => `
          <option value="${p.id}">
            ${p.team} · #${escapeHTML(p.number)}
            ${escapeHTML(p.name)}
          </option>
        `
        )
        .join("");

    select.value = current;
  }

  function renderTeamSummary() {
    const el =
      $("teamSummaryCards");

    if (!el) return;

    el.innerHTML =
      ["A", "B"]
        .map(team => {
          const info =
            team === "A"
              ? game().gameInfo.teamA
              : game().gameInfo.teamB;

          return `
          <div class="summary-stat-card">
            <span>${escapeHTML(info)} 득점</span>
            <strong>${game().score[team]}</strong>
          </div>

          <div class="summary-stat-card">
            <span>${escapeHTML(info)} 리바운드</span>
            <strong>${teamStat(team, "reb")}</strong>
          </div>

          <div class="summary-stat-card">
            <span>${escapeHTML(info)} 어시스트</span>
            <strong>${teamStat(team, "ast")}</strong>
          </div>

          <div class="summary-stat-card">
            <span>${escapeHTML(info)} 턴오버</span>
            <strong>${teamStat(team, "to")}</strong>
          </div>
          `;
        })
        .join("");
  }

  function renderPlayerDetail(id) {
    const el =
      $("playerDetailCard");

    if (!el) return;

    const p =
      getPlayer(id);

    if (!p) {
      el.innerHTML =
        `<div class="empty-message">
          선수를 선택하면 상세 기록이 표시돼용.
        </div>`;

      return;
    }

    const s = p.stats;

    el.innerHTML = `
      <div class="player-detail-grid">

        <div class="player-detail-stat">
          <span>PTS</span>
          <strong>${s.pts}</strong>
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
          <span>FG%</span>
          <strong>${percent(
            s.fgMade,
            s.fgAttempt
          )}</strong>
        </div>

        <div class="player-detail-stat">
          <span>+/-</span>
          <strong>${s.plusMinus}</strong>
        </div>

      </div>
    `;
  }

  function renderPeriodStats() {
    const el =
      $("periodStatsList");

    if (!el) return;

    const periods = {};

    game().logs.forEach(log => {
      if (!periods[log.period]) {
        periods[log.period] = {
          A: 0,
          B: 0
        };
      }

      if (
        log.action.startsWith("points")
      ) {
        periods[log.period][log.team] +=
          log.value || 0;
      }
    });

    const keys =
      Object.keys(periods)
        .sort((a, b) => a - b);

    if (!keys.length) {
      el.innerHTML =
        `<div class="empty-message">
          구간별 기록이 없습니다.
        </div>`;

      return;
    }

    el.innerHTML =
      keys.map(
        p => `
        <div class="period-stat-row">
          <span>${p}Q</span>

          <strong>
            ${game().gameInfo.teamA}
            ${periods[p].A}
            :
            ${periods[p].B}
            ${game().gameInfo.teamB}
          </strong>

          <span>
            ${periods[p].A > periods[p].B
              ? "A팀 우세"
              : periods[p].A < periods[p].B
              ? "B팀 우세"
              : "동점"}
          </span>
        </div>
        `
      ).join("");
  }

  function renderSubstitutionLog() {
    const el =
      $("substitutionLogList");

    if (!el) return;

    const list =
      game().substitutions;

    if (!list.length) {
      el.innerHTML =
        `<div class="empty-message">
          선수 교체 기록이 없습니다.
        </div>`;

      return;
    }

    el.innerHTML =
      list.slice().reverse()
        .map(
          sub => `
          <div class="substitution-log-row">
            <span>${sub.period}Q</span>

            <strong>
              ${sub.team} · #${escapeHTML(
                sub.playerName
              )}
            </strong>

            <span>
              ${sub.type === "IN"
                ? "투입"
                : "아웃"}
            </span>
          </div>
          `
        ).join("");
  }

  /* =======================================================
     슛차트
  ======================================================= */

  function drawCourt(
    ctx,
    width,
    height
  ) {
    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    ctx.strokeStyle =
      "#334856";

    ctx.lineWidth = 3;

    ctx.strokeRect(
      20,
      20,
      width - 40,
      height - 40
    );

    const centerX =
      width / 2;

    ctx.beginPath();

    ctx.arc(
      centerX,
      height - 70,
      45,
      Math.PI,
      0
    );

    ctx.stroke();

    ctx.strokeRect(
      centerX - 90,
      height - 130,
      180,
      110
    );

    ctx.beginPath();

    ctx.arc(
      centerX,
      height - 130,
      45,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(
      centerX,
      height - 40,
      240,
      Math.PI,
      0
    );

    ctx.stroke();

    ctx.fillStyle =
      "#f4f7fb";

    ctx.font =
      "bold 12px sans-serif";

    ctx.fillText(
      game().mode === MODE.THREE
        ? "3대3 COURT"
        : "5대5 COURT",
      30,
      42
    );
  }

  function renderShotChart() {
    const canvas =
      $("shotChartCanvas");

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    drawCourt(
      ctx,
      canvas.width,
      canvas.height
    );

    let shots =
      game().shots;

    const view =
      $("shotViewMode")?.value ||
      "player";

    if (view === "player") {
      if (selectedPlayerId) {
        shots =
          shots.filter(
            s =>
              s.playerId ===
              selectedPlayerId
          );
      }
    }

    if (view === "teamA") {
      shots =
        shots.filter(
          s => s.team === "A"
        );
    }

    if (view === "teamB") {
      shots =
        shots.filter(
          s => s.team === "B"
        );
    }

    if (
      $("shotPeriodFilter")?.value &&
      $("shotPeriodFilter").value !== "all"
    ) {
      const period =
        Number(
          $("shotPeriodFilter").value
        );

      shots =
        shots.filter(
          s => s.period === period
        );
    }

    shots.forEach(
      shot => {
        const radius =
          shot.made ? 7 : 6;

        ctx.beginPath();

        ctx.arc(
          shot.x,
          shot.y,
          radius,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          shot.made
            ? "#2f93ff"
            : "#ff4c55";

        ctx.fill();

        if (!shot.made) {
          ctx.strokeStyle =
            "#ffffff";

          ctx.lineWidth = 2;

          ctx.beginPath();

          ctx.moveTo(
            shot.x - 5,
            shot.y - 5
          );

          ctx.lineTo(
            shot.x + 5,
            shot.y + 5
          );

          ctx.moveTo(
            shot.x + 5,
            shot.y - 5
          );

          ctx.lineTo(
            shot.x - 5,
            shot.y + 5
          );

          ctx.stroke();
        }
      }
    );

    if (heatmapEnabled) {
      drawHeatmap(
        ctx,
        shots
      );
    }
  }

  function drawHeatmap(ctx, shots) {
    const cells = 12;

    const canvas =
      $("shotChartCanvas");

    const cellW =
      canvas.width / cells;

    const cellH =
      canvas.height / cells;

    const map = {};

    shots.forEach(
      shot => {
        const cx =
          Math.floor(
            shot.x / cellW
          );

        const cy =
          Math.floor(
            shot.y / cellH
          );

        const key =
          `${cx}_${cy}`;

        if (!map[key]) {
          map[key] = {
            total: 0,
            made: 0
          };
        }

        map[key].total++;

        if (shot.made) {
          map[key].made++;
        }
      }
    );

    Object.entries(map)
      .forEach(
        ([key, value]) => {
          const [cx, cy] =
            key.split("_")
              .map(Number);

          const rate =
            value.made /
            value.total;

          ctx.fillStyle =
            `rgba(246,186,63,${
              0.08 +
              rate * 0.35
            })`;

          ctx.fillRect(
            cx * cellW,
            cy * cellH,
            cellW,
            cellH
          );
        }
      );
  }

  function renderMiniCourt() {
    const canvas =
      $("miniCourtCanvas");

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    drawCourt(
      ctx,
      canvas.width,
      canvas.height
    );

    game().shots.forEach(
      shot => {
        const x =
          shot.x /
          $("shotChartCanvas").width *
          canvas.width;

        const y =
          shot.y /
          $("shotChartCanvas").height *
          canvas.height;

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          5,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          shot.made
            ? "#2f93ff"
            : "#ff4c55";

        ctx.fill();
      }
    );
  }

  function renderShotSummary() {
    const el =
      $("shotSummaryCard");

    if (!el) return;

    let shots =
      game().shots;

    if (selectedPlayerId) {
      shots =
        shots.filter(
          s =>
            s.playerId ===
            selectedPlayerId
        );
    }

    const made =
      shots.filter(
        s => s.made
      ).length;

    const total =
      shots.length;

    el.innerHTML = `
      <div class="shot-summary-stat">
        <span>전체 슛</span>
        <strong>${made}/${total}</strong>
      </div>

      <div class="shot-summary-stat">
        <span>성공률</span>
        <strong>${percent(
          made,
          total
        )}</strong>
      </div>
    `;
  }

  function renderZoneAnalysis() {
    const el =
      $("zoneAnalysisCards");

    if (!el) return;

    let shots =
      game().shots;

    if (selectedPlayerId) {
      shots =
        shots.filter(
          s =>
            s.playerId ===
            selectedPlayerId
        );
    }

    if (!shots.length) {
      el.innerHTML =
        `<div class="empty-message">
          슛 위치를 기록하면 구역별 분석이 표시돼용.
        </div>`;

      return;
    }

    const zones = [
      ["골밑", 0, 0],
      ["미들", 0, 0],
      ["외곽", 0, 0]
    ];

    shots.forEach(
      shot => {
        const center =
          $("shotChartCanvas").width / 2;

        const distance =
          Math.abs(
            shot.x - center
          );

        let zone = 0;

        if (shot.y > 430) {
          zone = 0;
        } else if (distance < 180) {
          zone = 1;
        } else {
          zone = 2;
        }

        zones[zone][1]++;

        if (shot.made) {
          zones[zone][2]++;
        }
      }
    );

    el.innerHTML =
      zones.map(
        ([name, total, made]) => `
        <div class="zone-card">
          <span>${name}</span>

          <strong>
            ${percent(made, total)}
          </strong>

          <small>
            ${made}/${total} 성공
          </small>
        </div>
        `
      ).join("");
  }

  function renderShotTrend() {
    const el =
      $("shotTrendList");

    if (!el) return;

    const periods = {};

    game().shots.forEach(
      shot => {
        if (!periods[shot.period]) {
          periods[shot.period] = {
            made: 0,
            total: 0
          };
        }

        periods[shot.period].total++;

        if (shot.made) {
          periods[shot.period].made++;
        }
      }
    );

    const keys =
      Object.keys(periods)
        .sort((a, b) => a - b);

    if (!keys.length) {
      el.innerHTML =
        `<div class="empty-message">
          슛 기록이 없습니다.
        </div>`;

      return;
    }

    el.innerHTML =
      keys.map(
        period => {
          const data =
            periods[period];

          return `
            <div class="shot-trend-row">
              <span>${period}Q</span>

              <strong>
                ${data.made}/${data.total}
              </strong>

              <span>
                ${percent(
                  data.made,
                  data.total
                )}
              </span>
            </div>
          `;
        }
      ).join("");
  }

  /* =======================================================
     영상 태그
  ======================================================= */

  function saveVideoTag() {
    const playerId =
      $("videoPlayerSelect")?.value;

    const team =
      $("videoTeamSelect")?.value || "A";

    if (!playerId) {
      alert("선수를 선택해주세용.");
      return;
    }

    const video =
      $("analysisVideo");

    const currentTime =
      video?.currentTime || 0;

    game().videoTags.push({
      id: uid("tag"),

      playerId,

      team,

      tag:
        selectedVideoTag ||
        "일반 장면",

      memo:
        $("videoTagMemo")?.value ||
        "",

      time:
        currentTime,

      timestamp:
        Date.now()
    });

    renderVideoTags();

    saveState();
  }

  function renderVideoTags() {
    const el =
      $("videoTagList");

    if (!el) return;

    if (!game().videoTags.length) {
      el.innerHTML =
        `<div class="empty-message">
          저장된 영상 태그가 없습니다.
        </div>`;

      return;
    }

    el.innerHTML =
      game().videoTags
        .slice()
        .reverse()
        .map(
          tag => `
          <div class="video-tag-row">
            <strong>
              ${formatTime(tag.time)}
            </strong>

            <div>
              <b>${escapeHTML(tag.tag)}</b>

              <p>
                ${escapeHTML(tag.memo)}
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

  /* =======================================================
     전력분석
  ======================================================= */

  function renderAnalysis() {
    renderLineupAnalysis();

    renderRanking(
      "plusMinusRanking",
      getAllPlayers()
        .sort(
          (a, b) =>
            b.stats.plusMinus -
            a.stats.plusMinus
        ),
      p => p.stats.plusMinus
    );

    renderRanking(
      "offenseRanking",
      getAllPlayers()
        .sort(
          (a, b) =>
            playerOffense(b) -
            playerOffense(a)
        ),
      playerOffense
    );

    renderRanking(
      "defenseRanking",
      getAllPlayers()
        .sort(
          (a, b) =>
            playerDefense(b) -
            playerDefense(a)
        ),
      playerDefense
    );

    renderTeamStyle();

    drawPassNetwork();
  }

  function playerOffense(p) {
    const s = p.stats;

    return (
      s.pts +
      s.ast * 1.5 +
      s.reb * 0.5 -
      s.to
    );
  }

  function playerDefense(p) {
    const s = p.stats;

    return (
      s.reb +
      s.stl * 2 +
      s.blk * 2 -
      s.pf * 0.5
    );
  }

  function renderRanking(
    id,
    list,
    valueFn
  ) {
    const el = $(id);

    if (!el) return;

    const valid =
      list.filter(
        p => valueFn(p) !== 0
      );

    if (!valid.length) {
      el.innerHTML =
        `<div class="empty-message">
          아직 기록이 없습니다.
        </div>`;

      return;
    }

    el.innerHTML =
      valid
        .slice(0, 10)
        .map(
          (p, i) => `
          <div class="ranking-row">
            <div class="rank-number">
              ${i + 1}
            </div>

            <div>
              <strong>
                ${escapeHTML(p.name)}
              </strong>

              <span>
                ${p.team} · #${escapeHTML(p.number)}
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

  function renderLineupAnalysis() {
    const el =
      $("lineupAnalysisList");

    if (!el) return;

    const groups = {};

    getAllPlayers()
      .filter(p => p.onCourt)
      .forEach(p => {
        const key =
          p.team;

        if (!groups[key]) {
          groups[key] = {
            team: key,
            players: [],
            plus: 0,
            pts: 0,
            ast: 0
          };
        }

        groups[key].players.push(
          p.name
        );

        groups[key].plus +=
          p.stats.plusMinus;

        groups[key].pts +=
          p.stats.pts;

        groups[key].ast +=
          p.stats.ast;
      });

    if (!Object.keys(groups).length) {
      el.innerHTML =
        `<div class="empty-message">
          라인업 기록이 없습니다.
        </div>`;

      return;
    }

    el.innerHTML =
      Object.values(groups)
        .map(
          group => `
          <div class="lineup-analysis-row">
            <strong>
              ${escapeHTML(
                group.players.join(" · ")
              )}
            </strong>

            <span>
              PTS ${group.pts}
            </span>

            <span>
              AST ${group.ast}
            </span>

            <span>
              +/- ${group.plus}
            </span>

            <span>
              ${
                group.plus >= 0
                  ? "긍정적"
                  : "보완 필요"
              }
            </span>
          </div>
          `
        )
        .join("");
  }

  function renderTeamStyle() {
    const el =
      $("teamStyleAnalysis");

    if (!el) return;

    const output =
      ["A", "B"].map(team => {
        const pts =
          game().score[team];

        const ast =
          teamStat(team, "ast");

        const to =
          teamStat(team, "to");

        const reb =
          teamStat(team, "reb");

        const styleScore =
          clamp(
            pts * 3 +
            ast * 5 +
            reb * 2 -
            to * 4,
            0,
            100
          );

        const name =
          team === "A"
            ? game().gameInfo.teamA
            : game().gameInfo.teamB;

        return `
          <div class="team-style-card">
            <h4>${escapeHTML(name)}</h4>

            <div class="style-meter">
              <div
                style="width:${styleScore}%"
              ></div>
            </div>

            <p>
              득점 ${pts} · 어시스트 ${ast}
              · 리바운드 ${reb} · 턴오버 ${to}
            </p>

            <p>
              ${
                ast >= to
                  ? "패스와 볼 흐름을 비교적 안정적으로 유지하는 팀이에용."
                  : "턴오버 관리와 공격 전개 안정성이 보완 포인트예용."
              }
            </p>
          </div>
        `;
      });

    el.innerHTML =
      output.join("");
  }

  function drawPassNetwork() {
    const canvas =
      $("passNetworkCanvas");

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const team =
      $("passNetworkTeam")?.value ||
      "A";

    const list =
      players()[team];

    const active =
      list.filter(p => p.onCourt);

    if (!active.length) return;

    const cx =
      canvas.width / 2;

    const cy =
      canvas.height / 2;

    active.forEach(
      (player, index) => {
        const angle =
          (Math.PI * 2 * index) /
          active.length;

        const x =
          cx +
          Math.cos(angle) * 160;

        const y =
          cy +
          Math.sin(angle) * 150;

        player.__networkX = x;
        player.__networkY = y;
      }
    );

    active.forEach(
      player => {
        const x =
          player.__networkX;

        const y =
          player.__networkY;

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          32,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          team === "A"
            ? "#102c47"
            : "#431a20";

        ctx.fill();

        ctx.strokeStyle =
          team === "A"
            ? "#2f93ff"
            : "#ff4c55";

        ctx.stroke();

        ctx.fillStyle =
          "#ffffff";

        ctx.textAlign =
          "center";

        ctx.font =
          "bold 13px sans-serif";

        ctx.fillText(
          `#${player.number}`,
          x,
          y - 3
        );

        ctx.font =
          "11px sans-serif";

        ctx.fillText(
          player.name,
          x,
          y + 13
        );
      }
    );
  }

  /* =======================================================
     리포트
  ======================================================= */

  function generateGameReport() {
    const el =
      $("gameReportOutput");

    if (!el) return;

    const g = game();

    const winner =
      g.score.A === g.score.B
        ? "무승부"
        : g.score.A > g.score.B
        ? g.gameInfo.teamA
        : g.gameInfo.teamB;

    const top =
      [...getAllPlayers()]
        .sort(
          (a, b) =>
            playerImpact(b) -
            playerImpact(a)
        )[0];

    el.innerHTML = `
      <div class="report-highlight">
        <strong>
          ${escapeHTML(winner)}
        </strong>
        ${
          winner === "무승부"
            ? ""
            : " 우세"
        }
      </div>

      <h4>경기 결과</h4>

      <p>
        ${escapeHTML(g.gameInfo.teamA)}
        <strong>${g.score.A}</strong>
        :
        <strong>${g.score.B}</strong>
        ${escapeHTML(g.gameInfo.teamB)}
      </p>

      <h4>경기 모드</h4>

      <p>
        ${
          g.mode === MODE.THREE
            ? "3대3"
            : "5대5"
        }
      </p>

      <h4>MVP 후보</h4>

      <p>
        ${
          top
            ? `#${escapeHTML(
                top.number
              )} ${escapeHTML(
                top.name
              )} · 영향도 ${playerImpact(
                top
              ).toFixed(1)}`
            : "기록 없음"
        }
      </p>

      <h4>팀 분석</h4>

      <ul>
        <li>
          A팀 리바운드:
          ${teamStat("A", "reb")}
        </li>

        <li>
          B팀 리바운드:
          ${teamStat("B", "reb")}
        </li>

        <li>
          A팀 어시스트:
          ${teamStat("A", "ast")}
        </li>

        <li>
          B팀 어시스트:
          ${teamStat("B", "ast")}
        </li>

        <li>
          A팀 턴오버:
          ${teamStat("A", "to")}
        </li>

        <li>
          B팀 턴오버:
          ${teamStat("B", "to")}
        </li>
      </ul>
    `;

    generateAIComment();
  }

  function generatePlayerReport() {
    const id =
      $("reportPlayerSelect")?.value;

    const el =
      $("playerReportOutput");

    if (!el) return;

    const p =
      getPlayer(id);

    if (!p) {
      el.innerHTML =
        `<div class="empty-message">
          선수를 선택해주세용.
        </div>`;

      return;
    }

    const s = p.stats;

    el.innerHTML = `
      <div class="report-blue-box">
        <strong>
          ${escapeHTML(p.name)}
        </strong>

        · ${p.team} · #${escapeHTML(p.number)}
      </div>

      <h4>기본 기록</h4>

      <ul>
        <li>PTS: ${s.pts}</li>
        <li>REB: ${s.reb}</li>
        <li>AST: ${s.ast}</li>
        <li>STL: ${s.stl}</li>
        <li>BLK: ${s.blk}</li>
        <li>TO: ${s.to}</li>
        <li>PF: ${s.pf}</li>
        <li>+/-: ${s.plusMinus}</li>
      </ul>

      <h4>슈팅</h4>

      <p>
        FG ${s.fgMade}/${s.fgAttempt}
        (${percent(
          s.fgMade,
          s.fgAttempt
        )})
      </p>

      <p>
        2PT ${s.fg2Made}/${s.fg2Attempt}
      </p>

      <p>
        3PT ${s.fg3Made}/${s.fg3Attempt}
      </p>

      <p>
        FT ${s.ftMade}/${s.ftAttempt}
      </p>
    `;

    generatePlayerTraining(p);
  }

  function generateAIComment() {
    const el =
      $("aiCommentOutput");

    if (!el) return;

    const all =
      getAllPlayers();

    if (!all.length) return;

    const best =
      [...all]
        .sort(
          (a, b) =>
            playerImpact(b) -
            playerImpact(a)
        )[0];

    let comment =
      `${best.name} 선수는 현재 공격과 수비에서 가장 높은 종합 영향도를 보여주고 있어용.`;

    if (best.stats.to > best.stats.ast) {
      comment +=
        " 다만 턴오버 관리가 다음 경기의 핵심 보완 포인트예용.";
    } else if (
      best.stats.ast >= 3
    ) {
      comment +=
        " 특히 동료를 살리는 플레이가 눈에 띄어용.";
    }

    el.innerHTML =
      `<div class="report-highlight">
        ${escapeHTML(comment)}
      </div>`;
  }

  function generatePlayerTraining(player) {
    const el =
      $("trainingPlanOutput");

    if (!el) return;

    const s = player.stats;

    const plans = [];

    if (s.to > s.ast) {
      plans.push(
        [
          "볼 컨트롤",
          "압박 상황에서 드리블과 패스 선택 훈련",
          "8~10분"
        ]
      );
    }

    if (
      s.fgAttempt > 0 &&
      s.fgMade / s.fgAttempt < 0.4
    ) {
      plans.push(
        [
          "슈팅 정확도",
          "중거리·외곽 슈팅 폼과 밸런스 훈련",
          "15분"
        ]
      );
    }

    if (s.reb < 3) {
      plans.push(
        [
          "리바운드",
          "박스아웃과 공 위치 반응 훈련",
          "10분"
        ]
      );
    }

    if (s.stl + s.blk === 0) {
      plans.push(
        [
          "수비",
          "스텝과 1대1 수비 위치 선정",
          "10분"
        ]
      );
    }

    if (!plans.length) {
      plans.push(
        [
          "종합 유지",
          "현재 강점을 유지하면서 경기 상황별 의사결정 훈련",
          "15분"
        ]
      );
    }

    el.innerHTML =
      plans.map(
        ([title, desc, time]) => `
          <div class="training-card">
            <h4>${title}</h4>
            <p>${desc}</p>
            <p><strong>권장 시간:</strong> ${time}</p>
          </div>
        `
      ).join("");
  }

  /* =======================================================
     저장 경기
  ======================================================= */

  function saveGame() {
    const g = game();

    const copy =
      structuredClone(g);

    state.savedGames.push({
      id: uid("saved"),
      savedAt: new Date().toISOString(),

      mode: state.currentMode,

      title:
        g.gameInfo.title ||
        `${g.gameInfo.teamA} vs ${g.gameInfo.teamB}`,

      game: copy
    });

    saveState();

    renderSavedGames();

    alert("경기가 저장되었어용.");
  }

  function renderSavedGames() {
    const el =
      $("savedGameList");

    if (!el) return;

    if (!state.savedGames.length) {
      el.innerHTML =
        `<div class="empty-message">
          저장된 경기가 없습니다.
        </div>`;

      return;
    }

    el.innerHTML =
      state.savedGames
        .slice()
        .reverse()
        .map(
          item => `
          <div class="saved-game-row">

            <div>
              <strong>
                ${escapeHTML(item.title)}
              </strong>

              <span>
                ${
                  item.mode === MODE.THREE
                    ? "3대3"
                    : "5대5"
                }
                ·
                ${new Date(
                  item.savedAt
                ).toLocaleString("ko-KR")}
              </span>
            </div>

            <button
              type="button"
              data-load-saved="${item.id}"
            >
              불러오기
            </button>

            <button
              type="button"
              data-delete-saved="${item.id}"
            >
              삭제
            </button>

          </div>
        `
        )
        .join("");
  }

  function loadSavedGame(id) {
    const item =
      state.savedGames.find(
        x => x.id === id
      );

    if (!item) return;

    state.currentMode =
      item.mode;

    state.modes[item.mode] =
      structuredClone(item.game);

    renderAll();

    saveState();

    alert("저장 경기를 불러왔어용.");
  }

  function deleteSavedGame(id) {
    state.savedGames =
      state.savedGames.filter(
        x => x.id !== id
      );

    saveState();

    renderSavedGames();
  }

  /* =======================================================
     JSON
  ======================================================= */

  function exportJSON() {
    const blob =
      new Blob(
        [
          JSON.stringify(
            state,
            null,
            2
          )
        ],
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
      `courtvision-${state.currentMode}-${today()}.json`;

    a.click();

    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      try {
        const imported =
          JSON.parse(
            reader.result
          );

        state =
          normalizeState(
            imported
          );

        saveState();

        renderAll();

        alert(
          "JSON 데이터를 불러왔어용."
        );
      } catch {
        alert(
          "JSON 파일을 읽을 수 없어용."
        );
      }
    };

    reader.readAsText(file);
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
        "+/-",
        "OFF",
        "DEF"
      ]
    ];

    getAllPlayers()
      .forEach(p => {
        const s = p.stats;

        rows.push([
          p.team,
          p.number,
          p.name,
          formatTime(p.timeOnCourt),
          s.pts,
          s.reb,
          s.ast,
          s.stl,
          s.blk,
          s.to,
          s.pf,
          `${s.fgMade}/${s.fgAttempt}`,
          percent(
            s.fgMade,
            s.fgAttempt
          ),
          s.plusMinus,
          s.off,
          s.def
        ]);
      });

    const csv =
      rows
        .map(
          row =>
            row
              .map(
                value =>
                  `"${String(value)
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
            "text/csv;charset=utf-8;"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `courtvision-record-${state.currentMode}-${today()}.csv`;

    a.click();

    URL.revokeObjectURL(url);
  }

  /* =======================================================
     리그
  ======================================================= */

  function addLeagueTeam() {
    const input =
      $("leagueTeamNameInput");

    const name =
      input?.value.trim();

    if (!name) return;

    state.league.teams.push({
      id: uid("league"),
      name,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0
    });

    input.value = "";

    saveState();

    renderLeague();
  }

  function removeLeagueTeam(id) {
    state.league.teams =
      state.league.teams.filter(
        t => t.id !== id
      );

    saveState();

    renderLeague();
  }

  function renderLeague() {
    renderLeagueTeams();

    renderLeagueStandings();

    renderSchedule();

    renderSeasonLeaders();
  }

  function renderLeagueTeams() {
    const el =
      $("leagueTeamList");

    if (!el) return;

    if (!state.league.teams.length) {
      el.innerHTML =
        `<div class="empty-message">
          등록된 리그 팀이 없습니다.
        </div>`;

      return;
    }

    el.innerHTML =
      state.league.teams
        .map(
          team => `
          <div class="league-team-row">
            <strong>
              ${escapeHTML(team.name)}
            </strong>

            <button
              type="button"
              data-remove-league="${team.id}"
            >
              삭제
            </button>
          </div>
          `
        )
        .join("");
  }

  function renderLeagueStandings() {
    const body =
      $("leagueStandingsBody");

    if (!body) return;

    const list =
      [...state.league.teams]
        .sort(
          (a, b) =>
            b.wins - a.wins ||
            (
              b.pointsFor -
              b.pointsAgainst
            ) -
            (
              a.pointsFor -
              a.pointsAgainst
            )
        );

    if (!list.length) {
      body.innerHTML =
        `<tr>
          <td colspan="9" class="empty-cell">
            리그 결과가 없습니다.
          </td>
        </tr>`;

      return;
    }

    body.innerHTML =
      list.map(
        (team, index) => {
          const winRate =
            team.played
              ? (
                  team.wins /
                  team.played *
                  100
                ).toFixed(1) + "%"
              : "0%";

          return `
          <tr>
            <td>${index + 1}</td>

            <td>${escapeHTML(team.name)}</td>

            <td>${team.played}</td>

            <td>${team.wins}</td>

            <td>${team.losses}</td>

            <td>${team.pointsFor}</td>

            <td>${team.pointsAgainst}</td>

            <td>
              ${
                team.pointsFor -
                team.pointsAgainst
              }
            </td>

            <td>${winRate}</td>
          </tr>
          `;
        }
      ).join("");
  }

  function renderSchedule() {
    const list =
      $("scheduleList");

    if (!list) return;

    const aSelect =
      $("scheduleTeamASelect");

    const bSelect =
      $("scheduleTeamBSelect");

    const options =
      `<option value="">
        팀 선택
      </option>` +
      state.league.teams
        .map(
          team =>
            `<option value="${team.id}">
              ${escapeHTML(team.name)}
            </option>`
        )
        .join("");

    if (aSelect) {
      const current = aSelect.value;

      aSelect.innerHTML =
        options;

      aSelect.value = current;
    }

    if (bSelect) {
      const current = bSelect.value;

      bSelect.innerHTML =
        options;

      bSelect.value = current;
    }

    if (!state.league.schedule.length) {
      list.innerHTML =
        `<div class="empty-message">
          등록된 경기 일정이 없습니다.
        </div>`;

      return;
    }

    list.innerHTML =
      state.league.schedule
        .map(
          item => {
            const a =
              state.league.teams.find(
                t => t.id === item.a
              );

            const b =
              state.league.teams.find(
                t => t.id === item.b
              );

            return `
              <div class="schedule-row">
                <time>
                  ${escapeHTML(item.date || "")}
                  ${
                    item.time
                      ? ` ${escapeHTML(item.time)}`
                      : ""
                  }
                </time>

                <strong>
                  ${
                    a
                      ? escapeHTML(a.name)
                      : "삭제된 팀"
                  }
                  VS
                  ${
                    b
                      ? escapeHTML(b.name)
                      : "삭제된 팀"
                  }
                </strong>

                <span>
                  예정
                </span>

                <button
                  type="button"
                  data-delete-schedule="${item.id}"
                >
                  삭제
                </button>
              </div>
            `;
          }
        )
        .join("");
  }

  function addSchedule() {
    const a =
      $("scheduleTeamASelect")?.value;

    const b =
      $("scheduleTeamBSelect")?.value;

    if (!a || !b || a === b) {
      alert(
        "서로 다른 두 팀을 선택해주세용."
      );
      return;
    }

    state.league.schedule.push({
      id: uid("schedule"),

      a,

      b,

      date:
        $("scheduleDateInput")?.value ||
        "",

      time:
        $("scheduleTimeInput")?.value ||
        ""
    });

    saveState();

    renderLeague();
  }

  function resetLeague() {
    if (
      !confirm(
        "리그 데이터를 모두 초기화할까용?"
      )
    ) {
      return;
    }

    state.league = {
      teams: [],
      schedule: [],
      results: []
    };

    saveState();

    renderLeague();
  }

  function renderSeasonLeaders() {
    const all =
      getAllPlayers();

    if (!all.length) return;

    const best = stat =>
      [...all]
        .sort(
          (a, b) =>
            b.stats[stat] -
            a.stats[stat]
        )[0];

    setText(
      "seasonPointsLeader",
      `${best("pts").name} · ${best("pts").stats.pts}`
    );

    setText(
      "seasonReboundLeader",
      `${best("reb").name} · ${best("reb").stats.reb}`
    );

    setText(
      "seasonAssistLeader",
      `${best("ast").name} · ${best("ast").stats.ast}`
    );

    const defensive =
      [...all]
        .sort(
          (a, b) =>
            playerDefense(b) -
            playerDefense(a)
        )[0];

    setText(
      "seasonDefenseLeader",
      `${defensive.name}`
    );

    const mvp =
      [...all]
        .sort(
          (a, b) =>
            playerImpact(b) -
            playerImpact(a)
        )[0];

    setText(
      "seasonMvpLeader",
      `${mvp.name}`
    );
  }

  /* =======================================================
     리포트 선수 선택
  ======================================================= */

  function renderReportPlayerSelect() {
    const select =
      $("reportPlayerSelect");

    if (!select) return;

    const current =
      select.value;

    select.innerHTML =
      `<option value="">
        개인 리포트 선수 선택
      </option>` +
      getAllPlayers()
        .map(
          p =>
            `<option value="${p.id}">
              ${p.team} · #${escapeHTML(
                p.number
              )}
              ${escapeHTML(p.name)}
            </option>`
        )
        .join("");

    select.value = current;
  }

  function renderVideoPlayerSelect() {
    const select =
      $("videoPlayerSelect");

    if (!select) return;

    const current =
      select.value;

    select.innerHTML =
      `<option value="">
        선수를 선택해주세용
      </option>` +
      getAllPlayers()
        .map(
          p =>
            `<option value="${p.id}">
              ${p.team} · #${escapeHTML(
                p.number
              )}
              ${escapeHTML(p.name)}
            </option>`
        )
        .join("");

    select.value = current;
  }

  function renderShotPlayerSelect() {
    const select =
      $("shotPlayerSelect");

    if (!select) return;

    const current =
      select.value;

    select.innerHTML =
      `<option value="">
        선수를 선택해주세용
      </option>` +
      getAllPlayers()
        .map(
          p =>
            `<option value="${p.id}">
              ${p.team} · #${escapeHTML(
                p.number
              )}
              ${escapeHTML(p.name)}
            </option>`
        )
        .join("");

    select.value = current;
  }

  function renderPeriodFilters() {
    const filters = [
      $("recordFilterPeriod"),
      $("shotPeriodFilter")
    ];

    filters.forEach(
      select => {
        if (!select) return;

        const current =
          select.value;

        select.innerHTML =
          `<option value="all">
            전체 구간
          </option>` +
          Array.from(
            {
              length: game().period
            },
            (_, i) =>
              `<option value="${i + 1}">
                ${i + 1}Q
              </option>`
          ).join("");

        select.value =
          current || "all";
      }
    );
  }

  /* =======================================================
     설정값 화면
  ======================================================= */

  function renderSetupValues() {
    const g = game();

    setValue(
      "gameDate",
      g.gameInfo.date
    );

    setValue(
      "gameTitle",
      g.gameInfo.title
    );

    setValue(
      "gameLocation",
      g.gameInfo.location
    );

    setValue(
      "competitionName",
      g.gameInfo.competition
    );

    setValue(
      "teamAName",
      g.gameInfo.teamA
    );

    setValue(
      "teamBName",
      g.gameInfo.teamB
    );

    setValue(
      "gameMinutes",
      g.gameInfo.minutes
    );

    setValue(
      "shotClockSeconds",
      g.gameInfo.shotClock
    );

    setValue(
      "periodType",
      g.gameInfo.periodType
    );

    setValue(
      "targetScore",
      g.gameInfo.targetScore
    );
  }

  /* =======================================================
     시계 렌더
  ======================================================= */

  function renderClock() {
    setText(
      "gameClock",
      formatTime(
        game().gameClock
      )
    );

    setText(
      "shotClock",
      game().shotClock
    );
  }

  /* =======================================================
     탭
  ======================================================= */

  function activateTab(tabId) {
    qsa(".tab-section")
      .forEach(
        section =>
          section.classList.toggle(
            "active",
            section.id === tabId
          )
      );

    qsa(".nav-btn")
      .forEach(
        button =>
          button.classList.toggle(
            "active",
            button.dataset.tab === tabId
          )
      );
  }

  /* =======================================================
     전체 렌더
  ======================================================= */

  function renderAll() {
    renderSetupValues();

    renderPlayerSetup();

    renderLive();

    renderClock();

    renderRecords();

    renderShotChart();

    renderMiniCourt();

    renderShotSummary();

    renderZoneAnalysis();

    renderShotTrend();

    renderVideoTags();

    renderReportPlayerSelect();

    renderVideoPlayerSelect();

    renderShotPlayerSelect();

    renderPeriodFilters();

    renderAnalysis();

    renderSavedGames();

    renderLeague();

    updateModeButtons();
  }

  function updateModeButtons() {
    const three =
      $("mode3v3Btn");

    const five =
      $("mode5v5Btn");

    if (three) {
      three.classList.toggle(
        "active",
        state.currentMode === MODE.THREE
      );
    }

    if (five) {
      five.classList.toggle(
        "active",
        state.currentMode === MODE.FIVE
      );
    }
  }

  /* =======================================================
     버튼 이벤트
  ======================================================= */

  function bindEvents() {
    /* 모드 */

    $("mode3v3Btn")?.addEventListener(
      "click",
      () => switchMode(MODE.THREE)
    );

    $("mode5v5Btn")?.addEventListener(
      "click",
      () => switchMode(MODE.FIVE)
    );

    /* 탭 */

    qsa(".nav-btn")
      .forEach(
        btn => {
          btn.addEventListener(
            "click",
            () =>
              activateTab(
                btn.dataset.tab
              )
          );
        }
      );

    /* 설정 */

    $("toggleSetupBtn")
      ?.addEventListener(
        "click",
        () =>
          $("setupPanel")
            ?.classList.toggle(
              "open"
            )
      );

    $("closeSetupBtn")
      ?.addEventListener(
        "click",
        () =>
          $("setupPanel")
            ?.classList.remove(
              "open"
            )
      );

    $("saveSetupBtn")
      ?.addEventListener(
        "click",
        readSetup
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

    /* 설정 선수 */

    document.addEventListener(
      "click",
      event => {
        const target =
          event.target;

        const remove =
          target.closest(
            "[data-remove-player]"
          );

        if (remove) {
          const row =
            remove.closest(
              ".player-form-row"
            );

          if (!row) return;

          removePlayer(
            row.parentElement.id ===
              "teamAPlayers"
              ? "A"
              : "B",
            remove.dataset.id
          );

          return;
        }

        const onCourt =
          target.closest(
            "[data-oncourt-player]"
          );

        if (onCourt) {
          const row =
            onCourt.closest(
              ".player-form-row"
            );

          if (!row) return;

          toggleOnCourt(
            row.parentElement.id ===
              "teamAPlayers"
              ? "A"
              : "B",
            onCourt.dataset.id
          );

          return;
        }

        const selected =
          target.closest(
            "[data-select-player]"
          );

        if (selected) {
          selectPlayer(
            selected.dataset.selectPlayer
          );

          return;
        }

        const savedLoad =
          target.closest(
            "[data-load-saved]"
          );

        if (savedLoad) {
          loadSavedGame(
            savedLoad.dataset.loadSaved
          );

          return;
        }

        const savedDelete =
          target.closest(
            "[data-delete-saved]"
          );

        if (savedDelete) {
          deleteSavedGame(
            savedDelete.dataset.deleteSaved
          );

          return;
        }

        const leagueRemove =
          target.closest(
            "[data-remove-league]"
          );

        if (leagueRemove) {
          removeLeagueTeam(
            leagueRemove.dataset.removeLeague
          );

          return;
        }

        const scheduleDelete =
          target.closest(
            "[data-delete-schedule]"
          );

        if (scheduleDelete) {
          state.league.schedule =
            state.league.schedule.filter(
              x =>
                x.id !==
                scheduleDelete.dataset.deleteSchedule
            );

          saveState();

          renderLeague();

          return;
        }

        const videoDelete =
          target.closest(
            "[data-delete-video-tag]"
          );

        if (videoDelete) {
          game().videoTags =
            game().videoTags.filter(
              x =>
                x.id !==
                videoDelete.dataset.deleteVideoTag
            );

          saveState();

          renderVideoTags();

          return;
        }
      }
    );

    /* 선수 액션 */

    qsa(".stat-btn")
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () =>
              recordAction(
                button.dataset.action
              )
          );
        }
      );

    /* 빠른 기능 */

    $("undoLastActionBtn")
      ?.addEventListener(
        "click",
        undoLastAction
      );

    $("nextPeriodBtn")
      ?.addEventListener(
        "click",
        nextPeriod
      );

    $("teamATimeoutBtn")
      ?.addEventListener(
        "click",
        () =>
          takeTimeout("A")
      );

    $("teamBTimeoutBtn")
      ?.addEventListener(
        "click",
        () =>
          takeTimeout("B")
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
        stopClock
      );

    $("startClockBtn")
      ?.addEventListener(
        "click",
        startClock
      );

    $("pauseClockBtn")
      ?.addEventListener(
        "click",
        stopClock
      );

    $("resetShotClockBtn")
      ?.addEventListener(
        "click",
        resetShotClock
      );

    /* 저장 */

    $("saveGameBtn")
      ?.addEventListener(
        "click",
        saveGame
      );

    $("exportJsonBtn")
      ?.addEventListener(
        "click",
        exportJSON
      );

    $("importJsonInput")
      ?.addEventListener(
        "change",
        event =>
          importJSON(
            event.target.files[0]
          )
      );

    $("exportCsvBtn")
      ?.addEventListener(
        "click",
        exportCSV
      );

    /* 초기화 */

    $("resetGameBtn")
      ?.addEventListener(
        "click",
        () => {
          if (
            !confirm(
              "현재 모드의 경기 데이터를 초기화할까용?"
            )
          ) {
            return;
          }

          state.modes[
            state.currentMode
          ] =
            createGameMode(
              state.currentMode
            );

          selectedPlayerId = null;

          stopClock();

          saveState();

          renderAll();
        }
      );

    /* 슛차트 */

    $("recordMadeShotBtn")
      ?.addEventListener(
        "click",
        () =>
          recordShotFromButton(true)
      );

    $("recordMissShotBtn")
      ?.addEventListener(
        "click",
        () =>
          recordShotFromButton(false)
      );

    $("toggleHeatmapBtn")
      ?.addEventListener(
        "click",
        event => {
          heatmapEnabled =
            !heatmapEnabled;

          event.currentTarget.textContent =
            heatmapEnabled
              ? "히트맵 끄기"
              : "히트맵 켜기";

          renderShotChart();
        }
      );

    $("clearShotChartBtn")
      ?.addEventListener(
        "click",
        () => {
          game().shots = [];

          saveState();

          renderShotChart();

          renderMiniCourt();

          renderShotSummary();

          renderZoneAnalysis();

          renderShotTrend();
        }
      );

    $("shotPlayerSelect")
      ?.addEventListener(
        "change",
        event => {
          selectedPlayerId =
            event.target.value ||
            selectedPlayerId;

          renderShotChart();

          renderShotSummary();

          renderZoneAnalysis();

          renderShotTrend();
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

    $("shotChartCanvas")
      ?.addEventListener(
        "click",
        event => {
          const canvas =
            event.currentTarget;

          const rect =
            canvas.getBoundingClientRect();

          const x =
            (
              event.clientX -
              rect.left
            ) *
            canvas.width /
            rect.width;

          const y =
            (
              event.clientY -
              rect.top
            ) *
            canvas.height /
            rect.height;

          const type =
            prompt(
              "슛 종류를 입력해주세용: 2PT / 3PT / FT",
              "2PT"
            );

          if (
            ![
              "2PT",
              "3PT",
              "FT"
            ].includes(
              String(type).toUpperCase()
            )
          ) {
            return;
          }

          const made =
            confirm(
              "성공 슛이면 확인, 실패면 취소를 눌러주세용."
            );

          addShotAt(
            x,
            y,
            made,
            String(type).toUpperCase()
          );
        }
      );

    /* 기록 필터 */

    $("recordFilterTeam")
      ?.addEventListener(
        "change",
        renderRecords
      );

    $("recordFilterPeriod")
      ?.addEventListener(
        "change",
        renderRecords
      );

    $("playerDetailSelect")
      ?.addEventListener(
        "change",
        event =>
          renderPlayerDetail(
            event.target.value
          )
      );

    /* 영상 */

    qsa(".tag-btn")
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () => {
              qsa(".tag-btn")
                .forEach(
                  b =>
                    b.classList.remove(
                      "selected"
                    )
                );

              button.classList.add(
                "selected"
              );

              selectedVideoTag =
                button.dataset.tag;
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
          game().videoTags = [];

          saveState();

          renderVideoTags();
        }
      );

    $("videoFileInput")
      ?.addEventListener(
        "change",
        event => {
          const file =
            event.target.files[0];

          if (!file) return;

          $("videoFileName").textContent =
            file.name;

          const video =
            $("analysisVideo");

          video.src =
            URL.createObjectURL(file);

          video.load();
        }
      );

    $("back10Btn")
      ?.addEventListener(
        "click",
        () =>
          seekVideo(-10)
      );

    $("back5Btn")
      ?.addEventListener(
        "click",
        () =>
          seekVideo(-5)
      );

    $("forward5Btn")
      ?.addEventListener(
        "click",
        () =>
          seekVideo(5)
      );

    $("forward10Btn")
      ?.addEventListener(
        "click",
        () =>
          seekVideo(10)
      );

    $("playPauseBtn")
      ?.addEventListener(
        "click",
        toggleVideo
      );

    $("speed05Btn")
      ?.addEventListener(
        "click",
        () =>
          setVideoSpeed(0.5)
      );

    $("speed10Btn")
      ?.addEventListener(
        "click",
        () =>
          setVideoSpeed(1)
      );

    $("speed15Btn")
      ?.addEventListener(
        "click",
        () =>
          setVideoSpeed(1.5)
      );

    $("speed20Btn")
      ?.addEventListener(
        "click",
        () =>
          setVideoSpeed(2)
      );

    /* 분석 */

    $("passNetworkTeam")
      ?.addEventListener(
        "change",
        drawPassNetwork
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
        () => {
          const id =
            $("reportPlayerSelect")
              ?.value;

          const p =
            getPlayer(id);

          if (!p) {
            alert(
              "선수를 선택해주세용."
            );
            return;
          }

          generatePlayerTraining(p);
        }
      );

    $("printReportBtn")
      ?.addEventListener(
        "click",
        () =>
          window.print()
      );

    /* 리그 */

    $("addLeagueTeamBtn")
      ?.addEventListener(
        "click",
        addLeagueTeam
      );

    $("resetLeagueBtn")
      ?.addEventListener(
        "click",
        resetLeague
      );

    $("addScheduleBtn")
      ?.addEventListener(
        "click",
        addSchedule
      );
  }

  /* =======================================================
     영상 제어
  ======================================================= */

  function seekVideo(seconds) {
    const video =
      $("analysisVideo");

    if (!video) return;

    video.currentTime =
      Math.max(
        0,
        Math.min(
          video.duration || Infinity,
          video.currentTime +
            seconds
        )
      );
  }

  function toggleVideo() {
    const video =
      $("analysisVideo");

    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }

  function setVideoSpeed(speed) {
    const video =
      $("analysisVideo");

    if (!video) return;

    video.playbackRate =
      speed;
  }

  /* =======================================================
     헬퍼
  ======================================================= */

  function setText(id, value) {
    const el = $(id);

    if (el) {
      el.textContent =
        value ?? "";
    }
  }

  function setValue(id, value) {
    const el = $(id);

    if (el) {
      el.value =
        value ?? "";
    }
  }

  function setWidth(id, value) {
    const el = $(id);

    if (el) {
      el.style.width =
        value;
    }
  }

  /* =======================================================
     초기화
  ======================================================= */

  function init() {
    bindEvents();

    renderAll();

    activateTab(
      "liveSection"
    );

    console.log(
      `%cCOURTVISION PRO%c ${state.currentMode} initialized`,
      "font-weight:900;color:#2f93ff",
      "color:inherit"
    );
  }

  init();

})();