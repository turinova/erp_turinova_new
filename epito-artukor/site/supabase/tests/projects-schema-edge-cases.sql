-- =============================================================================
-- Építő Ártükör — 011–015 séma edge-case tesztek (lokális psql, superuser)
-- Futtatás: psql -d artukor_test -f projects-schema-edge-cases.sql
-- Minden teszt NOTICE-ban ír PASS/FAIL-t; a szkript végig lefut.
-- =============================================================================

begin;

create temp table t_ids (key text primary key, id uuid not null) on commit drop;

do $$
declare
  v_org uuid; v_trade uuid; v_unit uuid;
  v_proj_a uuid; v_proj_b uuid;
  v_q_active uuid; v_q_archived uuid; v_q_rfq uuid; v_q_b uuid;
  v_line_active uuid; v_line_archived uuid; v_line_tig uuid; v_line_b uuid;
  v_rfq uuid; v_rfq_line uuid; v_inv uuid; v_sub uuid;
  v_pkg1 uuid; v_pkg2 uuid;
  v_cert1 uuid; v_cert2 uuid;
begin
  select id into v_org from public.organizations where slug = 'demo';
  select id into v_trade from public.trades where organization_id = v_org and code = 'gepeszet';
  insert into public.units (organization_id, code, name, sort_order)
  values (v_org, 'db-test', 'darab (teszt)', 99) returning id into v_unit;

  insert into public.projects (organization_id, code, name, client_name, status)
  values (v_org, 'TESZT-A', 'Teszt projekt A', 'Teszt Ügyfél', 'in_progress')
  returning id into v_proj_a;
  insert into public.projects (organization_id, code, name, client_name, status)
  values (v_org, 'TESZT-B', 'Teszt projekt B', 'Teszt Ügyfél', 'quoting')
  returning id into v_proj_b;

  -- aktív (elfogadott) quote TIG-es sorral
  insert into public.quotes (project_id, title, status, primary_trade_id)
  values (v_proj_a, 'Gépészet v2', 'accepted', v_trade) returning id into v_q_active;
  -- archivált quote
  insert into public.quotes (project_id, title, status, primary_trade_id)
  values (v_proj_a, 'Gépészet v1', 'archived', v_trade) returning id into v_q_archived;
  -- quote RFQ-val (RESTRICT teszt)
  insert into public.quotes (project_id, title, status, primary_trade_id)
  values (v_proj_a, 'Villamosság', 'draft', v_trade) returning id into v_q_rfq;
  -- B projekt quote-ja archivált (cascade teszt)
  insert into public.quotes (project_id, title, status, primary_trade_id)
  values (v_proj_b, 'B quote', 'archived', v_trade) returning id into v_q_b;

  insert into public.quote_lines (quote_id, sort_order, text_snapshot, trade_id, unit_id, quantity, cost_material_unit_price, cost_labor_unit_price, pricing_status, execution_status)
  values (v_q_active, 1, 'Aktív sor', v_trade, v_unit, 10, 1000, 500, 'costed', 'pending')
  returning id into v_line_active;
  insert into public.quote_lines (quote_id, sort_order, text_snapshot, trade_id, unit_id, quantity, cost_material_unit_price, cost_labor_unit_price, pricing_status)
  values (v_q_archived, 1, 'Archivált sor', v_trade, v_unit, 5, 2000, 800, 'costed')
  returning id into v_line_archived;
  insert into public.quote_lines (quote_id, sort_order, text_snapshot, trade_id, unit_id, quantity, cost_material_unit_price, cost_labor_unit_price, pricing_status, execution_status)
  values (v_q_active, 2, 'TIG-es sor', v_trade, v_unit, 3, 5000, 2500, 'costed', 'done')
  returning id into v_line_tig;
  insert into public.quote_lines (quote_id, sort_order, text_snapshot, trade_id, unit_id, quantity, cost_material_unit_price, cost_labor_unit_price, pricing_status, execution_status)
  values (v_q_b, 1, 'B sor', v_trade, v_unit, 1, 100, 50, 'costed', 'done')
  returning id into v_line_b;

  -- RFQ lánc
  insert into public.rfqs (project_id, quote_id, trade_id, title, expires_at)
  values (v_proj_a, v_q_rfq, v_trade, 'Villamos bekérés', now() + interval '7 days')
  returning id into v_rfq;
  insert into public.rfq_lines (rfq_id, quote_line_id, text, unit_id, quantity)
  values (v_rfq, v_line_active, 'Aktív sor', v_unit, 10) returning id into v_rfq_line;
  insert into public.rfq_invitations (rfq_id, subcontractor_name, access_token, access_code)
  values (v_rfq, 'Klima-Pro', 'tok-' || gen_random_uuid(), '123456') returning id into v_inv;
  insert into public.rfq_submissions (rfq_id, invitation_id, subcontractor_name, total_amount)
  values (v_rfq, v_inv, 'Klima-Pro', 150000) returning id into v_sub;
  insert into public.rfq_submission_bids (submission_id, rfq_line_id, material_unit_price, labor_unit_price)
  values (v_sub, v_rfq_line, 900, 450);

  -- a submission áraz egy sort az ARCHIVÁLT quote-on (SET NULL átjárás teszt)
  update public.quote_lines
  set cost_source_submission_id = v_sub
  where id = v_line_archived;

  -- Ügyfélcsomagok
  insert into public.customer_packages (project_id, title, status, access_token)
  values (v_proj_a, 'Ajánlat v1', 'sent', 'pkg-tok-1') returning id into v_pkg1;
  insert into public.customer_packages (project_id, title, status)
  values (v_proj_a, 'Ajánlat v2 (draft)', 'draft') returning id into v_pkg2;

  -- TIG-ek
  insert into public.performance_certificates (project_id, document_number, issued_at, period_to, vat_mode, vat_label)
  values (v_proj_a, 'TIG-TESZT-A-2026-001', current_date, current_date, 'standard', 'ÁFA 27%')
  returning id into v_cert1;
  insert into public.performance_certificates (project_id, document_number, issued_at, period_to, vat_mode, vat_label)
  values (v_proj_a, 'TIG-TESZT-A-2026-002', current_date, current_date, 'standard', 'ÁFA 27%')
  returning id into v_cert2;

  -- TIG-hez kötés (NULL → érték: engednie kell)
  update public.quote_lines set tig_document_id = v_cert1 where id = v_line_tig;

  -- B projekt TIG + kötés (projekt-cascade teszthez)
  insert into public.performance_certificates (project_id, document_number, issued_at, period_to, vat_mode, vat_label)
  values (v_proj_b, 'TIG-TESZT-B-2026-001', current_date, current_date, 'standard', 'ÁFA 27%');
  update public.quote_lines ql set tig_document_id = pc.id
  from public.performance_certificates pc
  where ql.id = v_line_b and pc.project_id = v_proj_b;

  insert into t_ids values
    ('org', v_org), ('proj_a', v_proj_a), ('proj_b', v_proj_b),
    ('q_active', v_q_active), ('q_archived', v_q_archived), ('q_rfq', v_q_rfq),
    ('line_active', v_line_active), ('line_archived', v_line_archived), ('line_tig', v_line_tig),
    ('rfq', v_rfq), ('inv', v_inv), ('sub', v_sub),
    ('pkg1', v_pkg1), ('pkg2', v_pkg2), ('cert1', v_cert1), ('cert2', v_cert2);

  raise notice 'SEED OK';
end $$;

-- ---------------------------------------------------------------------------
-- Tesztek
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_ok boolean;
begin
  select * into r from (
    select
      (select id from t_ids where key='proj_a') as proj_a,
      (select id from t_ids where key='proj_b') as proj_b,
      (select id from t_ids where key='q_active') as q_active,
      (select id from t_ids where key='q_archived') as q_archived,
      (select id from t_ids where key='q_rfq') as q_rfq,
      (select id from t_ids where key='line_active') as line_active,
      (select id from t_ids where key='line_archived') as line_archived,
      (select id from t_ids where key='line_tig') as line_tig,
      (select id from t_ids where key='rfq') as rfq,
      (select id from t_ids where key='inv') as inv,
      (select id from t_ids where key='sub') as sub,
      (select id from t_ids where key='pkg1') as pkg1,
      (select id from t_ids where key='pkg2') as pkg2,
      (select id from t_ids where key='cert1') as cert1,
      (select id from t_ids where key='cert2') as cert2
  ) x;

  -- T1: quote törlés RFQ-val → RESTRICT hiba várt
  begin
    delete from public.quotes where id = r.q_rfq;
    raise notice 'T1 FAIL — RFQ-s quote törlődött (RESTRICT nem élt)';
  exception when foreign_key_violation then
    raise notice 'T1 PASS — RFQ-s quote törlése blokkolt (RESTRICT)';
  end;

  -- T2: második 'sent' csomag ugyanarra a projektre → unique hiba várt
  begin
    update public.customer_packages set status = 'sent', access_token = 'pkg-tok-2' where id = r.pkg2;
    raise notice 'T2 FAIL — két sent csomag egy projekten';
  exception when unique_violation then
    raise notice 'T2 PASS — második sent csomag blokkolt (partial unique)';
  end;

  -- T3: helyes sorrend — előbb supersede, aztán sent → mennie kell
  begin
    update public.customer_packages set status = 'superseded' where id = r.pkg1;
    update public.customer_packages set status = 'sent', access_token = 'pkg-tok-2' where id = r.pkg2;
    raise notice 'T3 PASS — supersede→sent sorrend működik';
  exception when others then
    raise notice 'T3 FAIL — %', sqlerrm;
  end;

  -- T4: archivált quote sorának üzleti módosítása → hiba várt
  begin
    update public.quote_lines set quantity = 99 where id = r.line_archived;
    raise notice 'T4 FAIL — archivált sor módosult';
  exception when others then
    raise notice 'T4 PASS — archivált sor módosítás blokkolt (%)', sqlerrm;
  end;

  -- T5: submission törlése, ami archivált quote sorát árazza → SET NULL-nak át kell mennie
  begin
    delete from public.rfq_submissions where id = r.sub;
    select cost_source_submission_id is null into v_ok from public.quote_lines where id = r.line_archived;
    if v_ok then
      raise notice 'T5 PASS — submission törlés SET NULL átment az archivált-guardon';
    else
      raise notice 'T5 FAIL — cost_source_submission_id nem nullázódott';
    end if;
  exception when others then
    raise notice 'T5 FAIL — submission törlés elhasalt: %', sqlerrm;
  end;

  -- T6: TIG-es sor készültség-visszaállítás → hiba várt
  begin
    update public.quote_lines set execution_status = 'pending' where id = r.line_tig;
    raise notice 'T6 FAIL — TIG-es sor készültsége visszaállt';
  exception when others then
    raise notice 'T6 PASS — TIG-es sor készültség-visszaállítás blokkolt';
  end;

  -- T7: TIG-es sor átcsatolása másik cert-re → hiba várt
  begin
    update public.quote_lines set tig_document_id = r.cert2 where id = r.line_tig;
    raise notice 'T7 FAIL — TIG-es sor átcsatolódott';
  exception when others then
    raise notice 'T7 PASS — TIG átcsatolás blokkolt';
  end;

  -- T8: TIG-es sor törlése → hiba várt
  begin
    delete from public.quote_lines where id = r.line_tig;
    raise notice 'T8 FAIL — TIG-es sor törlődött';
  exception when others then
    raise notice 'T8 PASS — TIG-es sor törlés blokkolt';
  end;

  -- T9: TIG-es sor bekerülési ára módosítható (élő tényköltség-követés) → mennie kell
  begin
    update public.quote_lines set cost_material_unit_price = 5500 where id = r.line_tig;
    raise notice 'T9 PASS — TIG-es sor bekerülési ára módosítható';
  exception when others then
    raise notice 'T9 FAIL — bekerülési ár zárolva: %', sqlerrm;
  end;

  -- T10: duplikált TIG-sorszám ugyanarra a projektre → hiba várt
  begin
    insert into public.performance_certificates (project_id, document_number, issued_at, period_to, vat_mode, vat_label)
    values (r.proj_a, 'TIG-TESZT-A-2026-001', current_date, current_date, 'standard', 'ÁFA 27%');
    raise notice 'T10 FAIL — duplikált TIG-sorszám bement';
  exception when unique_violation then
    raise notice 'T10 PASS — TIG-sorszám ütközés blokkolt';
  end;

  -- T11: második submission ugyanarra a meghívásra → hiba várt
  begin
    insert into public.rfq_submissions (rfq_id, invitation_id, subcontractor_name, total_amount)
    values (r.rfq, r.inv, 'Klima-Pro újra', 140000);
    insert into public.rfq_submissions (rfq_id, invitation_id, subcontractor_name, total_amount)
    values (r.rfq, r.inv, 'Klima-Pro harmadszor', 130000);
    raise notice 'T11 FAIL — két submission egy meghíváson';
  exception when unique_violation then
    raise notice 'T11 PASS — 1 beküldés / meghívás kikényszerítve';
  end;

  -- T12: cert törlése → SET NULL felszabadítja a sort (jövőbeli storno út)
  begin
    delete from public.performance_certificates where id = r.cert1;
    select tig_document_id is null into v_ok from public.quote_lines where id = r.line_tig;
    if v_ok then
      raise notice 'T12 PASS — cert törléskor a sor felszabadult (SET NULL átment a guardokon)';
    else
      raise notice 'T12 FAIL — tig_document_id nem nullázódott';
    end if;
  exception when others then
    raise notice 'T12 FAIL — cert törlés elhasalt: %', sqlerrm;
  end;

  -- T13: projekt törlés archivált quote-tal + TIG-es sorral (cascade-lánc)
  begin
    delete from public.projects where id = r.proj_b;
    raise notice 'T13 INFO — B projekt törlése SIKERÜLT (cascade sorrend: cert SET NULL előbb futott)';
  exception when others then
    raise notice 'T13 INFO — B projekt törlése BLOKKOLT: %', sqlerrm;
  end;

  -- T14: RFQ-sor quote-sor törlés után is él (SET NULL + snapshot szöveg)
  begin
    -- line_active nem TIG-es és a quote nem archivált → törölhető
    delete from public.quote_lines where id = r.line_active;
    if exists (
      select 1 from public.rfq_lines
      where rfq_id = r.rfq and quote_line_id is null and text = 'Aktív sor'
    ) then
      raise notice 'T14 PASS — rfq_line snapshot megmaradt SET NULL után';
    else
      raise notice 'T14 FAIL — rfq_line elveszett vagy nem nullázódott';
    end if;
  exception when others then
    raise notice 'T14 FAIL — %', sqlerrm;
  end;

end $$;

rollback;
