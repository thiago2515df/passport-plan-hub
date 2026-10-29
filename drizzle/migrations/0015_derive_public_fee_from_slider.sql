DO $migration$
DECLARE
  definition text;
  updated text;
  old_fragment text := $$payment_rate := COALESCE(NULLIF(s #>> '{paymentRules,card,embeddedFeePercent}','')::numeric, 8.69);
  IF payment_rate < 0 OR payment_rate >= 50 THEN payment_rate := 8.69; END IF;$$;
  new_fragment text := $$payment_rate := COALESCE(
    NULLIF(
      (s #> '{paymentRules,card,visaMaster}') ->>
      GREATEST(0, LEAST(11, COALESCE((s->>'interestFreeInstallments')::integer, 6) - 1)),
      ''
    )::numeric,
    NULLIF(s #>> '{paymentRules,card,embeddedFeePercent}','')::numeric,
    8.69
  );
  IF payment_rate < 0 OR payment_rate >= 50 THEN payment_rate := 8.69; END IF;$$;
BEGIN
  definition := pg_get_functiondef('public.public_proposal(text)'::regprocedure);
  updated := replace(definition, old_fragment, new_fragment);
  IF updated = definition THEN
    RAISE EXCEPTION 'public_proposal payment rate fragment did not match; no changes applied';
  END IF;
  EXECUTE updated;
END;
$migration$;

COMMENT ON FUNCTION public.public_proposal(text) IS
  'Customer proposal price derives the embedded payment fee directly from Visa/Master table + selected interest-free installment count, keeping Pix and gross total aligned.';
