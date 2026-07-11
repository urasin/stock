(function () {
  const storageKey = "stock-personal-doc:v1";
  const storage = getStorage();
  const defaultState = {
    watchlist: [],
    notes: [],
    checklist: {},
    seeded: [],
    updatedAt: null,
  };
  let state = loadState();
  if (applySeedData(state)) {
    state.updatedAt = new Date().toISOString();
    storage.setItem(storageKey, JSON.stringify(state));
  }

  const stockForm = document.querySelector("[data-stock-form]");
  const noteForm = document.querySelector("[data-note-form]");
  const watchlistBody = document.querySelector("[data-watchlist]");
  const noteSymbols = document.querySelector("[data-note-symbols]");
  const notesList = document.querySelector("[data-notes-list]");
  const searchInput = document.querySelector("[data-search]");
  const statusFilter = document.querySelector("[data-status-filter]");
  const statusMessage = document.querySelector("[data-status-message]");
  const updatedAt = document.querySelector("[data-updated-at]");

  if (noteForm?.elements.date) {
    noteForm.elements.date.value = today();
  }

  stockForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(stockForm);
    const id = String(formData.get("id") || "").trim();
    const symbol = normalizeSymbol(formData.get("symbol"));
    if (!symbol) return;

    const record = {
      id: id || createId(),
      symbol,
      name: clean(formData.get("name")),
      market: clean(formData.get("market")) || "JP",
      status: clean(formData.get("status")) || "調査中",
      currentPrice: parseNumber(formData.get("currentPrice")),
      targetPrice: parseNumber(formData.get("targetPrice")),
      reviewDate: clean(formData.get("reviewDate")),
      nextAction: clean(formData.get("nextAction")),
      thesis: clean(formData.get("thesis")),
      updatedAt: new Date().toISOString(),
    };

    const duplicate = state.watchlist.find(
      (item) => item.id !== record.id && item.symbol === record.symbol && item.market === record.market,
    );
    const index = state.watchlist.findIndex((item) => item.id === record.id);

    if (duplicate) {
      record.id = duplicate.id;
      state.watchlist = state.watchlist.map((item) => (item.id === duplicate.id ? record : item));
      showMessage("既存銘柄を更新しました。");
    } else if (index >= 0) {
      state.watchlist[index] = record;
      showMessage("銘柄を更新しました。");
    } else {
      state.watchlist.unshift(record);
      showMessage("銘柄を追加しました。");
    }

    resetStockForm();
    saveAndRender();
  });

  document.querySelector("[data-clear-stock]")?.addEventListener("click", resetStockForm);

  watchlistBody?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const item = state.watchlist.find((record) => record.id === button.dataset.id);
    if (!item) return;

    if (button.dataset.action === "edit") {
      fillStockForm(item);
      stockForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (button.dataset.action === "delete" && confirm(`${item.symbol} を削除しますか？`)) {
      state.watchlist = state.watchlist.filter((record) => record.id !== item.id);
      state.notes = state.notes.filter((note) => note.symbol !== item.symbol);
      showMessage("銘柄を削除しました。");
      saveAndRender();
    }
  });

  noteForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(noteForm);
    const body = clean(formData.get("body"));
    if (!body) return;

    state.notes.unshift({
      id: createId(),
      symbol: clean(formData.get("symbol")),
      type: clean(formData.get("type")) || "仮説",
      date: clean(formData.get("date")) || today(),
      body,
      createdAt: new Date().toISOString(),
    });

    noteForm.elements.body.value = "";
    if (noteForm.elements.date) noteForm.elements.date.value = today();
    showMessage("ノートを追加しました。");
    saveAndRender();
  });

  notesList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-note-delete]");
    if (!button) return;
    if (!confirm("このノートを削除しますか？")) return;
    state.notes = state.notes.filter((note) => note.id !== button.dataset.noteDelete);
    showMessage("ノートを削除しました。");
    saveAndRender();
  });

  searchInput?.addEventListener("input", renderWatchlist);
  statusFilter?.addEventListener("change", renderWatchlist);

  document.querySelectorAll("[data-check]").forEach((input) => {
    input.checked = state.checklist[input.dataset.check] === true;
    input.addEventListener("change", () => {
      state.checklist[input.dataset.check] = input.checked;
      saveAndRender();
    });
  });

  document.querySelector("[data-reset-checks]")?.addEventListener("click", () => {
    state.checklist = {};
    showMessage("チェックをリセットしました。");
    saveAndRender();
  });

  document.querySelector("[data-export]")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-personal-doc-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  document.querySelector("[data-import]")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const imported = JSON.parse(String(reader.result || "{}"));
        state = normalizeState(imported);
        showMessage("データを読み込みました。");
        saveAndRender();
      } catch (_error) {
        showMessage("JSONを読み込めませんでした。");
      } finally {
        event.target.value = "";
      }
    });
    reader.readAsText(file);
  });

  document.querySelector("[data-reset-all]")?.addEventListener("click", () => {
    if (!confirm("すべての保存データを削除しますか？")) return;
    state = structuredCloneSafe(defaultState);
    showMessage("保存データを削除しました。");
    saveAndRender();
  });

  renderAll();

  function renderAll() {
    renderStats();
    renderWatchlist();
    renderNoteSymbols();
    renderNotes();
    renderChecklist();
    renderUpdatedAt();
  }

  function renderStats() {
    const records = state.watchlist;
    const owned = records.filter((item) => item.status === "保有").length;
    const watching = records.filter((item) => item.status === "監視").length;
    const upsides = records
      .map(getUpside)
      .filter((value) => Number.isFinite(value));
    const avgUpside = upsides.length
      ? upsides.reduce((total, value) => total + value, 0) / upsides.length
      : null;
    const nextReview = records
      .map((item) => item.reviewDate)
      .filter(Boolean)
      .sort()[0];

    setStat("total", String(records.length));
    setStat("owned", String(owned));
    setStat("watching", String(watching));
    setStat("avg-upside", avgUpside === null ? "-" : formatPercent(avgUpside));
    setStat("next-review", nextReview || "未設定");
  }

  function renderWatchlist() {
    const query = clean(searchInput?.value).toLowerCase();
    const status = clean(statusFilter?.value);
    const rows = state.watchlist
      .filter((item) => !status || item.status === status)
      .filter((item) => {
        if (!query) return true;
        return [item.symbol, item.name, item.market, item.status, item.nextAction, item.thesis]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(sortByReviewDate);

    if (!watchlistBody) return;
    if (rows.length === 0) {
      watchlistBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="10">銘柄はまだ登録されていません。</td>
        </tr>
      `;
      return;
    }

    watchlistBody.innerHTML = rows
      .map((item) => {
        const upside = getUpside(item);
        const upsideClass = Number.isFinite(upside)
          ? upside >= 0
            ? "upside-positive"
            : "upside-negative"
          : "";
        const thesis = item.thesis ? `<small>${escapeHtml(item.thesis)}</small>` : "";
        return `
          <tr>
            <td class="symbol-cell">
              <strong>${escapeHtml(item.symbol)}</strong>
              ${thesis}
            </td>
            <td>${escapeHtml(item.name || "-")}</td>
            <td>${escapeHtml(item.market || "-")}</td>
            <td><span class="status-pill" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
            <td class="num">${formatPrice(item.currentPrice)}</td>
            <td class="num">${formatPrice(item.targetPrice)}</td>
            <td class="num ${upsideClass}">${Number.isFinite(upside) ? formatPercent(upside) : "-"}</td>
            <td>${escapeHtml(item.reviewDate || "-")}</td>
            <td>${escapeHtml(item.nextAction || "-")}</td>
            <td>
              <div class="row-actions">
                <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}">編集</button>
                <button type="button" data-action="delete" data-id="${escapeHtml(item.id)}">削除</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderNoteSymbols() {
    if (!noteSymbols) return;
    const current = noteSymbols.value;
    const options = state.watchlist
      .slice()
      .sort((a, b) => a.symbol.localeCompare(b.symbol, "ja"))
      .map((item) => {
        const label = item.name ? `${item.symbol} ${item.name}` : item.symbol;
        return `<option value="${escapeHtml(item.symbol)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    noteSymbols.innerHTML = `<option value="">全体メモ</option>${options}`;
    noteSymbols.value = current;
  }

  function renderNotes() {
    if (!notesList) return;
    if (state.notes.length === 0) {
      notesList.innerHTML = `<p class="muted">ノートはまだありません。</p>`;
      return;
    }

    notesList.innerHTML = state.notes
      .slice(0, 20)
      .map((note) => {
        const symbol = note.symbol ? note.symbol : "全体";
        return `
          <article class="note-item">
            <div class="note-meta">
              <div>
                <strong>${escapeHtml(symbol)} / ${escapeHtml(note.type)}</strong>
                <span>${escapeHtml(note.date || "")}</span>
              </div>
              <button type="button" data-note-delete="${escapeHtml(note.id)}">削除</button>
            </div>
            <div class="note-body">${escapeHtml(note.body)}</div>
          </article>
        `;
      })
      .join("");
  }

  function renderChecklist() {
    const inputs = Array.from(document.querySelectorAll("[data-check]"));
    inputs.forEach((input) => {
      input.checked = state.checklist[input.dataset.check] === true;
    });

    const total = inputs.length;
    const done = inputs.filter((input) => input.checked).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    const progressText = document.querySelector("[data-check-progress]");
    const progressBar = document.querySelector("[data-check-progress-bar]");
    if (progressText) progressText.textContent = `${done}/${total} 完了`;
    if (progressBar) progressBar.style.width = `${percent}%`;
  }

  function renderUpdatedAt() {
    if (!updatedAt) return;
    updatedAt.textContent = state.updatedAt
      ? `保存: ${formatDateTime(state.updatedAt)}`
      : "未保存";
  }

  function saveAndRender() {
    state.updatedAt = new Date().toISOString();
    storage.setItem(storageKey, JSON.stringify(state));
    renderAll();
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(storage.getItem(storageKey) || "null"));
    } catch (_error) {
      return structuredCloneSafe(defaultState);
    }
  }

  function normalizeState(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      watchlist: Array.isArray(source.watchlist) ? source.watchlist.map(normalizeStock) : [],
      notes: Array.isArray(source.notes) ? source.notes.map(normalizeNote) : [],
      checklist: source.checklist && typeof source.checklist === "object" ? source.checklist : {},
      seeded: Array.isArray(source.seeded) ? source.seeded.map(clean).filter(Boolean) : [],
      updatedAt: clean(source.updatedAt),
    };
  }

  function applySeedData(targetState) {
    const seed = window.STOCK_PERSONAL_DOC_SEED;
    if (!seed || typeof seed !== "object") return false;

    const seeded = new Set(targetState.seeded || []);
    let changed = false;

    if (Array.isArray(seed.watchlist)) {
      seed.watchlist.map(normalizeStock).forEach((seedStock) => {
        if (!seedStock.symbol || seeded.has(seedStock.id)) return;
        const exists = targetState.watchlist.some(
          (item) => item.symbol === seedStock.symbol && item.market === seedStock.market,
        );
        seeded.add(seedStock.id);
        if (!exists) {
          targetState.watchlist.unshift(seedStock);
          changed = true;
        }
      });
    }

    if (Array.isArray(seed.notes)) {
      seed.notes.map(normalizeNote).forEach((seedNote) => {
        if (!seedNote.body || seeded.has(seedNote.id)) return;
        const exists = targetState.notes.some((note) => note.id === seedNote.id);
        seeded.add(seedNote.id);
        if (!exists) {
          targetState.notes.unshift(seedNote);
          changed = true;
        }
      });
    }

    targetState.seeded = Array.from(seeded);
    return changed;
  }

  function normalizeStock(item) {
    return {
      id: clean(item.id) || createId(),
      symbol: normalizeSymbol(item.symbol),
      name: clean(item.name),
      market: clean(item.market) || "JP",
      status: clean(item.status) || "調査中",
      currentPrice: parseNumber(item.currentPrice),
      targetPrice: parseNumber(item.targetPrice),
      reviewDate: clean(item.reviewDate),
      nextAction: clean(item.nextAction),
      thesis: clean(item.thesis),
      updatedAt: clean(item.updatedAt),
    };
  }

  function normalizeNote(item) {
    return {
      id: clean(item.id) || createId(),
      symbol: normalizeSymbol(item.symbol),
      type: clean(item.type) || "仮説",
      date: clean(item.date) || today(),
      body: clean(item.body),
      createdAt: clean(item.createdAt),
    };
  }

  function resetStockForm() {
    stockForm.reset();
    stockForm.elements.id.value = "";
    stockForm.elements.market.value = "JP";
    stockForm.elements.status.value = "調査中";
  }

  function fillStockForm(item) {
    stockForm.elements.id.value = item.id;
    stockForm.elements.symbol.value = item.symbol;
    stockForm.elements.name.value = item.name || "";
    stockForm.elements.market.value = item.market || "JP";
    stockForm.elements.status.value = item.status || "調査中";
    stockForm.elements.currentPrice.value = item.currentPrice ?? "";
    stockForm.elements.targetPrice.value = item.targetPrice ?? "";
    stockForm.elements.reviewDate.value = item.reviewDate || "";
    stockForm.elements.nextAction.value = item.nextAction || "";
    stockForm.elements.thesis.value = item.thesis || "";
  }

  function getUpside(item) {
    if (!Number.isFinite(item.currentPrice) || !Number.isFinite(item.targetPrice) || item.currentPrice <= 0) {
      return null;
    }
    return item.targetPrice / item.currentPrice - 1;
  }

  function sortByReviewDate(a, b) {
    const aDate = a.reviewDate || "9999-12-31";
    const bDate = b.reviewDate || "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.symbol.localeCompare(b.symbol, "ja");
  }

  function setStat(name, value) {
    const element = document.querySelector(`[data-stat="${name}"]`);
    if (element) element.textContent = value;
  }

  function showMessage(message) {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    clearTimeout(showMessage.timeoutId);
    showMessage.timeoutId = setTimeout(() => {
      statusMessage.textContent = "";
    }, 3600);
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function normalizeSymbol(value) {
    return clean(value).toUpperCase();
  }

  function parseNumber(value) {
    const text = clean(value).replace(/,/g, "");
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function formatPrice(value) {
    return Number.isFinite(value)
      ? new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value)
      : "-";
  }

  function formatPercent(value) {
    return new Intl.NumberFormat("ja-JP", {
      style: "percent",
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(value);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "未保存";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function today() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function structuredCloneSafe(value) {
    if (window.structuredClone) return window.structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function getStorage() {
    try {
      const testKey = `${storageKey}:test`;
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch (_error) {
      const fallback = new Map();
      return {
        getItem: (key) => fallback.get(key) || null,
        setItem: (key, value) => fallback.set(key, value),
        removeItem: (key) => fallback.delete(key),
      };
    }
  }
})();
