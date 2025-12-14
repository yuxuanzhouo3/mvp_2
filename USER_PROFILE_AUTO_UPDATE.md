# User Profile Auto-Update Implementation

## Overview

This document describes the implementation of automatic user profile updates in Supabase after successful user login. The system ensures that every authenticated user has a corresponding record in the `user_profiles` table with their latest information.

## Database Schema

The `user_profiles` table has the following structure:

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Implementation Details

### 1. Profile API Endpoint (`/api/profile/route.ts`)

The main implementation is in the profile API endpoint, which is automatically called after successful login by the Supabase auth client.

Key features:
- **Automatic profile creation**: Creates a new `user_profiles` record if it doesn't exist
- **Profile updates**: Updates existing records with the latest user information
- **Uses admin privileges**: Leverages `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS policies
- **Graceful error handling**: Continues operation even if profile update fails

### 2. Flow of Operations

1. User signs in successfully via Supabase auth
2. The `SupabaseAuthClient.signInWithPassword()` method calls `refreshUserProfile()`
3. `refreshUserProfile()` makes a request to `/api/profile` with the access token
4. The `/api/profile` endpoint:
   - Authenticates the user using the provided token
   - Checks if a `user_profiles` record exists
   - Creates or updates the record with current user data
   - Returns the complete profile information

### 3. Data Mapped

The following data is automatically synchronized:

| Source | Destination |
|--------|-------------|
| `auth.users.id` | `user_profiles.id` |
| `auth.users.email` | `user_profiles.email` |
| `user_metadata.full_name` or `user_metadata.name` | `user_profiles.full_name` |
| Default values | `user_profiles.subscription_tier = 'free'` |
| Default values | `user_profiles.subscription_status = 'active'` |

### 4. China Region (CloudBase)

The China region uses CloudBase authentication and handles user data differently. The CloudBase login endpoint (`/api/auth/login/route.ts`) returns user data directly, but doesn't interact with the Supabase `user_profiles` table as it uses a different database system.

## Security Considerations

1. **Service Role Key**: The implementation uses the `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security (RLS) policies, which is necessary for creating/updating user profiles that belong to the authenticated user.

2. **Token Validation**: The endpoint validates the JWT token before performing any database operations.

3. **Error Handling**: Errors in profile updates don't prevent the authentication flow from completing.

## Testing

A test script (`test-profile-update.js`) is provided to verify the implementation:

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# Run the test
node test-profile-update.js
```

The test will:
1. Sign in with test credentials
2. Call the profile API endpoint
3. Verify the record in the `user_profiles` table
4. Clean up by signing out

## Troubleshooting

### Common Issues

1. **Missing `SUPABASE_SERVICE_ROLE_KEY`**
   - The profile update will fail
   - Check your Supabase dashboard for the service role key
   - Set it in your environment variables

2. **`user_profiles` table doesn't exist**
   - Run the migration script: `004_payment_subscription_tables.sql`
   - The table is created automatically by the migration

3. **Permission errors**
   - Ensure RLS policies are correctly set up
   - The service role key should bypass RLS
   - Check that the table has the correct policies

4. **Profile not updating**
   - Check browser console for errors
   - Verify network requests to `/api/profile`
   - Check server logs for detailed error messages

## Future Enhancements

1. **Real-time sync**: Consider adding database triggers to sync data bidirectionally
2. **Additional fields**: Map more user metadata fields as needed
3. **Version control**: Add version tracking for profile changes
4. **Audit logs**: Track who made changes to user profiles

## Name Editing Feature

### Implementation Details

A name editing feature has been added to the settings page that allows users to update their `full_name` in the `user_profiles` table:

1. **API Endpoint**: `/api/profile/update` - Handles PUT requests to update the user's name
2. **UI Component**: Settings page now includes an editable name field with save/cancel functionality
3. **Real-time Updates**: The name is updated in both `user_profiles` and `auth.users.user_metadata`

### How to Use

1. Go to Settings → Account tab
2. Click the edit icon (✏️) next to the Name field
3. Enter your new name
4. Click the save icon (✓) to update or cancel icon (✕) to discard changes
5. A success message will confirm the update

### API Endpoint Details

**PUT /api/profile/update**

Request body:
```json
{
  "full_name": "New Name"
}
```

Response:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "full_name": "New Name"
  }
}
```

## Related Files

- `/app/api/profile/route.ts` - Main profile retrieval and auto-update implementation
- `/app/api/profile/update/route.ts` - Name update API endpoint
- `/lib/auth/client.ts` - Auth client that calls the profile API
- `/lib/integrations/supabase-admin.ts` - Admin client setup
- `/app/settings/page.tsx` - Settings page with name editing UI
- `/supabase/migrations/004_payment_subscription_tables.sql` - Database schema
- `/test-profile-update.js` - Test script for auto-update
- `/test-name-update.js` - Test script for name editing