/* =========================================================
   COURTVISION PRO
   APP.JS
   실시간 선수 / 기록 / 슛차트 / 히트맵
   ========================================================= */

const STORAGE_KEY = "COURTVISION_PRO_V2";

let mode = 3;

let game = {
  teamA: {
    name: "설천고 A",
    players: []
  },

  teamB: {
    name: "설천고 B",
    players: []
  },

  selectedPlayer: null,

  score: {
    A: 0,
    B: 0
  },

  fouls: {
    A: 0,
    B: 0
  },

  shots: [],

  logs: [],

  clock: {
    total: 600,
    running: false
  },

  shotClock: {
    total: 14,
    current: 14,
    running: false
  }
};

let clockTimer = null;
let shotClockTimer = null;
let heatmapEnabled = true;


/* =========================================================
   초기 선수 생성
   ========================================================= */

function makePlayer(team, number) {

  return {
    id:
      `${team}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,

    team,

    number,

    name:
      `${team}팀 선수 ${number}`,

    position:
      "G",

    onCourt: true,

    stats: {
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pf: 0,

      fgMade: 0,
      fgAttempt: 0,

      oneMade: 0,
      oneAttempt: 0,

      twoMade: 0,
      twoAttempt: 0,

      threeMade: 0,
      threeAttempt: 0
    }
  };
}


/* =========================================================
   초기화
   ========================================================= */

function initializePlayers() {

  if (
    game.teamA.players.length > 0 ||
    game.teamB.players.length > 0
  ) {
    return;
  }

  const count = mode === 3 ? 3 : 5;

  for (let i = 1; i <= count; i++) {

    game.teamA.players.push(
      makePlayer("A", i)
    );

    game.teamB.players.push(
      makePlayer("B", i)
    );
  }
}


/* =========================================================
   전체 선수
   ========================================================= */

function getAllPlayers() {

  return [
    ...game.teamA.players,
    ...game.teamB.players
  ];
}


function getPlayer(id) {

  return getAllPlayers()
    .find(player => player.id === id);
}


/* =========================================================
   선수 설정 화면
   ========================================================= */

function renderPlayerSetup() {

  renderPlayerTeam("A");
  renderPlayerTeam("B");
}


function renderPlayerTeam(team) {

  const container =
    document.getElementById(
      `players${team}`
    );

  if (!container) return;

  const players =
    game[`team${team}`].players;

  container.innerHTML = "";

  players.forEach(
    (player, index) => {

      const row =
        document.createElement("div");

      row.className =
        "player-row";

      row.innerHTML = `

        <input
          type="number"
          value="${player.number}"
          title="등번호"
          onchange="
            updatePlayer(
              '${team}',
              ${index},
              'number',
              this.value
            )
          "
        >

        <input
          value="${escapeHTML(player.name)}"
          placeholder="선수 이름"
          onchange="
            updatePlayer(
              '${team}',
              ${index},
              'name',
              this.value
            )
          "
        >

        <button
          onclick="
            updatePlayer(
              '${team}',
              ${index},
              'position',
              prompt(
                '포지션을 입력하세요',
                '${player.position}'
              ) || '${player.position}'
            )
          "
        >
          ${player.position}
        </button>

        <button
          class="${
            player.onCourt
              ? "playing"
              : ""
          }"
          onclick="
            togglePlayerCourt(
              '${player.id}'
            )
          "
        >
          ${
            player.onCourt
              ? "출전"
              : "벤치"
          }
        </button>

        <button
          class="remove"
          onclick="
            deletePlayer(
              '${team}',
              ${index}
            )
          "
        >
          ×
        </button>

      `;

      container.appendChild(row);
    }
  );
}


/* =========================================================
   선수 수정
   ========================================================= */

function updatePlayer(
  team,
  index,
  key,
  value
) {

  const player =
    game[`team${team}`].players[index];

  if (!player) return;

  if (key === "number") {

    player.number =
      Number(value) || 0;

  } else {

    player[key] = value;

  }

  saveLocal();

  refreshAll();
}


/* =========================================================
   선수 추가
   ========================================================= */

function addPlayer(team) {

  const players =
    game[`team${team}`].players;

  let number = 1;

  if (players.length > 0) {

    number =
      Math.max(
        ...players.map(
          player =>
            Number(player.number) || 0
        )
      ) + 1;
  }

  players.push(
    makePlayer(
      team,
      number
    )
  );

  saveLocal();

  renderPlayerSetup();
  renderLivePlayers();
  renderPlayerSelectors();
}


/* =========================================================
   선수 삭제
   ========================================================= */

function deletePlayer(
  team,
  index
) {

  const player =
    game[`team${team}`]
      .players[index];

  if (!player) return;

  if (
    game.selectedPlayer ===
    player.id
  ) {

    game.selectedPlayer =
      null;
  }

  game[`team${team}`]
    .players
    .splice(index, 1);

  saveLocal();

  refreshAll();
}


/* =========================================================
   출전 / 벤치
   ========================================================= */

function togglePlayerCourt(id) {

  const player =
    getPlayer(id);

  if (!player) return;

  const players =
    game[`team${player.team}`]
      .players;

  const currentOnCourt =
    players.filter(
      p => p.onCourt
    ).length;

  if (
    !player.onCourt &&
    currentOnCourt >= mode
  ) {

    alert(
      `${mode}대${mode}는 최대 ${mode}명까지 출전할 수 있습니다.`
    );

    return;
  }

  player.onCourt =
    !player.onCourt;

  saveLocal();

  refreshAll();
}


/* =========================================================
   팀 이름
   ========================================================= */

function changeTeamName(
  team,
  name
) {

  game[`team${team}`].name =
    name;

  refreshAll();
}


/* =========================================================
   라이브 선수
   ========================================================= */

function renderLivePlayers() {

  renderLiveTeam("A");
  renderLiveTeam("B");
}


function renderLiveTeam(team) {

  const container =
    document.getElementById(
      `livePlayers${team}`
    );

  if (!container) return;

  container.innerHTML = "";

  const players =
    game[`team${team}`]
      .players
      .filter(
        player =>
          player.onCourt
      )
      .slice(0, mode);

  players.forEach(player => {

    const card =
      document.createElement("div");

    card.className =
      "player-card " +
      (
        team === "B"
          ? "away "
          : ""
      ) +
      (
        game.selectedPlayer ===
        player.id
          ? "selected"
          : ""
      );

    card.onclick =
      () => selectPlayer(player.id);

    card.innerHTML = `

      <div class="number">
        ${player.number}
      </div>

      <b>
        ${escapeHTML(player.name)}
      </b>

      <small>
        ${player.position}
      </small>

      <small>
        PTS ${player.stats.pts}
        · REB ${player.stats.reb}
        · AST ${player.stats.ast}
      </small>

    `;

    container.appendChild(card);
  });
}


/* =========================================================
   선수 선택
   ========================================================= */

function selectPlayer(id) {

  const player =
    getPlayer(id);

  if (!player) return;

  game.selectedPlayer =
    id;

  updateSelectedPlayer();

  renderLivePlayers();

  updateShotPlayerSelect();

  saveLocal();
}


function updateSelectedPlayer() {

  const title =
    document.getElementById(
      "selectedTitle"
    );

  const stats =
    document.getElementById(
      "selectedStats"
    );

  if (!title || !stats) return;

  const player =
    getPlayer(
      game.selectedPlayer
    );

  if (!player) {

    title.textContent =
      "선수를 선택해주세요";

    stats.textContent =
      "라이브 화면에서 선수를 선택하세요.";

    return;
  }

  title.textContent =
    `#${player.number} ${player.name}`;

  const s =
    player.stats;

  const fgPct =
    s.fgAttempt > 0
      ? Math.round(
          s.fgMade /
          s.fgAttempt *
          100
        )
      : 0;

  stats.innerHTML = `

    <b>PTS ${s.pts}</b>
    · REB ${s.reb}
    · AST ${s.ast}
    · STL ${s.stl}
    · BLK ${s.blk}
    · TO ${s.tov}
    · PF ${s.pf}
    · FG ${fgPct}%

  `;
}


/* =========================================================
   기록 버튼
   ========================================================= */

function stat(type) {

  const player =
    getPlayer(
      game.selectedPlayer
    );

  if (!player) {

    alert(
      "먼저 라이브 화면에서 선수를 선택해주세요."
    );

    return;
  }


  switch (type) {

    case "1P":

      recordMadeShot(
        player,
        1
      );

      break;


    case "2P":

      if (mode === 3) {

        recordMadeShot(
          player,
          2
        );

      } else {

        recordMadeShot(
          player,
          2
        );
      }

      break;


    case "3P":

      if (mode === 3) {

        alert(
          "3대3에서는 외곽슛이 2점입니다."
        );

        return;

      }

      recordMadeShot(
        player,
        3
      );

      break;


    case "MISS":

      recordMiss(
        player
      );

      break;


    case "REB":

      player.stats.reb++;

      addLog(
        `${player.name} · 리바운드`
      );

      break;


    case "AST":

      player.stats.ast++;

      addLog(
        `${player.name} · 어시스트`
      );

      break;


    case "STL":

      player.stats.stl++;

      addLog(
        `${player.name} · 스틸`
      );

      break;


    case "BLK":

      player.stats.blk++;

      addLog(
        `${player.name} · 블록`
      );

      break;


    case "TO":

      player.stats.tov++;

      addLog(
        `${player.name} · 턴오버`
      );

      break;


    case "PF":

      player.stats.pf++;

      game.fouls[
        player.team
      ]++;

      addLog(
        `${player.name} · 파울`
      );

      break;
  }


  saveLocal();

  refreshAll();
}


/* =========================================================
   성공 슛
   ========================================================= */

function recordMadeShot(
  player,
  points
) {

  const s =
    player.stats;

  s.pts += points;

  s.fgMade++;
  s.fgAttempt++;

  if (points === 1) {

    s.oneMade++;
    s.oneAttempt++;

  }

  if (points === 2) {

    s.twoMade++;
    s.twoAttempt++;

  }

  if (points === 3) {

    s.threeMade++;
    s.threeAttempt++;

  }

  game.score[
    player.team
  ] += points;

  addLog(
    `${player.name} · +${points}점`
  );

  resetShotClock();
}


/* =========================================================
   실패 슛
   ========================================================= */

function recordMiss(player) {

  player.stats.fgAttempt++;

  addLog(
    `${player.name} · 슛 실패`
  );

  resetShotClock();
}


/* =========================================================
   로그
   ========================================================= */

function addLog(text) {

  game.logs.unshift({

    id:
      Date.now() +
      Math.random(),

    text,

    time:
      new Date()
        .toLocaleTimeString(
          "ko-KR",
          {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          }
        )

  });

  if (
    game.logs.length > 50
  ) {

    game.logs.length = 50;

  }

  renderLogs();
}


function renderLogs() {

  const container =
    document.getElementById(
      "recentLogs"
    );

  if (!container) return;

  if (!game.logs.length) {

    container.innerHTML =
      "아직 기록이 없습니다.";

    return;
  }

  container.innerHTML =
    game.logs
      .map(
        log => `

          <div class="video-log">

            <b>
              ${escapeHTML(
                log.text
              )}
            </b>

            <small>
              ${log.time}
            </small>

          </div>

        `
      )
      .join("");
}


/* =========================================================
   선수 선택 Select
   ========================================================= */

function renderPlayerSelectors() {

  const ids = [
    "shotPlayer",
    "detailPlayer",
    "reportPlayer"
  ];

  ids.forEach(id => {

    const select =
      document.getElementById(id);

    if (!select) return;

    const current =
      select.value;

    select.innerHTML =
      `<option value="">
        선수 선택
      </option>`;

    getAllPlayers()
      .forEach(player => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          player.id;

        option.textContent =
          `${player.team} · #${player.number} ${player.name}`;

        select.appendChild(
          option
        );

      });

    if (
      getPlayer(current)
    ) {

      select.value =
        current;

    }

  });

  updateShotPlayerSelect();
}


function updateShotPlayerSelect() {

  const select =
    document.getElementById(
      "shotPlayer"
    );

  if (!select) return;

  if (
    game.selectedPlayer &&
    getPlayer(
      game.selectedPlayer
    )
  ) {

    select.value =
      game.selectedPlayer;

  }
}


/* =========================================================
   슛차트 위치 기록
   ========================================================= */

function setShotResult(success) {

  const select =
    document.getElementById(
      "shotPlayer"
    );

  const selectedId =
    select?.value ||
    game.selectedPlayer;

  const player =
    getPlayer(selectedId);

  if (!player) {

    alert(
      "먼저 선수를 선택해주세요."
    );

    return;
  }

  const court =
    document.getElementById(
      "shotCourt"
    );

  if (!court) return;

  court.dataset.shotResult =
    success
      ? "made"
      : "miss";

  court.classList.add(
    "ready-to-record"
  );

  court.onclick =
    function handler(event) {

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

      recordShotLocation(
        player,
        x,
        y,
        success
      );

      court.onclick =
        null;

      court.classList.remove(
        "ready-to-record"
      );
    };
}


/* =========================================================
   슛 위치 저장
   ========================================================= */

function recordShotLocation(
  player,
  x,
  y,
  success
) {

  const shot = {

    id:
      Date.now() +
      Math.random(),

    playerId:
      player.id,

    team:
      player.team,

    playerName:
      player.name,

    x,
    y,

    success,

    mode,

    time:
      new Date()
        .toLocaleTimeString()

  };

  game.shots.push(
    shot
  );

  addLog(
    `${player.name} · ` +
    `${success ? "슛 성공" : "슛 실패"} · ` +
    `${Math.round(x)}%, ${Math.round(y)}%`
  );

  renderShotChart();
  renderMiniCourt();
  renderShotStats();

  saveLocal();
}


/* =========================================================
   슛차트 렌더링
   ========================================================= */

function renderShotChart() {

  const court =
    document.getElementById(
      "shotCourt"
    );

  if (!court) return;

  court.innerHTML = "";

  const label =
    document.createElement(
      "span"
    );

  label.className =
    "court-label";

  label.textContent =
    `${mode}대${mode} SHOT CHART`;

  court.appendChild(
    label
  );


  const select =
    document.getElementById(
      "shotPlayer"
    );

  const selectedId =
    select?.value ||
    game.selectedPlayer;


  let shots =
    game.shots;

  if (selectedId) {

    shots =
      shots.filter(
        shot =>
          shot.playerId ===
          selectedId
      );

  }


  if (heatmapEnabled) {

    renderHeatmap(
      court,
      shots
    );

  }


  shots.forEach(
    shot => {

      const dot =
        document.createElement(
          "div"
        );

      dot.className =
        "shot-dot " +
        (
          shot.success
            ? "success"
            : "fail"
        );

      dot.style.left =
        shot.x + "%";

      dot.style.top =
        shot.y + "%";

      if (!shot.success) {

        dot.textContent =
          "×";

      }

      dot.title =
        `${shot.playerName} · ${
          shot.success
            ? "성공"
            : "실패"
        }`;

      court.appendChild(
        dot
      );

    }
  );

}


/* =========================================================
   히트맵
   ========================================================= */

function renderHeatmap(
  court,
  shots
) {

  if (!shots.length) return;

  const cells = {};

  shots.forEach(
    shot => {

      const gx =
        Math.floor(
          shot.x / 8
        ) * 8;

      const gy =
        Math.floor(
          shot.y / 8
        ) * 8;

      const key =
        `${gx}-${gy}`;

      if (!cells[key]) {

        cells[key] = [];

      }

      cells[key].push(
        shot
      );

    }
  );


  Object.values(cells)
    .forEach(
      cellShots => {

        const x =
          cellShots.reduce(
            (sum, shot) =>
              sum + shot.x,
            0
          ) /
          cellShots.length;

        const y =
          cellShots.reduce(
            (sum, shot) =>
              sum + shot.y,
            0
          ) /
          cellShots.length;

        const made =
          cellShots.filter(
            shot =>
              shot.success
          ).length;

        const total =
          cellShots.length;

        const rate =
          made / total;

        const heat =
          document.createElement(
            "div"
          );

        heat.className =
          "heat";

        const size =
          Math.min(
            160,
            55 +
            total * 12
          );

        heat.style.width =
          `${size}px`;

        heat.style.height =
          `${size}px`;

        heat.style.left =
          `${x}%`;

        heat.style.top =
          `${y}%`;

        heat.style.opacity =
          Math.min(
            0.75,
            0.25 +
            total * 0.08
          );

        heat.title =
          `시도 ${total} · 성공 ${made} · 성공률 ${Math.round(rate*100)}%`;

        court.appendChild(
          heat
        );

      }
    );
}


/* =========================================================
   히트맵 ON/OFF
   ========================================================= */

function toggleHeatmap() {

  heatmapEnabled =
    !heatmapEnabled;

  renderShotChart();

}


/* =========================================================
   미니 코트
   ========================================================= */

function renderMiniCourt() {

  const court =
    document.getElementById(
      "miniCourt"
    );

  if (!court) return;

  court.innerHTML = "";

  game.shots
    .forEach(
      shot => {

        const dot =
          document.createElement(
            "div"
          );

        dot.className =
          "shot-dot " +
          (
            shot.success
              ? "success"
              : "fail"
          );

        dot.style.left =
          shot.x + "%";

        dot.style.top =
          shot.y + "%";

        if (!shot.success) {

          dot.textContent =
            "×";

        }

        court.appendChild(
          dot
        );

      }
    );
}


/* =========================================================
   슛 통계
   ========================================================= */

function renderShotStats() {

  const container =
    document.getElementById(
      "shotStats"
    );

  if (!container) return;

  const select =
    document.getElementById(
      "shotPlayer"
    );

  const playerId =
    select?.value ||
    game.selectedPlayer;


  let shots =
    game.shots;

  if (playerId) {

    shots =
      shots.filter(
        shot =>
          shot.playerId ===
          playerId
      );

  }


  const total =
    shots.length;

  const made =
    shots.filter(
      shot =>
        shot.success
    ).length;

  const miss =
    total - made;

  const pct =
    total
      ? Math.round(
          made /
          total *
          100
        )
      : 0;


  container.innerHTML = `

    <div class="summary-grid">

      <div class="summary-card">
        <span>전체 슛</span>
        <b>${total}</b>
      </div>

      <div class="summary-card">
        <span>성공</span>
        <b>${made}</b>
      </div>

      <div class="summary-card">
        <span>실패</span>
        <b>${miss}</b>
      </div>

      <div class="summary-card">
        <span>성공률</span>
        <b>${pct}%</b>
      </div>

    </div>

  `;
}


/* =========================================================
   슛차트 전체 삭제
   ========================================================= */

function clearShots() {

  if (
    !confirm(
      "모든 슛차트 기록을 삭제할까요?"
    )
  ) return;

  game.shots = [];

  saveLocal();

  renderShotChart();
  renderMiniCourt();
  renderShotStats();
}


/* =========================================================
   기록표
   ========================================================= */

function renderRecords() {

  const tbody =
    document.getElementById(
      "recordBody"
    );

  if (!tbody) return;

  const filter =
    document.getElementById(
      "recordTeam"
    );

  const teamFilter =
    filter?.value ||
    "ALL";

  tbody.innerHTML = "";

  getAllPlayers()
    .filter(
      player =>
        teamFilter === "ALL" ||
        player.team === teamFilter
    )
    .forEach(
      player => {

        const s =
          player.stats;

        const fgPct =
          s.fgAttempt
            ? Math.round(
                s.fgMade /
                s.fgAttempt *
                100
              )
            : 0;

        const tr =
          document.createElement(
            "tr"
          );

        tr.innerHTML = `

          <td>${player.team}</td>

          <td>
            ${player.number}
          </td>

          <td>
            ${escapeHTML(
              player.name
            )}
          </td>

          <td>00:00</td>

          <td>${s.pts}</td>

          <td>${s.reb}</td>

          <td>${s.ast}</td>

          <td>${s.stl}</td>

          <td>${s.blk}</td>

          <td>${s.tov}</td>

          <td>${s.pf}</td>

          <td>
            ${s.fgMade}/${s.fgAttempt}
          </td>

          <td>${fgPct}%</td>

          <td>0</td>

          <td>${s.oneMade}</td>

          <td>${s.twoMade}</td>

        `;

        tbody.appendChild(
          tr
        );

      }
    );


  renderTeamSummary();
}


/* =========================================================
   팀 요약
   ========================================================= */

function renderTeamSummary() {

  const container =
    document.getElementById(
      "teamSummary"
    );

  if (!container) return;

  const A =
    game.teamA.players;

  const B =
    game.teamB.players;


  const total =
    (team,key) =>
      game[`team${team}`]
        .players
        .reduce(
          (sum,p) =>
            sum +
            (p.stats[key] || 0),
          0
        );


  container.innerHTML = `

    <div class="summary-grid">

      <div class="summary-card">
        <span>${game.teamA.name} PTS</span>
        <b>${total("A","pts")}</b>
      </div>

      <div class="summary-card">
        <span>${game.teamB.name} PTS</span>
        <b>${total("B","pts")}</b>
      </div>

      <div class="summary-card">
        <span>${game.teamA.name} REB</span>
        <b>${total("A","reb")}</b>
      </div>

      <div class="summary-card">
        <span>${game.teamB.name} REB</span>
        <b>${total("B","reb")}</b>
      </div>

    </div>

  `;
}


/* =========================================================
   기록 CSV
   ========================================================= */

function downloadCSV() {

  let csv =
    "팀,번호,선수,PTS,REB,AST,STL,BLK,TO,PF,FG,FG%\n";

  getAllPlayers()
    .forEach(
      player => {

        const s =
          player.stats;

        const pct =
          s.fgAttempt
            ? Math.round(
                s.fgMade /
                s.fgAttempt *
                100
              )
            : 0;

        csv += [

          player.team,

          player.number,

          `"${player.name
            .replaceAll(
              '"',
              '""'
            )}"`,

          s.pts,
          s.reb,
          s.ast,
          s.stl,
          s.blk,
          s.tov,
          s.pf,

          `${s.fgMade}/${s.fgAttempt}`,

          `${pct}%`

        ].join(",") + "\n";

      }
    );


  const blob =
    new Blob(
      ["\ufeff" + csv],
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

  a.href = url;

  a.download =
    "COURTVISION_PRO_RECORDS.csv";

  a.click();

  URL.revokeObjectURL(
    url
  );
}


/* =========================================================
   경기 시계
   ========================================================= */

function startClock() {

  if (
    game.clock.running
  ) return;

  game.clock.running =
    true;

  clockTimer =
    setInterval(
      () => {

        if (
          game.clock.total <= 0
        ) {

          pauseClock();

          return;
        }

        game.clock.total--;

        updateClockUI();

      },
      1000
    );
}


function pauseClock() {

  game.clock.running =
    false;

  clearInterval(
    clockTimer
  );

  clockTimer =
    null;
}


function resetGameClock() {

  pauseClock();

  game.clock.total =
    600;

  updateClockUI();
}


function updateClockUI() {

  const clock =
    document.getElementById(
      "gameClock"
    );

  if (!clock) return;

  const min =
    Math.floor(
      game.clock.total /
      60
    );

  const sec =
    game.clock.total %
    60;

  clock.textContent =
    `${String(min).padStart(2,"0")}:` +
    `${String(sec).padStart(2,"0")}`;
}


/* =========================================================
   샷클락
   ========================================================= */

function startShotClock() {

  if (
    game.shotClock.running
  ) return;

  game.shotClock.running =
    true;

  shotClockTimer =
    setInterval(
      () => {

        if (
          game.shotClock.current <= 0
        ) {

          stopShotClock();

          return;
        }

        game.shotClock.current--;

        updateShotClockUI();

      },
      1000
    );
}


function stopShotClock() {

  game.shotClock.running =
    false;

  clearInterval(
    shotClockTimer
  );

  shotClockTimer =
    null;
}


function resetShotClock() {

  stopShotClock();

  game.shotClock.current =
    game.shotClock.total;

  updateShotClockUI();
}


function updateShotClockUI() {

  const el =
    document.getElementById(
      "shotClock"
    );

  if (el) {

    el.textContent =
      game.shotClock.current;

  }
}


/* =========================================================
   페이지 이동
   ========================================================= */

function showPage(page) {

  document.querySelectorAll(
    ".page"
  )
  .forEach(
    section =>
      section.classList.add(
        "hidden"
      )
  );

  const target =
    document.getElementById(
      page
    );

  if (target) {

    target.classList.remove(
      "hidden"
    );

  }


  document.querySelectorAll(
    "nav button"
  )
  .forEach(
    button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
        page
      );

    }
  );


  if (page === "shots") {

    renderPlayerSelectors();
    renderShotChart();
    renderShotStats();

  }

  if (page === "records") {

    renderRecords();

  }

  if (page === "report") {

    renderPlayerSelectors();
    renderReport();

  }

}


/* =========================================================
   선수 설정
   ========================================================= */

function toggleSetup() {

  const setup =
    document.getElementById(
      "setup"
    );

  if (!setup) return;

  if (
    setup.classList.contains(
      "hidden"
    )
  ) {

    setup.classList.remove(
      "hidden"
    );

    document.querySelectorAll(
      ".page"
    )
    .forEach(
      page => {

        if (
          page.id !==
          "setup"
        ) {

          page.classList.add(
            "hidden"
          );

        }

      }
    );

  } else {

    showPage("live");

  }

}


/* =========================================================
   경기 설정 저장
   ========================================================= */

function startGame() {

  const teamAInput =
    document.getElementById(
      "teamAName"
    );

  const teamBInput =
    document.getElementById(
      "teamBName"
    );

  if (teamAInput) {

    game.teamA.name =
      teamAInput.value ||
      "설천고 A";

  }

  if (teamBInput) {

    game.teamB.name =
      teamBInput.value ||
      "설천고 B";

  }


  const shotClock =
    document.getElementById(
      "shotClockSetting"
    );

  if (shotClock) {

    game.shotClock.total =
      Number(
        shotClock.value
      ) || 14;

  }


  resetShotClock();

  saveLocal();

  showPage("live");

  refreshAll();

  addLog(
    "경기 설정 저장"
  );
}


/* =========================================================
   영상
   ========================================================= */

function loadVideo(event) {

  const file =
    event.target.files?.[0];

  if (!file) return;

  const video =
    document.getElementById(
      "videoPlayer"
    );

  if (!video) return;

  video.src =
    URL.createObjectURL(
      file
    );

}


function videoRate(rate) {

  const video =
    document.getElementById(
      "videoPlayer"
    );

  if (video) {

    video.playbackRate =
      rate;

  }
}


/* =========================================================
   영상 마킹
   ========================================================= */

function videoMark(type) {

  const video =
    document.getElementById(
      "videoPlayer"
    );

  const time =
    video?.currentTime || 0;

  if (!game.videoMarks) {

    game.videoMarks = [];

  }

  game.videoMarks.push({

    type,

    time

  });

  renderVideoMarks();

  saveLocal();
}


function renderVideoMarks() {

  const container =
    document.getElementById(
      "videoLogs"
    );

  if (!container) return;

  const marks =
    game.videoMarks || [];

  if (!marks.length) {

    container.innerHTML =
      "아직 표시된 장면이 없습니다.";

    return;
  }

  container.innerHTML =
    marks
      .map(
        mark => `

          <div class="video-log">

            <b>
              ${escapeHTML(
                mark.type
              )}
            </b>

            <span>
              ${formatVideoTime(
                mark.time
              )}
            </span>

          </div>

        `
      )
      .join("");
}


function formatVideoTime(
  seconds
) {

  const min =
    Math.floor(
      seconds / 60
    );

  const sec =
    Math.floor(
      seconds % 60
    );

  return (
    `${min}:` +
    `${String(sec).padStart(2,"0")}`
  );
}


/* =========================================================
   리포트
   ========================================================= */

function renderReport() {

  const select =
    document.getElementById(
      "reportPlayer"
    );

  const container =
    document.getElementById(
      "playerReport"
    );

  if (!select || !container)
    return;

  const player =
    getPlayer(
      select.value
    );

  if (!player) {

    container.innerHTML =
      "선수를 선택해주세요.";

    return;
  }

  const s =
    player.stats;

  const fg =
    s.fgAttempt
      ? Math.round(
          s.fgMade /
          s.fgAttempt *
          100
        )
      : 0;

  container.innerHTML = `

    <h3>
      #${player.number}
      ${escapeHTML(
        player.name
      )}
    </h3>

    <div class="summary-grid">

      <div class="summary-card">
        <span>PTS</span>
        <b>${s.pts}</b>
      </div>

      <div class="summary-card">
        <span>FG%</span>
        <b>${fg}%</b>
      </div>

      <div class="summary-card">
        <span>REB</span>
        <b>${s.reb}</b>
      </div>

      <div class="summary-card">
        <span>AST</span>
        <b>${s.ast}</b>
      </div>

      <div class="summary-card">
        <span>STL</span>
        <b>${s.stl}</b>
      </div>

      <div class="summary-card">
        <span>BLK</span>
        <b>${s.blk}</b>
      </div>

    </div>

  `;
}


/* =========================================================
   전력분석
   ========================================================= */

function renderAnalysis() {

  const ptsA =
    teamStat(
      "A",
      "pts"
    );

  const ptsB =
    teamStat(
      "B",
      "pts"
    );

  const rebA =
    teamStat(
      "A",
      "reb"
    );

  const rebB =
    teamStat(
      "B",
      "reb"
    );

  const astA =
    teamStat(
      "A",
      "ast"
    );

  const astB =
    teamStat(
      "B",
      "ast"
    );


  const offense =
    document.getElementById(
      "offenseAnalysis"
    );

  if (offense) {

    offense.innerHTML = `

      <div class="summary-grid">

        <div class="summary-card">
          <span>
            ${game.teamA.name}
          </span>
          <b>${ptsA} PTS</b>
        </div>

        <div class="summary-card">
          <span>
            ${game.teamB.name}
          </span>
          <b>${ptsB} PTS</b>
        </div>

      </div>

    `;
  }


  const defense =
    document.getElementById(
      "defenseAnalysis"
    );

  if (defense) {

    defense.innerHTML = `

      ${game.teamA.name}
      · REB ${rebA}
      · AST ${astA}

      <br><br>

      ${game.teamB.name}
      · REB ${rebB}
      · AST ${astB}

    `;

  }


  const coach =
    document.getElementById(
      "coachInsight"
    );

  if (coach) {

    if (ptsA > ptsB) {

      coach.textContent =
        `${game.teamA.name}이 ` +
        `${ptsA - ptsB}점 앞서고 있습니다.`;

    }

    else if (ptsB > ptsA) {

      coach.textContent =
        `${game.teamB.name}이 ` +
        `${ptsB - ptsA}점 앞서고 있습니다.`;

    }

    else {

      coach.textContent =
        "현재 양 팀이 동점입니다.";

    }

  }

}


/* =========================================================
   팀 통계
   ========================================================= */

function teamStat(
  team,
  key
) {

  return game[`team${team}`]
    .players
    .reduce(
      (sum, player) =>
        sum +
        (
          player.stats[key] ||
          0
        ),
      0
    );
}


/* =========================================================
   전체 새로고침
   ========================================================= */

function refreshAll() {

  renderPlayerSetup();

  renderLivePlayers();

  renderPlayerSelectors();

  updateSelectedPlayer();

  renderRecords();

  renderShotChart();

  renderMiniCourt();

  renderShotStats();

  renderLogs();

  renderVideoMarks();

  renderAnalysis();

  updateHeader();

  updateClockUI();

  updateShotClockUI();

}


/* =========================================================
   상단 UI
   ========================================================= */

function updateHeader() {

  const values = {

    liveTeamA:
      game.teamA.name,

    liveTeamB:
      game.teamB.name,

    sideAName:
      game.teamA.name,

    sideBName:
      game.teamB.name,

    scoreA:
      game.score.A,

    scoreB:
      game.score.B,

    sideAScore:
      game.score.A,

    sideBScore:
      game.score.B,

    foulA:
      game.fouls.A,

    foulB:
      game.fouls.B,

    modeBadge:
      `${mode}대${mode}`,

    infoMode:
      `${mode}대${mode}`

  };


  Object.entries(
    values
  )
  .forEach(
    ([id,value]) => {

      const el =
        document.getElementById(
          id
        );

      if (el) {

        el.textContent =
          value;

      }

    }
  );


  const subtitle =
    document.getElementById(
      "liveSubtitle"
    );

  if (subtitle) {

    subtitle.textContent =
      `${mode}대${mode} 실시간 경기 분석`;

  }
}


/* =========================================================
   저장
   ========================================================= */

function saveLocal() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      mode,
      game
    })
  );
}


/* =========================================================
   불러오기
   ========================================================= */

function loadLocal() {

  const raw =
    localStorage.getItem(
      STORAGE_KEY
    );

  if (!raw) return;

  try {

    const saved =
      JSON.parse(raw);

    mode =
      saved.mode || 3;

    game =
      saved.game || game;

  }
  catch(error) {

    console.error(
      "저장 데이터 오류",
      error
    );

  }
}


/* =========================================================
   초기화
   ========================================================= */

function resetAll() {

  if (
    !confirm(
      "경기 기록과 선수 데이터를 모두 초기화할까요?"
    )
  ) return;

  localStorage.removeItem(
    STORAGE_KEY
  );

  location.reload();
}


/* =========================================================
   모드
   ========================================================= */

function setMode(newMode) {

  mode =
    Number(newMode);

  const count =
    mode === 3
      ? 3
      : 5;

  document.getElementById(
    "mode3"
  )?.classList.toggle(
    "active",
    mode === 3
  );

  document.getElementById(
    "mode5"
  )?.classList.toggle(
    "active",
    mode === 5
  );


  [
    "A",
    "B"
  ].forEach(
    team => {

      const players =
        game[`team${team}`]
          .players;

      players.forEach(
        (player,index) => {

          player.onCourt =
            index < count;

        }
      );

    }
  );


  saveLocal();

  refreshAll();
}


/* =========================================================
   HTML 안전 처리
   ========================================================= */

function escapeHTML(value) {

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
   분
   ========================================================= */

function formatMinutes(
  seconds
) {

  const min =
    Math.floor(
      seconds / 60
    );

  const sec =
    seconds % 60;

  return (
    `${String(min).padStart(2,"0")}:` +
    `${String(sec).padStart(2,"0")}`
  );
}


/* =========================================================
   네비게이션
   ========================================================= */

document
  .querySelectorAll(
    "nav button"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );

        }
      );

    }
  );


/* =========================================================
   초기 실행
   ========================================================= */

loadLocal();

initializePlayers();

setMode(mode);

refreshAll();

showPage("live");