-- A taxa da máquina de 6x é incorporada ao preço público do pacote.
-- Ela não é comissão do vendedor e não deve ser somada novamente no modal.
UPDATE public.system_settings
SET payment_rules = jsonb_set(
  COALESCE(payment_rules, '{}'::jsonb),
  '{card,embeddedFeePercent}',
  to_jsonb(8.69::numeric),
  true
)
WHERE id = 1
  AND NOT (COALESCE(payment_rules, '{}'::jsonb) #> '{card}') ? 'embeddedFeePercent';

ALTER TABLE public.system_settings
  ALTER COLUMN payment_rules SET DEFAULT '{
    "card":{"enabled":true,"embeddedFeePercent":8.69,"visaMaster":[0,0,0,0,0,0,9.48,9.97,11.02,11.98,12.90,13.44],"otherBrands":[0,0,0,0,0,0,9.48,9.97,11.02,11.98,12.90,13.44]},
    "pix":{"enabled":true,"discountPercent":8.9,"note":"Pix à vista com desconto."},
    "boleto":{"enabled":true,"maxInstallments":1,"fees":[0,0,0,0,0,0,0,0,0,0,0,0],"note":"Condições e vencimentos sujeitos à confirmação da agência."}
  }'::jsonb;

ALTER TABLE public.proposal_acceptances
  ADD COLUMN IF NOT EXISTS payment_fee numeric NOT NULL DEFAULT 0 CHECK (payment_fee >= 0);

COMMENT ON COLUMN public.proposal_acceptances.payment_fee IS
  'Taxa de pagamento embutida no preço aceito; separada da comissão do vendedor.';

CREATE OR REPLACE FUNCTION public.public_proposal(_code text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p jsonb; s jsonb; safe_s jsonb; t jsonb; safe_t jsonb; h jsonb; safe_h jsonb;
  hs jsonb := '[]'::jsonb; extras jsonb; owner uuid;
  cfg public.seller_commissions%ROWTYPE; accepted public.proposal_acceptances%ROWTYPE;
  transport_cost numeric := 0; extra_cost numeric := 0; base numeric; fee numeric;
  package_before_payment numeric; customer_total numeric; payment_rate numeric := 8.69;
  kind text; rate numeric; adult_count integer; child_count integer; key text; idx integer := 0;
BEGIN
  IF _code !~ '^[a-z0-9]{6,12}$' THEN RETURN NULL; END IF;
  SELECT convert_from(decode(payload,'base64'),'UTF8')::jsonb, owner_id INTO p,owner
    FROM public.proposals WHERE code=_code AND status <> 'cancelled';
  IF p IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO accepted FROM public.proposal_acceptances WHERE code=_code;
  IF accepted.code IS NOT NULL THEN
    p := convert_from(decode(accepted.payload,'base64'),'UTF8')::jsonb;
    kind := accepted.commission_kind; rate := accepted.commission_value;
  ELSE
    SELECT * INTO cfg FROM public.seller_commissions WHERE user_id=owner;
    IF cfg.configured_at IS NULL THEN RETURN NULL; END IF;
    CASE p->'s'->'transport'->>'mode'
      WHEN 'air' THEN kind := cfg.air_kind; rate := cfg.air_value;
      WHEN 'bus' THEN kind := cfg.bus_kind; rate := cfg.bus_value;
      ELSE kind := cfg.hotel_kind; rate := cfg.hotel_value;
    END CASE;
  END IF;

  s := p->'s'; t := s->'transport';
  payment_rate := COALESCE(NULLIF(s #>> '{paymentRules,card,embeddedFeePercent}','')::numeric, 8.69);
  IF payment_rate < 0 OR payment_rate >= 50 THEN payment_rate := 8.69; END IF;

  IF t->>'mode' IN ('air','bus') THEN transport_cost := COALESCE((t->>'price')::numeric,0); END IF;
  IF t->>'mode'='bus' AND s->>'destino' ~* 'caldas\s+novas?' THEN
    SELECT count(*) INTO child_count FROM jsonb_array_elements(COALESCE(s->'childAges','[]'::jsonb));
    adult_count := COALESCE((s->>'adults')::integer,GREATEST(0,COALESCE(substring(s->>'hospedes' FROM '(\d+)\s*hóspede')::integer,substring(s->>'hospedes' FROM '^\d+$')::integer,2)-child_count));
    SELECT 110*(adult_count+count(*)) INTO transport_cost FROM jsonb_array_elements(COALESCE(s->'childAges','[]'::jsonb)) age WHERE (age::text)::numeric>5;
  END IF;

  SELECT COALESCE(sum((item->>'cost')::numeric),0),COALESCE(jsonb_agg(jsonb_build_object('name',item->>'name','cost',0)),'[]'::jsonb)
    INTO extra_cost,extras FROM jsonb_array_elements(COALESCE(s->'extras','[]'::jsonb)) item;

  SELECT COALESCE(jsonb_object_agg(k,v),'{}'::jsonb) INTO safe_s FROM jsonb_each(s) e(k,v)
    WHERE k IN ('destino','checkin','checkout','hospedes','cliente','origem','rooms','adults','childAges','roomOccupancies','paymentRules');
  safe_s := safe_s || jsonb_build_object('rav',0,'extras',extras);

  IF t IS NOT NULL AND t <> 'null'::jsonb THEN
    SELECT COALESCE(jsonb_object_agg(k,v),'{}'::jsonb) INTO safe_t FROM jsonb_each(t) e(k,v) WHERE k IN ('mode','travelClass','bags');
    FOREACH key IN ARRAY ARRAY['outbound','inbound'] LOOP
      safe_t := safe_t || jsonb_build_object(key,(SELECT COALESCE(jsonb_object_agg(k,v),'{}'::jsonb) FROM jsonb_each(COALESCE(t->key,'{}'::jsonb)) e(k,v)
        WHERE k IN ('company','departure','arrival','ticket','from','to','duration','stops','airline','flightNumber','departureDate','arrivalDate','fareCategory','connections','connectionDetails','baggage')));
    END LOOP;
    safe_s := safe_s || jsonb_build_object('transport',safe_t);
  END IF;

  FOR h IN SELECT value FROM jsonb_array_elements(p->'hotels') LOOP
    base := round(COALESCE((h->>'total')::numeric,0)+transport_cost+extra_cost,2);
    fee := round(CASE WHEN kind='percent' THEN base*rate/100 ELSE rate END,2);
    package_before_payment := round(base+fee,2);
    customer_total := CASE
      WHEN payment_rate > 0 THEN round(package_before_payment/(1-payment_rate/100),2)
      ELSE package_before_payment
    END;

    SELECT COALESCE(jsonb_object_agg(k,v),'{}'::jsonb) INTO safe_h FROM jsonb_each(h) e(k,v)
      WHERE k IN ('name','address','stars','room','image','hotelId','provider','providerListingId','sourceUrl','rating','reviewCount','images','publicDetails','totalEstimated');
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name',item->>'name','cost',0)),'[]'::jsonb) INTO extras
      FROM jsonb_array_elements(COALESCE(h->'extras','[]'::jsonb)) item;

    hs := hs || jsonb_build_array(
      safe_h || jsonb_build_object(
        'total',CASE WHEN accepted.code IS NOT NULL AND idx=accepted.hotel_index THEN accepted.total ELSE customer_total END,
        'nightly',0,
        'extras',extras
      )
    );
    idx := idx+1;
  END LOOP;

  RETURN replace(encode(convert_to(jsonb_build_object('s',safe_s,'hotels',hs)::text,'UTF8'),'base64'),E'\n','');
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;

REVOKE ALL ON FUNCTION public.public_proposal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_proposal(text) TO anon,authenticated;
COMMENT ON FUNCTION public.public_proposal(text) IS
  'Customer proposal with administrator-confirmed seller commission plus the saved 6x payment fee embedded in the public package total.';

CREATE OR REPLACE FUNCTION public.accept_proposal_package(_code text,_index integer,_expected_total numeric) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  row public.proposals%ROWTYPE; p jsonb; s jsonb; h jsonb; safe jsonb;
  cfg public.seller_commissions%ROWTYPE; prior public.proposal_acceptances%ROWTYPE;
  tc numeric := 0; ec numeric := 0; hc numeric; final numeric; base numeric; seller_fee numeric;
  payment_fee numeric; kind text; rate numeric; adult_count integer; children integer;
BEGIN
  IF _code !~ '^[a-z0-9]{6,12}$' OR _index IS NULL OR _index<0 OR _expected_total IS NULL THEN
    RAISE EXCEPTION 'Proposta inválida.';
  END IF;

  SELECT * INTO row FROM public.proposals WHERE code=_code FOR UPDATE;
  IF NOT FOUND OR row.status='cancelled' THEN RAISE EXCEPTION 'Proposta indisponível.'; END IF;

  SELECT * INTO prior FROM public.proposal_acceptances WHERE code=_code;
  IF FOUND THEN
    IF prior.hotel_index=_index THEN RETURN true;
    ELSE RAISE EXCEPTION 'Esta proposta já possui um pacote confirmado.';
    END IF;
  END IF;

  SELECT * INTO cfg FROM public.seller_commissions WHERE user_id=row.owner_id FOR SHARE;
  IF cfg.configured_at IS NULL THEN RAISE EXCEPTION 'As comissões desta proposta ainda precisam ser confirmadas pelo administrador.'; END IF;

  p := convert_from(decode(row.payload,'base64'),'UTF8')::jsonb; s := p->'s';
  IF _index>=jsonb_array_length(p->'hotels') THEN RAISE EXCEPTION 'Pacote inválido.'; END IF;
  h := p->'hotels'->_index; hc := COALESCE((h->>'total')::numeric,0);

  safe := convert_from(decode(public.public_proposal(_code),'base64'),'UTF8')::jsonb;
  final := (safe->'hotels'->_index->>'total')::numeric;
  IF final IS NULL OR final<>_expected_total THEN RAISE EXCEPTION 'O preço foi atualizado. Recarregue a proposta antes de confirmar.'; END IF;

  IF s->'transport'->>'mode' IN ('air','bus') THEN tc := COALESCE((s->'transport'->>'price')::numeric,0); END IF;
  IF s->'transport'->>'mode'='bus' AND s->>'destino' ~* 'caldas\s+novas?' THEN
    SELECT count(*) INTO children FROM jsonb_array_elements(COALESCE(s->'childAges','[]'::jsonb));
    adult_count := COALESCE((s->>'adults')::integer,GREATEST(0,COALESCE(substring(s->>'hospedes' FROM '(\d+)\s*hóspede')::integer,substring(s->>'hospedes' FROM '^\d+$')::integer,2)-children));
    SELECT 110*(adult_count+count(*)) INTO tc FROM jsonb_array_elements(COALESCE(s->'childAges','[]'::jsonb)) age WHERE (age::text)::numeric>5;
  END IF;

  SELECT COALESCE(sum((item->>'cost')::numeric),0) INTO ec FROM jsonb_array_elements(COALESCE(s->'extras','[]'::jsonb)) item;
  CASE s->'transport'->>'mode'
    WHEN 'air' THEN kind := cfg.air_kind; rate := cfg.air_value;
    WHEN 'bus' THEN kind := cfg.bus_kind; rate := cfg.bus_value;
    ELSE kind := cfg.hotel_kind; rate := cfg.hotel_value;
  END CASE;

  base := round(hc+tc+ec,2);
  seller_fee := round(CASE WHEN kind='percent' THEN base*rate/100 ELSE rate END,2);
  payment_fee := GREATEST(0, round(final-(base+seller_fee),2));

  INSERT INTO public.proposal_acceptances(
    code,hotel_index,payload,hotel_cost,transport_cost,extras_cost,commission,payment_fee,total,commission_kind,commission_value
  ) VALUES(
    _code,_index,row.payload,hc,tc,ec,seller_fee,payment_fee,final,kind,rate
  );

  UPDATE public.proposals SET status='approved' WHERE code=_code;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.accept_proposal_package(text,integer,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_proposal_package(text,integer,numeric) TO anon,authenticated;
