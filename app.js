import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGoSNKi1wapE1SpHxTc8wNZGGkJ2nQj7s",
  authDomain: "nexus-transport-2887b.firebaseapp.com",
  projectId: "nexus-transport-2887b",
  storageBucket: "nexus-transport-2887b.firebasestorage.app",
  messagingSenderId: "972915419764",
  appId: "1:972915419764:web:7d61dfb03bbe56df867f21"
};

let firebaseReady = false;
let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  firebaseReady = true;
} catch (err) {
  console.warn("Firebase no inició. Modo local activo.", err);
}

const KEY = "nexus_transport_pr_square_v4";
const CLOUD_PATH = ["transport_state", "main"];
const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = (v) => Number(v || 0);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
const esc = (s = "") => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

let state = loadLocal();
let filters = { desde: "", hasta: "", buscar: "", estado: "" };

function defaultState() {
  return {
    cfg: { name: "Nexus Transport PR", phone: "", email: "", address: "Puerto Rico", rate: 2.5, tax: 0, logo: "" },
    clientes: [], choferes: [], proveedores: [], vehiculos: [], servicios: [], evidencias: []
  };
}
function loadLocal() {
  try { return { ...defaultState(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return defaultState(); }
}
function localSaveOnly() { localStorage.setItem(KEY, JSON.stringify(state)); setSync("Guardado local"); }
async function save(syncCloud = true) {
  localSaveOnly();
  renderAll();
  if (syncCloud) await pushCloud(false);
}
function setSync(text) { if ($("syncStatus")) $("syncStatus").textContent = text; }

async function pullCloud() {
  if (!firebaseReady || !db) return setSync("Firebase no disponible");
  try {
    setSync("Leyendo nube...");
    const snap = await getDoc(doc(db, ...CLOUD_PATH));
    if (snap.exists() && snap.data().payload) {
      state = { ...defaultState(), ...snap.data().payload };
      localSaveOnly();
      renderAll();
      setSync("Firebase conectado");
    } else {
      await pushCloud(false);
      setSync("Nube inicializada");
    }
  } catch (err) {
    console.warn(err);
    setSync("Firebase bloqueado");
  }
}
async function pushCloud(show = true) {
  if (!firebaseReady || !db) return;
  try {
    if (show) setSync("Subiendo...");
    await setDoc(doc(db, ...CLOUD_PATH), { payload: state, updatedAt: serverTimestamp() }, { merge: true });
    setSync("Firebase sincronizado");
  } catch (err) {
    console.warn(err);
    setSync("Solo local");
  }
}

function byId(arr, id) { return arr.find(x => x.id === id) || null; }
function nameOf(arr, id, fallback = "—") { return byId(arr, id)?.nombre || byId(arr, id)?.unidad || fallback; }
function serviceTotal(s) { return num(s.base) + (num(s.millas) * num(state.cfg.rate)) + num(s.peajes); }
function serviceBalance(s) { return Math.max(0, serviceTotal(s) - num(s.pagado)); }
function serviceProfit(s) { return serviceTotal(s) - num(s.gastos) - num(s.peajes); }
function activeServices() { return state.servicios.filter(s => s.estado !== "Cancelado"); }
function filteredServices() {
  const q = filters.buscar.toLowerCase().trim();
  return activeServices().filter(s => !filters.desde || s.fecha >= filters.desde)
    .filter(s => !filters.hasta || s.fecha <= filters.hasta)
    .filter(s => !filters.estado || s.estado === filters.estado)
    .filter(s => {
      if (!q) return true;
      const bag = [s.numero, s.origen, s.destino, s.tipo, s.estado, s.metodo, nameOf(state.clientes, s.clienteId), nameOf(state.choferes, s.choferId), nameOf(state.proveedores, s.proveedorId), nameOf(state.vehiculos, s.vehiculoId)].join(" ").toLowerCase();
      return bag.includes(q);
    }).sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.hora).localeCompare(String(a.hora)));
}
function table(el, heads, rows) {
  el.innerHTML = `<thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>` +
    (rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}"><div class="empty">Sin datos registrados.</div></td></tr>`) + "</tbody>";
}
function pill(s) {
  const c = s === "Cobrado" || s === "Activo" ? "ok" : s === "Pendiente" || s === "Mantenimiento" ? "warn" : s === "Cancelado" || s === "Inactivo" ? "bad" : "";
  return `<span class="pill ${c}">${esc(s)}</span>`;
}
function actions(key,id) { return `<div class="rowBtns"><button class="mini" data-edit="${key}:${id}">Editar</button><button class="mini danger" data-del="${key}:${id}">Borrar</button></div>`; }

function openTab(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("hidden", v.id !== id));
  document.querySelectorAll(".navRail button").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  const active = document.querySelector(`.navRail button[data-tab="${id}"]`);
  if ($("pageTitle")) $("pageTitle").textContent = active?.textContent || id;
}
function bindNav() {
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => openTab(b.dataset.tab));
  document.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openTab(b.dataset.open));
}
function bindEvents() {
  bindNav();
  $("btnFilter").onclick = () => { filters = { desde:fDesde.value, hasta:fHasta.value, buscar:fBuscar.value, estado:fEstado.value }; renderAll(); };
  $("btnClear").onclick = () => { [fDesde,fHasta,fBuscar,fEstado].forEach(x => x.value=""); filters = { desde:"", hasta:"", buscar:"", estado:"" }; renderAll(); };
  $("saveClient").onclick = saveClient; $("saveDriver").onclick = saveDriver; $("saveProvider").onclick = saveProvider; $("saveVehicle").onclick = saveVehicle; $("saveService").onclick = saveService; $("saveEvidence").onclick = saveEvidence; $("saveConfig").onclick = saveConfig;
  $("btnSeed").onclick = seedDemo; $("btnSyncNow").onclick = async () => { await pushCloud(true); await pullCloud(); };
  $("btnExportJson").onclick = exportJson; $("importJson").onchange = importJson;
  $("openRoute").onclick = openGoogleRoute; $("routeService").onchange = renderRoutePreview;
  $("cfgLogo").onchange = readLogo;
  $("srvCliente").onchange = () => { const c = byId(state.clientes, srvCliente.value); if (c) srvTelefono.value = c.telefono || ""; };
  ["pdfExecutive","pdfServices","pdfDrivers","pdfCash","pdfInvoices","pdfCobros","pdfRetenciones","pdfDeducciones","pdfFlujo"].forEach(id => { const el=$(id); if(el) el.onclick = () => makePdf(id); });
  $("csvServices").onclick = exportCsv;
}

function upsert(arrName, obj) {
  const i = state[arrName].findIndex(x => x.id === obj.id);
  if (i >= 0) state[arrName][i] = obj; else state[arrName].push(obj);
}
function reset(formId, idField) { $(formId).reset(); $(idField).value=""; if ($("srvFecha")) srvFecha.value=today(); }
function saveClient(e){ e?.preventDefault(); if(!cliNombre.value.trim()) return alert("Nombre requerido"); upsert("clientes", {id:cliId.value||uid(), nombre:cliNombre.value, telefono:cliTelefono.value, email:cliEmail.value, municipio:cliMunicipio.value, direccion:cliDireccion.value, notas:cliNotas.value}); reset("formCliente","cliId"); save(); }
function saveDriver(){ if(!drvNombre.value.trim()) return alert("Chofer requerido"); upsert("choferes", {id:drvId.value||uid(), nombre:drvNombre.value, telefono:drvTelefono.value, ganancia:num(drvGanancia.value), retencion:num(drvRetencion.value), licencia:drvLicencia.value, expira:drvExpira.value, estado:drvEstado.value}); reset("formChofer","drvId"); save(); }
function saveProvider(){ if(!proNombre.value.trim()) return alert("Proveedor requerido"); upsert("proveedores", {id:proId.value||uid(), nombre:proNombre.value, deduccion:num(proDeduccion.value), telefono:proTelefono.value, email:proEmail.value, estado:proEstado.value}); reset("formProveedor","proId"); save(); }
function saveVehicle(){ if(!vehUnidad.value.trim()) return alert("Unidad requerida"); upsert("vehiculos", {id:vehId.value||uid(), unidad:vehUnidad.value, tablilla:vehTablilla.value, marca:vehMarca.value, modelo:vehModelo.value, ano:vehAno.value, vin:vehVin.value, mantenimiento:vehMantenimiento.value, marbete:vehMarbete.value, estado:vehEstado.value}); reset("formVehiculo","vehId"); save(); }
function nextNo(){ return `NTP-${String(state.servicios.length + 1).padStart(5,"0")}`; }
function saveService(){
  if(!srvFecha.value || !srvCliente.value || !srvChofer.value || !srvOrigen.value || !srvDestino.value) return alert("Completa fecha, cliente, chofer, origen y destino.");
  upsert("servicios", { id:srvId.value||uid(), fecha:srvFecha.value, hora:srvHora.value, numero:srvNumero.value||nextNo(), clienteId:srvCliente.value, telefono:srvTelefono.value, origen:srvOrigen.value, destino:srvDestino.value, tipo:srvTipo.value, choferId:srvChofer.value, proveedorId:srvProveedor.value, vehiculoId:srvVehiculo.value, millas:num(srvMillas.value), base:num(srvBase.value), peajes:num(srvPeajes.value), gastos:num(srvGastos.value), pagado:num(srvPagado.value), metodo:srvMetodo.value, estado:srvEstado.value, notas:srvNotas.value, updatedAt:new Date().toISOString() });
  reset("formServicio","srvId"); save();
}
function saveEvidence(){
  const file = evFile.files?.[0];
  const finish = (data="") => { upsert("evidencias", { id:evId.value||uid(), servicioId:evServicio.value, tipo:evTipo.value, desc:evDesc.value, fileName:file?.name||"", fileData:data, createdAt:new Date().toISOString() }); reset("formEvidencia","evId"); save(); };
  if (file) { const r = new FileReader(); r.onload=()=>finish(r.result); r.readAsDataURL(file); } else finish();
}
function saveConfig(){ state.cfg = {...state.cfg, name:cfgName.value, phone:cfgPhone.value, email:cfgEmail.value, address:cfgAddress.value, rate:num(cfgRate.value), tax:num(cfgTax.value)}; save(); }
function readLogo(e){ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{state.cfg.logo=r.result; save();}; r.readAsDataURL(f); }
function remove(key,id){ if(!confirm("¿Borrar registro?")) return; state[key] = state[key].filter(x => x.id !== id); save(); }

function renderAll(){ renderBrand(); renderSelects(); renderDashboard(); renderTables(); renderFinance(); renderConfig(); renderRoutePreview(); }
function renderBrand(){ brandName.textContent=state.cfg.name||"Nexus Transport PR"; if(state.cfg.logo) brandMark.innerHTML=`<img src="${state.cfg.logo}" alt="Logo">`; else brandMark.textContent=(state.cfg.name||"NT").split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function options(arr,label){ return `<option value="">${label}</option>` + arr.filter(x=>x.estado!=="Inactivo").map(x=>`<option value="${x.id}">${esc(x.nombre||x.unidad)}</option>`).join(""); }
function renderSelects(){ srvCliente.innerHTML=options(state.clientes,"Seleccionar cliente"); srvChofer.innerHTML=options(state.choferes,"Seleccionar chofer"); srvProveedor.innerHTML=options(state.proveedores,"Sin proveedor"); srvVehiculo.innerHTML=options(state.vehiculos,"Sin vehículo"); const srvOpts=options(state.servicios.map(s=>({...s,nombre:`${s.numero} — ${nameOf(state.clientes,s.clienteId)} — ${s.origen} → ${s.destino}`})),"Seleccionar servicio"); routeService.innerHTML=srvOpts; evServicio.innerHTML=srvOpts; }
function renderDashboard(){
  const rows=filteredServices(); const all=activeServices(); const fact=rows.reduce((a,s)=>a+serviceTotal(s),0), paid=rows.reduce((a,s)=>a+num(s.pagado),0), bal=rows.reduce((a,s)=>a+serviceBalance(s),0), net=rows.reduce((a,s)=>a+serviceProfit(s),0);
  heroBalance.textContent=money(all.reduce((a,s)=>a+serviceBalance(s),0)); heroServices.textContent=`${all.length} servicios activos`;
  kpiGrid.innerHTML = [["Facturado",fact,"servicios filtrados"],["Cobrado",paid,"cash-in"],["Por cobrar",bal,"pendiente"],["Neto operativo",net,"antes de pagos"]].map(([a,b,c])=>`<div class="kpi"><span>${a}</span><strong>${money(b)}</strong><small>${c}</small></div>`).join("");
  table(tblRecent,["Fecha","Servicio","Cliente","Ruta","Estado","Total"], rows.slice(0,8).map(s=>[esc(s.fecha),esc(s.numero),esc(nameOf(state.clientes,s.clienteId)),`${esc(s.origen)} → ${esc(s.destino)}`,pill(s.estado),money(serviceTotal(s))]));
  const map={}; rows.forEach(s=>{ const n=nameOf(state.choferes,s.choferId,"Sin chofer"); map[n]=(map[n]||0)+serviceTotal(s); });
  topDrivers.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,v])=>`<div class="listItem"><strong>${esc(n)}</strong><span>${money(v)}</span></div>`).join("") || `<div class="empty">Sin desempeño todavía.</div>`;
}
function renderTables(){
  const rows=filteredServices();
  table(tblServicios,["Fecha","No.","Cliente","Ruta","Chofer","Total","Pagado","Balance","Estado","Acción"], rows.map(s=>[esc(s.fecha),esc(s.numero),esc(nameOf(state.clientes,s.clienteId)),`${esc(s.origen)} → ${esc(s.destino)}`,esc(nameOf(state.choferes,s.choferId)),money(serviceTotal(s)),money(s.pagado),money(serviceBalance(s)),pill(s.estado),actions("servicios",s.id)]));
  table(tblClientes,["Cliente","Teléfono","Municipio","Facturado","Balance","Acción"], state.clientes.map(c=>{ const ss=state.servicios.filter(s=>s.clienteId===c.id); return [esc(c.nombre),esc(c.telefono),esc(c.municipio),money(ss.reduce((a,s)=>a+serviceTotal(s),0)),money(ss.reduce((a,s)=>a+serviceBalance(s),0)),actions("clientes",c.id)]; }));
  table(tblChoferes,["Chofer","Teléfono","Ganancia","Retención","Licencia","Expira","Estado","Acción"], state.choferes.map(d=>[esc(d.nombre),esc(d.telefono),`${num(d.ganancia)}%`,`${num(d.retencion)}%`,esc(d.licencia),esc(d.expira),pill(d.estado),actions("choferes",d.id)]));
  table(tblProveedores,["Proveedor","Deducción","Teléfono","Email","Estado","Acción"], state.proveedores.map(p=>[esc(p.nombre),`${num(p.deduccion)}%`,esc(p.telefono),esc(p.email),pill(p.estado),actions("proveedores",p.id)]));
  table(tblVehiculos,["Unidad","Tablilla","Marca/Modelo","Año","Mantenimiento","Marbete","Estado","Acción"], state.vehiculos.map(v=>[esc(v.unidad),esc(v.tablilla),`${esc(v.marca)} ${esc(v.modelo)}`,esc(v.ano),esc(v.mantenimiento),esc(v.marbete),pill(v.estado),actions("vehiculos",v.id)]));
  table(tblFacturacion,["Factura","Fecha","Cliente","Método","Estado","Total","Pagado","Balance"], rows.map(s=>[esc(s.numero),esc(s.fecha),esc(nameOf(state.clientes,s.clienteId)),esc(s.metodo),pill(s.estado),money(serviceTotal(s)),money(s.pagado),money(serviceBalance(s))]));
  table(tblCobros,["Fecha","Servicio","Cliente","Método","Cobrado","Balance","Estado"], rows.map(s=>[esc(s.fecha),esc(s.numero),esc(nameOf(state.clientes,s.clienteId)),esc(s.metodo),money(s.pagado),money(serviceBalance(s)),pill(s.estado)]));
  table(tblEvidencias,["Fecha","Servicio","Tipo","Descripción","Archivo","Acción"], state.evidencias.map(e=>[esc((e.createdAt||"").slice(0,10)),esc(nameOf(state.servicios.map(s=>({...s,nombre:s.numero})),e.servicioId)),esc(e.tipo),esc(e.desc), e.fileData?`<a class="mini" href="${e.fileData}" download="${esc(e.fileName||"evidencia")}">Descargar</a>`:esc(e.fileName), actions("evidencias",e.id)]));
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const [k,id]=b.dataset.del.split(":"); remove(k,id);});
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const [k,id]=b.dataset.edit.split(":"); edit(k,id);});
}
function paymentRows(rows=filteredServices()){
  const map={}; rows.forEach(s=>{ const d=byId(state.choferes,s.choferId); if(!d)return; const bruto=serviceProfit(s)*num(d.ganancia)/100; const ret=bruto*num(d.retencion)/100; map[d.id]??={nombre:d.nombre, bruto:0, ret:0, neto:0}; map[d.id].bruto+=bruto; map[d.id].ret+=ret; map[d.id].neto+=bruto-ret; }); return Object.values(map);
}
function providerRows(rows=filteredServices()){
  const map={}; rows.forEach(s=>{ const p=byId(state.proveedores,s.proveedorId); if(!p)return; const ded=serviceTotal(s)*num(p.deduccion)/100; map[p.id]??={nombre:p.nombre, ded:0}; map[p.id].ded+=ded; }); return Object.values(map);
}
function renderFinance(){
  const rows=filteredServices(); const fact=rows.reduce((a,s)=>a+serviceTotal(s),0), paid=rows.reduce((a,s)=>a+num(s.pagado),0), bal=rows.reduce((a,s)=>a+serviceBalance(s),0), gastos=rows.reduce((a,s)=>a+num(s.gastos)+num(s.peajes),0), net=fact-gastos;
  cobrosKpis.innerHTML = [["Cobrado",paid],["Por cobrar",bal],["Servicios",rows.length],["Facturado",fact]].map(([a,b])=>`<div class="kpi"><span>${a}</span><strong>${typeof b==='number'?money(b):b}</strong></div>`).join("");
  cashKpis.innerHTML = [["Facturado",fact],["Cobrado",paid],["Gastos",gastos],["Neto",net]].map(([a,b])=>`<div class="kpi"><span>${a}</span><strong>${money(b)}</strong></div>`).join("");
  table(tblRetenciones,["Chofer","Bruto","Retención","Neto a pagar"], paymentRows(rows).map(r=>[esc(r.nombre),money(r.bruto),money(r.ret),money(r.neto)]));
  table(tblDeducciones,["Proveedor","Deducción acumulada"], providerRows(rows).map(r=>[esc(r.nombre),money(r.ded)]));
  table(tblFlujo,["Concepto","Total"], [["Facturado",money(fact)],["Cobrado",money(paid)],["Gastos + peajes",money(gastos)],["Cuentas por cobrar",money(bal)],["Neto operacional",money(net)]]);
}
function renderConfig(){ cfgName.value=state.cfg.name||""; cfgPhone.value=state.cfg.phone||""; cfgEmail.value=state.cfg.email||""; cfgAddress.value=state.cfg.address||""; cfgRate.value=state.cfg.rate||0; cfgTax.value=state.cfg.tax||0; }
function renderRoutePreview(){ const s=byId(state.servicios, routeService.value); if(!s){ routePreview.textContent="Sin ruta seleccionada."; return; } routePreview.innerHTML=`<strong>${esc(s.numero)} · ${esc(nameOf(state.clientes,s.clienteId))}</strong><span>${esc(s.origen)} → ${esc(s.destino)}</span><span>Millas guardadas: ${num(s.millas).toFixed(2)} · Total: ${money(serviceTotal(s))}</span>`; }
function openGoogleRoute(){ const s=byId(state.servicios, routeService.value); if(!s) return alert("Selecciona un servicio."); const url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(s.origen)}&destination=${encodeURIComponent(s.destino)}&travelmode=driving`; window.open(url,"_blank"); }

function edit(k,id){
  const o=byId(state[k],id); if(!o)return;
  if(k==="clientes"){ openTab("clientes"); cliId.value=o.id; cliNombre.value=o.nombre||""; cliTelefono.value=o.telefono||""; cliEmail.value=o.email||""; cliMunicipio.value=o.municipio||""; cliDireccion.value=o.direccion||""; cliNotas.value=o.notas||""; }
  if(k==="choferes"){ openTab("choferes"); drvId.value=o.id; drvNombre.value=o.nombre||""; drvTelefono.value=o.telefono||""; drvGanancia.value=o.ganancia||0; drvRetencion.value=o.retencion||0; drvLicencia.value=o.licencia||""; drvExpira.value=o.expira||""; drvEstado.value=o.estado||"Activo"; }
  if(k==="proveedores"){ openTab("proveedores"); proId.value=o.id; proNombre.value=o.nombre||""; proDeduccion.value=o.deduccion||0; proTelefono.value=o.telefono||""; proEmail.value=o.email||""; proEstado.value=o.estado||"Activo"; }
  if(k==="vehiculos"){ openTab("flota"); vehId.value=o.id; vehUnidad.value=o.unidad||""; vehTablilla.value=o.tablilla||""; vehMarca.value=o.marca||""; vehModelo.value=o.modelo||""; vehAno.value=o.ano||""; vehVin.value=o.vin||""; vehMantenimiento.value=o.mantenimiento||""; vehMarbete.value=o.marbete||""; vehEstado.value=o.estado||"Activo"; }
  if(k==="servicios"){ openTab("servicios"); srvId.value=o.id; srvFecha.value=o.fecha||today(); srvHora.value=o.hora||""; srvNumero.value=o.numero||""; srvCliente.value=o.clienteId||""; srvTelefono.value=o.telefono||""; srvOrigen.value=o.origen||""; srvDestino.value=o.destino||""; srvTipo.value=o.tipo||"Grúa"; srvChofer.value=o.choferId||""; srvProveedor.value=o.proveedorId||""; srvVehiculo.value=o.vehiculoId||""; srvMillas.value=o.millas||0; srvBase.value=o.base||0; srvPeajes.value=o.peajes||0; srvGastos.value=o.gastos||0; srvPagado.value=o.pagado||0; srvMetodo.value=o.metodo||"ATH Móvil"; srvEstado.value=o.estado||"Pendiente"; srvNotas.value=o.notas||""; }
}

function seedDemo(){
  if(!confirm("¿Cargar datos demo?")) return;
  const c1=uid(), c2=uid(), d1=uid(), d2=uid(), p1=uid(), v1=uid();
  state.clientes=[{id:c1,nombre:"Metro Auto Group",telefono:"787-000-0000",email:"",municipio:"San Juan",direccion:"San Juan, PR",notas:"Cuenta comercial"},{id:c2,nombre:"Cliente Residencial",telefono:"787-111-2222",email:"",municipio:"Bayamón",direccion:"Bayamón, PR",notas:""}];
  state.choferes=[{id:d1,nombre:"Carlos Rivera",telefono:"787-222-3333",ganancia:50,retencion:10,licencia:"PR-12345",expira:"2027-12-31",estado:"Activo"},{id:d2,nombre:"Luis Morales",telefono:"787-333-4444",ganancia:45,retencion:10,licencia:"PR-99881",expira:"2027-08-20",estado:"Activo"}];
  state.proveedores=[{id:p1,nombre:"Proveedor Externo A",deduccion:5,telefono:"",email:"",estado:"Activo"}];
  state.vehiculos=[{id:v1,unidad:"Unidad 01",tablilla:"ABC-123",marca:"Ford",modelo:"F-550",ano:"2022",vin:"",mantenimiento:"2026-07-15",marbete:"2027-01-30",estado:"Activo"}];
  state.servicios=[{id:uid(),fecha:today(),hora:"09:00",numero:"NTP-00001",clienteId:c1,telefono:"787-000-0000",origen:"San Juan, PR",destino:"Caguas, PR",tipo:"Grúa",choferId:d1,proveedorId:p1,vehiculoId:v1,millas:22,base:95,peajes:8,gastos:15,pagado:120,metodo:"ATH Móvil",estado:"Cobrado",notas:"Servicio completado"},{id:uid(),fecha:today(),hora:"13:30",numero:"NTP-00002",clienteId:c2,telefono:"787-111-2222",origen:"Bayamón, PR",destino:"Carolina, PR",tipo:"Transporte",choferId:d2,proveedorId:"",vehiculoId:v1,millas:18,base:80,peajes:4,gastos:10,pagado:0,metodo:"No cobrado",estado:"Pendiente",notas:"Pendiente de cobro"}];
  save();
}

function pdfDoc(title){ const { jsPDF } = window.jspdf; const docp = new jsPDF({unit:"pt",format:"letter"}); const W=docp.internal.pageSize.getWidth(); docp.setFillColor(7,17,31); docp.rect(0,0,W,86,"F"); docp.setTextColor(255); docp.setFont("helvetica","bold"); docp.setFontSize(17); docp.text(state.cfg.name||"Nexus Transport PR",40,34); docp.setFont("helvetica","normal"); docp.setFontSize(10); docp.text(title,40,56); if(state.cfg.logo){try{docp.addImage(state.cfg.logo,state.cfg.logo.startsWith("data:image/png")?"PNG":"JPEG",W-86,18,48,48)}catch{}} docp.setTextColor(25,35,50); return docp; }
function addRows(docp, heads, rows, startY=120){ let y=startY; docp.setFontSize(9); docp.setFont("helvetica","bold"); docp.text(heads.join("   |   "),40,y); docp.setFont("helvetica","normal"); y+=18; rows.forEach(r=>{ if(y>740){docp.addPage(); y=50;} docp.text(r.map(x=>String(x).slice(0,28)).join("   |   "),40,y); y+=16; }); return y; }
function makePdf(id){ const rows=filteredServices(); const titles={pdfExecutive:"Dashboard Ejecutivo",pdfServices:"Reporte de Servicios",pdfDrivers:"Pagos y Retenciones a Choferes",pdfCash:"Flujo de Caja",pdfInvoices:"Facturación",pdfCobros:"Cobros",pdfRetenciones:"Retenciones",pdfDeducciones:"Deducciones",pdfFlujo:"Flujo de Caja"}; const docp=pdfDoc(titles[id]||"Reporte"); if(id.includes("Drivers")||id.includes("Retenciones")) addRows(docp,["Chofer","Bruto","Retención","Neto"],paymentRows(rows).map(r=>[r.nombre,money(r.bruto),money(r.ret),money(r.neto)])); else if(id.includes("Deducciones")) addRows(docp,["Proveedor","Deducción"],providerRows(rows).map(r=>[r.nombre,money(r.ded)])); else if(id.includes("Cash")||id.includes("Flujo")||id.includes("Executive")){ const fact=rows.reduce((a,s)=>a+serviceTotal(s),0), paid=rows.reduce((a,s)=>a+num(s.pagado),0), bal=rows.reduce((a,s)=>a+serviceBalance(s),0), gastos=rows.reduce((a,s)=>a+num(s.gastos)+num(s.peajes),0); addRows(docp,["Concepto","Total"],[["Servicios",rows.length],["Facturado",money(fact)],["Cobrado",money(paid)],["Por cobrar",money(bal)],["Gastos",money(gastos)],["Neto",money(fact-gastos)]]); } else addRows(docp,["Fecha","No.","Cliente","Ruta","Total","Pagado","Balance"],rows.map(s=>[s.fecha,s.numero,nameOf(state.clientes,s.clienteId),`${s.origen} > ${s.destino}`,money(serviceTotal(s)),money(s.pagado),money(serviceBalance(s))])); docp.save(`${titles[id]||"reporte"}.pdf`); }
function exportCsv(){ const rows=filteredServices(); const data=[["fecha","numero","cliente","origen","destino","chofer","total","pagado","balance","estado"],...rows.map(s=>[s.fecha,s.numero,nameOf(state.clientes,s.clienteId),s.origen,s.destino,nameOf(state.choferes,s.choferId),serviceTotal(s),s.pagado,serviceBalance(s),s.estado])]; download(new Blob([data.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n")],{type:"text/csv"}),"servicios.csv"); }
function exportJson(){ download(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),`nexus-transport-backup-${today()}.json`); }
function importJson(e){ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ state={...defaultState(),...JSON.parse(r.result)}; save(); alert("Backup importado."); }catch{ alert("JSON inválido."); } }; r.readAsText(f); }
function download(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }

function boot(){ srvFecha.value=today(); bindEvents(); renderAll(); setSync(firebaseReady?"Firebase listo":"Solo local"); pullCloud(); }
boot();
