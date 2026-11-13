const KEY = "pupShopLedger.v1";
const $ = (id) => document.getElementById(id);
const peso = (n) =>
  "₱" +
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

let db = load();
function load() {
  try {
    return migrate(
      JSON.parse(localStorage.getItem(KEY)) || {
        items: [],
        tx: [],
        opening: 0,
      },
    );
  } catch {
    return { items: [], tx: [], opening: 0 };
  }
}
// fix category typo and sanitize data (also used for imported backups)
function migrate(d) {
  const str = (v) => String(v ?? ""),
    num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const img = (v) =>
    typeof v === "string" && /^(data:image\/|placeholder\.jpeg)/.test(v)
      ? v
      : "";
  return {
    opening: num(d.opening),
    logo: img(d.logo),
    shop: (() => {
      const o = d.shop || {},
        c = (v, n) =>
          String(v ?? "")
            .trim()
            .slice(0, n);
      return {
        branch: c(o.branch, 60),
        address: c(o.address, 200),
        contact: c(o.contact, 100),
        notes: c(
          o.notes ?? (o.branch === undefined ? d.shopDetails : ""),
          2000,
        ),
      };
    })(),
    items: d.items.map((i) => ({
      id: str(i.id).replace(/[^\w-]/g, ""),
      name: str(i.name),
      cat:
        {
          "Photoes/Illustrations": "Photos/Illustrations",
          Drinkware: "Tableware",
        }[str(i.cat)] || str(i.cat),
      price: num(i.price),
      cost: num(i.cost),
      stock: num(i.stock),
      low: num(i.low),
      img: img(i.img),
    })),
    tx: d.tx.map((t) => ({
      ...t,
      id: str(t.id).replace(/[^\w-]/g, ""),
      date: isDate(t.date) ? t.date : today(),
      type: ["sale", "income", "restock", "expense"].includes(t.type)
        ? t.type
        : "expense",
      amount: num(t.amount),
      note: str(t.note),
      ...(t.qty != null ? { qty: num(t.qty) } : {}),
      ...(t.void ? { void: true } : {}),
    })),
  };
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    alert(
      "⚠ Could not save! Storage is full. Download a backup now and remove some product photos.",
    );
  }
}
const item = (id) => db.items.find((i) => i.id === id);

// signed cash effect
const signed = (t) =>
  t.void ? 0 : t.type === "sale" || t.type === "income" ? t.amount : -t.amount;
const live = (t) => !t.void;
const unitCost = (t) =>
  t.unitCost != null ? t.unitCost : item(t.itemId)?.cost || 0;
const profitOf = (f) =>
  db.tx
    .filter((t) => t.type === "sale" && live(t) && f(t))
    .reduce((a, t) => a + t.amount - unitCost(t) * (t.qty || 0), 0);

// ---- tabs
document
  .querySelectorAll("#tabs button")
  .forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
function showTab(name) {
  document
    .querySelectorAll("main > section")
    .forEach((s) => (s.hidden = s.id !== name));
  document
    .querySelectorAll("#tabs button")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  render();
}

// ---- dashboard
// ---- dashboard charts (plain SVG/CSS, works offline)
const niceMax = (m) => {
  if (m <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(m)),
    f = m / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};
const short = (n) =>
  n >= 1e6
    ? +(n / 1e6).toFixed(1) + "M"
    : n >= 1e3
      ? +(n / 1e3).toFixed(1) + "k"
      : String(Math.round(n));
const incomeOf = (t) =>
  t.type === "sale" || t.type === "income" ? t.amount : 0;
const costOf = (t) =>
  t.type === "sale"
    ? unitCost(t) * (t.qty || 0)
    : t.type === "expense"
      ? t.amount
      : 0;
// grouped column chart: labels[], series[{name,color,values[]}]
function colChart(labels, series, every = 1) {
  const W = 600,
    H = 230,
    L = 44,
    B = 26,
    T = 12,
    R = 6,
    n = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values))),
    gw = (W - L - R) / n;
  const bw = Math.min(22, (gw * 0.8) / series.length),
    y = (v) => T + (H - T - B) * (1 - v / max);
  let g = "";
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#eadfcf"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#777">${short(v)}</text>`;
  }
  labels.forEach((lb, i) => {
    const x0 = L + gw * i + (gw - bw * series.length) / 2;
    series.forEach((s, k) => {
      const v = s.values[i],
        h = Math.max(0, (H - T - B) * (v / max));
      g += `<rect x="${x0 + bw * k}" y="${y(v)}" width="${bw - 1}" height="${h}" rx="3" fill="${s.color}"><title>${esc(lb)} · ${esc(s.name)}: ${peso(v)}</title></rect>`;
    });
    if (i % every === 0)
      g += `<text x="${L + gw * i + gw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#777">${esc(lb)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${g}</svg>
    <div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`;
}
// horizontal bars: rows[{label,value,color,text}]
function hbar(rows) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return `<div class="hbars">${rows
    .map(
      (r) => `<div class="hb"><span class="hl">${esc(r.label)}</span>
    <span class="ht"><span style="width:${Math.max(r.value ? 2 : 0, (Math.abs(r.value) / max) * 100)}%;background:${r.color}"></span></span>
    <b class="hv">${r.text ?? peso(r.value)}</b></div>`,
    )
    .join("")}</div>`;
}
const C = { in: "#2e7d32", out: "#d9822b", net: "#800000", bad: "#b00020" };

function renderDash() {
  const d = today(),
    month = d.slice(0, 7),
    year = d.slice(0, 4);
  const live_ = db.tx.filter(live);
  const pl = (f) => {
    const L = live_.filter(f),
      sum = (g) => L.filter(g).reduce((a, t) => a + t.amount, 0);
    const sales = sum((t) => t.type === "sale"),
      other = sum((t) => t.type === "income");
    const cogs = L.filter((t) => t.type === "sale").reduce(
      (a, t) => a + unitCost(t) * (t.qty || 0),
      0,
    );
    const opex = sum((t) => t.type === "expense"),
      buys = sum((t) => t.type === "restock");
    return { sales, other, cogs, opex, buys, net: sales + other - cogs - opex };
  };
  const cards = (p) => `<div class="cards">
      <div class="card">Sales<b class="in">${peso(p.sales + p.other)}</b></div>
      <div class="card">Cost of products sold<b class="out">${peso(p.cogs)}</b></div>
      <div class="card">Other expenses<b class="out">${peso(p.opex)}</b></div>
      <div class="card" style="border-left-color:${p.net < 0 ? C.bad : C.in}">Net profit<b>${peso(p.net)}</b></div>
      <div class="card">Restock spending<b>${peso(p.buys)}</b></div></div>`;
  const breakdown = (p) =>
    hbar([
      { label: "Income", value: p.sales + p.other, color: C.in },
      { label: "Product cost", value: p.cogs, color: C.out },
      { label: "Other expenses", value: p.opex, color: C.out },
      { label: "Net profit", value: p.net, color: p.net < 0 ? C.bad : C.net },
    ]);
  const topBy = (f, by) => {
    const m = {};
    live_
      .filter((t) => t.type === "sale" && f(t))
      .forEach((t) => {
        const k = t.itemName || "(item)";
        m[k] = (m[k] || 0) + (by === "qty" ? t.qty || 0 : t.amount);
      });
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  };
  const noCost = db.items.filter((i) => !i.cost).length;

  // today
  const pT = pl((t) => t.date === d);
  const topT = topBy((t) => t.date === d, "amt");
  // this month: per day
  const dim = new Date(+year, +month.slice(5), 0).getDate();
  const days = Array.from({ length: dim }, (_, k) => String(k + 1)),
    inD = days.map(() => 0),
    exD = days.map(() => 0);
  live_
    .filter((t) => t.date.startsWith(month))
    .forEach((t) => {
      const k = +t.date.slice(8, 10) - 1;
      if (k >= 0 && k < dim) {
        inD[k] += incomeOf(t);
        exD[k] += costOf(t);
      }
    });
  const pM = pl((t) => t.date.startsWith(month)),
    topM = topBy((t) => t.date.startsWith(month), "qty");
  // this year: per month
  const MN = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    inY = Array(12).fill(0),
    exY = Array(12).fill(0);
  live_
    .filter((t) => t.date.startsWith(year))
    .forEach((t) => {
      const k = +t.date.slice(5, 7) - 1;
      if (k >= 0 && k < 12) {
        inY[k] += incomeOf(t);
        exY[k] += costOf(t);
      }
    });
  const pY = pl((t) => t.date.startsWith(year));
  // stocks
  const none = db.items.filter((i) => i.stock <= 0),
    low = db.items.filter((i) => i.stock > 0 && i.stock <= i.low),
    ok = db.items.length - none.length - low.length;
  const stockValue = db.items.reduce(
    (a, i) => a + Math.max(0, i.stock) * (i.cost || 0),
    0,
  );
  const balance =
    Number(db.opening || 0) + db.tx.reduce((a, t) => a + signed(t), 0);
  const seg = (n, c, l) =>
    n
      ? `<span style="flex:${n};background:${c}" title="${l}: ${n}">${n}</span>`
      : "";

  $("dash").innerHTML = `
    <div class="cards">
      <div class="card">Cash balance<b>${peso(balance)}</b></div>
      <div class="card">Stock value (at cost)<b>${peso(stockValue)}</b></div>
    </div>
    ${noCost ? `<div class="warn">⚠ ${noCost} product${noCost > 1 ? "s have" : " has"} no cost set, so profit is overstated. Add costs in the Items tab.</div>` : ""}

    <section class="dsec"><h3>📅 Today <small>${esc(d)}</small></h3>${cards(pT)}
      <div class="dgrid"><div><h4>Money today</h4>${breakdown(pT)}</div>
      <div><h4>Sales by product</h4>${topT.length ? hbar(topT.map(([n, v]) => ({ label: n, value: v, color: C.net }))) : "<p class='hint'>No sales yet today.</p>"}</div></div></section>

    <section class="dsec"><h3>🗓 This month <small>${MN[+month.slice(5) - 1]} ${year}</small></h3>${cards(pM)}
      <h4>Daily income vs. costs</h4>${colChart(
        days,
        [
          { name: "Income", color: C.in, values: inD },
          { name: "Costs & expenses", color: C.out, values: exD },
        ],
        dim > 16 ? 2 : 1,
      )}
      <h4>Top sellers (units)</h4>${topM.length ? hbar(topM.map(([n, v]) => ({ label: n, value: v, color: C.net, text: v + " sold" }))) : "<p class='hint'>No sales yet this month.</p>"}</section>

    <section class="dsec"><h3>📈 This year <small>${year}</small></h3>${cards(pY)}
      <h4>Monthly income vs. costs</h4>${colChart(MN, [
        { name: "Income", color: C.in, values: inY },
        { name: "Costs & expenses", color: C.out, values: exY },
      ])}</section>

    <section class="dsec"><h3>📦 Stocks</h3>
      <div class="segbar">${seg(ok, C.in, "In stock")}${seg(low, "#e0a100", "Low")}${seg(none.length, C.bad, "No stock")}</div>
      <div class="legend"><span><i style="background:${C.in}"></i>In stock ${ok}</span><span><i style="background:#e0a100"></i>Low ${low.length}</span><span><i style="background:${C.bad}"></i>No stock ${none.length}</span></div>
      <h4>No stock (${none.length})</h4>
      ${none.length ? none.map((i) => `<div class="item low">${esc(i.name)} <small>${esc(i.cat)}</small> — <b>No stock</b></div>`).join("") : "<p class='hint'>None 🎉</p>"}
      <h4>Low stock (${low.length})</h4>
      ${low.length ? low.map((i) => `<div class="item lowwarn">${esc(i.name)} <small>${esc(i.cat)}</small> — ${i.stock} left <small>(alert at ${i.low})</small></div>`).join("") : "<p class='hint'>None 🎉</p>"}
    </section>
    <p class="hint"><b>Net profit</b> = income − cost of the products sold − other expenses. Product cost counts when an item is sold; <b>Restock spending</b> is shown separately so it isn't counted twice.</p>`;
}

// ---- record form
function syncForm() {
  const t = $("txType").value;
  const needsItem = t === "sale" || t === "restock";
  $("itemWrap").hidden = $("qtyWrap").hidden = !needsItem;
  $("txItem").innerHTML = db.items
    .map((i) => `<option value="${i.id}">${esc(i.name)} (${i.stock})</option>`)
    .join("");
  autoAmount();
}
function autoAmount() {
  const t = $("txType").value,
    it = item($("txItem").value),
    q = Number($("txQty").value) || 0;
  if (it && t === "sale") $("txAmount").value = (it.price * q).toFixed(2);
  if (it && t === "restock")
    $("txAmount").value = ((it.cost || 0) * q).toFixed(2);
}
$("txType").onchange = syncForm;
$("txItem").onchange = $("txQty").oninput = autoAmount;
$("txForm").onsubmit = (e) => {
  e.preventDefault();
  const type = $("txType").value,
    amount = Number($("txAmount").value);
  const t = {
    id: uid(),
    date: $("txDate").value,
    type,
    amount,
    note: $("txNote").value.trim(),
  };
  if (type === "sale" || type === "restock") {
    const it = item($("txItem").value);
    if (!it) return flash("txMsg", "Add an item first.", true);
    const qty = Number($("txQty").value);
    if (
      type === "sale" &&
      qty > it.stock &&
      !confirm(`Only ${it.stock} in stock. Record anyway?`)
    )
      return;
    it.stock += type === "sale" ? -qty : qty;
    Object.assign(t, { itemId: it.id, itemName: it.name, qty });
    if (type === "sale") t.unitCost = it.cost || 0;
  }
  db.tx.push(t);
  save();
  $("txNote").value = "";
  flash("txMsg", "Saved ✔");
  syncForm();
};
function flash(id, msg, bad) {
  const el = $(id);
  el.textContent = msg;
  el.style.color = bad ? "#b00020" : "";
  setTimeout(() => (el.textContent = ""), 2500);
}

// ---- product photos (resized so localStorage doesn't fill up)
const PLACEHOLDER = "placeholder.jpeg";
const imgOf = (i) => esc((i && i.img) || PLACEHOLDER);
let pendingImg = "";
function shrink(file, max = 480, png = false) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file),
      im = new Image();
    im.onload = () => {
      const s = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * s);
      c.height = Math.round(im.height * s);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.8));
    };
    im.onerror = rej;
    im.src = url;
  });
}
async function pickPhoto(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    pendingImg = await shrink(f);
    $("iPreview").src = pendingImg;
  } catch {
    alert("Could not read that image.");
  }
  e.target.value = "";
}
$("iCam").onchange = $("iFile").onchange = pickPhoto;
$("iPhotoClear").onclick = () => {
  pendingImg = "";
  $("iPreview").src = PLACEHOLDER;
};

// ---- items
$("itemForm").onsubmit = (e) => {
  e.preventDefault();
  const id = $("itemId").value;
  const data = {
    name: $("iName").value.trim(),
    cat: $("iCat").value.trim(),
    price: Number($("iPrice").value),
    cost: Number($("iCost").value) || 0,
    low: Number($("iLow").value) || 0,
    img: pendingImg,
  };
  if (id) {
    const stock = Number($("iStock").value);
    if (!Number.isFinite(stock) || stock < 0)
      return alert("Stock must be 0 or more.");
    Object.assign(item(id), data, { stock });
  } else
    db.items.push({
      id: uid(),
      ...data,
      stock: Number($("iStock").value) || 0,
    });
  save();
  clearItemForm();
  renderItems();
};
function clearItemForm() {
  fillCats();
  $("itemForm").reset();
  $("itemId").value = "";
  $("iStock").disabled = false;
  $("iStockLbl").textContent = "Opening stock";
  pendingImg = "";
  $("iPreview").src = PLACEHOLDER;
}
$("iCancel").onclick = clearItemForm;
$("itemSearch").oninput = renderItems;
function renderItems() {
  const q = $("itemSearch").value.toLowerCase();
  $("itemList").innerHTML =
    db.items
      .filter((i) => (i.name + i.cat).toLowerCase().includes(q))
      .map(
        (i) => `
    <div class="item"><div class="l"><img src="${imgOf(i)}" alt=""><div><b>${esc(i.name)}</b> <small>${esc(i.cat)}</small><br>
      ${peso(i.price)} · cost ${peso(i.cost)} · <span class="${i.stock <= i.low ? "low" : ""}">stock ${i.stock}</span></div></div>
      <div><button class="small" data-e="${i.id}">Edit</button><button class="small" data-d="${i.id}">Del</button></div></div>`,
      )
      .join("") || "<p>No items yet.</p>";
  $("itemList")
    .querySelectorAll("[data-e]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const i = item(b.dataset.e);
          $("itemId").value = i.id;
          $("iName").value = i.name;
          fillCats(i.cat);
          $("iPrice").value = i.price;
          $("iCost").value = i.cost;
          $("iLow").value = i.low;
          $("iStock").value = i.stock;
          $("iStock").disabled = false;
          $("iStockLbl").textContent = "Stock on hand (edit to correct)";
          pendingImg = i.img || "";
          $("iPreview").src = i.img || PLACEHOLDER;
          scrollTo(0, 0);
        }),
    );
  $("itemList")
    .querySelectorAll("[data-d]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (confirm("Delete this item? Past ledger entries are kept.")) {
            db.items = db.items.filter((i) => i.id !== b.dataset.d);
            save();
            renderItems();
          }
        }),
    );
}

// ---- ledger
function filtered() {
  const f = $("lFrom").value,
    t = $("lTo").value,
    ty = $("lType").value;
  return db.tx
    .filter(
      (x) =>
        (!f || x.date >= f) && (!t || x.date <= t) && (!ty || x.type === ty),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
["lFrom", "lTo", "lType"].forEach((id) => ($(id).onchange = renderLedger));
function renderLedger() {
  // running balance across ALL entries so filtered views stay accurate
  const bal = {};
  let run = Number(db.opening || 0);
  [...db.tx]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .forEach((t) => {
      run += signed(t);
      bal[t.id] = run;
    });
  const rows = filtered();
  $("lTable").innerHTML =
    `<tr><th>Date</th><th>Type</th><th>Details</th><th class="n">In</th><th class="n">Out</th><th class="n">Balance</th><th></th></tr>` +
    rows
      .map(
        (
          t,
        ) => `<tr${t.void ? ' style="text-decoration:line-through;opacity:.5"' : ""}><td>${esc(t.date)}</td><td>${esc(t.type)}${t.void ? " (void)" : ""}</td><td>${esc(t.itemName ? `${t.itemName} ×${t.qty}` : "")} ${esc(t.note)}</td>
      <td class="n in">${t.void ? (t.type === "sale" || t.type === "income" ? peso(t.amount) : "") : signed(t) > 0 ? peso(t.amount) : ""}</td><td class="n out">${t.void ? (t.type === "sale" || t.type === "income" ? "" : peso(t.amount)) : signed(t) < 0 ? peso(t.amount) : ""}</td>
      <td class="n">${peso(bal[t.id])}</td><td>${t.void ? "" : `<button class="small" data-v="${esc(t.id)}">Void</button>`}</td></tr>`,
      )
      .join("") +
    `<tr><th colspan="3">Totals (filtered)</th><th class="n in">${peso(rows.filter((t) => signed(t) > 0).reduce((a, t) => a + t.amount, 0))}</th><th class="n out">${peso(rows.filter((t) => signed(t) < 0).reduce((a, t) => a + t.amount, 0))}</th><th></th><th></th></tr>`;
  $("lTable")
    .querySelectorAll("[data-v]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const t = db.tx.find((x) => x.id === b.dataset.v);
          if (
            !confirm(
              "Void this entry? It stays in the ledger (struck out) and stock will be reversed.",
            )
          )
            return;
          const it = item(t.itemId);
          if (
            it &&
            t.type === "restock" &&
            it.stock - t.qty < 0 &&
            !confirm(
              `Stock for ${it.name} would go negative (${it.stock - t.qty}). Void anyway?`,
            )
          )
            return;
          if (it && t.type === "sale") it.stock += t.qty;
          if (it && t.type === "restock") it.stock -= t.qty;
          t.void = true;
          t.voidedAt = new Date().toISOString(); // kept for audit trail
          save();
          render();
        }),
    );
}
$("csvBtn").onclick = () => {
  const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [
    "Date,Type,Item,Qty,Amount,Direction,Note",
    ...filtered().map((t) =>
      [
        t.date,
        t.type,
        q(t.itemName),
        t.qty ?? "",
        t.amount,
        t.void ? "void" : signed(t) > 0 ? "in" : "out",
        q(t.note),
      ].join(","),
    ),
  ];
  download(`ledger-${today()}.csv`, lines.join("\n"), "text/csv");
};

// ---- backup
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}
const backupFile = () =>
  new File(
    [JSON.stringify({ ...db, exportedAt: new Date().toISOString() }, null, 2)],
    `pup-shop-backup-${today()}.json`,
    { type: "application/json" },
  );
$("expJson").onclick = () => {
  const f = backupFile();
  download(f.name, f, "application/json");
  logEvent(
    "download",
    `${f.name} (${db.items.length} products, ${db.tx.length} entries)`,
  );
  flash("bkMsg", "Backup downloaded ✔");
};

// ---- backup history + safety copies (device-local; not part of backups)
const HKEY = "pupShopLedger.history",
  SKEY = "pupShopLedger.snapshots";
const readJ = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k)) || [];
  } catch {
    return [];
  }
};
function logEvent(action, detail, snapId) {
  const h = readJ(HKEY);
  h.unshift({
    at: new Date().toISOString(),
    action,
    detail,
    snapId: snapId || "",
  });
  try {
    localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 50)));
  } catch {}
  renderHistory();
}
function snapshot(reason) {
  // keep the last 3 full copies; drop oldest if storage is full
  let snaps = readJ(SKEY);
  const id = uid();
  snaps.unshift({ id, at: new Date().toISOString(), reason, data: db });
  snaps = snaps.slice(0, 3);
  while (snaps.length) {
    try {
      localStorage.setItem(SKEY, JSON.stringify(snaps));
      logEvent("snapshot", `Safety copy: ${reason}`, id);
      return id;
    } catch {
      snaps.pop();
    }
  }
  alert(
    "⚠ Not enough storage for a safety copy. Download a backup first if you're unsure.",
  );
  return "";
}
const ACTION_LABEL = {
  download: "⬇ Downloaded",
  share: "📤 Shared",
  replace: "♻ Replaced",
  combine: "🔀 Combined",
  erase: "🗑 Erased",
  snapshot: "🛟 Safety copy",
  undo: "↩ Restored copy",
};
function renderHistory() {
  const h = readJ(HKEY),
    snaps = new Set(readJ(SKEY).map((s) => s.id));
  const last = h.find((e) => e.action === "download" || e.action === "share");
  $("lastBackup").textContent = last
    ? `Last backup: ${new Date(last.at).toLocaleString()}`
    : "⚠ No backup downloaded from this device yet.";
  $("historyList").innerHTML =
    h
      .map(
        (
          e,
        ) => `<div class="hist"><div><b>${ACTION_LABEL[e.action] || esc(e.action)}</b><small>${esc(new Date(e.at).toLocaleString())} · ${esc(e.detail)}</small></div>
    ${e.snapId && snaps.has(e.snapId) ? `<button class="small" data-r="${esc(e.snapId)}">Restore</button>` : ""}</div>`,
      )
      .join("") || "<p class='hint'>No history yet.</p>";
  $("historyList")
    .querySelectorAll("[data-r]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const sn = readJ(SKEY).find((x) => x.id === b.dataset.r);
          if (!sn) return;
          if (
            !confirm(
              "Restore this safety copy? Current data on this device will be replaced (a new safety copy is saved first).",
            )
          )
            return;
          snapshot("Before restoring a safety copy");
          db = migrate(sn.data);
          save();
          logEvent(
            "undo",
            `Restored safety copy from ${new Date(sn.at).toLocaleString()}`,
          );
          render();
        }),
    );
}

// (i) info buttons: tap to show/hide a short explanation
document.addEventListener("click", (e) => {
  const b = e.target.closest("button.info");
  if (!b) return;
  const host = b.closest("h3, .fx"),
    nx = host.nextElementSibling;
  if (nx && nx.classList.contains("tipbox") && nx.dataset.for === b.dataset.tip)
    return nx.remove();
  document.querySelectorAll(".tipbox").forEach((t) => t.remove());
  const t = document.createElement("div");
  t.className = "tipbox";
  t.dataset.for = b.dataset.tip;
  t.textContent = b.dataset.tip;
  host.after(t);
});

// Combine an incoming backup into a copy of the current data. Never mutates `db`.
function mergeData(cur, inc) {
  const out = JSON.parse(JSON.stringify(cur)),
    st = { newItems: 0, matchedItems: 0, newTx: 0, voided: 0, dupTx: 0 };
  const key = (i) => (i.name + "|" + i.cat).trim().toLowerCase();
  const map = {},
    added = new Set();
  inc.items.forEach((ii) => {
    const m =
      out.items.find((x) => x.id === ii.id) ||
      out.items.find((x) => key(x) === key(ii));
    if (m) {
      map[ii.id] = m.id;
      st.matchedItems++;
      if (!m.img && ii.img) m.img = ii.img;
      if (!m.cost && ii.cost) m.cost = ii.cost;
    } else {
      out.items.push({ ...ii });
      map[ii.id] = ii.id;
      added.add(ii.id);
      st.newItems++;
    }
  });
  const byId = {};
  out.tx.forEach((t) => (byId[t.id] = t));
  const adj = (t, dir) => {
    // dir +1 apply, -1 reverse
    const it = out.items.find((x) => x.id === t.itemId);
    if (!it || added.has(it.id)) return;
    if (t.type === "sale") it.stock -= dir * t.qty;
    if (t.type === "restock") it.stock += dir * t.qty;
  };
  inc.tx.forEach((t0) => {
    const t = { ...t0 };
    if (t.itemId && map[t.itemId]) t.itemId = map[t.itemId];
    const ex = byId[t.id];
    if (ex) {
      st.dupTx++;
      if (t.void && !ex.void) {
        adj(ex, -1);
        ex.void = true;
        ex.voidedAt = t.voidedAt || new Date().toISOString();
        st.voided++;
      }
    } else {
      out.tx.push(t);
      byId[t.id] = t;
      st.newTx++;
      if (!t.void) adj(t, +1);
    }
  });
  const sh = out.shop || (out.shop = {}),
    is = inc.shop || {};
  Object.keys(is).forEach((k) => {
    if (!String(sh[k] || "").trim() && is[k]) sh[k] = is[k];
  });
  if (!out.logo && inc.logo) out.logo = inc.logo;
  return { out, st };
}

let incoming = null;
function closeImport() {
  incoming = null;
  $("importPanel").hidden = true;
}
$("impJson").onchange = (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  file.text().then((txt) => {
    try {
      const d = JSON.parse(txt);
      if (!Array.isArray(d.items) || !Array.isArray(d.tx)) throw 0;
      incoming = migrate(d);
      const { st } = mergeData(db, incoming);
      $("importInfo").textContent =
        `Backup file: ${incoming.items.length} products, ${incoming.tx.length} entries` +
        (d.exportedAt
          ? ` (exported ${d.exportedAt.slice(0, 16).replace("T", " ")})`
          : "") +
        `. Combining would add ${st.newTx} new entries and ${st.newItems} new products, link ${st.matchedItems} matching products, and apply ${st.voided} voids. ${st.dupTx - st.voided} entries already exist here and are skipped.`;
      $("importPanel").hidden = false;
    } catch {
      flash("bkMsg", "Invalid backup file.", true);
    }
  });
};
$("impReplace").onclick = () => {
  if (
    !incoming ||
    !confirm(
      "Replace ALL data on this device with the backup? Anything not in the backup is lost.",
    )
  )
    return;
  snapshot("Before replace");
  db = incoming;
  save();
  logEvent(
    "replace",
    `Replaced with backup (${db.items.length} products, ${db.tx.length} entries)`,
  );
  closeImport();
  flash("bkMsg", "Restored ✔ (safety copy saved in history)");
  render();
};
$("impMerge").onclick = () => {
  if (!incoming) return;
  snapshot("Before combine");
  const r = mergeData(db, incoming);
  db = r.out;
  save();
  logEvent(
    "combine",
    `Combined: +${r.st.newTx} entries, +${r.st.newItems} products, ${r.st.voided} voids`,
  );
  closeImport();
  flash("bkMsg", "Combined ✔ (safety copy saved in history)");
  render();
};
$("impCancel").onclick = closeImport;
$("opening").onchange = () => {
  db.opening = Number($("opening").value) || 0;
  save();
};
$("wipe").onclick = () => {
  if (
    confirm(
      "Erase ALL data on this device? A safety copy is saved in Backup history.",
    ) &&
    confirm("Really sure?")
  ) {
    snapshot("Before erase");
    db = migrate({ items: [], tx: [], opening: 0 });
    save();
    logEvent("erase", "Erased all data");
    render();
  }
};

// ---- sell (POS)
let cart = {},
  cat = "All";
const CATEGORIES = [
  "Tops",
  "Bottoms",
  "Accessories",
  "Bags",
  "Photos/Illustrations",
  "Stuffed Toys",
  "Tableware",
  "Stationaries",
];
const CAT_ICON = {
  tops: "👕",
  bottoms: "👖",
  accessories: "🎫",
  bags: "👜",
  "photos/illustrations": "🖼️",
  "stuffed toys": "🧸",
  tableware: "🍽️",
  stationaries: "✏️",
};
function fillCats(sel) {
  const extra = db.items
    .map((i) => i.cat)
    .filter((c) => c && !CATEGORIES.includes(c));
  const keep = sel || $("iCat").value;
  $("iCat").innerHTML = [...CATEGORIES, ...new Set(extra)]
    .map((c) => `<option>${esc(c)}</option>`)
    .join("");
  if (keep) $("iCat").value = keep;
}
const catIcon = (c) => (c === "All" ? "🛍️" : CAT_ICON[c.toLowerCase()] || "🏷️");
function cartTotal() {
  return Object.entries(cart).reduce(
    (a, [id, q]) => a + (item(id)?.price || 0) * q,
    0,
  );
}
function addToCart(id) {
  const it = item(id);
  if (!it) return;
  if ((cart[id] || 0) >= it.stock)
    return flash("cartMsg", `Only ${it.stock} in stock.`, true);
  cart[id] = (cart[id] || 0) + 1;
  renderCart();
}
// ---- hero carousel: photos of products in the shop (independent of the logo)
let heroList = [],
  heroSig = null,
  heroIdx = 0,
  heroTimer = null;
function updateHero() {
  const pics = db.items
    .filter((i) => i.img)
    .map((i) => ({ src: i.img, name: i.name }));
  const sig = pics.map((p) => p.src.length + p.name).join("|");
  if (sig === heroSig) return;
  heroSig = sig;
  heroList = pics.length ? pics : [{ src: PLACEHOLDER, name: "" }];
  heroIdx = 0;
  clearInterval(heroTimer);
  showHero();
  if (heroList.length > 1)
    heroTimer = setInterval(() => {
      heroIdx = (heroIdx + 1) % heroList.length;
      showHero(true);
    }, 3500);
}
function showHero(animate) {
  const box = $("heroCar"),
    p = heroList[heroIdx % heroList.length],
    old = box.querySelector("img");
  const im = new Image();
  im.src = p.src;
  im.alt = p.name;
  im.className = "slide";
  if (animate && old) im.style.cssText = "transform:translateX(100%);opacity:0";
  box.prepend(im);
  if (animate && old) {
    void im.offsetWidth; // start the slide-in from the right
    im.style.cssText = "transform:none;opacity:1";
    old.style.cssText = "transform:translateX(-100%);opacity:0";
    setTimeout(() => old.remove(), 650);
  } else
    box.querySelectorAll("img.slide").forEach((x) => x !== im && x.remove());
  $("heroCap").textContent = p.name;
  $("heroDots").innerHTML =
    heroList.length > 1
      ? heroList
          .map((_, k) => `<i class="${k === heroIdx ? "on" : ""}"></i>`)
          .join("")
      : "";
}
$("heroCar").onclick = () => {
  if (heroList.length > 1) {
    heroIdx = (heroIdx + 1) % heroList.length;
    showHero(true);
  }
};
function renderSell() {
  updateHero();
  const day = db.tx
    .filter((t) => t.type === "sale" && live(t) && t.date === today())
    .reduce((a, t) => a + t.amount, 0);
  $("heroInfo").textContent =
    `Today's sales: ${peso(day)} · ${db.items.length} products`;
  const cats = [
    "All",
    ...CATEGORIES,
    ...new Set(
      db.items.map((i) => i.cat).filter((c) => c && !CATEGORIES.includes(c)),
    ),
  ];
  if (!cats.includes(cat)) cat = "All";
  $("cats").innerHTML = cats
    .map(
      (c) =>
        `<button class="chip ${c === cat ? "active" : ""}" data-c="${esc(c)}"><span>${catIcon(c)}</span>${esc(c).replace(/\//g, "/<wbr>")}</button>`,
    )
    .join("");
  $("cats")
    .querySelectorAll("[data-c]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          cat = b.dataset.c;
          renderSell();
        }),
    );
  const q = $("posSearch").value.toLowerCase();
  const list = db.items.filter(
    (i) => (cat === "All" || i.cat === cat) && i.name.toLowerCase().includes(q),
  );
  $("posCount").textContent =
    `${list.length} item${list.length === 1 ? "" : "s"}`;
  $("grid").innerHTML =
    list
      .map(
        (i) => `
    <div class="pcard ${i.stock <= 0 ? "out" : ""}">
      <span class="stock ${i.stock <= i.low ? "low" : ""}">${i.stock <= 0 ? "No stock" : i.stock + " left"}</span>
      <img src="${imgOf(i)}" alt="" loading="lazy">
      <h4>${esc(i.name)}</h4><small>${esc(i.cat)}</small>
      <div class="bottom"><span class="price">${peso(i.price)}</span><button class="add" data-a="${i.id}" ${i.stock <= 0 ? "disabled" : ""}>+</button></div>
    </div>`,
      )
      .join("") || `<p>No products yet. Add some in the <b>Items</b> tab.</p>`;
  $("grid")
    .querySelectorAll("[data-a]")
    .forEach((b) => (b.onclick = () => addToCart(b.dataset.a)));
  renderCart();
}
function renderCart() {
  Object.keys(cart).forEach((id) => {
    if (!item(id)) delete cart[id];
  });
  const ids = Object.keys(cart),
    n = ids.reduce((a, id) => a + cart[id], 0);
  $("cartLines").innerHTML =
    ids
      .map((id) => {
        const i = item(id);
        return `
    <div class="line"><img src="${imgOf(i)}" alt=""><div class="nm">${esc(i.name)}<small>${peso(i.price)} each</small></div>
      <div class="qty"><button data-m="${id}">−</button><b>${cart[id]}</b><button data-p="${id}">+</button></div></div>`;
      })
      .join("") || "<p class='hint'>Tap + on a product to add it.</p>";
  $("cartLines")
    .querySelectorAll("[data-m]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.m;
          if (--cart[id] <= 0) delete cart[id];
          renderCart();
        }),
    );
  $("cartLines")
    .querySelectorAll("[data-p]")
    .forEach((b) => (b.onclick = () => addToCart(b.dataset.p)));
  $("cartTotal").textContent = peso(cartTotal());
  $("fabCount").textContent = n;
  $("fabTotal").textContent = peso(cartTotal());
  $("cartFab").hidden = n === 0 && !$("cart").classList.contains("open");
}
$("posSearch").oninput = renderSell;
$("cartFab").onclick = () => {
  $("cart").classList.toggle("open");
  renderCart();
};
$("cartClear").onclick = () => {
  cart = {};
  $("cart").classList.remove("open");
  renderCart();
};
$("cartPay").onclick = () => {
  const ids = Object.keys(cart);
  if (!ids.length) return flash("cartMsg", "Cart is empty.", true);
  const note = $("cartNote").value.trim(),
    date = today(),
    batch = uid();
  ids.forEach((id) => {
    const it = item(id),
      qty = cart[id];
    it.stock -= qty;
    db.tx.push({
      id: uid(),
      date,
      type: "sale",
      amount: it.price * qty,
      note,
      itemId: id,
      itemName: it.name,
      qty,
      unitCost: it.cost || 0,
      order: batch,
    });
  });
  save();
  flash("cartMsg", `Sale recorded: ${peso(cartTotal())} ✔`);
  cart = {};
  $("cartNote").value = "";
  $("cart").classList.remove("open");
  render();
};

// ---- shop logo (default logo.png, can be replaced in Backup tab)
const DEFAULT_LOGO = "logo.png";
function applyLogo() {
  const src = db.logo || DEFAULT_LOGO;
  document
    .querySelectorAll("img.logo, #logoPreview")
    .forEach((im) => (im.src = src));
  const ic = document.querySelector('link[rel="icon"]');
  if (ic) ic.href = db.logo || "logo.svg";
}
$("logoFile").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    db.logo = await shrink(f, 256, true);
    save();
    applyLogo();
    flash("logoMsg", "Logo updated ✔");
  } catch {
    flash("logoMsg", "Could not read that image.", true);
  }
  e.target.value = "";
};
$("logoReset").onclick = () => {
  db.logo = "";
  save();
  applyLogo();
  flash("logoMsg", "Default logo restored ✔");
};

// ---- shop details (separate fields; branch name goes in the header)
const SHOP_FIELDS = {
  branch: "shBranch",
  address: "shAddress",
  contact: "shContact",
  notes: "shNotes",
};
Object.entries(SHOP_FIELDS).forEach(
  ([k, id]) =>
    ($(id).oninput = () => {
      db.shop = db.shop || {};
      db.shop[k] = $(id).value;
      save();
      renderShopInfo();
    }),
);
function renderShopInfo() {
  const sh = db.shop || {},
    b = (sh.branch || "").trim();
  $("branchTag").textContent = b ? " · " + b : "";
  document.title = "PUP Souvenir Shop" + (b ? " – " + b : "") + " Ledger";
  const lines = [sh.address, sh.contact && "☎ " + sh.contact]
    .map((x) => (x || "").trim())
    .filter(Boolean);
  $("shopInfo").textContent = lines.join("\n");
  $("shopInfo").hidden = !lines.length;
  $("branchWarn").hidden = !!b;
}

function render() {
  renderHistory();
  applyLogo();
  renderShopInfo();
  Object.entries(SHOP_FIELDS).forEach(([k, id]) => {
    if (document.activeElement !== $(id))
      $(id).value = (db.shop || {})[k] || "";
  });
  fillCats();
  renderSell();
  renderDash();
  syncForm();
  renderItems();
  renderLedger();
  $("opening").value = db.opening || 0;
}
$("txDate").value = today();
render();

// ---- offline
// tablets: ask for landscape (works when installed / fullscreen on Android); phones stay free
addEventListener(
  "click",
  () => {
    if (
      Math.min(screen.width, screen.height) >= 600 &&
      screen.orientation?.lock
    )
      screen.orientation.lock("landscape").catch(() => {});
  },
  { once: true },
);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
