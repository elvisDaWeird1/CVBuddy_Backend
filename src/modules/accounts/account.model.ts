import mongoose, { Document } from "mongoose";

import {
  ACCOUNT_ROLE_VALUES,
  ACCOUNT_STATUSES,
  ACCOUNT_STATUS_VALUES,
  AUTH_METHODS,
  AUTH_METHOD_VALUES
} from "../../constants/enums";

export type AuthMethod = "PASSWORD" | "GOOGLE";

export interface IAccount extends Document {
  email: string;
  passwordHash?: string;
  authMethods: AuthMethod[];
  googleSubject?: string;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  role: "APPLICANT" | "COMPANY" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: Date;
  updatedAt: Date;
}

const transformAccount = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  delete ret.passwordHash;
  return ret;
};

const AccountSchema = new mongoose.Schema<IAccount>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: function (this: IAccount) {
        const methods = Array.isArray(this.authMethods)
          ? this.authMethods
          : [AUTH_METHODS.PASSWORD];
        if (!methods.includes(AUTH_METHODS.PASSWORD)) {
          return false;
        }
        if (
          !this.isNew &&
          typeof this.isSelected === "function" &&
          !this.isSelected("passwordHash") &&
          !this.isModified("passwordHash") &&
          !this.isModified("authMethods")
        ) {
          return false;
        }
        return true;
      },
      validate: {
        validator: function (value: unknown) {
          if (value === undefined || value === null) {
            return true;
          }
          return typeof value === "string" && value.trim().length > 0;
        },
        message: "passwordHash cannot be blank"
      },
      select: false
    },
    authMethods: {
      type: [
        {
          type: String,
          enum: AUTH_METHOD_VALUES
        }
      ],
      default: () => [AUTH_METHODS.PASSWORD],
      required: true,
      validate: {
        validator: (methods: unknown) =>
          Array.isArray(methods) &&
          methods.length > 0 &&
          methods.every(
            (method) =>
              typeof method === "string" &&
              (AUTH_METHOD_VALUES as readonly string[]).includes(method)
          ),
        message: "At least one valid authentication method is required"
      }
    },
    googleSubject: {
      type: String,
      trim: true,
      required: function (this: IAccount) {
        const methods = Array.isArray(this.authMethods) ? this.authMethods : [];
        if (!methods.includes(AUTH_METHODS.GOOGLE)) {
          return false;
        }
        if (
          !this.isNew &&
          typeof this.isSelected === "function" &&
          !this.isSelected("googleSubject") &&
          !this.isModified("googleSubject") &&
          !this.isModified("authMethods")
        ) {
          return false;
        }
        return true;
      },
      validate: {
        validator: function (value: unknown) {
          if (value === undefined || value === null) {
            return true;
          }
          return typeof value === "string" && value.trim().length > 0;
        },
        message: "googleSubject cannot be blank"
      }
    },
    emailVerifiedAt: {
      type: Date
    },
    lastLoginAt: {
      type: Date
    },
    role: {
      type: String,
      enum: ACCOUNT_ROLE_VALUES,
      required: true
    },
    status: {
      type: String,
      enum: ACCOUNT_STATUS_VALUES,
      default: ACCOUNT_STATUSES.ACTIVE,
      required: true
    }
  },
  {
    collection: "accounts",
    timestamps: true,
    toJSON: {
      transform: transformAccount
    },
    toObject: {
      transform: transformAccount
    }
  }
);

AccountSchema.index({ email: 1 }, { unique: true });
AccountSchema.index({ googleSubject: 1 }, { unique: true, sparse: true });
AccountSchema.index({ role: 1 });
AccountSchema.index({ status: 1 });

const Account = mongoose.model<IAccount>("Account", AccountSchema);

export default Account;
