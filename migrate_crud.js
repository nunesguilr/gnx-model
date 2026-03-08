const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf-8');

// 1. App func additions
const app_funcs = `    toggleForgot: function() {
        document.getElementById('login-form').classList.toggle('hidden');
        document.getElementById('forgot-form').classList.toggle('hidden');
    },

    loginOAuth: async function(provider) {
        const { error } = await supabase.auth.signInWithOAuth({ provider: provider });
        if(error) showToast(error.message, 'error');
    },
    
`;
content = content.replace("window.app = {", "window.app = {\n" + app_funcs);

// 2. Cliente form
content = content.replace(/document\.getElementById\('form-cliente'\)\.addEventListener\('submit', \(e\) => \{[\s\S]*?\/\/ Auto update profile view if it's currently open[\s\S]*?\}\);/g, `document.getElementById('form-cliente').addEventListener('submit', async (e) => {
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

        let res;
        if (id) {
            res = await supabase.from('clients').update(data).eq('id', id);
            if(!res.error) showToast('Cliente atualizado', 'success');
        } else {
            res = await supabase.from('clients').insert(data);
            if(!res.error) showToast('Cliente cadastrado', 'success');
        }

        if(res.error) { showToast('Erro: ' + res.error.message, 'error'); return; }

        app.closeModal('modal-cliente');
    });`);

// 3. Produto Form
content = content.replace(/document\.getElementById\('form-produto'\)\.addEventListener\('submit', \(e\) => \{[\s\S]*?app\.renderProdutos\(\);\n    \}\);/g, `document.getElementById('form-produto').addEventListener('submit', async (e) => {
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

        let res;
        if (id) {
            res = await supabase.from('products').update(data).eq('id', id);
            if(!res.error) showToast('Produto atualizado', 'success');
        } else {
            res = await supabase.from('products').insert(data);
            if(!res.error) showToast('Produto cadastrado', 'success');
        }
        
        if(res.error) { showToast('Erro: ' + res.error.message, 'error'); return; }

        app.closeModal('modal-produto');
    });`);

// 4. Cancel sale
content = content.replace(/appData\.vendas\.find\(x => x\.id === id\);\n\s*if \(v\) v\.status = 'cancelado';\n\s*\/\/ remove pending parcels\n\s*appData\.parcelas = appData\.parcelas\.filter\(p => !\(p\.vendaId === id && p\.status === 'pendente'\)\);\n\s*saveState\(\);\n\s*this\.renderVendas\(\);\n\s*showToast\('Venda cancelada', 'warning'\);/, `await supabase.from('sales').update({status: 'cancelado'}).eq('id', id);
            await supabase.from('installments').delete().eq('sale_id', id).eq('status', 'pendente');
            showToast('Venda cancelada', 'warning');`);

// 5. Del cliente
content = content.replace(/appData\.clientes = appData\.clientes\.filter\(x => x\.id !== id\);\n\s*saveState\(\);\n\s*this\.renderClientes\(\);\n\s*showToast\('Cliente excluído', 'success'\);/, `await supabase.from('clients').delete().eq('id', id);
            showToast('Cliente excluído', 'success');`);

// 6. Del produto
content = content.replace(/appData\.produtos = appData\.produtos\.filter\(x => x\.id !== id\);\n\s*saveState\(\);\n\s*this\.renderProdutos\(\);\n\s*showToast\('Produto excluído', 'success'\);/, `await supabase.from('products').delete().eq('id', id);
            showToast('Produto excluído', 'success');`);

// 7. Pagar parcela
content = content.replace(/if \(confirm\('Confirmar pagamento desta parcela\?'\)\) \{[\s\S]*?showToast\('Parcela paga!', 'success'\);\n\s*\}\n\s*\}/g, `if (confirm('Confirmar pagamento desta parcela?')) {
            const p = appData.parcelas.find(x => x.id === id);
            if (p) {
                const {error} = await supabase.from('installment_payments').insert({
                    installment_id: p.id,
                    amount: p.value,
                    payment_date: new Date().toISOString().split('T')[0]
                });
                if(error) { showToast(error.message, 'error'); return; }
                showToast('Parcela paga!', 'success');
            }
        }`);

fs.writeFileSync('app.js', content, 'utf-8');
console.log('Migrate 1 done');
