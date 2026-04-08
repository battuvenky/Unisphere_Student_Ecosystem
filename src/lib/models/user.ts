import { Schema, model, models, type InferSchemaType } from "mongoose";

const requestItemSchema = new Schema(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    status: { type: String, enum: ["pending", "accepted", "rejected", "cancelled"], required: true },
    createdAt: { type: String, required: true },
    respondedAt: { type: String, default: null },
  },
  { _id: false }
);

const loginHistoryItemSchema = new Schema(
  {
    at: { type: String, required: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    source: { type: String, enum: ["login", "signup"], required: true },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    appId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "admin"], default: "student", required: true },
    department: { type: String, required: true, trim: true },
    year: { type: String, required: true, trim: true },
    skills: { type: [String], default: [] },
    profileImage: { type: String, default: "" },
    specialization: { type: String, default: "" },
    specializations: { type: [String], default: [] },
    experience: { type: String, default: "" },
    headline: { type: String, default: "" },
    bio: { type: String, default: "" },
    achievements: { type: [Schema.Types.Mixed], default: [] },
    projects: { type: [Schema.Types.Mixed], default: [] },
    friends: { type: [String], default: [] },
    requests: {
      incoming: { type: [requestItemSchema], default: [] },
      outgoing: { type: [requestItemSchema], default: [] },
    },
    auth: {
      lastLoginAt: { type: String, default: null },
      loginCount: { type: Number, default: 0 },
      loginHistory: { type: [loginHistoryItemSchema], default: [] },
    },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: String, default: null },
    createdAtIso: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export type UserModelRecord = InferSchemaType<typeof userSchema>;

export const UserModel = models.UniSphereUser || model("UniSphereUser", userSchema);
