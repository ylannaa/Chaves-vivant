import { type FormEvent, useEffect, useMemo, useState } from "react";

type TowerId = "energie" | "harmonie";
type Status = "box" | "staff" | "delivered" | "missing";

type Movement = {
  id: string;
  status: Status;
  previousStatus: Status;
  person: string;
  company: string;
  note: string;
  date: string;
};

type Unit = {
  id: string;
  tower: TowerId;
  apartment: number;
  floor: number;
  status: Status;
  responsible: string;
  history: Movement[];
};

const TOWERS: Record<TowerId, { short: string; full: string; number: string }> = {
  energie: { short: "Energie", full: "Torre 1 — Energie", number: "01" },
  harmonie: { short: "Harmonie", full: "Torre 2 — Harmonie", number: "02" },
};

const STATUS: Record<Status, { label: string; color: string; light: string }> = {
  box: { label: "Na caixa", color: "#1E3A2F", light: "#E7EEEA" },
  staff: { label: "Com colaborador", color: "#D1BE8C", light: "#F5F0E3" },
  delivered: { label: "Entregue ao cliente", color: "#278047", light: "#E7F4EB" },
  missing: { label: "Perdida", color: "#C13232", light: "#F8E9E6" },
};

function makeInitialUnits(): Unit[] {
  return (["energie", "harmonie"] as TowerId[]).flatMap((tower) =>
    Array.from({ length: 68 }, (_, index) => {
      const floor = Math.floor(index / 2) + 1;
      const apartment = floor * 100 + (index % 2) + 1;
      return { id: `${tower}-${apartment}`, tower, apartment, floor,
        status: "box" as Status, responsible: "", history: [] };
    }),
  );
}

function Icon({
  name,
  size = 18,
}: {
  name: "search" | "download" | "key" | "building" | "clock" | "check" | "arrow" | "box";
  size?: number;
}) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
        <path d="M5 19h14" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 8-8m-3 3 2 2m-5 1 2 2" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V5l8-3 8 3v16" />
        <path d="M9 21v-4h6v4M8 8h1m6 0h1M8 12h1m6 0h1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    box: (
      <>
        <path d="m4 7 8-4 8 4v10l-8 4-8-4Z" />
        <path d="m4 7 8 4 8-4m-8 4v10" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(date))
    .replace(".", "");
}

function downloadCsv(units: Unit[]) {
  const header = [
    "Torre",
    "Apartamento",
    "Andar",
    "Status",
    "Último responsável",
    "Empresa / Setor",
    "Atualizado em",
  ];
  const rows = units.map((unit) => {
    const last = unit.history[0];
    return [
      TOWERS[unit.tower].full,
      unit.apartment,
      unit.floor,
      STATUS[unit.status].label,
      unit.responsible || "—",
      last?.company || "—",
      last ? formatDate(last.date) : "—",
    ];
  });
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(escape).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-chaves-vivant-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [units, setUnits] = useState<Unit[]>(makeInitialUnits);
  const [tower, setTower] = useState<TowerId>("energie");
  const [selectedId, setSelectedId] = useState("energie-101");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [mobileTab, setMobileTab] = useState<"map" | "movement">("map");
  const [toast, setToast] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [quantityLoading, setQuantityLoading] = useState(true);
  const [quantitySaving, setQuantitySaving] = useState(false);
  const [quantityError, setQuantityError] = useState("");

  useEffect(() => {
    fetch("/api/key-quantities")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const rows: { unitId: string; quantity: number }[] = await response.json();
        setQuantities(Object.fromEntries(rows.map((row) => [row.unitId, row.quantity])));
      })
      .catch(() => setQuantityError("Não foi possível carregar as quantidades. Tente recarregar a página."))
      .finally(() => setQuantityLoading(false));
  }, []);

  async function saveQuantity(event: FormEvent) {
    event.preventDefault();
    const unitId = selectedId;
    const value = quantityDrafts[unitId] ?? String(quantities[unitId] ?? "");
    if (!value.trim()) return;
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647) return;
    setQuantitySaving(true);
    setQuantityError("");
    try {
      const response = await fetch("/api/key-quantities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, quantity }),
      });
      if (!response.ok) throw new Error();
      setQuantities((current) => ({ ...current, [unitId]: quantity }));
      setToast("Quantidade de chaves salva");
    } catch {
      setQuantityError("Não foi possível salvar a quantidade. Tente novamente.");
    } finally {
      setQuantitySaving(false);
    }
  }
  const [form, setForm] = useState({
    status: "staff" as Status,
    person: "",
    company: "",
    note: "",
  });

  const [movementLoading, setMovementLoading] = useState(true);
  const [movementSaving, setMovementSaving] = useState(false);
  const [movementError, setMovementError] = useState("");
  useEffect(() => {
    try { localStorage.removeItem("vivant-key-control-v1"); } catch { /* O banco é a fonte dos registros. */ }
    fetch("/api/key-movements").then(async (response) => {
      if (!response.ok) throw new Error();
      const rows: { unitId: string; movement: Movement }[] = await response.json();
      setUnits(makeInitialUnits().map((unit) => {
        const history = rows.filter((row) => row.unitId === unit.id).map((row) => row.movement);
        return { ...unit, history, status: history[0]?.status ?? "box",
          responsible: history[0]?.status === "box" ? "" : history[0]?.person ?? "" };
      }));
      setMovementLoading(false);
    }).catch(() => setMovementError("Não foi possível carregar os registros. Recarregue a página."));
  }, []);

  async function persistMovement(unitId: string, movement: Movement) {
    setMovementSaving(true);
    setMovementError("");
    try {
      const response = await fetch("/api/key-movements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, movement }),
      });
      if (!response.ok) throw new Error();
      const saved: Movement = await response.json();
      Object.assign(movement, saved);
      return true;
    } catch {
      setMovementError("Não foi possível salvar. Confira sua conexão e tente novamente.");
      return false;
    } finally { setMovementSaving(false); }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const towerUnits = useMemo(() => units.filter((unit) => unit.tower === tower), [units, tower]);
  const selected = units.find((unit) => unit.id === selectedId) ?? towerUnits[0];
  const stats = (Object.keys(STATUS) as Status[]).map((key) => ({
    status: key,
    count: towerUnits.filter((unit) => unit.status === key).length,
  }));
  const filtered = towerUnits.filter((unit) => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch =
      !query ||
      String(unit.apartment).includes(query) ||
      unit.responsible.toLocaleLowerCase("pt-BR").includes(query);
    return matchesSearch && (statusFilter === "all" || unit.status === statusFilter);
  });
  const filteredIds = new Set(filtered.map((unit) => unit.id));
  const hasActiveFilter = Boolean(search.trim()) || statusFilter !== "all";

  function changeTower(nextTower: TowerId) {
    setTower(nextTower);
    chooseUnit(`${nextTower}-101`);
  }

  function chooseUnit(id: string, goToMovement = false) {
    setSelectedId(id);
    setForm({ status: "staff", person: "", company: "", note: "" });
    if (goToMovement && window.innerWidth <= 860) setMobileTab("movement");
  }

  async function registerMovement(event: FormEvent) {
    event.preventDefault();
    if (!selected || !form.person.trim() || !form.company) return;
    const movement: Movement = {
      id: crypto.randomUUID(),
      status: form.status,
      previousStatus: selected.status,
      person: form.person.trim(),
      company: form.company,
      note: form.note.trim(),
      date: new Date().toISOString(),
    };
    if (!(await persistMovement(selected.id, movement))) return;
    setUnits((current) =>
      current.map((unit) =>
        unit.id === selected.id
          ? {
              ...unit,
              status: form.status,
              responsible: form.status === "box" ? "" : form.person.trim(),
              history: [movement, ...unit.history],
            }
          : unit,
      ),
    );
    setForm({ status: "staff", person: "", company: "", note: "" });
    setToast(`Movimentação do apto ${selected.apartment} registrada`);
  }

  async function quickReturn() {
    if (!selected) return;
    const last = selected.history[0];
    const movement: Movement = {
      id: crypto.randomUUID(),
      status: "box",
      previousStatus: selected.status,
      person: last?.person ?? selected.responsible,
      company: last?.company ?? "Engenharia",
      note: "Devolução rápida para a caixa",
      date: new Date().toISOString(),
    };
    if (!(await persistMovement(selected.id, movement))) return;
    setUnits((current) =>
      current.map((unit) =>
        unit.id === selected.id
          ? { ...unit, status: "box", responsible: "", history: [movement, ...unit.history] }
          : unit,
      ),
    );
    setToast(`Chave do apto ${selected.apartment} devolvida à caixa`);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="key" size={19} />
          </div>
          <h1>Controle de Chaves <span>— Vivant</span></h1>
        </div>
        <div className="tower-switch" aria-label="Selecionar torre">
          {(Object.keys(TOWERS) as TowerId[]).map((item) => (
            <button
              key={item}
              className={tower === item ? "active" : ""}
              onClick={() => changeTower(item)}
            >
              Torre {item === "energie" ? "1" : "2"} - {TOWERS[item].short}
            </button>
          ))}
        </div>
        <div className="header-stats">
          {stats.map((item) => (
            <div className="header-stat" key={item.status}>
              <span style={{ background: STATUS[item.status].color }} />
              <strong>{item.count}</strong>
              <small>{STATUS[item.status].label}</small>
            </div>
          ))}
        </div>
        <button className="export-button" onClick={() => downloadCsv(units)}>
          <Icon name="download" size={16} />
          <span>Exportar CSV</span>
        </button>
      </header>

      <nav className="mobile-tabs" aria-label="Seções">
        <button className={mobileTab === "map" ? "active" : ""} onClick={() => setMobileTab("map")}>
          Mapa da torre
        </button>
        <button
          className={mobileTab === "movement" ? "active" : ""}
          onClick={() => setMobileTab("movement")}
        >
          Movimentação
        </button>
      </nav>

      <div className="workspace">
        <section className={`panel map-panel ${mobileTab === "map" ? "mobile-active" : ""}`}>
          <div className="map-toolbar">
            <label className="search-box">
              <Icon name="search" size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar apto ou responsável..."
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as Status | "all")}
            >
              <option value="all">Todos</option>
              <option value="box">Na caixa</option>
              <option value="staff">Com colaborador</option>
              <option value="delivered">Entregue ao cliente</option>
              <option value="missing">Perdida</option>
            </select>
            <span className="filter-count">
              {hasActiveFilter ? `${filtered.length} encontrados` : "68 unidades"}
            </span>
          </div>
          <div className="building-cap">
            <span>Final 01</span>
            <div>
              <Icon name="building" size={17} /> 34 andares
            </div>
            <span>Final 02</span>
          </div>
          <div className="building-map">
            {Array.from({ length: 34 }, (_, index) => 34 - index).map((floor) => (
              <div className="floor-row" key={floor}>
                <span className="floor-label">{String(floor).padStart(2, "0")}</span>
                {[1, 2].map((ending) => {
                  const apartment = floor * 100 + ending;
                  const unit = towerUnits.find((item) => item.apartment === apartment)!;
                  return (
                    <button
                      key={ending}
                      aria-label={`Apartamento ${apartment}, ${STATUS[unit.status].label}`}
                      className={[
                        selected?.id === unit.id ? "selected" : "",
                        hasActiveFilter && !filteredIds.has(unit.id) ? "dimmed" : "",
                        hasActiveFilter && filteredIds.has(unit.id) ? "match" : "",
                      ].join(" ")}
                      style={{ background: STATUS[unit.status].color }}
                      onClick={() => chooseUnit(unit.id, true)}
                    >
                      {apartment}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="legend">
            {(Object.keys(STATUS) as Status[]).map((key) => (
              <div key={key}>
                <span style={{ background: STATUS[key].color }} />
                {STATUS[key].label}
              </div>
            ))}
          </div>
        </section>

        <section
          className={`panel detail-panel ${mobileTab === "movement" ? "mobile-active" : ""}`}
        >
          {selected && (
            <>
              <div className="detail-hero">
                <div className="detail-topline">
                  <div>
                    <h2>Apto {selected.apartment}</h2>
                    <p>{selected.floor}º andar · {TOWERS[selected.tower].full.replace("—", "-")}</p>
                  </div>
                  <div className="detail-corner">
                  <span
                    style={{
                      background: STATUS[selected.status].light,
                      color: STATUS[selected.status].color,
                    }}
                  >
                    <i style={{ background: STATUS[selected.status].color }} />
                    {STATUS[selected.status].label}
                  </span>
                <form className="quantity-form" onSubmit={saveQuantity}>
                  <label htmlFor="key-quantity">Nº de cópias</label>
                  <div>
                    <input
                      id="key-quantity"
                      type="number"
                      min="0"
                      max="2147483647"
                      step="1"
                      required
                      placeholder={quantityLoading ? "Carregando..." : "0"}
                      disabled={quantityLoading || quantitySaving}
                      value={quantityDrafts[selected.id] ?? String(quantities[selected.id] ?? 0)}
                      onChange={(event) => setQuantityDrafts((current) => ({ ...current, [selected.id]: event.target.value }))}
                    />
                    <button type="submit" disabled={quantityLoading || quantitySaving}>
                      {quantitySaving ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                  {quantityError && <p role="alert">{quantityError}</p>}
                </form>
                  </div>
                </div>
                {selected.status === "staff" && (
                  <button className="return-button" disabled={movementLoading || movementSaving || !!movementError} onClick={quickReturn}>
                    <Icon name="box" size={17} /> Devolver para a caixa
                  </button>
                )}
              </div>

              <form className="movement-form" onSubmit={registerMovement}>
                <div className="form-title">
                  <div className="form-icon">
                    <Icon name="arrow" size={17} />
                  </div>
                  <div>
                    <p className="section-kicker">Nova atualização</p>
                    <h3>Registrar movimentação</h3>
                  </div>
                </div>
                <p className="form-help">Escolha a situação e informe quem está registrando a movimentação.</p>
                <fieldset className="status-options">
                  <legend>1. Onde estão as chaves?</legend>
                  {(Object.keys(STATUS) as Status[]).map((status) => (
                    <label key={status} className={form.status === status ? "chosen" : ""}>
                      <input type="radio" name="status" value={status} checked={form.status === status}
                        onChange={() => setForm({ ...form, status })} />
                      <span className="status-dot" style={{ background: STATUS[status].color }} />
                      {STATUS[status].label}
                    </label>
                  ))}
                </fieldset>
                <p className="step-label">2. Quem é o responsável?</p>
                <label>
                  Nome completo
                  <input
                    required
                    maxLength={200}
                    value={form.person}
                    onChange={(e) => setForm({ ...form, person: e.target.value })}
                    placeholder="Quem pegou ou devolveu?"
                  />
                </label>
                <label>
                  Empresa / setor
                  <select
                    required
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Engenharia</option>
                    <option>Assistência Técnica</option>
                    <option>Terceirizado</option>
                    <option>Cliente</option>
                    <option>Administração</option>
                  </select>
                </label>
                <label>
                  Observação <em>opcional</em>
                  <textarea
                    maxLength={2000}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Ex.: Vistoria, limpeza fina, reparo..."
                    rows={2}
                  />
                </label>
                <p className="timestamp-note">
                  <Icon name="clock" size={14} /> Data e hora serão registradas automaticamente
                </p>
                {movementError && <p className="form-error" role="alert">{movementError}</p>}
                <button className="submit-button" type="submit" disabled={movementLoading || movementSaving}>
                  <Icon name="check" size={17} /> {movementLoading ? "Carregando registros..." : movementSaving ? "Salvando..." : "Salvar movimentação"}
                </button>
              </form>

              <div className="history">
                <div className="history-heading">
                  <div>
                    <p className="section-kicker">Registros</p>
                    <h3>Linha do tempo</h3>
                  </div>
                  <span>{selected.history.length}</span>
                </div>
                {selected.history.length ? (
                  <div className="timeline">
                    {selected.history.map((item) => (
                      <article key={item.id}>
                        <div
                          className="timeline-marker"
                          style={{ background: STATUS[item.status].color }}
                        />
                        <div className="timeline-content">
                          <div className="timeline-status">
                            <strong>{STATUS[item.previousStatus].label}</strong>
                            <Icon name="arrow" size={13} />
                            <strong style={{ color: STATUS[item.status].color }}>
                              {STATUS[item.status].label}
                            </strong>
                          </div>
                          <h4>{item.person}</h4>
                          <p>
                            {item.company}
                          </p>
                          {item.note && <blockquote>{item.note}</blockquote>}
                          <time>{formatDate(item.date)}</time>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="history-empty">
                    <Icon name="clock" size={22} />
                    <p>Nenhuma movimentação registrada.</p>
                    <small>O histórico desta unidade aparecerá aqui.</small>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {toast && (
        <div className="toast">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
    </main>
  );
}
