-- Arquivamento manual: a proposta ganha a etapa 'archived' e o cliente passa a ver "Proposta arquivada".
ALTER TABLE public.proposals DROP CONSTRAINT proposals_status_valid;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_status_valid CHECK (status IN ('created','awaiting','approved','cancelled','archived'));
COMMENT ON COLUMN public.proposals.status IS 'created: draft link; awaiting: user confirmed sending; approved/cancelled: recorded outcome; archived: filed away by the seller or admin, the customer sees "Proposta arquivada".';

-- O link público deixa de exibir uma proposta arquivada.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.public_proposal(text)'::regprocedure);
  IF def LIKE '%status NOT IN (''cancelled'',''archived'')%' THEN RETURN; END IF;
  def := replace(def, 'status <> ''cancelled''', 'status NOT IN (''cancelled'',''archived'')');
  IF def NOT LIKE '%status NOT IN (''cancelled'',''archived'')%' THEN
    RAISE EXCEPTION 'public_proposal archived filter did not match; no changes applied';
  END IF;
  EXECUTE def;
END $$;

-- Um pacote arquivado não pode mais ser aceito pelo cliente.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.accept_proposal_package(text,integer,numeric)'::regprocedure);
  IF def LIKE '%row.status IN (''cancelled'',''archived'')%' THEN RETURN; END IF;
  def := replace(def, 'row.status=''cancelled''', 'row.status IN (''cancelled'',''archived'')');
  IF def NOT LIKE '%row.status IN (''cancelled'',''archived'')%' THEN
    RAISE EXCEPTION 'accept_proposal_package archived guard did not match; no changes applied';
  END IF;
  EXECUTE def;
END $$;