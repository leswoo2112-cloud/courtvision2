/* =========================================================
   COURTVISION PRO
   app.js
   ---------------------------------------------------------
   3대3 / 5대5 농구 라이브 기록 시스템
   - 3대3 점수 규칙
     자유투 = 1
     2점슛 = 1
     3점슛 = 2
   - 5대5 점수 규칙
     자유투 = 1
     2점슛 = 2
     3점슛 = 3
========================================================= */

"use strict";

/* =========================================================
   01. 기본 상태
========================================================= */

const state = {

  mode: "3v3",

  game: {
    title: "농구 경기",
    location: "",
    date: "",
    competition: "",
    minutes: 10,
    shotClockMax: 14,
    targetScore: 21,
    periodType: "single",
    period: 1,
    clockSeconds: 600,
    shotClock: 14,
    running: false
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

  actions: [],

  shots: [],

  videoTags: [],

  savedGames: [],

  league: {
    teams: [],
    schedules: [],
    results: []
  }

};


/* =========================================================
   02. 초기 선수
========================================================= */

function createDefaultPlayers() {

  state.teams.A.players = [
    createPlayer("A", 1, "선수 A1", true),
    createPlayer("A", 2, "선수 A2", true),
    createPlayer("A", 3, "선수 A3", true)
  ];

  state.teams.B.players = [
    createPlayer("B", 1, "선수 B1", true),
    createPlayer("B", 2, "선수 B2", true),
    createPlayer("B", 3, "선수 B3", true)
  ];

}


/* =========================================================
   03. 선수 생성
========================================================= */

function createPlayer(
  team,
  number,
  name,
  onCourt = false
) {

  return {

    id:
      `${team}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    team,

    number,

    name,

    onCourt,

    stats: {

      min: 0,

      pts: 0,

      reb: 0,

      ast: 0,

      stl: 0,

      blk: 0,

      to: 0,

      pf: 0,

      fg: 0,

      fga: 0,

      ft: 0,

      fta: 0,

      fg2: 0,

      fga2: 0,

      fg3: 0,

      fga3: 0,

      off: 0,

      def: 0,

      plusMinus: 0

    },

    secondsPlayed: 0

  };

}


/* =========================================================
   04. DOM 준비
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    createDefaultPlayers();

    bindEvents();

    loadSetupValues();

    renderAll();

    startInternalClock();

  }
);


/* =========================================================
   05. 이벤트 연결
========================================================= */

function bindEvents() {

  /* 모드 */

  document
    .getElementById("mode3v3Btn")
    ?.addEventListener(
      "click",
      () => setMode("3v3")
    );


  document
    .getElementById("mode5v5Btn")
    ?.addEventListener(
      "click",
      () => setMode("5v5")
    );


  /* 설정 */

  document
    .getElementById("toggleSetupBtn")
    ?.addEventListener(
      "click",
      toggleSetup
    );


  document
    .getElementById("closeSetupBtn")
    ?.addEventListener(
      "click",
      closeSetup
    );


  document
    .getElementById("saveSetupBtn")
    ?.addEventListener(
      "click",
      saveSetup
    );


  document
    .getElementById("addTeamAPlayerBtn")
    ?.addEventListener(
      "click",
      () => addPlayer("A")
    );


  document
    .getElementById("addTeamBPlayerBtn")
    ?.addEventListener(
      "click",
      () => addPlayer("B")
    );


  /* 라이브 액션 */

  document
    .querySelectorAll(
      ".stat-btn[data-action]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const action =
              button.dataset.action;

            handlePlayerAction(
              action
            );

          }
        );

      }
    );


  /* 시계 */

  document
    .getElementById("startClockBtn")
    ?.addEventListener(
      "click",
      startClock
    );


  document
    .getElementById("pauseClockBtn")
    ?.addEventListener(
      "click",
      pauseClock
    );


  document
    .getElementById("resetShotClockBtn")
    ?.addEventListener(
      "click",
      resetShotClock
    );


  /* 빠른 기능 */

  document
    .getElementById("undoLastActionBtn")
    ?.addEventListener(
      "click",
      undoLastAction
    );


  document
    .getElementById("nextPeriodBtn")
    ?.addEventListener(
      "click",
      nextPeriod
    );


  document
    .getElementById("teamATimeoutBtn")
    ?.addEventListener(
      "click",
      () => useTimeout("A")
    );


  document
    .getElementById("teamBTimeoutBtn")
    ?.addEventListener(
      "click",
      () => useTimeout("B")
    );


  document
    .getElementById("endGameBtn")
    ?.addEventListener(
      "click",
      endGame
    );


  document
    .getElementById("resetGameBtn")
    ?.addEventListener(
      "click",
      resetGame
    );


  document
    .getElementById("saveGameBtn")
    ?.addEventListener(
      "click",
      saveGame
    );


  document
    .getElementById("loadGameDataBtn")
    ?.addEventListener(
      "click",
      loadSavedGame
    );


  document
    .getElementById("clearRecentLogsBtn")
    ?.addEventListener(
      "click",
      clearRecentLogs
    );


  document
    .getElementById("clearRecentOnlyBtn")
    ?.addEventListener(
      "click",
      clearRecentLogs
    );


  /* 네비게이션 */

  document
    .querySelectorAll(
      ".nav-btn[data-tab]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openTab(
              button.dataset.tab
            );

          }
        );

      }
    );


  /* 기록 */

  document
    .getElementById("recordFilterTeam")
    ?.addEventListener(
      "change",
      renderRecords
    );


  document
    .getElementById("recordFilterPeriod")
    ?.addEventListener(
      "change",
      renderRecords
    );


  document
    .getElementById("playerDetailSelect")
    ?.addEventListener(
      "change",
      renderPlayerDetail
    );


  /* 슛차트 */

  document
    .getElementById("recordMadeShotBtn")
    ?.addEventListener(
      "click",
      () => setShotMode("made")
    );


  document
    .getElementById("recordMissShotBtn")
    ?.addEventListener(
      "click",
      () => setShotMode("miss")
    );


  document
    .getElementById("clearShotChartBtn")
    ?.addEventListener(
      "click",
      clearShots
    );


  document
    .getElementById("shotPlayerSelect")
    ?.addEventListener(
      "change",
      renderShotChart
    );


  document
    .getElementById("shotViewMode")
    ?.addEventListener(
      "change",
      renderShotChart
    );


  document
    .getElementById("shotPeriodFilter")
    ?.addEventListener(
      "change",
      renderShotChart
    );


  /* 영상 */

  bindVideoEvents();


  /* 리포트 */

  document
    .getElementById("generateGameReportBtn")
    ?.addEventListener(
      "click",
      generateGameReport
    );


  document
    .getElementById("generatePlayerReportBtn")
    ?.addEventListener(
      "click",
      generatePlayerReport
    );


  document
    .getElementById("generateTrainingBtn")
    ?.addEventListener(
      "click",
      generateTraining
    );


  document
    .getElementById("printReportBtn")
    ?.addEventListener(
      "click",
      () => window.print()
    );


  /* 리그 */

  bindLeagueEvents();

}


/* =========================================================
   06. 모드 변경
========================================================= */

function setMode(mode) {

  state.mode = mode;

  const is3v3 =
    mode === "3v3";


  const btn3 =
    document.getElementById(
      "mode3v3Btn"
    );

  const btn5 =
    document.getElementById(
      "mode5v5Btn"
    );


  btn3?.classList.toggle(
    "active",
    is3v3
  );

  btn5?.classList.toggle(
    "active",
    !is3v3
  );


  updateModeButtonLabels();

  updateModeLabel();

  renderOnCourt();

  renderAll();

}


/* =========================================================
   07. 3대3 / 5대5 버튼 표시
========================================================= */

function updateModeButtonLabels() {

  const points1 =
    document.querySelector(
      '[data-action="points1"]'
    );

  const points2 =
    document.querySelector(
      '[data-action="points2"]'
    );

  const points3 =
    document.querySelector(
      '[data-action="points3"]'
    );


  if (!points1) return;


  if (
    state.mode === "3v3"
  ) {

    points1.querySelector(
      "strong"
    ).textContent = "+1";

    points1.querySelector(
      "span"
    ).textContent =
      "자유투 성공";


    points2.querySelector(
      "strong"
    ).textContent = "+1";

    points2.querySelector(
      "span"
    ).textContent =
      "1점 성공";


    points3.querySelector(
      "strong"
    ).textContent = "+2";

    points3.querySelector(
      "span"
    ).textContent =
      "2점 성공";

  }

  else {

    points1.querySelector(
      "strong"
    ).textContent = "+1";

    points1.querySelector(
      "span"
    ).textContent =
      "자유투 성공";


    points2.querySelector(
      "strong"
    ).textContent = "+2";

    points2.querySelector(
      "span"
    ).textContent =
      "2점 성공";


    points3.querySelector(
      "strong"
    ).textContent = "+3";

    points3.querySelector(
      "span"
    ).textContent =
      "3점 성공";

  }

}


/* =========================================================
   08. 설정
========================================================= */

function toggleSetup() {

  document
    .getElementById(
      "setupPanel"
    )
    ?.classList.toggle(
      "open"
    );

}


function closeSetup() {

  document
    .getElementById(
      "setupPanel"
    )
    ?.classList.remove(
      "open"
    );

}


function saveSetup() {

  state.game.title =
    value("gameTitle")
    || "농구 경기";


  state.game.location =
    value("gameLocation");


  state.game.date =
    value("gameDate");


  state.game.competition =
    value("competitionName");


  state.game.minutes =
    numberValue(
      "gameMinutes",
      10
    );


  state.game.shotClockMax =
    numberValue(
      "shotClockSeconds",
      14
    );


  state.game.targetScore =
    numberValue(
      "targetScore",
      21
    );


  state.game.periodType =
    value("periodType")
    || "single";


  state.game.clockSeconds =
    state.game.minutes * 60;


  state.game.shotClock =
    state.game.shotClockMax;


  state.teams.A.name =
    value("teamAName")
    || "설천고 A";


  state.teams.B.name =
    value("teamBName")
    || "설천고 B";


  readPlayersFromSetup(
    "A"
  );

  readPlayersFromSetup(
    "B"
  );


  closeSetup();

  renderAll();

}


/* =========================================================
   09. 설정값 불러오기
========================================================= */

function loadSetupValues() {

  setValue(
    "gameDate",
    new Date()
      .toISOString()
      .slice(0, 10)
  );


  setValue(
    "gameTitle",
    state.game.title
  );


  setValue(
    "teamAName",
    state.teams.A.name
  );


  setValue(
    "teamBName",
    state.teams.B.name
  );


  setValue(
    "gameMinutes",
    state.game.minutes
  );


  setValue(
    "shotClockSeconds",
    state.game.shotClockMax
  );


  setValue(
    "targetScore",
    state.game.targetScore
  );

}


/* =========================================================
   10. 선수 추가
========================================================= */

function addPlayer(team) {

  const players =
    state.teams[team].players;


  const nextNumber =
    players.length
      ? Math.max(
          ...players.map(
            player =>
              Number(
                player.number
              ) || 0
          )
        ) + 1
      : 1;


  players.push(
    createPlayer(
      team,
      nextNumber,
      `${team}팀 선수 ${nextNumber}`,
      false
    )
  );


  renderSetupPlayers(
    team
  );


  renderOnCourt();

}


/* =========================================================
   11. 설정 선수 화면
========================================================= */

function renderSetupPlayers(
  team
) {

  const container =
    document.getElementById(
      `team${team}Players`
    );


  if (!container) return;


  container.innerHTML =
    state.teams[team]
      .players
      .map(
        player => `

          <div
            class="player-form-row"
            data-player-id="${player.id}"
          >

            <input
              type="number"
              value="${player.number}"
              data-player-number
            >

            <input
              type="text"
              value="${escapeHTML(
                player.name
              )}"
              data-player-name
            >

            <button
              type="button"
              data-oncourt-player
            >
              ${
                player.onCourt
                  ? "출전 중"
                  : "대기"
              }
            </button>

            <button
              type="button"
              data-remove-player
            >
              ×
            </button>

          </div>

        `
      )
      .join("");


  container
    .querySelectorAll(
      "[data-player-id]"
    )
    .forEach(
      row => {

        const id =
          row.dataset.playerId;


        row
          .querySelector(
            "[data-player-number]"
          )
          ?.addEventListener(
            "change",
            event => {

              const player =
                findPlayer(id);

              if (player) {

                player.number =
                  Number(
                    event.target.value
                  );

                renderOnCourt();

              }

            }
          );


        row
          .querySelector(
            "[data-player-name]"
          )
          ?.addEventListener(
            "change",
            event => {

              const player =
                findPlayer(id);

              if (player) {

                player.name =
                  event.target.value;

                renderOnCourt();

              }

            }
          );


        row
          .querySelector(
            "[data-oncourt-player]"
          )
          ?.addEventListener(
            "click",
            () => {

              toggleOnCourt(
                id
              );

            }
          );


        row
          .querySelector(
            "[data-remove-player]"
          )
          ?.addEventListener(
            "click",
            () => {

              removePlayer(
                id
              );

            }
          );

      }
    );

}


/* =========================================================
   12. 모든 선수 설정 렌더링
========================================================= */

function renderSetup() {

  renderSetupPlayers("A");

  renderSetupPlayers("B");

}


/* =========================================================
   13. 설정 화면에서 선수 읽기
========================================================= */

function readPlayersFromSetup(
  team
) {

  const container =
    document.getElementById(
      `team${team}Players`
    );


  if (!container) return;


  container
    .querySelectorAll(
      "[data-player-id]"
    )
    .forEach(
      row => {

        const player =
          findPlayer(
            row.dataset.playerId
          );


        if (!player) return;


        const numberInput =
          row.querySelector(
            "[data-player-number]"
          );


        const nameInput =
          row.querySelector(
            "[data-player-name]"
          );


        if (numberInput) {

          player.number =
            Number(
              numberInput.value
            ) || player.number;

        }


        if (nameInput) {

          player.name =
            nameInput.value.trim()
            || player.name;

        }

      }
    );

}


/* =========================================================
   14. 출전 토글
========================================================= */

function toggleOnCourt(
  playerId
) {

  const player =
    findPlayer(
      playerId
    );


  if (!player) return;


  const team =
    state.teams[
      player.team
    ];


  const maxPlayers =
    state.mode === "3v3"
      ? 3
      : 5;


  if (
    !player.onCourt &&
    team.players.filter(
      p => p.onCourt
    ).length >= maxPlayers
  ) {

    alert(
      `${state.mode === "3v3" ? "3대3" : "5대5"}에서는 최대 ${maxPlayers}명까지 출전할 수 있어용.`
    );

    return;

  }


  player.onCourt =
    !player.onCourt;


  renderSetup();

  renderOnCourt();

}


/* =========================================================
   15. 선수 삭제
========================================================= */

function removePlayer(
  playerId
) {

  const player =
    findPlayer(
      playerId
    );


  if (!player) return;


  const team =
    state.teams[
      player.team
    ];


  team.players =
    team.players.filter(
      p =>
        p.id !== playerId
    );


  if (
    state.selectedPlayerId ===
    playerId
  ) {

    state.selectedPlayerId =
      null;

  }


  renderSetup();

  renderOnCourt();

  renderRecords();

}


/* =========================================================
   16. 선수 선택
========================================================= */

function selectPlayer(
  playerId
) {

  state.selectedPlayerId =
    playerId;


  renderOnCourt();

  renderSelectedPlayer();

  renderRecentLogs();

}


/* =========================================================
   17. 현재 선수 찾기
========================================================= */

function getSelectedPlayer() {

  return findPlayer(
    state.selectedPlayerId
  );

}


/* =========================================================
   18. 선수 찾기
========================================================= */

function findPlayer(
  playerId
) {

  if (!playerId) return null;


  for (
    const teamKey of ["A", "B"]
  ) {

    const player =
      state.teams[
        teamKey
      ]
      .players
      .find(
        p =>
          p.id === playerId
      );


    if (player) return player;

  }


  return null;

}


/* =========================================================
   19. 라이브 선수 카드
========================================================= */

function renderOnCourt() {

  renderTeamOnCourt(
    "A"
  );

  renderTeamOnCourt(
    "B"
  );


  updateModeLabel();

}


/* =========================================================
   20. 팀 출전 선수
========================================================= */

function renderTeamOnCourt(
  team
) {

  const container =
    document.getElementById(
      `team${team}OnCourt`
    );


  if (!container) return;


  const players =
    state.teams[team]
      .players;


  container.innerHTML =
    players
      .map(
        player => `

          <button
            class="
              player-live-card
              ${
                team === "A"
                  ? "team-a-card"
                  : "team-b-card"
              }
              ${
                player.onCourt
                  ? ""
                  : "out"
              }
              ${
                player.id ===
                state.selectedPlayerId
                  ? "selected"
                  : ""
              }
            "
            data-live-player="${player.id}"
            type="button"
          >

            <span class="number">
              ${escapeHTML(
                player.number
              )}
            </span>

            <span class="name">
              ${escapeHTML(
                player.name
              )}
            </span>

            <span class="points">
              PTS ${player.stats.pts}
            </span>

          </button>

        `
      )
      .join("");


  container
    .querySelectorAll(
      "[data-live-player]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            selectPlayer(
              button.dataset.livePlayer
            );

          }
        );

      }
    );

}


/* =========================================================
   21. 선택 선수
========================================================= */

function renderSelectedPlayer() {

  const player =
    getSelectedPlayer();


  const name =
    document.getElementById(
      "selectedPlayerName"
    );


  const info =
    document.getElementById(
      "selectedPlayerLiveInfo"
    );


  const teamTag =
    document.getElementById(
      "selectedPlayerTeamTag"
    );


  if (!player) {

    if (name)
      name.textContent =
        "선수를 선택해주세용";


    if (info)
      info.textContent =
        "출전 시간 00:00 · +/- 0";


    if (teamTag)
      teamTag.textContent =
        "팀 선택 대기";


    return;

  }


  if (name) {

    name.textContent =
      `#${player.number} ${player.name}`;

  }


  if (info) {

    info.textContent =
      `출전 시간 ${formatSeconds(
        player.secondsPlayed
      )} · +/- ${player.stats.plusMinus}`;

  }


  if (teamTag) {

    teamTag.textContent =
      player.team === "A"
        ? "A TEAM"
        : "B TEAM";

  }

}


/* =========================================================
   22. 액션 처리
========================================================= */

function handlePlayerAction(
  action
) {

  const player =
    getSelectedPlayer();


  if (!player) {

    alert(
      "먼저 선수를 선택해주세용."
    );

    return;

  }


  switch (action) {

    case "points1":

      recordShotAction(
        player,
        "FT",
        true
      );

      break;


    case "points2":

      recordShotAction(
        player,
        "2PT",
        true
      );

      break;


    case "points3":

      recordShotAction(
        player,
        "3PT",
        true
      );

      break;


    case "miss":

      recordShotAction(
        player,
        "MISS",
        false
      );

      break;


    case "reb":

      addStat(
        player,
        "reb",
        1,
        "리바운드"
      );

      break;


    case "ast":

      addStat(
        player,
        "ast",
        1,
        "어시스트"
      );

      break;


    case "stl":

      addStat(
        player,
        "stl",
        1,
        "스틸"
      );

      break;


    case "blk":

      addStat(
        player,
        "blk",
        1,
        "블록"
      );

      break;


    case "to":

      addStat(
        player,
        "to",
        1,
        "턴오버"
      );

      break;


    case "pf":

      addFoul(
        player
      );

      break;


    case "subIn":

      player.onCourt =
        true;

      renderAll();

      break;


    case "subOut":

      player.onCourt =
        false;

      renderAll();

      break;

  }

}


/* =========================================================
   23. 슛 기록
========================================================= */

function recordShotAction(
  player,
  shotType,
  made
) {

  const oldState =
    cloneStateForUndo();


  let points =
    0;


  /* 자유투 */

  if (
    shotType === "FT"
  ) {

    player.stats.fta += 1;


    if (made) {

      player.stats.ft += 1;

      points = 1;

      player.stats.pts += 1;

    }

  }


  /* 2점 버튼 */

  else if (
    shotType === "2PT"
  ) {

    player.stats.fga += 1;

    player.stats.fga2 += 1;


    if (made) {

      player.stats.fg += 1;

      player.stats.fg2 += 1;


      points =
        state.mode === "3v3"
          ? 1
          : 2;


      player.stats.pts +=
        points;

    }

  }


  /* 3점 버튼 */

  else if (
    shotType === "3PT"
  ) {

    player.stats.fga += 1;

    player.stats.fga3 += 1;


    if (made) {

      player.stats.fg += 1;

      player.stats.fg3 += 1;


      points =
        state.mode === "3v3"
          ? 2
          : 3;


      player.stats.pts +=
        points;

    }

  }


  /* 일반 실패 */

  else {

    player.stats.fga += 1;

  }


  /* 팀 점수 */

  if (
    points > 0
  ) {

    addTeamScore(
      player.team,
      points
    );

  }


  /* +/- */

  if (
    points > 0
  ) {

    updatePlusMinus(
      player.team,
      points
    );

  }


  /* 액션 기록 */

  pushAction({

    type: "shot",

    playerId:
      player.id,

    shotType,

    made,

    points,

    team:
      player.team

  }, oldState);


  /* 슛차트 */

  state.shots.push({

    id:
      cryptoRandomId(),

    playerId:
      player.id,

    team:
      player.team,

    type:
      shotType,

    made,

    points,

    period:
      state.game.period,

    x:
      null,

    y:
      null,

    time:
      state.game.clockSeconds

  });


  renderAll();

}


/* =========================================================
   24. 일반 기록
========================================================= */

function addStat(
  player,
  stat,
  amount,
  label
) {

  const oldState =
    cloneStateForUndo();


  player.stats[stat] +=
    amount;


  pushAction({

    type: "stat",

    playerId:
      player.id,

    stat,

    amount,

    label,

    team:
      player.team

  }, oldState);


  renderAll();

}


/* =========================================================
   25. 파울
========================================================= */

function addFoul(
  player
) {

  const oldState =
    cloneStateForUndo();


  player.stats.pf += 1;


  state.teams[
    player.team
  ].fouls += 1;


  pushAction({

    type: "foul",

    playerId:
      player.id,

    team:
      player.team

  }, oldState);


  renderAll();

}


/* =========================================================
   26. 팀 점수
========================================================= */

function addTeamScore(
  team,
  points
) {

  state.teams[
    team
  ].score =
    getTeamScore(team)
    + points;

}


/* =========================================================
   27. 팀 점수 계산
========================================================= */

function getTeamScore(
  team
) {

  return state.teams[
    team
  ].players
    .reduce(
      (
        total,
        player
      ) =>
        total +
        player.stats.pts,
      0
    );

}


/* =========================================================
   28. +/- 처리
========================================================= */

function updatePlusMinus(
  scoringTeam,
  points
) {

  const otherTeam =
    scoringTeam === "A"
      ? "B"
      : "A";


  state.teams[
    scoringTeam
  ].players
    .filter(
      player =>
        player.onCourt
    )
    .forEach(
      player => {

        player.stats.plusMinus +=
          points;

      }
    );


  state.teams[
    otherTeam
  ].players
    .filter(
      player =>
        player.onCourt
    )
    .forEach(
      player => {

        player.stats.plusMinus -=
          points;

      }
    );

}


/* =========================================================
   29. 액션 저장
========================================================= */

function pushAction(
  action,
  oldState
) {

  state.actions.push({

    ...action,

    id:
      cryptoRandomId(),

    timestamp:
      Date.now(),

    oldState

  });

}


/* =========================================================
   30. Undo
========================================================= */

function undoLastAction() {

  const action =
    state.actions.pop();


  if (!action) {

    alert(
      "취소할 기록이 없습니다."
    );

    return;

  }


  restoreFromSnapshot(
    action.oldState
  );


  renderAll();

}


/* =========================================================
   31. 스냅샷
========================================================= */

function cloneStateForUndo() {

  return JSON.parse(
    JSON.stringify({
      teams:
        state.teams,

      shots:
        state.shots
    })
  );

}


function restoreFromSnapshot(
  snapshot
) {

  state.teams =
    snapshot.teams;

  state.shots =
    snapshot.shots;

}


/* =========================================================
   32. 타임아웃
========================================================= */

function useTimeout(
  team
) {

  if (
    state.teams[
      team
    ].timeouts <= 0
  ) {

    return;

  }


  state.teams[
    team
  ].timeouts -= 1;


  state.running =
    false;


  renderAll();

}


/* =========================================================
   33. 다음 구간
========================================================= */

function nextPeriod() {

  state.game.period += 1;

  state.game.clockSeconds =
    state.game.minutes * 60;

  resetShotClock();

  pauseClock();

  renderAll();

}


/* =========================================================
   34. 경기 종료
========================================================= */

function endGame() {

  pauseClock();


  const scoreA =
    getTeamScore("A");


  const scoreB =
    getTeamScore("B");


  let winner =
    "무승부";


  if (
    scoreA > scoreB
  ) {

    winner =
      state.teams.A.name;

  }

  else if (
    scoreB > scoreA
  ) {

    winner =
      state.teams.B.name;

  }


  alert(
    `경기 종료\n\n${state.teams.A.name} ${scoreA} : ${scoreB} ${state.teams.B.name}\n\n승리: ${winner}`
  );

}


/* =========================================================
   35. 경기 초기화
========================================================= */

function resetGame() {

  if (
    !confirm(
      "현재 경기 기록을 초기화할까요?"
    )
  ) {

    return;

  }


  state.teams.A.fouls = 0;
  state.teams.B.fouls = 0;

  state.teams.A.timeouts = 1;
  state.teams.B.timeouts = 1;


  [
    "A",
    "B"
  ].forEach(
    team => {

      state.teams[
        team
      ].players
        .forEach(
          player => {

            player.stats = {

              min: 0,
              pts: 0,
              reb: 0,
              ast: 0,
              stl: 0,
              blk: 0,
              to: 0,
              pf: 0,
              fg: 0,
              fga: 0,
              ft: 0,
              fta: 0,
              fg2: 0,
              fga2: 0,
              fg3: 0,
              fga3: 0,
              off: 0,
              def: 0,
              plusMinus: 0

            };


            player.secondsPlayed =
              0;

          }
        );

    }
  );


  state.actions = [];

  state.shots = [];


  state.game.period = 1;

  state.game.clockSeconds =
    state.game.minutes * 60;

  state.game.shotClock =
    state.game.shotClockMax;


  renderAll();

}


/* =========================================================
   36. 게임 시계
========================================================= */

let internalTimer =
  null;


function startInternalClock() {

  if (internalTimer)
    clearInterval(
      internalTimer
    );


  internalTimer =
    setInterval(
      () => {

        if (
          !state.game.running
        ) {

          return;

        }


        if (
          state.game.clockSeconds >
          0
        ) {

          state.game.clockSeconds -=
            1;

        }


        if (
          state.game.shotClock >
          0
        ) {

          state.game.shotClock -=
            1;

        }


        updatePlayingTime();

        renderClock();

      },
      1000
    );

}


function startClock() {

  state.game.running =
    true;

  renderClock();

}


function pauseClock() {

  state.game.running =
    false;

  renderClock();

}


function resetShotClock() {

  state.game.shotClock =
    state.game.shotClockMax;

  renderClock();

}


/* =========================================================
   37. 출전시간
========================================================= */

function updatePlayingTime() {

  if (
    !state.game.running
  ) {

    return;

  }


  [
    "A",
    "B"
  ].forEach(
    team => {

      state.teams[
        team
      ].players
        .filter(
          player =>
            player.onCourt
        )
        .forEach(
          player => {

            player.secondsPlayed +=
              1;

          }
        );

    }
  );

}


/* =========================================================
   38. 시계 표시
========================================================= */

function renderClock() {

  const gameClock =
    document.getElementById(
      "gameClock"
    );


  const shotClock =
    document.getElementById(
      "shotClock"
    );


  const quarter =
    document.getElementById(
      "quarterLabel"
    );


  if (gameClock) {

    gameClock.textContent =
      formatClock(
        state.game.clockSeconds
      );

  }


  if (shotClock) {

    shotClock.textContent =
      state.game.shotClock;

  }


  if (quarter) {

    quarter.textContent =
      `${state.game.period}Q`;

  }

}


/* =========================================================
   39. 전체 렌더
========================================================= */

function renderAll() {

  renderSetup();

  renderLiveInfo();

  renderScores();

  renderClock();

  renderOnCourt();

  renderSelectedPlayer();

  renderRecentLogs();

  renderMVP();

  renderLeaders();

  renderComparison();

  renderRecords();

  renderPlayerSelectors();

  renderShotChart();

  renderShotSummary();

  renderZoneAnalysis();

  renderShotTrend();

  renderVideoTags();

  renderAnalysis();

  renderReports();

  renderLeague();

}


/* =========================================================
   40. 라이브 정보
========================================================= */

function renderLiveInfo() {

  setText(
    "liveGameTitle",
    state.game.title
  );

  setText(
    "liveGameLocation",
    state.game.location ||
      "미입력"
  );

  setText(
    "liveGameDate",
    state.game.date ||
      "미입력"
  );

  setText(
    "liveGameMode",
    state.mode === "3v3"
      ? "3대3"
      : "5대5"
  );


  setText(
    "teamANameDisplay",
    state.teams.A.name
  );

  setText(
    "teamBNameDisplay",
    state.teams.B.name
  );

  setText(
    "scoreboardTeamA",
    state.teams.A.name
  );

  setText(
    "scoreboardTeamB",
    state.teams.B.name
  );


  setText(
    "teamAPlayerCount",
    `선수 ${state.teams.A.players.length}명`
  );

  setText(
    "teamBPlayerCount",
    `선수 ${state.teams.B.players.length}명`
  );

}


/* =========================================================
   41. 점수 표시
========================================================= */

function renderScores() {

  const scoreA =
    getTeamScore("A");


  const scoreB =
    getTeamScore("B");


  [
    [
      "teamAScore",
      scoreA
    ],
    [
      "scoreboardAValue",
      scoreA
    ],
    [
      "teamBScore",
      scoreB
    ],
    [
      "scoreboardBValue",
      scoreB
    ],
    [
      "teamAFouls",
      state.teams.A.fouls
    ],
    [
      "scoreboardAFouls",
      state.teams.A.fouls
    ],
    [
      "teamBFouls",
      state.teams.B.fouls
    ],
    [
      "scoreboardBFouls",
      state.teams.B.fouls
    ],
    [
      "teamATimeouts",
      state.teams.A.timeouts
    ],
    [
      "scoreboardATimeouts",
      state.teams.A.timeouts
    ],
    [
      "teamBTimeouts",
      state.teams.B.timeouts
    ],
    [
      "scoreboardBTimeouts",
      state.teams.B.timeouts
    ]

  ].forEach(
    ([id, value]) =>
      setText(
        id,
        value
      )
  );

}


/* =========================================================
   42. 모드 표시
========================================================= */

function updateModeLabel() {

  setText(
    "liveModeLabel",
    state.mode === "3v3"
      ? "3대3 모드"
      : "5대5 모드"
  );

}


/* =========================================================
   43. 최근 기록
========================================================= */

function renderRecentLogs() {

  const container =
    document.getElementById(
      "recentLogList"
    );


  if (!container)
    return;


  if (
    state.actions.length === 0
  ) {

    container.innerHTML = `
      <div class="empty-message">
        아직 기록이 없습니다.
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.actions
      .slice(-30)
      .reverse()
      .map(
        action => {

          const player =
            findPlayer(
              action.playerId
            );


          return `

            <div class="recent-log-row">

              <time>
                ${new Date(
                  action.timestamp
                ).toLocaleTimeString(
                  "ko-KR",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  }
                )}
              </time>

              <strong>
                ${
                  player
                    ? `#${player.number} ${escapeHTML(player.name)}`
                    : "-"
                }
              </strong>

              <span>
                ${getActionLabel(
                  action
                )}
              </span>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   44. 액션 라벨
========================================================= */

function getActionLabel(
  action
) {

  if (
    action.type === "shot"
  ) {

    if (
      action.made
    ) {

      return `+${action.points}`;

    }

    return "슛 실패";

  }


  return (
    action.label ||
    action.type ||
    ""
  );

}


/* =========================================================
   45. MVP
========================================================= */

function renderMVP() {

  const players =
    getAllPlayers();


  if (
    players.length === 0
  )
    return;


  const ranked =
    players
      .map(
        player => ({

          player,

          score:
            player.stats.pts +
            player.stats.reb * 1.2 +
            player.stats.ast * 1.5 +
            player.stats.stl * 2 +
            player.stats.blk * 2 -
            player.stats.to * 1.5

        })
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );


  const top =
    ranked[0];


  if (!top) return;


  const player =
    top.player;


  const card =
    document.getElementById(
      "mvpCard"
    );


  if (!card) return;


  card.innerHTML = `

    <div class="mvp-icon">
      🏀
    </div>

    <div class="mvp-info">

      <div class="mvp-team">
        ${
          player.team === "A"
            ? "TEAM A"
            : "TEAM B"
        }
      </div>

      <div class="mvp-name">
        #${player.number}
        ${escapeHTML(
          player.name
        )}
      </div>

      <div class="mvp-stats">
        PTS ${player.stats.pts}
        · REB ${player.stats.reb}
        · AST ${player.stats.ast}
      </div>

    </div>

    <div class="mvp-score">
      ${top.score.toFixed(1)}
    </div>

  `;

}


/* =========================================================
   46. 리더
========================================================= */

function renderLeaders() {

  const container =
    document.getElementById(
      "liveLeaderCards"
    );


  if (!container)
    return;


  const players =
    getAllPlayers();


  if (
    players.every(
      p =>
        p.stats.pts === 0 &&
        p.stats.reb === 0 &&
        p.stats.ast === 0 &&
        p.stats.stl === 0 &&
        p.stats.blk === 0
    )
  ) {

    container.innerHTML = `
      <div class="empty-message">
        아직 기록이 없습니다.
      </div>
    `;

    return;

  }


  const categories = [

    [
      "득점",
      "pts"
    ],

    [
      "리바운드",
      "reb"
    ],

    [
      "어시스트",
      "ast"
    ],

    [
      "스틸",
      "stl"
    ],

    [
      "블록",
      "blk"
    ]

  ];


  container.innerHTML =
    categories
      .map(
        ([label, key]) => {

          const top =
            [...players]
              .sort(
                (
                  a,
                  b
                ) =>
                  b.stats[key] -
                  a.stats[key]
              )[0];


          return `

            <div class="live-leader-card">

              <span>
                ${label}
              </span>

              <strong>
                ${
                  top
                    ? `#${top.number} ${escapeHTML(top.name)}`
                    : "-"
                }
              </strong>

              <b>
                ${
                  top
                    ? top.stats[key]
                    : 0
                }
              </b>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   47. 팀 비교
========================================================= */

function renderComparison() {

  const stats = [

    [
      "Pts",
      "pts"
    ],

    [
      "Reb",
      "reb"
    ],

    [
      "Ast",
      "ast"
    ],

    [
      "Stl",
      "stl"
    ],

    [
      "Blk",
      "blk"
    ],

    [
      "To",
      "to"
    ]

  ];


  stats.forEach(
    ([label, key]) => {

      const a =
        teamStat(
          "A",
          key
        );


      const b =
        teamStat(
          "B",
          key
        );


      setText(
        `compare${capitalize(label)}A`,
        a
      );

      setText(
        `compare${capitalize(label)}B`,
        b
      );


      const total =
        a + b;


      const aWidth =
        total
          ? (a / total) * 100
          : 50;


      const bWidth =
        total
          ? (b / total) * 100
          : 50;


      const barA =
        document.getElementById(
          `compareBar${capitalize(label)}A`
        );


      const barB =
        document.getElementById(
          `compareBar${capitalize(label)}B`
        );


      if (barA)
        barA.style.width =
          `${aWidth}%`;


      if (barB)
        barB.style.width =
          `${bWidth}%`;

    }
  );

}


/* =========================================================
   48. 기록 페이지
========================================================= */

function renderRecords() {

  const body =
    document.getElementById(
      "statsTableBody"
    );


  if (!body)
    return;


  const teamFilter =
    value(
      "recordFilterTeam"
    ) || "all";


  let players =
    getAllPlayers();


  if (
    teamFilter !== "all"
  ) {

    players =
      players.filter(
        p =>
          p.team ===
          teamFilter
      );

  }


  if (
    players.length === 0
  ) {

    body.innerHTML = `
      <tr>
        <td
          colspan="16"
          class="empty-cell"
        >
          아직 기록이 없습니다.
        </td>
      </tr>
    `;

    return;

  }


  body.innerHTML =
    players
      .map(
        player => {

          const s =
            player.stats;


          const fgPct =
            s.fga
              ? (
                  s.fg /
                  s.fga *
                  100
                ).toFixed(1)
              : "0.0";


          return `

            <tr>

              <td>
                ${
                  player.team === "A"
                    ? "A"
                    : "B"
                }
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
                ${formatSeconds(
                  player.secondsPlayed
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
                ${s.fg}/${s.fga}
              </td>

              <td>
                ${fgPct}%
              </td>

              <td>
                ${s.plusMinus}
              </td>

              <td>
                ${s.off}
              </td>

              <td>
                ${s.def}
              </td>

            </tr>

          `;

        }
      )
      .join("");


  renderTeamSummary();

}


/* =========================================================
   49. 선수 선택 목록
========================================================= */

function renderPlayerSelectors() {

  const selects = [

    "playerDetailSelect",
    "shotPlayerSelect",
    "videoPlayerSelect",
    "reportPlayerSelect"

  ];


  const players =
    getAllPlayers();


  selects.forEach(
    id => {

      const select =
        document.getElementById(
          id
        );


      if (!select)
        return;


      const previous =
        select.value;


      let first =
        "선수를 선택해주세용";


      if (
        id === "reportPlayerSelect"
      ) {

        first =
          "개인 리포트 선수 선택";

      }


      select.innerHTML =
        `<option value="">
          ${first}
        </option>`;


      players.forEach(
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


      if (
        previous &&
        players.some(
          p =>
            p.id === previous
        )
      ) {

        select.value =
          previous;

      }

    }
  );

}


/* =========================================================
   50. 선수 상세
========================================================= */

function renderPlayerDetail() {

  const id =
    value(
      "playerDetailSelect"
    );


  const container =
    document.getElementById(
      "playerDetailCard"
    );


  if (!container)
    return;


  const player =
    findPlayer(id);


  if (!player) {

    container.innerHTML = `
      <div class="empty-message">
        선수를 선택하면 상세 기록이 표시돼용.
      </div>
    `;

    return;

  }


  const s =
    player.stats;


  const items = [

    [
      "PTS",
      s.pts
    ],

    [
      "REB",
      s.reb
    ],

    [
      "AST",
      s.ast
    ],

    [
      "STL",
      s.stl
    ],

    [
      "BLK",
      s.blk
    ],

    [
      "TO",
      s.to
    ],

    [
      "FG%",
      s.fga
        ? `${(
            s.fg /
            s.fga *
            100
          ).toFixed(1)}%`
        : "0.0%"
    ],

    [
      "+/-",
      s.plusMinus
    ]

  ];


  container.innerHTML = `

    <div class="player-detail-grid">

      ${
        items
          .map(
            ([label, value]) => `

              <div class="player-detail-stat">

                <span>
                  ${label}
                </span>

                <strong>
                  ${value}
                </strong>

              </div>

            `
          )
          .join("")
      }

    </div>

  `;

}


/* =========================================================
   51. 팀 요약
========================================================= */

function renderTeamSummary() {

  const container =
    document.getElementById(
      "teamSummaryCards"
    );


  if (!container)
    return;


  container.innerHTML =
    ["A", "B"]
      .map(
        team => `

          <div class="summary-stat-card">

            <span>
              ${state.teams[team].name}
            </span>

            <strong>
              ${getTeamScore(team)}
            </strong>

          </div>

        `
      )
      .join("");

}


/* =========================================================
   52. 슛차트 모드
========================================================= */

let shotRecordMode =
  null;


function setShotMode(
  mode
) {

  shotRecordMode =
    mode;


  alert(
    mode === "made"
      ? "코트에서 성공 위치를 눌러주세용."
      : "코트에서 실패 위치를 눌러주세용."
  );


  const canvas =
    document.getElementById(
      "shotChartCanvas"
    );


  if (!canvas)
    return;


  canvas.onclick =
    event => {

      const playerId =
        value(
          "shotPlayerSelect"
        );


      if (!playerId) {

        alert(
          "먼저 선수를 선택해주세용."
        );

        return;

      }


      const rect =
        canvas.getBoundingClientRect();


      const x =
        (
          event.clientX -
          rect.left
        ) /
        rect.width;


      const y =
        (
          event.clientY -
          rect.top
        ) /
        rect.height;


      state.shots.push({

        id:
          cryptoRandomId(),

        playerId,

        team:
          findPlayer(
            playerId
          )?.team,

        type:
          shotRecordMode === "made"
            ? "SHOT"
            : "MISS",

        made:
          shotRecordMode ===
          "made",

        points:
          0,

        period:
          state.game.period,

        x,

        y,

        time:
          state.game.clockSeconds

      });


      renderShotChart();

      renderShotSummary();

      renderZoneAnalysis();

      renderShotTrend();

    };

}


/* =========================================================
   53. 슛차트 렌더
========================================================= */

function renderShotChart() {

  const canvas =
    document.getElementById(
      "shotChartCanvas"
    );


  if (!canvas)
    return;


  const ctx =
    canvas.getContext(
      "2d"
    );


  drawCourt(
    canvas,
    ctx
  );


  const playerId =
    value(
      "shotPlayerSelect"
    );


  const view =
    value(
      "shotViewMode"
    ) || "player";


  let shots =
    state.shots
      .filter(
        shot =>
          shot.x !== null &&
          shot.y !== null
      );


  if (
    view === "player" &&
    playerId
  ) {

    shots =
      shots.filter(
        shot =>
          shot.playerId ===
          playerId
      );

  }

  else if (
    view === "teamA"
  ) {

    shots =
      shots.filter(
        shot =>
          shot.team === "A"
      );

  }

  else if (
    view === "teamB"
  ) {

    shots =
      shots.filter(
        shot =>
          shot.team === "B"
      );

  }


  shots.forEach(
    shot => {

      const x =
        shot.x *
        canvas.width;


      const y =
        shot.y *
        canvas.height;


      ctx.beginPath();

      ctx.arc(
        x,
        y,
        8,
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

        ctx.lineWidth =
          2;

        ctx.beginPath();

        ctx.moveTo(
          x - 5,
          y - 5
        );

        ctx.lineTo(
          x + 5,
          y + 5
        );

        ctx.moveTo(
          x + 5,
          y - 5
        );

        ctx.lineTo(
          x - 5,
          y + 5
        );

        ctx.stroke();

      }

    }
  );

}


/* =========================================================
   54. 코트 그리기
========================================================= */

function drawCourt(
  canvas,
  ctx
) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  ctx.fillStyle =
    "#07121b";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  ctx.strokeStyle =
    "#71808c";

  ctx.lineWidth =
    3;


  const w =
    canvas.width;


  const h =
    canvas.height;


  ctx.strokeRect(
    20,
    20,
    w - 40,
    h - 40
  );


  ctx.beginPath();

  ctx.arc(
    w / 2,
    h / 2,
    75,
    0,
    Math.PI * 2
  );

  ctx.stroke();


  ctx.beginPath();

  ctx.moveTo(
    w / 2,
    20
  );

  ctx.lineTo(
    w / 2,
    h - 20
  );

  ctx.stroke();


  /* 페인트 */

  ctx.strokeRect(
    w * 0.32,
    20,
    w * 0.36,
    h * 0.29
  );


  /* 림 */

  ctx.beginPath();

  ctx.arc(
    w / 2,
    h * 0.16,
    12,
    0,
    Math.PI * 2
  );

  ctx.stroke();

}


/* =========================================================
   55. 미니 슛차트
========================================================= */

function renderMiniCourt() {

  const canvas =
    document.getElementById(
      "miniCourtCanvas"
    );


  if (!canvas)
    return;


  const ctx =
    canvas.getContext(
      "2d"
    );


  drawCourt(
    canvas,
    ctx
  );


  state.shots
    .filter(
      shot =>
        shot.x !== null &&
        shot.y !== null
    )
    .forEach(
      shot => {

        ctx.beginPath();

        ctx.arc(
          shot.x *
            canvas.width,
          shot.y *
            canvas.height,
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


/* =========================================================
   56. 슛 요약
========================================================= */

function renderShotSummary() {

  const container =
    document.getElementById(
      "shotSummaryCard"
    );


  if (!container)
    return;


  const playerId =
    value(
      "shotPlayerSelect"
    );


  let shots =
    state.shots;


  if (playerId) {

    shots =
      shots.filter(
        shot =>
          shot.playerId ===
          playerId
      );

  }


  const made =
    shots.filter(
      shot =>
        shot.made
    ).length;


  const attempted =
    shots.length;


  const pct =
    attempted
      ? (
          made /
          attempted *
          100
        ).toFixed(1)
      : "0.0";


  container.innerHTML = `

    <div class="shot-summary-stat">

      <span>
        성공
      </span>

      <strong>
        ${made}
      </strong>

    </div>

    <div class="shot-summary-stat">

      <span>
        시도
      </span>

      <strong>
        ${attempted}
      </strong>

    </div>

    <div class="shot-summary-stat">

      <span>
        성공률
      </span>

      <strong>
        ${pct}%
      </strong>

    </div>

  `;


  renderMiniCourt();

}


/* =========================================================
   57. 구역 분석
========================================================= */

function renderZoneAnalysis() {

  const container =
    document.getElementById(
      "zoneAnalysisCards"
    );


  if (!container)
    return;


  const zones = {

    left:
      {
        name: "좌측",
        shots: []
      },

    center:
      {
        name: "중앙",
        shots: []
      },

    right:
      {
        name: "우측",
        shots: []
      }

  };


  state.shots
    .filter(
      shot =>
        shot.x !== null
    )
    .forEach(
      shot => {

        if (
          shot.x < 0.35
        ) {

          zones.left.shots
            .push(shot);

        }

        else if (
          shot.x > 0.65
        ) {

          zones.right.shots
            .push(shot);

        }

        else {

          zones.center.shots
            .push(shot);

        }

      }
    );


  container.innerHTML =
    Object.values(
      zones
    )
      .map(
        zone => {

          const made =
            zone.shots
              .filter(
                s =>
                  s.made
              )
              .length;


          const total =
            zone.shots.length;


          const pct =
            total
              ? (
                  made /
                  total *
                  100
                ).toFixed(1)
              : "0.0";


          return `

            <div class="zone-card">

              <span>
                ${zone.name}
              </span>

              <strong>
                ${pct}%
              </strong>

              <small>
                ${made}/${total} 성공
              </small>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   58. 슛 트렌드
========================================================= */

function renderShotTrend() {

  const container =
    document.getElementById(
      "shotTrendList"
    );


  if (!container)
    return;


  if (
    state.shots.length === 0
  ) {

    container.innerHTML = `
      <div class="empty-message">
        슛 기록이 없습니다.
      </div>
    `;

    return;

  }


  const periods = {};


  state.shots.forEach(
    shot => {

      const p =
        shot.period || 1;


      if (!periods[p]) {

        periods[p] = {
          made: 0,
          total: 0
        };

      }


      periods[p].total += 1;


      if (
        shot.made
      ) {

        periods[p].made +=
          1;

      }

    }
  );


  container.innerHTML =
    Object.entries(
      periods
    )
      .map(
        ([period, data]) => {

          const pct =
            data.total
              ? (
                  data.made /
                  data.total *
                  100
                ).toFixed(1)
              : "0.0";


          return `

            <div class="shot-trend-row">

              <span>
                ${period}Q
              </span>

              <strong>
                ${data.made}/${data.total}
              </strong>

              <span>
                ${pct}%
              </span>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   59. 슛 초기화
========================================================= */

function clearShots() {

  if (
    !confirm(
      "슛차트를 초기화할까요?"
    )
  ) {

    return;

  }


  state.shots = [];

  renderShotChart();

  renderShotSummary();

  renderZoneAnalysis();

  renderShotTrend();

}


/* =========================================================
   60. 영상 기능
========================================================= */

function bindVideoEvents() {

  const fileInput =
    document.getElementById(
      "videoFileInput"
    );


  fileInput?.addEventListener(
    "change",
    event => {

      const file =
        event.target.files?.[0];


      if (!file)
        return;


      const video =
        document.getElementById(
          "analysisVideo"
        );


      if (!video)
        return;


      video.src =
        URL.createObjectURL(
          file
        );


      setText(
        "videoFileName",
        file.name
      );

    }
  );


  const video =
    document.getElementById(
      "analysisVideo"
    );


  document
    .getElementById(
      "playPauseBtn"
    )
    ?.addEventListener(
      "click",
      () => {

        if (
          video.paused
        ) {

          video.play();

        }

        else {

          video.pause();

        }

      }
    );


  const seek =
    seconds => {

      if (!video)
        return;


      video.currentTime =
        Math.max(
          0,
          Math.min(
            video.duration ||
              Infinity,
            video.currentTime +
              seconds
          )
        );

    };


  document
    .getElementById(
      "back10Btn"
    )
    ?.addEventListener(
      "click",
      () => seek(-10)
    );


  document
    .getElementById(
      "back5Btn"
    )
    ?.addEventListener(
      "click",
      () => seek(-5)
    );


  document
    .getElementById(
      "forward5Btn"
    )
    ?.addEventListener(
      "click",
      () => seek(5)
    );


  document
    .getElementById(
      "forward10Btn"
    )
    ?.addEventListener(
      "click",
      () => seek(10)
    );


  [
    ["speed05Btn", 0.5],
    ["speed10Btn", 1],
    ["speed15Btn", 1.5],
    ["speed20Btn", 2]
  ]
    .forEach(
      ([id, speed]) => {

        document
          .getElementById(id)
          ?.addEventListener(
            "click",
            () => {

              if (video) {

                video.playbackRate =
                  speed;

              }

            }
          );

      }
    );


  document
    .querySelectorAll(
      ".tag-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".tag-btn"
              )
              .forEach(
                b =>
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


  document
    .getElementById(
      "saveVideoTagBtn"
    )
    ?.addEventListener(
      "click",
      saveVideoTag
    );


  document
    .getElementById(
      "clearVideoTagsBtn"
    )
    ?.addEventListener(
      "click",
      () => {

        state.videoTags = [];

        renderVideoTags();

      }
    );

}


function saveVideoTag() {

  const video =
    document.getElementById(
      "analysisVideo"
    );


  const selectedTag =
    document.querySelector(
      ".tag-btn.selected"
    );


  state.videoTags.push({

    id:
      cryptoRandomId(),

    time:
      video?.currentTime || 0,

    playerId:
      value(
        "videoPlayerSelect"
      ),

    team:
      value(
        "videoTeamSelect"
      ),

    tag:
      selectedTag?.dataset.tag ||
      "일반 장면",

    memo:
      value(
        "videoTagMemo"
      ),

    createdAt:
      Date.now()

  });


  renderVideoTags();

}


function renderVideoTags() {

  const container =
    document.getElementById(
      "videoTagList"
    );


  if (!container)
    return;


  if (
    state.videoTags.length === 0
  ) {

    container.innerHTML = `
      <div class="empty-message">
        저장된 영상 태그가 없습니다.
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.videoTags
      .slice()
      .reverse()
      .map(
        tag => `

          <div class="video-tag-row">

            <strong>
              ${formatVideoTime(
                tag.time
              )}
            </strong>

            <div>

              <strong>
                ${escapeHTML(
                  tag.tag
                )}
              </strong>

              <p>
                ${escapeHTML(
                  tag.memo ||
                  ""
                )}
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


  container
    .querySelectorAll(
      "[data-delete-video-tag]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            state.videoTags =
              state.videoTags.filter(
                tag =>
                  tag.id !==
                  button.dataset
                    .deleteVideoTag
              );

            renderVideoTags();

          }
        );

      }
    );

}


/* =========================================================
   61. 전력분석
========================================================= */

function renderAnalysis() {

  renderRanking(
    "plusMinusRanking",
    "plusMinus"
  );


  renderRanking(
    "offenseRanking",
    "offense"
  );


  renderRanking(
    "defenseRanking",
    "defense"
  );


  const style =
    document.getElementById(
      "teamStyleAnalysis"
    );


  if (!style)
    return;


  style.innerHTML =
    ["A", "B"]
      .map(
        team => {

          const s =
            state.teams[
              team
            ].players.reduce(
              (
                total,
                player
              ) => {

                total.pts +=
                  player.stats.pts;

                total.ast +=
                  player.stats.ast;

                total.reb +=
                  player.stats.reb;

                return total;

              },
              {
                pts: 0,
                ast: 0,
                reb: 0
              }
            );


          return `

            <div class="team-style-card">

              <h4>
                ${escapeHTML(
                  state.teams[team].name
                )}
              </h4>

              <p>
                득점 ${s.pts} ·
                어시스트 ${s.ast} ·
                리바운드 ${s.reb}
              </p>

              <div class="style-meter">

                <div
                  style="width:${Math.min(
                    100,
                    s.pts * 4
                  )}%"
                ></div>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


function renderRanking(
  id,
  type
) {

  const container =
    document.getElementById(
      id
    );


  if (!container)
    return;


  const players =
    getAllPlayers();


  let ranked;


  if (
    type === "plusMinus"
  ) {

    ranked =
      [...players]
        .sort(
          (
            a,
            b
          ) =>
            b.stats.plusMinus -
            a.stats.plusMinus
        );

  }

  else if (
    type === "offense"
  ) {

    ranked =
      [...players]
        .sort(
          (
            a,
            b
          ) =>
            offensiveScore(b) -
            offensiveScore(a)
        );

  }

  else {

    ranked =
      [...players]
        .sort(
          (
            a,
            b
          ) =>
            defensiveScore(b) -
            defensiveScore(a)
        );

  }


  container.innerHTML =
    ranked
      .slice(0, 8)
      .map(
        (
          player,
          index
        ) => {

          const score =
            type === "plusMinus"
              ? player.stats.plusMinus
              : type === "offense"
                ? offensiveScore(
                    player
                  )
                : defensiveScore(
                    player
                  );


          return `

            <div class="ranking-row">

              <div class="rank-number">
                ${index + 1}
              </div>

              <div>

                <strong>
                  #${player.number}
                  ${escapeHTML(
                    player.name
                  )}
                </strong>

                <span>
                  ${
                    player.team === "A"
                      ? state.teams.A.name
                      : state.teams.B.name
                  }
                </span>

              </div>

              <b>
                ${score.toFixed
                  ? score.toFixed(1)
                  : score}
              </b>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   62. 리포트
========================================================= */

function renderReports() {

  /* 현재 데이터로 다시 만들지는 않고
     사용자가 버튼을 누를 때 생성 */

}


function generateGameReport() {

  const a =
    getTeamScore("A");


  const b =
    getTeamScore("B");


  const winner =
    a === b
      ? "무승부"
      : a > b
        ? state.teams.A.name
        : state.teams.B.name;


  const output =
    document.getElementById(
      "gameReportOutput"
    );


  if (!output)
    return;


  output.innerHTML = `

    <div class="report-highlight">

      <h4>
        ${escapeHTML(
          state.game.title
        )}
      </h4>

      <p>
        ${
          state.teams.A.name
        }
        <strong>${a}</strong>
        :
        <strong>${b}</strong>
        ${
          state.teams.B.name
        }
      </p>

      <p>
        승리팀:
        <strong>
          ${escapeHTML(
            winner
          )}
        </strong>
      </p>

    </div>


    <h4>
      경기 요약
    </h4>

    <p>
      모드:
      ${
        state.mode === "3v3"
          ? "3대3"
          : "5대5"
      }
    </p>

    <p>
      현재 구간:
      ${state.game.period}Q
    </p>

  `;

}


function generatePlayerReport() {

  const id =
    value(
      "reportPlayerSelect"
    );


  const player =
    findPlayer(id);


  const output =
    document.getElementById(
      "playerReportOutput"
    );


  if (!output)
    return;


  if (!player) {

    output.innerHTML = `
      <div class="empty-message">
        선수를 선택해주세용.
      </div>
    `;

    return;

  }


  const s =
    player.stats;


  const fgPct =
    s.fga
      ? (
          s.fg /
          s.fga *
          100
        ).toFixed(1)
      : "0.0";


  output.innerHTML = `

    <div class="report-blue-box">

      <h4>
        #${player.number}
        ${escapeHTML(
          player.name
        )}
      </h4>

      <p>
        PTS ${s.pts} ·
        REB ${s.reb} ·
        AST ${s.ast}
      </p>

      <p>
        STL ${s.stl} ·
        BLK ${s.blk} ·
        TO ${s.to}
      </p>

      <p>
        FG ${s.fg}/${s.fga}
        (${fgPct}%)
      </p>

      <p>
        +/- ${s.plusMinus}
      </p>

    </div>

  `;


  const ai =
    document.getElementById(
      "aiCommentOutput"
    );


  if (ai) {

    ai.innerHTML = `

      <div class="report-highlight">

        ${
          s.pts >= 10
            ? "득점 생산력이 좋았어용."
            : "득점 기회를 조금 더 만들어보면 좋아용."
        }

        ${
          s.ast >= 3
            ? " 패스 연결도 적극적이었어용."
            : ""
        }

        ${
          s.reb >= 5
            ? " 리바운드 참여도도 좋았어용."
            : ""
        }

      </div>

    `;

  }

}


function generateTraining() {

  const output =
    document.getElementById(
      "trainingPlanOutput"
    );


  if (!output)
    return;


  output.innerHTML = `

    <div class="training-card">

      <h4>
        슈팅
      </h4>

      <p>
        게임 상황에서의 캐치앤슛과
        움직임 후 슛을 반복해보세용.
      </p>

    </div>


    <div class="training-card">

      <h4>
        볼 핸들링
      </h4>

      <p>
        압박 상황에서 방향 전환과
        첫 스텝을 집중적으로 연습해보세용.
      </p>

    </div>


    <div class="training-card">

      <h4>
        수비
      </h4>

      <p>
        사이드 스텝과 도움수비 후
        복귀 동작을 반복해보세용.
      </p>

    </div>

  `;

}


/* =========================================================
   63. 리그
========================================================= */

function bindLeagueEvents() {

  document
    .getElementById(
      "addLeagueTeamBtn"
    )
    ?.addEventListener(
      "click",
      addLeagueTeam
    );


  document
    .getElementById(
      "resetLeagueBtn"
    )
    ?.addEventListener(
      "click",
      resetLeague
    );


  document
    .getElementById(
      "addScheduleBtn"
    )
    ?.addEventListener(
      "click",
      addSchedule
    );


  document
    .getElementById(
      "exportJsonBtn"
    )
    ?.addEventListener(
      "click",
      exportJSON
    );


  document
    .getElementById(
      "importJsonInput"
    )
    ?.addEventListener(
      "change",
      importJSON
    );


  document
    .getElementById(
      "exportCsvBtn"
    )
    ?.addEventListener(
      "click",
      exportCSV
    );

}


function addLeagueTeam() {

  const input =
    document.getElementById(
      "leagueTeamNameInput"
    );


  const name =
    input?.value.trim();


  if (!name)
    return;


  state.league.teams.push({

    id:
      cryptoRandomId(),

    name,

    games: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0

  });


  input.value = "";

  renderLeague();

}


function resetLeague() {

  if (
    !confirm(
      "리그 데이터를 초기화할까요?"
    )
  ) {

    return;

  }


  state.league = {

    teams: [],
    schedules: [],
    results: []

  };


  renderLeague();

}


function addSchedule() {

  const a =
    value(
      "scheduleTeamASelect"
    );


  const b =
    value(
      "scheduleTeamBSelect"
    );


  if (
    !a ||
    !b ||
    a === b
  ) {

    alert(
      "서로 다른 두 팀을 선택해주세용."
    );

    return;

  }


  state.league.schedules.push({

    id:
      cryptoRandomId(),

    teamA:
      a,

    teamB:
      b,

    date:
      value(
        "scheduleDateInput"
      ),

    time:
      value(
        "scheduleTimeInput"
      )

  });


  renderLeague();

}


function renderLeague() {

  const list =
    document.getElementById(
      "leagueTeamList"
    );


  if (list) {

    list.innerHTML =
      state.league.teams
        .map(
          team => `

            <div class="league-team-row">

              <strong>
                ${escapeHTML(
                  team.name
                )}
              </strong>

              <button
                type="button"
                data-remove-league="${team.id}"
              >
                ×
              </button>

            </div>

          `
        )
        .join("")
        ||
        `
          <div class="empty-message">
            등록된 리그 팀이 없습니다.
          </div>
        `;


    list
      .querySelectorAll(
        "[data-remove-league]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              state.league.teams =
                state.league.teams.filter(
                  team =>
                    team.id !==
                    button.dataset
                      .removeLeague
                );

              renderLeague();

            }
          );

        }
      );

  }


  renderLeagueSelectors();

  renderStandings();

  renderSchedules();

}


/* =========================================================
   64. 리그 선택
========================================================= */

function renderLeagueSelectors() {

  const selects = [

    "scheduleTeamASelect",
    "scheduleTeamBSelect"

  ];


  selects.forEach(
    id => {

      const select =
        document.getElementById(
          id
        );


      if (!select)
        return;


      select.innerHTML =
        `<option value="">
          팀 선택
        </option>`;


      state.league.teams
        .forEach(
          team => {

            const option =
              document.createElement(
                "option"
              );


            option.value =
              team.id;


            option.textContent =
              team.name;


            select.appendChild(
              option
            );

          }
        );

    }
  );

}


/* =========================================================
   65. 순위표
========================================================= */

function renderStandings() {

  const body =
    document.getElementById(
      "leagueStandingsBody"
    );


  if (!body)
    return;


  const teams =
    [...state.league.teams]
      .sort(
        (
          a,
          b
        ) => {

          const winDiff =
            b.wins -
            a.wins;


          if (
            winDiff !== 0
          )
            return winDiff;


          return (
            (
              b.pointsFor -
              b.pointsAgainst
            ) -
            (
              a.pointsFor -
              a.pointsAgainst
            )
          );

        }
      );


  if (
    teams.length === 0
  ) {

    body.innerHTML = `
      <tr>
        <td
          colspan="9"
          class="empty-cell"
        >
          리그 결과가 없습니다.
        </td>
      </tr>
    `;

    return;

  }


  body.innerHTML =
    teams
      .map(
        (
          team,
          index
        ) => {

          const diff =
            team.pointsFor -
            team.pointsAgainst;


          const winRate =
            team.games
              ? (
                  team.wins /
                  team.games *
                  100
                ).toFixed(1)
              : "0.0";


          return `

            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHTML(
                  team.name
                )}
              </td>

              <td>
                ${team.games}
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

              <td>
                ${winRate}%
              </td>

            </tr>

          `;

        }
      )
      .join("");

}


function renderSchedules() {

  const container =
    document.getElementById(
      "scheduleList"
    );


  if (!container)
    return;


  if (
    state.league.schedules.length === 0
  ) {

    container.innerHTML = `
      <div class="empty-message">
        등록된 경기 일정이 없습니다.
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.league.schedules
      .map(
        schedule => {

          const teamA =
            state.league.teams
              .find(
                t =>
                  t.id ===
                  schedule.teamA
              );


          const teamB =
            state.league.teams
              .find(
                t =>
                  t.id ===
                  schedule.teamB
              );


          return `

            <div class="schedule-row">

              <time>
                ${schedule.date || "-"}
              </time>

              <strong>
                ${
                  teamA?.name ||
                  "-"
                }
                vs
                ${
                  teamB?.name ||
                  "-"
                }
              </strong>

              <span>
                ${schedule.time || ""}
              </span>

              <button
                type="button"
                data-remove-schedule="${schedule.id}"
              >
                삭제
              </button>

            </div>

          `;

        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-remove-schedule]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            state.league.schedules =
              state.league.schedules
                .filter(
                  schedule =>
                    schedule.id !==
                    button.dataset
                      .removeSchedule
                );

            renderSchedules();

          }
        );

      }
    );

}


/* =========================================================
   66. 경기 저장
========================================================= */

function saveGame() {

  const snapshot =
    JSON.parse(
      JSON.stringify(
        state
      )
    );


  state.savedGames.push({

    id:
      cryptoRandomId(),

    createdAt:
      Date.now(),

    snapshot

  });


  localStorage.setItem(
    "courtvision_saved_games",
    JSON.stringify(
      state.savedGames
    )
  );


  alert(
    "경기가 저장됐어용."
  );


  renderSavedGames();

}


/* =========================================================
   67. 저장 경기 불러오기
========================================================= */

function loadSavedGame() {

  const saved =
    state.savedGames[
      state.savedGames.length - 1
    ];


  if (!saved) {

    alert(
      "저장된 경기가 없습니다."
    );

    return;

  }


  restoreFullState(
    saved.snapshot
  );


  renderAll();

}


function restoreFullState(
  snapshot
) {

  Object.keys(
    state
  )
    .forEach(
      key => {

        if (
          key === "savedGames"
        )
          return;


        if (
          snapshot[key] !==
          undefined
        ) {

          state[key] =
            snapshot[key];

        }

      }
    );

}


/* =========================================================
   68. 저장 경기 목록
========================================================= */

function renderSavedGames() {

  const container =
    document.getElementById(
      "savedGameList"
    );


  if (!container)
    return;


  if (
    state.savedGames.length === 0
  ) {

    container.innerHTML = `
      <div class="empty-message">
        저장된 경기가 없습니다.
      </div>
    `;

    return;

  }


  container.innerHTML =
    state.savedGames
      .slice()
      .reverse()
      .map(
        saved => `

          <div class="saved-game-row">

            <div>

              <strong>
                ${
                  saved.snapshot
                    ?.game
                    ?.title ||
                  "농구 경기"
                }
              </strong>

              <span>
                ${new Date(
                  saved.createdAt
                ).toLocaleString(
                  "ko-KR"
                )}
              </span>

            </div>

            <button
              type="button"
              data-load-saved="${saved.id}"
            >
              불러오기
            </button>

            <button
              type="button"
              data-delete-saved="${saved.id}"
            >
              삭제
            </button>

          </div>

        `
      )
      .join("");


  container
    .querySelectorAll(
      "[data-load-saved]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const saved =
              state.savedGames
                .find(
                  item =>
                    item.id ===
                    button.dataset
                      .loadSaved
                );


            if (
              saved
            ) {

              restoreFullState(
                saved.snapshot
              );

              renderAll();

            }

          }
        );

      }
    );


  container
    .querySelectorAll(
      "[data-delete-saved]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            state.savedGames =
              state.savedGames
                .filter(
                  item =>
                    item.id !==
                    button.dataset
                      .deleteSaved
                );


            localStorage.setItem(
              "courtvision_saved_games",
              JSON.stringify(
                state.savedGames
              )
            );


            renderSavedGames();

          }
        );

      }
    );

}


/* =========================================================
   69. JSON
========================================================= */

function exportJSON() {

  const data =
    JSON.stringify(
      state,
      null,
      2
    );


  downloadFile(
    data,
    "courtvision-game.json",
    "application/json"
  );

}


function importJSON(
  event
) {

  const file =
    event.target.files?.[0];


  if (!file)
    return;


  const reader =
    new FileReader();


  reader.onload =
    () => {

      try {

        const imported =
          JSON.parse(
            reader.result
          );


        restoreFullState(
          imported
        );


        renderAll();


        alert(
          "JSON을 불러왔어용."
        );

      }

      catch {

        alert(
          "JSON 파일을 읽을 수 없어용."
        );

      }

    };


  reader.readAsText(
    file
  );

}


/* =========================================================
   70. CSV
========================================================= */

function exportCSV() {

  const header = [

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
    "FGA",
    "FG%",
    "+/-"

  ];


  const rows =
    getAllPlayers()
      .map(
        player => {

          const s =
            player.stats;


          return [

            player.team,

            player.number,

            player.name,

            formatSeconds(
              player.secondsPlayed
            ),

            s.pts,

            s.reb,

            s.ast,

            s.stl,

            s.blk,

            s.to,

            s.pf,

            s.fg,

            s.fga,

            s.fga
              ? (
                  s.fg /
                  s.fga *
                  100
                ).toFixed(1)
              : "0.0",

            s.plusMinus

          ];

        }
      );


  const csv =
    [
      header,
      ...rows
    ]
      .map(
        row =>
          row
            .map(
              cell =>
                `"${String(
                  cell
                ).replace(
                  /"/g,
                  '""'
                )}"`
            )
            .join(",")
      )
      .join("\n");


  downloadFile(
    "\uFEFF" + csv,
    "courtvision-stats.csv",
    "text/csv;charset=utf-8"
  );

}


/* =========================================================
   71. 탭
========================================================= */

function openTab(
  tabId
) {

  document
    .querySelectorAll(
      ".tab-section"
    )
    .forEach(
      section => {

        section.classList.toggle(
          "active",
          section.id ===
          tabId
        );

      }
    );


  document
    .querySelectorAll(
      ".nav-btn"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.tab ===
          tabId
        );

      }
    );


  if (
    tabId ===
    "shotchartSection"
  ) {

    setTimeout(
      renderShotChart,
      50
    );

  }

}


/* =========================================================
   72. 기타 계산
========================================================= */

function getAllPlayers() {

  return [

    ...state.teams.A.players,

    ...state.teams.B.players

  ];

}


function teamStat(
  team,
  key
) {

  return state.teams[
    team
  ].players
    .reduce(
      (
        total,
        player
      ) =>
        total +
        (
          Number(
            player.stats[key]
          ) || 0
        ),
      0
    );

}


function offensiveScore(
  player
) {

  const s =
    player.stats;


  return (
    s.pts +
    s.ast * 1.5 +
    s.reb * 0.5 -
    s.to
  );

}


function defensiveScore(
  player
) {

  const s =
    player.stats;


  return (
    s.reb * 0.7 +
    s.stl * 2 +
    s.blk * 2 +
    s.def
  );

}


/* =========================================================
   73. 최근 기록 삭제
========================================================= */

function clearRecentLogs() {

  state.actions = [];

  renderRecentLogs();

}


/* =========================================================
   74. 저장 데이터 복원
========================================================= */

(function loadLocalGames() {

  try {

    const saved =
      localStorage.getItem(
        "courtvision_saved_games"
      );


    if (saved) {

      state.savedGames =
        JSON.parse(
          saved
        );

    }

  }

  catch {

    state.savedGames =
      [];

  }

})();


/* =========================================================
   75. 저장 목록 초기 렌더
========================================================= */

function renderSavedGamesSafe() {

  renderSavedGames();

}


/* =========================================================
   76. 유틸
========================================================= */

function value(
  id
) {

  return (
    document.getElementById(
      id
    )?.value || ""
  );

}


function setValue(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.value =
      value ?? "";

  }

}


function numberValue(
  id,
  fallback
) {

  const number =
    Number(
      value(id)
    );


  return Number.isFinite(
    number
  )
    ? number
    : fallback;

}


function setText(
  id,
  text
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      text ?? "";

  }

}


function capitalize(
  value
) {

  return value.charAt(0)
    .toUpperCase() +
    value.slice(1);

}


function formatClock(
  seconds
) {

  seconds =
    Math.max(
      0,
      Number(seconds) || 0
    );


  const minutes =
    Math.floor(
      seconds / 60
    );


  const secs =
    seconds % 60;


  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    secs
  ).padStart(
    2,
    "0"
  )}`;

}


function formatSeconds(
  seconds
) {

  seconds =
    Math.max(
      0,
      Number(seconds) || 0
    );


  const minutes =
    Math.floor(
      seconds / 60
    );


  const secs =
    Math.floor(
      seconds % 60
    );


  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    secs
  ).padStart(
    2,
    "0"
  )}`;

}


function formatVideoTime(
  seconds
) {

  return formatSeconds(
    seconds
  );

}


function cryptoRandomId() {

  if (
    window.crypto &&
    crypto.randomUUID
  ) {

    return crypto.randomUUID();

  }


  return (
    Date.now()
      .toString(36) +
    Math.random()
      .toString(36)
      .slice(2)
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


function downloadFile(
  content,
  filename,
  type
) {

  const blob =
    new Blob(
      [content],
      {
        type
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    filename;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  URL.revokeObjectURL(
    url
  );

}


/* =========================================================
   END
========================================================= */