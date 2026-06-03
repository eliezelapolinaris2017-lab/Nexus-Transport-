import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGoSNKi1wapE1SpHxTc8wNZGGkJ2nQj7s",
  authDomain: "nexus-transport-2887b.firebaseapp.com",
  projectId: "nexus-transport-2887b",
  storageBucket: "nexus-transport-2887b.firebasestorage.app",
  messagingSenderId: "972915419764",
  appId: "1:972915419764:web:7d61dfb03bbe56df867f21"
};

const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = v => Number(v || 0);
const today = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString();
const uid = p => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

let state = freshState();
let filters = { q: "", from: "", to: "", status: "" };
let db = null;
let cloudRef = null;
let unsubscribe = null;
let saving = false;
let cloudReady = false;

function freshState() {
  return {
    cfg: { name: "Nexus Transport PR", phone: "", email: "", mileRate: 2.25 },
    clients: [], drivers: [], providers: [], vehicles: [], services: [], invoices: [], payments: [], cashflow: [], driverPayouts: [], retentionPayments: [], evidence: []
  };
}
function mergeState(raw) {
  const base = freshState();
  return { ...base, ...(raw || {}), cfg: { ...base.cfg, ...(raw?.cfg || {}) } };
}
function localLoad() {
  try { state = mergeState(JSON.parse(localStorage.getItem("nexusTransportState") || "null")); } catch { state = freshState(); }
}
function localSave() { localStorage.setItem("nexusTransportState", JSON.stringify(state)); }
function setBadge(text, cls = "warn") { const b = $("syncBadge"); if (!b) return; b.className = `badge ${cls}`; b.textContent = text; $("systemState") && ($("systemState").textContent = text); }
async function initFirebase() {
  localLoad(); render();
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    db = getFirestore(app);
    setBadge("Autenticando", "warn");
    await signInAnonymously(auth);
    onAuthStateChanged(auth, async user => {
      if (!user) return;
      cloudRef = doc(db, "nexusTransport", "main");
      cloudReady = true;
      await pullCloud();
      listenCloud();
      setBadge("Sincronizado", "ok");
    });
  } catch (err) {
    console.error("Firebase no disponible", err);
    cloudReady = false;
    setBadge("Modo local", "warn");
  }
}
async function pullCloud() {
  if (!cloudRef) return;
  try {
    const snap = await getDoc(cloudRef);
    if (snap.exists()) {
      const cloud = mergeState(snap.data().state || {});
      const localHasData = countAll(state) > 0;
      const cloudHasData = countAll(cloud) > 0;
      state = cloudHasData ? cloud : state;
      if (localHasData && !cloudHasData) await pushCloud();
    } else {
      await pushCloud();
    }
    localSave(); render();
  } catch (err) { console.error(err); setBadge("Firebase bloqueado", "bad"); }
}
async function pushCloud() {
  localSave();
  if (!cloudRef || !cloudReady) return;
  try {
    saving = true;
    await setDoc(cloudRef, { state, updatedAt: serverTimestamp() }, { merge: true });
    setBadge("Sincronizado", "ok");
  } catch (err) { console.error(err); setBadge("Firebase bloqueado", "bad"); }
  finally { setTimeout(() => saving = false, 300); }
}
function listenCloud() {
  if (!cloudRef) return;
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(cloudRef, snap => {
    if (saving || !snap.exists()) return;
    state = mergeState(snap.data().state || {});
    localSave(); render(); setBadge("Sincronizado", "ok");
  }, err => { console.error(err); setBadge("Firebase bloqueado", "bad"); });
}
async function save() { localSave(); await pushCloud(); render(); }
function countAll(s) { return ["clients","drivers","providers","vehicles","services","invoices","payments"].reduce((a,k)=>a+(s[k]?.length||0),0); }

function find(arr, id) { return (arr || []).find(x => x.id === id); }
function serviceTotal(s) { return num(s.base) + (num(s.miles) * num(state.cfg.mileRate)) + num(s.tolls) + num(s.expenses); }
function invBalance(i) { return Math.max(0, num(i.total) - num(i.paid)); }
function clientName(id) { return find(state.clients, id)?.name || "—"; }
function driverName(id) { return find(state.drivers, id)?.name || "—"; }
function providerName(id) { return find(state.providers, id)?.name || "—"; }
function vehicleName(id) { const v = find(state.vehicles, id); return v ? `${v.unit || ""} ${v.plate || ""}`.trim() : "—"; }
function filteredServices() {
  const q = filters.q.toLowerCase();
  return state.services.filter(s => {
    const text = [s.no, clientName(s.clientId), driverName(s.driverId), providerName(s.providerId), s.origin, s.dest, s.type, s.status].join(" ").toLowerCase();
    return (!q || text.includes(q)) && (!filters.from || s.date >= filters.from) && (!filters.to || s.date <= filters.to) && (!filters.status || s.status === filters.status);
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function nextNo(prefix, arr) { return `${prefix}-${String((arr?.length || 0) + 1).padStart(4, "0")}`; }
function options(id, arr, label, blank = "Seleccionar") {
  const el = $(id); if (!el) return;
  const value = el.value;
  el.innerHTML = `<option value="">${blank}</option>` + arr.map(x => `<option value="${x.id}">${escapeHtml(label(x))}</option>`).join("");
  el.value = value;
}
function escapeHtml(v) { return String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function table(id, headers, rows) {
  const el = $(id); if (!el) return;
  el.innerHTML = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(r=>`<tr>${r.join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Sin registros.</td></tr>`}</tbody>`;
}
function actionBtns(key, id) { return `<div class="actions"><button class="miniBtn" data-edit="${key}:${id}">Editar</button><button class="miniBtn danger" data-del="${key}:${id}">Borrar</button></div>`; }

function render() {
  renderOptions(); renderDashboard(); renderTables(); renderFinance(); renderConfig();
}
function renderOptions() {
  options("sClient", state.clients, x => x.name);
  options("sDriver", state.drivers.filter(x=>x.status!=="Inactivo"), x => x.name);
  options("sProvider", state.providers.filter(x=>x.status!=="Inactivo"), x => x.name, "Ninguno");
  options("sVehicle", state.vehicles.filter(x=>x.status!=="Inactivo"), x => `${x.unit || "Unidad"} ${x.plate || ""}`.trim(), "Ninguno");
  const pending = state.services.filter(s => !state.invoices.some(i => i.serviceId === s.id) && s.status !== "Cancelado");
  options("invoiceService", pending, x => `${x.no || "Servicio"} · ${clientName(x.clientId)} · ${money(serviceTotal(x))}`);
  const openInv = state.invoices.filter(i => invBalance(i) > 0);
  options("payInvoice", openInv, x => `${x.no} · ${clientName(x.clientId)} · Balance ${money(invBalance(x))}`);
  options("retDriver", state.drivers, x => `${x.name} · retenido ${money(driverBalance(x.id).heldRetention)}`);
}
function renderDashboard() {
  const billed = state.invoices.reduce((a,i)=>a+num(i.total),0);
  const paid = state.payments.reduce((a,p)=>a+num(p.amount),0);
  const pending = state.invoices.reduce((a,i)=>a+invBalance(i),0);
  const driverDue = driverBalances().reduce((a,d)=>a+d.payable,0);
  const cashIn = state.cashflow.filter(x=>x.type==="Ingreso").reduce((a,x)=>a+num(x.amount),0);
  const cashOut = state.cashflow.filter(x=>x.type==="Gasto").reduce((a,x)=>a+num(x.amount),0);
  $("heroBalance").textContent = money(pending); $("heroOpen").textContent = `${state.invoices.filter(i=>invBalance(i)>0).length} facturas abiertas`;
  const cards = [["Facturado", billed], ["Cobrado", paid], ["Por cobrar", pending], ["A pagar choferes", driverDue], ["Servicios", state.services.length], ["Facturas", state.invoices.length], ["Caja neta", cashIn-cashOut], ["Retención retenida", driverBalances().reduce((a,d)=>a+d.heldRetention,0)]];
  $("kpis").innerHTML = cards.map(([l,v]) => `<div class="kpi"><span>${l}</span><strong>${typeof v==="number" && l!=="Servicios" && l!=="Facturas" ? money(v) : v}</strong></div>`).join("");
  table("tblRecent", ["Fecha","Servicio","Cliente","Ruta","Estado","Total"], filteredServices().slice(0,8).map(s=>[`<td>${s.date||""}</td>`,`<td>${s.no||""}</td>`,`<td>${clientName(s.clientId)}</td>`,`<td>${escapeHtml(s.origin)} → ${escapeHtml(s.dest)}</td>`,`<td>${s.status}</td>`,`<td><strong>${money(serviceTotal(s))}</strong></td>`]));
  $("driverSummary").innerHTML = driverBalances().length ? driverBalances().map(d=>`<div class="listItem"><div><strong>${escapeHtml(d.name)}</strong><span>Bruto ${money(d.gross)} · Retenido ${money(d.heldRetention)}</span></div><strong>${money(d.payable)}</strong></div>`).join("") : `<p class="muted">Sin choferes.</p>`;
}
function renderTables() {
  table("tblClients", ["Nombre","Teléfono","Municipio","Facturado","Balance","Acción"], state.clients.map(c=>{const inv=state.invoices.filter(i=>i.clientId===c.id);return [`<td>${escapeHtml(c.name)}</td>`,`<td>${escapeHtml(c.phone)}</td>`,`<td>${escapeHtml(c.city)}</td>`,`<td>${money(inv.reduce((a,i)=>a+num(i.total),0))}</td>`,`<td>${money(inv.reduce((a,i)=>a+invBalance(i),0))}</td>`,`<td>${actionBtns("clients",c.id)}</td>`]}));
  table("tblDrivers", ["Nombre","%","Ret.","Balance Neto","Retenido","Acción"], driverBalances().map(d=>[`<td>${escapeHtml(d.name)}</td>`,`<td>${d.pct}%</td>`,`<td>${d.retention}%</td>`,`<td><strong>${money(d.payable)}</strong></td>`,`<td>${money(d.heldRetention)}</td>`,`<td>${actionBtns("drivers",d.id)}</td>`]));
  table("tblProviders", ["Nombre","% Ded.","Balance deducción","Teléfono","Acción"], state.providers.map(p=>[`<td>${escapeHtml(p.name)}</td>`,`<td>${num(p.pct)}%</td>`,`<td>${money(providerDeduction(p.id))}</td>`,`<td>${escapeHtml(p.phone)}</td>`,`<td>${actionBtns("providers",p.id)}</td>`]));
  table("tblVehicles", ["Unidad","Tablilla","VIN","Marbete","Estado","Acción"], state.vehicles.map(v=>[`<td>${escapeHtml(v.unit)}</td>`,`<td>${escapeHtml(v.plate)}</td>`,`<td>${escapeHtml(v.vin)}</td>`,`<td>${v.exp||""}</td>`,`<td>${v.status}</td>`,`<td>${actionBtns("vehicles",v.id)}</td>`]));
  table("tblServices", ["Fecha","No.","Cliente","Chofer","Ruta","Total","Estado","Acción"], filteredServices().map(s=>[`<td>${s.date||""}</td>`,`<td>${s.no}</td>`,`<td>${clientName(s.clientId)}</td>`,`<td>${driverName(s.driverId)}</td>`,`<td><a target="_blank" href="${mapUrl(s.origin,s.dest)}">${escapeHtml(s.origin)} → ${escapeHtml(s.dest)}</a></td>`,`<td><strong>${money(serviceTotal(s))}</strong></td>`,`<td>${s.status}</td>`,`<td><div class="actions"><button class="miniBtn" data-invoice="${s.id}">Facturar</button><button class="miniBtn" data-edit="services:${s.id}">Editar</button><button class="miniBtn danger" data-del="services:${s.id}">Borrar</button></div></td>`]));
  table("tblInvoices", ["Factura","Fecha","Cliente","Servicio","Total","Pagado","Balance","Estado","Acción"], state.invoices.map(i=>[`<td>${i.no}</td>`,`<td>${i.date}</td>`,`<td>${clientName(i.clientId)}</td>`,`<td>${find(state.services,i.serviceId)?.no||""}</td>`,`<td>${money(i.total)}</td>`,`<td>${money(i.paid)}</td>`,`<td><strong>${money(invBalance(i))}</strong></td>`,`<td>${i.status}</td>`,`<td><div class="actions"><button class="miniBtn" data-pdfinv="${i.id}">PDF</button><button class="miniBtn danger" data-del="invoices:${i.id}">Borrar</button></div></td>`]));
  table("tblPayments", ["Fecha","Factura","Cliente","Método","Monto"], state.payments.map(p=>{const i=find(state.invoices,p.invoiceId)||{};return [`<td>${p.date}</td>`,`<td>${i.no||""}</td>`,`<td>${clientName(p.clientId)}</td>`,`<td>${p.method}</td>`,`<td><strong>${money(p.amount)}</strong></td>`]}));
  table("tblCashflow", ["Fecha","Tipo","Categoría","Detalle","Monto"], state.cashflow.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(x=>[`<td>${x.date}</td>`,`<td>${x.type}</td>`,`<td>${x.category}</td>`,`<td>${escapeHtml(x.detail)}</td>`,`<td><strong>${money(x.amount)}</strong></td>`]));
}
function renderFinance() {
  $("driverPayments").innerHTML = driverBalances().length ? driverBalances().map(d=>`<div class="listItem"><div><strong>${escapeHtml(d.name)}</strong><span>Bruto ${money(d.gross)} · Retención ${money(d.heldRetention)} · Pagado ${money(d.paidOut)}</span></div><button class="miniBtn" data-paydriver="${d.id}">Pagar ${money(d.payable)}</button></div>`).join("") : `<p class="muted">Sin balances.</p>`;
}
function renderConfig() { $("cfgName").value = state.cfg.name || ""; $("cfgPhone").value = state.cfg.phone || ""; $("cfgEmail").value = state.cfg.email || ""; $("cfgMile").value = state.cfg.mileRate || 0; }
function mapUrl(origin, dest) { return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin||"")}&destination=${encodeURIComponent(dest||"")}`; }

function driverBalance(driverId) {
  const d = find(state.drivers, driverId) || {};
  const related = state.services.filter(s => s.driverId === driverId && s.status !== "Cancelado");
  const gross = related.reduce((a,s)=>a + serviceTotal(s) * (num(d.pct) / 100), 0);
  const retentionGross = gross * (num(d.retention) / 100);
  const paidOut = state.driverPayouts.filter(x=>x.driverId===driverId).reduce((a,x)=>a+num(x.amount),0);
  const retPaid = state.retentionPayments.filter(x=>x.driverId===driverId).reduce((a,x)=>a+num(x.amount),0);
  const payable = Math.max(0, gross - retentionGross - paidOut);
  const heldRetention = Math.max(0, retentionGross - retPaid);
  return { id: driverId, name: d.name || "—", pct: num(d.pct), retention: num(d.retention), gross, payable, paidOut, heldRetention };
}
function driverBalances(){ return state.drivers.map(d => driverBalance(d.id)); }
function providerDeduction(providerId) { const p=find(state.providers,providerId)||{}; return state.services.filter(s=>s.providerId===providerId && s.status!=="Cancelado").reduce((a,s)=>a+serviceTotal(s)*(num(p.pct)/100),0); }

function upsert(key, obj) { const arr = state[key]; const ix = arr.findIndex(x=>x.id===obj.id); ix >= 0 ? arr[ix] = obj : arr.push(obj); }
function remove(key, id) { if (!confirm("¿Borrar registro?")) return; state[key] = state[key].filter(x=>x.id!==id); save(); }
function createInvoice(serviceId) {
  const s = find(state.services, serviceId); if (!s) return alert("Selecciona un servicio.");
  const exists = state.invoices.find(i => i.serviceId === serviceId); if (exists) return alert("Ese servicio ya tiene factura.");
  const total = serviceTotal(s);
  const inv = { id: uid("inv"), no: nextNo("INV", state.invoices), date: today(), serviceId: s.id, clientId: s.clientId, total, paid: 0, status: "Pendiente", createdAt: stamp() };
  state.invoices.push(inv); s.status = "Facturado"; upsert("services", s); save(); openView("facturacion");
}
function registerPayment(e) {
  e.preventDefault(); const inv = find(state.invoices, $("payInvoice").value); if (!inv) return alert("Selecciona una factura.");
  const amount = num($("payAmount").value); if (amount <= 0) return alert("Monto inválido.");
  const pay = { id: uid("pay"), invoiceId: inv.id, clientId: inv.clientId, date: $("payDate").value || today(), method: $("payMethod").value, amount, createdAt: stamp() };
  state.payments.push(pay); inv.paid = num(inv.paid) + amount; inv.status = invBalance(inv) <= .01 ? "Pagada" : "Parcial"; upsert("invoices", inv);
  const s = find(state.services, inv.serviceId); if (s) { s.status = inv.status === "Pagada" ? "Cobrado" : "Parcial"; upsert("services", s); }
  state.cashflow.push({ id: uid("cf"), date: pay.date, type: "Ingreso", category: "Cobro factura", detail: `${inv.no} · ${clientName(inv.clientId)}`, method: pay.method, amount });
  e.target.reset(); $("payDate").value = today(); save();
}
function payDriver(driverId) { const b = driverBalance(driverId); if (b.payable <= 0) return alert("No hay balance neto a pagar."); const raw = prompt(`Balance neto de ${b.name}: ${money(b.payable)}\nMonto a pagar:`, b.payable.toFixed(2)); if (raw === null) return; const amount = Math.min(num(raw), b.payable); if (amount <= 0) return; state.driverPayouts.push({ id: uid("dp"), driverId, date: today(), amount, createdAt: stamp() }); state.cashflow.push({ id: uid("cf"), date: today(), type: "Gasto", category: "Pago chofer", detail: b.name, method: "Operacional", amount }); save(); }
function payRetention(e) { e.preventDefault(); const id = $("retDriver").value; const b = driverBalance(id); const amount = num($("retAmount").value); if (!id || amount <= 0 || amount > b.heldRetention) return alert("Monto inválido o mayor a retención disponible."); state.retentionPayments.push({ id: uid("ret"), driverId: id, date: $("retDate").value || today(), amount, createdAt: stamp() }); state.cashflow.push({ id: uid("cf"), date: $("retDate").value || today(), type: "Gasto", category: "Pago retención", detail: b.name, method: "Operacional", amount }); e.target.reset(); $("retDate").value = today(); save(); }

function bind() {
  document.querySelectorAll("#tabs button").forEach(btn => btn.addEventListener("click", () => openView(btn.dataset.view)));
  $("menuToggle")?.addEventListener("click", () => { $("sidebar")?.classList.add("open"); $("sidebarOverlay")?.classList.add("open"); });
  $("sidebarOverlay")?.addEventListener("click", () => { $("sidebar")?.classList.remove("open"); $("sidebarOverlay")?.classList.remove("open"); });
  $("btnFilter").onclick = () => { filters = { q: $("q").value.trim(), from: $("from").value, to: $("to").value, status: $("statusFilter").value }; render(); };
  $("btnClear").onclick = () => { ["q","from","to","statusFilter"].forEach(id=>$(id).value=""); filters = { q:"", from:"", to:"", status:"" }; render(); };
  $("btnSync").onclick = async () => { await pullCloud(); await pushCloud(); alert("Sincronización ejecutada."); };
  $("formClient").onsubmit = e => { e.preventDefault(); upsert("clients", { id: $("cId").value || uid("cli"), name: $("cName").value, phone: $("cPhone").value, email: $("cEmail").value, city: $("cCity").value, address: $("cAddress").value }); e.target.reset(); save(); };
  $("formDriver").onsubmit = e => { e.preventDefault(); upsert("drivers", { id: $("dId").value || uid("drv"), name: $("dName").value, phone: $("dPhone").value, pct: num($("dPct").value), retention: num($("dRet").value), lic: $("dLic").value, status: $("dStatus").value }); e.target.reset(); $("dPct").value=70; $("dRet").value=10; save(); };
  $("formProvider").onsubmit = e => { e.preventDefault(); upsert("providers", { id: $("pId").value || uid("prov"), name: $("pName").value, pct: num($("pPct").value), phone: $("pPhone").value, status: $("pStatus").value }); e.target.reset(); $("pPct").value=10; save(); };
  $("formVehicle").onsubmit = e => { e.preventDefault(); upsert("vehicles", { id: $("vId").value || uid("veh"), unit: $("vUnit").value, plate: $("vPlate").value, vin: $("vVin").value, exp: $("vExp").value, status: $("vStatus").value }); e.target.reset(); save(); };
  $("formService").onsubmit = e => { e.preventDefault(); const id = $("sId").value || uid("srv"); const old = find(state.services,id) || {}; const s = { ...old, id, no: old.no || nextNo("SRV", state.services), date: $("sDate").value || today(), clientId: $("sClient").value, driverId: $("sDriver").value, providerId: $("sProvider").value, vehicleId: $("sVehicle").value, origin: $("sOrigin").value, dest: $("sDest").value, type: $("sType").value, base: num($("sBase").value), miles: num($("sMiles").value), tolls: num($("sTolls").value), expenses: num($("sExpenses").value), status: $("sStatus").value, notes: $("sNotes").value, updatedAt: stamp() }; upsert("services", s); e.target.reset(); $("sDate").value=today(); save(); };
  $("btnCreateInvoice").onclick = () => createInvoice($("invoiceService").value);
  $("formPayment").onsubmit = registerPayment;
  $("formRetention").onsubmit = payRetention;
  $("formConfig").onsubmit = e => { e.preventDefault(); state.cfg = { ...state.cfg, name: $("cfgName").value, phone: $("cfgPhone").value, email: $("cfgEmail").value, mileRate: num($("cfgMile").value) }; save(); };
  document.body.addEventListener("click", e => { const t = e.target; if (t.dataset.del) { const [key,id] = t.dataset.del.split(":"); remove(key,id); } if (t.dataset.edit) { const [key,id] = t.dataset.edit.split(":"); edit(key,id); } if (t.dataset.invoice) createInvoice(t.dataset.invoice); if (t.dataset.paydriver) payDriver(t.dataset.paydriver); if (t.dataset.pdfinv) pdfInvoice(t.dataset.pdfinv); if (t.dataset.go) openView(t.dataset.go); });
  $("btnPdfExec").onclick = pdfExecutive; $("btnBackup").onclick = backup; $("fileImport").onchange = importBackup; $("btnDemo").onclick = seedDemo; $("pdfInvoices").onclick = pdfInvoices; $("pdfDrivers").onclick = pdfDrivers; $("exportCsv").onclick = exportCsv;
  $("sDate").value = today(); $("payDate").value = today(); $("retDate").value = today();
}
function openView(id) { document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("active", b.dataset.view===id)); document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden", v.id!==id)); const active=document.querySelector(`#tabs button[data-view="${id}"] span`); if($("pageTitle") && active) $("pageTitle").textContent=active.textContent; $("sidebar")?.classList.remove("open"); $("sidebarOverlay")?.classList.remove("open"); render(); }
function edit(key,id) { const x = find(state[key], id); if (!x) return; const fill = pairs => pairs.forEach(([a,b]) => $(a).value = b ?? ""); if(key==="clients"){fill([["cId",id],["cName",x.name],["cPhone",x.phone],["cEmail",x.email],["cCity",x.city],["cAddress",x.address]]);openView("clientes");} if(key==="drivers"){fill([["dId",id],["dName",x.name],["dPhone",x.phone],["dPct",x.pct],["dRet",x.retention],["dLic",x.lic],["dStatus",x.status]]);openView("choferes");} if(key==="providers"){fill([["pId",id],["pName",x.name],["pPct",x.pct],["pPhone",x.phone],["pStatus",x.status]]);openView("proveedores");} if(key==="vehicles"){fill([["vId",id],["vUnit",x.unit],["vPlate",x.plate],["vVin",x.vin],["vExp",x.exp],["vStatus",x.status]]);openView("flota");} if(key==="services"){fill([["sId",id],["sDate",x.date],["sClient",x.clientId],["sDriver",x.driverId],["sProvider",x.providerId],["sVehicle",x.vehicleId],["sOrigin",x.origin],["sDest",x.dest],["sType",x.type],["sBase",x.base],["sMiles",x.miles],["sTolls",x.tolls],["sExpenses",x.expenses],["sStatus",x.status],["sNotes",x.notes]]);openView("servicios");} }
function backup() { const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"}); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nexus-transport-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href); }
function importBackup(e) { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ state = mergeState(JSON.parse(r.result)); save(); alert("Backup importado."); }catch{ alert("Archivo inválido."); } }; r.readAsText(f); }
function seedDemo() { const c={id:uid("cli"),name:"Cliente Demo",phone:"787-000-0000",city:"San Juan"}; const d={id:uid("drv"),name:"Chofer Demo",phone:"787-000-0001",pct:70,retention:10,status:"Activo"}; const p={id:uid("prov"),name:"Proveedor Demo",pct:10,status:"Activo"}; const v={id:uid("veh"),unit:"Unidad 01",plate:"ABC-123",status:"Activo"}; state.clients.push(c); state.drivers.push(d); state.providers.push(p); state.vehicles.push(v); state.services.push({id:uid("srv"),no:nextNo("SRV",state.services),date:today(),clientId:c.id,driverId:d.id,providerId:p.id,vehicleId:v.id,origin:"San Juan",dest:"Ponce",type:"Grúa",base:250,miles:75,tolls:12,expenses:35,status:"Pendiente",notes:"Servicio demo"}); save(); }
function exportCsv() { const rows = [["fecha","servicio","cliente","chofer","origen","destino","total","estado"], ...state.services.map(s=>[s.date,s.no,clientName(s.clientId),driverName(s.driverId),s.origin,s.dest,serviceTotal(s),s.status])]; const csv = rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n"); const blob=new Blob([csv],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`servicios-${today()}.csv`; a.click(); URL.revokeObjectURL(a.href); }
function pdf(title, lines) { const { jsPDF } = window.jspdf; const docp = new jsPDF(); docp.setFont("helvetica","bold"); docp.setFontSize(17); docp.text(title,14,18); docp.setFont("helvetica","normal"); docp.setFontSize(10); let y=32; lines.forEach(line=>{ if(y>280){docp.addPage(); y=18;} docp.text(String(line),14,y); y+=7; }); docp.save(`${title.replaceAll(" ","_")}_${today()}.pdf`); }
function pdfExecutive() { const billed=state.invoices.reduce((a,i)=>a+num(i.total),0), paid=state.payments.reduce((a,p)=>a+num(p.amount),0), pending=state.invoices.reduce((a,i)=>a+invBalance(i),0); pdf("Reporte Ejecutivo", [`Negocio: ${state.cfg.name}`,`Facturado: ${money(billed)}`,`Cobrado: ${money(paid)}`,`Por cobrar: ${money(pending)}`,`Servicios: ${state.services.length}`,`Facturas: ${state.invoices.length}`]); }
function pdfInvoices() { pdf("Reporte Facturas", state.invoices.map(i=>`${i.no} | ${clientName(i.clientId)} | Total ${money(i.total)} | Pagado ${money(i.paid)} | Balance ${money(invBalance(i))}`)); }
function pdfDrivers() { pdf("Reporte Choferes", driverBalances().map(d=>`${d.name} | Bruto ${money(d.gross)} | Neto a pagar ${money(d.payable)} | Retenido ${money(d.heldRetention)}`)); }
function pdfInvoice(id) { const i=find(state.invoices,id); if(!i)return; pdf(`Factura ${i.no}`,[state.cfg.name,`Cliente: ${clientName(i.clientId)}`,`Fecha: ${i.date}`,`Total: ${money(i.total)}`,`Pagado: ${money(i.paid)}`,`Balance: ${money(invBalance(i))}`]); }

bind(); render(); initFirebase();
