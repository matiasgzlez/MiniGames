// Selector visual de ubicaciones de anuncios. Herramienta SOLO de desarrollo:
// nunca se incluye en el build de produccion (la inyecta el plugin de Vite
// injectGameAds solo cuando corre el dev server, y ademas esta guardada por
// import.meta.env.DEV).
//
// Uso: abrir cualquier pagina con ?adpick=1 (ej. http://localhost:5173/?adpick=1).
// Aparece un panel; se hace clic en el elemento donde se quiere un anuncio, se
// elige posicion (antes / despues / dentro) y tamano, y se acumula una lista. La
// lista persiste al navegar entre paginas (sessionStorage), asi se pueden marcar
// puntos en el landing, en juegos y en salas de una sola pasada. "Copiar JSON"
// copia la seleccion al portapapeles para pegarla y que se cableen los anuncios.

interface Pick {
  id: string;
  page: string; // location.pathname
  gameId: string | null; // parseado de /games/<id>/
  selector: string; // camino CSS al elemento ancla
  tag: string;
  elId: string;
  classes: string;
  text: string; // fragmento de texto del ancla
  position: "before" | "after" | "prepend" | "append";
  size: string; // etiqueta de tamano/formato elegido
}

const PARAM = "adpick";
const ON_KEY = "mg:adpick-on";
const PICKS_KEY = "mg:adpicks";

function isActive(): boolean {
  try {
    if (new URLSearchParams(location.search).has(PARAM)) {
      sessionStorage.setItem(ON_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(ON_KEY) === "1";
  } catch {
    return new URLSearchParams(location.search).has(PARAM);
  }
}

function loadPicks(): Pick[] {
  try {
    return JSON.parse(sessionStorage.getItem(PICKS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function savePicks(picks: Pick[]): void {
  try {
    sessionStorage.setItem(PICKS_KEY, JSON.stringify(picks));
  } catch {
    // ignore
  }
}

function gameIdFromPath(): string | null {
  const m = location.pathname.match(/\/games\/([^/]+)\//);
  return m ? m[1] : null;
}

// Camino CSS razonablemente unico hasta el elemento, para poder ubicarlo en el
// codigo despues. Usa id si hay; si no, tag + una clase significativa +
// nth-of-type entre hermanos del mismo tag.
function cssPath(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node !== document.body) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    let sel = node.tagName.toLowerCase();
    const cls = [...node.classList].find((c) => !c.startsWith("adpick"));
    if (cls) sel += `.${CSS.escape(cls)}`;
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = [...parent.children].filter((c) => c.tagName === node!.tagName);
      if (sameTag.length > 1) sel += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(sel);
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function describe(el: Element): Pick {
  return {
    id: Math.random().toString(36).slice(2, 9),
    page: location.pathname,
    gameId: gameIdFromPath(),
    selector: cssPath(el),
    tag: el.tagName.toLowerCase(),
    elId: (el as HTMLElement).id || "",
    classes: [...el.classList].filter((c) => !c.startsWith("adpick")).join(" "),
    text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
    position: "after",
    size: "Banner horizontal",
  };
}

const POSITIONS: Array<{ v: Pick["position"]; label: string }> = [
  { v: "before", label: "Antes de este elemento" },
  { v: "after", label: "Despues de este elemento" },
  { v: "prepend", label: "Dentro, al principio" },
  { v: "append", label: "Dentro, al final" },
];

const SIZES = ["Banner horizontal", "Rectangulo", "Rascacielos vertical", "Automatico (responsivo)"];

function injectCss(): void {
  const style = document.createElement("style");
  style.textContent = `
    .adpick-root { position: fixed; z-index: 2147483001; font: 13px/1.4 "Archivo", system-ui, sans-serif; color: #111; }
    .adpick-catcher { position: fixed; inset: 0; z-index: 2147483000; cursor: crosshair; background: transparent; }
    .adpick-hl { position: fixed; z-index: 2147483000; pointer-events: none; border: 2px solid #2b6cff; background: rgba(43,108,255,0.12); border-radius: 4px; transition: all 0.03s linear; }
    .adpick-hl__tag { position: absolute; top: -22px; left: 0; background: #2b6cff; color: #fff; font: 600 11px/1 "Archivo", system-ui, sans-serif; padding: 4px 6px; border-radius: 4px; white-space: nowrap; }
    .adpick-panel { position: fixed; top: 12px; right: 12px; width: 320px; max-height: calc(100vh - 24px); overflow: auto; z-index: 2147483003; background: #f4f2e6; border: 2px solid #111; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.35); padding: 12px; }
    .adpick-panel h3 { margin: 0 0 6px; font-size: 15px; font-weight: 800; }
    .adpick-panel p { margin: 0 0 10px; font-size: 12px; color: #555; }
    .adpick-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .adpick-item { border: 1px solid rgba(17,17,17,0.35); border-radius: 8px; padding: 6px 8px; background: #fff; font-size: 12px; position: relative; }
    .adpick-item b { display: block; font-size: 11px; color: #2b6cff; }
    .adpick-item span { color: #444; }
    .adpick-item__rm { position: absolute; top: 4px; right: 6px; cursor: pointer; border: none; background: none; font-size: 16px; line-height: 1; color: #b00; }
    .adpick-empty { font-size: 12px; color: #888; font-style: italic; margin-bottom: 10px; }
    .adpick-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .adpick-btn { cursor: pointer; border: 2px solid #111; border-radius: 999px; padding: 7px 12px; font: 700 12px "Archivo", system-ui, sans-serif; background: #111; color: #f4f2e6; }
    .adpick-btn--ghost { background: transparent; color: #111; }
    .adpick-form { position: fixed; z-index: 2147483004; background: #f4f2e6; border: 2px solid #111; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.4); padding: 14px; width: 300px; }
    .adpick-form h4 { margin: 0 0 4px; font-size: 14px; font-weight: 800; }
    .adpick-form .adpick-target { font-size: 11px; color: #2b6cff; word-break: break-all; margin-bottom: 10px; }
    .adpick-form label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 8px 0 3px; }
    .adpick-form select { width: 100%; padding: 6px; border: 1px solid #111; border-radius: 8px; background: #fff; font: 13px "Archivo", system-ui, sans-serif; }
    .adpick-form .adpick-actions { margin-top: 12px; }
    .adpick-copybox { width: 100%; height: 120px; margin-top: 8px; font: 11px monospace; border: 1px solid #111; border-radius: 8px; padding: 6px; }
  `;
  document.head.append(style);
}

function run(): void {
  injectCss();
  let picks = loadPicks();

  const catcher = document.createElement("div");
  catcher.className = "adpick-catcher";

  const hl = document.createElement("div");
  hl.className = "adpick-hl";
  hl.style.display = "none";
  hl.innerHTML = `<div class="adpick-hl__tag"></div>`;
  const hlTag = hl.querySelector<HTMLElement>(".adpick-hl__tag")!;

  const panel = document.createElement("div");
  panel.className = "adpick-panel adpick-root";

  document.body.append(catcher, hl, panel);

  let formEl: HTMLElement | null = null;

  function elementUnder(x: number, y: number): Element | null {
    catcher.style.pointerEvents = "none";
    const el = document.elementFromPoint(x, y);
    catcher.style.pointerEvents = "";
    if (!el) return null;
    if (el.closest(".adpick-root, .adpick-form, .adpick-hl, .adpick-catcher")) return null;
    return el;
  }

  function onMove(e: MouseEvent): void {
    if (formEl) return;
    const el = elementUnder(e.clientX, e.clientY);
    if (!el) {
      hl.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    hl.style.display = "block";
    hl.style.left = `${r.left}px`;
    hl.style.top = `${r.top}px`;
    hl.style.width = `${r.width}px`;
    hl.style.height = `${r.height}px`;
    hlTag.textContent = `${el.tagName.toLowerCase()}${(el as HTMLElement).className && typeof (el as HTMLElement).className === "string" ? "." + [...el.classList][0] : ""}`;
  }

  function onClick(e: MouseEvent): void {
    if (formEl) return;
    e.preventDefault();
    e.stopPropagation();
    const el = elementUnder(e.clientX, e.clientY);
    if (!el) return;
    openForm(describe(el), e.clientX, e.clientY);
  }

  catcher.addEventListener("mousemove", onMove);
  catcher.addEventListener("click", onClick, true);

  function openForm(pick: Pick, x: number, y: number): void {
    hl.style.display = "none";
    catcher.style.pointerEvents = "none";
    formEl = document.createElement("div");
    formEl.className = "adpick-form adpick-root";
    formEl.innerHTML = `
      <h4>Nuevo anuncio</h4>
      <div class="adpick-target">${pick.selector}</div>
      <label>Posicion</label>
      <select class="adpick-pos">${POSITIONS.map((p) => `<option value="${p.v}"${p.v === pick.position ? " selected" : ""}>${p.label}</option>`).join("")}</select>
      <label>Tamano del anuncio</label>
      <select class="adpick-size">${SIZES.map((s) => `<option${s === pick.size ? " selected" : ""}>${s}</option>`).join("")}</select>
      <div class="adpick-actions">
        <button class="adpick-btn adpick-add">Agregar</button>
        <button class="adpick-btn adpick-btn--ghost adpick-cancel">Cancelar</button>
      </div>
    `;
    const left = Math.min(x, window.innerWidth - 320);
    const top = Math.min(y, window.innerHeight - 260);
    formEl.style.left = `${Math.max(8, left)}px`;
    formEl.style.top = `${Math.max(8, top)}px`;
    document.body.append(formEl);

    const posSel = formEl.querySelector<HTMLSelectElement>(".adpick-pos")!;
    const sizeSel = formEl.querySelector<HTMLSelectElement>(".adpick-size")!;
    formEl.querySelector<HTMLButtonElement>(".adpick-add")!.addEventListener("click", () => {
      pick.position = posSel.value as Pick["position"];
      pick.size = sizeSel.value;
      picks.push(pick);
      savePicks(picks);
      closeForm();
      renderList();
    });
    formEl.querySelector<HTMLButtonElement>(".adpick-cancel")!.addEventListener("click", closeForm);
  }

  function closeForm(): void {
    formEl?.remove();
    formEl = null;
    catcher.style.pointerEvents = "";
  }

  function renderList(): void {
    const items = picks.length
      ? `<div class="adpick-list">${picks
          .map(
            (p) => `
        <div class="adpick-item">
          <button class="adpick-item__rm" data-id="${p.id}" title="Quitar">&times;</button>
          <b>${p.gameId ? "juego: " + p.gameId : p.page}</b>
          <span>${p.size} &middot; ${POSITIONS.find((q) => q.v === p.position)?.label ?? p.position}</span><br>
          <span style="color:#888">${p.selector}</span>
        </div>`,
          )
          .join("")}</div>`
      : `<div class="adpick-empty">Todavia no marcaste ningun lugar.</div>`;

    panel.innerHTML = `
      <h3>Selector de anuncios (${picks.length})</h3>
      <p>Hace clic en el elemento donde queres un anuncio. La lista se guarda al cambiar de pagina.</p>
      ${items}
      <div class="adpick-actions">
        <button class="adpick-btn adpick-copy">Copiar JSON</button>
        <button class="adpick-btn adpick-btn--ghost adpick-clear">Limpiar</button>
        <button class="adpick-btn adpick-btn--ghost adpick-exit">Salir</button>
      </div>
    `;
    panel.querySelectorAll<HTMLButtonElement>(".adpick-item__rm").forEach((b) =>
      b.addEventListener("click", () => {
        picks = picks.filter((p) => p.id !== b.dataset.id);
        savePicks(picks);
        renderList();
      }),
    );
    panel.querySelector<HTMLButtonElement>(".adpick-copy")!.addEventListener("click", copyJson);
    panel.querySelector<HTMLButtonElement>(".adpick-clear")!.addEventListener("click", () => {
      picks = [];
      savePicks(picks);
      renderList();
    });
    panel.querySelector<HTMLButtonElement>(".adpick-exit")!.addEventListener("click", exit);
  }

  function copyJson(): void {
    const json = JSON.stringify(picks, null, 2);
    // eslint-disable-next-line no-console
    console.log("[adpick] seleccion:\n" + json);
    void navigator.clipboard?.writeText(json).catch(() => undefined);
    // Fallback visible para copiar a mano.
    const box = document.createElement("textarea");
    box.className = "adpick-copybox";
    box.value = json;
    box.readOnly = true;
    panel.append(box);
    box.select();
  }

  function exit(): void {
    try {
      sessionStorage.removeItem(ON_KEY);
    } catch {
      // ignore
    }
    catcher.remove();
    hl.remove();
    panel.remove();
    formEl?.remove();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (formEl) closeForm();
    }
  });

  renderList();
}

if (import.meta.env.DEV && isActive()) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
}
