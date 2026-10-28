create table portfolio.photos_references (
 media_id uuid primary key references portfolio.media(id) on delete cascade,
 photos_id text not null,
 picker_session text not null,
 original_name text not null,
 imported_at timestamptz not null default now()
);
