# Turinova PHP Optimization Service

This service provides material optimization calculations for the ERP Turinova system.

## Features

- Material cutting optimization using guillotine algorithm
- Edge banding calculations
- Cost calculations for materials and cutting
- Integration with Supabase PostgreSQL database
- RESTful API endpoints

## API Endpoints

- `POST /` - Calculate material optimization
- `GET /` - Service information

## Environment Variables

Required environment variables for Railway deployment:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_PASSWORD` - Database password
- `SUPABASE_DB` - Database name (default: postgres)
- `SUPABASE_USER` - Database user (default: postgres)
- `SUPABASE_HOST` - Database host
- `SUPABASE_PORT` - Database port (default: 5432)

## Local Development

```bash
# Install PHP dependencies (if any)
composer install

# Start local server
php -S localhost:8000
```

## Railway Deployment

This service is configured for Railway deployment with PHP 8.0+ support.
