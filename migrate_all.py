import re

def migrate():
    with open('c:/Users/guilherme/.gemini/antigravity/scratch/gnx/app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # ---- 1. Auth Forms Replacements ----
    auth_logic = """
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
            showToast(`Bem vindo!`, 'success');
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
"""
    content = re.sub(r"// Login Form Submit.*?els\.linkLogin\.click\(\); // switch to login\n    \}\);", auth_logic, content, flags=re.DOTALL)


    # ---- 2. Vendas Form Replacements ----
    vendas_logic = """
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
        showToast(`Venda registrada!`, 'success');
    });
"""
    content = re.sub(r"// Venda Form.*?app\.updateBadges\(\);\n    \}\);", vendas_logic, content, flags=re.DOTALL)


    # ---- 3. Edit Form Adiantamento ----
    adiantamento = """
    document.getElementById('form-adiantamento').addEventListener('submit', async (e) => {
        e.preventDefault();
        const vId = document.getElementById('ad-venda-id').value;
        const v = appData.vendas.find(x => x.id === vId);
        if (!v) return;

        let valor = parseFloat(document.getElementById('ad-valor').value);
        const dataStr = document.getElementById('ad-data').value;

        if (valor <= 0) { showToast('Valor inválido', 'error'); return; }

        // Simplification for adiantamento: just create a new 'adiantamento' installment and immediately pay it
        // Then we'll let the user manage pending installments manually or using custom logic
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
"""
    content = re.sub(r"// Form Adiantamento.*?app\.updateBadges\(\);\n    \}\);", adiantamento, content, flags=re.DOTALL)

    # ---- 4. Check Login in DOMContentLoaded ----
    check_login = """
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
"""
    content = re.sub(r"loadState\(\);\n\n    // Check Login.*?showApp\(\);\n    \}", check_login, content, flags=re.DOTALL)
    
    # Remove old logout listener block to prevent dupe
    content = re.sub(r"// Logout.*?els\.authView\.classList\.remove\('hidden'\);\n    \}\);", "", content, flags=re.DOTALL)

    # Edit setting submit
    settings = """document.getElementById('form-config').addEventListener('submit', async (e) => {
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
    });"""
    content = re.sub(r"document\.getElementById\('form-config'\)\.addEventListener\('submit', \(e\) => \{.*?showToast\('Configurações aplicadas com sucesso!', 'success'\);\n    \}\);", settings, content, flags=re.DOTALL)


    # Write back
    with open('c:/Users/guilherme/.gemini/antigravity/scratch/gnx/app.js', 'w', encoding='utf-8') as f:
        f.write(content)

migrate()
