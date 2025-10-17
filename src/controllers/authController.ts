import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/appError';

import { IRegisterRequest, ILoginRequest, IRefreshTokenRequest, IApiResponse, IAuthResponse } from '../interfaces';

const createSendToken = (user: any, tokens: any, statusCode: number, res: Response) => {
    const cookieOptions = {
        expires: new Date(
            Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRES_IN!) || 7) * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
    };

    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    // Remove password from output
    user.password = undefined;

    const authResponse: IAuthResponse = {
        user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
        },
        tokens,
    };

    const response: IApiResponse<IAuthResponse> = {
        status: 'success',
        data: authResponse,
    };

    res.status(statusCode).json(response);
};

export const register = catchAsync(async (req: Request, res: Response) => {
    const { name, email, password, confirmPassword }: IRegisterRequest = req.body;

    if (!name || !email || !password || !confirmPassword) {
        throw new AppError('Please provide name, email, password, and confirm password', 400);
    }

    createSendToken('user', 'tokens', 201, res);
});