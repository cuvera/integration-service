import { Document, Types } from 'mongoose';

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password: string;
    googleId?: string;
    samlId?: string;
    avatar?: string;
    provider: 'local' | 'google' | 'saml';
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface ICreateUserRequest {
    name: string;
    email: string;
    password: string;
}

export interface IUserResponse {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt?: Date;
}

export interface IUpdateUserRequest {
    name?: string;
    email?: string;
    password?: string;
}
