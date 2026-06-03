import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = { apiKey:"AIzaSyDGoSNKi1wapE1SpHxTc8wNZGGkJ2nQj7s", authDomain:"nexus-transport-2887b.firebaseapp.com", projectId:"nexus-transport-2887b", storageBucket:"nexus-transport-2887b.firebasestorage.app", messagingSenderId:"972915419764", appId:"1:972915419764:web:7d61dfb03bbe56df867f21" };
const KEY = "nexus_transport_pr_v10_operational";
const $ = id => document.getElementById(id);
const uid = (p="id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const today = () => new Date().toISOString().slice(0,10);
const now = () => new Date().toISOString();
const n = v => Number(v) || 0;
const money = v => `$${n(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const esc = s => String(s ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const baseState = () => ({
  cfg:{name:"Nexus Transport PR", phone:"", email:"", mileRate:1.75, logo:""},
  clients:[], drivers:[], providers:[], vehicles:[], services:[], invoices:[], payments:[], cashflow:[], evidence:[], driverPayouts:[], retentionReleases:[]
});
let state = loadLocal();
let filters = {q:"", from:"", to:"", status:""};
let firebase = {ready:false, db:null, user:null, ref:null, unsub:null, pulling:false};
let saveTimer = null;

function loadLocal(){ try { return merge(baseState(), JSON.parse(localStorage.getItem(KEY)||"{}")); } catch { return baseState(); } }
function merge(a,b){ return {...a,...b,cfg:{...a.cfg,...(b?.cfg||{})}}; }
function saveLocal(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function setCloud(text, cls=""){ $("cloudStatus").textContent = text; $("cloudStatus").className = cls; }
async function saveCloud(){
  saveLocal();
  if(!firebase.ready || !firebase.ref || firebase.pulling) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async()=>{
    try{ await setDoc(firebase.ref,{state, updatedAt:serverTimestamp()}, {merge:true}); setCloud("Sincronizado", "ok"); }
    catch(e){ console.error(e); setCloud("Firebase bloqueado / modo local", "bad"); }
  }, 350);
}
async function forceSync(){
  if(!firebase.ready || !firebase.ref){ setCloud("Firebase no disponible / local", "bad"); return; }
  try{
    const snap = await getDoc(firebase.ref);
    if(snap.exists() && snap.data().state) state = merge(baseState(), snap.data().state);
    await setDoc(firebase.ref,{state, updatedAt:serverTimestamp()}, {merge:true});
    saveLocal(); render(); setCloud("Sincronizado ahora", "ok");
  }catch(e){ console.error(e); setCloud("No sincronizó: revisa reglas", "bad"); }
}
async function initFirebase(){
  try{
    const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app);
    setCloud("Autenticando..."); await signInAnonymously(auth);
    onAuthStateChanged(auth, async user => {
      if(!user) return;
      firebase.db=db; firebase.user=user; firebase.ref=doc(db,"users",user.uid,"apps","nexusTransportPR"); firebase.ready=true;
      setCloud("Firebase conectado", "ok");
      if(firebase.unsub) firebase.unsub();
      const snap = await getDoc(firebase.ref);
      if(snap.exists() && snap.data().state){ state = merge(baseState(), snap.data().state); saveLocal(); render(); }
      else await setDoc(firebase.ref,{state, createdAt:serverTimestamp(), updatedAt:serverTimestamp()}, {merge:true});
      firebase.unsub = onSnapshot(firebase.ref, s => {
        if(!s.exists() || !s.data().state) return;
        firebase.pulling = true;
        state = merge(baseState(), s.data().state); saveLocal(); render();
        firebase.pulling = false; setCloud("Sincronizado en vivo", "ok");
      }, err => { console.error(err); setCloud("Firebase bloqueado / reglas", "bad"); });
    });
  }catch(e){ console.error(e); setCloud("Firebase no disponible / local", "bad"); }
}

const get = (arr,id) => arr.find(x=>x.id===id);
const cname = id => get(state.clients,id)?.name || "—";
const dname = id => get(state.drivers,id)?.name || "—";
const pname = id => get(state.providers,id)?.name || "—";
const vname = id => get(state.vehicles,id)?.unit || "—";
const serviceTotal = s => n(s.base)+n(s.miles)*n(state.cfg.mileRate)+n(s.tolls);
const serviceBalance = s => Math.max(0, serviceTotal(s)-n(s.paid));
const invBalance = inv => Math.max(0, n(inv.total)-n(inv.paid));
const activeServices = () => state.services.filter(s=>s.status!=="Cancelado");
function filteredServices(){
  let rows = [...state.services];
  if(filters.from) rows = rows.filter(s=>s.date>=filters.from);
  if(filters.to) rows = rows.filter(s=>s.date<=filters.to);
  if(filters.status) rows = rows.filter(s=>s.status===filters.status);
  const q = filters.q.toLowerCase().trim();
  if(q) rows = rows.filter(s => [s.no,s.origin,s.dest,s.type,s.notes,s.status,cname(s.clientId),dname(s.driverId),pname(s.providerId)].join(" ").toLowerCase().includes(q));
  return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(b.no).localeCompare(String(a.no)));
}
function upsert(key,obj){ const i=state[key].findIndex(x=>x.id===obj.id); i>=0 ? state[key][i]=obj : state[key].push(obj); }
function remove(key,id){ if(confirm("¿Borrar registro?")){ state[key]=state[key].filter(x=>x.id!==id); saveCloud(); render(); } }
function nextNo(prefix, arr){ return `${prefix}-${String(arr.length+1).padStart(5,"0")}`; }
function statusPill(s){ const cls = s==="Cobrado"||s==="Pagada"?"ok":s==="Parcial"||s==="Facturado"?"warn":s==="Cancelado"?"bad":""; return `<span class="pill ${cls}">${esc(s)}</span>`; }
function table(el, heads, rows){ el.innerHTML=`<tr>${heads.map(h=>`<th>${h}</th>`).join("")}</tr>` + (rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${heads.length}"><div class="empty">Sin datos.</div></td></tr>`); }
function actions(key,id, extra=""){ return `<button class="mini" data-edit="${key}:${id}">Editar</button> ${extra} <button class="mini danger" data-del="${key}:${id}">Borrar</button>`; }
function mapUrl(s){ return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(s.origin||"")}&destination=${encodeURIComponent(s.dest||"")}`; }

function render(){ renderBrand(); renderSelects(); renderDashboard(); renderTables(); renderFinance(); renderRules(); }
function renderBrand(){ $("brandName").textContent=state.cfg.name || "Nexus Transport PR"; $("brandMark").innerHTML = state.cfg.logo ? `<img src="${state.cfg.logo}">` : (state.cfg.name||"NT").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase(); }
function options(arr,label){ return `<option value="">${label}</option>` + arr.filter(x=>x.status!=="Inactivo").map(x=>`<option value="${x.id}">${esc(x.name||x.unit)}</option>`).join(""); }
function renderSelects(){
  ["sClient"].forEach(id=>$(id).innerHTML=options(state.clients,"Seleccionar cliente"));
  ["sDriver","retDriver"].forEach(id=>$(id).innerHTML=options(state.drivers,"Seleccionar chofer"));
  $("sProvider").innerHTML=options(state.providers,"Sin proveedor"); $("sVehicle").innerHTML=options(state.vehicles,"Sin vehículo");
  const billable = state.services.filter(s=>s.status!=="Cancelado" && !state.invoices.some(i=>i.serviceId===s.id));
  $("invoiceService").innerHTML=options(billable.map(s=>({id:s.id,name:`${s.no} · ${cname(s.clientId)} · ${money(serviceTotal(s))}`})),"Seleccionar servicio");
  const openInv = state.invoices.filter(i=>invBalance(i)>0);
  $("payInvoice").innerHTML=options(openInv.map(i=>({id:i.id,name:`${i.no} · ${cname(i.clientId)} · balance ${money(invBalance(i))}`})),"Seleccionar factura");
  $("evService").innerHTML=options(state.services.map(s=>({id:s.id,name:`${s.no} · ${cname(s.clientId)}`})),"Seleccionar servicio");
}
function renderDashboard(){
  const rows=filteredServices(), invoices=state.invoices, payments=state.payments;
  const billed=invoices.reduce((a,i)=>a+n(i.total),0), paid=payments.reduce((a,p)=>a+n(p.amount),0), pending=invoices.reduce((a,i)=>a+invBalance(i),0);
  const driverDue = driverBalances().reduce((a,d)=>a+d.payable,0), retHeld=driverBalances().reduce((a,d)=>a+d.retentionHeld,0);
  $("dashPending").textContent=money(pending); $("dashCount").textContent=`${activeServices().length} servicios activos`;
  $("kpis").innerHTML = [["Facturado",money(billed),"facturas emitidas"],["Cobrado",money(paid),"ingreso real"],["Pagos choferes",money(driverDue),"balance a pagar"],["Retenciones",money(retHeld),"retenido pendiente"]].map(k=>`<div class="kpi"><span>${k[0]}</span><strong>${k[1]}</strong><small>${k[2]}</small></div>`).join("");
  table($("tblRecent"),["Fecha","Servicio","Cliente","Ruta","Estado","Total"],rows.slice(0,8).map(s=>[s.date,s.no,cname(s.clientId),`${esc(s.origin)} → ${esc(s.dest)}`,statusPill(s.status),money(serviceTotal(s))]));
  $("driverBalances").innerHTML = driverBalances().length ? driverBalances().map(d=>`<div class="listItem"><div><strong>${esc(d.name)}</strong><br><small>Retención: ${money(d.retentionHeld)}</small></div><div><strong>${money(d.payable)}</strong><br><button class="mini" data-paydriver="${d.id}">Pagar</button></div></div>`).join("") : `<div class="empty">Sin balances.</div>`;
}
function renderTables(){
  const rows=filteredServices();
  table($("tblServices"),["Fecha","No.","Cliente","Ruta","Chofer","Total","Pagado","Balance","Estado","Acción"],rows.map(s=>[s.date,s.no,cname(s.clientId),`${esc(s.origin)} → ${esc(s.dest)}`,dname(s.driverId),money(serviceTotal(s)),money(s.paid),money(serviceBalance(s)),statusPill(s.status),actions("services",s.id,`<button class="mini" data-invoice="${s.id}">Factura</button> <a class="mini" href="${mapUrl(s)}" target="_blank">Mapa</a>`)]));
  table($("tblClients"),["Cliente","Teléfono","Municipio","Balance","Acción"],state.clients.map(c=>[c.name,c.phone||"—",c.city||"—",money(clientBalance(c.id)),actions("clients",c.id)]));
  table($("tblDrivers"),["Chofer","%","Ret.","A pagar","Retenido","Acción"],state.drivers.map(d=>{ const b=driverBalance(d.id); return [d.name,`${n(d.pct)}%`,`${n(d.retention)}%`,money(b.payable),money(b.retentionHeld),actions("drivers",d.id,`<button class="mini" data-paydriver="${d.id}">Pagar chofer</button>`)] }));
  table($("tblProviders"),["Proveedor","% Deducción","Balance","Acción"],state.providers.map(p=>[p.name,`${n(p.pct)}%`,money(providerDeduction(p.id)),actions("providers",p.id)]));
  table($("tblVehicles"),["Unidad","Tablilla","VIN","Marbete","Estado","Acción"],state.vehicles.map(v=>[v.unit,v.plate||"—",v.vin||"—",v.exp||"—",statusPill(v.status),actions("vehicles",v.id)]));
  table($("tblRoutes"),["Servicio","Origen","Destino","Millas","Mapa"],state.services.map(s=>[s.no,s.origin||"—",s.dest||"—",n(s.miles),`<a class="mini" target="_blank" href="${mapUrl(s)}">Abrir Google Maps</a>`]));
  table($("tblEvidence"),["Fecha","Servicio","Descripción","Archivo"],state.evidence.map(e=>[e.date,get(state.services,e.serviceId)?.no||"—",e.desc||"—",e.fileName||"—"]));
}
function renderFinance(){
  table($("tblInvoices"),["Factura","Fecha","Cliente","Servicio","Total","Pagado","Balance","Estado","Acción"],state.invoices.map(i=>[i.no,i.date,cname(i.clientId),get(state.services,i.serviceId)?.no||"—",money(i.total),money(i.paid),money(invBalance(i)),statusPill(i.status),`<button class="mini" data-pdfinv="${i.id}">PDF</button>`]));
  table($("tblPayments"),["Fecha","Factura","Cliente","Método","Monto"],state.payments.map(p=>[p.date,get(state.invoices,p.invoiceId)?.no||"—",cname(p.clientId),p.method,money(p.amount)]));
  table($("tblRetentions"),["Chofer","Generada","Liberada/Pagada","Retenida pendiente"],driverBalances().map(d=>[d.name,money(d.retentionGenerated),money(d.retentionReleased),money(d.retentionHeld)]));
  table($("tblDeductions"),["Proveedor","Deducción generada","Servicios"],state.providers.map(p=>[p.name,money(providerDeduction(p.id)),state.services.filter(s=>s.providerId===p.id).length]));
  table($("tblCashflow"),["Fecha","Tipo","Categoría","Detalle","Método","Monto"],state.cashflow.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(x=>[x.date,x.type,x.category,x.detail||"—",x.method||"—",money(x.amount)]));
}
function renderRules(){ $("rulesBox").textContent = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /users/{userId}/{document=**} {\n      allow read, write: if request.auth != null && request.auth.uid == userId;\n    }\n    match /{document=**} { allow read, write: if false; }\n  }\n}`; }

function clientBalance(clientId){ return state.invoices.filter(i=>i.clientId===clientId).reduce((a,i)=>a+invBalance(i),0); }
function providerDeduction(providerId){ const p=get(state.providers,providerId); return state.payments.reduce((a,pay)=>{ const inv=get(state.invoices,pay.invoiceId); const s=inv?get(state.services,inv.serviceId):null; return s?.providerId===providerId ? a + n(pay.amount)*(n(p?.pct)/100) : a; },0); }
function driverBalance(driverId){ return driverBalances().find(x=>x.id===driverId) || {id:driverId,name:dname(driverId),gross:0,retentionGenerated:0,retentionReleased:0,retentionHeld:0,payouts:0,payable:0}; }
function driverBalances(){
  return state.drivers.map(d=>{
    let gross=0, retGen=0;
    state.payments.forEach(pay=>{ const inv=get(state.invoices,pay.invoiceId); const s=inv?get(state.services,inv.serviceId):null; if(s?.driverId===d.id){ const driverGross=n(pay.amount)*(n(d.pct)/100); gross += driverGross; retGen += driverGross*(n(d.retention)/100); }});
    const payouts=state.driverPayouts.filter(x=>x.driverId===d.id).reduce((a,x)=>a+n(x.amount),0);
    const released=state.retentionReleases.filter(x=>x.driverId===d.id).reduce((a,x)=>a+n(x.amount),0);
    const net=gross-retGen; return {id:d.id,name:d.name,gross,retentionGenerated:retGen,retentionReleased:released,retentionHeld:Math.max(0,retGen-released),payouts,payable:Math.max(0,net-payouts)};
  }).filter(x=>x.gross||x.retentionGenerated||x.payouts||x.retentionReleased);
}

function createInvoice(serviceId){
  const s=get(state.services,serviceId); if(!s) return alert("Servicio no encontrado");
  let inv=state.invoices.find(i=>i.serviceId===serviceId); if(inv){ alert("Este servicio ya tiene factura"); return; }
  inv={id:uid("inv"), no:nextNo("INV",state.invoices), date:today(), serviceId:s.id, clientId:s.clientId, total:serviceTotal(s), paid:0, status:"Pendiente", createdAt:now()};
  state.invoices.push(inv); s.status="Facturado"; upsert("services",s); saveCloud(); render(); alert(`Factura creada: ${inv.no}`);
}
function registerPayment(e){ e.preventDefault(); const inv=get(state.invoices,$("payInvoice").value); if(!inv) return alert("Selecciona una factura"); const amount=n($("payAmount").value); if(amount<=0) return alert("Monto inválido");
  const pay={id:uid("pay"), invoiceId:inv.id, clientId:inv.clientId, date:$("payDate").value||today(), method:$("payMethod").value, amount, createdAt:now()}; state.payments.push(pay);
  inv.paid=n(inv.paid)+amount; inv.status=invBalance(inv)<=0.01?"Pagada":"Parcial"; upsert("invoices",inv);
  const s=get(state.services,inv.serviceId); if(s){ s.paid=n(s.paid)+amount; s.status=serviceBalance(s)<=0.01?"Cobrado":"Parcial"; upsert("services",s); }
  state.cashflow.push({id:uid("cf"), date:pay.date, type:"Ingreso", category:"Cobro factura", detail:`${inv.no} · ${cname(inv.clientId)}`, method:pay.method, amount});
  e.target.reset(); $("payDate").value=today(); saveCloud(); render();
}
function payDriver(driverId){ const b=driverBalance(driverId); if(!b.payable) return alert("No hay balance neto a pagar."); const amount=n(prompt(`Balance neto de ${b.name}: ${money(b.payable)}\nMonto a pagar:`, b.payable.toFixed(2))); if(amount<=0) return;
  const x={id:uid("dp"), driverId, date:today(), amount:Math.min(amount,b.payable), createdAt:now()}; state.driverPayouts.push(x); state.cashflow.push({id:uid("cf"), date:x.date, type:"Gasto", category:"Pago chofer", detail:b.name, method:"Operacional", amount:x.amount}); saveCloud(); render(); }
function releaseRetention(e){ e.preventDefault(); const driverId=$("retDriver").value; if(!driverId) return alert("Selecciona chofer"); const b=driverBalance(driverId); const amount=n($("retAmount").value); if(amount<=0 || amount>b.retentionHeld) return alert("Monto inválido o mayor a retención disponible");
  const x={id:uid("rr"), driverId, date:$("retDate").value||today(), amount, createdAt:now()}; state.retentionReleases.push(x); state.cashflow.push({id:uid("cf"), date:x.date, type:"Gasto", category:"Pago retención", detail:b.name, method:"Operacional", amount}); e.target.reset(); $("retDate").value=today(); saveCloud(); render(); }

function bind(){
  document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$(b.dataset.view).classList.remove("hidden");render();});
  $("btnFilter").onclick=()=>{filters={q:$("q").value,from:$("from").value,to:$("to").value,status:$("status").value};render();}; $("btnClear").onclick=()=>{["q","from","to","status"].forEach(id=>$(id).value="");filters={q:"",from:"",to:"",status:""};render();};
  $("btnSync").onclick=forceSync; $("btnBackup").onclick=backup; $("fileImport").onchange=importBackup; $("btnDemo").onclick=seedDemo;
  $("formClient").onsubmit=e=>{e.preventDefault(); upsert("clients",{id:$("cId").value||uid("cli"),name:$("cName").value,phone:$("cPhone").value,email:$("cEmail").value,city:$("cCity").value,address:$("cAddress").value}); e.target.reset(); saveCloud(); render();};
  $("formDriver").onsubmit=e=>{e.preventDefault(); upsert("drivers",{id:$("dId").value||uid("drv"),name:$("dName").value,phone:$("dPhone").value,pct:n($("dPct").value),retention:n($("dRet").value),status:$("dStatus").value}); e.target.reset(); $("dPct").value=70; $("dRet").value=10; saveCloud(); render();};
  $("formProvider").onsubmit=e=>{e.preventDefault(); upsert("providers",{id:$("pId").value||uid("prov"),name:$("pName").value,pct:n($("pPct").value),phone:$("pPhone").value,status:$("pStatus").value}); e.target.reset(); $("pPct").value=10; saveCloud(); render();};
  $("formVehicle").onsubmit=e=>{e.preventDefault(); upsert("vehicles",{id:$("vId").value||uid("veh"),unit:$("vUnit").value,plate:$("vPlate").value,vin:$("vVin").value,exp:$("vExp").value,status:$("vStatus").value}); e.target.reset(); saveCloud(); render();};
  $("formService").onsubmit=e=>{e.preventDefault(); const id=$("sId").value||uid("srv"); const old=get(state.services,id)||{}; upsert("services",{...old,id,no:old.no||nextNo("SRV",state.services),date:$("sDate").value||today(),clientId:$("sClient").value,driverId:$("sDriver").value,providerId:$("sProvider").value,vehicleId:$("sVehicle").value,origin:$("sOrigin").value,dest:$("sDest").value,type:$("sType").value,base:n($("sBase").value),miles:n($("sMiles").value),tolls:n($("sTolls").value),expenses:n($("sExpenses").value),paid:n(old.paid),status:$("sStatus").value,notes:$("sNotes").value,updatedAt:now()}); e.target.reset(); $("sDate").value=today(); saveCloud(); render();};
  $("btnCreateInvoice").onclick=()=>createInvoice($("invoiceService").value); $("btnServiceInvoice").onclick=()=>$("sId").value?createInvoice($("sId").value):alert("Guarda o edita un servicio primero."); $("formPayment").onsubmit=registerPayment; $("formRetentionPay").onsubmit=releaseRetention;
  $("formEvidence").onsubmit=e=>{e.preventDefault(); const file=$("evFile").files[0]; state.evidence.push({id:uid("ev"),date:today(),serviceId:$("evService").value,desc:$("evDesc").value,fileName:file?.name||""}); e.target.reset(); saveCloud(); render();};
  $("formConfig").onsubmit=e=>{e.preventDefault(); state.cfg.name=$("cfgName").value||state.cfg.name; state.cfg.phone=$("cfgPhone").value; state.cfg.email=$("cfgEmail").value; state.cfg.mileRate=n($("cfgMile").value)||state.cfg.mileRate; saveCloud(); render();};
  $("cfgLogo").onchange=e=>{const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{state.cfg.logo=r.result; saveCloud(); render();}; r.readAsDataURL(f);};
  document.body.addEventListener("click", e=>{ const t=e.target; if(t.dataset.del){const [k,id]=t.dataset.del.split(":"); remove(k,id)} if(t.dataset.invoice) createInvoice(t.dataset.invoice); if(t.dataset.paydriver) payDriver(t.dataset.paydriver); if(t.dataset.pdfinv) pdfInvoice(t.dataset.pdfinv); if(t.dataset.edit){ editRecord(...t.dataset.edit.split(":")); }});
  $("pdfExecutive").onclick=pdfExecutive; $("pdfDrivers").onclick=pdfDrivers; $("pdfInvoices").onclick=pdfInvoices; $("payDate").value=today(); $("retDate").value=today(); $("sDate").value=today();
}
function editRecord(key,id){ const x=get(state[key],id); if(!x) return; const map={clients:["cId",id,"cName",x.name,"cPhone",x.phone,"cEmail",x.email,"cCity",x.city,"cAddress",x.address,"clientes"],drivers:["dId",id,"dName",x.name,"dPhone",x.phone,"dPct",x.pct,"dRet",x.retention,"dStatus",x.status,"choferes"],providers:["pId",id,"pName",x.name,"pPct",x.pct,"pPhone",x.phone,"pStatus",x.status,"proveedores"],vehicles:["vId",id,"vUnit",x.unit,"vPlate",x.plate,"vVin",x.vin,"vExp",x.exp,"vStatus",x.status,"flota"]}; if(key==="services"){ ["sId",id,"sDate",x.date,"sClient",x.clientId,"sDriver",x.driverId,"sProvider",x.providerId,"sVehicle",x.vehicleId,"sOrigin",x.origin,"sDest",x.dest,"sType",x.type,"sBase",x.base,"sMiles",x.miles,"sTolls",x.tolls,"sExpenses",x.expenses,"sStatus",x.status,"sNotes",x.notes].forEach((v,i,a)=>{if(i%2===0)$(v).value=a[i+1]||""}); openView("servicios"); return; } const arr=map[key]; if(arr){ for(let i=0;i<arr.length-1;i+=2)$(arr[i]).value=arr[i+1]||""; openView(arr[arr.length-1]); } }
function openView(id){ document.querySelector(`#tabs button[data-view="${id}"]`)?.click(); }
function backup(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`nexus-transport-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href); }
function importBackup(e){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{try{state=merge(baseState(),JSON.parse(r.result)); saveCloud(); render(); alert("Backup importado");}catch{alert("Archivo inválido")}}; r.readAsText(f); }
function seedDemo(){ if(state.clients.length && !confirm("Añadir datos demo sobre lo existente?")) return; const c={id:uid("cli"),name:"Cliente Demo",phone:"787-000-0000",city:"San Juan"}, d={id:uid("drv"),name:"Chofer Demo",pct:70,retention:10,status:"Activo"}, p={id:uid("prov"),name:"Proveedor Demo",pct:10,status:"Activo"}, v={id:uid("veh"),unit:"Unidad 01",plate:"ABC-123",status:"Activo"}; state.clients.push(c); state.drivers.push(d); state.providers.push(p); state.vehicles.push(v); state.services.push({id:uid("srv"),no:nextNo("SRV",state.services),date:today(),clientId:c.id,driverId:d.id,providerId:p.id,vehicleId:v.id,origin:"San Juan",dest:"Ponce",type:"Grua",base:250,miles:75,tolls:12,expenses:35,paid:0,status:"Pendiente",notes:"Servicio demo"}); saveCloud(); render(); }
function pdf(title, rows){ const {jsPDF}=window.jspdf; const docp=new jsPDF(); docp.setFont("helvetica","bold"); docp.setFontSize(18); docp.text(title,14,18); docp.setFont("helvetica","normal"); docp.setFontSize(10); let y=30; rows.forEach(r=>{ if(y>280){docp.addPage(); y=18;} docp.text(String(r),14,y); y+=7; }); docp.save(`${title.replaceAll(" ","_")}_${today()}.pdf`); }
function pdfExecutive(){ pdf("Reporte Ejecutivo Nexus Transport", [`Facturado: ${money(state.invoices.reduce((a,i)=>a+n(i.total),0))}`,`Cobrado: ${money(state.payments.reduce((a,p)=>a+n(p.amount),0))}`,`Pendiente: ${money(state.invoices.reduce((a,i)=>a+invBalance(i),0))}`,`Servicios: ${state.services.length}`,`Choferes: ${state.drivers.length}`]); }
function pdfDrivers(){ pdf("Reporte Choferes", driverBalances().map(d=>`${d.name} | A pagar ${money(d.payable)} | Retenido ${money(d.retentionHeld)} | Bruto ${money(d.gross)}`)); }
function pdfInvoices(){ pdf("Reporte Facturacion", state.invoices.map(i=>`${i.no} | ${cname(i.clientId)} | Total ${money(i.total)} | Pagado ${money(i.paid)} | Balance ${money(invBalance(i))}`)); }
function pdfInvoice(id){ const i=get(state.invoices,id); if(!i)return; pdf(`Factura ${i.no}`,[state.cfg.name,`Cliente: ${cname(i.clientId)}`,`Fecha: ${i.date}`,`Servicio: ${get(state.services,i.serviceId)?.no||""}`,`Total: ${money(i.total)}`,`Pagado: ${money(i.paid)}`,`Balance: ${money(invBalance(i))}`]); }

bind(); render(); initFirebase();
