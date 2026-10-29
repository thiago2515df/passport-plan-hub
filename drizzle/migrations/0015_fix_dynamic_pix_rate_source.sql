CREATE OR REPLACE FUNCTION public.public_proposal(_code text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p jsonb; s jsonb; safe_s jsonb; t jsonb; safe_t jsonb; h jsonb; safe_h jsonb;
  hs jsonb := '[]'::jsonb; extras jsonb; owner uuid;
  cfg public.seller_commissions%ROWTYPE; accepted public.proposal_acceptances%ROWTYPE;
  transport_cost numeric := 0; extra_cost numeric := 0; base numeric; fee numeric;
  package_before_payment numeric; customer_total numeric; payment_rate numeric := 8.69;
  embedded_rate numeric := 8.69; interest_free integer;
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

  embedded_rate := COALESCE(NULLIF(s #>> '{paymentRules,card,embeddedFeePercent}','')::numeric, 8.69);
  BEGIN
    interest_free := NULLIF(s->>'interestFreeInstallments','')::integer;
  EXCEPTION WHEN OTHERS THEN
    interest_free := NULL;
  END;

  -- Source of truth: selected slider position -> Visa/Master table.
  -- Fallback to embeddedFeePercent keeps older proposals compatible.
  IF interest_free BETWEEN 1 AND 12 THEN
    payment_rate := COALESCE(
      NULLIF(s #>> ARRAY['paymentRules','card','visaMaster',(interest_free - 1)::text], '')::numeric,
      embedded_rate
    );
  ELSE
    payment_rate := embedded_rate;
  END IF;
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
    WHERE k IN ('destino','checkin','checkout','hospedes','cliente','origem','rooms','adults','childAges','roomOccupancies','paymentRules','interestFreeInstallments');
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
  'Public proposal uses the selected 1x-12x slider position as source of truth for the Visa/Master machine rate, keeping card total and Pix discount aligned.';
