const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userModel"); // Adjust the path to your actual User model

// Passport session setup: Serialize and Deserialize user from the session
passport.serializeUser((user, done) => {
  done(null, user.id); // Store the user id in session
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy Configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,  // Google OAuth client ID
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,  // Google OAuth client secret
      callbackURL: process.env.GOOGLE_CALLBACK_URL,  // The callback URL where Google redirects after authentication
    },
    async (token, tokenSecret, profile, done) => {
      try {
        // Check if the user already exists in the DB
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // If no user exists, create a new one
          user = new User({
            googleId: profile.id,
            email: profile.emails[0].value,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            role: "user", // You can customize roles as per your requirements
          });

          await user.save();
        }

        // Return the user to Passport's callback function
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);
