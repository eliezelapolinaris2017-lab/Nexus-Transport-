/*************************************************
 SAMMY TOWING INC — Nexus Transport Manager v12+
 Versión extendida y estable con persistencia real
*************************************************/

// ====== Base LocalStorage ======
const store = {
  proveedores: JSON.parse(localStorage.getItem("proveedores") || "[]"),
  choferes: JSON.parse(localStorage.getItem("choferes") || "[]"),
  millas: JSON.parse(localStorage.getItem("millas") || "[]"),
  config: JSON.parse(localStorage.getItem("config") || "{}")
};
function saveAll() { for (const k in store) localStorage.setItem(k, JSON.stringify(store[k])); }

// ====== Configuración inicial ======
store.config.valorMilla ??= 1;
store.config.umbralAlto ??= 1000;
store.config.umbralMedio ??= 400;
store.config.nombre ??= "SAMMY TOWING INC";

// ====== Navegación ======
document.querySelectorAll(".tabs button").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
    if (btn.dataset.tab === "cierres") renderCierre();
    if (btn.dataset.tab === "flujo") renderFlujo();
  };
});

// ====== Proveedores ======
formProveedor.onsubmit = e => {
  e.preventDefault();
  const nombre = provNombre.value.trim(), porc = +provPorc.value;
  if (!nombre) return alert("Ingrese nombre del proveedor");
  store.proveedores.push({ nombre, porc });
  provNombre.value = provPorc.value = "";
  saveAll(); renderProveedores(); actualizarSelects();
};
function renderProveedores() {
  tablaProveedores.innerHTML = "<tr><th>Proveedor</th><th>% Deducción</th><th></th></tr>";
  store.proveedores.forEach((p, i) => {
    tablaProveedores.innerHTML += `
      <tr>
        <td>${p.nombre}</td>
        <td>${p.porc}%</td>
        <td><button onclick="delProv(${i})">🗑️</button></td>
      </tr>`;
  });
}
function delProv(i) { store.proveedores.splice(i, 1); saveAll(); renderProveedores(); }

// ====== Choferes ======
formChofer.onsubmit = e => {
  e.preventDefault();
  const nombre = chNombre.value.trim(), ganancia = +chGanancia.value, deduccion = +chDeduccion.value;
  if (!nombre) return alert("Ingrese nombre del chofer");
  store.choferes.push({ nombre, ganancia, deduccion });
  chNombre.value = chGanancia.value = chDeduccion.value = "";
  saveAll(); renderChoferes(); actualizarSelects();
};
function renderChoferes() {
  tablaChoferes.innerHTML = "<tr><th>Chofer</th><th>% Ganancia</th><th>% Deducción</th><th></th></tr>";
  store.choferes.forEach((c, i) => {
    tablaChoferes.innerHTML += `
      <tr>
        <td>${c.nombre}</td>
        <td>${c.ganancia}%</td>
        <td>${c.deduccion}%</td>
        <td><button onclick="delCh(${i})">🗑️</button></td>
      </tr>`;
  });
}
function delCh(i) { store.choferes.splice(i, 1); saveAll(); renderChoferes(); }

// ====== Selects Dinámicos ======
function actualizarSelects() {
  const chSel = document.getElementById("mChofer"), prSel = document.getElementById("mProveedor");
  chSel.innerHTML = "<option value=''>Seleccionar chofer</option>";
  prSel.innerHTML = "<option value=''>Seleccionar proveedor</option>";
  store.choferes.forEach(c => chSel.innerHTML += `<option>${c.nombre}</option>`);
  store.proveedores.forEach(p => prSel.innerHTML += `<option>${p.nombre}</option>`);
}
actualizarSelects();

// ====== Registro de Millas ======
formMillas.onsubmit = e => {
  e.preventDefault();
  const chofer = mChofer.value, proveedor = mProveedor.value, millas = +mMillas.value;
  if (!chofer || !proveedor || !millas) return alert("Complete todos los campos");
  store.millas.push({ chofer, proveedor, millas });
  mChofer.value = mProveedor.value = mMillas.value = "";
  saveAll(); renderMillas();
};

// ====== KPIs y Filtros ======
function renderMillas() {
  const fc = filtroChofer.value, fp = filtroProveedor.value;
  let data = store.millas.filter(m => (!fc || m.chofer === fc) && (!fp || m.proveedor === fp));
  tablaMillas.innerHTML = "<tr><th>Chofer</th><th>Proveedor</th><th>Millas</th><th></th></tr>";
  data.forEach((m, i) => {
    tablaMillas.innerHTML += `
      <tr>
        <td>${m.chofer}</td><td>${m.proveedor}</td><td>${m.millas}</td>
        <td><button onclick='delM(${i})'>🗑️</button></td>
      </tr>`;
  });

  const vm = store.config.valorMilla || 1, total = data.reduce((a, b) => a + b.millas, 0), valor = total * vm;
  kpiMillas.textContent = total.toFixed(0);
  kpiServicios.textContent = data.length;
  kpiValor.textContent = "$" + valor.toFixed(2);

  // IA de color
  const { umbralAlto, umbralMedio } = store.config;
  const color = valor >= umbralAlto ? "limegreen" : valor >= umbralMedio ? "gold" : "red";
  document.querySelector("#kpiValor").style.boxShadow = `0 0 25px ${color}`;
  document.querySelector("#kpiValor h3").style.color = color;
  document.querySelector("#kpiValor p").style.color = color;
}
filtroChofer.onchange = filtroProveedor.onchange = renderMillas;
btnMostrarTodo.onclick = () => { filtroChofer.value = filtroProveedor.value = ""; renderMillas(); };
function delM(i) { store.millas.splice(i, 1); saveAll(); renderMillas(); }
renderMillas();

// ====== Cierre Semanal ======
function calcularCierre() {
  const vm = store.config.valorMilla, res = {};
  store.millas.forEach(m => {
    const c = store.choferes.find(x => x.nombre === m.chofer); if (!c) return;
    const b = m.millas * vm, g = b * (c.ganancia / 100), d = b * (c.deduccion / 100);
    if (!res[m.chofer]) res[m.chofer] = { millas: 0, bruto: 0, gan: 0, ded: 0 };
    res[m.chofer].millas += m.millas; res[m.chofer].bruto += b; res[m.chofer].gan += g; res[m.chofer].ded += d;
  });
  return res;
}
function renderCierre() {
  const d = calcularCierre();
  let html = "<table><tr><th>Chofer</th><th>Millas</th><th>Bruto</th><th>Ganancia</th><th>Deducción</th><th>Neto</th></tr>";
  for (const c in d) {
    const r = d[c], net = r.gan - r.ded;
    html += `<tr><td>${c}</td><td>${r.millas}</td><td>$${r.bruto.toFixed(2)}</td>
             <td>$${r.gan.toFixed(2)}</td><td>$${r.ded.toFixed(2)}</td><td>$${net.toFixed(2)}</td></tr>`;
  }
  document.getElementById("tablaCierres").innerHTML = html + "</table>";
}

// ====== Flujo de Caja ======
function renderFlujo() {
  const d = calcularCierre(); let tb = 0, tg = 0, td = 0;
  for (const c in d) { tb += d[c].bruto; tg += d[c].gan; td += d[c].ded; }
  const net = tg - td;
  document.getElementById("tablaFlujo").innerHTML = `
    <div class="kpi">
      <div class="kpiCard"><h3>Bruto</h3><p>$${tb.toFixed(2)}</p></div>
      <div class="kpiCard"><h3>Ganancia</h3><p>$${tg.toFixed(2)}</p></div>
      <div class="kpiCard"><h3>Deducción</h3><p>$${td.toFixed(2)}</p></div>
      <div class="kpiCard"><h3>Neto</h3><p>$${net.toFixed(2)}</p></div>
    </div>`;
}

// ====== Configuración ======
saveConfig.onclick = () => {
  store.config.pin = pinInput.value;
  store.config.valorMilla = +valorMillaInput.value || 1;
  store.config.umbralAlto = +umbralAlto.value || 1000;
  store.config.umbralMedio = +umbralMedio.value || 400;
  const f = logoInput.files[0];
  if (f) {
    const r = new FileReader();
    r.onload = e => { store.config.logo = e.target.result; saveAll(); alert("Configuración guardada ✅"); };
    r.readAsDataURL(f);
  } else { saveAll(); alert("Configuración guardada ✅"); }
};

// ====== Backup + Import ======
backupAll.onclick = () => {
  const b = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "backup_sammy_towing.json";
  a.click();
};
const importBtn = document.createElement("button");
importBtn.textContent = "Importar Backup";
config.appendChild(importBtn);
importBtn.onclick = () => {
  const i = document.createElement("input");
  i.type = "file"; i.accept = ".json";
  i.onchange = e => {
    const f = e.target.files[0], r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        for (const k in d) store[k] = d[k];
        saveAll(); alert("Backup restaurado ✅"); location.reload();
      } catch { alert("Error al importar ❌"); }
    };
    r.readAsText(f);
  };
  i.click();
};

// ====== Seguridad ======
logoutBtn.onclick = () => {
  const p = prompt("PIN de seguridad:");
  if (p === store.config.pin) { alert("Sesión cerrada ✅"); location.reload(); }
  else alert("PIN incorrecto ❌");
};

console.log("✅ SAMMY TOWING INC — Nexus Transport Manager v12+ cargado correctamente.");
