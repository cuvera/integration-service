# Cuvera-core API

A complete REST API built with Node.js, Express.js, MongoDB, and TypeScript following MVC architecture.

## Features

- ✅ **TypeScript** - Full TypeScript support with strict type checking
- ✅ **Express.js** - Fast, unopinionated web framework
- ✅ **MongoDB** - NoSQL database with Mongoose ODM
- ✅ **MVC Architecture** - Proper separation of concerns
- ✅ **ES Modules** - Modern JavaScript module system
- ✅ **Swagger UI** - Interactive API documentation
- ✅ **Error Handling** - Centralized error handling middleware
- ✅ **Security** - Helmet, CORS, and input validation
- ✅ **Code Quality** - ESLint with Airbnb config and Prettier

## Project Structure

```
project-root/
├── src/
│   ├── config/          # Database and app configuration
│   │   ├── database.ts
│   │   └── swagger.ts
│   ├── controllers/     # Request handlers
│   │   └── userController.ts
│   ├── models/          # Database models
│   │   └── User.ts
│   ├── routes/          # API routes
│   │   └── userRoutes.ts
│   ├── services/        # Business logic
│   │   └── userService.ts
│   ├── middlewares/     # Custom middleware
│   │   └── errorHandler.ts
│   ├── utils/           # Utility functions
│   │   ├── appError.ts
│   │   └── catchAsync.ts
│   └── app.ts           # Main application file
├── .env.example         # Environment variables template
├── .eslintrc.json       # ESLint configuration
├── .prettierrc          # Prettier configuration
├── nodemon.json         # Nodemon configuration
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd node-express-mongodb-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` file with your configuration:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/your-database-name
   NODE_ENV=development
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run the application**

   **Development mode:**
   ```bash
   npm run dev
   ```

   **Production mode:**
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST   | `/api/v1/auth/register` | Register a new user | No |
| POST   | `/api/v1/auth/login` | Login user | No |
| POST   | `/api/v1/auth/refresh-token` | Refresh access token | No |
| POST   | `/api/v1/auth/logout` | Logout user | No |
| GET    | `/api/v1/auth/me` | Get current user profile | Yes |

### Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST   | `/api/v1/users` | Create a new user | No |
| GET    | `/api/v1/users` | Get all users | Yes |
| GET    | `/api/v1/users/:id` | Get user by ID | Yes |

### Example Requests

**Register User:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

**Login User:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Access Protected Route:**
```bash
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Refresh Token:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

## API Documentation

Interactive API documentation is available at:
- **Swagger UI**: http://localhost:3000/api-docs

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/defaultdb` |
| `NODE_ENV` | Environment mode | `development` |
| `JWT_SECRET` | JWT secret key for access tokens | Required |
| `JWT_EXPIRES_IN` | Access token expiration time | `15m` |
| `JWT_REFRESH_SECRET` | JWT secret key for refresh tokens | Required |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration time | `7d` |
| `JWT_COOKIE_EXPIRES_IN` | Cookie expiration time (days) | `7` |

## Error Handling

The API includes comprehensive error handling:

- **Validation Errors** - Mongoose validation errors
- **Cast Errors** - Invalid ObjectId format
- **Duplicate Key Errors** - Unique constraint violations
- **Custom App Errors** - Business logic errors

## Security Features

- **Helmet** - Sets various HTTP headers
- **CORS** - Cross-Origin Resource Sharing
- **Input Validation** - Mongoose schema validation
- **Password Hashing** - bcryptjs for secure password storage

## Development

### Code Style

This project uses:
- **ESLint** with Airbnb configuration
- **Prettier** for code formatting
- **TypeScript** for type safety

### Adding New Features

1. Create model in `src/models/`
2. Create service in `src/services/`
3. Create controller in `src/controllers/`
4. Create routes in `src/routes/`
5. Add Swagger documentation
6. Update this README

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
