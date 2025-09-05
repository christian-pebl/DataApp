-- Run this SQL in your Supabase SQL Editor to set up pin sharing system

-- First, let's add privacy and sharing columns to existing pins table
ALTER TABLE public.pins 
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'private' CHECK (privacy_level IN ('private', 'public', 'specific'));

-- Update map data service to use actual user IDs instead of admin-shared-data
-- (We'll handle this in the TypeScript code)

-- Create pin_shares table for specific user sharing
CREATE TABLE IF NOT EXISTS public.pin_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_id TEXT NOT NULL REFERENCES public.pins(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pin_id, shared_with_user_id)
);

-- Create notifications table for sharing notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'pin_shared' CHECK (type IN ('pin_shared')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    pin_id TEXT REFERENCES public.pins(id) ON DELETE CASCADE,
    shared_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_profiles table to store user emails and display names for sharing
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pin_shares_pin_id ON public.pin_shares(pin_id);
CREATE INDEX IF NOT EXISTS idx_pin_shares_shared_with ON public.pin_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_pin_shares_shared_by ON public.pin_shares(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Enable RLS on new tables
ALTER TABLE public.pin_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for pin_shares
CREATE POLICY "Users can view shares for their pins or shares with them" ON public.pin_shares
    FOR SELECT USING (
        shared_with_user_id = auth.uid() OR 
        shared_by_user_id = auth.uid() OR
        pin_id IN (SELECT id FROM public.pins WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create shares for their own pins" ON public.pin_shares
    FOR INSERT WITH CHECK (shared_by_user_id = auth.uid());

CREATE POLICY "Users can delete shares for their own pins" ON public.pin_shares
    FOR DELETE USING (shared_by_user_id = auth.uid());

-- Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Policies for user_profiles
CREATE POLICY "All users can view user profiles" ON public.user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own profile" ON public.user_profiles
    FOR ALL USING (id = auth.uid());

-- Function to create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, display_name)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to create notification when pin is shared
CREATE OR REPLACE FUNCTION public.notify_pin_shared()
RETURNS trigger AS $$
DECLARE
    pin_label TEXT;
    sharer_name TEXT;
BEGIN
    -- Get pin label
    SELECT label INTO pin_label FROM public.pins WHERE id = NEW.pin_id;
    
    -- Get sharer name
    SELECT display_name INTO sharer_name FROM public.user_profiles WHERE id = NEW.shared_by_user_id;
    
    -- Create notification
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        pin_id,
        shared_by_user_id
    ) VALUES (
        NEW.shared_with_user_id,
        'pin_shared',
        'Pin shared with you',
        sharer_name || ' shared a pin "' || COALESCE(pin_label, 'Unnamed Pin') || '" with you',
        NEW.pin_id,
        NEW.shared_by_user_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification when pin is shared
CREATE TRIGGER notify_on_pin_shared
    AFTER INSERT ON public.pin_shares
    FOR EACH ROW EXECUTE FUNCTION public.notify_pin_shared();

SELECT 'Pin sharing system setup complete!' as status;