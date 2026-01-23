# IstekharaNow Backend - Node.js Express Migration

This is a complete migration of the IstekharaNow Django backend to Node.js with Express, maintaining 100% API compatibility.

## 🚀 Features

- ✅ Complete API compatibility with Django backend
- ✅ Same database schema (PostgreSQL)
- ✅ AWS Cognito authentication (User, Alim, Admin pools)
- ✅ AWS SES email integration
- ✅ AWS S3 file uploads
- ✅ Stripe payment integration
- ✅ PayPal webhook support
- ✅ Instagram post synchronization
- ✅ Testimonial management
- ✅ Istekhara request/response system

## 📋 Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+
- AWS Account (Cognito, SES, S3)
- Stripe Account
- PayPal Business Account (optional)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database
DB_NAME=istekhara
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# AWS Cognito
AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_CLIENT_ID_USER=your_user_client_id
AWS_COGNITO_CLIENT_ID_ALIM=your_alim_client_id
AWS_COGNITO_CLIENT_ID_ADMIN=your_admin_client_id
AWS_COGNITO_POOL_ID_USER=your_user_pool_id
AWS_COGNITO_POOL_ID_ALIM=your_alim_pool_id
AWS_COGNITO_POOL_ID_ADMIN=your_admin_pool_id

# Stripe
STRIPE_API_KEY=your_stripe_secret_key

# Application
PORT=8000
DOMAIN_NAME=http://localhost:8000
USER_WEB_DOMAIN_NAME=http://localhost:3000
```

### 3. Database Setup

The application uses the existing Django database tables. Ensure your PostgreSQL database is running and accessible.

```bash
# Test database connection
npm start
```

The application will automatically connect to the existing tables created by Django migrations.

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:8000` (or your configured PORT).

## 📡 API Endpoints

All endpoints remain identical to the Django backend:

### User Endpoints
- `GET /users` - List all users (admin only)
- `POST /users/register` - Register new user
- `POST /users/login` - User login
- `POST /users/forgot-password` - Request password reset
- `POST /users/reset-password` - Reset password
- `GET /users/auth/social` - Get social auth URL
- `GET /users/auth/decode-token` - Decode social auth token

### Alim Endpoints
- `GET /alims` - List all alims (admin only)
- `POST /alims` - Create new alim (admin only)
- `POST /alims/login` - Alim login
- `POST /alims/forgot-password` - Request password reset
- `POST /alims/reset-password` - Reset password

### Admin Endpoints
- `POST /admins` - Create admin
- `POST /admins/login` - Admin login
- `POST /admins/forgot-password` - Request password reset
- `POST /admins/reset-password` - Reset password
- `GET /admins/overview` - Get dashboard overview

### Istekhara Endpoints
- `GET /istekharas` - List istekharas (filtered by user type)
- `POST /istekharas` - Create new istekhara request
- `GET /istekharas/:id` - Get single istekhara
- `POST /istekharas/:id/reply` - Reply to istekhara (alim only)
- `GET /istekharas/:id/testimonial-eligible` - Check testimonial eligibility

### Pricing & Quota Endpoints
- `GET /istekharas/pricing` - List pricing options
- `POST /istekharas/pricing/purchase` - Purchase quota
- `GET /istekharas/purchases` - List user purchases
- `DELETE /istekharas/purchases/:id/cancel-subscription` - Cancel subscription

### Testimonial Endpoints
- `GET /testimonials` - List testimonials (paginated)
- `POST /testimonials` - Create testimonial
- `GET /testimonials/:id` - Get single testimonial
- `PUT /testimonials/:id` - Update testimonial
- `DELETE /testimonials/:id` - Delete testimonial

### Utility Endpoints
- `GET /profile` - Get user profile
- `GET /settings` - Get app settings
- `POST /upload` - Upload file to S3
- `POST /contact` - Submit contact form
- `POST /auth/renew-token` - Renew authentication token
- `POST /stripe/webhook` - Stripe webhook handler
- `POST /paypal/webhook` - PayPal webhook handler

### Instagram Endpoints
- `POST /instagram/sync` - Sync Instagram posts
- `GET /instagram/posts` - Get Instagram posts
- `GET /instagram/media-proxy` - Proxy Instagram media

## 🔐 Authentication

The API uses AWS Cognito for authentication with three separate user pools:

1. **User Pool** - Regular users
2. **Alim Pool** - Scholars who respond to requests
3. **Admin Pool** - Administrative users

### Authentication Header

Include the Cognito ID token in requests:

```
x-id-token: <cognito_id_token>
```

### Authorization

Routes are protected with role-based access control:

```javascript
// Example: Only users and alims can access
router.get('/istekharas', authenticate, authorize(['user', 'alim']), controller);
```

## 📊 Database Schema

The application uses the existing Django database tables:

- `api_user` - User accounts
- `api_alim` - Alim (scholar) accounts
- `api_istekhara` - Istekhara requests
- `api_istekharaquota` - Purchase quotas
- `api_testimonial` - User testimonials
- `api_contactform` - Contact form submissions
- `api_instagrampost` - Instagram posts
- `api_instagrampostimage` - Instagram post images

## 🔄 Migration from Django

### Key Differences

1. **ORM**: Sequelize instead of Django ORM
2. **Middleware**: Express middleware instead of Django middleware
3. **Routing**: Express Router instead of Django URL patterns
4. **Error Handling**: Custom error handlers matching Django's response format

### Response Format

All responses maintain Django's format:

```json
{
  "message": "Success message",
  "result": { /* data */ },
  "status": true,
  "status_code": 200
}
```

### Error Responses

```json
{
  "message": "Error message",
  "result": {},
  "status": false,
  "status_code": 400
}
```

## 🧪 Testing

Test the API endpoints:

```bash
# Test user registration
curl -X POST http://localhost:8000/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Test123!"}'

# Test user login
curl -X POST http://localhost:8000/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

## 📦 Project Structure

```
├── src/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── controllers/
│   │   ├── userController.js    # User endpoints
│   │   ├── alimController.js    # Alim endpoints
│   │   ├── adminController.js   # Admin endpoints
│   │   ├── istekharaController.js
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.js              # Authentication & authorization
│   │   └── errorHandler.js      # Error handling
│   ├── models/
│   │   ├── index.js             # Model relationships
│   │   ├── User.js
│   │   ├── Alim.js
│   │   ├── Istekhara.js
│   │   └── ...
│   ├── routes/
│   │   ├── index.js             # Main router
│   │   ├── userRoutes.js
│   │   ├── alimRoutes.js
│   │   └── ...
│   ├── services/
│   │   ├── cognito.js           # AWS Cognito service
│   │   ├── email.js             # AWS SES service
│   │   └── s3.js                # AWS S3 service
│   ├── utils/
│   │   └── quran.js             # Quran data utilities
│   └── server.js                # Application entry point
├── .env.example                 # Environment variables template
├── package.json
└── README.md
```

## 🚨 Important Notes

### Database Compatibility

- Uses existing Django table names (e.g., `api_user`, `api_alim`)
- Column names match Django's snake_case convention
- Foreign key relationships preserved
- No database migration needed - works with existing data

### API Compatibility

- All endpoints maintain exact same paths
- Request/response formats identical
- Status codes match Django behavior
- Error messages preserved
- Query parameters work the same way

### Frontend Compatibility

**No frontend changes required!** The Express backend is a drop-in replacement for the Django backend.

## 🔧 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql -U postgres -d istekhara -c "SELECT 1"
```

### Cognito Token Issues

- Verify Cognito pool IDs and client IDs
- Check token expiration
- Ensure correct region configuration

### Email Sending Issues

- Verify SES credentials
- Check SES sending limits
- Confirm email addresses are verified in SES

## 📝 License

This project maintains the same license as the original Django project.

## 🤝 Contributing

When contributing, ensure:
- API compatibility is maintained
- All tests pass
- Code follows existing patterns
- Documentation is updated

## 📞 Support

For issues or questions, contact the development team or open an issue in the repository.
