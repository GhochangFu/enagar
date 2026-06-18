UPDATE ev_sessions SET status = 'CANCELLED' WHERE tenant_id = (SELECT id FROM tenants WHERE code = 'KMC') AND status IN ('HELD', 'CHARGING');
