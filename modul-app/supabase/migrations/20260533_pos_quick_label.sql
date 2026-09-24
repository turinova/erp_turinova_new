-- POS gyors tile: rövid pult-felirat (Lightspeed/Square custom label)

alter table public.pos_quick_items
  add column if not exists pos_label text;

comment on column public.pos_quick_items.pos_label is
  'Pulton megjelenő rövid név (max ~32). Üres = okos fallback a katalógusnévből.';

alter table public.pos_quick_items
  drop constraint if exists pos_quick_items_pos_label_len_chk;

alter table public.pos_quick_items
  add constraint pos_quick_items_pos_label_len_chk
  check (pos_label is null or char_length(btrim(pos_label)) <= 40);
