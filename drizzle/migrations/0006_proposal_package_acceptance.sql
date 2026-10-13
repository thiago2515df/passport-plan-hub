CREATE TABLE public.proposal_acceptances (
 code text PRIMARY KEY REFERENCES public.proposals(code),
 hotel_index integer NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 payload text NOT NULL,
 hotel_cost numeric NOT NULL,
 transport_cost numeric NOT NULL,
 extras_cost numeric NOT NULL,
 commission numeric NOT NULL,
 total numeric NOT NULL,
 commission_kind text NOT NULL,
 commission_value numeric NOT NULL
);
GRANT SELECT ON public.proposal_acceptances TO authenticated;
GRANT ALL ON public.proposal_acceptances TO service_role;
ALTER TABLE public.proposal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY acceptance_owner_read ON public.proposal_acceptances FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.code=proposal_acceptances.code AND (p.owner_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE OR REPLACE FUNCTION public.accept_proposal_package(_code text, _index integer, _expected_total numeric) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row public.proposals%ROWTYPE; p jsonb; s jsonb; h jsonb; safe jsonb; cfg public.seller_commissions%ROWTYPE; tc numeric:=0; ec numeric:=0; hc numeric; final numeric; base numeric; kind text:='fixed'; rate numeric:=0; adult_count integer; children integer; prior public.proposal_acceptances%ROWTYPE;
BEGIN
IF _code !~ '^[a-z0-9]{6,12}$' OR _index<0 THEN RAISE EXCEPTION 'Proposta inválida.'; END IF;
SELECT * INTO row FROM public.proposals WHERE code=_code FOR UPDATE;
IF NOT FOUND OR row.status='cancelled' THEN RAISE EXCEPTION 'Proposta indisponível.'; END IF;
SELECT * INTO prior FROM public.proposal_acceptances WHERE code=_code;
IF FOUND THEN IF prior.hotel_index=_index THEN RETURN true; ELSE RAISE EXCEPTION 'Esta proposta já possui um pacote confirmado.'; END IF; END IF;
p:=convert_from(decode(row.payload,'base64'),'UTF8')::jsonb; s:=p->'s';
IF _index>=jsonb_array_length(p->'hotels') THEN RAISE EXCEPTION 'Pacote inválido.'; END IF;
h:=p->'hotels'->_index; hc:=COALESCE((h->>'total')::numeric,0);
safe:=convert_from(decode(public.public_proposal(_code),'base64'),'UTF8')::jsonb; final:=(safe->'hotels'->_index->>'total')::numeric;
IF final IS NULL OR final<>_expected_total THEN RAISE EXCEPTION 'O preço foi atualizado. Recarregue a proposta antes de confirmar.'; END IF;
IF s->'transport'->>'mode' IN ('air','bus') THEN tc:=COALESCE((s->'transport'->>'price')::numeric,0); END IF;
IF s->'transport'->>'mode'='bus' AND s->>'destino' ~* 'caldas\s+novas?' THEN
SELECT count(*) INTO children FROM jsonb_array_elements(COALESCE(s->'childAges','[]'::jsonb));
adult_count:=COALESCE((s->>'adults')::integer,GREATEST(0,COALESCE(substring(s->>'hospedes' FROM '(\d+)\s*hóspede')::integer,2)-children));
SELECT 110*(adult_count+count(*)) INTO tc FROM jsonb_array_elements(COALESCE(s->'childAges','[]'::jsonb)) age WHERE (age::text)::numeric>5;
END IF;
SELECT COALESCE(sum((item->>'cost')::numeric),0) INTO ec FROM jsonb_array_elements(COALESCE(s->'extras','[]'::jsonb)) item;
SELECT * INTO cfg FROM public.seller_commissions WHERE user_id=row.owner_id;
IF s->'transport'->>'mode'='air' THEN kind:=COALESCE(cfg.air_kind,'fixed'); rate:=COALESCE(cfg.air_value,0); ELSIF s->'transport'->>'mode'='bus' THEN kind:=COALESCE(cfg.bus_kind,'fixed'); rate:=COALESCE(cfg.bus_value,0); END IF;
base:=round(hc+tc+ec,2);
INSERT INTO public.proposal_acceptances(code,hotel_index,payload,hotel_cost,transport_cost,extras_cost,commission,total,commission_kind,commission_value) VALUES(_code,_index,row.payload,hc,tc,ec,final-base,final,kind,rate);
UPDATE public.proposals SET status='approved' WHERE code=_code;
RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.accept_proposal_package(text,integer,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_proposal_package(text,integer,numeric) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.my_proposal_acceptances() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM public.proposal_acceptances a; $$;
REVOKE ALL ON FUNCTION public.my_proposal_acceptances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_proposal_acceptances() TO authenticated;
CREATE OR REPLACE FUNCTION public.proposal_acceptance_status(_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('hotelIndex',a.hotel_index,'acceptedAt',a.accepted_at,'total',a.total) FROM public.proposal_acceptances a WHERE a.code=_code AND _code ~ '^[a-z0-9]{6,12}$'; $$;
REVOKE ALL ON FUNCTION public.proposal_acceptance_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proposal_acceptance_status(text) TO anon,authenticated;