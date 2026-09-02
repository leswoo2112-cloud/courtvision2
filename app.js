/* =========================================================
   COURTVISION PRO
   Basketball Performance Analysis System
   APP.JS
========================================================= */

"use strict";

/* =========================================================
   1. GLOBAL STATE
========================================================= */

const STORAGE_KEY = "courtv_pro_basketball_v1";

const state = {
  mode: "3x3",

  teams: {
    home: "HOME TEAM",
    away: "AWAY TEAM"
  },

  game: {
    name: "",
    running: false,
    finished: false,

    period: 1,

    time: 600,
    initialTime: 600,

    shotClock: 14,
    initialShotClock: 14,

    homeScore: 0,
    awayScore: 0,

    events: []
  },

  players: [],

  games: [],

  shots: [],

  league: {
    teams: [],
    schedule: [],
    results: []
  },

  settings: {
    gameTime: 600,
    shotClock: 14
  },

  selectedReportPlayer: null,

  shotInput: {
    type: "make",
    value: 2
  }
};


/* =========================================================
   2. DOM HELPERS
========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) =>
  Array.from(document.querySelectorAll(selector));


function setText(selector, value) {
  const el = $(selector);

  if (el) {
    el.textContent = value;
  }
}


function show(el) {
  if (typeof el === "string") {
    el = $(el);
  }

  if (el) {
    el.classList.remove("hidden");
  }
}


function hide(el) {
  if (typeof el === "string") {
    el = $(el);
  }

  if (el) {
    el.classList.add("hidden");
  }
}


/* =========================================================
   3. INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  loadData();

  bindNavigation();

  bindModeButtons();

  bindGameControls();

  bindShotChart();

  bindPlayerControls();

  bindVideoControls();

  bindPoseControls();

  bindLeagueControls();

  bindSettingsControls();

  bindModalControls();

  bindKeyboardShortcuts();

  initCharts();

  updateAll();

});


/* =========================================================
   4. STORAGE
========================================================= */

function saveData() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );

  } catch (error) {

    console.error(error);

    toast(
      "데이터 저장에 실패했습니다.",
      "error"
    );

  }
}


function loadData() {

  try {

    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    const data = JSON.parse(saved);

    Object.assign(state, data);

    if (!state.game) {
      resetGameState();
    }

    if (!state.teams) {
      state.teams = {
        home: "HOME TEAM",
        away: "AWAY TEAM"
      };
    }

    if (!Array.isArray(state.players)) {
      state.players = [];
    }

    if (!Array.isArray(state.games)) {
      state.games = [];
    }

    if (!Array.isArray(state.shots)) {
      state.shots = [];
    }

    if (!state.league) {
      state.league = {
        teams: [],
        schedule: [],
        results: []
      };
    }

  } catch (error) {

    console.error(error);

    toast(
      "저장 데이터를 불러오지 못했습니다.",
      "error"
    );

  }
}


/* =========================================================
   5. NAVIGATION
========================================================= */

function bindNavigation() {

  $$(".nav-btn[data-page]").forEach(button => {

    button.addEventListener("click", () => {

      const page =
        button.dataset.page;

      openPage(page);

      const sidebar =
        $(".sidebar");

      if (sidebar) {
        sidebar.classList.remove("open");
      }

    });

  });


  $$("[data-page-link]").forEach(button => {

    button.addEventListener("click", () => {

      openPage(
        button.dataset.pageLink
      );

    });

  });

}


function openPage(pageName) {

  $$(".page").forEach(page => {
    page.classList.remove("active");
  });

  $$(".nav-btn[data-page]").forEach(button => {
    button.classList.remove("active");
  });


  const page =
    $(`#page-${pageName}`);

  const nav =
    $(`.nav-btn[data-page="${pageName}"]`);


  if (page) {
    page.classList.add("active");
  }

  if (nav) {
    nav.classList.add("active");
  }


  if (pageName === "report") {
    renderPlayerReport();
  }

  if (pageName === "gameReport") {
    updateGameReport();
  }

  if (pageName === "players") {
    renderPlayers();
  }

  if (pageName === "record") {
    renderGames();
  }

  if (pageName === "league") {
    renderLeague();
  }

  if (pageName === "team") {
    updateTeamAnalysis();
  }

}


/* =========================================================
   6. MODE
========================================================= */

function bindModeButtons() {

  $$(".mode-btn").forEach(button => {

    button.addEventListener("click", () => {

      setMode(
        button.dataset.mode
      );

    });

  });

}


function setMode(mode) {

  if (
    mode !== "3x3" &&
    mode !== "5x5"
  ) {
    return;
  }

  state.mode = mode;

  $$(".mode-btn").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.mode === mode
    );

  });


  const text =
    mode === "3x3"
      ? "3대3 경기 분석 시스템"
      : "5대5 경기 분석 시스템";

  setText(
    "#dashboardModeText",
    text
  );


  /*
    3x3:
      FT = 1
      inside = 1
      outside = 2

    5x5:
      FT = 1
      2PT = 2
      3PT = 3
  */

  if (mode === "3x3") {

    $$(".score-2").forEach(button => {

      const label =
        button.querySelector("strong");

      if (label) {
        label.textContent = "+1";
      }

      button.lastChild.textContent =
        " 2점";
    });


    $$(".score-3").forEach(button => {

      const label =
        button.querySelector("strong");

      if (label) {
        label.textContent = "+2";
      }

      button.lastChild.textContent =
        " 외곽";
    });

  } else {

    $$(".score-2").forEach(button => {

      const label =
        button.querySelector("strong");

      if (label) {
        label.textContent = "+2";
      }

      button.lastChild.textContent =
        " 2점";
    });


    $$(".score-3").forEach(button => {

      const label =
        button.querySelector("strong");

      if (label) {
        label.textContent = "+3";
      }

      button.lastChild.textContent =
        " 3점";
    });

  }


  saveData();

  updateAll();

  toast(
    `${mode === "3x3" ? "3대3" : "5대5"} 모드로 전환했습니다.`,
    "success"
  );

}


/* =========================================================
   7. GAME STATE
========================================================= */

function resetGameState() {

  state.game = {

    name: "",

    running: false,

    finished: false,

    period: 1,

    time: state.settings.gameTime,

    initialTime: state.settings.gameTime,

    shotClock: state.settings.shotClock,

    initialShotClock:
      state.settings.shotClock,

    homeScore: 0,

    awayScore: 0,

    events: []

  };

}


function startNewGame() {

  resetGameState();

  state.shots = [];

  state.game.name =
    "새 경기";

  state.game.running = false;

  state.game.finished = false;

  saveData();

  updateAll();

  openModal("gameModal");

}


/* =========================================================
   8. GAME CONTROLS
========================================================= */

let gameTimer = null;
let shotTimer = null;


function bindGameControls() {

  $("#newGameBtn")
    ?.addEventListener(
      "click",
      startNewGame
    );


  $("#createRecordBtn")
    ?.addEventListener(
      "click",
      startNewGame
    );


  $("#gameForm")
    ?.addEventListener(
      "submit",
      createGame
    );


  $("#startGameBtn")
    ?.addEventListener(
      "click",
      toggleGame
    );


  $("#resetGameBtn")
    ?.addEventListener(
      "click",
      resetLiveGame
    );


  $$(".stat-btn").forEach(button => {

    button.addEventListener(
      "click",
      () => {

        recordStat(
          button.dataset.team,
          button.dataset.stat,
          Number(
            button.dataset.points || 0
          )
        );

      }
    );

  });


  $("#saveGameBtn")
    ?.addEventListener(
      "click",
      saveCurrentGame
    );

}


function createGame(event) {

  event.preventDefault();

  const name =
    $("#gameName")?.value.trim()
    || "새 경기";

  const home =
    $("#gameHomeName")?.value.trim()
    || "HOME TEAM";

  const away =
    $("#gameAwayName")?.value.trim()
    || "AWAY TEAM";


  const mode =
    document.querySelector(
      'input[name="gameMode"]:checked'
    )?.value
    || state.mode;


  state.mode = mode;

  state.teams.home = home;
  state.teams.away = away;


  state.game = {

    name,

    running: false,

    finished: false,

    period: 1,

    time: state.settings.gameTime,

    initialTime: state.settings.gameTime,

    shotClock: state.settings.shotClock,

    initialShotClock:
      state.settings.shotClock,

    homeScore: 0,

    awayScore: 0,

    events: []

  };


  state.shots = [];


  saveData();

  closeModal("gameModal");

  updateAll();

  openPage("live");


  toast(
    "새 경기가 생성되었습니다.",
    "success"
  );

}


function toggleGame() {

  if (state.game.finished) {

    toast(
      "이미 종료된 경기입니다.",
      "error"
    );

    return;
  }


  if (state.game.running) {

    pauseGame();

  } else {

    startGame();

  }

}


function startGame() {

  state.game.running = true;

  clearInterval(gameTimer);
  clearInterval(shotTimer);


  gameTimer =
    setInterval(() => {

      if (
        state.game.time <= 0
      ) {

        endPeriod();

        return;
      }

      state.game.time--;

      updateClock();

      saveData();

    }, 1000);


  shotTimer =
    setInterval(() => {

      if (
        state.game.shotClock <= 0
      ) {

        state.game.shotClock =
          state.settings.shotClock;

        addEvent(
          "SHOT CLOCK RESET"
        );

      } else {

        state.game.shotClock--;

      }

      updateClock();

    }, 1000);


  setText(
    "#startGameBtn",
    "Ⅱ 일시정지"
  );

  updateClock();

}


function pauseGame() {

  state.game.running = false;

  clearInterval(gameTimer);
  clearInterval(shotTimer);

  gameTimer = null;
  shotTimer = null;


  setText(
    "#startGameBtn",
    "▶ 경기 시작"
  );

  saveData();

}


function endPeriod() {

  pauseGame();

  state.game.period++;

  const maxPeriods =
    state.mode === "3x3"
      ? 1
      : 4;


  if (
    state.game.period >
    maxPeriods
  ) {

    finishGame();

    return;
  }


  state.game.time =
    state.settings.gameTime;

  state.game.shotClock =
    state.settings.shotClock;


  addEvent(
    `${state.game.period}Q START`
  );

  updateAll();

  toast(
    `${state.game.period}쿼터가 시작됩니다.`,
    "success"
  );

}


function finishGame() {

  state.game.running = false;

  state.game.finished = true;

  clearInterval(gameTimer);
  clearInterval(shotTimer);

  gameTimer = null;
  shotTimer = null;


  saveCurrentGame();

  toast(
    "경기가 종료되었습니다.",
    "success"
  );

  updateAll();

}


/* =========================================================
   9. RESET LIVE GAME
========================================================= */

function resetLiveGame() {

  const ok =
    confirm(
      "현재 경기 데이터를 모두 초기화할까요?"
    );

  if (!ok) {
    return;
  }


  resetGameState();

  state.shots = [];

  saveData();

  updateAll();

  renderShotMarkers();

  toast(
    "경기가 초기화되었습니다.",
    "success"
  );

}


/* =========================================================
   10. STAT RECORDING
========================================================= */

function recordStat(
  team,
  stat,
  points = 0
) {

  if (
    team !== "home" &&
    team !== "away"
  ) {
    return;
  }


  const game =
    state.game;


  let actualPoints =
    Number(points);


  /*
    3x3 scoring correction
  */

  if (
    state.mode === "3x3"
  ) {

    if (stat === "fg2") {
      actualPoints = 1;
    }

    if (stat === "fg3") {
      actualPoints = 2;
    }

  }


  if (actualPoints > 0) {

    if (team === "home") {
      game.homeScore += actualPoints;
    } else {
      game.awayScore += actualPoints;
    }

  }


  /*
    Event
  */

  const event = {

    id:
      Date.now() +
      Math.random(),

    team,

    stat,

    points:
      actualPoints,

    period:
      game.period,

    clock:
      formatTime(game.time),

    timestamp:
      new Date().toISOString()

  };


  game.events.push(event);


  /*
    If stat is made shot,
    automatically create basic shot data
  */

  if (
    stat === "ft" ||
    stat === "fg2" ||
    stat === "fg3"
  ) {

    const value =
      stat === "ft"
        ? 1
        : state.mode === "3x3"
          ? stat === "fg2"
            ? 1
            : 2
          : stat === "fg2"
            ? 2
            : 3;


    state.shots.push({

      id: event.id,

      x:
        10 +
        Math.random() * 80,

      y:
        10 +
        Math.random() * 80,

      type: "make",

      value,

      team,

      period:
        game.period,

      timestamp:
        event.timestamp

    });

  }


  updateAll();

  saveData();


  /*
    Small visual feedback
  */

  flashStatButton(
    team,
    stat
  );

}


function addEvent(text) {

  state.game.events.push({

    id:
      Date.now() +
      Math.random(),

    text,

    period:
      state.game.period,

    clock:
      formatTime(state.game.time),

    timestamp:
      new Date().toISOString()

  });

  renderLiveEvents();

}


/* =========================================================
   11. STAT BUTTON ANIMATION
========================================================= */

function flashStatButton(
  team,
  stat
) {

  const button =
    $(
      `.stat-btn[data-team="${team}"][data-stat="${stat}"]`
    );

  if (!button) {
    return;
  }

  button.animate(
    [
      {
        transform: "scale(1)"
      },
      {
        transform: "scale(0.94)"
      },
      {
        transform: "scale(1)"
      }
    ],
    {
      duration: 180
    }
  );

}


/* =========================================================
   12. CLOCK
========================================================= */

function formatTime(seconds) {

  seconds =
    Math.max(
      0,
      Math.floor(seconds)
    );

  const min =
    Math.floor(seconds / 60);

  const sec =
    seconds % 60;

  return (
    String(min).padStart(2, "0") +
    ":" +
    String(sec).padStart(2, "0")
  );

}


function updateClock() {

  const time =
    formatTime(
      state.game.time
    );


  setText(
    "#gameClock",
    time
  );

  setText(
    "#liveClock",
    time
  );


  setText(
    "#shotClock",
    state.game.shotClock
  );


  setText(
    "#periodText",
    `${state.game.period}Q`
  );

  setText(
    "#livePeriod",
    `${state.game.period}Q`
  );

}


/* =========================================================
   13. SAVE CURRENT GAME
========================================================= */

function saveCurrentGame() {

  const game = {

    id:
      state.game.id ||
      Date.now(),

    date:
      new Date().toISOString(),

    name:
      state.game.name ||
      "경기",

    mode:
      state.mode,

    home:
      state.teams.home,

    away:
      state.teams.away,

    homeScore:
      state.game.homeScore,

    awayScore:
      state.game.awayScore,

    events:
      [...state.game.events],

    shots:
      [...state.shots]

  };


  const existing =
    state.games.findIndex(
      item =>
        item.id === game.id
    );


  if (existing >= 0) {

    state.games[existing] =
      game;

  } else {

    state.games.unshift(
      game
    );

  }


  state.game.id =
    game.id;


  saveData();

  renderGames();
  renderRecentGames();

  toast(
    "경기가 저장되었습니다.",
    "success"
  );

}


/* =========================================================
   14. GAME TABLE
========================================================= */

function renderGames() {

  const tbody =
    $("#gamesTable");

  if (!tbody) {
    return;
  }


  const search =
    $("#gameSearch")?.value
      .toLowerCase()
      .trim()
    || "";


  const mode =
    $("#recordModeFilter")?.value
    || "all";


  const result =
    $("#recordResultFilter")?.value
    || "all";


  let games =
    [...state.games];


  games =
    games.filter(game => {

      const matchesSearch =
        !search ||
        game.name
          .toLowerCase()
          .includes(search) ||
        game.home
          .toLowerCase()
          .includes(search) ||
        game.away
          .toLowerCase()
          .includes(search);


      const matchesMode =
        mode === "all" ||
        game.mode === mode;


      const winner =
        game.homeScore >
        game.awayScore
          ? "win"
          : game.homeScore <
              game.awayScore
            ? "loss"
            : "draw";


      const matchesResult =
        result === "all" ||
        result === winner;


      return (
        matchesSearch &&
        matchesMode &&
        matchesResult
      );

    });


  if (!games.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">
          기록된 경기가 없습니다.
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    games.map(game => {

      const date =
        new Date(
          game.date
        ).toLocaleDateString(
          "ko-KR"
        );


      const winner =
        game.homeScore >
        game.awayScore
          ? "HOME 승"
          : game.homeScore <
              game.awayScore
            ? "AWAY 승"
            : "무승부";


      return `
        <tr>

          <td>${date}</td>

          <td>
            <strong>${escapeHTML(game.name)}</strong>
          </td>

          <td>
            ${game.mode === "3x3" ? "3대3" : "5대5"}
          </td>

          <td>
            ${escapeHTML(game.home)}
            <strong>${game.homeScore}</strong>
          </td>

          <td>
            ${escapeHTML(game.away)}
            <strong>${game.awayScore}</strong>
          </td>

          <td>
            ${winner}
          </td>

          <td>

            <button
              class="text-btn"
              onclick="loadGame('${game.id}')"
            >
              불러오기
            </button>

            <button
              class="text-btn"
              onclick="deleteGame('${game.id}')"
            >
              삭제
            </button>

          </td>

        </tr>
      `;

    }).join("");

}


function renderRecentGames() {

  const tbody =
    $("#recentGamesTable");

  if (!tbody) {
    return;
  }


  const games =
    state.games.slice(
      0,
      5
    );


  if (!games.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          저장된 경기가 없습니다.
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    games.map(game => {

      const shots =
        game.shots || [];


      const made =
        shots.filter(
          shot =>
            shot.type === "make"
        ).length;


      const fg =
        shots.length
          ? Math.round(
              made /
              shots.length *
              100
            )
          : 0;


      return `
        <tr>

          <td>
            ${escapeHTML(game.name)}
          </td>

          <td>
            ${game.mode === "3x3" ? "3대3" : "5대5"}
          </td>

          <td>
            ${game.homeScore}
            -
            ${game.awayScore}
          </td>

          <td>
            ${fg}%
          </td>

          <td>
            ${calculate3PT(game.shots)}%
          </td>

          <td>
            ${game.homeScore >= game.awayScore
              ? "HOME"
              : "AWAY"}
          </td>

        </tr>
      `;

    }).join("");

}


window.loadGame = function(id) {

  const game =
    state.games.find(
      item =>
        String(item.id) === String(id)
    );


  if (!game) {
    return;
  }


  state.mode =
    game.mode;

  state.teams.home =
    game.home;

  state.teams.away =
    game.away;


  state.game = {

    id:
      game.id,

    name:
      game.name,

    running: false,

    finished: true,

    period: 1,

    time: state.settings.gameTime,

    initialTime:
      state.settings.gameTime,

    shotClock:
      state.settings.shotClock,

    initialShotClock:
      state.settings.shotClock,

    homeScore:
      game.homeScore,

    awayScore:
      game.awayScore,

    events:
      game.events || []

  };


  state.shots =
    game.shots || [];


  setMode(state.mode);

  updateAll();

  openPage("dashboard");


  toast(
    "경기를 불러왔습니다.",
    "success"
  );

};


window.deleteGame = function(id) {

  const ok =
    confirm(
      "이 경기 기록을 삭제할까요?"
    );


  if (!ok) {
    return;
  }


  state.games =
    state.games.filter(
      game =>
        String(game.id) !==
        String(id)
    );


  saveData();

  renderGames();
  renderRecentGames();

  toast(
    "경기가 삭제되었습니다.",
    "success"
  );

};


/* =========================================================
   15. SHOT CHART
========================================================= */

function bindShotChart() {

  $$(".shot-type").forEach(button => {

    button.addEventListener(
      "click",
      () => {

        $$(".shot-type")
          .forEach(btn =>
            btn.classList.remove("active")
          );

        button.classList.add("active");

        state.shotInput.type =
          button.dataset.shotType;

      }
    );

  });


  $$(".shot-value-btn").forEach(button => {

    button.addEventListener(
      "click",
      () => {

        $$(".shot-value-btn")
          .forEach(btn =>
            btn.classList.remove("active")
          );

        button.classList.add("active");

        state.shotInput.value =
          Number(
            button.dataset.shotValue
          );

      }
    );

  });


  $("#shotCourt")
    ?.addEventListener(
      "click",
      handleCourtClick
    );


  $("#clearShotsBtn")
    ?.addEventListener(
      "click",
      clearShots
    );

}


function handleCourtClick(event) {

  const court =
    $("#shotCourt");

  if (!court) {
    return;
  }


  const rect =
    court.getBoundingClientRect();


  const x =
    (
      event.clientX -
      rect.left
    ) /
    rect.width *
    100;


  const y =
    (
      event.clientY -
      rect.top
    ) /
    rect.height *
    100;


  const shot = {

    id:
      Date.now() +
      Math.random(),

    x,

    y,

    type:
      state.shotInput.type,

    value:
      state.shotInput.value,

    team: "home",

    period:
      state.game.period,

    timestamp:
      new Date().toISOString()

  };


  state.shots.push(
    shot
  );


  saveData();

  renderShotMarkers();

  updateShotStats();

}


function renderShotMarkers() {

  const court =
    $("#shotCourt");

  if (!court) {
    return;
  }


  court
    .querySelectorAll(
      ".shot-marker"
    )
    .forEach(marker =>
      marker.remove()
    );


  state.shots.forEach(shot => {

    const marker =
      document.createElement(
        "div"
      );


    marker.className =
      `shot-marker ${shot.type}`;


    marker.style.left =
      `${shot.x}%`;

    marker.style.top =
      `${shot.y}%`;


    marker.textContent =
      shot.type === "make"
        ? "✓"
        : "×";


    marker.title =
      `${shot.type === "make" ? "성공" : "실패"} · ${shot.value}PT`;


    court.appendChild(
      marker
    );

  });

}


function clearShots() {

  if (!state.shots.length) {
    return;
  }


  const ok =
    confirm(
      "슛차트 기록을 모두 삭제할까요?"
    );


  if (!ok) {
    return;
  }


  state.shots = [];

  saveData();

  renderShotMarkers();

  updateShotStats();

}


/* =========================================================
   16. SHOT STATISTICS
========================================================= */

function updateShotStats() {

  const shots =
    state.shots;


  const total =
    shots.length;


  const made =
    shots.filter(
      shot =>
        shot.type === "make"
    ).length;


  const missed =
    total - made;


  const fg =
    total
      ? Math.round(
          made /
          total *
          100
        )
      : 0;


  const shots2 =
    shots.filter(
      shot =>
        Number(shot.value) === 2
    );


  const made2 =
    shots2.filter(
      shot =>
        shot.type === "make"
    ).length;


  const shots3 =
    shots.filter(
      shot =>
        Number(shot.value) === 3
    );


  const made3 =
    shots3.filter(
      shot =>
        shot.type === "make"
    ).length;


  const fg2 =
    shots2.length
      ? Math.round(
          made2 /
          shots2.length *
          100
        )
      : 0;


  const fg3 =
    shots3.length
      ? Math.round(
          made3 /
          shots3.length *
          100
        )
      : 0;


  const points =
    shots.reduce(
      (sum, shot) =>
        sum +
        (
          shot.type === "make"
            ? Number(shot.value)
            : 0
        ),
      0
    );


  setText(
    "#shotTotal",
    total
  );

  setText(
    "#madeShots",
    made
  );

  setText(
    "#missedShots",
    missed
  );

  setText(
    "#shotFg",
    `${fg}%`
  );

  setText(
    "#shot2pt",
    `${fg2}%`
  );

  setText(
    "#shot3pt",
    `${fg3}%`
  );

  setText(
    "#shotPoints",
    points
  );


  /*
    Zone statistics
  */

  const zones = {
    paint: [],
    mid: [],
    three: []
  };


  shots.forEach(shot => {

    const x =
      Number(shot.x);

    const y =
      Number(shot.y);


    if (x < 27) {

      zones.paint.push(
        shot
      );

    } else if (
      x < 60
    ) {

      zones.mid.push(
        shot
      );

    } else {

      zones.three.push(
        shot
      );

    }

  });


  updateZone(
    zones.paint,
    "#zonePaint",
    "#zonePaintText"
  );

  updateZone(
    zones.mid,
    "#zoneMid",
    "#zoneMidText"
  );

  updateZone(
    zones.three,
    "#zoneThree",
    "#zoneThreeText"
  );

}


function updateZone(
  shots,
  barSelector,
  textSelector
) {

  const total =
    shots.length;


  const made =
    shots.filter(
      shot =>
        shot.type === "make"
    ).length;


  const rate =
    total
      ? Math.round(
          made /
          total *
          100
        )
      : 0;


  const bar =
    $(barSelector);

  if (bar) {
    bar.style.width =
      `${rate}%`;
  }

  setText(
    textSelector,
    `${rate}%`
  );

}


function calculate3PT(shots = []) {

  const three =
    shots.filter(
      shot =>
        Number(shot.value) === 3
    );


  if (!three.length) {
    return 0;
  }


  const made =
    three.filter(
      shot =>
        shot.type === "make"
    ).length;


  return Math.round(
    made /
    three.length *
    100
  );

}


/* =========================================================
   17. PLAYERS
========================================================= */

function bindPlayerControls() {

  $("#addPlayerBtn")
    ?.addEventListener(
      "click",
      () => {

        resetPlayerForm();

        openModal(
          "playerModal"
        );

      }
    );


  $("#playerForm")
    ?.addEventListener(
      "submit",
      savePlayer
    );


  $("#playerSearch")
    ?.addEventListener(
      "input",
      renderPlayers
    );


  $("#playerPositionFilter")
    ?.addEventListener(
      "change",
      renderPlayers
    );


  $("#reportPlayerSelect")
    ?.addEventListener(
      "change",
      event => {

        state.selectedReportPlayer =
          event.target.value;

        renderPlayerReport();

      }
    );

}


function savePlayer(event) {

  event.preventDefault();


  const id =
    $("#playerId")?.value;


  const player = {

    id:
      id ||
      Date.now().toString(),

    name:
      $("#playerName")?.value.trim()
      || "이름 없음",

    number:
      Number(
        $("#playerNumber")?.value
        || 0
      ),

    position:
      $("#playerPosition")?.value
      || "G",

    hand:
      $("#playerHand")?.value
      || "right",

    stats: {

      points: 0,

      fgMade: 0,

      fgAttempted: 0,

      threeMade: 0,

      threeAttempted: 0,

      ftMade: 0,

      ftAttempted: 0,

      reb: 0,

      ast: 0,

      stl: 0,

      blk: 0,

      to: 0

    }

  };


  const existing =
    state.players.findIndex(
      p =>
        String(p.id) ===
        String(player.id)
    );


  if (existing >= 0) {

    player.stats =
      state.players[existing].stats
      || player.stats;

    state.players[existing] =
      player;

  } else {

    state.players.push(
      player
    );

  }


  saveData();

  closeModal(
    "playerModal"
  );

  renderPlayers();
  populatePlayerSelect();

  toast(
    "선수 정보가 저장되었습니다.",
    "success"
  );

}


function resetPlayerForm() {

  $("#playerForm")?.reset();

  setText(
    "#playerModalTitle",
    "선수 등록"
  );

  if ($("#playerId")) {
    $("#playerId").value = "";
  }

}


function renderPlayers() {

  const grid =
    $("#playerGrid");

  if (!grid) {
    return;
  }


  const search =
    $("#playerSearch")?.value
      .toLowerCase()
      .trim()
    || "";


  const position =
    $("#playerPositionFilter")?.value
    || "all";


  const players =
    state.players.filter(
      player => {

        const matchSearch =
          !search ||
          player.name
            .toLowerCase()
            .includes(search);


        const matchPosition =
          position === "all" ||
          player.position === position;


        return (
          matchSearch &&
          matchPosition
        );

      }
    );


  if (!players.length) {

    grid.innerHTML = `
      <div class="empty-state large">
        등록된 선수가 없습니다.
      </div>
    `;

    return;
  }


  grid.innerHTML =
    players.map(player => {

      return `
        <article class="player-card">

          <div class="player-top">

            <div class="player-number">
              ${player.number}
            </div>

            <div class="player-position">
              ${player.position}
            </div>

          </div>

          <h3>
            ${escapeHTML(player.name)}
          </h3>

          <p class="player-meta">
            ${player.hand === "left"
              ? "왼손"
              : player.hand === "both"
                ? "양손"
                : "오른손"}
          </p>

          <div class="player-card-actions">

            <button
              onclick="editPlayer('${player.id}')"
            >
              수정
            </button>

            <button
              onclick="deletePlayer('${player.id}')"
            >
              삭제
            </button>

          </div>

        </article>
      `;

    }).join("");

}


window.editPlayer = function(id) {

  const player =
    state.players.find(
      p =>
        String(p.id) ===
        String(id)
    );


  if (!player) {
    return;
  }


  $("#playerId").value =
    player.id;

  $("#playerName").value =
    player.name;

  $("#playerNumber").value =
    player.number;

  $("#playerPosition").value =
    player.position;

  $("#playerHand").value =
    player.hand;


  setText(
    "#playerModalTitle",
    "선수 정보 수정"
  );


  openModal(
    "playerModal"
  );

};


window.deletePlayer = function(id) {

  const ok =
    confirm(
      "이 선수를 삭제할까요?"
    );


  if (!ok) {
    return;
  }


  state.players =
    state.players.filter(
      player =>
        String(player.id) !==
        String(id)
    );


  saveData();

  renderPlayers();

  populatePlayerSelect();

  toast(
    "선수가 삭제되었습니다.",
    "success"
  );

};


function populatePlayerSelect() {

  const select =
    $("#reportPlayerSelect");

  if (!select) {
    return;
  }


  const current =
    state.selectedReportPlayer;


  select.innerHTML = `
    <option value="">
      선수를 선택하세요
    </option>
  `;


  state.players.forEach(
    player => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        player.id;

      option.textContent =
        `#${player.number} ${player.name}`;

      select.appendChild(
        option
      );

    }
  );


  if (current) {
    select.value =
      current;
  }

}


/* =========================================================
   18. PLAYER REPORT
========================================================= */

function renderPlayerReport() {

  const container =
    $("#playerReport");

  if (!container) {
    return;
  }


  populatePlayerSelect();


  const player =
    state.players.find(
      p =>
        String(p.id) ===
        String(
          state.selectedReportPlayer
        )
    );


  if (!player) {

    container.innerHTML = `
      <div class="empty-state large">
        선수를 선택하면 리포트가 표시됩니다.
      </div>
    `;

    return;
  }


  const stats =
    player.stats || {};


  container.innerHTML = `

    <article class="panel">

      <div class="player-report-header">

        <div class="player-report-name">

          <div class="report-player-number">
            ${player.number}
          </div>

          <div>

            <span class="eyebrow">
              PLAYER REPORT
            </span>

            <h3>
              ${escapeHTML(player.name)}
            </h3>

            <p class="player-meta">
              ${player.position}
            </p>

          </div>

        </div>

      </div>


      <div class="player-report-stat-grid">

        ${reportStat(
          "PTS",
          stats.points || 0
        )}

        ${reportStat(
          "REB",
          stats.reb || 0
        )}

        ${reportStat(
          "AST",
          stats.ast || 0
        )}

        ${reportStat(
          "STL",
          stats.stl || 0
        )}

        ${reportStat(
          "BLK",
          stats.blk || 0
        )}

        ${reportStat(
          "TO",
          stats.to || 0
        )}

      </div>


      <div class="report-chart">

        <canvas
          id="playerRadarChart"
        ></canvas>

      </div>

    </article>

  `;


  createPlayerRadar(
    player
  );

}


function reportStat(
  label,
  value
) {

  return `
    <div>

      <span>
        ${label}
      </span>

      <strong>
        ${value}
      </strong>

    </div>
  `;

}


/* =========================================================
   19. VIDEO
========================================================= */

function bindVideoControls() {

  $("#selectVideoBtn")
    ?.addEventListener(
      "click",
      () =>
        $("#videoInput")?.click()
    );


  $("#videoInput")
    ?.addEventListener(
      "change",
      handleVideo
    );


  $("#videoDropzone")
    ?.addEventListener(
      "dragover",
      event => {

        event.preventDefault();

        $("#videoDropzone")
          ?.classList.add(
            "dragover"
          );

      }
    );


  $("#videoDropzone")
    ?.addEventListener(
      "dragleave",
      () => {

        $("#videoDropzone")
          ?.classList.remove(
            "dragover"
          );

      }
    );


  $("#videoDropzone")
    ?.addEventListener(
      "drop",
      event => {

        event.preventDefault();

        $("#videoDropzone")
          ?.classList.remove(
            "dragover"
          );


        const file =
          event.dataTransfer
            ?.files?.[0];


        if (file) {
          loadVideoFile(file);
        }

      }
    );


  $("#slowDownBtn")
    ?.addEventListener(
      "click",
      () =>
        setVideoRate(0.5)
    );


  $("#normalSpeedBtn")
    ?.addEventListener(
      "click",
      () =>
        setVideoRate(1)
    );


  $("#fastSpeedBtn")
    ?.addEventListener(
      "click",
      () =>
        setVideoRate(1.5)
    );


  $("#frameBackBtn")
    ?.addEventListener(
      "click",
      () =>
        moveFrame(-1)
    );


  $("#frameForwardBtn")
    ?.addEventListener(
      "click",
      () =>
        moveFrame(1)
    );


  $("#detectPoseBtn")
    ?.addEventListener(
      "click",
      () =>
        videoAnalysisMessage(
          "자세 추적 기능이 선택되었습니다."
        )
    );


  $("#detectMovementBtn")
    ?.addEventListener(
      "click",
      () =>
        videoAnalysisMessage(
          "움직임 분석 기능이 선택되었습니다."
        )
    );


  $("#detectShotBtn")
    ?.addEventListener(
      "click",
      () =>
        videoAnalysisMessage(
          "슛 장면 분석 기능이 선택되었습니다."
        )
    );


  $("#createHighlightBtn")
    ?.addEventListener(
      "click",
      () =>
        videoAnalysisMessage(
          "하이라이트 생성 기능이 선택되었습니다."
        )
    );

}


function handleVideo(event) {

  const file =
    event.target.files?.[0];

  if (file) {
    loadVideoFile(file);
  }

}


function loadVideoFile(file) {

  const video =
    $("#analysisVideo");

  if (!video) {
    return;
  }


  const url =
    URL.createObjectURL(file);


  video.src =
    url;


  hide(
    "#videoDropzone"
  );

  show(
    "#videoPlayerWrap"
  );


  videoAnalysisMessage(
    `영상 로드 완료 · ${file.name}`
  );

}


function setVideoRate(rate) {

  const video =
    $("#analysisVideo");

  if (!video) {
    return;
  }

  video.playbackRate =
    rate;

}


function moveFrame(direction) {

  const video =
    $("#analysisVideo");

  if (!video) {
    return;
  }


  /*
    일반적인 영상의 한 프레임을
    약 1/30초로 이동
  */

  const frame =
    1 / 30;


  video.currentTime =
    Math.max(
      0,
      video.currentTime +
      frame * direction
    );

}


function videoAnalysisMessage(message) {

  const result =
    $("#videoAnalysisResult");

  if (!result) {
    return;
  }


  result.innerHTML = `

    <div class="live-comment">

      <span>
        AI VIDEO ANALYSIS
      </span>

      <p>
        ${escapeHTML(message)}
      </p>

    </div>

  `;

}


/* =========================================================
   20. POSE / CAMERA
========================================================= */

let cameraStream = null;
let poseInstance = null;


function bindPoseControls() {

  $("#cameraStartBtn")
    ?.addEventListener(
      "click",
      startCamera
    );


  $("#cameraStopBtn")
    ?.addEventListener(
      "click",
      stopCamera
    );

}


async function startCamera() {

  const video =
    $("#poseVideo");

  const canvas =
    $("#poseCanvas");


  if (!video || !canvas) {
    return;
  }


  try {

    cameraStream =
      await navigator.mediaDevices
        .getUserMedia({

          video: {
            facingMode: "user",
            width: {
              ideal: 1280
            },
            height: {
              ideal: 720
            }
          },

          audio: false

        });


    video.srcObject =
      cameraStream;


    setText(
      "#cameraStatus",
      "CAMERA LIVE"
    );


    $("#cameraStatus")
      ?.classList.add("live");


    initializePose(
      video,
      canvas
    );


    toast(
      "카메라가 시작되었습니다.",
      "success"
    );

  } catch (error) {

    console.error(error);

    toast(
      "카메라를 사용할 수 없습니다. 브라우저 권한을 확인해주세요.",
      "error"
    );

  }

}


function stopCamera() {

  if (cameraStream) {

    cameraStream
      .getTracks()
      .forEach(track =>
        track.stop()
      );

    cameraStream = null;

  }


  const video =
    $("#poseVideo");

  if (video) {
    video.srcObject = null;
  }


  if (poseInstance) {

    try {
      poseInstance.close();
    } catch (_) {}

    poseInstance = null;

  }


  setText(
    "#cameraStatus",
    "CAMERA OFF"
  );


  $("#cameraStatus")
    ?.classList.remove("live");

}


function initializePose(
  video,
  canvas
) {

  if (
    typeof Pose ===
    "undefined"
  ) {

    setText(
      "#poseComment",
      "MediaPipe Pose를 불러오지 못했습니다."
    );

    return;

  }


  const ctx =
    canvas.getContext("2d");


  poseInstance =
    new Pose({

      locateFile: file =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`

    });


  poseInstance.setOptions({

    modelComplexity: 1,

    smoothLandmarks: true,

    enableSegmentation: false,

    smoothSegmentation: false,

    minDetectionConfidence: 0.5,

    minTrackingConfidence: 0.5

  });


  poseInstance.onResults(
    results => {

      const width =
        video.videoWidth ||
        640;


      const height =
        video.videoHeight ||
        480;


      canvas.width =
        width;

      canvas.height =
        height;


      ctx.clearRect(
        0,
        0,
        width,
        height
      );


      if (
        results.poseLandmarks &&
        typeof drawConnectors !==
          "undefined"
      ) {

        drawConnectors(
          ctx,
          results.poseLandmarks,
          POSE_CONNECTIONS,
          {
            color: "#39d98a",
            lineWidth: 3
          }
        );


        drawLandmarks(
          ctx,
          results.poseLandmarks,
          {
            color: "#ffffff",
            lineWidth: 1,
            radius: 3
          }
        );


        analyzePose(
          results.poseLandmarks
        );

      }

    }
  );


  runPoseLoop(
    video
  );

}


async function runPoseLoop(video) {

  if (!poseInstance) {
    return;
  }


  if (
    video.readyState >= 2
  ) {

    try {

      await poseInstance.send({
        image: video
      });

    } catch (error) {
      console.error(error);
    }

  }


  if (
    cameraStream &&
    poseInstance
  ) {

    requestAnimationFrame(
      () =>
        runPoseLoop(video)
    );

  }

}


function analyzePose(
  landmarks
) {

  const leftShoulder =
    landmarks[11];

  const rightShoulder =
    landmarks[12];

  const leftHip =
    landmarks[23];

  const rightHip =
    landmarks[24];

  const leftKnee =
    landmarks[25];

  const rightKnee =
    landmarks[26];


  if (
    !leftShoulder ||
    !rightShoulder ||
    !leftHip ||
    !rightHip
  ) {
    return;
  }


  /*
    Simple balance estimate.
    This is an on-device geometric
    heuristic, not a medical diagnosis.
  */

  const shoulderDiff =
    Math.abs(
      leftShoulder.y -
      rightShoulder.y
    );


  const hipDiff =
    Math.abs(
      leftHip.y -
      rightHip.y
    );


  const balance =
    clamp(
      Math.round(
        100 -
        (
          shoulderDiff +
          hipDiff
        ) *
        300
      ),
      0,
      100
    );


  let kneeScore = 70;


  if (
    leftKnee &&
    rightKnee
  ) {

    const kneeDiff =
      Math.abs(
        leftKnee.x -
        rightKnee.x
      );


    kneeScore =
      clamp(
        Math.round(
          100 -
          kneeDiff *
          80
        ),
        0,
        100
      );

  }


  const upper =
    clamp(
      Math.round(
        100 -
        shoulderDiff *
        300
      ),
      0,
      100
    );


  const foot =
    75;


  const overall =
    Math.round(
      (
        balance +
        kneeScore +
        upper +
        foot
      ) / 4
    );


  setText(
    "#poseScore",
    overall
  );

  setText(
    "#balanceScore",
    balance
  );

  setText(
    "#kneeScore",
    kneeScore
  );

  setText(
    "#upperScore",
    upper
  );

  setText(
    "#footScore",
    foot
  );


  setProgress(
    "#balanceBar",
    balance
  );

  setProgress(
    "#kneeBar",
    kneeScore
  );

  setProgress(
    "#upperBar",
    upper
  );

  setProgress(
    "#footBar",
    foot
  );


  let comment =
    "균형이 안정적입니다.";


  if (overall < 60) {

    comment =
      "중심 이동과 하체 안정성을 확인해보세요.";

  } else if (
    overall < 75
  ) {

    comment =
      "전체적인 자세는 양호하지만 안정성을 더 높일 수 있습니다.";

  } else {

    comment =
      "현재 자세 밸런스가 안정적으로 나타납니다.";

  }


  setText(
    "#poseComment",
    comment
  );

}


function setProgress(
  selector,
  value
) {

  const element =
    $(selector);

  if (element) {
    element.style.width =
      `${value}%`;
  }

}


/* =========================================================
   21. LEAGUE
========================================================= */

function bindLeagueControls() {

  $$(".league-tab").forEach(tab => {

    tab.addEventListener(
      "click",
      () => {

        const target =
          tab.dataset.leagueTab;


        $$(".league-tab")
          .forEach(
            item =>
              item.classList.remove(
                "active"
              )
          );


        $$(".league-content")
          .forEach(
            content =>
              content.classList.remove(
                "active"
              )
          );


        tab.classList.add(
          "active"
        );


        $(
          `#league-${target}`
        )?.classList.add(
          "active"
        );

      }
    );

  });


  $("#generateLeagueBtn")
    ?.addEventListener(
      "click",
      generateLeague
    );

}


function generateLeague() {

  const names =
    prompt(
      "팀 이름을 쉼표로 입력하세요.\n예: A팀,B팀,C팀,D팀"
    );


  if (!names) {
    return;
  }


  const teams =
    names
      .split(",")
      .map(name =>
        name.trim()
      )
      .filter(Boolean);


  if (teams.length < 2) {

    toast(
      "2개 이상의 팀이 필요합니다.",
      "error"
    );

    return;
  }


  state.league.teams =
    teams.map(name => ({

      name,

      played: 0,

      wins: 0,

      losses: 0,

      pointsFor: 0,

      pointsAgainst: 0

    }));


  /*
    Round robin schedule
  */

  const schedule = [];

  let gameNo = 1;


  for (
    let i = 0;
    i < teams.length;
    i++
  ) {

    for (
      let j = i + 1;
      j < teams.length;
      j++
    ) {

      schedule.push({

        id:
          Date.now() +
          gameNo,

        number:
          gameNo,

        home:
          teams[i],

        away:
          teams[j],

        played: false,

        homeScore: null,

        awayScore: null

      });


      gameNo++;

    }

  }


  state.league.schedule =
    schedule;


  saveData();

  renderLeague();


  toast(
    "리그 일정이 생성되었습니다.",
    "success"
  );

}


function renderLeague() {

  renderRanking();

  renderSchedule();

  renderLeagueResults();

}


function renderRanking() {

  const tbody =
    $("#rankingTable");

  if (!tbody) {
    return;
  }


  const teams =
    [...state.league.teams]
      .sort(
        (a, b) => {

          const diffA =
            a.pointsFor -
            a.pointsAgainst;


          const diffB =
            b.pointsFor -
            b.pointsAgainst;


          return (
            b.wins -
            a.wins
          ) || (
            diffB -
            diffA
          );

        }
      );


  if (!teams.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">
          등록된 팀이 없습니다.
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    teams.map(
      (team, index) => {

        const diff =
          team.pointsFor -
          team.pointsAgainst;


        return `
          <tr>

            <td>
              <strong>
                ${index + 1}
              </strong>
            </td>

            <td>
              ${escapeHTML(team.name)}
            </td>

            <td>
              ${team.played}
            </td>

            <td>
              ${team.wins}
            </td>

            <td>
              ${team.losses}
            </td>

            <td>
              ${team.pointsFor}
            </td>

            <td>
              ${team.pointsAgainst}
            </td>

            <td>
              ${diff}
            </td>

          </tr>
        `;

      }
    ).join("");

}


function renderSchedule() {

  const container =
    $("#leagueSchedule");

  if (!container) {
    return;
  }


  if (
    !state.league.schedule.length
  ) {

    container.innerHTML = `
      <div class="empty-state">
        생성된 일정이 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    state.league.schedule
      .map(match => `

        <div class="schedule-card">

          <div class="schedule-date">
            GAME ${match.number}
          </div>

          <div class="schedule-match">

            ${escapeHTML(match.home)}

            <span>
              VS
            </span>

            ${escapeHTML(match.away)}

          </div>

          <div>

            ${
              match.played
                ? `${match.homeScore} - ${match.awayScore}`
                : `<button
                    class="secondary-btn"
                    onclick="enterLeagueResult('${match.id}')"
                  >
                    결과 입력
                  </button>`
            }

          </div>

        </div>

      `).join("");

}


window.enterLeagueResult =
  function(id) {

    const match =
      state.league.schedule.find(
        item =>
          String(item.id) ===
          String(id)
      );


    if (!match) {
      return;
    }


    const score =
      prompt(
        `${match.home} - ${match.away}\n점수를 입력하세요.\n예: 21-18`
      );


    if (!score) {
      return;
    }


    const values =
      score
        .split("-")
        .map(
          value =>
            Number(
              value.trim()
            )
        );


    if (
      values.length !== 2 ||
      values.some(
        value =>
          !Number.isFinite(value)
      )
    ) {

      toast(
        "점수 형식이 올바르지 않습니다.",
        "error"
      );

      return;
    }


    match.played = true;

    match.homeScore =
      values[0];

    match.awayScore =
      values[1];


    updateLeagueStandings(
      match
    );


    saveData();

    renderLeague();

    toast(
      "경기 결과가 입력되었습니다.",
      "success"
    );

  };


function updateLeagueStandings(
  match
) {

  const home =
    state.league.teams.find(
      team =>
        team.name ===
        match.home
    );


  const away =
    state.league.teams.find(
      team =>
        team.name ===
        match.away
    );


  if (!home || !away) {
    return;
  }


  home.played++;
  away.played++;


  home.pointsFor +=
    match.homeScore;

  home.pointsAgainst +=
    match.awayScore;


  away.pointsFor +=
    match.awayScore;

  away.pointsAgainst +=
    match.homeScore;


  if (
    match.homeScore >
    match.awayScore
  ) {

    home.wins++;
    away.losses++;

  } else if (
    match.homeScore <
    match.awayScore
  ) {

    away.wins++;
    home.losses++;

  }

}


function renderLeagueResults() {

  const container =
    $("#leagueResults");

  if (!container) {
    return;
  }


  const results =
    state.league.schedule
      .filter(
        match =>
          match.played
      );


  if (!results.length) {

    container.innerHTML = `
      <div class="empty-state">
        경기 결과가 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    results.map(
      match => `

        <div class="schedule-card">

          <div class="schedule-date">
            GAME ${match.number}
          </div>

          <div class="schedule-match">

            ${escapeHTML(match.home)}

            <span>
              ${match.homeScore}
              :
              ${match.awayScore}
            </span>

            ${escapeHTML(match.away)}

          </div>

          <div>
            완료
          </div>

        </div>

      `
    ).join("");

}


/* =========================================================
   22. SETTINGS
========================================================= */

function bindSettingsControls() {

  $("#saveTeamSettingsBtn")
    ?.addEventListener(
      "click",
      saveTeamSettings
    );


  $("#gameTimeSetting")
    ?.addEventListener(
      "change",
      event => {

        state.settings.gameTime =
          Number(
            event.target.value
          );

        saveData();

      }
    );


  $("#shotClockSetting")
    ?.addEventListener(
      "change",
      event => {

        state.settings.shotClock =
          Number(
            event.target.value
          );

        saveData();

      }
    );


  $("#exportDataBtn")
    ?.addEventListener(
      "click",
      exportData
    );


  $("#importDataBtn")
    ?.addEventListener(
      "click",
      () =>
        $("#importDataInput")?.click()
    );


  $("#importDataInput")
    ?.addEventListener(
      "change",
      importData
    );


  $("#clearAllDataBtn")
    ?.addEventListener(
      "click",
      clearAllData
    );


  $("#fullscreenBtn")
    ?.addEventListener(
      "click",
      toggleFullscreen
    );


  $("#themeBtn")
    ?.addEventListener(
      "click",
      toggleTheme
    );

}


function saveTeamSettings() {

  const home =
    $("#homeTeamInput")
      ?.value.trim();


  const away =
    $("#awayTeamInput")
      ?.value.trim();


  if (home) {
    state.teams.home =
      home;
  }

  if (away) {
    state.teams.away =
      away;
  }


  saveData();

  updateAll();

  toast(
    "팀 설정이 저장되었습니다.",
    "success"
  );

}


function exportData() {

  const data =
    JSON.stringify(
      state,
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
    `courtv-pro-backup-${Date.now()}.json`;


  a.click();


  URL.revokeObjectURL(
    url
  );


  toast(
    "데이터 백업 파일을 생성했습니다.",
    "success"
  );

}


function importData(event) {

  const file =
    event.target.files?.[0];


  if (!file) {
    return;
  }


  const reader =
    new FileReader();


  reader.onload =
    () => {

      try {

        const data =
          JSON.parse(
            reader.result
          );


        Object.assign(
          state,
          data
        );


        saveData();

        updateAll();

        toast(
          "데이터를 복원했습니다.",
          "success"
        );

      } catch (error) {

        console.error(error);

        toast(
          "백업 파일을 읽을 수 없습니다.",
          "error"
        );

      }

    };


  reader.readAsText(
    file
  );

}


function clearAllData() {

  const ok =
    confirm(
      "모든 선수·경기·슛차트·리그 데이터를 삭제할까요?\n이 작업은 되돌릴 수 없습니다."
    );


  if (!ok) {
    return;
  }


  localStorage.removeItem(
    STORAGE_KEY
  );


  location.reload();

}


/* =========================================================
   23. GAME REPORT
========================================================= */

function updateGameReport() {

  setText(
    "#reportGameTitle",
    state.game.name ||
      "경기 리포트"
  );


  setText(
    "#reportDate",
    new Date().toLocaleString(
      "ko-KR"
    )
  );


  setText(
    "#reportHomeScore",
    state.game.homeScore
  );


  setText(
    "#reportAwayScore",
    state.game.awayScore
  );


  const winner =
    state.game.homeScore >
    state.game.awayScore
      ? state.teams.home
      : state.game.homeScore <
          state.game.awayScore
        ? state.teams.away
        : "무승부";


  setText(
    "#reportSummary",
    `현재 경기 결과는 ${state.teams.home} ${state.game.homeScore} : ${state.game.awayScore} ${state.teams.away}입니다. 결과 우세 팀: ${winner}`
  );


  const analysis =
    generateAnalysis();


  const list =
    $("#reportAnalysis");


  if (list) {

    list.innerHTML =
      analysis
        .map(
          item =>
            `<li>${escapeHTML(item)}</li>`
        )
        .join("");

  }


  setText(
    "#reportCoach",
    generateCoachComment()
  );

}


function generateAnalysis() {

  const result = [];


  const shots =
    state.shots;


  const total =
    shots.length;


  const made =
    shots.filter(
      shot =>
        shot.type === "make"
    ).length;


  const fg =
    total
      ? Math.round(
          made /
          total *
          100
        )
      : 0;


  const turnovers =
    state.game.events.filter(
      event =>
        event.stat === "to"
    ).length;


  if (fg >= 55) {

    result.push(
      "슛 효율이 높은 경기 흐름을 보이고 있습니다."
    );

  } else if (fg >= 40) {

    result.push(
      "평균적인 슛 성공률을 유지하고 있습니다."
    );

  } else {

    result.push(
      "슛 선택과 공격 전개 효율을 개선할 필요가 있습니다."
    );

  }


  if (turnovers >= 5) {

    result.push(
      "턴오버 관리가 중요한 개선 포인트입니다."
    );

  } else {

    result.push(
      "공격권 관리가 비교적 안정적입니다."
    );

  }


  if (
    state.game.homeScore >
    state.game.awayScore
  ) {

    result.push(
      "현재 HOME 팀이 스코어에서 우위를 보이고 있습니다."
    );

  } else if (
    state.game.homeScore <
    state.game.awayScore
  ) {

    result.push(
      "현재 AWAY 팀이 스코어에서 우위를 보이고 있습니다."
    );

  } else {

    result.push(
      "양 팀이 동점으로 팽팽한 경기입니다."
    );

  }


  return result;

}


function generateCoachComment() {

  const turnovers =
    state.game.events.filter(
      event =>
        event.stat === "to"
    ).length;


  const shots =
    state.shots;


  const made =
    shots.filter(
      shot =>
        shot.type === "make"
    ).length;


  const fg =
    shots.length
      ? made /
        shots.length *
        100
      : 0;


  if (turnovers >= 6) {

    return "다음 경기에서는 볼 소유 안정성과 패스 타이밍을 우선적으로 개선해보세요.";

  }


  if (fg < 40) {

    return "좋은 슛을 만드는 과정과 공격 공간 확보를 우선적으로 점검해보세요.";

  }


  return "현재 공격 효율이 안정적입니다. 수비 전환 속도와 리바운드 이후 전개까지 연결해보세요.";

}


/* =========================================================
   24. TEAM ANALYSIS
========================================================= */

function updateTeamAnalysis() {

  const events =
    state.game.events;


  const points =
    state.game.homeScore;


  const reb =
    countStat(
      events,
      "reb"
    );


  const ast =
    countStat(
      events,
      "ast"
    );


  const stl =
    countStat(
      events,
      "stl"
    );


  const blk =
    countStat(
      events,
      "blk"
    );


  const to =
    countStat(
      events,
      "to"
    );


  const fg =
    calculateCurrentFG();


  const three =
    calculateCurrent3PT();


  setText(
    "#teamPoints",
    points
  );

  setText(
    "#teamFg",
    `${fg}%`
  );

  setText(
    "#team3pt",
    `${three}%`
  );

  setText(
    "#teamAst",
    ast
  );

  setText(
    "#teamReb",
    reb
  );

  setText(
    "#teamStl",
    stl
  );

  setText(
    "#teamBlk",
    blk
  );

  setText(
    "#teamTo",
    to
  );


  createTeamRadar({
    offense:
      normalizeScore(
        points,
        100
      ),

    shooting:
      fg,

    passing:
      normalizeScore(
        ast,
        15
      ),

    rebounding:
      normalizeScore(
        reb,
        20
      ),

    defense:
      normalizeScore(
        stl + blk,
        12
      ),

    ballControl:
      normalizeScore(
        Math.max(
          0,
          10 - to
        ),
        10
      )

  });

}


function countStat(
  events,
  stat
) {

  return events.filter(
    event =>
      event.stat === stat &&
      event.team === "home"
  ).length;

}


function calculateCurrentFG() {

  const shots =
    state.shots.filter(
      shot =>
        shot.team === "home"
    );


  if (!shots.length) {
    return 0;
  }


  const made =
    shots.filter(
      shot =>
        shot.type === "make"
    ).length;


  return Math.round(
    made /
    shots.length *
    100
  );

}


function calculateCurrent3PT() {

  const shots =
    state.shots.filter(
      shot =>
        shot.team === "home" &&
        Number(shot.value) === 3
    );


  if (!shots.length) {
    return 0;
  }


  const made =
    shots.filter(
      shot =>
        shot.type === "make"
    ).length;


  return Math.round(
    made /
    shots.length *
    100
  );

}


/* =========================================================
   25. DASHBOARD
========================================================= */

function updateDashboard() {

  setText(
    "#homeScore",
    state.game.homeScore
  );

  setText(
    "#awayScore",
    state.game.awayScore
  );


  setText(
    "#liveHomeScore",
    state.game.homeScore
  );

  setText(
    "#liveAwayScore",
    state.game.awayScore
  );


  setText(
    "#homeTeamName",
    state.teams.home
  );

  setText(
    "#awayTeamName",
    state.teams.away
  );


  setText(
    "#liveHomeName",
    state.teams.home
  );

  setText(
    "#liveAwayName",
    state.teams.away
  );


  const fg =
    calculateCurrentFG();


  const three =
    calculateCurrent3PT();


  const reb =
    countStat(
      state.game.events,
      "reb"
    );


  const ast =
    countStat(
      state.game.events,
      "ast"
    );


  const stl =
    countStat(
      state.game.events,
      "stl"
    );


  const to =
    countStat(
      state.game.events,
      "to"
    );


  setText(
    "#kpiFg",
    `${fg}%`
  );

  setText(
    "#kpi3pt",
    `${three}%`
  );

  setText(
    "#kpiReb",
    reb
  );

  setText(
    "#kpiAst",
    ast
  );

  setText(
    "#kpiStl",
    stl
  );

  setText(
    "#kpiTo",
    to
  );


  const score =
    calculateTeamScore();


  setText(
    "#teamAnalysisScore",
    score
  );


  renderDashboardAnalysis();

}


function calculateTeamScore() {

  const fg =
    calculateCurrentFG();


  const three =
    calculateCurrent3PT();


  const ast =
    countStat(
      state.game.events,
      "ast"
    );


  const reb =
    countStat(
      state.game.events,
      "reb"
    );


  const to =
    countStat(
      state.game.events,
      "to"
    );


  return clamp(
    Math.round(
      fg * 0.4 +
      three * 0.2 +
      Math.min(
        100,
        ast * 5
      ) * 0.15 +
      Math.min(
        100,
        reb * 4
      ) * 0.15 +
      Math.max(
        0,
        100 -
        to * 10
      ) * 0.1
    ),
    0,
    100
  );

}


function renderDashboardAnalysis() {

  const container =
    $("#dashboardAnalysis");

  if (!container) {
    return;
  }


  const analysis =
    generateAnalysis();


  container.innerHTML =
    analysis.map(
      text => `

        <div class="analysis-item">

          <span>●</span>

          <p>
            ${escapeHTML(text)}
          </p>

        </div>

      `
    ).join("");

}


function updateLiveAnalysis() {

  const fg =
    calculateCurrentFG();


  const reb =
    countStat(
      state.game.events,
      "reb"
    );


  const ast =
    countStat(
      state.game.events,
      "ast"
    );


  const to =
    countStat(
      state.game.events,
      "to"
    );


  const offense =
    clamp(
      Math.round(
        fg * 0.65 +
        ast * 2.5
      ),
      0,
      100
    );


  const defense =
    clamp(
      Math.round(
        reb * 3 +
        countStat(
          state.game.events,
          "stl"
        ) * 7 +
        countStat(
          state.game.events,
          "blk"
        ) * 8
      ),
      0,
      100
    );


  const elapsed =
    state.game.initialTime -
    state.game.time;


  const pace =
    elapsed > 0
      ? Math.round(
          state.game.homeScore /
          elapsed *
          60
        )
      : 0;


  setText(
    "#liveOffense",
    offense
  );

  setText(
    "#liveDefense",
    defense
  );

  setText(
    "#livePace",
    pace
  );


  let comment =
    "경기 데이터를 수집하는 중입니다.";


  if (to >= 5) {

    comment =
      "턴오버가 증가하고 있습니다. 볼 운반과 패스 선택을 점검하세요.";

  } else if (
    fg >= 55
  ) {

    comment =
      "슛 효율이 좋습니다. 현재 공격 흐름을 유지하세요.";

  } else if (
    fg < 35 &&
    state.shots.length >= 5
  ) {

    comment =
      "슛 성공률이 낮습니다. 더 좋은 위치에서 슛을 만드는 것이 중요합니다.";

  } else if (
    reb >= 8
  ) {

    comment =
      "리바운드에서 좋은 흐름을 보이고 있습니다.";

  }


  setText(
    "#liveComment",
    comment
  );

}


function renderLiveEvents() {

  const container =
    $("#liveEvents");

  if (!container) {
    return;
  }


  const events =
    state.game.events
      .slice(-8)
      .reverse();


  if (!events.length) {

    container.innerHTML = `
      <div class="empty-state">
        아직 이벤트가 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    events.map(
      event => {

        const text =
          event.text ||
          getEventText(event);


        return `

          <div class="event-item">

            <span>
              ${escapeHTML(text)}
            </span>

            <span>
              ${event.clock || ""}
            </span>

          </div>

        `;

      }
    ).join("");

}


function getEventText(event) {

  const team =
    event.team === "home"
      ? state.teams.home
      : state.teams.away;


  const labels = {

    ft: "자유투",

    fg2: state.mode === "3x3"
      ? "1점 성공"
      : "2점 성공",

    fg3: state.mode === "3x3"
      ? "2점 성공"
      : "3점 성공",

    reb: "리바운드",

    ast: "어시스트",

    stl: "스틸",

    blk: "블록",

    to: "턴오버"

  };


  return `
    ${team}
    ·
    ${labels[event.stat] || event.stat}
    ${
      event.points
        ? `+${event.points}`
        : ""
    }
  `;

}


/* =========================================================
   26. CHARTS
========================================================= */

let performanceChart = null;
let teamRadarChart = null;
let playerRadarChart = null;


function initCharts() {

  if (
    typeof Chart ===
    "undefined"
  ) {
    return;
  }


  const performanceCanvas =
    $("#performanceChart");


  if (performanceCanvas) {

    performanceChart =
      new Chart(
        performanceCanvas,
        {

          type: "line",

          data: {

            labels: [
              "1",
              "2",
              "3",
              "4",
              "5",
              "6",
              "7"
            ],

            datasets: [

              {
                label: "득점 흐름",

                data: [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ],

                borderWidth: 2,

                tension: 0.35,

                fill: false

              }

            ]

          },

          options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

              legend: {
                display: false
              }

            },

            scales: {

              x: {
                grid: {
                  color:
                    "rgba(255,255,255,0.04)"
                },

                ticks: {
                  color:
                    "#71818e"
                }

              },

              y: {

                beginAtZero: true,

                grid: {
                  color:
                    "rgba(255,255,255,0.04)"
                },

                ticks: {
                  color:
                    "#71818e"
                }

              }

            }

          }

        }
      );

  }


  updatePerformanceChart();

}


function updatePerformanceChart() {

  if (!performanceChart) {
    return;
  }


  const events =
    state.game.events
      .filter(
        event =>
          event.team === "home" &&
          event.points
      );


  const periodValues =
    [0, 0, 0, 0];


  events.forEach(event => {

    const period =
      Number(
        event.period
      ) || 1;


    if (
      period >= 1 &&
      period <= 4
    ) {

      periodValues[
        period - 1
      ] +=
        Number(
          event.points
        );

    }

  });


  performanceChart.data.labels =
    state.mode === "3x3"
      ? [
          "초반",
          "중반",
          "후반"
        ]
      : [
          "1Q",
          "2Q",
          "3Q",
          "4Q"
        ];


  performanceChart.data.datasets[0]
    .data =
      state.mode === "3x3"
        ? [
            periodValues[0] * 0.4,
            periodValues[0] * 0.8,
            periodValues[0]
          ]
        : periodValues;


  performanceChart.update();

}


function createTeamRadar(data) {

  if (
    typeof Chart ===
    "undefined"
  ) {
    return;
  }


  const canvas =
    $("#teamRadarChart");

  if (!canvas) {
    return;
  }


  if (teamRadarChart) {
    teamRadarChart.destroy();
  }


  teamRadarChart =
    new Chart(
      canvas,
      {

        type: "radar",

        data: {

          labels: [
            "공격",
            "슈팅",
            "패싱",
            "리바운드",
            "수비",
            "볼컨트롤"
          ],

          datasets: [

            {
              label: "TEAM",

              data: [
                data.offense,
                data.shooting,
                data.passing,
                data.rebounding,
                data.defense,
                data.ballControl
              ],

              borderWidth: 2,

              fill: true

            }

          ]

        },

        options: {

          responsive: true,

          maintainAspectRatio: false,

          scales: {

            r: {

              beginAtZero: true,

              max: 100,

              ticks: {
                display: false
              },

              grid: {
                color:
                  "rgba(255,255,255,0.08)"
              },

              angleLines: {
                color:
                  "rgba(255,255,255,0.08)"
              },

              pointLabels: {
                color:
                  "#b9c5cf",

                font: {
                  size: 9
                }
              }

            }

          },

          plugins: {

            legend: {
              display: false
            }

          }

        }

      }
    );

}


function createPlayerRadar(
  player
) {

  if (
    typeof Chart ===
    "undefined"
  ) {
    return;
  }


  const canvas =
    $("#playerRadarChart");

  if (!canvas) {
    return;
  }


  if (playerRadarChart) {
    playerRadarChart.destroy();
  }


  const stats =
    player.stats || {};


  playerRadarChart =
    new Chart(
      canvas,
      {

        type: "radar",

        data: {

          labels: [
            "득점",
            "슈팅",
            "리바운드",
            "어시스트",
            "수비",
            "볼관리"
          ],

          datasets: [

            {
              label:
                player.name,

              data: [

                normalizeScore(
                  stats.points || 0,
                  30
                ),

                normalizeScore(
                  stats.fgMade || 0,
                  15
                ),

                normalizeScore(
                  stats.reb || 0,
                  15
                ),

                normalizeScore(
                  stats.ast || 0,
                  12
                ),

                normalizeScore(
                  (
                    stats.stl || 0
                  ) +
                  (
                    stats.blk || 0
                  ),
                  8
                ),

                normalizeScore(
                  Math.max(
                    0,
                    10 -
                    (
                      stats.to || 0
                    )
                  ),
                  10
                )

              ],

              borderWidth: 2,

              fill: true

            }

          ]

        },

        options: {

          responsive: true,

          maintainAspectRatio: false,

          scales: {

            r: {

              beginAtZero: true,

              max: 100,

              ticks: {
                display: false
              },

              pointLabels: {
                color:
                  "#b9c5cf",

                font: {
                  size: 9
                }
              }

            }

          },

          plugins: {

            legend: {
              display: false
            }

          }

        }

      }
    );

}


/* =========================================================
   27. KEYBOARD SHORTCUTS
========================================================= */

function bindKeyboardShortcuts() {

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.target.matches(
          "input, textarea, select"
        )
      ) {
        return;
      }


      /*
        Space:
        경기 시작 / 일시정지
      */

      if (
        event.code === "Space"
      ) {

        event.preventDefault();

        toggleGame();

      }


      /*
        R:
        샷클락 리셋
      */

      if (
        event.key.toLowerCase() ===
        "r"
      ) {

        state.game.shotClock =
          state.settings.shotClock;

        updateClock();

      }


      /*
        ESC:
        모달 닫기
      */

      if (
        event.key === "Escape"
      ) {

        $$(".modal.active")
          .forEach(
            modal =>
              modal.classList.remove(
                "active"
              )
          );

      }

    }
  );

}


/* =========================================================
   28. MODALS
========================================================= */

function bindModalControls() {

  $$("[data-close-modal]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          closeModal(
            button.dataset.closeModal
          );

        }
      );

    });


  $$(".modal")
    .forEach(modal => {

      modal.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            modal
          ) {

            modal.classList.remove(
              "active"
            );

          }

        }
      );

    });

}


function openModal(id) {

  $(`#${id}`)
    ?.classList.add(
      "active"
    );

}


function closeModal(id) {

  $(`#${id}`)
    ?.classList.remove(
      "active"
    );

}


/* =========================================================
   29. THEME
========================================================= */

function toggleTheme() {

  document.body
    .classList.toggle(
      "light-mode"
    );


  const light =
    document.body
      .classList.contains(
        "light-mode"
      );


  localStorage.setItem(
    "courtv-theme",
    light
      ? "light"
      : "dark"
  );

}


function loadTheme() {

  const theme =
    localStorage.getItem(
      "courtv-theme"
    );


  if (theme === "light") {

    document.body
      .classList.add(
        "light-mode"
      );

  }

}


loadTheme();


/* =========================================================
   30. FULLSCREEN
========================================================= */

async function toggleFullscreen() {

  try {

    if (
      !document.fullscreenElement
    ) {

      await document.documentElement
        .requestFullscreen();

    } else {

      await document.exitFullscreen();

    }

  } catch (error) {

    console.error(error);

  }

}


/* =========================================================
   31. MASTER UPDATE
========================================================= */

function updateAll() {

  updateClock();

  updateDashboard();

  updateLiveAnalysis();

  renderLiveEvents();

  renderShotMarkers();

  updateShotStats();

  renderRecentGames();

  renderGames();

  renderPlayers();

  populatePlayerSelect();

  renderLeague();

  updateGameReport();

  updateTeamAnalysis();

  updatePerformanceChart();

}


/* =========================================================
   32. UTILITIES
========================================================= */

function clamp(
  value,
  min,
  max
) {

  return Math.min(
    Math.max(
      value,
      min
    ),
    max
  );

}


function normalizeScore(
  value,
  max
) {

  if (!max) {
    return 0;
  }


  return clamp(
    Math.round(
      value /
      max *
      100
    ),
    0,
    100
  );

}


function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   33. SEARCH LISTENERS
========================================================= */

$("#gameSearch")
  ?.addEventListener(
    "input",
    renderGames
  );


$("#recordModeFilter")
  ?.addEventListener(
    "change",
    renderGames
  );


$("#recordResultFilter")
  ?.addEventListener(
    "change",
    renderGames
  );


/* =========================================================
   34. PERFORMANCE PERIOD
========================================================= */

$("#performancePeriod")
  ?.addEventListener(
    "change",
    () => {

      updatePerformanceChart();

    }
  );


/* =========================================================
   35. REPORT EXPORT
========================================================= */

$("#generateReportBtn")
  ?.addEventListener(
    "click",
    () => {

      updateGameReport();

      toast(
        "경기 리포트를 생성했습니다.",
        "success"
      );

    }
  );


$("#exportPlayerReportBtn")
  ?.addEventListener(
    "click",
    () => {

      const player =
        state.players.find(
          p =>
            String(p.id) ===
            String(
              state.selectedReportPlayer
            )
        );


      if (!player) {

        toast(
          "선수를 먼저 선택해주세요.",
          "error"
        );

        return;

      }


      const report = {

        player: player.name,

        number: player.number,

        position:
          player.position,

        stats:
          player.stats,

        generatedAt:
          new Date().toISOString()

      };


      const blob =
        new Blob(
          [
            JSON.stringify(
              report,
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
        `${player.name}-player-report.json`;


      a.click();


      URL.revokeObjectURL(
        url
      );


      toast(
        "선수 리포트를 저장했습니다.",
        "success"
      );

    }
  );


/* =========================================================
   END
========================================================= */