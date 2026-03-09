const { getOrderDB } = require("../../config/conectet");
const mongoose = require("mongoose");
const { Schema } = mongoose;

const GeoPointSchema = {
  type: { type: String, default: "Point" },
  coordinates: { type: [Number], required: true },
};

const OrderSchema = new Schema(
  {
    // ✅ نوع الخدمة (مع مقدم خدمة أو خدمة ذاتية)
    serviceType: {
      type: String,
      enum: ["with_provider", "self_service"],
      required: true,
    },

    // ✅ نوع الخدمة الطبية المطلوبة (دكتور، تمريض، إلخ)
    medicalServiceType: {
      type: String,
      enum: ["doctor", "nursing", "pharmacy", "hospital", "other"],
      required: true,
    },

    // ✅ المريض (صاحب الطلب)
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ✅ مقدم الخدمة (doctor أو nursing)
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ✅ تاريخ ووقت الموعد
    appointmentDate: {
      type: Date,
      required: true,
    },

    // ✅ مدة الخدمة المتوقعة (بالساعات)
    duration: {
      type: Number,
      required: true,
      min: 1,
      max: 24,
    },

    // ✅ عنوان الطلب ووصفه
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      minlength: 5,
      maxlength: 2000,
    },

    // ✅ مستوى الاستعجال
    urgencyLevel: {
      type: String,
      enum: ["normal", "emergency"],
      default: "normal",
    },

    // ✅ موقع المريض (مكان تقديم الخدمة)
    meetingPoint: GeoPointSchema,

    // ✅ حالة الطلب
    status: {
      type: String,
      enum: [
        "open",                           // الطلب مفتوح لقبول مقدمين
        "awaiting_provider_confirmation", // في انتظار قبول المقدم
        "confirmed",                      // مؤكد من الطرفين
        "rejected_by_provider",           // رُفض من المقدم
        "in_progress",                    // يُنفَّذ الآن
        "completed",                      // مكتمل
        "cancelled",                      // ملغي
      ],
      default: "open",
    },

    // ✅ تتبع إتمام الخدمة
    completion: {
      patientConfirmed: { type: Boolean, default: false },
      patientConfirmedAt: Date,
      patientArrivedAt: Date, // ✅ وقت وصول المريض (إذا كان اللقاء في عيادة)
      patientFeedback: String,
      providerConfirmed: { type: Boolean, default: false },
      providerConfirmedAt: Date,
      providerArrivedAt: Date, // ✅ وقت وصول الدكتور/الممرض للمريض
      providerFeedback: String,
      completedAt: Date,
      commissionPaid: { type: Boolean, default: false },
    },

    // ✅ السعر والعمولة
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    commission: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ✅ الإلغاء
    cancellation: {
      cancelledBy: {
        type: String,
        enum: ["patient", "provider", "admin", "system"],
      },
      cancelledAt: Date,
      reason: String,
    },

    // ✅ بيانات الدفع
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "partial", "failed"],
      default: "pending",
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "card", "wallet", "online"],
      default: "cash",
    },

    payoutStatus: {
      type: String,
      enum: ["pending", "done", "failed"],
      default: "pending",
    },

    // ✅ المقدمون المهتمون والعروض
    Interested: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    WithdrawnInterested: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    offers: [
      {
        provider: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        proposedPrice: { type: Number, required: true },
        description: String,
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected", "withdrawn_conflict"],
          default: "pending",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Performance Indexes
OrderSchema.index({ patient: 1, status: 1 });
OrderSchema.index({ provider: 1, status: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ status: 1, appointmentDate: 1 });
OrderSchema.index({ medicalServiceType: 1, status: 1 });
OrderSchema.index({ meetingPoint: "2dsphere" });

let OrderModel;

const getOrderModel = () => {
  if (OrderModel) return OrderModel;
  const db = getOrderDB();
  OrderModel = db.model("order", OrderSchema);
  return OrderModel;
};

module.exports = { getOrderModel };
