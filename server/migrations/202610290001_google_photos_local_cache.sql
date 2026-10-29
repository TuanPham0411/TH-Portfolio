alter table portfolio.media add column storage_source text not null default 'drive' check(storage_source in ('drive','google-photos'));
update portfolio.media m set storage_source='google-photos' where exists(select 1 from portfolio.photos_references p where p.media_id=m.id);
