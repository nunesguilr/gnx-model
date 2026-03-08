const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf-8');

// 1. Auth Logic (Reset Password, Login, Signup)
const auth_logic = `
    // Forgot Password
    document.getElementById('forgot-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const em = document.getElementById('forgot-email').value;
        const { error } = await supabase.auth.resetPasswordForEmail(em);
        if(error) showToast(error.message, 'error');
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

        // Fetch user from public.users to get company details
        const { data: userRow } = await supabase.from('users').select('*').eq('id', data.user.id).single();
        if(userRow) {
            if(userRow.status === 'pendente' && userRow.role === 'funcionario') {
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

        // Register in auth
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
            
            if(cErr) { showToast('Erro ao criar empresa', 'error'); return; }
            companyId = cData.id;

            // insert user
            await supabase.from('users').insert({
                id: userId, company_id: companyId, name: nome, email: email,
                password_hash: 'auth', role: 'admin', status: 'ativo'
            });

            showToast('Empresa criada com sucesso! Faça login.', 'success');
        } else {
            const code = document.getElementById('reg-code').value.toUpperCase();
            const { data: adminComp } = await supabase.from('companies').select('id').eq('invite_code', code).single();
            if(!adminComp) { showToast('Código inválido', 'error'); return; }
            
            await supabase.from('users').insert({
                id: userId, company_id: adminComp.id, name: nome, email: email,
                password_hash: 'auth', role: 'funcionario', status: 'pendente'
            });

            showToast('Cadastro realizado! Aguarde a aprovação.', 'success');
        }

        els.linkLogin.click();
    });
`;
content = content.replace(/\/\/ Login Form Submit[\s\S]*?els\.linkLogin\.click\(\); \/\/ switch to login\n\s*\}\);/g, auth_logic);

// 2. Venda Form Logic
const vendas_logic = `
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

        // Insert Sale
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

        // Insert Items
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

        // Insert Installments
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
`;
content = content.replace(/\/\/ Venda Form[\s\S]*?app\.updateBadges\(\);\n\s*\}\);/g, vendas_logic);

// 3. Form Adiantamento
const adiantamento = `
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
        
        if(!instErr) {
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
`;
content = content.replace(/\/\/ Form Adiantamento[\s\S]*?app\.updateBadges\(\);\n\s*\}\);/g, adiantamento);


// 4. Initial Auth state Check
const check_login = `
    // Initialize Supabase Auth Check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
        if(session) {
            const { data: userRow } = await supabase.from('users').select('*').eq('id', session.user.id).single();
            if(userRow) {
                currentUser = { ...session.user, ...userRow };
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

    // Handle logout properly
    els.btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut();
        currentUser = null;
        els.mainLayout.classList.add('hidden');
        els.authView.classList.remove('hidden');
        window.location.reload();
    });
`;
content = content.replace(/loadState\(\);\n\n\s*\/\/ Check Login[\s\S]*?showApp\(\);\n\s*\}/g, check_login);
content = content.replace(/\/\/ Logout[\s\S]*?els\.authView\.classList\.remove\('hidden'\);\n\s*\}\);/g, ""); // Remove dupe


// 5. Config
const settings = `document.getElementById('form-config').addEventListener('submit', async (e) => {
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
        showToast('Configurações aplicadas', 'success');
    });`;
content = content.replace(/document\.getElementById\('form-config'\)\.addEventListener\('submit', \(e\) => \{[\s\S]*?showToast\('Configurações aplicadas com sucesso!', 'success'\);\n\s*\}\);/g, settings);

fs.writeFileSync('app.js', content, 'utf-8');
console.log('Migrate all done');
