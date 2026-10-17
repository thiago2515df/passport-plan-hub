DO $migration$
DECLARE definition text; updated text;
BEGIN
  definition := pg_get_functiondef('public.public_proposal(text)'::regprocedure);
  updated := replace(definition,
    'WHERE k IN (''name'',''address'',''stars'',''room'',''image'',''hotelId'')',
    'WHERE k IN (''name'',''address'',''stars'',''room'',''image'',''hotelId'',''provider'',''providerListingId'',''sourceUrl'',''rating'',''reviewCount'',''images'',''publicDetails'',''totalEstimated'')');
  IF updated = definition THEN RAISE EXCEPTION 'Public hotel projection did not match; no changes applied'; END IF;
  EXECUTE updated;
END;
$migration$;
COMMENT ON FUNCTION public.public_proposal(text) IS 'Exact-code customer projection: final package totals only, with public lodging identity, photos and saved Airbnb details. Internal costs and seller commissions remain private.';