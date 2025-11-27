--
-- PostgreSQL database dump
--

\restrict JZu8dzJkZff2b1ebbmp1vecEAzcOZLa0RXbC5NbdJbld20RRoetocpQMr0R0YEE

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: machine_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.machine_type_enum AS ENUM (
    'Korpus'
);


--
-- Name: quote_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quote_status AS ENUM (
    'draft',
    'accepted',
    'in_production',
    'done',
    'rejected',
    'ordered',
    'ready',
    'finished',
    'cancelled'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
begin
    raise debug 'PgBouncer auth request: %', p_usename;

    return query
    select 
        rolname::text, 
        case when rolvaliduntil < now() 
            then null 
            else rolpassword::text 
        end 
    from pg_authid 
    where rolname=$1 and rolcanlogin;
end;
$_$;


--
-- Name: calculate_accessory_net_price(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_accessory_net_price() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Auto-calculate net_price when base_price or multiplier changes
  NEW.net_price = ROUND(NEW.base_price * NEW.multiplier);
  RETURN NEW;
END;
$$;


--
-- Name: calculate_linear_materials_price_per_m(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_linear_materials_price_per_m() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Calculate price_per_m from base_price * multiplier
    NEW.price_per_m = ROUND((NEW.base_price * NEW.multiplier)::numeric, 2);
    RETURN NEW;
END;
$$;


--
-- Name: calculate_materials_price_per_sqm(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_materials_price_per_sqm() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Calculate price_per_sqm from base_price * multiplier
    NEW.price_per_sqm = ROUND((NEW.base_price * NEW.multiplier)::numeric, 2);
    RETURN NEW;
END;
$$;


--
-- Name: create_pos_sale(uuid, text, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_pos_sale(p_worker_id uuid, p_payment_type text, p_customer jsonb DEFAULT '{}'::jsonb, p_items jsonb DEFAULT '[]'::jsonb, p_fees jsonb DEFAULT '[]'::jsonb, p_discount jsonb DEFAULT '{"amount": 0, "percentage": 0}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_warehouse_id uuid;
  v_pos_order_id uuid;
  v_pos_order_number varchar(50);
  v_item jsonb;
  v_fee jsonb;
  v_subtotal_net numeric(12,2) := 0;
  v_total_vat numeric(12,2) := 0;
  v_total_gross numeric(12,2) := 0;
  v_discount_percentage numeric(5,2);
  v_discount_amount numeric(12,2);
  v_item_total_net numeric(12,2);
  v_item_total_vat numeric(12,2);
  v_item_total_gross numeric(12,2);
  v_result jsonb;
  v_product_type varchar(30);
BEGIN
  -- Step 1: Get default warehouse (is_active = true, LIMIT 1)
  SELECT id INTO v_warehouse_id
  FROM public.warehouses
  WHERE is_active = true
  LIMIT 1;

  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Nincs aktív raktár. Kérjük, állítson be legalább egy aktív raktárt.';
  END IF;

  -- Step 2: Calculate totals from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_total_net := (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric;
    v_item_total_vat := (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
    v_item_total_gross := (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric;
    
    v_subtotal_net := v_subtotal_net + v_item_total_net;
    v_total_vat := v_total_vat + v_item_total_vat;
    v_total_gross := v_total_gross + v_item_total_gross;
  END LOOP;

  -- Step 3: Calculate totals from fees
  FOR v_fee IN SELECT * FROM jsonb_array_elements(p_fees)
  LOOP
    v_item_total_net := (v_fee->>'quantity')::numeric * (v_fee->>'unit_price_net')::numeric;
    v_item_total_vat := (v_fee->>'quantity')::numeric * ((v_fee->>'unit_price_gross')::numeric - (v_fee->>'unit_price_net')::numeric);
    v_item_total_gross := (v_fee->>'quantity')::numeric * (v_fee->>'unit_price_gross')::numeric;
    
    v_subtotal_net := v_subtotal_net + v_item_total_net;
    v_total_vat := v_total_vat + v_item_total_vat;
    v_total_gross := v_total_gross + v_item_total_gross;
  END LOOP;

  -- Step 4: Apply discount
  v_discount_percentage := COALESCE((p_discount->>'percentage')::numeric, 0);
  v_discount_amount := COALESCE((p_discount->>'amount')::numeric, 0);

  IF v_discount_amount = 0 AND v_discount_percentage > 0 THEN
    v_discount_amount := (v_total_gross * v_discount_percentage) / 100;
  END IF;
  
  v_total_gross := v_total_gross - v_discount_amount;
  -- Recalculate VAT proportionally (simplified: reduce VAT by discount percentage)
  IF v_total_gross > 0 THEN
    v_total_vat := v_total_vat * (v_total_gross / (v_total_gross + v_discount_amount));
    v_subtotal_net := v_total_gross - v_total_vat;
  ELSE
    v_total_vat := 0;
    v_subtotal_net := 0;
  END IF;

  -- Step 5: Insert pos_order
  INSERT INTO public.pos_orders (
    worker_id,
    customer_name,
    customer_email,
    customer_mobile,
    billing_name,
    billing_country,
    billing_city,
    billing_postal_code,
    billing_street,
    billing_house_number,
    billing_tax_number,
    billing_company_reg_number,
    discount_percentage,
    discount_amount,
    subtotal_net,
    total_vat,
    total_gross,
    status
  ) VALUES (
    p_worker_id,
    NULLIF(p_customer->>'name', ''),
    NULLIF(p_customer->>'email', ''),
    NULLIF(p_customer->>'mobile', ''),
    NULLIF(p_customer->>'billing_name', ''),
    COALESCE(NULLIF(p_customer->>'billing_country', ''), 'Magyarország'),
    NULLIF(p_customer->>'billing_city', ''),
    NULLIF(p_customer->>'billing_postal_code', ''),
    NULLIF(p_customer->>'billing_street', ''),
    NULLIF(p_customer->>'billing_house_number', ''),
    NULLIF(p_customer->>'billing_tax_number', ''),
    NULLIF(p_customer->>'billing_company_reg_number', ''),
    v_discount_percentage,
    v_discount_amount,
    v_subtotal_net,
    v_total_vat,
    v_total_gross,
    'completed'
  )
  RETURNING id, pos_order_number INTO v_pos_order_id, v_pos_order_number;

  -- Step 6: Insert pos_order_items (products)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_type := COALESCE(v_item->>'product_type', 'accessory');
    
    INSERT INTO public.pos_order_items (
      pos_order_id,
      item_type,
      product_type,
      accessory_id,
      material_id,
      linear_material_id,
      product_name,
      sku,
      quantity,
      unit_price_net,
      unit_price_gross,
      vat_id,
      currency_id,
      total_net,
      total_vat,
      total_gross
    ) VALUES (
      v_pos_order_id,
      'product',
      v_product_type,
      CASE WHEN v_item->>'accessory_id' IS NOT NULL AND v_item->>'accessory_id' != '' THEN (v_item->>'accessory_id')::uuid ELSE NULL END,
      CASE WHEN v_item->>'material_id' IS NOT NULL AND v_item->>'material_id' != '' THEN (v_item->>'material_id')::uuid ELSE NULL END,
      CASE WHEN v_item->>'linear_material_id' IS NOT NULL AND v_item->>'linear_material_id' != '' THEN (v_item->>'linear_material_id')::uuid ELSE NULL END,
      v_item->>'name',
      NULLIF(v_item->>'sku', ''),
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price_net')::numeric,
      (v_item->>'unit_price_gross')::numeric,
      (v_item->>'vat_id')::uuid,
      (v_item->>'currency_id')::uuid,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric,
      (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric),
      (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric
    );
  END LOOP;

  -- Step 7: Insert pos_order_items (fees)
  FOR v_fee IN SELECT * FROM jsonb_array_elements(p_fees)
  LOOP
    INSERT INTO public.pos_order_items (
      pos_order_id,
      item_type,
      feetype_id,
      product_name,
      sku,
      quantity,
      unit_price_net,
      unit_price_gross,
      vat_id,
      currency_id,
      total_net,
      total_vat,
      total_gross
    ) VALUES (
      v_pos_order_id,
      'fee',
      CASE WHEN v_fee->>'feetype_id' IS NOT NULL AND v_fee->>'feetype_id' != '' THEN (v_fee->>'feetype_id')::uuid ELSE NULL END,
      v_fee->>'name',
      NULL,
      (v_fee->>'quantity')::numeric,
      (v_fee->>'unit_price_net')::numeric,
      (v_fee->>'unit_price_gross')::numeric,
      (v_fee->>'vat_id')::uuid,
      (v_fee->>'currency_id')::uuid,
      (v_fee->>'quantity')::numeric * (v_fee->>'unit_price_net')::numeric,
      (v_fee->>'quantity')::numeric * ((v_fee->>'unit_price_gross')::numeric - (v_fee->>'unit_price_net')::numeric),
      (v_fee->>'quantity')::numeric * (v_fee->>'unit_price_gross')::numeric
    );
  END LOOP;

  -- Step 8: Insert pos_payment
  INSERT INTO public.pos_payments (
    pos_order_id,
    payment_type,
    amount,
    status
  ) VALUES (
    v_pos_order_id,
    p_payment_type,
    v_total_gross,
    'completed'
  );

  -- Step 9: Create stock movements for each product item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_type := COALESCE(v_item->>'product_type', 'accessory');
    
    IF v_product_type = 'accessory' AND v_item->>'accessory_id' IS NOT NULL AND v_item->>'accessory_id' != '' THEN
      INSERT INTO public.stock_movements (
        warehouse_id,
        product_type,
        accessory_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        note
      ) VALUES (
        v_warehouse_id,
        'accessory',
        (v_item->>'accessory_id')::uuid,
        -1 * (v_item->>'quantity')::numeric, -- negative for outgoing
        'out',
        'pos_sale',
        v_pos_order_id,
        'POS order: ' || v_pos_order_number
      );
    ELSIF v_product_type = 'material' AND v_item->>'material_id' IS NOT NULL AND v_item->>'material_id' != '' THEN
      INSERT INTO public.stock_movements (
        warehouse_id,
        product_type,
        material_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        note
      ) VALUES (
        v_warehouse_id,
        'material',
        (v_item->>'material_id')::uuid,
        -1 * (v_item->>'quantity')::numeric, -- negative for outgoing
        'out',
        'pos_sale',
        v_pos_order_id,
        'POS order: ' || v_pos_order_number
      );
    ELSIF v_product_type = 'linear_material' AND v_item->>'linear_material_id' IS NOT NULL AND v_item->>'linear_material_id' != '' THEN
      INSERT INTO public.stock_movements (
        warehouse_id,
        product_type,
        linear_material_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        note
      ) VALUES (
        v_warehouse_id,
        'linear_material',
        (v_item->>'linear_material_id')::uuid,
        -1 * (v_item->>'quantity')::numeric, -- negative for outgoing
        'out',
        'pos_sale',
        v_pos_order_id,
        'POS order: ' || v_pos_order_number
      );
    END IF;
  END LOOP;

  -- Step 10: Return result
  SELECT jsonb_build_object(
    'pos_order', (
      SELECT jsonb_build_object(
        'id', id,
        'pos_order_number', pos_order_number,
        'worker_id', worker_id,
        'total_gross', total_gross,
        'status', status,
        'created_at', created_at
      )
      FROM public.pos_orders
      WHERE id = v_pos_order_id
    ),
    'items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'item_type', item_type,
          'product_name', product_name,
          'quantity', quantity,
          'total_gross', total_gross
        )
      )
      FROM public.pos_order_items
      WHERE pos_order_id = v_pos_order_id
    ),
    'payment', (
      SELECT jsonb_build_object(
        'id', id,
        'payment_type', payment_type,
        'amount', amount,
        'status', status
      )
      FROM public.pos_payments
      WHERE pos_order_id = v_pos_order_id
    )
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Hiba a POS rendelés létrehozásakor: %', SQLERRM;
END;
$$;


--
-- Name: generate_order_number(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number(target_date date DEFAULT CURRENT_DATE) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
  max_attempts INTEGER := 100; -- Safety limit
  attempt INTEGER := 0;
BEGIN
  date_str := TO_CHAR(target_date, 'YYYY-MM-DD');
  
  -- Find the highest number (including deleted orders)
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'ORD-\d{4}-\d{2}-\d{2}-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM orders
  WHERE order_number LIKE 'ORD-' || date_str || '-%';
  -- NOTE: Removed "AND deleted_at IS NULL" - we need to see ALL numbers
  
  -- Loop until we find an available number
  LOOP
    new_order_number := 'ORD-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
    
    -- Check if this number exists (deleted or not)
    IF NOT EXISTS (
      SELECT 1 FROM orders WHERE order_number = new_order_number
    ) THEN
      -- Number is available, return it
      RETURN new_order_number;
    END IF;
    
    -- Number exists, try next one
    next_num := next_num + 1;
    attempt := attempt + 1;
    
    -- Safety check to prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION generate_order_number(target_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_order_number(target_date date) IS 'Generate unique order number: ORD-YYYY-MM-DD-NNN';


--
-- Name: generate_pos_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_pos_order_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_val bigint;
BEGIN
  SELECT nextval('pos_order_number_seq') INTO next_val;
  RETURN 'POS-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;


--
-- Name: generate_purchase_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_purchase_order_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_val bigint;
BEGIN
  -- Pl.: PO-20251116-000123
  SELECT nextval('purchase_order_number_seq') INTO next_val;

  RETURN 'PO-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;


--
-- Name: generate_quote_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quote_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  new_quote_number VARCHAR(50);
  max_attempts INTEGER := 100; -- Safety limit
  attempt INTEGER := 0;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  
  -- Find the highest number (including deleted quotes)
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(quote_number FROM POSITION('-' IN quote_number) + 6)
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE quote_number LIKE 'Q-' || current_year || '-%';
  -- NOTE: Removed "AND deleted_at IS NULL" - we need to see ALL numbers
  
  -- Loop until we find an available number
  LOOP
    new_quote_number := 'Q-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
    
    -- Check if this number exists (deleted or not)
    IF NOT EXISTS (
      SELECT 1 FROM public.quotes WHERE quote_number = new_quote_number
    ) THEN
      -- Number is available, return it
      RETURN new_quote_number;
    END IF;
    
    -- Number exists, try next one
    next_number := next_number + 1;
    attempt := attempt + 1;
    
    -- Safety check to prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique quote number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;


--
-- Name: generate_quote_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quote_order_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
BEGIN
  -- Format date as YYYY-MM-DD
  date_str := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
  
  -- Get the next number for this date from quotes table
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'ORD-\d{4}-\d{2}-\d{2}-(\d+)') 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM quotes
  WHERE order_number LIKE 'ORD-' || date_str || '-%'
    AND deleted_at IS NULL;
  
  -- Generate new order number with zero-padded sequence
  new_order_number := 'ORD-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN new_order_number;
END;
$$;


--
-- Name: FUNCTION generate_quote_order_number(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_quote_order_number() IS 'Generate unique order number for quotes: ORD-YYYY-MM-DD-NNN';


--
-- Name: generate_shipment_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_shipment_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_val bigint;
BEGIN
  -- Pl.: SH-20251116-000123
  SELECT nextval('shipment_number_seq') INTO next_val;

  RETURN 'SH-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;


--
-- Name: generate_shop_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_shop_order_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_num INTEGER;
    order_num TEXT;
BEGIN
    SELECT nextval('shop_order_number_seq') INTO next_num;
    order_num := 'SO-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(next_num::TEXT, 3, '0');
    RETURN order_num;
END;
$$;


--
-- Name: generate_stock_movement_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_stock_movement_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_val bigint;
BEGIN
  SELECT nextval('stock_movement_number_seq') INTO next_val;

  RETURN 'SM-' ||
         to_char(current_date, 'YYYYMMDD') ||
         '-' ||
         lpad(next_val::text, 6, '0');
END;
$$;


--
-- Name: get_user_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_permissions(user_uuid uuid) RETURNS TABLE(page_path character varying, page_name character varying, can_access boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.path,
    p.name,
    COALESCE(up.can_access, false) as can_access
  FROM pages p
  LEFT JOIN user_permissions up ON p.id = up.page_id AND up.user_id = user_uuid
  WHERE p.is_active = true
  ORDER BY p.category, p.name;
END;
$$;


--
-- Name: grant_default_permissions_to_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_default_permissions_to_new_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  BEGIN
    -- Grant access to all active pages
    INSERT INTO public.user_permissions (user_id, page_id, can_access)
    SELECT 
      NEW.id,
      p.id,
      true
    FROM public.pages p
    WHERE p.is_active = true
    ON CONFLICT (user_id, page_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to grant default permissions: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_page_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_page_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_record RECORD;
BEGIN
  IF NEW.is_active = TRUE THEN
    FOR user_record IN SELECT id FROM auth.users LOOP
      INSERT INTO public.user_permissions (user_id, page_id, can_access)
      VALUES (user_record.id, NEW.id, TRUE)
      ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = TRUE;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  page_record RECORD;
BEGIN
  FOR page_record IN SELECT id FROM public.pages WHERE is_active = TRUE LOOP
    INSERT INTO public.user_permissions (user_id, page_id, can_access)
    VALUES (NEW.id, page_record.id, TRUE)
    ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = TRUE;
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: lookup_user_pin(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lookup_user_pin(pin_code character varying) RETURNS TABLE(user_id uuid, worker_id uuid, failed_attempts integer, locked_until timestamp with time zone, is_active boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    up.worker_id,
    up.failed_attempts,
    up.locked_until,
    up.is_active
  FROM public.user_pins up
  WHERE up.pin = pin_code
    AND up.is_active = true;
END;
$$;


--
-- Name: receive_shipment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_shipment(p_shipment_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_shipment record;
  v_po record;
  v_item record;
  v_received_count integer := 0;
  v_total_items integer := 0;
  v_all_received boolean := true;
  v_po_item record;
  v_received_qty numeric(10,2);
  v_ordered_qty numeric(10,2);
  v_result jsonb;
BEGIN
  -- Validate shipment exists and is in draft status
  SELECT s.*, po.id as po_id, po.status as po_status
  INTO v_shipment
  FROM public.shipments s
  INNER JOIN public.purchase_orders po ON po.id = s.purchase_order_id
  WHERE s.id = p_shipment_id
    AND s.deleted_at IS NULL
    AND po.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Shipment not found or deleted'
    );
  END IF;

  IF v_shipment.status != 'draft' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Shipment can only be received from draft status'
    );
  END IF;

  -- Load purchase order
  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = v_shipment.purchase_order_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Purchase order not found'
    );
  END IF;

  -- Check if any items have quantity_received > 0
  SELECT COUNT(*) INTO v_received_count
  FROM public.shipment_items si
  WHERE si.shipment_id = p_shipment_id
    AND si.deleted_at IS NULL
    AND si.quantity_received > 0;

  IF v_received_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No received quantities provided'
    );
  END IF;

  -- Process each shipment item and create stock movements
  FOR v_item IN
    SELECT 
      si.id,
      si.purchase_order_item_id,
      si.quantity_received,
      poi.product_type,
      poi.accessory_id,
      poi.material_id,
      poi.linear_material_id
    FROM public.shipment_items si
    INNER JOIN public.purchase_order_items poi ON poi.id = si.purchase_order_item_id
    WHERE si.shipment_id = p_shipment_id
      AND si.deleted_at IS NULL
      AND poi.deleted_at IS NULL
      AND si.quantity_received > 0
  LOOP
    -- Insert stock movement
    INSERT INTO public.stock_movements (
      warehouse_id,
      product_type,
      accessory_id,
      material_id,
      linear_material_id,
      quantity,
      movement_type,
      source_type,
      source_id,
      note,
      stock_movement_number
    ) VALUES (
      v_shipment.warehouse_id,
      v_item.product_type,
      v_item.accessory_id,
      v_item.material_id,
      v_item.linear_material_id,
      v_item.quantity_received, -- positive quantity
      'in',
      'purchase_receipt',
      p_shipment_id,
      v_shipment.note,
      generate_stock_movement_number()
    );
  END LOOP;

  -- Update shipment status to 'received'
  UPDATE public.shipments
  SET status = 'received',
      updated_at = now()
  WHERE id = p_shipment_id;

  -- Recalculate PO status based on ALL shipments for this PO
  -- For each PO item, sum received quantities across all shipments
  FOR v_po_item IN
    SELECT poi.id, poi.quantity as ordered_qty
    FROM public.purchase_order_items poi
    WHERE poi.purchase_order_id = v_po.id
      AND poi.deleted_at IS NULL
  LOOP
    -- Sum received quantities from all shipments for this PO item
    SELECT COALESCE(SUM(si.quantity_received), 0) INTO v_received_qty
    FROM public.shipment_items si
    INNER JOIN public.shipments s ON s.id = si.shipment_id
    WHERE si.purchase_order_item_id = v_po_item.id
      AND s.purchase_order_id = v_po.id
      AND si.deleted_at IS NULL
      AND s.deleted_at IS NULL
      AND s.status = 'received';

    v_ordered_qty := v_po_item.ordered_qty;

    -- If any item is not fully received, PO is partial
    IF v_received_qty < v_ordered_qty THEN
      v_all_received := false;
      EXIT; -- Exit loop early
    END IF;
  END LOOP;

  -- Update PO status
  IF v_all_received THEN
    UPDATE public.purchase_orders
    SET status = 'received',
        updated_at = now()
    WHERE id = v_po.id;
  ELSE
    UPDATE public.purchase_orders
    SET status = 'partial',
        updated_at = now()
    WHERE id = v_po.id;
  END IF;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'shipment_id', p_shipment_id,
    'shipment_status', 'received',
    'po_status', CASE WHEN v_all_received THEN 'received' ELSE 'partial' END,
    'items_received', v_received_count
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic in a function
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


--
-- Name: sync_user_from_auth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_from_auth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, created_at, updated_at, last_sign_in_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.created_at, 
    NEW.updated_at, 
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = EXCLUDED.updated_at,
    last_sign_in_at = EXCLUDED.last_sign_in_at;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_user_from_auth failed for user %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: update_accessories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_accessories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_feetypes_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_feetypes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_media_files_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_media_files_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_pos_order(uuid, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pos_order(p_pos_order_id uuid, p_customer_data jsonb, p_discount jsonb, p_items jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_warehouse_id uuid;
  v_pos_order_number varchar(50);
  v_subtotal_net numeric(12,2) := 0;
  v_total_vat numeric(12,2) := 0;
  v_total_gross numeric(12,2) := 0;
  v_discount_percentage numeric(5,2) := 0;
  v_discount_amount numeric(12,2) := 0;
  v_item_total_net numeric(12,2);
  v_item_total_vat numeric(12,2);
  v_item_total_gross numeric(12,2);
  v_item jsonb;
  v_existing_item record;
  v_existing_movement record;
  v_old_quantity numeric(10,2);
  v_product_type varchar(30);
  v_new_quantity numeric(10,2);
  v_quantity_diff numeric(10,2);
  v_result jsonb;
BEGIN
  -- Step 1: Verify order exists
  SELECT pos_order_number INTO v_pos_order_number
  FROM public.pos_orders
  WHERE id = p_pos_order_id AND deleted_at IS NULL;
  
  IF v_pos_order_number IS NULL THEN
    RAISE EXCEPTION 'POS rendelés nem található vagy törölve';
  END IF;

  -- Step 2: Get warehouse_id from existing stock movements (or query active warehouse)
  SELECT warehouse_id INTO v_warehouse_id
  FROM public.stock_movements
  WHERE source_type = 'pos_sale' AND source_id = p_pos_order_id
  LIMIT 1;
  
  -- If no existing movements, get active warehouse
  IF v_warehouse_id IS NULL THEN
    SELECT id INTO v_warehouse_id
    FROM public.warehouses
    WHERE is_active = true
    LIMIT 1;
    
    IF v_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Nincs aktív raktár. Kérjük, állítson be legalább egy aktív raktárt.';
    END IF;
  END IF;

  -- Step 3: Calculate totals from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Skip soft-deleted items (they will be handled separately)
    IF v_item->>'deleted' = 'true' THEN
      CONTINUE;
    END IF;
    
    v_item_total_net := (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric;
    v_item_total_vat := (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
    v_item_total_gross := (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric;
    
    v_subtotal_net := v_subtotal_net + v_item_total_net;
    v_total_vat := v_total_vat + v_item_total_vat;
    v_total_gross := v_total_gross + v_item_total_gross;
  END LOOP;

  -- Step 4: Apply discount
  v_discount_percentage := COALESCE((p_discount->>'percentage')::numeric, 0);
  v_discount_amount := COALESCE((p_discount->>'amount')::numeric, 0);
  
  -- If discount_amount is provided, use it; otherwise calculate from percentage
  IF v_discount_amount = 0 AND v_discount_percentage > 0 THEN
    v_discount_amount := (v_total_gross * v_discount_percentage) / 100;
  END IF;
  
  v_total_gross := v_total_gross - v_discount_amount;

  -- Step 5: Update pos_orders
  UPDATE public.pos_orders
  SET
    customer_name = NULLIF(p_customer_data->>'customer_name', ''),
    customer_email = NULLIF(p_customer_data->>'customer_email', ''),
    customer_mobile = NULLIF(p_customer_data->>'customer_mobile', ''),
    billing_name = NULLIF(p_customer_data->>'billing_name', ''),
    billing_country = COALESCE(NULLIF(p_customer_data->>'billing_country', ''), 'Magyarország'),
    billing_city = NULLIF(p_customer_data->>'billing_city', ''),
    billing_postal_code = NULLIF(p_customer_data->>'billing_postal_code', ''),
    billing_street = NULLIF(p_customer_data->>'billing_street', ''),
    billing_house_number = NULLIF(p_customer_data->>'billing_house_number', ''),
    billing_tax_number = NULLIF(p_customer_data->>'billing_tax_number', ''),
    billing_company_reg_number = NULLIF(p_customer_data->>'billing_company_reg_number', ''),
    discount_percentage = v_discount_percentage,
    discount_amount = v_discount_amount,
    subtotal_net = v_subtotal_net,
    total_vat = v_total_vat,
    total_gross = v_total_gross,
    updated_at = now()
  WHERE id = p_pos_order_id;

  -- Step 6: Handle pos_order_items (update, insert, soft-delete)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- If item has an ID, it's an existing item
    IF v_item->>'id' IS NOT NULL AND v_item->>'id' != '' THEN
      -- Check if item should be soft-deleted
      IF v_item->>'deleted' = 'true' THEN
        -- Soft delete the item
        UPDATE public.pos_order_items
        SET deleted_at = now(), updated_at = now()
        WHERE id = (v_item->>'id')::uuid;
        
        -- If it's a product (not a fee), create reverse stock movement
        IF (v_item->>'item_type')::text = 'product' THEN
          -- Get the old quantity and product info from the item before deletion
          SELECT quantity, product_type, accessory_id, material_id, linear_material_id INTO v_existing_item
          FROM public.pos_order_items
          WHERE id = (v_item->>'id')::uuid;
          
          -- Create IN movement to reverse the original OUT movement
          IF v_existing_item.quantity IS NOT NULL AND v_existing_item.quantity > 0 THEN
            IF v_existing_item.accessory_id IS NOT NULL THEN
              INSERT INTO public.stock_movements (
                warehouse_id, product_type, accessory_id, quantity, movement_type, source_type, source_id, note
              ) VALUES (
                v_warehouse_id, 'accessory', v_existing_item.accessory_id, v_existing_item.quantity, 'in', 'pos_sale', p_pos_order_id,
                'POS rendelés módosítás: tétel törölve - ' || v_pos_order_number
              );
            ELSIF v_existing_item.material_id IS NOT NULL THEN
              INSERT INTO public.stock_movements (
                warehouse_id, product_type, material_id, quantity, movement_type, source_type, source_id, note
              ) VALUES (
                v_warehouse_id, 'material', v_existing_item.material_id, v_existing_item.quantity, 'in', 'pos_sale', p_pos_order_id,
                'POS rendelés módosítás: tétel törölve - ' || v_pos_order_number
              );
            ELSIF v_existing_item.linear_material_id IS NOT NULL THEN
              INSERT INTO public.stock_movements (
                warehouse_id, product_type, linear_material_id, quantity, movement_type, source_type, source_id, note
              ) VALUES (
                v_warehouse_id, 'linear_material', v_existing_item.linear_material_id, v_existing_item.quantity, 'in', 'pos_sale', p_pos_order_id,
                'POS rendelés módosítás: tétel törölve - ' || v_pos_order_number
              );
            END IF;
          END IF;
        END IF;
      ELSE
        -- Update existing item
        SELECT quantity INTO v_old_quantity
        FROM public.pos_order_items
        WHERE id = (v_item->>'id')::uuid;
        
        v_new_quantity := (v_item->>'quantity')::numeric;
        v_item_total_net := v_new_quantity * (v_item->>'unit_price_net')::numeric;
        v_item_total_vat := v_new_quantity * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
        v_item_total_gross := v_new_quantity * (v_item->>'unit_price_gross')::numeric;
        
        UPDATE public.pos_order_items
        SET
          product_type = COALESCE((v_item->>'product_type')::varchar, 'accessory'),
          product_name = v_item->>'product_name',
          sku = NULLIF(v_item->>'sku', ''),
          quantity = v_new_quantity,
          unit_price_net = (v_item->>'unit_price_net')::numeric,
          unit_price_gross = (v_item->>'unit_price_gross')::numeric,
          vat_id = (v_item->>'vat_id')::uuid,
          currency_id = (v_item->>'currency_id')::uuid,
          accessory_id = CASE WHEN (v_item->>'accessory_id') IS NOT NULL AND (v_item->>'accessory_id') != '' THEN (v_item->>'accessory_id')::uuid ELSE NULL END,
          material_id = CASE WHEN (v_item->>'material_id') IS NOT NULL AND (v_item->>'material_id') != '' THEN (v_item->>'material_id')::uuid ELSE NULL END,
          linear_material_id = CASE WHEN (v_item->>'linear_material_id') IS NOT NULL AND (v_item->>'linear_material_id') != '' THEN (v_item->>'linear_material_id')::uuid ELSE NULL END,
          total_net = v_item_total_net,
          total_vat = v_item_total_vat,
          total_gross = v_item_total_gross,
          updated_at = now()
        WHERE id = (v_item->>'id')::uuid;
        
        -- If it's a product (not a fee), handle stock movements for all product types
        IF (v_item->>'item_type')::text = 'product' THEN
          -- Calculate quantity difference
          v_quantity_diff := v_new_quantity - COALESCE(v_old_quantity, 0);
          
          IF v_quantity_diff != 0 THEN
            -- Determine product type and ID
            IF (v_item->>'accessory_id') IS NOT NULL AND (v_item->>'accessory_id') != '' THEN
              -- Accessory
              IF v_quantity_diff < 0 THEN
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, accessory_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'accessory', (v_item->>'accessory_id')::uuid, ABS(v_quantity_diff), 'in', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség csökkentve - ' || v_pos_order_number
                );
              ELSE
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, accessory_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'accessory', (v_item->>'accessory_id')::uuid, -1 * v_quantity_diff, 'out', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség növelve - ' || v_pos_order_number
                );
              END IF;
            ELSIF (v_item->>'material_id') IS NOT NULL AND (v_item->>'material_id') != '' THEN
              -- Material
              IF v_quantity_diff < 0 THEN
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, material_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'material', (v_item->>'material_id')::uuid, ABS(v_quantity_diff), 'in', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség csökkentve - ' || v_pos_order_number
                );
              ELSE
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, material_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'material', (v_item->>'material_id')::uuid, -1 * v_quantity_diff, 'out', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség növelve - ' || v_pos_order_number
                );
              END IF;
            ELSIF (v_item->>'linear_material_id') IS NOT NULL AND (v_item->>'linear_material_id') != '' THEN
              -- Linear material
              IF v_quantity_diff < 0 THEN
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, linear_material_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'linear_material', (v_item->>'linear_material_id')::uuid, ABS(v_quantity_diff), 'in', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség csökkentve - ' || v_pos_order_number
                );
              ELSE
                INSERT INTO public.stock_movements (
                  warehouse_id, product_type, linear_material_id, quantity, movement_type, source_type, source_id, note
                ) VALUES (
                  v_warehouse_id, 'linear_material', (v_item->>'linear_material_id')::uuid, -1 * v_quantity_diff, 'out', 'pos_sale', p_pos_order_id,
                  'POS rendelés módosítás: mennyiség növelve - ' || v_pos_order_number
                );
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;
    ELSE
      -- New item (no ID)
      IF v_item->>'deleted' != 'true' THEN
        v_item_total_net := (v_item->>'quantity')::numeric * (v_item->>'unit_price_net')::numeric;
        v_item_total_vat := (v_item->>'quantity')::numeric * ((v_item->>'unit_price_gross')::numeric - (v_item->>'unit_price_net')::numeric);
        v_item_total_gross := (v_item->>'quantity')::numeric * (v_item->>'unit_price_gross')::numeric;
        
        INSERT INTO public.pos_order_items (
          pos_order_id,
          item_type,
          product_type,
          accessory_id,
          material_id,
          linear_material_id,
          feetype_id,
          product_name,
          sku,
          quantity,
          unit_price_net,
          unit_price_gross,
          vat_id,
          currency_id,
          total_net,
          total_vat,
          total_gross
        ) VALUES (
          p_pos_order_id,
          (v_item->>'item_type')::varchar,
          COALESCE((v_item->>'product_type')::varchar, 'accessory'),
          CASE WHEN (v_item->>'accessory_id') IS NOT NULL AND (v_item->>'accessory_id') != '' THEN (v_item->>'accessory_id')::uuid ELSE NULL END,
          CASE WHEN (v_item->>'material_id') IS NOT NULL AND (v_item->>'material_id') != '' THEN (v_item->>'material_id')::uuid ELSE NULL END,
          CASE WHEN (v_item->>'linear_material_id') IS NOT NULL AND (v_item->>'linear_material_id') != '' THEN (v_item->>'linear_material_id')::uuid ELSE NULL END,
          CASE WHEN (v_item->>'feetype_id') IS NOT NULL AND (v_item->>'feetype_id') != '' THEN (v_item->>'feetype_id')::uuid ELSE NULL END,
          v_item->>'product_name',
          NULLIF(v_item->>'sku', ''),
          (v_item->>'quantity')::numeric,
          (v_item->>'unit_price_net')::numeric,
          (v_item->>'unit_price_gross')::numeric,
          (v_item->>'vat_id')::uuid,
          (v_item->>'currency_id')::uuid,
          v_item_total_net,
          v_item_total_vat,
          v_item_total_gross
        );
        
        -- If it's a new product (not a fee), create OUT stock movement for all product types
        IF (v_item->>'item_type')::text = 'product' THEN
          IF (v_item->>'accessory_id') IS NOT NULL AND (v_item->>'accessory_id') != '' THEN
            INSERT INTO public.stock_movements (
              warehouse_id, product_type, accessory_id, quantity, movement_type, source_type, source_id, note
            ) VALUES (
              v_warehouse_id, 'accessory', (v_item->>'accessory_id')::uuid, -1 * (v_item->>'quantity')::numeric, 'out', 'pos_sale', p_pos_order_id,
              'POS rendelés módosítás: új tétel hozzáadva - ' || v_pos_order_number
            );
          ELSIF (v_item->>'material_id') IS NOT NULL AND (v_item->>'material_id') != '' THEN
            INSERT INTO public.stock_movements (
              warehouse_id, product_type, material_id, quantity, movement_type, source_type, source_id, note
            ) VALUES (
              v_warehouse_id, 'material', (v_item->>'material_id')::uuid, -1 * (v_item->>'quantity')::numeric, 'out', 'pos_sale', p_pos_order_id,
              'POS rendelés módosítás: új tétel hozzáadva - ' || v_pos_order_number
            );
          ELSIF (v_item->>'linear_material_id') IS NOT NULL AND (v_item->>'linear_material_id') != '' THEN
            INSERT INTO public.stock_movements (
              warehouse_id, product_type, linear_material_id, quantity, movement_type, source_type, source_id, note
            ) VALUES (
              v_warehouse_id, 'linear_material', (v_item->>'linear_material_id')::uuid, -1 * (v_item->>'quantity')::numeric, 'out', 'pos_sale', p_pos_order_id,
              'POS rendelés módosítás: új tétel hozzáadva - ' || v_pos_order_number
            );
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Step 7: Return updated order data
  SELECT jsonb_build_object(
    'success', true,
    'pos_order_id', p_pos_order_id,
    'pos_order_number', v_pos_order_number,
    'subtotal_net', v_subtotal_net,
    'total_vat', v_total_vat,
    'total_gross', v_total_gross,
    'discount_percentage', v_discount_percentage,
    'discount_amount', v_discount_amount
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Hiba a POS rendelés frissítésekor: %', SQLERRM;
END;
$$;


--
-- Name: update_pos_order_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pos_order_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_pos_orders_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pos_orders_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_pos_payments_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pos_payments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_production_machines_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_production_machines_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_quote_accessories_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quote_accessories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_quote_fees_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quote_fees_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_quote_payment_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quote_payment_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_quote_id UUID;
  v_final_total NUMERIC(12,2);
  v_total_paid NUMERIC(12,2);
  v_new_status TEXT;
  v_tolerance CONSTANT NUMERIC := 1.0; -- 1 Ft tolerance for rounding
BEGIN
  -- Get quote_id from the affected row
  IF (TG_OP = 'DELETE') THEN
    v_quote_id := OLD.quote_id;
  ELSE
    v_quote_id := NEW.quote_id;
  END IF;

  -- Get quote's final total
  SELECT final_total_after_discount INTO v_final_total
  FROM quotes
  WHERE id = v_quote_id;

  -- Calculate total paid (excluding soft-deleted payments)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM quote_payments
  WHERE quote_id = v_quote_id
    AND deleted_at IS NULL;

  -- Determine payment status with tolerance
  IF v_total_paid = 0 THEN
    v_new_status := 'not_paid';
  ELSIF v_total_paid >= v_final_total - v_tolerance THEN
    -- Consider "paid" if within 1 Ft of final total (handles rounding)
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Update quote's payment status
  UPDATE quotes
  SET payment_status = v_new_status,
      updated_at = NOW()
  WHERE id = v_quote_id;

  RETURN NULL; -- Result is ignored for AFTER triggers
END;
$$;


--
-- Name: FUNCTION update_quote_payment_status(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_quote_payment_status() IS 'Auto-calculate and update quote payment_status based on payments';


--
-- Name: update_quote_status_timestamps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_quote_status_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only update if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Update the appropriate timestamp based on new status
    CASE NEW.status
      WHEN 'ordered' THEN 
        -- Only set if not already set (preserve first transition)
        IF NEW.ordered_at IS NULL THEN
          NEW.ordered_at := NOW();
        END IF;
        
      WHEN 'in_production' THEN 
        IF NEW.in_production_at IS NULL THEN
          NEW.in_production_at := NOW();
        END IF;
        
      WHEN 'ready' THEN 
        IF NEW.ready_at IS NULL THEN
          NEW.ready_at := NOW();
        END IF;
        
      WHEN 'finished' THEN 
        IF NEW.finished_at IS NULL THEN
          NEW.finished_at := NOW();
        END IF;
        
      WHEN 'cancelled' THEN 
        IF NEW.cancelled_at IS NULL THEN
          NEW.cancelled_at := NOW();
        END IF;
        
      ELSE
        -- No timestamp update for 'draft' or other statuses
        NULL;
    END CASE;
    
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION update_quote_status_timestamps(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_quote_status_timestamps() IS 'Automatically updates status timestamp columns when quote status changes. Only sets timestamp on first transition to preserve original date.';


--
-- Name: update_shop_order_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shop_order_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_order_id uuid;
  v_total_active integer;
  v_deleted_status_count integer;
  v_non_deleted_count integer;
  v_handed_over_count integer;
  v_arrived_count integer;
  v_ordered_or_more_count integer;
  v_new_status varchar(20);
BEGIN
  -- Get the order_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- Count all active items (excluding soft-deleted: deleted_at IS NULL)
  SELECT COUNT(*)
  INTO v_total_active
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL;

  -- Count items with status = 'deleted'
  SELECT COUNT(*)
  INTO v_deleted_status_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'deleted';

  -- Count non-deleted items (status != 'deleted')
  SELECT COUNT(*)
  INTO v_non_deleted_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status != 'deleted';

  -- Count items that are handed_over
  SELECT COUNT(*)
  INTO v_handed_over_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'handed_over';

  -- Count items that are arrived
  SELECT COUNT(*)
  INTO v_arrived_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status = 'arrived';

  -- Count items that are ordered, arrived, or handed_over
  SELECT COUNT(*)
  INTO v_ordered_or_more_count
  FROM shop_order_items
  WHERE order_id = v_order_id
    AND deleted_at IS NULL
    AND status IN ('ordered', 'arrived', 'handed_over');

  -- Determine the new status based on business logic (priority order)
  IF v_total_active = 0 OR (v_total_active > 0 AND v_deleted_status_count = v_total_active) THEN
    -- Priority 1: All items are deleted → order is deleted
    v_new_status := 'deleted';
  ELSIF v_non_deleted_count > 0 AND v_handed_over_count = v_non_deleted_count THEN
    -- Priority 2: All non-deleted items are handed_over → order is handed_over (final state)
    v_new_status := 'handed_over';
  ELSIF v_non_deleted_count > 0 AND v_arrived_count = v_non_deleted_count THEN
    -- Priority 3: All non-deleted items are arrived → order is finished (ready for handover)
    v_new_status := 'finished';
  ELSIF v_non_deleted_count > 0 AND (v_arrived_count > 0 OR v_handed_over_count > 0) THEN
    -- Priority 4: Mix of arrived/handed_over (partial handover) → order stays at arrived
    v_new_status := 'arrived';
  ELSIF v_non_deleted_count > 0 AND v_ordered_or_more_count = v_non_deleted_count THEN
    -- Priority 5: All non-deleted items are ordered or better → order is ordered
    v_new_status := 'ordered';
  ELSE
    -- Priority 6: Otherwise → order is open (some items still need to be ordered)
    v_new_status := 'open';
  END IF;

  -- Update the shop_orders status if it changed
  UPDATE shop_orders
  SET status = v_new_status,
      updated_at = NOW()
  WHERE id = v_order_id
    AND status != v_new_status; -- Only update if status actually changed

  -- Return the appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


--
-- Name: FUNCTION update_shop_order_status(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_shop_order_status() IS 'Automatically updates shop_orders.status based on shop_order_items statuses:
   Priority 1: deleted - All items have status=deleted
   Priority 2: handed_over - All non-deleted items handed over to customer (final state)
   Priority 3: finished - All non-deleted items have arrived (ready for handover)
   Priority 4: arrived - Mix of arrived/handed_over (partial handover in progress)
   Priority 5: ordered - All non-deleted items are ordered or better
   Priority 6: open - Some non-deleted items still need ordering';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_user_pins_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_pins_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: accessories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accessories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    sku character varying(100) NOT NULL,
    net_price integer NOT NULL,
    vat_id uuid NOT NULL,
    currency_id uuid NOT NULL,
    units_id uuid NOT NULL,
    partners_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38,
    barcode character varying(64),
    last_purchase_net_price integer,
    is_stock_tracked boolean DEFAULT true NOT NULL,
    default_warehouse_id uuid,
    image_url text,
    CONSTRAINT accessories_base_price_positive CHECK ((base_price > 0)),
    CONSTRAINT accessories_multiplier_range CHECK (((multiplier >= 1.00) AND (multiplier <= 5.00)))
);


--
-- Name: COLUMN accessories.image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accessories.image_url IS 'URL to the product image';


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: currencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    rate numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    shop_order_item_id uuid,
    product_type character varying(30) NOT NULL,
    accessory_id uuid,
    material_id uuid,
    linear_material_id uuid,
    quantity numeric(10,2) NOT NULL,
    net_price integer NOT NULL,
    vat_id uuid NOT NULL,
    currency_id uuid NOT NULL,
    units_id uuid NOT NULL,
    description character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    note text,
    CONSTRAINT purchase_order_items_net_price_positive CHECK ((net_price >= 0)),
    CONSTRAINT purchase_order_items_product_type_check CHECK (((product_type)::text = ANY ((ARRAY['accessory'::character varying, 'material'::character varying, 'linear_material'::character varying])::text[]))),
    CONSTRAINT purchase_order_items_quantity_positive CHECK ((quantity > (0)::numeric))
);


--
-- Name: shipment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipment_id uuid NOT NULL,
    purchase_order_item_id uuid NOT NULL,
    quantity_received numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    note text,
    CONSTRAINT shipment_items_quantity_nonnegative CHECK ((quantity_received >= (0)::numeric))
);


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    partner_id uuid NOT NULL,
    shipment_date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    note text,
    shipment_number character varying(50) DEFAULT public.generate_shipment_number() NOT NULL,
    CONSTRAINT shipments_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid NOT NULL,
    product_type character varying(30) NOT NULL,
    accessory_id uuid,
    material_id uuid,
    linear_material_id uuid,
    quantity numeric(10,2) NOT NULL,
    movement_type character varying(20) NOT NULL,
    source_type character varying(30) NOT NULL,
    source_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    stock_movement_number character varying(50) DEFAULT public.generate_stock_movement_number() NOT NULL,
    CONSTRAINT stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying, 'adjustment'::character varying])::text[]))),
    CONSTRAINT stock_movements_product_type_check CHECK (((product_type)::text = ANY ((ARRAY['accessory'::character varying, 'material'::character varying, 'linear_material'::character varying])::text[]))),
    CONSTRAINT stock_movements_quantity_nonzero CHECK ((quantity <> (0)::numeric))
);


--
-- Name: current_stock; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.current_stock AS
 WITH stock_aggregated AS (
         SELECT stock_movements.warehouse_id,
            stock_movements.product_type,
            stock_movements.accessory_id,
            stock_movements.material_id,
            stock_movements.linear_material_id,
            sum(stock_movements.quantity) AS quantity_on_hand,
            max(stock_movements.created_at) AS last_movement_at
           FROM public.stock_movements
          GROUP BY stock_movements.warehouse_id, stock_movements.product_type, stock_movements.accessory_id, stock_movements.material_id, stock_movements.linear_material_id
        ), material_costs AS (
         SELECT sm.material_id,
            sm.warehouse_id,
            avg(poi.net_price) AS avg_cost_per_unit
           FROM (((public.stock_movements sm
             JOIN public.shipments s ON (((s.id = sm.source_id) AND ((sm.source_type)::text = 'purchase_receipt'::text))))
             JOIN public.shipment_items si ON (((si.shipment_id = s.id) AND (si.deleted_at IS NULL))))
             JOIN public.purchase_order_items poi ON (((poi.id = si.purchase_order_item_id) AND (poi.material_id = sm.material_id) AND ((poi.product_type)::text = 'material'::text) AND (poi.deleted_at IS NULL))))
          WHERE (((sm.movement_type)::text = 'in'::text) AND ((sm.product_type)::text = 'material'::text))
          GROUP BY sm.material_id, sm.warehouse_id
        ), linear_material_costs AS (
         SELECT sm.linear_material_id,
            sm.warehouse_id,
            avg(poi.net_price) AS avg_cost_per_unit
           FROM (((public.stock_movements sm
             JOIN public.shipments s ON (((s.id = sm.source_id) AND ((sm.source_type)::text = 'purchase_receipt'::text))))
             JOIN public.shipment_items si ON (((si.shipment_id = s.id) AND (si.deleted_at IS NULL))))
             JOIN public.purchase_order_items poi ON (((poi.id = si.purchase_order_item_id) AND (poi.linear_material_id = sm.linear_material_id) AND ((poi.product_type)::text = 'linear_material'::text) AND (poi.deleted_at IS NULL))))
          WHERE (((sm.movement_type)::text = 'in'::text) AND ((sm.product_type)::text = 'linear_material'::text))
          GROUP BY sm.linear_material_id, sm.warehouse_id
        )
 SELECT sa.warehouse_id,
    sa.product_type,
    sa.accessory_id,
    sa.material_id,
    sa.linear_material_id,
    sa.quantity_on_hand,
    sa.last_movement_at,
        CASE
            WHEN (((sa.product_type)::text = 'accessory'::text) AND (sa.accessory_id IS NOT NULL)) THEN (sa.quantity_on_hand * (COALESCE(a.net_price, 0))::numeric)
            WHEN (((sa.product_type)::text = 'material'::text) AND (sa.material_id IS NOT NULL)) THEN (sa.quantity_on_hand * COALESCE(mc.avg_cost_per_unit, (0)::numeric))
            WHEN (((sa.product_type)::text = 'linear_material'::text) AND (sa.linear_material_id IS NOT NULL)) THEN (sa.quantity_on_hand * COALESCE(lmc.avg_cost_per_unit, (0)::numeric))
            ELSE (0)::numeric
        END AS stock_value
   FROM (((stock_aggregated sa
     LEFT JOIN public.accessories a ON (((a.id = sa.accessory_id) AND ((sa.product_type)::text = 'accessory'::text) AND (a.deleted_at IS NULL))))
     LEFT JOIN material_costs mc ON (((mc.material_id = sa.material_id) AND (mc.warehouse_id = sa.warehouse_id) AND ((sa.product_type)::text = 'material'::text))))
     LEFT JOIN linear_material_costs lmc ON (((lmc.linear_material_id = sa.linear_material_id) AND (lmc.warehouse_id = sa.warehouse_id) AND ((sa.product_type)::text = 'linear_material'::text))));


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    email character varying,
    mobile character varying,
    discount_percent numeric(5,2) DEFAULT 0,
    billing_name character varying,
    billing_country character varying DEFAULT 'Magyarország'::character varying,
    billing_city character varying,
    billing_postal_code character varying,
    billing_street character varying,
    billing_house_number character varying,
    billing_tax_number character varying,
    billing_company_reg_number character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    sms_notification boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN customers.sms_notification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.sms_notification IS 'Indicates whether the customer wants to receive SMS notifications. Defaults to true (opt-out model).';


--
-- Name: cutting_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cutting_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fee_per_meter numeric(10,2) DEFAULT 300 NOT NULL,
    currency_id uuid NOT NULL,
    vat_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    panthelyfuras_fee_per_hole numeric(10,2) DEFAULT 50,
    duplungolas_fee_per_sqm numeric(10,2) DEFAULT 200,
    szogvagas_fee_per_panel numeric(10,2) DEFAULT 100
);


--
-- Name: TABLE cutting_fees; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cutting_fees IS 'Global cutting fee configuration';


--
-- Name: COLUMN cutting_fees.fee_per_meter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.fee_per_meter IS 'Fee charged per meter of cutting (default: 300 Ft/m)';


--
-- Name: COLUMN cutting_fees.currency_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.currency_id IS 'Currency for cutting fee';


--
-- Name: COLUMN cutting_fees.vat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.vat_id IS 'VAT rate for cutting fee';


--
-- Name: COLUMN cutting_fees.panthelyfuras_fee_per_hole; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.panthelyfuras_fee_per_hole IS 'Fee charged per hinge hole (default: 50 Ft/hole)';


--
-- Name: COLUMN cutting_fees.duplungolas_fee_per_sqm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.duplungolas_fee_per_sqm IS 'Fee charged per square meter for groove cutting (default: 200 Ft/m²)';


--
-- Name: COLUMN cutting_fees.szogvagas_fee_per_panel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cutting_fees.szogvagas_fee_per_panel IS 'Fee charged per panel for angle cutting (default: 100 Ft/panel)';


--
-- Name: edge_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edge_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    type character varying(10) NOT NULL,
    thickness numeric(5,2) NOT NULL,
    width integer NOT NULL,
    decor character varying(10) NOT NULL,
    price numeric(10,0) NOT NULL,
    vat_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    "ráhagyás" integer DEFAULT 0 NOT NULL,
    favourite_priority integer
);


--
-- Name: COLUMN edge_materials.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edge_materials.active IS 'Whether this edge material is currently active for use. Inactive edge materials are excluded from optimization.';


--
-- Name: COLUMN edge_materials."ráhagyás"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.edge_materials."ráhagyás" IS 'Edge overhang in millimeters. Used in optimization calculations. Default is 0mm.';


--
-- Name: feetypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feetypes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    net_price numeric(12,2) NOT NULL,
    vat_id uuid NOT NULL,
    currency_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: COLUMN feetypes.net_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.feetypes.net_price IS 'Net price (can be negative for discounts/adjustments)';


--
-- Name: linear_material_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linear_material_price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    linear_material_id uuid NOT NULL,
    old_price numeric(10,2),
    new_price numeric(10,2) NOT NULL,
    old_currency_id uuid,
    new_currency_id uuid,
    old_vat_id uuid,
    new_vat_id uuid,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: linear_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linear_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    width numeric(10,2) NOT NULL,
    length numeric(10,2) NOT NULL,
    thickness numeric(10,2) NOT NULL,
    type text NOT NULL,
    image_url text,
    price_per_m numeric(10,2) DEFAULT 0 NOT NULL,
    currency_id uuid,
    vat_id uuid,
    on_stock boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38 NOT NULL,
    partners_id uuid,
    units_id uuid NOT NULL,
    barcode character varying(64),
    last_purchase_net_price integer,
    is_stock_tracked boolean DEFAULT true NOT NULL,
    default_warehouse_id uuid,
    CONSTRAINT linear_materials_base_price_positive CHECK ((base_price > 0)),
    CONSTRAINT linear_materials_multiplier_range CHECK (((multiplier >= 1.00) AND (multiplier <= 5.00)))
);


--
-- Name: machine_edge_material_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_edge_material_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    edge_material_id uuid NOT NULL,
    machine_code character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    machine_type public.machine_type_enum DEFAULT 'Korpus'::public.machine_type_enum NOT NULL
);


--
-- Name: machine_linear_material_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_linear_material_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    linear_material_id uuid NOT NULL,
    machine_type text DEFAULT 'Korpus'::text NOT NULL,
    machine_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: machine_material_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_material_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid,
    machine_code character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    machine_type public.machine_type_enum NOT NULL
);


--
-- Name: material_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name character varying NOT NULL,
    row_id uuid NOT NULL,
    action character varying NOT NULL,
    actor character varying,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_group_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_group_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    kerf_mm integer DEFAULT 3,
    trim_top_mm integer DEFAULT 0,
    trim_right_mm integer DEFAULT 0,
    trim_bottom_mm integer DEFAULT 0,
    trim_left_mm integer DEFAULT 0,
    rotatable boolean DEFAULT true,
    waste_multi double precision DEFAULT 1.0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid,
    kerf_mm integer NOT NULL,
    trim_top_mm integer NOT NULL,
    trim_right_mm integer NOT NULL,
    trim_bottom_mm integer NOT NULL,
    trim_left_mm integer NOT NULL,
    rotatable boolean NOT NULL,
    waste_multi double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    usage_limit numeric(3,2) DEFAULT 0.65,
    CONSTRAINT material_settings_usage_limit_check CHECK (((usage_limit >= (0)::numeric) AND (usage_limit <= (1)::numeric)))
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid,
    group_id uuid,
    name character varying NOT NULL,
    length_mm integer NOT NULL,
    width_mm integer NOT NULL,
    thickness_mm integer NOT NULL,
    grain_direction boolean DEFAULT false,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    on_stock boolean DEFAULT true NOT NULL,
    price_per_sqm numeric(10,2) DEFAULT 0 NOT NULL,
    currency_id uuid,
    vat_id uuid,
    active boolean DEFAULT true NOT NULL,
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38 NOT NULL,
    partners_id uuid,
    units_id uuid NOT NULL,
    barcode character varying(64),
    last_purchase_net_price integer,
    is_stock_tracked boolean DEFAULT true NOT NULL,
    default_warehouse_id uuid,
    CONSTRAINT materials_base_price_positive CHECK ((base_price > 0)),
    CONSTRAINT materials_multiplier_range CHECK (((multiplier >= 1.00) AND (multiplier <= 5.00)))
);


--
-- Name: COLUMN materials.price_per_sqm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.materials.price_per_sqm IS 'Price per square meter in the specified currency';


--
-- Name: COLUMN materials.currency_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.materials.currency_id IS 'Foreign key to currencies table';


--
-- Name: COLUMN materials.vat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.materials.vat_id IS 'Foreign key to vat table';


--
-- Name: COLUMN materials.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.materials.active IS 'Whether this material is currently active for use in optimization and operations. Inactive materials are excluded from calculations.';


--
-- Name: material_effective_settings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.material_effective_settings AS
 SELECT m.id AS material_id,
    COALESCE(ms.kerf_mm, mgs.kerf_mm, 3) AS kerf_mm,
    COALESCE(ms.trim_top_mm, mgs.trim_top_mm, 0) AS trim_top_mm,
    COALESCE(ms.trim_right_mm, mgs.trim_right_mm, 0) AS trim_right_mm,
    COALESCE(ms.trim_bottom_mm, mgs.trim_bottom_mm, 0) AS trim_bottom_mm,
    COALESCE(ms.trim_left_mm, mgs.trim_left_mm, 0) AS trim_left_mm,
    COALESCE(ms.rotatable, mgs.rotatable, true) AS rotatable,
    COALESCE(ms.waste_multi, mgs.waste_multi, (1.0)::double precision) AS waste_multi,
    COALESCE(ms.usage_limit, 0.65) AS usage_limit,
    m.grain_direction
   FROM (((public.materials m
     LEFT JOIN public.material_settings ms ON ((m.id = ms.material_id)))
     LEFT JOIN public.material_groups mg ON ((m.group_id = mg.id)))
     LEFT JOIN public.material_group_settings mgs ON ((mg.id = mgs.group_id)))
  WHERE (m.deleted_at IS NULL);


--
-- Name: material_inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_inventory_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    sku character varying(100) NOT NULL,
    transaction_type character varying(20) NOT NULL,
    quantity integer NOT NULL,
    unit_price integer,
    reference_type character varying(30) NOT NULL,
    reference_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comment text,
    CONSTRAINT check_price_required CHECK (((((transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying])::text[])) AND (unit_price IS NOT NULL)) OR (((transaction_type)::text = ANY ((ARRAY['reserved'::character varying, 'released'::character varying])::text[])) AND (unit_price IS NULL)))),
    CONSTRAINT check_quantity_sign CHECK (((((transaction_type)::text = 'in'::text) AND (quantity > 0)) OR (((transaction_type)::text = 'out'::text) AND (quantity < 0)) OR (((transaction_type)::text = ANY ((ARRAY['reserved'::character varying, 'released'::character varying])::text[])) AND (quantity > 0)))),
    CONSTRAINT material_inventory_transactions_reference_type_check CHECK (((reference_type)::text = ANY ((ARRAY['shop_order_item'::character varying, 'quote'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT material_inventory_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying, 'reserved'::character varying, 'released'::character varying])::text[])))
);


--
-- Name: TABLE material_inventory_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.material_inventory_transactions IS 'Soft inventory tracking for materials using transaction log approach. Each row represents a movement (in/out/reserved/released). Phase 1: bevételezés only.';


--
-- Name: COLUMN material_inventory_transactions.sku; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_inventory_transactions.sku IS 'Denormalized machine_code from machine_material_map for fast queries without joins';


--
-- Name: COLUMN material_inventory_transactions.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_inventory_transactions.quantity IS 'Number of boards: positive for IN, negative for OUT, positive absolute value for RESERVED/RELEASED';


--
-- Name: COLUMN material_inventory_transactions.unit_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_inventory_transactions.unit_price IS 'Price per board at transaction time. Required for IN/OUT, NULL for RESERVED/RELEASED. Used for average cost calculation.';


--
-- Name: COLUMN material_inventory_transactions.reference_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_inventory_transactions.reference_type IS 'Type of source document: shop_order_item (bevételezés), quote (foglalás/kivételezés), manual (corrections)';


--
-- Name: material_inventory_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.material_inventory_summary AS
 SELECT m.id AS material_id,
    m.name AS material_name,
    mmm.machine_code AS sku,
    b.name AS brand_name,
    m.length_mm,
    m.width_mm,
    m.thickness_mm,
    COALESCE(sum(
        CASE
            WHEN ((mit.transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying])::text[])) THEN mit.quantity
            ELSE 0
        END), (0)::bigint) AS quantity_on_hand,
    COALESCE(sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'reserved'::text) THEN mit.quantity
            WHEN ((mit.transaction_type)::text = 'released'::text) THEN (- mit.quantity)
            ELSE 0
        END), (0)::bigint) AS quantity_reserved,
    (COALESCE(sum(
        CASE
            WHEN ((mit.transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying])::text[])) THEN mit.quantity
            ELSE 0
        END), (0)::bigint) - COALESCE(sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'reserved'::text) THEN mit.quantity
            WHEN ((mit.transaction_type)::text = 'released'::text) THEN (- mit.quantity)
            ELSE 0
        END), (0)::bigint)) AS quantity_available,
    COALESCE(((sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'in'::text) THEN (mit.quantity * mit.unit_price)
            ELSE 0
        END))::numeric / (NULLIF(sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'in'::text) THEN mit.quantity
            ELSE 0
        END), 0))::numeric), (0)::numeric) AS average_cost_per_board,
    COALESCE(((sum(
        CASE
            WHEN ((mit.transaction_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying])::text[])) THEN mit.quantity
            ELSE 0
        END))::numeric * ((sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'in'::text) THEN (mit.quantity * mit.unit_price)
            ELSE 0
        END))::numeric / (NULLIF(sum(
        CASE
            WHEN ((mit.transaction_type)::text = 'in'::text) THEN mit.quantity
            ELSE 0
        END), 0))::numeric)), (0)::numeric) AS total_inventory_value,
    max(mit.created_at) AS last_movement_at
   FROM (((public.materials m
     JOIN public.machine_material_map mmm ON (((mmm.material_id = m.id) AND (mmm.machine_type = 'Korpus'::public.machine_type_enum))))
     LEFT JOIN public.brands b ON ((b.id = m.brand_id)))
     LEFT JOIN public.material_inventory_transactions mit ON ((mit.material_id = m.id)))
  WHERE (m.deleted_at IS NULL)
  GROUP BY m.id, m.name, mmm.machine_code, b.name, m.length_mm, m.width_mm, m.thickness_mm;


--
-- Name: VIEW material_inventory_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.material_inventory_summary IS 'Real-time inventory summary per material. Aggregates transactions to show current stock levels with average cost valuation.';


--
-- Name: material_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    old_price_per_sqm numeric(10,2) NOT NULL,
    new_price_per_sqm numeric(10,2) NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE material_price_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.material_price_history IS 'Tracks all price changes for materials over time';


--
-- Name: COLUMN material_price_history.material_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.material_id IS 'Reference to the material whose price changed';


--
-- Name: COLUMN material_price_history.old_price_per_sqm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.old_price_per_sqm IS 'Price before the change';


--
-- Name: COLUMN material_price_history.new_price_per_sqm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.new_price_per_sqm IS 'Price after the change';


--
-- Name: COLUMN material_price_history.changed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.changed_by IS 'User who made the price change';


--
-- Name: COLUMN material_price_history.changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.material_price_history.changed_at IS 'Timestamp when the price was changed';


--
-- Name: materials_with_settings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.materials_with_settings AS
 SELECT m.id,
    b.name AS brand_name,
    m.name AS material_name,
    m.length_mm,
    m.width_mm,
    m.thickness_mm,
    m.grain_direction,
    m.on_stock,
    m.image_url,
    mes.kerf_mm,
    mes.trim_top_mm,
    mes.trim_right_mm,
    mes.trim_bottom_mm,
    mes.trim_left_mm,
    mes.rotatable,
    mes.waste_multi,
    mes.usage_limit,
    m.created_at,
    m.updated_at
   FROM ((public.materials m
     JOIN public.brands b ON ((m.brand_id = b.id)))
     JOIN public.material_effective_settings mes ON ((m.id = mes.material_id)))
  WHERE (m.deleted_at IS NULL);


--
-- Name: media_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_filename text NOT NULL,
    stored_filename text NOT NULL,
    storage_path text NOT NULL,
    full_url text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    mimetype text DEFAULT 'image/webp'::text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE media_files; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.media_files IS 'Tracks all uploaded media files with original and stored filenames for better management';


--
-- Name: COLUMN media_files.original_filename; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.original_filename IS 'Original filename when uploaded (e.g., H1379_ST36_Orleans.webp)';


--
-- Name: COLUMN media_files.stored_filename; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.stored_filename IS 'Filename as stored in Supabase (e.g., material-id-timestamp.webp)';


--
-- Name: COLUMN media_files.storage_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.storage_path IS 'Full path in storage bucket (e.g., materials/stored_filename.webp)';


--
-- Name: COLUMN media_files.full_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.full_url IS 'Full public URL to access the image';


--
-- Name: COLUMN media_files.size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_files.size IS 'File size in bytes';


--
-- Name: pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    path character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    country character varying,
    postal_code character varying,
    city character varying,
    address character varying,
    mobile character varying,
    email character varying,
    tax_number character varying,
    company_registration_number character varying,
    bank_account character varying,
    notes text,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    contact_person character varying,
    vat_id uuid,
    currency_id uuid,
    payment_terms integer DEFAULT 30 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT partners_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    comment text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: TABLE payment_methods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_methods IS 'Available payment methods for quotes and orders';


--
-- Name: COLUMN payment_methods.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_methods.name IS 'Payment method name (e.g., Készpénz, Bankkártya) - max 50 characters';


--
-- Name: COLUMN payment_methods.comment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_methods.comment IS 'Optional description or notes about the payment method';


--
-- Name: COLUMN payment_methods.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_methods.active IS 'Whether this payment method is currently active/available';


--
-- Name: COLUMN payment_methods.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_methods.deleted_at IS 'Soft delete timestamp - NULL means not deleted';


--
-- Name: pos_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pos_order_id uuid NOT NULL,
    item_type character varying(20) NOT NULL,
    accessory_id uuid,
    feetype_id uuid,
    product_name character varying(255) NOT NULL,
    sku character varying(100),
    quantity numeric(10,2) NOT NULL,
    unit_price_net numeric(12,2) NOT NULL,
    unit_price_gross numeric(12,2) NOT NULL,
    vat_id uuid NOT NULL,
    currency_id uuid NOT NULL,
    total_net numeric(12,2) NOT NULL,
    total_vat numeric(12,2) NOT NULL,
    total_gross numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    product_type character varying(30),
    material_id uuid,
    linear_material_id uuid,
    CONSTRAINT chk_pos_order_items_product_accessory CHECK (((((item_type)::text = 'product'::text) AND (((accessory_id IS NOT NULL) AND (material_id IS NULL) AND (linear_material_id IS NULL)) OR ((material_id IS NOT NULL) AND (accessory_id IS NULL) AND (linear_material_id IS NULL)) OR ((linear_material_id IS NOT NULL) AND (accessory_id IS NULL) AND (material_id IS NULL)))) OR (((item_type)::text = 'fee'::text) AND (accessory_id IS NULL) AND (material_id IS NULL) AND (linear_material_id IS NULL)))),
    CONSTRAINT pos_order_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['product'::character varying, 'fee'::character varying])::text[])))
);


--
-- Name: pos_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pos_order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pos_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pos_order_number character varying(50) DEFAULT public.generate_pos_order_number() NOT NULL,
    worker_id uuid NOT NULL,
    customer_name character varying(255),
    customer_email character varying(255),
    customer_mobile character varying(50),
    billing_name character varying(255),
    billing_country character varying(100) DEFAULT 'Magyarország'::character varying,
    billing_city character varying(100),
    billing_postal_code character varying(20),
    billing_street character varying(255),
    billing_house_number character varying(20),
    billing_tax_number character varying(50),
    billing_company_reg_number character varying(50),
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    subtotal_net numeric(12,2) DEFAULT 0 NOT NULL,
    total_vat numeric(12,2) DEFAULT 0 NOT NULL,
    total_gross numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT pos_orders_status_check CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'cancelled'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: pos_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pos_order_id uuid NOT NULL,
    payment_type character varying(20) NOT NULL,
    amount numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT pos_payments_payment_type_check CHECK (((payment_type)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying])::text[]))),
    CONSTRAINT pos_payments_status_check CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'pending'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: product_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type character varying(30) DEFAULT 'shop_order'::character varying NOT NULL,
    shop_order_item_id uuid,
    raw_product_name character varying(255) NOT NULL,
    raw_sku character varying(100),
    raw_base_price integer,
    raw_multiplier numeric(3,2),
    raw_quantity numeric(10,2),
    raw_units_id uuid,
    raw_partner_id uuid,
    raw_vat_id uuid,
    raw_currency_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    accessory_id uuid,
    suggestion_hash text GENERATED ALWAYS AS (md5((((((((((((((((((COALESCE(raw_product_name, ''::character varying))::text || '|'::text) || (COALESCE(raw_sku, ''::character varying))::text) || '|'::text) || COALESCE((raw_base_price)::text, ''::text)) || '|'::text) || COALESCE((raw_multiplier)::text, ''::text)) || '|'::text) || COALESCE((raw_quantity)::text, ''::text)) || '|'::text) || COALESCE((raw_units_id)::text, ''::text)) || '|'::text) || COALESCE((raw_partner_id)::text, ''::text)) || '|'::text) || COALESCE((raw_vat_id)::text, ''::text)) || '|'::text) || COALESCE((raw_currency_id)::text, ''::text)))) STORED,
    quote_id uuid,
    CONSTRAINT product_suggestions_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['shop_order'::character varying, 'order'::character varying])::text[]))),
    CONSTRAINT product_suggestions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: production_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_name character varying(255) NOT NULL,
    comment text,
    usage_limit_per_day integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: purchase_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number character varying(50) DEFAULT public.generate_purchase_order_number() NOT NULL,
    partner_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    source_type character varying(30) DEFAULT 'stock_replenishment'::character varying NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_date date,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    note text,
    CONSTRAINT purchase_orders_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['stock_replenishment'::character varying, 'customer_order'::character varying])::text[]))),
    CONSTRAINT purchase_orders_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'confirmed'::character varying, 'partial'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: quote_accessories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_accessories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    accessory_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    accessory_name character varying(255) NOT NULL,
    sku character varying(255) NOT NULL,
    unit_price_net numeric(12,2) NOT NULL,
    vat_rate numeric(5,4) NOT NULL,
    unit_id uuid NOT NULL,
    unit_name character varying(100) NOT NULL,
    currency_id uuid NOT NULL,
    total_net numeric(12,2) NOT NULL,
    total_vat numeric(12,2) NOT NULL,
    total_gross numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38 NOT NULL,
    product_suggestion_id uuid,
    CONSTRAINT chk_quote_accessories_base_price_positive CHECK ((base_price >= 0)),
    CONSTRAINT chk_quote_accessories_multiplier_range CHECK (((multiplier >= 1.00) AND (multiplier <= 5.00))),
    CONSTRAINT chk_quote_accessories_real_or_snapshot CHECK (((accessory_id IS NOT NULL) OR ((accessory_name IS NOT NULL) AND (sku IS NOT NULL) AND (base_price IS NOT NULL) AND (multiplier IS NOT NULL) AND (unit_id IS NOT NULL) AND (unit_name IS NOT NULL) AND (currency_id IS NOT NULL) AND (vat_rate IS NOT NULL) AND (unit_price_net IS NOT NULL) AND (total_net IS NOT NULL) AND (total_vat IS NOT NULL) AND (total_gross IS NOT NULL)))),
    CONSTRAINT quote_accessories_quantity_check CHECK ((quantity > 0))
);


--
-- Name: TABLE quote_accessories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quote_accessories IS 'Junction table linking quotes to accessories with quantity and snapshot pricing';


--
-- Name: COLUMN quote_accessories.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.quantity IS 'Number of units of this accessory';


--
-- Name: COLUMN quote_accessories.unit_price_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.unit_price_net IS 'Snapshot of net price per unit at time of adding';


--
-- Name: COLUMN quote_accessories.total_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.total_net IS 'Calculated: unit_price_net × quantity';


--
-- Name: COLUMN quote_accessories.base_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.base_price IS 'Base price component for calculating net price (base_price × multiplier)';


--
-- Name: COLUMN quote_accessories.multiplier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_accessories.multiplier IS 'Multiplier component for calculating net price (base_price × multiplier)';


--
-- Name: quote_edge_materials_breakdown; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_edge_materials_breakdown (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_materials_pricing_id uuid NOT NULL,
    edge_material_id uuid NOT NULL,
    edge_material_name character varying(255) NOT NULL,
    total_length_m numeric(10,2) NOT NULL,
    price_per_m numeric(10,2) NOT NULL,
    net_price numeric(12,2) NOT NULL,
    vat_amount numeric(12,2) NOT NULL,
    gross_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    feetype_id uuid NOT NULL,
    fee_name character varying(255) NOT NULL,
    unit_price_net numeric(12,2) NOT NULL,
    vat_rate numeric(5,4) NOT NULL,
    vat_amount numeric(12,2) NOT NULL,
    gross_price numeric(12,2) NOT NULL,
    currency_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    quantity integer DEFAULT 1 NOT NULL,
    comment text,
    CONSTRAINT quote_fees_quantity_check CHECK ((quantity > 0))
);


--
-- Name: TABLE quote_fees; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quote_fees IS 'Junction table linking quotes to fees with snapshot pricing';


--
-- Name: COLUMN quote_fees.unit_price_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_fees.unit_price_net IS 'Net price per unit (can be negative for discounts/adjustments)';


--
-- Name: COLUMN quote_fees.vat_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_fees.vat_rate IS 'Snapshot of VAT rate at time of adding';


--
-- Name: COLUMN quote_fees.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_fees.quantity IS 'Quantity of this fee (multiplies unit price)';


--
-- Name: COLUMN quote_fees.comment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_fees.comment IS 'Optional per-quote comment for this fee';


--
-- Name: quote_materials_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_materials_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    material_id uuid NOT NULL,
    material_name character varying(255) NOT NULL,
    board_width_mm integer NOT NULL,
    board_length_mm integer NOT NULL,
    thickness_mm integer NOT NULL,
    grain_direction boolean NOT NULL,
    on_stock boolean NOT NULL,
    boards_used integer NOT NULL,
    usage_percentage numeric(5,2) NOT NULL,
    pricing_method character varying(20) NOT NULL,
    charged_sqm numeric(10,4),
    price_per_sqm numeric(10,2) NOT NULL,
    vat_rate numeric(5,4) NOT NULL,
    currency character varying(10) NOT NULL,
    usage_limit numeric(5,4) NOT NULL,
    waste_multi numeric(5,2) NOT NULL,
    material_net numeric(12,2) NOT NULL,
    material_vat numeric(12,2) NOT NULL,
    material_gross numeric(12,2) NOT NULL,
    edge_materials_net numeric(12,2) DEFAULT 0 NOT NULL,
    edge_materials_vat numeric(12,2) DEFAULT 0 NOT NULL,
    edge_materials_gross numeric(12,2) DEFAULT 0 NOT NULL,
    cutting_length_m numeric(10,2) NOT NULL,
    cutting_net numeric(12,2) DEFAULT 0 NOT NULL,
    cutting_vat numeric(12,2) DEFAULT 0 NOT NULL,
    cutting_gross numeric(12,2) DEFAULT 0 NOT NULL,
    services_net numeric(12,2) DEFAULT 0 NOT NULL,
    services_vat numeric(12,2) DEFAULT 0 NOT NULL,
    services_gross numeric(12,2) DEFAULT 0 NOT NULL,
    total_net numeric(12,2) NOT NULL,
    total_vat numeric(12,2) NOT NULL,
    total_gross numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_panels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_panels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    material_id uuid NOT NULL,
    width_mm integer NOT NULL,
    height_mm integer NOT NULL,
    quantity integer NOT NULL,
    label character varying(255),
    edge_material_a_id uuid,
    edge_material_b_id uuid,
    edge_material_c_id uuid,
    edge_material_d_id uuid,
    panthelyfuras_quantity integer DEFAULT 0 NOT NULL,
    panthelyfuras_oldal character varying(50),
    duplungolas boolean DEFAULT false NOT NULL,
    szogvagas boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method text NOT NULL,
    comment text,
    payment_date timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    deleted_at timestamp without time zone
);


--
-- Name: TABLE quote_payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quote_payments IS 'Payment transactions for orders - supports multiple payments and refunds';


--
-- Name: COLUMN quote_payments.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_payments.amount IS 'Payment amount - positive for payments, negative for refunds';


--
-- Name: COLUMN quote_payments.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quote_payments.payment_method IS 'Payment method: cash, transfer, card';


--
-- Name: quote_services_breakdown; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_services_breakdown (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_materials_pricing_id uuid NOT NULL,
    service_type character varying(50) NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    net_price numeric(12,2) NOT NULL,
    vat_amount numeric(12,2) NOT NULL,
    gross_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    quote_number character varying(50) NOT NULL,
    status public.quote_status DEFAULT 'draft'::public.quote_status NOT NULL,
    total_net numeric(12,2) NOT NULL,
    total_vat numeric(12,2) NOT NULL,
    total_gross numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    final_total_after_discount numeric(12,2) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    fees_total_net numeric(12,2) DEFAULT 0,
    fees_total_vat numeric(12,2) DEFAULT 0,
    fees_total_gross numeric(12,2) DEFAULT 0,
    accessories_total_net numeric(12,2) DEFAULT 0,
    accessories_total_vat numeric(12,2) DEFAULT 0,
    accessories_total_gross numeric(12,2) DEFAULT 0,
    order_number text,
    barcode text,
    production_machine_id uuid,
    production_date date,
    payment_status text DEFAULT 'not_paid'::text,
    source character varying(20) DEFAULT 'internal'::character varying,
    comment text,
    payment_method_id uuid,
    ordered_at timestamp with time zone,
    in_production_at timestamp with time zone,
    ready_at timestamp with time zone,
    finished_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    ready_notification_sent_at timestamp with time zone,
    last_storage_reminder_sent_at timestamp with time zone
);


--
-- Name: COLUMN quotes.fees_total_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.fees_total_net IS 'Sum of all fees net prices';


--
-- Name: COLUMN quotes.fees_total_vat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.fees_total_vat IS 'Sum of all fees VAT amounts';


--
-- Name: COLUMN quotes.fees_total_gross; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.fees_total_gross IS 'Sum of all fees gross prices';


--
-- Name: COLUMN quotes.accessories_total_net; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.accessories_total_net IS 'Sum of all accessories total net prices';


--
-- Name: COLUMN quotes.accessories_total_vat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.accessories_total_vat IS 'Sum of all accessories total VAT amounts';


--
-- Name: COLUMN quotes.accessories_total_gross; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.accessories_total_gross IS 'Sum of all accessories total gross prices';


--
-- Name: COLUMN quotes.order_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.order_number IS 'Generated when quote becomes an order: ORD-YYYY-MM-DD-NNN';


--
-- Name: COLUMN quotes.barcode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.barcode IS 'Production tracking barcode';


--
-- Name: COLUMN quotes.production_machine_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.production_machine_id IS 'Machine assigned for production';


--
-- Name: COLUMN quotes.production_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.production_date IS 'Scheduled production date';


--
-- Name: COLUMN quotes.payment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.payment_status IS 'Auto-calculated: not_paid, partial, paid';


--
-- Name: COLUMN quotes.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.source IS 'Source of quote: internal (created by company) or customer_portal (submitted by customer)';


--
-- Name: COLUMN quotes.comment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.comment IS 'Internal comment/note for the quote or order (max 250 characters enforced in app)';


--
-- Name: COLUMN quotes.payment_method_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.payment_method_id IS 'Selected payment method (NULL for admin quotes, populated for customer portal quotes)';


--
-- Name: COLUMN quotes.ordered_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.ordered_at IS 'Timestamp when quote status changed to ordered. Used for analytics and lead time calculations.';


--
-- Name: COLUMN quotes.in_production_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.in_production_at IS 'Timestamp when quote status changed to in_production. Used for production time tracking.';


--
-- Name: COLUMN quotes.ready_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.ready_at IS 'Timestamp when quote status changed to ready. Used for completion time analytics.';


--
-- Name: COLUMN quotes.finished_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.finished_at IS 'Timestamp when quote status changed to finished (handed over to customer). Used for delivery time tracking.';


--
-- Name: COLUMN quotes.cancelled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.cancelled_at IS 'Timestamp when quote status changed to cancelled. Used for cancellation analytics.';


--
-- Name: COLUMN quotes.ready_notification_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.ready_notification_sent_at IS 'Timestamp when "Készre jelentés" SMS was sent to customer. NULL if SMS not sent or customer has SMS disabled. Set when order becomes ready and SMS is successfully sent.';


--
-- Name: COLUMN quotes.last_storage_reminder_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.quotes.last_storage_reminder_sent_at IS 'Timestamp when last "Tárolás figyelmeztetés" SMS was sent to customer. NULL if no reminder sent yet. Updated each time a storage reminder is sent (tracks only the most recent reminder).';


--
-- Name: shipment_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipment_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_name character varying(255) NOT NULL,
    sku character varying(100),
    type character varying(100),
    base_price integer NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.38,
    quantity numeric(10,2) NOT NULL,
    units_id uuid,
    partner_id uuid,
    vat_id uuid,
    currency_id uuid,
    megjegyzes text,
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    product_type character varying(30),
    accessory_id uuid,
    material_id uuid,
    linear_material_id uuid,
    CONSTRAINT shop_order_items_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('ordered'::character varying)::text, ('arrived'::character varying)::text, ('handed_over'::character varying)::text, ('deleted'::character varying)::text])))
);


--
-- Name: COLUMN shop_order_items.quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shop_order_items.quantity IS 'Quantity with support for 2 decimal places (e.g., 2.50, 1.75)';


--
-- Name: shop_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shop_order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number character varying(50) NOT NULL,
    worker_id uuid NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_mobile character varying(50),
    customer_discount numeric(5,2) DEFAULT 0,
    billing_name character varying(255),
    billing_country character varying(100),
    billing_city character varying(100),
    billing_postal_code character varying(20),
    billing_street character varying(255),
    billing_house_number character varying(20),
    billing_tax_number character varying(50),
    billing_company_reg_number character varying(50),
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    sms_sent_at timestamp with time zone,
    CONSTRAINT shop_orders_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('ordered'::character varying)::text, ('arrived'::character varying)::text, ('finished'::character varying)::text, ('handed_over'::character varying)::text, ('deleted'::character varying)::text])))
);


--
-- Name: COLUMN shop_orders.sms_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shop_orders.sms_sent_at IS 'Timestamp when Beszerzés SMS notification was sent to customer. NULL if SMS not sent yet or customer has SMS disabled.';


--
-- Name: CONSTRAINT shop_orders_status_check ON shop_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT shop_orders_status_check ON public.shop_orders IS 'Valid statuses: open, ordered, arrived (partial delivery), finished (all arrived), handed_over (delivered to customer), deleted';


--
-- Name: sms_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_template text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template_name character varying(100) NOT NULL
);


--
-- Name: TABLE sms_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sms_settings IS 'Stores customizable SMS notification message templates. Templates: "Készre jelentés" (order ready), "Tárolás figyelmeztetés" (storage warning), "Beszerzés" (procurement complete)';


--
-- Name: COLUMN sms_settings.message_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_settings.message_template IS 'SMS message template with placeholders: {customer_name}, {order_number}, {company_name}, {material_name}';


--
-- Name: COLUMN sms_settings.template_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sms_settings.template_name IS 'Name of the SMS template (e.g., "Készre jelentés", "Tárolás figyelmeztetés")';


--
-- Name: stock_movement_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_movement_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_company (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    country character varying,
    postal_code character varying,
    city character varying,
    address character varying,
    phone_number character varying,
    email character varying,
    website character varying,
    tax_number character varying,
    company_registration_number character varying,
    vat_id character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    shortform character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    page_id uuid NOT NULL,
    can_access boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_pins (
    user_id uuid NOT NULL,
    pin character varying(6) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    is_active boolean DEFAULT true,
    failed_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    worker_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_sign_in_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: vat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vat (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    kulcs numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    mobile character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    nickname character varying(100),
    color character varying(7) DEFAULT '#1976d2'::character varying
);


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: accessories accessories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: cutting_fees cutting_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cutting_fees
    ADD CONSTRAINT cutting_fees_pkey PRIMARY KEY (id);


--
-- Name: edge_materials edge_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edge_materials
    ADD CONSTRAINT edge_materials_pkey PRIMARY KEY (id);


--
-- Name: feetypes feetypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feetypes
    ADD CONSTRAINT feetypes_pkey PRIMARY KEY (id);


--
-- Name: linear_material_price_history linear_material_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_pkey PRIMARY KEY (id);


--
-- Name: linear_materials linear_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_pkey PRIMARY KEY (id);


--
-- Name: machine_edge_material_map machine_edge_material_map_edge_material_id_machine_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_edge_material_map
    ADD CONSTRAINT machine_edge_material_map_edge_material_id_machine_type_key UNIQUE (edge_material_id, machine_type);


--
-- Name: machine_edge_material_map machine_edge_material_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_edge_material_map
    ADD CONSTRAINT machine_edge_material_map_pkey PRIMARY KEY (id);


--
-- Name: machine_linear_material_map machine_linear_material_map_linear_material_id_machine_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_linear_material_map
    ADD CONSTRAINT machine_linear_material_map_linear_material_id_machine_type_key UNIQUE (linear_material_id, machine_type);


--
-- Name: machine_linear_material_map machine_linear_material_map_machine_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_linear_material_map
    ADD CONSTRAINT machine_linear_material_map_machine_code_key UNIQUE (machine_code);


--
-- Name: machine_linear_material_map machine_linear_material_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_linear_material_map
    ADD CONSTRAINT machine_linear_material_map_pkey PRIMARY KEY (id);


--
-- Name: machine_material_map machine_material_map_material_id_machine_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_material_map
    ADD CONSTRAINT machine_material_map_material_id_machine_type_key UNIQUE (material_id, machine_type);


--
-- Name: machine_material_map machine_material_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_material_map
    ADD CONSTRAINT machine_material_map_pkey PRIMARY KEY (id);


--
-- Name: material_audit material_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_audit
    ADD CONSTRAINT material_audit_pkey PRIMARY KEY (id);


--
-- Name: material_group_settings material_group_settings_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_settings
    ADD CONSTRAINT material_group_settings_group_id_key UNIQUE (group_id);


--
-- Name: material_group_settings material_group_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_settings
    ADD CONSTRAINT material_group_settings_pkey PRIMARY KEY (id);


--
-- Name: material_groups material_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_groups
    ADD CONSTRAINT material_groups_name_key UNIQUE (name);


--
-- Name: material_groups material_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_groups
    ADD CONSTRAINT material_groups_pkey PRIMARY KEY (id);


--
-- Name: material_inventory_transactions material_inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_inventory_transactions
    ADD CONSTRAINT material_inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: material_price_history material_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_price_history
    ADD CONSTRAINT material_price_history_pkey PRIMARY KEY (id);


--
-- Name: material_settings material_settings_material_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_settings
    ADD CONSTRAINT material_settings_material_id_key UNIQUE (material_id);


--
-- Name: material_settings material_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_settings
    ADD CONSTRAINT material_settings_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_stored_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_stored_filename_key UNIQUE (stored_filename);


--
-- Name: quote_payments order_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payments
    ADD CONSTRAINT order_payments_pkey PRIMARY KEY (id);


--
-- Name: pages pages_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_path_key UNIQUE (path);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_name_key UNIQUE (name);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: pos_order_items pos_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_pkey PRIMARY KEY (id);


--
-- Name: pos_orders pos_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_orders
    ADD CONSTRAINT pos_orders_pkey PRIMARY KEY (id);


--
-- Name: pos_orders pos_orders_pos_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_orders
    ADD CONSTRAINT pos_orders_pos_order_number_key UNIQUE (pos_order_number);


--
-- Name: pos_payments pos_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_payments
    ADD CONSTRAINT pos_payments_pkey PRIMARY KEY (id);


--
-- Name: product_suggestions product_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_pkey PRIMARY KEY (id);


--
-- Name: production_machines production_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_machines
    ADD CONSTRAINT production_machines_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: quote_accessories quote_accessories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_pkey PRIMARY KEY (id);


--
-- Name: quote_edge_materials_breakdown quote_edge_materials_breakdown_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_edge_materials_breakdown
    ADD CONSTRAINT quote_edge_materials_breakdown_pkey PRIMARY KEY (id);


--
-- Name: quote_fees quote_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_fees
    ADD CONSTRAINT quote_fees_pkey PRIMARY KEY (id);


--
-- Name: quote_materials_pricing quote_materials_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_materials_pricing
    ADD CONSTRAINT quote_materials_pricing_pkey PRIMARY KEY (id);


--
-- Name: quote_panels quote_panels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_pkey PRIMARY KEY (id);


--
-- Name: quote_services_breakdown quote_services_breakdown_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_services_breakdown
    ADD CONSTRAINT quote_services_breakdown_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_barcode_key UNIQUE (barcode);


--
-- Name: quotes quotes_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_order_number_key UNIQUE (order_number);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);


--
-- Name: shipment_items shipment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_shipment_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_shipment_number_unique UNIQUE (shipment_number);


--
-- Name: shop_order_items shop_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_pkey PRIMARY KEY (id);


--
-- Name: shop_orders shop_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_order_number_key UNIQUE (order_number);


--
-- Name: shop_orders shop_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_pkey PRIMARY KEY (id);


--
-- Name: sms_settings sms_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_settings
    ADD CONSTRAINT sms_settings_pkey PRIMARY KEY (id);


--
-- Name: sms_settings sms_settings_template_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_settings
    ADD CONSTRAINT sms_settings_template_name_unique UNIQUE (template_name);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: tenant_company tenant_company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_company
    ADD CONSTRAINT tenant_company_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_page_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_page_unique UNIQUE (user_id, page_id);


--
-- Name: user_pins user_pins_pin_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pins
    ADD CONSTRAINT user_pins_pin_key UNIQUE (pin);


--
-- Name: user_pins user_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pins
    ADD CONSTRAINT user_pins_pkey PRIMARY KEY (user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vat vat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vat
    ADD CONSTRAINT vat_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: workers workers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT workers_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: accessories_sku_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX accessories_sku_unique_active ON public.accessories USING btree (sku) WHERE (deleted_at IS NULL);


--
-- Name: brands_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX brands_name_unique_active ON public.brands USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: currencies_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX currencies_name_unique_active ON public.currencies USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: customers_email_unique_not_null; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_email_unique_not_null ON public.customers USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: customers_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_name_unique_active ON public.customers USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: feetypes_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX feetypes_name_unique_active ON public.feetypes USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_barcode_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_barcode_active ON public.accessories USING btree (barcode) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_base_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_base_price ON public.accessories USING btree (base_price);


--
-- Name: idx_accessories_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_currency_id ON public.accessories USING btree (currency_id);


--
-- Name: idx_accessories_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_deleted_at ON public.accessories USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_multiplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_multiplier ON public.accessories USING btree (multiplier);


--
-- Name: idx_accessories_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_name_active ON public.accessories USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_partners_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_partners_id ON public.accessories USING btree (partners_id);


--
-- Name: idx_accessories_sku_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_sku_active ON public.accessories USING btree (sku) WHERE (deleted_at IS NULL);


--
-- Name: idx_accessories_units_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_units_id ON public.accessories USING btree (units_id);


--
-- Name: idx_accessories_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accessories_vat_id ON public.accessories USING btree (vat_id);


--
-- Name: idx_brands_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_active_ordered ON public.brands USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_brands_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_name_active ON public.brands USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_currencies_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_currencies_active_ordered ON public.currencies USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_currencies_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_currencies_name_active ON public.currencies USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_active_ordered ON public.customers USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email_active ON public.customers USING btree (email) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_name_active ON public.customers USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_sms_notification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_sms_notification ON public.customers USING btree (sms_notification) WHERE (deleted_at IS NULL);


--
-- Name: idx_cutting_fees_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cutting_fees_currency_id ON public.cutting_fees USING btree (currency_id);


--
-- Name: idx_cutting_fees_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cutting_fees_vat_id ON public.cutting_fees USING btree (vat_id);


--
-- Name: idx_edge_materials_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_active ON public.edge_materials USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_active_only; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_active_only ON public.edge_materials USING btree (active) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_active_ordered ON public.edge_materials USING btree (deleted_at, type) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_active_type_decor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_active_type_decor ON public.edge_materials USING btree (deleted_at, type, decor) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_brand_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_brand_active ON public.edge_materials USING btree (brand_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_brand_id ON public.edge_materials USING btree (brand_id);


--
-- Name: idx_edge_materials_decor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_decor ON public.edge_materials USING btree (decor);


--
-- Name: idx_edge_materials_dimensions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_dimensions_active ON public.edge_materials USING btree (thickness, width, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_favourite_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_favourite_priority ON public.edge_materials USING btree (favourite_priority) WHERE ((deleted_at IS NULL) AND (favourite_priority IS NOT NULL));


--
-- Name: idx_edge_materials_price_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_price_active ON public.edge_materials USING btree (price, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_type ON public.edge_materials USING btree (type);


--
-- Name: idx_edge_materials_unique_fields; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_unique_fields ON public.edge_materials USING btree (brand_id, type, thickness, width, decor, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_vat_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_vat_active ON public.edge_materials USING btree (vat_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_edge_materials_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edge_materials_vat_id ON public.edge_materials USING btree (vat_id);


--
-- Name: idx_feetypes_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feetypes_currency_id ON public.feetypes USING btree (currency_id);


--
-- Name: idx_feetypes_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feetypes_deleted_at ON public.feetypes USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_feetypes_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feetypes_name_active ON public.feetypes USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_feetypes_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feetypes_vat_id ON public.feetypes USING btree (vat_id);


--
-- Name: idx_linear_materials_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_active ON public.linear_materials USING btree (active) WHERE (deleted_at IS NULL);


--
-- Name: idx_linear_materials_base_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_base_price ON public.linear_materials USING btree (base_price);


--
-- Name: idx_linear_materials_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_brand_id ON public.linear_materials USING btree (brand_id);


--
-- Name: idx_linear_materials_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_currency_id ON public.linear_materials USING btree (currency_id);


--
-- Name: idx_linear_materials_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_deleted_at ON public.linear_materials USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_linear_materials_multiplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_multiplier ON public.linear_materials USING btree (multiplier);


--
-- Name: idx_linear_materials_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_name ON public.linear_materials USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_linear_materials_on_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_on_stock ON public.linear_materials USING btree (on_stock) WHERE (deleted_at IS NULL);


--
-- Name: idx_linear_materials_partners_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_partners_id ON public.linear_materials USING btree (partners_id);


--
-- Name: idx_linear_materials_units_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_units_id ON public.linear_materials USING btree (units_id);


--
-- Name: idx_linear_materials_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_materials_vat_id ON public.linear_materials USING btree (vat_id);


--
-- Name: idx_linear_price_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_price_history_changed_at ON public.linear_material_price_history USING btree (changed_at DESC);


--
-- Name: idx_linear_price_history_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linear_price_history_material_id ON public.linear_material_price_history USING btree (linear_material_id);


--
-- Name: idx_machine_edge_material_map_edge_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_edge_material_map_edge_material_id ON public.machine_edge_material_map USING btree (edge_material_id);


--
-- Name: idx_machine_edge_material_map_machine_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_edge_material_map_machine_code ON public.machine_edge_material_map USING btree (machine_code);


--
-- Name: idx_machine_edge_material_map_machine_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_edge_material_map_machine_type ON public.machine_edge_material_map USING btree (machine_type);


--
-- Name: idx_machine_linear_material_map_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_linear_material_map_code ON public.machine_linear_material_map USING btree (machine_code);


--
-- Name: idx_machine_linear_material_map_linear_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_linear_material_map_linear_id ON public.machine_linear_material_map USING btree (linear_material_id);


--
-- Name: idx_material_price_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_price_history_changed_at ON public.material_price_history USING btree (changed_at DESC);


--
-- Name: idx_material_price_history_changed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_price_history_changed_by ON public.material_price_history USING btree (changed_by);


--
-- Name: idx_material_price_history_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_price_history_material_id ON public.material_price_history USING btree (material_id);


--
-- Name: idx_materials_base_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_base_price ON public.materials USING btree (base_price);


--
-- Name: idx_materials_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_brand_id ON public.materials USING btree (brand_id);


--
-- Name: idx_materials_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_currency_id ON public.materials USING btree (currency_id);


--
-- Name: idx_materials_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_group_id ON public.materials USING btree (group_id);


--
-- Name: idx_materials_multiplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_multiplier ON public.materials USING btree (multiplier);


--
-- Name: idx_materials_partners_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_partners_id ON public.materials USING btree (partners_id);


--
-- Name: idx_materials_units_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_units_id ON public.materials USING btree (units_id);


--
-- Name: idx_materials_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_vat_id ON public.materials USING btree (vat_id);


--
-- Name: idx_media_files_original_filename; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_original_filename ON public.media_files USING btree (original_filename);


--
-- Name: idx_media_files_stored_filename; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_stored_filename ON public.media_files USING btree (stored_filename);


--
-- Name: idx_media_files_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_files_uploaded_by ON public.media_files USING btree (uploaded_by);


--
-- Name: idx_mit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_created_at ON public.material_inventory_transactions USING btree (created_at DESC);


--
-- Name: idx_mit_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_material_id ON public.material_inventory_transactions USING btree (material_id);


--
-- Name: idx_mit_material_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_material_type ON public.material_inventory_transactions USING btree (material_id, transaction_type);


--
-- Name: idx_mit_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_reference ON public.material_inventory_transactions USING btree (reference_type, reference_id);


--
-- Name: idx_mit_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_sku ON public.material_inventory_transactions USING btree (sku);


--
-- Name: idx_mit_transaction_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mit_transaction_type ON public.material_inventory_transactions USING btree (transaction_type);


--
-- Name: idx_order_payments_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payments_deleted_at ON public.quote_payments USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_order_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payments_order_id ON public.quote_payments USING btree (quote_id);


--
-- Name: idx_order_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payments_payment_date ON public.quote_payments USING btree (payment_date DESC);


--
-- Name: idx_pages_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_active ON public.pages USING btree (is_active);


--
-- Name: idx_pages_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_path ON public.pages USING btree (path);


--
-- Name: idx_pages_path_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_path_active ON public.pages USING btree (path, is_active);


--
-- Name: idx_partners_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_active_ordered ON public.partners USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_partners_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_currency_id ON public.partners USING btree (currency_id);


--
-- Name: idx_partners_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_email_active ON public.partners USING btree (email) WHERE (deleted_at IS NULL);


--
-- Name: idx_partners_status_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_status_active ON public.partners USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_partners_vat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_vat_id ON public.partners USING btree (vat_id);


--
-- Name: idx_payment_methods_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_active ON public.payment_methods USING btree (active) WHERE (deleted_at IS NULL);


--
-- Name: idx_payment_methods_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_deleted_at ON public.payment_methods USING btree (deleted_at);


--
-- Name: idx_payment_methods_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_name ON public.payment_methods USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_pos_order_items_accessory_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_accessory_id ON public.pos_order_items USING btree (accessory_id);


--
-- Name: idx_pos_order_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_deleted_at ON public.pos_order_items USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_pos_order_items_item_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_item_type ON public.pos_order_items USING btree (item_type);


--
-- Name: idx_pos_order_items_linear_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_linear_material_id ON public.pos_order_items USING btree (linear_material_id);


--
-- Name: idx_pos_order_items_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_material_id ON public.pos_order_items USING btree (material_id);


--
-- Name: idx_pos_order_items_pos_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_pos_order_id ON public.pos_order_items USING btree (pos_order_id);


--
-- Name: idx_pos_order_items_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_order_items_product_type ON public.pos_order_items USING btree (product_type);


--
-- Name: idx_pos_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_orders_created_at ON public.pos_orders USING btree (created_at);


--
-- Name: idx_pos_orders_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_orders_deleted_at ON public.pos_orders USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_pos_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_orders_status ON public.pos_orders USING btree (status);


--
-- Name: idx_pos_orders_worker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_orders_worker_id ON public.pos_orders USING btree (worker_id);


--
-- Name: idx_pos_payments_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_payments_deleted_at ON public.pos_payments USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_pos_payments_payment_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_payments_payment_type ON public.pos_payments USING btree (payment_type);


--
-- Name: idx_pos_payments_pos_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_payments_pos_order_id ON public.pos_payments USING btree (pos_order_id);


--
-- Name: idx_pos_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_payments_status ON public.pos_payments USING btree (status);


--
-- Name: idx_product_suggestions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_suggestions_created_at ON public.product_suggestions USING btree (created_at);


--
-- Name: idx_product_suggestions_shop_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_suggestions_shop_item ON public.product_suggestions USING btree (shop_order_item_id);


--
-- Name: idx_product_suggestions_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_suggestions_status_created ON public.product_suggestions USING btree (status, created_at DESC);


--
-- Name: idx_production_machines_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_machines_deleted_at ON public.production_machines USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_production_machines_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_machines_name_active ON public.production_machines USING btree (machine_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_purchase_order_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_deleted_at ON public.purchase_order_items USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_purchase_order_items_po_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_po_id ON public.purchase_order_items USING btree (purchase_order_id);


--
-- Name: idx_purchase_order_items_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_product_type ON public.purchase_order_items USING btree (product_type);


--
-- Name: idx_purchase_order_items_shop_order_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_shop_order_item_id ON public.purchase_order_items USING btree (shop_order_item_id);


--
-- Name: idx_purchase_orders_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_deleted_at ON public.purchase_orders USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_purchase_orders_order_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_order_date ON public.purchase_orders USING btree (order_date);


--
-- Name: idx_purchase_orders_partner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_partner_id ON public.purchase_orders USING btree (partner_id);


--
-- Name: idx_purchase_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_status ON public.purchase_orders USING btree (status);


--
-- Name: idx_purchase_orders_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_warehouse_id ON public.purchase_orders USING btree (warehouse_id);


--
-- Name: idx_qemb_edge_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qemb_edge_material_id ON public.quote_edge_materials_breakdown USING btree (edge_material_id);


--
-- Name: idx_qemb_pricing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qemb_pricing_id ON public.quote_edge_materials_breakdown USING btree (quote_materials_pricing_id);


--
-- Name: idx_qmp_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qmp_material_id ON public.quote_materials_pricing USING btree (material_id);


--
-- Name: idx_qmp_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qmp_quote_id ON public.quote_materials_pricing USING btree (quote_id);


--
-- Name: idx_qsb_pricing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qsb_pricing_id ON public.quote_services_breakdown USING btree (quote_materials_pricing_id);


--
-- Name: idx_qsb_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qsb_service_type ON public.quote_services_breakdown USING btree (service_type);


--
-- Name: idx_quote_accessories_accessory_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_accessory_id ON public.quote_accessories USING btree (accessory_id);


--
-- Name: idx_quote_accessories_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_currency_id ON public.quote_accessories USING btree (currency_id);


--
-- Name: idx_quote_accessories_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_deleted_at ON public.quote_accessories USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_accessories_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_quote_id ON public.quote_accessories USING btree (quote_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_accessories_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_accessories_unit_id ON public.quote_accessories USING btree (unit_id);


--
-- Name: idx_quote_edge_materials_breakdown_pricing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_edge_materials_breakdown_pricing_id ON public.quote_edge_materials_breakdown USING btree (quote_materials_pricing_id);


--
-- Name: idx_quote_fees_currency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_fees_currency_id ON public.quote_fees USING btree (currency_id);


--
-- Name: idx_quote_fees_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_fees_deleted_at ON public.quote_fees USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_fees_feetype_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_fees_feetype_id ON public.quote_fees USING btree (feetype_id);


--
-- Name: idx_quote_fees_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_fees_quote_id ON public.quote_fees USING btree (quote_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_materials_pricing_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_materials_pricing_quote_id ON public.quote_materials_pricing USING btree (quote_id);


--
-- Name: idx_quote_panels_edge_material_a_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_edge_material_a_id ON public.quote_panels USING btree (edge_material_a_id);


--
-- Name: idx_quote_panels_edge_material_b_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_edge_material_b_id ON public.quote_panels USING btree (edge_material_b_id);


--
-- Name: idx_quote_panels_edge_material_c_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_edge_material_c_id ON public.quote_panels USING btree (edge_material_c_id);


--
-- Name: idx_quote_panels_edge_material_d_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_edge_material_d_id ON public.quote_panels USING btree (edge_material_d_id);


--
-- Name: idx_quote_panels_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_material_id ON public.quote_panels USING btree (material_id);


--
-- Name: idx_quote_panels_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_panels_quote_id ON public.quote_panels USING btree (quote_id);


--
-- Name: idx_quote_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_payments_payment_date ON public.quote_payments USING btree (payment_date DESC);


--
-- Name: idx_quote_payments_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_payments_quote_id ON public.quote_payments USING btree (quote_id);


--
-- Name: idx_quote_services_breakdown_pricing_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_services_breakdown_pricing_id ON public.quote_services_breakdown USING btree (quote_materials_pricing_id);


--
-- Name: idx_quotes_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_barcode ON public.quotes USING btree (barcode) WHERE (barcode IS NOT NULL);


--
-- Name: idx_quotes_cancelled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_cancelled_at ON public.quotes USING btree (cancelled_at) WHERE (cancelled_at IS NOT NULL);


--
-- Name: idx_quotes_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_comment ON public.quotes USING btree (comment) WHERE ((comment IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_quotes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_created_at ON public.quotes USING btree (created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_created_by ON public.quotes USING btree (created_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_customer_id ON public.quotes USING btree (customer_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_finished_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_finished_at ON public.quotes USING btree (finished_at) WHERE (finished_at IS NOT NULL);


--
-- Name: idx_quotes_in_production_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_in_production_at ON public.quotes USING btree (in_production_at) WHERE (in_production_at IS NOT NULL);


--
-- Name: idx_quotes_last_storage_reminder_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_last_storage_reminder_sent_at ON public.quotes USING btree (last_storage_reminder_sent_at) WHERE (last_storage_reminder_sent_at IS NOT NULL);


--
-- Name: idx_quotes_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_order_number ON public.quotes USING btree (order_number) WHERE (order_number IS NOT NULL);


--
-- Name: idx_quotes_ordered_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_ordered_at ON public.quotes USING btree (ordered_at) WHERE (ordered_at IS NOT NULL);


--
-- Name: idx_quotes_payment_method_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_payment_method_id ON public.quotes USING btree (payment_method_id) WHERE (payment_method_id IS NOT NULL);


--
-- Name: idx_quotes_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_payment_status ON public.quotes USING btree (payment_status);


--
-- Name: idx_quotes_production_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_production_date ON public.quotes USING btree (production_date) WHERE (production_date IS NOT NULL);


--
-- Name: idx_quotes_production_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_production_machine ON public.quotes USING btree (production_machine_id) WHERE (production_machine_id IS NOT NULL);


--
-- Name: idx_quotes_quote_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_quote_number ON public.quotes USING btree (quote_number) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_ready_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_ready_at ON public.quotes USING btree (ready_at) WHERE (ready_at IS NOT NULL);


--
-- Name: idx_quotes_ready_notification_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_ready_notification_sent_at ON public.quotes USING btree (ready_notification_sent_at) WHERE (ready_notification_sent_at IS NOT NULL);


--
-- Name: idx_quotes_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_source ON public.quotes USING btree (source) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_status ON public.quotes USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotes_status_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_status_ordered ON public.quotes USING btree (status) WHERE (status = ANY (ARRAY['ordered'::public.quote_status, 'in_production'::public.quote_status, 'ready'::public.quote_status, 'finished'::public.quote_status]));


--
-- Name: idx_shipment_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_items_deleted_at ON public.shipment_items USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_shipment_items_po_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_items_po_item_id ON public.shipment_items USING btree (purchase_order_item_id);


--
-- Name: idx_shipment_items_shipment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_items_shipment_id ON public.shipment_items USING btree (shipment_id);


--
-- Name: idx_shipments_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_deleted_at ON public.shipments USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_shipments_partner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_partner_id ON public.shipments USING btree (partner_id);


--
-- Name: idx_shipments_purchase_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_purchase_order_id ON public.shipments USING btree (purchase_order_id);


--
-- Name: idx_shipments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_status ON public.shipments USING btree (status);


--
-- Name: idx_shipments_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_warehouse_id ON public.shipments USING btree (warehouse_id);


--
-- Name: idx_shop_order_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_order_items_deleted_at ON public.shop_order_items USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_shop_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_order_items_order_id ON public.shop_order_items USING btree (order_id);


--
-- Name: idx_shop_order_items_partner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_order_items_partner_id ON public.shop_order_items USING btree (partner_id);


--
-- Name: idx_shop_order_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_order_items_status ON public.shop_order_items USING btree (status);


--
-- Name: idx_shop_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_created_at ON public.shop_orders USING btree (created_at);


--
-- Name: idx_shop_orders_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_deleted_at ON public.shop_orders USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_shop_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_order_number ON public.shop_orders USING btree (order_number);


--
-- Name: idx_shop_orders_sms_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_sms_sent_at ON public.shop_orders USING btree (sms_sent_at) WHERE (sms_sent_at IS NOT NULL);


--
-- Name: idx_shop_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_status ON public.shop_orders USING btree (status);


--
-- Name: idx_shop_orders_worker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shop_orders_worker_id ON public.shop_orders USING btree (worker_id);


--
-- Name: idx_sms_settings_template_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_settings_template_name ON public.sms_settings USING btree (template_name);


--
-- Name: idx_stock_movements_accessory_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_accessory_id ON public.stock_movements USING btree (accessory_id);


--
-- Name: idx_stock_movements_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_created_at ON public.stock_movements USING btree (created_at);


--
-- Name: idx_stock_movements_linear_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_linear_material_id ON public.stock_movements USING btree (linear_material_id);


--
-- Name: idx_stock_movements_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_material_id ON public.stock_movements USING btree (material_id);


--
-- Name: idx_stock_movements_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_product_type ON public.stock_movements USING btree (product_type);


--
-- Name: idx_stock_movements_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_source ON public.stock_movements USING btree (source_type, source_id);


--
-- Name: idx_stock_movements_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_warehouse ON public.stock_movements USING btree (warehouse_id);


--
-- Name: idx_tenant_company_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_company_name_active ON public.tenant_company USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_units_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_active_ordered ON public.units USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_units_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_name_active ON public.units USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_units_shortform_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_shortform_active ON public.units USING btree (shortform) WHERE (deleted_at IS NULL);


--
-- Name: idx_user_permissions_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_page_id ON public.user_permissions USING btree (page_id);


--
-- Name: idx_user_permissions_user_access; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_user_access ON public.user_permissions USING btree (user_id, can_access);


--
-- Name: idx_user_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: idx_user_pins_pin_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_pins_pin_active ON public.user_pins USING btree (pin) WHERE (is_active = true);


--
-- Name: idx_user_pins_worker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_pins_worker_id ON public.user_pins USING btree (worker_id);


--
-- Name: idx_users_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_vat_active_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vat_active_ordered ON public.vat USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_vat_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vat_name_active ON public.vat USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_workers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_active ON public.workers USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_workers_color; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_color ON public.workers USING btree (color);


--
-- Name: idx_workers_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_deleted_at ON public.workers USING btree (deleted_at);


--
-- Name: idx_workers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_name ON public.workers USING btree (name);


--
-- Name: idx_workers_nickname; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workers_nickname ON public.workers USING btree (nickname);


--
-- Name: ix_brands_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_brands_deleted_at ON public.brands USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_currencies_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_currencies_deleted_at ON public.currencies USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_customers_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customers_deleted_at ON public.customers USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_materials_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_materials_deleted_at ON public.materials USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_partners_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_partners_deleted_at ON public.partners USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_tenant_company_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_tenant_company_deleted_at ON public.tenant_company USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_units_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_units_deleted_at ON public.units USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: ix_vat_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_vat_deleted_at ON public.vat USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: materials_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX materials_name_unique_active ON public.materials USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: partners_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX partners_name_unique_active ON public.partners USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: production_machines_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX production_machines_name_unique_active ON public.production_machines USING btree (machine_name) WHERE (deleted_at IS NULL);


--
-- Name: tenant_company_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_company_name_unique_active ON public.tenant_company USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: units_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX units_name_unique_active ON public.units USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: uq_product_suggestions_item_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_suggestions_item_hash ON public.product_suggestions USING btree (shop_order_item_id, suggestion_hash);


--
-- Name: uq_stock_movements_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stock_movements_number ON public.stock_movements USING btree (stock_movement_number);


--
-- Name: uq_warehouses_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_warehouses_code ON public.warehouses USING btree (code);


--
-- Name: vat_name_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vat_name_unique_active ON public.vat USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_permissions();


--
-- Name: users sync_user_trigger; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER sync_user_trigger AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_from_auth();


--
-- Name: users trigger_grant_default_permissions; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER trigger_grant_default_permissions AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_default_permissions_to_new_user();


--
-- Name: media_files media_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER media_files_updated_at BEFORE UPDATE ON public.media_files FOR EACH ROW EXECUTE FUNCTION public.update_media_files_updated_at();


--
-- Name: pages on_public_page_created_or_activated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_public_page_created_or_activated AFTER INSERT OR UPDATE OF is_active ON public.pages FOR EACH ROW EXECUTE FUNCTION public.handle_new_page_permissions();


--
-- Name: accessories trigger_calculate_accessory_net_price; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_accessory_net_price BEFORE INSERT OR UPDATE ON public.accessories FOR EACH ROW EXECUTE FUNCTION public.calculate_accessory_net_price();


--
-- Name: linear_materials trigger_calculate_linear_materials_price_per_m; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_linear_materials_price_per_m BEFORE INSERT OR UPDATE ON public.linear_materials FOR EACH ROW EXECUTE FUNCTION public.calculate_linear_materials_price_per_m();


--
-- Name: materials trigger_calculate_materials_price_per_sqm; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_materials_price_per_sqm BEFORE INSERT OR UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.calculate_materials_price_per_sqm();


--
-- Name: quote_payments trigger_update_payment_status_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_payment_status_delete AFTER DELETE ON public.quote_payments FOR EACH ROW EXECUTE FUNCTION public.update_quote_payment_status();


--
-- Name: quote_payments trigger_update_payment_status_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_payment_status_insert AFTER INSERT ON public.quote_payments FOR EACH ROW EXECUTE FUNCTION public.update_quote_payment_status();


--
-- Name: quote_payments trigger_update_payment_status_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_payment_status_update AFTER UPDATE ON public.quote_payments FOR EACH ROW EXECUTE FUNCTION public.update_quote_payment_status();


--
-- Name: pos_order_items trigger_update_pos_order_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_pos_order_items_updated_at BEFORE UPDATE ON public.pos_order_items FOR EACH ROW EXECUTE FUNCTION public.update_pos_order_items_updated_at();


--
-- Name: pos_orders trigger_update_pos_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_pos_orders_updated_at BEFORE UPDATE ON public.pos_orders FOR EACH ROW EXECUTE FUNCTION public.update_pos_orders_updated_at();


--
-- Name: pos_payments trigger_update_pos_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_pos_payments_updated_at BEFORE UPDATE ON public.pos_payments FOR EACH ROW EXECUTE FUNCTION public.update_pos_payments_updated_at();


--
-- Name: purchase_order_items trigger_update_purchase_order_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_purchase_order_items_updated_at BEFORE UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchase_orders trigger_update_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quotes trigger_update_quote_status_timestamps; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_quote_status_timestamps BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_quote_status_timestamps();


--
-- Name: TRIGGER trigger_update_quote_status_timestamps ON quotes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trigger_update_quote_status_timestamps ON public.quotes IS 'Automatically records timestamp when quote status changes for analytics and reporting.';


--
-- Name: shipment_items trigger_update_shipment_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shipment_items_updated_at BEFORE UPDATE ON public.shipment_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shipments trigger_update_shipments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shop_order_items trigger_update_shop_order_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_shop_order_status AFTER INSERT OR DELETE OR UPDATE ON public.shop_order_items FOR EACH ROW EXECUTE FUNCTION public.update_shop_order_status();


--
-- Name: TRIGGER trigger_update_shop_order_status ON shop_order_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trigger_update_shop_order_status ON public.shop_order_items IS 'Updates parent shop_order status whenever items are inserted, updated, or deleted. Deleted items are ignored when determining if order is finished.';


--
-- Name: user_pins trigger_update_user_pins_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_user_pins_updated_at BEFORE UPDATE ON public.user_pins FOR EACH ROW EXECUTE FUNCTION public.update_user_pins_updated_at();


--
-- Name: accessories update_accessories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_accessories_updated_at BEFORE UPDATE ON public.accessories FOR EACH ROW EXECUTE FUNCTION public.update_accessories_updated_at();


--
-- Name: brands update_brands_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: currencies update_currencies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cutting_fees update_cutting_fees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cutting_fees_updated_at BEFORE UPDATE ON public.cutting_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: feetypes update_feetypes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_feetypes_updated_at BEFORE UPDATE ON public.feetypes FOR EACH ROW EXECUTE FUNCTION public.update_feetypes_updated_at();


--
-- Name: linear_materials update_linear_materials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_linear_materials_updated_at BEFORE UPDATE ON public.linear_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machine_linear_material_map update_machine_linear_material_map_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_machine_linear_material_map_updated_at BEFORE UPDATE ON public.machine_linear_material_map FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: material_group_settings update_material_group_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_material_group_settings_updated_at BEFORE UPDATE ON public.material_group_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: material_settings update_material_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_material_settings_updated_at BEFORE UPDATE ON public.material_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: materials update_materials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partners update_partners_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_methods update_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: production_machines update_production_machines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_production_machines_updated_at BEFORE UPDATE ON public.production_machines FOR EACH ROW EXECUTE FUNCTION public.update_production_machines_updated_at();


--
-- Name: quote_accessories update_quote_accessories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quote_accessories_updated_at BEFORE UPDATE ON public.quote_accessories FOR EACH ROW EXECUTE FUNCTION public.update_quote_accessories_updated_at();


--
-- Name: quote_fees update_quote_fees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quote_fees_updated_at BEFORE UPDATE ON public.quote_fees FOR EACH ROW EXECUTE FUNCTION public.update_quote_fees_updated_at();


--
-- Name: quotes update_quotes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sms_settings update_sms_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sms_settings_updated_at BEFORE UPDATE ON public.sms_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_company update_tenant_company_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_company_updated_at BEFORE UPDATE ON public.tenant_company FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: units update_units_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vat update_vat_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vat_updated_at BEFORE UPDATE ON public.vat FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: accessories accessories_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: accessories accessories_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: accessories accessories_partners_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: accessories accessories_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: accessories accessories_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accessories
    ADD CONSTRAINT accessories_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: cutting_fees cutting_fees_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cutting_fees
    ADD CONSTRAINT cutting_fees_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: cutting_fees cutting_fees_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cutting_fees
    ADD CONSTRAINT cutting_fees_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id);


--
-- Name: edge_materials edge_materials_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edge_materials
    ADD CONSTRAINT edge_materials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);


--
-- Name: edge_materials edge_materials_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edge_materials
    ADD CONSTRAINT edge_materials_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id);


--
-- Name: feetypes feetypes_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feetypes
    ADD CONSTRAINT feetypes_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: feetypes feetypes_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feetypes
    ADD CONSTRAINT feetypes_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: linear_material_price_history linear_material_price_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: linear_material_price_history linear_material_price_history_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE CASCADE;


--
-- Name: linear_material_price_history linear_material_price_history_new_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_new_currency_id_fkey FOREIGN KEY (new_currency_id) REFERENCES public.currencies(id);


--
-- Name: linear_material_price_history linear_material_price_history_new_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_new_vat_id_fkey FOREIGN KEY (new_vat_id) REFERENCES public.vat(id);


--
-- Name: linear_material_price_history linear_material_price_history_old_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_old_currency_id_fkey FOREIGN KEY (old_currency_id) REFERENCES public.currencies(id);


--
-- Name: linear_material_price_history linear_material_price_history_old_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_material_price_history
    ADD CONSTRAINT linear_material_price_history_old_vat_id_fkey FOREIGN KEY (old_vat_id) REFERENCES public.vat(id);


--
-- Name: linear_materials linear_materials_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE RESTRICT;


--
-- Name: linear_materials linear_materials_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: linear_materials linear_materials_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: linear_materials linear_materials_partners_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: linear_materials linear_materials_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: linear_materials linear_materials_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linear_materials
    ADD CONSTRAINT linear_materials_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: machine_edge_material_map machine_edge_material_map_edge_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_edge_material_map
    ADD CONSTRAINT machine_edge_material_map_edge_material_id_fkey FOREIGN KEY (edge_material_id) REFERENCES public.edge_materials(id) ON DELETE CASCADE;


--
-- Name: machine_linear_material_map machine_linear_material_map_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_linear_material_map
    ADD CONSTRAINT machine_linear_material_map_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE CASCADE;


--
-- Name: machine_material_map machine_material_map_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_material_map
    ADD CONSTRAINT machine_material_map_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: material_group_settings material_group_settings_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_group_settings
    ADD CONSTRAINT material_group_settings_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.material_groups(id);


--
-- Name: material_inventory_transactions material_inventory_transactions_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_inventory_transactions
    ADD CONSTRAINT material_inventory_transactions_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: material_price_history material_price_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_price_history
    ADD CONSTRAINT material_price_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: material_price_history material_price_history_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_price_history
    ADD CONSTRAINT material_price_history_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: material_settings material_settings_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_settings
    ADD CONSTRAINT material_settings_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: materials materials_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);


--
-- Name: materials materials_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: materials materials_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: materials materials_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.material_groups(id);


--
-- Name: materials materials_partners_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: materials materials_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: materials materials_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id);


--
-- Name: quote_payments order_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payments
    ADD CONSTRAINT order_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: partners partners_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: partners partners_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_feetype_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_feetype_id_fkey FOREIGN KEY (feetype_id) REFERENCES public.feetypes(id) ON DELETE SET NULL;


--
-- Name: pos_order_items pos_order_items_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: pos_order_items pos_order_items_pos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_pos_order_id_fkey FOREIGN KEY (pos_order_id) REFERENCES public.pos_orders(id) ON DELETE CASCADE;


--
-- Name: pos_order_items pos_order_items_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_order_items
    ADD CONSTRAINT pos_order_items_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: pos_orders pos_orders_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_orders
    ADD CONSTRAINT pos_orders_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE RESTRICT;


--
-- Name: pos_payments pos_payments_pos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_payments
    ADD CONSTRAINT pos_payments_pos_order_id_fkey FOREIGN KEY (pos_order_id) REFERENCES public.pos_orders(id) ON DELETE CASCADE;


--
-- Name: product_suggestions product_suggestions_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id);


--
-- Name: product_suggestions product_suggestions_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: product_suggestions product_suggestions_raw_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_raw_currency_id_fkey FOREIGN KEY (raw_currency_id) REFERENCES public.currencies(id);


--
-- Name: product_suggestions product_suggestions_raw_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_raw_partner_id_fkey FOREIGN KEY (raw_partner_id) REFERENCES public.partners(id);


--
-- Name: product_suggestions product_suggestions_raw_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_raw_units_id_fkey FOREIGN KEY (raw_units_id) REFERENCES public.units(id);


--
-- Name: product_suggestions product_suggestions_raw_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_raw_vat_id_fkey FOREIGN KEY (raw_vat_id) REFERENCES public.vat(id);


--
-- Name: product_suggestions product_suggestions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.workers(id);


--
-- Name: product_suggestions product_suggestions_shop_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suggestions
    ADD CONSTRAINT product_suggestions_shop_order_item_id_fkey FOREIGN KEY (shop_order_item_id) REFERENCES public.shop_order_items(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_shop_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_shop_order_item_id_fkey FOREIGN KEY (shop_order_item_id) REFERENCES public.shop_order_items(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id) ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;


--
-- Name: quote_accessories quote_accessories_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE RESTRICT;


--
-- Name: quote_accessories quote_accessories_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: quote_accessories quote_accessories_product_suggestion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_product_suggestion_id_fkey FOREIGN KEY (product_suggestion_id) REFERENCES public.product_suggestions(id) ON DELETE SET NULL;


--
-- Name: quote_accessories quote_accessories_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_accessories quote_accessories_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_accessories
    ADD CONSTRAINT quote_accessories_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: quote_edge_materials_breakdown quote_edge_materials_breakdown_edge_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_edge_materials_breakdown
    ADD CONSTRAINT quote_edge_materials_breakdown_edge_material_id_fkey FOREIGN KEY (edge_material_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_edge_materials_breakdown quote_edge_materials_breakdown_quote_materials_pricing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_edge_materials_breakdown
    ADD CONSTRAINT quote_edge_materials_breakdown_quote_materials_pricing_id_fkey FOREIGN KEY (quote_materials_pricing_id) REFERENCES public.quote_materials_pricing(id) ON DELETE CASCADE;


--
-- Name: quote_fees quote_fees_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_fees
    ADD CONSTRAINT quote_fees_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: quote_fees quote_fees_feetype_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_fees
    ADD CONSTRAINT quote_fees_feetype_id_fkey FOREIGN KEY (feetype_id) REFERENCES public.feetypes(id) ON DELETE RESTRICT;


--
-- Name: quote_fees quote_fees_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_fees
    ADD CONSTRAINT quote_fees_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_materials_pricing quote_materials_pricing_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_materials_pricing
    ADD CONSTRAINT quote_materials_pricing_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: quote_materials_pricing quote_materials_pricing_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_materials_pricing
    ADD CONSTRAINT quote_materials_pricing_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_panels quote_panels_edge_material_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_edge_material_a_id_fkey FOREIGN KEY (edge_material_a_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_edge_material_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_edge_material_b_id_fkey FOREIGN KEY (edge_material_b_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_edge_material_c_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_edge_material_c_id_fkey FOREIGN KEY (edge_material_c_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_edge_material_d_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_edge_material_d_id_fkey FOREIGN KEY (edge_material_d_id) REFERENCES public.edge_materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: quote_panels quote_panels_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_panels
    ADD CONSTRAINT quote_panels_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_payments quote_payments_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payments
    ADD CONSTRAINT quote_payments_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_services_breakdown quote_services_breakdown_quote_materials_pricing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_services_breakdown
    ADD CONSTRAINT quote_services_breakdown_quote_materials_pricing_id_fkey FOREIGN KEY (quote_materials_pricing_id) REFERENCES public.quote_materials_pricing(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: quotes quotes_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;


--
-- Name: quotes quotes_production_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_production_machine_id_fkey FOREIGN KEY (production_machine_id) REFERENCES public.production_machines(id) ON DELETE RESTRICT;


--
-- Name: shipment_items shipment_items_purchase_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_purchase_order_item_id_fkey FOREIGN KEY (purchase_order_item_id) REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT;


--
-- Name: shipment_items shipment_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE RESTRICT;


--
-- Name: shipments shipments_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;


--
-- Name: shop_order_items shop_order_items_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE SET NULL;


--
-- Name: shop_order_items shop_order_items_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id);


--
-- Name: shop_order_items shop_order_items_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE SET NULL;


--
-- Name: shop_order_items shop_order_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL;


--
-- Name: shop_order_items shop_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE;


--
-- Name: shop_order_items shop_order_items_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id);


--
-- Name: shop_order_items shop_order_items_units_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_units_id_fkey FOREIGN KEY (units_id) REFERENCES public.units(id);


--
-- Name: shop_order_items shop_order_items_vat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES public.vat(id);


--
-- Name: shop_orders shop_orders_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id);


--
-- Name: stock_movements stock_movements_accessory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_linear_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_linear_material_id_fkey FOREIGN KEY (linear_material_id) REFERENCES public.linear_materials(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;


--
-- Name: user_permissions user_permissions_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_pins user_pins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pins
    ADD CONSTRAINT user_pins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_pins user_pins_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pins
    ADD CONSTRAINT user_pins_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE SET NULL;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: cutting_fees Allow anon users to read cutting fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anon users to read cutting fees" ON public.cutting_fees FOR SELECT TO anon USING (true);


--
-- Name: tenant_company Allow anon users to read tenant company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anon users to read tenant company" ON public.tenant_company FOR SELECT TO anon USING (true);


--
-- Name: cutting_fees Allow authenticated users to insert cutting fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert cutting fees" ON public.cutting_fees FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: cutting_fees Allow authenticated users to read cutting fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read cutting fees" ON public.cutting_fees FOR SELECT TO authenticated USING (true);


--
-- Name: cutting_fees Allow authenticated users to update cutting fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update cutting fees" ON public.cutting_fees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: pages Authenticated users can view pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view pages" ON public.pages FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Enable all operations for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all operations for all users" ON public.edge_materials USING (true) WITH CHECK (true);


--
-- Name: quote_accessories Enable delete for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for authenticated users" ON public.quote_accessories FOR DELETE USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_fees Enable delete for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for authenticated users" ON public.quote_fees FOR DELETE USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_accessories Enable insert for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users" ON public.quote_accessories FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: quote_fees Enable insert for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users" ON public.quote_fees FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: quote_accessories Enable read access for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for authenticated users" ON public.quote_accessories FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_fees Enable read access for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for authenticated users" ON public.quote_fees FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_accessories Enable update for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for authenticated users" ON public.quote_accessories FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: quote_fees Enable update for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for authenticated users" ON public.quote_fees FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: pages Pages are readable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pages are readable by authenticated users" ON public.pages FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Users can delete edge materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete edge materials" ON public.edge_materials FOR DELETE USING ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Users can insert edge materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert edge materials" ON public.edge_materials FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Users can update edge materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update edge materials" ON public.edge_materials FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: edge_materials Users can view edge materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view edge materials" ON public.edge_materials FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: cutting_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cutting_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: edge_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edge_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_payments order_payments_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_delete_policy ON public.quote_payments FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: quote_payments order_payments_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_insert_policy ON public.quote_payments FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: quote_payments order_payments_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_select_policy ON public.quote_payments FOR SELECT USING (((auth.uid() IS NOT NULL) AND (deleted_at IS NULL)));


--
-- Name: quote_payments order_payments_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_update_policy ON public.quote_payments FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (deleted_at IS NULL)));


--
-- Name: pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_accessories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_accessories ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_payments quote_payments_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_payments_delete_policy ON public.quote_payments FOR DELETE USING ((auth.uid() IS NOT NULL));


--
-- Name: quote_payments quote_payments_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_payments_insert_policy ON public.quote_payments FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: quote_payments quote_payments_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_payments_select_policy ON public.quote_payments FOR SELECT USING (((auth.uid() IS NOT NULL) AND (deleted_at IS NULL)));


--
-- Name: quote_payments quote_payments_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quote_payments_update_policy ON public.quote_payments FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (deleted_at IS NULL)));


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Authenticated users can delete material images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can delete material images" ON storage.objects FOR DELETE TO authenticated USING ((bucket_id = 'materials'::text));


--
-- Name: objects Authenticated users can update material images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can update material images" ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'materials'::text));


--
-- Name: objects Authenticated users can upload material images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload material images" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'materials'::text));


--
-- Name: objects Authenticated users can view material images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can view material images" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'materials'::text));


--
-- Name: objects Enable delete for accessories; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Enable delete for accessories" ON storage.objects FOR DELETE TO authenticated USING ((bucket_id = 'accessories'::text));


--
-- Name: objects Enable delete for authenticated users; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Enable delete for authenticated users" ON storage.objects FOR DELETE TO authenticated USING ((bucket_id = 'materials'::text));


--
-- Name: objects Enable public read access for accessories; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Enable public read access for accessories" ON storage.objects FOR SELECT USING ((bucket_id = 'accessories'::text));


--
-- Name: objects Enable read access for accessories; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Enable read access for accessories" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'accessories'::text));


--
-- Name: objects Enable read access for authenticated users; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Enable read access for authenticated users" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'materials'::text));


--
-- Name: objects Enable update for accessories; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Enable update for accessories" ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'accessories'::text));


--
-- Name: objects Enable update for authenticated users; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Enable update for authenticated users" ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'materials'::text));


--
-- Name: objects Enable upload for accessories; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Enable upload for accessories" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'accessories'::text));


--
-- Name: objects Enable upload for authenticated users; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Enable upload for authenticated users" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'materials'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict JZu8dzJkZff2b1ebbmp1vecEAzcOZLa0RXbC5NbdJbld20RRoetocpQMr0R0YEE

