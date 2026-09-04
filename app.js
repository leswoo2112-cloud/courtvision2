"use strict";

/* =========================================================
   COURTVISION PRO
   PRO BASKETBALL ANALYTICS
   FINAL BUILD
   2026-09-04

   핵심 원칙
   ---------------------------------------------------------
   1. 실제 입력 데이터만 사용
   2. 경기 시작 전 기록 입력 금지
   3. 3v3 / 5v5 데이터 엔진 분리
   4. 슛 위치는 사용자가 실제 코트를 클릭
   5. 저장 데이터는 LocalStorage
   6. 버튼은 모두 명시적인 이벤트로 연결
========================================================= */


/* =========================================================
   DOM
========================================================= */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEY = "COURTVISION_PRO_FINAL_20260904_V2";


/* =========================================================
   HELPERS
========================================================= */

function uid(prefix = "id") {
  if (window.crypto && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}


function esc(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}


function pct(made, attempts) {
  if (!attempts) return "기록 없음";
  return `${((made / attempts) * 100).toFixed(1)}%`;
}


function numPct(made, attempts) {
  if (!attempts) return null;
  return (made / attempts) * 100;
}


function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;

  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}


function formatDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}


function toast(message) {
  const el = $("#toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(window.__cvToastTimer);

  window.__cvToastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 1800);
}


/* =========================================================
   DEFAULT STATE
========================================================= */

function defaultState() {
  return {
    version: 2,

    mode: "3v3",

    page: "live",

    setupComplete: false,

    selectedPlayerId: null,

    selectedTeam: "A",

    pendingShot: null,

    pendingPass: null,

    game: {
      id: uid("game"),

      name: "",

      tournament: "",

      date: formatDate(),

      teamA: "HOME",

      teamB: "AWAY",

      period: 1,

      clock: 600,

      periodLength: 600,

      shotClock: 14,

      shotClockMax: 14,

      running: false,

      ended: false,

      startedAt: null,

      endedAt: null
    },

    players: [],

    events: [],

    shots: [],

    passes: [],

    savedGames: [],

    league: {
      name: "",
      teams: [],
      games: []
    },

    video: {
      name: "",
      url: ""
    },

    reportPlayerId: null
  };
}


/* =========================================================
   LOAD STATE SAFELY
========================================================= */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultState();
    }

    const parsed = JSON.parse(raw);

    const base = defaultState();

    return {
      ...base,
      ...parsed,

      game: {
        ...base.game,
        ...(parsed.game || {})
      },

      league: {
        ...base.league,
        ...(parsed.league || {})
      },

      video: {
        ...base.video,
        ...(parsed.video || {})
      },

      players: Array.isArray(parsed.players)
        ? parsed.players
        : [],

      events: Array.isArray(parsed.events)
        ? parsed.events
        : [],

      shots: Array.isArray(parsed.shots)
        ? parsed.shots
        : [],

      passes: Array.isArray(parsed.passes)
        ? parsed.passes
        : [],

      savedGames: Array.isArray(parsed.savedGames)
        ? parsed.savedGames
        : []
    };

  } catch (error) {

    console.error("COURTVISION state load error:", error);

    return defaultState();
  }
}


let S = loadState();


/* =========================================================
   SAVE
========================================================= */

function saveState() {
  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(S)
    );

    return true;

  } catch (error) {

    console.error("COURTVISION save error:", error);

    toast("저장 공간이 부족합니다.");

    return false;
  }
}


/* =========================================================
   TEAM / PLAYER HELPERS
========================================================= */

function teamName(team) {
  return team === "A"
    ? S.game.teamA
    : S.game.teamB;
}


function playersOf(team) {
  return S.players.filter(
    player => player.team === team
  );
}


function getPlayer(id) {
  return S.players.find(
    player => player.id === id
  ) || null;
}


function selectedPlayer() {

  const selected = getPlayer(
    S.selectedPlayerId
  );

  if (selected) return selected;

  const list = playersOf(
    S.selectedTeam
  );

  return list[0] || null;
}


function setSelectedPlayer(id) {

  const player = getPlayer(id);

  if (!player) return;

  S.selectedPlayerId = player.id;

  S.selectedTeam = player.team;

  saveState();

  render();
}


/* =========================================================
   MODE RULES
========================================================= */

function pointsForShot(type) {

  if (type === "FT") {
    return 1;
  }

  if (S.mode === "3v3") {

    if (type === "2PT") return 1;

    if (type === "3PT") return 2;
  }

  if (S.mode === "5v5") {

    if (type === "2PT") return 2;

    if (type === "3PT") return 3;
  }

  return 0;
}


function modePlayerCount() {
  return S.mode === "3v3" ? 3 : 5;
}


function modePeriodCount() {
  return S.mode === "3v3" ? 1 : 4;
}


/* =========================================================
   GAME STATE
========================================================= */

function gameHasStarted() {
  return !!S.game.startedAt;
}


function canRecord() {

  if (!S.setupComplete) {
    toast("먼저 선수 설정을 완료하세요.");
    return false;
  }

  if (!gameHasStarted()) {
    toast("먼저 경기 시작 버튼을 눌러주세요.");
    return false;
  }

  if (S.game.ended) {
    toast("경기가 종료되었습니다.");
    return false;
  }

  return true;
}


function startGame() {

  if (!S.setupComplete) {
    toast("먼저 선수 설정을 완료하세요.");
    openSetup();
    return;
  }

  if (!S.players.length) {
    toast("선수를 등록해주세요.");
    openSetup();
    return;
  }

  S.game.running = true;

  S.game.ended = false;

  S.game.startedAt =
    S.game.startedAt || Date.now();

  S.game.shotClock =
    S.game.shotClockMax;

  saveState();

  render();

  toast("경기를 시작했습니다.");
}


function pauseGame() {

  if (!gameHasStarted()) {
    toast("아직 경기가 시작되지 않았습니다.");
    return;
  }

  if (S.game.ended) {
    return;
  }

  S.game.running = false;

  saveState();

  render();

  toast("경기를 일시정지했습니다.");
}


function endGame() {

  if (!gameHasStarted()) {
    toast("아직 경기가 시작되지 않았습니다.");
    return;
  }

  if (!confirm("경기를 종료할까요?")) {
    return;
  }

  S.game.running = false;

  S.game.ended = true;

  S.game.endedAt = Date.now();

  saveState();

  render();

  toast("경기가 종료되었습니다.");
}


function nextPeriod() {

  if (!gameHasStarted()) {
    toast("먼저 경기를 시작하세요.");
    return;
  }

  if (S.game.period >= modePeriodCount()) {

    endGame();

    return;
  }

  S.game.period += 1;

  S.game.clock =
    S.game.periodLength;

  S.game.shotClock =
    S.game.shotClockMax;

  S.game.running = false;

  saveState();

  render();

  toast(`${S.game.period}쿼터로 이동했습니다.`);
}


function resetShotClock() {

  S.game.shotClock =
    S.game.shotClockMax;

  saveState();

  render();
}


/* =========================================================
   STATS
========================================================= */

function emptyStats() {

  return {
    PTS: 0,

    FGM: 0,
    FGA: 0,

    FGM2: 0,
    FGA2: 0,

    TPM: 0,
    TPA: 0,

    FTM: 0,
    FTA: 0,

    REB: 0,
    ORB: 0,
    DRB: 0,

    AST: 0,
    STL: 0,
    BLK: 0,

    TOV: 0,
    PF: 0
  };
}


function playerStats(playerId) {

  const stats = emptyStats();

  const events =
    S.events.filter(
      event => event.playerId === playerId
    );

  for (const event of events) {

    if (event.kind === "shot") {

      const type = event.shotType;

      const made = !!event.made;

      if (type === "FT") {

        stats.FTA += 1;

        if (made) {
          stats.FTM += 1;
        }

      } else {

        stats.FGA += 1;

        if (made) {
          stats.FGM += 1;
        }

        if (type === "3PT") {

          stats.TPA += 1;

          if (made) {
            stats.TPM += 1;
          }

        } else {

          stats.FGA2 += 1;

          if (made) {
            stats.FGM2 += 1;
          }
        }
      }

      stats.PTS += event.points || 0;

      continue;
    }


    if (event.kind === "stat") {

      const statName = event.stat;

      if (statName === "REB") {

        stats.REB += 1;

      } else if (statName === "ORB") {

        stats.ORB += 1;
        stats.REB += 1;

      } else if (statName === "DRB") {

        stats.DRB += 1;
        stats.REB += 1;

      } else if (
        Object.prototype.hasOwnProperty.call(
          stats,
          statName
        )
      ) {

        stats[statName] += 1;
      }
    }
  }

  return stats;
}


function teamStats(team) {

  const total = emptyStats();

  playersOf(team).forEach(player => {

    const stats =
      playerStats(player.id);

    Object.keys(total).forEach(key => {

      total[key] +=
        Number(stats[key] || 0);

    });
  });

  return total;
}


/* =========================================================
   ADVANCED METRICS
========================================================= */

function possessions(stats) {

  if (
    !stats.FGA &&
    !stats.FTA &&
    !stats.TOV
  ) {
    return null;
  }

  const value =
    stats.FGA +
    0.44 * stats.FTA -
    stats.ORB +
    stats.TOV;

  return value > 0
    ? value
    : null;
}


function advancedStats(stats) {

  const poss = possessions(stats);

  const efg =
    stats.FGA > 0
      ? ((stats.FGM + 0.5 * stats.TPM) /
          stats.FGA) * 100
      : null;

  const tsDenominator =
    2 * (
      stats.FGA +
      0.44 * stats.FTA
    );

  const ts =
    tsDenominator > 0
      ? (stats.PTS / tsDenominator) * 100
      : null;

  const ortg =
    poss
      ? (stats.PTS / poss) * 100
      : null;

  return {
    possessions: poss,
    eFG: efg,
    TS: ts,
    ORtg: ortg
  };
}


/* =========================================================
   EVENT CREATION
========================================================= */

function createEvent(
  kind,
  playerId,
  team,
  extra = {}
) {

  const event = {

    id: uid("event"),

    kind,

    playerId,

    team,

    period: S.game.period,

    clock: S.game.clock,

    shotClock: S.game.shotClock,

    timestamp: Date.now(),

    ...extra
  };

  S.events.push(event);

  return event;
}


/* =========================================================
   RECORD STAT
========================================================= */

function recordStat(statName) {

  if (!canRecord()) return;

  const player =
    selectedPlayer();

  if (!player) {
    toast("선수를 선택해주세요.");
    return;
  }

  createEvent(
    "stat",
    player.id,
    player.team,
    {
      stat: statName
    }
  );

  saveState();

  render();

  toast(
    `${player.name} · ${statLabel(statName)} 기록`
  );
}


function statLabel(stat) {

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

  return labels[stat] || stat;
}


/* =========================================================
   SHOT RECORD
========================================================= */

function beginShot(type, made) {

  if (!canRecord()) return;

  const player =
    selectedPlayer();

  if (!player) {
    toast("먼저 선수를 선택해주세요.");
    return;
  }

  S.pendingShot = {

    playerId: player.id,

    team: player.team,

    shotType: type,

    made: !!made
  };

  S.page = "shots";

  saveState();

  render();

  toast(
    `${made ? "성공" : "실패"} · ${shotLabel(type)} 선택 → 코트를 클릭하세요.`
  );
}


function shotLabel(type) {

  if (type === "FT") return "자유투";

  if (type === "2PT") return "2점 필드골";

  if (type === "3PT") return "3점 필드골";

  return type;
}


/* =========================================================
   SHOT ZONE
========================================================= */

function classifyShotZone(x, y) {

  /*
    좌표:
    x = 0 왼쪽 / 1 오른쪽
    y = 0 골대 쪽 / 1 반대쪽

    실제 입력 좌표를 그대로 저장한다.
  */

  const dx = x - 0.5;

  const absX = Math.abs(dx);


  if (y < 0.18) {

    if (absX < 0.16) {
      return "림";
    }

    return x < 0.5
      ? "좌측 림"
      : "우측 림";
  }


  if (
    y < 0.40 &&
    absX < 0.18
  ) {
    return "페인트존";
  }


  if (
    y < 0.58 &&
    absX < 0.26
  ) {
    return "미드레인지";
  }


  if (
    y > 0.80 &&
    x < 0.20
  ) {
    return "좌측 코너";
  }


  if (
    y > 0.80 &&
    x > 0.80
  ) {
    return "우측 코너";
  }


  if (x < 0.34) {
    return "좌측 윙";
  }


  if (x > 0.66) {
    return "우측 윙";
  }


  return "탑";
}


/* =========================================================
   COMPLETE SHOT
========================================================= */

function completeShotAtPosition(
  court,
  event
) {

  if (!S.pendingShot) {
    toast("먼저 성공/실패와 슛 종류를 선택하세요.");
    return;
  }

  if (!canRecord()) {
    S.pendingShot = null;
    return;
  }

  const rect =
    court.getBoundingClientRect();

  let x =
    (event.clientX - rect.left) /
    rect.width;

  let y =
    (event.clientY - rect.top) /
    rect.height;

  x = clamp(x, 0.02, 0.98);

  y = clamp(y, 0.02, 0.98);


  const pending =
    S.pendingShot;

  const points =
    pending.made
      ? pointsForShot(
          pending.shotType
        )
      : 0;


  const created =
    createEvent(
      "shot",
      pending.playerId,
      pending.team,
      {
        shotType: pending.shotType,

        made: pending.made,

        points,

        x,

        y,

        zone:
          classifyShotZone(x, y)
      }
    );


  S.shots.push({

    id: uid("shot"),

    eventId: created.id,

    playerId: pending.playerId,

    team: pending.team,

    shotType: pending.shotType,

    made: pending.made,

    points,

    x,

    y,

    zone:
      classifyShotZone(x, y),

    period: S.game.period,

    clock: S.game.clock,

    timestamp: Date.now()
  });


  S.pendingShot = null;

  resetShotClock();

  saveState();

  render();

  toast("실제 슛 위치가 기록되었습니다.");
}


/* =========================================================
   PASS NETWORK
========================================================= */

function beginPass() {

  if (!canRecord()) return;

  const player =
    selectedPlayer();

  if (!player) {
    toast("패스한 선수를 선택해주세요.");
    return;
  }

  S.pendingPass = {

    from: player.id,

    team: player.team
  };

  saveState();

  render();

  toast("받는 선수를 선택하세요.");
}


function completePass(toPlayerId) {

  if (!S.pendingPass) return;

  if (!canRecord()) {
    S.pendingPass = null;
    return;
  }

  const receiver =
    getPlayer(toPlayerId);

  if (!receiver) return;

  if (
    receiver.team !==
    S.pendingPass.team
  ) {
    toast("같은 팀 선수에게만 패스할 수 있습니다.");
    return;
  }

  if (
    receiver.id ===
    S.pendingPass.from
  ) {
    toast("자기 자신에게는 패스할 수 없습니다.");
    return;
  }


  const created =
    createEvent(
      "pass",
      S.pendingPass.from,
      S.pendingPass.team,
      {
        receiverId: receiver.id
      }
    );


  S.passes.push({

    id: uid("pass"),

    eventId: created.id,

    from:
      S.pendingPass.from,

    to:
      receiver.id,

    team:
      S.pendingPass.team,

    period:
      S.game.period,

    clock:
      S.game.clock,

    timestamp:
      Date.now()
  });


  const passer =
    getPlayer(
      S.pendingPass.from
    );


  S.pendingPass = null;

  saveState();

  render();

  toast(
    `${passer?.name || "선수"} → ${receiver.name} 패스 기록`
  );
}


/* =========================================================
   UNDO
========================================================= */

function undoLastEvent() {

  if (!S.events.length) {
    toast("취소할 기록이 없습니다.");
    return;
  }

  const last =
    S.events[S.events.length - 1];

  S.events.pop();


  if (last.kind === "shot") {

    S.shots =
      S.shots.filter(
        shot =>
          shot.eventId !== last.id
      );
  }


  if (last.kind === "pass") {

    S.passes =
      S.passes.filter(
        pass =>
          pass.eventId !== last.id
      );
  }


  saveState();

  render();

  toast("마지막 기록을 취소했습니다.");
}


/* =========================================================
   COURT DOTS
========================================================= */

function shotDots(shots = S.shots) {

  return shots.map(shot => {

    const player =
      getPlayer(
        shot.playerId
      );

    const title =
      `${player?.name || ""} · ${
        shotLabel(shot.shotType)
      } · ${
        shot.made ? "성공" : "실패"
      }`;

    return `
      <i
        class="dot ${shot.made ? "made" : "miss"}"
        style="
          left:${shot.x * 100}%;
          top:${shot.y * 100}%;
        "
        title="${esc(title)}">
      </i>
    `;
  }).join("") + `
    <i class="rim"></i>
    <i class="mid"></i>
  `;
}


/* =========================================================
   LIVE PAGE
========================================================= */

function renderLive() {

  const section =
    $("#live");

  if (!section) return;


  const A =
    teamStats("A");

  const B =
    teamStats("B");

  const selected =
    selectedPlayer();


  section.innerHTML = `

    <div class="live-section">

      <div class="panel">

        <div class="title">

          <div>
            <div class="eyebrow">
              ${S.mode} · LIVE ANALYSIS
            </div>

            <h2>
              ${esc(
                S.game.name ||
                "경기 미설정"
              )}
            </h2>

            <small>
              ${esc(
                S.game.tournament ||
                "대회 미설정"
              )}
            </small>
          </div>

          <div class="
            live-status
            ${S.game.running ? "running" : ""}
          ">

            <span class="live-status-dot"></span>

            ${
              S.game.ended
                ? "경기 종료"
                : S.game.running
                  ? "LIVE"
                  : gameHasStarted()
                    ? "일시정지"
                    : "경기 대기"
            }

          </div>

        </div>


        <div class="scoreboard">

          <div class="score-team home">

            <span class="score-team-name">
              ${esc(S.game.teamA)}
            </span>

            <strong class="score-number">
              ${A.PTS}
            </strong>

          </div>


          <div class="score-center">

            <span class="game-label">
              ${S.mode} ·
              ${S.game.period}Q
            </span>

            <strong class="game-clock">
              ${formatClock(
                S.game.clock
              )}
            </strong>

            <span class="period-label">
              ${
                S.game.ended
                  ? "경기 종료"
                  : gameHasStarted()
                    ? "경기 진행"
                    : "경기 시작 전"
              }
            </span>


            <div class="shot-clock">

              <small>SHOT CLOCK</small>

              <strong>
                ${S.game.shotClock}
              </strong>

            </div>

          </div>


          <div class="score-team away">

            <span class="score-team-name">
              ${esc(S.game.teamB)}
            </span>

            <strong class="score-number">
              ${B.PTS}
            </strong>

          </div>

        </div>


        <div class="game-controls">

          ${
            !gameHasStarted() &&
            !S.game.ended
              ? `
                <button
                  type="button"
                  class="blue"
                  data-action="start-game">
                  경기 시작
                </button>
              `
              : ""
          }


          ${
            gameHasStarted() &&
            !S.game.ended
              ? `
                <button
                  type="button"
                  data-action="toggle-game">
                  ${
                    S.game.running
                      ? "일시정지"
                      : "경기 재개"
                  }
                </button>

                <button
                  type="button"
                  data-action="next-period">
                  다음 구간
                </button>

                <button
                  type="button"
                  data-action="reset-shotclock">
                  샷클락 리셋
                </button>

                <button
                  type="button"
                  class="danger"
                  data-action="end-game">
                  경기 종료
                </button>
              `
              : ""
          }

        </div>

      </div>

    </div>


    <div class="live-grid">

      <div class="live-section">

        <div class="panel">

          <div class="title">
            <h3>
              ${esc(S.game.teamA)}
              ON COURT
            </h3>

            <small>
              ${playersOf("A").length}/${modePlayerCount()}
            </small>
          </div>

          <div class="roster">
            ${renderPlayerCards("A")}
          </div>

        </div>


        <div class="panel">

          <div class="title">
            <h3>
              ${esc(S.game.teamB)}
              ON COURT
            </h3>

            <small>
              ${playersOf("B").length}/${modePlayerCount()}
            </small>
          </div>

          <div class="roster">
            ${renderPlayerCards("B")}
          </div>

        </div>

      </div>


      <div class="live-section">

        <div class="panel">

          <div class="title">

            <div>
              <h3>
                선수 액션
              </h3>

              <small>
                ${
                  selected
                    ? `#${esc(selected.number)}
                       ${esc(selected.name)}`
                    : "선수를 선택하세요"
                }
              </small>
            </div>

          </div>


          ${
            !gameHasStarted()
              ? `
                <div class="locked-message">
                  선수 등록은 완료되었습니다.
                  경기 시작 후 실제 기록 입력이 활성화됩니다.
                </div>
              `
              : ""
          }


          <div class="actions">

            ${shotActionButton(
              "FT",
              "자유투",
              gameHasStarted()
            )}

            ${shotActionButton(
              "2PT",
              S.mode === "3v3"
                ? "2점 필드골"
                : "2점 필드골",
              gameHasStarted()
            )}

            ${shotActionButton(
              "3PT",
              S.mode === "3v3"
                ? "3점 필드골"
                : "3점 필드골",
              gameHasStarted()
            )}


            ${statActionButton(
              "REB",
              "리바운드",
              gameHasStarted()
            )}

            ${statActionButton(
              "AST",
              "어시스트",
              gameHasStarted()
            )}

            ${statActionButton(
              "STL",
              "스틸",
              gameHasStarted()
            )}

            ${statActionButton(
              "BLK",
              "블록",
              gameHasStarted()
            )}

            ${statActionButton(
              "TOV",
              "턴오버",
              gameHasStarted()
            )}

            ${statActionButton(
              "PF",
              "파울",
              gameHasStarted()
            )}

          </div>


          <div class="game-controls">

            <button
              type="button"
              ${!gameHasStarted() ? "disabled" : ""}
              data-action="pass">
              패스
            </button>

            <button
              type="button"
              ${!S.events.length ? "disabled" : ""}
              data-action="undo">
              마지막 기록 취소
            </button>

          </div>


          ${
            S.pendingPass
              ? `
                <div class="setup-info"
                     style="margin-top:12px">
                  패스를 받을 선수를 선택하세요.
                </div>

                <div class="roster">

                  ${playersOf(
                    S.pendingPass.team
                  ).map(player => `

                    <button
                      type="button"
                      class="player"
                      data-pass-to="${player.id}">

                      <span class="player-number">
                        #${esc(player.number)}
                      </span>

                      <span class="player-name">
                        ${esc(player.name)}
                      </span>

                    </button>

                  `).join("")}

                </div>
              `
              : ""
          }

        </div>


        <div class="panel">

          <div class="title">

            <h3>
              최근 기록
            </h3>

            <small>
              ${S.events.length}
            </small>

          </div>

          ${
            renderRecentEvents()
          }

        </div>

      </div>


      <div class="live-section">

        <div class="panel">

          <div class="title">

            <div>
              <h3>
                미니 슛차트
              </h3>

              <small>
                라이브에서는 미니 차트만 표시
              </small>
            </div>

            <button
              type="button"
              data-page="shots">
              전체 보기
            </button>

          </div>

          <div class="court mini">
            ${shotDots()}
          </div>

        </div>


        <div class="panel">

          <div class="title">
            <h3>라이브 리더</h3>
          </div>

          ${renderLeaders()}

        </div>


        <div class="panel">

          <div class="title">
            <h3>팀 요약</h3>
          </div>

          ${renderTeamSummary("A")}
          ${renderTeamSummary("B")}

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   PLAYER CARD
========================================================= */

function renderPlayerCards(team) {

  const list =
    playersOf(team);

  if (!list.length) {

    return `
      <div class="empty">
        선수 설정 필요
      </div>
    `;
  }


  return list.map(player => {

    const stats =
      playerStats(player.id);

    const active =
      player.id ===
      S.selectedPlayerId;


    return `
      <button
        type="button"
        class="
          player
          ${active ? "active" : ""}
        "
        data-player="${player.id}">

        <span class="player-number">
          #${esc(player.number)}
        </span>

        <span class="player-name">
          ${esc(player.name)}
        </span>

        <span class="player-stats">
          ${stats.PTS} PTS
          · ${stats.REB} REB
          · ${stats.AST} AST
        </span>

      </button>
    `;

  }).join("");
}


/* =========================================================
   ACTION BUTTONS
========================================================= */

function shotActionButton(
  type,
  label,
  enabled
) {

  return `
    <button
      type="button"
      class="action-shot"
      ${enabled ? "" : "disabled"}
      data-shot-success="${type}">
      ${label} 성공
    </button>
  `;
}


function statActionButton(
  stat,
  label,
  enabled
) {

  return `
    <button
      type="button"
      class="action-stat"
      ${enabled ? "" : "disabled"}
      data-stat="${stat}">
      ${label}
    </button>
  `;
}


/* =========================================================
   RECENT EVENTS
========================================================= */

function renderRecentEvents() {

  const events =
    S.events
      .slice(-10)
      .reverse();

  if (!events.length) {

    return `
      <div class="empty">
        기록 없음
      </div>
    `;
  }


  return events.map(event => {

    const player =
      getPlayer(
        event.playerId
      );

    let description = "";


    if (event.kind === "shot") {

      description =
        `${shotLabel(event.shotType)}
         ${event.made ? "성공" : "실패"}
         ${event.points ? `+${event.points}` : ""}`;

    } else if (event.kind === "pass") {

      const receiver =
        getPlayer(
          event.receiverId
        );

      description =
        `패스 → ${receiver?.name || ""}`;

    } else if (event.kind === "stat") {

      description =
        statLabel(event.stat);
    }


    return `
      <div class="row">

        <span>
          ${formatClock(event.clock)}
          ·
          ${esc(player?.name || "선수")}
        </span>

        <b>
          ${esc(description)}
        </b>

      </div>
    `;

  }).join("");
}


/* =========================================================
   LIVE LEADERS
========================================================= */

function renderLeaders() {

  if (!S.players.length) {

    return `
      <div class="empty">
        기록 없음
      </div>
    `;
  }


  return S.players
    .map(player => ({
      player,
      stats:
        playerStats(player.id)
    }))
    .sort(
      (a, b) =>
        b.stats.PTS -
        a.stats.PTS
    )
    .slice(0, 6)
    .map(item => `

      <div class="row">

        <span>
          #${esc(item.player.number)}
          ${esc(item.player.name)}
        </span>

        <b>
          ${item.stats.PTS}점
          · ${item.stats.REB}R
          · ${item.stats.AST}A
        </b>

      </div>

    `)
    .join("");
}


/* =========================================================
   TEAM SUMMARY
========================================================= */

function renderTeamSummary(team) {

  const stats =
    teamStats(team);

  return `

    <div class="row">
      <span>
        ${esc(teamName(team))}
      </span>

      <b>
        ${stats.PTS}점
      </b>
    </div>

    <div class="row">
      <span>FG%</span>

      <b>
        ${pct(
          stats.FGM,
          stats.FGA
        )}
      </b>
    </div>

    <div class="row">
      <span>3P%</span>

      <b>
        ${pct(
          stats.TPM,
          stats.TPA
        )}
      </b>
    </div>

    <div class="row">
      <span>REB</span>

      <b>
        ${stats.REB}
      </b>
    </div>

  `;
}


/* =========================================================
   RECORDS PAGE
========================================================= */

function renderRecords() {

  const section =
    $("#records");

  if (!section) return;


  section.innerHTML = `

    <div class="panel">

      <div class="title">

        <div>
          <div class="eyebrow">
            BOX SCORE
          </div>

          <h2>
            선수 기록
          </h2>
        </div>

        <button
          type="button"
          data-action="export-csv">
          CSV 내보내기
        </button>

      </div>


      <div class="table-wrap">

        <table>

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
              S.players.length

                ? S.players.map(
                    player => {

                      const stats =
                        playerStats(
                          player.id
                        );

                      return `

                        <tr>

                          <td>
                            #${esc(player.number)}
                            ${esc(player.name)}
                          </td>

                          <td>
                            ${esc(
                              teamName(
                                player.team
                              )
                            )}
                          </td>

                          <td>${stats.PTS}</td>

                          <td>
                            ${stats.FGM}/${stats.FGA}
                          </td>

                          <td>
                            ${pct(
                              stats.FGM,
                              stats.FGA
                            )}
                          </td>

                          <td>
                            ${stats.FGM2}/${stats.FGA2}
                          </td>

                          <td>
                            ${stats.TPM}/${stats.TPA}
                          </td>

                          <td>
                            ${stats.FTM}/${stats.FTA}
                          </td>

                          <td>${stats.REB}</td>
                          <td>${stats.AST}</td>
                          <td>${stats.STL}</td>
                          <td>${stats.BLK}</td>
                          <td>${stats.TOV}</td>
                          <td>${stats.PF}</td>

                        </tr>

                      `;
                    }
                  ).join("")

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

    </div>
  `;
}


/* =========================================================
   SHOT PAGE
========================================================= */

function renderShotsPage() {

  const section =
    $("#shots");

  if (!section) return;


  const team =
    S.selectedTeam;

  const playerFilter =
    $("#shot-player-filter")
      ?.value || "";


  const filtered =
    S.shots.filter(
      shot =>
        shot.team === team &&
        (
          !playerFilter ||
          shot.playerId === playerFilter
        )
    );


  const made =
    filtered.filter(
      shot => shot.made
    );


  const fieldGoalShots =
    filtered.filter(
      shot =>
        shot.shotType !== "FT"
    );


  const fieldGoalMade =
    fieldGoalShots.filter(
      shot => shot.made
    );


  section.innerHTML = `

    <div class="panel">

      <div class="title">

        <div>

          <div class="eyebrow">
            SHOT LOCATION ANALYTICS
          </div>

          <h2>
            슛차트
          </h2>

          <small>
            실제 코트 위치를 클릭하여 기록
          </small>

        </div>

      </div>


      <div class="filters">

        <select
          id="shot-team-filter">

          <option value="A"
            ${team === "A" ? "selected" : ""}>
            팀 A · ${esc(S.game.teamA)}
          </option>

          <option value="B"
            ${team === "B" ? "selected" : ""}>
            팀 B · ${esc(S.game.teamB)}
          </option>

        </select>


        <select
          id="shot-player-filter">

          <option value="">
            선수 전체
          </option>

          ${
            playersOf(team)
              .map(player => `

                <option
                  value="${player.id}"
                  ${
                    player.id ===
                    playerFilter
                      ? "selected"
                      : ""
                  }>

                  #${esc(player.number)}
                  ${esc(player.name)}

                </option>

              `)
              .join("")
          }

        </select>


        <button
          type="button"
          data-shot-result="1"
          class="${
            S.pendingShot?.made === true
              ? "active"
              : ""
          }">

          슛 성공

        </button>


        <button
          type="button"
          data-shot-result="0"
          class="${
            S.pendingShot?.made === false
              ? "active"
              : ""
          }">

          슛 실패

        </button>


        <button
          type="button"
          data-shot-type="FT"
          class="${
            S.pendingShot?.shotType === "FT"
              ? "active"
              : ""
          }">

          자유투

        </button>


        <button
          type="button"
          data-shot-type="2PT"
          class="${
            S.pendingShot?.shotType === "2PT"
              ? "active"
              : ""
          }">

          2점 필드골

        </button>


        <button
          type="button"
          data-shot-type="3PT"
          class="${
            S.pendingShot?.shotType === "3PT"
              ? "active"
              : ""
          }">

          3점 필드골

        </button>

      </div>


      ${
        S.pendingShot
          ? `
            <div class="setup-info">

              ${
                S.pendingShot.made
                  ? "성공"
                  : "실패"
              }
              ·
              ${
                shotLabel(
                  S.pendingShot.shotType
                )
              }

              —
              아래 코트에서
              실제 슛 위치를 클릭하세요.

            </div>
          `
          : `
            <div class="setup-info">

              성공/실패와 슛 종류를 선택한 뒤
              코트의 실제 위치를 클릭하세요.

            </div>
          `
      }


      <div class="shot-layout">

        <div class="panel">

          <div
            class="court shot-court"
            id="shot-court">

            ${shotDots(filtered)}

            <div
              class="click">
            </div>

          </div>

        </div>


        <div>

          <div class="panel">

            <div class="kpis">

              ${kpi(
                "시도",
                filtered.length
              )}

              ${kpi(
                "성공",
                made.length
              )}

              ${kpi(
                "FG%",
                pct(
                  fieldGoalMade.length,
                  fieldGoalShots.length
                )
              )}

              ${kpi(
                "2P 성공",
                filtered.filter(
                  shot =>
                    shot.shotType === "2PT" &&
                    shot.made
                ).length
              )}

              ${kpi(
                "3P 성공",
                filtered.filter(
                  shot =>
                    shot.shotType === "3PT" &&
                    shot.made
                ).length
              )}

              ${kpi(
                "득점",
                filtered.reduce(
                  (sum, shot) =>
                    sum + shot.points,
                  0
                )
              )}

            </div>

          </div>


          <div
            class="panel"
            style="margin-top:16px">

            <div class="title">
              <h3>
                구역별 슛 기록
              </h3>
            </div>

            ${renderZoneTable(filtered)}

          </div>


          <div
            class="panel"
            style="margin-top:16px">

            <div class="title">
              <h3>
                슛 분포
              </h3>
            </div>

            ${renderShotDistribution(filtered)}

          </div>

        </div>

      </div>

    </div>
  `;
}


function kpi(label, value) {

  return `
    <div class="kpi">

      <small>
        ${esc(label)}
      </small>

      <b>
        ${esc(value)}
      </b>

    </div>
  `;
}


/* =========================================================
   ZONE TABLE
========================================================= */

function renderZoneTable(shots) {

  const zones = [
    "림",
    "좌측 림",
    "우측 림",
    "페인트존",
    "미드레인지",
    "좌측 코너",
    "우측 코너",
    "좌측 윙",
    "우측 윙",
    "탑"
  ];


  return `

    <div class="table-wrap">

      <table>

        <thead>
          <tr>
            <th>구역</th>
            <th>시도</th>
            <th>성공</th>
            <th>FG%</th>
          </tr>
        </thead>

        <tbody>

          ${
            zones.map(zone => {

              const list =
                shots.filter(
                  shot =>
                    shot.zone === zone
                );

              const makes =
                list.filter(
                  shot =>
                    shot.made
                );

              return `

                <tr>

                  <td>
                    ${zone}
                  </td>

                  <td>
                    ${list.length}
                  </td>

                  <td>
                    ${makes.length}
                  </td>

                  <td>
                    ${pct(
                      makes.length,
                      list.length
                    )}
                  </td>

                </tr>

              `;

            }).join("")
          }

        </tbody>

      </table>

    </div>
  `;
}


/* =========================================================
   SHOT DISTRIBUTION
========================================================= */

function renderShotDistribution(shots) {

  const total =
    shots.length;

  if (!total) {

    return `
      <div class="empty">
        기록 없음
      </div>
    `;
  }


  const types = [
    ["FT", "자유투"],
    ["2PT", "2점 필드골"],
    ["3PT", "3점 필드골"]
  ];


  return types.map(
    ([type, label]) => {

      const count =
        shots.filter(
          shot =>
            shot.shotType === type
        ).length;

      const width =
        total
          ? (count / total) * 100
          : 0;


      return `

        <div class="barrow">

          <b>
            ${label}
          </b>

          <div class="bar">
            <i
              style="width:${width}%">
            </i>
          </div>

          <span>
            ${count}
          </span>

        </div>

      `;

    }
  ).join("");
}


/* =========================================================
   ANALYSIS PAGE
========================================================= */

function renderAnalysis() {

  const section =
    $("#analysis");

  if (!section) return;


  const A =
    teamStats("A");

  const B =
    teamStats("B");


  section.innerHTML = `

    <div class="grid g2">

      <div class="panel">

        <div class="title">
          <div>
            <div class="eyebrow">
              TEAM COMPARISON
            </div>

            <h2>
              팀 비교
            </h2>
          </div>
        </div>

        ${compareRow(
          "득점",
          A.PTS,
          B.PTS,
          S.game.teamA,
          S.game.teamB
        )}

        ${compareRow(
          "FG%",
          numPct(A.FGM,A.FGA),
          numPct(B.FGM,B.FGA),
          S.game.teamA,
          S.game.teamB,
          true
        )}

        ${compareRow(
          "3P%",
          numPct(A.TPM,A.TPA),
          numPct(B.TPM,B.TPA),
          S.game.teamA,
          S.game.teamB,
          true
        )}

        ${compareRow(
          "REB",
          A.REB,
          B.REB,
          S.game.teamA,
          S.game.teamB
        )}

        ${compareRow(
          "AST",
          A.AST,
          B.AST,
          S.game.teamA,
          S.game.teamB
        )}

        ${compareRow(
          "STL",
          A.STL,
          B.STL,
          S.game.teamA,
          S.game.teamB
        )}

        ${compareRow(
          "BLK",
          A.BLK,
          B.BLK,
          S.game.teamA,
          S.game.teamB
        )}

        ${compareRow(
          "TOV",
          A.TOV,
          B.TOV,
          S.game.teamA,
          S.game.teamB
        )}

      </div>


      <div class="panel">

        <div class="title">

          <div>
            <div class="eyebrow">
              ADVANCED METRICS
            </div>

            <h2>
              고급 지표
            </h2>
          </div>

        </div>


        ${renderAdvancedTeam(
          "A",
          A
        )}

        ${renderAdvancedTeam(
          "B",
          B
        )}

      </div>

    </div>


    <div
      class="grid g2"
      style="margin-top:16px">

      <div class="panel">

        <div class="title">
          <h3>
            패스 네트워크 · HOME
          </h3>
        </div>

        ${renderPassNetwork("A")}

      </div>


      <div class="panel">

        <div class="title">
          <h3>
            패스 네트워크 · AWAY
          </h3>
        </div>

        ${renderPassNetwork("B")}

      </div>

    </div>


    <div
      class="panel"
      style="margin-top:16px">

      <div class="title">
        <h3>
          경기 득점 흐름
        </h3>
      </div>

      ${renderScoringFlow()}

    </div>

  `;
}


/* =========================================================
   COMPARE
========================================================= */

function compareRow(
  label,
  a,
  b,
  nameA,
  nameB,
  percentage = false
) {

  const av =
    a == null ? null : Number(a);

  const bv =
    b == null ? null : Number(b);

  const max =
    Math.max(
      av || 0,
      bv || 0,
      1
    );


  const aw =
    av == null
      ? 0
      : (av / max) * 100;

  const bw =
    bv == null
      ? 0
      : (bv / max) * 100;


  const format =
    value =>
      value == null
        ? "기록 없음"
        : percentage
          ? `${value.toFixed(1)}%`
          : value;


  return `

    <div class="barrow">

      <b>${esc(label)}</b>

      <div class="bar">
        <i
          style="width:${aw}%">
        </i>
      </div>

      <span>
        ${format(av)}
      </span>

    </div>


    <div class="barrow">

      <b>
        ${esc(nameB)}
      </b>

      <div class="bar">
        <i
          style="width:${bw}%">
        </i>
      </div>

      <span>
        ${format(bv)}
      </span>

    </div>

  `;
}


/* =========================================================
   ADVANCED TEAM
========================================================= */

function renderAdvancedTeam(
  team,
  stats
) {

  const advanced =
    advancedStats(stats);


  return `

    <div
      style="
        margin-bottom:14px;
        font-weight:800;
      ">

      ${esc(teamName(team))}

    </div>


    ${advancedRow(
      "eFG%",
      advanced.eFG
    )}

    ${advancedRow(
      "TS%",
      advanced.TS
    )}

    ${advancedRow(
      "ORtg",
      advanced.ORtg
    )}

    ${advancedRow(
      "Possessions",
      advanced.possessions
    )}

  `;
}


function advancedRow(
  label,
  value
) {

  return `

    <div class="row">

      <span>
        ${label}
      </span>

      <b>
        ${
          value == null
            ? "기록 없음"
            : typeof value === "number"
              ? value.toFixed(1)
              : value
        }
      </b>

    </div>

  `;
}


/* =========================================================
   PASS NETWORK
========================================================= */

function renderPassNetwork(team) {

  const players =
    playersOf(team);

  if (!players.length) {

    return `
      <div class="empty">
        선수 설정 필요
      </div>
    `;
  }


  const width = 600;
  const height = 420;

  const centerX = 300;
  const centerY = 190;

  const radius = 125;

  const positions = {};


  players.forEach(
    (player, index) => {

      const angle =
        -Math.PI / 2 +
        (
          index *
          (Math.PI * 2 /
            Math.max(
              players.length,
              1
            ))
        );

      positions[player.id] = {

        x:
          centerX +
          Math.cos(angle) *
          radius,

        y:
          centerY +
          Math.sin(angle) *
          radius
      };

    }
  );


  const edges = {};

  S.passes
    .filter(
      pass =>
        pass.team === team
    )
    .forEach(pass => {

      const key =
        `${pass.from}|${pass.to}`;

      edges[key] =
        (edges[key] || 0) + 1;

    });


  let svg = `

    <svg
      class="network"
      viewBox="0 0 ${width} ${height}"
      aria-label="패스 네트워크">

  `;


  Object.entries(edges)
    .forEach(
      ([key, count]) => {

        const [
          from,
          to
        ] = key.split("|");

        const p =
          positions[from];

        const q =
          positions[to];

        if (!p || !q) return;


        svg += `

          <line
            x1="${p.x}"
            y1="${p.y}"
            x2="${q.x}"
            y2="${q.y}"
            stroke="#3ea6ff"
            stroke-opacity=".48"
            stroke-width="${Math.min(
              12,
              1 + count * 2
            )}"
          />

        `;

      }
    );


  players.forEach(player => {

    const p =
      positions[player.id];

    const received =
      S.passes.filter(
        pass =>
          pass.team === team &&
          pass.to === player.id
      ).length;


    const radiusValue =
      18 + received * 2;


    svg += `

      <circle
        cx="${p.x}"
        cy="${p.y}"
        r="${radiusValue}"
        fill="#176dc3"
        stroke="#66c4ff"
        stroke-width="2"
      />

      <text
        x="${p.x}"
        y="${p.y + 4}"
        fill="white"
        text-anchor="middle"
        font-size="12"
        font-weight="800">

        #${esc(player.number)}

      </text>

      <text
        x="${p.x}"
        y="${p.y + 42}"
        fill="#a7b8ca"
        text-anchor="middle"
        font-size="11">

        ${esc(player.name)}

      </text>

    `;

  });


  svg += `</svg>`;


  return svg;
}


/* =========================================================
   SCORING FLOW
========================================================= */

function renderScoringFlow() {

  const periods =
    S.mode === "3v3"
      ? [1]
      : [1,2,3,4];


  if (!S.events.length) {

    return `
      <div class="empty">
        기록 없음
      </div>
    `;
  }


  return `

    <div class="bars">

      ${
        periods.map(period => {

          const a =
            S.events
              .filter(
                event =>
                  event.kind === "shot" &&
                  event.team === "A" &&
                  event.period === period
              )
              .reduce(
                (sum, event) =>
                  sum + event.points,
                0
              );


          const b =
            S.events
              .filter(
                event =>
                  event.kind === "shot" &&
                  event.team === "B" &&
                  event.period === period
              )
              .reduce(
                (sum, event) =>
                  sum + event.points,
                0
              );


          const max =
            Math.max(
              a,
              b,
              1
            );


          return `

            <div
              class="barrow">

              <b>
                ${period}Q
              </b>

              <div
                class="bar">

                <i
                  style="
                    width:${(a/max)*100}%;
                  ">
                </i>

              </div>

              <span>
                ${a}-${b}
              </span>

            </div>

          `;

        }).join("")
      }

    </div>

  `;
}


/* =========================================================
   REPORT PAGE
========================================================= */

function renderReport() {

  const section =
    $("#report");

  if (!section) return;


  const A =
    teamStats("A");

  const B =
    teamStats("B");

  const hasData =
    S.events.length > 0;


  section.innerHTML = `

    <div class="report-header">

      <div>

        <div class="eyebrow">
          COURTVISION PRO REPORT
        </div>

        <h2>
          경기 · 팀 · 선수 분석 리포트
        </h2>

        <div class="muted">
          ${esc(
            S.game.name ||
            "경기 미설정"
          )}
          ·
          ${S.mode}
        </div>

      </div>


      <div class="report-actions">

        <button
          type="button"
          class="blue no-print"
          data-action="print-report">
          인쇄 / PDF 저장
        </button>

        <button
          type="button"
          class="no-print"
          data-action="export-csv">
          CSV
        </button>

      </div>

    </div>


    ${
      !hasData

        ? `
          <div class="panel">

            <div class="empty">
              아직 실제 경기 데이터가 없습니다.
              <br>
              실제 기록이 입력되면 리포트가 자동 생성됩니다.
            </div>

          </div>
        `

        : `

          <div class="kpis">

            ${kpi(
              "최종 스코어",
              `${A.PTS} - ${B.PTS}`
            )}

            ${kpi(
              "HOME FG%",
              pct(A.FGM,A.FGA)
            )}

            ${kpi(
              "AWAY FG%",
              pct(B.FGM,B.FGA)
            )}

            ${kpi(
              "HOME REB",
              A.REB
            )}

            ${kpi(
              "HOME AST",
              A.AST
            )}

            ${kpi(
              "HOME TOV",
              A.TOV
            )}

          </div>


          <div
            class="grid g2"
            style="margin-top:16px">

            <div class="panel">

              <div class="title">
                <h3>
                  ${esc(S.game.teamA)}
                </h3>
              </div>

              ${renderTeamReport(A)}

            </div>


            <div class="panel">

              <div class="title">
                <h3>
                  ${esc(S.game.teamB)}
                </h3>
              </div>

              ${renderTeamReport(B)}

            </div>

          </div>


          <div
            class="panel"
            style="margin-top:16px">

            <div class="title">
              <h3>
                선수 박스스코어
              </h3>
            </div>

            ${renderPlayerTable()}

          </div>


          <div
            class="grid g2"
            style="margin-top:16px">

            <div class="panel">

              <div class="title">
                <h3>
                  경기 흐름
                </h3>
              </div>

              ${renderScoringFlow()}

            </div>


            <div class="panel">

              <div class="title">
                <h3>
                  팀 분석
                </h3>
              </div>

              ${renderReportComparison(A,B)}

            </div>

          </div>

        `
    }


    <div
      class="panel"
      style="margin-top:16px">

      <div class="title">

        <div>
          <h3>
            개인 리포트
          </h3>

          <small>
            선수별 상세 분석
          </small>
        </div>


        <select
          id="report-player">

          ${
            S.players.length

              ? S.players.map(
                  player => `

                    <option
                      value="${player.id}"
                      ${
                        (
                          S.reportPlayerId ||
                          S.players[0]?.id
                        ) === player.id
                          ? "selected"
                          : ""
                      }>

                      #${esc(player.number)}
                      ${esc(player.name)}

                    </option>

                  `
                ).join("")

              : `
                <option>
                  선수 없음
                </option>
              `
          }

        </select>

      </div>


      ${
        S.players.length
          ? renderIndividualReport(
              S.reportPlayerId ||
              S.players[0].id
            )
          : `
            <div class="empty">
              선수 설정 필요
            </div>
          `
      }

    </div>

  `;
}


/* =========================================================
   TEAM REPORT
========================================================= */

function renderTeamReport(stats) {

  const advanced =
    advancedStats(stats);


  const rows = [

    ["PTS", stats.PTS],

    [
      "FG",
      `${stats.FGM}/${stats.FGA}`
    ],

    [
      "FG%",
      pct(
        stats.FGM,
        stats.FGA
      )
    ],

    [
      "2P",
      `${stats.FGM2}/${stats.FGA2}`
    ],

    [
      "3P",
      `${stats.TPM}/${stats.TPA}`
    ],

    [
      "3P%",
      pct(
        stats.TPM,
        stats.TPA
      )
    ],

    [
      "FT",
      `${stats.FTM}/${stats.FTA}`
    ],

    ["REB", stats.REB],

    ["ORB", stats.ORB],

    ["DRB", stats.DRB],

    ["AST", stats.AST],

    ["STL", stats.STL],

    ["BLK", stats.BLK],

    ["TOV", stats.TOV],

    ["PF", stats.PF],

    [
      "eFG%",
      advanced.eFG == null
        ? "기록 없음"
        : `${advanced.eFG.toFixed(1)}%`
    ],

    [
      "TS%",
      advanced.TS == null
        ? "기록 없음"
        : `${advanced.TS.toFixed(1)}%`
    ],

    [
      "ORtg",
      advanced.ORtg == null
        ? "기록 없음"
        : advanced.ORtg.toFixed(1)
    ]

  ];


  return rows.map(
    ([label,value]) => `

      <div class="row">

        <span>
          ${label}
        </span>

        <b>
          ${value}
        </b>

      </div>

    `
  ).join("");
}


/* =========================================================
   PLAYER TABLE
========================================================= */

function renderPlayerTable() {

  return `

    <div class="table-wrap">

      <table>

        <thead>

          <tr>
            <th>선수</th>
            <th>팀</th>
            <th>PTS</th>
            <th>FG</th>
            <th>FG%</th>
            <th>3P</th>
            <th>REB</th>
            <th>AST</th>
            <th>STL</th>
            <th>BLK</th>
            <th>TOV</th>
          </tr>

        </thead>

        <tbody>

          ${
            S.players.map(
              player => {

                const stats =
                  playerStats(
                    player.id
                  );

                return `

                  <tr>

                    <td>
                      #${esc(player.number)}
                      ${esc(player.name)}
                    </td>

                    <td>
                      ${esc(
                        teamName(
                          player.team
                        )
                      )}
                    </td>

                    <td>
                      ${stats.PTS}
                    </td>

                    <td>
                      ${stats.FGM}/${stats.FGA}
                    </td>

                    <td>
                      ${pct(
                        stats.FGM,
                        stats.FGA
                      )}
                    </td>

                    <td>
                      ${stats.TPM}/${stats.TPA}
                    </td>

                    <td>
                      ${stats.REB}
                    </td>

                    <td>
                      ${stats.AST}
                    </td>

                    <td>
                      ${stats.STL}
                    </td>

                    <td>
                      ${stats.BLK}
                    </td>

                    <td>
                      ${stats.TOV}
                    </td>

                  </tr>

                `;

              }
            ).join("")
          }

        </tbody>

      </table>

    </div>

  `;
}


/* =========================================================
   REPORT COMPARISON
========================================================= */

function renderReportComparison(
  A,
  B
) {

  return `

    ${compareRow(
      "PTS",
      A.PTS,
      B.PTS,
      S.game.teamA,
      S.game.teamB
    )}

    ${compareRow(
      "FG%",
      numPct(A.FGM,A.FGA),
      numPct(B.FGM,B.FGA),
      S.game.teamA,
      S.game.teamB,
      true
    )}

    ${compareRow(
      "3P%",
      numPct(A.TPM,A.TPA),
      numPct(B.TPM,B.TPA),
      S.game.teamA,
      S.game.teamB,
      true
    )}

    ${compareRow(
      "REB",
      A.REB,
      B.REB,
      S.game.teamA,
      S.game.teamB
    )}

  `;
}


/* =========================================================
   INDIVIDUAL REPORT
========================================================= */

function renderIndividualReport(
  playerId
) {

  const player =
    getPlayer(playerId);

  if (!player) {

    return `
      <div class="empty">
        선수 데이터 없음
      </div>
    `;
  }


  const stats =
    playerStats(player.id);

  const advanced =
    advancedStats(stats);


  const shots =
    S.shots.filter(
      shot =>
        shot.playerId ===
        player.id
    );


  const madeShots =
    shots.filter(
      shot =>
        shot.made
    );


  const passesMade =
    S.passes.filter(
      pass =>
        pass.from ===
        player.id
    ).length;


  const passesReceived =
    S.passes.filter(
      pass =>
        pass.to ===
        player.id
    ).length;


  return `

    <div class="kpis">

      ${kpi(
        "득점",
        stats.PTS
      )}

      ${kpi(
        "FG%",
        pct(
          stats.FGM,
          stats.FGA
        )
      )}

      ${kpi(
        "2P",
        `${stats.FGM2}/${stats.FGA2}`
      )}

      ${kpi(
        "3P",
        `${stats.TPM}/${stats.TPA}`
      )}

      ${kpi(
        "REB",
        stats.REB
      )}

      ${kpi(
        "AST",
        stats.AST
      )}

    </div>


    <div
      class="grid g2"
      style="margin-top:16px">

      <div class="panel">

        <div class="title">
          <h3>
            개인 고급 지표
          </h3>
        </div>

        ${advancedRow(
          "eFG%",
          advanced.eFG
        )}

        ${advancedRow(
          "TS%",
          advanced.TS
        )}

        ${advancedRow(
          "ORtg",
          advanced.ORtg
        )}

        ${advancedRow(
          "어시스트",
          stats.AST
        )}

        ${advancedRow(
          "턴오버",
          stats.TOV
        )}

        ${advancedRow(
          "패스 성공 기록",
          passesMade
        )}

        ${advancedRow(
          "패스 받은 횟수",
          passesReceived
        )}

      </div>


      <div class="panel">

        <div class="title">
          <h3>
            슛 분석
          </h3>
        </div>

        ${advancedRow(
          "슛 시도",
          shots.length
        )}

        ${advancedRow(
          "슛 성공",
          madeShots.length
        )}

        ${advancedRow(
          "필드골",
          `${stats.FGM}/${stats.FGA}`
        )}

        ${advancedRow(
          "3점",
          `${stats.TPM}/${stats.TPA}`
        )}

        ${advancedRow(
          "자유투",
          `${stats.FTM}/${stats.FTA}`
        )}

      </div>

    </div>


    <div
      class="grid g2"
      style="margin-top:16px">

      <div class="panel">

        <div class="title">
          <h3>
            개인 슛차트
          </h3>
        </div>

        <div class="court">
          ${shotDots(shots)}
        </div>

      </div>


      <div class="panel">

        <div class="title">
          <h3>
            분석
          </h3>
        </div>

        ${renderPlayerAnalysis(
          player,
          stats,
          shots
        )}

      </div>

    </div>

  `;
}


/* =========================================================
   PLAYER ANALYSIS
========================================================= */

function renderPlayerAnalysis(
  player,
  stats,
  shots
) {

  const comments = [];


  if (!stats.FGA) {

    comments.push(
      "필드골 데이터가 아직 없습니다."
    );

  } else if (
    stats.FGM / stats.FGA >= .5
  ) {

    comments.push(
      "현재 기록 기준 필드골 효율이 좋습니다."
    );

  } else {

    comments.push(
      "필드골 성공률과 슛 셀렉션을 지속적으로 확인하세요."
    );
  }


  if (
    stats.TPA >= 3
  ) {

    if (
      stats.TPM / stats.TPA >= .4
    ) {

      comments.push(
        "3점 슈팅 효율이 좋은 편입니다."
      );

    } else {

      comments.push(
        "3점 시도 대비 성공률을 추가로 확인할 필요가 있습니다."
      );
    }

  } else {

    comments.push(
      "3점 데이터가 충분하지 않습니다."
    );
  }


  if (
    stats.AST > stats.TOV
  ) {

    comments.push(
      "어시스트 대비 턴오버 관리가 안정적입니다."
    );

  } else if (
    stats.TOV > stats.AST
  ) {

    comments.push(
      "압박 상황의 의사결정과 볼 관리 데이터를 확인하세요."
    );
  }


  if (
    stats.REB > 0
  ) {

    comments.push(
      `리바운드 ${stats.REB}개를 기록했습니다.`
    );
  }


  if (!shots.length) {

    comments.push(
      "실제 슛 위치 데이터가 없어 공간별 슈팅 분석은 제한됩니다."
    );
  }


  return comments.map(
    comment => `

      <div class="recommend">
        ${esc(comment)}
      </div>

    `
  ).join("");
}


/* =========================================================
   VIDEO PAGE
========================================================= */

function renderVideo() {

  const section =
    $("#video");

  if (!section) return;


  section.innerHTML = `

    <div class="panel video">

      <div class="title">

        <div>

          <div class="eyebrow">
            VIDEO ANALYSIS
          </div>

          <h2>
            영상 분석
          </h2>

        </div>


        <input
          id="video-file"
          type="file"
          accept="video/*">

      </div>


      <video
        id="analysis-video"
        controls
        playsinline
        ${
          S.video.url
            ? `src="${esc(S.video.url)}"`
            : ""
        }>
      </video>


      <div class="video-tools">

        <button
          type="button"
          data-action="video-marker">
          현재 시점 마커
        </button>

        <button
          type="button"
          data-action="video-slow">
          0.5×
        </button>

        <button
          type="button"
          data-action="video-normal">
          1×
        </button>

        <button
          type="button"
          data-action="video-fast">
          1.5×
        </button>

      </div>


      <div style="margin-top:14px">

        ${
          S.video.name
            ? `
              <div class="row">

                <span>
                  영상
                </span>

                <b>
                  ${esc(S.video.name)}
                </b>

              </div>
            `
            : ""
        }


        ${
          S.video.markers?.length
            ? S.video.markers.map(
                marker => `

                  <div class="row">

                    <span>
                      ${formatClock(
                        marker.time
                      )}
                    </span>

                    <b>
                      ${esc(
                        marker.label
                      )}
                    </b>

                  </div>

                `
              ).join("")
            : `
              <div class="empty">
                영상 파일을 불러오고
                현재 시점 마커를 추가할 수 있습니다.
              </div>
            `
        }

      </div>

    </div>
  `;
}


/* =========================================================
   LEAGUE PAGE
========================================================= */

function renderLeague() {

  const section =
    $("#league");

  if (!section) return;


  section.innerHTML = `

    <div class="league-grid">

      <div class="panel">

        <div class="title">
          <div>
            <div class="eyebrow">
              LEAGUE DATABASE
            </div>

            <h2>
              리그 설정
            </h2>
          </div>
        </div>


        <input
          id="league-name"
          value="${esc(
            S.league.name
          )}"
          placeholder="리그명"
          style="width:100%">


        <div
          style="
            display:flex;
            gap:8px;
            margin-top:10px;
          ">

          <input
            id="league-team-input"
            placeholder="팀 이름"
            style="flex:1">

          <button
            type="button"
            data-action="league-add-team">
            팀 추가
          </button>

        </div>


        <div
          style="margin-top:12px">

          ${
            S.league.teams.length
              ? S.league.teams.map(
                  (team, index) => `

                    <div class="row">

                      <span>
                        ${esc(team)}
                      </span>

                      <button
                        type="button"
                        data-league-remove="${index}">
                        삭제
                      </button>

                    </div>

                  `
                ).join("")
              : `
                <div class="empty">
                  등록된 팀 없음
                </div>
              `
          }

        </div>

      </div>


      <div class="panel">

        <div class="title">
          <h2>
            순위표
          </h2>
        </div>

        ${renderStandings()}

      </div>

    </div>

  `;
}


/* =========================================================
   STANDINGS
========================================================= */

function renderStandings() {

  if (!S.league.teams.length) {

    return `
      <div class="empty">
        등록된 팀 없음
      </div>
    `;
  }


  const rows =
    S.league.teams.map(
      team => {

        let win = 0;
        let loss = 0;
        let pointsFor = 0;
        let pointsAgainst = 0;


        S.league.games.forEach(
          game => {

            if (
              game.teamA === team
            ) {

              pointsFor +=
                game.scoreA;

              pointsAgainst +=
                game.scoreB;

              if (
                game.scoreA >
                game.scoreB
              ) {
                win++;
              } else if (
                game.scoreA <
                game.scoreB
              ) {
                loss++;
              }

            }


            if (
              game.teamB === team
            ) {

              pointsFor +=
                game.scoreB;

              pointsAgainst +=
                game.scoreA;

              if (
                game.scoreB >
                game.scoreA
              ) {
                win++;
              } else if (
                game.scoreB <
                game.scoreA
              ) {
                loss++;
              }

            }

          }
        );


        return {

          team,

          win,

          loss,

          played:
            win + loss,

          pct:
            win + loss
              ? win / (win + loss)
              : 0,

          pointsFor,

          pointsAgainst,

          diff:
            pointsFor -
            pointsAgainst
        };

      }
    );


  rows.sort(
    (a,b) =>
      b.win - a.win ||
      b.diff - a.diff
  );


  return `

    <div class="table-wrap">

      <table>

        <thead>

          <tr>
            <th>순위</th>
            <th>팀</th>
            <th>경기</th>
            <th>승</th>
            <th>패</th>
            <th>승률</th>
            <th>득점</th>
            <th>실점</th>
            <th>득실</th>
          </tr>

        </thead>

        <tbody>

          ${
            rows.map(
              (row,index) => `

                <tr>

                  <td>
                    ${index + 1}
                  </td>

                  <td>
                    ${esc(row.team)}
                  </td>

                  <td>
                    ${row.played}
                  </td>

                  <td>
                    ${row.win}
                  </td>

                  <td>
                    ${row.loss}
                  </td>

                  <td>
                    ${row.pct.toFixed(3)}
                  </td>

                  <td>
                    ${row.pointsFor}
                  </td>

                  <td>
                    ${row.pointsAgainst}
                  </td>

                  <td>
                    ${
                      row.diff >= 0
                        ? "+" + row.diff
                        : row.diff
                    }
                  </td>

                </tr>

              `
            ).join("")
          }

        </tbody>

      </table>

    </div>

  `;
}


/* =========================================================
   SETUP MODAL
========================================================= */

function openSetup() {

  const modal =
    $("#modal");

  if (!modal) return;


  const count =
    modePlayerCount();


  modal.innerHTML = `

    <div class="modalbg">

      <div class="modalbox">

        <div class="modal-header">

          <div>

            <div class="eyebrow">
              GAME / ROSTER SETUP
            </div>

            <h2>
              경기 / 선수 설정
            </h2>

            <div class="modal-subtitle">
              ${S.mode} ·
              ${count}명 로스터
            </div>

          </div>


          <button
            type="button"
            class="close"
            data-action="close-modal">
            ×
          </button>

        </div>


        <div class="setup-info">

          경기 정보를 입력하고 선수 명단을 등록하세요.
          <br>

          <strong>
            저장 후 경기 시작
          </strong>
          을 누르면 라이브 화면으로 이동합니다.

        </div>


        <div class="form">

          <input
            id="setup-game-name"
            value="${esc(
              S.game.name
            )}"
            placeholder="경기명">


          <input
            id="setup-tournament"
            value="${esc(
              S.game.tournament
            )}"
            placeholder="대회명">


          <div class="setup-grid">


            <div class="team-form">

              <h3>
                팀 A
              </h3>


              <input
                id="setup-team-A"
                value="${esc(
                  S.game.teamA
                )}"
                placeholder="팀 A 이름"
                style="width:100%">


              ${
                Array.from({
                  length: count
                }).map(
                  (_,index) => {

                    const player =
                      playersOf("A")[index];


                    return `

                      <div
                        class="player-input">

                        <input
                          data-setup-number="A-${index}"
                          value="${esc(
                            player?.number ||
                            index + 1
                          )}"
                          placeholder="번호">

                        <input
                          data-setup-name="A-${index}"
                          value="${esc(
                            player?.name ||
                            ""
                          )}"
                          placeholder="선수 이름">

                      </div>

                    `;

                  }
                ).join("")}

            </div>


            <div class="team-form">

              <h3>
                팀 B
              </h3>


              <input
                id="setup-team-B"
                value="${esc(
                  S.game.teamB
                )}"
                placeholder="팀 B 이름"
                style="width:100%">


              ${
                Array.from({
                  length: count
                }).map(
                  (_,index) => {

                    const player =
                      playersOf("B")[index];


                    return `

                      <div
                        class="player-input">

                        <input
                          data-setup-number="B-${index}"
                          value="${esc(
                            player?.number ||
                            index + 1
                          )}"
                          placeholder="번호">

                        <input
                          data-setup-name="B-${index}"
                          value="${esc(
                            player?.name ||
                            ""
                          )}"
                          placeholder="선수 이름">

                      </div>

                    `;

                  }
                ).join("")}

            </div>


          </div>


          <div class="setup-footer">

            <button
              type="button"
              data-action="close-modal">
              취소
            </button>

            <button
              type="button"
              class="blue"
              data-action="apply-setup">
              설정 저장 · 경기 시작
            </button>

          </div>

        </div>

      </div>

    </div>

  `;
}


/* =========================================================
   APPLY SETUP
========================================================= */

function applySetup() {

  const gameName =
    $("#setup-game-name")
      ?.value.trim();

  const tournament =
    $("#setup-tournament")
      ?.value.trim();

  const teamA =
    $("#setup-team-A")
      ?.value.trim();

  const teamB =
    $("#setup-team-B")
      ?.value.trim();


  const count =
    modePlayerCount();


  const newPlayers = [];


  for (
    const team of ["A","B"]
  ) {

    for (
      let index = 0;
      index < count;
      index++
    ) {

      const number =
        $(
          `[data-setup-number="${team}-${index}"]`
        )?.value.trim();


      const name =
        $(
          `[data-setup-name="${team}-${index}"]`
        )?.value.trim();


      if (!name) {
        continue;
      }


      newPlayers.push({

        id:
          uid("player"),

        team,

        number:
          number ||
          String(index + 1),

        name

      });

    }

  }


  if (!newPlayers.length) {

    toast(
      "최소 한 명의 선수를 등록해주세요."
    );

    return;
  }


  /*
    경기 시작 전 설정이면
    새 로스터를 그대로 적용한다.

    이미 경기가 진행 중이면
    기존 이벤트의 playerId가 깨질 수 있기 때문에
    설정 변경을 막는다.
  */

  if (
    gameHasStarted() &&
    !S.game.ended
  ) {

    toast(
      "진행 중인 경기의 선수 설정은 변경할 수 없습니다."
    );

    return;
  }


  S.game.name =
    gameName;

  S.game.tournament =
    tournament;

  S.game.teamA =
    teamA ||
    "HOME";

  S.game.teamB =
    teamB ||
    "AWAY";


  S.players =
    newPlayers;


  S.setupComplete =
    true;


  S.selectedPlayerId =
    S.players[0]?.id ||
    null;


  S.selectedTeam =
    S.players[0]?.team ||
    "A";


  /*
    설정 저장 후에는
    경기 자체는 아직 시작하지 않는다.

    사용자가 라이브에서
    '경기 시작'을 한 번 더 눌러야
    실제 시간이 흐르고 기록 버튼이 활성화된다.
  */

  S.game.running = false;

  S.game.ended = false;

  S.game.startedAt = null;

  S.game.endedAt = null;

  S.game.period = 1;

  S.game.clock =
    S.game.periodLength;

  S.game.shotClock =
    S.game.shotClockMax;


  S.events = [];

  S.shots = [];

  S.passes = [];

  S.pendingShot = null;

  S.pendingPass = null;


  $("#modal").innerHTML = "";

  S.page = "live";


  saveState();

  render();

  toast(
    "선수 설정 완료 · 라이브에서 경기 시작을 눌러주세요."
  );
}


/* =========================================================
   SAVE GAME
========================================================= */

function saveCurrentGame() {

  const snapshot = {

    id:
      S.game.id,

    savedAt:
      Date.now(),

    mode:
      S.mode,

    game: {
      ...S.game,
      running: false
    },

    players:
      JSON.parse(
        JSON.stringify(
          S.players
        )
      ),

    events:
      JSON.parse(
        JSON.stringify(
          S.events
        )
      ),

    shots:
      JSON.parse(
        JSON.stringify(
          S.shots
        )
      ),

    passes:
      JSON.parse(
        JSON.stringify(
          S.passes
        )
      )

  };


  S.savedGames =
    S.savedGames.filter(
      game =>
        game.id !== snapshot.id
    );


  S.savedGames.push(
    snapshot
  );


  saveState();

  toast("경기를 저장했습니다.");
}


/* =========================================================
   RESET
========================================================= */

function resetAll() {

  if (
    !confirm(
      "현재 경기와 선수 기록을 모두 초기화할까요?"
    )
  ) {
    return;
  }


  const league =
    S.league;


  S =
    defaultState();


  S.league =
    league;


  saveState();

  render();

  setTimeout(
    openSetup,
    100
  );
}


/* =========================================================
   MODE CHANGE
========================================================= */

function changeMode(mode) {

  if (mode === S.mode) {
    return;
  }


  if (
    S.events.length ||
    S.shots.length
  ) {

    if (
      !confirm(
        "3대3/5대5를 변경하면 현재 경기 기록이 초기화됩니다. 계속할까요?"
      )
    ) {
      return;
    }

  }


  const league =
    S.league;

  const savedGames =
    S.savedGames;


  S =
    defaultState();


  S.mode =
    mode;

  S.league =
    league;

  S.savedGames =
    savedGames;


  saveState();

  render();

  openSetup();
}


/* =========================================================
   CSV EXPORT
========================================================= */

function exportCSV() {

  const rows = [];


  rows.push([
    "선수",
    "팀",
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
    "ORB",
    "DRB",
    "AST",
    "STL",
    "BLK",
    "TOV",
    "PF"
  ]);


  S.players.forEach(
    player => {

      const stats =
        playerStats(
          player.id
        );


      rows.push([

        player.name,

        teamName(
          player.team
        ),

        stats.PTS,

        stats.FGM,

        stats.FGA,

        pct(
          stats.FGM,
          stats.FGA
        ),

        stats.FGM2,

        stats.FGA2,

        stats.TPM,

        stats.TPA,

        stats.FTM,

        stats.FTA,

        stats.REB,

        stats.ORB,

        stats.DRB,

        stats.AST,

        stats.STL,

        stats.BLK,

        stats.TOV,

        stats.PF

      ]);

    }
  );


  const csv =
    rows
      .map(
        row =>
          row
            .map(
              cell =>
                `"${String(cell)
                  .replace(/"/g,'""')}"`
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
    URL.createObjectURL(
      blob
    );


  const a =
    document.createElement("a");

  a.href = url;

  a.download =
    `COURTVISION_${S.game.name || "game"}_${formatDate()}.csv`;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);

  toast("CSV를 생성했습니다.");
}


/* =========================================================
   PRINT
========================================================= */

function printReport() {

  if (
    S.page !== "report"
  ) {
    S.page = "report";

    render();
  }

  setTimeout(
    () => window.print(),
    100
  );
}


/* =========================================================
   VIDEO MARKERS
========================================================= */

function addVideoMarker() {

  const video =
    $("#analysis-video");

  if (!video) {
    toast("먼저 영상을 불러오세요.");
    return;
  }


  if (!S.video.markers) {
    S.video.markers = [];
  }


  const time =
    Number(
      video.currentTime || 0
    );


  const label =
    prompt(
      "마커 이름을 입력하세요.",
      "분석 포인트"
    );


  if (!label) return;


  S.video.markers.push({

    id:
      uid("marker"),

    time,

    label

  });


  saveState();

  render();

  toast("영상 마커를 추가했습니다.");
}


/* =========================================================
   VIDEO SPEED
========================================================= */

function setVideoSpeed(rate) {

  const video =
    $("#analysis-video");

  if (!video) return;

  video.playbackRate =
    rate;
}


/* =========================================================
   EVENT DELEGATION
   ---------------------------------------------------------
   모든 버튼을 이 하나의 click listener에서
   명시적으로 처리한다.
========================================================= */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "button"
      );


    if (button) {

      /*
        NAV
      */

      if (
        button.dataset.page
      ) {

        S.page =
          button.dataset.page;

        saveState();

        render();

        return;
      }


      /*
        MODE
      */

      if (
        button.dataset.mode
      ) {

        changeMode(
          button.dataset.mode
        );

        return;
      }


      /*
        PLAYER
      */

      if (
        button.dataset.player
      ) {

        setSelectedPlayer(
          button.dataset.player
        );

        return;
      }


      /*
        SHOT SUCCESS FROM LIVE
      */

      if (
        button.dataset.shotSuccess
      ) {

        beginShot(
          button.dataset.shotSuccess,
          true
        );

        return;
      }


      /*
        STAT
      */

      if (
        button.dataset.stat
      ) {

        recordStat(
          button.dataset.stat
        );

        return;
      }


      /*
        SHOT RESULT
      */

      if (
        button.dataset.shotResult !==
        undefined
      ) {

        if (!canRecord()) {
          return;
        }


        const player =
          selectedPlayer();


        if (!player) {
          toast(
            "선수를 먼저 선택해주세요."
          );

          return;
        }


        S.pendingShot =
          S.pendingShot || {};


        S.pendingShot.playerId =
          player.id;

        S.pendingShot.team =
          player.team;

        S.pendingShot.made =
          button.dataset.shotResult ===
          "1";


        saveState();

        render();

        return;
      }


      /*
        SHOT TYPE
      */

      if (
        button.dataset.shotType
      ) {

        if (!canRecord()) {
          return;
        }


        const player =
          selectedPlayer();


        if (!player) {
          toast(
            "선수를 먼저 선택해주세요."
          );

          return;
        }


        S.pendingShot =
          S.pendingShot || {};


        S.pendingShot.playerId =
          player.id;

        S.pendingShot.team =
          player.team;

        S.pendingShot.shotType =
          button.dataset.shotType;


        saveState();

        render();

        return;
      }


      /*
        PASS TO PLAYER
      */

      if (
        button.dataset.passTo
      ) {

        completePass(
          button.dataset.passTo
        );

        return;
      }


      /*
        GENERIC ACTION
      */

      const action =
        button.dataset.action;


      if (action) {

        switch (action) {

          case "start-game":

            startGame();

            break;


          case "toggle-game":

            if (
              S.game.running
            ) {
              pauseGame();
            } else {
              startGame();
            }

            break;


          case "next-period":

            nextPeriod();

            break;


          case "reset-shotclock":

            resetShotClock();

            break;


          case "end-game":

            endGame();

            break;


          case "pass":

            beginPass();

            break;


          case "undo":

            undoLastEvent();

            break;


          case "apply-setup":

            applySetup();

            break;


          case "close-modal":

            $("#modal").innerHTML =
              "";

            break;


          case "print-report":

            printReport();

            break;


          case "export-csv":

            exportCSV();

            break;


          case "league-add-team": {

            const input =
              $("#league-team-input");

            const value =
              input?.value.trim();


            if (!value) {
              toast(
                "팀 이름을 입력해주세요."
              );

              break;
            }


            if (
              S.league.teams
                .includes(value)
            ) {

              toast(
                "이미 등록된 팀입니다."
              );

              break;
            }


            S.league.teams.push(
              value
            );

            saveState();

            render();

            toast(
              "팀을 추가했습니다."
            );

            break;
          }


          case "video-marker":

            addVideoMarker();

            break;


          case "video-slow":

            setVideoSpeed(.5);

            break;


          case "video-normal":

            setVideoSpeed(1);

            break;


          case "video-fast":

            setVideoSpeed(1.5);

            break;

        }

        return;
      }


      /*
        HEADER BUTTONS
      */

      if (
        button.id === "setup"
      ) {

        openSetup();

        return;
      }


      if (
        button.id === "save"
      ) {

        saveCurrentGame();

        return;
      }


      if (
        button.id === "reset"
      ) {

        resetAll();

        return;
      }


      /*
        LEAGUE REMOVE
      */

      if (
        button.dataset.leagueRemove !==
        undefined
      ) {

        const index =
          Number(
            button.dataset.leagueRemove
          );


        if (
          Number.isInteger(index)
        ) {

          S.league.teams
            .splice(index,1);

          saveState();

          render();

        }

        return;
      }

    }


    /*
      SHOT COURT CLICK
    */

    const court =
      event.target.closest(
        "#shot-court"
      );


    if (
      court &&
      S.pendingShot &&
      !event.target.closest("button")
    ) {

      completeShotAtPosition(
        court,
        event
      );

      return;
    }

  }
);


/* =========================================================
   CHANGE EVENTS
========================================================= */

document.addEventListener(
  "change",
  event => {

    const target =
      event.target;


    /*
      SHOT TEAM FILTER
    */

    if (
      target.id ===
      "shot-team-filter"
    ) {

      S.selectedTeam =
        target.value;

      S.selectedPlayerId =
        playersOf(
          S.selectedTeam
        )[0]?.id ||
        null;

      saveState();

      render();

      return;
    }


    /*
      SHOT PLAYER FILTER
      -------------------------------------------------------
      필터 자체는 별도 state가 필요 없으므로
      렌더링 직후 유지하기 위해 DOM value를 보존한다.
    */

    if (
      target.id ===
      "shot-player-filter"
    ) {

      target.dataset.keep =
        target.value;

      return;
    }


    /*
      REPORT PLAYER
    */

    if (
      target.id ===
      "report-player"
    ) {

      S.reportPlayerId =
        target.value;

      saveState();

      render();

      return;
    }


    /*
      LEAGUE NAME
    */

    if (
      target.id ===
      "league-name"
    ) {

      S.league.name =
        target.value.trim();

      saveState();

      return;
    }


    /*
      VIDEO FILE
    */

    if (
      target.id ===
      "video-file"
    ) {

      const file =
        target.files?.[0];


      if (!file) return;


      if (
        S.video.url
      ) {

        try {
          URL.revokeObjectURL(
            S.video.url
          );
        } catch (_) {}

      }


      S.video.name =
        file.name;

      S.video.url =
        URL.createObjectURL(
          file
        );

      S.video.markers =
        [];


      saveState();

      render();

      toast(
        "영상을 불러왔습니다."
      );

      return;
    }

  }
);


/* =========================================================
   MODAL BACKGROUND
========================================================= */

document.addEventListener(
  "click",
  event => {

    if (
      event.target.classList
        .contains("modalbg")
    ) {

      $("#modal").innerHTML =
        "";
    }

  }
);


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    /*
      스페이스:
      경기 시작 / 일시정지

      단, input/select에서는 무시
    */

    if (
      event.code !==
      "Space"
    ) {
      return;
    }


    const tag =
      document.activeElement
        ?.tagName;


    if (
      tag === "INPUT" ||
      tag === "SELECT" ||
      tag === "TEXTAREA"
    ) {
      return;
    }


    event.preventDefault();


    if (!gameHasStarted()) {

      startGame();

      return;
    }


    if (S.game.ended) {
      return;
    }


    if (S.game.running) {
      pauseGame();
    } else {
      startGame();
    }

  }
);


/* =========================================================
   CLOCK ENGINE
========================================================= */

let clockTimer = null;


function startClockEngine() {

  if (clockTimer) {
    clearInterval(
      clockTimer
    );
  }


  clockTimer =
    setInterval(
      () => {

        if (
          !S.game.running ||
          S.game.ended
        ) {
          return;
        }


        if (
          S.game.clock <= 0
        ) {

          S.game.clock = 0;

          S.game.running =
            false;

          saveState();

          render();

          toast(
            `${S.game.period}쿼터 종료`
          );

          return;
        }


        S.game.clock -= 1;


        /*
          샷클락도 실제 경기 진행 중
          같이 감소
        */

        if (
          S.game.shotClock > 0
        ) {

          S.game.shotClock -= 1;

        }


        /*
          샷클락 0은 기록 시스템에서
          자동 공격권 전환을 추측하지 않는다.

          분석 프로그램에서는 실제 기록원이
          리셋을 눌러주는 방식으로 처리한다.
        */


        /*
          1초마다 전체 DOM을 갈아끼우지 않고
          라이브 화면만 갱신한다.
        */

        if (
          S.page === "live"
        ) {

          updateLiveClockOnly();

        } else {

          saveState();

        }


        /*
          1초 단위 LocalStorage 저장
        */

        saveState();


      },
      1000
    );
}


function updateLiveClockOnly() {

  const clock =
    $(".game-clock");

  if (clock) {

    clock.textContent =
      formatClock(
        S.game.clock
      );
  }


  const shotClock =
    $(".shot-clock strong");

  if (shotClock) {

    shotClock.textContent =
      S.game.shotClock;
  }


  const status =
    $(".live-status");

  if (status) {

    status.classList.toggle(
      "running",
      S.game.running
    );

    const dot =
      $(".live-status-dot");

    if (dot) {
      dot.style.opacity =
        S.game.running
          ? "1"
          : ".6";
    }
  }

}


/* =========================================================
   RENDER
========================================================= */

function render() {

  /*
    navigation
  */

  $$(".main-nav button")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
        S.page
      );

    });


  /*
    mode
  */

  $$(".mode-switch button")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.mode ===
        S.mode
      );

    });


  /*
    section
  */

  $$("main section")
    .forEach(section => {

      section.classList.toggle(
        "on",
        section.id ===
        S.page
      );

    });


  /*
    render all page contents
  */

  renderLive();

  renderRecords();

  renderShotsPage();

  renderVideo();

  renderAnalysis();

  renderReport();

  renderLeague();

}


/* =========================================================
   INITIAL BOOT
========================================================= */

function boot() {

  /*
    방어적 데이터 보정
  */

  if (!S.game) {

    S.game =
      defaultState().game;
  }


  if (!Array.isArray(S.players)) {
    S.players = [];
  }


  if (!Array.isArray(S.events)) {
    S.events = [];
  }


  if (!Array.isArray(S.shots)) {
    S.shots = [];
  }


  if (!Array.isArray(S.passes)) {
    S.passes = [];
  }


  if (!Array.isArray(S.savedGames)) {
    S.savedGames = [];
  }


  if (!S.league) {

    S.league =
      defaultState().league;
  }


  if (!S.video) {

    S.video =
      defaultState().video;
  }


  if (!S.video.markers) {

    S.video.markers = [];
  }


  saveState();

  render();

  startClockEngine();


  /*
    처음 실행 시
    선수 설정 자동 표시
  */

  if (
    !S.setupComplete ||
    !S.players.length
  ) {

    setTimeout(
      openSetup,
      150
    );

  }

}


/* =========================================================
   START
========================================================= */

boot();