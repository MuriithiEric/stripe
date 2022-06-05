const express = require("express");
const app = express();
const { resolve } = require("path");
const nodemailer = require("nodemailer");
// Copy the .env.example in the root into a .env file in this folder
require("dotenv").config({ path: "./.env" });

// Ensure environment variables are set.
checkEnv();
let endpointSecret =
  "whsec_e6ad32f34f242f1d0ad8fc5aa90ba0f4e253eb4bbe448da7fc6221730b8b5069";
let session = "";

//this code here initializes the stripe api
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2020-08-27",
  appInfo: {
    name: "stripe-samples/accept-a-payment/prebuilt-checkout-page",
    version: "0.0.1",
    url: "https://github.com/stripe-samples",
  },
});

app.use(express.static(process.env.STATIC_DIR));
app.use(express.urlencoded());

app.get("/", (req, res) => {
  const path = resolve(process.env.STATIC_DIR + "/index.html");
  res.sendFile(path);
});

// this displays the JSON result on the success page
app.get("/checkout-session", async (req, res) => {
  const { sessionId } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  res.send(session);
});

app.post("/create-checkout-session", async (req, res) => {
  const domainURL = process.env.DOMAIN;

  //Setting up payment intents to save used cards for later
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // automatic_payment_methods: {
    //   enabled: true,
    // },
    line_items: [
      {
        price: process.env.PRICE,
        quantity: 1,
      },
    ],
    customer: "cus_Ln3nJ75ofx7o6u", //this essentially sets up the code to use the customer ID and attaches a customer's card to an email address
    payment_intent_data: {
      setup_future_usage: "on_session",
    },
    // redirects us to our other client pages
    success_url: `${domainURL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${domainURL}/canceled.html`,

    

    // automatic_tax: { enabled: true }
  });

  return res.redirect(303, session.url);
});

// Webhook for testing the endpoint locally

app.post(
  "/webhooks",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const sig = request.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.async_payment_failed":
        session = event.data.object;
        console.log(session);
        // Then define and call a function to handle the event checkout.session.async_payment_failed
        break;
      case "checkout.session.completed":
        session = event.data.object;
        console.log(session);

        let emailto = session.customer_details.email;

        // Reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: process.env.email,
            pass: process.env.password,
          },
        });

        // send mail with defined transport object
        let info = await transporter.sendMail({
          from: process.env.email, // sender address
          to: emailto, // list of receivers
          subject: "Thanks for the payment for the product", // Subject line
          text: "Thanks for the payment for the product", // plain text body
          html: `
    
    Hello ${session.customer_details.email} Thanks for the payment for the product
    
    `, // html body
        });

        console.log("Message sent: %s", info.messageId);

        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

app.listen(4200, () => console.log(`Node server listening on port ${4200}!`));

function checkEnv() {
  const price = process.env.PRICE;
  if (price !== "price_1L42mdFfKTVSOLpJsPUgcfPT") {
    console.log(
      "You must set a Price ID in the environment variables. Please see the README."
    );
    process.exit(0);
  }
}
