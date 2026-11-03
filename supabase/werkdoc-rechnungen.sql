-- =====================================================================
-- WERKDOC – GEMEINSAME RECHNUNGSNUMMERN, SCHUTZ & WEBSITE-ANBINDUNG
-- Im Supabase-Projekt von WerkDoc ausführen (nicht im Website-Projekt!):
-- SQL Editor -> New query -> alles einfügen -> Run. Kann mehrfach ausgeführt werden.
--
--  1) wb_naechste_nr        Zähler für Belegnummern (RE-001/2026 …). Laden und Website
--                           ziehen aus derselben Reihe – keine doppelten Nummern.
--  2) Schutz-Trigger        Erstellte Rechnungen bleiben unveränderbar und unlöschbar,
--                           auch wenn ein altes Gerät es versucht. Erlaubt: Status, Verlauf, Bezahlt-Datum.
--  3) wb_website_rechnung   Einzige Funktion, die die Website (Edge Function) aufrufen darf.
--                           Sie legt NUR Kunde + Rechnung an – kein Lesen, kein Ändern, kein Löschen.
--                           Geschützt mit einem eigenen Website-Schlüssel (nicht dem Service-Key).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) ZÄHLER
-- ---------------------------------------------------------------------
create table if not exists public.wb_nummern (
  user_id uuid not null,
  kind    text not null,          -- rechnung | angebot | kva
  jahr    int  not null,          -- 0 = Nummern ohne Jahreszahl
  letzte  int  not null,
  primary key (user_id, kind, jahr)
);
alter table public.wb_nummern enable row level security;   -- nur über die Funktionen

-- p_min: kleinste erlaubte Nummer (z. B. Startnummer 30 oder die höchste schon vergebene + 1)
create or replace function public.wb_nr_ziehen(p_user uuid, p_kind text, p_jahr int, p_min int)
returns int language sql security definer set search_path = public as $$
  insert into public.wb_nummern as n (user_id, kind, jahr, letzte)
  values (p_user, p_kind, p_jahr, greatest(coalesce(p_min, 1), 1))
  on conflict (user_id, kind, jahr) do update set letzte = greatest(n.letzte + 1, excluded.letzte)
  returning letzte
$$;
revoke all on function public.wb_nr_ziehen(uuid, text, int, int) from public, anon, authenticated;

-- Aufruf aus der WerkDoc-App (angemeldeter Nutzer)
create or replace function public.wb_naechste_nr(p_kind text, p_jahr int, p_min int)
returns int language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  if p_kind not in ('rechnung', 'angebot', 'kva') then raise exception 'unbekannte Belegart'; end if;
  return public.wb_nr_ziehen(auth.uid(), p_kind, p_jahr, p_min);
end $$;
revoke all on function public.wb_naechste_nr(text, int, int) from public, anon;
grant execute on function public.wb_naechste_nr(text, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- 2) SCHUTZ: erstellte Rechnungen bleiben, wie sie sind
-- ---------------------------------------------------------------------
create or replace function public.wb_rechnung_schutz() returns trigger
language plpgsql set search_path = public as $$
declare
  geschuetzt text[] := array['typ','nr','kundeId','auftragId','geraet','imei','datum','leistung','faellig',
                             'positionen','ku','mwst','brutto','rabatt','notiz','websiteAuftrag','quelle','created'];
  alt jsonb;
begin
  if old.coll = 'rechnungen' and not coalesce(old.deleted, false) and old.data is not null
     and coalesce(old.data->>'typ', 'rechnung') = 'rechnung' and coalesce(old.data->>'nr', '') <> '' then
    new.deleted := false;                                    -- Löschen wird ignoriert
    if new.data is null then new.data := old.data; end if;
    select coalesce(jsonb_object_agg(k, old.data->k), '{}'::jsonb) into alt
      from unnest(geschuetzt) k where old.data ? k;
    new.data := new.data || alt;                             -- Rechnungsinhalt bleibt der alte
  end if;
  return new;
end $$;

drop trigger if exists wb_rechnung_schutz on public.wb_records;
create trigger wb_rechnung_schutz before update on public.wb_records
for each row execute function public.wb_rechnung_schutz();

-- ---------------------------------------------------------------------
-- 3) WEBSITE-ANBINDUNG
-- ---------------------------------------------------------------------
create table if not exists public.wb_website_zugang (
  user_id          uuid primary key,
  schluessel_hash  text not null,
  erstellt         timestamptz not null default now()
);
alter table public.wb_website_zugang enable row level security;   -- keine Policies: niemand liest das über die API

-- Einmalig im SQL Editor ausführen – gibt den Website-Schlüssel EINMAL zurück (danach nur noch als Hash gespeichert).
-- Neu ausführen = neuer Schlüssel, der alte gilt dann nicht mehr.
create or replace function public.wb_website_zugang_erzeugen(p_email text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  u uuid; k text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select id into u from auth.users where lower(email) = lower(p_email);
  if u is null then raise exception 'Kein WerkDoc-Konto mit der E-Mail %', p_email; end if;
  insert into public.wb_website_zugang (user_id, schluessel_hash) values (u, encode(extensions.digest(k, 'sha256'), 'hex'))
  on conflict (user_id) do update set schluessel_hash = excluded.schluessel_hash, erstellt = now();
  return k;
end $$;
revoke all on function public.wb_website_zugang_erzeugen(text) from public, anon, authenticated;

-- Legt Kunde (falls neu) und Rechnung an und gibt Nummer + Firmendaten fürs PDF zurück.
-- p_kunde:    { name, strasse, plz, ort, land, mail, tel }
-- p_rechnung: { websiteAuftrag, geraet, datum, leistung, faellig, positionen:[{bez,text,menge,einheit,preis}], notiz }
create or replace function public.wb_website_rechnung(p_key text, p_kunde jsonb, p_rechnung jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  u uuid; firma jsonb; ref text := p_rechnung->>'websiteAuftrag';
  jahr int := extract(year from (now() at time zone 'Europe/Berlin'))::int;
  pre text; mit_jahr boolean; start int := 1; hoechste int; n int; nr text;
  k_id text; k_nr text; r_id text; jetzt bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  vorhanden text; daten jsonb;
begin
  select z.user_id into u from public.wb_website_zugang z
   where z.schluessel_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  if u is null then raise exception 'zugang_verweigert' using errcode = '28000'; end if;
  if ref is null or ref !~ '^RM-\d{5}$' then raise exception 'auftragsnummer_ungueltig'; end if;
  if coalesce(trim(p_kunde->>'name'), '') = '' or jsonb_typeof(p_rechnung->'positionen') <> 'array'
     or jsonb_array_length(p_rechnung->'positionen') = 0 then raise exception 'daten_unvollstaendig'; end if;

  perform pg_advisory_xact_lock(hashtext('wb_website_rechnung:' || u::text));   -- eine Rechnung nach der anderen

  -- schon eine gültige (nicht stornierte) Rechnung zu diesem Auftrag?
  select r.data->>'nr' into vorhanden from public.wb_records r
   where r.user_id = u and r.coll = 'rechnungen' and not coalesce(r.deleted, false)
     and r.data->>'websiteAuftrag' = ref and coalesce(r.data->>'nr', '') <> ''
     and coalesce(r.data->>'status', 'offen') <> 'storniert' limit 1;
  if vorhanden is not null then raise exception 'bereits_rechnung:%', vorhanden using errcode = '23505'; end if;

  select r.data into firma from public.wb_records r where r.user_id = u and r.coll = 'firma' and not coalesce(r.deleted, false) limit 1;
  firma := coalesce(firma, '{}'::jsonb);
  pre := coalesce(nullif(trim(firma->>'preRe'), ''), 'RE-');
  mit_jahr := coalesce(firma->>'nrJahr', 'true') <> 'false';
  if not mit_jahr then jahr := 0; end if;
  if (firma->>'reStartYear') ~ '^\d+$' and (firma->>'reStartYear')::int = jahr and (firma->>'reStart') ~ '^\d+$' then start := (firma->>'reStart')::int; end if;

  -- höchste schon vergebene laufende Nummer (wie in der App: jede Zahl außer der Jahreszahl zählt)
  select max(m[1]::int) into hoechste from public.wb_records r, regexp_matches(r.data->>'nr', '\d+', 'g') m
   where r.user_id = u and r.coll = 'rechnungen' and coalesce(r.data->>'typ', 'rechnung') = 'rechnung'
     and coalesce(r.data->>'nr', '') <> '' and length(m[1]) < 6 and m[1]::int <> jahr
     and (jahr = 0 or left(r.data->>'datum', 4) = jahr::text);
  n := public.wb_nr_ziehen(u, 'rechnung', jahr, greatest(coalesce(hoechste, 0) + 1, start));
  nr := pre || lpad(n::text, 3, '0') || case when jahr > 0 then '/' || jahr else '' end;

  -- Kunde über die E-Mail wiederfinden oder neu anlegen
  select r.id, r.data->>'nr' into k_id, k_nr from public.wb_records r
   where r.user_id = u and r.coll = 'kunden' and not coalesce(r.deleted, false)
     and lower(r.data->>'mail') = lower(p_kunde->>'mail') and coalesce(p_kunde->>'mail', '') <> '' limit 1;
  if k_id is null then
    k_id := 'web' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    select (greatest(1000, coalesce(max((r.data->>'nr')::int), 0)) + 1)::text into k_nr from public.wb_records r
     where r.user_id = u and r.coll = 'kunden' and (r.data->>'nr') ~ '^\d{1,9}$';
    insert into public.wb_records (user_id, coll, id, data, deleted, upd, updated_at)
    values (u, 'kunden', k_id, jsonb_strip_nulls(jsonb_build_object(
      'name', trim(p_kunde->>'name'), 'strasse', p_kunde->>'strasse', 'plz', p_kunde->>'plz', 'ort', p_kunde->>'ort',
      'land', p_kunde->>'land', 'mail', p_kunde->>'mail', 'tel', p_kunde->>'tel', 'nr', k_nr,
      'notiz', 'Angelegt über die Website (Auftrag ' || ref || ')')), false, jetzt, now());
  end if;

  r_id := 'web' || substr(md5(random()::text || clock_timestamp()::text || ref), 1, 12);
  daten := jsonb_build_object(
    'typ', 'rechnung', 'nr', nr, 'status', 'offen', 'kundeId', k_id, 'auftragId', '',
    'websiteAuftrag', ref, 'quelle', 'website',
    'geraet', coalesce(p_rechnung->>'geraet', ''), 'imei', '',
    'datum', coalesce(p_rechnung->>'datum', to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD')),
    'leistung', coalesce(p_rechnung->>'leistung', p_rechnung->>'datum'),
    'faellig', p_rechnung->>'faellig',
    'positionen', p_rechnung->'positionen', 'ku', true, 'mwst', 0, 'brutto', true, 'rabatt', 0,
    'notiz', coalesce(p_rechnung->>'notiz', ''),
    'verlauf', jsonb_build_array(jsonb_build_object('t', to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD"T"HH24:MI'), 'e', 'Erstellt über die Website (Auftrag ' || ref || ')')),
    'created', to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD"T"HH24:MI'));
  insert into public.wb_records (user_id, coll, id, data, deleted, upd, updated_at) values (u, 'rechnungen', r_id, daten, false, jetzt, now());

  return jsonb_build_object('id', r_id, 'nr', nr, 'kunde_nr', k_nr,
    'firma', jsonb_strip_nulls(jsonb_build_object(
      'name', firma->>'name', 'strasse', firma->>'strasse', 'plz', firma->>'plz', 'ort', firma->>'ort',
      'tel', firma->>'tel', 'mail', firma->>'mail', 'ansprechpartner', firma->>'ansprechpartner',
      'bank', firma->>'bank', 'iban', firma->>'iban', 'bic', firma->>'bic', 'stnr', firma->>'stnr', 'ustid', firma->>'ustid')));
end $$;
revoke all on function public.wb_website_rechnung(text, jsonb, jsonb) from public;
grant execute on function public.wb_website_rechnung(text, jsonb, jsonb) to anon;

-- Nach dem Mailversand: Status "versendet" setzen (nur bei Website-Rechnungen, nur von "offen" aus)
create or replace function public.wb_website_versendet(p_key text, p_id text, p_an text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid;
begin
  select z.user_id into u from public.wb_website_zugang z
   where z.schluessel_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  if u is null then raise exception 'zugang_verweigert' using errcode = '28000'; end if;
  update public.wb_records r set
    data = r.data || jsonb_build_object('status', 'versendet', 'verlauf', coalesce(r.data->'verlauf', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('t', to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM-DD"T"HH24:MI'), 'e', 'Per E-Mail an ' || coalesce(p_an, 'den Kunden') || ' versendet'))),
    upd = (extract(epoch from clock_timestamp()) * 1000)::bigint, updated_at = now()
  where r.user_id = u and r.coll = 'rechnungen' and r.id = p_id and r.data->>'quelle' = 'website' and coalesce(r.data->>'status', 'offen') = 'offen';
end $$;
revoke all on function public.wb_website_versendet(text, text, text) from public;
grant execute on function public.wb_website_versendet(text, text, text) to anon;

-- Status einer Website-Rechnung abfragen (für "Storniert?" im Admin-Bereich) – gibt nur Nummer + Status zurück
create or replace function public.wb_website_status(p_key text, p_ref text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u uuid; erg jsonb;
begin
  select z.user_id into u from public.wb_website_zugang z
   where z.schluessel_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  if u is null then raise exception 'zugang_verweigert' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('nr', r.data->>'nr', 'status', coalesce(r.data->>'status', 'offen'))), '[]'::jsonb) into erg
    from public.wb_records r where r.user_id = u and r.coll = 'rechnungen' and not coalesce(r.deleted, false) and r.data->>'websiteAuftrag' = p_ref;
  return erg;
end $$;
revoke all on function public.wb_website_status(text, text) from public;
grant execute on function public.wb_website_status(text, text) to anon;

-- =====================================================================
-- EINMALIG DANACH (E-Mail deines WerkDoc-Kontos eintragen):
--   select public.wb_website_zugang_erzeugen('info@repair-mobile.de');
-- Das Ergebnis ist der Website-Schlüssel -> in Supabase (Website-Projekt) als Edge-Function-Secret
-- WERKDOC_WEBSITE_KEY eintragen. Er kann nur die drei wb_website_*-Funktionen oben aufrufen.
-- =====================================================================
