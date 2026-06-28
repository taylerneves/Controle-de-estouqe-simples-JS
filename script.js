/* ===================================================
   ESTOQUEI — script.js
   Controle de Estoque Simples
   =================================================== */

'use strict';

/* ========== ESTADO DA APLICAÇÃO ========== */
let produtos = [];       // Array principal de produtos
let nextId   = 1;        // Contador de IDs
let editMode = false;    // true quando editando um produto existente
let currentStockId = null; // ID do produto no modal de estoque

/* ========== CONSTANTES ========== */
const LOW_STOCK_THRESHOLD = 5; // Limite para "estoque baixo"
const STORAGE_KEY_PRODUTOS = 'estoquei_produtos';
const STORAGE_KEY_NEXTID   = 'estoquei_nextId';

/* ========== SELETORES DE DOM ========== */
// Sidebar & navegação
const sidebar       = document.getElementById('sidebar');
const overlay       = document.getElementById('overlay');
const menuToggle    = document.getElementById('menuToggle');
const sidebarClose  = document.getElementById('sidebarClose');
const navItems      = document.querySelectorAll('.nav-item');
const topbarTitle   = document.getElementById('topbarTitle');
const searchWrap    = document.getElementById('searchWrap');

// Seções
const sections = {
  dashboard: document.getElementById('section-dashboard'),
  cadastro:  document.getElementById('section-cadastro'),
  produtos:  document.getElementById('section-produtos'),
};

// Dashboard stats
const statTotal  = document.getElementById('statTotal');
const statItens  = document.getElementById('statItens');
const statBaixo  = document.getElementById('statBaixo');
const statValor  = document.getElementById('statValor');
const lowStockPanel = document.getElementById('lowStockPanel');
const lowStockList  = document.getElementById('lowStockList');

// Formulário de cadastro
const productForm      = document.getElementById('productForm');
const editIdInput      = document.getElementById('editId');
const inputNome        = document.getElementById('inputNome');
const inputCategoria   = document.getElementById('inputCategoria');
const inputQtd         = document.getElementById('inputQtd');
const inputPreco       = document.getElementById('inputPreco');
const btnSubmit        = document.getElementById('btnSubmit');
const btnSubmitLabel   = document.getElementById('btnSubmitLabel');
const btnCancelarEdit  = document.getElementById('btnCancelarEdit');
const catList          = document.getElementById('catList');

// Erros do formulário
const erroNome      = document.getElementById('erroNome');
const erroCategoria = document.getElementById('erroCategoria');
const erroQtd       = document.getElementById('erroQtd');
const erroPreco     = document.getElementById('erroPreco');

// Tabela de produtos
const produtoTbody  = document.getElementById('produtoTbody');
const emptyState    = document.getElementById('emptyState');
const searchInputInline = document.getElementById('searchInputInline');

// Modal de controle de estoque
const stockModal        = document.getElementById('stockModal');
const modalClose        = document.getElementById('modalClose');
const btnModalCancel    = document.getElementById('btnModalCancel');
const modalProductName  = document.getElementById('modalProductName');
const modalCurrentStock = document.getElementById('modalCurrentStock');
const stockQtyInput     = document.getElementById('stockQtyInput');
const btnAdd            = document.getElementById('btnAdd');
const btnRemove         = document.getElementById('btnRemove');
const erroStock         = document.getElementById('erroStock');

// Toast container
const toastContainer = document.getElementById('toastContainer');

/* =====================================================
   PERSISTÊNCIA — LocalStorage
===================================================== */

/** Salva os dados no LocalStorage */
function salvarDados() {
  localStorage.setItem(STORAGE_KEY_PRODUTOS, JSON.stringify(produtos));
  localStorage.setItem(STORAGE_KEY_NEXTID, String(nextId));
}

/** Carrega os dados do LocalStorage */
function carregarDados() {
  const storedProdutos = localStorage.getItem(STORAGE_KEY_PRODUTOS);
  const storedNextId   = localStorage.getItem(STORAGE_KEY_NEXTID);

  if (storedProdutos) {
    try {
      produtos = JSON.parse(storedProdutos);
    } catch {
      produtos = [];
    }
  }

  if (storedNextId) {
    nextId = parseInt(storedNextId, 10) || 1;
  }
}

/* =====================================================
   NAVEGAÇÃO — Seções & Sidebar
===================================================== */

/** Ativa a seção informada e atualiza o nav */
function ativarSecao(nome) {
  // Oculta todas as seções
  Object.values(sections).forEach(s => s.classList.remove('active'));

  // Exibe a seção solicitada
  if (sections[nome]) sections[nome].classList.add('active');

  // Atualiza nav items
  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.section === nome);
  });

  // Atualiza título da topbar
  const titulos = { dashboard: 'Dashboard', cadastro: 'Cadastrar Produto', produtos: 'Produtos' };
  topbarTitle.textContent = titulos[nome] || '';

  // Exibe/oculta barra de pesquisa no topo (só na seção de produtos)
  searchWrap.style.display = nome === 'produtos' ? 'flex' : 'none';

  // Ao abrir a seção de produtos, renderiza a tabela
  if (nome === 'produtos') renderTabela();

  // Fecha sidebar no mobile
  fecharSidebar();
}

/** Abre a sidebar (mobile) */
function abrirSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

/** Fecha a sidebar (mobile) */
function fecharSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* =====================================================
   DASHBOARD
===================================================== */

/** Atualiza todos os cards e o painel de estoque baixo */
function atualizarDashboard() {
  const total  = produtos.length;
  const itens  = produtos.reduce((acc, p) => acc + p.quantidade, 0);
  const baixos = produtos.filter(p => p.quantidade < LOW_STOCK_THRESHOLD);
  const valor  = produtos.reduce((acc, p) => acc + (p.quantidade * p.preco), 0);

  // Anima os números
  animarNumero(statTotal, total);
  animarNumero(statItens, itens);
  animarNumero(statBaixo, baixos.length);
  statValor.textContent = formatarMoeda(valor);

  // Painel de estoque baixo
  if (baixos.length > 0) {
    lowStockPanel.style.display = 'block';
    lowStockList.innerHTML = '';
    baixos.forEach(p => {
      const li = document.createElement('li');
      const badgeClass = p.quantidade === 0 ? 'ls-badge ls-zero' : 'ls-badge';
      li.innerHTML = `
        <i class="ph-bold ph-${p.quantidade === 0 ? 'x-circle' : 'warning'}"></i>
        <span>${escapeHtml(p.nome)}</span>
        <span class="badge-cat">${escapeHtml(p.categoria)}</span>
        <span class="${badgeClass}">${p.quantidade} un.</span>
      `;
      lowStockList.appendChild(li);
    });
  } else {
    lowStockPanel.style.display = 'none';
  }
}

/**
 * Anima a transição de um número num elemento
 * @param {HTMLElement} el
 * @param {number} target
 */
function animarNumero(el, target) {
  const current = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
  if (current === target) return;

  const diff     = target - current;
  const steps    = 20;
  const stepVal  = diff / steps;
  let count      = 0;
  let val        = current;

  const timer = setInterval(() => {
    val += stepVal;
    count++;
    el.textContent = Math.round(val);
    if (count >= steps) {
      el.textContent = target;
      clearInterval(timer);
    }
  }, 16);
}

/* =====================================================
   FORMULÁRIO — Cadastro & Edição
===================================================== */

/** Valida o formulário e retorna true se válido */
function validarFormulario() {
  let valido = true;

  // Limpa erros anteriores
  [erroNome, erroCategoria, erroQtd, erroPreco].forEach(e => e.textContent = '');
  [inputNome, inputCategoria, inputQtd, inputPreco].forEach(i => i.classList.remove('error'));

  const nome      = inputNome.value.trim();
  const categoria = inputCategoria.value.trim();
  const qtd       = inputQtd.value;
  const preco     = inputPreco.value;

  if (!nome) {
    erroNome.textContent = 'Informe o nome do produto.';
    inputNome.classList.add('error');
    valido = false;
  }

  if (!categoria) {
    erroCategoria.textContent = 'Informe a categoria.';
    inputCategoria.classList.add('error');
    valido = false;
  }

  if (qtd === '' || Number(qtd) < 0 || isNaN(Number(qtd))) {
    erroQtd.textContent = 'Informe uma quantidade válida (≥ 0).';
    inputQtd.classList.add('error');
    valido = false;
  }

  if (preco === '' || Number(preco) < 0 || isNaN(Number(preco))) {
    erroPreco.textContent = 'Informe um preço válido (≥ 0).';
    inputPreco.classList.add('error');
    valido = false;
  }

  return valido;
}

/** Reseta o formulário para o modo de cadastro */
function resetarFormulario() {
  productForm.reset();
  editIdInput.value = '';
  editMode = false;
  btnSubmitLabel.textContent = 'Cadastrar Produto';
  btnSubmit.querySelector('i').className = 'ph-bold ph-plus';
  btnCancelarEdit.style.display = 'none';
  [erroNome, erroCategoria, erroQtd, erroPreco].forEach(e => e.textContent = '');
  [inputNome, inputCategoria, inputQtd, inputPreco].forEach(i => i.classList.remove('error'));
}

/** Preenche o formulário com os dados de um produto para edição */
function iniciarEdicao(id) {
  const produto = produtos.find(p => p.id === id);
  if (!produto) return;

  editMode           = true;
  editIdInput.value  = id;
  inputNome.value      = produto.nome;
  inputCategoria.value = produto.categoria;
  inputQtd.value       = produto.quantidade;
  inputPreco.value     = produto.preco;

  btnSubmitLabel.textContent = 'Salvar Alterações';
  btnSubmit.querySelector('i').className = 'ph-bold ph-floppy-disk';
  btnCancelarEdit.style.display = 'inline-flex';

  // Navega para o cadastro e faz scroll até o form
  ativarSecao('cadastro');
  productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  inputNome.focus();
}

/** Submissão do formulário (cadastro ou edição) */
productForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validarFormulario()) return;

  const nome      = inputNome.value.trim();
  const categoria = inputCategoria.value.trim();
  const quantidade = parseInt(inputQtd.value, 10);
  const preco     = parseFloat(parseFloat(inputPreco.value).toFixed(2));

  if (editMode) {
    // === MODO EDIÇÃO ===
    const id = parseInt(editIdInput.value, 10);
    const idx = produtos.findIndex(p => p.id === id);
    if (idx !== -1) {
      produtos[idx] = { ...produtos[idx], nome, categoria, quantidade, preco };
      salvarDados();
      atualizarDashboard();
      atualizarDatalist();
      mostrarToast('Produto atualizado com sucesso!', 'success');
      resetarFormulario();
    }
  } else {
    // === MODO CADASTRO ===
    // Verifica nome duplicado
    const duplicado = produtos.some(p => p.nome.toLowerCase() === nome.toLowerCase());
    if (duplicado) {
      erroNome.textContent = 'Já existe um produto com este nome.';
      inputNome.classList.add('error');
      return;
    }

    const novoProduto = { id: nextId++, nome, categoria, quantidade, preco };
    produtos.push(novoProduto);
    salvarDados();
    atualizarDashboard();
    atualizarDatalist();
    mostrarToast('Produto cadastrado com sucesso!', 'success');
    resetarFormulario();
  }
});

/** Cancela a edição */
btnCancelarEdit.addEventListener('click', () => {
  resetarFormulario();
  mostrarToast('Edição cancelada.', 'warning');
});

/** Atualiza o datalist de categorias */
function atualizarDatalist() {
  const categorias = [...new Set(produtos.map(p => p.categoria))].sort();
  catList.innerHTML = categorias.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
}

/* =====================================================
   EXCLUSÃO
===================================================== */

/** Exclui um produto por ID, com confirmação */
function excluirProduto(id) {
  const produto = produtos.find(p => p.id === id);
  if (!produto) return;

  if (!confirm(`Excluir "${produto.nome}"?\n\nEsta ação não pode ser desfeita.`)) return;

  produtos = produtos.filter(p => p.id !== id);
  salvarDados();
  atualizarDashboard();
  atualizarDatalist();
  renderTabela(searchInputInline.value.trim());
  mostrarToast(`"${produto.nome}" excluído.`, 'error');
}

/* =====================================================
   TABELA DE PRODUTOS
===================================================== */

/** Renderiza a tabela de produtos, opcionalmente filtrada por busca */
function renderTabela(filtro = '') {
  const termo = filtro.toLowerCase().trim();
  const lista = termo
    ? produtos.filter(p => p.nome.toLowerCase().includes(termo))
    : [...produtos];

  produtoTbody.innerHTML = '';

  if (lista.length === 0) {
    emptyState.style.display = 'block';
    document.querySelector('.produto-table').style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  document.querySelector('.produto-table').style.display = 'table';

  lista.forEach(p => {
    const total      = p.quantidade * p.preco;
    const rowClass   = p.quantidade === 0 ? 'row--empty' : (p.quantidade < LOW_STOCK_THRESHOLD ? 'row--low' : '');
    const badgeClass = p.quantidade === 0 ? 'badge badge--empty' : (p.quantidade < LOW_STOCK_THRESHOLD ? 'badge badge--low' : 'badge badge--ok');
    const badgeText  = p.quantidade === 0 ? 'Esgotado' : (p.quantidade < LOW_STOCK_THRESHOLD ? 'Baixo' : 'Normal');
    const badgeIcon  = p.quantidade === 0 ? 'x-circle' : (p.quantidade < LOW_STOCK_THRESHOLD ? 'warning' : 'check-circle');

    const tr = document.createElement('tr');
    if (rowClass) tr.classList.add(rowClass);

    tr.innerHTML = `
      <td>#${p.id}</td>
      <td><strong>${escapeHtml(p.nome)}</strong></td>
      <td>${escapeHtml(p.categoria)}</td>
      <td>${p.quantidade}</td>
      <td>${formatarMoeda(p.preco)}</td>
      <td>${formatarMoeda(total)}</td>
      <td><span class="${badgeClass}"><i class="ph-bold ph-${badgeIcon}"></i>${badgeText}</span></td>
      <td class="actions-cell">
        <button class="btn btn--sm btn--ghost btn--icon" title="Controle de estoque" data-action="stock" data-id="${p.id}">
          <i class="ph-bold ph-arrows-clockwise"></i>
        </button>
        <button class="btn btn--sm btn--ghost btn--icon" title="Editar produto" data-action="edit" data-id="${p.id}">
          <i class="ph-bold ph-pencil-simple"></i>
        </button>
        <button class="btn btn--sm btn--danger btn--icon" title="Excluir produto" data-action="delete" data-id="${p.id}">
          <i class="ph-bold ph-trash"></i>
        </button>
      </td>
    `;

    produtoTbody.appendChild(tr);
  });
}

/** Delegação de eventos na tabela */
produtoTbody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const id     = parseInt(btn.dataset.id, 10);
  const action = btn.dataset.action;

  if (action === 'edit')   iniciarEdicao(id);
  if (action === 'delete') excluirProduto(id);
  if (action === 'stock')  abrirModalEstoque(id);
});

/* =====================================================
   PESQUISA
===================================================== */

// Pesquisa inline (dentro da seção Produtos)
searchInputInline.addEventListener('input', () => {
  renderTabela(searchInputInline.value.trim());
});

/* =====================================================
   MODAL — Controle de Estoque
===================================================== */

/** Abre o modal de controle de estoque para o produto */
function abrirModalEstoque(id) {
  const produto = produtos.find(p => p.id === id);
  if (!produto) return;

  currentStockId = id;
  modalProductName.textContent  = produto.nome;
  modalCurrentStock.textContent = produto.quantidade;
  stockQtyInput.value = 1;
  erroStock.textContent = '';

  stockModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  stockQtyInput.focus();
}

/** Fecha o modal de estoque */
function fecharModalEstoque() {
  stockModal.classList.remove('open');
  document.body.style.overflow = '';
  currentStockId = null;
}

/** Adiciona unidades ao produto atual no modal */
btnAdd.addEventListener('click', () => {
  erroStock.textContent = '';
  const qtd = parseInt(stockQtyInput.value, 10);

  if (isNaN(qtd) || qtd <= 0) {
    erroStock.textContent = 'Informe uma quantidade válida.';
    return;
  }

  const idx = produtos.findIndex(p => p.id === currentStockId);
  if (idx === -1) return;

  produtos[idx].quantidade += qtd;
  salvarDados();
  atualizarDashboard();
  renderTabela(searchInputInline.value.trim());

  modalCurrentStock.textContent = produtos[idx].quantidade;
  mostrarToast(`+${qtd} unidade(s) adicionada(s) a "${produtos[idx].nome}".`, 'success');
  fecharModalEstoque();
});

/** Remove unidades do produto atual no modal */
btnRemove.addEventListener('click', () => {
  erroStock.textContent = '';
  const qtd = parseInt(stockQtyInput.value, 10);
  const idx = produtos.findIndex(p => p.id === currentStockId);
  if (idx === -1) return;

  if (isNaN(qtd) || qtd <= 0) {
    erroStock.textContent = 'Informe uma quantidade válida.';
    return;
  }

  if (qtd > produtos[idx].quantidade) {
    erroStock.textContent = `Não é possível remover mais do que o estoque atual (${produtos[idx].quantidade}).`;
    return;
  }

  produtos[idx].quantidade -= qtd;
  salvarDados();
  atualizarDashboard();
  renderTabela(searchInputInline.value.trim());

  modalCurrentStock.textContent = produtos[idx].quantidade;

  const msg = produtos[idx].quantidade === 0
    ? `Estoque de "${produtos[idx].nome}" zerado!`
    : `-${qtd} unidade(s) removida(s) de "${produtos[idx].nome}".`;

  mostrarToast(msg, produtos[idx].quantidade === 0 ? 'warning' : 'success');
  fecharModalEstoque();
});

// Fechar modal pelos botões
modalClose.addEventListener('click', fecharModalEstoque);
btnModalCancel.addEventListener('click', fecharModalEstoque);

// Fechar modal clicando fora
stockModal.addEventListener('click', (e) => {
  if (e.target === stockModal) fecharModalEstoque();
});

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stockModal.classList.contains('open')) fecharModalEstoque();
});

/* =====================================================
   TOASTS
===================================================== */

/**
 * Exibe uma notificação toast
 * @param {string} msg   - Mensagem
 * @param {'success'|'error'|'warning'|'info'} tipo
 * @param {number} duracao - ms até desaparecer (padrão 3500)
 */
function mostrarToast(msg, tipo = 'success', duracao = 3500) {
  const icons = {
    success: 'check-circle',
    error:   'x-circle',
    warning: 'warning',
    info:    'info',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${tipo}`;
  toast.innerHTML = `<i class="ph-bold ph-${icons[tipo] || 'info'}"></i><span>${escapeHtml(msg)}</span>`;
  toastContainer.appendChild(toast);

  // Remove após a duração
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, duracao);
}

/* =====================================================
   UTILITÁRIOS
===================================================== */

/**
 * Escapa caracteres HTML para evitar XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formata um número como moeda BRL
 * @param {number} valor
 * @returns {string}
 */
function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* =====================================================
   EVENT LISTENERS — Navegação & Sidebar
===================================================== */

// Botões do nav
navItems.forEach(item => {
  item.addEventListener('click', () => ativarSecao(item.dataset.section));
});

// Toggle sidebar (mobile)
menuToggle.addEventListener('click', abrirSidebar);
sidebarClose.addEventListener('click', fecharSidebar);
overlay.addEventListener('click', fecharSidebar);

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

(function init() {
  carregarDados();
  atualizarDashboard();
  atualizarDatalist();
  ativarSecao('dashboard');

  // Se não houver produtos, mostra dica
  if (produtos.length === 0) {
    setTimeout(() => {
      mostrarToast('Bem-vindo! Comece cadastrando seu primeiro produto.', 'info', 5000);
    }, 600);
  }
})();