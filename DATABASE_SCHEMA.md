# Esquema de Banco de Dados - GNX

Para suportar o sistema Gestor de Nexos (GNX) com multilocação (várias empresas), papéis de usuários e gestão financeira, propõe-se um banco de dados relacional (como **PostgreSQL** ou **MySQL**). A modelagem relacional é ideal devido às inúmeras relações e necessidades de consistência financeira (vendas, parcelas e relatórios).

Abaixo está o diagrama lógico estruturado em tabelas:

## 1. `companies` (Empresas)
Tabela central para garantir o isolamento dos dados de diferentes instâncias do sistema.
- `id`: UUID ou INT PK
- `name`: VARCHAR (Nome da empresa)
- `invite_code`: VARCHAR (Código único para convites de funcionários)
- `created_at`: TIMESTAMP

## 2. `users` (Usuários / Equipe)
Armazena tanto administradores quanto funcionários.
- `id`: UUID ou INT PK
- `company_id`: FK -> `companies(id)`
- `name`: VARCHAR
- `email`: VARCHAR (Único)
- `password_hash`: VARCHAR
- `role`: ENUM ('admin', 'funcionario') 
- `status`: ENUM ('ativo', 'pendente', 'bloqueado')
- `created_at`: TIMESTAMP

## 3. `clients` (Clientes)
- `id`: UUID ou INT PK
- `company_id`: FK -> `companies(id)` (Isolamento por empresa)
- `name`: VARCHAR
- `document`: VARCHAR (CPF/CNPJ - opcional)
- `email`: VARCHAR
- `phone`: VARCHAR
- `address`: TEXT
- `obs`: TEXT
- `created_at`: TIMESTAMP

## 4. `products` (Produtos)
- `id`: UUID ou INT PK
- `company_id`: FK -> `companies(id)`
- `name`: VARCHAR
- `description`: TEXT
- `cost_price`: DECIMAL(10,2) (Preço de compra)
- `sale_price`: DECIMAL(10,2) (Preço de venda)
- `margin`: DECIMAL(5,2) (Calculado para relatórios/consultas velozes ou gerado dinamicamente)
- `created_at`: TIMESTAMP

## 5. `sales` (Vendas / Notas)
A cabeça da nota fiscal/venda provendo o total.
- `id`: UUID PK
- `company_id`: FK -> `companies(id)`
- `client_id`: FK -> `clients(id)`
- `sale_number`: INT (Gerado sequencialmente por empresa)
- `date`: DATE ou TIMESTAMP
- `total_amount`: DECIMAL(10,2)
- `status`: ENUM ('pendente', 'pago', 'cancelado')
- `created_at`: TIMESTAMP

## 6. `sale_items` (Itens da Venda)
Os produtos atrelados especificamente a uma venda.
- `id`: UUID PK
- `sale_id`: FK -> `sales(id)` ON DELETE CASCADE
- `product_id`: FK -> `products(id)`
- `quantity`: INT
- `unit_price`: DECIMAL(10,2) (Guardar o preço no ato da venda para impedir alterações retroativas)
- `subtotal`: DECIMAL(10,2)

## 7. `installments` (Parcelas ou Adiantamentos)
Para o controle financeiro, toda venda pode ter N parcelas e M adiantamentos.
- `id`: UUID PK
- `company_id`: FK -> `companies(id)`
- `sale_id`: FK -> `sales(id)` ON DELETE CASCADE
- `client_id`: FK -> `clients(id)` (Redundância útil para filtros de perfil de cliente sem JOIN de sales)
- `type`: ENUM ('parcela', 'adiantamento')
- `installment_num`: INT ou VARCHAR (Ex: 1, 2, "Adiantamento 01")
- `due_date`: DATE (Data de vencimento ou de pagamento se pago antecipado)
- `amount`: DECIMAL(10,2)
- `status`: ENUM ('pendente', 'pago', 'atrasado')
- `payment_date`: DATE (Preenchido ao registrar o pagamento)
- `created_at`: TIMESTAMP

## 8. `settings` (Configurações da Empresa)
- `id`: UUID PK
- `company_id`: FK -> `companies(id)` UNIQUE
- `primary_color`: VARCHAR (Ex: '#6c5ce7')
- `bg_image_url`: VARCHAR
- `panel_opacity`: DECIMAL(3,2)
- `updated_at`: TIMESTAMP

---

### Índices Recomendados (Performance)
- Relatórios exigem filtragem rápida de Vendas: `INDEX nas tabelas sales(company_id, date)`
- Listagem e alertas de devedores / painel inicial: `INDEX em installments(company_id, due_date, status)`
- Busca de clientes rápida: `INDEX em clients(company_id, name)`

### Relacionamentos e Integridade
O vínculo de `company_id` deve permear quase todas as entidades. Isso garante o correto isolamento no caso de múltiplas lojas (multitenancy). Quando uma nota é cancelada (`sales(status) = 'cancelado'`), as parcelas/pagamentos correspondentes podem ser removidas (`installments`) ou marcadas também como canceladas para fins de auditoria.
