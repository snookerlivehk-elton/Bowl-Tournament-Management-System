create table if not exists users (
  id serial primary key,
  name text not null,
  nationality text,
  photo_url text,
  created_at timestamptz default now()
);

create table if not exists roles (
  id serial primary key,
  name text not null unique,
  parent_role_id int references roles(id) on delete set null,
  permissions jsonb not null default '[]'::jsonb
);

create table if not exists titles (
  id serial primary key,
  name text not null,
  scope text not null default 'club'
);

create table if not exists clubs (
  id serial primary key,
  name text not null,
  region text,
  created_at timestamptz default now()
);

create table if not exists countries (
  code text primary key,
  name text not null,
  local_name text,
  flag_url text,
  enabled boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists matches (
  id serial primary key,
  competition_id int,
  club_id int,
  player_ids jsonb not null,
  frames_per_match int not null default 4,
  status text not null default 'created',
  created_at timestamptz default now()
);

create table if not exists frames (
  id serial primary key,
  match_id int not null references matches(id) on delete cascade,
  frame_no int not null
);

create table if not exists rolls (
  id serial primary key,
  frame_id int not null references frames(id) on delete cascade,
  player_id int not null,
  pins jsonb not null
);

-- invites for QR-based player-vs-player matches
create table if not exists match_invites (
  id serial primary key,
  match_id int not null references matches(id) on delete cascade,
  token text not null unique,
  created_at timestamptz default now(),
  expires_at timestamptz
);

alter table if exists frames add column if not exists scores jsonb;
