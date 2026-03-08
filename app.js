/**
 * GNX - Gestor de Nexos
 * Main Application Logic
 */

const STORAGE_KEY = 'gnx_data';
const CURRENT_USER_KEY = 'gnx_user';

// Mock Data Structure
const defaultData = {
    users: [], // { id, name, email, password, company }
    clientes: [], // { id, nome, email, telefone, endereco }
    produtos: [], // { id, nome, desc, compra, venda, margem }
    vendas: [], // { id, num, clientId, date, items[], total, status }
    parcelas: [], // { id, vendaId, clientId, num, date, value, status }
};

// State
let appData = null;
let currentUser = null;
let currentVendaItems = [];

// Initialize Lucide Icons
lucide.createIcons();

// Elements Cache
const els = {
    authView: document.getElementById('auth-view'),
    mainLayout: document.getElementById('main-layout'),
    toastContainer: document.getElementById('toast-container'),
    
    // Auth Forms
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    linkRegister: document.getElementById('link-register'),
    linkLogin: document.getElementById('link-login'),
    
    // User UI
    userName: document.getElementById('user-name'),
    userCompany: document.getElementById('user-company'),
    userInitial: document.getElementById('user-initial'),
    btnLogout: document.getElementById('btn-logout'),
    
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    pageViews: document.querySelectorAll('.page-view'),
    pageTitle: document.getElementById('page-title'),
    
    // Badges
    parcelasBadge: document.getElementById('parcelas-badge'),
    notifBadge: document.getElementById('notif-badge'),
    dashAlertas: document.getElementById('dash-alertas-parcelas'),
};

// Utils
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function formatDate(dateStr) {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('pt-BR', options);
}

function formatCurrency(value) {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrency(str) {
    // Basic parser for inputs
    if(typeof str === 'number') return str;
    return Number(str.replace(/[^0-9.-]+/g,""));
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function loadState() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        appData = JSON.parse(data);
    } else {
        appData = JSON.parse(JSON.stringify(defaultData));
        saveState();
    }
}

// Toast Notifications
window.showToast = function(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info';
    if(type === 'success') icon = 'check-circle';
    if(type === 'error') icon = 'alert-octagon';
    if(type === 'warning') icon = 'alert-triangle';

    toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
    els.toastContainer.appendChild(toast);
    lucide.createIcons({ root: toast });

    setTimeout(() => {
        toast.style.animation = 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Global App Object
window.app = {
    // Navigation
    navigate: function(viewId) {
        els.pageViews.forEach(v => v.classList.add('hidden'));
        els.navItems.forEach(n => n.classList.remove('active'));
        
        const view = document.getElementById(`${viewId}-view`);
        if(view) view.classList.remove('hidden');
        
        const nav = Array.from(els.navItems).find(n => n.dataset.view === viewId);
        if(nav) nav.classList.add('active');
        
        const titles = {
            'dashboard': 'Dashboard Geral',
            'clientes': 'Gestão de Clientes',
            'produtos': 'Catálogo de Produtos',
            'vendas': 'Registro de Vendas',
            'parcelas': 'Controle de Parcelas',
            'relatorios': 'Relatórios Gerenciais'
        };
        els.pageTitle.textContent = titles[viewId] || 'GNX';

        // View specific logic
        if(viewId === 'dashboard') this.renderDashboard();
        if(viewId === 'clientes') this.renderClientes();
        if(viewId === 'produtos') this.renderProdutos();
        if(viewId === 'vendas') this.renderVendas();
        if(viewId === 'parcelas') this.renderParcelas();
        
        this.updateBadges();
    },

    // Modals
    openModal: function(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
        if(modalId === 'modal-cliente') document.getElementById('form-cliente').reset();
        if(modalId === 'modal-produto') document.getElementById('form-produto').reset();
        if(modalId === 'modal-venda') {
            document.getElementById('form-venda').reset();
            currentVendaItems = [];
            this.updateVendaClientOpts();
            this.updateVendaProdutoOpts();
            this.renderVendaItems();
        }
    },

    closeModal: function(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    },

    // Badges & Alerts
    updateBadges: function() {
        // Check pending/late parcels within 1 day or late
        const today = new Date();
        today.setHours(0,0,0,0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let alertCount = 0;
        els.dashAlertas.innerHTML = '';

        appData.parcelas.forEach(p => {
            if(p.status === 'pago') return;
            
            const pDate = new Date(p.date + 'T00:00:00');
            
            let isLate = pDate < today;
            let isWarning = pDate.getTime() === tomorrow.getTime() || pDate.getTime() === today.getTime();

            if (isLate || isWarning) {
                alertCount++;
                if (p.status !== 'atrasado' && isLate) {
                    p.status = 'atrasado'; // Auto update
                    saveState();
                }
                
                // Add to dashboard
                const cliente = appData.clientes.find(c => c.id === p.clientId) || {nome: 'Desconhecido'};
                const div = document.createElement('div');
                div.className = `alert-item ${isLate ? 'danger' : ''}`;
                div.innerHTML = `
                    <div class="alert-content">
                        <p><strong>${cliente.nome}</strong> - Parcela ${p.num}</p>
                        <span>Vence em: ${formatDate(p.date)} - ${formatCurrency(p.value)}</span>
                    </div>
                `;
                els.dashAlertas.appendChild(div);
            }
        });

        if(els.dashAlertas.children.length === 0) {
            els.dashAlertas.innerHTML = '<p class="text-sm text-muted p-2">Nenhum alerta pendente.</p>';
        }

        if(alertCount > 0) {
            els.parcelasBadge.textContent = alertCount;
            els.parcelasBadge.classList.remove('hidden');
            els.notifBadge.classList.remove('hidden');
        } else {
            els.parcelasBadge.classList.add('hidden');
            els.notifBadge.classList.add('hidden');
        }
    },

    // -------------------------------------------------------------
    // Dashboard
    // -------------------------------------------------------------
    renderDashboard: function() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        
        let vrMes = 0;
        let fatTotal = 0;
        let cstTotal = 0;

        const ultimas = [];

        appData.vendas.forEach(v => {
            fatTotal += v.total;
            
            // Calc costs for profit
            v.items.forEach(i => {
                const p = appData.produtos.find(prod => prod.id === i.prodId);
                if(p) cstTotal += (p.compra * i.qtd);
            });

            const vDate = new Date(v.date);
            if(vDate >= firstDay) {
                vrMes++;
            }

            ultimas.push(v);
        });

        const lucro = fatTotal - cstTotal;
        const tmed = vrMes > 0 ? (fatTotal / appData.vendas.length) : 0; // ticket total time average

        document.getElementById('dash-vendas-mes').textContent = vrMes;
        document.getElementById('dash-faturamento').textContent = formatCurrency(fatTotal);
        document.getElementById('dash-lucro').textContent = formatCurrency(lucro);
        document.getElementById('dash-ticket').textContent = formatCurrency(tmed);

        // Ultimas Vendas
        const tBody = document.getElementById('dash-ultimas-vendas');
        tBody.innerHTML = '';
        ultimas.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5).forEach(v => {
            const c = appData.clientes.find(cli => cli.id === v.clientId) || {nome: 'N/A'};
            tBody.innerHTML += `
                <tr>
                    <td>#${v.num}</td>
                    <td>${c.nome}</td>
                    <td>${formatDate(v.date)}</td>
                    <td>${formatCurrency(v.total)}</td>
                    <td><span class="badge-status status-${v.status}">${v.status}</span></td>
                </tr>
            `;
        });
    },

    // -------------------------------------------------------------
    // Clientes
    // -------------------------------------------------------------
    renderClientes: function() {
        const search = document.getElementById('search-clientes').value.toLowerCase();
        const tbody = document.getElementById('table-clientes');
        tbody.innerHTML = '';

        appData.clientes.filter(c => c.nome.toLowerCase().includes(search)).forEach(c => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${c.nome}</strong></td>
                    <td>${c.email}</td>
                    <td>${c.telefone}</td>
                    <td>
                        <button class="icon-btn" title="Editar" onclick="app.editCliente('${c.id}')"><i data-lucide="edit-2"></i></button>
                        <button class="icon-btn text-danger" title="Excluir" onclick="app.delCliente('${c.id}')"><i data-lucide="trash-2"></i></button>
                    </td>
                </tr>
            `;
        });
        lucide.createIcons({root: tbody});
    },
    
    editCliente: function(id) {
        const c = appData.clientes.find(x => x.id === id);
        if(!c) return;
        document.getElementById('cli-id').value = c.id;
        document.getElementById('cli-nome').value = c.nome;
        document.getElementById('cli-email').value = c.email;
        document.getElementById('cli-telefone').value = c.telefone;
        document.getElementById('cli-endereco').value = c.endereco;
        document.getElementById('cliente-modal-title').textContent = 'Editar Cliente';
        this.openModal('modal-cliente');
    },

    delCliente: function(id) {
        if(confirm('Tem certeza que deseja excluir?')) {
            appData.clientes = appData.clientes.filter(x => x.id !== id);
            saveState();
            this.renderClientes();
            showToast('Cliente excluído', 'success');
        }
    },

    // -------------------------------------------------------------
    // Produtos
    // -------------------------------------------------------------
    calcMargin: function() {
        const c = parseFloat(document.getElementById('prod-compra').value);
        const v = parseFloat(document.getElementById('prod-venda').value);
        const disp = document.getElementById('prod-margin-display');
        if(c > 0 && v >= c) {
            const m = ((v - c) / v) * 100;
            disp.textContent = m.toFixed(2) + '%';
        } else {
            disp.textContent = '0.00%';
        }
    },

    renderProdutos: function() {
        const search = document.getElementById('search-produtos').value.toLowerCase();
        const tbody = document.getElementById('table-produtos');
        tbody.innerHTML = '';

        appData.produtos.filter(p => p.nome.toLowerCase().includes(search)).forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${p.nome}</strong></td>
                    <td>${p.desc.substring(0,30)}</td>
                    <td>${formatCurrency(p.compra)}</td>
                    <td>${formatCurrency(p.venda)}</td>
                    <td><span class="text-success">${p.margem}%</span></td>
                    <td>
                        <button class="icon-btn" title="Editar" onclick="app.editProduto('${p.id}')"><i data-lucide="edit-2"></i></button>
                        <button class="icon-btn text-danger" title="Excluir" onclick="app.delProduto('${p.id}')"><i data-lucide="trash-2"></i></button>
                    </td>
                </tr>
            `;
        });
        lucide.createIcons({root: tbody});
    },

    editProduto: function(id) {
        const p = appData.produtos.find(x => x.id === id);
        if(!p) return;
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-nome').value = p.nome;
        document.getElementById('prod-desc').value = p.desc;
        document.getElementById('prod-compra').value = p.compra;
        document.getElementById('prod-venda').value = p.venda;
        this.calcMargin();
        document.getElementById('produto-modal-title').textContent = 'Editar Produto';
        this.openModal('modal-produto');
    },

    delProduto: function(id) {
        if(confirm('Tem certeza que deseja excluir?')) {
            appData.produtos = appData.produtos.filter(x => x.id !== id);
            saveState();
            this.renderProdutos();
            showToast('Produto excluído', 'success');
        }
    },

    // -------------------------------------------------------------
    // Vendas
    // -------------------------------------------------------------
    updateVendaClientOpts: function() {
        const sel = document.getElementById('venda-cliente');
        sel.innerHTML = '<option value="">Selecione um cliente...</option>';
        appData.clientes.forEach(c => {
            sel.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
        });
    },

    updateVendaProdutoOpts: function() {
        const sel = document.getElementById('venda-produto-sel');
        sel.innerHTML = '<option value="">Selecione um produto...</option>';
        appData.produtos.forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${p.nome} - ${formatCurrency(p.venda)}</option>`;
        });
    },

    addVendaItem: function() {
        const sel = document.getElementById('venda-produto-sel');
        const prodId = sel.value;
        const qtd = parseInt(document.getElementById('venda-qtd').value);
        
        if(!prodId || qtd < 1) return;
        
        const prod = appData.produtos.find(p => p.id === prodId);
        if(!prod) return;

        // Check if already in list
        const ex = currentVendaItems.find(i => i.prodId === prodId);
        if(ex) {
            ex.qtd += qtd;
            ex.subtotal = ex.qtd * ex.preco;
        } else {
            currentVendaItems.push({
                prodId: prod.id,
                nome: prod.nome,
                qtd: qtd,
                preco: prod.venda,
                subtotal: qtd * prod.venda
            });
        }
        
        this.renderVendaItems();
    },

    removeVendaItem: function(idx) {
        currentVendaItems.splice(idx, 1);
        this.renderVendaItems();
    },

    renderVendaItems: function() {
        const tbody = document.getElementById('venda-items-tbody');
        tbody.innerHTML = '';
        let total = 0;
        
        currentVendaItems.forEach((i, idx) => {
            total += i.subtotal;
            tbody.innerHTML += `
                <tr>
                    <td>${i.nome}</td>
                    <td>${i.qtd}</td>
                    <td>${formatCurrency(i.preco)}</td>
                    <td>${formatCurrency(i.subtotal)}</td>
                    <td><button type="button" class="icon-btn text-danger" onclick="app.removeVendaItem(${idx})"><i data-lucide="x-circle"></i></button></td>
                </tr>
            `;
        });
        
        document.getElementById('venda-total').textContent = formatCurrency(total);
        lucide.createIcons({root: tbody});
    },

    renderVendas: function() {
        const tbody = document.getElementById('table-vendas');
        tbody.innerHTML = '';

        const vendasSorted = [...appData.vendas].sort((a,b) => new Date(b.date) - new Date(a.date));

        vendasSorted.forEach(v => {
            const cliente = appData.clientes.find(c => c.id === v.clientId) || {nome: 'N/A'};
            tbody.innerHTML += `
                <tr>
                    <td><strong>#${v.num}</strong></td>
                    <td>${cliente.nome}</td>
                    <td>${formatDate(v.date)}</td>
                    <td><strong>${formatCurrency(v.total)}</strong></td>
                    <td><span class="badge-status status-${v.status}">${v.status}</span></td>
                    <td>
                        <button class="icon-btn text-danger" title="Cancelar Venda" onclick="app.cancelarVenda('${v.id}')"><i data-lucide="slash"></i></button>
                    </td>
                </tr>
            `;
        });
        lucide.createIcons({root: tbody});
    },

    cancelarVenda: function(id) {
        if(confirm('Cancelar venda e excluir parcelas pendentes?')) {
            const v = appData.vendas.find(x => x.id === id);
            if(v) v.status = 'cancelado';
            // remove pending parcels
            appData.parcelas = appData.parcelas.filter(p => !(p.vendaId === id && p.status === 'pendente'));
            saveState();
            this.renderVendas();
            showToast('Venda cancelada', 'warning');
        }
    },

    // -------------------------------------------------------------
    // Parcelas
    // -------------------------------------------------------------
    renderParcelas: function(filter = 'todas') {
        const tbody = document.getElementById('table-parcelas');
        tbody.innerHTML = '';

        let list = appData.parcelas;
        if(filter !== 'todas') {
            list = list.filter(p => p.status === filter);
        }

        // sort by date asc
        list.sort((a,b) => new Date(a.date) - new Date(b.date));

        list.forEach(p => {
            const venda = appData.vendas.find(v => v.id === p.vendaId) || {num: 'N/A'};
            const cliente = appData.clientes.find(c => c.id === p.clientId) || {nome: 'N/A'};
            
            let actBtn = '';
            if(p.status !== 'pago') {
                actBtn = `<button class="btn btn-sm btn-primary" onclick="app.pagarParcela('${p.id}')"><i data-lucide="check"></i> Pagar</button>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td>
                        <div class="text-sm">VDA #${venda.num}</div>
                        <strong>${cliente.nome}</strong>
                    </td>
                    <td>${p.num}</td>
                    <td>${formatDate(p.date)}</td>
                    <td><strong>${formatCurrency(p.value)}</strong></td>
                    <td><span class="badge-status status-${p.status}">${p.status}</span></td>
                    <td>${actBtn}</td>
                </tr>
            `;
        });
        
        // update tabs ui
        document.querySelectorAll('#parcelas-view .tab').forEach(t => {
            t.classList.toggle('active', t.dataset.filter === filter);
        });

        lucide.createIcons({root: tbody});
    },

    pagarParcela: function(id) {
        if(confirm('Confirmar pagamento desta parcela?')) {
            const p = appData.parcelas.find(x => x.id === id);
            if(p) {
                p.status = 'pago';
                
                // check if entire venda is paid
                const allVendaParcels = appData.parcelas.filter(parc => parc.vendaId === p.vendaId);
                const allPaid = allVendaParcels.every(parc => parc.status === 'pago');
                if(allPaid) {
                    const v = appData.vendas.find(x => x.id === p.vendaId);
                    if(v) v.status = 'pago';
                }

                saveState();
                this.renderParcelas();
                this.updateBadges();
                showToast('Pacela paga!', 'success');
            }
        }
    },

    // -------------------------------------------------------------
    // Relatórios (Mock logic for now)
    // -------------------------------------------------------------
    generateReport: function() {
        const d1 = document.getElementById('rel-start').value;
        const d2 = document.getElementById('rel-end').value;
        
        let msg = 'Gerando relatório PDF...';
        if(d1 && d2) msg += ` Período: ${formatDate(d1)} a ${formatDate(d2)}`;
        showToast(msg, 'info');

        // Em uma implementação real usariamos html2pdf ou jspdf com o conteudo filtrado
        // Aqui apenas estilizamos o grafico
        setTimeout(() => this.renderChart(), 1000);
    },

    renderChart: function() {
        const container = document.getElementById('chart-container');
        container.innerHTML = '';
        // Mock 12 months
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        months.forEach(m => {
            const val = Math.floor(Math.random() * 50000) + 10000;
            const height = (val / 60000) * 100; // relative to max 60k
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = `${height}%`;
            bar.dataset.val = formatCurrency(val);
            container.appendChild(bar);
        });
    }

};

// -----------------------------------------------------------------
// Event Listeners
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    loadState();

    // Check Login
    const savedUser = sessionStorage.getItem(CURRENT_USER_KEY);
    if(savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
    }

    // Toggle Auth Forms
    els.linkRegister.addEventListener('click', (e) => {
        e.preventDefault();
        els.loginForm.classList.add('hidden');
        els.registerForm.classList.remove('hidden');
    });

    els.linkLogin.addEventListener('click', (e) => {
        e.preventDefault();
        els.registerForm.classList.add('hidden');
        els.loginForm.classList.remove('hidden');
    });

    // Login Form Submit
    els.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const em = document.getElementById('login-email').value;
        const ps = document.getElementById('login-password').value;

        const u = appData.users.find(x => x.email === em && x.password === ps);
        if(u) {
            currentUser = u;
            sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
            showToast(`Bem vindo, ${u.name}!`, 'success');
            showApp();
        } else {
            showToast('Email ou senha inválidos!', 'error');
        }
    });

    // Register Form Submit
    els.registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pwd = document.getElementById('reg-password').value;
        const empresa = document.getElementById('reg-empresa').value;

        if(appData.users.find(x => x.email === email)) {
            showToast('Email já cadastrado', 'error');
            return;
        }

        const newUser = { id: generateId(), name: nome, email, password: pwd, company: empresa };
        appData.users.push(newUser);
        saveState();

        showToast('Cadastro realizado! Faça login.', 'success');
        els.linkLogin.click(); // switch to login
    });

    // Logout
    els.btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem(CURRENT_USER_KEY);
        currentUser = null;
        els.mainLayout.classList.add('hidden');
        els.authView.classList.remove('hidden');
    });

    // Navigation Click
    els.navItems.forEach(n => {
        n.addEventListener('click', (e) => {
            e.preventDefault();
            const view = n.dataset.view;
            app.navigate(view);
        });
    });

    // Forms Handlers
    
    // Cliente Form
    document.getElementById('form-cliente').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('cli-id').value;
        const data = {
            nome: document.getElementById('cli-nome').value,
            email: document.getElementById('cli-email').value,
            telefone: document.getElementById('cli-telefone').value,
            endereco: document.getElementById('cli-endereco').value
        };

        if(id) {
            const idx = appData.clientes.findIndex(x => x.id === id);
            appData.clientes[idx] = { ...appData.clientes[idx], ...data };
            showToast('Cliente atualizado', 'success');
        } else {
            appData.clientes.push({ id: generateId(), ...data });
            showToast('Cliente cadastrado', 'success');
        }

        saveState();
        app.closeModal('modal-cliente');
        app.renderClientes();
    });

    // Produto Form
    document.getElementById('form-produto').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const c = parseFloat(document.getElementById('prod-compra').value);
        const v = parseFloat(document.getElementById('prod-venda').value);
        let m = 0;
        if(v >= c) m = ((v - c) / v) * 100;

        const data = {
            nome: document.getElementById('prod-nome').value,
            desc: document.getElementById('prod-desc').value,
            compra: c,
            venda: v,
            margem: m.toFixed(2)
        };

        if(id) {
            const idx = appData.produtos.findIndex(x => x.id === id);
            appData.produtos[idx] = { ...appData.produtos[idx], ...data };
            showToast('Produto atualizado', 'success');
        } else {
            appData.produtos.push({ id: generateId(), ...data });
            showToast('Produto cadastrado', 'success');
        }

        saveState();
        app.closeModal('modal-produto');
        app.renderProdutos();
    });

    // Venda Form
    document.getElementById('form-venda').addEventListener('submit', (e) => {
        e.preventDefault();
        if(currentVendaItems.length === 0) {
            showToast('Adicione pelo menos um produto!', 'error');
            return;
        }

        const clientId = document.getElementById('venda-cliente').value;
        const status = document.getElementById('venda-status').value;
        const numParc = parseInt(document.getElementById('venda-parcelas').value);
        const interDias = parseInt(document.getElementById('venda-intervalo').value);
        
        const total = currentVendaItems.reduce((acc, i) => acc + i.subtotal, 0);

        // Calculate next sequence num
        let nextNum = 1;
        if(appData.vendas.length > 0) {
            nextNum = Math.max(...appData.vendas.map(v => parseInt(v.num) || 0)) + 1;
        }

        const numStr = nextNum.toString().padStart(5, '0');
        const vendaId = generateId();
        const dataHj = new Date().toISOString().split('T')[0];

        const nVenda = {
            id: vendaId,
            num: numStr,
            clientId: clientId,
            date: dataHj,
            items: [...currentVendaItems],
            total: total,
            status: numParc > 1 ? 'pendente' : status
        };

        appData.vendas.push(nVenda);

        // Generate Parcels
        const valParc = total / numParc;
        const dtBase = new Date();

        for(let i=1; i<=numParc; i++) {
            let pDate = new Date(dtBase);
            if(i > 1) { // Primeira parcela é a vista, ou com prazo 1 intervalo. Vamos considerar a partir de 1 mes se numParc > 1
                 pDate.setDate(pDate.getDate() + (interDias * (i-1)));
            }
            
            appData.parcelas.push({
                id: generateId(),
                vendaId: vendaId,
                clientId: clientId,
                num: `${i}/${numParc}`,
                date: pDate.toISOString().split('T')[0],
                value: valParc,
                status: (i===1 && status === 'pago') ? 'pago' : 'pendente'
            });
        }

        saveState();
        app.closeModal('modal-venda');
        showToast(`Venda #${numStr} registrada!`, 'success');
        app.renderVendas();
        app.updateBadges();
    });

    // Search Inputs
    document.getElementById('search-clientes').addEventListener('input', () => app.renderClientes());
    document.getElementById('search-produtos').addEventListener('input', () => app.renderProdutos());

    // Tabs Parcelas
    document.querySelectorAll('#parcelas-view .tab').forEach(t => {
        t.addEventListener('click', () => {
            app.renderParcelas(t.dataset.filter);
        });
    });

});

function showApp() {
    els.authView.classList.add('hidden');
    els.mainLayout.classList.remove('hidden');
    
    // Fill user info
    els.userName.textContent = currentUser.name;
    els.userCompany.textContent = currentUser.company;
    els.userInitial.textContent = currentUser.name.charAt(0).toUpperCase();

    // Init dash
    app.navigate('dashboard');
    app.renderChart(); // initial mock render
}
