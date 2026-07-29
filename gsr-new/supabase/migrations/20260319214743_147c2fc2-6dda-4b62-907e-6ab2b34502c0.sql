
-- Create a trigger function to auto-create notifications on follow insert
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
BEGIN
  -- Only notify on new pending follow requests
  IF NEW.status = 'pending' THEN
    -- Get the follower's display name
    SELECT COALESCE(display_name, username, 'Κάποιος') INTO _name
    FROM public.profiles WHERE user_id = NEW.follower_id LIMIT 1;

    INSERT INTO public.notifications (user_id, from_user_id, type, title, message, link)
    VALUES (
      NEW.following_id,
      NEW.follower_id,
      'follow_request',
      'Νέο αίτημα φιλίας',
      _name || ' σου έστειλε αίτημα φιλίας',
      '/profile/' || NEW.follower_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_follow_notify ON public.follows;
CREATE TRIGGER on_follow_notify
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_follow();

-- Also create trigger for profile comments
CREATE OR REPLACE FUNCTION public.notify_on_profile_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
BEGIN
  -- Don't notify if commenting on own profile
  IF NEW.author_id != NEW.profile_user_id THEN
    SELECT COALESCE(display_name, username, 'Κάποιος') INTO _name
    FROM public.profiles WHERE user_id = NEW.author_id LIMIT 1;

    INSERT INTO public.notifications (user_id, from_user_id, type, title, message, link)
    VALUES (
      NEW.profile_user_id,
      NEW.author_id,
      'profile_comment',
      'Νέο σχόλιο στο προφίλ σου',
      _name || ' σχολίασε στο προφίλ σου',
      '/profile/' || NEW.profile_user_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_comment_notify ON public.profile_comments;
CREATE TRIGGER on_profile_comment_notify
  AFTER INSERT ON public.profile_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_profile_comment();
