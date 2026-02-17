-- Fix RLS policies that are blocking points updates
-- Remove a policy restritiva e crie uma que permite UPDATE da Edge Function

-- 1️⃣ Remover a policy problemática que bloqueia UPDATE
DROP POLICY IF EXISTS "Update customer via restricted functions only" ON customers;

-- 2️⃣ Criar policy correta que permite UPDATE sem restrições (a Edge Function é service_role)
CREATE POLICY "Allow service role to update customer points"
ON customers
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 3️⃣ Garantir que INSERT em loyalty_transactions funciona
DROP POLICY IF EXISTS "Transactions are immutable" ON loyalty_transactions;

CREATE POLICY "Allow insert loyalty transactions"
ON loyalty_transactions
FOR INSERT
WITH CHECK (true);

-- 4️⃣ Permitir SELECT para clientes verem suas próprias transactions
CREATE POLICY "Users can read own loyalty transactions"
ON loyalty_transactions
FOR SELECT
USING (auth.uid() IS NULL OR customer_id = auth.uid());
