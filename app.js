/**
 * GNX - Gestor de Nexos
 * Main Application Logic
 */

const SUPABASE_URL = 'https://ckzgjkkfhrmgrzaattrv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iJdBzHS3nNSzlAja_n0b1Q_clL1voIv';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let appData = {
    users: [], clientes: [], produtos: [], vendas: [], parcelas: [], settings: null
};
let currentUser = null; // Contains auth user + custom users table data
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

function hexToRgba(hex, alpha) {
    if (!hex) return '';
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function adjustHex(hex, amount) {
    if (!hex) return '';
    return '#' + hex.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

function formatCurrency(value) {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrency(str) {
    // Basic parser for inputs
    if (typeof str === 'number') return str;
    return Number(str.replace(/[^0-9.-]+/g, ""));
}

async function saveState() {
    // Only kept for backwards compatibility in UI logic if anywhere missed. 
    // Data is now saved per-action to Supabase directly.
}

async function loadStateDb() {
    if (!currentUser || !currentUser.company_id) return;
    const cid = currentUser.company_id;

    const [
        { data: users }, { data: clients }, { data: products },
        { data: sales }, { data: saleItems }, { data: installments },
        { data: settings }
    ] = await Promise.all([
        supabase.from('users').select('*').eq('company_id', cid),
        supabase.from('clients').select('*').eq('company_id', cid),
        supabase.from('products').select('*').eq('company_id', cid),
        supabase.from('sales').select('*').eq('company_id', cid),
        supabase.from('sale_items').select('*, sales!inner(company_id)').eq('sales.company_id', cid),
        supabase.from('installments').select('*').eq('company_id', cid),
        supabase.from('company_settings').select('*').eq('company_id', cid).maybeSingle()
    ]);

    appData.users = (users || []).map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, company: u.company_id, status: u.status, companyCode: '' }));
    appData.clientes = (clients || []).map(c => ({ id: c.id, nome: c.name, documento: c.document, email: c.email, telefone: c.phone, endereco: c.address_street, obs: c.obs }));
    appData.produtos = (products || []).map(p => ({ id: p.id, nome: p.name, desc: p.description, compra: parseFloat(p.cost_price), venda: parseFloat(p.sale_price), margem: p.sale_price > 0 ? (((p.sale_price - p.cost_price) / p.sale_price) * 100).toFixed(2) : 0 }));

    appData.vendas = (sales || []).map(s => {
        let items = (saleItems || []).filter(i => i.sale_id === s.id).map(i => ({
            prodId: i.product_id,
            nome: appData.produtos.find(p => p.id === i.product_id)?.nome || 'Item',
            qtd: i.quantity, preco: parseFloat(i.unit_price), subtotal: parseFloat(i.subtotal)
        }));
        return {
            id: s.id, num: s.sale_number, clientId: s.client_id, date: s.date, items: items,
            total: parseFloat(s.total_amount), status: s.status
        };
    });

    appData.parcelas = (installments || []).map(i => ({
        id: i.id, vendaId: i.sale_id, clientId: i.client_id, num: i.installment_number || i.description,
        date: i.due_date, value: parseFloat(i.original_amount), status: i.status
    }));

    if (settings) {
        appData.settings = { primaryColor: settings.primary_color, bgImage: settings.bg_image_url, panelOpacity: settings.panel_opacity };
    } else {
        appData.settings = { primaryColor: '#6c5ce7', bgImage: '', panelOpacity: '0.6' };
    }
}

function setupRealtime() {
    if (!currentUser) return;
    const cid = currentUser.company_id;

    supabase.channel('public:gnx_changes')
        .on('postgres_changes', { event: '*', schema: 'public', filter: `company_id=eq.${cid}` }, async payload => {
            // Re-fetch all to ensure integrity (simpler sync architecture)
            await loadStateDb();
            const currentView = document.querySelector('.page-view:not(.hidden)')?.id.replace('-view', '');
            if (currentView && currentView !== 'cliente-perfil' && currentView !== 'venda-detalhe') {
                app.navigate(currentView);
            } else if (currentView === 'cliente-perfil') {
                app.abrirPerfilCliente(document.getElementById('cliente-perfil-view').dataset.clientId);
            } else if (currentView === 'venda-detalhe') {
                app.abrirDetalheVenda(document.getElementById('venda-detalhe-view').dataset.vendaId);
            }
        }).subscribe();
}

// Toast Notifications
window.showToast = function (message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-octagon';
    if (type === 'warning') icon = 'alert-triangle';

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
    toggleForgot: function () {
        document.getElementById('login-form').classList.toggle('hidden');
        document.getElementById('forgot-form').classList.toggle('hidden');
    },

    loginOAuth: async function (provider) {
        const { error } = await supabase.auth.signInWithOAuth({ provider: provider });
        if (error) showToast(error.message, 'error');
    },

    toggleSidebar: function () {
        document.getElementById('main-sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').classList.toggle('open');
    },

    closeSidebar: function () {
        document.getElementById('main-sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('open');
    },

    // Configurações
    applySettings: function () {
        if (!appData.settings) appData.settings = { primaryColor: '#6c5ce7', bgImage: '', panelOpacity: '0.6' };
        const s = appData.settings;
        const root = document.documentElement;

        root.style.setProperty('--primary', s.primaryColor);
        root.style.setProperty('--primary-hover', adjustHex(s.primaryColor, -20));
        root.style.setProperty('--primary-soft', hexToRgba(s.primaryColor, 0.15));
        root.style.setProperty('--glow', `0 0 20px ${hexToRgba(s.primaryColor, 0.3)}`);

        root.style.setProperty('--glass-bg', `rgba(25, 26, 35, ${s.panelOpacity})`);

        if (s.bgImage) {
            document.body.style.backgroundImage = `url('${s.bgImage}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
        } else {
            document.body.style.backgroundImage = `radial-gradient(circle at 15% 50%, ${hexToRgba(s.primaryColor, 0.08)} 0%, transparent 50%), radial-gradient(circle at 85% 30%, ${hexToRgba(s.primaryColor, 0.05)} 0%, transparent 50%)`;
            document.body.style.backgroundSize = 'auto';
            document.body.style.backgroundPosition = 'initial';
            document.body.style.backgroundAttachment = 'initial';
        }
    },

    resetConfig: function () {
        if (confirm('Restaurar cores e fundo padrão?')) {
            appData.settings = { primaryColor: '#6c5ce7', bgImage: '', panelOpacity: '0.6' };
            saveState();
            this.applySettings();
            this.renderConfig();
            showToast('Configurações restauradas', 'success');
        }
    },

    toggleRegScope: function () {
        const role = document.getElementById('reg-role').value;
        const gEmpresa = document.getElementById('group-reg-empresa');
        const gCode = document.getElementById('group-reg-code');
        const iEmpresa = document.getElementById('reg-empresa');
        const iCode = document.getElementById('reg-code');

        if (role === 'admin') {
            gEmpresa.classList.remove('hidden');
            gCode.classList.add('hidden');
            iEmpresa.required = true;
            iCode.required = false;
        } else {
            gEmpresa.classList.add('hidden');
            gCode.classList.remove('hidden');
            iEmpresa.required = false;
            iCode.required = true;
        }
    },

    renderEquipe: function () {
        document.getElementById('invite-code-display').textContent = currentUser.companyCode || 'N/A';
        const tbody = document.getElementById('table-equipe');
        tbody.innerHTML = '';

        let equipe = appData.users.filter(u => u.company === currentUser.company && u.role === 'funcionario');

        if (equipe.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum funcionário cadastrado.</td></tr>';
        } else {
            equipe.forEach(u => {
                let statusBadge = u.status === 'ativo' ? '<span class="badge bg-success-soft text-success">Ativo</span>' : '<span class="badge bg-warning-soft text-warning">Pendente</span>';
                let btnAprovar = u.status === 'pendente' ? `<button class="btn btn-sm btn-primary" onclick="app.aprovarMembro('${u.id}')"><i data-lucide="check"></i> Aprovar</button>` : '';

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${u.name}</strong></td>
                        <td>${u.email}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <div class="flex gap-2">
                                ${btnAprovar}
                                <button class="btn btn-sm btn-danger" onclick="app.removerMembro('${u.id}')"><i data-lucide="trash-2"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        lucide.createIcons({ root: tbody });
    },

    aprovarMembro: function (id) {
        if (confirm('Aprovar este funcionário para acessar o sistema?')) {
            const u = appData.users.find(x => x.id === id);
            if (u) u.status = 'ativo';
            saveState();
            this.renderEquipe();
            showToast('Funcionário aprovado!', 'success');
        }
    },

    removerMembro: function (id) {
        if (confirm('Remover definitivamente este membro da equipe? O acesso dele será bloqueado imediatamente.')) {
            appData.users = appData.users.filter(x => x.id !== id);
            saveState();
            this.renderEquipe();
            showToast('Membro removido da empresa', 'warning');
        }
    },

    renderConfig: function () {
        if (!appData.settings) appData.settings = { primaryColor: '#6c5ce7', bgImage: '', panelOpacity: '0.6' };
        document.getElementById('config-color').value = appData.settings.primaryColor;
        document.getElementById('config-bg').value = appData.settings.bgImage;
        document.getElementById('config-opacity').value = appData.settings.panelOpacity;
    },

    // Navigation
    navigate: function (viewId) {
        this.closeSidebar();
        els.pageViews.forEach(v => v.classList.add('hidden'));
        els.navItems.forEach(n => n.classList.remove('active'));

        const view = document.getElementById(`${viewId}-view`);
        if (view) view.classList.remove('hidden');

        const nav = Array.from(els.navItems).find(n => n.dataset.view === viewId);
        if (nav) nav.classList.add('active');

        const titles = {
            'dashboard': 'Dashboard Geral',
            'clientes': 'Gestão de Clientes',
            'produtos': 'Catálogo de Produtos',
            'vendas': 'Registro de Vendas',
            'parcelas': 'Controle de Parcelas',
            'relatorios': 'Relatórios Gerenciais',
            'equipe': 'Gestão de Equipe',
            'configuracoes': 'Configurações'
        };
        els.pageTitle.textContent = titles[viewId] || 'GNX';

        // View specific logic
        if (viewId === 'dashboard') this.renderDashboard();
        if (viewId === 'clientes') this.renderClientes();
        if (viewId === 'produtos') this.renderProdutos();
        if (viewId === 'vendas') this.renderVendas();
        if (viewId === 'parcelas') this.renderParcelas();
        if (viewId === 'equipe') this.renderEquipe();
        if (viewId === 'configuracoes') this.renderConfig();

        this.updateBadges();
    },

    // Modals
    openModal: function (modalId) {
        document.getElementById(modalId).classList.remove('hidden');
        if (modalId === 'modal-cliente') document.getElementById('form-cliente').reset();
        if (modalId === 'modal-produto') document.getElementById('form-produto').reset();
        if (modalId === 'modal-venda') {
            document.getElementById('form-venda').reset();
            currentVendaItems = [];
            this.updateVendaClientOpts();
            this.updateVendaProdutoOpts();
            this.renderVendaItems();
        }
    },

    closeModal: function (modalId) {
        document.getElementById(modalId).classList.add('hidden');
    },

    // Badges & Alerts
    updateBadges: function () {
        // Check pending/late parcels within 1 day or late
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let alertCount = 0;
        els.dashAlertas.innerHTML = '';

        appData.parcelas.forEach(p => {
            if (p.status === 'pago') return;

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
                const cliente = appData.clientes.find(c => c.id === p.clientId) || { nome: 'Desconhecido' };
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

        if (els.dashAlertas.children.length === 0) {
            els.dashAlertas.innerHTML = '<p class="text-sm text-muted p-2">Nenhum alerta pendente.</p>';
        }

        if (alertCount > 0) {
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
    renderDashboard: function () {
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
                if (p) cstTotal += (p.compra * i.qtd);
            });

            const vDate = new Date(v.date);
            if (vDate >= firstDay) {
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
        ultimas.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).forEach(v => {
            const c = appData.clientes.find(cli => cli.id === v.clientId) || { nome: 'N/A' };
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
    renderClientes: function () {
        const search = document.getElementById('search-clientes').value.toLowerCase();
        const listContainer = document.getElementById('table-clientes');
        listContainer.innerHTML = '';

        appData.clientes.filter(c => c.nome.toLowerCase().includes(search)).forEach(c => {
            listContainer.innerHTML += `
                <div class="glass panel flex flex-col justify-between" style="cursor: pointer; position: relative; padding: 20px;" onclick="app.abrirPerfilCliente('${c.id}')">
                    <div style="margin-bottom: 12px;">
                        <h3 class="text-primary font-bold" style="font-size: 1.1rem; margin-bottom: 4px;">${c.nome}</h3>
                        <p class="text-sm text-muted" style="display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="phone" style="width: 14px; height: 14px;"></i> ${c.telefone || 'Sem telefone'}
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: auto;" onclick="event.stopPropagation()">
                        <button class="icon-btn text-info" title="Perfil" onclick="app.abrirPerfilCliente('${c.id}')"><i data-lucide="user"></i></button>
                        <button class="icon-btn" title="Editar" onclick="app.editCliente('${c.id}')"><i data-lucide="edit-2"></i></button>
                        <button class="icon-btn text-danger" title="Excluir" onclick="app.delCliente('${c.id}')"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
            `;
        });
        lucide.createIcons({ root: listContainer });
    },

    editCliente: function (id) {
        const c = appData.clientes.find(x => x.id === id);
        if (!c) return;
        document.getElementById('cli-id').value = c.id;
        document.getElementById('cli-nome').value = c.nome;
        document.getElementById('cli-documento').value = c.documento || '';
        document.getElementById('cli-email').value = c.email || '';
        document.getElementById('cli-telefone').value = c.telefone || '';
        document.getElementById('cli-endereco').value = c.endereco || '';
        document.getElementById('cli-obs').value = c.obs || '';
        document.getElementById('cliente-modal-title').textContent = 'Editar Cliente';
        this.openModal('modal-cliente');
    },

    delCliente: async function (id) {
        if (confirm('Tem certeza que deseja excluir?')) {
            const { error } = await supabase.from('clients').delete().eq('id', id);
            if (error) { showToast(error.message, 'error'); return; }
            showToast('Cliente excluído', 'success');
        }
    },

    abrirPerfilCliente: function (id) {
        const c = appData.clientes.find(x => x.id === id);
        if (!c) return;

        // Hide all views, maintain 'clientes' as active in sidebar
        els.pageViews.forEach(v => v.classList.add('hidden'));
        els.navItems.forEach(n => n.classList.remove('active'));
        const nav = Array.from(els.navItems).find(n => n.dataset.view === 'clientes');
        if (nav) nav.classList.add('active');

        document.getElementById('cliente-perfil-view').classList.remove('hidden');
        els.pageTitle.textContent = 'Perfil do Cliente';

        // Populate Ficha
        document.getElementById('perfil-title').innerHTML = `Perfil de <strong class="text-primary">${c.nome}</strong>`;
        document.getElementById('perf-nome').textContent = c.nome;
        document.getElementById('perf-doc').textContent = c.documento || 'Não informado';
        document.getElementById('perf-email').textContent = c.email || 'Não informado';
        document.getElementById('perf-tel').textContent = c.telefone || 'Não informado';
        document.getElementById('perf-end').textContent = c.endereco || 'Não informado';
        document.getElementById('perf-obs').textContent = c.obs || 'Nenhuma observação.';

        // Calculate Metrics
        const vendas = appData.vendas.filter(v => v.clientId === id);
        const parcelas = appData.parcelas.filter(p => p.clientId === id);

        let totalCompras = 0, saldoDevedor = 0, saldoPendente = 0;

        vendas.forEach(v => { if (v.status !== 'cancelado') totalCompras += v.total; });
        parcelas.forEach(p => {
            if (p.status === 'atrasado') saldoDevedor += p.value;
            if (p.status === 'pendente') saldoPendente += p.value;
        });

        document.getElementById('perfil-total-compras').textContent = formatCurrency(totalCompras);
        document.getElementById('perfil-saldo-devedor').textContent = formatCurrency(saldoDevedor);
        document.getElementById('perfil-saldo-pendente').textContent = formatCurrency(saldoPendente);

        // Populate Historico & Cumpridas
        const tbodyHist = document.getElementById('perfil-historico-vendas');
        const tbodyCump = document.getElementById('perfil-vendas-cumpridas');
        tbodyHist.innerHTML = '';
        tbodyCump.innerHTML = '';

        const sortedVendas = vendas.sort((a, b) => new Date(b.date) - new Date(a.date));

        let countPendentes = 0;
        let countCumpridas = 0;

        sortedVendas.forEach(v => {
            const saleParcels = parcelas.filter(p => p.vendaId === v.id);
            const totalParcels = saleParcels.length;
            const paidParcels = saleParcels.filter(p => p.status === 'pago').length;

            let parcelsText = totalParcels > 0 ? `${paidParcels} / ${totalParcels}` : 'À vista';

            const trHTML = `
                <tr class="clickable-row" onclick="app.abrirDetalheVenda('${v.id}')">
                    <td><strong>#${v.num}</strong></td>
                    <td>${formatDate(v.date)}</td>
                    <td><span class="text-muted">${parcelsText}</span></td>
                    <td>${formatCurrency(v.total)}</td>
                    <td><span class="badge-status status-${v.status}">${v.status}</span></td>
                </tr>
            `;

            if (v.status === 'pago') {
                tbodyCump.innerHTML += trHTML;
                countCumpridas++;
            } else {
                tbodyHist.innerHTML += trHTML;
                countPendentes++;
            }
        });

        if (countPendentes === 0) {
            tbodyHist.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma venda pendente ou em curso.</td></tr>';
        }
        if (countCumpridas === 0) {
            tbodyCump.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma venda concluída.</td></tr>';
        }

        // Save current user for quick sale
        document.getElementById('cliente-perfil-view').dataset.clientId = id;
    },

    novaVendaPerfil: function () {
        const id = document.getElementById('cliente-perfil-view').dataset.clientId;
        this.openModal('modal-venda');
        document.getElementById('venda-cliente').value = id;
    },

    abrirDetalheVenda: function (vendaId) {
        const v = appData.vendas.find(x => x.id === vendaId);
        if (!v) return;

        // Hide all views, maintain 'clientes' as active in sidebar
        els.pageViews.forEach(v => v.classList.add('hidden'));
        document.getElementById('venda-detalhe-view').classList.remove('hidden');
        els.pageTitle.textContent = 'Detalhes da Venda';

        const cliente = appData.clientes.find(c => c.id === v.clientId) || { nome: 'Desconhecido' };

        document.getElementById('vd-title').innerHTML = `Nota <strong class="text-primary">#${v.num}</strong>`;
        document.getElementById('vd-subtitle').innerHTML = `Cliente: <strong>${cliente.nome}</strong> &bull; Data: ${formatDate(v.date)}`;

        document.getElementById('vd-total').textContent = formatCurrency(v.total);
        document.getElementById('vd-status').innerHTML = `<span class="badge-status status-${v.status}">${v.status.toUpperCase()}</span>`;

        const saleParcels = appData.parcelas.filter(p => p.vendaId === v.id);
        const pendente = saleParcels.filter(p => p.status !== 'pago').reduce((acc, p) => acc + p.value, 0);
        document.getElementById('vd-pendente').textContent = formatCurrency(pendente);

        // Populate Parcels
        const tbody = document.getElementById('vd-parcelas-tbody');
        tbody.innerHTML = '';
        if (saleParcels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Venda sem parcelas registradas.</td></tr>';
        } else {
            // Sort by numerical num string if possible or by date
            saleParcels.sort((a, b) => new Date(a.date) - new Date(b.date));
            saleParcels.forEach(p => {
                let actBtn = '';
                if (p.status !== 'pago') {
                    actBtn = `<button class="btn btn-sm btn-primary" onclick="app.pagarParcela('${p.id}', true)"><i data-lucide="check"></i> Pagar</button>`;
                }
                tbody.innerHTML += `
                    <tr>
                        <td>${p.num}</td>
                        <td>${formatDate(p.date)}</td>
                        <td><strong>${formatCurrency(p.value)}</strong></td>
                        <td><span class="badge-status status-${p.status}">${p.status}</span></td>
                        <td>${actBtn}</td>
                    </tr>
                `;
            });
        }

        // Populate Products
        const prodList = document.getElementById('vd-produtos-list');
        prodList.innerHTML = '';
        v.items.forEach(i => {
            prodList.innerHTML += `
               <div class="mb-2" style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
                   <div><strong>${i.nome}</strong><br><span class="text-muted">${i.qtd}x ${formatCurrency(i.preco)}</span></div>
                   <div class="font-bold">${formatCurrency(i.subtotal)}</div>
               </div>
           `;
        });

        // Store venda ID for the modal
        document.getElementById('venda-detalhe-view').dataset.vendaId = v.id;
        lucide.createIcons({ root: document.getElementById('venda-detalhe-view') });
    },

    voltarPerfilCliente: function () {
        const clientId = document.getElementById('cliente-perfil-view').dataset.clientId;
        this.abrirPerfilCliente(clientId);
    },

    abrirModalAdiantamento: function () {
        const id = document.getElementById('venda-detalhe-view').dataset.vendaId;
        const v = appData.vendas.find(x => x.id === id);
        if (!v || v.status === 'pago') {
            showToast('Esta venda já está quitada!', 'warning');
            return;
        }
        document.getElementById('ad-venda-id').value = id;
        document.getElementById('ad-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('ad-valor').value = '';
        this.openModal('modal-adiantamento');
    },

    // -------------------------------------------------------------
    // Produtos
    // -------------------------------------------------------------
    calcMargin: function () {
        const c = parseFloat(document.getElementById('prod-compra').value);
        const v = parseFloat(document.getElementById('prod-venda').value);
        const disp = document.getElementById('prod-margin-display');
        if (c > 0 && v >= c) {
            const m = ((v - c) / v) * 100;
            disp.textContent = m.toFixed(2) + '%';
        } else {
            disp.textContent = '0.00%';
        }
    },

    renderProdutos: function () {
        const search = document.getElementById('search-produtos').value.toLowerCase();
        const tbody = document.getElementById('table-produtos');
        tbody.innerHTML = '';

        appData.produtos.filter(p => p.nome.toLowerCase().includes(search)).forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${p.nome}</strong></td>
                    <td>${p.desc.substring(0, 30)}</td>
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
        lucide.createIcons({ root: tbody });
    },

    editProduto: function (id) {
        const p = appData.produtos.find(x => x.id === id);
        if (!p) return;
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-nome').value = p.nome;
        document.getElementById('prod-desc').value = p.desc;
        document.getElementById('prod-compra').value = p.compra;
        document.getElementById('prod-venda').value = p.venda;
        this.calcMargin();
        document.getElementById('produto-modal-title').textContent = 'Editar Produto';
        this.openModal('modal-produto');
    },

    delProduto: async function (id) {
        if (confirm('Tem certeza que deseja excluir?')) {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) { showToast(error.message, 'error'); return; }
            showToast('Produto excluído', 'success');
        }
    },

    // -------------------------------------------------------------
    // Vendas
    // -------------------------------------------------------------
    updateVendaClientOpts: function () {
        const sel = document.getElementById('venda-cliente');
        sel.innerHTML = '<option value="">Selecione um cliente...</option>';
        appData.clientes.forEach(c => {
            sel.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
        });
    },

    updateVendaProdutoOpts: function () {
        const sel = document.getElementById('venda-produto-sel');
        sel.innerHTML = '<option value="">Selecione um produto...</option>';
        appData.produtos.forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${p.nome} - ${formatCurrency(p.venda)}</option>`;
        });
    },

    addVendaItem: function () {
        const sel = document.getElementById('venda-produto-sel');
        const prodId = sel.value;
        const qtd = parseInt(document.getElementById('venda-qtd').value);

        if (!prodId || qtd < 1) return;

        const prod = appData.produtos.find(p => p.id === prodId);
        if (!prod) return;

        // Check if already in list
        const ex = currentVendaItems.find(i => i.prodId === prodId);
        if (ex) {
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

    removeVendaItem: function (idx) {
        currentVendaItems.splice(idx, 1);
        this.renderVendaItems();
    },

    renderVendaItems: function () {
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
        lucide.createIcons({ root: tbody });
    },

    renderVendas: function () {
        const tbody = document.getElementById('table-vendas');
        tbody.innerHTML = '';

        const vendasSorted = [...appData.vendas].sort((a, b) => new Date(b.date) - new Date(a.date));

        vendasSorted.forEach(v => {
            const cliente = appData.clientes.find(c => c.id === v.clientId) || { nome: 'N/A' };
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
        lucide.createIcons({ root: tbody });
    },

    cancelarVenda: async function (id) {
        if (confirm('Cancelar venda e excluir parcelas pendentes?')) {
            await supabase.from('sales').update({ status: 'cancelado' }).eq('id', id);
            await supabase.from('installments').delete().eq('sale_id', id).eq('status', 'pendente');
            showToast('Venda cancelada', 'warning');
        }
    },

    // -------------------------------------------------------------
    // Parcelas
    // -------------------------------------------------------------
    renderParcelas: function (filter = 'todas') {
        const tbody = document.getElementById('table-parcelas');
        tbody.innerHTML = '';

        let list = appData.parcelas;
        if (filter !== 'todas') {
            list = list.filter(p => p.status === filter);
        }

        // sort by date asc
        list.sort((a, b) => new Date(a.date) - new Date(b.date));

        list.forEach(p => {
            const venda = appData.vendas.find(v => v.id === p.vendaId) || { num: 'N/A' };
            const cliente = appData.clientes.find(c => c.id === p.clientId) || { nome: 'N/A' };

            let actBtn = '';
            if (p.status !== 'pago') {
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

        lucide.createIcons({ root: tbody });
    },

    pagarParcela: async function (id, fromDetail = false) {
        if (confirm('Confirmar pagamento desta parcela?')) {
            const p = appData.parcelas.find(x => x.id === id);
            if (p) {
                const { error } = await supabase.from('installment_payments').insert({
                    installment_id: p.id,
                    amount: p.value,
                    payment_date: new Date().toISOString().split('T')[0]
                });
                if (error) { showToast(error.message, 'error'); return; }
                showToast('Parcela paga!', 'success');
            }
        }
    },

    // -------------------------------------------------------------
    // Relatórios (Mock logic for now)
    // -------------------------------------------------------------
    generateReport: function () {
        const d1 = document.getElementById('rel-start').value;
        const d2 = document.getElementById('rel-end').value;

        let msg = 'Gerando relatório PDF...';
        if (d1 && d2) msg += ` Período: ${formatDate(d1)} a ${formatDate(d2)}`;
        showToast(msg, 'info');

        // Em uma implementação real usariamos html2pdf ou jspdf com o conteudo filtrado
        // Aqui apenas estilizamos o grafico
        setTimeout(() => this.renderChart(), 1000);
    },

    renderChart: function () {
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
    // Initialize Supabase Auth Check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
            const { data: userRow } = await supabase.from('users').select('*').eq('id', session.user.id).single();
            if (userRow) {
                currentUser = { ...session.user, ...userRow }; // Combine
                await loadStateDb();
                setupRealtime();
                showApp();
            } else {
                els.authView.classList.remove('hidden');
            }
        } else {
            els.authView.classList.remove('hidden');
        }
    });

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

    // Forgot Password
    document.getElementById('forgot-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const em = document.getElementById('forgot-email').value;
        const { error } = await supabase.auth.resetPasswordForEmail(em);
        if (error) showToast(error.message, 'error');
        else showToast('Email de recuperação enviado!', 'success');
    });

    // Login Form Submit
    els.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const em = document.getElementById('login-email').value;
        const ps = document.getElementById('login-password').value;

        const { data, error } = await supabase.auth.signInWithPassword({ email: em, password: ps });
        if (error) {
            showToast('Email ou senha inválidos!', 'error');
            return;
        }

        const { data: userRow } = await supabase.from('users').select('*').eq('id', data.user.id).single();
        if (userRow) {
            if (userRow.status === 'pendente' && userRow.role === 'funcionario') {
                showToast('Conta pendente de aprovação.', 'warning');
                return;
            }
            currentUser = { ...data.user, ...userRow }; // Combine
            await loadStateDb();
            setupRealtime();
            showToast('Bem vindo!', 'success');
            showApp();
        } else {
            showToast('Perfil não encontrado no sistema.', 'error');
        }
    });

    // Register Form Submit
    els.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pwd = document.getElementById('reg-password').value;
        const role = document.getElementById('reg-role') ? document.getElementById('reg-role').value : 'admin';

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email, password: pwd, options: { data: { name: nome } }
        });

        if (authError) {
            showToast(authError.message, 'error');
            return;
        }

        const userId = authData.user.id;
        let companyId;

        if (role === 'admin') {
            const empresa = document.getElementById('reg-empresa').value;
            const code = Math.random().toString(36).substr(2, 6).toUpperCase();
            const { data: cData, error: cErr } = await supabase.from('companies').insert({
                name: empresa, invite_code: code
            }).select().single();

            if (cErr) { showToast('Erro ao criar empresa', 'error'); return; }
            companyId = cData.id;

            await supabase.from('users').insert({
                id: userId, company_id: companyId, name: nome, email: email,
                password_hash: 'auth', role: 'admin', status: 'ativo'
            });

            showToast('Empresa criada com sucesso! Faça login.', 'success');
        } else {
            const code = document.getElementById('reg-code').value.toUpperCase();
            const { data: adminComp } = await supabase.from('companies').select('id').eq('invite_code', code).maybeSingle();
            if (!adminComp) { showToast('Código inválido', 'error'); return; }

            await supabase.from('users').insert({
                id: userId, company_id: adminComp.id, name: nome, email: email,
                password_hash: 'auth', role: 'funcionario', status: 'pendente'
            });

            showToast('Cadastro realizado! Aguarde a aprovação.', 'success');
        }

        els.linkLogin.click(); // switch to login
    });

    // Logout
    els.btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut();
        currentUser = null;
        els.mainLayout.classList.add('hidden');
        els.authView.classList.remove('hidden');
        window.location.reload();
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
    document.getElementById('form-cliente').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('cli-id').value;
        const data = {
            company_id: currentUser.company_id,
            name: document.getElementById('cli-nome').value,
            document: document.getElementById('cli-documento').value,
            email: document.getElementById('cli-email').value,
            phone: document.getElementById('cli-telefone').value,
            address_street: document.getElementById('cli-endereco').value,
            obs: document.getElementById('cli-obs').value
        };

        if (id) {
            const { error } = await supabase.from('clients').update(data).eq('id', id);
            if (error) { showToast(error.message, 'error'); return; }
            showToast('Cliente atualizado', 'success');
        } else {
            const { error } = await supabase.from('clients').insert(data);
            if (error) { showToast(error.message, 'error'); return; }
            showToast('Cliente cadastrado', 'success');
        }

        app.closeModal('modal-cliente');
    });

    // Produto Form
    document.getElementById('form-produto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const c = parseFloat(document.getElementById('prod-compra').value);
        const v = parseFloat(document.getElementById('prod-venda').value);

        const data = {
            company_id: currentUser.company_id,
            name: document.getElementById('prod-nome').value,
            description: document.getElementById('prod-desc').value,
            cost_price: c,
            sale_price: v
        };

        if (id) {
            const { error } = await supabase.from('products').update(data).eq('id', id);
            if (error) { showToast(error.message, 'error'); return; }
            showToast('Produto atualizado', 'success');
        } else {
            const { error } = await supabase.from('products').insert(data);
            if (error) { showToast(error.message, 'error'); return; }
            showToast('Produto cadastrado', 'success');
        }

        app.closeModal('modal-produto');
    });

    // Venda Form
    document.getElementById('form-venda').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (currentVendaItems.length === 0) {
            showToast('Adicione pelo menos um produto!', 'error');
            return;
        }

        const clientId = document.getElementById('venda-cliente').value;
        const status = document.getElementById('venda-status').value;
        const numParc = parseInt(document.getElementById('venda-parcelas').value);
        const interDias = parseInt(document.getElementById('venda-intervalo').value);

        const total = currentVendaItems.reduce((acc, i) => acc + i.subtotal, 0);

        let nextNum = 1;
        if (appData.vendas.length > 0) {
            nextNum = Math.max(...appData.vendas.map(v => parseInt(v.num) || 0)) + 1;
        }

        const finalStatus = numParc > 1 ? 'pendente' : status;

        const { data: sData, error: sErr } = await supabase.from('sales').insert({
            company_id: currentUser.company_id,
            client_id: clientId,
            user_id: currentUser.id,
            sale_number: nextNum,
            date: new Date().toISOString().split('T')[0],
            total_amount: total,
            status: finalStatus
        }).select().single();

        if (sErr) { showToast(sErr.message, 'error'); return; }

        const itemsToInsert = currentVendaItems.map(i => {
            let theProd = appData.produtos.find(p => p.id === i.prodId);
            return {
                sale_id: sData.id,
                product_id: i.prodId,
                quantity: i.qtd,
                unit_price: i.preco,
                cost_price: theProd ? theProd.compra : 0
            };
        });
        await supabase.from('sale_items').insert(itemsToInsert);

        const valParc = total / numParc;
        const dtBase = new Date();
        const installmentsToInsert = [];

        for (let i = 1; i <= numParc; i++) {
            let pDate = new Date(dtBase);
            if (i > 1) pDate.setDate(pDate.getDate() + (interDias * (i - 1)));

            installmentsToInsert.push({
                company_id: currentUser.company_id,
                sale_id: sData.id,
                client_id: clientId,
                type: 'parcela',
                installment_number: i,
                description: i + '/' + numParc,
                due_date: pDate.toISOString().split('T')[0],
                original_amount: valParc,
                status: (i === 1 && finalStatus === 'pago') ? 'pago' : 'pendente'
            });
        }
        await supabase.from('installments').insert(installmentsToInsert);

        app.closeModal('modal-venda');
        showToast('Venda registrada!', 'success');
    });

    // Form Adiantamento
    document.getElementById('form-adiantamento').addEventListener('submit', async (e) => {
        e.preventDefault();
        const vId = document.getElementById('ad-venda-id').value;
        const v = appData.vendas.find(x => x.id === vId);
        if (!v) return;

        let valor = parseFloat(document.getElementById('ad-valor').value);
        const dataStr = document.getElementById('ad-data').value;

        if (valor <= 0) { showToast('Valor inválido', 'error'); return; }

        const { data: instData, error: instErr } = await supabase.from('installments').insert({
            company_id: currentUser.company_id,
            sale_id: v.id,
            client_id: v.clientId,
            type: 'adiantamento',
            description: 'Adiantamento/Avulso',
            due_date: dataStr,
            original_amount: valor,
            status: 'pago'
        }).select().single();

        if (!instErr) {
            await supabase.from('installment_payments').insert({
                installment_id: instData.id,
                amount: valor,
                payment_date: dataStr
            });
            showToast('Adiantamento registrado!', 'success');
        } else {
            showToast(instErr.message, 'error');
        }

        app.closeModal('modal-adiantamento');
    });

    // Config Form
    document.getElementById('form-config').addEventListener('submit', async (e) => {
        e.preventDefault();
        const color = document.getElementById('config-color').value;
        const bg = document.getElementById('config-bg').value;
        const opacity = document.getElementById('config-opacity').value;

        await supabase.from('company_settings').upsert({
            company_id: currentUser.company_id,
            primary_color: color,
            bg_image_url: bg,
            panel_opacity: opacity
        });
        showToast('Configurações aplicadas com sucesso!', 'success');
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

    // Handle Roles Scopes
    const adminOnlyItems = document.querySelectorAll('.admin-only');
    if (currentUser.role === 'funcionario') {
        adminOnlyItems.forEach(el => el.classList.add('hidden'));
    } else {
        adminOnlyItems.forEach(el => el.classList.remove('hidden'));
    }

    // Fill user info
    els.userName.textContent = currentUser.name;
    els.userCompany.textContent = currentUser.company;
    els.userInitial.textContent = currentUser.name.charAt(0).toUpperCase();

    // Apply config
    app.applySettings();

    // Init dash
    app.navigate('dashboard');
    app.renderChart(); // initial mock render
}
