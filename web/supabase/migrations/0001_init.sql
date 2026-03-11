create table if not exists profiles (
  id uuid primary key,
  display_name text not null default '',
  preferred_roles text[] not null default '{}',
  daily_apply_goal integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists application_logs (
  id uuid primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  company text not null,
  source text not null check (source in ('linkedin', 'indeed', 'glassdoor', 'other')),
  quality_score integer not null check (quality_score between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists economy_balances (
  user_id uuid primary key references profiles(id) on delete cascade,
  zen integer not null default 0,
  total_zen_earned integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists guest_state (
  user_id uuid primary key references profiles(id) on delete cascade,
  active integer not null default 1,
  happiest_guest_mood integer not null default 50,
  updated_at timestamptz not null default now()
);

create table if not exists progression_state (
  user_id uuid primary key references profiles(id) on delete cascade,
  level integer not null default 1,
  total_applications integer not null default 0,
  unlocked_bath_tier integer not null default 1,
  updated_at timestamptz not null default now()
);
