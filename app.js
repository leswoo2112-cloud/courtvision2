/* =========================================================
   COURTVISION PRO
   PRO BASKETBALL ANALYTICS
   app.js
========================================================= */

"use strict";

/* =========================================================
   01. BASIC HELPERS
========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [
    ...document.querySelectorAll(selector)
];

const STORAGE_KEY = "COURTVISION_PRO_FINAL_DATA_V1";


function escapeHTML(value = "") {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function uuid() {

    if (window.crypto?.randomUUID) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
}


function formatClock(seconds) {

    seconds = Math.max(
        0,
        Math.floor(Number(seconds) || 0)
    );

    const minutes = Math.floor(seconds / 60);

    const secs = seconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0")
    );
}


function percentage(made, attempts) {

    if (!attempts) {
        return "기록 없음";
    }

    return (
        ((made / attempts) * 100).toFixed(1) +
        "%"
    );
}


function numberOrEmpty(value) {

    return value === null ||
        value === undefined ||
        Number.isNaN(value)
        ? "기록 없음"
        : value;
}


/* =========================================================
   02. DEFAULT DATA
========================================================= */

function createDefaultState() {

    return {

        version: 1,

        mode: "3v3",

        currentPage: "live",

        setupComplete: false,

        selectedTeam: "A",

        selectedPlayerId: null,

        pendingShot: null,

        pendingPass: null,

        game: {

            id: uuid(),

            name: "",

            tournament: "",

            date:
                new Date()
                    .toISOString()
                    .slice(0, 10),

            teamA: "HOME",

            teamB: "AWAY",

            period: 1,

            clock: 600,

            shotClock: 14,

            running: false,

            ended: false

        },

        players: [],

        events: [],

        shots: [],

        passes: [],

        savedGames: [],

        videoMarkers: [],

        league: {

            name: "",

            teams: [],

            games: []

        }

    };
}


let state = loadState();


function loadState() {

    try {

        const raw =
            localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return createDefaultState();
        }

        const parsed = JSON.parse(raw);

        return {

            ...createDefaultState(),

            ...parsed,

            game: {
                ...createDefaultState().game,
                ...(parsed.game || {})
            },

            league: {
                ...createDefaultState().league,
                ...(parsed.league || {})
            }

        };

    } catch (error) {

        console.error(error);

        return createDefaultState();
    }
}


function saveState() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );
}


/* =========================================================
   03. TOAST
========================================================= */

let toastTimer = null;


function showToast(message) {

    const toast = $("#toast");

    if (!toast) {
        return;
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 1800);
}


/* =========================================================
   04. MODE
========================================================= */

function getRosterSize() {

    return state.mode === "3v3"
        ? 3
        : 5;
}


function getScoringRule(type, made = true) {

    if (!made) {
        return 0;
    }

    if (type === "FT") {
        return 1;
    }

    if (state.mode === "3v3") {

        if (type === "2PT") {
            return 1;
        }

        if (type === "3PT") {
            return 2;
        }

    } else {

        if (type === "2PT") {
            return 2;
        }

        if (type === "3PT") {
            return 3;
        }

    }

    return 0;
}


function shotTypeLabel(type) {

    switch (type) {

        case "FT":
            return "자유투";

        case "2PT":
            return "2점 필드골";

        case "3PT":
            return "3점 필드골";

        default:
            return "슛";

    }
}


/* =========================================================
   05. PLAYERS
========================================================= */

function getPlayers(team = null) {

    if (!team) {
        return state.players;
    }

    return state.players.filter(
        player => player.team === team
    );
}


function getPlayer(id) {

    return state.players.find(
        player => player.id === id
    );
}


function getSelectedPlayer() {

    let player =
        getPlayer(state.selectedPlayerId);

    if (player) {
        return player;
    }

    player =
        getPlayers(state.selectedTeam)[0];

    if (player) {

        state.selectedPlayerId =
            player.id;

    }

    return player || null;
}


function teamName(team) {

    return team === "A"
        ? state.game.teamA
        : state.game.teamB;
}


/* =========================================================
   06. PLAYER STATISTICS
========================================================= */

function emptyStats() {

    return {

        PTS: 0,

        FGM: 0,
        FGA: 0,

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


function getPlayerStats(playerId) {

    const stats = emptyStats();

    const events =
        state.events.filter(
            event => event.playerId === playerId
        );

    events.forEach(event => {

        if (event.kind === "shot") {

            stats.FGA += 1;

            if (event.made) {
                stats.FGM += 1;
            }

            if (event.type === "FT") {

                stats.FTA += 1;

                if (event.made) {
                    stats.FTM += 1;
                }

            } else {

                stats.TPA += 1;

                if (event.type === "3PT" && event.made) {
                    stats.TPM += 1;
                }

                if (event.type === "3PT") {
                    stats.TPA += 0;
                }

            }

            if (event.type === "3PT" && event.made) {
                stats.TPM += 1;
            }

            stats.PTS += event.points;

        }


        if (event.kind === "stat") {

            if (
                Object.prototype.hasOwnProperty.call(
                    stats,
                    event.stat
                )
            ) {

                stats[event.stat] += 1;

            }

        }

    });

    /*
       위에서 3점 성공을 TPM에 한 번 더 넣을 수 있으므로
       실제 3점 시도/성공은 shots 데이터 기준으로 다시 계산한다.
    */

    const shots =
        state.shots.filter(
            shot => shot.playerId === playerId
        );

    stats.TPA =
        shots.filter(
            shot => shot.type === "3PT"
        ).length;

    stats.TPM =
        shots.filter(
            shot =>
                shot.type === "3PT" &&
                shot.made
        ).length;

    return stats;
}


/* =========================================================
   07. TEAM STATISTICS
========================================================= */

function getTeamStats(team) {

    const stats = emptyStats();

    getPlayers(team).forEach(player => {

        const playerStats =
            getPlayerStats(player.id);

        Object.keys(stats).forEach(key => {

            stats[key] +=
                playerStats[key] || 0;

        });

    });

    return stats;
}


/* =========================================================
   08. EVENT CREATION
========================================================= */

function createEvent(
    kind,
    playerId,
    team,
    extra = {}
) {

    const event = {

        id: uuid(),

        kind,

        playerId,

        team,

        period: state.game.period,

        clock: state.game.clock,

        timestamp: Date.now(),

        ...extra

    };

    state.events.push(event);

    return event;
}


/* =========================================================
   09. SHOOTING
========================================================= */

function startShot(type, made) {

    const player =
        getSelectedPlayer();

    if (!player) {

        showToast(
            "먼저 선수를 선택하세요."
        );

        return;

    }

    state.pendingShot = {

        type,

        made,

        playerId: player.id,

        team: player.team

    };

    state.currentPage = "shots";

    saveState();

    render();

    showToast(
        `${made ? "성공" : "실패"} · ${shotTypeLabel(type)} · 코트를 클릭하세요.`
    );
}


function addShotAtPosition(x, y) {

    const pending =
        state.pendingShot;

    if (!pending) {

        showToast(
            "먼저 슛 성공/실패와 종류를 선택하세요."
        );

        return;

    }

    const event =
        createEvent(
            "shot",
            pending.playerId,
            pending.team,
            {

                type: pending.type,

                made: pending.made,

                points:
                    getScoringRule(
                        pending.type,
                        pending.made
                    )

            }
        );


    const shot = {

        eventId: event.id,

        playerId:
            pending.playerId,

        team:
            pending.team,

        type:
            pending.type,

        made:
            pending.made,

        points:
            event.points,

        x: Math.max(
            0,
            Math.min(1, x)
        ),

        y: Math.max(
            0,
            Math.min(1, y)
        ),

        zone:
            classifyShotZone(x, y),

        period:
            state.game.period,

        clock:
            state.game.clock

    };


    state.shots.push(shot);

    state.pendingShot = null;

    state.game.shotClock = 14;

    saveState();

    render();

    showToast(
        "실제 슛 위치가 기록되었습니다."
    );
}


/* =========================================================
   10. SHOT ZONE
========================================================= */

function classifyShotZone(x, y) {

    /*
       코트 좌표:
       x = 0 ~ 1
       y = 0 ~ 1

       현재 UI 코트 기준으로
       위쪽이 공격 림 방향.
    */

    if (y < 0.22) {

        return "림";

    }

    if (
        y < 0.44 &&
        x > 0.34 &&
        x < 0.66
    ) {

        return "페인트존";

    }

    if (
        y < 0.61 &&
        x > 0.29 &&
        x < 0.71
    ) {

        return "미드레인지";

    }

    if (
        y > 0.78 &&
        x < 0.22
    ) {

        return "좌측 코너 3점";

    }

    if (
        y > 0.78 &&
        x > 0.78
    ) {

        return "우측 코너 3점";

    }

    if (x < 0.34) {

        return "좌측 윙 3점";

    }

    if (x > 0.66) {

        return "우측 윙 3점";

    }

    return "탑 3점";
}


/* =========================================================
   11. BASIC STATS
========================================================= */

function addBasicStat(stat) {

    const player =
        getSelectedPlayer();

    if (!player) {

        showToast(
            "먼저 선수를 선택하세요."
        );

        return;

    }

    createEvent(
        "stat",
        player.id,
        player.team,
        {
            stat
        }
    );

    saveState();

    render();

    showToast(
        getStatLabel(stat) +
        " 기록 완료"
    );
}


function getStatLabel(stat) {

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
   12. PASS NETWORK
========================================================= */

function startPass() {

    const player =
        getSelectedPlayer();

    if (!player) {

        showToast(
            "먼저 패스하는 선수를 선택하세요."
        );

        return;

    }

    state.pendingPass = {

        passerId: player.id,

        team: player.team

    };

    saveState();

    render();

    showToast(
        "같은 팀의 받는 선수를 선택하세요."
    );
}


function completePass(receiverId) {

    const pending =
        state.pendingPass;

    if (!pending) {
        return;
    }

    const receiver =
        getPlayer(receiverId);

    if (!receiver) {
        return;
    }

    if (
        receiver.team !== pending.team ||
        receiver.id === pending.passerId
    ) {

        showToast(
            "같은 팀의 다른 선수를 선택하세요."
        );

        return;

    }

    const event =
        createEvent(
            "pass",
            pending.passerId,
            pending.team,
            {
                receiverId
            }
        );

    state.passes.push({

        eventId: event.id,

        passerId:
            pending.passerId,

        receiverId,

        team:
            pending.team,

        period:
            state.game.period,

        clock:
            state.game.clock

    });

    state.pendingPass = null;

    saveState();

    render();

    showToast(
        "패스 연결이 기록되었습니다."
    );
}


/* =========================================================
   13. UNDO
========================================================= */

function undoLastEvent() {

    if (!state.events.length) {

        showToast(
            "취소할 기록이 없습니다."
        );

        return;

    }

    const event =
        state.events.pop();

    if (event.kind === "shot") {

        state.shots =
            state.shots.filter(
                shot =>
                    shot.eventId !== event.id
            );

    }

    if (event.kind === "pass") {

        state.passes =
            state.passes.filter(
                pass =>
                    pass.eventId !== event.id
            );

    }

    saveState();

    render();

    showToast(
        "마지막 기록을 취소했습니다."
    );
}


/* =========================================================
   14. LIVE CLOCK
========================================================= */

let clockTimer = null;


function toggleGameClock() {

    if (state.game.ended) {

        showToast(
            "이미 종료된 경기입니다."
        );

        return;

    }

    state.game.running =
        !state.game.running;

    saveState();

    render();
}


function endGame() {

    state.game.running = false;

    state.game.ended = true;

    saveState();

    render();

    showToast(
        "경기가 종료되었습니다."
    );
}


function nextPeriod() {

    if (state.mode === "3v3") {

        showToast(
            "3대3은 현재 경기 종료 방식으로 관리합니다."
        );

        return;

    }

    if (state.game.period >= 4) {

        endGame();

        return;

    }

    state.game.period += 1;

    state.game.clock = 600;

    state.game.shotClock = 24;

    saveState();

    render();

    showToast(
        `${state.game.period}쿼터가 시작되었습니다.`
    );
}


function runClock() {

    clearInterval(clockTimer);

    clockTimer = setInterval(() => {

        if (
            !state.game.running ||
            state.game.ended
        ) {

            return;

        }

        if (state.game.clock > 0) {
            state.game.clock -= 1;
        }

        if (state.game.shotClock > 0) {
            state.game.shotClock -= 1;
        }

        if (state.game.clock <= 0) {

            state.game.clock = 0;

            state.game.running = false;

            if (
                state.mode === "5v5" &&
                state.game.period < 4
            ) {

                nextPeriod();

            } else {

                state.game.ended = true;

            }

        }

        saveState();

        render();

    }, 1000);
}


/* =========================================================
   15. SAVE GAME
========================================================= */

function saveCurrentGame() {

    const snapshot =
        JSON.parse(
            JSON.stringify(state)
        );

    snapshot.currentPage = "live";

    snapshot.game.running = false;

    snapshot.savedAt =
        new Date().toISOString();

    state.savedGames.push(
        snapshot
    );

    saveState();

    showToast(
        "현재 경기를 저장했습니다."
    );
}


/* =========================================================
   16. RESET
========================================================= */

function resetEverything() {

    const ok =
        confirm(
            "현재 경기의 기록과 설정을 모두 초기화할까요?"
        );

    if (!ok) {
        return;
    }

    state = createDefaultState();

    saveState();

    render();

    openSetupModal();
}


/* =========================================================
   17. LIVE RENDER
========================================================= */

function renderLive() {

    const page =
        $("#page-live");

    if (!page) {
        return;
    }

    const teamA =
        getTeamStats("A");

    const teamB =
        getTeamStats("B");

    const selected =
        getSelectedPlayer();


    page.innerHTML = `

        <div class="grid live-layout">

            <!-- LEFT -->
            <div class="grid">

                <div class="panel">

                    <div class="panel-title">

                        <div>
                            <h3>경기 정보</h3>
                            <div class="panel-subtitle">
                                실제 입력 데이터만 표시
                            </div>
                        </div>

                        <span class="badge blue">
                            ${state.mode}
                        </span>

                    </div>

                    <div class="stat-list">

                        <div class="stat-row">
                            <span class="stat-label">
                                경기
                            </span>
                            <b class="stat-value">
                                ${escapeHTML(
                                    state.game.name ||
                                    "미설정"
                                )}
                            </b>
                        </div>

                        <div class="stat-row">
                            <span class="stat-label">
                                대회
                            </span>
                            <b class="stat-value">
                                ${escapeHTML(
                                    state.game.tournament ||
                                    "미설정"
                                )}
                            </b>
                        </div>

                        <div class="stat-row">
                            <span class="stat-label">
                                날짜
                            </span>
                            <b class="stat-value">
                                ${escapeHTML(
                                    state.game.date
                                )}
                            </b>
                        </div>

                        <div class="stat-row">
                            <span class="stat-label">
                                규칙
                            </span>
                            <b class="stat-value">
                                ${
                                    state.mode === "3v3"
                                    ? "FT 1 · 2PT 1 · 3PT 2"
                                    : "FT 1 · 2PT 2 · 3PT 3"
                                }
                            </b>
                        </div>

                    </div>

                </div>


                ${renderRosterPanel("A")}

                ${renderRosterPanel("B")}

            </div>


            <!-- CENTER -->
            <div class="grid">

                <div class="panel">

                    <div class="scoreboard">

                        <div class="score-team">

                            <div class="score-team-name">
                                ${escapeHTML(
                                    state.game.teamA
                                )}
                            </div>

                            <div class="score-number">
                                ${teamA.PTS}
                            </div>

                        </div>


                        <div class="score-center">

                            <div class="game-clock">
                                ${formatClock(
                                    state.game.clock
                                )}
                            </div>

                            <div class="shot-clock">
                                샷클락
                                ${state.game.shotClock}초
                            </div>

                            <div class="period-label">
                                ${
                                    state.game.ended
                                    ? "경기 종료"
                                    : state.game.period +
                                      "쿼터"
                                }
                            </div>

                        </div>


                        <div class="score-team">

                            <div class="score-team-name">
                                ${escapeHTML(
                                    state.game.teamB
                                )}
                            </div>

                            <div class="score-number">
                                ${teamB.PTS}
                            </div>

                        </div>

                    </div>

                </div>


                <div class="panel">

                    <div class="panel-title">

                        <div>

                            <h3>
                                선수 액션
                            </h3>

                            <div class="panel-subtitle">

                                ${
                                    selected
                                    ? `#${escapeHTML(
                                        selected.no
                                      )}
                                      ${escapeHTML(
                                        selected.name
                                      )}`
                                    : "선수 미선택"
                                }

                            </div>

                        </div>

                        ${
                            state.pendingPass
                            ? `
                                <span class="badge yellow">
                                    받는 선수 선택
                                </span>
                              `
                            : `
                                <span class="badge">
                                    ${escapeHTML(
                                        teamName(
                                            selected?.team ||
                                            state.selectedTeam
                                        )
                                    )}
                                </span>
                              `
                        }

                    </div>


                    <div class="action-grid">

                        <button
                            class="action-btn shoot"
                            data-shot-action="FT"
                        >
                            자유투
                        </button>

                        <button
                            class="action-btn shoot"
                            data-shot-action="2PT"
                        >
                            2점 필드골
                        </button>

                        <button
                            class="action-btn shoot"
                            data-shot-action="3PT"
                        >
                            3점 필드골
                        </button>


                        <button
                            class="action-btn"
                            data-stat-action="REB"
                        >
                            리바운드
                        </button>

                        <button
                            class="action-btn"
                            data-stat-action="AST"
                        >
                            어시스트
                        </button>

                        <button
                            class="action-btn"
                            data-stat-action="STL"
                        >
                            스틸
                        </button>

                        <button
                            class="action-btn"
                            data-stat-action="BLK"
                        >
                            블록
                        </button>

                        <button
                            class="action-btn"
                            data-stat-action="TOV"
                        >
                            턴오버
                        </button>

                        <button
                            class="action-btn"
                            data-stat-action="PF"
                        >
                            파울
                        </button>


                        <button
                            class="action-btn pass"
                            id="passAction"
                        >
                            패스
                        </button>

                        <button
                            class="action-btn warn"
                            id="undoAction"
                        >
                            마지막 기록 취소
                        </button>

                        <button
                            class="action-btn"
                            id="timeoutAction"
                        >
                            타임아웃
                        </button>


                        <button
                            class="action-btn"
                            id="clockAction"
                        >
                            ${
                                state.game.running
                                ? "경기 일시정지"
                                : "경기 시작"
                            }
                        </button>

                        ${
                            state.mode === "5v5"
                            ? `
                                <button
                                    class="action-btn"
                                    id="periodAction"
                                >
                                    다음 쿼터
                                </button>
                              `
                            : ""
                        }

                        <button
                            class="action-btn danger"
                            id="endGameAction"
                        >
                            경기 종료
                        </button>

                    </div>

                </div>


                <div class="panel">

                    <div class="panel-title">

                        <h3>최근 기록</h3>

                        <span class="badge">
                            ${state.events.length} 이벤트
                        </span>

                    </div>

                    ${
                        state.events.length
                        ? state.events
                            .slice(-10)
                            .reverse()
                            .map(renderEvent)
                            .join("")
                        : `
                            <div class="empty-state">
                                아직 기록이 없습니다.
                            </div>
                          `
                    }

                </div>

            </div>


            <!-- RIGHT -->
            <div class="grid">

                <div class="panel">

                    <div class="panel-title">

                        <div>
                            <h3>
                                미니 슛차트
                            </h3>

                            <div class="panel-subtitle">
                                라이브에서는 미니 차트만 표시
                            </div>
                        </div>

                        <button
                            class="ghost-btn"
                            data-go-page="shots"
                        >
                            전체 보기
                        </button>

                    </div>

                    <div class="mini-court">

                        ${renderShotDots()}

                        <div class="court-center-line"></div>

                        <div class="court-center-circle"></div>

                        <div class="court-rim"></div>

                    </div>

                </div>


                <div class="panel">

                    <div class="panel-title">

                        <h3>
                            라이브 리더
                        </h3>

                    </div>

                    ${
                        renderLeaders()
                    }

                </div>


                <div class="panel">

                    <div class="panel-title">

                        <h3>
                            팀 요약
                        </h3>

                    </div>

                    ${renderTeamSummary("A")}

                    ${renderTeamSummary("B")}

                </div>

            </div>

        </div>

    `;
}


function renderRosterPanel(team) {

    const players =
        getPlayers(team);

    return `

        <div class="panel">

            <div class="panel-title">

                <h3>
                    ${escapeHTML(
                        teamName(team)
                    )}
                </h3>

                <span class="badge">
                    ${players.length}명
                </span>

            </div>

            <div class="roster-grid">

                ${
                    players.length
                    ? players
                        .map(player => {

                            const stats =
                                getPlayerStats(
                                    player.id
                                );

                            return `

                                <button
                                    class="
                                        player-card
                                        ${
                                            state.selectedPlayerId ===
                                            player.id
                                            ? "selected"
                                            : ""
                                        }
                                    "
                                    data-select-player="${player.id}"
                                >

                                    <div class="player-number">
                                        #${escapeHTML(
                                            player.number
                                        )}
                                    </div>

                                    <div class="player-name">
                                        ${escapeHTML(
                                            player.name
                                        )}
                                    </div>

                                    <div class="player-mini">
                                        ${stats.PTS}점
                                        · ${stats.REB}R
                                        · ${stats.AST}A
                                    </div>

                                </button>

                            `;

                        })
                        .join("")
                    : `
                        <div class="empty-state">
                            선수 설정에서 선수를 등록하세요.
                        </div>
                      `
                }

            </div>

        </div>

    `;
}


function renderShotDots() {

    return state.shots
        .map(shot => {

            return `

                <i
                    class="
                        shot-dot
                        ${
                            shot.made
                            ? "made"
                            : "miss"
                        }
                    "
                    style="
                        left:${shot.x * 100}%;
                        top:${shot.y * 100}%;
                    "
                    title="
                        ${escapeHTML(
                            shot.zone
                        )}
                    "
                ></i>

            `;

        })
        .join("");
}


function renderEvent(event) {

    const player =
        getPlayer(event.playerId);

    let text = "";

    if (event.kind === "shot") {

        text =
            `${event.made ? "성공" : "실패"} · ` +
            `${shotTypeLabel(event.type)}` +
            (
                event.points
                ? ` +${event.points}`
                : ""
            );

    } else if (event.kind === "stat") {

        text =
            getStatLabel(
                event.stat
            );

    } else if (event.kind === "pass") {

        const receiver =
            getPlayer(
                event.receiverId
            );

        text =
            `패스 → ${
                receiver
                ? escapeHTML(
                    receiver.name
                  )
                : ""
            }`;

    } else {

        text = "타임아웃";

    }

    return `

        <div class="timeline-event">

            <span class="timeline-time">
                ${formatClock(
                    event.clock
                )}
            </span>

            <span class="timeline-team">
                ${escapeHTML(
                    teamName(
                        event.team
                    )
                )}
            </span>

            <span class="timeline-text">

                ${
                    player
                    ? `#${escapeHTML(
                        player.number
                      )}
                      ${escapeHTML(
                        player.name
                      )} · `
                    : ""
                }

                ${text}

            </span>

        </div>

    `;
}


function renderLeaders() {

    const players =
        state.players
            .map(player => ({

                player,

                stats:
                    getPlayerStats(
                        player.id
                    )

            }))
            .sort(
                (a, b) =>
                    b.stats.PTS -
                    a.stats.PTS
            )
            .slice(0, 6);


    if (!players.length) {

        return `
            <div class="empty-state">
                기록 없음
            </div>
        `;

    }


    return players
        .map(item => {

            return `

                <div class="stat-row">

                    <span>
                        #${escapeHTML(
                            item.player.number
                        )}
                        ${escapeHTML(
                            item.player.name
                        )}
                    </span>

                    <b class="stat-value">
                        ${item.stats.PTS}점
                        · ${item.stats.REB}R
                        · ${item.stats.AST}A
                    </b>

                </div>

            `;

        })
        .join("");
}


function renderTeamSummary(team) {

    const stats =
        getTeamStats(team);

    return `

        <div class="stat-row">

            <span class="stat-label">
                ${escapeHTML(
                    teamName(team)
                )}
            </span>

            <b class="stat-value">
                ${stats.PTS}점
            </b>

        </div>

        <div class="stat-row">

            <span class="stat-label">
                FG%
            </span>

            <b class="stat-value">
                ${percentage(
                    stats.FGM,
                    stats.FGA
                )}
            </b>

        </div>

        <div class="stat-row">

            <span class="stat-label">
                3P%
            </span>

            <b class="stat-value">
                ${percentage(
                    stats.TPM,
                    stats.TPA
                )}
            </b>

        </div>

        <div class="stat-row">

            <span class="stat-label">
                REB
            </span>

            <b class="stat-value">
                ${stats.REB}
            </b>

        </div>

    `;
}


/* =========================================================
   18. RECORD PAGE
========================================================= */

function renderRecords() {

    const page =
        $("#page-records");

    if (!page) {
        return;
    }

    const A =
        getTeamStats("A");

    const B =
        getTeamStats("B");


    page.innerHTML = `

        <div class="panel">

            <div class="panel-title">

                <div>
                    <h3>
                        선수 기록
                    </h3>

                    <div class="panel-subtitle">
                        ${state.mode}
                    </div>
                </div>

                <span class="badge">
                    ${state.events.length} 이벤트
                </span>

            </div>


            <div class="kpi-grid">

                ${kpi(
                    "팀 A",
                    `${A.PTS}점`
                )}

                ${kpi(
                    "팀 B",
                    `${B.PTS}점`
                )}

                ${kpi(
                    "팀 A FG%",
                    percentage(
                        A.FGM,
                        A.FGA
                    )
                )}

                ${kpi(
                    "팀 A 3P%",
                    percentage(
                        A.TPM,
                        A.TPA
                    )
                )}

                ${kpi(
                    "팀 A AST",
                    A.AST
                )}

                ${kpi(
                    "팀 A TOV",
                    A.TOV
                )}

            </div>


            <div class="table-wrap">

                <table class="data-table">

                    <thead>

                        <tr>

                            <th>선수</th>
                            <th>팀</th>
                            <th>PTS</th>
                            <th>FG</th>
                            <th>FG%</th>
                            <th>3P</th>
                            <th>3P%</th>
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
                            state.players.length
                            ? state.players
                                .map(
                                    renderPlayerRow
                                )
                                .join("")
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


function renderPlayerRow(player) {

    const s =
        getPlayerStats(
            player.id
        );

    return `

        <tr>

            <td>
                #${escapeHTML(
                    player.number
                )}
                ${escapeHTML(
                    player.name
                )}
            </td>

            <td>
                ${escapeHTML(
                    teamName(
                        player.team
                    )
                )}
            </td>

            <td>${s.PTS}</td>

            <td>
                ${s.FGM}/${s.FGA}
            </td>

            <td>
                ${percentage(
                    s.FGM,
                    s.FGA
                )}
            </td>

            <td>
                ${s.TPM}/${s.TPA}
            </td>

            <td>
                ${percentage(
                    s.TPM,
                    s.TPA
                )}
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
}


function kpi(label, value) {

    return `

        <div class="kpi-card">

            <label>
                ${escapeHTML(
                    label
                )}
            </label>

            <strong>
                ${value}
            </strong>

        </div>

    `;
}


/* =========================================================
   19. SHOT CHART PAGE
========================================================= */

function renderShots() {

    const page =
        $("#page-shots");

    if (!page) {
        return;
    }


    const shots =
        state.shots.filter(
            shot =>
                shot.team ===
                state.selectedTeam &&
                (
                    !state.selectedPlayerId ||
                    shot.playerId ===
                    state.selectedPlayerId
                )
        );


    const made =
        shots.filter(
            shot => shot.made
        );


    const fieldShots =
        shots.filter(
            shot =>
                shot.type !== "FT"
        );


    const fieldMade =
        fieldShots.filter(
            shot => shot.made
        );


    page.innerHTML = `

        <div class="panel">

            <div class="panel-title">

                <div>

                    <h3>
                        슛차트
                    </h3>

                    <div class="panel-subtitle">
                        실제 코트 위치 입력
                    </div>

                </div>

                <span class="badge blue">
                    ${shots.length}개 기록
                </span>

            </div>


            <div class="filters">

                <select
                    class="filter-select"
                    id="shotTeamFilter"
                >

                    <option value="A"
                        ${
                            state.selectedTeam === "A"
                            ? "selected"
                            : ""
                        }
                    >
                        팀 A ·
                        ${escapeHTML(
                            state.game.teamA
                        )}
                    </option>

                    <option value="B"
                        ${
                            state.selectedTeam === "B"
                            ? "selected"
                            : ""
                        }
                    >
                        팀 B ·
                        ${escapeHTML(
                            state.game.teamB
                        )}
                    </option>

                </select>


                <select
                    class="filter-select"
                    id="shotPlayerFilter"
                >

                    <option value="">
                        선수 전체
                    </option>

                    ${
                        getPlayers(
                            state.selectedTeam
                        )
                        .map(player => `

                            <option
                                value="${player.id}"
                                ${
                                    state.selectedPlayerId ===
                                    player.id
                                    ? "selected"
                                    : ""
                                }
                            >
                                #${escapeHTML(
                                    player.number
                                )}
                                ${escapeHTML(
                                    player.name
                                )}
                            </option>

                        `)
                        .join("")
                    }

                </select>


                <button
                    class="tab-btn ${
                        state.pendingShot?.made === true
                        ? "active"
                        : ""
                    }"
                    data-shot-made="true"
                >
                    슛 성공
                </button>


                <button
                    class="tab-btn ${
                        state.pendingShot?.made === false
                        ? "active"
                        : ""
                    }"
                    data-shot-made="false"
                >
                    슛 실패
                </button>


                <button
                    class="tab-btn ${
                        state.pendingShot?.type === "FT"
                        ? "active"
                        : ""
                    }"
                    data-shot-type="FT"
                >
                    자유투
                </button>


                <button
                    class="tab-btn ${
                        state.pendingShot?.type === "2PT"
                        ? "active"
                        : ""
                    }"
                    data-shot-type="2PT"
                >
                    2점 필드골
                </button>


                <button
                    class="tab-btn ${
                        state.pendingShot?.type === "3PT"
                        ? "active"
                        : ""
                    }"
                    data-shot-type="3PT"
                >
                    3점 필드골
                </button>

            </div>


            <div class="grid grid-2">


                <!-- COURT -->

                <div>

                    <div
                        class="basketball-court"
                        id="shotCourt"
                    >

                        ${renderShotDots()}

                        <div class="court-center-line"></div>

                        <div class="court-center-circle"></div>

                        <div class="court-paint"></div>

                        <div class="court-rim"></div>

                        <div class="court-backboard"></div>

                        <div
                            class="court-click-layer"
                        ></div>

                    </div>

                </div>


                <!-- ANALYSIS -->

                <div class="grid">

                    <div class="panel">

                        <div class="kpi-grid">

                            ${kpi(
                                "시도",
                                shots.length
                            )}

                            ${kpi(
                                "성공",
                                made.length
                            )}

                            ${kpi(
                                "FG%",
                                percentage(
                                    fieldMade.length,
                                    fieldShots.length
                                )
                            )}

                            ${kpi(
                                "2점 성공",
                                shots.filter(
                                    s =>
                                        s.type === "2PT" &&
                                        s.made
                                ).length
                            )}

                            ${kpi(
                                "3점 성공",
                                shots.filter(
                                    s =>
                                        s.type === "3PT" &&
                                        s.made
                                ).length
                            )}

                            ${kpi(
                                "득점",
                                shots.reduce(
                                    (sum, shot) =>
                                        sum +
                                        shot.points,
                                    0
                                )
                            )}

                        </div>

                    </div>


                    <div class="panel">

                        <div class="panel-title">

                            <h3>
                                구역별 슛 기록
                            </h3>

                        </div>

                        ${renderZoneTable(
                            shots
                        )}

                    </div>


                    <div class="panel">

                        <div class="notice">

                            ${
                                state.pendingShot
                                ? `
                                    현재 입력:
                                    <b>
                                        ${
                                            state.pendingShot.made
                                            ? "성공"
                                            : "실패"
                                        }
                                    </b>
                                    ·
                                    <b>
                                        ${shotTypeLabel(
                                            state.pendingShot.type
                                        )}
                                    </b>
                                    <br>
                                    코트에서 실제 위치를 클릭하세요.
                                  `
                                : `
                                    슛 성공/실패와
                                    슛 종류를 선택한 뒤
                                    코트를 클릭하세요.
                                  `
                            }

                        </div>

                    </div>

                </div>

            </div>

        </div>

    `;
}


function renderZoneTable(shots) {

    const zones = [

        "림",

        "페인트존",

        "미드레인지",

        "좌측 코너 3점",

        "우측 코너 3점",

        "좌측 윙 3점",

        "우측 윙 3점",

        "탑 3점"

    ];


    return `

        <div class="table-wrap">

            <table class="data-table">

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
                        zones
                            .map(zone => {

                                const list =
                                    shots.filter(
                                        shot =>
                                            shot.zone ===
                                            zone
                                    );

                                const made =
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
                                            ${made.length}
                                        </td>

                                        <td>
                                            ${percentage(
                                                made.length,
                                                list.length
                                            )}
                                        </td>

                                    </tr>

                                `;

                            })
                            .join("")
                    }

                </tbody>

            </table>

        </div>

    `;
}


/* =========================================================
   20. VIDEO PAGE
========================================================= */

function renderVideo() {

    const page =
        $("#page-video");

    if (!page) {
        return;
    }


    page.innerHTML = `

        <div class="panel">

            <div class="panel-title">

                <div>

                    <h3>
                        영상 분석
                    </h3>

                    <div class="panel-subtitle">
                        경기 영상을 불러와 장면을 표시할 수 있습니다.
                    </div>

                </div>

                <input
                    type="file"
                    id="videoFile"
                    accept="video/*"
                >

            </div>


            <video
                id="analysisVideo"
                class="video-player"
                controls
            ></video>


            <div class="video-controls">

                <button
                    id="addVideoMarker"
                    class="ghost-btn"
                >
                    현재 시점 마커
                </button>

                <button
                    id="clearVideoMarkers"
                    class="danger-btn"
                >
                    마커 초기화
                </button>

            </div>


            <div style="margin-top:12px">

                ${
                    state.videoMarkers.length
                    ? state.videoMarkers
                        .map(
                            (marker, index) => `

                                <div
                                    class="video-marker"
                                >

                                    <span>
                                        ${formatClock(
                                            marker.time
                                        )}
                                        ·
                                        ${escapeHTML(
                                            marker.label
                                        )}
                                    </span>

                                    <button
                                        data-seek-video="${marker.time}"
                                    >
                                        이동
                                    </button>

                                </div>

                            `
                        )
                        .join("")
                    : `
                        <div class="empty-state">
                            아직 영상 마커가 없습니다.
                        </div>
                      `
                }

            </div>

        </div>

    `;
}


/* =========================================================
   21. TEAM ANALYSIS
========================================================= */

function renderAnalysis() {

    const page =
        $("#page-analysis");

    if (!page) {
        return;
    }


    const A =
        getTeamStats("A");

    const B =
        getTeamStats("B");


    page.innerHTML = `

        <div class="tabs">

            <button
                class="tab-btn active"
                data-analysis-tab="team"
            >
                팀 비교
            </button>

            <button
                class="tab-btn"
                data-analysis-tab="network"
            >
                패스 네트워크
            </button>

            <button
                class="tab-btn"
                data-analysis-tab="flow"
            >
                경기 흐름
            </button>

            <button
                class="tab-btn"
                data-analysis-tab="lineup"
            >
                라인업
            </button>

        </div>


        <div id="analysisContent">

            ${renderTeamAnalysis(A, B)}

        </div>

    `;
}


function renderTeamAnalysis(A, B) {

    return `

        <div class="grid grid-2">

            <div class="panel">

                <div class="panel-title">

                    <h3>
                        팀 비교
                    </h3>

                </div>

                <div class="bar-list">

                    ${compareBar(
                        "득점",
                        A.PTS,
                        B.PTS
                    )}

                    ${compareBar(
                        "FG%",
                        percentage(
                            A.FGM,
                            A.FGA
                        ),
                        percentage(
                            B.FGM,
                            B.FGA
                        )
                    )}

                    ${compareBar(
                        "3P%",
                        percentage(
                            A.TPM,
                            A.TPA
                        ),
                        percentage(
                            B.TPM,
                            B.TPA
                        )
                    )}

                    ${compareBar(
                        "REB",
                        A.REB,
                        B.REB
                    )}

                    ${compareBar(
                        "AST",
                        A.AST,
                        B.AST
                    )}

                    ${compareBar(
                        "STL",
                        A.STL,
                        B.STL
                    )}

                    ${compareBar(
                        "BLK",
                        A.BLK,
                        B.BLK
                    )}

                    ${compareBar(
                        "TOV",
                        A.TOV,
                        B.TOV
                    )}

                </div>

            </div>


            <div class="panel">

                <div class="panel-title">

                    <h3>
                        효율 지표
                    </h3>

                </div>

                ${renderAdvancedMetrics(
                    "A"
                )}

                ${renderAdvancedMetrics(
                    "B"
                )}

            </div>

        </div>


        <div
            class="grid grid-2"
            style="margin-top:15px"
        >

            <div class="panel">

                <div class="panel-title">

                    <h3>
                        ${escapeHTML(
                            state.game.teamA
                        )} 팀 레이더
                    </h3>

                </div>

                ${renderRadar("A")}

            </div>


            <div class="panel">

                <div class="panel-title">

                    <h3>
                        ${escapeHTML(
                            state.game.teamB
                        )} 팀 레이더
                    </h3>

                </div>

                ${renderRadar("B")}

            </div>

        </div>

    `;
}


function compareBar(label, a, b) {

    const av =
        parseFloat(a);

    const bv =
        parseFloat(b);

    const max =
        Math.max(
            Number.isFinite(av) ? av : 0,
            Number.isFinite(bv) ? bv : 0,
            1
        );


    return `

        <div class="bar-row">

            <span class="bar-label">
                ${label}
            </span>

            <div class="bar-track">

                <i
                    class="bar-fill"
                    style="
                        width:${
                            Number.isFinite(av)
                            ? av / max * 100
                            : 0
                        }%;
                    "
                ></i>

            </div>

            <span class="bar-value">
                ${a}
            </span>

        </div>


        <div class="bar-row">

            <span class="bar-label">
                ${escapeHTML(
                    state.game.teamB
                )}
            </span>

            <div class="bar-track">

                <i
                    class="bar-fill"
                    style="
                        width:${
                            Number.isFinite(bv)
                            ? bv / max * 100
                            : 0
                        }%;
                    "
                ></i>

            </div>

            <span class="bar-value">
                ${b}
            </span>

        </div>

    `;
}


/* =========================================================
   22. ADVANCED METRICS
========================================================= */

function calculateAdvanced(team) {

    const stats =
        getTeamStats(team);


    const possessions =
        stats.FGA +
        0.44 * stats.FTA -
        stats.ORB +
        stats.TOV;


    const eFG =
        stats.FGA
        ? (
            (
                stats.FGM +
                0.5 * stats.TPM
            ) /
            stats.FGA
        ) * 100
        : null;


    const TS =
        (
            stats.FGA +
            0.44 * stats.FTA
        )
        ? (
            stats.PTS /
            (
                2 *
                (
                    stats.FGA +
                    0.44 *
                    stats.FTA
                )
            )
        ) * 100
        : null;


    const ORtg =
        possessions
        ? (
            stats.PTS /
            possessions
        ) * 100
        : null;


    const ASTTO =
        stats.TOV
        ? stats.AST / stats.TOV
        : null;


    return {

        eFG,

        TS,

        ORtg,

        ASTTO,

        possessions

    };
}


function renderAdvancedMetrics(team) {

    const stats =
        getTeamStats(team);

    const advanced =
        calculateAdvanced(team);


    return `

        <div
            class="stat-row"
        >

            <span class="stat-label">
                ${escapeHTML(
                    teamName(team)
                )}
            </span>

            <b class="stat-value">
                실제 기록 기반
            </b>

        </div>


        <div class="stat-row">

            <span class="stat-label">
                eFG%
            </span>

            <b class="stat-value">
                ${
                    advanced.eFG === null
                    ? "기록 없음"
                    : advanced.eFG.toFixed(1) + "%"
                }
            </b>

        </div>


        <div class="stat-row">

            <span class="stat-label">
                TS%
            </span>

            <b class="stat-value">
                ${
                    advanced.TS === null
                    ? "기록 없음"
                    : advanced.TS.toFixed(1) + "%"
                }
            </b>

        </div>


        <div class="stat-row">

            <span class="stat-label">
                ORtg
            </span>

            <b class="stat-value">
                ${
                    advanced.ORtg === null
                    ? "기록 없음"
                    : advanced.ORtg.toFixed(1)
                }
            </b>

        </div>


        <div class="stat-row">

            <span class="stat-label">
                AST/TO
            </span>

            <b class="stat-value">
                ${
                    advanced.ASTTO === null
                    ? "기록 없음"
                    : advanced.ASTTO.toFixed(2)
                }
            </b>

        </div>

    `;
}


/* =========================================================
   23. RADAR
========================================================= */

function renderRadar(team) {

    const stats =
        getTeamStats(team);

    const values = [

        stats.PTS,

        stats.REB,

        stats.AST,

        stats.STL,

        stats.BLK,

        stats.FGM

    ];


    const labels = [

        "PTS",

        "REB",

        "AST",

        "STL",

        "BLK",

        "FGM"

    ];


    const max =
        Math.max(
            ...values,
            1
        );


    const cx = 190;

    const cy = 160;

    const radius = 100;


    function point(value, index, r = radius) {

        const angle =
            -Math.PI / 2 +
            index *
            (
                Math.PI * 2 /
                values.length
            );

        return {

            x:
                cx +
                Math.cos(angle) *
                r *
                (value / max),

            y:
                cy +
                Math.sin(angle) *
                r *
                (value / max)

        };

    }


    const polygon =
        values
            .map(
                (value, index) => {

                    const p =
                        point(
                            value,
                            index
                        );

                    return `${p.x},${p.y}`;

                }
            )
            .join(" ");


    const grid =
        [1, 0.66, 0.33]
            .map(level => {

                const points =
                    values
                        .map(
                            (_, index) => {

                                const angle =
                                    -Math.PI / 2 +
                                    index *
                                    (
                                        Math.PI * 2 /
                                        values.length
                                    );

                                return `
                                    ${
                                        cx +
                                        Math.cos(angle) *
                                        radius *
                                        level
                                    },
                                    ${
                                        cy +
                                        Math.sin(angle) *
                                        radius *
                                        level
                                    }
                                `;

                            }
                        )
                        .join(" ");

                return `
                    <polygon
                        points="${points}"
                        fill="none"
                        stroke="#25364d"
                    />
                `;

            })
            .join("");


    return `

        <svg
            class="radar-chart"
            viewBox="0 0 380 320"
        >

            ${grid}

            <polygon
                points="${polygon}"
                fill="rgba(62,166,255,.12)"
                stroke="#45b2ff"
                stroke-width="2"
            />

            ${
                labels
                    .map(
                        (label, index) => {

                            const angle =
                                -Math.PI / 2 +
                                index *
                                (
                                    Math.PI * 2 /
                                    labels.length
                                );

                            const x =
                                cx +
                                Math.cos(angle) *
                                130;

                            const y =
                                cy +
                                Math.sin(angle) *
                                130;

                            return `

                                <text
                                    x="${x}"
                                    y="${y}"
                                    fill="#91a2b9"
                                    font-size="11"
                                    text-anchor="middle"
                                >
                                    ${label}
                                </text>

                            `;

                        }
                    )
                    .join("")
            }

        </svg>

    `;
}


/* =========================================================
   24. PASS NETWORK
========================================================= */

function renderPassNetwork(team = "A") {

    const players =
        getPlayers(team);


    const positions = {};


    players.forEach(
        (player, index) => {

            const angle =
                -Math.PI / 2 +
                index *
                (
                    Math.PI * 2 /
                    Math.max(
                        players.length,
                        1
                    )
                );

            positions[player.id] = {

                x:
                    300 +
                    Math.cos(angle) *
                    140,

                y:
                    210 +
                    Math.sin(angle) *
                    140

            };

        }
    );


    const edgeMap = {};


    state.passes
        .filter(
            pass =>
                pass.team === team
        )
        .forEach(pass => {

            const key =
                `${pass.passerId}_${pass.receiverId}`;

            edgeMap[key] =
                (edgeMap[key] || 0) + 1;

        });


    let svg = `

        <svg
            class="pass-network"
            viewBox="0 0 600 430"
        >

    `;


    Object.entries(
        edgeMap
    ).forEach(
        ([key, count]) => {

            const [
                from,
                to
            ] =
                key.split("_");


            const a =
                positions[from];

            const b =
                positions[to];


            if (!a || !b) {
                return;
            }


            svg += `

                <line
                    x1="${a.x}"
                    y1="${a.y}"
                    x2="${b.x}"
                    y2="${b.y}"
                    stroke="#3ea6ff88"
                    stroke-width="${1 + count * 2}"
                />

            `;

        }
    );


    players.forEach(player => {

        const pos =
            positions[player.id];

        const received =
            state.passes.filter(
                pass =>
                    pass.team === team &&
                    pass.receiverId ===
                    player.id
            ).length;


        const radius =
            16 +
            received * 2;


        svg += `

            <circle
                cx="${pos.x}"
                cy="${pos.y}"
                r="${radius}"
                fill="#176bc0"
                stroke="#6bc8ff"
            />

            <text
                x="${pos.x}"
                y="${pos.y + 4}"
                fill="#fff"
                font-size="11"
                text-anchor="middle"
            >
                #${escapeHTML(
                    player.number
                )}
            </text>

            <text
                x="${pos.x}"
                y="${pos.y + 32}"
                fill="#9badc5"
                font-size="10"
                text-anchor="middle"
            >
                ${escapeHTML(
                    player.name
                )}
            </text>

        `;

    });


    svg += "</svg>";

    return svg;
}


/* =========================================================
   25. ANALYSIS TABS
========================================================= */

function renderAnalysisTab(tab) {

    const container =
        $("#analysisContent");

    if (!container) {
        return;
    }


    if (tab === "team") {

        container.innerHTML =
            renderTeamAnalysis(
                getTeamStats("A"),
                getTeamStats("B")
            );

        return;
    }


    if (tab === "network") {

        container.innerHTML = `

            <div class="panel">

                <div class="panel-title">

                    <div>

                        <h3>
                            패스 네트워크
                        </h3>

                        <div class="panel-subtitle">
                            노드 = 선수 · 선 굵기 = 패스 연결 횟수
                        </div>

                    </div>

                    <select
                        class="filter-select"
                        id="networkTeam"
                    >

                        <option value="A">
                            ${escapeHTML(
                                state.game.teamA
                            )}
                        </option>

                        <option value="B">
                            ${escapeHTML(
                                state.game.teamB
                            )}
                        </option>

                    </select>

                </div>

                ${renderPassNetwork(
                    state.selectedTeam
                )}

            </div>

        `;

        return;
    }


    if (tab === "flow") {

        container.innerHTML = `

            <div class="grid grid-2">

                <div class="panel">

                    <div class="panel-title">

                        <h3>
                            득점 흐름
                        </h3>

                    </div>

                    ${renderScoringFlow()}

                </div>


                <div class="panel">

                    <div class="panel-title">

                        <h3>
                            경기 이벤트
                        </h3>

                    </div>

                    <div class="timeline">

                        ${
                            state.events.length
                            ? state.events
                                .slice()
                                .reverse()
                                .map(
                                    renderEvent
                                )
                                .join("")
                            : `
                                <div class="empty-state">
                                    기록 없음
                                </div>
                              `
                        }

                    </div>

                </div>

            </div>

        `;

        return;
    }


    if (tab === "lineup") {

        container.innerHTML = `

            <div class="panel">

                <div class="panel-title">

                    <h3>
                        라인업 성과
                    </h3>

                </div>

                ${renderLineupTable()}

            </div>

        `;

    }

}


/* =========================================================
   26. SCORING FLOW
========================================================= */

function renderScoringFlow() {

    const periods =
        state.mode === "3v3"
        ? [1]
        : [1, 2, 3, 4];


    const data =
        periods.map(period => {

            const A =
                state.events
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


            const B =
                state.events
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


            return {

                period,

                A,

                B

            };

        });


    const max =
        Math.max(
            ...data.flatMap(
                item => [
                    item.A,
                    item.B
                ]
            ),
            1
        );


    return `

        <div class="bar-list">

            ${
                data.map(item => `

                    <div class="bar-row">

                        <span>
                            ${item.period}Q
                        </span>

                        <div class="bar-track">

                            <i
                                class="bar-fill"
                                style="
                                    width:${
                                        item.A /
                                        max *
                                        100
                                    }%;
                                "
                            ></i>

                        </div>

                        <span>
                            ${item.A}-${item.B}
                        </span>

                    </div>

                `).join("")
            }

        </div>

    `;
}


/* =========================================================
   27. LINEUP
========================================================= */

function renderLineupTable() {

    return `

        <div class="table-wrap">

            <table class="data-table">

                <thead>

                    <tr>

                        <th>팀</th>

                        <th>출전 선수</th>

                        <th>득점</th>

                        <th>REB</th>

                        <th>AST</th>

                        <th>이벤트</th>

                    </tr>

                </thead>

                <tbody>

                    ${
                        ["A", "B"]
                            .map(team => {

                                const players =
                                    getPlayers(
                                        team
                                    );

                                const ids =
                                    players.map(
                                        p =>
                                            p.id
                                    );

                                const events =
                                    state.events.filter(
                                        event =>
                                            ids.includes(
                                                event.playerId
                                            )
                                    );


                                return `

                                    <tr>

                                        <td>
                                            ${escapeHTML(
                                                teamName(
                                                    team
                                                )
                                            )}
                                        </td>

                                        <td>
                                            ${
                                                players
                                                    .map(
                                                        p =>
                                                            `#${escapeHTML(
                                                                p.number
                                                            )} ${escapeHTML(
                                                                p.name
                                                            )}`
                                                    )
                                                    .join(
                                                        ", "
                                                    ) ||
                                                "기록 없음"
                                            }
                                        </td>

                                        <td>
                                            ${events
                                                .filter(
                                                    e =>
                                                        e.kind ===
                                                        "shot"
                                                )
                                                .reduce(
                                                    (
                                                        sum,
                                                        e
                                                    ) =>
                                                        sum +
                                                        e.points,
                                                    0
                                                )}
                                        </td>

                                        <td>
                                            ${players
                                                .reduce(
                                                    (
                                                        sum,
                                                        player
                                                    ) =>
                                                        sum +
                                                        getPlayerStats(
                                                            player.id
                                                        ).REB,
                                                    0
                                                )}
                                        </td>

                                        <td>
                                            ${players
                                                .reduce(
                                                    (
                                                        sum,
                                                        player
                                                    ) =>
                                                        sum +
                                                        getPlayerStats(
                                                            player.id
                                                        ).AST,
                                                    0
                                                )}
                                        </td>

                                        <td>
                                            ${events.length}
                                        </td>

                                    </tr>

                                `;

                            })
                            .join("")
                    }

                </tbody>

            </table>

        </div>

    `;
}


/* =========================================================
   28. REPORT
========================================================= */

function renderReport() {

    const page =
        $("#page-report");

    if (!page) {
        return;
    }


    const hasData =
        state.events.length > 0 ||
        state.shots.length > 0;


    page.innerHTML = `

        <div class="report-header">

            <div>

                <h2>
                    경기 + 팀 리포트
                </h2>

                <p>
                    ${escapeHTML(
                        state.game.name ||
                        "저장되지 않은 경기"
                    )}
                    ·
                    ${state.mode}
                </p>

            </div>

            <button
                class="primary-btn no-print"
                id="printReport"
            >
                인쇄 / PDF 저장
            </button>

        </div>


        ${
            !hasData
            ? `

                <div class="empty-state">

                    아직 경기 데이터가 없습니다.
                    <br>
                    실제 경기 기록을 입력하면
                    리포트가 자동으로 생성됩니다.

                </div>

              `
            : renderFullTeamReport()
        }


        <div class="panel report-section">

            <div class="panel-title">

                <div>

                    <h3>
                        개인 리포트
                    </h3>

                    <div class="panel-subtitle">
                        선수별 실제 경기 데이터
                    </div>

                </div>


                ${
                    state.players.length
                    ? `

                        <select
                            class="filter-select"
                            id="reportPlayer"
                        >

                            ${
                                state.players
                                    .map(
                                        player => `

                                            <option
                                                value="${player.id}"
                                                ${
                                                    state.selectedPlayerId ===
                                                    player.id
                                                    ? "selected"
                                                    : ""
                                                }
                                            >
                                                #${escapeHTML(
                                                    player.number
                                                )}
                                                ${escapeHTML(
                                                    player.name
                                                )}
                                            </option>

                                        `
                                    )
                                    .join("")
                            }

                        </select>

                      `
                    : ""
                }

            </div>


            <div id="individualReport">

                ${
                    state.players.length
                    ? renderIndividualReport(
                        state.selectedPlayerId ||
                        state.players[0].id
                    )
                    : `
                        <div class="empty-state">
                            선수 설정 필요
                        </div>
                      `
                }

            </div>

        </div>

    `;
}


function renderFullTeamReport() {

    const A =
        getTeamStats("A");

    const B =
        getTeamStats("B");


    return `

        <div class="kpi-grid">

            ${kpi(
                "최종 스코어",
                `${A.PTS} - ${B.PTS}`
            )}

            ${kpi(
                "팀 A FG%",
                percentage(
                    A.FGM,
                    A.FGA
                )
            )}

            ${kpi(
                "팀 A 3P%",
                percentage(
                    A.TPM,
                    A.TPA
                )
            )}

            ${kpi(
                "팀 A REB",
                A.REB
            )}

            ${kpi(
                "팀 A AST",
                A.AST
            )}

            ${kpi(
                "팀 A TOV",
                A.TOV
            )}

        </div>


        <div
            class="grid grid-2 report-section"
        >

            <div class="panel">

                <div class="panel-title">

                    <h3>
                        ${escapeHTML(
                            state.game.teamA
                        )}
                    </h3>

                </div>

                ${renderTeamReportStats(A)}

            </div>


            <div class="panel">

                <div class="panel-title">

                    <h3>
                        ${escapeHTML(
                            state.game.teamB
                        )}
                    </h3>

                </div>

                ${renderTeamReportStats(B)}

            </div>

        </div>


        <div
            class="panel report-section"
        >

            <div class="panel-title">

                <h3>
                    팀 비교
                </h3>

            </div>

            ${[
                "PTS",
                "FG%",
                "3P%",
                "REB",
                "AST",
                "STL",
                "BLK",
                "TOV"
            ]
                .map(
                    key =>
                        compareBar(
                            key,
                            key === "FG%"
                            ? percentage(
                                A.FGM,
                                A.FGA
                              )
                            : key === "3P%"
                            ? percentage(
                                A.TPM,
                                A.TPA
                              )
                            : A[key],

                            key === "FG%"
                            ? percentage(
                                B.FGM,
                                B.FGA
                              )
                            : key === "3P%"
                            ? percentage(
                                B.TPM,
                                B.TPA
                              )
                            : B[key]
                        )
                )
                .join("")}

        </div>


        <div
            class="panel report-section"
        >

            <div class="panel-title">

                <h3>
                    선수 박스스코어
                </h3>

            </div>

            ${renderPlayerBoxScore()}

        </div>


        <div
            class="grid grid-2 report-section"
        >

            <div class="panel">

                <div class="panel-title">

                    <h3>
                        경기 흐름
                    </h3>

                </div>

                ${renderScoringFlow()}

            </div>


            <div class="panel">

                <div class="panel-title">

                    <h3>
                        팀 개선 포인트
                    </h3>

                </div>

                ${renderRecommendations("A")}

            </div>

        </div>

    `;
}


function renderTeamReportStats(stats) {

    return `

        <div class="stat-list">

            <div class="stat-row">
                <span class="stat-label">PTS</span>
                <b class="stat-value">${stats.PTS}</b>
            </div>

            <div class="stat-row">
                <span class="stat-label">FG</span>
                <b class="stat-value">
                    ${stats.FGM}/${stats.FGA}
                </b>
            </div>

            <div class="stat-row">
                <span class="stat-label">FG%</span>
                <b class="stat-value">
                    ${percentage(
                        stats.FGM,
                        stats.FGA
                    )}
                </b>
            </div>

            <div class="stat-row">
                <span class="stat-label">3P</span>
                <b class="stat-value">
                    ${stats.TPM}/${stats.TPA}
                </b>
            </div>

            <div class="stat-row">
                <span class="stat-label">3P%</span>
                <b class="stat-value">
                    ${percentage(
                        stats.TPM,
                        stats.TPA
                    )}
                </b>
            </div>

            <div class="stat-row">
                <span class="stat-label">FT</span>
                <b class="stat-value">
                    ${stats.FTM}/${stats.FTA}
                </b>
            </div>

            <div class="stat-row">
                <span class="stat-label">REB</span>
                <b class="stat-value">${stats.REB}</b>
            </div>

            <div class="stat-row">
                <span class="stat-label">ORB</span>
                <b class="stat-value">${stats.ORB}</b>
            </div>

            <div class="stat-row">
                <span class="stat-label">DRB</span>
                <b class="stat-value">${stats.DRB}</b>
            </div>

            <div class="stat-row">
                <span class="stat-label">AST</span>
                <b class="stat-value">${stats.AST}</b>
            </div>

            <div class="stat-row">
                <span class="stat-label">STL</span>
                <b class="stat-value">${stats.STL}</b>
            </div>

            <div class="stat-row">
                <span class="stat-label">BLK</span>
                <b class="stat-value">${stats.BLK}</b>
            </div>

            <div class="stat-row">
                <span class="stat-label">TOV</span>
                <b class="stat-value">${stats.TOV}</b>
            </div>

            <div class="stat-row">
                <span class="stat-label">PF</span>
                <b class="stat-value">${stats.PF}</b>
            </div>

        </div>

    `;
}


function renderPlayerBoxScore() {

    return `

        <div class="table-wrap">

            <table class="data-table">

                <thead>

                    <tr>

                        <th>선수</th>
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
                        state.players
                            .map(
                                player => {

                                    const s =
                                        getPlayerStats(
                                            player.id
                                        );

                                    return `

                                        <tr>

                                            <td>
                                                #${escapeHTML(
                                                    player.number
                                                )}
                                                ${escapeHTML(
                                                    player.name
                                                )}
                                            </td>

                                            <td>${s.PTS}</td>

                                            <td>
                                                ${s.FGM}/${s.FGA}
                                            </td>

                                            <td>
                                                ${percentage(
                                                    s.FGM,
                                                    s.FGA
                                                )}
                                            </td>

                                            <td>
                                                ${s.TPM}/${s.TPA}
                                            </td>

                                            <td>${s.REB}</td>

                                            <td>${s.AST}</td>

                                            <td>${s.STL}</td>

                                            <td>${s.BLK}</td>

                                            <td>${s.TOV}</td>

                                        </tr>

                                    `;

                                }
                            )
                            .join("")
                    }

                </tbody>

            </table>

        </div>

    `;
}


/* =========================================================
   29. RECOMMENDATIONS
========================================================= */

function renderRecommendations(team) {

    const stats =
        getTeamStats(team);

    const recommendations = [];


    if (
        stats.FGA > 0 &&
        stats.FGM / stats.FGA < 0.4
    ) {

        recommendations.push(
            "필드골 성공률이 낮습니다. 림 주변 마무리와 슛 셀렉션을 우선 점검하세요."
        );

    }


    if (
        stats.TPA > 0 &&
        stats.TPM / stats.TPA < 0.3
    ) {

        recommendations.push(
            "3점 성공률이 낮습니다. 코너·윙 캐치앤슛의 반복 훈련을 점검하세요."
        );

    }


    if (
        stats.TOV > stats.AST &&
        stats.TOV > 0
    ) {

        recommendations.push(
            "턴오버가 어시스트보다 많습니다. 압박 상황의 볼 운반과 패스 선택을 점검하세요."
        );

    }


    if (!recommendations.length) {

        recommendations.push(
            "현재 데이터만으로 뚜렷한 개선 포인트를 확정하기 어렵습니다. 실제 경기 데이터를 더 축적하세요."
        );

    }


    return recommendations
        .map(
            text => `

                <div class="recommendation">
                    ${text}
                </div>

            `
        )
        .join("");
}


/* =========================================================
   30. INDIVIDUAL REPORT
========================================================= */

function renderIndividualReport(playerId) {

    const player =
        getPlayer(playerId);

    if (!player) {

        return `
            <div class="empty-state">
                선수 기록 없음
            </div>
        `;

    }


    const stats =
        getPlayerStats(
            player.id
        );


    const shots =
        state.shots.filter(
            shot =>
                shot.playerId ===
                player.id
        );


    return `

        <div class="kpi-grid">

            ${kpi(
                "득점",
                stats.PTS
            )}

            ${kpi(
                "FG%",
                percentage(
                    stats.FGM,
                    stats.FGA
                )
            )}

            ${kpi(
                "3P%",
                percentage(
                    stats.TPM,
                    stats.TPA
                )
            )}

            ${kpi(
                "REB",
                stats.REB
            )}

            ${kpi(
                "AST",
                stats.AST
            )}

            ${kpi(
                "TOV",
                stats.TOV
            )}

        </div>


        <div
            class="grid grid-2 report-section"
        >

            <div class="panel">

                <div class="panel-title">

                    <h3>
                        기본 기록
                    </h3>

                </div>

                ${renderTeamReportStats(
                    stats
                )}

            </div>


            <div class="panel">

                <div class="panel-title">

                    <h3>
                        슛 구역
                    </h3>

                </div>

                ${
                    shots.length
                    ? renderZoneTable(
                        shots
                      )
                    : `
                        <div class="empty-state">
                            슛 위치 기록 없음
                        </div>
                      `
                }

            </div>

        </div>


        <div
            class="panel report-section"
        >

            <div class="panel-title">

                <h3>
                    선수 개선 포인트
                </h3>

            </div>

            ${renderPlayerRecommendations(
                player.id
            )}

        </div>

    `;
}


function renderPlayerRecommendations(playerId) {

    const stats =
        getPlayerStats(
            playerId
        );

    const recommendations = [];


    if (
        stats.FGA > 0 &&
        stats.FGM / stats.FGA < 0.4
    ) {

        recommendations.push(
            "필드골 성공률을 높이기 위한 슈팅 폼과 마무리 효율 점검이 필요합니다."
        );

    }


    if (
        stats.TPA > 0 &&
        stats.TPM / stats.TPA < 0.3
    ) {

        recommendations.push(
            "3점 슈팅 성공률 개선을 위해 캐치앤슛과 발 정렬을 점검하세요."
        );

    }


    if (
        stats.TOV > stats.AST
    ) {

        recommendations.push(
            "턴오버 관리와 패스 판단을 우선적으로 점검하세요."
        );

    }


    if (!recommendations.length) {

        recommendations.push(
            "현재 기록으로 확정적인 약점을 판단하기 어렵습니다."
        );

    }


    return recommendations
        .map(
            text => `

                <div class="recommendation">
                    ${text}
                </div>

            `
        )
        .join("");
}


/* =========================================================
   31. LEAGUE
========================================================= */

function renderLeague() {

    const page =
        $("#page-league");

    if (!page) {
        return;
    }


    page.innerHTML = `

        <div class="league-layout">


            <div class="panel">

                <div class="panel-title">

                    <div>

                        <h3>
                            리그 설정
                        </h3>

                        <div class="panel-subtitle">
                            ${state.mode} 전용
                        </div>

                    </div>

                </div>


                <div class="modal-form">

                    <input
                        class="form-input"
                        id="leagueName"
                        value="${escapeHTML(
                            state.league.name
                        )}"
                        placeholder="리그명"
                    >


                    <button
                        class="primary-btn"
                        id="addLeagueTeam"
                    >
                        팀 추가
                    </button>


                    ${
                        state.league.teams
                            .map(
                                (team, index) => `

                                    <div
                                        class="stat-row"
                                    >

                                        <span>
                                            ${escapeHTML(
                                                team
                                            )}
                                        </span>

                                        <button
                                            data-remove-league-team="${index}"
                                        >
                                            삭제
                                        </button>

                                    </div>

                                `
                            )
                            .join("")
                    }

                </div>

            </div>


            <div class="panel">

                <div class="panel-title">

                    <h3>
                        순위
                    </h3>

                </div>

                ${renderStandings()}

            </div>

        </div>

    `;
}


function renderStandings() {

    if (!state.league.teams.length) {

        return `
            <div class="empty-state">
                등록된 팀이 없습니다.
            </div>
        `;

    }


    const standings =
        state.league.teams.map(
            team => ({

                team,

                wins: 0,

                losses: 0,

                pointsFor: 0,

                pointsAgainst: 0

            })
        );


    state.league.games.forEach(
        game => {

            const A =
                standings.find(
                    item =>
                        item.team ===
                        game.teamA
                );

            const B =
                standings.find(
                    item =>
                        item.team ===
                        game.teamB
                );


            if (!A || !B) {
                return;
            }


            A.pointsFor +=
                Number(game.scoreA) || 0;

            A.pointsAgainst +=
                Number(game.scoreB) || 0;

            B.pointsFor +=
                Number(game.scoreB) || 0;

            B.pointsAgainst +=
                Number(game.scoreA) || 0;


            if (
                game.scoreA >
                game.scoreB
            ) {

                A.wins += 1;

                B.losses += 1;

            } else {

                B.wins += 1;

                A.losses += 1;

            }

        }
    );


    standings.sort(
        (a, b) =>
            b.wins -
            a.wins ||
            (
                (b.pointsFor -
                 b.pointsAgainst) -
                (a.pointsFor -
                 a.pointsAgainst)
            )
    );


    return `

        <div class="table-wrap">

            <table class="data-table">

                <thead>

                    <tr>

                        <th>팀</th>
                        <th>승</th>
                        <th>패</th>
                        <th>득실</th>

                    </tr>

                </thead>

                <tbody>

                    ${
                        standings
                            .map(
                                item => `

                                    <tr>

                                        <td>
                                            ${escapeHTML(
                                                item.team
                                            )}
                                        </td>

                                        <td>
                                            ${item.wins}
                                        </td>

                                        <td>
                                            ${item.losses}
                                        </td>

                                        <td>
                                            ${
                                                item.pointsFor -
                                                item.pointsAgainst
                                            }
                                        </td>

                                    </tr>

                                `
                            )
                            .join("")
                    }

                </tbody>

            </table>

        </div>

    `;
}


/* =========================================================
   32. SETUP MODAL
========================================================= */

function openSetupModal() {

    const rosterSize =
        getRosterSize();


    $("#modalRoot").innerHTML = `

        <div class="modal-backdrop">

            <div class="modal">

                <div class="modal-header">

                    <div>

                        <h2>
                            경기 / 선수 설정
                        </h2>

                        <div class="panel-subtitle">
                            ${state.mode}
                            · ${rosterSize}명 로스터
                        </div>

                    </div>

                    <button
                        class="modal-close"
                        id="closeModal"
                    >
                        ×
                    </button>

                </div>


                <div class="notice">

                    경기 정보를 입력하고
                    선수 명단을 등록하세요.
                    <br>
                    저장하면 라이브 화면에
                    즉시 반영됩니다.

                </div>


                <div
                    class="modal-form"
                    style="margin-top:14px"
                >

                    <div class="form-row">

                        <input
                            class="form-input"
                            id="setupGameName"
                            value="${escapeHTML(
                                state.game.name
                            )}"
                            placeholder="경기명"
                        >

                        <input
                            class="form-input"
                            id="setupTournament"
                            value="${escapeHTML(
                                state.game.tournament
                            )}"
                            placeholder="대회명"
                        >

                    </div>


                    <div class="form-row">

                        <input
                            class="form-input"
                            id="setupTeamA"
                            value="${escapeHTML(
                                state.game.teamA
                            )}"
                            placeholder="팀 A"
                        >

                        <input
                            class="form-input"
                            id="setupTeamB"
                            value="${escapeHTML(
                                state.game.teamB
                            )}"
                            placeholder="팀 B"
                        >

                    </div>

                </div>


                <div class="roster-setup">

                    ${renderSetupTeam("A", rosterSize)}

                    ${renderSetupTeam("B", rosterSize)}

                </div>


                <div class="modal-footer">

                    <button
                        class="ghost-btn"
                        id="cancelSetup"
                    >
                        취소
                    </button>

                    <button
                        class="primary-btn"
                        id="applySetup"
                    >
                        설정 저장 · 경기 시작
                    </button>

                </div>

            </div>

        </div>

    `;
}


function renderSetupTeam(team, size) {

    const players =
        getPlayers(team);


    return `

        <div class="roster-team">

            <h3>
                팀 ${team}
            </h3>


            ${
                Array.from(
                    {
                        length: size
                    },
                    (_, index) => {

                        const player =
                            players[index] ||
                            {};


                        return `

                            <div
                                class="player-input-row"
                            >

                                <input
                                    class="form-input"
                                    data-setup-number="${team}-${index}"
                                    value="${escapeHTML(
                                        player.number ||
                                        index + 1
                                    )}"
                                    placeholder="번호"
                                >

                                <input
                                    class="form-input"
                                    data-setup-name="${team}-${index}"
                                    value="${escapeHTML(
                                        player.name ||
                                        ""
                                    )}"
                                    placeholder="선수 이름"
                                >

                            </div>

                        `;

                    }
                ).join("")
            }

        </div>

    `;
}


/* =========================================================
   33. APPLY SETUP
========================================================= */

function applySetup() {

    const rosterSize =
        getRosterSize();


    state.game.name =
        $("#setupGameName")
            .value
            .trim();


    state.game.tournament =
        $("#setupTournament")
            .value
            .trim();


    state.game.teamA =
        $("#setupTeamA")
            .value
            .trim() ||
        "HOME";


    state.game.teamB =
        $("#setupTeamB")
            .value
            .trim() ||
        "AWAY";


    state.players = [];


    ["A", "B"].forEach(
        team => {

            for (
                let i = 0;
                i < rosterSize;
                i++
            ) {

                const number =
                    $(
                        `[data-setup-number="${team}-${i}"]`
                    )
                    .value
                    .trim();


                const name =
                    $(
                        `[data-setup-name="${team}-${i}"]`
                    )
                    .value
                    .trim();


                /*
                   이름이 비어 있으면
                   실제 선수로 등록하지 않는다.
                   가짜 데이터 방지.
                */

                if (!name) {
                    continue;
                }


                state.players.push({

                    id: uuid(),

                    team,

                    number:
                        number ||
                        String(i + 1),

                    name,

                    active: true

                });

            }

        }
    );


    state.setupComplete = true;

    state.selectedTeam = "A";

    state.selectedPlayerId =
        state.players[0]?.id ||
        null;


    state.pendingShot = null;

    state.pendingPass = null;


    saveState();

    $("#modalRoot").innerHTML = "";

    state.currentPage = "live";

    render();

    showToast(
        "선수 설정이 저장되었습니다."
    );
}


/* =========================================================
   34. MAIN RENDER
========================================================= */

function render() {

    /*
       현재 페이지 표시
    */

    $$(".page").forEach(
        page => {

            page.classList.toggle(
                "active",
                page.id ===
                `page-${state.currentPage}`
            );

        }
    );


    /*
       네비게이션
    */

    $$(".nav-btn").forEach(
        button => {

            button.classList.toggle(
                "active",
                button.dataset.page ===
                state.currentPage
            );

        }
    );


    /*
       3대3 / 5대5
    */

    $$(".mode-btn").forEach(
        button => {

            button.classList.toggle(
                "active",
                button.dataset.mode ===
                state.mode
            );

        }
    );


    renderLive();

    renderRecords();

    renderShots();

    renderVideo();

    renderAnalysis();

    renderReport();

    renderLeague();

}


/* =========================================================
   35. NAVIGATION EVENTS
========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "button"
            );


        if (!button) {
            return;
        }


        /*
           페이지 이동
        */

        if (
            button.dataset.page
        ) {

            state.currentPage =
                button.dataset.page;

            saveState();

            render();

            return;

        }


        /*
           라이브 → 특정 페이지
        */

        if (
            button.dataset.goPage
        ) {

            state.currentPage =
                button.dataset.goPage;

            saveState();

            render();

            return;

        }


        /*
           모드
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
           선수 선택
        */

        if (
            button.dataset.selectPlayer
        ) {

            const player =
                getPlayer(
                    button.dataset.selectPlayer
                );


            if (
                state.pendingPass &&
                player
            ) {

                completePass(
                    player.id
                );

                return;

            }


            if (player) {

                state.selectedPlayerId =
                    player.id;

                state.selectedTeam =
                    player.team;

                saveState();

                render();

            }

            return;

        }


        /*
           라이브 슛 버튼
        */

        if (
            button.dataset.shotAction
        ) {

            startShot(
                button.dataset.shotAction,
                true
            );

            return;

        }


        /*
           기본 스탯
        */

        if (
            button.dataset.statAction
        ) {

            addBasicStat(
                button.dataset.statAction
            );

            return;

        }


        /*
           슛 성공 / 실패
        */

        if (
            button.dataset.shotMade
        ) {

            state.pendingShot =
                state.pendingShot ||
                {};


            state.pendingShot.made =
                button.dataset.shotMade ===
                "true";


            saveState();

            render();

            return;

        }


        /*
           슛 종류
        */

        if (
            button.dataset.shotType
        ) {

            state.pendingShot =
                state.pendingShot ||
                {};


            state.pendingShot.type =
                button.dataset.shotType;


            saveState();

            render();

            return;

        }


        /*
           패스
        */

        if (
            button.id ===
            "passAction"
        ) {

            startPass();

            return;

        }


        /*
           마지막 기록 취소
        */

        if (
            button.id ===
            "undoAction"
        ) {

            undoLastEvent();

            return;

        }


        /*
           경기 시계
        */

        if (
            button.id ===
            "clockAction"
        ) {

            toggleGameClock();

            return;

        }


        /*
           다음 쿼터
        */

        if (
            button.id ===
            "periodAction"
        ) {

            nextPeriod();

            return;

        }


        /*
           경기 종료
        */

        if (
            button.id ===
            "endGameAction"
        ) {

            endGame();

            return;

        }


        /*
           타임아웃
        */

        if (
            button.id ===
            "timeoutAction"
        ) {

            const player =
                getSelectedPlayer();


            createEvent(
                "timeout",
                player?.id ||
                null,
                state.selectedTeam
            );


            saveState();

            render();

            showToast(
                "타임아웃이 기록되었습니다."
            );

            return;

        }


        /*
           설정
        */

        if (
            button.id ===
            "setupBtn"
        ) {

            openSetupModal();

            return;

        }


        /*
           저장
        */

        if (
            button.id ===
            "saveBtn"
        ) {

            saveCurrentGame();

            return;

        }


        /*
           초기화
        */

        if (
            button.id ===
            "resetBtn"
        ) {

            resetEverything();

            return;

        }


        /*
           모달 닫기
        */

        if (
            button.id ===
            "closeModal" ||
            button.id ===
            "cancelSetup"
        ) {

            $("#modalRoot").innerHTML = "";

            return;

        }


        /*
           리포트 인쇄
        */

        if (
            button.id ===
            "printReport"
        ) {

            window.print();

            return;

        }


        /*
           분석 탭
        */

        if (
            button.dataset.analysisTab
        ) {

            $$
            (
                "[data-analysis-tab]"
            )
            .forEach(
                tab =>
                    tab.classList.remove(
                        "active"
                    )
            );


            button.classList.add(
                "active"
            );


            renderAnalysisTab(
                button.dataset.analysisTab
            );

            return;

        }


        /*
           리그 팀 추가
        */

        if (
            button.id ===
            "addLeagueTeam"
        ) {

            const name =
                prompt(
                    "추가할 팀 이름"
                );


            if (name?.trim()) {

                state.league.teams.push(
                    name.trim()
                );

                saveState();

                render();

            }

            return;

        }


        /*
           리그 팀 삭제
        */

        if (
            button.dataset.removeLeagueTeam
        ) {

            const index =
                Number(
                    button.dataset
                        .removeLeagueTeam
                );


            state.league.teams.splice(
                index,
                1
            );

            saveState();

            render();

            return;

        }


        /*
           영상 마커
        */

        if (
            button.id ===
            "addVideoMarker"
        ) {

            addVideoMarker();

            return;

        }


        if (
            button.id ===
            "clearVideoMarkers"
        ) {

            state.videoMarkers = [];

            saveState();

            renderVideo();

            return;

        }


        /*
           영상 이동
        */

        if (
            button.dataset.seekVideo
        ) {

            const video =
                $("#analysisVideo");


            if (video) {

                video.currentTime =
                    Number(
                        button.dataset
                            .seekVideo
                    );

            }

            return;

        }

    }
);


/* =========================================================
   36. SHOT COURT CLICK
========================================================= */

document.addEventListener(
    "click",
    event => {

        const court =
            event.target.closest(
                "#shotCourt"
            );


        if (!court) {
            return;
        }


        if (
            !state.pendingShot
        ) {

            return;

        }


        const layer =
            event.target.closest(
                ".court-click-layer"
            );


        if (!layer) {
            return;
        }


        const rect =
            court.getBoundingClientRect();


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


        addShotAtPosition(
            x,
            y
        );

    }
);


/* =========================================================
   37. SELECT FILTERS
========================================================= */

document.addEventListener(
    "change",
    event => {

        const target =
            event.target;


        if (
            target.id ===
            "shotTeamFilter"
        ) {

            state.selectedTeam =
                target.value;

            state.selectedPlayerId =
                null;

            saveState();

            render();

            return;

        }


        if (
            target.id ===
            "shotPlayerFilter"
        ) {

            state.selectedPlayerId =
                target.value ||
                null;

            saveState();

            render();

            return;

        }


        if (
            target.id ===
            "reportPlayer"
        ) {

            state.selectedPlayerId =
                target.value;

            saveState();


            const container =
                $("#individualReport");


            if (container) {

                container.innerHTML =
                    renderIndividualReport(
                        target.value
                    );

            }

            return;

        }


        if (
            target.id ===
            "networkTeam"
        ) {

            state.selectedTeam =
                target.value;

            saveState();

            const container =
                $("#analysisContent");


            if (container) {

                container.innerHTML = `

                    <div class="panel">

                        <div class="panel-title">

                            <h3>
                                패스 네트워크
                            </h3>

                        </div>

                        ${renderPassNetwork(
                            target.value
                        )}

                    </div>

                `;

            }

            return;

        }


        if (
            target.id ===
            "leagueName"
        ) {

            state.league.name =
                target.value;

            saveState();

            return;

        }


        if (
            target.id ===
            "videoFile"
        ) {

            loadVideo(
                target.files[0]
            );

            return;

        }

    }
);


/* =========================================================
   38. VIDEO
========================================================= */

function loadVideo(file) {

    if (!file) {
        return;
    }


    const video =
        $("#analysisVideo");


    if (!video) {
        return;
    }


    video.src =
        URL.createObjectURL(
            file
        );

    video.load();

}


function addVideoMarker() {

    const video =
        $("#analysisVideo");


    if (
        !video ||
        !video.src
    ) {

        showToast(
            "먼저 영상을 불러오세요."
        );

        return;

    }


    const label =
        prompt(
            "마커 이름",
            "중요 장면"
        ) ||
        "중요 장면";


    state.videoMarkers.push({

        time:
            video.currentTime,

        label

    });


    state.videoMarkers.sort(
        (a, b) =>
            a.time -
            b.time
    );


    saveState();

    renderVideo();

    showToast(
        "영상 마커가 추가되었습니다."
    );
}


/* =========================================================
   39. MODE CHANGE
========================================================= */

function changeMode(mode) {

    if (
        mode === state.mode
    ) {

        return;

    }


    if (
        state.events.length ||
        state.shots.length
    ) {

        const ok =
            confirm(
                "모드를 변경하면 현재 경기 기록이 초기화됩니다. 계속할까요?"
            );


        if (!ok) {
            return;
        }

    }


    const oldSavedGames =
        state.savedGames;


    const oldLeague =
        state.league;


    state =
        createDefaultState();


    state.mode =
        mode;


    state.savedGames =
        oldSavedGames;


    state.league =
        oldLeague;


    saveState();

    render();

    openSetupModal();

}


/* =========================================================
   40. INITIALIZE
========================================================= */

runClock();

render();


if (
    !state.setupComplete
) {

    setTimeout(
        () => {

            openSetupModal();

        },
        150
    );

}