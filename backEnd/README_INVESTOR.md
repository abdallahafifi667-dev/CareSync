# 🚀 Users Payment Service — Technical Documentation

> **الإصدار:** 2.0.0  
> **آخر تحديث:** January 2026  
> **الغرض:** وثيقة تقنية شاملة لخدمة إدارة المستخدمين والمدفوعات

---

## 📋 جدول المحتويات

1. [الملخص التنفيذي](#-الملخص-التنفيذي)
2. [الهندسة المعمارية](#-الهندسة-المعمارية)
3. [نظام المصادقة والتوكنات](#-نظام-المصادقة-والتوكنات)
4. [نماذج البيانات](#-نماذج-البيانات)
5. [نظام KYC والتحقق من الهوية](#-نظام-kyc-والتحقق-من-الهوية)
6. [الإشعارات ونظام FCM](#-الإشعارات-ونظام-fcm)
7. [البنية التحتية والخدمات](#-البنية-التحتية-والخدمات)
8. [نظام المراقبة والتتبع](#-نظام-المراقبة-والتتبع)
9. [الأمان والحماية](#-الأمان-والحماية)
10. [واجهات API](#-واجهات-api)
11. [التشغيل والنشر](#-التشغيل-والنشر)
12. [المخاطر والتخفيف](#-المخاطر-والتخفيف)
13. [مقاييس النجاح](#-مقاييس-النجاح)

---

## 📊 الملخص التنفيذي

### ما هو users_Payment؟

خدمة **users_Payment** هي العمود الفقري لنظام إدارة المستخدمين في منصة السفر والسياحة. تتولى:

| الوظيفة          | الوصف                                         |
| ---------------- | --------------------------------------------- |
| 🔐 **المصادقة**  | تسجيل المستخدمين، تسجيل الدخول، إدارة الجلسات |
| 💳 **المحفظة**   | إدارة أرصدة المستخدمين والعمولات              |
| 📋 **KYC**       | التحقق من الهوية ورفع المستندات               |
| 🔔 **الإشعارات** | Firebase Cloud Messaging (FCM)                |
| 📍 **الموقع**    | تتبع وتحديث مواقع المستخدمين الجغرافية        |
| 🌐 **اللغات**    | إدارة لغات المستخدم وفيديوهات الإثبات         |

### القيمة الرئيسية

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✅ تجربة مستخدم سلسة: تسجيل → تحقق → تفعيل → استخدام                       │
│  ✅ أمان عالي: تشفير AES-256 + JWT مشفر + Rate Limiting                      │
│  ✅ قابلية للتوسع: Kafka + Redis + Workers منفصلة                            │
│  ✅ مراقبة كاملة: Prometheus metrics + Health checks + Audit logging         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ الهندسة المعمارية

### نظرة عامة على المكونات

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           users_Payment Service                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Routes    │  │ Controllers │  │ Middlewares │  │   Models    │       │
│  │  ─────────  │  │  ─────────  │  │  ─────────  │  │  ─────────  │       │
│  │ • users     │  │ • auth      │  │ • security  │  │ • User      │       │
│  │ • profile   │  │ • profile   │  │ • verifyTkn │  │ • Wallet    │       │
│  │ • languages │  │ • docVerify │  │ • rateLimt  │  │ • KYC       │       │
│  │ • reviews   │  │ • language  │  │ • cloudinary│  │ • Audit     │       │
│  │ • system    │  │ • review    │  │ • error     │  │ • Review    │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Config    │  │    Utils    │  │   Workers   │  │ Monitoring  │       │
│  │  ─────────  │  │  ─────────  │  │  ─────────  │  │  ─────────  │       │
│  │ • MongoDB   │  │ • encrypt   │  │ • profile   │  │ • metrics   │       │
│  │ • Kafka     │  │ • email     │  │ • review    │  │ • health    │       │
│  │ • Redis     │  │ • FCMClean  │  │             │  │ • logger    │       │
│  │ • Firebase  │  │ • audit     │  │             │  │             │       │
│  │ • Cloudinary│  │             │  │             │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          External Services                                 │
├────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ MongoDB  │  │  Redis   │  │  Kafka   │  │ Firebase │  │Cloudinary│     │
│  │ (Users)  │  │ (Cache)  │  │ (Events) │  │  (FCM)   │  │ (Media)  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│  ┌──────────┐                                                              │
│  │ MongoDB  │                                                              │
│  │ (Audit)  │                                                              │
│  └──────────┘                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### هيكل المجلدات

```
users_Payment/
├── app.js                          # نقطة الدخول الرئيسية
├── bin/www                         # HTTP Server bootstrap
├── package.json                    # التبعيات
├── docker-compose.yml              # Docker orchestration
├── .env                            # متغيرات البيئة
│
├── config/                         # إعدادات الاتصال
│   ├── conectet.js                 # MongoDB connections (Users + Audit)
│   ├── kafka.js                    # Kafka producer/consumer
│   ├── redis.js                    # Redis client
│   ├── firebase.js                 # Firebase Admin SDK
│   ├── cloudinary.js               # Cloudinary config
│   └── bullQueue.js                # Bull queue for background jobs
│
├── controllers/                    # منطق الأعمال
│   ├── authcontroller.js           # تسجيل/دخول/خروج
│   ├── profileUser.js              # إدارة الملف الشخصي
│   ├── documentVerificationController.js  # KYC والتحقق
│   ├── languageController.js       # إدارة اللغات
│   ├── reviewController.js         # التقييمات
│   ├── cloudinaryWebhook.js        # Webhooks للوسائط
│   ├── forgetpassword.controllers.js      # استعادة كلمة المرور
│   └── Notification/
│       └── notificationService.js  # خدمة الإشعارات
│
├── middlewares/                    # الوسطاء
│   ├── security.js                 # Helmet, CORS, Rate Limiting, XSS
│   ├── verifytoken.js              # التحقق من JWT
│   ├── genarattokenandcookies.js   # توليد التوكنات
│   ├── cloudinaryWebhookAuth.js    # التحقق من Cloudinary webhooks
│   ├── error.js                    # معالجة الأخطاء
│   ├── RemainingAccount.js         # التحقق من الرصيد
│   └── updateProductRating.js      # تحديث التقييمات
│
├── models/                         # نماذج Mongoose
│   ├── users.models.js             # User + Wallet + KYC schemas
│   ├── Audit.models.js             # سجل الأحداث
│   ├── Review.models.js            # التقييمات
│   └── countries.json              # قائمة الدول
│
├── routes/                         # طرق API
│   ├── users.js                    # /users/* endpoints
│   ├── profile.js                  # /api/user/* endpoints
│   ├── languages.js                # /api/user/languages/* endpoints
│   ├── reviewRoutes.js             # /api/review/* endpoints
│   ├── forgetpassword.js           # /forget-password/* endpoints
│   └── systemMonitoring.js         # /api/system/* endpoints
│
├── util/                           # أدوات مساعدة
│   ├── encryption.js               # AES-256-CBC encryption
│   ├── sendGemail.js               # Email service (Nodemailer)
│   ├── auditLogger.js              # Audit logging
│   ├── FCMCleanupService.js        # تنظيف FCM tokens
│   └── initServices.js             # تهيئة الخدمات
│
├── workers/                        # معالجات الخلفية
│   ├── profileWorker.js            # معالجة تحديثات الملف الشخصي
│   └── reviewWorker.js             # معالجة التقييمات
│
├── validators/                     # Joi validators
│   ├── AuthValidator.js            # تحقق من بيانات المصادقة
│   ├── ProfileValidator.js         # تحقق من بيانات الملف الشخصي
│   └── NotificationValidator.js    # تحقق من بيانات الإشعارات
│
├── monitoring/                     # المراقبة
│   ├── metrics.js                  # Prometheus metrics
│   └── health.js                   # Health check endpoints
│
└── infrastructure/                 # البنية التحتية
    └── eventBus.js                 # EventBus (Kafka + Redis)
```

---

## 🔐 نظام المصادقة والتوكنات

### استراتيجية التوكنات

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Token Flow Architecture                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐                                    ┌─────────────┐         │
│   │   Mobile    │ ─────── Login Request ───────────▶ │   Server    │         │
│   │    App      │                                    │             │         │
│   └─────────────┘                                    └──────┬──────┘         │
│         │                                                   │                │
│         │                                                   ▼                │
│         │                                    ┌──────────────────────────┐    │
│         │                                    │  Generate Token Pair     │    │
│         │                                    │  • Access Token (7d)     │    │
│         │                                    │  • Refresh Token (365d)  │    │
│         │                                    └──────────────────────────┘    │
│         │                                                   │                │
│         │                                                   ▼                │
│         │                                    ┌──────────────────────────┐    │
│         │                                    │  Encrypt with AES-256   │    │
│         │                                    │  Format: iv:encrypted   │    │
│         │                                    └──────────────────────────┘    │
│         │                                                   │                │
│         │  ◀──────────── Encrypted Tokens ──────────────────┘                │
│         │                                                                    │
│   ┌─────▼─────┐                                                              │
│   │  Store    │  Access Token → auth-token header                            │
│   │  Locally  │  Refresh Token → refresh-token header                        │
│   └───────────┘                                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### تفاصيل التوكنات

| النوع             | المدة   | الاستخدام          | التخزين                 |
| ----------------- | ------- | ------------------ | ----------------------- |
| **Access Token**  | 7 أيام  | طلبات API          | Header: `auth-token`    |
| **Refresh Token** | 365 يوم | تجديد Access Token | Header: `refresh-token` |

### عملية التشفير

```javascript
// util/encryption.js

// 1. توليد JWT
jwt.sign({ id, email, role, type }, JWT_SECRET, { expiresIn });

// 2. تشفير AES-256-CBC
const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
// Output: iv:encryptedData

// 3. Cache in Redis
cacheToken(tokenHash, decoded, 604800); // 7 days TTL
```

### API Endpoints للمصادقة

| Method  | Endpoint                | Description                 |
| ------- | ----------------------- | --------------------------- |
| `POST`  | `/users/register`       | تسجيل مستخدم جديد           |
| `POST`  | `/users/login`          | تسجيل الدخول                |
| `POST`  | `/users/verifyEmail`    | التحقق من البريد الإلكتروني |
| `POST`  | `/users/viledLogin`     | تحديث FCM token             |
| `POST`  | `/users/logout`         | تسجيل الخروج                |
| `POST`  | `/users/auth/refresh`   | تجديد Access Token          |
| `PATCH` | `/users/updateLocation` | تحديث الموقع الجغرافي       |

---

## 📦 نماذج البيانات

### User Schema

```javascript
UserSchema = {
  // Core Identity
  role: 'guide' | 'normal' | 'admin',
  username: String,
  email: {
    address: String,
    verified: Boolean,
    verificationCode: String
  },
  password: String (hashed),
  phone: String,
  avatar: String,

  // Location
  location: {
    type: 'Point',
    coordinates: [longitude, latitude]
  },
  country: String,
  Address: String,

  // Profile
  PersonalPhoto: [String],
  description: String,
  languages: [{
    name: String,
    proficiency: 'beginner' | 'intermediate' | 'advanced' | 'native',
    video: String
  }],

  // Transportation (for guides)
  transportation: {
    hasVehicle: Boolean,
    vehicleType: 'car' | 'bus' | 'none',
    description: String
  },

  // FCM
  fcmTokens: [String] (max 5)
}
```

### UserWallet Schema

```javascript
UserWalletSchema = {
  userId: ObjectId (ref: User),

  // Balance Management
  RemainingAccount: Number,    // الرصيد المتبقي
  targetAccount: Number,       // الرصيد المستهدف
  wallet: Number,              // المحفظة الرئيسية
  balance: Number,             // رصيد المرشد السياحي

  // Commission Tracking
  commissionDebt: Number,      // ديون العمولة
  commissionOperationCount: Number
}
```

### UserKYC Schema

```javascript
UserKYCSchema = {
  userId: ObjectId (ref: User),

  // Verification Status
  documentation: Boolean,
  verificationLevel: 'none' | 'basic' | 'full',

  // Identity
  identityNumber: String,
  identityType: 'national_id' | 'passport' | 'driver_license',
  dateOfBirth: Date,

  // Documents
  documentPhoto: String,       // ID photo URL
  guideDocument: String,       // Guide certification URL

  // OCR Data
  idVerificationData: {
    extractedText: String,
    extractedId: String,
    extractedDateOfBirth: Date,
    idType: String,
    verifiedAt: Date,
    verificationSource: String
  },

  // Pending Documents (30 min expiry)
  pendingDocuments: {
    selfie: { url, publicId, uploadedAt },
    idCard: { url, publicId, uploadedAt },
    guideDocument: { url, publicId, uploadedAt },
    expiresAt: Date,
    verificationStatus: 'pending' | 'processing' | 'completed' | 'failed'
  },

  // Risk Assessment
  riskScore: {
    level: 'low' | 'medium' | 'high',
    factors: [String],
    calculatedAt: Date
  },

  // Retry Limits
  kycAttempts: {
    count: Number,
    lastAttemptAt: Date,
    lockedUntil: Date
  }
}
```

### Audit Schema

```javascript
AuditSchema = {
  userId: ObjectId,
  ip: String,
  action: String,
  details: [Array],
  createdAt: Date,
};

// TTL Index: 90 days auto-cleanup
```

---

## 🆔 نظام KYC والتحقق من الهوية

### عملية التحقق

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         KYC Verification Flow                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Request Signature                                                        │
│  ┌─────────┐      POST /users/cloudinary/sign-upload      ┌─────────┐       │
│  │  App    │ ──────────────────────────────────────────▶ │ Server  │       │
│  └─────────┘                                              └────┬────┘       │
│       │                                                        │             │
│       │ ◀──────── { signature, timestamp, uploadUrl } ─────────┘             │
│       │                                                                      │
│  2. Upload Documents to Cloudinary                                           │
│       │                                                                      │
│       │ ────── Upload selfie ────────▶ ┌────────────┐                       │
│       │ ────── Upload idCard ────────▶ │ Cloudinary │                       │
│       │ ────── Upload guideDoc ──────▶ └─────┬──────┘                       │
│       │                                      │                               │
│       │                                      │ Webhook                       │
│       │                                      ▼                               │
│       │                              POST /users/verifyDocuments/webhook     │
│       │                              ┌─────────────────┐                     │
│       │                              │    Server       │                     │
│       │                              │  • Store URLs   │                     │
│       │                              │  • Check both   │                     │
│       │                              │    uploaded     │                     │
│       │                              └────────┬────────┘                     │
│       │                                       │                              │
│  3. Document Processing (Auto-triggered when both selfie + idCard ready)     │
│                                               │                              │
│    ┌──────────────────────────────────────────▼───────────────────────────┐  │
│    │                    Google Vision API Processing                      │  │
│    ├─────────────────────────────────────────────────────────────────────┤  │
│    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│    │  │ Face Detect │  │  Liveness   │  │ Text/OCR   │  │ Face Match  │ │  │
│    │  │  Detection  │  │   Check     │  │ Extraction │  │  Compare    │ │  │
│    │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│    │         │                │                │                │        │  │
│    │         └────────────────┼────────────────┼────────────────┘        │  │
│    │                          ▼                ▼                         │  │
│    │                   ┌─────────────────────────────────┐               │  │
│    │                   │      Risk Score Calculation     │               │  │
│    │                   │  • Face matching quality        │               │  │
│    │                   │  • Document authenticity        │               │  │
│    │                   │  • ID format validation         │               │  │
│    │                   │  • Duplicate ID check           │               │  │
│    │                   │  • Age verification (18+)       │               │  │
│    │                   └─────────────────────────────────┘               │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  4. Result                                                                   │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │  documentation: true/false                                         │   │
│    │  riskScore: { level: 'low'|'medium'|'high', factors: [...] }       │   │
│    │  verificationLevel: 'none'|'basic'|'full'                          │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### وظائف التحقق

| الدالة                            | الوصف                                      |
| --------------------------------- | ------------------------------------------ |
| `detectFaceInImage()`             | كشف الوجه في الصورة باستخدام Google Vision |
| `checkFaceLiveness()`             | التحقق من حيوية الصورة (ليست صورة لصورة)   |
| `detectImageManipulation()`       | كشف التلاعب بالصورة                        |
| `extractTextFromDocument()`       | استخراج النص من بطاقة الهوية (OCR)         |
| `compareFacesFromUrls()`          | مقارنة الوجه في السيلفي مع بطاقة الهوية    |
| `validateInternationalIdFormat()` | التحقق من صحة تنسيق رقم الهوية حسب الدولة  |
| `checkDuplicateId()`              | التحقق من عدم تكرار رقم الهوية             |
| `verifyAge()`                     | التحقق من العمر (18+ سنة)                  |
| `calculateRiskScore()`            | حساب درجة المخاطر                          |

### الدول المدعومة للتحقق

- 🇪🇬 Egypt: `^(2|3)[0-9]{13}$`
- 🇸🇦 Saudi Arabia: `^[12][0-9]{9}$`
- 🇦🇪 UAE: `^784-[0-9]{4}-[0-9]{7}-[0-9]$`
- 🇺🇸 USA (SSN): `^[0-9]{3}-[0-9]{2}-[0-9]{4}$`
- 🇬🇧 UK (National Insurance): `^[A-Z]{2}[0-9]{6}[A-Z]$`
- 🌍 Generic: Alphanumeric 5-20 chars

### حدود المحاولات

```javascript
KYC_MAX_ATTEMPTS = 5;
KYC_LOCKOUT_DURATION = 24 * 60 * 60 * 1000; // 24 hours
```

---

## 🔔 الإشعارات ونظام FCM

### Firebase Cloud Messaging

```javascript
// controllers/Notification/notificationService.js

class NotificationService {
  // إرسال لجهاز واحد
  static async sendToDevice(token, title, body, data = {})

  // إرسال لعدة أجهزة
  static async sendToMultipleDevices(tokens, title, body, data = {})

  // إرسال لموضوع (Topic)
  static async sendToTopic(topic, title, body, data = {})
}
```

### خدمة تنظيف FCM Tokens

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        FCM Cleanup Service                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐                           ┌─────────────┐                  │
│  │ Bull Queue  │ ◀──── Scheduled Jobs ────▶│ Processor   │                  │
│  │  (cleanup)  │                           │             │                  │
│  └─────────────┘                           └──────┬──────┘                  │
│                                                   │                          │
│  Schedules:                                       ▼                          │
│  • Weekly (Mon 3:00 AM): كل المستخدمين    ┌─────────────────┐              │
│  • Daily (4:00 AM): فحص النشاط            │ For each user:  │              │
│                                            │ • Test token    │              │
│                                            │   (dryRun)      │              │
│  ┌─────────────────────────────────────┐   │ • Remove if     │              │
│  │ Max 5 FCM tokens per user           │   │   invalid       │              │
│  │ Auto-cleanup older tokens on save   │   └─────────────────┘              │
│  └─────────────────────────────────────┘                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏭 البنية التحتية والخدمات

### EventBus (Kafka + Redis)

```javascript
// infrastructure/eventBus.js

class EventBus {
  // الاتصال بـ Redis و Kafka
  async connect()

  // نشر حدث
  async publish(topic, data)

  // نشر حدث طلب
  async publishOrderEvent(eventType, orderData, userData)

  // الاشتراك في موضوع
  async subscribe(topic, handler)

  // الحصول على مقاييس
  getMetrics()
}
```

### Kafka Configuration

```javascript
// config/kafka.js

const kafka = new Kafka({
  clientId: "travel-platform",
  brokers: ["localhost:9092"],
  connectionTimeout: 3000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

// Topics:
// - document-verification
// - profile-updates
// - order-events
```

### Redis Configuration

```javascript
// config/redis.js

const redis = createClient({
  url: process.env.REDIS_URL,
});

// Uses:
// - Token caching
// - Session storage
// - Rate limiting
```

### Docker Compose

```yaml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0

  kafka:
    image: confluentinc/cp-kafka:7.5.0

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--save", "60", "1", "--appendonly", "yes"]
```

---

## 📊 نظام المراقبة والتتبع

### Prometheus Metrics

| Metric                                          | Type      | Description              |
| ----------------------------------------------- | --------- | ------------------------ |
| `trip_monitoring_trips_started_total`           | Counter   | إجمالي الرحلات التي بدأت |
| `trip_monitoring_trips_completed_total`         | Counter   | إجمالي الرحلات المكتملة  |
| `trip_monitoring_active_trips`                  | Gauge     | الرحلات النشطة حالياً    |
| `trip_monitoring_http_request_duration_seconds` | Histogram | زمن استجابة HTTP         |
| `trip_monitoring_events_published_total`        | Counter   | الأحداث المنشورة         |
| `trip_monitoring_events_consumed_total`         | Counter   | الأحداث المستهلكة        |

### Health Endpoints

| Endpoint            | Description                |
| ------------------- | -------------------------- |
| `GET /health`       | حالة الخدمة العامة         |
| `GET /health/live`  | Kubernetes liveness probe  |
| `GET /health/ready` | Kubernetes readiness probe |
| `GET /health/redis` | حالة Redis                 |
| `GET /health/kafka` | حالة Kafka                 |
| `GET /health/db`    | حالة MongoDB               |
| `GET /metrics`      | Prometheus metrics         |
| `GET /stats`        | إحصائيات النظام            |

### Audit Logging

```javascript
// util/auditLogger.js

logUserAction({
  user: userId, // معرف المستخدم
  ip: req.ip, // عنوان IP
  action: "user", // نوع الإجراء
  details: {
    action: "login",
    subject: "login",
    error: null, // أو رسالة الخطأ
  },
});

// Auto-cleanup: 90 days TTL
```

---

## 🛡️ الأمان والحماية

### Security Middleware Stack

```javascript
// middlewares/security.js

module.exports = (app) => {
  // 1. Helmet - HTTP Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: true,
    }),
  );

  // 2. CORS Configuration
  app.use(
    cors({
      origin: whitelist,
      credentials: true,
    }),
  );

  // 3. Request Body Parsing
  app.use(express.json({ limit: "10kb" }));

  // 4. XSS Protection
  app.use(xss());

  // 5. MongoDB Injection Prevention
  app.use(mongoSanitize());

  // 6. HTTP Parameter Pollution Prevention
  app.use(hpp());

  // 7. Compression
  app.use(compression());

  // 8. Rate Limiting
  // - General: 100 requests / 15 min
  // - Auth: 5 requests / 15 min
  // - Upload: 10 requests / 15 min

  // 9. User Agent Parsing
  app.use(useragent.express());

  // 10. Request Logging
  app.use(morgan("combined"));
};
```

### Rate Limits

| الفئة                 | الحد    | النافذة  |
| --------------------- | ------- | -------- |
| General               | 100 طلب | 15 دقيقة |
| Auth (Login/Register) | 5 طلب   | 15 دقيقة |
| Upload                | 10 طلب  | 15 دقيقة |
| Password Reset        | 3 طلب   | 60 دقيقة |

### Token Security

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Token Security Layers                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: JWT Signing                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' })             │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  Layer 2: AES-256-CBC Encryption                                            │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)                     │     │
│  │  crypto.createCipheriv('aes-256-cbc', key, iv)                     │     │
│  │  Output: iv:encryptedData                                          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  Layer 3: Redis Caching (Performance + Revocation)                          │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  Token Hash → Decoded Payload                                      │     │
│  │  TTL: 7 days (matches access token expiry)                         │     │
│  │  Instant revocation via cache deletion                             │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌐 واجهات API

### Authentication Routes (`/users/*`)

| Method | Endpoint          | Auth       | Description       |
| ------ | ----------------- | ---------- | ----------------- |
| POST   | `/register`       | ❌         | تسجيل مستخدم جديد |
| POST   | `/login`          | ❌         | تسجيل الدخول      |
| POST   | `/verifyEmail`    | ✅ Partial | التحقق من البريد  |
| POST   | `/viledLogin`     | ✅ Partial | تحديث FCM token   |
| POST   | `/logout`         | ✅ Partial | تسجيل الخروج      |
| PATCH  | `/updateLocation` | ✅ Full    | تحديث الموقع      |
| POST   | `/auth/refresh`   | ❌         | تجديد التوكن      |

### Profile Routes (`/api/user/*`)

| Method | Endpoint                  | Auth       | Description             |
| ------ | ------------------------- | ---------- | ----------------------- |
| GET    | `/profile/:id`            | ✅ Partial | الحصول على الملف الشخصي |
| PUT    | `/profile/put/:id`        | ✅ Owner   | تحديث الملف الشخصي      |
| GET    | `/profile/orders/:id`     | ✅ Partial | الطلبات المكتملة        |
| GET    | `/profile/order/:id`      | ✅ Partial | تفاصيل طلب              |
| GET    | `/transportation/:id`     | ✅ Partial | معلومات المواصلات       |
| PUT    | `/transportation/:id`     | ✅ Owner   | تحديث المواصلات         |
| POST   | `/cloudinary/sign-upload` | ✅ Full    | توقيع رفع الوسائط       |

### Language Routes (`/api/user/languages/*`)

| Method | Endpoint         | Auth       | Description  |
| ------ | ---------------- | ---------- | ------------ |
| POST   | `/`              | ✅ Full    | إضافة لغة    |
| GET    | `/`              | ✅ Partial | قائمة اللغات |
| PUT    | `/:languageName` | ✅ Full    | تحديث لغة    |
| DELETE | `/:languageName` | ✅ Full    | حذف لغة      |

### KYC Routes (`/users/*`)

| Method | Endpoint                   | Auth           | Description         |
| ------ | -------------------------- | -------------- | ------------------- |
| POST   | `/cloudinary/sign-upload`  | ✅ Partial     | توقيع رفع المستندات |
| POST   | `/verifyDocuments/webhook` | Cloudinary Sig | استقبال المستندات   |
| POST   | `/verifyDocuments/trigger` | ✅ Full        | بدء التحقق يدوياً   |

### System Routes (`/api/system/*`)

| Method | Endpoint   | Auth | Description        |
| ------ | ---------- | ---- | ------------------ |
| GET    | `/health`  | ❌   | حالة الخدمة        |
| GET    | `/metrics` | ❌   | Prometheus metrics |
| GET    | `/stats`   | ❌   | إحصائيات النظام    |

### مستويات المصادقة

| Level      | Description                                        |
| ---------- | -------------------------------------------------- |
| ❌         | بدون مصادقة                                        |
| ✅ Partial | `verifyTokenUpPhoto` - توكن صالح فقط               |
| ✅ Full    | `verifyToken` - توكن + بريد مؤكد + KYC مكتمل       |
| ✅ Owner   | `verifyTokenAndAuthorization` - Full + مالك المورد |

---

## 🚀 التشغيل والنشر

### متطلبات البيئة

```env
# Server
PORT=3000
NODE_ENV=production

# MongoDB
MONGO_URL_USERS=mongodb://localhost:27017/users
MONGO_URL_AUDIT=mongodb://localhost:27017/audit

# Security
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-char-encryption-key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Firebase
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-email

# Google Vision (KYC)
GOOGLE_VISION_CREDENTIALS={"type":"service_account",...}

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=travel-platform
KAFKA_CONSUMER_GROUP=main-group

# Redis
REDIS_URL=redis://localhost:6379

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
```

### التشغيل المحلي

```bash
# 1. تثبيت التبعيات
npm install

# 2. تشغيل البنية التحتية
docker-compose up -d

# 3. تشغيل الخادم
npm start
```

### النشر الإنتاجي

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Production Deployment Architecture                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Kubernetes Cluster                           │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │    │
│  │  │  Pod: API   │  │  Pod: API   │  │  Pod: API   │  (HPA)          │    │
│  │  │  Replicas   │  │  Replicas   │  │  Replicas   │                 │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │    │
│  │         │                │                │                        │    │
│  │         └────────────────┼────────────────┘                        │    │
│  │                          │                                         │    │
│  │                   ┌──────▼──────┐                                  │    │
│  │                   │  Service    │                                  │    │
│  │                   │  (LB)       │                                  │    │
│  │                   └─────────────┘                                  │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Managed Services                             │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                     │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐       │    │
│  │  │  MongoDB  │  │  Redis    │  │  Kafka    │  │ Cloudinary│       │    │
│  │  │  Atlas    │  │  Cloud    │  │ Confluent │  │           │       │    │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘       │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ المخاطر والتخفيف

| المخاطر                    | التأثير         | التخفيف                         |
| -------------------------- | --------------- | ------------------------------- |
| فشل Kafka                  | تأخر الأحداث    | Retry mechanism + SQS fallback  |
| فشل Redis                  | بطء التوكنات    | Database fallback               |
| فشل KYC                    | توقف التحقق     | Manual verification queue       |
| هجمات Brute Force          | اختراق          | Rate limiting + Account lockout |
| تسريب البيانات             | فقدان الثقة     | AES encryption + Audit logs     |
| Cloudinary Webhook Failure | فقدان المستندات | Webhook signature verification  |

---

## 📈 مقاييس النجاح (KPIs)

| المقياس             | الهدف                     |
| ------------------- | ------------------------- |
| Response Time (p95) | < 300ms                   |
| Kafka Delivery Rate | > 99.9%                   |
| KYC Processing Time | < 2 min (90th percentile) |
| Service Uptime      | > 99.9%                   |
| Auth Success Rate   | > 99.5%                   |
| FCM Delivery Rate   | > 98%                     |

---

## 📞 للديمو والعرض

### سيناريو العرض

1. **تسجيل مستخدم جديد** → إظهار تلقي كود التحقق
2. **التحقق من البريد** → تأكيد الحساب
3. **رفع مستندات KYC** → إظهار عملية التحقق
4. **تفعيل الحساب** → الوصول الكامل للخدمات
5. **تحديث الملف الشخصي** → عبر Kafka async
6. **فحص Health endpoints** → جاهزية الخدمة

### الأسئلة المتوقعة

| السؤال              | الإجابة                                    |
| ------------------- | ------------------------------------------ |
| How secure is it?   | AES-256 + JWT + Rate Limiting + Audit Logs |
| How scalable?       | Kafka workers + Kubernetes ready           |
| Cost estimation?    | MongoDB Atlas + Confluent + Redis Cloud    |
| Time to production? | 2-3 weeks with CI/CD setup                 |

---

> **تم إعداد هذا المستند بواسطة فريق التطوير**  
> **آخر تحديث:** January 2026
