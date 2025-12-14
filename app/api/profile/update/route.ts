import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import { isChinaRegion } from "@/lib/config/region";
import { requireAuth } from "@/lib/auth/auth";
import { z } from "zod";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema
const updateProfileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

/**
 * PUT /api/profile/update
 * Updates the user's profile information in the user_profiles table
 */
export async function PUT(request: NextRequest) {
  try {
    // This endpoint is only for international (Supabase) region
    if (isChinaRegion()) {
      return NextResponse.json(
        { error: "This endpoint is not available in China region" },
        { status: 400 }
      );
    }

    // Authenticate the user
    const auth = await requireAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateProfileSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: validationResult.error.errors[0]?.message
        },
        { status: 400 }
      );
    }

    const { full_name } = validationResult.data;

    // Get Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();

    // Update user_profiles table
    const { error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update({
        full_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.user.id);

    if (updateError) {
      console.error("[/api/profile/update] Failed to update profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    // Also update user metadata in auth.users
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      auth.user.id,
      {
        user_metadata: {
          ...auth.user.user_metadata,
          full_name,
        }
      }
    );

    if (metadataError) {
      console.error("[/api/profile/update] Failed to update user metadata:", metadataError);
      // Don't fail the request if metadata update fails
    }

    console.log("[/api/profile/update] Profile updated successfully for user:", auth.user.id);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        full_name,
      },
    });

  } catch (error: any) {
    console.error("[/api/profile/update] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}