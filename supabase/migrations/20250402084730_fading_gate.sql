/*
  # Add organization name field to profiles table

  1. Changes
    - Add org_name field to store the organization name
*/

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS org_name text;