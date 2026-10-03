"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";

export async function uploadProductImageAction(data: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || user.profile?.role !== "admin") {
      return { error: "Unauthorized" };
    }

    const file = data.get("file") as File | null;
    if (!file) return { error: "No file provided" };

    if (!file.type.startsWith("image/")) {
      return { error: "Only image files are allowed" };
    }

    if (file.size > 3 * 1024 * 1024) {
      return { error: "Image must be under 3MB" };
    }

    const ext = file.name.split(".").pop() ?? "png";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5);
    const path = `${crypto.randomUUID()}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const admin = createAdminClient();

    const { error } = await admin.storage
      .from("product-images")
      .upload(path, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) return { error: getErrorMessage(error) };

    const { data: urlData } = admin.storage
      .from("product-images")
      .getPublicUrl(path);

    return { url: urlData.publicUrl, path };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function removeUploadedImageAction(path: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.profile?.role !== "admin") return { error: "Unauthorized" };

    const admin = createAdminClient();
    await admin.storage.from("product-images").remove([path]);
    return { success: true };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}