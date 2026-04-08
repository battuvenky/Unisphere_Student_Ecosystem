import { Schema, model, models, type InferSchemaType } from "mongoose";

const messageSchema = new Schema(
  {
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    message: { type: String, required: true, default: "" },
    timestamp: { type: String, required: true, index: true },
    type: { type: String, enum: ["text", "note", "file"], default: "text", required: true },
    title: { type: String, default: "" },
    url: { type: String, default: "" },
    deliveredAt: { type: String, default: null },
    seenAt: { type: String, default: null },
  },
  {
    versionKey: false,
  }
);

export type MessageModelRecord = InferSchemaType<typeof messageSchema>;

export const MessageModel = models.UniSphereMessage || model("UniSphereMessage", messageSchema);
