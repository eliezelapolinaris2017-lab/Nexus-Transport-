/*************************************************
 SAMMY TOWING INC — Nexus Transport Manager v13.2
 app.js — versión corporativa con PDF y persistencia
*************************************************/

// ===== BASE LOCAL =====
const store = {
  proveedores: JSON.parse(localStorage.getItem("proveedores") || "[]"),
  choferes: JSON.parse(localStorage.getItem("choferes") || "[]"),
  millas: JSON.parse(localStorage.getItem("millas") || "[]"),
  config: JSON.parse(localStorage.getItem("config") || "{}")
};
function save(k){ localStorage.setItem(k, JSON.stringify(store[k])); }
function saveAll(){ for(const k in store) save(k); }

// ===== CONFIG DEFAULT =====
store.config.valorMilla ??= 1;
store.config.umbralAlto ??= 1000;
store.config.umbralMedio ??= 400;
store.config.nombre ??= "SAMMY TOWING INC";

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
formProveedor.onsubmit=e=>{
  e.preventDefault();
  store.proveedores.push({nombre:provNombre.value,porc:+provPorc.value});
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
function delProv(i){store.proveedores.splice(i,1);save("proveedores");renderProveedores();}

// ===== CHOFERES =====
formChofer.onsubmit=e=>{
  e.preventDefault();
  store.choferes.push({
    nombre:chNombre.value,
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
function delCh(i){store.choferes.splice(i,1);save("choferes");renderChoferes();}

// ===== SELECTS =====
function actualizarSelects(){
  const chSel=mChofer, prSel=mProveedor, fch=filtroChofer, fpr=filtroProveedor;
  chSel.innerHTML=fch.innerHTML="<option value=''>Chofer</option>";
  prSel.innerHTML=fpr.innerHTML="<option value=''>Proveedor</option>";
  store.choferes.forEach(c=>{
    chSel.innerHTML+=`<option>${c.nombre}</option>`;
    fch.innerHTML+=`<option>${c.nombre}</option>`;
  });
  store.proveedores.forEach(p=>{
    prSel.innerHTML+=`<option>${p.nombre}</option>`;
    fpr.innerHTML+=`<option>${p.nombre}</option>`;
  });
}
renderProveedores(); renderChoferes(); actualizarSelects();

// ===== MILLAS =====
formMillas.onsubmit=e=>{
  e.preventDefault();
  store.millas.push({chofer:mChofer.value,proveedor:mProveedor.value,millas:+mMillas.value});
  mChofer.value=mProveedor.value=mMillas.value="";
  save("millas"); renderMillas();
};
function renderMillas(){
  const fc=filtroChofer.value, fp=filtroProveedor.value;
  let data=store.millas.filter(m=>(!fc||m.chofer===fc)&&(!fp||m.proveedor===fp));
  tablaMillas.innerHTML="<tr><th>Chofer</th><th>Proveedor</th><th>Millas</th><th></th></tr>";
  data.forEach((m,i)=>tablaMillas.innerHTML+=
    `<tr><td>${m.chofer}</td><td>${m.proveedor}</td><td>${m.millas}</td>
     <td><button onclick='delM(${i})'>🗑️</button></td></tr>`);
  const total=data.reduce((a,b)=>a+b.millas,0),
        servicios=data.length,
        valor=total*(store.config.valorMilla||1);
  kpiMillas.querySelector("p").textContent=total.toFixed(0);
  kpiServicios.querySelector("p").textContent=servicios;
  kpiValor.querySelector("p").textContent=`$${valor.toFixed(2)}`;
  const {umbralAlto,umbralMedio}=store.config;
  let c="red"; if(valor>=umbralAlto)c="lime"; else if(valor>=umbralMedio)c="gold";
  kpiValor.style.boxShadow=`0 0 25px ${c}`; kpiValor.style.color=c;
}
filtroChofer.onchange=filtroProveedor.onchange=renderMillas;
btnMostrarTodo.onclick=()=>{filtroChofer.value=filtroProveedor.value="";renderMillas();};
function delM(i){store.millas.splice(i,1);save("millas");renderMillas();}
renderMillas();

// ===== CIERRE SEMANAL =====
function calcularCierre(){
  const vm=store.config.valorMilla,res={};
  store.millas.forEach(m=>{
    const ch=store.choferes.find(c=>c.nombre===m.chofer);
    if(!ch)return;
    const b=m.millas*vm,g=b*(ch.ganancia/100),d=b*(ch.deduccion/100);
    if(!res[m.chofer])res[m.chofer]={millas:0,bruto:0,gan:0,ded:0};
    res[m.chofer].millas+=m.millas;res[m.chofer].bruto+=b;res[m.chofer].gan+=g;res[m.chofer].ded+=d;
  });return res;
}
function renderCierre(){
  const d=calcularCierre();
  let h="<table><tr><th>Chofer</th><th>Millas</th><th>Bruto</th><th>Ganancia</th><th>Deducción</th><th>Neto</th></tr>";
  for(const c in d){
    const r=d[c];const n=r.gan-r.ded;
    h+=`<tr><td>${c}</td><td>${r.millas}</td><td>$${r.bruto.toFixed(2)}</td>
         <td>$${r.gan.toFixed(2)}</td><td>$${r.ded.toFixed(2)}</td><td>$${n.toFixed(2)}</td></tr>`;
  }
  document.getElementById("tablaCierres").innerHTML=h+"</table>";
}

// ===== PDF CORPORATIVO CIERRE =====
pdfCierre.onclick=()=>{
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:"landscape"});
  const empresa=store.config.nombre||"SAMMY TOWING INC";
  const fecha=new Date().toLocaleDateString();
  const valorMilla=store.config.valorMilla?.toFixed(2)||"1.00";
  const data=calcularCierre();

  if(store.config.logo) doc.addImage(store.config.logo,"PNG",250,8,35,25);
  doc.setFontSize(18); doc.setTextColor(255,0,0);
  doc.text(empresa,10,18);
  doc.setDrawColor(200,0,0); doc.line(10,21,280,21);
  doc.setFontSize(11); doc.setTextColor(0);
  doc.text("Reporte de Cierre Semanal",10,29);
  doc.text(`Fecha: ${fecha}`,10,36);
  doc.text(`Valor por milla: $${valorMilla}`,10,43);

  let y=55; doc.setFontSize(10);
  doc.text("Chofer",10,y); doc.text("Millas",55,y);
  doc.text("Bruto",90,y); doc.text("Ganancia",125,y);
  doc.text("Deducción",165,y); doc.text("Neto",205,y);
  doc.line(10,y+2,270,y+2); y+=10;

  let tb=0,tg=0,td=0,tn=0;
  for(const c in data){
    const r=data[c];const n=r.gan-r.ded;
    tb+=r.bruto;tg+=r.gan;td+=r.ded;tn+=n;
    doc.text(c,10,y);doc.text(String(r.millas),55,y);
    doc.text(`$${r.bruto.toFixed(2)}`,90,y);
    doc.text(`$${r.gan.toFixed(2)}`,125,y);
    doc.text(`$${r.ded.toFixed(2)}`,165,y);
    doc.text(`$${n.toFixed(2)}`,205,y);
    y+=8;if(y>180){doc.addPage("landscape");y=20;}
  }

  doc.setDrawColor(180,0,0);doc.line(10,y,270,y);
  y+=8;doc.setFontSize(11);doc.setTextColor(255,0,0);
  doc.text("TOTALES GENERALES",10,y);
  doc.text(`$${tb.toFixed(2)}`,90,y);
  doc.text(`$${tg.toFixed(2)}`,125,y);
  doc.text(`$${td.toFixed(2)}`,165,y);
  doc.text(`$${tn.toFixed(2)}`,205,y);

  y+=25;doc.setTextColor(0);doc.setFontSize(9);
  doc.text("Aprobado por: ____________________________",10,y);
  y+=20;doc.setDrawColor(180,0,0);doc.line(10,y,280,y);
  y+=8;doc.setTextColor(120);
  doc.text("Generado con Nexus Transport Manager v13 — SAMMY TOWING INC",10,y);
  doc.save(`Cierre_Semanal_${fecha}.pdf`);
};

// ===== FLUJO DE CAJA =====
function renderFlujo(){
  const d=calcularCierre();let tb=0,tg=0,td=0;for(const c in d){tb+=d[c].bruto;tg+=d[c].gan;td+=d[c].ded;}
  const tn=tg-td;
  document.getElementById("tablaFlujo").innerHTML=`
    <div class='kpi'>
      <div class='kpiCard'><h3>Bruto</h3><p>$${tb.toFixed(2)}</p></div>
      <div class='kpiCard'><h3>Ganancia</h3><p>$${tg.toFixed(2)}</p></div>
      <div class='kpiCard'><h3>Deducción</h3><p>$${td.toFixed(2)}</p></div>
      <div class='kpiCard'><h3>Neto</h3><p>$${tn.toFixed(2)}</p></div>
    </div>
    <button id="pdfFlujo">Exportar Flujo PDF</button>`;
  document.getElementById("pdfFlujo").onclick=()=>exportarFlujoPDF(tb,tg,td,tn);
}

// ===== PDF CORPORATIVO FLUJO =====
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
  doc.text(`Fecha: ${fecha}`,10,33);

  doc.setFontSize(12);
  doc.text(`Ingresos Brutos: $${tb.toFixed(2)}`,10,50);
  doc.text(`Ganancias Totales: $${tg.toFixed(2)}`,10,58);
  doc.text(`Deducciones Totales: $${td.toFixed(2)}`,10,66);
  doc.text(`Balance Neto Final: $${tn.toFixed(2)}`,10,74);
  doc.setDrawColor(180,0,0);doc.line(10,120,200,120);
  doc.setFontSize(9);doc.setTextColor(120);
  doc.text("Generado con Nexus Transport Manager v13 — SAMMY TOWING INC",10,126);
  doc.save(`Flujo_Caja_${fecha}.pdf`);
}

// ===== CONFIGURACIÓN =====
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
      saveAll();alert("Configuración guardada ✅");
      renderLogoPreview();
    };
    r.readAsDataURL(f);
  } else {saveAll();alert("Configuración guardada ✅");}
};

// Mostrar logo al cargar
function renderLogoPreview(){
  if(store.config.logo){
    let img=document.getElementById("logoPreview");
    if(!img){img=document.createElement("img");img.id="logoPreview";
      img.style="width:120px;margin-top:10px;border-radius:6px;display:block;";}
    img.src=store.config.logo;logoInput.insertAdjacentElement("afterend",img);
  }
}
window.addEventListener("load",renderLogoPreview);

// ===== BACKUP + IMPORT =====
backupAll.onclick=()=>{
  const b=new Blob([JSON.stringify(store,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download="backup_sammy_towing.json";a.click();
};
const imp=document.createElement("button");
imp.textContent="Importar Backup";config.appendChild(imp);
imp.onclick=()=>{
  const i=document.createElement("input");i.type="file";i.accept=".json";
  i.onchange=e=>{
    const r=new FileReader();
    r.onload=x=>{
      Object.assign(store,JSON.parse(x.target.result));
      saveAll();alert("Backup restaurado ✅");location.reload();
    };
    r.readAsText(e.target.files[0]);
  };i.click();
};

// ===== SEGURIDAD =====
logoutBtn.onclick=()=>{
  const p=prompt("PIN de seguridad:");
  if(p===store.config.pin){alert("Sesión cerrada ✅");location.reload();}
  else alert("PIN incorrecto ❌");
};

console.log("✅ SAMMY TOWING INC v13.2 cargado correctamente.");
