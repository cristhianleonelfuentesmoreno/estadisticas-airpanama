ALTER TABLE llegadas_malek_historico ADD CONSTRAINT unique_vuelo_fecha_llegada UNIQUE (fecha, numero_vuelo);
ALTER TABLE salidas_malek_historico ADD CONSTRAINT unique_vuelo_fecha_salida UNIQUE (fecha, numero_vuelo);
