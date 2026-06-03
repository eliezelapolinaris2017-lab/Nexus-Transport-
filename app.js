(() => {
  const KEY = "prt_pro_v1";
  const $ = (id) => document.getElementById(id);
  const uid = (p="id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const today = () => new Date().toISOString().slice(0,10);
  const money = n => `$${(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const num = v => Number(v)||0;
  const esc = s => String(s ?? "").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const base = {
    cfg:{name:"Puerto Rico Transport PRO", phone:"", email:"", address:"Puerto Rico", rate:1.75, tax:0, logo:""},
    clientes:[], choferes:[], proveedores:[], vehiculos:[], servicios:[]
  };
  let state = load();
  let filters = {desde:"", hasta:"", buscar:"", estado:""};

  function load(){ try { return {...base, ...JSON.parse(localStorage.getItem(KEY)||"{}")} } catch { return structuredClone(base); } }
  function save(){ localStorage.setItem(KEY, JSON.stringify(state)); renderAll(); }
  function activeServices(){ return state.servicios.filter(s=>s.estado!=="Cancelado"); }
  function total(s){ return num(s.base)+num(s.millas)*num(state.cfg.rate)+num(s.peajes); }
  function balance(s){ return Math.max(0,total(s)-num(s.pagado)); }
  function profit(s){ return total(s)-num(s.gastos); }
  function byId(arr,id){ return arr.find(x=>x.id===id); }
  function nameOf(arr,id,fallback="—"){ return byId(arr,id)?.nombre || byId(arr,id)?.unidad || fallback; }
  function filteredServices(){
    let rows = [...state.servicios];
    if(filters.desde) rows = rows.filter(s=>String(s.fecha)>=filters.desde);
    if(filters.hasta) rows = rows.filter(s=>String(s.fecha)<=filters.hasta);
    if(filters.estado) rows = rows.filter(s=>s.estado===filters.estado);
    const q = filters.buscar.trim().toLowerCase();
    if(q) rows = rows.filter(s => [s.numero,s.telefono,s.origen,s.destino,s.tipo,s.notas,s.estado,nameOf(state.clientes,s.clienteId,""),nameOf(state.choferes,s.choferId,""),nameOf(state.proveedores,s.proveedorId,"")].join(" ").toLowerCase().includes(q));
    return rows.sort((a,b)=>String(b.fecha+b.hora).localeCompare(String(a.fecha+a.hora)));
  }

  function init(){
    $("srvFecha").value = today();
    bindTabs(); bindFilters(); bindForms(); loadConfigUI(); renderAll();
    if(!state.clientes.length && !state.choferes.length && !state.proveedores.length) seedHint();
  }
  function seedHint(){ console.info("Puerto Rico Transport PRO listo. Añade clientes, choferes y servicios."); }

  function bindTabs(){
    document.querySelectorAll("[data-tab]").forEach(btn=>btn.onclick=()=>openTab(btn.dataset.tab));
    document.querySelectorAll("[data-open]").forEach(btn=>btn.onclick=()=>openTab(btn.dataset.open));
  }
  function openTab(id){
    document.querySelectorAll(".tabView").forEach(v=>v.classList.add("hidden"));
    $(id)?.classList.remove("hidden");
    document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
    renderAll();
  }
  function bindFilters(){
    $("btnApplyFilters").onclick = ()=>{ filters={desde:$("fDesde").value,hasta:$("fHasta").value,buscar:$("fBuscar").value,estado:$("fEstado").value}; renderAll(); };
    $("btnClearFilters").onclick = ()=>{ filters={desde:"",hasta:"",buscar:"",estado:""}; ["fDesde","fHasta","fBuscar","fEstado"].forEach(id=>$(id).value=""); renderAll(); };
  }
  function bindForms(){
    $("btnSaveClient").onclick=saveClient; $("btnSaveDriver").onclick=saveDriver; $("btnSaveProvider").onclick=saveProvider; $("btnSaveVehicle").onclick=saveVehicle; $("btnSaveService").onclick=saveService; $("btnSaveConfig").onclick=saveConfig;
    $("pdfExecutive").onclick=()=>pdfExecutive(); $("btnQuickPdf").onclick=()=>pdfExecutive(); $("pdfServices").onclick=()=>pdfServices(); $("exportCsv").onclick=exportCsv; $("backupJson").onclick=backupJson;
    $("importJson").onchange=importJson; $("cfgLogo").onchange=readLogo;
  }

  function saveClient(){
    if(!$("cliNombre").value.trim()) return alert("Nombre requerido");
    upsert("clientes", {id:$("cliId").value||uid("cli"), nombre:$("cliNombre").value.trim(), telefono:$("cliTelefono").value, email:$("cliEmail").value, municipio:$("cliMunicipio").value, direccion:$("cliDireccion").value, notas:$("cliNotas").value});
    formCliente.reset(); $("cliId").value=""; save();
  }
  function saveDriver(){
    if(!$("drvNombre").value.trim()) return alert("Nombre requerido");
    upsert("choferes", {id:$("drvId").value||uid("drv"), nombre:$("drvNombre").value.trim(), telefono:$("drvTelefono").value, ganancia:num($("drvGanancia").value), retencion:num($("drvRetencion").value), licencia:$("drvLicencia").value, expira:$("drvExpira").value, estado:$("drvEstado").value});
    formChofer.reset(); $("drvGanancia").value=50; $("drvRetencion").value=10; $("drvId").value=""; save();
  }
  function saveProvider(){
    if(!$("proNombre").value.trim()) return alert("Nombre requerido");
    upsert("proveedores", {id:$("proId").value||uid("pro"), nombre:$("proNombre").value.trim(), deduccion:num($("proDeduccion").value), telefono:$("proTelefono").value, email:$("proEmail").value, estado:$("proEstado").value});
    formProveedor.reset(); $("proDeduccion").value=0; $("proId").value=""; save();
  }
  function saveVehicle(){
    if(!$("vehUnidad").value.trim()) return alert("Unidad requerida");
    upsert("vehiculos", {id:$("vehId").value||uid("veh"), unidad:$("vehUnidad").value.trim(), tablilla:$("vehTablilla").value, marca:$("vehMarca").value, modelo:$("vehModelo").value, ano:$("vehAno").value, vin:$("vehVin").value, mantenimiento:$("vehMantenimiento").value, marbete:$("vehMarbete").value, estado:$("vehEstado").value});
    formVehiculo.reset(); $("vehId").value=""; save();
  }
  function saveService(){
    if(!$("srvFecha").value || !$("srvCliente").value || !$("srvChofer").value) return alert("Fecha, cliente y chofer son requeridos");
    const id = $("srvId").value || uid("srv");
    upsert("servicios", {id, fecha:$("srvFecha").value, hora:$("srvHora").value, numero:$("srvNumero").value || nextServiceNo(), clienteId:$("srvCliente").value, telefono:$("srvTelefono").value, origen:$("srvOrigen").value, destino:$("srvDestino").value, tipo:$("srvTipo").value, choferId:$("srvChofer").value, proveedorId:$("srvProveedor").value, vehiculoId:$("srvVehiculo").value, millas:num($("srvMillas").value), base:num($("srvBase").value), peajes:num($("srvPeajes").value), gastos:num($("srvGastos").value), pagado:num($("srvPagado").value), estado:$("srvEstado").value, notas:$("srvNotas").value, updatedAt:new Date().toISOString()});
    formServicio.reset(); $("srvFecha").value=today(); $("srvId").value=""; save();
  }
  function upsert(key,obj){ const i=state[key].findIndex(x=>x.id===obj.id); i>=0 ? state[key][i]=obj : state[key].push(obj); }
  function nextServiceNo(){ return `PRT-${String(state.servicios.length+1).padStart(5,"0")}`; }
  function remove(key,id){ if(confirm("¿Borrar registro?")){ state[key]=state[key].filter(x=>x.id!==id); save(); } }

  function renderAll(){ renderBrand(); renderSelects(); renderDashboard(); renderTables(); renderFinance(); }
  function renderBrand(){
    $("brandName").textContent=state.cfg.name||"Puerto Rico Transport PRO";
    if(state.cfg.logo) $("brandLogo").innerHTML=`<img src="${state.cfg.logo}" alt="Logo">`; else $("brandLogo").textContent=(state.cfg.name||"PR").split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
  }
  function opt(arr, label="Seleccionar"){ return `<option value="">${label}</option>` + arr.filter(x=>x.estado!=="Inactivo").map(x=>`<option value="${x.id}">${esc(x.nombre||x.unidad)}</option>`).join(""); }
  function renderSelects(){
    $("srvCliente").innerHTML=opt(state.clientes,"Seleccionar cliente"); $("srvChofer").innerHTML=opt(state.choferes,"Seleccionar chofer"); $("srvProveedor").innerHTML=opt(state.proveedores,"Sin proveedor"); $("srvVehiculo").innerHTML=opt(state.vehiculos,"Sin vehículo asignado");
  }
  function renderDashboard(){
    const rows=filteredServices(), all=activeServices();
    const fact=rows.reduce((a,s)=>a+total(s),0), paid=rows.reduce((a,s)=>a+num(s.pagado),0), bal=rows.reduce((a,s)=>a+balance(s),0), net=rows.reduce((a,s)=>a+profit(s),0);
    $("heroBalance").textContent=money(activeServices().reduce((a,s)=>a+balance(s),0)); $("heroServices").textContent=`${all.length} servicios activos`;
    $("kpiGrid").innerHTML=[
      ["Facturado",money(fact),`${rows.length} servicios filtrados`],["Cobrado",money(paid),"cash-in real"],["Pendiente",money(bal),"cuentas por cobrar"],["Ganancia neta",money(net),"antes de retenciones"]
    ].map(k=>`<div class="kpi"><span>${k[0]}</span><strong>${k[1]}</strong><small>${k[2]}</small></div>`).join("");
    table($("tblRecent"), ["Fecha","Servicio","Cliente","Ruta","Estado","Total"], rows.slice(0,8).map(s=>[s.fecha, s.numero, nameOf(state.clientes,s.clienteId), `${esc(s.origen)} → ${esc(s.destino)}`, status(s.estado), money(total(s))]));
    renderTop(rows);
  }
  function renderTop(rows){
    const drivers={}; rows.forEach(s=>{ const n=nameOf(state.choferes,s.choferId,"Sin chofer"); drivers[n]=(drivers[n]||0)+total(s); });
    const items=Object.entries(drivers).sort((a,b)=>b[1]-a[1]).slice(0,6);
    $("topPerformance").innerHTML=items.length?items.map(([n,v])=>`<div class="listItem"><strong>${esc(n)}</strong><span>${money(v)}</span></div>`).join(""):`<div class="empty">Sin desempeño registrado.</div>`;
  }
  function status(s){ const c=s==="Cobrado"?"ok":s==="Pendiente"?"warn":s==="Cancelado"?"bad":""; return `<span class="pill ${c}">${esc(s)}</span>`; }
  function table(el, heads, rows){ el.innerHTML = `<tr>${heads.map(h=>`<th>${h}</th>`).join("")}</tr>` + (rows.length? rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}"><div class="empty">Sin datos.</div></td></tr>`); }
  function actions(key,id){ return `<div class="rowBtns"><button class="mini" data-edit="${key}:${id}">Editar</button><button class="mini danger" data-del="${key}:${id}">Borrar</button></div>`; }
  function renderTables(){
    const sr=filteredServices();
    table($("tblServicios"),["Fecha","No.","Cliente","Ruta","Chofer","Total","Pagado","Balance","Estado","Acción"], sr.map(s=>[s.fecha,s.numero,nameOf(state.clientes,s.clienteId),`${esc(s.origen)} → ${esc(s.destino)}`,nameOf(state.choferes,s.choferId),money(total(s)),money(s.pagado),money(balance(s)),status(s.estado),actions("servicios",s.id)]));
    table($("tblClientes"),["Cliente","Teléfono","Municipio","Total facturado","Balance","Acción"], state.clientes.map(c=>{const ss=state.servicios.filter(s=>s.clienteId===c.id);return [esc(c.nombre),esc(c.telefono),esc(c.municipio),money(ss.reduce((a,s)=>a+total(s),0)),money(ss.reduce((a,s)=>a+balance(s),0)),actions("clientes",c.id)]}));
    table($("tblChoferes"),["Chofer","Teléfono","Ganancia","Retención","Licencia","Expira","Estado","Acción"], state.choferes.map(d=>[esc(d.nombre),esc(d.telefono),`${num(d.ganancia)}%`,`${num(d.retencion)}%`,esc(d.licencia),esc(d.expira),status(d.estado),actions("choferes",d.id)]));
    table($("tblProveedores"),["Proveedor","Deducción","Teléfono","Email","Estado","Acción"], state.proveedores.map(p=>[esc(p.nombre),`${num(p.deduccion)}%`,esc(p.telefono),esc(p.email),status(p.estado),actions("proveedores",p.id)]));
    table($("tblVehiculos"),["Unidad","Tablilla","Marca/Modelo","Año","Mantenimiento","Marbete","Estado","Acción"], state.vehiculos.map(v=>[esc(v.unidad),esc(v.tablilla),`${esc(v.marca)} ${esc(v.modelo)}`,esc(v.ano),esc(v.mantenimiento),esc(v.marbete),status(v.estado),actions("vehiculos",v.id)]));
    document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const [k,id]=b.dataset.del.split(":"); remove(k,id)});
    document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const [k,id]=b.dataset.edit.split(":"); edit(k,id)});
  }
  function renderFinance(){
    const rows=filteredServices(); const fact=rows.reduce((a,s)=>a+total(s),0), gastos=rows.reduce((a,s)=>a+num(s.gastos),0), bal=rows.reduce((a,s)=>a+balance(s),0), net=fact-gastos;
    $("financeKpis").innerHTML=[["Facturado",fact],["Gastos",gastos],["Balance pendiente",bal],["Neto operacional",net]].map(([a,b])=>`<div class="kpi"><span>${a}</span><strong>${money(b)}</strong></div>`).join("");
    renderDriverPayments(rows); renderProviderDeductions(rows);
    table($("tblCashflow"),["Concepto","Total"],[["Facturado",money(fact)],["Cobrado",money(rows.reduce((a,s)=>a+num(s.pagado),0))],["Gastos",money(gastos)],["Cuentas por cobrar",money(bal)],["Neto",money(net)]]);
  }
  function renderDriverPayments(rows){
    const map={}; rows.forEach(s=>{const d=byId(state.choferes,s.choferId); if(!d)return; const bruto=profit(s)*num(d.ganancia)/100, ret=bruto*num(d.retencion)/100; map[d.nombre]??={bruto:0,ret:0,neto:0}; map[d.nombre].bruto+=bruto; map[d.nombre].ret+=ret; map[d.nombre].neto+=bruto-ret;});
    $("driverPayments").innerHTML=Object.entries(map).map(([n,v])=>`<div class="listItem"><strong>${esc(n)}</strong><span>Bruto ${money(v.bruto)} · Ret. ${money(v.ret)} · Neto ${money(v.neto)}</span></div>`).join("")||`<div class="empty">Sin pagos calculados.</div>`;
  }
  function renderProviderDeductions(rows){
    const map={}; rows.forEach(s=>{const p=byId(state.proveedores,s.proveedorId); if(!p)return; map[p.nombre]=(map[p.nombre]||0)+total(s)*num(p.deduccion)/100;});
    $("providerDeductions").innerHTML=Object.entries(map).map(([n,v])=>`<div class="listItem"><strong>${esc(n)}</strong><span>${money(v)}</span></div>`).join("")||`<div class="empty">Sin deducciones.</div>`;
  }
  function edit(k,id){
    const o=byId(state[k],id); if(!o)return;
    const map={clientes:["cli",["Nombre","Telefono","Email","Municipio","Direccion","Notas"]],choferes:["drv",["Nombre","Telefono","Ganancia","Retencion","Licencia","Expira","Estado"]],proveedores:["pro",["Nombre","Deduccion","Telefono","Email","Estado"]],vehiculos:["veh",["Unidad","Tablilla","Marca","Modelo","Ano","Vin","Mantenimiento","Marbete","Estado"]]};
    if(k==="servicios"){ openTab("servicios"); ["Id","Fecha","Hora","Numero","Telefono","Origen","Destino","Tipo","Millas","Base","Peajes","Gastos","Pagado","Estado","Notas"].forEach(n=>{const el=$("srv"+n); if(el) el.value=o[n.toLowerCase()]??""}); $("srvCliente").value=o.clienteId; $("srvChofer").value=o.choferId; $("srvProveedor").value=o.proveedorId; $("srvVehiculo").value=o.vehiculoId; return; }
    const [pre,fields]=map[k]; openTab(k==="clientes"?"clientes":k==="choferes"?"choferes":k==="proveedores"?"proveedores":"flota"); $(pre+"Id").value=o.id; fields.forEach(F=>{ const key=F.toLowerCase(); const el=$(pre+F); if(el) el.value=o[key]??""; });
  }

  function loadConfigUI(){ [ ["cfgName","name"],["cfgPhone","phone"],["cfgEmail","email"],["cfgAddress","address"],["cfgRate","rate"],["cfgTax","tax"] ].forEach(([id,k])=>$(id).value=state.cfg[k]??""); }
  function saveConfig(){ state.cfg={...state.cfg,name:cfgName.value,phone:cfgPhone.value,email:cfgEmail.value,address:cfgAddress.value,rate:num(cfgRate.value),tax:num(cfgTax.value)}; save(); }
  function readLogo(e){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{state.cfg.logo=r.result; save();}; r.readAsDataURL(f); }

  function pdfBase(title){
    const { jsPDF } = window.jspdf; const doc=new jsPDF({unit:"pt",format:"letter"}); const W=doc.internal.pageSize.getWidth();
    doc.setFillColor(11,27,51); doc.rect(0,0,W,82,"F"); doc.setTextColor(255); doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.text(state.cfg.name||"Puerto Rico Transport PRO",40,34); doc.setFontSize(11); doc.setFont("helvetica","normal"); doc.text(title,40,56);
    if(state.cfg.logo){ try{ doc.addImage(state.cfg.logo, state.cfg.logo.startsWith("data:image/png")?"PNG":"JPEG", W-92,18,48,48); }catch{} }
    doc.setTextColor(16,32,51); return doc;
  }
  function pdfExecutive(){
    const doc=pdfBase("Reporte Ejecutivo"); const rows=filteredServices(); let y=116; const data=[["Servicios",rows.length],["Facturado",money(rows.reduce((a,s)=>a+total(s),0))],["Cobrado",money(rows.reduce((a,s)=>a+num(s.pagado),0))],["Balance pendiente",money(rows.reduce((a,s)=>a+balance(s),0))],["Ganancia neta",money(rows.reduce((a,s)=>a+profit(s),0))]];
    doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.text("Resumen operacional",40,y); y+=24; doc.setFontSize(11); data.forEach(([a,b])=>{doc.setFont("helvetica","bold");doc.text(String(a),50,y);doc.setFont("helvetica","normal");doc.text(String(b),250,y);y+=22;});
    y+=12; doc.setFont("helvetica","bold"); doc.text("Servicios recientes",40,y); y+=22; doc.setFont("helvetica","normal"); rows.slice(0,18).forEach(s=>{ if(y>720){doc.addPage();y=50;} doc.text(`${s.fecha}  ${s.numero}  ${nameOf(state.clientes,s.clienteId)}  ${money(total(s))}  ${s.estado}`,40,y); y+=18; });
    doc.save(`Reporte_Ejecutivo_PRT_${today()}.pdf`);
  }
  function pdfServices(){ const doc=pdfBase("Listado de Servicios"); let y=116; filteredServices().forEach(s=>{ if(y>720){doc.addPage();y=50;} doc.setFont("helvetica","bold");doc.text(`${s.fecha} · ${s.numero} · ${nameOf(state.clientes,s.clienteId)}`,40,y); y+=15; doc.setFont("helvetica","normal");doc.text(`${s.origen} → ${s.destino} | ${nameOf(state.choferes,s.choferId)} | Total ${money(total(s))} | Balance ${money(balance(s))}`,40,y); y+=24; }); doc.save(`Servicios_PRT_${today()}.pdf`); }
  function exportCsv(){ const head=["fecha","numero","cliente","telefono","origen","destino","tipo","chofer","proveedor","millas","base","peajes","gastos","pagado","total","balance","estado"]; const rows=filteredServices().map(s=>[s.fecha,s.numero,nameOf(state.clientes,s.clienteId),s.telefono,s.origen,s.destino,s.tipo,nameOf(state.choferes,s.choferId),nameOf(state.proveedores,s.proveedorId,""),s.millas,s.base,s.peajes,s.gastos,s.pagado,total(s),balance(s),s.estado]); download("servicios_prt.csv", [head,...rows].map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n"), "text/csv"); }
  function backupJson(){ download(`backup_prt_${today()}.json`, JSON.stringify(state,null,2), "application/json"); }
  function importJson(e){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ state={...base,...JSON.parse(r.result)}; save(); alert("Backup importado."); }catch{ alert("Archivo inválido."); } }; r.readAsText(f); }
  function download(name,content,type){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }

  window.addEventListener("DOMContentLoaded", init);
})();
