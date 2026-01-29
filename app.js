/*************************************************
 SAMMY TOWING INC — Nexus Transport Manager v12L
 Versión optimizada (corta y funcional)
*************************************************/

// ===== Datos LocalStorage =====
const store = {
  proveedores: JSON.parse(localStorage.getItem("proveedores")||"[]"),
  choferes: JSON.parse(localStorage.getItem("choferes")||"[]"),
  millas: JSON.parse(localStorage.getItem("millas")||"[]"),
  config: JSON.parse(localStorage.getItem("config")||"{}")
};
function save(k){ localStorage.setItem(k, JSON.stringify(store[k])); }
function saveAll(){ for(const k in store) save(k); }

// ===== Config predeterminada =====
store.config.valorMilla ??= 1;
store.config.umbralAlto ??= 1000;
store.config.umbralMedio ??= 400;
store.config.nombre ??= "SAMMY TOWING INC";

// ===== Navegación =====
document.querySelectorAll(".tabs button").forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
    document.getElementById(b.dataset.tab).classList.remove("hidden");
    if(b.dataset.tab==="cierres") renderCierre();
    if(b.dataset.tab==="flujo") renderFlujo();
  };
});

// ===== Proveedores =====
formProveedor.onsubmit=e=>{
  e.preventDefault();
  store.proveedores.push({nombre:provNombre.value,porc:+provPorc.value});
  provNombre.value=provPorc.value="";
  save("proveedores"); renderProveedores(); actualizarSelects();
};
function renderProveedores(){
  tablaProveedores.innerHTML="<tr><th>Proveedor</th><th>% Ded.</th><th></th></tr>";
  store.proveedores.forEach((p,i)=>tablaProveedores.innerHTML+=
    `<tr><td>${p.nombre}</td><td>${p.porc}%</td><td><button onclick='delProv(${i})'>🗑️</button></td></tr>`);
}
function delProv(i){store.proveedores.splice(i,1);save("proveedores");renderProveedores();}

// ===== Choferes =====
formChofer.onsubmit=e=>{
  e.preventDefault();
  store.choferes.push({nombre:chNombre.value,ganancia:+chGanancia.value,deduccion:+chDeduccion.value});
  chNombre.value=chGanancia.value=chDeduccion.value="";
  save("choferes"); renderChoferes(); actualizarSelects();
};
function renderChoferes(){
  tablaChoferes.innerHTML="<tr><th>Chofer</th><th>% Gana</th><th>% Ded.</th><th></th></tr>";
  store.choferes.forEach((c,i)=>tablaChoferes.innerHTML+=
    `<tr><td>${c.nombre}</td><td>${c.ganancia}%</td><td>${c.deduccion}%</td><td><button onclick='delCh(${i})'>🗑️</button></td></tr>`);
}
function delCh(i){store.choferes.splice(i,1);save("choferes");renderChoferes();}

// ===== Selects dinámicos =====
function actualizarSelects(){
  const chSel=document.getElementById("mChofer"), prSel=document.getElementById("mProveedor");
  chSel.innerHTML="<option value=''>Chofer</option>";
  prSel.innerHTML="<option value=''>Proveedor</option>";
  store.choferes.forEach(c=>chSel.innerHTML+=`<option>${c.nombre}</option>`);
  store.proveedores.forEach(p=>prSel.innerHTML+=`<option>${p.nombre}</option>`);
}
actualizarSelects();

// ===== Registro de Millas =====
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
    `<tr><td>${m.chofer}</td><td>${m.proveedor}</td><td>${m.millas}</td><td><button onclick='delM(${i})'>🗑️</button></td></tr>`);
  const vm=store.config.valorMilla||1, total=data.reduce((a,b)=>a+b.millas,0), valor=total*vm;
  kpiMillas.textContent=total; kpiServicios.textContent=data.length; kpiValor.textContent="$"+valor.toFixed(2);
  const color=valor>=store.config.umbralAlto?"lime":valor>=store.config.umbralMedio?"gold":"red";
  kpiValor.style.color=kpiValor.parentElement.style.boxShadow=color==="gold"?"0 0 25px gold":`0 0 25px ${color}`;
}
function delM(i){store.millas.splice(i,1);save("millas");renderMillas();}
filtroChofer.onchange=filtroProveedor.onchange=renderMillas;btnMostrarTodo.onclick=()=>{filtroChofer.value=filtroProveedor.value="";renderMillas();};
renderMillas();

// ===== Cierre y Flujo =====
function calcularCierre(){
  const vm=store.config.valorMilla,res={};
  store.millas.forEach(m=>{
    const c=store.choferes.find(x=>x.nombre===m.chofer); if(!c)return;
    const b=m.millas*vm,g=b*(c.ganancia/100),d=b*(c.deduccion/100);
    if(!res[m.chofer])res[m.chofer]={millas:0,bruto:0,gan:0,ded:0};
    res[m.chofer].millas+=m.millas;res[m.chofer].bruto+=b;res[m.chofer].gan+=g;res[m.chofer].ded+=d;
  });return res;
}
function renderCierre(){
  const d=calcularCierre();let h="<table><tr><th>Chofer</th><th>Millas</th><th>Bruto</th><th>Ganancia</th><th>Deducción</th><th>Neto</th></tr>";
  for(const c in d){const r=d[c];h+=`<tr><td>${c}</td><td>${r.millas}</td><td>$${r.bruto.toFixed(2)}</td><td>$${r.gan.toFixed(2)}</td><td>$${r.ded.toFixed(2)}</td><td>$${(r.gan-r.ded).toFixed(2)}</td></tr>`;}
  document.getElementById("tablaCierres").innerHTML=h+"</table>";
}
function renderFlujo(){
  const d=calcularCierre();let tb=0,tg=0,td=0;
  for(const c in d){tb+=d[c].bruto;tg+=d[c].gan;td+=d[c].ded;}
  const net=tg-td;
  document.getElementById("tablaFlujo").innerHTML=
  `<div class='kpi'><div class='kpiCard'><h3>Bruto</h3><p>$${tb.toFixed(2)}</p></div>
  <div class='kpiCard'><h3>Ganancia</h3><p>$${tg.toFixed(2)}</p></div>
  <div class='kpiCard'><h3>Deducción</h3><p>$${td.toFixed(2)}</p></div>
  <div class='kpiCard'><h3>Neto</h3><p>$${net.toFixed(2)}</p></div></div>`;
}

// ===== Configuración =====
saveConfig.onclick=()=>{
  store.config.pin=pinInput.value;
  store.config.valorMilla=parseFloat(valorMillaInput.value||1);
  store.config.umbralAlto=parseFloat(umbralAlto.value||1000);
  store.config.umbralMedio=parseFloat(umbralMedio.value||400);
  const f=logoInput.files[0];
  if(f){const r=new FileReader();r.onload=e=>{store.config.logo=e.target.result;save("config");alert("Configuración guardada ✅");};r.readAsDataURL(f);}
  else{save("config");alert("Configuración guardada ✅");}
};

// ===== Backup + Import =====
backupAll.onclick=()=>{
  const blob=new Blob([JSON.stringify(store)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="backup_sammy_towing.json";a.click();
};
const imp=document.createElement("button");imp.textContent="Importar Backup";config.appendChild(imp);
imp.onclick=()=>{const i=document.createElement("input");i.type="file";i.onchange=e=>{
  const r=new FileReader();r.onload=x=>{Object.assign(store,JSON.parse(x.target.result));saveAll();alert("Backup restaurado ✅");location.reload();};
  r.readAsText(e.target.files[0]);};i.click();};

// ===== Salir con PIN =====
logoutBtn.onclick=()=>{const p=prompt("PIN de seguridad:");p===store.config.pin?(alert("Sesión cerrada"),location.reload()):alert("PIN incorrecto");};

console.log("✅ SAMMY TOWING INC Manager v12L listo");
