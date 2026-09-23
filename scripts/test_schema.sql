SELECT column_name
FROM information_schema.columns
WHERE table_name IN ('llegadas_malek_historico', 'salidas_malek_historico', 'manual_flights_log');
