import passport from "passport";
import { Request } from "express";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";

import { config } from "./app.config";
import { BadRequestException, NotFoundException } from "../utils/appError";
import { ProviderEnum } from "../enums/account-provider.enum";
import {
  loginOrCreateAccountService,
  verifyUserService,
} from "../services/auth.service";
import AccountModel from "../models/account.model";

passport.use(
  new GoogleStrategy(
    {
      clientID: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackURL: config.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req: Request, _accessToken, _refreshToken, profile, done) => {
      try {
        if (!profile._json.email) {
          throw new BadRequestException("Email is required");
        }

        const { email, sub: googleId, picture } = profile._json;

        // Check if account exists first
        const existingAccount = await AccountModel.findOne({
          provider: ProviderEnum.GOOGLE,
          providerId: googleId,
        });

        if (existingAccount) {
          const { user } = await loginOrCreateAccountService({
            provider: ProviderEnum.GOOGLE,
            displayName: profile.displayName,
            providerId: googleId,
            picture: picture,
            email: email,
          });
          return done(null, user);
        }

        // Create new account
        const { user } = await loginOrCreateAccountService({
          provider: ProviderEnum.GOOGLE,
          displayName: profile.displayName,
          providerId: googleId,
          picture: picture,
          email: email,
        });

        done(null, user);
      } catch (error: any) {
        console.error("Google OAuth Error:", error);
        done(error, false);
      }
    }
  )
);

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await verifyUserService({ email, password });
        return done(null, user);
      } catch (error: any) {
        return done(error, false, { message: error?.message });
      }
    }
  )
);

passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));
