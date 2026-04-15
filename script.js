/*
GZS Manager - script.js
VERSÃO BLINDADA + FUNCIONALIDADE TOTAL (LOGIN, FUNCIONÁRIOS, VALES, DESCONTOS, FINANCEIRO)
COM FILTROS DE FUNCIONÁRIOS ATIVOS/INATIVOS
*/

(function(){

const LS_KEY = 'gzs_manager_v3';
1
/* -------------------------
UTILS
------------------------- */
function loadStore(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) return JSON.parse(raw);
  } catch{}
  return {};
}

function el(id){ return document.getElementById(id); }

function money(v){
  return "R$ " + Number(v||0).toFixed(2).replace(".",",");
}

const store = loadStore();

/* -------------------------
BLINDAGEM GLOBAL
------------------------- */
store.config ||= {};
store.config.admin ||= { user:"gelozonasul", pass:"1234" };
store.config.settings ||= {
  weeklySalary:400,
  biweeklySalary:700,
  lateLimit:"08:21",
  latePenalty:10,
  mealValue:20,
  dayOffValue:100,
  faltaValue:null
};
store.config.empresa ||= "GZS Manager";

store.employees ||= [];
store.periods ||= {};
store.vales ||= {};
store.descontos ||= {};
store.historico ||= [];

saveStore(store);

function ensureEmployeeStores(id){
  store.periods[id] ||= null;
  store.vales[id] ||= [];
  store.descontos[id] ||= [];
  store.historico[id] ||= [];
}

function isAtraso(entrada){
  if(!entrada) return false;

  const [h1,m1] = entrada.split(":").map(Number);
  const [h2,m2] = store.config.settings.lateLimit.split(":").map(Number);

  return (h1*60+m1) > (h2*60+m2);
}

/* -------------------------
LOGIN
------------------------- */
function setupLogin(){
  const btn = el("btnLogin");
  if(!btn) return;

  btn.addEventListener("click", ()=>{
    const userInput = el("user")?.value?.trim();
const passInput = el("pass")?.value?.trim();

console.log("Digitado:", userInput, passInput);
console.log("Correto:", store.config.admin);

if(!userInput || !passInput){
  alert("Preencha usuário e senha");
  return;
}

    console.log("Tentando login:", userInput, passInput);

    if(userInput === store.config.admin.user && passInput === store.config.admin.pass){
      const token = btoa(userInput + ":" + passInput);
      localStorage.setItem("gzs_logged", JSON.stringify({
  token,
  user: userInput,
  time: Date.now()
}));
      window.location.href = "painel.html";
    } else {
      alert("Usuário ou senha inválidos");
    }
  });
}

function protect(){
  const raw = localStorage.getItem("gzs_logged");
  const p = location.pathname.split("/").pop();

  const paginasProtegidas = [
    "painel.html",
    "funcionario.html",
    "configuracoes.html"
  ];

  if(!paginasProtegidas.includes(p)) return;

  if(!raw){
    location.href = "index.html";
    return;
  }

  try{
    const data = JSON.parse(raw);

    if(!data.token){
      throw new Error("Token inválido");
    }

  }catch{
    localStorage.removeItem("gzs_logged");
    location.href = "index.html";
  }
}
function saveStore(s){

  try{
    const backup = localStorage.getItem(LS_KEY);
    if(backup){
      localStorage.setItem(LS_KEY + "_backup", backup);
    }
  }catch{}

  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

/* -------------------------
PAINEL
------------------------- */
function setupAddEmployee(){
  const btn = el("btnAddEmp");
  if(!btn) return;

  btn.onclick = ()=>{
    const name = prompt("Nome do funcionário:")?.trim();
    if(!name) return;

    const id = Date.now().toString();
    store.employees.push({
      id,
      name,
      payType:"Quinzenal",
      foodMode:"Acumulado",
      active:true
    });

    ensureEmployeeStores(id);
    saveStore(store);
    renderEmployeeList();
  };
}

function renderEmployeeList(filter="todos"){
  const list = el("empList");
  if(!list) return;

  list.innerHTML = "";

  const filteredEmployees = store.employees.filter(emp=>{
    if(filter === "ativos") return emp.active;
    if(filter === "inativos") return !emp.active;
    return true;
  });

function renderEmployeeCounter(){
  const counterEl = el("empCounter");
  if(!counterEl) return;

  const all = store.employees.length;
  const active = store.employees.filter(e=>e.active).length;
  const inactive = all - active;

  counterEl.innerText = `Total: ${all} | Ativos: ${active} | Inativos: ${inactive}`;
}

  filteredEmployees.forEach(emp=>{
    const d = document.createElement("div");
    d.className = "card";

    d.innerHTML = `
      <strong>${emp.name}</strong>

      <div class="actions">      
  <button class="btn btnAbrir" ${emp.active ? "" : "disabled"}>${emp.active ? "Abrir" : "Inativo"}</button>      
  <button class="btn danger btnInativar">${emp.active ? "Inativar" : "Ativar"}</button>      
  <button class="btn danger btnExcluir">Excluir</button>
</div>      
    `;  

    d.querySelector(".btnAbrir").onclick = ()=>{
      if(emp.active) location.href="funcionario.html?id="+emp.id;
    };

    d.querySelector(".btnInativar").onclick = ()=>{
      emp.active = !emp.active;
      saveStore(store);
      renderEmployeeList(filter);
    };

d.querySelector(".btnExcluir").onclick = ()=>{

  const confirmar = confirm(
`Excluir funcionário?

Todos os dados serão apagados:
- períodos
- vales
- descontos
- histórico`
  );

  if(!confirmar) return;

  const id = emp.id;

  // remover funcionário da lista
  store.employees = store.employees.filter(e => e.id !== id);

  // apagar dados vinculados
  delete store.periods[id];
  delete store.vales[id];
  delete store.descontos[id];
  delete store.historico[id];

  saveStore(store);

  renderEmployeeList(filter);

};

    list.appendChild(d);
});

renderEmployeeCounter();  
}

/* -------------------------
FILTRO DE FUNCIONÁRIOS
------------------------- */
function setupEmployeeFilter(){
  const filterEl = el("filterEmployees");
  if(!filterEl) return;

  filterEl.onchange = ()=>{
    renderEmployeeList(filterEl.value);
  };
}

/* -------------------------
RESUMO FINANCEIRO DO PAINEL
------------------------- */
function renderResumoFinanceiroPainel(){

  const box = el("resumoFinanceiroPainel");
  if(!box) return;

  let totalFaltas = 0;
  let totalDescontos = 0;
  let totalVales = 0;
  let totalFolgasAcumuladas = 0;
  let qtdFolgas = 0;

  store.employees.forEach(emp=>{

    if(!emp.active) return;

    const id = emp.id;

    const p = store.periods[id];
    if(p){

      Object.values(p.dias).forEach(d=>{

        if(d.status === "Falta"){
          totalFaltas++;
        }

        if(d.folgaVenda === "Acumulada"){
          qtdFolgas++;
          totalFolgasAcumuladas += store.config.settings.dayOffValue;
        }

      });

    }

    const vales = store.vales[id] || [];
    const descontos = store.descontos[id] || [];


totalVales += vales.reduce((s,v)=>{
  if(p && v.data && v.data >= p.inicio && v.data <= p.fim){
    return s + v.valor;
  }
  return s;
},0);

totalDescontos += descontos.reduce((s,d)=>{
  if(p && d.data && d.data >= p.inicio && d.data <= p.fim){
    return s + d.valor;
  }
  return s;
},0);

  });

  box.innerHTML = `
  <div class="card">

  <h3>Resumo Financeiro Geral</h3>

  <div>Faltas registradas: <strong>${totalFaltas}</strong></div>

  <div>Vales totais: <strong>${money(totalVales)}</strong></div>

  <div>Descontos extras: <strong>${money(totalDescontos)}</strong></div>

  ${qtdFolgas > 0 ? `
  <div>Folgas acumuladas (${qtdFolgas}): 
  <strong>${money(totalFolgasAcumuladas)}</strong></div>
  ` : ""}

  </div>
  `;
}

/* -------------------------
DASHBOARD GERENCIAL
------------------------- */
function renderDashboardGerencial(){

  const box = el("overview");
  if(!box) return;

  let ativos = 0;
  let faltas = 0;
  let totalVales = 0;
  let totalDescontos = 0;
  let folgasAcumuladas = 0;

  store.employees.forEach(emp=>{

    if(emp.active) ativos++;

    const id = emp.id;

    const p = store.periods[id];
    if(p){
      Object.values(p.dias).forEach(d=>{

        if(d.status === "Falta"){
          faltas++;
        }

        if(d.folgaVenda === "Acumulada"){
          folgasAcumuladas++;
        }

      });
    }

    const vales = store.vales[id] || [];
    const descontos = store.descontos[id] || [];


totalVales += vales.reduce((s,v)=>{
  if(p && v.data && v.data >= p.inicio && v.data <= p.fim){
    return s + v.valor;
  }
  return s;
},0);

totalDescontos += descontos.reduce((s,d)=>{
  if(p && d.data && d.data >= p.inicio && d.data <= p.fim){
    return s + d.valor;
  }
  return s;
},0);

  });

  box.innerHTML = `
  
  <div class="card">
    <h4>${ativos}</h4>
    <p>Funcionários Ativos</p>
  </div>

  <div class="card">
    <h4>${faltas}</h4>
    <p>Faltas no período</p>
  </div>

  <div class="card">
    <h4>${money(totalVales)}</h4>
    <p>Vales lançados</p>
  </div>

  <div class="card">
    <h4>${money(totalDescontos)}</h4>
    <p>Descontos extras</p>
  </div>

  ${folgasAcumuladas > 0 ? `
  <div class="card">
    <h4>${folgasAcumuladas}</h4>
    <p>Folgas acumuladas</p>
  </div>
  ` : ""}

  `;

}

function setupValesFuncionario(id){
  const btn = el("btnAddVale");
  if(!btn) return;

  btn.onclick = ()=>{
    const valor = parseFloat(prompt("Valor do vale (R$):"));
    if(isNaN(valor) || valor <= 0) return alert("Valor inválido");

    const data = prompt("Data do vale (YYYY-MM-DD)")?.trim();
    if(!data) return alert("Data inválida");

    const p = store.periods[id];

    if(!p){
      alert("Defina um período antes de lançar vales.");
      return;
    }

    if(data < p.inicio || data > p.fim){
      const confirmar = confirm(
`⚠️ Data fora do período atual!

Período: ${p.inicio} até ${p.fim}

Deseja lançar mesmo assim?`
      );

      if(!confirmar) return;
    }

    store.vales[id].push({ valor, data });
    saveStore(store);

    renderVales(id);
  };

  renderVales(id);
}

function renderVales(id){
  const box = el("listaVales");
  if(!box) return;

  const p = store.periods[id];

  const vales = store.vales[id] || [];

  const filtrados = vales
    .map((v, i) => ({ ...v, index: i }))
    .filter(v => p && v.data && v.data >= p.inicio && v.data <= p.fim);

  if(filtrados.length === 0){
    box.innerHTML = "Nenhum vale neste período";
    return;
  }

  box.innerHTML = filtrados.map(v => `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding:6px;border-bottom:1px solid #eee;">
      
      <span>${v.data} — ${money(v.valor)}</span>
      
      <div>
        <button class="btn btnEditarVale" data-i="${v.index}">✏️</button>
        <button class="btn danger btnExcluirVale" data-i="${v.index}">🗑</button>
      </div>

    </div>
  `).join("");

  box.querySelectorAll(".btnEditarVale").forEach(btn=>{
    btn.onclick = ()=>{
      const i = btn.dataset.i;
      const vale = store.vales[id][i];

      const novoValor = parseFloat(prompt("Novo valor:", vale.valor));
      if(isNaN(novoValor) || novoValor <= 0) return alert("Valor inválido");

      const novaData = prompt("Nova data (YYYY-MM-DD):", vale.data)?.trim();
      if(!novaData) return alert("Data inválida");

      vale.valor = novoValor;
      vale.data = novaData;

      saveStore(store);
      renderVales(id);
    };
  });

  box.querySelectorAll(".btnExcluirVale").forEach(btn=>{
    btn.onclick = ()=>{
      const i = btn.dataset.i;

      const confirmar = confirm("Excluir este vale?");
      if(!confirmar) return;

      store.vales[id].splice(i, 1);

      saveStore(store);
      renderVales(id);
    };
  });
}

/* -------------------------
DESCONTOS
------------------------- */
function setupDescontosFuncionario(id){
  const btn = el("btnAddDesconto");
  if(!btn) return;

  btn.onclick = ()=>{
    const valor = parseFloat(prompt("Valor do desconto (R$):"));
    if(isNaN(valor) || valor <= 0) return alert("Valor inválido");

    const motivo = prompt("Motivo do desconto:")?.trim();
    if(!motivo) return alert("Motivo inválido");

    store.descontos[id].push({ valor, motivo, data:new Date().toISOString().slice(0,10) });
    saveStore(store);
    renderDescontos(id);
  };

  renderDescontos(id);
}

function renderDescontos(id){
  const box = el("listaDescontos");
  if(!box) return;

  const p = store.periods[id];

  const descontos = store.descontos[id] || [];

  const filtrados = descontos
    .map((d, i) => ({ ...d, index: i }))
    .filter(d => p && d.data && d.data >= p.inicio && d.data <= p.fim);

  if(filtrados.length === 0){
    box.innerHTML = "Nenhum desconto neste período";
    return;
  }

  box.innerHTML = filtrados.map(d => `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding:6px;border-bottom:1px solid #eee;">
      
      <span>${d.data} — ${money(d.valor)} (${d.motivo})</span>
      
      <div>
        <button class="btn btnEditarDesconto" data-i="${d.index}">✏️</button>
        <button class="btn danger btnExcluirDesconto" data-i="${d.index}">🗑</button>
      </div>

    </div>
  `).join("");

  // ✏️ EDITAR DESCONTO
  box.querySelectorAll(".btnEditarDesconto").forEach(btn=>{
    btn.onclick = ()=>{
      const i = btn.dataset.i;
      const desconto = store.descontos[id][i];

      const novoValor = parseFloat(prompt("Novo valor:", desconto.valor));
      if(isNaN(novoValor) || novoValor <= 0) return alert("Valor inválido");

      const novoMotivo = prompt("Novo motivo:", desconto.motivo)?.trim();
      if(!novoMotivo) return alert("Motivo inválido");

      const novaData = prompt("Nova data (YYYY-MM-DD):", desconto.data)?.trim();
      if(!novaData) return alert("Data inválida");

      desconto.valor = novoValor;
      desconto.motivo = novoMotivo;
      desconto.data = novaData;

      saveStore(store);
      renderDescontos(id);
    };
  });

  // 🗑 EXCLUIR DESCONTO
  box.querySelectorAll(".btnExcluirDesconto").forEach(btn=>{
    btn.onclick = ()=>{
      const i = btn.dataset.i;

      const confirmar = confirm("Excluir este desconto?");
      if(!confirmar) return;

      store.descontos[id].splice(i, 1);

      saveStore(store);
      renderDescontos(id);
    };
  });
}

/* -------------------------
FUNCIONÁRIO
------------------------- */
function renderFuncionario(){
  const id = new URLSearchParams(location.search).get("id");
  const emp = store.employees.find(e=>e.id===id);
  if(!emp) return location.href="painel.html";

  ensureEmployeeStores(id);

  let visualizandoHistorico = false;
let historicoSelecionado = null;

  const card = el("pointsCard");
  if(!card) return;

  card.innerHTML = `
    <div class="card">
      <h3>${emp.name}</h3>

      <div class="grid" style="margin:15px 0;">
        <div>
          <label class="small">Pagamento do Salário</label>
          <select id="selectPayType" class="input">
            <option value="Semanal" ${emp.payType==="Semanal"?"selected":""}>Semanal</option>
            <option value="Quinzenal" ${emp.payType==="Quinzenal"?"selected":""}>Quinzenal</option>
          </select>
        </div>

        <div>
          <label class="small">Pagamento da Alimentação</label>
          <select id="selectFoodMode" class="input">
            <option value="Acumulado" ${emp.foodMode==="Acumulado"?"selected":""}>Acumulado</option>
            <option value="Diario" ${emp.foodMode==="Diario"?"selected":""}>Diário</option>
          </select>
        </div>
      </div>

      <h4>Período de Apuração</h4>

      <div class="grid">
        <input type="date" id="perInicio" class="input"/>
        <input type="date" id="perFim" class="input"/>
        <button class="btn" id="defPeriodo">Definir período</button>
        <button class="btn danger" id="fecharPeriodo">Fechar período</button>
      </div>

      <div id="periodoAtivo" class="small"></div>
      <div id="tabelaPeriodo"></div>
      <div id="financeiroPeriodo"></div>

<button class="btn" id="btnExportarPDF" style="margin-top:10px;">
  📄 Exportar PDF
</button>

<div id="historicoPeriodos"></div>
    </div>
  `;

  setupValesFuncionario(id);
  setupDescontosFuncionario(id);

  const selPay = el("selectPayType");
  const selFood = el("selectFoodMode");

  if(selPay) selPay.onchange = ()=>{
    emp.payType = selPay.value;
    saveStore(store);
    renderTabela();
  };

  if(selFood) selFood.onchange = ()=>{
    emp.foodMode = selFood.value;
    saveStore(store);
    renderTabela();
  };

  el("defPeriodo")?.addEventListener("click", ()=>{
    const inicio = el("perInicio")?.value;
    const fim = el("perFim")?.value;
    if(!inicio || !fim) return alert("Informe o período completo");

    const dias = {};
    let d = new Date(inicio);
    const f = new Date(fim);

    while(d <= f){
      const key = d.toISOString().slice(0,10);
      dias[key] = { entrada:"", saida:"", status:"Presente", folgaVenda:"Nenhuma" };
      d.setDate(d.getDate()+1);
    }

    store.periods[id] = { inicio, fim, fechado:false, dias };
    saveStore(store);
    renderTabela();
  });

  el("fecharPeriodo")?.addEventListener("click", ()=>{
    const pAtual = store.periods[id];
if(!pAtual) return;

ensureEmployeeStores(id);

pAtual.fechado = true;

store.historico[id].push(
  JSON.parse(JSON.stringify({
    ...pAtual,
    fechadoEm: new Date().toISOString()
  }))
);

saveStore(store);

    const fimAtual = new Date(pAtual.fim);
    fimAtual.setDate(fimAtual.getDate() + 1);
    const inicioNovo = fimAtual.toISOString().slice(0,10);

    const diasNovo = emp.payType === "Semanal" ? 6 : 14;
    const fimNovoDate = new Date(fimAtual);
    fimNovoDate.setDate(fimNovoDate.getDate() + diasNovo);
    const fimNovo = fimNovoDate.toISOString().slice(0,10);

    const dias = {};
    let d = new Date(inicioNovo);
    const f = new Date(fimNovo);
    while(d <= f){
      const key = d.toISOString().slice(0,10);
      dias[key] = { entrada:"", saida:"", status:"Presente", folgaVenda:"Nenhuma" };
      d.setDate(d.getDate() + 1);
    }

    store.periods[id] = { inicio: inicioNovo, fim: fimNovo, fechado: false, dias };
    saveStore(store);

    alert(`Período fechado com sucesso! Novo período de ${inicioNovo} até ${fimNovo} criado.`);
renderTabela();
renderVales(id);
renderDescontos(id);
renderHistorico(id);
  });

  if(store.periods[id]) renderTabela();

renderHistorico(id);

el("btnExportarPDF")?.addEventListener("click", ()=>{
  exportarPDF(id);
});

function renderHistorico(id){
  const box = el("historicoPeriodos");
  if(!box) return;

  const historico = store.historico[id] || [];

  if(historico.length === 0){
    box.innerHTML = `
      <div class="card">
        <h4>Histórico de Períodos</h4>
        <div class="small">Nenhum período fechado ainda</div>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="card">
      <h4>Histórico de Períodos</h4>

      ${historico.map((h, index) => `
  <div 
    class="itemHistorico" 
    data-i="${index}"
    style="margin-bottom:8px;padding:8px;border-bottom:1px solid #eee;cursor:pointer;">
    
    <div><strong>${h.inicio} → ${h.fim}</strong></div>
    <div class="small">Fechado em: ${new Date(h.fechadoEm).toLocaleDateString()}</div>

  </div>
`).join("")}

    </div>
  `;

  // 🔥 NOVO BLOCO (ESSA É A PARTE QUE VOCÊ ADICIONA)
  box.querySelectorAll(".itemHistorico").forEach(item=>{
    item.onclick = ()=>{
      const index = item.dataset.i;
      abrirHistoricoPeriodo(id, index);
    };
  });

}

function abrirHistoricoPeriodo(id, index){
  const h = store.historico[id][index];
  if(!h) return;

  visualizandoHistorico = true;
historicoSelecionado = h;

  const box = el("tabelaPeriodo");
  el("defPeriodo").disabled = true;
el("fecharPeriodo").disabled = true;
  const financeiro = el("financeiroPeriodo");

  // 🔒 trava visual de período
  el("periodoAtivo").innerText =
    `Histórico: ${h.inicio} até ${h.fim} (FECHADO)`;

  let totalFalta = 0;
  let totalAtrasos = 0;

  let html = `<table class="table">
  <tr>
    <th>Data</th><th>Status</th><th>Folga</th><th>Entrada</th><th>Saída</th>
  </tr>`;

  Object.entries(h.dias).forEach(([data,info])=>{

    if(info.status==="Falta") totalFalta++;
    if(info.status==="Presente" && isAtraso(info.entrada)) totalAtrasos++;

    html += `<tr>
      <td>${data}</td>
      <td>${info.status}</td>
      <td>${info.folgaVenda}</td>
      <td>${info.entrada || "-"}</td>
      <td>${info.saida || "-"}</td>
    </tr>`;
  });

  html += "</table>";
  box.innerHTML = html;

  // 💰 cálculo igual ao período normal (congelado)
  const emp = store.employees.find(e=>e.id===id);

  let salarioPeriodo = emp.payType==="Semanal"
    ? store.config.settings.weeklySalary
    : store.config.settings.biweeklySalary;

  let diasPeriodo = emp.payType==="Semanal"? 7 : 15;
  const valorDia = salarioPeriodo / diasPeriodo;

  const valorFaltaConfig = store.config.settings.faltaValue;

  const descontoFaltas = totalFalta * (
    valorFaltaConfig !== null ? valorFaltaConfig : valorDia
  );

  const descontoAtrasos = totalAtrasos * store.config.settings.latePenalty;

  const totalVales = (store.vales[id] || []).reduce((s,v)=>{
    if(v.data >= h.inicio && v.data <= h.fim){
      return s + v.valor;
    }
    return s;
  },0);

  const totalDescontos = (store.descontos[id] || []).reduce((s,d)=>{
    if(d.data >= h.inicio && d.data <= h.fim){
      return s + d.valor;
    }
    return s;
  },0);

  let totalAlimentacao = 0;
  Object.values(h.dias).forEach(info=>{
    if(info.status==="Presente" && info.entrada){
      totalAlimentacao += store.config.settings.mealValue;
    }
  });

  let totalFolga = 0;
  Object.values(h.dias).forEach(info=>{
    if(info.folgaVenda==="Acumulada"){
      totalFolga += store.config.settings.dayOffValue;
    }
  });

  const salarioFinal =
  salarioPeriodo
  - descontoFaltas
  - descontoAtrasos
  - totalVales
  - totalDescontos
  + totalAlimentacao
  + totalFolga;

financeiro.innerHTML = `
  <div class="card">

    <!-- 🔥 BOTÃO NOVO -->
    <button class="btn" id="voltarPeriodo" style="margin-bottom:10px;">
      ⬅ Voltar ao período atual
    </button>

    <h4>Resumo do Período (Histórico)</h4>

    <div>Salário: ${money(salarioPeriodo)}</div>
    <div>Faltas: - ${money(descontoFaltas)}</div>
    <div>Atrasos: - ${money(descontoAtrasos)}</div>
    <div>Vales: - ${money(totalVales)}</div>
    <div>Descontos: - ${money(totalDescontos)}</div>
    <div>Alimentação: + ${money(totalAlimentacao)}</div>
    <div>Folgas: + ${money(totalFolga)}</div>

    <hr>
    <strong>Total: ${money(salarioFinal)}</strong>
  </div>
`;

el("voltarPeriodo").onclick = ()=>{
  visualizandoHistorico = false;
  historicoSelecionado = null;

  renderTabela();
renderVales(id);
renderDescontos(id);

el("defPeriodo").disabled = false;
el("fecharPeriodo").disabled = false;

  const pAtual = store.periods[id];

el("periodoAtivo").innerText =
  `Período: ${pAtual.inicio} até ${pAtual.fim} ${pAtual.fechado ? "(FECHADO)" : ""}`;
};
}

function renderTabela(){

  if(visualizandoHistorico) return;

  const p = historicoSelecionado || store.periods[id];
  if(!p) return;

    el("periodoAtivo") && (el("periodoAtivo").innerText =
      `Período: ${p.inicio} até ${p.fim} ${p.fechado ? "(FECHADO)" : ""}`
    );

    let totalFalta=0, totalAtrasos=0;

    let html = `<table class="table">
    <tr>
    <th>Data</th><th>Status</th><th>Folga</th><th>Entrada</th><th>Saída</th>
    </tr>`;

    Object.entries(p.dias).forEach(([data,info])=>{

  if(info.status !== "Folga"){
    info.folgaVenda = "Nenhuma";
  }

  if(info.status==="Falta") totalFalta++;
  if(info.status==="Presente" && isAtraso(info.entrada)) totalAtrasos++;

      html += `<tr>
        <td>${data}</td>
        <td>
          <select data-date="${data}" data-d="status" ${p.fechado ? "disabled" : ""}>
            <option ${info.status==="Presente"?"selected":""}>Presente</option>
            <option ${info.status==="Falta"?"selected":""}>Falta</option>
            <option ${info.status==="Folga"?"selected":""}>Folga</option>
          </select>
        </td>
        <td>
         <select data-date="${data}" data-d="folgaVenda" ${p.fechado || info.status !== "Folga" ? "disabled" : ""}>
            <option ${info.folgaVenda==="Nenhuma"?"selected":""}>Nenhuma</option>
            <option ${info.folgaVenda==="Paga"?"selected":""}>Paga</option>
            <option ${info.folgaVenda==="Acumulada"?"selected":""}>Acumulada</option>
          </select>
        </td>
        <td><input type="time" data-d="entrada" data-date="${data}" value="${info.entrada}" ${p.fechado ? "disabled" : ""}></td>
        <td><input type="time" data-d="saida" data-date="${data}" value="${info.saida}" ${p.fechado ? "disabled" : ""}></td>
      </tr>`;
    });

    html += "</table>";
    el("tabelaPeriodo") && (el("tabelaPeriodo").innerHTML = html);

    el("tabelaPeriodo")?.querySelectorAll("input,select").forEach(inp=>{
      inp.onchange = ()=>{
        const d = inp.dataset.date;
        const k = inp.dataset.d;
        p.dias[d][k] = inp.value;
        saveStore(store);
        renderTabela();
      };
    });

    let salarioPeriodo = emp.payType==="Semanal"
  ? store.config.settings.weeklySalary
  : store.config.settings.biweeklySalary;

    let diasPeriodo = emp.payType==="Semanal"? 7 : 15;
    const valorDia = salarioPeriodo / diasPeriodo;

const valorFaltaConfig = store.config.settings.faltaValue;

const descontoFaltas = totalFalta * (
  valorFaltaConfig !== null
    ? valorFaltaConfig
    : valorDia
);
    let totalAlimentacao = 0;

    if(emp.foodMode==="Acumulado"){
      Object.values(p.dias).forEach(info=>{
        if(info.status==="Presente" && info.entrada && info.entrada.trim() !== "") {
          totalAlimentacao += store.config.settings.mealValue;
        }
      });
    }

    let qtdFolgasAcumuladas = 0;
    let totalFolgaAcumulada = 0;

    Object.values(p.dias).forEach(info=>{
      if(info.folgaVenda === "Acumulada"){
        qtdFolgasAcumuladas++;
        totalFolgaAcumulada += store.config.settings.dayOffValue;
      }
    });

    const totalVales = (store.vales[id] || []).reduce((s, v) => {
  if(v.data && v.data >= p.inicio && v.data <= p.fim){
    return s + v.valor;
  }
  return s;
}, 0);

const totalDescontos = (store.descontos[id] || []).reduce((s, d) => {
  if(d.data && d.data >= p.inicio && d.data <= p.fim){
    return s + d.valor;
  }
  return s;
}, 0);

    const descontoAtrasos = totalAtrasos * store.config.settings.latePenalty;

    const salarioFinal =
      salarioPeriodo
      - descontoFaltas
      - descontoAtrasos
      - totalVales
      - totalDescontos
      + totalAlimentacao
      + totalFolgaAcumulada;

    el("financeiroPeriodo") && (el("financeiroPeriodo").innerHTML = `
      <div class="card" style="padding:20px;background:#fdfdfd;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);max-width:400px;margin:10px 0;">
        <h4 style="margin-bottom:15px;border-bottom:1px solid #eee;padding-bottom:5px;">Resumo Financeiro</h4>

        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span>Salário Base:</span>
          <span>${money(salarioPeriodo)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span>Desconto por Faltas (${totalFalta}):</span>
          <span style="color:#e74c3c;">- ${money(descontoFaltas)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span>Desconto por Atrasos (${totalAtrasos}):</span>
          <span style="color:#e74c3c;">- ${money(descontoAtrasos)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span>Vales:</span>
          <span style="color:#e74c3c;">- ${money(totalVales)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span>Descontos Extras:</span>
          <span style="color:#e74c3c;">- ${money(totalDescontos)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;margin:15px 0;border-top:1px solid #eee;border-bottom:1px solid #eee;padding:10px 0;font-weight:bold;">
          <span>Alimentação Acumulada:</span>
          <span style="color:#27ae60;">+ ${money(totalAlimentacao)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span>Folgas Acumuladas (${qtdFolgasAcumuladas}):</span>
          <span style="color:#27ae60;">+ ${money(totalFolgaAcumulada)}</span>
        </div>

        <div style="text-align:center;margin-top:15px;">
          <h3 style="color:#2c3e50;">Total a Receber: ${money(salarioFinal)}</h3>
        </div>

      </div>
    `);
  }
}

function exportarPDF(id){

  const emp = store.employees.find(e=>e.id===id);
  const p = historicoSelecionado || store.periods[id];

  if(!p){
    alert("Nenhum período ativo para exportar");
    return;
  }

  const tabela = el("tabelaPeriodo")?.innerHTML || "";
  const financeiro = el("financeiroPeriodo")?.innerHTML || "";

  const conteudo = `
    <div style="font-family:Arial;padding:20px;">
      <h2>${store.config.empresa}</h2>
      <h3>Funcionário: ${emp.name}</h3>
      <p>Período: ${p.inicio} até ${p.fim}</p>

      <hr>

      <h4>Registro de Dias</h4>
      ${tabela}

      <hr>

      <h4>Resumo Financeiro</h4>
      ${financeiro}
    </div>
  `;

  const opt = {
    margin:       0.5,
    filename:     `${emp.name}_${p.inicio}_${p.fim}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().from(conteudo).set(opt).save();
}

function init(){
  setupLogin();
  protect();

  const p = location.pathname.split("/").pop();

 if(p==="painel.html"){
  renderEmployeeList();
  setupEmployeeFilter();
  setupAddEmployee();
  renderResumoFinanceiroPainel();
  renderDashboardGerencial();

  renderEmployeeCounter();
  applyEmpresaConfig();
}

  if(p==="funcionario.html"){
    renderFuncionario();
  }
}

init();

})();
