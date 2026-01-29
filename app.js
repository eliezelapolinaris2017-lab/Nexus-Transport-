/*************************************************
 * SAMMY TOWING INC — Nexus Transport Manager v12
 * app.js [1/3]
 * Funciones principales, gestión base y navegación
 *************************************************/

// ===== BASE LOCAL =====
const store = {
  proveedores: JSON.parse(localStorage.getItem("proveedores")||"[]"),
  choferes: JSON.parse(localStorage.getItem("choferes")||"[]"),
  millas: JSON.parse(localStorage.getItem("millas")||"[]"),
  config: JSON.parse(localStorage.getItem("config")||"{}")
};

// ===== CONFIGURACIÓN INICIAL =====
if (!store.config.valorMilla) store.config.valorMilla = 1.00;
if (!store.config.nombre) store.config.nombre = "SAMMY TOWING INC";
if (!store.config.umbralAlto) store.config.umbralAlto = 1000;
if (!store.config.umbralMedio) store.config.umbralMedio = 400;

// ===== GUARDAR =====
function saveAll(){
  for(const k in store)
    localStorage.setItem(k, JSON.stringify(store[k]));
}

// ===== NAVEGACIÓN =====
document.querySelectorAll(".tabs button").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");

    if(btn.dataset.tab==="cierres") renderCierre();
    if(btn.dataset.tab==="flujo") renderFlujo();
  };
});

// ===== PROVEEDORES =====
const formProv=document.getElementById("formProveedor"),
      tablaProv=document.getElementById("tablaProveedores");

formProv.onsubmit=e=>{
  e.preventDefault();
  store.proveedores.push({nombre:provNombre.value,porc:+provPorc.value});
  provNombre.value=provPorc.value="";
  saveAll();renderProveedores();
};

function renderProveedores(){
  tablaProv.innerHTML="<tr><th>Nombre</th><th>Deducción</th><th></th></tr>";
  store.proveedores.forEach((p,i)=>{
    tablaProv.innerHTML+=`
      <tr>
        <td>${p.nombre}</td>
        <td>${p.porc}%</td>
        <td><button onclick="delProv(${i})">🗑️</button></td>
      </tr>`;
  });
  actualizarSelectProveedores();
}
function delProv(i){ store.proveedores.splice(i,1); saveAll(); renderProveedores(); }
renderProveedores();

// ===== CHOFERES =====
const formCh=document.getElementById("formChofer"),
      tablaCh=document.getElementById("tablaChoferes");

formCh.onsubmit=e=>{
  e.preventDefault();
  store.choferes.push({nombre:chNombre.value,ganancia:+chGanancia.value,deduccion:+chDeduccion.value});
  chNombre.value=chGanancia.value=chDeduccion.value="";
  saveAll();renderChoferes();
};

function renderChoferes(){
  tablaCh.innerHTML="<tr><th>Nombre</th><th>Ganancia</th><th>Deducción</th><th></th></tr>";
  store.choferes.forEach((c,i)=>{
    tablaCh.innerHTML+=`
      <tr>
        <td>${c.nombre}</td>
        <td>${c.ganancia}%</td>
        <td>${c.deduccion}%</td>
        <td><button onclick="delCh(${i})">🗑️</button></td>
      </tr>`;
  });
  actualizarSelectChoferes();
}
function delCh(i){ store.choferes.splice(i,1); saveAll(); renderChoferes(); }
renderChoferes();

// ===== CONFIGURACIÓN =====
const configDiv=document.getElementById("config");

document.getElementById("saveConfig").onclick=()=>{
  store.config.pin=pinInput.value;
  store.config.valorMilla=parseFloat(valorMillaInput.value||1);
  store.config.umbralAlto=parseFloat(umbralAlto.value||1000);
  store.config.umbralMedio=parseFloat(umbralMedio.value||400);
  const f=document.getElementById("logoInput").files[0];
  if(f){
    const r=new FileReader();
    r.onload=e=>{
      store.config.logo=e.target.result;
      saveAll();alert("Configuración guardada ✅");
    };
    r.readAsDataURL(f);
  } else {saveAll();alert("Configuración guardada ✅");}
};

// ===== MILLAS (Base estructura de selects) =====
const formMillas=document.getElementById("formMillas"),
      tablaMillas=document.getElementById("tablaMillas");

const choferSelect=document.createElement("select");
choferSelect.id="mChofer";
choferSelect.required=true;
choferSelect.innerHTML="<option value='' disabled selected>Seleccionar chofer</option>";

const proveedorSelect=document.createElement("select");
proveedorSelect.id="mProveedor";
proveedorSelect.required=true;
proveedorSelect.innerHTML="<option value='' disabled selected>Seleccionar proveedor</option>";

const choferInput=document.getElementById("mChofer");
const proveedorInput=document.getElementById("mProveedor");
if(choferInput) choferInput.replaceWith(choferSelect);
if(proveedorInput) proveedorInput.replaceWith(proveedorSelect);

function actualizarSelectChoferes(){
  choferSelect.innerHTML="<option value='' disabled selected>Seleccionar chofer</option>";
  store.choferes.forEach(c=>{
    const opt=document.createElement("option");
    opt.value=c.nombre;
    opt.textContent=`${c.nombre} — ${c.ganancia}% ganancia`;
    choferSelect.appendChild(opt);
  });
}
function actualizarSelectProveedores(){
  proveedorSelect.innerHTML="<option value='' disabled selected>Seleccionar proveedor</option>";
  store.proveedores.forEach(p=>{
    const opt=document.createElement("option");
    opt.value=p.nombre;
    opt.textContent=`${p.nombre} — ${p.porc}% deducción`;
    proveedorSelect.appendChild(opt);
  });
}
actualizarSelectChoferes();
actualizarSelectProveedores();

// ===== REGISTRO DE MILLAS =====
formMillas.onsubmit=e=>{
  e.preventDefault();
  store.millas.push({
    chofer:choferSelect.value,
    proveedor:proveedorSelect.value,
    millas:+mMillas.value
  });
  choferSelect.selectedIndex=0;
  proveedorSelect.selectedIndex=0;
  mMillas.value="";
  saveAll();
  renderMillas();
};
/*************************************************
 * SAMMY TOWING INC — Nexus Transport Manager v12
 * app.js [2/3]
 * Filtros, KPIs dinámicos y lógica de IA visual
 *************************************************/

// ===== RENDER MILLAS + FILTROS + KPIs =====

// Variables de filtro
const filtroChofer = document.getElementById("filtroChofer");
const filtroProveedor = document.getElementById("filtroProveedor");
const btnMostrarTodo = document.getElementById("btnMostrarTodo");

// KPI elements
const kpiMillas = document.querySelector("#kpiMillas p");
const kpiServicios = document.querySelector("#kpiServicios p");
const kpiValor = document.querySelector("#kpiValor p");

// Inicializar filtros dinámicos
function actualizarFiltros(){
  filtroChofer.innerHTML = "<option value=''>Filtrar por Chofer</option>";
  filtroProveedor.innerHTML = "<option value=''>Filtrar por Proveedor</option>";

  store.choferes.forEach(c=>{
    const opt=document.createElement("option");
    opt.value=c.nombre;
    opt.textContent=c.nombre;
    filtroChofer.appendChild(opt);
  });

  store.proveedores.forEach(p=>{
    const opt=document.createElement("option");
    opt.value=p.nombre;
    opt.textContent=p.nombre;
    filtroProveedor.appendChild(opt);
  });
}
actualizarFiltros();

// Render principal con filtrado
function renderMillas(){
  let data = [...store.millas];
  const fc = filtroChofer.value;
  const fp = filtroProveedor.value;

  // Aplicar filtro combinado
  if(fc) data = data.filter(m=>m.chofer===fc);
  if(fp) data = data.filter(m=>m.proveedor===fp);

  // Render tabla
  tablaMillas.innerHTML="<tr><th>Chofer</th><th>Proveedor</th><th>Millas</th><th></th></tr>";
  data.forEach((m,i)=>{
    tablaMillas.innerHTML += `
      <tr>
        <td>${m.chofer}</td>
        <td>${m.proveedor}</td>
        <td>${m.millas}</td>
        <td><button onclick='delM(${i})'>🗑️</button></td>
      </tr>`;
  });

  // Calcular KPIs
  const totalMillas = data.reduce((a,b)=>a+b.millas,0);
  const totalServicios = data.length;
  const valorTotal = totalMillas * (store.config.valorMilla || 1);

  kpiMillas.textContent = totalMillas.toFixed(0);
  kpiServicios.textContent = totalServicios;
  kpiValor.textContent = `$${valorTotal.toFixed(2)}`;

  // IA de color (según umbrales)
  const umbralAlto = store.config.umbralAlto || 1000;
  const umbralMedio = store.config.umbralMedio || 400;

  let color = "red";
  if(valorTotal >= umbralAlto) color = "limegreen";
  else if(valorTotal >= umbralMedio) color = "gold";

  document.querySelector("#kpiValor").style.boxShadow = `0 0 25px ${color}`;
  document.querySelector("#kpiValor h3").style.color = color;
  document.querySelector("#kpiValor p").style.color = color;
}

// Mostrar todo
btnMostrarTodo.onclick = ()=>{
  filtroChofer.value = "";
  filtroProveedor.value = "";
  renderMillas();
};

// Listeners dinámicos
filtroChofer.onchange = renderMillas;
filtroProveedor.onchange = renderMillas;

// Inicializar tabla
renderMillas();

// ===== BORRAR MILLAS =====
function delM(i){
  store.millas.splice(i,1);
  saveAll();
  renderMillas();
}

// ===== FUNCIONES DE CIERRE Y PDF =====
function calcularCierre(){
  const vm=parseFloat(store.config.valorMilla||1),res={};
  store.millas.forEach(m=>{
    const ch=store.choferes.find(c=>c.nombre===m.chofer);
    if(!ch)return;
    const bruto=m.millas*vm,gan=bruto*(ch.ganancia/100),ded=bruto*(ch.deduccion/100);
    if(!res[m.chofer])res[m.chofer]={millas:0,bruto:0,ganancia:0,deduccion:0};
    res[m.chofer].millas+=m.millas;
    res[m.chofer].bruto+=bruto;
    res[m.chofer].ganancia+=gan;
    res[m.chofer].deduccion+=ded;
  });
  return res;
}

function renderCierre(){
  const d=calcularCierre();
  let html="<table><tr><th>Chofer</th><th>Millas</th><th>Bruto</th><th>Ganancia</th><th>Deducción</th><th>Neto</th></tr>";
  let tb=0,tg=0,td=0,tn=0;
  for(const c in d){
    const r=d[c],n=r.ganancia-r.deduccion;
    tb+=r.bruto;tg+=r.ganancia;td+=r.deduccion;tn+=n;
    html+=`<tr>
      <td>${c}</td>
      <td>${r.millas}</td>
      <td>$${r.bruto.toFixed(2)}</td>
      <td>$${r.ganancia.toFixed(2)}</td>
      <td>$${r.deduccion.toFixed(2)}</td>
      <td>$${n.toFixed(2)}</td>
    </tr>`;
  }
  html+=`<tr style="font-weight:bold;background:#222">
    <td>TOTALES</td><td>-</td>
    <td>$${tb.toFixed(2)}</td><td>$${tg.toFixed(2)}</td>
    <td>$${td.toFixed(2)}</td><td>$${tn.toFixed(2)}</td>
  </tr></table>`;
  document.getElementById("tablaCierres").innerHTML=html;
}
/*************************************************
 * SAMMY TOWING INC — Nexus Transport Manager v12
 * app.js [3/3]
 * PDF, Flujo de Caja, Backup e Importación
 *************************************************/

// ===== PDF DEL CIERRE SEMANAL =====
document.getElementById("pdfCierre").onclick=()=>{
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:"landscape"});
  const fecha=new Date().toLocaleDateString();
  const empresa=store.config.nombre||"SAMMY TOWING INC";
  const vm=store.config.valorMilla.toFixed(2);
  const data=calcularCierre();

  if(store.config.logo){doc.addImage(store.config.logo,"PNG",240,10,40,20);}
  doc.setFontSize(16);doc.text(empresa,10,15);
  doc.setFontSize(11);
  doc.text("Cierre Semanal - Reporte Ejecutivo",10,22);
  doc.text(`Fecha: ${fecha}`,10,28);
  doc.text(`Valor por milla: $${vm}`,10,34);
  doc.setDrawColor(180);doc.line(10,38,280,38);

  let y=46;
  doc.setFontSize(10);
  doc.text("Chofer",10,y);
  doc.text("Millas",60,y);
  doc.text("Bruto",100,y);
  doc.text("Ganancia",140,y);
  doc.text("Deducción",180,y);
  doc.text("Neto",230,y);
  doc.line(10,y+2,270,y+2);

  let tb=0,tg=0,td=0,tn=0; y+=10;
  for(const c in data){
    const r=data[c];
    const neto=r.ganancia-r.deduccion;
    tb+=r.bruto;tg+=r.ganancia;td+=r.deduccion;tn+=neto;
    doc.text(c,10,y);
    doc.text(String(r.millas),60,y);
    doc.text(`$${r.bruto.toFixed(2)}`,100,y);
    doc.text(`$${r.ganancia.toFixed(2)}`,140,y);
    doc.text(`$${r.deduccion.toFixed(2)}`,180,y);
    doc.text(`$${neto.toFixed(2)}`,230,y);
    y+=8;if(y>180){doc.addPage("landscape");y=20;}
  }

  doc.setDrawColor(120);
  doc.line(10,y,270,y);
  y+=8;
  doc.setFontSize(11);
  doc.text("TOTALES GENERALES:",10,y);
  doc.text(`$${tb.toFixed(2)}`,100,y);
  doc.text(`$${tg.toFixed(2)}`,140,y);
  doc.text(`$${td.toFixed(2)}`,180,y);
  doc.text(`$${tn.toFixed(2)}`,230,y);

  y+=20;
  doc.setFontSize(10);
  doc.text("Observaciones:",10,y);
  y+=8;
  doc.rect(10,y,250,25);
  y+=35;
  doc.text("Aprobado por: ____________________",10,y);

  doc.line(10,200,280,200);
  doc.setFontSize(9);
  doc.text("Generado por SAMMY TOWING INC — Nexus Transport Manager v12",10,206);
  doc.save(`Cierre_Semanal_${fecha}.pdf`);
};

// ===== FLUJO DE CAJA =====
function renderFlujo(){
  const d=calcularCierre();let tb=0,tg=0,td=0,tn=0;
  for(const c in d){tb+=d[c].bruto;tg+=d[c].ganancia;td+=d[c].deduccion;tn+=(d[c].ganancia-d[c].deduccion);}
  const caja=`
  <div class="kpi">
    <div class="kpiCard" style="background:#1e293b"><h3>Ingresos Brutos</h3><p>$${tb.toFixed(2)}</p></div>
    <div class="kpiCard" style="background:#0f766e"><h3>Ganancias Totales</h3><p>$${tg.toFixed(2)}</p></div>
    <div class="kpiCard" style="background:#7f1d1d"><h3>Deducciones Totales</h3><p>$${td.toFixed(2)}</p></div>
    <div class="kpiCard" style="background:#ca8a04"><h3>Balance Neto</h3><p>$${tn.toFixed(2)}</p></div>
  </div>
  <button id="pdfFlujo" class="pdf">Exportar Flujo PDF</button>`;
  document.getElementById("tablaFlujo").innerHTML=caja;

  document.getElementById("pdfFlujo").onclick=()=>{
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF();
    const fecha=new Date().toLocaleDateString();
    const empresa=store.config.nombre||"SAMMY TOWING INC";
    const vm=store.config.valorMilla.toFixed(2);
    if(store.config.logo){doc.addImage(store.config.logo,"PNG",150,10,40,20);}
    doc.setFontSize(14);doc.text(empresa,10,15);
    doc.setFontSize(10);
    doc.text("Reporte financiero semanal",10,22);
    doc.text(`Fecha: ${fecha}`,10,28);
    doc.text(`Valor por milla: $${vm}`,10,34);
    doc.setDrawColor(200);doc.line(10,38,200,38);
    doc.setFontSize(12);
    doc.text(`Ingresos Brutos Totales: $${tb.toFixed(2)}`,10,50);
    doc.text(`Ganancias Totales: $${tg.toFixed(2)}`,10,58);
    doc.text(`Deducciones Totales: $${td.toFixed(2)}`,10,66);
    doc.text(`Balance Neto Final: $${tn.toFixed(2)}`,10,74);
    doc.line(10,280,200,280);
    doc.setFontSize(9);
    doc.text("Generado por SAMMY TOWING INC — Nexus Transport Manager v12",10,286);
    doc.save(`Flujo_Financiero_${fecha}.pdf`);
  };
}

// ===== BACKUP =====
document.getElementById("backupAll").onclick=()=>{
  const b=new Blob([JSON.stringify(store,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);
  a.download="backup_sammy_towing.json";
  a.click();
};

// ===== IMPORT =====
const importBtn=document.createElement("button");
importBtn.textContent="Importar Backup";
importBtn.style.marginLeft="10px";
document.getElementById("config").appendChild(importBtn);
importBtn.onclick=()=>{
  const i=document.createElement("input");i.type="file";i.accept=".json";
  i.onchange=e=>{
    const f=e.target.files[0],r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        for(const k in d){store[k]=d[k];localStorage.setItem(k,JSON.stringify(store[k]));}
        alert("Backup restaurado ✅");location.reload();
      }catch(err){alert("Error al importar ❌");}
    };r.readAsText(f);
  };i.click();
};

// ===== SALIR CON PIN =====
document.getElementById("logoutBtn").onclick=()=>{
  const p=prompt("Ingrese el PIN para salir:");
  if(p===store.config.pin){alert("Sesión cerrada ✅");location.reload();}
  else alert("PIN incorrecto ❌");
};

console.log("✅ SAMMY TOWING INC — Nexus Transport Manager v12 cargado correctamente.");
