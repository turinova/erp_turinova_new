-- =============================================================================
-- quote_lines.execution_status: 'skipped' = „Nem kell” (nem megy TIG-be,
-- készültségben lezártnak számít)
-- =============================================================================

alter table public.quote_lines
  drop constraint if exists quote_lines_execution_status_check;

alter table public.quote_lines
  add constraint quote_lines_execution_status_check
  check (execution_status in ('pending', 'done', 'skipped'));
