export interface IApiResponse<T = any> {
    status: 'success' | 'fail' | 'error';
    message?: string;
    data?: T;
    results?: number;
}

export interface IErrorResponse {
    status: 'fail' | 'error';
    message: string;
    error?: any;
    stack?: string;
}

export interface IPaginationQuery {
    page?: number;
    limit?: number;
    sort?: string;
    fields?: string;
}

export interface IPaginatedResponse<T> extends IApiResponse<T> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
