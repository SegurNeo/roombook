/*
  # Add role and team size fields to profiles table

  1. Changes
    - Add role field to store user's role (property_manager, landlord, investor)
    - Add team_size field to store team size information
    - Add onboarding_completed flag to track onboarding status
*/

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS team_size text,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;