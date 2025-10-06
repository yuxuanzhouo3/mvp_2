# Login Credentials

## Dummy User Accounts

Use these credentials to test the application with different subscription tiers:

### Free Account
- **Email:** `demo@example.com`
- **Password:** `demo123`
- **Tier:** Free (no payment required)

### Pro Account
- **Email:** `pro@example.com`
- **Password:** `demo123`
- **Tier:** Pro ($9.99/month)
- **Payment Method:** Stripe (demo)

### Max Enterprise Account
- **Email:** `enterprise@example.com`
- **Password:** `demo123`
- **Tier:** Enterprise ($49.99/month)
- **Payment Method:** PayPal (demo)

## Features

### After Login:
- Click the **Settings** icon (⚙️) in the top right corner to access your account settings
- **Account Tab**: View your subscription tier and payment method
- **Payment Tab**: Add or update payment information (credit card details)
- **Pro Tab**: View subscription options and upgrade/downgrade
- Click **Pro** link in header to see full pricing page with:
  - 3 subscription tiers (Free, Pro, Max Enterprise)
  - Stripe and PayPal payment options
  - Detailed feature comparisons
  - FAQ section

## Running the Application

```bash
# Install dependencies
pnpm install

# Run database migrations
npx prisma migrate dev

# Seed dummy users (if not already done)
pnpm run seed

# Start development server
pnpm dev
```

Visit http://localhost:3000 and login with the credentials above!
