const S = {
  mode: '3v3',
  page: 'live',

  clock: 600,
  shot: 14,
  run: false,

  sel: 'A1',

  A: '설천고',
  B: '상대팀',

  players: {
    A: [1, 2, 3].map(n => ({
      n,
      name: `선수 A${n}`
    })),

    B: [1, 2, 3].map(n => ({
      n,
      name: `선수 B${n}`
    }))
  },

  st: {},
  shots: [],
  logs: []
};


const $ = s =>
  document.querySelector(s);

const $$ = s =>
  [...document.querySelectorAll(s)];

const id = (team, number) =>
  team + number;


/* =========================
   PLAYER STAT INITIALIZE
========================= */

function init() {

  ['A', 'B'].forEach(team => {

    S.players[team].forEach(player => {

      const key = id(team, player.n);

      S.st[key] ||= {
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        to: 0,
        pf: 0,

        fgm: 0,
        fga: 0,

        tpm: 0,
        tpa: 0,

        ftm: 0,
        fta: 0,

        plus: 0
      };

    });

  });

}


/* =========================
   BASIC FUNCTIONS
========================= */

function pct(a, b) {

  return b
    ? Math.round(a / b * 100)
    : 0;

}


function score(team) {

  return S.players[team].reduce(
    (total, player) =>
      total + S.st[id(team, player.n)].pts,
    0
  );

}


function time(seconds) {

  return `${String(
    Math.floor(seconds / 60)
  ).padStart(2, '0')}:${String(
    Math.floor(seconds % 60)
  ).padStart(2, '0')}`;

}


/* =========================
   PLAYER RATING
========================= */

function rating(key) {

  const s = S.st[key];

  return Math.max(
    0,
    Math.min(
      100,

      50 +

      s.pts * 3 +
      s.reb * 4 +
      s.ast * 4 +
      s.stl * 5 +
      s.blk * 5 -

      s.to * 4 -
      s.pf * 2 +

      pct(s.fgm, s.fga) * 0.25
    )
  );

}


/* =========================
   COURT
========================= */

function court() {

  return `
    <div class="court">

      <i class="key"></i>
      <i class="rim"></i>

      ${S.shots.map(x => `
        <i
          class="dot ${x.m ? '' : 'miss'}"
          style="
            left:${x.x}%;
            top:${x.y}%;
          "
        ></i>
      `).join('')}

    </div>
  `;

}


/* =========================
   PLAYER CARD
========================= */

function card(team, player) {

  const key = id(team, player.n);
  const s = S.st[key];

  return `
    <button
      class="panel pcard
      ${team.toLowerCase()}
      ${S.sel === key ? 'sel' : ''}"
      onclick="sel('${key}')"
    >

      <div class="num">
        ${player.n}
      </div>

      <div class="pname">
        ${player.name}
      </div>

      <div class="mini">
        ${s.pts} PTS · +/- ${s.plus}
      </div>

    </button>
  `;

}


/* =========================
   LIVE PAGE
========================= */

function live() {

  init();

  const team = S.sel[0];
  const number = +S.sel.slice(1);

  const player =
    S.players[team].find(
      p => p.n === number
    );

  const s = S.st[S.sel];

  const acts =
    S.mode === '3v3'

      ? [
          ['ft', '+1', '자유투 성공'],
          ['in', '+1', '아크 안 성공'],
          ['out', '+2', '외곽 성공']
        ]

      : [
          ['ft', '+1', '자유투 성공'],
          ['in', '+2', '2점 성공'],
          ['out', '+3', '3점 성공']
        ];


  $('#app').innerHTML = `

    <div class="page">

      <div class="grid live">


        <!-- LEFT -->

        <div class="stack">


          <div class="panel">

            <div class="eyebrow">
              GAME INFORMATION
            </div>

            <h2>경기 정보</h2>

            <p>
              경기명

              <b style="float:right">
                설천고 리그전
              </b>
            </p>

            <p>
              경기 모드

              <b style="float:right">
                ${S.mode === '3v3'
                  ? '3대3'
                  : '5대5'}
              </b>
            </p>

            <p>
              경기 시간

              <b style="float:right">
                10분
              </b>
            </p>

            <p>
              샷클락

              <b style="float:right">
                14초
              </b>
            </p>

          </div>


          <div class="panel">

            <div class="eyebrow">
              A TEAM
            </div>

            <h2>${S.A}</h2>

            <div class="score">
              ${score('A')}
            </div>

            <span>
              선수 ${S.players.A.length}명
            </span>

          </div>


          <div class="panel">

            <div class="eyebrow red">
              B TEAM
            </div>

            <h2>${S.B}</h2>

            <div class="score">
              ${score('B')}
            </div>

            <span>
              선수 ${S.players.B.length}명
            </span>

          </div>


          <div class="panel quick">

            <div class="eyebrow">
              QUICK ACTION
            </div>

            <h3>빠른 기능</h3>

            <button onclick="undo()">
              ↶ 마지막 입력 취소
            </button>

            <button
              onclick="
                S.logs.push('다음 구간');
                render();
              "
            >
              다음 구간
            </button>

            <button onclick="log('A팀 타임아웃')">
              A팀 타임아웃
            </button>

            <button onclick="log('B팀 타임아웃')">
              B팀 타임아웃
            </button>

            <button
              onclick="
                S.logs.pop();
                render();
              "
            >
              최근 기록 삭제
            </button>

            <button
              class="danger"
              onclick="save()"
            >
              경기 종료 · 저장
            </button>

          </div>

        </div>


        <!-- CENTER -->

        <div class="stack">


          <div class="panel scoreboard">


            <div class="scoreteam a">

              <div class="eyebrow">
                HOME
              </div>

              <div class="team">
                ${S.A}
              </div>

              <div class="score">
                ${score('A')}
              </div>

              <span>
                파울 0 · TO 0
              </span>

            </div>


            <div class="clock">

              <div class="q">
                ${S.mode === '3v3'
                  ? 'GAME'
                  : '1Q'}
              </div>

              <div class="time">
                ${time(S.clock)}
              </div>

              <div class="shot">
                ${Math.ceil(S.shot)}
              </div>

              <button
                onclick="
                  S.run = !S.run;
                  render();
                "
              >
                ${S.run ? '정지' : '시작'}
              </button>

              <button
                onclick="
                  S.shot = 14;
                  render();
                "
              >
                샷클락
              </button>

            </div>


            <div class="scoreteam b">

              <div class="eyebrow red">
                AWAY
              </div>

              <div class="team">
                ${S.B}
              </div>

              <div class="score">
                ${score('B')}
              </div>

              <span>
                파울 0 · TO 0
              </span>

            </div>

          </div>


          <!-- ON COURT -->

          <div class="panel">

            <div class="eyebrow">
              ON COURT
            </div>

            <h2>
              현재 출전 선수
            </h2>

            <div class="two">


              <div>

                <div class="eyebrow">
                  A TEAM ON COURT
                </div>

                <div class="players">

                  ${S.players.A
                    .slice(
                      0,
                      S.mode === '3v3'
                        ? 3
                        : 5
                    )
                    .map(
                      p => card('A', p)
                    )
                    .join('')}

                </div>

              </div>


              <div>

                <div class="eyebrow red">
                  B TEAM ON COURT
                </div>

                <div class="players">

                  ${S.players.B
                    .slice(
                      0,
                      S.mode === '3v3'
                        ? 3
                        : 5
                    )
                    .map(
                      p => card('B', p)
                    )
                    .join('')}

                </div>

              </div>

            </div>

          </div>


          <!-- SELECTED PLAYER -->

          <div class="panel">

            <div class="eyebrow">
              SELECTED PLAYER
            </div>

            <h2>
              #${player.n} ${player.name}
            </h2>

            <p class="muted">
              ${s.pts} PTS ·
              ${s.reb} REB ·
              ${s.ast} AST ·
              +/- ${s.plus}
            </p>


            <div class="acts">


              ${acts.map(a => `

                <button
                  class="act"
                  onclick="
                    shot(
                      '${a[0]}',
                      ${
                        a[0] === 'ft'
                          ? 1
                          : a[0] === 'in'
                            ? (
                              S.mode === '3v3'
                                ? 1
                                : 2
                            )
                            : (
                              S.mode === '3v3'
                                ? 2
                                : 3
                            )
                      }
                    )
                  "
                >

                  ${a[1]}

                  <small>
                    ${a[2]}
                  </small>

                </button>

              `).join('')}


              <button
                class="act miss"
                onclick="
                  shot('miss', 0)
                "
              >

                실패

                <small>
                  슛 실패
                </small>

              </button>


              ${
                [
                  ['reb', 'REB'],
                  ['ast', 'AST'],
                  ['stl', 'STL'],
                  ['blk', 'BLK'],
                  ['to', 'TO'],
                  ['pf', 'PF']
                ]
                .map(a => `

                  <button
                    class="act"
                    onclick="
                      stat('${a[0]}')
                    "
                  >

                    ${a[1]}

                    <small>
                      ${a[0]}
                    </small>

                  </button>

                `)
                .join('')
              }


              <button
                class="act gold"
                onclick="
                  log(
                    player.name +
                    ' · 선수 투입'
                  )
                "
              >
                IN

                <small>
                  선수 투입
                </small>

              </button>


              <button
                class="act gold"
                onclick="
                  log(
                    player.name +
                    ' · 교체 아웃'
                  )
                "
              >
                OUT

                <small>
                  교체 아웃
                </small>

              </button>


            </div>

          </div>

        </div>


        <!-- RIGHT -->

        <div class="stack">


          <div class="panel">

            <div class="eyebrow">
              SHOT PREVIEW
            </div>

            <h2>
              미니 슛차트
            </h2>

            <div style="height:250px">
              ${court()}
            </div>

            <div class="mini">
              ● 성공　× 실패
            </div>

          </div>


          <div class="panel">

            <div class="eyebrow">
              RECENT LOG
            </div>

            <h2>
              최근 기록
            </h2>

            ${
              S.logs
                .slice(-9)
                .reverse()
                .map(
                  x =>
                    `<div class="log">${x}</div>`
                )
                .join('')

              ||

              '<p class="muted">아직 기록이 없습니다.</p>'
            }

          </div>


          <div class="panel">

            <div class="eyebrow">
              LIVE MVP
            </div>

            <h2>
              경기 MVP 후보
            </h2>

            <div class="leader">

              <span>
                ${mvp()[1]}
              </span>

              <b>
                ${mvp()[0].toFixed(1)}
              </b>

            </div>

          </div>


          <div class="panel">

            <div class="eyebrow">
              LIVE LEADERS
            </div>

            <h2>
              실시간 부문별 1위
            </h2>

            ${leaders()}

          </div>


        </div>

      </div>

    </div>

  `;

}


/* =========================
   MVP
========================= */

function mvp() {

  let players = [

    ...S.players.A.map(
      p => [
        rating('A' + p.n),
        p.name
      ]
    ),

    ...S.players.B.map(
      p => [
        rating('B' + p.n),
        p.name
      ]
    )

  ];

  return players.sort(
    (a, b) => b[0] - a[0]
  )[0]
    || [0, '선수를 기다리는 중'];

}


/* =========================
   LIVE LEADERS
========================= */

function leaders() {

  let players = [

    ...S.players.A.map(
      p => [
        'A' + p.n,
        p.name
      ]
    ),

    ...S.players.B.map(
      p => [
        'B' + p.n,
        p.name
      ]
    )

  ];


  return [

    ['득점', 'pts'],
    ['리바운드', 'reb'],
    ['어시스트', 'ast'],
    ['스틸', 'stl'],
    ['블록', 'blk']

  ]
  .map(x => {

    let best =
      players.sort(
        (u, v) =>
          S.st[v[0]][x[1]]
          -
          S.st[u[0]][x[1]]
      )[0];

    return `

      <div class="leader">

        <span>
          ${x[0]} · ${best[1]}
        </span>

        <b>
          ${S.st[best[0]][x[1]]}
        </b>

      </div>

    `;

  })
  .join('');

}


/* =========================
   SHOT
========================= */

function shot(type, points) {

  const s = S.st[S.sel];

  const made =
    type !== 'miss';


  if (type === 'ft') {

    s.fta++;

    if (made)
      s.ftm++;

  }

  else {

    s.fga++;

    if (made)
      s.fgm++;

    if (type === 'out') {

      s.tpa++;

      if (made)
        s.tpm++;

    }

  }


  if (made)
    s.pts += points;


  S.shots.push({

    x: 15 + Math.random() * 70,
    y: 15 + Math.random() * 70,

    m: made

  });


  log(
    `${S.sel} · ${
      made
        ? points + '점 성공'
        : '슛 실패'
    }`
  );

}


/* =========================
   BASIC STAT
========================= */

function stat(key) {

  S.st[S.sel][key]++;

  log(
    `${S.sel} · ${key.toUpperCase()}`
  );

}


/* =========================
   LOG
========================= */

function log(text) {

  S.logs.push(text);

  render();

}


/* =========================
   PLAYER SELECT
========================= */

function sel(key) {

  S.sel = key;

  render();

}


/* =========================
   UNDO
========================= */

function undo() {

  S.logs.pop();

  render();

}


/* =========================
   SAVE
========================= */

function save() {

  localStorage.setItem(
    'cv_game',
    JSON.stringify(S)
  );

  alert(
    '경기 데이터 저장 완료'
  );

}


/* =========================
   RECORDS
========================= */

function records() {

  init();

  let all = [

    ...S.players.A.map(
      p => ['A', p]
    ),

    ...S.players.B.map(
      p => ['B', p]
    )

  ];


  $('#app').innerHTML = `

    <div class="page">

      <div class="reporthead">

        <div>

          <div class="eyebrow">
            BOX SCORE
          </div>

          <h1>
            선수 기록표
          </h1>

        </div>

        <button onclick="csv()">
          CSV 저장
        </button>

      </div>


      <div class="panel table">

        <table>

          <thead>

            <tr>

              <th>팀</th>
              <th>번호</th>
              <th>선수</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TO</th>
              <th>PF</th>
              <th>FG</th>
              <th>FG%</th>
              <th>EFF</th>

            </tr>

          </thead>


          <tbody>

            ${
              all.map(([team, player]) => {

                let s =
                  S.st[id(
                    team,
                    player.n
                  )];

                return `

                  <tr>

                    <td>${team}</td>

                    <td>
                      ${player.n}
                    </td>

                    <td>
                      <b>
                        ${player.name}
                      </b>
                    </td>

                    <td>${s.pts}</td>
                    <td>${s.reb}</td>
                    <td>${s.ast}</td>
                    <td>${s.stl}</td>
                    <td>${s.blk}</td>
                    <td>${s.to}</td>
                    <td>${s.pf}</td>

                    <td>
                      ${s.fgm}/${s.fga}
                    </td>

                    <td>
                      ${pct(
                        s.fgm,
                        s.fga
                      )}%
                    </td>

                    <td>
                      ${rating(
                        id(team, player.n)
                      ).toFixed(1)}
                    </td>

                  </tr>

                `;

              }).join('')
            }

          </tbody>

        </table>

      </div>

    </div>

  `;

}


/* =========================
   SHOT CHART
========================= */

function shots() {

  let made =
    S.shots.filter(
      x => x.m
    ).length;

  let total =
    S.shots.length;


  $('#app').innerHTML = `

    <div class="page">


      <div class="reporthead">

        <div>

          <div class="eyebrow">
            SHOT CHART
          </div>

          <h1>
            슛차트 · 구역 분석
          </h1>

        </div>

        <button
          onclick="
            S.shots = [];
            render();
          "
        >
          슛차트 초기화
        </button>

      </div>


      <div class="two grid">


        <div class="panel">

          <div style="height:620px">
            ${court()}
          </div>

        </div>


        <div class="stack">


          <div class="panel">

            <div class="eyebrow">
              SHOT SUMMARY
            </div>

            <h2>
              슈팅 요약
            </h2>


            <div class="kpis">


              <div class="kpi">

                <span>
                  전체 슛
                </span>

                <div class="v">
                  ${total}
                </div>

              </div>


              <div class="kpi">

                <span>
                  성공률
                </span>

                <div class="v">
                  ${pct(
                    made,
                    total
                  )}%
                </div>

              </div>


              <div class="kpi">

                <span>
                  성공 / 시도
                </span>

                <div class="v">
                  ${made}/${total}
                </div>

              </div>


              <div class="kpi">

                <span>
                  득점
                </span>

                <div class="v">

                  ${
                    S.shots.reduce(
                      (x, z) =>
                        x +
                        (
                          z.m
                            ? (
                              S.mode === '3v3'
                                ? 2
                                : 3
                            )
                            : 0
                        ),
                      0
                    )
                  }

                </div>

              </div>


            </div>

          </div>


          <div class="panel">

            <div class="eyebrow">
              ZONE ANALYSIS
            </div>

            <h2>
              구역별 효율
            </h2>


            <div class="heat">

              ${
                [
                  'RIM',
                  'PAINT',
                  'MID',
                  'LC3',
                  'LW3',
                  'RW3',
                  'RC3',
                  'TOP3',
                  'L-C',
                  'R-C',
                  'POST',
                  'DRIVE',
                  'P&R',
                  'TRANS'
                ]
                .map(
                  (x, i) => `

                    <div
                      class="cell"
                      style="
                        --h:${
                          .18 +
                          (i % 5) *
                          .13
                        }
                      "
                    >

                      ${x}

                      <br>

                      ${30 + i * 4}%

                    </div>

                  `
                )
                .join('')
              }

            </div>

          </div>


        </div>

      </div>

    </div>

  `;

}


/* =========================
   RADAR
========================= */

function radar(
  values,
  labels
) {

  const c = 150;
  const r = 105;
  const n = values.length;


  const polygon = scale => {

    return values
      .map((value, i) => {

        const angle =
          -Math.PI / 2 +
          i *
          2 *
          Math.PI /
          n;

        return `
          ${
            c +
            Math.cos(angle) *
            r *
            scale(value)
          },
          ${
            c +
            Math.sin(angle) *
            r *
            scale(value)
          }
        `;

      })
      .join(' ');

  };


  const rings =
    [
      .25,
      .5,
      .75,
      1
    ]
    .map(scale => `

      <polygon
        points="${
          Array.from(
            { length: n },
            (_, i) => {

              const angle =
                -Math.PI / 2 +
                i *
                2 *
                Math.PI /
                n;

              return `
                ${
                  c +
                  Math.cos(angle) *
                  r *
                  scale
                },
                ${
                  c +
                  Math.sin(angle) *
                  r *
                  scale
                }
              `;

            }
          ).join(' ')
        }"

        fill="none"
        stroke="#294354"
      />

    `)
    .join('');


  return `

    <svg
      class="radar"
      viewBox="0 0 300 300"
    >

      ${rings}


      <polygon
        points="${polygon(
          v => v / 100
        )}"

        fill="rgba(38,141,245,.2)"

        stroke="#3aa0ff"

        stroke-width="2"
      />


      ${
        labels
          .map(
            (label, i) => {

              const angle =
                -Math.PI / 2 +
                i *
                2 *
                Math.PI /
                n;

              return `

                <text

                  x="${
                    c +
                    Math.cos(angle) *
                    (r + 25)
                  }"

                  y="${
                    c +
                    Math.sin(angle) *
                    (r + 25)
                  }"

                  fill="#9eb0bf"

                  font-size="11"

                  text-anchor="middle"
                >

                  ${label}

                </text>

              `;

            }
          )
          .join('')
      }

    </svg>

  `;

}


/* =========================
   REPORT
========================= */

function reports() {

  const values =
    [
      82,
      76,
      71,
      68,
      73,
      80
    ];

  const labels =
    [
      '공격',
      '수비',
      '슈팅',
      '플레이메이킹',
      '리바운드',
      '운동능력'
    ];


  $('#app').innerHTML = `

    <div class="page">


      <div class="reporthead">

        <div>

          <div class="eyebrow">
            REPORT
          </div>

          <h1>
            리포트
          </h1>

        </div>


        <div class="filters">

          <button class="primary">
            개인 리포트
          </button>

          <button>
            팀 리포트
          </button>

        </div>

      </div>


      <div class="panel">

        <div class="eyebrow">
          PLAYER REPORT
        </div>

        <h2>
          개인 선수 리포트
        </h2>


        <div class="kpis">


          <div class="kpi">

            <span>
              PTS
            </span>

            <div class="v">
              ${S.st[S.sel].pts}
            </div>

          </div>


          <div class="kpi">

            <span>
              REB
            </span>

            <div class="v">
              ${S.st[S.sel].reb}
            </div>

          </div>


          <div class="kpi">

            <span>
              AST
            </span>

            <div class="v">
              ${S.st[S.sel].ast}
            </div>

          </div>


          <div class="kpi">

            <span>
              EFF
            </span>

            <div class="v">
              ${rating(
                S.sel
              ).toFixed(1)}
            </div>

          </div>


        </div>

      </div>


      <div
        class="three grid"
        style="margin-top:14px"
      >


        <div class="panel">

          <div class="eyebrow">
            OVERALL PROFILE
          </div>

          <h2>
            종합 지표
          </h2>

          <div class="radarwrap">

            ${radar(
              values,
              labels
            )}

          </div>

        </div>


        <div class="panel">

          <div class="eyebrow">
            DETAIL METRICS
          </div>

          <h2>
            세부 지표
          </h2>


          <div class="bars">

            ${
              values
                .map(
                  (value, i) => `

                    <div class="barrow">

                      <span>
                        ${labels[i]}
                      </span>

                      <div class="bar">

                        <i
                          style="
                            width:${value}%
                          "
                        ></i>

                      </div>

                      <b>
                        ${value}
                      </b>

                    </div>

                  `
                )
                .join('')
            }

          </div>

        </div>


        <div class="panel">

          <div class="eyebrow">
            SHOT PROFILE
          </div>

          <h2>
            슛 분포
          </h2>


          <div class="heat">

            ${
              [
                'RIM',
                'PAINT',
                'MID',
                'LC3',
                'LW3',
                'RW3',
                'TOP3'
              ]
              .map(
                (x, i) => `

                  <div
                    class="cell"
                    style="
                      --h:${
                        .2 +
                        i * .09
                      }
                    "
                  >

                    ${x}

                    <br>

                    ${58 - i * 5}%

                  </div>

                `
              )
              .join('')
            }

          </div>

        </div>


      </div>


      <!-- PERSONAL TRAINING -->

      <div
        class="panel"
        style="margin-top:14px"
      >

        <div class="eyebrow">
          TRAINING RECOMMENDATIONS
        </div>

        <h2>
          개인 훈련 추천
        </h2>

        <div class="recs">

          ${drills(false)}

        </div>

      </div>


      <!-- TEAM REPORT -->

      <div
        class="panel"
        style="margin-top:14px"
      >

        <div class="eyebrow">
          TEAM REPORT
        </div>

        <h2>
          팀 전체 리포트
        </h2>


        <div class="kpis">

          ${
            [
              '공격 지수',
              '수비 지수',
              '전환 속도',
              '볼 공유',
              '리바운드',
              '슈팅'
            ]
            .map(
              (x, i) => `

                <div class="kpi">

                  <span>
                    ${x}
                  </span>

                  <div class="v">
                    ${
                      [
                        82,
                        76,
                        79,
                        74,
                        71,
                        78
                      ][i]
                    }
                  </div>

                </div>

              `
            )
            .join('')
          }

        </div>


        <div class="radarwrap">

          ${radar(
            [
              82,
              76,
              79,
              74,
              71,
              78
            ],

            [
              '공격',
              '수비',
              '전환',
              '패스',
              '리바운드',
              '슈팅'
            ]
          )}

        </div>


        <h3>
          팀 훈련 추천
        </h3>

        <div class="recs">

          ${drills(true)}

        </div>

      </div>

    </div>

  `;

}


/* =========================
   TRAINING
========================= */

function drills(team) {

  const list = team

    ? [

        [
          '트랜지션 수비',
          '전환 수비 첫 3초 강화'
        ],

        [
          '5인 패싱',
          '볼 무브먼트 강화'
        ],

        [
          '팀 3점',
          '코너·윙·탑 반복'
        ],

        [
          '리바운드',
          '박스아웃·세컨드 찬스'
        ],

        [
          '픽앤롤 수비',
          '스크린 대응·로테이션'
        ]

      ]

    : [

        [
          '3점 정확도',
          '다양한 위치 캐치앤슛'
        ],

        [
          '볼 핸들링',
          '압박 상황 드리블'
        ],

        [
          '픽앤롤 플레이',
          '판단·마무리 선택'
        ],

        [
          '수비 슬라이드',
          '사이드스텝·클로즈아웃'
        ],

        [
          '리바운드 집중력',
          '타이밍·위치 선점'
        ]

      ];


  return list
    .map(
      (x, i) => `

        <div class="drill">

          <span class="tag">
            추천 ${i < 2
              ? '우선'
              : '일반'}
          </span>

          <h3>
            ${x[0]}
          </h3>

          <p class="muted">
            ${x[1]}
          </p>

          <hr>

          <small>
            예상 시간
            <b>
              ${15 + i * 5}분
            </b>
          </small>

        </div>

      `
    )
    .join('');

}


/* =========================
   ANALYSIS
========================= */

function analysis() {

  const values =
    [
      82,
      76,
      79,
      74,
      71,
      78
    ];


  $('#app').innerHTML = `

    <div class="page">

      <h1>
        전력분석
      </h1>


      <div
        class="kpis"
        style="margin:14px 0"
      >

        ${
          [
            '공격 효율',
            '수비 효율',
            '볼 관리',
            '슈팅 효율'
          ]
          .map(
            (x, i) => `

              <div class="kpi">

                <span>
                  ${x}
                </span>

                <div class="v">
                  ${
                    [
                      78,
                      72,
                      81,
                      69
                    ][i]
                  }
                </div>

              </div>

            `
          )
          .join('')
        }

      </div>


      <div class="two grid">


        <div class="panel">

          <div class="eyebrow">
            TEAM PROFILE
          </div>

          <h2>
            팀 종합 프로필
          </h2>

          <div class="radarwrap">

            ${radar(
              values,
              [
                '공격',
                '수비',
                '전환',
                '패스',
                '리바운드',
                '슈팅'
              ]
            )}

          </div>

        </div>


        <div class="panel">

          <div class="eyebrow">
            KEY INSIGHTS
          </div>

          <h2>
            핵심 분석
          </h2>


          <div class="bars">

            ${
              [
                ['공격', 82],
                ['수비', 76],
                ['전환', 79],
                ['볼 공유', 74],
                ['리바운드', 71]
              ]
              .map(
                x => `

                  <div class="barrow">

                    <span>
                      ${x[0]}
                    </span>

                    <div class="bar">

                      <i
                        style="
                          width:${x[1]}%
                        "
                      ></i>

                    </div>

                    <b>
                      ${x[1]}
                    </b>

                  </div>

                `
              )
              .join('')
            }

          </div>


          <h3
            style="margin-top:20px"
          >
            개선 포인트
          </h3>

          <p>
            • 외곽 효율 개선
          </p>

          <p>
            • 전환 수비 첫 3초 강화
          </p>

          <p>
            • 공격 리바운드 확대
          </p>

        </div>

      </div>

    </div>

  `;

}


/* =========================
   VIDEO
========================= */

function video() {

  $('#app').innerHTML = `

    <div class="page">

      <h1>
        영상 분석
      </h1>


      <div
        class="two grid"
        style="margin-top:14px"
      >


        <div
          class="panel"
          style="
            min-height:450px;
            display:grid;
            place-items:center;
            text-align:center
          "
        >

          <div>

            <div
              style="font-size:60px"
            >
              ▶
            </div>

            <h2>
              경기 영상 연결
            </h2>

            <p class="muted">
              이벤트와 영상 타임라인을
              연결하는 공간
            </p>

          </div>

        </div>


        <div class="panel">

          <div class="eyebrow">
            EVENT MARKERS
          </div>

          <h2>
            이벤트 타임라인
          </h2>


          ${
            S.logs
              .map(
                x =>
                  `<div class="log">${x}</div>`
              )
              .join('')

            ||

            '<p class="muted">기록 없음</p>'
          }

        </div>

      </div>

    </div>

  `;

}


/* =========================
   LEAGUE
========================= */

function league() {

  let games =
    JSON.parse(
      localStorage.getItem(
        'cv_league'
      ) || '[]'
    );


  $('#app').innerHTML = `

    <div class="page">


      <div class="reporthead">

        <div>

          <div class="eyebrow">
            3V3 LEAGUE
          </div>

          <h1>
            설천고 3대3 리그
          </h1>

        </div>


        <button
          class="primary"
          onclick="addg()"
        >
          경기 결과 추가
        </button>

      </div>


      <div class="kpis">


        <div class="kpi">

          <span>
            경기
          </span>

          <div class="v">
            ${games.length}
          </div>

        </div>


        <div class="kpi">

          <span>
            승
          </span>

          <div class="v">
            ${
              games.filter(
                x => x.a > x.b
              ).length
            }
          </div>

        </div>


        <div class="kpi">

          <span>
            패
          </span>

          <div class="v">
            ${
              games.filter(
                x => x.a < x.b
              ).length
            }
          </div>

        </div>


        <div class="kpi">

          <span>
            승률
          </span>

          <div class="v">

            ${
              games.length
                ? pct(
                    games.filter(
                      x => x.a > x.b
                    ).length,
                    games.length
                  )
                : 0
            }%

          </div>

        </div>


      </div>


      <div
        class="panel table"
        style="margin-top:14px"
      >

        <table>

          <thead>

            <tr>

              <th>날짜</th>
              <th>상대</th>
              <th>설천고</th>
              <th>상대</th>
              <th>결과</th>

            </tr>

          </thead>


          <tbody>

            ${
              games
                .map(
                  x => `

                    <tr>

                      <td>
                        ${x.d}
                      </td>

                      <td>
                        ${x.o}
                      </td>

                      <td>
                        ${x.a}
                      </td>

                      <td>
                        ${x.b}
                      </td>

                      <td>
                        ${
                          x.a > x.b
                            ? '승'
                            : '패'
                        }
                      </td>

                    </tr>

                  `
                )
                .join('')

              ||

              `
                <tr>
                  <td colspan="5">
                    리그 기록이 없습니다.
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


/* =========================
   ADD LEAGUE GAME
========================= */

function addg() {

  let opponent =
    prompt(
      '상대팀',
      '상대팀'
    );

  if (!opponent)
    return;


  let a =
    +prompt(
      '설천고 점수',
      '21'
    );


  let b =
    +prompt(
      '상대 점수',
      '18'
    );


  let games =
    JSON.parse(
      localStorage.getItem(
        'cv_league'
      ) || '[]'
    );


  games.push({

    d:
      new Date()
        .toLocaleDateString(
          'ko-KR'
        ),

    o: opponent,

    a,

    b

  });


  localStorage.setItem(
    'cv_league',
    JSON.stringify(games)
  );


  render();

}


/* =========================
   CSV
========================= */

function csv() {

  let rows = [

    [
      '팀',
      '번호',
      '선수',
      'PTS',
      'REB',
      'AST',
      'STL',
      'BLK',
      'TO',
      'PF',
      'FGM',
      'FGA',
      'FG%',
      'EFF'
    ]

  ];


  ['A', 'B'].forEach(
    team => {

      S.players[team].forEach(
        player => {

          let s =
            S.st[id(
              team,
              player.n
            )];


          rows.push([

            team,
            player.n,
            player.name,

            s.pts,
            s.reb,
            s.ast,
            s.stl,
            s.blk,
            s.to,
            s.pf,

            s.fgm,
            s.fga,

            pct(
              s.fgm,
              s.fga
            ) + '%',

            rating(
              id(
                team,
                player.n
              )
            ).toFixed(1)

          ]);

        }
      );

    }
  );


  let a =
    document.createElement('a');


  a.href =
    URL.createObjectURL(
      new Blob(
        [
          '\ufeff' +
          rows
            .map(
              r => r.join(',')
            )
            .join('\n')
        ],

        {
          type:
            'text/csv'
        }
      )
    );


  a.download =
    'COURTVISION_records.csv';


  a.click();

}


/* =========================
   RENDER
========================= */

function render() {

  $$('.modes button')
    .forEach(
      button => {

        button.classList.toggle(
          'active',
          button.dataset.mode ===
          S.mode
        );

      }
    );


  $$('nav button')
    .forEach(
      button => {

        button.classList.toggle(
          'active',
          button.dataset.page ===
          S.page
        );

      }
    );


  (
    {
      live,
      records,
      shots,
      video,
      analysis,
      reports,
      league
    }[S.page]
    || live
  )();

}


/* =========================
   MODE SWITCH
========================= */

$$('.modes button')
  .forEach(
    button => {

      button.onclick = () => {

        S.mode =
          button.dataset.mode;


        if (
          S.mode === '5v5'
        ) {

          ['A', 'B']
            .forEach(
              team => {

                while (
                  S.players[team]
                    .length < 5
                ) {

                  let n =
                    S.players[team]
                      .length + 1;


                  S.players[team]
                    .push({

                      n,

                      name:
                        `선수 ${team}${n}`

                    });

                }

              }
            );

        }


        init();

        render();

      };

    }
  );


/* =========================
   NAV
========================= */

$$('nav button')
  .forEach(
    button => {

      button.onclick = () => {

        S.page =
          button.dataset.page;

        render();

      };

    }
  );


/* =========================
   HEADER BUTTONS
========================= */

$('#save').onclick =
  save;


$('#reset').onclick =
  () => {

    if (
      confirm(
        '현재 경기를 초기화할까요?'
      )
    ) {

      S.clock = 600;
      S.shot = 14;

      S.shots = [];
      S.logs = [];

      S.st = {};

      init();

      render();

    }

  };


/* =========================
   PLAYER SETUP
========================= */

$('#players').onclick =
  () => {

    ['A', 'B']
      .forEach(
        team => {

          $(
            '#p' +
            team.toLowerCase()
          ).innerHTML =

            S.players[team]
              .map(
                (player, i) => `

                  <div class="sp">

                    <input
                      value="${player.n}"
                      data-t="${team}"
                      data-i="${i}"
                      data-k="n"
                    >

                    <input
                      value="${player.name}"
                      data-t="${team}"
                      data-i="${i}"
                      data-k="name"
                    >

                    <button
                      onclick="
                        S.players['${team}']
                          .splice(${i},1);

                        $('#players').click();
                      "
                    >
                      ×
                    </button>

                  </div>

                `
              )
              .join('');

        }
      );


    dlg.showModal();

  };


/* =========================
   SAVE PLAYER SETUP
========================= */

$('#savePlayers').onclick =
  () => {

    $$('input[data-t]')
      .forEach(
        input => {

          S.players[
            input.dataset.t
          ][
            +input.dataset.i
          ][
            input.dataset.k
          ] =

            input.dataset.k === 'n'
              ? +input.value
              : input.value;

        }
      );


    init();

    dlg.close();

    render();

  };


/* =========================
   GAME TIMER
========================= */

let last =
  performance.now();


function tick(now) {

  let delta =
    (now - last) / 1000;


  last = now;


  if (S.run) {

    S.clock =
      Math.max(
        0,
        S.clock - delta
      );


    S.shot =
      Math.max(
        0,
        S.shot - delta
      );


    if (
      S.clock <= 0
    ) {

      S.run = false;

    }


    render();

  }


  requestAnimationFrame(
    tick
  );

}


requestAnimationFrame(
  tick
);


/* =========================
   START
========================= */

init();

render();