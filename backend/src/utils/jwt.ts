import jwt, { Secret, JwtPayload } from 'jsonwebtoken';
import { config } from '../config/app.config';

export const generateToken = (payload: Record<string, any>, expiresIn = '1d') => {
  return jwt.sign(
    payload, 
    config.JWT_SECRET as Secret, 
    { expiresIn } as jwt.SignOptions
  );
};

export const verifyToken = (token: string): Promise<JwtPayload | string> => {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token, 
      config.JWT_SECRET as Secret, 
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded as JwtPayload | string);
      }
    );
  });
};
