import { httpAction } from './_generated/server';
import { httpRouter } from "convex/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
    }

    // Robust header reading (case-insensitive)
    // Robust header reading (case-insensitive)
const getHeader = (name: string) => {
  let value: string | null = null;
  request.headers.forEach((v, k) => {
    if (k.toLowerCase() === name.toLowerCase()) value = v;
  });
  return value;
};


    const svix_id = getHeader("svix-id");
    const svix_signature = getHeader("svix-signature");
    const svix_timestamp = getHeader("svix-timestamp");

    if (!svix_id || !svix_signature || !svix_timestamp) {
      console.error("Missing Svix headers:", { svix_id, svix_signature, svix_timestamp });
      return new Response("Missing required Svix headers", { status: 400 });
    }

    const payload = await request.json();
    const body = JSON.stringify(payload);

    const wh = new Webhook(webhookSecret);
    let evt: WebhookEvent;

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature, // ✅ must have dash
      }) as WebhookEvent;
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return new Response("Error verifying webhook", { status: 400 });
    }

    // Handle user.created event
    if (evt.type === "user.created") {
      const data: any = evt.data;
      const email = data.email_addresses?.[0]?.email_address;
      const name = `${data.first_name || ""} ${data.last_name || ""}`.trim();
      const image = data.image_url;

      if (!email) {
        return new Response("User has no email", { status: 400 });
      }

      try {
        await ctx.runMutation(api.users.syncUser, {
          clerkId: data.id,
          email,
          name,
          image,
        });
      } catch (error) {
        console.error("Error creating user:", error);
        return new Response("Error creating user", { status: 500 });
      }
    }

    return new Response("Webhook processed successfully", { status: 200 });
  }),
});

export default http;
