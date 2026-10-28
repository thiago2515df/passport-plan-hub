UPDATE public.system_settings
SET payment_rules =
  jsonb_set(
    jsonb_set(
      COALESCE(payment_rules, '{}'::jsonb),
      '{card,visaMaster}',
      '[3.89,5.67,6.51,7.02,7.90,8.69,9.48,9.97,11.02,11.98,12.90,13.44]'::jsonb,
      true
    ),
    '{card,otherBrands}',
    '[4.50,5.87,6.57,7.28,7.98,8.68,9.58,10.28,11.02,11.98,12.90,13.50]'::jsonb,
    true
  )
WHERE id = 1;

ALTER TABLE public.system_settings
  ALTER COLUMN payment_rules SET DEFAULT '{
    "card":{"enabled":true,"embeddedFeePercent":8.69,"visaMaster":[3.89,5.67,6.51,7.02,7.90,8.69,9.48,9.97,11.02,11.98,12.90,13.44],"otherBrands":[4.50,5.87,6.57,7.28,7.98,8.68,9.58,10.28,11.02,11.98,12.90,13.50]},
    "pix":{"enabled":true,"discountPercent":8.9,"note":"Pix à vista com desconto."},
    "boleto":{"enabled":true,"maxInstallments":1,"fees":[0,0,0,0,0,0,0,0,0,0,0,0],"note":"Condições e vencimentos sujeitos à confirmação da agência."}
  }'::jsonb;
