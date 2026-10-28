create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema portfolio;
create table portfolio.users (
 id text primary key default extensions.gen_random_uuid()::text,
 email text not null unique, password text not null, name text not null default '',
 verified boolean not null default false, admin boolean not null default false
);
create table portfolio.sessions (hash text primary key, uid text references portfolio.users(id) on delete cascade, expires timestamptz not null default now()+interval '12 hours');
create table portfolio.tokens (hash text primary key, uid text references portfolio.users(id) on delete cascade, purpose text not null, expires timestamptz not null default now()+interval '1 hour');
create table portfolio.records (path text primary key, uid text references portfolio.users(id) on delete cascade, data jsonb not null);
-- Additive content store: no changes to existing accounts or MES tickets.
create table portfolio.content (id text primary key check(id='main'), version integer not null default 1, data jsonb not null, updated_by text references portfolio.users(id), updated_at timestamptz not null default now());
create table portfolio.media (id uuid primary key, type text not null, size bigint not null check(size>0), name text not null, ready boolean not null default false, created_by text references portfolio.users(id), created_at timestamptz not null default now());
-- First-party visit records; anonymous visitors use an expiring random session.
create table portfolio.visits (
 id uuid primary key default extensions.gen_random_uuid(),
 visitor_hash text not null, uid text references portfolio.users(id) on delete set null,
 account_name text not null default '', account_email text not null default '',
 role text not null check(role in ('viewer','user','admin')),
 path text not null, referrer text not null default '', browser text not null default '',
 created_at timestamptz not null default now(), last_seen timestamptz not null default now()
);
create index portfolio_visits_time on portfolio.visits(created_at desc,id);
create index portfolio_visits_user on portfolio.visits(uid,created_at desc);
create index portfolio_visits_session on portfolio.visits(visitor_hash,created_at desc);
