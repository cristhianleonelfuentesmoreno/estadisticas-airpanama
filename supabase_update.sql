-- Add 'PENDIENTE' to the allowed values for estado_final in llegadas_malek_historico
ALTER TABLE llegadas_malek_historico DROP CONSTRAINT IF EXISTS llegadas_malek_historico_estado_final_check;
ALTER TABLE llegadas_malek_historico ADD CONSTRAINT llegadas_malek_historico_estado_final_check CHECK (estado_final IN ('LLEGÓ', 'CUMPLIDO', 'DEMORADO', 'DESVIADO', 'PENDIENTE'));

-- Add 'PENDIENTE' to the allowed values for estado_final in salidas_malek_historico
ALTER TABLE salidas_malek_historico DROP CONSTRAINT IF EXISTS salidas_malek_historico_estado_final_check;
ALTER TABLE salidas_malek_historico ADD CONSTRAINT salidas_malek_historico_estado_final_check CHECK (estado_final IN ('LLEGÓ', 'CUMPLIDO', 'DEMORADO', 'DESVIADO', 'PENDIENTE'));
