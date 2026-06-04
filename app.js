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
    cfg: { name: "Nexus Transport PR", address: "", phone: "", email: "", web: "", taxId: "", repName: "", logoDataUrl: "", mileRate: 2.25, taxRate: 0 },
    clients: [], drivers: [], providers: [], vehicles: [], services: [], invoices: [], payments: [], cashflow: [], driverPayouts: [], retentionPayments: [], evidence: []
  };
}
function mergeState(raw) {
  const base = freshState();
  const merged = { ...base, ...(raw || {}), cfg: { ...base.cfg, ...(raw?.cfg || {}) } };
  return normalizeOperationalState(merged);
}
function normalizeOperationalState(data) {
  const base = freshState();
  const keys = Object.keys(base).filter(k => Array.isArray(base[k]));
  keys.forEach(key => {
    data[key] = Array.isArray(data[key]) ? data[key] : [];
    const seen = new Set();
    data[key] = data[key].map((row, index) => {
      const item = { ...(row || {}) };
      const prefix = key === "services" ? "srv" : key.slice(0, 3);
      if (!item.id || seen.has(item.id)) {
        item.legacyId = item.id || "";
        item.id = `${prefix}_${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 7)}`;
        item.migratedAt = new Date().toISOString();
      }
      seen.add(item.id);
      return item;
    });
  });

  // Garantía operacional: cada servicio tiene ID único y número visible.
  data.services.forEach((s, index) => {
    if (!s.id) s.id = `srv_${Date.now().toString(36)}_${index}`;
    if (!s.no) s.no = `SRV-${String(index + 1).padStart(4, "0")}`;
    s.commissionKey = s.id;
  });

  // Facturas amarradas únicamente a serviceId. Si una factura quedó sin serviceId, no se usa cliente/fecha para calcular comisión.
  data.invoices.forEach((inv, index) => {
    if (!inv.id) inv.id = `inv_${Date.now().toString(36)}_${index}`;
    if (!inv.no) inv.no = `INV-${String(index + 1).padStart(4, "0")}`;
    const service = data.services.find(s => s.id === inv.serviceId);
    if (service) {
      inv.clientId = service.clientId;
      inv.total = Number(service.base || 0) + (Number(service.miles || 0) * Number(data.cfg?.mileRate || 0)) + Number(service.tolls || 0) + Number(service.expenses || 0);
    }
  });
  return data;
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
async function save() { state = normalizeOperationalState(state); recomputeInvoicePaid(); localSave(); await pushCloud(); render(); }
function countAll(s) { return ["clients","drivers","providers","vehicles","services","invoices","payments"].reduce((a,k)=>a+(s[k]?.length||0),0); }

function find(arr, id) { return (arr || []).find(x => x.id === id); }
function serviceTotal(s) { return num(s.base) + (num(s.miles) * num(state.cfg.mileRate)) + num(s.tolls) + num(s.expenses); }
function milesLabel(s) { return `${num(s.miles).toFixed(2)} mi${s.milesVerified ? " · reales" : (s.routeAuto ? " · estimadas" : "")}`; }
function invBalance(i) { return Math.max(0, num(i.total) - num(i.paid)); }
function recomputeInvoicePaid() {
  state.invoices.forEach(inv => {
    inv.paid = state.payments.filter(p => p.invoiceId === inv.id).reduce((a,p)=>a+num(p.amount),0);
    inv.status = invBalance(inv) <= .01 ? "Pagada" : (num(inv.paid) > 0 ? "Parcial" : "Pendiente");
    const s = find(state.services, inv.serviceId);
    if (s && s.status !== "Cancelado") { s.status = inv.status === "Pagada" ? "Cobrado" : (inv.status === "Parcial" ? "Parcial" : "Facturado"); }
  });
}
function serviceIsCommissionable(s) { return s && s.status !== "Cancelado"; }
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

const PR_PLACES = {
  "adjuntas":[18.1635,-66.7236],"aguada":[18.3794,-67.1882],"aguadilla":[18.4275,-67.1541],"aguas buenas":[18.2569,-66.1029],"aibonito":[18.1399,-66.2660],"anasco":[18.2854,-67.1403],"ańasco":[18.2854,-67.1403],"arecibo":[18.4724,-66.7157],"arroyo":[17.9658,-66.0613],"barceloneta":[18.4505,-66.5385],"barranquitas":[18.1866,-66.3063],"bayamon":[18.3986,-66.1557],"bayamón":[18.3986,-66.1557],"cabo rojo":[18.0866,-67.1457],"caguas":[18.2341,-66.0485],"camuy":[18.4838,-66.8449],"canovanas":[18.3749,-65.8993],"canóvanas":[18.3749,-65.8993],"carolina":[18.3808,-65.9574],"catano":[18.4413,-66.1182],"cataño":[18.4413,-66.1182],"cayey":[18.1119,-66.1660],"ceiba":[18.2641,-65.6485],"ciales":[18.3361,-66.4688],"cidra":[18.1758,-66.1613],"coamo":[18.0797,-66.3579],"comerio":[18.2180,-66.2260],"comerío":[18.2180,-66.2260],"corozal":[18.3411,-66.3168],"culebra":[18.3030,-65.3007],"dorado":[18.4588,-66.2677],"fajardo":[18.3258,-65.6524],"florida":[18.3630,-66.5621],"guanica":[17.9716,-66.9080],"guánica":[17.9716,-66.9080],"guayama":[17.9841,-66.1138],"guayanilla":[18.0191,-66.7918],"guaynabo":[18.3575,-66.1110],"gurabo":[18.2544,-65.9729],"hatillo":[18.4863,-66.8254],"hormigueros":[18.1397,-67.1274],"humacao":[18.1497,-65.8274],"isabela":[18.5008,-67.0244],"jayuya":[18.2186,-66.5916],"juana diaz":[18.0530,-66.5066],"juana díaz":[18.0530,-66.5066],"juncos":[18.2275,-65.9204],"lajas":[18.0494,-67.0593],"lares":[18.2947,-66.8782],"las marias":[18.2528,-66.9921],"las marías":[18.2528,-66.9921],"las piedras":[18.1830,-65.8663],"loiza":[18.4313,-65.8802],"loíza":[18.4313,-65.8802],"luquillo":[18.3725,-65.7166],"manati":[18.4285,-66.4921],"manatí":[18.4285,-66.4921],"maricao":[18.1808,-66.9791],"maunabo":[18.0072,-65.8993],"mayaguez":[18.2011,-67.1396],"mayagüez":[18.2011,-67.1396],"moca":[18.3947,-67.1132],"morovis":[18.3258,-66.4060],"naguabo":[18.2116,-65.7349],"naranjito":[18.3008,-66.2449],"orocovis":[18.2269,-66.3910],"patillas":[18.0064,-66.0157],"penuelas":[18.0633,-66.7216],"peñuelas":[18.0633,-66.7216],"ponce":[18.0111,-66.6141],"quebradillas":[18.4738,-66.9385],"rincon":[18.3402,-67.2499],"rincón":[18.3402,-67.2499],"rio grande":[18.3794,-65.8313],"río grande":[18.3794,-65.8313],"sabana grande":[18.0777,-66.9605],"salinas":[17.9775,-66.2988],"san german":[18.0816,-67.0449],"san germán":[18.0816,-67.0449],"san juan":[18.4655,-66.1057],"san lorenzo":[18.1894,-65.9610],"san sebastian":[18.3366,-66.9902],"san sebastián":[18.3366,-66.9902],"santa isabel":[17.9661,-66.4049],"toa alta":[18.3883,-66.2482],"toa baja":[18.4438,-66.2596],"trujillo alto":[18.3547,-66.0074],"utuado":[18.2655,-66.7005],"vega alta":[18.4122,-66.3313],"vega baja":[18.4444,-66.3877],"vieques":[18.1263,-65.4401],"villalba":[18.1272,-66.4921],"yabucoa":[18.0505,-65.8793],"yauco":[18.0349,-66.8499]
};
function normalizePlace(v){ return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zñ\s]/g," ").replace(/\s+/g," ").trim(); }
function matchPRPlace(input){
  const q = normalizePlace(input);
  if (!q) return null;
  const keys = Object.keys(PR_PLACES);
  let key = keys.find(k => normalizePlace(k) === q) || keys.find(k => q.includes(normalizePlace(k))) || keys.find(k => normalizePlace(k).includes(q));
  return key ? { name: key.replace(/\b\w/g, c => c.toUpperCase()), coord: PR_PLACES[key] } : null;
}
function haversineMiles(a,b){
  const R = 3958.8, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0]-a[0]), dLon = toRad(b[1]-a[1]);
  const lat1 = toRad(a[0]), lat2 = toRad(b[0]);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function estimateRouteMiles(origin, dest){
  const o = matchPRPlace(origin), d = matchPRPlace(dest);
  if (!o || !d) return { ok:false, message:"No pude identificar municipio de origen/destino. Escribe municipio claro: San Juan, Ponce, Caguas, etc." };
  const direct = haversineMiles(o.coord, d.coord);
  const roadFactor = direct < 8 ? 1.35 : 1.23;
  const miles = Math.max(1, Math.round(direct * roadFactor * 10) / 10);
  return { ok:true, miles, origin:o.name, dest:d.name, message:`Millas estimadas: ${miles} mi (${o.name} → ${d.name}). Ajustable manualmente si la ruta real cambia.` };
}
function updateRouteEstimate(force=false){
  const origin = $("sOrigin")?.value || "", dest = $("sDest")?.value || "";
  const box = $("routeHelper");
  if (!origin || !dest) { if(box) box.textContent = "Escribe origen y destino para calcular millas estimadas automáticamente."; return; }
  const est = estimateRouteMiles(origin, dest);
  if (box) box.textContent = est.message;
  if (est.ok && ($("sMiles") && (force || num($("sMiles").value) === 0 || $("sMiles").dataset.auto === "1"))) {
    $("sMiles").value = est.miles;
    $("sMiles").dataset.auto = "1";
  }
}
function fillPRPlaces(){
  const dl = $("prPlaces"); if(!dl) return;
  const unique = [...new Set(Object.keys(PR_PLACES).map(k => k.replace(/\b\w/g, c => c.toUpperCase())))].sort();
  dl.innerHTML = unique.map(x => `<option value="${escapeHtml(x)}"></option>`).join("");
}
function table(id, headers, rows) {
  const el = $(id); if (!el) return;
  el.innerHTML = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(r=>`<tr>${r.join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Sin registros.</td></tr>`}</tbody>`;
}
function actionBtns(key, id) { return `<div class="actions"><button class="miniBtn" data-edit="${key}:${id}">Editar</button><button class="miniBtn danger" data-del="${key}:${id}">Borrar</button></div>`; }

function render() {
  recomputeInvoicePaid();
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
  $("driverSummary").innerHTML = driverBalances().length ? driverBalances().map(d=>`<div class="listItem"><div><strong>${escapeHtml(d.name)}</strong><span>${d.services} servicios · Bruto ${money(d.gross)} · Retenido ${money(d.heldRetention)}</span></div><strong>${money(d.payable)}</strong></div>`).join("") : `<p class="muted">Sin choferes.</p>`;
}
function renderTables() {
  table("tblClients", ["Nombre","Teléfono","Municipio","Facturado","Balance","Acción"], state.clients.map(c=>{const inv=state.invoices.filter(i=>i.clientId===c.id);return [`<td>${escapeHtml(c.name)}</td>`,`<td>${escapeHtml(c.phone)}</td>`,`<td>${escapeHtml(c.city)}</td>`,`<td>${money(inv.reduce((a,i)=>a+num(i.total),0))}</td>`,`<td>${money(inv.reduce((a,i)=>a+invBalance(i),0))}</td>`,`<td>${actionBtns("clients",c.id)}</td>`]}));
  table("tblDrivers", ["Nombre","%","Ret.","Servicios","Bruto","Balance Neto","Retenido","Acción"], driverBalances().map(d=>[`<td>${escapeHtml(d.name)}</td>`,`<td>${d.pct}%</td>`,`<td>${d.retention}%</td>`,`<td><strong>${d.services}</strong></td>`,`<td>${money(d.gross)}</td>`,`<td><strong>${money(d.payable)}</strong></td>`,`<td>${money(d.heldRetention)}</td>`,`<td>${actionBtns("drivers",d.id)}</td>`]));
  table("tblProviders", ["Nombre","% Ded.","Balance deducción","Teléfono","Acción"], state.providers.map(p=>[`<td>${escapeHtml(p.name)}</td>`,`<td>${num(p.pct)}%</td>`,`<td>${money(providerDeduction(p.id))}</td>`,`<td>${escapeHtml(p.phone)}</td>`,`<td>${actionBtns("providers",p.id)}</td>`]));
  table("tblVehicles", ["Unidad","Tablilla","VIN","Marbete","Estado","Acción"], state.vehicles.map(v=>[`<td>${escapeHtml(v.unit)}</td>`,`<td>${escapeHtml(v.plate)}</td>`,`<td>${escapeHtml(v.vin)}</td>`,`<td>${v.exp||""}</td>`,`<td>${v.status}</td>`,`<td>${actionBtns("vehicles",v.id)}</td>`]));
  table("tblServices", ["Fecha","No.","ID","Cliente","Chofer","Ruta","Millas","Total","Estado","Acción"], filteredServices().map(s=>[`<td>${s.date||""}</td>`,`<td>${s.no}</td>`,`<td><code>${escapeHtml(String(s.id).slice(-8))}</code></td>`,`<td>${clientName(s.clientId)}</td>`,`<td>${driverName(s.driverId)}</td>`,`<td><a class="routeLinkBtn" target="_blank" href="${mapUrl(s.origin,s.dest)}">${escapeHtml(s.origin)} → ${escapeHtml(s.dest)}</a></td>`,`<td><span class="badgeMiles">${milesLabel(s)}</span></td>`,`<td><strong>${money(serviceTotal(s))}</strong></td>`,`<td>${s.status}</td>`,`<td><div class="actions"><button class="miniBtn" data-map="${s.id}">Ver ruta</button><button class="miniBtn" data-miles="${s.id}">Editar millas</button><button class="miniBtn" data-invoice="${s.id}">Facturar</button><button class="miniBtn" data-edit="services:${s.id}">Editar</button><button class="miniBtn danger" data-del="services:${s.id}">Borrar</button></div></td>`]));
  table("tblInvoices", ["Factura","Fecha","Cliente","Servicio","Total","Pagado","Balance","Estado","Acción"], state.invoices.map(i=>[`<td>${i.no}</td>`,`<td>${i.date}</td>`,`<td>${clientName(i.clientId)}</td>`,`<td>${find(state.services,i.serviceId)?.no||""}</td>`,`<td>${money(i.total)}</td>`,`<td>${money(i.paid)}</td>`,`<td><strong>${money(invBalance(i))}</strong></td>`,`<td>${i.status}</td>`,`<td><div class="actions"><button class="miniBtn" data-pdfinv="${i.id}">PDF</button><button class="miniBtn danger" data-del="invoices:${i.id}">Borrar</button></div></td>`]));
  table("tblPayments", ["Fecha","Factura","Cliente","Método","Monto"], state.payments.map(p=>{const i=find(state.invoices,p.invoiceId)||{};return [`<td>${p.date}</td>`,`<td>${i.no||""}</td>`,`<td>${clientName(p.clientId)}</td>`,`<td>${p.method}</td>`,`<td><strong>${money(p.amount)}</strong></td>`]}));
  table("tblCashflow", ["Fecha","Tipo","Categoría","Detalle","Método","Monto","Acción"], state.cashflow.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(x=>[`<td>${x.date}</td>`,`<td>${x.type}</td>`,`<td>${escapeHtml(x.category)}</td>`,`<td>${escapeHtml(x.detail)}</td>`,`<td>${escapeHtml(x.method || "")}</td>`,`<td><strong>${money(x.amount)}</strong></td>`,`<td>${actionBtns("cashflow",x.id)}</td>`]));
}
function renderFinance() {
  $("driverPayments").innerHTML = driverBalances().length ? driverBalances().map(d=>`<div class="listItem"><div><strong>${escapeHtml(d.name)}</strong><span>${d.services} servicios por ID · Bruto ${money(d.gross)} · Retención ${money(d.heldRetention)} · Pagado ${money(d.paidOut)}</span></div><button class="miniBtn" data-paydriver="${d.id}">Pagar ${money(d.payable)}</button></div>`).join("") : `<p class="muted">Sin balances.</p>`;
}
function renderConfig() {
  $("cfgName") && ($("cfgName").value = state.cfg.name || "");
  $("cfgAddress") && ($("cfgAddress").value = state.cfg.address || "");
  $("cfgPhone") && ($("cfgPhone").value = state.cfg.phone || "");
  $("cfgEmail") && ($("cfgEmail").value = state.cfg.email || "");
  $("cfgWeb") && ($("cfgWeb").value = state.cfg.web || "");
  $("cfgTaxId") && ($("cfgTaxId").value = state.cfg.taxId || "");
  $("cfgRep") && ($("cfgRep").value = state.cfg.repName || "");
  $("cfgTaxRate") && ($("cfgTaxRate").value = state.cfg.taxRate || 0);
  $("cfgMile") && ($("cfgMile").value = state.cfg.mileRate || 0);
  const prev = $("logoPreview");
  if (prev) prev.innerHTML = state.cfg.logoDataUrl ? `<img src="${state.cfg.logoDataUrl}" alt="Logo empresa">` : "Sin logo cargado";
}
function mapUrl(origin, dest) { return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin||"")}&destination=${encodeURIComponent(dest||"")}`; }
function openMapForRoute(origin, dest) {
  if (!origin || !dest) return alert("Escribe origen y destino para abrir la ruta.");
  window.open(mapUrl(origin, dest), "_blank", "noopener,noreferrer");
}
function confirmRealMiles(serviceId) {
  const s = find(state.services, serviceId);
  if (!s) return alert("No encontré ese servicio.");
  openMapForRoute(s.origin, s.dest);
  const value = prompt(`Verifica la ruta en Google Maps y escribe las millas reales para ${s.no}:`, num(s.miles).toFixed(2));
  if (value === null) return;
  const miles = num(value);
  if (miles <= 0) return alert("Las millas deben ser mayor de 0.");
  s.miles = miles;
  s.milesVerified = true;
  s.routeAuto = false;
  s.routeNote = "Millas reales confirmadas manualmente desde Google Maps";
  s.updatedAt = stamp();
  upsert("services", s);
  const inv = state.invoices.find(i => i.serviceId === s.id);
  if (inv) { inv.total = serviceTotal(s); upsert("invoices", inv); recomputeInvoicePaid(); }
  save();
  render();
}
function confirmCurrentFormMiles() {
  const origin = $("sOrigin")?.value || "";
  const dest = $("sDest")?.value || "";
  openMapForRoute(origin, dest);
  const current = num($("sMiles")?.value || 0).toFixed(2);
  const value = prompt("Verifica la ruta en Google Maps y escribe las millas reales:", current);
  if (value === null) return;
  const miles = num(value);
  if (miles <= 0) return alert("Las millas deben ser mayor de 0.");
  if ($("sMiles")) { $("sMiles").value = miles.toFixed(2); $("sMiles").dataset.auto = "0"; }
  const box = $("routeHelper");
  if (box) box.textContent = `Millas reales confirmadas: ${miles.toFixed(2)} mi. Al guardar, se recalcula factura/comisión.`;
}

function driverBalance(driverId) {
  const d = find(state.drivers, driverId) || {};
  const related = state.services
    .filter(s => serviceIsCommissionable(s) && s.driverId === driverId)
    .map(s => ({ ...s, commissionKey: s.id }));

  // Comisión operacional por serviceId: NO agrupa por cliente, fecha, ruta ni factura.
  // Mismo cliente + mismo día + servicios diferentes = comisiones separadas.
  const gross = related.reduce((a, s) => a + serviceTotal(s) * (num(d.pct) / 100), 0);
  const retentionGross = gross * (num(d.retention) / 100);
  const paidOut = state.driverPayouts.filter(x => x.driverId === driverId).reduce((a,x)=>a+num(x.amount),0);
  const retPaid = state.retentionPayments.filter(x => x.driverId === driverId).reduce((a,x)=>a+num(x.amount),0);
  const payable = Math.max(0, gross - retentionGross - paidOut);
  const heldRetention = Math.max(0, retentionGross - retPaid);
  return {
    id: driverId,
    name: d.name || "—",
    pct: num(d.pct),
    retention: num(d.retention),
    services: related.length,
    serviceIds: related.map(s => s.id),
    gross,
    payable,
    paidOut,
    heldRetention
  };
}
function driverBalances(){ return state.drivers.map(d => driverBalance(d.id)); }
function providerDeduction(providerId) { const p=find(state.providers,providerId)||{}; return state.services.filter(s=>s.providerId===providerId && serviceIsCommissionable(s)).reduce((a,s)=>a+serviceTotal(s)*(num(p.pct)/100),0); }

function upsert(key, obj) { const arr = state[key]; const ix = arr.findIndex(x=>x.id===obj.id); ix >= 0 ? arr[ix] = obj : arr.push(obj); }
function remove(key, id) {
  if (!confirm("¿Borrar registro?")) return;
  if (key === "payments") {
    const p = find(state.payments, id);
    state.cashflow = state.cashflow.filter(x => x.sourceType !== "payment" || x.sourceId !== id);
    state.payments = state.payments.filter(x=>x.id!==id);
    if (p) recomputeInvoicePaid();
    return save();
  }
  if (key === "invoices") {
    const inv = find(state.invoices, id);
    const paymentIds = state.payments.filter(p=>p.invoiceId===id).map(p=>p.id);
    state.payments = state.payments.filter(p=>p.invoiceId!==id);
    state.cashflow = state.cashflow.filter(x => !(x.sourceType === "payment" && paymentIds.includes(x.sourceId)));
    state.invoices = state.invoices.filter(x=>x.id!==id);
    if (inv) { const srv = find(state.services, inv.serviceId); if (srv && srv.status !== "Cancelado") { srv.status = "Pendiente"; upsert("services", srv); } }
    return save();
  }
  if (key === "cashflow") {
    const cf = find(state.cashflow, id);
    if (cf?.locked) {
      if (!confirm("Este movimiento viene de una factura/pago. Si lo borras, solo se elimina de caja, no del documento original. ¿Continuar?")) return;
    }
  }
  state[key] = state[key].filter(x=>x.id!==id);
  save();
}
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
  const balance = invBalance(inv);
  const finalAmount = Math.min(amount, balance);
  const pay = { id: uid("pay"), invoiceId: inv.id, clientId: inv.clientId, date: $("payDate").value || today(), method: $("payMethod").value, amount: finalAmount, createdAt: stamp() };
  const cfId = uid("cf");
  pay.cashflowId = cfId;
  state.payments.push(pay); recomputeInvoicePaid(); upsert("invoices", inv);
  const s = find(state.services, inv.serviceId); if (s) { s.status = inv.status === "Pagada" ? "Cobrado" : "Parcial"; upsert("services", s); }
  state.cashflow.push({ id: cfId, date: pay.date, type: "Ingreso", category: "Cobro factura", detail: `${inv.no} · ${clientName(inv.clientId)}`, method: pay.method, amount: finalAmount, sourceType: "payment", sourceId: pay.id, locked: true });
  e.target.reset(); $("payDate").value = today(); save();
}
function payDriver(driverId) {
  const b = driverBalance(driverId);
  if (b.payable <= 0) return alert("No hay balance neto a pagar.");
  const raw = prompt(`Balance neto de ${b.name}: ${money(b.payable)}
Monto a pagar:`, b.payable.toFixed(2));
  if (raw === null) return;
  const amount = Math.min(num(raw), b.payable);
  if (amount <= 0) return;
  const payoutId = uid("dp");
  const cfId = uid("cf");
  state.driverPayouts.push({ id: payoutId, driverId, date: today(), amount, cashflowId: cfId, createdAt: stamp() });
  state.cashflow.push({ id: cfId, date: today(), type: "Gasto", category: "Pago chofer", detail: b.name, method: "Operacional", amount, sourceType: "driverPayout", sourceId: payoutId, locked: true });
  save();
}
function payRetention(e) {
  e.preventDefault();
  const id = $("retDriver").value;
  const b = driverBalance(id);
  const amount = num($("retAmount").value);
  if (!id || amount <= 0 || amount > b.heldRetention) return alert("Monto inválido o mayor a retención disponible.");
  const retId = uid("ret");
  const cfId = uid("cf");
  state.retentionPayments.push({ id: retId, driverId: id, date: $("retDate").value || today(), amount, cashflowId: cfId, createdAt: stamp() });
  state.cashflow.push({ id: cfId, date: $("retDate").value || today(), type: "Gasto", category: "Pago retención", detail: b.name, method: "Operacional", amount, sourceType: "retentionPayment", sourceId: retId, locked: true });
  e.target.reset(); $("retDate").value = today(); save();
}
function saveCashflow(e) {
  e.preventDefault();
  const id = $("cfId").value || uid("cf");
  const old = find(state.cashflow, id) || {};
  const cf = { ...old, id, date: $("cfDate").value || today(), type: $("cfType").value, category: $("cfCategory").value || "Ajuste manual", detail: $("cfDetail").value || "", method: $("cfMethod").value || "Operacional", amount: num($("cfAmount").value), updatedAt: stamp() };
  if (cf.amount <= 0) return alert("El monto debe ser mayor de cero.");
  upsert("cashflow", cf);
  e.target.reset(); $("cfDate").value = today(); save();
}
function clearCashflowForm() { ["cfId","cfCategory","cfDetail"].forEach(id => $(id).value = ""); $("cfAmount").value = 0; $("cfDate").value = today(); $("cfType").value = "Ingreso"; $("cfMethod").value = "ATH Móvil"; }
async function resetSystem() {
  if (!confirm("Esto borrará TODO el sistema: clientes, servicios, facturas, cobros, pagos, caja y datos en Firebase. Haz backup antes. ¿Continuar?")) return;
  if (!confirm("Confirmación final: esta acción no se puede deshacer.")) return;
  state = freshState();
  localSave();
  await pushCloud();
  render();
  alert("Sistema reiniciado.");
}

function bind() {
  document.querySelectorAll("#tabs button").forEach(btn => btn.addEventListener("click", () => openView(btn.dataset.view)));
  $("menuToggle")?.addEventListener("click", () => { $("sidebar")?.classList.add("open"); $("sidebarOverlay")?.classList.add("open"); });
  $("sidebarOverlay")?.addEventListener("click", () => { $("sidebar")?.classList.remove("open"); $("sidebarOverlay")?.classList.remove("open"); });
  $("btnFilter").onclick = () => { filters = { q: $("q").value.trim(), from: $("from").value, to: $("to").value, status: $("statusFilter").value }; render(); };
  $("btnClear").onclick = () => { ["q","from","to","statusFilter"].forEach(id=>$(id).value=""); filters = { q:"", from:"", to:"", status:"" }; render(); };
  $("btnSync").onclick = async () => { await pullCloud(); await pushCloud(); alert("Sincronización ejecutada."); };
  fillPRPlaces();
  ["sOrigin","sDest"].forEach(id => $(id)?.addEventListener("input", () => updateRouteEstimate(false)));
  $("btnOpenCurrentRoute")?.addEventListener("click", () => openMapForRoute($("sOrigin")?.value || "", $("sDest")?.value || ""));
  $("btnConfirmCurrentMiles")?.addEventListener("click", () => confirmCurrentFormMiles());
  $("sMiles")?.addEventListener("input", () => { $("sMiles").dataset.auto = "0"; });
  $("formClient").onsubmit = e => { e.preventDefault(); upsert("clients", { id: $("cId").value || uid("cli"), name: $("cName").value, phone: $("cPhone").value, email: $("cEmail").value, city: $("cCity").value, address: $("cAddress").value }); e.target.reset(); save(); };
  $("formDriver").onsubmit = e => { e.preventDefault(); upsert("drivers", { id: $("dId").value || uid("drv"), name: $("dName").value, phone: $("dPhone").value, pct: num($("dPct").value), retention: num($("dRet").value), lic: $("dLic").value, status: $("dStatus").value }); e.target.reset(); $("dPct").value=70; $("dRet").value=10; save(); };
  $("formProvider").onsubmit = e => { e.preventDefault(); upsert("providers", { id: $("pId").value || uid("prov"), name: $("pName").value, pct: num($("pPct").value), phone: $("pPhone").value, status: $("pStatus").value }); e.target.reset(); $("pPct").value=10; save(); };
  $("formVehicle").onsubmit = e => { e.preventDefault(); upsert("vehicles", { id: $("vId").value || uid("veh"), unit: $("vUnit").value, plate: $("vPlate").value, vin: $("vVin").value, exp: $("vExp").value, status: $("vStatus").value }); e.target.reset(); save(); };
  $("formService").onsubmit = e => { e.preventDefault(); updateRouteEstimate(true); const id = $("sId").value || uid("srv"); const old = find(state.services,id) || {}; const est = estimateRouteMiles($("sOrigin").value, $("sDest").value); const s = { ...old, id, no: old.no || nextNo("SRV", state.services), date: $("sDate").value || today(), clientId: $("sClient").value, driverId: $("sDriver").value, providerId: $("sProvider").value, vehicleId: $("sVehicle").value, origin: $("sOrigin").value, dest: $("sDest").value, type: $("sType").value, base: num($("sBase").value), miles: num($("sMiles").value), routeAuto: !!est.ok && $("sMiles")?.dataset.auto !== "0", milesVerified: $("sMiles")?.dataset.auto === "0" || !!old.milesVerified, routeNote: ($("sMiles")?.dataset.auto === "0") ? "Millas reales confirmadas manualmente desde Google Maps" : (est.ok ? est.message : "Millas manuales"), tolls: num($("sTolls").value), expenses: num($("sExpenses").value), status: $("sStatus").value, notes: $("sNotes").value, createdAt: old.createdAt || stamp(), updatedAt: stamp() }; upsert("services", s); const inv = state.invoices.find(i => i.serviceId === s.id); if (inv) { inv.total = serviceTotal(s); upsert("invoices", inv); recomputeInvoicePaid(); } e.target.reset(); $("sDate").value=today(); if($("sMiles")) { $("sMiles").dataset.auto="1"; } updateRouteEstimate(); save(); };
  $("btnCreateInvoice").onclick = () => createInvoice($("invoiceService").value);
  $("formPayment").onsubmit = registerPayment;
  $("formRetention").onsubmit = payRetention;
  $("formCashflow").onsubmit = saveCashflow;
  $("btnClearCashflow").onclick = clearCashflowForm;
  $("formConfig").onsubmit = e => {
    e.preventDefault();
    state.cfg = {
      ...state.cfg,
      name: $("cfgName")?.value || "",
      address: $("cfgAddress")?.value || "",
      phone: $("cfgPhone")?.value || "",
      email: $("cfgEmail")?.value || "",
      web: $("cfgWeb")?.value || "",
      taxId: $("cfgTaxId")?.value || "",
      repName: $("cfgRep")?.value || "",
      taxRate: num($("cfgTaxRate")?.value),
      mileRate: num($("cfgMile")?.value)
    };
    save();
  };
  $("cfgLogo") && ($("cfgLogo").onchange = e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { state.cfg.logoDataUrl = String(reader.result || ""); save(); };
    reader.readAsDataURL(file);
  });
  $("btnRemoveLogo") && ($("btnRemoveLogo").onclick = () => { state.cfg.logoDataUrl = ""; save(); });
  document.body.addEventListener("click", e => { const t = e.target.closest("button"); if (!t) return; if (t.dataset.del) { const [key,id] = t.dataset.del.split(":"); remove(key,id); } if (t.dataset.edit) { const [key,id] = t.dataset.edit.split(":"); edit(key,id); } if (t.dataset.invoice) createInvoice(t.dataset.invoice); if (t.dataset.paydriver) payDriver(t.dataset.paydriver); if (t.dataset.pdfinv) pdfInvoice(t.dataset.pdfinv); if (t.dataset.map) { const s = find(state.services, t.dataset.map); if (s) openMapForRoute(s.origin, s.dest); } if (t.dataset.miles) confirmRealMiles(t.dataset.miles); if (t.dataset.go) openView(t.dataset.go); });
  $("btnPdfExec").onclick = pdfExecutive; $("btnBackup").onclick = backup; $("fileImport").onchange = importBackup; $("btnDemo").onclick = seedDemo; $("pdfInvoices").onclick = pdfInvoices; $("pdfDrivers").onclick = pdfDrivers; $("exportCsv").onclick = exportCsv;
  $("btnResetSystem") && ($("btnResetSystem").onclick = resetSystem);
  $("sDate").value = today(); $("payDate").value = today(); $("retDate").value = today(); $("cfDate").value = today();
}
function openView(id) { document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("active", b.dataset.view===id)); document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden", v.id!==id)); const active=document.querySelector(`#tabs button[data-view="${id}"] span`); if($("pageTitle") && active) $("pageTitle").textContent=active.textContent; $("sidebar")?.classList.remove("open"); $("sidebarOverlay")?.classList.remove("open"); render(); }
function edit(key,id) { const x = find(state[key], id); if (!x) return; const fill = pairs => pairs.forEach(([a,b]) => $(a).value = b ?? ""); if(key==="clients"){fill([["cId",id],["cName",x.name],["cPhone",x.phone],["cEmail",x.email],["cCity",x.city],["cAddress",x.address]]);openView("clientes");} if(key==="drivers"){fill([["dId",id],["dName",x.name],["dPhone",x.phone],["dPct",x.pct],["dRet",x.retention],["dLic",x.lic],["dStatus",x.status]]);openView("choferes");} if(key==="providers"){fill([["pId",id],["pName",x.name],["pPct",x.pct],["pPhone",x.phone],["pStatus",x.status]]);openView("proveedores");} if(key==="vehicles"){fill([["vId",id],["vUnit",x.unit],["vPlate",x.plate],["vVin",x.vin],["vExp",x.exp],["vStatus",x.status]]);openView("flota");} if(key==="services"){fill([["sId",id],["sDate",x.date],["sClient",x.clientId],["sDriver",x.driverId],["sProvider",x.providerId],["sVehicle",x.vehicleId],["sOrigin",x.origin],["sDest",x.dest],["sType",x.type],["sBase",x.base],["sMiles",x.miles],["sTolls",x.tolls],["sExpenses",x.expenses],["sStatus",x.status],["sNotes",x.notes]]); if($("sMiles")) $("sMiles").dataset.auto="0"; openView("servicios"); updateRouteEstimate(false);} if(key==="cashflow"){fill([["cfId",id],["cfDate",x.date],["cfType",x.type],["cfCategory",x.category],["cfMethod",x.method],["cfAmount",x.amount],["cfDetail",x.detail]]);openView("pagos");} }
function backup() { const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"}); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nexus-transport-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href); }
function importBackup(e) { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ state = mergeState(JSON.parse(r.result)); save(); alert("Backup importado."); }catch{ alert("Archivo inválido."); } }; r.readAsText(f); }
function seedDemo() { const c={id:uid("cli"),name:"Cliente Demo",phone:"787-000-0000",city:"San Juan"}; const d={id:uid("drv"),name:"Chofer Demo",phone:"787-000-0001",pct:70,retention:10,status:"Activo"}; const p={id:uid("prov"),name:"Proveedor Demo",pct:10,status:"Activo"}; const v={id:uid("veh"),unit:"Unidad 01",plate:"ABC-123",status:"Activo"}; state.clients.push(c); state.drivers.push(d); state.providers.push(p); state.vehicles.push(v); state.services.push({id:uid("srv"),no:nextNo("SRV",state.services),date:today(),clientId:c.id,driverId:d.id,providerId:p.id,vehicleId:v.id,origin:"San Juan",dest:"Ponce",type:"Grúa",base:250,miles:74.8,routeAuto:true,tolls:12,expenses:35,status:"Pendiente",notes:"Servicio demo"}); save(); }
function exportCsv() { const rows = [["fecha","servicio","cliente","chofer","origen","destino","total","estado"], ...state.services.map(s=>[s.date,s.no,clientName(s.clientId),driverName(s.driverId),s.origin,s.dest,serviceTotal(s),s.status])]; const csv = rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n"); const blob=new Blob([csv],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`servicios-${today()}.csv`; a.click(); URL.revokeObjectURL(a.href); }
function pdfSafeName(text) { return String(text || "documento").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80); }
function pdfMoneyValue(n) { return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function addPdfHeader(docp, title, subtitle = "") {
  const cfg = state.cfg || {};
  const W = docp.internal.pageSize.getWidth();
  let y = 16;
  if (cfg.logoDataUrl) {
    try {
      const type = String(cfg.logoDataUrl).includes("image/png") ? "PNG" : "JPEG";
      docp.addImage(cfg.logoDataUrl, type, (W - 34) / 2, y, 34, 34);
      y += 40;
    } catch (err) { console.warn("Logo PDF omitido", err); }
  }
  docp.setFont("helvetica", "bold");
  docp.setFontSize(15);
  docp.text((cfg.name || "Nexus Transport PR").toUpperCase(), W / 2, y, { align: "center" });
  y += 6;
  docp.setFont("helvetica", "normal");
  docp.setFontSize(8.5);
  [cfg.address, cfg.phone ? `Tel: ${cfg.phone}` : "", cfg.email, cfg.web, cfg.taxId ? `Reg./ID: ${cfg.taxId}` : ""].filter(Boolean).forEach(line => {
    docp.text(String(line), W / 2, y, { align: "center" }); y += 4.5;
  });
  y += 3;
  docp.setDrawColor(25, 55, 95); docp.setLineWidth(.5); docp.line(16, y, W - 16, y); y += 9;
  docp.setFont("helvetica", "bold"); docp.setFontSize(13); docp.text(title.toUpperCase(), W / 2, y, { align: "center" }); y += 6;
  if (subtitle) { docp.setFont("helvetica", "normal"); docp.setFontSize(9); docp.text(subtitle, W / 2, y, { align: "center" }); y += 6; }
  return y + 2;
}
function addFooter(docp) {
  const pages = docp.internal.getNumberOfPages();
  const W = docp.internal.pageSize.getWidth();
  const H = docp.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    docp.setPage(i); docp.setFont("helvetica", "normal"); docp.setFontSize(8); docp.setTextColor(90);
    docp.line(16, H - 18, W - 16, H - 18);
    docp.text("Documento generado automáticamente por Nexus Transport PR", 16, H - 10);
    docp.text(`Página ${i} de ${pages}`, W - 16, H - 10, { align: "right" });
    docp.setTextColor(0);
  }
}
function ensureSpace(docp, y, needed = 20) { if (y + needed > 275) { docp.addPage(); return 20; } return y; }
function pdfTable(docp, headers, rows, x, y, widths) {
  docp.setFontSize(8); docp.setFont("helvetica", "bold"); docp.setFillColor(235, 240, 247); docp.rect(x, y - 5, widths.reduce((a,b)=>a+b,0), 8, "F");
  let cx = x; headers.forEach((h,i)=>{ docp.text(String(h), cx + 1.5, y); cx += widths[i]; }); y += 6;
  docp.setFont("helvetica", "normal");
  rows.forEach(row => { y = ensureSpace(docp, y, 12); cx = x; row.forEach((cell,i)=>{ const txt = docp.splitTextToSize(String(cell ?? ""), widths[i] - 3).slice(0,2); docp.text(txt, cx + 1.5, y); cx += widths[i]; }); docp.setDrawColor(230); docp.line(x, y + 2, x + widths.reduce((a,b)=>a+b,0), y + 2); y += 8; });
  return y;
}
function pdfExecutive() {
  const { jsPDF } = window.jspdf; const docp = new jsPDF({ unit:"mm", format:"letter" });
  let y = addPdfHeader(docp, "Reporte Ejecutivo", `Fecha: ${today()}`);
  const billed=state.invoices.reduce((a,i)=>a+num(i.total),0), paid=state.payments.reduce((a,p)=>a+num(p.amount),0), pending=state.invoices.reduce((a,i)=>a+invBalance(i),0);
  const driverDue = driverBalances().reduce((a,d)=>a+num(d.payable),0), held = driverBalances().reduce((a,d)=>a+num(d.heldRetention),0);
  y = pdfTable(docp, ["Concepto", "Total"], [["Servicios", state.services.length],["Facturas", state.invoices.length],["Facturado", `$${pdfMoneyValue(billed)}`],["Cobrado", `$${pdfMoneyValue(paid)}`],["Por cobrar", `$${pdfMoneyValue(pending)}`],["A pagar choferes", `$${pdfMoneyValue(driverDue)}`],["Retenciones retenidas", `$${pdfMoneyValue(held)}`]], 28, y, [90, 55]);
  y += 8; docp.setFont("helvetica","bold"); docp.setFontSize(10); docp.text("Servicios recientes", 16, y); y += 7;
  const rows = filteredServices().slice(0, 20).map(s=>[s.no, clientName(s.clientId), driverName(s.driverId), `${s.origin} → ${s.dest}`, `${num(s.miles).toFixed(2)} mi`, money(serviceTotal(s)), s.status]);
  pdfTable(docp, ["Servicio","Cliente","Chofer","Ruta","Millas","Total","Estado"], rows, 10, y, [21,28,28,45,18,24,22]);
  addFooter(docp); docp.save(`Reporte_Ejecutivo_${today()}.pdf`);
}
function pdfInvoices() {
  const { jsPDF } = window.jspdf; const docp = new jsPDF({ unit:"mm", format:"letter" });
  let y = addPdfHeader(docp, "Reporte de Facturas", `Fecha: ${today()}`);
  const rows = state.invoices.map(i=>[i.no, i.date, clientName(i.clientId), find(state.services,i.serviceId)?.no || "", money(i.total), money(i.paid), money(invBalance(i)), i.status]);
  pdfTable(docp, ["Factura","Fecha","Cliente","Servicio","Total","Pagado","Balance","Estado"], rows, 8, y, [22,22,35,24,24,24,24,22]);
  addFooter(docp); docp.save(`Reporte_Facturas_${today()}.pdf`);
}
function pdfDrivers() {
  const { jsPDF } = window.jspdf; const docp = new jsPDF({ unit:"mm", format:"letter" });
  let y = addPdfHeader(docp, "Reporte de Choferes", `Fecha: ${today()}`);
  const rows = driverBalances().map(d=>[d.name, d.services, money(d.gross), money(d.commission), money(d.paid), money(d.payable), money(d.heldRetention)]);
  pdfTable(docp, ["Chofer","Servicios","Bruto","Comisión","Pagado","A pagar","Retenido"], rows, 10, y, [40,20,27,27,27,27,27]);
  addFooter(docp); docp.save(`Reporte_Choferes_${today()}.pdf`);
}
function pdfInvoice(id) {
  const { jsPDF } = window.jspdf; const i=find(state.invoices,id); if(!i)return;
  const s = find(state.services, i.serviceId) || {}; const c = find(state.clients, i.clientId) || {};
  const docp = new jsPDF({ unit:"mm", format:"letter" });
  let y = addPdfHeader(docp, `Factura ${i.no}`, `Fecha: ${i.date}`);
  const W = docp.internal.pageSize.getWidth();
  docp.setFont("helvetica","bold"); docp.setFontSize(10); docp.text("CLIENTE", 16, y); docp.text("DETALLE DEL DOCUMENTO", W - 16, y, {align:"right"}); y += 6;
  docp.setFont("helvetica","normal"); docp.setFontSize(9);
  docp.text(c.name || clientName(i.clientId), 16, y); docp.text(`Factura: ${i.no}`, W - 16, y, {align:"right"}); y += 5;
  if (c.phone) docp.text(`Tel: ${c.phone}`, 16, y);
  docp.text(`Estado: ${i.status}`, W - 16, y, {align:"right"}); y += 5;
  if (c.email) { docp.text(`Email: ${c.email}`, 16, y); y += 5; }
  if (c.address) { docp.text(docp.splitTextToSize(`Dirección: ${c.address}`, 90), 16, y); y += 8; }
  y += 5;
  const desc = `${s.type || "Servicio de transporte"} · ${s.origin || ""} → ${s.dest || ""} · ${num(s.miles).toFixed(2)} millas`;
  pdfTable(docp, ["Descripción", "Cantidad", "Precio"], [[desc, "1", money(i.total)]], 16, y, [125, 25, 38]);
  y += 32;
  const paid = num(i.paid), balance = invBalance(i), taxRate = num(state.cfg.taxRate);
  const subtotal = taxRate ? num(i.total) / (1 + taxRate / 100) : num(i.total);
  const tax = num(i.total) - subtotal;
  const tx = W - 76;
  docp.setFont("helvetica","bold"); docp.setFontSize(10);
  [["Subtotal", subtotal], [`IVU (${taxRate}%)`, tax], ["TOTAL", i.total], ["Pagado", paid], ["Balance", balance]].forEach(([label,val], idx)=>{ docp.text(label, tx, y); docp.text(`$${pdfMoneyValue(val)}`, W - 16, y, {align:"right"}); y += idx===2 ? 7 : 6; });
  y += 18; docp.setFont("helvetica","normal"); docp.text("______________________________", 22, y); docp.text("______________________________", W - 86, y); y += 5;
  docp.text("Cliente", 52, y, {align:"center"}); docp.text(state.cfg.repName || "Representante autorizado", W - 52, y, {align:"center"});
  addFooter(docp); docp.save(`${pdfSafeName(i.no)}_${today()}.pdf`);
}

state = normalizeOperationalState(state);
bind(); render(); initFirebase();
