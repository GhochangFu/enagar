ALTER TABLE citizens
  ADD COLUMN keycloak_subject VARCHAR(255);

CREATE UNIQUE INDEX citizens_tenant_keycloak_subject_unique
  ON citizens (tenant_id, keycloak_subject);
