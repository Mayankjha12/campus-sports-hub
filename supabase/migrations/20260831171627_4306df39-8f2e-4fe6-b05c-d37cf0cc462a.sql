-- ROLES
CREATE TYPE public.app_role AS ENUM ('student', 'admin');
CREATE TYPE public.facility_status AS ENUM ('open', 'closed', 'maintenance');
CREATE TYPE public.booking_status AS ENUM ('confirmed', 'cancelled', 'completed');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  student_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, student_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), COALESCE(NEW.email, ''), NEW.raw_user_meta_data->>'student_id')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FACILITIES
CREATE TABLE public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sport text NOT NULL,
  location text NOT NULL,
  capacity int NOT NULL DEFAULT 4,
  equipment text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  image_key text NOT NULL DEFAULT 'badminton',
  open_hour int NOT NULL DEFAULT 6,
  close_hour int NOT NULL DEFAULT 22,
  status public.facility_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.facilities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facilities TO authenticated;
GRANT ALL ON public.facilities TO service_role;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facilities_public_read" ON public.facilities FOR SELECT USING (true);
CREATE POLICY "facilities_admin_write" ON public.facilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- BOOKINGS
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- THE concurrency guarantee: only one active booking per facility + date + start time
CREATE UNIQUE INDEX bookings_unique_active_slot
  ON public.bookings (facility_id, booking_date, start_time)
  WHERE status = 'confirmed';
CREATE INDEX bookings_user_idx ON public.bookings (user_id, booking_date DESC);
CREATE INDEX bookings_facility_date_idx ON public.bookings (facility_id, booking_date);
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT SELECT ON public.bookings TO anon;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_read_slots" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "bookings_insert_own" ON public.bookings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_update_own" ON public.bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- WAITLIST
CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, facility_id, booking_date, start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waitlist_select" ON public.waitlist FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "waitlist_insert_own" ON public.waitlist FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "waitlist_update_own" ON public.waitlist FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "waitlist_delete_own" ON public.waitlist FOR DELETE TO authenticated USING (user_id = auth.uid());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CONCURRENCY DEMO
CREATE TABLE public.demo_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX demo_bookings_unique_slot ON public.demo_bookings (run_id, facility_id, booking_date, start_time);
GRANT SELECT, INSERT, DELETE ON public.demo_bookings TO authenticated;
GRANT ALL ON public.demo_bookings TO service_role;
ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_bookings_read" ON public.demo_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo_bookings_write" ON public.demo_bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "demo_bookings_clear" ON public.demo_bookings FOR DELETE TO authenticated USING (true);

-- SEED FACILITIES
INSERT INTO public.facilities (name, sport, location, capacity, equipment, description, image_key, open_hour, close_hour, status) VALUES
('Badminton Court 1', 'Badminton', 'Indoor Sports Complex, Block A', 4, ARRAY['Rackets','Shuttlecocks','Net'], 'Wooden-floor indoor court with tournament-grade lighting and synthetic mat overlay. Preferred court for inter-department matches.', 'badminton', 6, 22, 'open'),
('Badminton Court 2', 'Badminton', 'Indoor Sports Complex, Block A', 4, ARRAY['Rackets','Shuttlecocks','Net'], 'Second indoor badminton court, ideal for casual doubles and evening practice sessions.', 'badminton', 6, 22, 'open'),
('Tennis Court 1', 'Tennis', 'North Campus Lawns', 4, ARRAY['Rackets','Tennis balls','Ball machine'], 'Synthetic hard court with floodlights for night play, adjacent to the athletics track.', 'tennis', 6, 21, 'open'),
('Basketball Court', 'Basketball', 'Central Quad, near Library', 10, ARRAY['Basketballs','Bibs','Scoreboard'], 'Full-size outdoor acrylic court with two practice hoops and covered spectator seating.', 'basketball', 6, 22, 'open'),
('Football Ground', 'Football', 'South Campus Sports Field', 22, ARRAY['Footballs','Goal nets','Training cones','Bibs'], 'Natural turf 11-a-side ground maintained by the campus grounds team, with changing rooms nearby.', 'football', 6, 20, 'open'),
('Cricket Ground', 'Cricket', 'South Campus Sports Field', 22, ARRAY['Cricket balls','Bats','Pads','Stumps','Bowling machine'], 'Turf wicket with practice nets on the eastern edge and an electronic scoreboard.', 'cricket', 6, 19, 'maintenance'),
('Gymnasium', 'Gymnasium', 'Student Wellness Centre, Block C', 30, ARRAY['Free weights','Treadmills','Rowing machines','Spin bikes'], 'Air-conditioned strength and cardio gym with certified trainers on duty during evening hours.', 'gym', 5, 23, 'open');