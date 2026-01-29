/*************************************************
 SAMMY TOWING INC — Nexus Transport Manager v14
 app.js — versión contable PRO con Retenciones, 
 Deducciones y Pagos
*************************************************/

// ===== BASE LOCAL =====
const store = {
  proveedores: JSON.parse(localStorage.getItem("proveedores") || "[]"),
  choferes: JSON.parse(localStorage.getItem("choferes") || "[]"),
  millas: JSON.parse(localStorage.getItem("millas") || "[]"),
  pagos: JSON.parse(localStorage.getItem("pagos") || "[]"),
  retenciones: JSON.parse(localStorage.getItem("retenciones") || "[]"),
  deducciones: JSON.parse(localStorage.getItem("deducciones") || "[]"),
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
    switch(btn.dataset.tab){
      case "cierres": renderCierre(); break;
      case "flujo": renderFlujo(); break;
      case "retenciones": renderRetenciones(); break;
      case "deducciones": renderDeducciones(); break;
      case "pagos": renderPagos(); break;
    }
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
/*************************************************
  🧾 RETENCIONES 10% / DEDUCCIONES / PAGOS
*************************************************/

// ===== RETENCIONES 10% =====
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

// ===== PDF RETENCIONES =====
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
  doc.text(`Fecha: ${fecha}`,10,33);

  let y=48, total=0;
  for(const c in data){
    const r=data[c];
    const ret=r.gan*0.10; total+=ret;
    const estado=(store.retenciones.find(x=>x.chofer===c)||{estado:"Pendiente"}).estado;
    doc.text(`${c.padEnd(20)} $${ret.toFixed(2)}   Estado: ${estado}`,10,y);
    y+=7;
  }
  y+=10;doc.setDrawColor(200,0,0);doc.line(10,y,200,y);
  y+=8;doc.setTextColor(255,0,0);doc.text(`Total Retenciones: $${total.toFixed(2)}`,10,y);
  doc.save(`Retenciones_${fecha}.pdf`);
};

// ===== DEDUCCIONES A PROVEEDORES =====
function renderDeducciones(){
  const vm=store.config.valorMilla||1;
  const data={};
  store.millas.forEach(m=>{
    const p=store.proveedores.find(x=>x.nombre===m.proveedor);
    if(!p)return;
    const ded=(m.millas*vm)*(p.porc/100);
    if(!data[m.proveedor])data[m.proveedor]={total:0};
    data[m.proveedor].total+=ded;
  });
  let h="<table><tr><th>Proveedor</th><th>Deducción Total</th></tr>";
  for(const p in data){
    h+=`<tr><td>${p}</td><td>$${data[p].total.toFixed(2)}</td></tr>`;
  }
  document.getElementById("tablaDeducciones").innerHTML=h+"</table>";
  store.deducciones=data; save("deducciones");
}

// ===== PDF DEDUCCIONES =====
pdfDeducciones.onclick=()=>{
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF();
  const empresa=store.config.nombre||"SAMMY TOWING INC";
  const fecha=new Date().toLocaleDateString();
  const data=store.deducciones;

  if(store.config.logo) doc.addImage(store.config.logo,"PNG",150,8,35,20);
  doc.setFontSize(16); doc.setTextColor(255,0,0);
  doc.text(empresa,10,15);
  doc.setDrawColor(200,0,0); doc.line(10,18,200,18);
  doc.setFontSize(11); doc.setTextColor(0);
  doc.text("Reporte de Deducciones a Proveedores",10,26);
  doc.text(`Fecha: ${fecha}`,10,33);

  let y=48,total=0;
  for(const p in data){
    const v=data[p].total; total+=v;
    doc.text(`${p.padEnd(20)} $${v.toFixed(2)}`,10,y);
    y+=7;
  }
  y+=10; doc.setTextColor(255,0,0);
  doc.text(`Total Deducciones: $${total.toFixed(2)}`,10,y);
  doc.save(`Deducciones_${fecha}.pdf`);
};

// ===== PAGOS A CHOFERES =====
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
      <td><button onclick="registrarPago('${c}',${g},${reg.pagado})">💵 Pago</button></td>
    </tr>`;
  }
  document.getElementById("tablaPagos").innerHTML=h+"</table>";
  save("pagos");
}

function registrarPago(chofer,g,actual){
  const monto=parseFloat(prompt(`Ingrese monto pagado a ${chofer}:`,0))||0;
  if(!monto)return;
  let reg=store.pagos.find(x=>x.chofer===chofer);
  if(!reg){reg={chofer,pagado:0};store.pagos.push(reg);}
  reg.pagado+=monto; if(reg.pagado>g)reg.pagado=g;
  save("pagos"); renderPagos();
}

// ===== PDF PAGOS =====
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
  doc.text(`Fecha: ${fecha}`,10,36);

  let y=55;
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
  }
  doc.save(`Pagos_${fecha}.pdf`);
}
/*************************************************
  💰 FLUJO DE CAJA / CONFIGURACIÓN / BACKUP / PIN
*************************************************/

// ===== FLUJO DE CAJA =====
function renderFlujo(){
  const d=calcularCierre();let tb=0,tg=0,td=0;
  for(const c in d){tb+=d[c].bruto;tg+=d[c].gan;td+=d[c].ded;}
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
  doc.text("Generado con Nexus Transport Manager v14 — SAMMY TOWING INC",10,126);
  doc.save(`Flujo_Caja_${fecha}.pdf`);
}

// ===== CONFIGURACIÓN =====
saveConfig.onclick=()=>{
  store.config.pin=pinInput.value;
  store.config.valorMilla=parseFloat(valorMillaInput.value)||1;
  store.config.umbralAlto=parseFloat(umbralAlto.value)||1000;
  store.config.umbralMedio=parseFloat(umbralMedio.value)||400;
 if(store.config.logo) document.body.style.setProperty("background-image", `url(${store.config.logo})`);
  const f=logoInput.files[0];
  if(f){
    const r=new FileReader();
    r.onload=e=>{
      store.config.logo=e.target.result;
      saveAll();
      renderLogoPreview();
      alert("Configuración guardada ✅");
    };
    r.readAsDataURL(f);
  } else {
    saveAll();
    alert("Configuración guardada ✅");
  }
};

// Mostrar logo al cargar
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
window.addEventListener("load",()=>{
  renderLogoPreview();
  // Rellenar inputs guardados
  if(store.config.pin) pinInput.value=store.config.pin;
  if(store.config.valorMilla) valorMillaInput.value=store.config.valorMilla;
  if(store.config.umbralAlto) umbralAlto.value=store.config.umbralAlto;
  if(store.config.umbralMedio) umbralMedio.value=store.config.umbralMedio;
});

// ===== BACKUP + IMPORT =====
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
      Object.assign(store,JSON.parse(x.target.result));
      saveAll();
      alert("Backup restaurado ✅");
      location.reload();
    };
    r.readAsText(e.target.files[0]);
  };
  i.click();
};

// ===== SEGURIDAD =====
logoutBtn.onclick=()=>{
  const p=prompt("PIN de seguridad:");
  if(p===store.config.pin){
    alert("Sesión cerrada ✅");
    location.reload();
  } else {
    alert("PIN incorrecto ❌");
  }
};

console.log("✅ SAMMY TOWING INC v14 cargado correctamente.");
