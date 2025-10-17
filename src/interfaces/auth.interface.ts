export interface ILoginRequest {
    email: string;
    password: string;
}

export interface IRegisterRequest {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export interface ITokens {
    accessToken: string;
    refreshToken: string;
}

export interface IAuthResponse {
    user: {
        id: string;
        name: string;
        email: string;
    };
    tokens: ITokens;
}

export interface IJwtPayload {
    id: string;
    email: string;
    iat?: number;
    exp?: number;
}

export interface IRefreshTokenRequest {
    refreshToken: string;
}
