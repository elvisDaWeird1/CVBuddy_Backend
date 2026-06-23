const mongoose = require("mongoose");
const {
  ACCOUNT_ROLE_VALUES,
  ACCOUNT_STATUSES,
  ACCOUNT_STATUS_VALUES
} = require("../../constants/enums");

const transformAccount = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  delete ret.passwordHash;
  return ret;
};

const AccountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
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
AccountSchema.index({ role: 1 });
AccountSchema.index({ status: 1 });

module.exports = mongoose.model("Account", AccountSchema);
