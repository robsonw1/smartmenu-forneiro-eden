# Configuração de PrintNode com Supabase Secrets

## 🔒 Segurança

A API Key do PrintNode é armazenada **apenas no servidor** como uma variável de ambiente do Supabase, nunca no banco de dados público.

## ⚙️ Como Configurar

### 1. Obtenha sua API Key do PrintNode

1. Acesse [PrintNode Account](https://app.printnode.com/account)
2. Vá para **API Keys**
3. Copie sua API Key (começa com `eyJ...`)

### 2. Configure no Supabase (Via CLI)

```bash
# Faça login no Supabase CLI
npx supabase login

# Defina a variável de ambiente
npx supabase secrets set PRINTNODE_API_KEY="sua_api_key_aqui"

# Verifique se foi salva
npx supabase secrets list
```

### 3. Ou Configure no Dashboard do Supabase

1. Abra [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **Project Settings** → **API**
4. Em **Query Editor**, acesse a aba **Secrets** (se disponível)
5. Adicione: `PRINTNODE_API_KEY` = sua API Key

### 4. Dono do Estabelecimento Configura

No Admin Dashboard → **Configurações** → **Configuração de Impressão**

1. Insira o **ID da Impressora** (número fornecido pelo PrintNode)
2. Selecione o **Modo de Impressão** (Automático ou Manual)
3. Clique em **Testar Impressão**

## ✅ Pronto!

- ✅ API Key: Segura no servidor (não exposta)
- ✅ ID da Impressora: Configurável pelo dono
- ✅ Impressão automática ou manual

## 🔧 Para Múltiplos Clientes

Cada cliente usa a **mesma API Key do PrintNode** (sua), com seus próprios **IDs de impressoras**.

Se em futuro você quiser que cada cliente tenha sua própria API Key:
- Usar a tabela `printnode_config` que já existe no banco de dados
- Ajustar a Edge Function para buscar a API Key por cliente
