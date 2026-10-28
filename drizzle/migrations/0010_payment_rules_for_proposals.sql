ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS payment_rules jsonb NOT NULL DEFAULT '{
    "card":{"enabled":true,"visaMaster":[0,0,0,0,0,0,9.48,9.97,11.02,11.98,12.90,13.44],"otherBrands":[0,0,0,0,0,0,9.48,9.97,11.02,11.98,12.90,13.44]},
    "pix":{"enabled":true,"discountPercent":0,"note":"Pagamento à vista via Pix."},
    "boleto":{"enabled":true,"maxInstallments":1,"fees":[0,0,0,0,0,0,0,0,0,0,0,0],"note":"Condições e vencimentos sujeitos à confirmação da agência."}
  }'::jsonb;

COMMENT ON COLUMN public.system_settings.payment_rules IS
  'Regras comerciais públicas copiadas para cada proposta: cartão, Pix e boleto.';
