import { supabase } from "@/app/lib/supabaseClient";
import { findAuthUserByEmail } from "@/app/lib/authUserLookup";
import { upsertUserProfile } from "@/app/lib/userProfileSync";

async function finalizeRegistration(userId, { email, password, fullName }) {
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      auth_provider: "email",
    },
  });

  if (updateError) {
    throw updateError;
  }

  const profile = await upsertUserProfile({
    userId,
    email,
    fullName,
    authProvider: "email",
  });

  return profile;
}

function isFullyRegistered(existing) {
  return (
    existing?.user &&
    existing?.profile?.user_id &&
    existing.profile.user_id === existing.user.id
  );
}

export async function completeEmailRegistration({ email, password, fullName }) {
  if (!supabase) {
    throw new Error("Database unavailable.");
  }

  const existing = await findAuthUserByEmail(email);

  if (isFullyRegistered(existing)) {
    const error = new Error("An account with this email already exists. Please sign in.");
    error.status = 409;
    throw error;
  }

  if (existing?.user) {
    const profile = await finalizeRegistration(existing.user.id, {
      email,
      password,
      fullName,
    });

    return {
      profile,
      recovered: true,
      message: "Account setup completed successfully.",
    };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      auth_provider: "email",
    },
  });

  if (error) {
    const message = error.message || "Could not create account.";
    if (/already registered|already exists|duplicate/i.test(message)) {
      const retry = await findAuthUserByEmail(email);
      if (retry?.user) {
        const profile = await finalizeRegistration(retry.user.id, {
          email,
          password,
          fullName,
        });
        return {
          profile,
          recovered: true,
          message: "Account setup completed successfully.",
        };
      }

      const duplicateError = new Error(
        "An account with this email already exists. Please sign in."
      );
      duplicateError.status = 409;
      throw duplicateError;
    }
    throw error;
  }

  const profile = await upsertUserProfile({
    userId: data.user.id,
    email,
    fullName,
    authProvider: "email",
  });

  return {
    profile,
    recovered: false,
    message: "Account created successfully.",
  };
}
