-- Restaura a tabela real da máquina e permite que cada proposta escolha
-- quantas parcelas serão apresentadas ao cliente como "sem juros".
UPDATE public.system_settings
SET payment_rules =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(payment_rules, '{}'::jsonb),
        '{card,visaMaster}',
        '[3.89,5.67,6.51,7.02,7.90,8.69,9.48,9.97,11.02,11.98,12.90,13.44]'::jsonb,
        true
      ),
      '{card,otherBrands}',
      '[3.89,5.67,6.51,7.02,7.90,8.69,9.48,9.97,11.02,11.98,12.90,13.44]'::jsonb,
      true
    ),
    '{card,embeddedFeePercent}',
    to_jsonb(8.69::numeric),
    true
  )
WHERE id = 1;

ALTER TABLE public.system_settings
  ALTER COLUMN payment_rules SET DEFAULT '{
    "card":{"enabled":true,"embeddedFeePercent":8.69,"visaMaster":[3.89,5.67,6.51,7.02,7.90,8.69,9.48,9.97,11.02,11.98,12.90,13.44],"otherBrands":[3.89,5.67,6.51,7.02,7.90,8.69,9.48,9.97,11.02,11.98,12.90,13.44]},
    "pix":{"enabled":true,"discountPercent":8.9,"note":"Pix à vista com desconto."},
    "boleto":{"enabled":true,"maxInstallments":1,"fees":[0,0,0,0,0,0,0,0,0,0,0,0],"note":"Condições e vencimentos sujeitos à confirmação da agência."}
  }'::jsonb;

DO $migration$
DECLARE definition text; updated text;
BEGIN
  definition := pg_get_functiondef('public.public_proposal(text)'::regprocedure);
  updated := replace(
    definition,
    '''roomOccupancies'',''paymentRules'')',
    '''roomOccupancies'',''paymentRules'',''interestFreeInstallments'')'
  );
  IF updated = definition THEN
    RAISE EXCEPTION 'Public proposal payment projection did not match; no changes applied';
  END IF;
  EXECUTE updated;
END;
$migration$;

COMMENT ON FUNCTION public.public_proposal(text) IS
  'Customer proposal with seller commission, embedded machine fee chosen per proposal, public payment rules and selected interest-free installment count.';
