UPDATE public.system_settings
SET payment_rules = jsonb_set(
  jsonb_set(
    COALESCE(payment_rules, '{}'::jsonb),
    '{pix,discountPercent}',
    to_jsonb(8.9::numeric),
    true
  ),
  '{pix,note}',
  to_jsonb('Pix à vista com desconto.'::text),
  true
)
WHERE id = 1;

ALTER TABLE public.system_settings
  ALTER COLUMN payment_rules SET DEFAULT '{
    "card":{"enabled":true,"visaMaster":[0,0,0,0,0,0,9.48,9.97,11.02,11.98,12.90,13.44],"otherBrands":[0,0,0,0,0,0,9.48,9.97,11.02,11.98,12.90,13.44]},
    "pix":{"enabled":true,"discountPercent":8.9,"note":"Pix à vista com desconto."},
    "boleto":{"enabled":true,"maxInstallments":1,"fees":[0,0,0,0,0,0,0,0,0,0,0,0],"note":"Condições e vencimentos sujeitos à confirmação da agência."}
  }'::jsonb;
