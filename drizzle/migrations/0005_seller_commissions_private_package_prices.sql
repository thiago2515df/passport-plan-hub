CREATE TABLE public.seller_commissions (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, air_kind text NOT NULL DEFAULT 'fixed' CHECK (air_kind IN ('fixed','percent')), air_value numeric NOT NULL DEFAULT 0 CHECK (air_value >= 0), bus_kind text NOT NULL DEFAULT 'fixed' CHECK (bus_kind IN ('fixed','percent')), bus_value numeric NOT NULL DEFAULT 0 CHECK (bus_value >= 0));
GRANT SELECT, INSERT, UPDATE ON public.seller_commissions TO authenticated;
GRANT ALL ON public.seller_commissions TO service_role;
ALTER TABLE public.seller_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY commissions_read ON public.seller_commissions FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY commissions_insert ON public.seller_commissions FOR INSERT TO authenticated WITH CHECK ((user_id=auth.uid() AND public.seller_can('create_proposals')) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY commissions_update ON public.seller_commissions FOR UPDATE TO authenticated USING ((user_id=auth.uid() AND public.seller_can('create_proposals')) OR public.has_role(auth.uid(),'admin')) WITH CHECK ((user_id=auth.uid() AND public.seller_can('create_proposals')) OR public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.public_proposal(_code text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $function$
DECLARE p jsonb; s jsonb; safe_s jsonb; t jsonb; safe_t jsonb; h jsonb; hs jsonb := '[]'::jsonb; extras jsonb; owner uuid; cfg public.seller_commissions%ROWTYPE; transport_cost numeric := 0; extra_cost numeric := 0; base numeric; fee numeric; kind text := 'fixed'; rate numeric := 0; adult_count integer; child_count integer; key text;
BEGIN
IF _code !~ '^[a-z0-9]{6,12}$' THEN RETURN NULL; END IF;
SELECT convert_from(decode(payload,'base64'),'UTF8')::jsonb,owner_id INTO p,owner FROM public.proposals WHERE code=_code;
IF p IS NULL THEN RETURN NULL; END IF;
s := p->'s'; t := s->'transport';
SELECT * INTO cfg FROM public.seller_commissions WHERE user_id=owner;
IF t->>'mode' IN ('air','bus') THEN transport_cost := COALESCE((t->>'price')::numeric,0); END IF;
IF t->>'mode'='bus' AND s->>'destino' ~* 'caldas\s+novas?' THEN
SELECT count(*) INTO child_count FROM jsonb_array_elements(COALESCE(s->'childAges','[]'::jsonb));
adult_count := COALESCE((s->>'adults')::integer, GREATEST(0,COALESCE(substring(s->>'hospedes' FROM '(\d+)\s*hóspede')::integer,2)-child_count));
SELECT 110*(adult_count+count(*)) INTO transport_cost FROM jsonb_array_elements(COALESCE(s->'childAges','[]'::jsonb)) age WHERE (age::text)::numeric>5;
END IF;
IF t->>'mode'='air' THEN kind:=COALESCE(cfg.air_kind,'fixed'); rate:=COALESCE(cfg.air_value,0); ELSIF t->>'mode'='bus' THEN kind:=COALESCE(cfg.bus_kind,'fixed'); rate:=COALESCE(cfg.bus_value,0); END IF;
SELECT COALESCE(sum((item->>'cost')::numeric),0), COALESCE(jsonb_agg(jsonb_build_object('name',item->>'name','cost',0)),'[]'::jsonb) INTO extra_cost,extras FROM jsonb_array_elements(COALESCE(s->'extras','[]'::jsonb)) item;
SELECT COALESCE(jsonb_object_agg(k,v),'{}'::jsonb) INTO safe_s FROM jsonb_each(s) e(k,v) WHERE k IN ('destino','checkin','checkout','hospedes','cliente','origem','rooms','adults','childAges');
safe_s := safe_s || jsonb_build_object('rav',0,'extras',extras);
IF t IS NOT NULL AND t <> 'null'::jsonb THEN
SELECT COALESCE(jsonb_object_agg(k,v),'{}'::jsonb) INTO safe_t FROM jsonb_each(t) e(k,v) WHERE k IN ('mode','travelClass','bags');
FOREACH key IN ARRAY ARRAY['outbound','inbound'] LOOP
safe_t := safe_t || jsonb_build_object(key,(SELECT COALESCE(jsonb_object_agg(k,v),'{}'::jsonb) FROM jsonb_each(COALESCE(t->key,'{}'::jsonb)) e(k,v) WHERE k IN ('company','departure','arrival','ticket','from','to','duration','stops','airline','flightNumber','departureDate','arrivalDate','fareCategory','connections','connectionDetails','baggage')));
END LOOP;
safe_s := safe_s || jsonb_build_object('transport',safe_t);
END IF;
FOR h IN SELECT value FROM jsonb_array_elements(p->'hotels') LOOP
base := round(COALESCE((h->>'total')::numeric,0)+transport_cost+extra_cost,2);
fee := round(CASE WHEN kind='percent' THEN base*rate/100 ELSE rate END,2);
SELECT COALESCE(jsonb_object_agg(k,v),'{}'::jsonb) INTO h FROM jsonb_each(h) e(k,v) WHERE k IN ('name','address','stars','room','image','hotelId');
hs := hs || jsonb_build_array(h || jsonb_build_object('total',base+fee,'nightly',0));
END LOOP;
RETURN replace(encode(convert_to(jsonb_build_object('s',safe_s,'hotels',hs)::text,'UTF8'),'base64'),E'\n','');
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.public_proposal(text) TO anon, authenticated;