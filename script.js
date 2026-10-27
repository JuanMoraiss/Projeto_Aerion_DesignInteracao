
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const colors = {
  friend: "#00efce",
  unknown: "#159bff",
  threat: "#ffc247",
  critical: "#ff4055"
};

const targets = [
  { id: "A-01", kind: "friend", x: -.50, y: -.55, speed: 280, heading: 138, zone: "A2" },
  { id: "A-03", kind: "friend", x: -.22, y: .42, speed: 310, heading: 225, zone: "C4" },
  { id: "T-02", kind: "threat", x: .42, y: -.42, speed: 480, heading: 48, zone: "C7" },
  { id: "T-04", kind: "critical", x: .55, y: -.08, speed: 612, heading: 320, zone: "B3" },
  { id: "T-05", kind: "threat", x: -.62, y: -.05, speed: 390, heading: 270, zone: "D4" },
  { id: "T-07", kind: "unknown", x: .38, y: .39, speed: 350, heading: 155, zone: "A1" },
  { id: "C-01", kind: "unknown", x: -.45, y: .12, speed: 220, heading: 260, zone: "A1" }
];

let selectedId = "T-04";
let elapsed = 0;
let sweepPaused = false;
let simulationPaused = false;
let simulationSpeed = 1;
let radarRange = 100;

const alerts = [
  { id: 1, time: "14:28", priority: "Crítica", target: "T-04", description: "Contato não identificado na zona B3.", status: "Pendente" },
  { id: 2, time: "14:24", priority: "Alta", target: "T-02", description: "Contato simulado na zona C7.", status: "Pendente" },
  { id: 3, time: "14:18", priority: "Baixa", target: "A-01", description: "Contato identificado como amigo.", status: "Resolvido" },
  { id: 4, time: "14:12", priority: "Média", target: "T-05", description: "Múltiplos contatos na região D4.", status: "Visualizado" },
  { id: 5, time: "14:05", priority: "Média", target: "T-07", description: "Contato aguardando identificação.", status: "Pendente" }
];

function getTarget() {
  return targets.find(t => t.id === selectedId) || targets[0];
}

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.style.display = "none", 2500);
}

function showPage(pageId) {
  $$(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageId);
  });

  $$(".nav").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  if (pageId === "radar") { renderRadar("#bigRadar", true); renderList(); }
  if (pageId === "home") renderHome();
  if (pageId === "targets") { renderTargetDetails(); renderPlan(); }
  if (pageId === "alerts") renderAlerts();
}

$$(".nav").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

$$("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

function radarSvg(size = 500, mini = false) {
  const center = size / 2;
  const radius = size * 0.42;
  const rangeScale = radarRange / 100;

  let svg = `
    <svg class="radar" viewBox="0 0 ${size} ${size}"
      role="img" aria-label="Radar de simulação">
      <defs>
        <radialGradient id="radarBackground">
          <stop offset="0%" stop-color="#00324b"/>
          <stop offset="100%" stop-color="#00101d"/>
        </radialGradient>
        <linearGradient id="radarBeam">
          <stop offset="0%" stop-color="#00eaff" stop-opacity=".55"/>
          <stop offset="100%" stop-color="#00eaff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <circle cx="${center}" cy="${center}" r="${radius}"
        fill="url(#radarBackground)" stroke="#00d9ff" stroke-width="1.5"/>
  `;

  for (let i = 1; i <= 4; i++) {
    svg += `<circle cx="${center}" cy="${center}"
      r="${radius * i / 4}" fill="none" stroke="#0879a4"
      stroke-width=".8"/>`;
  }

  for (let degree = 0; degree < 360; degree += 15) {
    const angle = degree * Math.PI / 180;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;

    svg += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}"
      stroke="#075174" opacity="${degree % 45 === 0 ? .65 : .25}"/>`;
  }

  svg += `
    <path d="M ${center - radius} ${center} H ${center + radius}
      M ${center} ${center - radius} V ${center + radius}"
      stroke="#00bde9" stroke-width="1"/>
    <text x="${center}" y="${center - radius - 8}" text-anchor="middle"
      fill="#00d9ff">N</text>
    <text x="${center}" y="${center + radius + 18}" text-anchor="middle"
      fill="#00d9ff">S</text>
    <text x="${center - radius - 14}" y="${center + 4}"
      fill="#00d9ff">O</text>
    <text x="${center + radius + 8}" y="${center + 4}"
      fill="#00d9ff">L</text>
    <g class="sweep ${sweepPaused ? "paused" : ""}">
      <path d="M ${center} ${center}
        L ${center} ${center - radius}
        A ${radius} ${radius} 0 0 1
        ${center + radius * .55} ${center - radius * .84} Z"
        fill="url(#radarBeam)"/>
      <line x1="${center}" y1="${center}"
        x2="${center}" y2="${center - radius}"
        stroke="#00eaff" stroke-width="1.5"/>
    </g>
  `;

  if (!mini) {
    [25, 50, 75, 100].forEach(value => {
      svg += `<text x="${center + radius * .63}"
        y="${center - radius * value / 100 - 4}"
        font-size="11" fill="#48a7d0">${Math.round(value * rangeScale)} km</text>`;
    });
  }

  const filter = $("#filter")?.value || "all";

  targets.forEach(target => {
    if (filter !== "all") {
      const matches =
        (filter === "friend" && target.kind === "friend") ||
        (filter === "unknown" && target.kind === "unknown") ||
        (filter === "threat" && ["threat", "critical"].includes(target.kind));

      if (!matches) return;
    }

    const x = center + target.x * radius;
    const y = center + target.y * radius;
    const color = colors[target.kind];
    const selected = target.id === selectedId;

    svg += `
      <g class="radar-target ${isDim(target) ? "dim" : ""}" data-target="${target.id}"
        tabindex="0" role="button" aria-label="${target.id}, ${kindName[target.kind]}"
        style="color:${color}">
        <title>${kindName[target.kind]}: ${kindHelp[target.kind]}</title>
        ${selected ? `<circle cx="${x}" cy="${y}" r="16"
          fill="none" stroke="${color}" stroke-width="2">
          <animate attributeName="r" values="13;20;13"
            dur="2s" repeatCount="indefinite"/>
        </circle>` : ""}
        ${shape(target.kind, x, y, color)}
        <text x="${x + 10}" y="${y - 10}" fill="${color}"
          stroke="#00101e" stroke-width="3" paint-order="stroke"
          font-size="12" font-weight="bold">${target.id}</text>
      </g>
    `;
  });

  return svg + `<circle cx="${center}" cy="${center}" r="3" fill="#00eaff"/></svg>`;
}

function bindRadar(container) {
  $(container).querySelectorAll("[data-target]").forEach(element => {
    element.addEventListener("click", () => {
      selectedId = element.dataset.target;
      renderRadar("#bigRadar", true);
      renderHome();
      renderTargetDetails();
      renderSelectedDetails();
      renderPlan();
      renderList();
      logAction("Selecionou " + selectedId);
      notify("Contato " + selectedId + " selecionado");
    });
  });
}

function renderRadar(selector, full = false) {
  const container = $(selector);
  if (!container) return;

  container.innerHTML = radarSvg(full ? 620 : 500, !full);
  bindRadar(selector);

  if (selector === "#bigRadar") renderSelectedDetails();
}

function renderSelectedDetails() {
  const target = getTarget();
  const container = $("#selectedDetails");
  if (!container) return;

  container.innerHTML = `
    <h2 style="color:${colors[target.kind]}">${target.id} · ${kindName[target.kind]}</h2>
    ${detail("Distância", dist(target).toFixed(1) + " km")}
    ${detail("Tempo até o impacto", target.kind === "friend" ? "—" : fmt(eta(target)))}
    <details><summary>Mais detalhes</summary>
      ${detail("Velocidade", target.speed + " m/s")}
      ${detail("Direção", target.heading + "°")}
      ${detail("Zona", target.zone)}
    </details>
  `;
}

function detail(label, value) {
  return `<div class="detail"><span>${label}</span><b>${value}</b></div>`;
}

function renderHome() {
  const friends = targets.filter(t => t.kind === "friend").length;
  const threats = targets.filter(t => ["threat", "critical"].includes(t.kind)).length;
  const unknown = targets.filter(t => t.kind === "unknown").length;

  $("#targetCount").textContent = targets.length;
  $("#friendCount").textContent = friends;
  $("#threatCount").textContent = threats;
  $("#homeFriends").textContent = friends;
  $("#homeThreats").textContent = threats;
  $("#homeUnknown").textContent = unknown;
  $("#homeTotal").textContent = targets.length;

  $("#recentAlerts").innerHTML = alerts.slice(0, 4).map(alert => `
    <div class="alert">
      <span class="${priorityClass(alert.priority)}">⚠ ${alert.priority}</span>
      <span>${alert.time}</span>
      <span>${alert.description}</span>
    </div>
  `).join("");

  renderRadar("#homeRadar");
}

function renderTargetDetails() {
  const target = getTarget();

  $("#targetDetails").innerHTML = `
    <h2 style="color:${colors[target.kind]}">${target.id}</h2>
    ${detail("Tipo", target.kind)}
    ${detail("Velocidade", target.speed + " m/s")}
    ${detail("Direção", target.heading + "°")}
    ${detail("Zona", target.zone)}
  `;

  const startX = 10;
  const startY = 100;
  const endX = 290 + target.x * 80;
  const endY = 70 + target.y * 45;

  $("#trajectory").innerHTML = `
    <svg viewBox="0 0 400 160" style="width:100%;max-width:500px">
      <defs>
        <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M25 0H0V25" fill="none" stroke="#075078"/>
        </pattern>
      </defs>
      <rect width="400" height="160" fill="url(#grid)"/>
      <path d="M${startX} ${startY} L${endX} ${endY}"
        stroke="${colors[target.kind]}" stroke-width="2" stroke-dasharray="7 5"/>
      <circle cx="${startX}" cy="${startY}" r="6"
        fill="${colors[target.kind]}"/>
      <circle cx="${endX}" cy="${endY}" r="7"
        fill="none" stroke="${colors[target.kind]}" stroke-width="2"/>
      <text x="${startX + 10}" y="${startY - 10}" fill="${colors[target.kind]}">
        Atual
      </text>
      <text x="${endX - 5}" y="${endY - 12}" fill="${colors[target.kind]}">
        Estimativa
      </text>
    </svg>
  `;
}

function priorityClass(priority) {
  if (priority === "Crítica") return "red";
  if (priority === "Alta" || priority === "Média") return "yellow";
  return "green";
}

function renderAlerts() {
  const search = ($("#alertSearch").value || "").toLowerCase();
  const status = $("#alertStatus").value;

  const filtered = alerts.filter(alert => {
    const matchesText =
      `${alert.target} ${alert.description}`.toLowerCase().includes(search);
    const matchesStatus = status === "all" || alert.status === status;
    return matchesText && matchesStatus;
  });

  $("#alertList").innerHTML = filtered.map(alert => `
    <div class="alert">
      <div>
        <b class="${priorityClass(alert.priority)}">${alert.priority}</b>
        <p>${alert.time} · ${alert.target}</p>
        <span>${alert.description}</span>
      </div>
      <button data-alert="${alert.id}">${alert.status}</button>
    </div>
  `).join("") || "<p>Nenhum alerta encontrado.</p>";

  $$("[data-alert]").forEach(button => {
    button.addEventListener("click", () => {
      const alert = alerts.find(a => a.id === Number(button.dataset.alert));
      const statuses = ["Pendente", "Visualizado", "Resolvido"];
      alert.status = statuses[(statuses.indexOf(alert.status) + 1) % statuses.length];
      renderAlerts();
      renderHome();
      notify("Status atualizado: " + alert.status);
    });
  });
}

$("#filter").addEventListener("change", () => renderRadar("#bigRadar", true));

$("#range").addEventListener("change", event => {
  radarRange = Number(event.target.value);
  renderRadar("#bigRadar", true);
});

$("#pauseSweep").addEventListener("click", () => {
  sweepPaused = !sweepPaused;
  $("#pauseSweep").textContent = sweepPaused
    ? "Retomar varredura"
    : "Pausar varredura";

  $$(".sweep").forEach(sweep => {
    sweep.classList.toggle("paused", sweepPaused);
  });
});

$("#resetRadar").addEventListener("click", () => {
  radarRange = 100;
  $("#range").value = "100";
  $("#filter").value = "all";
  renderRadar("#bigRadar", true);
  notify("Radar restaurado");
});

$("#alertSearch").addEventListener("input", renderAlerts);
$("#alertStatus").addEventListener("change", renderAlerts);

$("#saveDecision").addEventListener("click", () => {
  notify("Observação registrada nesta sessão.");
});

$("#simSpeed").addEventListener("change", event => {
  simulationSpeed = Number(event.target.value);
  notify("Velocidade ajustada");
});

$("#pauseSimulation").addEventListener("click", () => {
  simulationPaused = !simulationPaused;
  $("#pauseSimulation").textContent = simulationPaused
    ? "Retomar simulação"
    : "Pausar simulação";
});

$("#restartSimulation").addEventListener("click", () => {
  elapsed = 0;
  notify("Cronômetro reiniciado");
});

function tick() {
  if (simulationPaused) return;

  elapsed += simulationSpeed;

  const seconds = Math.floor(elapsed);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");

  $("#clock").textContent =
    `${hours}:${minutes}:${remainder}`;

  targets.forEach(target => {
    target.x += 0.0015 * simulationSpeed *
      (target.id === "T-04" ? -1 : 1);
    target.y += 0.0008 * simulationSpeed;

    if (target.x > .78 || target.x < -.78)
      target.x *= -1;

    if (target.y > .78)
      target.y = -.78;

    target.heading = (target.heading + 1) % 360;
  });
  lastTick = Date.now();
  tickExtras();

}

const kindName = { friend: "Aliado", unknown: "Desconhecido", threat: "Hostil", critical: "Hostil crítico" };
const kindHelp = { friend: "identificado pelo IFF como aliado.", unknown: "ainda sem identificação.", threat: "ameaça confirmada.", critical: "ameaça confirmada, prioridade máxima." };
const interceptors = [{ id: "I-01", range: 70 }, { id: "I-02", range: 120 }];
const plan = {};
const actions = [];
const tutSteps = [
  ["Selecione um alvo no radar", "Clique em um símbolo para ver distância e tempo até o impacto."],
  ["Calcule a rota", "Em Alvos, escolha o interceptador e clique em Calcular rota."],
  ["Autorize com confirmação", "Você confirma antes de agir e pode desfazer por 5 s."]
];
let lastTick = Date.now(), focusOn = false, soundOn = true, alertOn = false, undoTimer = null, tut = 0;

const dist = t => Math.hypot(t.x, t.y) * 65 + 10;
const eta = t => dist(t) * 1000 / t.speed;
const fmt = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
const isDim = t => focusOn && t.kind !== "critical" && t.id !== selectedId;
const P = t => plan[t.id] || (plan[t.id] = { step: t.kind === "unknown" ? 0 : 1, int: "I-01", iff: 0 });

// H2
function shape(kind, x, y, c) {
  const s = `fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="2"`;
  if (kind === "friend") return `<circle cx="${x}" cy="${y}" r="6" ${s}/>`;
  if (kind === "unknown") return `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" ${s}/>`;
  return `<path d="M${x} ${y - 9}L${x + 9} ${y}L${x} ${y + 9}L${x - 9} ${y}Z" ${s}/>`;
}

// H6
function logAction(m) {
  actions.unshift(new Date().toLocaleTimeString("pt-BR") + " · " + m);
  actions.length = Math.min(actions.length, 6);
  $("#actionLog").innerHTML = actions.map(a => `<li>${a}</li>`).join("");
}

// H7
function sortedThreats() { return targets.filter(t => t.kind !== "friend").sort((a, b) => eta(a) - eta(b)); }
function renderList() {
  const el = $("#threatList");
  if (!el) return;
  el.innerHTML = sortedThreats().map((t, i) => `<button class="row${t.id === selectedId ? " on" : ""}" data-pick="${t.id}"><i class="sh ${t.kind[0]}"></i><b>${t.id}</b> <span>${kindName[t.kind]}</span> <em>${fmt(eta(t))}</em> <kbd>${i + 1}</kbd></button>`).join("");
}

function refreshAll() {
  renderRadar("#bigRadar", true);
  renderHome();
  renderSelectedDetails();
  renderTargetDetails();
  renderPlan();
  renderList();
}
function pick(id) {
  selectedId = id;
  refreshAll();
  logAction("Selecionou " + id);
  notify("Contato " + id + " selecionado");
}

// H1 
function renderPlan() {
  const el = $("#plan");
  if (!el) return;
  const t = getTarget(), p = P(t), friend = t.kind === "friend";
  $("#crumb").textContent = `Perímetro Norte › Zona ${t.zone} › ${t.id}`;
  const steps = ["Detectado", "Identificado", "Rota calculada", "Engajado"];
  el.innerHTML = `
    <ol class="steps">${steps.map((s, i) => `<li class="${i < p.step ? "done" : i === p.step ? "now" : ""}">${i < p.step ? "✓" : i === p.step ? "●" : "○"} ${s}</li>`).join("")}</ol>
    <div class="detail"><span>Tempo até o impacto</span><b class="red">${friend ? "—" : fmt(eta(t))}</b></div>
    ${friend
      ? `<div class="infobox">ⓘ <b>Aliado identificado: engajamento bloqueado.</b><br>O IFF confirmou ${t.id} como aliado.</div>`
      : `<fieldset class="ints"><legend>Interceptador</legend>${interceptors.map(i => `<label><input type="radio" name="int" value="${i.id}" ${p.int === i.id ? "checked" : ""}> <b>${i.id}</b> · alcance ${i.range} km</label>`).join("")}</fieldset>`}
    <div id="routeError"></div>
    ${p.step === 0 && !friend ? `<button data-act="iff" title="Consulta o sistema de identificação (IFF)">Consultar identificação (IFF)</button>` : ""}
    <button data-act="route" ${friend || p.step < 1 ? "disabled" : ""} title="Calcula a rota do interceptador até o alvo">Calcular rota</button>
    <button class="danger" data-act="authorize" ${friend || p.step !== 2 ? "disabled" : ""} title="Autoriza o engajamento. Você poderá desfazer por 5 s.">Autorizar interceptação</button>
    ${p.step === 1 && !friend ? `<p class="hint">Calcule a rota para liberar a autorização.</p>` : ""}`;
}

// H9
function showErr(msg, buttons = "") {
  $("#routeError").innerHTML = `<div class="errbox" role="alert">✕ ${msg}<br>${buttons}</div>`;
}

function ask(html) {
  $("#dlg").innerHTML = html;
  if (!$("#dlg").open) $("#dlg").showModal();
}

function act(a) {
  const t = getTarget(), p = P(t);
  if (a === "close") return $("#dlg").close();
  if (a === "iff") {
    p.iff++;
    if (p.iff < 2) return showErr("Sem resposta de identificação do contato " + t.id + ".", `<button data-act="iff">Tentar novamente</button> <button data-act="manual">Classificar manualmente como hostil</button>`);
    p.step = 1; logAction("IFF consultado: " + t.id); return renderPlan();
  }
  if (a === "manual") { t.kind = "threat"; p.step = 1; logAction("Classificação manual: " + t.id); return refreshAll(); }
  if (a === "route") {
    p.int = ($("input[name=int]:checked") || {}).value || p.int;
    const it = interceptors.find(i => i.id === p.int), d = dist(t);
    if (d > it.range) {
      logAction(`Falha de rota ${t.id} com ${it.id}`);
      return showErr(`Não foi possível calcular a rota. ${t.id} está fora do alcance de ${it.id} (alcance ${it.range} km, alvo a ${d.toFixed(0)} km).`, `<button data-act="other">Escolher outro interceptador</button> <button data-act="back">Voltar ao radar</button>`);
    }
    p.step = Math.max(p.step, 2); logAction(`Rota calculada ${it.id} → ${t.id}`); return renderPlan();
  }
  if (a === "other") { p.int = interceptors.reduce((m, i) => i.range > m.range ? i : m).id; notify("Selecionado " + p.int); return renderPlan(); }
  if (a === "back") return showPage("radar");
  if (a === "authorize") {
    if (t.kind === "friend") return notify("Aliado identificado: engajamento bloqueado.");
    if (p.step < 2) return notify("Calcule a rota antes de autorizar.");
    // H5
    return ask(`<h2>Autorizar interceptação de ${t.id}?</h2>
      <div class="detail"><span>Classificação</span><b>${kindName[t.kind]}</b></div>
      <div class="detail"><span>Zona</span><b>${t.zone}</b></div>
      <div class="detail"><span>Impacto em</span><b class="red">${fmt(eta(t))}</b></div>
      <div class="detail"><span>Interceptador</span><b>${p.int}</b></div>
      <div class="row-btns"><button data-act="close">Cancelar</button><button class="danger" data-act="confirm">Confirmar interceptação</button></div>`);
  }
  if (a === "confirm") { $("#dlg").close(); p.step = 3; logAction("Interceptação autorizada: " + t.id); startUndo(t); return renderPlan(); }
  if (a === "undo") { clearInterval(undoTimer); $("#undo").hidden = true; p.step = 2; logAction("Engajamento desfeito: " + t.id); return renderPlan(); }
  if (a === "goPlan") return showPage("targets");
  if (a === "dismiss") { alertOn = false; focusOn = false; $("#redAlert").hidden = true; $("#focusBtn").classList.remove("on"); return refreshAll(); }
  if (a === "tut") { tut = 0; return tutorial(); }
  if (a === "tutNext" || a === "tutSkip") {
    const never = $("#tutNever") && $("#tutNever").checked;
    if (a === "tutNext" && tut < 2) { tut++; return tutorial(); }
    try { if (never || a === "tutNext") localStorage.setItem("aerionTut", "1"); } catch (e) {}
    $("#dlg").close();
  }
}

// H3
function startUndo(t) {
  const u = $("#undo"); let n = 5;
  u.hidden = false;
  u.innerHTML = `Interceptação autorizada · <b>${t.id}</b> <button data-act="undo">Desfazer</button> <span id="uc">5 s</span><div class="bar"><i></i></div>`;
  clearInterval(undoTimer);
  undoTimer = setInterval(() => {
    n--;
    if ($("#uc")) $("#uc").textContent = n + " s";
    if (n <= 0) {
      clearInterval(undoTimer); u.hidden = true;
      const al = alerts.find(x => x.target === t.id && x.status !== "Resolvido");
      if (al) al.status = "Resolvido";
      renderHome(); logAction("Engajamento de " + t.id + " concluído");
    }
  }, 1000);
}

// H10
function tutorial() {
  const [h, p] = tutSteps[tut];
  ask(`<span class="hint">${tut + 1} de 3</span><h2>${h}</h2><p>${p}</p>
    <label><input type="checkbox" id="tutNever"> Não mostrar novamente</label>
    <div class="row-btns"><button data-act="tutSkip">Pular</button><button class="primary" data-act="tutNext">${tut === 2 ? "Concluir" : "Avançar"}</button></div>`);
}
function help() {
  ask(`<h2>Como operar</h2>
    <ol><li>No radar, clique em um contato (ou use as teclas 1 a 4).</li><li>Em Alvos, escolha o interceptador e clique em <b>Calcular rota</b>.</li><li>Clique em <b>Autorizar interceptação</b>, confirme e, se precisar, desfaça em até 5 s.</li></ol>
    <h2>Atalhos</h2><p><kbd>Espaço</kbd> pausa a varredura · <kbd>1–4</kbd> seleciona ameaça · <kbd>Enter</kbd> autoriza · <kbd>?</kbd> ajuda<br>Voz ou texto: “interceptar T-04”</p>
    <h2>Símbolos</h2><p>Círculo: aliado · Quadrado: desconhecido · Losango: hostil (vermelho = crítico)</p>
    <div class="row-btns"><button data-act="tut">Rever tutorial</button><button class="primary" data-act="close">Fechar</button></div>`);
}

// H11 (AVA)
function siren() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime;
    o.type = "sawtooth"; g.gain.value = .05; o.connect(g); g.connect(a.destination);
    for (let i = 0; i < 4; i++) o.frequency.setValueAtTime(i % 2 ? 600 : 900, t0 + i * .35);
    o.start(t0); o.stop(t0 + 1.4);
  } catch (e) {}
}
function updateBanner() {
  const t = targets.find(x => x.kind === "critical");
  if (!t || !alertOn) return;
  $("#redAlert").innerHTML = `<b>ALERTA VERMELHO: contato crítico ${t.id} na zona ${t.zone} · impacto em ${fmt(eta(t))}</b> <button data-act="goPlan">Calcular interceptação</button> <button data-act="dismiss">Dispensar</button>`;
}
function redAlert() {
  const t = targets.find(x => x.kind === "critical");
  if (!t) return;
  alertOn = true; focusOn = true; selectedId = t.id;
  $("#focusBtn").classList.add("on");
  $("#redAlert").hidden = false;
  updateBanner();
  const msg = `Alerta vermelho. Contato crítico ${t.id}, zona ${t.zone}.`;
  $("#captions").innerHTML = `${soundOn ? "🔊 Sirene: alerta vermelho" : "🔇 Som desligado"}<br>Voz: “${msg}”`;
  setTimeout(() => $("#captions").innerHTML = "", 7000);
  if (soundOn) { siren(); try { const u = new SpeechSynthesisUtterance(msg); u.lang = "pt-BR"; speechSynthesis.speak(u); } catch (e) {} }
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
  refreshAll(); logAction("Alerta vermelho: " + t.id);
}
function runCommand(text) {
  const m = text.toLowerCase().match(/(interceptar|selecionar)\s+([atc])[-\s]?0?(\d+)/);
  if (!m) return notify("Comando não entendido. Exemplo: interceptar T-04");
  const id = m[2].toUpperCase() + "-" + m[3].padStart(2, "0");
  if (!targets.find(t => t.id === id)) return notify("Alvo " + id + " não encontrado");
  pick(id); showPage("targets"); logAction("Comando: " + text);
  if (m[1] === "interceptar") act("authorize");
}

function tickExtras() { updateBanner(); renderList(); }

function initExtras() {
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"), r = e.target.closest("[data-pick]");
    if (b) act(b.dataset.act);
    if (r) pick(r.dataset.pick);
  });
  // H7
  document.addEventListener("keydown", e => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (["input", "textarea", "select"].includes(tag) || $("#dlg").open || e.ctrlKey || e.metaKey) return;
    if (e.target.matches && e.target.matches("[data-target]") && e.key === "Enter") return pick(e.target.dataset.target);
    if (e.key === " " && tag !== "button") { e.preventDefault(); $("#pauseSweep").click(); }
    else if (/^[1-4]$/.test(e.key)) { const t = sortedThreats()[Number(e.key) - 1]; if (t) pick(t.id); }
    else if (e.key === "Enter" && tag !== "button") act("authorize");
    else if (e.key === "?") help();
  });
  $("#cmd").addEventListener("keydown", e => { if (e.key === "Enter") { runCommand(e.target.value); e.target.value = ""; } });
  $("#mic").addEventListener("click", () => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { notify("Sem reconhecimento de voz neste navegador. Digite o comando."); return $("#cmd").focus(); }
    const r = new R(); r.lang = "pt-BR";
    r.onresult = e => runCommand(e.results[0][0].transcript);
    r.onerror = () => notify("Não consegui ouvir. Tente digitar o comando.");
    r.start(); notify("Ouvindo… diga “interceptar T-04”");
  });
  $("#soundBtn").addEventListener("click", () => { soundOn = !soundOn; $("#soundBtn").textContent = soundOn ? "🔊 Som" : "🔇 Mudo"; });
  $("#helpBtn").addEventListener("click", help);
  $("#simAlert").addEventListener("click", redAlert);
  // H8
  $("#focusBtn").addEventListener("click", () => {
    focusOn = !focusOn; $("#focusBtn").classList.toggle("on", focusOn);
    renderRadar("#bigRadar", true); renderHome();
  });
  // H1
  setInterval(() => {
    $("#sweepStatus").textContent = `Varredura ${sweepPaused ? "pausada" : "ativa"} · dados atualizados há ${Math.round((Date.now() - lastTick) / 1000)} s`;
  }, 1000);
  renderPlan(); renderList();
  let seen = false;
  try { seen = !!localStorage.getItem("aerionTut"); } catch (e) {}
  if (!seen) tutorial();
}

renderHome();
renderRadar("#bigRadar", true);
renderSelectedDetails();
renderTargetDetails();
renderAlerts();
setInterval(tick, 1000);
initExtras();
