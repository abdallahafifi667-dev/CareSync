"use strict";

require("dotenv").config();
const express = require("express");
const { connect } = require("./config/conectet");
const securityMiddleware = require("./middlewares/security");
const {
  errorNotFound,
  errorHandler,
  validationErrorHandler,
  databaseErrorHandler,
  authenticationErrorHandler,
} = require("./middlewares/error");


const app = express();


const initializeApp = async () => {
  try {
    await connect();

    const orderRouter = require("./users-core/routes/order");
    const chatRouter = require("./users-core/routes/chat");
    const usersRouter = require("./users-core/routes/users");
    const forgetpassword = require("./users-core/routes/forgetpassword");
    const profileRouter = require("./users-core/routes/profile");
    const academicDegreesRouter = require("./users-core/routes/academicDegrees");
    const reviewRoutes = require("./users-core/routes/reviewRoutes");
    const paymentRouter = require("./users-core/routes/payment");



    var postsRoute = require('./plog-api/routes/postsRoute');
    var commentRoute = require('./plog-api/routes/commentRoute');
    var categoriesRouter = require('./plog-api/routes/categoriesRouter');

    const contractRouter = require('./E-commerce/routes/contractRoutes');
    const knowledgeRouter = require('./knowledge-api/routes/knowledgeRoutes');
    const ecommerceChatRouter = require('./E-commerce/routes/chatRoutes');


    securityMiddleware(app);

    // Set logger for correlation middleware
    app.set("logger", logger);

    // Attach health and metrics endpoints
    attachHealthRoutes(app, { detailed: true });



    app.use("/users", usersRouter);
    app.use("/forget-password", forgetpassword);
    app.use("/api/user", profileRouter);
    app.use("/api/user/academic-degrees", academicDegreesRouter);
    app.use("/api/review", reviewRoutes);
    app.use("/api/order", orderRouter);
    app.use("/api/chat", chatRouter);
    app.use("/api/payment", paymentRouter);


    app.use("/api/posts", postsRoute);
    app.use("/api/comment", commentRoute);
    app.use("/api/categories", categoriesRouter);
    app.use("/api/contracts", contractRouter);
    app.use("/api/knowledge", knowledgeRouter);
    app.use("/api/ecommerce-chat", ecommerceChatRouter);




    app.use(validationErrorHandler);
    app.use(databaseErrorHandler);
    app.use(authenticationErrorHandler);
    app.use(errorNotFound);
    app.use(errorHandler);
  } catch (err) {
    logger.error("Failed to initialize app:", err);
    process.exit(1);
  }
};

initializeApp();

module.exports = app;
