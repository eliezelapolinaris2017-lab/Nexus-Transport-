/*************************************************
 SAMMY TOWING INC — Nexus Transport Manager v14.1
 app.js — PRO con Filtros Globales (Fecha + Buscar),
 Retenciones / Deducciones / Pagos + PDFs
*************************************************/

/* =======================
   BASE LOCAL
======================= */
const store = {
  proveedores: JSON.parse(localStorage.getItem("proveedores") || "[]"),
  choferes: JSON.parse(localStorage.getItem("choferes") || "[]"),
  millas: JSON.parse(localStorage.getItem("millas") || "[]"),
  pagos: JSON.parse(localStorage.getItem("pagos") || "[]"),
  retenciones: JSON.parse(localStorage.getItem("retenciones") || "[]"),
  deducciones: JSON.parse(localStorage.getItem("deducciones") || "{}"), // objeto {proveedor:{total}}
  config: JSON.parse(localStorage.getItem("config") || "{}")
};

function save(k){ localStorage.setItem(k, JSON.stringify(store[k])); }
function saveAll(){ for(const k in store) save(k); }

// ===== CONFIG DEFAULT =====
store.config.valorMilla ??= 1;
store.config.umbralAlto ??= 1000;
store.config.umbralMedio ??= 400;
store.config.nombre ??= "SAMMY TOWING INC";

/* =======================
   FILTROS GLOBALES
   (aplican a dataset base de millas)
======================= */
const FILTER_KEY = "sammy.filters.v1";

let filters = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}");
filters.desde ??= "";
filters.hasta ??= "";
filters.buscar ??= "";

const fDesde   = document.getElementById("fDesde");
const fHasta   = document.getElementById("fHasta");
const fBuscar  = document.getElementById("fBuscar");
const fAplicar = document.getElementById("fAplicar");
const fLimpiar = document.getElementById("fLimpiar");

function saveFilters(){ localStorage.setItem(FILTER_KEY, JSON.stringify(filters)); }
function loadFiltersToUI(){
  if(fDesde)  fDesde.value  = filters.desde || "";
  if(fHasta)  fHasta.value  = filters.hasta || "";
  if(fBuscar) fBuscar.value = filters.buscar || "";
}

function normDate(s){ return s ? String(s).replaceAll("-","") : ""; }

function matchesGlobalFilters(row){
  const d = normDate(row.fecha || "");
  const desde = normDate(filters.desde || "");
  const hasta = normDate(filters.hasta || "");

  if(desde && (!d || d < desde)) return false;
  if(hasta && (!d || d > hasta)) return false;

  const q = (filters.buscar || "").trim().toLowerCase();
  if(q){
    const a = (row.chofer || "").toLowerCase();
    const b = (row.proveedor || "").toLowerCase();
    if(!a.includes(q) && !b.includes(q)) return false;
  }
  return true;
}

function getFilteredMiles(){
  return store.millas.filter(matchesGlobalFilters);
}

function refreshAllFilteredViews(){
  renderMillas();
  renderCierre();
  renderRetenciones();
  renderDeducciones();
  renderPagos();
  renderFlujo();
}

if(fAplicar){
  fAplicar.onclick = ()=>{
    filters.desde  = fDesde?.value  || "";
    filters.hasta  = fHasta?.value  || "";
    filters.buscar = fBuscar?.value || "";
    saveFilters();
    refreshAllFilteredViews();
  };
}
if(fLimpiar){
  fLimpiar.onclick = ()=>{
    filters = {desde:"", hasta:"", buscar:""};
    saveFilters();
    loadFiltersToUI();
    refreshAllFilteredViews();
  };
}

/* =======================
   NAVEGACIÓN
======================= */
document.querySelectorAll(".tabs button").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
    switch(btn.dataset.tab){
      case "millas": renderMillas(); break;
      case "cierres": renderCierre(); break;
      case "flujo": renderFlujo(); break;
      case "retenciones": renderRetenciones(); break;
      case "deducciones": renderDeducciones(); break;
      case "pagos": renderPagos(); break;
    }
  };
});

/* =======================
   PROVEEDORES
======================= */
formProveedor.onsubmit=e=>{
  e.preventDefault();
  store.proveedores.push({nombre:provNombre.value.trim(),porc:+provPorc.value});
  provNombre.value=provPorc.value="";
  save("proveedores"); renderProveedores(); actualizarSelects();
};

function renderProveedores(){
  tablaProveedores.innerHTML="<tr><th>Proveedor</th><th>% Deducción</th><th></th></tr>";
  store.proveedores.forEach((p,i)=>{
    tablaProveedores.innerHTML+=`
      <tr><td>${p.nombre}</td><td>${p.porc}%</td>
      <td><button onclick='delProv(${i})'>🗑️</button></td></tr>`;
  });
}
function delProv(i){
  store.proveedores.splice(i,1);
  save("proveedores");
  renderProveedores();
  actualizarSelects();
}

/* =======================
   CHOFERES
======================= */
formChofer.onsubmit=e=>{
  e.preventDefault();
  store.choferes.push({
    nombre:chNombre.value.trim(),
    ganancia:+chGanancia.value,
    deduccion:+chDeduccion.value
  });
  chNombre.value=chGanancia.value=chDeduccion.value="";
  save("choferes"); renderChoferes(); actualizarSelects();
};

function renderChoferes(){
  tablaChoferes.innerHTML="<tr><th>Chofer</th><th>% Ganancia</th><th>% Deducción</th><th></th></tr>";
  store.choferes.forEach((c,i)=>{
    tablaChoferes.innerHTML+=`
      <tr><td>${c.nombre}</td><td>${c.ganancia}%</td><td>${c.deduccion}%</td>
      <td><button onclick='delCh(${i})'>🗑️</button></td></tr>`;
  });
}
function delCh(i){
  store.choferes.splice(i,1);
  save("choferes");
  renderChoferes();
  actualizarSelects();
}

/* =======================
   SELECTS (millas)
======================= */
function actualizarSelects(){
  const chSel=mChofer, prSel=mProveedor, fch=filtroChofer, fpr=filtroProveedor;

  chSel.innerHTML = "<option value=''>Seleccionar Chofer</option>";
  prSel.innerHTML = "<option value=''>Seleccionar Proveedor</option>";
  fch.innerHTML   = "<option value=''>Filtrar por Chofer</option>";
  fpr.innerHTML   = "<option value=''>Filtrar por Proveedor</option>";

  store.choferes.forEach(c=>{
    chSel.innerHTML+=`<option>${c.nombre}</option>`;
    fch.innerHTML+=`<option>${c.nombre}</option>`;
  });
  store.proveedores.forEach(p=>{
    prSel.innerHTML+=`<option>${p.nombre}</option>`;
    fpr.innerHTML+=`<option>${p.nombre}</option>`;
  });
}

renderProveedores();
renderChoferes();
actualizarSelects();

/* =======================
   MILLAS
======================= */
function defaultTodayISO(){
  return new Date().toISOString().slice(0,10);
}

// input nuevo del index: mFecha
window.mFecha = document.getElementById("mFecha");

formMillas.onsubmit=e=>{
  e.preventDefault();

  const fecha = (mFecha && mFecha.value) ? mFecha.value : defaultTodayISO();

  store.millas.push({
    fecha,
    chofer: mChofer.value,
    proveedor: mProveedor.value,
    millas: +mMillas.value
  });

  if(mFecha) mFecha.value = defaultTodayISO();
  mChofer.value=mProveedor.value=mMillas.value="";
  save("millas");
  renderMillas();
};

function renderMillas(){
  const fc=filtroChofer.value, fp=filtroProveedor.value;

  // base filtrada globalmente
  let base = getFilteredMiles();

  // + filtros internos
  let data = base.filter(m=>(!fc||m.chofer===fc)&&(!fp||m.proveedor===fp));

  tablaMillas.innerHTML="<tr><th>Fecha</th><th>Chofer</th><th>Proveedor</th><th>Millas</th><th></th></tr>";

  data.forEach((m,i)=>tablaMillas.innerHTML+=
    `<tr><td>${m.fecha || ""}</td><td>${m.chofer}</td><td>${m.proveedor}</td><td>${m.millas}</td>
     <td><button onclick='delM(${getIndexInStore(m)})'>🗑️</button></td></tr>`);

  const total=data.reduce((a,b)=>a+b.millas,0),
        servicios=data.length,
        valor=total*(store.config.valorMilla||1);

  kpiMillas.querySelector("p").textContent=total.toFixed(0);
  kpiServicios.querySelector("p").textContent=servicios;
  kpiValor.querySelector("p").textContent=`$${valor.toFixed(2)}`;

  const {umbralAlto,umbralMedio}=store.config;
  let c="red"; if(valor>=umbralAlto)c="lime"; else if(valor>=umbralMedio)c="gold";
  kpiValor.style.boxShadow=`0 0 25px ${c}`;
  kpiValor.style.color=c;
}

function getIndexInStore(row){
  // encuentra el index real del objeto en store.millas
  return store.millas.findIndex(x =>
    x.fecha===row.fecha &&
    x.chofer===row.chofer &&
    x.proveedor===row.proveedor &&
    x.millas===row.millas
  );
}

filtroChofer.onchange=filtroProveedor.onchange=renderMillas;
btnMostrarTodo.onclick=()=>{
  filtroChofer.value="";
  filtroProveedor.value="";
  renderMillas();
};

function delM(idx){
  if(idx<0) return;
  store.millas.splice(idx,1);
  save("millas");
  renderMillas();
}

/* =======================
   CIERRE SEMANAL
   (usa dataset filtrado global)
======================= */
function calcularCierre(){
  const vm=store.config.valorMilla||1;
  const res={};

  getFilteredMiles().forEach(m=>{
    const ch=store.choferes.find(c=>c.nombre===m.chofer);
    if(!ch) return;

    const b=m.millas*vm;
    const g=b*(ch.ganancia/100);
    const d=b*(ch.deduccion/100);

    if(!res[m.chofer]) res[m.chofer]={millas:0,bruto:0,gan:0,ded:0};
    res[m.chofer].millas+=m.millas;
    res[m.chofer].bruto+=b;
    res[m.chofer].gan+=g;
    res[m.chofer].ded+=d;
  });

  return res;
}

function renderCierre(){
  const d=calcularCierre();
  let h="<table><tr><th>Chofer</th><th>Millas</th><th>Bruto</th><th>Ganancia</th><th>Deducción</th><th>Neto</th></tr>";
  for(const c in d){
    const r=d[c];
    const n=r.gan-r.ded;
    h+=`<tr><td>${c}</td><td>${r.millas}</td><td>$${r.bruto.toFixed(2)}</td>
         <td>$${r.gan.toFixed(2)}</td><td>$${r.ded.toFixed(2)}</td><td>$${n.toFixed(2)}</td></tr>`;
  }
  document.getElementById("tablaCierres").innerHTML=h+"</table>";
}

/* =======================
   RETENCIONES 10%
======================= */
function renderRetenciones(){
  const data = calcularCierre();
  let h = "<table><tr><th>Chofer</th><th>Retención 10%</th><th>Estado</th><th></th></tr>";
  for(const c in data){
    const r = data[c];
    const ret = r.gan * 0.10;
    const registro = store.retenciones.find(x=>x.chofer===c) || {estado:"Pendiente"};
    h += `<tr>
      <td>${c}</td>
      <td>$${ret.toFixed(2)}</td>
      <td>${registro.estado}</td>
      <td><button onclick="toggleRetencion('${c}')">✔️ Cambiar</button></td>
    </tr>`;
  }
  document.getElementById("tablaRetenciones").innerHTML = h + "</table>";
  save("retenciones");
}

function toggleRetencion(chofer){
  const r = store.retenciones.find(x=>x.chofer===chofer);
  if(r){
    r.estado = r.estado === "Pendiente" ? "Enviada" : "Pendiente";
  }else{
    store.retenciones.push({chofer, estado:"Enviada"});
  }
  save("retenciones");
  renderRetenciones();
}

/* ===== PDF RETENCIONES (según filtro) ===== */
pdfRetenciones.onclick=()=>{
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF();
  const empresa=store.config.nombre||"SAMMY TOWING INC";
  const fecha=new Date().toLocaleDateString();
  const data=calcularCierre();

  if(store.config.logo) doc.addImage(store.config.logo,"PNG",150,8,35,20);
  doc.setFontSize(16); doc.setTextColor(255,0,0);
  doc.text(empresa,10,15);
  doc.setDrawColor(200,0,0); doc.line(10,18,200,18);
  doc.setFontSize(11); doc.setTextColor(0);
  doc.text("Reporte de Retenciones 10%",10,26);
  doc.text(`Fecha reporte: ${fecha}`,10,33);
  doc.text(`Filtro: ${filters.desde||"—"} a ${filters.hasta||"—"} | Buscar: ${(filters.buscar||"—")}`,10,40);

  let y=52, total=0;
  for(const c in data){
    const r=data[c];
    const ret=r.gan*0.10; total+=ret;
    const estado=(store.retenciones.find(x=>x.chofer===c)||{estado:"Pendiente"}).estado;
    doc.text(`${c}  $${ret.toFixed(2)}   Estado: ${estado}`,10,y);
    y+=7;
    if(y>270){ doc.addPage(); y=20; }
  }
  y+=6; doc.setDrawColor(200,0,0); doc.line(10,y,200,y);
  y+=8; doc.setTextColor(255,0,0); doc.text(`Total Retenciones: $${total.toFixed(2)}`,10,y);
  doc.save(`Retenciones_${fecha}.pdf`);
};

/* =======================
   DEDUCCIONES A PROVEEDORES
   (usa dataset filtrado global)
======================= */
function renderDeducciones(){
  const vm=store.config.valorMilla||1;
  const data={};

  getFilteredMiles().forEach(m=>{
    const p=store.proveedores.find(x=>x.nombre===m.proveedor);
    if(!p) return;

    const ded=(m.millas*vm)*(p.porc/100);
    if(!data[m.proveedor]) data[m.proveedor]={total:0};
    data[m.proveedor].total+=ded;
  });

  let h="<table><tr><th>Proveedor</th><th>Deducción Total</th></tr>";
  for(const p in data){
    h+=`<tr><td>${p}</td><td>$${data[p].total.toFixed(2)}</td></tr>`;
  }
  document.getElementById("tablaDeducciones").innerHTML=h+"</table>";

  store.deducciones=data;
  save("deducciones");
}

/* ===== PDF DEDUCCIONES (según filtro) ===== */
pdfDeducciones.onclick=()=>{
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF();
  const empresa=store.config.nombre||"SAMMY TOWING INC";
  const fecha=new Date().toLocaleDateString();

  const data = store.deducciones || {};

  if(store.config.logo) doc.addImage(store.config.logo,"PNG",150,8,35,20);
  doc.setFontSize(16); doc.setTextColor(255,0,0);
  doc.text(empresa,10,15);
  doc.setDrawColor(200,0,0); doc.line(10,18,200,18);
  doc.setFontSize(11); doc.setTextColor(0);
  doc.text("Reporte de Deducciones a Proveedores",10,26);
  doc.text(`Fecha reporte: ${fecha}`,10,33);
  doc.text(`Filtro: ${filters.desde||"—"} a ${filters.hasta||"—"} | Buscar: ${(filters.buscar||"—")}`,10,40);

  let y=52,total=0;
  for(const p in data){
    const v=data[p].total; total+=v;
    doc.text(`${p}  $${v.toFixed(2)}`,10,y);
    y+=7;
    if(y>270){ doc.addPage(); y=20; }
  }
  y+=6; doc.setTextColor(255,0,0);
  doc.text(`Total Deducciones: $${total.toFixed(2)}`,10,y);
  doc.save(`Deducciones_${fecha}.pdf`);
};

/* =======================
   PAGOS A CHOFERES
   (usa cierre filtrado)
======================= */
function renderPagos(){
  const cierres=calcularCierre();
  let h="<table><tr><th>Chofer</th><th>Ganancia</th><th>Pagado</th><th>Pendiente</th><th>Estado</th><th></th></tr>";

  for(const c in cierres){
    const g=cierres[c].gan;
    const reg=store.pagos.find(x=>x.chofer===c)||{pagado:0};
    const pendiente=g-reg.pagado;

    let estado="Pendiente";
    if(pendiente<=0)estado="Pagado";
    else if(pendiente<g)estado="Parcial";

    h+=`<tr>
      <td>${c}</td>
      <td>$${g.toFixed(2)}</td>
      <td>$${reg.pagado.toFixed(2)}</td>
      <td>$${pendiente.toFixed(2)}</td>
      <td>${estado}</td>
      <td><button onclick="registrarPago('${c}',${g})">💵 Pago</button></td>
    </tr>`;
  }

  document.getElementById("tablaPagos").innerHTML=h+"</table>";
  save("pagos");
}

function registrarPago(chofer,g){
  const monto=parseFloat(prompt(`Ingrese monto pagado a ${chofer}:`,0))||0;
  if(!monto) return;

  let reg=store.pagos.find(x=>x.chofer===chofer);
  if(!reg){ reg={chofer,pagado:0}; store.pagos.push(reg); }

  reg.pagado+=monto;
  if(reg.pagado>g) reg.pagado=g;

  save("pagos");
  renderPagos();
}

/* ===== PDF PAGOS (según filtro) ===== */
pdfPagos.onclick=()=>{
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:"landscape"});
  const empresa=store.config.nombre||"SAMMY TOWING INC";
  const fecha=new Date().toLocaleDateString();
  const cierres=calcularCierre();

  if(store.config.logo) doc.addImage(store.config.logo,"PNG",250,8,35,25);
  doc.setFontSize(18); doc.setTextColor(255,0,0);
  doc.text(empresa,10,18);
  doc.setDrawColor(200,0,0); doc.line(10,21,280,21);
  doc.setFontSize(11); doc.setTextColor(0);
  doc.text("Reporte de Pagos a Choferes",10,29);
  doc.text(`Fecha reporte: ${fecha}`,10,36);
  doc.text(`Filtro: ${filters.desde||"—"} a ${filters.hasta||"—"} | Buscar: ${(filters.buscar||"—")}`,10,43);

  let y=60;
  doc.text("Chofer",10,y); doc.text("Ganancia",70,y);
  doc.text("Pagado",110,y); doc.text("Pendiente",150,y);
  doc.text("Estado",190,y); y+=8;

  for(const c in cierres){
    const g=cierres[c].gan;
    const reg=store.pagos.find(x=>x.chofer===c)||{pagado:0};
    const pendiente=g-reg.pagado;

    let estado="Pendiente";
    if(pendiente<=0)estado="Pagado";
    else if(pendiente<g)estado="Parcial";

    doc.text(c,10,y);
    doc.text(`$${g.toFixed(2)}`,70,y);
    doc.text(`$${reg.pagado.toFixed(2)}`,110,y);
    doc.text(`$${pendiente.toFixed(2)}`,150,y);
    doc.text(estado,190,y);
    y+=7;
    if(y>190){ doc.addPage(); y=20; }
  }
  doc.save(`Pagos_${fecha}.pdf`);
};

/* =======================
   FLUJO DE CAJA
======================= */
function renderFlujo(){
  const d=calcularCierre();
  let tb=0,tg=0,td=0;
  for(const c in d){ tb+=d[c].bruto; tg+=d[c].gan; td+=d[c].ded; }
  const tn=tg-td;

  document.getElementById("tablaFlujo").innerHTML=`
    <div class='kpi'>
      <div class='kpiCard'><h3>Bruto</h3><p>$${tb.toFixed(2)}</p></div>
      <div class='kpiCard'><h3>Ganancia</h3><p>$${tg.toFixed(2)}</p></div>
      <div class='kpiCard'><h3>Deducción</h3><p>$${td.toFixed(2)}</p></div>
      <div class='kpiCard'><h3>Neto</h3><p>$${tn.toFixed(2)}</p></div>
    </div>
    <button id="pdfFlujo" type="button">Exportar Flujo PDF</button>`;

  document.getElementById("pdfFlujo").onclick=()=>exportarFlujoPDF(tb,tg,td,tn);
}

function exportarFlujoPDF(tb,tg,td,tn){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF();
  const empresa=store.config.nombre||"SAMMY TOWING INC";
  const fecha=new Date().toLocaleDateString();

  if(store.config.logo) doc.addImage(store.config.logo,"PNG",150,8,35,20);
  doc.setFontSize(16);doc.setTextColor(255,0,0);
  doc.text(empresa,10,15);doc.setDrawColor(200,0,0);
  doc.line(10,18,200,18);
  doc.setFontSize(11);doc.setTextColor(0);
  doc.text("Reporte de Flujo de Caja",10,26);
  doc.text(`Fecha reporte: ${fecha}`,10,33);
  doc.text(`Filtro: ${filters.desde||"—"} a ${filters.hasta||"—"} | Buscar: ${(filters.buscar||"—")}`,10,40);

  doc.setFontSize(12);
  doc.text(`Ingresos Brutos: $${tb.toFixed(2)}`,10,58);
  doc.text(`Ganancias Totales: $${tg.toFixed(2)}`,10,66);
  doc.text(`Deducciones Totales: $${td.toFixed(2)}`,10,74);
  doc.text(`Balance Neto Final: $${tn.toFixed(2)}`,10,82);

  doc.setDrawColor(180,0,0);doc.line(10,120,200,120);
  doc.setFontSize(9);doc.setTextColor(120);
  doc.text("Generado con Nexus Transport Manager v14.1 — SAMMY TOWING INC",10,126);
  doc.save(`Flujo_Caja_${fecha}.pdf`);
}

/* =======================
   CONFIGURACIÓN + LOGO HEADER
======================= */
function renderLogoPreview(){
  if(store.config.logo){
    let img=document.getElementById("logoPreview");
    if(!img){
      img=document.createElement("img");
      img.id="logoPreview";
      img.style="width:120px;margin-top:10px;border-radius:6px;display:block;";
    }
    img.src=store.config.logo;
    logoInput.insertAdjacentElement("afterend",img);
  }
}

function renderHeaderLogo(){
  const box = document.querySelector(".logo");
  if(!box) return;
  if(store.config.logo){
    box.innerHTML = `<img src="${store.config.logo}">`;
  }else{
    box.textContent = "ST";
  }
}

saveConfig.onclick=()=>{
  store.config.pin=pinInput.value;
  store.config.valorMilla=parseFloat(valorMillaInput.value)||1;
  store.config.umbralAlto=parseFloat(umbralAlto.value)||1000;
  store.config.umbralMedio=parseFloat(umbralMedio.value)||400;

  const f=logoInput.files[0];
  if(f){
    const r=new FileReader();
    r.onload=e=>{
      store.config.logo=e.target.result;
      saveAll();
      renderLogoPreview();
      renderHeaderLogo();
      alert("Configuración guardada ✅");
    };
    r.readAsDataURL(f);
  } else {
    saveAll();
    renderHeaderLogo();
    alert("Configuración guardada ✅");
  }
};

/* =======================
   BACKUP + IMPORT
======================= */
backupAll.onclick=()=>{
  const b=new Blob([JSON.stringify(store,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);
  a.download="backup_sammy_towing.json";
  a.click();
};

const imp=document.createElement("button");
imp.textContent="Importar Backup";
config.appendChild(imp);
imp.onclick=()=>{
  const i=document.createElement("input");
  i.type="file"; i.accept=".json";
  i.onchange=e=>{
    const r=new FileReader();
    r.onload=x=>{
      Object.assign(store, JSON.parse(x.target.result));
      saveAll();
      alert("Backup restaurado ✅");
      location.reload();
    };
    r.readAsText(e.target.files[0]);
  };
  i.click();
};

/* =======================
   SEGURIDAD
======================= */
logoutBtn.onclick=()=>{
  const p=prompt("PIN de seguridad:");
  if(p===store.config.pin){
    alert("Sesión cerrada ✅");
    location.reload();
  } else {
    alert("PIN incorrecto ❌");
  }
};

/* =======================
   INIT
======================= */
window.addEventListener("load",()=>{
  loadFiltersToUI();

  // default fecha hoy en formulario millas
  if(mFecha) mFecha.value = defaultTodayISO();

  renderLogoPreview();
  renderHeaderLogo();

  if(store.config.pin) pinInput.value=store.config.pin;
  if(store.config.valorMilla) valorMillaInput.value=store.config.valorMilla;
  if(store.config.umbralAlto) umbralAlto.value=store.config.umbralAlto;
  if(store.config.umbralMedio) umbralMedio.value=store.config.umbralMedio;

  // primera carga
  renderMillas();
  renderCierre();
  renderDeducciones();
  renderRetenciones();
  renderPagos();
  renderFlujo();
});

console.log("✅ SAMMY TOWING INC v14.1 cargado correctamente.");
