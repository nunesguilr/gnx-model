import re

def migrate():
    with open('c:/Users/guilherme/.gemini/antigravity/scratch/gnx/app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Add toggleForgot and loginOAuth to window.app
    app_funcs = """
    toggleForgot: function() {
        document.getElementById('login-form').classList.toggle('hidden');
        document.getElementById('forgot-form').classList.toggle('hidden');
    },

    loginOAuth: async function(provider) {
        const { error } = await supabase.auth.signInWithOAuth({ provider: provider });
        if(error) showToast(error.message, 'error');
    },
    
"""
    content = content.replace("window.app = {", "window.app = {" + app_funcs)

    # 1. replace client form
    client_form = """document.getElementById('form-cliente').addEventListener('submit', async (e) => {
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
    });"""
    content = re.sub(r"document\.getElementById\('form-cliente'\)\.addEventListener\('submit', \(e\) => \{.*?\n        // Auto update profile view if it's currently open.*?\}\);", client_form, content, flags=re.DOTALL)

    # 2. replace produto form
    produto_form = """document.getElementById('form-produto').addEventListener('submit', async (e) => {
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
    });"""
    content = re.sub(r"document\.getElementById\('form-produto'\)\.addEventListener\('submit', \(e\) => \{.*?app\.renderProdutos\(\);\n    \}\);", produto_form, content, flags=re.DOTALL)

    # 3. Cancel sale
    content = content.replace("""appData.vendas.find(x => x.id === id);
            if (v) v.status = 'cancelado';
            // remove pending parcels
            appData.parcelas = appData.parcelas.filter(p => !(p.vendaId === id && p.status === 'pendente'));
            saveState();
            this.renderVendas();
            showToast('Venda cancelada', 'warning');""", """await supabase.from('sales').update({status: 'cancelado'}).eq('id', id);
            await supabase.from('installments').delete().eq('sale_id', id).eq('status', 'pendente');
            showToast('Venda cancelada', 'warning');""")

    # 4. Del Cliente
    content = content.replace("""appData.clientes = appData.clientes.filter(x => x.id !== id);
            saveState();
            this.renderClientes();
            showToast('Cliente excluído', 'success');""", """await supabase.from('clients').delete().eq('id', id);
            showToast('Cliente excluído', 'success');""")
            
    # 5. Del Produto
    content = content.replace("""appData.produtos = appData.produtos.filter(x => x.id !== id);
            saveState();
            this.renderProdutos();
            showToast('Produto excluído', 'success');""", """await supabase.from('products').delete().eq('id', id);
            showToast('Produto excluído', 'success');""")

    # 6. Pagar Parcela
    pagar = """if (confirm('Confirmar pagamento desta parcela?')) {
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
        }"""
    content = re.sub(r"if \(confirm\('Confirmar pagamento desta parcela\?'\)\) \{.*?showToast\('Parcela paga!', 'success'\);\n            \}\n        \}", pagar, content, flags=re.DOTALL)
    
    # Write back
    with open('c:/Users/guilherme/.gemini/antigravity/scratch/gnx/app.js', 'w', encoding='utf-8') as f:
        f.write(content)

migrate()
