-- ============================================================
-- 008_fix_rls_recursion.sql
-- Fix infinite recursion in profiles RLS policies.
-- The admin policies self-reference the profiles table, causing
-- infinite recursion when auth.uid() is null (anon requests).
-- Solution: use a security definer function to check admin role.
-- ============================================================

-- Create a security definer function that bypasses RLS to check role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'admin'
  );
$$;

-- Drop the recursive policies
DROP POLICY IF EXISTS profiles_admin_select ON profiles;
DROP POLICY IF EXISTS profiles_admin_update ON profiles;
DROP POLICY IF EXISTS creator_profiles_admin_select ON creator_profiles;
DROP POLICY IF EXISTS creator_profiles_admin_update ON creator_profiles;

-- Recreate admin policies using the security definer function
CREATE POLICY profiles_admin_select ON profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE USING (public.is_admin());

CREATE POLICY creator_profiles_admin_select ON creator_profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY creator_profiles_admin_update ON creator_profiles
  FOR UPDATE USING (public.is_admin());

-- Also fix brand_profiles admin policies (same pattern)
DROP POLICY IF EXISTS brand_profiles_admin_select ON brand_profiles;
DROP POLICY IF EXISTS brand_profiles_admin_update ON brand_profiles;

CREATE POLICY brand_profiles_admin_select ON brand_profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY brand_profiles_admin_update ON brand_profiles
  FOR UPDATE USING (public.is_admin());
