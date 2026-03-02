import { NextRequest, NextResponse } from "next/server";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OCR service not configured" },
      { status: 500 }
    );
  }

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const dataUrl = body.image;
  if (!dataUrl || typeof dataUrl !== "string") {
    return NextResponse.json({ error: "Missing image field" }, { status: 400 });
  }

  // Strip data URI prefix to get raw base64
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

  const visionResponse = await fetch(`${VISION_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "TEXT_DETECTION" }],
        },
      ],
    }),
  });

  if (!visionResponse.ok) {
    const err = await visionResponse.text();
    console.error("Vision API error:", err);
    return NextResponse.json(
      { error: "OCR service error" },
      { status: 502 }
    );
  }

  const visionData = await visionResponse.json();
  const text =
    visionData.responses?.[0]?.textAnnotations?.[0]?.description ?? "";

  if (!text) {
    return NextResponse.json(
      { error: "No text detected in image" },
      { status: 422 }
    );
  }

  return NextResponse.json({ text });
}
