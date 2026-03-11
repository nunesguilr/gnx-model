/**
 * GNX - Gestor de Nexos
 * Core Logic & LocalDatabase Implementation
 */

(function () {
    'use strict';

    // --- Utility Functions ---
    const utils = {
        uuid() {
            return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
        },
        formatMoney(val) { return parseFloat(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
        formatDate(dateStr) {
            if (!dateStr) return '';
            const parts = dateStr.includes('-') ? dateStr.split('-') : [];
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return new Date(dateStr).toLocaleDateString('pt-BR');
        },
        debounce(func, timeout = 300) {
            let timer;
            return (...args) => { clearTimeout(timer); timer = setTimeout(() => { func.apply(this, args); }, timeout); };
        },
        toast(msg, type = 'info') {
            const container = document.getElementById('toast-container');
            const t = document.createElement('div');
            t.className = `toast toast-${type}`;
            let icon = 'info';
            if (type === 'success') icon = 'check-circle';
            if (type === 'error') icon = 'alert-triangle';
            t.innerHTML = `<i data-lucide="${icon}"></i> <span>${msg}</span>`;
            container.appendChild(t);
            if (window.lucide) lucide.createIcons({ root: t });
            setTimeout(() => {
                t.classList.add('hiding');
                t.addEventListener('animationend', () => t.remove());
            }, 3000);
        }
    };

    // --- Database (LocalStorage) ---
    const DB_KEY = 'gnx_database_v2';
    const defaultSchema = {
        users: [], // { id, companyId, name, email, password, role, status }
        companies: [], // { id, name, inviteCode, config: {} }
        clients: [], // { id, companyId, name, contact, address, ... }
        products: [], // { id, companyId, name, desc, cost, price }
        sales: [], // { id, companyId, clientId, date, total, status, items: [] }
        installments: [] // { id, companyId, saleId, clientId, num, dueDate, amount, status }
    };

    const db = {
        data: null,
        load() {
            const stored = localStorage.getItem(DB_KEY);
            if (stored) {
                try { this.data = JSON.parse(stored); } catch { this.data = defaultSchema; }
            } else {
                this.data = defaultSchema;
                this.save();
            }
            if (!this.data.users) this.data = { ...defaultSchema, ...this.data };
        },
        save() { localStorage.setItem(DB_KEY, JSON.stringify(this.data)); },
        getTable(tableName, companyId = null) {
            const table = this.data[tableName] || [];
            if (companyId) return table.filter(row => row.companyId === companyId);
            return table;
        },
        insert(tableName, obj) {
            if (!obj.id) obj.id = utils.uuid();
            obj.createdAt = new Date().toISOString();
            this.data[tableName].push(obj);
            this.save();
            return obj;
        },
        update(tableName, id, payload) {
            const idx = this.data[tableName].findIndex(r => r.id === id);
            if (idx !== -1) {
                this.data[tableName][idx] = { ...this.data[tableName][idx], ...payload, updatedAt: new Date().toISOString() };
                this.save();
                return this.data[tableName][idx];
            }
            return null;
        },
        remove(tableName, id) {
            this.data[tableName] = this.data[tableName].filter(r => r.id !== id);
            this.save();
        }
    };

    // --- State & Auth ---
    const state = {
        currentUser: null,
        currentCompany: null,
        cart: [],
        currentViewingClient: null,
        currentViewingSale: null
    };

    const auth = {
        init() {
            const sessionStr = sessionStorage.getItem('gnx_session');
            if (sessionStr) {
                const userId = JSON.parse(sessionStr);
                const u = db.getTable('users').find(x => x.id === userId && x.status === 'active');
                if (u) {
                    state.currentUser = u;
                    state.currentCompany = db.getTable('companies').find(x => x.id === u.companyId);
                    return true;
                }
            }
            return false;
        },
        login(email, password) {
            const u = db.getTable('users').find(x => x.email === email && x.password === password);
            if (!u) throw new Error('Credenciais inválidas.');
            if (u.status !== 'active') throw new Error('Sua conta está aguardando aprovação do admin.');

            sessionStorage.setItem('gnx_session', JSON.stringify(u.id));
            state.currentUser = u;
            state.currentCompany = db.getTable('companies').find(x => x.id === u.companyId);
        },
        logout() {
            sessionStorage.removeItem('gnx_session');
            state.currentUser = null;
            state.currentCompany = null;
        },
        registerCompany(companyName, adminName, email, password) {
            if (db.getTable('users').some(x => x.email === email)) throw new Error('E-mail já está em uso.');
            const code = 'GNX-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            const comp = db.insert('companies', { name: companyName, inviteCode: code, config: {} });
            const user = db.insert('users', { companyId: comp.id, name: adminName, email, password, role: 'admin', status: 'active' });
            return user;
        },
        registerEmployee(inviteCode, name, email, password) {
            if (db.getTable('users').some(x => x.email === email)) throw new Error('E-mail já cadastrado.');
            const comp = db.getTable('companies').find(x => x.inviteCode === inviteCode);
            if (!comp) throw new Error('Código de empresa inválido.');
            db.insert('users', { companyId: comp.id, name, email, password, role: 'func', status: 'pending' });
        }
    };

    // --- The Core Application Object ---
    const app = {
        // Nav & Layout
        init() {
            db.load();
            if (auth.init()) {
                this.renderApp();
            } else {
                this.showLogin();
            }
            setTimeout(() => lucide.createIcons(), 100);
            this._bindEvents();
        },

        _bindEvents() {
            document.getElementById('form-login').addEventListener('submit', e => {
                e.preventDefault();
                try {
                    auth.login(document.getElementById('login-email').value, document.getElementById('login-password').value);
                    this.renderApp();
                    utils.toast('Bem-vindo ao GNX!', 'success');
                } catch (err) { utils.toast(err.message, 'error'); }
            });
            document.getElementById('form-register-company').addEventListener('submit', e => {
                e.preventDefault();
                try {
                    auth.registerCompany(
                        document.getElementById('reg-company-name').value,
                        document.getElementById('reg-admin-name').value,
                        document.getElementById('reg-company-email').value,
                        document.getElementById('reg-company-password').value
                    );
                    utils.toast('Empresa criada com absoluto sucesso!', 'success');
                    this.showLogin();
                } catch (err) { utils.toast(err.message, 'error'); }
            });
            document.getElementById('form-register-employee').addEventListener('submit', e => {
                e.preventDefault();
                try {
                    auth.registerEmployee(
                        document.getElementById('reg-emp-code').value,
                        document.getElementById('reg-emp-name').value,
                        document.getElementById('reg-emp-email').value,
                        document.getElementById('reg-emp-password').value
                    );
                    utils.toast('Solicitação enviada. Aguarde aprovação do admin!', 'info');
                    this.showLogin();
                } catch (err) { utils.toast(err.message, 'error'); }
            });

            // Navigation bindings
            document.querySelectorAll('.nav-item').forEach(el => {
                el.addEventListener('click', e => {
                    e.preventDefault();
                    if (el.dataset.page) this.navigate(el.dataset.page);
                    if (window.innerWidth <= 768) this.toggleSidebar();
                });
            });

            // App Modals & Forms handling
            // Client
            document.getElementById('form-cliente').addEventListener('submit', (e) => {
                e.preventDefault();
                const cid = state.currentUser.companyId;
                const payload = {
                    name: document.getElementById('mc-name').value,
                    contact: document.getElementById('mc-contact').value,
                    address: document.getElementById('mc-address').value
                };
                const id = document.getElementById('mc-id').value;
                if (id) db.update('clients', id, payload);
                else payload.companyId = cid, db.insert('clients', payload);
                utils.toast('Cliente salvo com sucesso', 'success');
                this.closeModal('modal-cliente');
                this.renderClients();
            });

            // Product
            document.getElementById('form-produto').addEventListener('submit', (e) => {
                e.preventDefault();
                const cid = state.currentUser.companyId;
                const payload = {
                    name: document.getElementById('mp-name').value,
                    desc: document.getElementById('mp-desc').value,
                    cost: parseFloat(document.getElementById('mp-cost').value || 0),
                    price: parseFloat(document.getElementById('mp-price').value || 0)
                };
                const id = document.getElementById('mp-id').value;
                if (id) db.update('products', id, payload);
                else payload.companyId = cid, db.insert('products', payload);
                utils.toast('Produto salvo!', 'success');
                this.closeModal('modal-produto');
                this.renderProducts();
            });

            // Sale Creation
            document.getElementById('form-venda').addEventListener('submit', (e) => {
                e.preventDefault();
                if (state.cart.length === 0) return utils.toast('Adicione produtos na cesta!', 'error');

                const cid = state.currentUser.companyId;
                const clientId = document.getElementById('mv-client-id').value;
                const installmentsNum = parseInt(document.getElementById('mv-installments').value);
                const interval = parseInt(document.getElementById('mv-interval').value);
                const downpayment = parseFloat(document.getElementById('mv-downpayment').value) || 0;

                const total = state.cart.reduce((s, c) => s + (c.qtd * c.price), 0);

                // Insert Sale
                const sale = db.insert('sales', {
                    companyId: cid, clientId, date: new Date().toISOString().split('T')[0],
                    total, status: 'pendente', items: state.cart
                });

                // Generate Installments Finance Logic
                const amountToFinance = total - downpayment;
                if (downpayment > 0) {
                    db.insert('installments', {
                        companyId: cid, saleId: sale.id, clientId, num: 'Sinal/Entrada',
                        dueDate: new Date().toISOString().split('T')[0], amount: downpayment, status: 'pago'
                    });
                }

                if (amountToFinance > 0) {
                    const instAmount = amountToFinance / installmentsNum;
                    const now = new Date();
                    for (let i = 1; i <= installmentsNum; i++) {
                        let due = new Date(now.getTime() + (interval * i * 86400000));
                        db.insert('installments', {
                            companyId: cid, saleId: sale.id, clientId, num: i.toString(),
                            dueDate: due.toISOString().split('T')[0], amount: instAmount, status: 'pendente'
                        });
                    }
                } else if (downpayment >= total) {
                    db.update('sales', sale.id, { status: 'pago' });
                }

                utils.toast('Venda e títulos gerados com sucesso!', 'success');
                this.closeModal('modal-venda');
                this.renderSales();
                this.renderDashboard();
            });

            // Received amount (Amortize)
            document.getElementById('form-adiantamento').addEventListener('submit', (e) => {
                e.preventDefault();
                const amt = parseFloat(document.getElementById('ma-amount').value);
                if (!amt || amt <= 0) return utils.toast('Valor inválido', 'error');
                if (!state.currentViewingSale) return;

                const cid = state.currentUser.companyId;
                const installments = db.getTable('installments', cid)
                    .filter(i => i.saleId === state.currentViewingSale.id && i.status !== 'pago')
                    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

                let remaining = amt;
                let amortizedCount = 0;

                // In a perfect system we fractionally update. Here we fractionally deduct if partial.
                for (let inst of installments) {
                    if (remaining <= 0) break;
                    if (remaining >= inst.amount) {
                        db.update('installments', inst.id, { status: 'pago' });
                        remaining -= inst.amount;
                        amortizedCount++;
                    } else {
                        db.update('installments', inst.id, { amount: inst.amount - remaining }); // Deduct

                        // Register the partial snippet as a paid ghost installment for audit history
                        db.insert('installments', {
                            companyId: cid, saleId: inst.saleId, clientId: inst.clientId,
                            num: `Adiant. (${inst.num})`, dueDate: new Date().toISOString().split('T')[0],
                            amount: remaining, status: 'pago'
                        });
                        remaining = 0;
                        amortizedCount++;
                    }
                }

                // If out of pending, mark sale paid
                const pendingNow = db.getTable('installments', cid).filter(i => i.saleId === state.currentViewingSale.id && i.status !== 'pago');
                if (pendingNow.length === 0) {
                    db.update('sales', state.currentViewingSale.id, { status: 'pago' });
                }

                utils.toast(`Amortização realizada em ${amortizedCount} parcela(s)!`, 'success');
                this.closeModal('modal-adiantamento');
                this.openSaleDetail(state.currentViewingSale.id); // Refresh detail
            });
        },

        // --- Auth Display ---
        showLogin() {
            document.body.className = '';
            document.getElementById('auth-view').classList.add('active');
            document.getElementById('main-layout').classList.remove('active');
            ['form-login', 'form-register-company', 'form-register-employee'].forEach(id => {
                document.getElementById(id).classList.add('hidden');
            });
            document.getElementById('form-login').classList.remove('hidden');
        },
        showRegister() {
            document.getElementById('form-login').classList.add('hidden');
            document.getElementById('form-register-company').classList.remove('hidden');
        },
        showRegisterEmployee() {
            document.getElementById('form-login').classList.add('hidden');
            document.getElementById('form-register-employee').classList.remove('hidden');
        },
        logout() { auth.logout(); this.showLogin(); },

        // --- Main Rendering ---
        renderApp() {
            document.getElementById('auth-view').classList.remove('active');
            document.getElementById('main-layout').classList.add('active');

            const isAd = state.currentUser.role === 'admin';
            document.querySelectorAll('.admin-only').forEach(el => isAd ? el.style.display = 'flex' : el.style.display = 'none');

            document.getElementById('user-display-name').textContent = state.currentUser.name;
            document.getElementById('user-display-role').textContent = isAd ? "Administrador" : "Equipe";
            document.getElementById('user-avatar-initial').textContent = state.currentUser.name.charAt(0).toUpperCase();

            this.applyTheme(state.currentCompany.config);
            this.navigate('dashboard');
            setTimeout(() => lucide.createIcons(), 50);
        },

        applyTheme(cfg) {
            if (!cfg) return;
            const root = document.documentElement;
            if (cfg.color) {
                const hc = cfg.color;
                // Extract HSL from hex using a canvas or regex - simplify by just applying css prop if supported or override style
                // Let's rely on standard color parsing or just set the generic variable as string if it was updated
                // Actually, our CSS expects HSL Hue. In the browser we can just convert hex to hue roughly, but replacing the background color direct is easier
                root.style.setProperty('--color-primary', hc);
            }
            if (cfg.blur) {
                root.style.setProperty('--glass-blur', cfg.blur + 'px');
            }
        },
        saveConfig() {
            const cfg = {
                color: document.getElementById('cfg-color').value,
                blur: document.getElementById('cfg-blur').value
            };
            state.currentCompany.config = cfg;
            db.update('companies', state.currentCompany.id, { config: cfg });
            this.applyTheme(cfg);
            utils.toast('Tema atualizado!', 'success');
        },
        resetConfig() {
            document.documentElement.removeAttribute('style');
            db.update('companies', state.currentCompany.id, { config: {} });
            utils.toast('Tema padrão restaurado.', 'info');
        },

        // --- Navigation ---
        toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); },
        navigate(pageId) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const p = document.getElementById(`page-${pageId}`);
            if (p) p.classList.add('active');

            document.querySelectorAll('.nav-item').forEach(nv => {
                nv.classList.remove('active');
                if (nv.dataset.page === pageId) nv.classList.add('active');
            });

            const titleMap = { dashboard: 'Dashboard Visão Global', clientes: 'Gestão de Clientes', produtos: 'Catálogo', vendas: 'Central de Vendas', parcelas: 'Operacional Financeiro', equipe: 'Controle de Acesso', config: 'Personalização' };
            if (titleMap[pageId]) document.getElementById('topbar-title').textContent = titleMap[pageId];

            if (pageId === 'dashboard') this.renderDashboard();
            if (pageId === 'clientes') this.renderClients();
            if (pageId === 'produtos') this.renderProducts();
            if (pageId === 'vendas') this.renderSales();
            if (pageId === 'parcelas') this.renderInstallments();
            if (pageId === 'equipe') this.renderEquipe();
        },

        openModal(id) {
            document.getElementById(id).classList.add('active');
            if (id === 'modal-venda') this.renderVendaDeps();
        },
        closeModal(id) {
            document.getElementById(id).classList.remove('active');
            const f = document.querySelector(`#${id} form`);
            if (f) f.reset();
            if (id === 'modal-venda') { state.cart = []; this.renderCart(); }
        },

        // --- Dashboard ---
        renderDashboard() {
            const cid = state.currentUser.companyId;
            const sales = db.getTable('sales', cid);
            const insts = db.getTable('installments', cid);

            const atrasados = insts.filter(i => i.status === 'pendente' && new Date(i.dueDate) < new Date()).reduce((s, i) => s + parseFloat(i.amount), 0);
            const brutos = sales.reduce((s, i) => s + parseFloat(i.total), 0);

            // Count late badges
            const lateCount = insts.filter(i => i.status === 'pendente' && new Date(i.dueDate) < new Date()).length;
            const b = document.getElementById('badge-parcelas');
            if (lateCount > 0) { b.textContent = lateCount; b.classList.remove('hidden'); } else b.classList.add('hidden');

            document.getElementById('dash-vendas').textContent = sales.length;
            document.getElementById('dash-faturamento').textContent = utils.formatMoney(brutos);
            document.getElementById('dash-atrasos').textContent = utils.formatMoney(atrasados);

            // Calculate Lucro Bruto roughly from items
            let lucroTotal = 0;
            let prodsCache = {};
            db.getTable('products', cid).forEach(p => prodsCache[p.id] = p.cost);
            sales.forEach(s => {
                s.items.forEach(i => {
                    const cost = prodsCache[i.id] || 0;
                    lucroTotal += (i.price - cost) * i.qtd;
                });
            });
            document.getElementById('dash-lucro').textContent = utils.formatMoney(lucroTotal);

            // Recent sales render
            const rTbody = document.getElementById('dash-recent-sales');
            rTbody.innerHTML = '';
            const clis = {}; db.getTable('clients', cid).forEach(c => clis[c.id] = c.name);

            const recent = sales.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
            recent.forEach(s => {
                rTbody.innerHTML += `<tr>
              <td><span class="text-muted">#${s.id.slice(0, 6).toUpperCase()}</span></td>
              <td><strong>${clis[s.clientId] || 'Avulso'}</strong></td>
              <td>${utils.formatDate(s.date)}</td>
              <td>${utils.formatMoney(s.total)}</td>
              <td><span class="status-badge status-${s.status}">${s.status}</span></td>
           </tr>`;
            });
            lucide.createIcons();
        },

        // --- Modules ---
        renderClients() {
            const cid = state.currentUser.companyId;
            const q = document.getElementById('search-cli').value.toLowerCase();
            const tbody = document.getElementById('table-clientes');
            tbody.innerHTML = '';
            let list = db.getTable('clients', cid);
            if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || (c.contact && c.contact.toLowerCase().includes(q)));

            list.forEach(c => {
                tbody.innerHTML += `<tr>
             <td style="font-weight:600">${c.name}</td>
             <td class="text-muted">${c.contact || '-'}</td>
             <td class="text-muted text-sm">${(c.address || '-').slice(0, 30)}</td>
             <td class="text-muted text-sm">${utils.formatDate(c.createdAt)}</td>
             <td>
               <button class="btn btn-ghost btn-sm color-primary" onclick="app.abrirPerfilCliente('${c.id}')"><i data-lucide="eye"></i> Perfil Info.</button>
             </td>
           </tr>`;
            });
            lucide.createIcons();
        },

        calcMargin() {
            const cost = parseFloat(document.getElementById('mp-cost').value || 0);
            const price = parseFloat(document.getElementById('mp-price').value || 0);
            if (cost > 0 && price > 0) {
                let prc = ((price - cost) / price) * 100;
                document.getElementById('mp-margin').textContent = prc.toFixed(2) + '%';
            }
        },

        renderProducts() {
            const cid = state.currentUser.companyId;
            const q = document.getElementById('search-prod').value.toLowerCase();
            const tbody = document.getElementById('table-produtos');
            tbody.innerHTML = '';
            let list = db.getTable('products', cid);
            if (q) list = list.filter(p => p.name.toLowerCase().includes(q));

            list.forEach(p => {
                const mg = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(1) : 0;
                tbody.innerHTML += `<tr>
             <td style="font-weight:600">${p.name}</td>
             <td class="text-muted text-sm">${p.desc || '-'}</td>
             <td class="text-muted">${utils.formatMoney(p.cost)}</td>
             <td>${utils.formatMoney(p.price)}</td>
             <td class="color-success">${mg}%</td>
             <td><button class="icon-btn color-danger" onclick="app.deleteProd('${p.id}')"><i data-lucide="trash-2"></i></button></td>
           </tr>`;
            });
            lucide.createIcons();
        },
        deleteProd(id) {
            if (confirm('Tem certeza? Removerá o produto do catálogo (vendas passadas ficam imutáveis).')) {
                db.remove('products', id);
                this.renderProducts();
                utils.toast('Extirpado com sucesso', 'success');
            }
        },

        // Sales Logic
        renderSales() {
            const cid = state.currentUser.companyId;
            const tbody = document.getElementById('table-vendas');
            tbody.innerHTML = '';
            let list = db.getTable('sales', cid).sort((a, b) => new Date(b.date) - new Date(a.date));
            const clis = {}; db.getTable('clients', cid).forEach(c => clis[c.id] = c.name);

            list.forEach(s => {
                tbody.innerHTML += `<tr>
             <td style="font-family:monospace; color:var(--color-primary)">${s.id.slice(0, 8).toUpperCase()}</td>
             <td style="font-weight:600">${clis[s.clientId] || '?'}</td>
             <td>${utils.formatDate(s.date)}</td>
             <td style="font-weight:bold">${utils.formatMoney(s.total)}</td>
             <td><span class="status-badge status-${s.status}">${s.status}</span></td>
             <td><button class="btn btn-ghost btn-sm" onclick="app.openSaleDetail('${s.id}')">Explorar <i data-lucide="chevron-right"></i></button></td>
           </tr>`;
            });
            lucide.createIcons();
        },
        renderVendaDeps() {
            const cid = state.currentUser.companyId;
            const cliSel = document.getElementById('mv-client-id');
            const proSel = document.getElementById('mv-prod-sel');

            cliSel.innerHTML = '';
            db.getTable('clients', cid).forEach(c => {
                cliSel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
            proSel.innerHTML = '';
            db.getTable('products', cid).forEach(p => {
                proSel.innerHTML += `<option value="${p.id}" data-price="${p.price}">${p.name} - ${utils.formatMoney(p.price)}</option>`;
            });
            state.cart = [];
            this.renderCart();
        },
        addCartItem() {
            const sel = document.getElementById('mv-prod-sel');
            if (!sel.options.length) return utils.toast('Nenhum produto cadastrado', 'error');
            const opt = sel.options[sel.selectedIndex];
            const qtd = parseInt(document.getElementById('mv-prod-qtd').value);
            if (qtd <= 0) return;
            state.cart.push({
                id: opt.value, name: opt.text.split(' - ')[0], price: parseFloat(opt.dataset.price), qtd
            });
            this.renderCart();
        },
        rmvCartItem(idx) { state.cart.splice(idx, 1); this.renderCart(); },
        renderCart() {
            const tbody = document.getElementById('mv-cart-body');
            tbody.innerHTML = '';
            let tot = 0;
            state.cart.forEach((c, idx) => {
                const sub = c.price * c.qtd; tot += sub;
                tbody.innerHTML += `<tr>
             <td>${c.name}</td><td>${c.qtd}</td><td>${utils.formatMoney(c.price)}</td><td>${utils.formatMoney(sub)}</td>
             <td><button type="button" class="icon-btn" onclick="app.rmvCartItem(${idx})"><i data-lucide="x"></i></button></td>
           </tr>`;
            });
            document.getElementById('mv-cart-total').textContent = utils.formatMoney(tot);
            lucide.createIcons();
        },

        // Detalhe Venda
        openSaleDetail(id) {
            const cid = state.currentUser.companyId;
            const s = db.getTable('sales', cid).find(x => x.id == id);
            if (!s) return;
            state.currentViewingSale = s;
            this.navigate('detalhe-venda');
            document.getElementById('vd-title').textContent = `Documento / Fatura: ${s.id.slice(0, 8).toUpperCase()}`;

            const itemsTb = document.getElementById('vd-items'); itemsTb.innerHTML = '';
            s.items.forEach(c => {
                itemsTb.innerHTML += `<tr><td>${c.name}</td><td>${c.qtd}</td><td>${utils.formatMoney(c.price)}</td><td>${utils.formatMoney(c.price * c.qtd)}</td></tr>`;
            });

            const instTb = document.getElementById('vd-installments'); instTb.innerHTML = '';
            const ins = db.getTable('installments', cid).filter(i => i.saleId === s.id).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

            ins.forEach(i => {
                let st = i.status;
                if (st === 'pendente' && new Date(i.dueDate) < new Date()) st = 'atrasado';

                instTb.innerHTML += `<tr>
            <td><strong class="color-primary">#${i.num}</strong></td>
            <td>${utils.formatDate(i.dueDate)}</td>
            <td style="font-weight:bold">${utils.formatMoney(i.amount)}</td>
            <td><span class="status-badge status-${st}">${st}</span></td>
            <td>${st !== 'pago' ? `<button class="btn btn-ghost btn-sm color-success" onclick="app.directPayInstallment('${i.id}')">Quitar Auto</button>` : `<i data-lucide="check" class="color-success"></i>`}</td>
          </tr>`;
            });
            lucide.createIcons();
        },

        directPayInstallment(id) {
            db.update('installments', id, { status: 'pago' });
            const inst = db.getTable('installments', state.currentUser.companyId).find(x => x.id === id);

            // Check if all paid
            const pendings = db.getTable('installments', state.currentUser.companyId).filter(x => x.saleId === inst.saleId && x.status !== 'pago');
            if (pendings.length === 0) db.update('sales', inst.saleId, { status: 'pago' });

            utils.toast('Baixa na parcela efetuada.', 'success');
            this.openSaleDetail(inst.saleId); // refresh
        },

        // Perfil Cliente
        abrirPerfilCliente(id) {
            const cid = state.currentUser.companyId;
            const cli = db.getTable('clients', cid).find(x => x.id == id);
            if (!cli) return;
            this.navigate('perfil-cliente');
            document.getElementById('pc-title').textContent = cli.name;

            const sales = db.getTable('sales', cid).filter(s => s.clientId === id);
            const insts = db.getTable('installments', cid).filter(i => i.clientId === id);

            const totalPago = insts.filter(i => i.status === 'pago').reduce((s, i) => s + parseFloat(i.amount), 0);
            const devendo = insts.filter(i => i.status === 'pendente' && new Date(i.dueDate) < new Date()).reduce((s, i) => s + parseFloat(i.amount), 0);
            const pendenteF = insts.filter(i => i.status === 'pendente' && new Date(i.dueDate) >= new Date()).reduce((s, i) => s + parseFloat(i.amount), 0); // vai vencer

            document.getElementById('pc-total-gasto').textContent = utils.formatMoney(totalPago);
            document.getElementById('pc-saldo-devedor').textContent = utils.formatMoney(devendo);
            document.getElementById('pc-saldo-pendente').textContent = utils.formatMoney(pendenteF);

            const tb = document.getElementById('pc-sales'); tb.innerHTML = '';
            sales.forEach(s => {
                tb.innerHTML += `<tr>
             <td style="font-family:monospace" class="color-primary">${s.id.slice(0, 6).toUpperCase()}</td>
             <td>${utils.formatDate(s.date)}</td>
             <td>${utils.formatMoney(s.total)}</td>
             <td><span class="status-badge status-${s.status}">${s.status}</span></td>
           </tr>`;
            });
        },

        // General Installments List
        renderInstallments(filter = 'all') {
            const cid = state.currentUser.companyId;
            const tb = document.getElementById('table-parcelas');
            tb.innerHTML = '';
            const clis = {}; db.getTable('clients', cid).forEach(c => clis[c.id] = c.name);

            let arr = db.getTable('installments', cid).sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

            arr.forEach(i => {
                if (i.status === 'pendente' && new Date(i.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))) {
                    i.displayStatus = 'atrasado';
                } else {
                    i.displayStatus = i.status;
                }
            });

            if (filter !== 'all') {
                arr = arr.filter(i => i.displayStatus === filter);
            }

            arr.forEach((i, idx) => {
                if (idx > 100) return; // limit to 100 on general view
                tb.innerHTML += `<tr>
              <td style="font-family:monospace">${i.saleId.slice(0, 6).toUpperCase()}</td>
              <td style="font-weight:600">${clis[i.clientId] || 'Excluído'}</td>
              <td>${i.num}</td>
              <td class="${i.displayStatus === 'atrasado' ? 'color-danger' : ''}">${utils.formatDate(i.dueDate)}</td>
              <td>${utils.formatMoney(i.amount)}</td>
              <td><span class="status-badge status-${i.displayStatus}">${i.displayStatus}</span></td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="app.openSaleDetail('${i.saleId}')"><i data-lucide="eye"></i></button>
              </td>
            </tr>`;
            });
            lucide.createIcons();
        },

        // Equipe View
        renderEquipe() {
            document.getElementById('display-invite-code').textContent = state.currentCompany.inviteCode;
            const cid = state.currentUser.companyId;
            const tb = document.getElementById('table-equipe');
            tb.innerHTML = '';
            const list = db.getTable('users', cid);

            list.forEach(u => {
                let action = '-';
                if (u.role !== 'admin' && state.currentUser.role === 'admin') {
                    if (u.status === 'pending') {
                        action = `<button class="btn btn-sm btn-primary" onclick="app.approveUser('${u.id}')">Aprovar Admissão</button>
                             <button class="icon-btn color-danger" onclick="app.removeUser('${u.id}')"><i data-lucide="trash-2"></i></button>`;
                    } else {
                        action = `<button class="icon-btn color-danger" onclick="app.removeUser('${u.id}')"><i data-lucide="power"></i></button>`;
                    }
                }
                tb.innerHTML += `<tr>
             <td><strong>${u.name}</strong> ${u.id === state.currentUser.id ? '(Você)' : ''}</td>
             <td>${u.email}</td>
             <td><span class="status-badge" style="background:${u.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}">${u.status}</span></td>
             <td class="text-sm text-muted">${u.role.toUpperCase()}</td>
             <td><div class="flex gap-2">${action}</div></td>
           </tr>`;
            });
            lucide.createIcons();
        },
        approveUser(id) { db.update('users', id, { status: 'active' }); this.renderEquipe(); utils.toast('Usuário aprovado para usar o sistema!', 'success'); },
        removeUser(id) { if (confirm('Remover permanente do quadro da empresa?')) { db.remove('users', id); this.renderEquipe(); } }
    };

    // Attach strictly defined components externally to window.app
    window.app = app;

    // Initialize
    document.addEventListener('DOMContentLoaded', () => app.init());

})();
