import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      console.error("[upload] FAL_KEY environment variable is not set");
      return NextResponse.json(
        { error: "FAL_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    console.log("[upload] FAL_KEY loaded, length:", falKey.length);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    console.log("[upload] File received:", file.name, "size:", file.size, "type:", file.type);

    // Use fal.ai REST API directly instead of SDK to avoid config issues
    const contentType = file.type || "image/png";
    const fileName = file.name || `${Date.now()}.png`;

    // Step 1: Initiate upload
    const initiateRes = await fetch(
      "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content_type: contentType,
          file_name: fileName,
        }),
      }
    );

    if (!initiateRes.ok) {
      const errText = await initiateRes.text();
      console.error("[upload] Initiate failed:", initiateRes.status, errText);
      return NextResponse.json(
        { error: `Upload initiation failed: ${errText}` },
        { status: initiateRes.status }
      );
    }

    const { upload_url, file_url } = await initiateRes.json();
    console.log("[upload] Got upload URL, file will be at:", file_url);

    // Step 2: Upload the file content
    const arrayBuffer = await file.arrayBuffer();
    const uploadRes = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: arrayBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("[upload] PUT failed:", uploadRes.status, errText);
      return NextResponse.json(
        { error: `File upload failed: ${errText}` },
        { status: uploadRes.status }
      );
    }

    console.log("[upload] Upload complete:", file_url);
    return NextResponse.json({ url: file_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[upload] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
