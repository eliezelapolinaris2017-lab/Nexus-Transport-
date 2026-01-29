// ========== BASE LOCAL ==========
const store = {
  proveedores: JSON.parse(localStorage.getItem("proveedores")||"[]"),
  choferes: JSON.parse(localStorage.getItem("choferes")||"[]"),
  millas: JSON.parse(localStorage.getItem("millas")||"[]"),
  config: JSON.parse(localStorage.getItem("config")||"{}")
};
if (!store.config.valorMilla) store.config.valorMilla = 1.00;
if (!store.config.nombre) store.config.nombre = "Nexus Transport PR";

// ========== GUARDAR ==========
function saveAll(){for(const k in store)localStorage.setItem(k,JSON.stringify(store[k]));}

// ========== NAVEGACIÓN ==========
document.querySelectorAll(".tabs button").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
    if(btn.dataset.tab==="cierres")renderCierre();
    if(btn.dataset.tab==="flujo")renderFlujo();
  };
});

// ========== PROVEEDORES ==========
const formProv=document.getElementById("formProveedor"),tablaProv=document.getElementById("tablaProveedores");
formProv.onsubmit=e=>{
  e.preventDefault();
  store.proveedores.push({nombre:provNombre.value,porc:+provPorc.value});
  provNombre.value=provPorc.value="";
  saveAll();renderProveedores();
};
function renderProveedores(){
  tablaProv.innerHTML="<tr><th>Nombre</th><th>Deducción</th><th></th></tr>";
  store.proveedores.forEach((p,i)=>tablaProv.innerHTML+=`<tr><td>${p.nombre}</td><td>${p.porc}%</td><td><button onclick="delProv(${i})">🗑️</button></td></tr>`);
}
function delProv(i){store.proveedores.splice(i,1);saveAll();renderProveedores();}
renderProveedores();

// ========== CHOFERES ==========
const formCh=document.getElementById("formChofer"),tablaCh=document.getElementById("tablaChoferes");
formCh.onsubmit=e=>{
  e.preventDefault();
  store.choferes.push({nombre:chNombre.value,ganancia:+chGanancia.value,deduccion:+chDeduccion.value});
  chNombre.value=chGanancia.value=chDeduccion.value="";
  saveAll();renderChoferes();
};
function renderChoferes(){
  tablaCh.innerHTML="<tr><th>Nombre</th><th>Ganancia</th><th>Deducción</th><th></th></tr>";
  store.choferes.forEach((c,i)=>tablaCh.innerHTML+=`<tr><td>${c.nombre}</td><td>${c.ganancia}%</td><td>${c.deduccion}%</td><td><button onclick="delCh(${i})">🗑️</button></td></tr>`);
}
function delCh(i){store.choferes.splice(i,1);saveAll();renderChoferes();}
renderChoferes();

// ========== CONFIG ==========
const configDiv=document.getElementById("config");

// campo nombre negocio
const nombreNegocioInput=document.createElement("input");
nombreNegocioInput.placeholder="Nombre del negocio";
nombreNegocioInput.value=store.config.nombre||"Nexus Transport PR";
configDiv.insertBefore(nombreNegocioInput,configDiv.firstChild);
configDiv.insertBefore(document.createTextNode("Nombre del negocio: "),configDiv.firstChild);

const valorMillaInput=document.createElement("input");
valorMillaInput.type="number";valorMillaInput.step="0.01";valorMillaInput.placeholder="Valor por milla ($)";
valorMillaInput.value=store.config.valorMilla||1.00;
configDiv.append("\nValor por milla: ",valorMillaInput);

document.getElementById("saveConfig").onclick=()=>{
  store.config.pin=pinInput.value;
  store.config.nombre=nombreNegocioInput.value.trim()||"Nexus Transport PR";
  store.config.valorMilla=parseFloat(valorMillaInput.value||1);
  const f=document.getElementById("logoInput").files[0];
  if(f){
    const r=new FileReader();
    r.onload=e=>{
      store.config.logo=e.target.result;
      saveAll();
      alert("Configuración guardada ✅");
    };
    r.readAsDataURL(f);
  } else { saveAll(); alert("Configuración guardada ✅"); }
};

// ========== MILLAS ==========
const formMillas=document.getElementById("formMillas"),tablaMillas=document.getElementById("tablaMillas");
formMillas.onsubmit=e=>{
  e.preventDefault();
  store.millas.push({chofer:mChofer.value,proveedor:mProveedor.value,millas:+mMillas.value});
  mChofer.value=mProveedor.value=mMillas.value="";
  saveAll();renderMillas();
};
function renderMillas(){
  tablaMillas.innerHTML="<tr><th>Chofer</th><th>Proveedor</th><th>Millas</th><th></th></tr>";
  store.millas.forEach((m,i)=>tablaMillas.innerHTML+=`<tr><td>${m.chofer}</td><td>${m.proveedor}</td><td>${m.millas}</td><td><button onclick="delM(${i})">🗑️</button></td></tr>`);
}
function delM(i){store.millas.splice(i,1);saveAll();renderMillas();}
renderMillas();

// ========== CIERRE SEMANAL ==========
function calcularCierre(){
  const vm=parseFloat(store.config.valorMilla||1),res={};
  store.millas.forEach(m=>{
    const ch=store.choferes.find(c=>c.nombre===m.chofer);
    if(!ch)return;
    const bruto=m.millas*vm,gan=bruto*(ch.ganancia/100),ded=bruto*(ch.deduccion/100);
    if(!res[m.chofer])res[m.chofer]={millas:0,bruto:0,ganancia:0,deduccion:0};
    res[m.chofer].millas+=m.millas;res[m.chofer].bruto+=bruto;res[m.chofer].ganancia+=gan;res[m.chofer].deduccion+=ded;
  });return res;
}
function renderCierre(){
  const d=calcularCierre();let html="<table><tr><th>Chofer</th><th>Millas</th><th>Bruto</th><th>Ganancia</th><th>Deducción</th><th>Neto</th></tr>";
  let tb=0,tg=0,td=0,tn=0;
  for(const c in d){const r=d[c],n=r.ganancia-r.deduccion;tb+=r.bruto;tg+=r.ganancia;td+=r.deduccion;tn+=n;
    html+=`<tr><td>${c}</td><td>${r.millas}</td><td>$${r.bruto.toFixed(2)}</td><td>$${r.ganancia.toFixed(2)}</td><td>$${r.deduccion.toFixed(2)}</td><td>$${n.toFixed(2)}</td></tr>`;}
  html+=`<tr style="font-weight:bold;background:#222"><td>TOTALES</td><td>-</td><td>$${tb.toFixed(2)}</td><td>$${tg.toFixed(2)}</td><td>$${td.toFixed(2)}</td><td>$${tn.toFixed(2)}</td></tr></table>`;
  document.getElementById("tablaCierres").innerHTML=html;
}

// ========== PDF DEL CIERRE (EJECUTIVO DETALLADO) ==========
document.getElementById("pdfCierre").onclick=()=>{
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:"landscape"});
  const fecha=new Date().toLocaleDateString();
  const empresa=store.config.nombre||"Nexus Transport PR";
  const vm=store.config.valorMilla.toFixed(2);
  const data=calcularCierre();

  if(store.config.logo){doc.addImage(store.config.logo,"PNG",240,10,40,20);}
  doc.setFontSize(16);doc.text(empresa,10,15);
  doc.setFontSize(11);
  doc.text("Cierre Semanal - Reporte Ejecutivo",10,22);
  doc.text(`Fecha: ${fecha}`,10,28);
  doc.text(`Valor por milla: $${vm}`,10,34);
  doc.setDrawColor(180);doc.line(10,38,280,38);

  // Encabezados tabla
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
    y+=8;
    if(y>180){doc.addPage("landscape");y=20;}
  }

  // Totales
  doc.setDrawColor(120);
  doc.line(10,y,270,y);
  y+=8;
  doc.setFontSize(11);
  doc.text("TOTALES GENERALES:",10,y);
  doc.text(`$${tb.toFixed(2)}`,100,y);
  doc.text(`$${tg.toFixed(2)}`,140,y);
  doc.text(`$${td.toFixed(2)}`,180,y);
  doc.text(`$${tn.toFixed(2)}`,230,y);

  // Observaciones
  y+=20;
  doc.setFontSize(10);
  doc.text("Observaciones:",10,y);
  y+=8;
  doc.rect(10,y,250,25);
  y+=35;
  doc.text("Aprobado por: ____________________",10,y);

  // Pie
  doc.line(10,200,280,200);
  doc.setFontSize(9);
  doc.text("Generado por Nexus Transport Manager",10,206);
  doc.save(`Cierre_Semanal_${fecha}.pdf`);
};

// ========== FLUJO DE CAJA ==========
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

  // PDF flujo financiero
  document.getElementById("pdfFlujo").onclick=()=>{
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF();
    const fecha=new Date().toLocaleDateString();
    const empresa=store.config.nombre||"Nexus Transport PR";
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
    doc.setLineWidth(0.3);
    doc.line(10,280,200,280);
    doc.setFontSize(9);
    doc.text("Generado por Nexus Transport Manager",10,286);
    doc.save(`Flujo_Financiero_${fecha}.pdf`);
  };
}

// ========== BACKUP ==========
document.getElementById("backupAll").onclick=()=>{
  const b=new Blob([JSON.stringify(store,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="backup_nexus_transport.json";a.click();
};

// ========== IMPORT ==========
const importBtn=document.createElement("button");
importBtn.textContent="Importar Backup";importBtn.style.marginLeft="10px";
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

// ========== SALIR ==========
document.getElementById("logoutBtn").onclick=()=>{
  const p=prompt("Ingrese el PIN para salir:");
  if(p===store.config.pin){alert("Sesión cerrada ✅");location.reload();}
  else alert("PIN incorrecto ❌");
};
