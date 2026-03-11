# GNX - Gestor de Nexos

O **GNX (Gestor de Nexos)** é um Moderno Sistema de Gestão Empresarial (ERP/CRM) projetado para unir o controle rigoroso do seu negócio à uma experiência visual imersiva e responsiva. Mais do que apenas planilhas, o GNX transforma a visualização dos dados da sua empresa em um painel dinâmico, escuro (Dark Mode) e com elementos cristalinos (Glassmorphism), criando uma experiência de usuário focada em agilidade e clareza.

## 🎯 Proposta de Valor
O GNX foi criado para lojistas, prestadores de serviços, micro e pequenas empresas que precisam de controle exato sobre vendas parceladas, fluxo de caixa e histórico de clientes, sem a complexidade de sistemas legados. Ele empodera o administrador (Chefe) e permite delegar tarefas para a equipe (Funcionários) com total segurança.

---

## 🚀 Funcionalidades Principais

### 1. Gestão de Equipe e Multi-usuário (RBAC)
*   **Controle de Acesso Escalonado:** Separação estrita entre Administradores (Donos) e Funcionários.
*   **Ecossistema por Empresa:** Vários donos podem criar suas "Empresas" no mesmo sistema. Cada empresa ganha um **Código de Convite Único**.
*   **Admissão de Funcionários:** O funcionário se cadastra usando o Código da Empresa e aguarda em "Status Pendente". O Administrador possui total controle no painel "Equipe" para *Aprovar* ou *Remover* o acesso.
*   **Privacidade:** Funcionários não podem acessar "Configurações", "Relatórios Financeiros" ou "Gestão de Equipe", mantendo o sigilo dos dados estratégicos.

### 2. CRM Dinâmico (Perfil de Clientes)
*   **Dashboard Individual:** Cada cliente possui um "Perfil Avançado" próprio, acessível em um clique.
*   **Raio-X Financeiro:** Visualize imediatamente o "Total em Compras", "Saldo Devedor (Atrasado)" e "Total Pendente (À Vencer)" do seu cliente.
*   **Histórico Inteligente:** As vendas do cliente são automaticamente filtradas entre **Vendas Pendentes / Em Curso** e **Vendas Cumpridas** (Quitadas), mantendo as cobranças ativas em evidência.

### 3. Sistema Absoluto de Vendas e Parcelamento
*   **PDV Rápido:** Crie vendas vinculando os produtos cadastrados. O GNX calcula subtotais, totais e margens na hora.
*   **Parcelamento Automático:** Cadastre a venda e peça para o sistema dividir em até 24 vezes, escolhendo o intervalo (ex: a cada 30 dias). As parcelas são atreladas à nota e ao cliente.
*   **Amortização e Adiantamentos (Novo):** Se o cliente der um valor fora de época (Sinal/Abono), basta registrar o "Adiantamento". O GNX, com sua inteligência algorítmica, varrerá as parcelas pendentes daquela nota e as deduzirá/liquidará progressivamente da fila até que o valor informado se esgote!

### 4. Visão Estratégica
*   **Dashboard Global:** Resumo em tempo real do Total Recebido vs Pendente, contagem de vendas e acompanhamento geral.
*   **Painel de Cobrança (Parcelas):** Aba exclusiva para você rastrear quais parcelas estão Pagas, Pendentes ou Atrasadas no seu negócio inteiro.
*   **Alertas Visuais:** Sistema de *badges* no menu lateral e sinos indicando alertas automáticos sobre parcelas que irão vencer nas próximas horas para não perder o prazo de cobrança.

### 5. Personalização e "White Label"
*   **Customização de Tema:** A aba de "Configurações" deixa o Administrador trocar a cor principal do sistema (Cores Neon), trocar a Imagem de Fundo (Wallpaper) e até mesmo alterar a opacidade dos painéis (Glassmorphism), moldando a interface à Identidade da própria marca em tempo real.

---

## 🛠 Arquitetura e Tecnologia (Under the Hood)
O sistema GNX se destaca pela flexibilidade sem depender de infraestruturas pesadas locais.

*   **Front-end Moderno e Minimalista:** Construído inteiramente com **Vanilla JavaScript, HTML5 e CSS3 puro**, garantindo que rode de forma eficiente em qualquer navegador sem a necessidade de frameworks pesados (Node.js, React, etc).
*   **UI/UX Avançada:** Design em Dark Mode por padrão, fontes amigáveis (*Outfit* e *Inter* do Google Fonts), e uso intensivo de Custom Properties de CSS (Variáveis) para troca rápida de temas dinâmicos via JavaScript.
*   **Backend Serverless Eficiente:** Toda a persistência, autenticação e comunicação em Tempo Real (Realtime) é feita através do **Supabase** (PostgreSQL na Nuvem) com comunicação direta pelo front-end. Zero dependência de servidores Python, Go ou Node.js locais. Tudo é executado direto no lado do cliente com máxima eficiência.
*   **Iconografia:** Adota o padrão minimalista e afiado do *Lucide Icons*.

---

GNX - Gestor de Nexos.
(Criado sob as demandas de alta performance e interface cristalina).
